---
name: kpi-framework
description: "Use when a team must decide what to measure before building anything — picking one north-star metric, separating leading input drivers from lagging outputs, adding guardrails so a number cannot be gamed, and setting a target that is not arbitrary. NOT the live dashboard that displays them (that is `dashboard`), NOT instrumenting the events (that is `analytics`), NOT the recurring board report (that is `reporting`)."
tags: [north-star-metric, leading-vs-lagging, input-metrics, guardrail-metrics, target-setting, vanity-metrics, kpi-tree]
recommends: [analytics, dashboard, reporting, ab-testing, forecasting, business-intelligence, unit-economics, project-ops]
origin: risco
---

# KPI framework

You decide **what** to measure. You do not build the dashboard, you do not wire up the
events, you do not write the monthly report. Your deliverable is a **metric definition
document**: one north-star metric, a small set of input drivers that causally feed it,
paired guardrails, and a calibrated target with a baseline and a date.

Most measurement work fails upstream, before any chart exists. Teams instrument 40 KPIs
and none of them lead anywhere. They optimize a lagging output nobody can move. They
celebrate a vanity number. They set "double it this month" and watch it get gamed. Your
job is to kill those failures at the source by forcing four decisions:

1. **What single output predicts long-term value?** (the north star)
2. **Which 3-5 controllable inputs cause it?** (the driver set)
3. **What breaks if we over-optimize it?** (the guardrails)
4. **What target — baseline, magnitude, date — is honest and ungameable?**

Answer those four and hand the result to `../analytics/SKILL.md` to instrument and
`../dashboard/SKILL.md` to display. If you find yourself choosing chart types or writing
SQL, you have left this skill.

## The one artifact

Everything you produce collapses into a single table. Nothing leaves this skill with the
baseline, target, or date column blank — an unfilled target is a decision you skipped, not
a decision you made.

| metric | type | definition (event + window + denominator) | leading/lagging | owner | baseline | target | target_date |
|---|---|---|---|---|---|---|---|
| Weekly Active Teams | north-star | teams with >=1 member completing a core action in a rolling 7-day window / all active teams | lagging | PM, Activation | 38% | 52% | 2026-Q4 |
| Time-to-first-core-action | input | median minutes from signup to first core action, new teams | leading | PM, Onboarding | 41 min | <15 min | 2026-Q3 |
| Week-1 saved items | input | new teams with >=3 saved items in first 7 days / new teams | leading | PM, Onboarding | 22% | 40% | 2026-Q3 |
| Invites accepted | input | invited members who activate within 7 days / invites sent | leading | Growth | 31% | 45% | 2026-Q4 |
| Support tickets / active team | guardrail | open tickets / weekly active teams (must not rise) | lagging | Support lead | 0.12 | <=0.12 | ongoing |

The columns are not decoration. "Definition" must be unambiguous enough that two analysts
querying independently get the same number — that means a concrete **event**, a **time
window**, and a **denominator**. See `references/definition-and-targets.md` for how to
write definitions that don't drift.

## Step 1 — Pick ONE north star (the output)

**The north star is an output / lagging metric.** Why: it's the scoreboard for value
delivered, deliberately too broad to act on directly. You don't push the north star — you
push the inputs and watch the north star move. One per team; more than one means no team
actually owns the outcome.

**Express delivered value as a rate or ratio, not a raw count.** Why: raw counts grow with
time and headcount and hide health — "total users" goes up even as the product dies.

- Bad: `total registered users`
- Good: `weekly active teams that completed a core action / all active teams`

**It must predict long-term retention or revenue.** If the number can climb for a quarter
while the business erodes, it is not a north star. The test: would you bet next year's
retention on this number rising? If not, keep looking.

**Vanity reject test.** Followers, page views, likes, total signups — vanity unless tied to
a downstream outcome (conversion, revenue, retention). 10k followers with zero sales lift
is the canonical example. If a candidate metric can double with no change in value
delivered, reject it and say why in the doc.

Source candidates from a lens — AARRR (acquisition/activation/retention/referral/revenue)
or HEART (happiness/engagement/adoption/retention/task-success) — then narrow to one.
`references/metric-catalog.md` lists candidate north stars and driver sets per business
type (SaaS, marketplace, content, e-commerce, B2B sales-led).

## Step 2 — Build the driver set (3-5 inputs)

The north star is the scoreboard; the inputs are the plays you actually run.

**Each input is leading, directly controllable, and a concrete instrumentable event.** Why:
if the team can't influence it through their own work, it's not an input — it's another
output, and chasing it is vanity. "Engagement" and "satisfaction" are not inputs; they're
abstractions you cannot ship against.

- Bad: `increase engagement`
- Good: `% of new teams with >=1 saved item in the first 7 days`

**Each input must plausibly *cause* the north star.** Why: a metric tree connects every
node to its parent (the outcome) and its children (the inputs). A standalone number has no
defense against gaming; in a tree, gaming one node shows up as distortion in its neighbors.
Draw the tree so the causal claim is explicit and falsifiable:

```text
        Weekly Active Teams (north star, output)
        /              |                 \
Time-to-first      Week-1 saved        Invites accepted
core action        items (>=3)         within 7 days
(leading)          (leading)           (leading)
```

**Cap the set at 5.** Why: more than five inputs is sprawl — focus dilutes, nobody owns the
list, and you're back to the 40-KPI swamp you came to escape. If you have eight candidates,
the work of this step is cutting three.

Hand the final event list — exact events, windows, denominators — to `../analytics/SKILL.md`
to instrument. You define them; analytics implements them.

## Step 3 — Add guardrails / countermetrics

> "When a measure becomes a target, it ceases to be a good measure." — Goodhart's Law (Charles Goodhart, 1975)

Single-metric optimization gets gamed. Optimize sales volume alone and reps discount to the
floor; optimize Average Handle Time alone and agents hang up on unsolved problems.

**Every target gets a paired shadow metric representing the foreseeable harm.** Why: the
guardrail is what catches the gaming before it costs you. The pair must measure the thing
that breaks when someone over-optimizes the target.

| north-star / target you push | likely gaming move | guardrail to pair |
|---|---|---|
| Average Handle Time ↓ | agents close tickets prematurely | First Contact Resolution + Customer Effort Score |
| Activation rate ↑ | loosen "activated" definition, count trivial actions | week-4 retention of newly-activated cohort |
| Signups ↑ | buy low-intent traffic | activation rate of new signups |
| Revenue per order ↑ | aggressive upsell, hidden fees | refund rate + repeat-purchase rate |
| Sessions per user ↑ | dark patterns, notification spam | uninstall / unsubscribe rate |

A guardrail does not need a stretch target — its target is usually "must not get worse than
baseline." Write it into the table anyway, with `ongoing` as the date.

## Step 4 — Set the target

This is where frameworks most often break: arbitrary numbers that discourage, or
sandbagged ones that drive nothing.

**Baseline before target.** Why: you cannot calibrate a target without knowing current
state. "Get to 50%" is meaningless until you know whether you're at 12% or 48%. If there is
no baseline, the first deliverable is "measure the baseline" — do not invent a target on
top of an unknown.

**Magnitude must be calibrated — not arbitrary, not sandbagged.** Why: targets that are too
ambitious hurt performance through burnout and shortcuts; targets that are trivially safe
drive no improvement. Ground the magnitude in the baseline (a defensible improvement band)
and the levers you actually have, not in a round number that sounds good in a deck.

- Bad: `double activation this month`
- Good: `activation 38% → 52% by 2026-Q4, owner: PM Activation, based on onboarding rework + invite flow`

**Attach a date and an owner to every target.** Why: a target with no date is a wish; a
target with no owner is nobody's job. A row missing either is incomplete.

See `references/definition-and-targets.md` for baseline measurement, improvement-band
calibration, and why round-number targets invite theatre.

## Decision table — is this row a north star, an input, a guardrail, or noise?

| the metric is... | controllable by the team? | tied to delivered value? | → classify as |
|---|---|---|---|
| an output (outcome) | no (you steer it via inputs) | yes, predicts retention/revenue | **north star** (pick one) |
| an output | partially | yes, but could regress when pushing the NSM | **guardrail** |
| an input (a play) | yes, directly | causally feeds the north star | **input driver** |
| a count or output | no | no downstream outcome | **noise / vanity — reject** |

If a candidate is controllable but doesn't feed the north star, it's a distraction. If it's
tied to value but uncontrollable, it's either the north star itself or a guardrail. If it's
neither controllable nor value-tied, cut it.

## Anti-patterns

| anti-pattern | why it bites | the fix |
|---|---|---|
| Vanity metric | grows without value moving; celebrates nothing real | tie to a downstream outcome or reject |
| 40-KPI sprawl | nothing leads, no focus, no owner | one north star + 3-5 inputs, cut the rest |
| Lagging-only | you can watch it but can't act on it | add controllable leading inputs |
| Un-actionable input | team can't influence it through their work | replace with a concrete shippable event |
| Arbitrary target | "double it" discourages or invites gaming | baseline first, then a calibrated band |
| Single number, no guardrail | gets gamed, breaks a neighbor silently | pair every target with a countermetric |
| Raw count as north star | rises with time/size, hides decline | use a rate or ratio tied to value |
| Never re-validated | metric stops predicting value, nobody notices | re-check predictiveness semi-annually |

## Re-validation cadence

Re-validate the north star's **predictiveness** (does it still track retention/revenue?) and
the inputs' **controllability** (can the team still move them?) at least **semi-annually**.
Products and portfolios change; a metric that predicted value last year can quietly stop.
Evolve definitions transparently — version the doc, note what changed and why, so a metric
shift never looks like cooking the numbers.

## Handoff

When the metric definition doc is complete, route the downstream work:

- Events to instrument (the exact inputs + windows) → `../analytics/SKILL.md`
- What to display and how → `../dashboard/SKILL.md`
- Recurring narrative around the numbers → `../reporting/SKILL.md`
- Designing a test to move a specific input → `../ab-testing/SKILL.md`
- Projecting a metric forward in time → `../forecasting/SKILL.md`
- Cash/revenue economics, CAC/LTV behind the metric → `../unit-economics/SKILL.md`
- Wiring KRs into an operating cadence → `../project-ops/SKILL.md`
- Standing analytics models behind it all → `../business-intelligence/SKILL.md`
