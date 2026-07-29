---
name: analytics
description: "Use when instrumenting product or web analytics — GA4/PostHog SDK wiring, event taxonomy, funnels, double-counted events, consent gating, PII scrubbing. NOT charting that data (that is dashboard), NOT choosing which metrics matter (that is kpi-framework), NOT experiment math (that is ab-testing), NOT cookie-policy text (that is gdpr-privacy)."
tags: [analytics, ga4, posthog, event-tracking, telemetry, consent-mode, funnels, privacy]
recommends: [kpi-framework, ab-testing, gdpr-privacy, nextjs, dashboard, clickhouse-analytics]
origin: risco
---

# Analytics — the instrumentation layer

This skill owns the **capture** side of analytics: deciding *what to track*, *how to name it*, *where the
SDK lives in the codebase*, and *how not to leak PII or break consent law*. It produces three checkable
artifacts — an event taxonomy, tracking code (GA4 and/or PostHog), and a consent wiring. Everything
downstream of capture (charts, KPI choice, experiment stats, raw-event SQL, legal text) belongs to a
sibling; see the routing table below.

The order of work is fixed: **taxonomy → SDK wiring → consent gate → PII scrub → funnel + validation.**

## When NOT to use

| The ask | Route to |
| --- | --- |
| Chart the captured data on a board | `dashboard` |
| Decide *which* metrics matter (North Star, AARRR) | `kpi-framework` |
| Scheduled stakeholder reports / exports | `reporting` |
| Variant assignment, significance, experiment design | `ab-testing` (PostHog *experiments* live there; PostHog *event capture* lives here) |
| Query a warehouse of raw events with SQL | `clickhouse-analytics` / `duckdb` / `sql` |
| App error/trace/uptime telemetry (Sentry, OpenTelemetry) | `observability` |
| Cookie-banner legal text, DPA, ROPA, subject rights | `gdpr-privacy` / `data-policy` |
| Predict future values from a series | `forecasting` |

The load-bearing line: `analytics` = events flow **in**; `dashboard`/`reporting` = events flow **out**.

## Decision: GA4 vs PostHog vs both

| You need | Pick |
| --- | --- |
| Web/ads attribution, Google Ads conversions, marketing audiences | **GA4** |
| Product behavior, funnels, feature flags, session replay, self-serve insights | **PostHog** |
| Both marketing attribution *and* deep product analytics (very common) | **Both** — GA4 for ads, PostHog for product |

Running both is normal and fine. Keep **one taxonomy** shared across both so a `purchase` means the same
thing everywhere. Do not let the two tools drift into two naming schemes.

## Step 1 — Event taxonomy first, code second

**An event name is a contract: design the taxonomy before you write a single SDK call, and never rename a
live event in production.** Every funnel, audience, dashboard, and saved insight downstream is keyed by the
exact event name and property keys. Rename `signup_completed` to `sign_up` after launch and you silently
fork the metric into two — the old funnel flatlines, the new one starts from zero, and nobody notices for a
week. You can add events forever; you can never safely rename one.

Name events `object_action` in `snake_case`: `signup_completed`, `checkout_started`, `invoice_paid`. The
**object** is the noun, the **action** is a past-tense verb. Detail goes in **properties**, never in the
name — `cta_clicked` with `{ location: "navbar" }`, not three events `navbar_cta`, `hero_cta`, `footer_cta`.

GA4 hard constraints (the SDK silently truncates or drops violators): event names ≤ 40 chars, alphanumeric +
underscore only, **must start with a letter**; ≤ 25 params per event; ≤ 25 user properties. Prefer GA4
**recommended events** — `sign_up`, `login`, `purchase`, `add_to_cart`, `search`, `generate_lead` — with
their prescribed params, because they unlock prebuilt reports and audiences you cannot get from a custom name.

```text
Bad                              Good
"Clicked The Big Button"    →    cta_clicked          { location: "hero" }
trackSignup_v2              →    signup_completed     { method: "google" }
purchaseEvent2              →    purchase             { value: 49, currency: "EUR" }
NavbarCheckoutButton        →    checkout_started     { source: "navbar" }
```

**Identify vs anonymous.** Before login the user is anonymous (`client_id` / `distinct_id`). On
authentication, call `identify(stableUserId, { plan, signup_date })` — the stable id is your DB user id, a
UUID, **never the email**. On logout call `reset()` so the next visitor on a shared machine does not inherit
the previous person. The full starter SaaS + e-commerce catalog and property conventions are in
`references/event-taxonomy.md`.

## Step 2 — Wire the SDK

GA4 with the global site tag (Next.js `Script` shown; the consent block in Step 3 must run *before* this):

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

PostHog (`posthog-js`) — the cost/privacy-correct defaults:

```ts
import posthog from 'posthog-js';

posthog.init('phc_xxx', {
  api_host: '/ingest',              // reverse proxy: first-party path beats ad-blockers
  ui_host: 'https://eu.posthog.com',
  person_profiles: 'identified_only', // no profile per anonymous visitor — cheaper, more private
  defaults: '2025-05-24',
  // autocapture: false,            // turn off if you want a deliberate, named-only taxonomy
});

// on login:  posthog.identify(user.id, { plan: user.plan });
// on logout: posthog.reset();
```

`person_profiles: 'identified_only'` is the recommended default — it avoids creating a person profile for
every anonymous visitor. A **reverse proxy** (serving the SDK + ingestion under a first-party path like
`/ingest`) is standard practice for both PostHog and GA to dodge ad-blockers and tracking-prevention.

**Server-side capture** for actions off the browser — payment confirmation, webhooks, cron. With
`@posthog/next`, `await getPostHog()` works in server components, route handlers, and server actions; it
reads identity from the PostHog cookie (and opts the route into dynamic rendering, since it calls
`cookies()`). GA4 server events use the Measurement Protocol with the `client_id`. Full snippets — gtag
install, Consent Mode v2, Measurement Protocol, recommended-event param tables — are in
`references/ga4-setup.md` and `references/posthog-setup.md`.

## Step 3 — Consent before collection

**Decision: do you serve EEA / UK / CH traffic?** If yes, Consent Mode v2 is not optional. Since **21 July
2025** Google enforces it for EEA/UK traffic: tags without connected consent signals lose conversion
tracking, remarketing, and demographics. Four params are required and **default to `denied`** for EEA/UK/CH:

```html
<!-- This block MUST run BEFORE the gtag('config', ...) call in Step 2. Order is load-bearing. -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
  // when the banner is accepted:
  // gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ... });
</script>
```

PostHog's equivalent is `posthog.optOut()` / `posthog.optIn()` — start opted-out for EEA visitors and opt
in on acceptance. The legal *text* of the banner (what it says, the DPA, retention) is `gdpr-privacy`'s job;
this skill only wires the **signal** the banner emits. Region-scoped defaults live in `references/ga4-setup.md`.

## Step 4 — PII discipline

Never pass these into a `capture(` / `gtag('event'` / `track(` call. They turn an analytics store into a
breach-reportable PII store and violate most processing agreements:

| Banned in event props | Allowed instead |
| --- | --- |
| `email`, `phone`, full name | a hashed id, or set on the person profile only — not on every event |
| raw IP, geolocation coords | let the SDK derive coarse geo server-side |
| `password`, `token`, `secret`, API keys, `session_id` | nothing — these never belong in analytics |
| `credit_card`, `ssn`, IBAN | nothing |

Scrub at the boundary — a single `capture()` wrapper that strips known PII keys is far safer than trusting
every call site. A GA4 `user_id` is a **stable opaque identifier, not an email**; sending an email as the
`user_id` is a PII leak *and* a violation of Google's policy.

## Step 5 — Funnels & validation

Define the funnel from the **named events**, in order, e.g. `signup_started → signup_completed →
project_created → invoice_paid`. The funnel is only as reliable as the names, which is why Step 1 comes first.

Before you ship, **validate** — do not trust that it works:

- GA4: open the **DebugView** (or watch the network tab for `/g/collect` hits) and confirm each event fires
  once with the right params.
- PostHog: watch the **Activity** / live events feed; confirm `distinct_id` is stable across the session.
- **Do not fire events on render.** A `capture()` in a React component body or an unguarded `useEffect`
  re-fires on every re-render and double-counts. Fire on the user action, or in a `useEffect` with a
  correct dependency array / a fire-once guard.
- **Stitching:** GA4 Measurement Protocol events must arrive **within 48h** of the client-side timestamp to
  stitch to the right `client_id`. If you set `user_id` server-side, set the **same** `user_id` browser-side
  or you create duplicate users.
- Checking a PostHog feature flag emits a `$feature_flag_called` event — expected, not a bug; budget for it.

## Verify

Run `scripts/verify.sh [path]` (default: cwd). It is a **read-only static lint**, never a network call. It
flags: PII-looking literals inside `capture(` / `gtag('event'` / `.track(` calls; GA4 event names that break
the ≤ 40-char / leading-letter / charset rule; GA present without a `gtag('consent','default'` gate; and
`posthog.init(` with no host (reverse-proxy reminder). It exits 0 on a clean or empty target.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Rename a live event in prod | Forks the metric; old funnel flatlines, new one starts at zero | Add a new event; deprecate the old one in a doc, never rename |
| Treat autocapture as the taxonomy | Autocapture is noisy DOM events, not your domain — funnels become unbuildable | Design named domain events; autocapture is a supplement |
| Email/token in event props | Turns analytics into a breach-reportable PII store; violates the DPA | Scrub at a `capture()` wrapper; ids only |
| No consent gate for EEA/UK | Since 21 Jul 2025, Google drops conversions/remarketing/demographics | `gtag('consent','default', denied)` before config; PostHog `optOut` |
| `capture()` in render / unguarded effect | Re-fires every re-render → double-counting | Fire on the action or a fire-once-guarded effect |
| Server `user_id` ≠ browser `user_id` | Creates duplicate users; funnel splits | Use the same stable id on both sides; stitch within 48h |
| `posthog.init` with no proxy host | Ad-blockers eat ~20-40% of events | Serve SDK + ingest under a first-party path (`/ingest`) |
| Email as GA4 `user_id` | PII leak + Google policy violation | A stable opaque id (DB id / UUID) |
