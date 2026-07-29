---
name: fastapi
description: "Use when building, reviewing, testing, securing or shipping a FastAPI / async Python service — routers, Pydantic v2 schemas, dependency injection, async SQLAlchemy 2.0, OAuth2/JWT, ASGITransport tests, production wiring. NOT language-level Python or packaging (that is `python`), NOT engine-level SQL (that is `postgresdb`), NOT framework-agnostic REST contracts (that is `api-design`)."
tags: [python, api, async, backend, rest]
recommends: [postgresdb, secure-coding, deployment]
origin: risco
---

# FastAPI & modern Python services

The single authoritative skill for building, reviewing, testing, securing and shipping an
async FastAPI service on Python 3.12+. The mental model: **the app is a thin async HTTP
layer over typed dependencies, a service/repository core, and explicit DB sessions. Routes
validate and delegate; they never own business logic, raw SQL, or secrets.**

Pinned stack: Python 3.12+, FastAPI 0.136+, Starlette 1.0+ (FastAPI 0.136 requires it;
avoid <1.0.1, GHSA-86qp-5c8j-p5mr), Pydantic v2 (2.7+) + pydantic-settings 2.x,
SQLAlchemy 2.0 async, Alembic 1.13+, asyncpg 0.30 / psycopg 3, httpx 0.28+,
pytest 8 + pytest-asyncio 1.0+ (`asyncio_mode=auto`), ruff 0.7+, mypy 1.13+ strict,
uv 0.5+, uvicorn 0.32+ / gunicorn 23+ + uvicorn-worker 0.3+, PyJWT 2.10+, argon2-cffi 23+,
pip-audit 2.7+, PostgreSQL 16. (All lower bounds; install the latest in each line.)

> **⚠️ SDD new-feature gate — read this first.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP — do **not** write feature code yet. Hand off to `../specify/SKILL.md` first: it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build here directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

Out of scope, and where it goes instead: [`django`](../django/SKILL.md) for Django; Flask / sync WSGI,
notebooks and CLI-only scripts (no skill); language-level Python, typing and packaging →
[`python`](../python/SKILL.md); framework-agnostic REST contracts — status codes, URL naming, versioning,
cursor vs offset → [`api-design`](../api-design/SKILL.md) (this skill covers their FastAPI *implementation*);
engine-level schema, indexing, EXPLAIN, zero-downtime migrations, PgBouncer →
[`postgresdb`](../postgresdb/SKILL.md); language-agnostic injection / secret / authz theory →
[`secure-coding`](../secure-coding/SKILL.md); Dockerfile, Compose and CI/CD mechanics →
[`deployment`](../deployment/SKILL.md) (this skill keeps only a Docker *note*).

## Decision rules

1. `async def` for any I/O route + async drivers (asyncpg, httpx); never `requests`/`psycopg2`/blocking calls on the loop (offload via `await anyio.to_thread.run_sync`).
2. Three Pydantic models per resource — `XCreate`/`XUpdate`/`XResponse` (`from_attributes=True`); responses never leak hashes/tokens/internal flags.
3. Request-scoped resources via `Annotated[T, Depends(...)]`, never built inline — so tests can override them.
4. One DB session per request via `get_db` (commit-on-success / rollback-on-exception); handlers never commit.
5. One error envelope `{"error":{"code","message","details?"}}` via centralized handlers; never leak stack traces / SQL.
6. Settings from `pydantic-settings` (`BaseSettings`), never scattered `os.getenv`.
7. Validate JWT `exp`/`iss`/`aud` and pin `algorithms=["RS256"|"HS256"]` explicitly.
8. Tests: `ASGITransport` + `dependency_overrides` on a transactional DB; CI gates on `ruff`, `mypy --strict`, `pytest --cov`, `pip-audit`.

## Project layout

```text
app/
├── main.py            # create_app() factory + lifespan; app = create_app()
├── core/
│   ├── config.py      # Settings(BaseSettings) + get_settings()
│   ├── security.py    # hashing, JWT encode/decode
│   └── logging.py     # structlog / JSON logging setup
├── api/
│   ├── deps.py        # get_db, get_current_user, Pagination, require_roles
│   └── routers/
│       ├── users.py
│       └── health.py
├── schemas/           # Pydantic v2 models (Create/Update/Response)
│   └── user.py
├── models/            # SQLAlchemy 2.0 DeclarativeBase models
│   └── user.py
├── db/
│   ├── base.py        # engine, async_sessionmaker, Base
│   └── repository.py  # generic async Repository[ModelT]
├── services/          # business logic (no FastAPI imports)
│   └── user_service.py
├── exceptions.py      # AppError hierarchy + register_exception_handlers
tests/                 # pytest-asyncio + ASGITransport
alembic/               # async env.py + versions/
pyproject.toml         # ruff + mypy strict + pytest config
```

Routers stay thin, services hold the logic, the repository/CRUD layer owns persistence.

## Application factory + lifespan

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import health, users
from app.core.config import Settings, get_settings
from app.db.base import engine
from app.exceptions import register_exception_handlers

# Routers paired with their mount prefix + OpenAPI tag, declared once so the factory
# stays a flat loop instead of a wall of include_router() calls.
ROUTERS = (
    (health.router, "/health", "health"),
    (users.router, "/api/v1/users", "users"),
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Open pools/caches on startup (here), never at import time, so importing the module has
    # no side effects (tests and Alembic import it freely).
    yield
    await engine.dispose()   # release pooled DB connections so workers exit cleanly


def _install_cors(app: FastAPI, settings: Settings) -> None:
    if not settings.cors_origins:
        return  # no browser clients configured -> skip the middleware entirely
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,   # explicit per-env list, never ["*"] with creds
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title=settings.api_title, version=settings.api_version, lifespan=lifespan)

    register_exception_handlers(app)
    _install_cors(app, settings)
    for router, prefix, tag in ROUTERS:
        app.include_router(router, prefix=prefix, tags=[tag])
    return app


app = create_app()
```

Accepting an optional `settings` argument lets tests build the app with overridden config
without touching the `get_settings` cache. **Bad** = `allow_origins=["*"]` with
`allow_credentials=True` — browsers reject it and Starlette refuses to echo `*` for
credentialed requests. → [`references/production.md`](references/production.md) for proxy headers / logging wiring at
startup.

To inject servers / security schemes / a logo into the generated OpenAPI doc, assign a
custom builder to `app.openapi` inside `create_app()`. → [`references/production.md`](references/production.md)
(Customizing the OpenAPI schema).

## Configuration (pydantic-settings)

```python
from functools import lru_cache

from pydantic import PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    api_title: str = "Service API"
    api_version: str = "1.0.0"
    environment: str = "development"
    database_url: PostgresDsn
    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "service-api"
    jwt_audience: str = "service-clients"
    access_token_ttl_seconds: int = 900
    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env/.env
```

**Bad** = `DB_URL = os.environ["DB_URL"]` at import time (crashes on import, untyped,
unmockable). **Good** = inject `get_settings` as a dependency so tests override it.

## Pydantic v2 models (Create/Update/Response split)

```python
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field

# Reusable constrained types keep the same rule in one place across the three models.
FullName = Annotated[str, Field(min_length=1, max_length=100)]
RawPassword = Annotated[str, Field(min_length=12, max_length=128)]


class UserInput(BaseModel):
    """Fields a client may send. Create/Update narrow this; Response never inherits it."""

    email: EmailStr
    full_name: FullName


class UserCreate(UserInput):
    password: RawPassword


class UserUpdate(BaseModel):
    # Every field optional: a PATCH sends only what changes.
    email: EmailStr | None = None
    full_name: FullName | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # populate straight off ORM attributes

    id: UUID
    email: EmailStr
    full_name: str
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def label(self) -> str:
        return f"{self.full_name} <{self.email}>"
```

v2 migration cheats: use `.model_dump()` not `.dict()`; `.model_validate(obj)` not
`.from_orm()`; `model_config = ConfigDict(...)` not class `Config`;
`field_validator`/`model_validator` not `@validator`/`@root_validator`.

**Bad** = a response model with `hashed_password: str` (leaks the hash). **Good** = the
`UserResponse` above (no secret fields). → [`references/security.md`](references/security.md).

## Dependency injection

```python
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import async_session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    session = async_session_factory()
    try:
        yield session
        await session.commit()   # commit only if the handler returned without raising
    except Exception:
        await session.rollback()  # any error (incl. HTTP exceptions) unwinds the txn
        raise
    finally:
        await session.close()    # always release the connection back to the pool


DbSession = Annotated[AsyncSession, Depends(get_db)]


@dataclass(frozen=True)
class Pagination:
    limit: int
    offset: int


def get_pagination(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


PageParams = Annotated[Pagination, Depends(get_pagination)]
```

→ [`references/database.md`](references/database.md) for `async_session_factory` wiring; → [`references/security.md`](references/security.md)
for `get_current_user` and `require_roles`.

## Routers & endpoints

```python
from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession, PageParams
from app.schemas.user import UserCreate, UserResponse
from app.services import user_service

router = APIRouter()


@router.get("", response_model=list[UserResponse])
async def list_users(db: DbSession, page: PageParams) -> list[UserResponse]:
    return await user_service.list_users(db, limit=page.limit, offset=page.offset)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: DbSession, response: Response) -> UserResponse:
    user = await user_service.create_user(db, payload)
    response.headers["Location"] = f"/api/v1/users/{user.id}"
    return user
```

**Bad** = hashing the password + building `select()` + business rules inline in the route.
**Good** = `await user_service.create_user(db, payload)` (route stays thin). `CurrentUser`
is defined in `references/security.md`.

## Error handling & envelope

```python
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import logger


class AppError(Exception):
    def __init__(self, message: str, code: str, status_code: int = 500,
                 details: list[dict] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


class NotFoundError(AppError):
    def __init__(self, resource: str, ident: str) -> None:
        super().__init__(f"{resource} not found: {ident}", "not_found", 404)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(map(str, e["loc"][1:])), "message": e["msg"], "code": e["type"]}
                   for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": "Request validation failed",
                               "details": details}},
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "An unexpected error occurred"}},
        )
```

Keep this envelope identical across every handler — one `code`/`message`/`details` shape so
clients parse errors once. Subclass `AppError` per failure (each fixes a `code` + status):
`NotFoundError` (404), `ConflictError` (409), `Unauthorized` (401), `Forbidden` (403) — full
hierarchy in → [`references/production.md`](references/production.md) (AppError subclasses).
[`secure-coding`](../secure-coding/SKILL.md) has the why: error responses must never leak internals
(stack traces, SQL, secrets).

## Async SQLAlchemy 2.0 (essentials)

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import get_settings

engine = create_async_engine(str(get_settings().database_url), pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    full_name: Mapped[str]
    hashed_password: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


async def list_users(db: AsyncSession, limit: int, offset: int) -> list[User]:
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())
```

Fetch by PK with `await db.get(Model, pk)`, by unique key with `.scalar_one_or_none()`; eager-load with
`selectinload` (collections) / `joinedload` (many-to-one).
→ [`references/database.md`](references/database.md) for relationships, N+1 / eager loading, repository, Alembic, pooling.

## Background tasks vs real queues

```python
from fastapi import BackgroundTasks


# Good: in-request, non-durable side effect (best-effort email).
@router.post("/signup")
async def signup(background: BackgroundTasks) -> dict[str, str]:
    background.add_task(send_welcome_email, "user@example.com")
    return {"status": "accepted"}
```

Anything needing **retries, durability, or cross-process execution** (payment webhooks, large
jobs) goes to a real broker (Celery / Arq / Dramatiq), **never** `BackgroundTasks` — it runs
in-process and dies with the worker, with no retry or visibility.

## Testing

Drive the app in-process with `httpx.AsyncClient(transport=ASGITransport(app=create_app()))`
and swap real dependencies via `app.dependency_overrides[get_db] = lambda: db_session` against
a transactional fixture — so every test rolls back. Use `pytest-asyncio` with
`asyncio_mode = "auto"` (no `@pytest.mark.asyncio`), and assert secrets never serialize (e.g.
`assert "hashed_password" not in resp.json()`). TDD red→green→refactor. Full fixtures
(transactional `begin_nested`, auth overrides, respx, coverage gate) in
→ [`references/testing.md`](references/testing.md).

## Security

Full hardening playbook — argon2 hashing, OAuth2 + JWT (claims validated, `algorithms`
pinned), `get_current_user`/`require_roles` RBAC, CORS, shared-store rate limiting, injection,
`SecretStr` + log redaction, security headers, `pip-audit` — lives in
→ [`references/security.md`](references/security.md) — including the exact `argon2.PasswordHasher().hash(pw)` and
`jwt.decode(t, key, algorithms=[...], audience=..., issuer=...)` calls. See
[`secure-coding`](../secure-coding/SKILL.md) for the language-agnostic theory.

## Production

ASGI/worker math, structured JSON logging + request-id, liveness vs readiness probes, graceful
shutdown, keyset pagination, caching, `ORJSONResponse` and proxy headers all live in
→ [`references/production.md`](references/production.md). See [`deployment`](../deployment/SKILL.md) for the
Dockerfile and CI/CD pipeline.

## Anti-patterns

| Anti-pattern | Why it breaks → do this |
|---|---|
| `requests` (or any blocking call) inside an `async def` route | Blocks the event loop → use `httpx.AsyncClient`. |
| `.dict()` / `from_orm()` on a model | Pydantic v2: use `.model_dump()`; `.dict()`/`from_orm` are deprecated. |
| Returning the ORM object with no `response_model` | Leaks columns + lazy-loads in serializer → declare `response_model`. |
| `allow_origins=['*']` together with credentials | Browser rejects it; Starlette blocks it. Pin origins. |
| Decoding a JWT without checking `exp`/`aud` | Forged/replayed tokens. Validate exp/iss/aud + pin alg. |
| Building the WHERE clause with an f-string | SQLi. Bound params / SQLAlchemy expressions only. |
| One global session shared by the whole app | Cross-request data bleed + concurrency bugs. One session per request. |
| Catching `Exception` and returning its message | Leaks internals. Log it, return generic 500. |
| `BackgroundTasks` for a payment-webhook retry | No durability/retry. Use a real broker. |
| Skipping `mypy --strict` because it is noisy | Strict catches the bugs FastAPI's runtime won't. Keep it. |
| Committing inside the handler | Let `get_db` own commit/rollback; handlers stay thin. |
| Default-mutable arg / engine built at import time | Mutable defaults bite; engine must live in lifespan. |

## Project grounding

In a project with a `02-DOCS/` layer ([`harness`](../harness/SKILL.md)), read
`02-DOCS/wiki/stack/fastapi.md` first and stay consistent with it; create or update it with this
project's real choices — auth model (JWT/OAuth2 provider, token TTLs), DB session + migration tool,
error-envelope shape, settings/secrets approach, deployment target — bump its `Updated` date, and index
it in `02-DOCS/wiki/index.md`. No `02-DOCS/`? Skip silently. Conventions are *recorded, not gated* —
never block the task on this.

Verify gate: [`scripts/verify.sh`](scripts/verify.sh).
