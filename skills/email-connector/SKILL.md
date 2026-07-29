---
name: email-connector
description: "Use when wiring server code to send transactional or bulk email via Resend, SendGrid, or Postmark: a provider-agnostic sendEmail() seam, idempotent retries, 100-cap batches with partial failures, transactional-vs-broadcast streams, bounce webhooks feeding a suppression list. NOT SPF/DKIM/DMARC inbox reputation (that is `email-deliverability`)."
tags: [email, transactional-email, resend, sendgrid, postmark, webhooks, idempotency]
recommends: [email-deliverability, newsletter, webhooks, secure-coding, api-connector-builder, automation-flows]
origin: risco
---

# email-connector — put transactional & bulk email on the wire

You wire the *send*. A welcome mail, a password reset, a receipt, a 4,000-row
digest — your job is the server code that hands it to a provider, makes it safe
to retry, and keeps the suppression list honest. You do **not** own the inbox
(SPF/DKIM/DMARC/reputation is `../email-deliverability/SKILL.md`) and you do
**not** own the words (subject lines and growth are `../newsletter/SKILL.md`,
launch copy is `../marketing/SKILL.md`). Generic typed clients for *any* REST API
are `../api-connector-builder/SKILL.md`; deciding *when* a multi-step sequence
fires is `../automation-flows/SKILL.md`.

Stack as of June 2026: `resend` 6.12.4, `@sendgrid/mail` 8.1.6, Postmark via its
HTTP API, React Email 5.0 (React 19.2 / Next.js 16, Tailwind 4), Node 20+ / TS.

`scripts/verify.sh` is read-only and greps a target for the four invariants this
skill exists to hold: env-sourced key, idempotency, a single `sendEmail()` seam,
and a webhook signature checked on the raw body.

## Step 1 — pick a provider

| Provider | Best default fit | Native idempotency | Template model | Batch cap | Pick when |
|----------|------------------|--------------------|----------------|-----------|-----------|
| **Resend** | Greenfield, React/Next shops | Yes — `{ idempotencyKey }`, 24h, ≤256 chars | React Email JSX via `react:` | 100/call | You want JSX templates and the least ceremony |
| **SendGrid (Twilio)** | High volume, marketing+txn mix | No — dedupe yourself | `d-` dynamic templates + `dynamicTemplateData` | per-send `personalizations` | You need 10k req/s scale or already on Twilio |
| **Postmark** | Pure transactional, deliverability-first | No — self-dedupe via your key + webhooks | Postmark server templates | per-stream | Receipts/resets must never queue behind marketing |

Idempotency support changes your strategy, not just your config — see Step 4.
Full per-provider matrix (auth header, SDK + version, single/batch signatures,
idempotency model, stream/subdomain model, dynamic-template syntax, webhook event
names, rate limits, when to pick each) plus a suppression-webhook handler skeleton
per provider is in `references/providers.md`.

## Step 2 — the `sendEmail()` seam

One provider-agnostic function. The rest of the app calls `sendEmail(...)` and
never imports a provider SDK. *Why:* swapping SendGrid→Postmark is then one file,
not a grep across every call site. That one file reads the key from
`process.env` — never a `re_…` / `SG.…` / server-token literal, because a
committed key is a send-as-you credential and burns your reputation with it.

```ts
// lib/email/index.ts — the only place a provider SDK is imported
export type SendArgs = {
  to: string | string[];
  subject: string;
  react?: React.ReactElement; // template component
  html?: string;
  text?: string;
  idempotencyKey: string;     // required for transactional sends
  stream?: 'transactional' | 'broadcast';
};
export async function sendEmail(args: SendArgs): Promise<{ id: string }> { /* provider impl */ }
```

```ts
// lib/email/resend.ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(a: SendArgs) {
  const { data, error } = await resend.emails.send(
    { from: 'YourApp <noreply@notify.yourdomain.com>', to: a.to, subject: a.subject, react: a.react, html: a.html, text: a.text },
    { idempotencyKey: a.idempotencyKey }, // 2nd arg, retained 24h, ≤256 chars
  );
  if (error) throw new Error(error.message);
  return { id: data!.id };
}
```

```ts
// lib/email/sendgrid.ts
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(a: SendArgs) {
  const [res] = await sgMail.send({
    from: 'noreply@notify.yourdomain.com',
    to: a.to, subject: a.subject, html: a.html, text: a.text,
    // SendGrid has no idempotency key — guard with your own dedupe (Step 4)
  });
  return { id: res.headers['x-message-id'] };
}
```

```ts
// lib/email/postmark.ts — raw HTTP, X-Postmark-Server-Token header
export async function sendEmail(a: SendArgs) {
  // Postmark has no idempotency key: self-dedupe BEFORE calling (Step 4)
  const r = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN!,
    },
    body: JSON.stringify({
      From: 'noreply@notify.yourdomain.com',
      To: Array.isArray(a.to) ? a.to.join(',') : a.to,
      Subject: a.subject, HtmlBody: a.html, TextBody: a.text,
      MessageStream: a.stream === 'broadcast' ? 'broadcast' : 'outbound',
    }),
  });
  if (!r.ok) throw new Error(`Postmark ${r.status}`);
  return { id: (await r.json()).MessageID };
}
```

Bad → Good:

```ts
// Bad — provider SDK called directly in a route handler, key inline
import { Resend } from 'resend';
await new Resend('re_live_123abc').emails.send({ to, subject, html });
```
```ts
// Good — call the seam; key is in env, swap is one file
import { sendEmail } from '@/lib/email';
await sendEmail({ to, subject, react: <Welcome name={n} />, idempotencyKey });
```

## Step 3 — templates

Templates are typed components, not string concat. *Why:* JSX escapes
interpolated values; hand-built HTML invites injection and broken markup.

React Email 5.0 renamed `renderAsync` → `render`. The Resend SDK lazily imports
`@react-email/render` when you pass `react:`, so you usually pass the component
directly and skip manual rendering.

```tsx
// emails/welcome.tsx
import { Html, Button, Text } from '@react-email/components';
export function Welcome({ name, url }: { name: string; url: string }) {
  return (
    <Html>
      <Text>Welcome, {name}.</Text>
      <Button href={url}>Confirm your email</Button>
    </Html>
  );
}
```

```ts
// SendGrid: dynamic template referenced by a d- id, data passed separately
await sgMail.send({
  to, from: 'noreply@notify.yourdomain.com',
  templateId: 'd-abc123...',                  // dynamic template id starts with d-
  dynamicTemplateData: { name, confirm_url },  // values, not pre-rendered HTML
});
```

```ts
// Bad — string concat, unescaped user input straight into HTML
const html = '<h1>Hi ' + req.body.name + '</h1>'; // XSS + broken layout risk
```

## Step 4 — idempotency & retries

Every transactional send carries a key, because queues retry, serverless
functions re-fire, and users double-click — without a stable key one password
reset becomes three. Derive it from the *event*, not the clock. Same event → same
key → provider (or your table) collapses the duplicate.

```ts
const idempotencyKey = `pwreset:${userId}:${tokenVersion}`; // stable across retries
```

- **Resend:** native. Pass `{ idempotencyKey }` as the 2nd arg; retained 24h,
  ≤256 chars. For a batch, the key represents the whole batch (e.g.
  `team-quota/123456789`), not each row.
- **Postmark / SendGrid:** no idempotency feature. You must self-dedupe: write
  the key to a `sent_emails` table inside the same transaction as the send,
  unique-constrain it, and skip if it already exists.

```ts
// Self-dedupe seam for providers without native keys
const inserted = await db.sentEmails.insertIfAbsent({ key: idempotencyKey });
if (!inserted) return; // already sent — do not re-fire
await sendEmail({ to, subject, html, idempotencyKey });
```

```ts
// Bad — no key; queue retry sends the reset 3×
await sendEmail({ to, subject, react: <Reset url={url} /> } as any);
```

## Step 5 — batch / bulk

`resend.batch.send([...])` is capped at **100 emails per call** and forbids
attachments/scheduling. Chunk larger runs, then inspect *both* arrays for
partial failure — a 200 response can still contain per-row errors.

Checklist for a bulk run:

- [ ] Filter the recipient list against the suppression list (Step 7) first.
- [ ] Chunk into ≤100; one `idempotencyKey` per chunk.
- [ ] Use `batchValidation: 'permissive'` so one bad address does not nuke the chunk.
- [ ] Iterate results: collect succeeded ids and failed rows separately.
- [ ] Re-queue only the failed rows; never replay the whole chunk.

```ts
function chunk<T>(xs: T[], n = 100) { const o: T[][] = []; for (let i = 0; i < xs.length; i += n) o.push(xs.slice(i, i + n)); return o; }

for (const [i, group] of chunk(recipients).entries()) {
  const { data } = await resend.batch.send(
    group.map((r) => ({ from, to: r.email, subject, react: <Digest items={r.items} /> })),
    { idempotencyKey: `digest-2026-06/${i}`, batchValidation: 'permissive' },
  );
  data?.data?.forEach((d) => markSent(d.id));      // succeeded rows
  // inspect per-row errors and re-queue only those — do not replay the chunk
}
```

## Step 6 — transactional vs broadcast split

Reputation isolation. Give each stream a distinct From, subdomain, and
stream/IP so they cannot poison each other:

| Stream | From | Subdomain | Provider stream |
|--------|------|-----------|-----------------|
| Transactional | `noreply@notify.yourdomain.com` | `notify.` | Resend default / Postmark `outbound` |
| Broadcast | `news@promo.yourdomain.com` | `promo.` | dedicated marketing stream / `broadcast` |

*Why:* a marketing send that trips a blocklist must never take password resets
down with it. The DNS/auth setup for those subdomains is
`../email-deliverability/SKILL.md`'s job; you just send on the right one.

## Step 7 — delivery/bounce/complaint webhook → suppression

The provider POSTs bounce and complaint events. Verify the signature on the
**raw** body (parse after verifying), then write the address to a suppression
list and check that list before every future send. The verification is absolute
because this hook mutates the suppression list: unverified, anyone can suppress
— or un-suppress — your users.

```ts
// app/api/email/webhook/route.ts (Next.js 16) — verify BEFORE parsing
export async function POST(req: Request) {
  const raw = await req.text();                       // raw body, not req.json()
  if (!verifyProviderSignature(raw, req.headers)) return new Response('bad sig', { status: 401 });
  const event = JSON.parse(raw);
  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    await db.suppressions.upsert({ email: event.data.to, reason: event.type });
  }
  return new Response('ok');
}
```

```ts
// Before any send: skip suppressed addresses
const recipients = candidates.filter(async (e) => !(await db.suppressions.has(e)));
```

Generic webhook hardening (replay windows, queueing, retries beyond email) is
`../webhooks/SKILL.md`. The address-validity question (is this mailbox real
before I ever send) is `../lead-gen/SKILL.md` / `../email-deliverability/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|--------------|--------------|------------|
| API key hard-coded (`re_…`, `SG.…`, server token) | Committed credential = send-as-you abuse | Read from `process.env`; rotate via `../secure-coding/SKILL.md` |
| No idempotency key on transactional sends | Queue/serverless retry double-sends | Deterministic `event:userId:version` key |
| One stream for everything | Marketing hit poisons reset/receipt deliverability | Split From + subdomain + stream (Step 6) |
| String-concatenated HTML with user input | XSS + broken layout | React Email component or `d-` dynamic template |
| Ignoring per-row `data.errors` in a batch | Silent partial loss; "looked like 200" | Inspect both arrays; re-queue only failures |
| Trusting the webhook without signature check | Anyone can poison your suppression list | Verify signature on raw body, then parse |
| Sending to a bounced/complained address | Reputation damage, ISP penalties | Filter against suppression list before send |
| Calling the provider SDK at scattered call sites | Provider swap = grep across the app | One `sendEmail()` seam (Step 2) |
