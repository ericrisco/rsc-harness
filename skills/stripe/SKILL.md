---
name: stripe
description: "Use when wiring an app to Stripe for payments, subscriptions, Checkout, webhooks or the billing portal — adding a paywall or paid plan, charging recurring fees, and debugging why a completion event never fires, why signature verification fails, or why a webhook fires twice and duplicates the order. NOT a generic non-Stripe inbound event receiver (that is `webhooks`), NOT the invoice document's legal form (that is `invoicing`), NOT deciding what to charge (that is `pricing`)."
tags: [stripe, payments, subscriptions, checkout, webhooks, billing, saas]
recommends: [webhooks, invoicing, pricing, secure-coding, nodejs]
profiles: []
origin: risco
---

# Stripe — Checkout, subscriptions, and webhooks that survive production

Wire an app to Stripe for one-time payments and subscriptions: a Checkout
Session to take money, a signature-verified webhook to learn the outcome, and
the billing portal so customers manage themselves. Targets stripe-node v22.x
(API version `2026-05-27.dahlia`).

The one rule everything else hangs off:

- **Stripe is the source of truth; your DB is a cache kept current by verified
  webhooks.** A subscription's real state lives in Stripe. You mirror it locally
  only so you can render a paywall without a round-trip. The webhook is what
  keeps the mirror honest — never the client redirect, never polling.

## When to use / When NOT to use

**Use when:** adding Checkout or a paywall; taking a one-time or recurring
charge; receiving Stripe webhooks; letting users cancel/upgrade via the portal;
debugging `No signatures found matching`, double-fired events, or a
`checkout.session.completed` that never arrives.

**Do NOT use for:**

- A **generic, non-Stripe inbound webhook receiver** (arbitrary HMAC, a
  retry/queue consumer for any provider) → `webhooks`. This skill only covers
  Stripe's `Stripe-Signature` scheme and event model.
- The **invoice document's legal form** — what must appear on it, dunning copy,
  payment-status as a business process → [invoicing](../invoicing/SKILL.md).
- **Cash-flow forecasting, bank reconciliation, month-close** →
  [finance-ops](../finance-ops/SKILL.md).
- **What to charge / plan tiers / packaging** → [pricing](../pricing/SKILL.md).
  This skill implements a price; it does not decide it.
- A **typed client for some other REST API** → `api-connector-builder`.

## Pick the surface

| You need | Use | Why |
|---|---|---|
| A link to sell one product, zero code | Payment Link | No backend; Stripe hosts everything. Outgrow it fast. |
| Hosted checkout, full control of session | **Checkout Session** | The default. Stripe hosts the page, handles SCA/3DS, PCI scope is minimal. |
| Your own embedded payment form | Payment Element + Checkout Session | Custom UI, but you render the form. Use the Element *with* a Checkout Session, not raw PaymentIntents, unless you have a reason. |

Default to **Checkout Session** unless a requirement forces otherwise.

## Mental model

```text
Customer ──> Price (you defined it in Stripe) ──> Checkout Session
   │                                                    │
   │                                          customer pays (hosted)
   ▼                                                    ▼
your DB  <── webhook (verified) ── Event <── Subscription / Invoice
(a cache)                                    (the real state, in Stripe)
```

Env vars used throughout — read from the environment, never hard-code:

- `STRIPE_SECRET_KEY` — `sk_test_…` in dev, `sk_live_…` in prod.
- `STRIPE_WEBHOOK_SECRET` — `whsec_…`, one per endpoint; differs in test vs live.

## Construct the client (pin the API version)

```ts
import Stripe from "stripe";

// Pin apiVersion explicitly so a dashboard-level version bump can never change
// your API behavior under you. Match the version your SDK release ships with.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia",
});
```

## Create a Checkout Session

```ts
// Subscription mode — recurring price.
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: "price_123", quantity: 1 }], // a recurring Price ID
  success_url: `${BASE}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${BASE}/pricing`,
  // Tie the session to YOUR user so the webhook can find the right row.
  client_reference_id: userId,
  // 14-day trial; omit for immediate billing.
  subscription_data: { trial_period_days: 14 },
});
// Redirect the browser to session.url.
```

```ts
// Payment mode — one-time charge (e.g. a digital download).
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: "price_onetime", quantity: 1 }],
  success_url: `${BASE}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${BASE}/`,
  client_reference_id: userId,
});
```

`success_url` is a UX redirect, not proof of payment. The customer can close the
tab before it loads, or hit the URL directly. **Grant access from the webhook,
not the redirect.**

## The webhook handler (load-bearing)

This is where integrations break. Three non-negotiables:

1. **Verify against the RAW body.** `constructEvent` recomputes the signature
   over the exact bytes Stripe sent. Any middleware that parses/re-serializes
   the body (e.g. `express.json()` on this route) changes those bytes and you
   get `No signatures found matching the expected signature`.
2. **Return 2xx before slow work.** Verify, record the event, return 200
   immediately. Stripe treats a timeout as failure and retries — for up to 3
   days in live mode — so slow handlers cause duplicate delivery.
3. **Be idempotent.** Events are unordered and may arrive more than once.
   Dedupe on `event.id`, persisting the idempotency record in the *same
   transaction* as the business write. Default replay tolerance is 5 minutes.

```ts
// Express. The route gets the RAW body; do NOT mount express.json() here.
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,                          // raw Buffer, untouched
      req.headers["stripe-signature"]!,  // header name is lowercase
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  // Dedupe + record in one transaction; skip if we have seen this event.id.
  const fresh = await recordEventOnce(event.id, event.type);
  if (!fresh) return res.status(200).send(); // already processed; ack and stop

  // Return 2xx FAST. Hand heavy work to a queue/background job if it is slow.
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      await grantAccess(s.client_reference_id!, s.customer as string);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub.customer as string, sub.status); // mirror state
      break;
    }
    case "invoice.payment_failed":
      // dunning lives here; see references/webhook-events.md
      break;
  }
  res.status(200).send();
});
```

See [`references/webhook-events.md`](references/webhook-events.md) for the full
event catalog per flow (subscription lifecycle, one-time payment, dunning) and
what each event should do to your DB.

### Framework gotchas (raw body)

```ts
// Next.js App Router — read the raw text yourself; do not use req.json().
// app/api/webhook/route.ts
export async function POST(req: Request) {
  const body = await req.text();                       // raw string
  const sig = req.headers.get("stripe-signature")!;
  const event = stripe.webhooks.constructEvent(body, sig, secret);
  // ...handle, then:
  return new Response(null, { status: 200 });
}
```

```ts
// Edge / Cloudflare Workers — synchronous crypto is unavailable. Use the async
// API with the Web Crypto provider.
const event = await stripe.webhooks.constructEventAsync(
  body, sig, secret, undefined, Stripe.createSubtleCryptoProvider(),
);
```

## Subscribe to only the events you need

For a subscription paywall, listen to exactly these — listening to "all events"
is discouraged and buries you in noise:

`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.paid`, `invoice.payment_failed`.

## Billing portal (self-service)

Do not build cancel/upgrade/update-card UI. Stripe hosts it.

```ts
const portal = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,             // the Customer you stored
  return_url: `${BASE}/account`,
});
// Redirect to portal.url — it is short-lived; mint it on demand, never cache it.
```

## Idempotency on create calls

A retried POST (network blip, double-click) can create two subscriptions.
Pass an idempotency key derived from the operation, not a random one:

```ts
await stripe.checkout.sessions.create(params, {
  idempotencyKey: `checkout:${userId}:${planId}`,
});
```

## Local testing — Stripe CLI, never hand-crafted JSON

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook   # prints a whsec_… secret
stripe trigger checkout.session.completed                # fire a real test event
```

Put the printed `whsec_…` in `STRIPE_WEBHOOK_SECRET` for local runs. Hand-built
JSON will never pass signature verification — that is the point.

## Going live

Compact checklist; depth in [`references/going-live.md`](references/going-live.md):

- [ ] `apiVersion` pinned explicitly in the client.
- [ ] Swap `sk_test_`/`whsec_` (test) for live values via env, not code.
- [ ] Create the live webhook endpoint; copy its **own** signing secret.
- [ ] Restrict the event subscription to the allowlist above.
- [ ] Use **restricted API keys** for the server, not the unrestricted secret.
- [ ] Idempotency keys on all create calls.
- [ ] Confirm SCA/3DS is handled (Checkout does this for you).

## Anti-patterns

| Bad | Good | Why |
|---|---|---|
| `express.json()` on the webhook route | `express.raw()` / `req.text()` | Re-serialized body breaks the signature → `No signatures found matching`. |
| No `constructEvent` — trust the payload | Always verify the signature | Anyone can POST fake events to an unverified endpoint. |
| Grant access on the `success_url` redirect | Grant on `checkout.session.completed` | The redirect is UX, not proof; it can be skipped or forged. |
| DB writes, then return 200 | Return 200 fast, queue slow work | Timeouts make Stripe retry → duplicate delivery. |
| Process every delivery | Dedupe on `event.id` in the write txn | Events are unordered and at-least-once. |
| Hard-coded `sk_live_…` in source | `process.env.STRIPE_SECRET_KEY` | Leaked keys = drained account; never commit them. |
| No `apiVersion` | Pin it explicitly | A dashboard version bump silently changes your API behavior. |
| Poll the API for subscription state | React to webhooks | Polling is slow, rate-limited, and races real events. |
| Listen to all event types | Subscribe to the allowlist | Noise, wasted handling, accidental side effects. |
| Cache the portal/session URL | Mint per request | These URLs are short-lived and single-use. |

## See also

- `webhooks` — generic, non-Stripe inbound event receivers.
- [invoicing](../invoicing/SKILL.md) — the invoice document and its legal form.
- [pricing](../pricing/SKILL.md) — deciding tiers and amounts before you wire them.
- [secure-coding](../secure-coding/SKILL.md) — secret handling, key restriction.
