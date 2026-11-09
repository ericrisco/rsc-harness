# Threat modeling — PR-sized, not enterprise ceremony

Lightweight STRIDE you can finish inside a PR description or one section of an
audit. The goal is not a "complete" document. It is an explicit authz decision
on every changed entry point, a validator on every untrusted input, a defense on
every dangerous sink, and a written list of accepted residual risks. Model only
the boundary the diff (or the audited unit) **touches** — never the whole app.

Use it in two places:

- **Orientation mode** (a one-off question about a feature or a diff): model the
  changed element, decide the controls, hand off to `fixes-by-stack.md`.
- **Audit mode**: model each coverage unit before hunting in it. The STRIDE hits
  become the questions the hunt answers; each answer is a candidate until it is
  verified (`verification.md`).

## The 30-second model: lethal trifecta + trust boundaries

- **Lethal trifecta:** private data **+** untrusted input **+** a way to send
  data out. Flag any handler where all three meet — that is where a leak turns
  into a breach.
- **Trust-boundary rule:** every untrusted→trusted crossing is a checkpoint with
  one owning defense: HTTP body→SQL, user string→shell/URL/HTML, JWT
  claim→authz decision, filename→fs path, upload→disk/exec.
- **Least privilege / least agency** for tokens, DB roles, CORS origins and file
  permissions. It is the one control that still caps the blast radius *after*
  another defense fails, so it is never optional.

| Untrusted source | Dangerous sink | Defense | Where the fix lives |
|---|---|---|---|
| Request body | SQL query | Parameterize (bound params / ORM) | `fixes-by-stack.md` A03 |
| User URL | Outbound fetch | https-only + host allowlist, block private ranges, pin the dialed IP | `fixes-by-stack.md` A10 |
| User HTML | DOM render | Encode by context / DOMPurify allowlist | `fixes-by-stack.md` XSS |
| Filename | Filesystem path | Canonicalize + base-dir containment | `fixes-by-stack.md` A03 |
| JWT / claim | Authz decision | Verify signature + pinned alg + `aud`/`iss`/`exp` | `fixes-by-stack.md` AuthN/AuthZ |
| Upload | Disk / exec | Size + sniffed type, store outside web root, random name | `fixes-by-stack.md` uploads |

## When to threat-model (and when to skip)

**Do it when the change or unit:**

- Introduces a new trust boundary (new endpoint, queue consumer, webhook).
- Adds or changes an auth/authz surface (login, role check, token issuance, sharing).
- Touches money, PII, file uploads, or outbound fetches of user-controlled URLs.
- Wires up a new external integration (payment, email, object store, third-party API).

**Skip it when the diff is:**

- A copy edit, string/i18n change, or pure styling/CSS.
- An internal refactor that moves no data across a boundary and changes no authz.
- Test-only or fixture-only code.
- A dependency bump with no new reachable surface (still run the dependency
  scanners in `scanners.md`).

"Good enough" trigger: if the change adds or moves a `‖` boundary (below),
model it. If it doesn't, skip and move on. Trivial non-security refactors never
need a security pass.

## STRIDE in one table

| Threat | Question to ask | Typical control on this stack |
|---|---|---|
| **S**poofing | Who is the caller, and did we verify it? | Verified server-side session or JWT with checked `aud`/`iss`/`exp` and **pinned `algorithms`** (never `alg:none`). |
| **T**ampering | Can the client alter what the server trusts? | Server-side authz + server-computed values (totals, IDs); signed/HMAC payloads for webhooks; DB `CHECK`/`UNIQUE`/FK constraints. |
| **R**epudiation | Can we prove who did what? | Append-only audit log via `slog`/`structlog` keyed on `user_id` (not PII), with action + object id + timestamp. |
| **I**nformation disclosure | Does the response leak more than this caller may see? | Field allowlists in the response model, generic errors to the client, ownership-scoped queries (`WHERE owner_id = :me`). |
| **D**enial of service | Can one caller exhaust us? | Per-IP + per-identity rate limits, request body-size caps, statement/query timeouts, linear-time (ReDoS-safe) regex. |
| **E**levation of privilege | Can a user act as admin or another user? | Deny-by-default authz, per-object ownership checks on **every** request, role checks enforced server-side only. |

## Trust boundaries and a text DFD

Model the request as a 5-box flow and mark every place data crosses from one
trust level to another with `‖`. At each `‖`, untrusted data becomes trusted
(or the reverse) **only after** the check that lives there runs.

```text
Client  ‖  Edge/CDN  ‖  API  ‖  DB  ‖  3rd-party
```

`‖` is a checkpoint: HTTP body → SQL, user string → shell/URL/HTML, JWT claim →
authz decision, filename → filesystem path, upload → disk/exec. The control
that defends the crossing must live on the trusted side (the server), never on
the client.

Worked DFD — **"user uploads an avatar"**:

```text
[Browser]
   |  multipart/form-data (untrusted)
   v
[Next.js Route Handler]
   |  || CHECK: size cap + sniff magic bytes (not file.type); reject SVG
   v
[FastAPI presign endpoint]
   |  || CHECK: await auth(); is this the *caller's own* avatar slot? (authz)
   v
[Object store — private bucket]
   |  || CHECK: random object key; no public-read ACL; server sets content-type
   v
[CDN]
      || CHECK: short-TTL signed URL; Content-Disposition: attachment; nosniff
```

Each `||` annotates the one check it owns. If a box has no check on its inbound
crossing, that is the candidate finding.

## Abuse cases — turn each user story into "…and an attacker does X"

| Feature | Abuse case | Control |
|---|---|---|
| Login | Credential stuffing with leaked password lists | Per-IP **and** per-identity rate limit + temporary lockout; generic "invalid credentials". The IP is the socket peer or the hop your own proxy appended — never a raw client-supplied `X-Forwarded-For`, which the attacker sets per request. |
| Avatar upload | Polyglot file / SVG carrying `<script>` | Sniff magic bytes, reject SVG, re-encode images server-side, serve from a separate origin with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`. |
| Search | Result enumeration + ReDoS via crafted pattern | Bound and validate input length, parameterize the query, use a linear-time regex engine (RE2 / Go `regexp`), cap result count. |
| Webhook | Forgery or replay of a payment event | Verify HMAC signature, enforce a timestamp freshness window, dedupe on an idempotency key stored with a `UNIQUE` constraint. |
| Password reset | Token leaked via `Host` header poisoning or `Referer` | Single-use **hashed** short-TTL token; build the reset link from a **configured base URL**, never from the request `Host`. |
| Payment retry | Replayed or double-submitted charge after a timeout | Idempotency key per charge with a `UNIQUE` constraint, so the replay is a no-op; server computes the amount. |
| Export / report | IDOR mass-extraction of other tenants' rows | Ownership-scoped query + per-object authz + rate limit; return `404` (not `403`) on a miss to avoid confirming the row exists. |

## The PR-sized template

Paste this into the PR description (or the audit unit's notes) and fill only the
rows that apply.

```markdown
### Threat model: <feature>

**Assets** — what's worth stealing/breaking here (PII, money, files, tokens).

**Entry points** — every changed handler/action/consumer (METHOD + path).

**Trust boundaries** — the crossings this diff adds or moves.

**STRIDE hits** — only the categories that actually apply, one line each.

**Decided controls** — the concrete defense per hit (with the file it lives in).

**Residual risk (accepted)** — what we are knowingly NOT defending, and why.
```

**"Good enough" stopping rule:** stop when every changed entry point has an
explicit authz decision, every untrusted input has a validator, every dangerous
sink has a defense, and every residual risk is written down. Do **not** keep
going until the document feels "complete" — completeness is not the bar;
coverage of the changed boundary is.

## Worked example — FastAPI "create invoice + download via signed URL"

```markdown
### Threat model: invoices

**Assets** — invoice PDF (financial), customer PII (name, address, line items).

**Entry points**
- POST /invoices                  (create)
- GET  /invoices/{id}/download    (fetch signed URL)

**Trust boundaries**
- Client to API: request body (amount, customer_id) is untrusted.
- API to object store: PDF stored under a random key in a private bucket.
- API to client: short-TTL signed URL returned to the caller.

**STRIDE hits**
- Tampering: client submits its own `total` -> recompute server-side from line items.
- Information disclosure: caller requests another tenant's invoice id (IDOR).
- Elevation: caller downloads any invoice by guessing sequential ids.

**Decided controls**
- Ownership-scoped query on both endpoints (WHERE org_id = :caller_org).
- Server computes `total`; the client value is ignored.
- Download returns a 60s signed URL; the object key is random, bucket is private.
- 404 (not 403) when the invoice is not owned, to avoid id enumeration.
- Audit log: user_id + invoice_id + action on create and download.

**Residual risk (accepted)**
- A signed URL is bearer within its 60s TTL; we accept the short window rather
  than per-download re-auth. Mitigated by the short TTL + audit trail.
```

The download handler doing the ownership check + expiry:

```python
# GOOD — ownership-scoped lookup, 404 on miss, short-lived signed URL.
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/invoices/{invoice_id}/download")
def download_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    invoice = db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.org_id == user.org_id,   # ownership scope
        )
    ).scalar_one_or_none()
    if invoice is None:
        # 404 (not 403): never confirm an invoice id the caller can't see.
        raise HTTPException(status_code=404, detail="Not found")
    url = object_store.signed_url(invoice.object_key, expires=timedelta(seconds=60))
    audit.info("invoice_download", user_id=user.id, invoice_id=invoice.id)
    return {"url": url}
```

Residual-risk note: the signed URL is bearer for its 60-second TTL and the audit
log records `user_id` only (no PII). Both are accepted trade-offs.

## Common pitfalls when an agent threat-models

Self-check against these before you call a model done:

- **Modeling the whole app instead of the diff or unit.** If you are listing
  threats to code the change doesn't touch, stop — scope to the changed boundary.
- **Listing threats with no decided control.** A STRIDE hit without a "Decided
  control" line is just anxiety. Every hit needs a concrete defense or an
  explicit "accepted" with a reason.
- **Trusting a client-side check as a control.** Hidden buttons, disabled form
  fields and front-end validation are UX, not security. The control must live on
  the server side of the `‖` it defends.
- **Confusing authentication with authorization.** "The user is logged in" is
  not a control for an IDOR. The control is "the query is scoped to *this*
  caller's rows."
- **Treating "internal" as safe.** An internal-only URL is exactly the SSRF
  target (cloud metadata, the database). Boundaries exist inside the perimeter.
- **Trusting a header the client controls as identity.** `X-Forwarded-For`,
  `X-Real-IP`, `Host` and similar are attacker-supplied unless your own proxy
  overwrites them. Don't key rate limits, allowlists or links on them.
- **Skipping the residual-risk line.** If you are knowingly not defending
  something (a short-lived bearer URL, say), write it down so the reviewer
  accepts it on purpose instead of discovering it in an incident.
- **Reporting a STRIDE hit as a finding.** A hit is a question. It becomes a
  finding only after the code proves it reachable (`verification.md`).

## From model to fix — the handoff

A finished model is an input to a code change, not the deliverable. For each
"Decided control", open the matching section in `fixes-by-stack.md`, take the
GOOD pattern for the repo's stack, and propose it as a diff for the changed
handler. Apply it only with the person's permission. Then re-run the relevant
scanners from `scanners.md` and the check that exposed the problem, so no
secret, SAST or CVE regression slipped in alongside the fix.

## Record the decisions

In a project with a `02-DOCS/` layer, the project's security decisions — threat
model, auth model, secrets backend, CI security gates, accepted risks — live in
`02-DOCS/wiki/stack/security.md`, indexed from `02-DOCS/wiki/index.md`. Read it
first and stay consistent; if it is missing or stale, update it with the real
choices and bump its `Updated` date in the same change. No `02-DOCS/` layer?
Skip silently. Conventions are recorded, never a gate on the task.

---

See `fixes-by-stack.md` for the vulnerable→fixed code that implements each
control per stack, including the auth surface (sessions, JWT, RBAC/ABAC)
referenced by the Spoofing and Elevation rows above.
