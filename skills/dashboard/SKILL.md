---
name: dashboard
description: "Use when building or fixing a KPI dashboard decision-makers must read in one screen: which metrics earn a tile, how each tile is framed to answer a decision, and which chart fits it. NOT defining the metrics or their targets (that is kpi-framework), wiring the data (that is analytics), or writing a narrative status report (that is reporting)."
tags: [kpi-dashboard, data-visualization, executive-dashboard, chart-selection, dashboard-design, at-a-glance]
recommends: [kpi-framework, analytics, reporting, forecasting, business-intelligence, ab-testing, design, spreadsheet-ops]
origin: risco
---

# dashboard

A dashboard is read in **5 seconds by someone who will not scroll**. If a busy reader cannot grasp business status that fast, the design failed — no matter how accurate the numbers are. Your job here is **arrangement, framing, and chart choice**, producing a checkable artifact:

- `dashboard.yaml` — a tile manifest (each tile: metric, chart, comparison, owner, refresh, decision).
- a one-screen layout sketch placing the north-star top-left.

You do **not** decide which metrics matter (that is [kpi-framework](../kpi-framework/SKILL.md)) and you do **not** wire the data source (that is [analytics](../analytics/SKILL.md)). You take a metric set that already exists and make it readable at a glance.

Run `scripts/verify.sh dashboard.yaml` before you hand off. It checks shape and discipline — tile count 1-9, exactly one `north_star: true`, the required keys on every tile, no banned charts — never whether the numbers are correct.

## The Decision Test gate

No tile exists until its metric names the **action it drives**. Ask: *what does someone do differently based on this number?* If the answer is vague ("good to know", "shows we're growing"), the metric is vanity — cut it or convert it. A tile that changes no decision is decoration.

| Vanity metric (Bad) | Actionable conversion (Good) | Decision it drives |
| --- | --- | --- |
| Total followers | Follower-growth rate WoW | Double down or change content cadence |
| Total page views | Conversion rate by source | Reallocate spend to the converting channel |
| Cumulative signups | Activation rate (signup → key action) | Fix onboarding if activation drops |
| Total revenue (all-time) | MRR + net revenue retention | Whether to hire / extend runway |
| App downloads | 7-day retention | Kill or scale the acquisition channel |

Rule: an always-up counter ("total X") is almost always vanity. Convert it to a **rate or ratio** that can go down. Why: a number that only ever rises never triggers an action.

## Tile budget: 5-9, exactly one north-star

Executive dashboards carry roughly **5 to 9 KPIs**. Human working memory caps near ~7 items; more tiles cause analysis paralysis and the screen stops being a glance.

- Exactly **one** tile flagged `north_star: true`. Why: a glance needs a single first read.
- 4-8 supporting tiles around it. Total ≤ 9.

When a stakeholder demands 20 metrics, do not cram them — **tier**:

- [ ] Does this metric drive a decision the leadership team makes weekly? → main screen.
- [ ] Is it a diagnostic you only check *after* a main tile turns red? → drill-down view, linked from the parent tile.
- [ ] Is it commentary / context that needs prose? → route to [reporting](../reporting/SKILL.md), not a tile.
- [ ] Is it a projection of a metric forward? → [forecasting](../forecasting/SKILL.md), not the live screen.
- [ ] Does the user want to slice it freely by dimension? → [business-intelligence](../business-intelligence/SKILL.md), not a fixed tile.

## Framing every tile

The minimum viable tile is **not** a number. It is a number plus the context that makes it actionable:

```text
value + comparison(target | prior | benchmark) + delta + units + date range
+ RYG status + owner + refresh cadence
```

Bad → Good:

```text
Bad:   Churn: 4.1%
Good:  Monthly logo churn — 4.1%  ▲0.6pp vs prior month  (target ≤3.0%)  🔴
       Owner: Head of CS · Refresh: daily · Range: May 2026
```

Why each field earns its place:

- **comparison** — a number alone has no "is this good?"; target/prior/benchmark supplies it.
- **delta** — direction and magnitude of change is the second thing the eye wants.
- **units + date range** — "4.1%" of what, over what window; ambiguity kills trust.
- **RYG status** — lets the reader triage in the 5-second glance without reading the number.
- **owner** — every red tile needs an accountable human, or nothing happens.
- **refresh cadence** — tells the reader how stale the number can be; a "real-time" label on a weekly metric is a lie.

## Chart per metric: pick by shape

Choose the chart from the **shape of the question**, not from what looks impressive. Full matrix and edge cases in `references/chart-selection.md`.

| Metric shape | Chart | Why |
| --- | --- | --- |
| Single headline number | Big-number tile + delta | Fastest read; the north-star usually lives here |
| Trend over time | Line | Slope shows direction instantly |
| Category comparison | Sorted horizontal bar | Length is easy to compare; sorting answers "who's worst" |
| Target vs actual | **Bullet chart** | Compact, comparable; replaces gauges/dials |
| Part-to-whole (≤5 parts) | Stacked bar or treemap | Pie only legible to 3-5 slices |
| Correlation | Scatter | Shows relationship between two measures |
| Distribution | Histogram | Shape of spread, not just average |

Kill-list: no `pie` beyond 5 categories (sorted bar instead) and no `gauge` / `dial` (bullet chart instead) — verify.sh rejects both; no dual-axis, which invents correlations that aren't there; no 3D and no donut-with-center-number gimmicks.

## Layout & data-ink

Lay tiles out for the **Z / F scan pattern**: the eye starts top-left, sweeps right, drops down. Put the north-star top-left; group related KPIs together (acquisition cluster, revenue cluster, health cluster).

Apply the **data-ink ratio**: if a pixel shows no new information, remove it. Strip heavy borders, drop shadows, gradients, 3D, background textures — they raise cognitive load without adding meaning.

**Color is meaning, not decoration.** Use a status palette (red/yellow/green) only for status. A rainbow of tile colors with no semantic meaning makes the screen harder, not friendlier.

```text
Before:  9 boxed-and-shadowed tiles, each a different bright color,
         3 pie charts, two gauges, no clear starting point.
After:   north-star top-left (big number + sparkline);
         flat tiles, hairline separators, neutral palette;
         RYG reserved for status; bullets replace gauges;
         sorted bar replaces the pies.
```

## The artifact: `dashboard.yaml`

Emit a manifest a BI tool, a web app, or a human can build from. Short schema here; full field reference in `references/tile-schema.md`.

```yaml
# dashboard.yaml — one screen, one north-star
title: SaaS Exec Dashboard
date_range: "2026-05"
tiles:
  - id: waa
    north_star: true
    metric: Weekly Active Accounts
    chart: big_number          # + sparkline trend
    value_source: warehouse.fct_active_accounts
    units: accounts
    comparison: { type: target, value: 1200 }
    delta: vs_prior_week
    status_logic: "green ≥ target; yellow ≥ 90%; red < 90%"
    owner: VP Product
    refresh: daily
    decision: "If below 90% of target two weeks running, escalate activation work."
  - id: nrr
    metric: Net Revenue Retention
    chart: big_number
    comparison: { type: benchmark, value: 110 }   # %
    units: percent
    owner: VP Sales
    refresh: monthly
    decision: "Below 100% triggers a save/expansion review."
  - id: churn
    metric: Monthly Logo Churn
    chart: line
    comparison: { type: target, value: 3.0 }
    units: percent
    owner: Head of CS
    refresh: daily
    decision: "Above target investigates cohort + reason codes."
  - id: runway
    metric: Cash Runway
    chart: bullet                      # actual vs target months
    comparison: { type: target, value: 18 }
    units: months
    owner: CFO
    refresh: monthly
    decision: "Under 12 months opens fundraise / cost review."
  - id: pipeline
    metric: New Pipeline by Source
    chart: sorted_bar
    comparison: { type: prior, value: last_month }
    units: currency
    owner: Head of Marketing
    refresh: weekly
    decision: "Shift spend toward the top-converting source."
layout:
  north_star: top_left
  scan: Z
  groups: [growth, revenue, health]
```

The keys verify.sh requires on every tile: `metric`, `chart`, `comparison`, `owner`, `refresh`, `decision`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| 20 tiles on one screen | Past ~7, no one can read it in 5 seconds | Cut to 5-9; tier the rest to a drill-down |
| Vanity metrics (totals, followers) | Never trigger an action | Apply the Decision Test; convert to rates |
| Bare numbers, no comparison | No "is this good?" signal | Add target / prior / benchmark + delta |
| Pie chart with 8 slices | Slices become unreadable | Sorted horizontal bar |
| Gauges and dials | Waste space, resist comparison | Bullet chart |
| Rainbow tile colors | Color reads as meaning when it isn't | Neutral tiles; RYG for status only |
| "Real-time" on everything | False precision; refresh-cost theater | Match refresh to decision cadence |
| It's actually a report | Prose + commentary isn't a glance | Move narrative to reporting |
| No north-star | Reader has no entry point | One `north_star: true` tile, top-left |

## Handoff

Beyond the routes named above: reading out an experiment or variant significance → [ab-testing](../ab-testing/SKILL.md); visual polish, spacing and type scale of the rendered screen → [design](../design/SKILL.md); pulling or joining the underlying numbers in a sheet → [spreadsheet-ops](../spreadsheet-ops/SKILL.md).
