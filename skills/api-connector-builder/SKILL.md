---
name: api-connector-builder
description: "Use when writing a client for someone else's REST or GraphQL API: auth flow choice and token refresh, pagination to exhaustion, retry-with-jitter on transient failures only, rate-limit-aware throttling. NOT inbound callbacks (that is `webhooks`), NOT chaining services (that is `automation-flows`), NOT designing your own API (that is `api-design`)."
tags: [api, rest, graphql, oauth, pagination, retries, rate-limiting, http-client, connector]
recommends: [webhooks, automation-flows, api-design, data-scraper, secure-coding, error-handling, structured-extraction]
origin: risco
---

# API connector builder — auth, pagination, retries, rate limits

You are writing a client for **someone else's** HTTP API. You do not own the
contract; you obey it. The deliverable is one typed connector module per vendor
that authenticates, walks the whole result set, retries only transient failures
with backoff, and stays under the rate limit without getting the key banned.
One connector = one vendor: mixed clients tangle two auth schemes and two
rate-limit budgets into something no one can reason about.

Four pillars, every time: **auth, pagination, retries, rate limits.** If your
connector skips any one of them it works in the demo and breaks in production —
on page 2, on token expiry, on the first 429, or on a flaky network.

## Step 0 — read the contract

Read the vendor docs before writing a line — invented endpoints and guessed
field names 404 in prod. Extract these first; each one changes what you write,
so missing one means a rewrite.

| Find in their docs        | Why it changes your code                                  |
| ------------------------- | --------------------------------------------------------- |
| Auth scheme + token TTL   | Picks the flow below; TTL decides if you need refresh     |
| Base URL **and version**  | Wrong version = silent 404s or deprecated field shapes    |
| Rate-limit header names   | You cannot throttle to a budget you cannot read           |
| Pagination style          | Cursor vs offset vs Link vs Relay = different loop         |
| Error envelope shape      | Where the real error code lives (body, not always status) |
| Idempotency support       | Decides whether POST is safe to retry (key header?)       |

If a fact is not in the docs, probe one real call and read the response headers
and body — do not assume.

## Auth — pick the flow, then store the secret right

OAuth 2.1 is the current baseline. Three deltas you must honor: **PKCE is
mandatory for every authorization-code client**, the **Implicit** and
**Resource-Owner-Password** grants are **removed**, and **bearer tokens may not
travel in query strings** (header only) — query strings end up in logs and
referrers. (oauth.net/2.1, accessed 2026-06-02.)

| Flow                          | Pick it when                                | Secret lives        | Refresh strategy                       |
| ----------------------------- | ------------------------------------------- | ------------------- | -------------------------------------- |
| **API key in header**         | Simple server-to-server, vendor issues key  | env / secret store  | none; rotate manually                  |
| **Bearer static token**       | Personal access token, long-lived           | env / secret store  | none; treat as a key                   |
| **OAuth2 Client Credentials** | Machine-to-machine, no end user             | client_id + secret  | re-mint on 401; cache until expiry     |
| **OAuth2 Auth-Code + PKCE**   | Acting on behalf of a user                  | refresh token       | rotate on every refresh (see below)    |
| **Device flow**               | CLI / TV / input-constrained device         | refresh token       | poll then rotate as auth-code          |

**Refresh-token rule (public clients):** refresh tokens must be **sender-
constrained or one-time-use** — rotated on every refresh, with the old one
invalidated. Keep access tokens short-lived. Never log a raw token; log a partial
or hash if you must correlate. (OAuth 2.0 Security BCP / RFC 9700, accessed
2026-06-02.) Full per-flow walkthroughs, token storage, and a DPoP note are in
`references/auth-flows.md`.

## Retries + backoff

Retry **only transient failures**, and only when the operation is safe to repeat.

| Status / error                       | Retry? | Note                                          |
| ------------------------------------ | ------ | --------------------------------------------- |
| 429 Too Many Requests                | yes    | honor `Retry-After` (see rate limits)         |
| 502 / 503 / 504                      | yes    | server-side transient                         |
| Connection reset / timeout / DNS     | yes    | network transient                             |
| 400 / 401 / 403 / 404 / 409 / 422    | **no** | replay returns the same error — fix the call  |
| 2xx                                  | n/a    | success                                       |

**Idempotency gate.** GET/PUT/DELETE are idempotent by semantics and safe to
retry. **POST is not** — only retry it if you send a stable **idempotency key**
so the server dedupes the duplicate. (AWS Builders' Library, accessed 2026-06-02.)

**Backoff with jitter.** Use `delay = min(cap, base * 2^attempt) + random_jitter`.
The jitter is not optional: without it, every client that failed at the same
instant retries at the same instant — a synchronized thundering herd that DDoSes
the recovering server. Full or decorrelated jitter is preferred. Always set stop
conditions: **max attempts 3–5, a total deadline, and a per-attempt timeout.**
(AWS Builders' Library, accessed 2026-06-02.)

```python
# Bad: retries everything, flat sleep, no jitter, no cap, no deadline.
for _ in range(10):
    r = httpx.get(url)
    if r.status_code == 200:
        return r.json()
    time.sleep(1)  # 4xx will never recover; herds synchronize on flat 1s
```

```python
# Good: transient-only, exponential backoff WITH jitter, bounded.
import random, time, httpx

RETRYABLE = {429, 502, 503, 504}

def get(url, *, attempts=5, base=0.5, cap=20.0, deadline=60.0):
    started = time.monotonic()
    for attempt in range(attempts):
        try:
            r = httpx.get(url, timeout=10.0)  # per-attempt timeout
        except (httpx.ConnectError, httpx.ReadTimeout):
            pass  # network transient -> fall through to backoff
        else:
            if r.status_code == 200:
                return r.json()
            if r.status_code not in RETRYABLE:
                r.raise_for_status()  # 4xx: do not retry, surface it
        if time.monotonic() - started > deadline:
            raise TimeoutError("retry deadline exceeded")
        delay = min(cap, base * 2 ** attempt) + random.uniform(0, base)
        time.sleep(delay)
    raise RuntimeError("max attempts exhausted")
```

In Python prefer `tenacity` 9.1.4 (`@retry` with `wait_exponential_jitter`,
`stop_after_attempt`, `retry_if_exception_type`) over a hand loop; in Node/TS use
`undici` (the engine behind global `fetch()` since Node 18) with its retry
interceptor. (PyPI/tenacity, nodejs/undici, accessed 2026-06-02.)

## Rate limits

Do not guess the wait — the server tells you. **Precedence:**

1. **`Retry-After` present** (on a 429 or 503) → wait exactly that. It is either
   a number of seconds or an HTTP-date; handle both.
2. **No `Retry-After`** → compute the wait from `X-RateLimit-Reset` (a Unix epoch
   or a delta-seconds, per vendor docs).
3. **Proactively throttle** on `X-RateLimit-Remaining` — slow down *before* you
   hit zero rather than absorbing a wall of 429s. (iotools.cloud rate-limiting
   guidance, accessed 2026-06-02.)

```python
# Bad: ignore the headers, hammer, eat 429s, get the key throttled or banned.
while more:
    resp = client.get(next_url)   # no remaining check, no Retry-After
    process(resp)
```

```python
# Good: header-aware. Honor Retry-After, else reset; brake near the limit.
def wait_for_rate_limit(resp):
    ra = resp.headers.get("Retry-After")
    if ra is not None:
        return float(ra) if ra.isdigit() else _seconds_until_httpdate(ra)
    remaining = int(resp.headers.get("X-RateLimit-Remaining", "1"))
    if remaining <= 1:
        reset = float(resp.headers.get("X-RateLimit-Reset", "0"))
        return max(0.0, reset - time.time())  # or reset directly if delta-seconds
    return 0.0
```

For sustained pulls, gate every request through a **token-bucket** sized to the
documented budget (e.g. 60 req/min → refill 1 token/sec, capacity 60) so bursts
smooth out instead of slamming the wall.

## Pagination — loop to exhaustion

There is no single best strategy; the vendor chose one and you follow it. The
universal rule: **loop until the API says there is no next page — never a fixed
page count.** A hardcoded `for page in range(10)` silently drops everything after
page 10.

| Style                      | Signal of "next"                          | Trade-off                                   |
| -------------------------- | ----------------------------------------- | ------------------------------------------- |
| **Offset / page number**   | `?offset=` / `?page=` until empty page    | simple; drifts on inserts, slow at depth    |
| **Cursor / keyset**        | opaque `next_cursor` in body              | stable under writes, fixed cost — prefer it |
| **Link header (REST)**     | `Link: <...>; rel="next"`                 | parse the header, follow until no `next`    |
| **Relay (GraphQL)**        | `pageInfo.hasNextPage` + `endCursor`      | pass `endCursor` as `after` next query      |

(graphql.org/learn/pagination + pagination pattern guides, accessed 2026-06-02.)

Expose results as a generator / async-iterator so callers stream instead of
buffering everything:

```python
def iter_records(client):
    cursor = None
    while True:
        page = client.get("/items", params={"cursor": cursor, "limit": 100})
        body = page.json()
        yield from body["data"]
        cursor = body.get("next_cursor")
        if not cursor:           # exhaustion signal, not a counter
            return
```

Full code for every style — offset, keyset, `Link`-header parsing, GraphQL Relay
connection walking, in Python and TS, plus dedup-on-overlap notes — is in
`references/pagination.md`.

## Putting it together

A minimal connector wires all four pillars plus env config and structured logging.

```python
# connector.py — Python: httpx + tenacity
import os, logging, httpx
from tenacity import retry, stop_after_attempt, wait_exponential_jitter, retry_if_exception_type

log = logging.getLogger("connector")
TOKEN = os.environ["VENDOR_API_TOKEN"]          # from env, never hardcoded

class Transient(Exception): ...

@retry(stop=stop_after_attempt(5),
       wait=wait_exponential_jitter(initial=0.5, max=20),
       retry=retry_if_exception_type(Transient))
def _request(client, method, path, **kw):
    r = client.request(method, path, timeout=10.0, **kw)   # per-request timeout
    log.info("req id=%s %s status=%s", r.headers.get("x-request-id"), path, r.status_code)
    if r.status_code in (429, 502, 503, 504):
        raise Transient(r.status_code)
    r.raise_for_status()
    return r

def client():
    return httpx.Client(base_url="https://api.vendor.com/v2",
                        headers={"Authorization": f"Bearer {TOKEN}"})  # header, not query
```

```typescript
// connector.ts — Node/TS: global fetch (undici) + bounded retry
const TOKEN = process.env.VENDOR_API_TOKEN!;          // from env, never hardcoded
const RETRYABLE = new Set([429, 502, 503, 504]);

export async function request(path: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const res = await fetch(`https://api.vendor.com/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...init.headers },
    signal: AbortSignal.timeout(10_000),              // per-request timeout
  });
  console.info(JSON.stringify({ id: res.headers.get("x-request-id"), path, status: res.status, attempt }));
  if (RETRYABLE.has(res.status) && attempt < 4) {
    const ra = Number(res.headers.get("retry-after"));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(20_000, 500 * 2 ** attempt) + Math.random() * 500;
    await new Promise((r) => setTimeout(r, wait));
    return request(path, init, attempt + 1);
  }
  return res;                                          // caller checks res.ok / paginates
}
```

## Anti-patterns

| Anti-pattern                          | Consequence                              | Fix                                          |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Retry 4xx (401/403/404/422)           | Burns attempts; same error every time    | Retry only 429 + 5xx + network errors        |
| `for page in range(N)` fixed loop     | Silently drops records past page N       | Loop on cursor / Link / hasNextPage          |
| Flat `sleep(1)` between retries        | Synchronized herd hammers recovering API | Exponential backoff **with** jitter + cap    |
| Log the token / Authorization header  | Leaked credential in shipped logs        | Log request id + status + attempt only       |
| Hardcode the API key in source        | Leaks via git; cannot rotate cleanly     | Read from env / secret store                 |
| No request timeout                    | One hung socket stalls the whole run     | Set a per-request timeout always             |
| Ignore `Retry-After`                  | Keep 429-ing; key gets throttled/banned  | Honor `Retry-After`, else `X-RateLimit-Reset`|
| Re-POST on retry with no idempotency  | Duplicate charges / records              | Send an idempotency key, or do not retry POST|
| Token in query string                 | Token ends up in logs / referrers        | Bearer in the `Authorization` header         |
| Implicit / password OAuth grant       | Removed in OAuth 2.1; insecure           | Auth-Code + PKCE, or Client Credentials      |

## Verify

Run `scripts/verify.sh` over the connector you write: it greps for hardcoded
secrets, asserts a retry mechanism and a pagination loop and a request timeout
exist, and flags `localStorage` token storage or plaintext token logging. It is a
structure linter (read-only), not a behavior test — exit 0 on a clean target.
