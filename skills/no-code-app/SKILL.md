---
name: no-code-app
description: "Use when building an app on a no-code/low-code platform (Bubble, Softr, Glide over Airtable or Xano) — picking the platform, modeling the data, keeping usage-metered cost predictable, and planning the exit before lock-in. NOT a hand-written coded app (that is `nextjs`), NOT wiring SaaS tools together with no app UI (that is `automation-flows`)."
tags: [no-code, low-code, bubble, glide, softr, app-builder, mvp]
recommends: [nextjs, shopify, wordpress, automation-flows, spreadsheet-ops, notion-connector, stripe]
origin: risco
---

# No-code app

You are deciding whether to build an app on a visual platform, which platform, how to model it, and where the wall is. No-code is not "the easy way" — it is a trade: you buy speed-to-first-user and pay it back in logic ceilings and metered cost. Your job is to make that trade with eyes open.

**Decide the exit before you build the entrance.** If you cannot describe how you would leave, you are not building an MVP — you are building a hostage.

No-code wins on **speed-to-first-user** — a working app in days, no deploy pipeline. That is the only thing it reliably wins. It dies on **deep conditional logic** and on **scale economics**: many-branch workflows get unmaintainable, and metering turns a $29 bill into a $400 one without warning.

## Step 0: is no-code even the right tool?

Run this gate before touching any builder. If any line is a clear yes, route out — do not rationalize staying.

| If the user really wants... | Stop and go to |
| --- | --- |
| A hand-written app, full control over code | [../nextjs/SKILL.md](../nextjs/SKILL.md) (or [../react/SKILL.md](../react/SKILL.md)) |
| A commerce storefront, products + checkout | [../shopify/SKILL.md](../shopify/SKILL.md) |
| A content site / blog / CMS | [../wordpress/SKILL.md](../wordpress/SKILL.md) |
| To wire SaaS tools together, no app UI | [../automation-flows/SKILL.md](../automation-flows/SKILL.md) |
| A spreadsheet as the deliverable itself | [../spreadsheet-ops/SKILL.md](../spreadsheet-ops/SKILL.md) |
| A Notion workspace, not a published app | [../notion-connector/SKILL.md](../notion-connector/SKILL.md) |

No-code is the right tool when ALL hold: there is a real app UI (screens + data + logic), the logic is mostly CRUD + a handful of rules, time-to-launch matters more than scale today, and you accept the platform owns your runtime. If logic is the heart of the product (pricing engine, matching algorithm, real-time anything), no-code is wrong even if the UI is simple — write code.

## Pick the platform

Match the platform to the **app shape**, then to the **billing model** you will have to defend in six months. Why this order: the billing model, not the feature list, is what kills no-code projects.

| App shape | Platform | Bills on | Why |
| --- | --- | --- | --- |
| Internal tool / client portal over existing data | **Softr** | Flat rate per workspace | No per-write metering, no charge for internal editors → predictable as you grow |
| Customer-facing, simple, mobile-feel | **Glide** | "Updates" (data writes) | Fast to ship; cost scales with write volume, and rows are capped per plan (a standard source tops out far below Glide's own tables) — watch both |
| Complex custom SaaS, heavy logic, custom workflows | **Bubble** | Workload Units (WU) | Most powerful builder; every query/workflow/API call burns WU, and tier allotments are small (Starter ~175K WU, Growth ~250K — only ~1.4x, not the 4x some stale write-ups claim) → cost is a function of usage, not seats |

Rules:
- **Default to Softr for anything that is "a nice front-end over a table."** Flat-rate billing means a usage spike does not become a surprise invoice.
- **Reach for Bubble only when the logic genuinely needs it.** Bubble can do almost anything; that power is exactly why its WU bill is hard to predict. If you pick Bubble for a simple portal you are overpaying in money and complexity.
- **If you find yourself fighting the builder to express logic, that is the signal to stop** and reconsider [../nextjs/SKILL.md](../nextjs/SKILL.md). The builder fighting back is the migration cliff sending a postcard.

Exact tiers and numbers change — see [references/platform-limits.md](references/platform-limits.md). Do not hardcode prices into your design; design against the *metering model*.

## Model the data first

Tables and relations come before a single screen. Why: screens are cheap to rebuild, a wrong data model poisons every workflow and every cost estimate on top of it.

Pick the backend by **logic complexity**, not by familiarity:

| Backend | What it is | Use when | Watch out |
| --- | --- | --- | --- |
| Platform-native DB | Built into Bubble/Glide/Softr | Simple apps, one source of truth | Locked to the platform |
| Airtable | Relational DB with a spreadsheet UI | Simple read/create, admin data entry | ~50K records/base cap, slow API |
| Xano | Full backend (PostgreSQL + visual API builder) | Complex logic, performance, security | More setup; it is a real backend |

The hybrid pattern that scales: **Airtable for human data entry/admin, Xano for API logic + performance + security.**

Field-type and relation discipline:
- Normalize. One entity = one table. A `bookings` row links to `customers` and `classes` by relation, it does not copy the customer's name and email into every booking.
- Give every field its real type (date, number, single-select), not "text for everything." Wrong types make filters and aggregations expensive or impossible later.
- Watch the **50K-record/base cap on Airtable** and the fact that on Bubble every relation traversal in a workflow is WU you pay for.

Bad → Good:

```text
Bad  — one giant "Records" table, 40 columns, status in a text field,
       customer name + email + class title all duplicated per row.
       => filtering is slow, a rename means editing every row, WU/updates balloon.

Good — customers | classes | bookings(customer→, class→, date, status:single-select)
       => rename once, filter by relation, aggregate cleanly, predictable cost.
```

Sketch the model in plain text before you build it:

```yaml
customers: { id, name, email, phone }
classes:   { id, title, starts_at, capacity, instructor }
bookings:  { id, customer: ->customers, class: ->classes, status: [pending|paid|cancelled], created_at }
payments:  { id, booking: ->bookings, amount, provider_ref }   # via stripe
```

Payments in any of these flows: see [../stripe/SKILL.md](../stripe/SKILL.md).

## Build logic without footguns

The metering model punishes the obvious-but-wrong way of doing things. Build defensively.

- **Keep workflows shallow.** A 6-level nested conditional in a visual editor is unreadable and un-debuggable. If logic gets that deep, it belongs in code (Xano function or a real backend), not in the builder canvas.
- **Batch writes; never loop an API call per row.** A workflow that fires one external API call per record across 2,000 rows is 2,000 metered operations — this is the #1 cause of an exploded Bubble WU bill and Glide update overage. Batch, or move the loop server-side.
- **Validate server-side, not just in the UI.** Client-side-only validation in a no-code app is trivially bypassed; enforce rules in the backend (Bubble backend workflow, Xano endpoint) and gate writes with privacy/permission rules.
- **Push expensive aggregation to scheduled jobs**, not to every page load. Recomputing a dashboard on each view multiplies reads by traffic.

Bad → Good:

```text
Bad  — On booking confirmed: loop over all 2,000 customers, call email API per row.
       => 2,000 metered ops every run; WU/update bill spikes; rate limits hit.

Good — On booking confirmed: write one row; a scheduled batch job sends queued emails.
       => one metered write per booking; sending is amortized and rate-safe.
```

## Know your limits and the cost ceiling

The full 2026 tier/metering/record-cap table and worked cost examples live in [references/platform-limits.md](references/platform-limits.md). Operating rules:

- **Estimate cost from the metering model, not the sticker price.** Bubble: count WU ≈ queries + workflow steps + API calls per user action, times expected actions/month. Glide: count data writes (updates) per user per month. A free or Starter tier that looks fine at demo traffic is the trap.
- **Load-test at 10x expected rows, early.** A Bubble app that is snappy at 100 records can crawl at 10,000. Find the wall before your users do, not after.
- **Know the hard caps**: Airtable ~50K records/base; per-tier app/user/row limits on every platform. Design so you do not silently hit one in month three.
- **Watch the overage meters**: Bubble warns by email at 75% and 100% of your WU allotment, then charges overage. Wire those warnings to a human who can react.

## Plan the exit

This is the section everyone skips and everyone regrets. Do it on day 1.

1. **Export your data on day 1 and on a schedule.** Confirm the platform actually lets you export records (~68% give you no code export — data export is the minimum you must verify).
2. **Keep the data model portable.** Clean tables + relations (the model above) map onto Postgres/Prisma directly. A giant denormalized table does not.
3. **Know your migrate-off triggers** and watch for them:
   - Logic outgrows the canvas — many-branch conditionals, custom algorithms.
   - Performance — it crawls at real row counts (the 10K-row test).
   - Cost — the metered bill crosses what a real backend + hosting would cost.
4. **Price the rewrite honestly.** ~25-30% of no-code projects get rewritten when they outgrow the tool, at $50K-$250K. Knowing that number is what lets you decide *now* whether to start in code via [../nextjs/SKILL.md](../nextjs/SKILL.md) instead.

When two of those triggers fire, stop adding features and start the migration plan — do not keep pouring work into a runtime you are about to leave.

## Anti-patterns

| Bad | Good | Why |
| --- | --- | --- |
| Reaching for Bubble because "no-code is faster" | Run Step 0 gate first | Coded apps/stores/blogs route to nextjs/shopify/wordpress |
| Building screens, then bolting on data | Model tables + relations first | Wrong model poisons every workflow and cost estimate |
| One giant table, 40 columns, text-typed everything | Normalized tables linked by relation | Cheap renames, fast filters, predictable metering |
| Airtable for complex logic + scale | Xano (or hybrid: Airtable entry + Xano logic) | Airtable ~50K cap + slow API; Xano is a real backend |
| Per-row API call in a workflow loop | Batch writes / scheduled jobs | #1 cause of WU/update bill explosions |
| Client-side-only validation | Enforce rules server-side + permission gates | UI validation is trivially bypassed |
| Pricing off the monthly sticker | Estimate from the metering model | WU/updates scale with usage, not the headline price |
| Testing only at demo scale (100 rows) | Load-test at 10x expected rows early | Snappy at 100 can crawl at 10,000 |
| No export plan, hope you never leave | Export day 1, keep model portable | 68% offer no code export; rewrite is $50K-$250K |
| Picking Bubble for a simple internal portal | Softr (flat-rate) for portals over data | Predictable cost, no per-write surprise |
