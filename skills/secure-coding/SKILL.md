---
name: secure-coding
description: "Use when threat-modeling a feature, reviewing code or a diff for security, hardening authentication/authorization, handling secrets, configuring CORS/CSP/security headers, or fixing OWASP-class vulnerabilities (broken access control, injection, SSRF, auth failures, supply-chain) in FastAPI/Python, Go, Next.js, or Flutter. Triggers: 'security review', 'threat model this', 'is this safe', 'harden auth', 'rotate secrets', 'fix this vuln', 'OWASP', 'why is this endpoint exposed', before merging an endpoint that touches auth/payments/PII/uploads."
tags: [security, owasp, stride, auth, review]
recommends: [deployment]
origin: risco
---

# Secure coding — threat modeling + OWASP across the stack

Threat-model a feature in PR-sized increments, fix OWASP-class bugs with
stack-correct vulnerable→fixed diffs, and gate the result with `verify.sh`.
Stacks: FastAPI/Python 3.12+, Next.js 15 / React 19 / TS, Go 1.22+,
Flutter/Dart 3, PostgreSQL 16.

Operating posture:

- **Read-only by default.** Identify → rank by exploitability → propose fixes
  as diffs. Apply changes only when the user asks.
- **Exploitability over theory.** Rank like a bounty triager: reachable +
  user-controlled + meaningful sink comes first. Do not dump a flat checklist.
- **Every finding ships a fix.** Never "consider sanitizing" — show the
  corrected code for *this* stack.

## When to use / When NOT to use

**Use when:** adding/reviewing an endpoint touching auth, money, PII, file
uploads, or external URLs; a diff needs a security pass before merge; designing
a feature (threat-model before code); hardening cookies/tokens/CORS/CSP/TLS/
rate limits/password hashing/MFA; handling secrets, dependency CVEs, lockfile
integrity, or CI security gates.

**Do NOT use for:**

- **Agent / Claude-Code config security** (`.claude/`, hooks, MCP, prompt
  injection, sandboxing) — a *different* concern. This skill is about the
  **application code the user ships**. Point there (See Also) and stay in lane.
- Pure infra/network firewalling with no code change — defer.
- Pentest/bounty PoC against a third party — out of scope (legal); this skill
  defends code, it does not attack external targets.
- Trivial non-security refactors — don't gate them through `verify.sh`.

## The 30-second model: lethal trifecta + trust boundaries

- **Lethal trifecta** (Simon Willison): private data **+** untrusted input **+**
  ability to exfiltrate. Flag any handler where all three meet — that's where a
  leak becomes a breach.
- **Trust-boundary rule:** every untrusted→trusted crossing is a checkpoint with
  one owning defense: HTTP body→SQL, user string→shell/URL/HTML, JWT claim→authz
  decision, filename→fs path, upload→disk/exec.

| Untrusted source | Dangerous sink | Defense | Reference |
|---|---|---|---|
| Request body | SQL query | Parameterize (bound params / ORM) | `references/owasp-by-stack.md` A03 |
| User URL | Outbound fetch | https-only + IP allowlist, block private ranges | `references/owasp-by-stack.md` A10 |
| User HTML | DOM render | Encode by context / DOMPurify allowlist | `references/owasp-by-stack.md` A03 |
| Filename | Filesystem path | Canonicalize + base-dir containment | `references/owasp-by-stack.md` A03 |
| JWT / claim | Authz decision | Verify signature + pinned alg + `aud`/`iss`/`exp` | `references/authn-authz.md` |
| Upload | Disk / exec | Type+size, sniff magic bytes, store outside web root | `references/owasp-by-stack.md` A01 |

## Review workflow (PR-sized)

1. **Scope.** What data, which boundary, what auth context does the diff touch?
2. **Threat-model lite.** STRIDE on the changed element only → `references/threat-modeling.md`.
3. **Map sinks to OWASP.** Match each changed sink to a category → `references/owasp-by-stack.md`.
4. **Rank by exploitability.** Reachable? User-controlled? Meaningful sink? Report the highest-impact reachable findings first, not a checklist.
5. **Propose fixes as diffs** in the repo's actual stack (Good/Bad, copy-pasteable).
6. **Run `scripts/verify.sh`** in the repo root; resolve every high/critical before merge.

## Core principles (non-negotiable)

1. Validate at the boundary with a schema (Pydantic v2 / Zod `.strict()` / Go struct+validator) — never trust shape.
2. Parameterize every query; ORM or driver bind params, never string-built SQL.
3. Authorize on the **server**, per-object, on **every** request; deny by default.
4. Encode on output by context (HTML / attribute / JS / URL); never build HTML from user strings.
5. Secrets only from env/secret-manager — never in repo, logs, or client bundles.
6. Fail closed: generic errors to the client, detail to logs (no stack traces, no PII).
7. Pin + lock dependencies; a reachable CVE is a release blocker.
8. Least privilege / least agency for tokens, DB roles, CORS origins, file perms.

## OWASP Top 10 — fastest fix per category

| OWASP 2021 | The mistake you'll actually see | Stack-correct fix in one phrase | Deep ref |
|---|---|---|---|
| A01 Broken Access Control | `db.get(id)` returned to any authed user | Ownership-scoped query; 404 (not 403) on miss | `references/owasp-by-stack.md` A01 |
| A02 Cryptographic Failures | SHA-256 password hash; `random` token | Argon2id + CSPRNG (`secrets`/`crypto/rand`) | `references/owasp-by-stack.md` A02 |
| A03 Injection | f-string SQL / `shell=True` | Bound params / arg-list, no shell / canonicalize path | `references/owasp-by-stack.md` A03 |
| A04 Insecure Design | No rate limit, replayable payment | Lockout + idempotency-key `UNIQUE` constraint | `references/owasp-by-stack.md` A04 |
| A05 Security Misconfiguration | `debug=True`, `*`+credentials CORS | `debug=False`, explicit origin allowlist, headers | `references/owasp-by-stack.md` A05 |
| A06 Vulnerable Components | Ignored transitive CVE | Audit + upgrade/override/replace | `references/owasp-by-stack.md` A06 |
| A07 Auth Failures | Reusable session id, user enumeration | Lockout + rotate session id + generic error | `references/owasp-by-stack.md` A07 |
| A08 Data Integrity | `curl \| bash`, unpinned CDN script | `npm ci`/`go mod verify` + SRI | `references/owasp-by-stack.md` A08 |
| A09 Logging Failures | No authz-fail log; PII in logs | Structured log on `user_id`, redact secrets | `references/owasp-by-stack.md` A09 |
| A10 SSRF | Fetch user-supplied URL directly | https-only + IP allowlist + pin dialed IP | `references/owasp-by-stack.md` A10 |

Flagship: **A01 Broken Access Control / IDOR** (the #1, stack-agnostic in shape).

```python
# Python — FastAPI 3.12 + SQLAlchemy 2.0
# BAD — any authenticated user can read any document.
@router.get("/documents/{doc_id}")
def get_doc(doc_id: int, db: Session = Depends(get_db)):
    return db.get(Document, doc_id)

# GOOD — ownership-scoped query; 404 on miss; injected current_user.
@router.get("/documents/{doc_id}")
def get_doc(doc_id: int, db: Session = Depends(get_db),
            user: User = Depends(get_current_user)) -> DocumentOut:
    doc = db.execute(
        select(Document).where(Document.id == doc_id, Document.owner_id == user.id)
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")  # 404 not 403
    return DocumentOut.model_validate(doc)
```

```ts
// TS — Next.js 15 App Router Route Handler / Server Action
// BAD — trusts the id and assumes a session exists.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next.js 15: params is a Promise — await it.
  return Response.json(await db.document.findUnique({ where: { id } }));
}
// GOOD — auth() guard + ownership scope + notFound().
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
// NOTE: Server Actions are public POST endpoints — re-authorize server-side.
```

```go
// Go — 1.22 ServeMux + slog
// BAD — r.PathValue("id") straight into the query, no ownership check.
// GOOD — userID from context; scoped query; 404 on miss.
mux.HandleFunc("GET /documents/{id}", func(w http.ResponseWriter, r *http.Request) {
    userID, ok := r.Context().Value(userKey).(int64)
    if !ok { http.Error(w, "unauthorized", http.StatusUnauthorized); return }
    var body string
    err := db.QueryRowContext(r.Context(),
        "SELECT body FROM documents WHERE id=$1 AND owner_id=$2",
        r.PathValue("id"), userID).Scan(&body)
    if err == sql.ErrNoRows {
        slog.Warn("authz_miss", "user", userID)
        http.Error(w, "not found", http.StatusNotFound); return
    }
    if err != nil { http.Error(w, "internal error", http.StatusInternalServerError); return }
    _, _ = w.Write([]byte(body))
})
```

Full vulnerable→fixed code for **all 10 categories in all three stacks** lives
in `references/owasp-by-stack.md`.

## Input validation & output encoding

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
(persisted then served), **reflected** (echoed from the request), and **DOM**
(client writes user data into the DOM) XSS all need encoding/sanitizing.

```tsx
// BAD — raw user HTML into the DOM.
<div dangerouslySetInnerHTML={{ __html: userHtml }} />
// GOOD — DOMPurify allowlist sanitize, or render as text.
import DOMPurify from "isomorphic-dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml, { ALLOWED_TAGS: ["b","i","p"] }) }} />
```

**Upload validation:** size cap + **sniffed** content-type (magic bytes, not the
client-sent `file.type`) + extension allowlist + store outside the web root +
random filename.

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

## AuthN / AuthZ in 60 seconds

- **Library note (2026):** Auth.js / NextAuth v5 is still maintained (now under
  the Better Auth team; security patches continue) and the `auth()` patterns
  below are valid — but for *new* Next.js projects, evaluate Better Auth too. The
  principles here (server-side authz, `HttpOnly` cookies, pinned-alg JWT) are
  library-agnostic.
- **Sessions vs JWT:** server-side session = easy revocation, default for
  first-party web; JWT = stateless, short access (5–15 min) + rotating refresh
  with reuse detection + a revocation story.
- **Cookie flags:** `HttpOnly; Secure; SameSite=Lax` (`Strict` for sensitive),
  `__Host-` prefix, scoped `Path=/`. BAD = token in `localStorage` (XSS steals it).
- **Password hashing:** Argon2id (`time_cost=3, memory_cost=65536, parallelism=4`)
  via `argon2-cffi` (Py) / `golang.org/x/crypto/argon2` (Go); bcrypt `cost>=12`
  fallback; never SHA-256/MD5. (These exceed the OWASP floor of `m=19456, t=2,
  p=1` or `m=47104, t=1, p=1` — `≥` the minimum on every axis is the bar; tune
  `memory_cost` up until a hash takes ~0.5s on prod hardware.)
- **CSRF:** needed for cookie-auth state-changing requests; double-submit token
  or framework token; SameSite is defense-in-depth, not sufficient alone.

```python
# GOOD — verify a JWT with pinned algorithms + audience + issuer (PyJWT).
import jwt
claims = jwt.decode(
    token, public_key,
    algorithms=["RS256"],            # pinned: rejects alg:none and HS-when-RS
    audience="api://my-service", issuer="https://issuer.example.com/",
    options={"require": ["exp", "aud", "iss"]},
)
```

Sessions/OIDC/RBAC/ABAC/MFA/refresh-rotation details: `references/authn-authz.md`.

## CORS, security headers, TLS, rate limiting, logging

```python
# CORS — BAD: allow_origins=["*"] with allow_credentials=True (illegal + dangerous).
# GOOD — explicit origin allowlist.
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=["https://app.example.com"], allow_credentials=True,
    allow_methods=["GET", "POST"], allow_headers=["authorization", "content-type"])
```

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

- **Rate limiting:** per-IP **and** per-identity, stricter on auth/OTP/search.
  In-memory limiters are **not** multi-instance safe — use Redis behind >1 replica.
- **Logging without PII:** redact tokens/passwords/PAN/email; log `user_id`,
  not email; structured (`slog`/`structlog`); never log auth-route bodies.

## Secrets & supply chain (the part that gets you breached)

- Env/secret-manager, never repo; `.env` gitignored. Only `NEXT_PUBLIC_*` is
  public — **BAD: a secret read in a Client Component ships to the browser.**
- Pin + commit the lockfile; install with `npm ci` / `pnpm i --frozen-lockfile`
  / `go mod verify` / `pip install --require-hashes`.
- Audit per stack: `pip-audit`, `npm audit --omit=dev` / `osv-scanner`,
  `govulncheck`, `dart pub outdated`.
- On exposure: **rotate the credential first, then scrub history** (`gitleaks`
  to confirm). SBOM via `syft`; provenance via `cosign`/SLSA.

Full runbook: `references/secrets-and-supply-chain.md`.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality |
|---|---|
| "It's behind auth, so IDOR doesn't matter." | Authenticated ≠ authorized. Check object ownership on every request. |
| "The frontend already validates / hides the button." | Client checks are UX. Re-authorize and re-validate on the server. Server Actions and API routes are public. |
| "I'll sanitize with a blacklist of bad chars." | Allowlist + parameterize/encode. Blacklists are bypassable. |
| "JWT in localStorage is fine, it's just an access token." | Any XSS steals it instantly. Use `HttpOnly` cookies; short TTLs. |
| "`allow_origins=['*']` with credentials is convenient." | The browser rejects it and it's dangerous. Use an explicit origin allowlist. |
| "npm audit shows criticals but they're transitive." | Transitive is still in your bundle. Pin/override or replace. |
| "I'll log the payload to debug, remove it later." | "Later" never comes; PII/secrets leak to logs. Redact now. |
| "We'll add rate limiting after launch." | Auth/OTP endpoints get brute-forced on day one. |
| "It's an internal URL fetch, SSRF isn't a risk." | Internal is exactly the SSRF target (metadata, RDS). Allowlist hosts, block private IPs. |
| "Error stack to the client speeds debugging." | It leaks internals to attackers. Generic to client, detail to logs. |
| "Secrets in `.env.example` are placeholders; real ones in CI YAML are fine." | Use the secret store; never inline real secrets in CI files. |
| "Argon2 is overkill, SHA-256 is fast." | Fast = brute-forceable. Use Argon2id (or bcrypt cost≥12). |

## verify.sh — the gate

`scripts/verify.sh` runs gitleaks + semgrep + the per-stack CVE audit
(pip-audit/osv-scanner/govulncheck). It is **the user's to run in their own repo
root** — it auto-detects the stack, skips (does not fail) when a tool is
missing, and exits non-zero **only** on real high/critical findings. The CI
equivalent is in `references/secrets-and-supply-chain.md`.

## Quick reference

| Concern | Tool / flag | One-liner |
|---|---|---|
| Secret scan | `gitleaks dir . --redact` | Working tree; add `gitleaks git .` for history; rotate-then-scrub on a hit |
| SAST | `semgrep --config=auto --severity ERROR` | ERROR gates; WARNING informational |
| Python CVEs | `pip-audit` | Upgrade to fix version; constraints for transitive |
| Node CVEs | `npm audit --omit=dev --audit-level=high` | Or `osv-scanner scan source -L …` (multi-ecosystem) |
| Node CVEs (lockfile) | `osv-scanner scan source -L pnpm-lock.yaml` | Lockfile-aware, broad ecosystem coverage (v2 CLI) |
| Go CVEs | `govulncheck ./...` | Reachability-aware (only vulns you call) |
| Password hash | Argon2id | `time_cost=3, memory_cost=65536, parallelism=4` |
| Cookie flags | `Set-Cookie` | `__Host-name; HttpOnly; Secure; SameSite=Lax; Path=/` |
| CSP starter | header | `default-src 'self'; object-src 'none'; frame-ancestors 'none'` |
| CORS rule | allowlist | Explicit origins; never `*` with credentials |
| SSRF blocklist | IP ranges | `169.254.169.254`, `10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `fc00::/7`, `fe80::/10` |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this
project's security decisions there and index them from the root `CLAUDE.md`, so the next
agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/security.md`, indexed in `02-DOCS/wiki/index.md` (the
   Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — the threat model, the auth model, the secrets backend, the CI security gates, and any accepted risks —
   then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a
   short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the
   article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the
brand study, technical conventions are *recorded, not gated* — never block the task on this.

## See Also

- **Stack skills** — `../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`,
  `../flutter/SKILL.md`, `../postgresdb/SKILL.md` (and `../design/SKILL.md`,
  `../deployment/SKILL.md`): they defer security to this skill. If a stack skill
  doesn't exist yet, treat this as the canonical security reference it points to.
- **Agent / Claude-Code config security** — a separate concern (`.claude/`,
  hooks, MCP, prompt injection, sandboxing). Covered by `../building-agents/SKILL.md`
  and agent-config-security tooling; explicitly **out of scope** here.
- **`../harness/SKILL.md`** — secrets land in
  `01-TOOLS/<PROVIDER>/.env` (gitignored); reinforces never-in-repo.
- **References** — go to `references/threat-modeling.md` to model a feature before
  coding; `references/owasp-by-stack.md` for vulnerable→fixed code in any of the
  three stacks; `references/authn-authz.md` to design login/sessions/tokens/MFA;
  `references/secrets-and-supply-chain.md` for secret handling, dependency
  pinning, and the CI gate.
