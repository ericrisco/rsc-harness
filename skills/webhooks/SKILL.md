---
name: webhooks
description: "Use when building the receiving end of a webhook — a provider-agnostic endpoint that proves pushed events are authentic and never processes one twice: raw-body HMAC, ~5-min replay window, idempotency on the event id, fast-ack-then-queue. NOT the Stripe-Signature scheme (that is stripe), NOT outbound clients you call (that is api-connector-builder)."
tags: [webhooks, inbound-webhooks, hmac-verification, idempotency, signature-verification, queue, connectors]
recommends: [stripe, email-connector, api-connector-builder, automation-flows, redis, secure-coding]
profiles: []
origin: risco
---

# Webhooks — the inbound front door that survives retries and forgeries

You are building the side of a webhook that *receives*. Some external system
pushes an HTTP POST at your endpoint; your job is to prove it is real, refuse to
act on it twice, and answer fast. That is the whole mandate.

This skill is provider-agnostic — it teaches the mechanics every webhook source
shares, not any one vendor's event catalog — and it ends at "enqueued." What
happens to the event afterward is a different job:

- The Stripe-specific scheme (`Stripe-Signature`, `t=,v1=`, `stripe listen`,
  the event model) → `../stripe/SKILL.md`.
- Email bounce/complaint webhooks where the point is suppression state →
  `../email-connector/SKILL.md`.
- The *outbound* client that calls someone else's API → `api-connector-builder`.
- Multi-step orchestration after the event lands → `automation-flows`.
- Broker/queue tuning (BullMQ concurrency, DLQ ops) → `redis`.
- Constant-time compare, secret handling, supply-chain hygiene →
  `../secure-coding/SKILL.md`.

## The pipeline

These five stages run in exactly this order. Each one exists to protect the one
after it; reorder them and you either trust forged data or waste work.

| # | Stage | Why it precedes the next |
|---|-------|--------------------------|
| 1 | Read the **raw body** | Parsing first destroys the bytes the signature was computed over. Capture the raw buffer before any JSON parse. |
| 2 | **Verify the signature** | Until this passes, every field in the body is attacker-controlled. Verify before you read anything. |
| 3 | Check the **timestamp window** | A cheap reject of replayed-but-valid payloads, before you touch a datastore. |
| 4 | **Dedupe** on the event id | At-least-once delivery means duplicates are normal. Mark it seen before doing work, not after. |
| 5 | **Persist/enqueue → `2xx`** | Hand the event to durable storage, then ack. The ack means "I own this now." |

**Delivery is at-least-once, never exactly-once.** Every major provider retries
on non-2xx or timeout, so duplicate deliveries are normal traffic and idempotency
is required, not a nice-to-have.

## Verify the signature

**Verify over the raw bytes, never over re-serialized JSON.** Re-serializing a
parsed object reorders keys and normalizes whitespace, so the HMAC you compute
no longer matches the one the sender computed. This is the single most common
cause of "signature fails even though the secret is right."

```js
// Bad — body was parsed, so the bytes are gone. HMAC will never match.
app.post("/webhooks", express.json(), (req, res) => {
  const expected = sign(JSON.stringify(req.body)); // reordered, re-spaced
});

// Good — keep the raw buffer for the HMAC; parse only after verifying.
app.post("/webhooks", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body; // a Buffer, the exact bytes received
  if (!verify(raw, req.headers)) return res.sendStatus(400);
  const event = JSON.parse(raw.toString("utf8"));
});
```

**Compare signatures in constant time.** A normal `===`/`==` short-circuits on
the first differing byte, which leaks how much of the signature an attacker
guessed correctly. Use `crypto.timingSafeEqual` (Node) or `hmac.compare_digest`
(Python). The buffers must be equal length, so guard that first.

The cross-vendor **Standard Webhooks** spec (adopted by Svix, Clerk, Resend,
Brex and others) defines the scheme this skill defaults to: headers
`webhook-id`, `webhook-timestamp`, `webhook-signature`; the signature is
`base64(HMAC-SHA256(secret, "{id}.{timestamp}.{body}"))`, version-prefixed as
`v1,<sig>`, and the header may carry **space-separated** signatures so a secret
can be rotated without dropped deliveries — accept the request if **any** match.

```js
import crypto from "node:crypto";

function verify(raw, headers) {
  const id = headers["webhook-id"];
  const ts = headers["webhook-timestamp"];
  const secret = process.env.WEBHOOK_SECRET; // never a literal
  const signed = `${id}.${ts}.${raw.toString("utf8")}`;
  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "base64"))
    .update(signed)
    .digest("base64");
  // header is "v1,<sig> v1,<sig2>"; accept if any matches (secret rotation)
  return String(headers["webhook-signature"] || "")
    .split(" ")
    .map((part) => part.split(",")[1])
    .some((sig) => sameLength(sig, expected) &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}
const sameLength = (a = "", b = "") => a.length === b.length;
```

```python
import hmac, hashlib, base64, os

def verify(raw: bytes, headers) -> bool:
    secret = base64.b64decode(os.environ["WEBHOOK_SECRET"])  # never a literal
    signed = f'{headers["webhook-id"]}.{headers["webhook-timestamp"]}.'.encode() + raw
    expected = base64.b64encode(hmac.new(secret, signed, hashlib.sha256).digest()).decode()
    sent = headers.get("webhook-signature", "")
    for part in sent.split(" "):          # space-separated for rotation
        sig = part.split(",", 1)[-1]
        if hmac.compare_digest(sig, expected):  # constant time
            return True
    return False
```

Per-provider header formats (Stripe `t=,v1=`, GitHub `X-Hub-Signature-256`,
Shopify base64 HMAC, Slack `v0=`, Svix) all map onto the same primitive —
mapping table and per-language verify primitives in
`references/signature-schemes.md`.

## Timestamp & replay

A valid signature does not stop a replay: an attacker who captures one delivery
can re-send the exact bytes, signature intact. Bound it with a timestamp.

**Reject any event whose `webhook-timestamp` is more than ~5 minutes from now.**
That five-minute window is the de-facto industry value (Benchling and others
recommend it). The Standard Webhooks spec mandates that you perform *a*
tolerance check but does not fix the number — pick a small one.

```js
const skewSeconds = Math.abs(Date.now() / 1000 - Number(ts));
if (skewSeconds > 300) return res.sendStatus(400); // outside the 5-min window
```

The timestamp window bounds *how long* a captured payload is replayable; the
idempotency check (next section) stops *exact* replays that arrive inside the
window. You need both — neither alone is enough.

## Idempotency

**The idempotency key is the provider's stable event id** (`webhook-id`, or for
Stripe `event.id`) — never a hash of the body or your own generated id. Mark it
seen *before* doing the work, so a retry that arrives mid-processing is caught.

Two stores, same idea:

| Store | Mechanism | TTL / lifetime |
|-------|-----------|----------------|
| Relational DB | `INSERT` the event id into a table with a **UNIQUE** constraint; a duplicate insert throws → skip | Keep the row at least as long as the retry window |
| Redis | `SET key val NX EX <ttl>` — `SETNX` returns false if already present → skip | TTL **≥ the provider's retry window** (hours to days) |

**The dedupe TTL must outlive the provider's entire retry schedule.** Retries
are exponential and capped — a provider may redeliver hours or days later. If
your key expires first, that late retry looks brand-new and you process twice.

```js
// Insert-then-process: the UNIQUE insert is the gate. Do work only if we won it.
try {
  await db.query("INSERT INTO seen_events (id) VALUES ($1)", [id]);
} catch (e) {
  if (e.code === "23505") return res.sendStatus(200); // already seen → ack, skip
  throw e;
}
await queue.add("process", { id, event });
res.sendStatus(200);
```

Prefer **insert-then-process** over **process-then-mark**. Marking after the
work leaves a window where two concurrent deliveries both pass the "have I seen
it?" check and both run. Let the UNIQUE constraint (or `NX`) be the lock.

## Fast-ack & queue

Heavy synchronous work inside the handler causes provider timeouts and a storm
of retries. Return `2xx` as soon as the event is durably stored or enqueued,
then do the real work in a background worker. The status code is a contract with
the sender:

| You return | Meaning to the provider | Use it when |
|------------|-------------------------|-------------|
| `2xx` | "I own this now" | After enqueue/persist — **even if** downstream processing later fails. Recover failures from your own queue, not by asking for a redelivery. |
| `4xx` | Permanent reject, do not retry | Bad/forged signature (`400`/`401`), or a payload you will never accept. A retry of a forged request is still forged. |
| `5xx` / timeout | "Try again" | A genuine transient failure *before* you took ownership (e.g. the queue itself is down). |

Once work is in the queue, handle failures there: bounded retries with backoff,
then route exhausted jobs to a **dead-letter queue / poison shelf** for manual
inspection. Do not let a poison event loop forever or block the queue head.
Queue/broker tuning itself (concurrency, DLQ wiring) is `redis`'s job.

## Framework raw-body recipes

Capturing the raw body is framework-specific and is the usual culprit behind
"mismatch though the secret is correct." One line each; full recipes in
`references/framework-raw-body.md`:

- **Express** — mount `express.raw({ type: "*/*" })` on the webhook route only;
  do not let a global `express.json()` consume it first.
- **Next.js App Router** — read `await req.text()` (or `req.arrayBuffer()`) in
  the route handler; the App Router does not auto-parse, but `await req.json()`
  discards the raw bytes, so verify off the text.
- **FastAPI / Starlette** — `await request.body()` for the raw `bytes`; do not
  type the handler param as a Pydantic model (that parses for you).
- **Hono** — `await c.req.text()` before any `c.req.json()`.
- **Serverless (Lambda/Vercel/Cloudflare)** — disable body parsing / read the
  raw stream; base64-decode if the platform wraps the body.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|--------------|--------------|------------|
| HMAC over parsed/re-serialized JSON | Key reorder + whitespace break the signature ("works with the right secret but still fails") | Verify over the raw bytes captured before parsing |
| `===` / `==` on the signature | Timing side-channel leaks the secret byte by byte | `crypto.timingSafeEqual` / `hmac.compare_digest` |
| Heavy synchronous work in the handler | Provider times out → retry storm → duplicate processing | Fast-ack: verify → dedupe → enqueue → `2xx`, work in a worker |
| Ack before persisting/enqueueing | `2xx` means "I own it"; if you crash now the event is lost forever (provider won't retry a 2xx) | Persist or enqueue *first*, then return `2xx` |
| No dedupe / dedupe on a body hash | At-least-once delivery double-processes; body hashes drift across redeliveries | UNIQUE-constraint or `SETNX` on the provider's stable event id |
| Dedupe TTL shorter than the retry window | A late retry looks new and runs again | TTL ≥ the provider's full retry schedule (hours–days) |
| Signing secret hard-coded in source | Leaks in git history; can't rotate | Read from env; accept space-separated sigs for rotation |
| Returning `200` on a bad signature | Silently swallows forged traffic and masks misconfig | `400`/`401` on signature failure |
| Skipping the timestamp check | Valid-but-replayed payloads sail through | Reject outside the ~5-min window |

## Verify your handler

`scripts/verify.sh` is a read-only heuristic linter. Run it from the root of the
project that contains your handler; it scans candidate files and prints
PASS/WARN/FAIL per invariant (raw-body verify, constant-time compare, timestamp
check, secret-from-env, dedupe-on-event-id). A WARN means "I could not find
evidence," which on a clean tree is expected and exits `0`.
