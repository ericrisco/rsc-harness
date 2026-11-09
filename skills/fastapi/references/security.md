# Securing a FastAPI service

Concrete, FastAPI-specific hardening on Python 3.12+: argon2-cffi 23+ password hashing, PyJWT
2.10+ with validated claims and **pinned algorithms**, RBAC dependencies, env-specific CORS,
shared-store rate limiting, injection-proof queries, `SecretStr` handling, log redaction,
security headers, and dependency auditing. For language-agnostic theory, **See Also
`security-audit`**.

## Password hashing

Use argon2id via argon2-cffi. Never MD5/SHA/plain (no work factor, GPU-crackable). bcrypt is an
acceptable fallback where argon2 is unavailable. Verification is constant-time and raises on
mismatch; re-hash on successful login when stored parameters fall behind current defaults.

```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()


def hash_password(plain: str) -> str:
    return ph.hash(plain)


def verify_password(stored_hash: str, plain: str) -> tuple[bool, str | None]:
    try:
        ph.verify(stored_hash, plain)
    except VerifyMismatchError:
        return False, None
    new_hash = ph.hash(plain) if ph.check_needs_rehash(stored_hash) else None
    return True, new_hash
```

When `verify_password` returns a non-`None` second element, persist it: the stored hash used
weaker parameters and was just upgraded transparently on a correct login.

## OAuth2 password flow + JWT

`OAuth2PasswordBearer` declares the token scheme (and powers the Swagger "Authorize" button).
The login route verifies credentials and returns a short-lived access token.

```python
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.api.deps import DbSession
from app.core.security import create_access_token, verify_password
from app.exceptions import Unauthorized
from app.services import user_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
router = APIRouter()


@router.post("/login")
async def login(db: DbSession, form: OAuth2PasswordRequestForm = Depends()) -> dict[str, str]:
    user = await user_service.get_by_email(db, form.username)
    if user is None:
        raise Unauthorized("Invalid credentials")
    ok, new_hash = verify_password(user.hashed_password, form.password)
    if not ok:
        raise Unauthorized("Invalid credentials")
    if new_hash is not None:
        user.hashed_password = new_hash
        await db.flush()
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}
```

Mint tokens with explicit `exp`, `iat`, `iss`, `aud`, `sub`; decode by **pinning `algorithms`**
and requiring the claims — never trust the token header's `alg`.

```python
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings


def create_access_token(subject: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": subject, "iss": s.jwt_issuer, "aud": s.jwt_audience,
        "iat": now, "exp": now + timedelta(seconds=s.access_token_ttl_seconds),
    }
    return jwt.encode(payload, s.jwt_secret.get_secret_value(), algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    s = get_settings()
    return jwt.decode(
        token, s.jwt_secret.get_secret_value(),
        algorithms=[s.jwt_algorithm],          # pinned — never accept the header's alg
        audience=s.jwt_audience, issuer=s.jwt_issuer,
        options={"require": ["exp", "iss", "aud", "sub"]},
    )
```

Bad: `jwt.decode(token, key, algorithms=["none"])` or omitting `algorithms` entirely — both
accept `alg=none`, making tokens forgeable with no signature. For asymmetric keys prefer RS256
(verify with the public key; sign only on the issuer). Resolve the token into the current user
in a dependency:

```python
from typing import Annotated

import jwt
from fastapi import Depends

from app.api.deps import DbSession
from app.core.security import decode_token, oauth2_scheme
from app.exceptions import Unauthorized
from app.models.user import User
from app.services import user_service


async def get_current_user(
    db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]
) -> User:
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise Unauthorized("Invalid or expired token") from exc
    user = await user_service.get_user(db, payload["sub"])
    if user is None or not user.is_active:
        raise Unauthorized("User not found or inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
```

## RBAC

A dependency factory that reads a `role` claim and raises `Forbidden` (403) when the caller's
role is not permitted. Compose it into a router via `dependencies=[Depends(require_roles("admin"))]`
or as a typed parameter.

```python
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends

from app.core.security import decode_token, oauth2_scheme
from app.exceptions import Forbidden, Unauthorized


def require_roles(*allowed: str) -> Callable[..., None]:
    async def _dep(token: Annotated[str, Depends(oauth2_scheme)]) -> None:
        try:
            payload = decode_token(token)
        except Exception as exc:
            raise Unauthorized() from exc
        if payload.get("role") not in allowed:
            raise Forbidden(f"Requires one of: {', '.join(allowed)}")
    return _dep
```

For private resources, prefer returning **404 over 403** when the caller is authenticated but
not the owner — a 403 confirms the resource exists, leaking its presence to a probing attacker.
Use 403 only where existence is already public and the action specifically is forbidden.

## CORS

CORS is enforced by the browser, not a server-side authorization control — but a wrong config
either breaks legitimate frontends or invites credentialed cross-origin abuse. Pin an explicit
origin list per environment; the `["*"]` + credentials combination is invalid (the browser
rejects it and Starlette refuses to echo `*` for credentialed requests).

```python
from fastapi.middleware.cors import CORSMiddleware

# settings.cors_origins, e.g. dev: ["http://localhost:3000"], prod: ["https://app.example.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,          # explicit list per env — never ["*"] with creds
    allow_credentials=bool(settings.cors_origins),
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,                                  # cache preflight to cut OPTIONS chatter
)
```

## Rate limiting

Limits must live in a **shared store** (Redis, or the API gateway), never per-process
counters. With multiple uvicorn workers, replicas, or serverless instances, per-process limits
fail open — each process counts independently, so N processes allow N× the intended rate.

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, storage_uri="redis://redis:6379/0")


# On the app:
#   app.state.limiter = limiter
#   app.add_exception_handler(RateLimitExceeded, rate_limit_handler)


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": "60"},
        content={"error": {"code": "rate_limited", "message": "Too many requests", "details": []}},
    )


# On the route:
#   @router.post("/login")
#   @limiter.limit("5/minute")
#   async def login(request: Request, ...): ...
```

Rate-limit auth endpoints (`/login`, `/register`, password reset) and expensive writes first —
those are the brute-force and abuse targets.

## Injection

Pydantic validates request bodies; `Query(ge=, le=)` and `Path(...)` bound query/path params.
For the database, use SQLAlchemy expressions or bound parameters — never interpolate user input
into SQL.

```python
from sqlalchemy import select, text

from app.models.user import User


# Bad: f-string SQL -> classic SQLi.
async def bad(db, email: str):
    return await db.execute(text(f"SELECT * FROM users WHERE email = '{email}'"))  # noqa: S608


# Good: ORM expression — value is bound, never concatenated.
async def good_orm(db, email: str):
    return await db.execute(select(User).where(User.email == email))


# Good: raw SQL with bound params when you truly need text().
async def good_text(db, email: str):
    return await db.execute(text("SELECT * FROM users WHERE email = :email"), {"email": email})
```

## Secret handling

- Type every secret as `SecretStr` in `Settings`; its `repr` renders `**********`, so it cannot
  leak via logs or tracebacks.
- Call `.get_secret_value()` only at the point of use (signing/decoding), never to store or log.
- Keep `.env` gitignored; commit a `.env.example` with names but no values.
- In production read secrets from a manager (AWS Secrets Manager, Vault, Doppler) injected as
  env vars; rotate signing keys and support a short overlap window during rotation.

```python
from app.core.config import get_settings

s = get_settings()
key = s.jwt_secret.get_secret_value()   # only here, only momentarily
# logger.info("config", jwt_secret=s.jwt_secret)  # safe: logs "**********", not the value
```

## Log redaction

Strip credentials and PII before logs are emitted. A structlog processor (or stdlib filter) that
masks known-sensitive keys, applied app-wide:

```python
from typing import Any

SENSITIVE = {"authorization", "cookie", "set-cookie", "password", "token", "access_token",
             "refresh_token", "secret", "ssn", "credit_card"}


def redact_processor(_logger: object, _method: str, event: dict[str, Any]) -> dict[str, Any]:
    for key in list(event):
        if key.lower() in SENSITIVE:
            event[key] = "***REDACTED***"
    return event


# Wire into structlog.configure(processors=[..., redact_processor, JSONRenderer()])
```

## Security headers & misc

```python
from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import get_settings

settings = get_settings()
in_prod = settings.environment == "production"

# Disable interactive docs in prod if the API is not public.
app = FastAPI(docs_url=None if in_prod else "/docs", redoc_url=None if in_prod else "/redoc")

# Reject Host-header spoofing / DNS rebinding.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["api.example.com", "*.example.com"])
```

Add response headers via a small middleware: `Strict-Transport-Security`
(`max-age=63072000; includeSubDomains`), `Content-Security-Policy` tuned to the API,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. Enforce a request body size limit at
the proxy (e.g. nginx `client_max_body_size`) so oversized payloads never reach the app.

## Dependency audit

```bash
uv run pip-audit
uv pip compile --generate-hashes -o requirements.lock pyproject.toml
uv pip sync requirements.lock
```

Gate CI on `pip-audit`: a non-zero exit means a dependency has a known CVE. Pin and hash the
lockfile so installs are reproducible and tamper-evident, and enable Dependabot (or Renovate) to
open update PRs automatically. Treat a failing audit as a build break, not a warning.

## See Also

- [`security-audit`](../../security-audit/SKILL.md) — language-agnostic injection, authz, and secret-handling rules (never leak internals through error responses).
- [`production.md`](production.md) — TLS termination, proxy headers, observability.
- [`postgresdb`](../../postgresdb/SKILL.md) — row-level security, DB roles/grants, and PgBouncer auth.
