---
name: whatsapp-telegram
description: "Use when wiring an app or agent to message customers over the WhatsApp Cloud API or a Telegram bot — order updates, OTP codes, reminders, alerts and broadcasts — or when debugging undelivered messages, 24-hour-window errors, rejected templates, webhook signature verification, or rate limits and their retry headers. NOT the reply content you send (that is `customer-support`)."
tags: [whatsapp, telegram, messaging, cloud-api, bot-api]
recommends: [customer-support, webhooks, automation-flows, chatbot, nodejs]
origin: risco
---

# WhatsApp & Telegram messaging

You are wiring code that pushes messages to real customers. Both platforms have sharp, silent rules: code that passes in testing 403s or drops in production. This skill is the transport pipe — endpoints, auth, windows, rate limits, webhooks. The *words* you send are out of scope (that is `../customer-support/SKILL.md`).

## Pick your platform

| If the customer is... | Use | Why |
| --- | --- | --- |
| already on WhatsApp, identity-verified, you have their phone number | WhatsApp Cloud API | Highest reach + trust; but **template-gated** and **billed per message**. |
| an opt-in bot subscriber (clicked "Start") | Telegram Bot API | Free, instant, dev-friendly, no template gate, but reach = people who joined your bot. |

You can ship both — but the rules do not transfer. WhatsApp's 24-hour window and template gate have no Telegram equivalent; Telegram's 30 msg/s ceiling has no WhatsApp equivalent.

---

## WhatsApp Cloud API

### Env + endpoint

Never hardcode credentials. Four values come from the Meta App + WhatsApp Business Account (WABA):

```bash
WA_TOKEN=...            # Bearer access token (System User token in prod, not a temp one)
WA_PHONE_NUMBER_ID=...  # the sending number's ID, not the phone number itself
WA_WABA_ID=...          # WhatsApp Business Account ID (for template management)
WA_APP_SECRET=...       # app secret, used to verify inbound webhook signatures
```

Send endpoint, **with the version pinned in the path**:

```
POST https://graph.facebook.com/v25.0/{WA_PHONE_NUMBER_ID}/messages
Authorization: Bearer ${WA_TOKEN}
Content-Type: application/json
```

Pin the version (`v25.0` is current, announced 2026-02-18; `v24.0` is the lowest still supported). Why: a versionless URL drifts onto whatever Meta defaults to and breaks payload shape without warning. Never call `graph.facebook.com/{id}/messages` bare.

### The 24-hour customer-service window (the load-bearing rule)

A **free-form** message can ONLY be sent inside a 24-hour window that the *user* opened by messaging you. Outside that window you MUST send a pre-approved **template** to re-engage — a free-form send out-of-window fails with **error #131047** (re-engagement message required).

| Window state | What you may send | Cost |
| --- | --- | --- |
| Open (user messaged < 24h ago) | Any free-form text / media / interactive | Free |
| Open | Utility template | Free (in-window) |
| Closed (no recent user message) | **Approved template only** | Billed per message (marketing/auth rates) |
| Closed + you send free-form | nothing — **#131047** | n/a |

So branch on window state before every send: in-window → free-form is fine; otherwise → reach for a template.

### Send free-form text (in-window)

```bash
curl -sS -X POST "https://graph.facebook.com/v25.0/${WA_PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer ${WA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"34699999999","type":"text","text":{"body":"Your order #1234 shipped."}}'
```

```ts
const res = await fetch(
  `https://graph.facebook.com/v25.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: "34699999999",
      type: "text",
      text: { body: "Your order #1234 shipped." },
    }),
  },
);
const data = await res.json();
const messageId = data.messages?.[0]?.id; // capture it — your only handle for delivery tracing
```

Always log `messages[0].id` from the response. It is the only key that ties a send to the later delivery/read webhook.

### Send a template (out-of-window or any business-initiated message)

```ts
const body = {
  messaging_product: "whatsapp",
  to: "34699999999",
  type: "template",
  template: {
    name: "appointment_reminder",      // must be APPROVED in WhatsApp Manager first
    language: { code: "ca" },
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Maria" },
          { type: "text", text: "dimarts a les 10:00" },
        ],
      },
    ],
  },
};
```

Templates are created and approved via WhatsApp Business Manager or the `POST /{WA_WABA_ID}/message_templates` API before they can be sent. Variable order in `parameters` must match the `{{1}} {{2}}` placeholders in the approved template body.

### Template categories + cost

Four categories: **marketing**, **utility**, **authentication**, **service**. Category drives both policy and price.

Billing changed on **2025-07-01**: conversation-based pricing is **deprecated**, replaced by **per-message** pricing — you are billed per delivered *template* message, rate by category + recipient country. Free-form messages inside an open window are free; utility templates inside an open window are free. Do not reason about old "per-conversation" pricing — it is gone. Full category/price table → `references/whatsapp-cloud-api.md`.

Policy note: since **2026-01-15** Meta prohibits general-purpose AI assistants (open ChatGPT-wrapper bots) on WhatsApp. Business automation is fine; a generic chatbot is not. For conversational design see `../customer-support/SKILL.md`.

### Inbound webhook

1. **GET verify** — Meta calls your callback URL once with `hub.mode`, `hub.verify_token`, `hub.challenge`. If `hub.verify_token` matches your configured token, echo back `hub.challenge` (plain, 200).
2. **POST events** — every event POST carries `X-Hub-Signature-256: sha256=<hmac>`. Compute `HMAC-SHA256(rawBody, WA_APP_SECRET)` and compare. **Reject unsigned/mismatched bodies** — without this anyone can forge inbound events.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyMeta(rawBody: string, header = ""): boolean {
  const expected =
    "sha256=" + createHmac("sha256", process.env.WA_APP_SECRET!).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

For retry/idempotency/dedupe patterns of the receiver itself, this is the WhatsApp-specific setup only — generic receiver design → `webhooks`.

---

## Telegram Bot API

### Token + base URL

Get a token from **@BotFather**. Every method is an HTTP call:

```
https://api.telegram.org/bot${TG_TOKEN}/<METHOD>
```

Token from env (`TG_TOKEN`), never inline — it embeds in the URL and leaks in logs. Current Bot API is **10.0** (released 2026-05-08).

### sendMessage

```bash
curl -sS "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
  -d chat_id=123456789 \
  --data-urlencode "text=Build *passed* ✅" \
  -d parse_mode=MarkdownV2
```

```ts
await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: 123456789, text: "Build passed", parse_mode: "HTML" }),
});
```

`parse_mode` is `HTML` | `MarkdownV2` | `Markdown` (legacy). **MarkdownV2 requires escaping** the reserved set `_*[]()~\`>#+-=|{}.!` with a backslash, or the call 400s. HTML is safer for dynamic text. Text cap is **4096 chars** per message — split longer payloads into chunks. Escape table + chunking → `references/telegram-bot-api.md`.

### Rate limits (the silent killer)

- Broadcast ceiling: **~30 messages/second** across all chats.
- Same chat: **~1 message/second**.
- Exceed either → **HTTP 429** with a JSON `parameters.retry_after` (seconds). **Honor it**: sleep `retry_after` seconds, then retry. Do not blast-retry — you will be throttled harder.
- Need more than 30/s? Enable **Paid Broadcasts** via @BotFather (up to 1000 msg/s, 0.1 Telegram Stars per excess message).

```ts
async function tgSend(payload: object, tries = 5): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.status !== 429) return res;
    const { parameters } = await res.json();
    await new Promise((r) => setTimeout(r, (parameters?.retry_after ?? 1) * 1000));
  }
  throw new Error("Telegram: rate-limited after retries");
}
```

### Inbound: setWebhook XOR getUpdates

Pick exactly **one** — never run both, they conflict.

- **setWebhook(url, ...)** — Telegram POSTs updates to your URL. Set a `secret_token`; Telegram echoes it back in the `X-Telegram-Bot-Api-Secret-Token` header — verify it. Optional `allowed_updates` (filter types) and `max_connections` (1–100, default 40).
- **getUpdates** — long-poll loop, good for local dev / single-instance bots. Calling `getUpdates` while a webhook is set returns an error; call `deleteWebhook` first.

Generic receiver design (retries, idempotency) → `webhooks`.

---

## Cross-cutting rules

1. **Tokens from env only.** A leaked `WA_TOKEN` or `TG_TOKEN` is an account takeover. No inline secrets, ever.
2. **Pin the Graph API version.** Versionless URLs drift and break payloads silently.
3. **Respect windows and rate limits.** WhatsApp: branch on the 24h window. Telegram: honor `retry_after`.
4. **Idempotency on retries.** A network retry can double-send; key sends on your own order/event id and dedupe.
5. **Capture the response message id** (WhatsApp `messages[0].id`, Telegram `result.message_id`) — your only handle for delivery tracing.

## Anti-patterns

| Bad | Good | Why |
| --- | --- | --- |
| Free-form WhatsApp send to a customer who hasn't messaged in days | Send an approved template to re-engage | Out-of-window free-form fails with **#131047**. |
| `POST graph.facebook.com/{id}/messages` (no version) | `POST .../v25.0/{id}/messages` | Versionless drifts onto Meta's default and breaks payload shape. |
| `Authorization: Bearer EAAxxx...` hardcoded | `Bearer ${process.env.WA_TOKEN}` | Hardcoded tokens leak in git/logs = account takeover. |
| Retry immediately after a Telegram 429 | Sleep `retry_after` seconds, then retry | Blast-retrying gets you throttled harder, not faster. |
| `setWebhook` AND a `getUpdates` loop | Pick exactly one | They conflict; `getUpdates` errors while a webhook is set. |
| Process inbound WhatsApp POST without checking `X-Hub-Signature-256` | Verify HMAC-SHA256 with app secret | Unsigned events are forgeable; you'd act on spoofed messages. |
| Reasoning about WhatsApp "per-conversation" cost | Per-**message** since 2025-07-01 | Conversation pricing is deprecated; estimates will be wrong. |
| Sending raw user text as `MarkdownV2` | Escape reserved chars, or use `HTML` | Unescaped `.` `-` `!` etc. 400 the call. |

## References

- `references/whatsapp-cloud-api.md` — full payload shapes (text/template/media/interactive), template component JSON, error codes (#131047, #131026, #100, template errors), webhook payload + signature verify, pricing category table, 2026 policy.
- `references/telegram-bot-api.md` — messaging method catalog, MarkdownV2 escape table, setWebhook + getUpdates examples, 429 backoff, Paid Broadcasts.
