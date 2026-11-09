# Fixes by stack — OWASP Top 10 vulnerable→fixed, plus authn/authz

Every confirmed finding ships a fix for *this* stack — never "consider
sanitizing". This file holds the copy-pasteable Bad/Good pairs. Propose them as
diffs; apply only with the person's permission (the fixing flow owns backup,
rollback and the re-check).

Stacks and versions assumed: Python 3.12+ / FastAPI ≥0.115 / Pydantic v2 /
SQLAlchemy 2.0, Next.js 15 App Router / React 19 / TS / Zod ≥3.23 / Auth.js v5,
Go 1.22+ (`http.ServeMux`, `log/slog`), Flutter / Dart 3, PostgreSQL 16. Where a
category is most acute in one language it leads with that one, but always gives
Python plus at least one other. A01, A03 and A10 get all three (Python / Go / TS)
because they are the highest-impact, most stack-agnostic classes.

Rank before you fix: reachable + user-controlled + meaningful sink comes first.
Report the highest-impact reachable findings first, not a flat checklist.

## Contents

- [Fastest fix per category](#fastest-fix-per-category)
- [A01 — Broken Access Control / IDOR](#a01--broken-access-control--idor)
- [A02 — Cryptographic Failures](#a02--cryptographic-failures)
- [A03 — Injection](#a03--injection)
- [A04 — Insecure Design](#a04--insecure-design)
- [A05 — Security Misconfiguration](#a05--security-misconfiguration)
- [A06 — Vulnerable & Outdated Components](#a06--vulnerable--outdated-components)
- [A07 — Identification & Authentication Failures](#a07--identification--authentication-failures)
- [A08 — Software & Data Integrity (supply chain)](#a08--software--data-integrity-supply-chain)
- [A09 — Logging & Monitoring Failures](#a09--logging--monitoring-failures)
- [A10 — SSRF](#a10--ssrf-server-side-request-forgery)
- [Input validation, XSS and uploads](#input-validation-xss-and-uploads)
- [CORS, security headers, rate limiting, failing closed](#cors-security-headers-rate-limiting-failing-closed)
- [AuthN / AuthZ](#authn--authz)
- [Anti-patterns](#anti-patterns)

## Fastest fix per category

| OWASP 2021 | The mistake you'll actually see | Stack-correct fix in one phrase |
|---|---|---|
| A01 Broken Access Control | `db.get(id)` returned to any authed user | Ownership-scoped query; 404 (not 403) on miss |
| A02 Cryptographic Failures | SHA-256 password hash; `random` token | Argon2id + CSPRNG (`secrets`/`crypto/rand`) |
| A03 Injection | f-string SQL / `shell=True` | Bound params / arg list, no shell / canonicalize path |
| A04 Insecure Design | No rate limit, replayable payment | Lockout + idempotency-key `UNIQUE` constraint |
| A05 Security Misconfiguration | `debug=True`, `*`+credentials CORS | `debug=False`, explicit origin allowlist, headers |
| A06 Vulnerable Components | Ignored transitive CVE | Audit + upgrade/override/replace |
| A07 Auth Failures | Reusable session id, user enumeration | Lockout + rotate session id + generic error |
| A08 Data Integrity | `curl \| bash`, unpinned CDN script | `npm ci`/`go mod verify` + SRI |
| A09 Logging Failures | No authz-fail log; PII in logs | Structured log on `user_id`, redact secrets |
| A10 SSRF | Fetch user-supplied URL directly | https-only + IP allowlist + pin dialed IP |

## A01 — Broken Access Control / IDOR

What: a row or function is reachable by a caller who should not see it.
Why exploitable: the id is in the URL/body and the server trusts authentication
("they're logged in") instead of checking authorization ("do they own *this*").
Authorize on the **server**, per object, on **every** request, deny by default:
the id is attacker-controlled, so the ownership predicate in the query is the
only thing between a stranger and the row.

### Python (FastAPI + SQLAlchemy 2.0)

```python
# BAD — any authenticated user can read any document by id.
@router.get("/documents/{doc_id}")
def get_doc(doc_id: int, db: Session = Depends(get_db)):
    return db.get(Document, doc_id)

# GOOD — ownership-scoped query; 404 (not 403) on miss to prevent enumeration;
# an output schema instead of the raw ORM object, so no extra fields leak.
from fastapi import Depends, HTTPException
from sqlalchemy import select

@router.get("/documents/{doc_id}")
def get_doc(
    doc_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    doc = db.execute(
        select(Document).where(
            Document.id == doc_id,
            Document.owner_id == user.id,
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")
    return DocumentOut.model_validate(doc)
```

### Go (1.22 `ServeMux`, `slog`)

```go
// BAD — path id goes straight to the query; no ownership check.
mux.HandleFunc("GET /documents/{id}", func(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")
    var body string
    _ = db.QueryRowContext(r.Context(), "SELECT body FROM documents WHERE id=$1", id).Scan(&body)
    _, _ = w.Write([]byte(body))   // returned to ANY caller
})

// GOOD — userID from the authenticated context; scoped query; 404 on miss.
mux.HandleFunc("GET /documents/{id}", func(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(userKey).(int64)
    if !ok {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }
    id := r.PathValue("id")
    var body string
    err := db.QueryRowContext(r.Context(),
        "SELECT body FROM documents WHERE id=$1 AND owner_id=$2", id, userID,
    ).Scan(&body)
    if err == sql.ErrNoRows {
        slog.Warn("authz_miss", "user", userID, "doc", id)
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    if err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    _, _ = w.Write([]byte(body))
})
```

### TS (Next.js 15 App Router — Route Handler / Server Action)

```ts
// BAD — returns the row from the id, assuming a session exists.
// Next.js 15: params is a Promise — await it (sync access is a removed-shim path).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  return Response.json(doc);
}

// GOOD — auth() guard + ownership scope + notFound() on miss.
import { auth } from "@/auth";
import { notFound } from "next/navigation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session) notFound();
  const doc = await db.document.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!doc) notFound();
  return Response.json(doc);
}
```

> **Server Actions are public POST endpoints.** Re-authorize inside the action
> body on every call. Conditionally rendering the button or hiding the form is
> UX only — an attacker calls the action directly.

### Mass-assignment guard

```python
# Pydantic v2 — reject unknown fields; never bind owner_id/role from the body.
from pydantic import BaseModel, ConfigDict

class DocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str
    body: str
    # owner_id is set from current_user server-side, never from the request.
```

```go
// Go — decode into an allowlist struct that has no owner_id / role field.
type docCreate struct {
    Title string `json:"title"`
    Body  string `json:"body"`
}
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields()
var in docCreate
if err := dec.Decode(&in); err != nil { /* 400 */ }
```

```ts
// Zod — .strict() rejects extra keys; map only the allowed ones.
const DocCreate = z.object({ title: z.string(), body: z.string() }).strict();
const data = DocCreate.parse(await req.json());
await db.document.create({ data: { ...data, ownerId: session.user.id } });
```

## A02 — Cryptographic Failures

What: passwords or data at rest protected with fast/broken primitives or
predictable randomness. Why exploitable: MD5/SHA-1 hashes crack offline at
billions per second; `random`/`Math.random` tokens are guessable.

```python
# BAD — fast hash, trivially brute-forced; predictable token.
import hashlib, random
pw_hash = hashlib.sha256(password.encode()).hexdigest()
token = str(random.randint(0, 10**9))

# GOOD — Argon2id for passwords; CSPRNG for tokens.
from argon2 import PasswordHasher
import secrets

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)  # 64 MiB
pw_hash = ph.hash(password)
token = secrets.token_urlsafe(32)
```

```go
// GOOD (Go) — Argon2id and crypto/rand; never math/rand for secrets.
import ("crypto/rand"; "golang.org/x/crypto/argon2")
salt := make([]byte, 16); _, _ = rand.Read(salt)
key := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
```

```ts
// GOOD (TS) — crypto.randomBytes, never Math.random for tokens.
import { randomBytes } from "node:crypto";
const token = randomBytes(32).toString("base64url");
```

Data at rest: AES-GCM (an AEAD with integrity), e.g. `cryptography`'s
`AESGCM`/`Fernet`. Enforce TLS everywhere; never MD5/SHA-1 for passwords.
Hashing parameters and rehash-on-login: [Password hashing](#password-hashing--argon2id).

## A03 — Injection

What: user input is concatenated into a query, shell command, or path. Why
exploitable: the parser can't tell data from code — `'; DROP TABLE` /
`$(rm -rf)` / `../../etc/passwd` all execute.

### SQL — parameterize, never interpolate

```python
# BAD — f-string SQL is injectable.
db.execute(text(f"SELECT * FROM users WHERE email = '{email}'"))
# GOOD — SQLAlchemy 2.0 bound parameters.
from sqlalchemy import select
db.execute(select(User).where(User.email == email))
```

```go
// BAD — Sprintf into the query string.
db.QueryContext(ctx, fmt.Sprintf("SELECT id FROM users WHERE email='%s'", email))
// GOOD — placeholders; the driver binds values.
db.QueryContext(ctx, "SELECT id FROM users WHERE email=$1", email)
```

```ts
// BAD — string concatenation in raw SQL.
sql.unsafe(`SELECT * FROM users WHERE email = '${email}'`);
// GOOD — postgres.js tagged template parameterizes interpolations.
await sql`SELECT * FROM users WHERE email = ${email}`;
// (Prisma client methods are parameterized; avoid $queryRawUnsafe.)
```

### Command injection — no shell, pass args as a list

```python
# BAD — shell=True with interpolation runs arbitrary commands.
subprocess.run(f"convert {infile} {outfile}", shell=True)
# GOOD — argument vector, no shell.
subprocess.run(["convert", infile, outfile], shell=False, check=True)
```

```go
// BAD — sh -c with a concatenated string.
exec.CommandContext(ctx, "sh", "-c", "convert "+infile+" "+outfile)
// GOOD — program + explicit args, no shell.
exec.CommandContext(ctx, "convert", infile, outfile)
```

Never build a shell string from user input. An argument that starts with `-`
can still be read as an option by the callee; put `--` before user-supplied
positional arguments where the program supports it.

### Path traversal — canonicalize + require base-dir containment

```python
# BAD — user name escapes the base dir via ../.
open(base_dir + "/" + user_name)
# GOOD — resolve and require containment in base.
from pathlib import Path
base = Path(base_dir).resolve()
target = (base / user_name).resolve()
if not target.is_relative_to(base):
    raise ValueError("path traversal")
target.open("rb")
```

```go
// GOOD (Go) — Clean + prefix check against the resolved base.
clean := filepath.Join(base, name) // Join already applies filepath.Clean
if !strings.HasPrefix(clean, filepath.Clean(base)+string(os.PathSeparator)) {
    http.Error(w, "bad path", http.StatusBadRequest)
    return
}
// CAVEAT: filepath.Clean is purely lexical — a symlink inside base can still
// point outside it. If the tree may contain attacker-controlled symlinks,
// resolve them too: real, err := filepath.EvalSymlinks(clean); then re-run the
// prefix check on `real` against an EvalSymlinks'd base. On Go 1.24+,
// os.Root / os.OpenRoot confines opens to the directory and refuses escapes.
```

### NoSQL / operator injection (Mongo-style)

```ts
// BAD — { email: req.body.email } where email is { "$ne": null } returns all.
// GOOD — reject object-typed values and $-prefixed keys before querying.
function assertScalar(v: unknown): asserts v is string | number {
  if (typeof v === "object" || v === null) throw new Error("bad filter value");
}
```

## A04 — Insecure Design

What: the feature is missing a control by design, not by bug. Why exploitable:
brute force, double-charge replays and id enumeration need no "vulnerability",
just usage. Controls: rate limit + lockout on auth (A07); idempotency keys on
payment writes (a `UNIQUE` constraint on `idempotency_key` turns a replayed POST
into a no-op); signed, expiring URLs instead of guessable sequential ids.

**Password reset done right** (the flagship): single-use, store the **hash** of
the token, short TTL, link built from a configured base URL.

```python
# GOOD — issue: store only the hash; email a link from a configured base URL.
import hashlib, secrets
from datetime import datetime, timedelta, timezone

raw = secrets.token_urlsafe(32)
db.add(PasswordReset(
    user_id=user.id,
    token_hash=hashlib.sha256(raw.encode()).hexdigest(),
    expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    used=False,
))
db.commit()
link = f"{settings.public_base_url}/reset?token={raw}"  # NOT request.headers["host"]
send_email(user.email, link)
# On redeem: look up by sha256(token), require not used and not expired,
# set used=True in the same transaction, then invalidate the user's sessions.
```

## A05 — Security Misconfiguration

What: debug mode, verbose errors, default credentials, or permissive CORS
shipped to prod. Why exploitable: stack traces leak internals; `*` + credentials
and open admin panels hand attackers a foothold.

```python
# GOOD — app config and a panic-equivalent: never leak internals to the client.
app = FastAPI(debug=False)  # no --reload in prod

@app.exception_handler(Exception)
async def unhandled(request, exc):
    logger.exception("unhandled", path=request.url.path)  # detail to logs
    return JSONResponse(status_code=500, content={"detail": "Internal error"})
```

```go
// GOOD — recover from panics; log detail, return a generic 500.
defer func() {
    if rec := recover(); rec != nil {
        slog.Error("panic", "err", rec)
        http.Error(w, "internal error", http.StatusInternalServerError)
    }
}()
```

Also: `NODE_ENV=production`; CORS allowlist (never `*` with credentials);
directory listing off; no default credentials; security headers present (see
[CORS, security headers…](#cors-security-headers-rate-limiting-failing-closed)).

## A06 — Vulnerable & Outdated Components

What: a dependency (often transitive) has a known CVE. Why exploitable: the
vulnerable code ships in your bundle whether you call it directly or not.
Finding these is the scanners' job (`scanners.md`); the fix lives here.

```bash
# Per ecosystem. Read each line as package@version -> advisory id + fixed-in;
# fix = upgrade to fixed-in, or override/replace if it's transitive.
pip-audit
npm audit --omit=dev --audit-level=high
osv-scanner scan source -L pnpm-lock.yaml   # v2 CLI; lockfile-aware, multi-ecosystem
govulncheck ./...   # reports ONLY vulns your code actually calls (reachability)
```

Override a vulnerable **transitive** dependency: npm `"overrides": {"lib":"1.2.4"}`
in `package.json`; pip a `constraints.txt` pin (`pip install -r req.txt -c
constraints.txt`); Go `replace lib v1.2.3 => lib v1.2.4` in `go.mod`. A reachable
high/critical CVE is a release blocker, not a follow-up ticket. Lockfiles,
verified installs and SBOM: `secrets-and-supply-chain.md`.

## A07 — Identification & Authentication Failures

What: weak login flow — no brute-force defense, session id not rotated, error
messages reveal which accounts exist. Why exploitable: credential stuffing and
session fixation need only a login form.

- **Brute-force / credential-stuffing defense:** per-IP + per-identity rate
  limit, lockout after N failures, generic `"invalid credentials"` (no user
  enumeration — same message and timing whether or not the email exists).
- **Session fixation:** regenerate the session id on login and on any privilege
  change, so a pre-auth id an attacker planted can't be reused.

```python
# GOOD (FastAPI + starsessions/itsdangerous-style store): rotate on login.
async def login(request: Request, creds: LoginIn) -> None:
    user = authenticate(creds.email, creds.password)   # raises 401 on mismatch
    await request.session.regenerate_id()   # new server-side session id
    request.session["uid"] = user.id
```

```go
// GOOD (Go, gorilla/sessions): rotate the session id at login.
session.Options.MaxAge = 0           // expire the old id
_ = session.Save(r, w)               // issue a fresh id, then set uid
session.Values["uid"] = userID
_ = session.Save(r, w)
```

MFA enrollment and verification: [MFA](#mfa).

## A08 — Software & Data Integrity (supply chain)

What: code or data is trusted without verifying its origin. Why exploitable: a
poisoned dependency, unsigned binary, or CDN compromise runs in your context.

- **Lockfile integrity:** `npm ci` / `pnpm i --frozen-lockfile`; `go mod verify`
  confirms module checksums against `go.sum`.
- **No `curl … | bash`:** download, `sha256sum -c`, then run. SRI for any
  third-party `<script>` so the browser refuses a tampered file.

```html
<!-- GOOD — Subresource Integrity pins the exact file hash. -->
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
        crossorigin="anonymous"></script>
```

## A09 — Logging & Monitoring Failures

What: security events aren't logged, or the logs leak PII/secrets. Why
exploitable: breaches go undetected, and the logs themselves become the leak.

```python
# GOOD (structlog) — log the event keyed on user_id; redact secrets; no bodies.
import structlog
log = structlog.get_logger()
log.warning("authz_miss", user_id=user.id, object="document", object_id=doc_id)
log.info("login_fail", user_id=user.id)   # never log password or full email
```

```go
// GOOD (slog) — structured fields, user_id not PII.
slog.Warn("authz_miss", "user_id", userID, "object", "document", "id", id)
```

Log auth events + authz failures with `user_id` (not PII); redact
tokens/passwords/PAN/email; never log auth-route bodies; alert on spikes of
`authz_miss` / `login_fail`.

## A10 — SSRF (Server-Side Request Forgery)

What: the server fetches a user-supplied URL. Why exploitable: the attacker
points it at internal services or the cloud metadata endpoint to steal
credentials. Highest-value modern category — block by IP, not just hostname.
Forbidden ranges: `169.254.169.254` (metadata), `10.0.0.0/8`, `172.16.0.0/12`,
`192.168.0.0/16`, `127.0.0.0/8`, `::1`, `fc00::/7`, `fe80::/10`.

### Python (`httpx`)

```python
# BAD — fetches whatever URL the user gave us:  r = httpx.get(user_url)
# GOOD — https-only, resolve DNS, reject EVERY returned IP, then DIAL the
# validated IP literal so DNS cannot rebind between check and connect.
# `sni_hostname` keeps TLS/SNI + certificate validation bound to the real host.
import ipaddress, socket, httpx
from urllib.parse import urlparse

def _blocked(ip) -> bool:  # ip: IPv4Address | IPv6Address
    return (ip.is_private or ip.is_loopback or ip.is_link_local
            or ip.is_reserved or ip.is_multicast or ip.is_unspecified)

def safe_get(user_url: str) -> httpx.Response:
    u = urlparse(user_url)
    if u.scheme != "https" or not u.hostname:
        raise ValueError("https URL required")
    port = u.port or 443
    # Resolve once and validate ALL returned addresses (a multi-record answer
    # can pair a safe first record with a private second one).
    infos = socket.getaddrinfo(u.hostname, port, proto=socket.IPPROTO_TCP)
    addrs = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not addrs or any(_blocked(ip) for ip in addrs):
        raise ValueError("blocked address")
    pinned = addrs[0]  # a validated address from the set we just checked
    bracket = f"[{pinned}]" if pinned.version == 6 else str(pinned)
    with httpx.Client(timeout=5.0, follow_redirects=False) as c:
        # Connect to the validated IP literal; pin SNI + Host to the real
        # hostname so certificate verification is performed against it.
        return c.get(
            f"https://{bracket}:{port}{u.path or '/'}",
            headers={"Host": u.hostname},
            extensions={"sni_hostname": u.hostname},
        )
```

### Go (`http.Client`)

```go
// GOOD — DialContext re-checks the IP actually dialed; redirects blocked; timeout.
func blockPrivate(ip net.IP) bool {
    return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
        ip.Equal(net.ParseIP("169.254.169.254"))
}
client := &http.Client{
    Timeout: 5 * time.Second,
    CheckRedirect: func(*http.Request, []*http.Request) error {
        return http.ErrUseLastResponse // do not follow redirects
    },
    Transport: &http.Transport{
        DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
            host, port, _ := net.SplitHostPort(addr)
            ips, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
            if err != nil { return nil, err }
            for _, ip := range ips {
                if blockPrivate(ip) { return nil, fmt.Errorf("blocked address") }
            }
            return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(ips[0].String(), port))
        },
    },
}
```

### TS (Route Handler `fetch`)

```ts
// GOOD — https-only allowlist, no redirects, hard timeout.
import { lookup } from "node:dns/promises";
import net from "node:net";

const ALLOWED_HOSTS = new Set(["api.partner.com"]);

// Reject loopback, RFC1918 private, link-local (incl. 169.254.169.254 metadata),
// IPv6 loopback/ULA/link-local. Normalize IPv4-mapped IPv6 (::ffff:a.b.c.d) so a
// mapped private address cannot slip through the IPv4 ranges below.
function isPrivate(address: string): boolean {
  let addr = address;
  const mapped = addr.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i); // IPv4-mapped
  if (mapped) addr = mapped[1];

  if (net.isIPv4(addr)) {
    const o = addr.split(".").map(Number); // [a, b, c, d]
    return (
      o[0] === 10 ||                                  // 10.0.0.0/8
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||   // 172.16.0.0/12
      (o[0] === 192 && o[1] === 168) ||               // 192.168.0.0/16
      o[0] === 127 ||                                 // 127.0.0.0/8 loopback
      (o[0] === 169 && o[1] === 254)                  // 169.254.0.0/16 link-local + metadata
    );
  }

  const ip = addr.toLowerCase().split("%")[0]; // drop zone id (fe80::1%eth0)
  if (ip === "::1") return true;               // IPv6 loopback
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 ULA
  if (ip.startsWith("fe8") || ip.startsWith("fe9") ||
      ip.startsWith("fea") || ip.startsWith("feb")) return true; // fe80::/10 link-local
  return false;
}

export async function fetchUserUrl(raw: string): Promise<Response> {
  const u = new URL(raw);                       // throws on malformed input
  if (u.protocol !== "https:") throw new Error("https required");
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error("host not allowed");
  // Validate EVERY resolved address, not just the first record.
  const addrs = await lookup(u.hostname, { all: true });
  if (addrs.length === 0) throw new Error("no address");
  for (const { address } of addrs) {
    if (net.isIP(address) && isPrivate(address)) throw new Error("blocked address");
  }
  // NOTE: undici/fetch re-resolves DNS at connect time, so this check is
  // TOCTOU-racy on its own. For untrusted hosts, pin via a custom undici
  // Agent whose `connect` re-validates the dialed IP (mirror the Go dialer).
  return fetch(u, { redirect: "error", signal: AbortSignal.timeout(5000) });
}
```

**DNS-rebinding caveat:** validating the pre-resolution IP is not enough — the
hostname can resolve to a safe IP at check time and a private IP at connect
time. Validate the IP you actually **dial**: the Python example connects to the
validated IP literal (with `sni_hostname` so TLS still verifies the real host),
and the Go example re-checks every IP inside `DialContext`. The TS `fetch`
example checks all records but cannot pin the dialed IP without a custom undici
`Agent` — for untrusted hosts, supply one whose `connect` re-validates the IP,
mirroring the Go dialer.

## Input validation, XSS and uploads

Validate at the boundary with a schema and never trust the shape that arrived —
an unbounded or extra field is how the next sink gets its payload.

```python
# BAD — raw body, unbounded, unknown fields silently accepted.
data = await request.json()
# GOOD — Pydantic v2: bounded + reject unknown fields.
from pydantic import BaseModel, ConfigDict, Field
class CreateUser(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=254)
    name: str = Field(min_length=1, max_length=100)
```

```ts
// GOOD — Zod .strict() parsed inside the Server Action (Go: struct + go-playground/validator).
const Schema = z.object({ email: z.string().email(), name: z.string().max(100) }).strict();
const data = Schema.parse(await req.json());   // BAD: `body as any`
```

**XSS:** React auto-escapes — the bug is `dangerouslySetInnerHTML`. **Stored**
(persisted then served), **reflected** (echoed from the request) and **DOM**
(client writes user data into the DOM) XSS all need encoding or sanitizing.
Encode on output *by context* (HTML / attribute / JS / URL); never build HTML by
concatenating user strings.

```tsx
// BAD — raw user HTML into the DOM.
<div dangerouslySetInnerHTML={{ __html: userHtml }} />
// GOOD — DOMPurify allowlist sanitize, or render as text.
import DOMPurify from "isomorphic-dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml, { ALLOWED_TAGS: ["b","i","p"] }) }} />
```

**Upload validation:** size cap + **sniffed** content type (magic bytes, not the
client-sent `file.type`) + extension allowlist + store outside the web root +
random filename. Reject SVG unless you sanitize it; serve user files with
`Content-Disposition: attachment` and `nosniff`, ideally from a separate origin.

```python
# GOOD — sniff magic bytes; never trust the client content-type.
import secrets, filetype
head = await file.read(512); await file.seek(0)
kind = filetype.guess(head)
if kind is None or kind.mime not in {"image/png", "image/jpeg"}:
    raise HTTPException(415, "unsupported media type")
dest = UPLOAD_DIR / f"{secrets.token_hex(16)}.{kind.extension}"   # outside web root
```

```ts
// GOOD — magic-byte sniff on the first bytes; reject SVG.
import { fileTypeFromBuffer } from "file-type";
const buf = Buffer.from(await file.arrayBuffer());
const ft = await fileTypeFromBuffer(buf);
if (!ft || !["image/png", "image/jpeg"].includes(ft.mime)) throw new Error("bad type");
```

## CORS, security headers, rate limiting, failing closed

```python
# CORS — BAD: allow_origins=["*"] with allow_credentials=True (illegal + dangerous).
# GOOD — explicit origin allowlist.
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=["https://app.example.com"], allow_credentials=True,
    allow_methods=["GET", "POST"], allow_headers=["authorization", "content-type"])
```

If someone asks for `*` with credentials "so the widget works everywhere", do not
implement it: list the real embedding origins, or serve the widget's public data
from a credential-less endpoint.

```ts
// Security headers — next.config.ts. CSP without unsafe-inline/unsafe-eval
// (use nonces/hashes for inline scripts); HSTS only when all subdomains are HTTPS.
const headers = [
  { key: "Content-Security-Policy", value: "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
export default { async headers() { return [{ source: "/:path*", headers }]; } };
```

- **TLS:** HTTPS everywhere, HSTS once every subdomain is on HTTPS.
- **Rate limiting:** per-IP **and** per-identity, stricter on auth/OTP/search.
  In-memory limiters are **not** multi-instance safe — use Redis behind more than
  one replica.
- **Which IP:** the socket peer address, or the single hop your *own* reverse
  proxy appends (configure the framework's trusted-proxy count, e.g. uvicorn
  `--forwarded-allow-ips`, Express `trust proxy` set to the exact hop count).
  Never key a limit, allowlist or audit trail on a raw client-supplied
  `X-Forwarded-For` / `X-Real-IP`: the caller writes whatever it wants there and
  rotates it to dodge the limit or frame someone else.
- **Fail closed:** generic error to the client, detail to the logs. A stack
  trace or DB message in a response is free reconnaissance for the attacker. An
  auth or verification dependency that times out or errors means "deny", not
  "allow".
- **Logging without PII:** see A09.

## AuthN / AuthZ

Pick the session model, verify tokens correctly, authorize per object, hash with
Argon2id, and store tokens where XSS can't reach them.

**Library note (2026):** Auth.js / NextAuth v5 (`next-auth@5`) moved under the
Better Auth team in late 2025 and is still patched; the `auth()` patterns here
remain valid. For *new* Next.js projects, weigh Better Auth too. The controls
are library-agnostic: server-side authz, `HttpOnly` cookies, pinned-alg JWT.

### Sessions vs JWT — pick this when

| Dimension | Server-side session | JWT (access + refresh) |
|---|---|---|
| Revocation | Instant — delete the server row | Needs a denylist; access token valid until `exp` |
| Scale | Shared store (Redis) or sticky | Stateless; nothing to look up |
| Mobile / native | Cookie handling is awkward | Natural — send as a bearer header |
| XSS exposure | `HttpOnly` cookie is unreadable by JS | `localStorage` is stealable by any XSS |
| CSRF | Needs a CSRF token (cookie auto-sent) | Bearer header is immune (not auto-sent) |

Bottom line: **server-side session is the default for first-party web.** Use JWT
for stateless/native clients — short access (5–15 min) + rotating refresh with
reuse detection + a revocation story.

### OAuth2 / OIDC and JWT verification

Use the authorization-code flow **with PKCE** (the code challenge defeats
interception of the authorization code). FastAPI as a **resource server**
verifies the access token: fetch and cache the JWKS, check `aud`/`iss`/`exp`,
and **pin the algorithm** — reject `alg:none` and reject HS256 when you expect
RS256 (an attacker who knows your public key could forge HS256 otherwise).

```python
# GOOD — verify with explicit algorithms, audience, issuer (PyJWT).
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, Request

_jwks = PyJWKClient("https://issuer.example.com/.well-known/jwks.json")

def get_current_user(request: Request) -> User:
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    try:
        signing_key = _jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],                 # pinned; rejects alg:none + HS*
            audience="api://my-service",
            issuer="https://issuer.example.com/",
            options={"require": ["exp", "iat", "aud", "iss"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")
    return load_user(claims["sub"])
```

```ts
// GOOD (Next.js 15, Auth.js v5) — server-side session guard in a Route Handler.
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("unauthorized", { status: 401 });
  return Response.json({ user: session.user.id });
}
```

### RBAC vs ABAC

RBAC checks a **role** ("is admin"); ABAC checks an **attribute/policy** ("is
the owner of this object", "is in the same org and the resource is not
locked"). Use RBAC for coarse function-level gates, ABAC for per-object access.

```python
# GOOD — RBAC dependency (function-level) raises 403 on role mismatch.
from fastapi import Depends, HTTPException

def require_role(role: str):
    def dep(user: User = Depends(get_current_user)) -> User:
        if role not in user.roles:
            raise HTTPException(status_code=403, detail="forbidden")
        return user
    return dep

@router.delete("/users/{uid}")
def delete_user(uid: int, _: User = Depends(require_role("admin"))) -> None:
    db.execute(delete(User).where(User.id == uid))

# GOOD — ABAC per-object check (ownership / attribute policy).
def can_edit(user: User, doc: Document) -> bool:
    return doc.owner_id == user.id or (
        "editor" in user.roles and doc.org_id == user.org_id and not doc.locked
    )
```

```go
// GOOD — Go middleware reads the role from the authenticated context.
func RequireRole(role string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        roles, _ := r.Context().Value(rolesKey).([]string)
        if !slices.Contains(roles, role) {
            http.Error(w, "forbidden", http.StatusForbidden)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

### Token lifetimes & refresh rotation

Short access tokens (5–15 min). Rotating refresh tokens: each refresh issues a
new refresh token and invalidates the old one. **Reuse detection**: if an
already-rotated refresh token is presented again, it was replayed — revoke the
whole token family and force re-login. Logout invalidates the refresh token.

```python
# GOOD — rotate + detect reuse (server-side refresh store).
def refresh(presented_jti: str, family_id: str) -> Tokens:
    rec = store.get(presented_jti)
    if rec is None or rec.revoked:
        # Replay of a rotated/revoked token -> kill the whole family.
        store.revoke_family(family_id)
        raise HTTPException(status_code=401, detail="reuse detected")
    store.revoke(presented_jti)                       # old token is now spent
    new_refresh = store.issue(family_id=family_id)    # rotate
    return Tokens(access=mint_access(rec.user_id), refresh=new_refresh)
```

### Cookies done right

Canonical flags: `HttpOnly; Secure; SameSite=Lax` (`Strict` for sensitive
actions), the `__Host-` prefix (forces `Secure`, `Path=/` and no `Domain` — locks
the cookie to the exact host), scoped `Path=/`, no `Domain` attribute.

```python
# FastAPI
response.set_cookie(
    key="__Host-session", value=sid,
    httponly=True, secure=True, samesite="lax", path="/",
)
```

```ts
// Next.js 15 — Route Handler or Server Action.
import { cookies } from "next/headers";
(await cookies()).set("__Host-session", sid, {
  httpOnly: true, secure: true, sameSite: "lax", path: "/",
});
```

```go
// Go
http.SetCookie(w, &http.Cookie{
    Name: "__Host-session", Value: sid,
    HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, Path: "/",
})
```

BAD: storing the token in `localStorage` — readable by any XSS payload.

### CSRF defense

Needed for **cookie-authenticated, state-changing** requests (the browser sends
the cookie automatically). Use a double-submit token (or the framework's token)
plus an Origin/Referer check. SameSite is defense in depth, **not** sufficient
alone. Bearer-token APIs don't need CSRF tokens — **but must not also accept the
auth cookie**, or they're back in scope.

```python
# GOOD — double-submit: cookie value must equal the X-CSRF-Token header.
import hmac
def verify_csrf(request: Request):
    cookie = request.cookies.get("csrf")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not hmac.compare_digest(cookie, header):
        raise HTTPException(status_code=403, detail="csrf")
    origin = request.headers.get("origin", "")
    if origin and origin not in settings.allowed_origins:
        raise HTTPException(status_code=403, detail="bad origin")
```

### Password hashing — Argon2id

Concrete params (tune `memory_cost` up until a hash takes ~0.5 s on prod
hardware): `time_cost=3, memory_cost=65536 (64 MiB), parallelism=4`. These sit
above the OWASP Password Storage minimums (`m=19456, t=2, p=1` **or** `m=47104,
t=1, p=1`) — meet or exceed the floor on every axis. Verify on login and rehash
transparently when params change. bcrypt with `cost>=12` is an acceptable
fallback. Never SHA-256/MD5.

```python
# GOOD — argon2-cffi: hash, verify, transparent rehash.
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)

def verify_login(stored_hash: str, password: str) -> bool:
    try:
        ph.verify(stored_hash, password)
    except VerifyMismatchError:
        return False
    if ph.check_needs_rehash(stored_hash):
        save_new_hash(ph.hash(password))   # upgrade params on successful login
    return True
```

Go note: `argon2.IDKey(password, salt, 3, 64*1024, 4, 32)` from
`golang.org/x/crypto/argon2` produces the equivalent Argon2id key.

### MFA

TOTP enrollment + verification with `pyotp`; store recovery codes **hashed**
(same as passwords); require step-up auth (re-verify the second factor) for
sensitive actions like changing email or disabling MFA.

```python
# GOOD — TOTP enroll + verify (pyotp).
import pyotp
secret = pyotp.random_base32()                 # store encrypted per user
uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="MyApp")
# verify with a small window to tolerate clock drift:
ok = pyotp.TOTP(secret).verify(submitted_code, valid_window=1)
```

### Flutter / Dart 3

Store tokens in `flutter_secure_storage` (backed by iOS Keychain / Android
Keystore) — **never** `SharedPreferences`, which is plaintext on disk.

```dart
// GOOD — secure storage, not SharedPreferences.
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final _storage = const FlutterSecureStorage();
Future<void> saveToken(String token) =>
    _storage.write(key: 'refresh_token', value: token);
Future<String?> readToken() => _storage.read(key: 'refresh_token');
```

For high-value apps, add TLS certificate pinning (e.g. a pinned
`SecurityContext` / `badCertificateCallback` on the HTTP client). Anything
compiled into the app binary is extractable — no backend secret in the client
(`secrets-and-supply-chain.md`).

## Anti-patterns

| What gets said | Reality |
|---|---|
| "It's behind auth, so IDOR doesn't matter." | Authenticated ≠ authorized. Check object ownership on every request. |
| "The frontend already validates / hides the button." | Client checks are UX. Re-authorize and re-validate on the server. Server Actions and API routes are public. |
| "I'll sanitize with a blacklist of bad chars." | Allowlist + parameterize/encode. Blacklists are bypassable. |
| "JWT in localStorage is fine, it's just an access token." | Any XSS steals it instantly. Use `HttpOnly` cookies; short TTLs. |
| "`allow_origins=['*']` with credentials is convenient." | The browser rejects it and it's dangerous. Use an explicit origin allowlist. |
| "npm audit shows criticals but they're transitive." | Transitive is still in your bundle. Pin/override or replace. |
| "I'll log the payload to debug, remove it later." | "Later" never comes; PII/secrets leak to logs. Redact now. |
| "We'll add rate limiting after launch." | Auth/OTP endpoints get brute-forced on day one. |
| "We rate-limit on `X-Forwarded-For`." | The client writes that header. Use the socket peer or your own proxy's hop. |
| "It's an internal URL fetch, SSRF isn't a risk." | Internal is exactly the SSRF target (metadata, RDS). Allowlist hosts and block `169.254.169.254`, `10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `fc00::/7`, `fe80::/10`. |
| "Error stack to the client speeds debugging." | It leaks internals to attackers. Generic to client, detail to logs. |
| "Secrets in `.env.example` are placeholders; real ones in CI YAML are fine." | Use the secret store; never inline real secrets in CI files. |
| "Argon2 is overkill, SHA-256 is fast." | Fast = brute-forceable. Use Argon2id (or bcrypt cost≥12). |

---

See `threat-modeling.md` to decide which of these controls a change needs,
`secrets-and-supply-chain.md` for where signing keys and session secrets live,
and `scanners.md` for the tools that find A06/A08 issues and SAST candidates.
