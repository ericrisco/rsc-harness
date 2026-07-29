---
name: calendar-scheduling
description: "Use when a product needs a booking surface — a pick-a-slot page, a Cal.com/Calendly embed, or real availability plus the confirmed meeting written to Google/Outlook — or when fixing double-booking, DST drift, or orphaned reschedule events. NOT calendar CRUD with no booking surface (that is `google-workspace`), NOT the payment (that is `stripe`)."
tags: [scheduling, booking, calendar, calcom, calendly, google-calendar, availability, webhooks]
recommends: [google-workspace, webhooks, automation-flows, email-connector, stripe, sales-pipeline]
profiles: []
origin: risco
---

# Calendar scheduling — booking surface + calendar sync, shipped together

Scheduling is always two halves bolted together: a **booking surface** (an
external person reserves a slot — embed, atom, or API call) and **calendar
sync** (you read free/busy to compute availability and write the confirmed
event back). Ship one without the other and you get the three bugs the rest of
this skill exists to prevent: **double-booking**, **timezone drift** after a DST
change, and **orphaned events** on reschedule.

## Decide the altitude first

Pick the lowest-code option that still owns the data model you actually need.

| You need… | Reach for | What you own | Escape hatch |
|---|---|---|---|
| A booking page fast, minimal code | **Embed Cal.com or Calendly** | Nothing — the widget owns slots/sync | Call the API later to read bookings / fire automation |
| Bookings in *your* UI, *your* branding/data model | **Cal.com Booker atom** or **Scheduling API** (Cal.com / Calendly) | Your UI; provider owns sync | Drop to raw provider API if the data model chafes |
| Read/write *one* provider's calendar directly | **Google `freebusy.query` + `events.insert`** | OAuth, refresh, slot math, watch/sync | If it's pure CRUD with no booking → `google-workspace` |
| Many providers (Google + Outlook + Apple), no N integrations | **Unified API** (Cronofy or Nylas v3) | One auth/availability surface | Cronofy if cross-domain scheduling matters; Nylas v3 is domain-scoped |

Why per row: the embed is zero-maintenance but a black box; the atom/API buys
your own UI without owning sync; raw provider is full control and full
liability; a unified API trades a vendor for not maintaining three calendar
integrations. Hosting, auth/scopes, webhook events, cross-domain support and
when each wins, per provider:
[`references/provider-matrix.md`](references/provider-matrix.md).

- **Cal.com** is open-source and self-hostable. Self-hosted instances get
  **unlimited API access** (no cloud rate limit) and full white-label by
  pointing the embed script at your own domain. REST base is `https://api.cal.com/v2`.
- **Calendly v1 API and its webhooks were discontinued in May 2025.** Use v2
  (REST/JSON, OAuth 2.1 or personal access token). Do not write new v1 code.

## OAuth scopes — narrowest that works

The default mistake is requesting the broad scope "to be safe." On Google, both
`calendar` and `calendar.events` are **restricted scopes** — they force a
third-party **security assessment** before you can ship to production. Avoid
them when a granular scope does the job.

```ts
// Bad — restricted scope, blocks production until a security assessment.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// Good — granular ladder, no restricted tier for the common booking case.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created", // app-owned secondary calendar it creates
  "https://www.googleapis.com/auth/calendar.freebusy",    // your own availability
  // add only if you must read the user's existing events to compute slots:
  "https://www.googleapis.com/auth/calendar.events.owned", // manage only events your app created
  "https://www.googleapis.com/auth/calendar.events.freebusy", // others' busy blocks
];
```

Scope ladder, narrowest first:

- `calendar.app.created` — a dedicated secondary calendar your app creates and
  owns. Best dodge for the restricted assessment when you only need *your* events.
- `calendar.freebusy` / `calendar.events.freebusy` — read availability (own /
  others') without reading event contents.
- `calendar.readonly` / `calendar.events.readonly` — read paths only.
- `calendar.events.owned` — write, but only events your app created.
- `calendar` / `calendar.events` — restricted; request only if you genuinely
  manage arbitrary events the app didn't create.

## Availability without double-booking — the core flow

Both classic races (computing slots in the browser, and writing the event
before re-checking) are eliminated by doing this server-side, in order:

1. **`freebusy.query`** across every relevant calendar (the host's, plus any
   secondary calendars that block time). Never trust a cached availability blob.
2. **Compute slots server-side** applying buffers (gap before/after),
   **minimum notice** (no "book in 5 minutes"), working hours, and slot length.
   The browser may *render* slots; it must never *decide* them.
3. **Place a short-lived hold/lock** on the chosen slot (a row with a TTL, or a
   tentative event) so a second request in the same window collides on the lock,
   not on the calendar.
4. **Write the event LAST** — only after the lock is held.
5. **Re-check `freebusy` inside the write transaction.** If the slot went busy
   between step 1 and now, abort and re-offer. This is the line that actually
   prevents the double-book.

Decision — do you need a hold step?

| Situation | Hold/lock? |
|---|---|
| Low traffic, single host, instant write | No — steps 1→5 with the in-transaction re-check is enough |
| Multi-step booking form, payment, or high contention | Yes — a TTL lock so the slot survives the form and releases if abandoned |

Google's availability primitive is `freebusy.query` (POST, returns busy blocks
per calendar); the write is `events.insert`. Both payloads (with
`conferenceData` for Meet), `watch` channels + sync tokens, recurring-event edge
cases and refresh-token handling:
[`references/google-calendar-sync.md`](references/google-calendar-sync.md).

## Timezone correctness

DST is where naive scheduling code dies. Rules:

- **Store the instant in UTC and carry the IANA zone id** (e.g.
  `Europe/Andorra`) separately. Never store a bare wall-clock string.
- **Render in the invitee's zone**, derived from the IANA id — not from a
  browser UTC *offset*. An offset (`+02:00`) is correct only on the day it was
  captured; it silently breaks across a DST boundary.
- **Google event payloads MUST set `timeZone`** alongside `dateTime`, or Google
  interprets the time in the calendar's default zone and the meeting drifts.

```json
// Bad — floating wall-clock, no zone. Drifts after the clocks change.
{ "start": { "dateTime": "2026-10-25T10:00:00" } }

// Good — instant + explicit IANA zone on both ends.
{
  "start": { "dateTime": "2026-10-25T10:00:00", "timeZone": "Europe/Andorra" },
  "end":   { "dateTime": "2026-10-25T10:30:00", "timeZone": "Europe/Andorra" }
}
```

## Webhooks that survive retries

A booking is not confirmed because the embed said so — it is confirmed when the
**webhook** says so. Providers retry, deliver duplicates, and arrive out of
order. Your handler must assume all three.

- **Verify the signature** before trusting the payload (Cal.com and Calendly
  each sign; reject unsigned).
- **Dedupe on the provider event id** — an idempotency key persisted before you
  act, so a retry is a no-op.
- **Handle the lifecycle:** Calendly fires `invitee.created` /
  `invitee.canceled` (and routing-form submissions); Cal.com fires
  `BOOKING_CREATED` / `BOOKING_CANCELLED` / `BOOKING_RESCHEDULED`. Map both to
  your own created/canceled/rescheduled handlers.
- Calendly **webhooks require a paid plan** (Standard/Teams/Enterprise) and are
  scoped `user` or `organization`. Single-use scheduling links **expire after
  90 days** if unused — don't hand out links you cache forever.

The generic inbound-receiver scaffolding (queue, retry, replay) lives in the
**webhooks** skill; this skill only owns the booking-specific lifecycle mapping.
For "on booking, also create a CRM record + Slack + sheet" cross-tool fan-out,
that orchestration is **automation-flows**, not here.

## Reschedule and cancel without orphans

- **Reschedule = update the same calendar event id.** Look up the event you
  created, `events.update` (or the provider's PATCH) the times — never
  `events.insert` a second one. The phantom-event bug is always a missing lookup.
- **Release the freed slot** — if you held a lock or marked a row busy, free it
  so the old time is offerable again.
- **Cancel = delete/cancel the same event** and release the slot; record the
  cancellation so reminders and downstream automation stop.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Compute available slots in the browser | Stale/raced data → double-book | `freebusy.query` server-side, re-check in the write txn |
| Request `auth/calendar` for a read-only widget | Restricted scope → blocked by security assessment | Narrowest scope: `calendar.freebusy` / `calendar.app.created` |
| Store local "wall-clock" times | Drift after DST → wrong-hour meetings | UTC instant + IANA zone; set `timeZone` on Google payloads |
| Trust the embed for confirmation state | Embed lies on network failures | Confirm only on a signature-verified webhook |
| Create a new event on reschedule | Orphaned phantom events pile up | `events.update` the same event id; release old slot |
| No idempotency on the webhook | Retries duplicate the booking | Dedupe on provider event id before acting |
| Cache a single-use scheduling link forever | Calendly links expire after 90 days | Generate on demand; treat expiry as expected |
| Poll the calendar for changes | Slow, rate-limited, misses edits | `watch` push channels + incremental sync tokens |
| Write new code against Calendly v1 | v1 API + webhooks dead since May 2025 | Calendly v2 (OAuth 2.1 / PAT) |

Adjacent skills: raw calendar CRUD / watch channels with no booking →
[`../google-workspace/SKILL.md`](../google-workspace/SKILL.md); charging for a
paid appointment → [`../stripe/SKILL.md`](../stripe/SKILL.md); booking funnel as
sales stages → [`../sales-pipeline/SKILL.md`](../sales-pipeline/SKILL.md);
sending the confirmation email itself → [`../email-connector/SKILL.md`](../email-connector/SKILL.md).
