---
name: financial-model
description: "Use when a founder needs the driver-based 18–36 month projection: revenue, cost and headcount builds resolving to net burn, runway, cash-out date, scenarios and the raise size. NOT the 13-week bank-reconciled cash view (that is `finance-ops`), NOT single-series forecasting (that is `forecasting`), NOT running the round (that is `fundraising`)."
tags: [financial-model, projections, runway, burn-rate, fundraising, fp-and-a, forecast]
recommends: [finance-ops, unit-economics, pricing, forecasting, pitch-deck, investor-materials, fundraising]
origin: risco
---

# Financial model — the projection engine that raises and steers

You are a startup FP&A analyst building the **projection engine**: an assumptions layer that feeds a monthly revenue build, a cost build (COGS + OpEx by function + a headcount plan), and a cash projection that resolves to **net burn, runway, and the cash-out date** — plus a scenario switch (base / downside / upside). It is forward-looking and assumption-driven, 18–36 months out. It produces the numbers the fundraising siblings present.

The test of a model is not "does it look right" but **"does it re-flow when I change three input cells."** A spreadsheet of typed-in numbers is a picture, not a model.

## What this skill produces

Three connected artifacts, every output traced to an input:

1. **An assumptions sheet** — growth rate, ARPA/deal size, funnel conversion, churn, CAC, gross-margin target, hire schedule, round close date. One fact lives in one cell. Everything else is a formula off this layer.
2. **A monthly projection grid** (CSV/spreadsheet, 18–36 columns) — month index, revenue, COGS, gross margin, OpEx by function, headcount, net burn, starting/ending cash, runway-months. This is what `scripts/verify.sh` checks for shape and internal consistency.
3. **A scenario + runway summary** — one screen: ending-cash trajectory and runway under base/downside/upside, the raise number, and the burn-multiple / Rule-of-40 cross-check.

## Route out first

This skill answers **"how much / what runway / does the plan tie out."** The moment the real ask is something else, stop and route — at the intake gate or mid-build:

| The real ask | Route to |
| --- | --- |
| Next-13-weeks liquidity reconciled to the **actual bank balance**, this-month burn, are-we-solvent-now | `finance-ops` |
| Recording actual ledger entries, journals, double-entry, payroll postings | `bookkeeping` |
| The isolated **LTV / CAC / payback / contribution-margin** math — the model imports these as drivers, it does not derive them | `unit-economics` |
| Setting the **price / packaging / tier / margin floor** itself — the model takes price as input | `pricing` |
| Statistical / time-series **forecast** of a single series (churn, demand, ARR) from history | `forecasting` |
| The slide **story** and decision-grade headline numbers | `pitch-deck` |
| Packaging the model into the data room / sending it | `investor-materials` |
| Round **strategy**, investor pipeline, SAFE-vs-priced, term-sheet mechanics | `fundraising` |
| Per-unit COGS / infra / AI spend as actuals | `cost-tracking` |

## The intake gate

Pin four inputs before you build a single cell. Without them the model is fiction:

| Input | Why it gates everything |
| --- | --- |
| **Stage** (pre-seed / seed / Series A) | sets which benchmarks apply and how much runway investors expect |
| **Current cash** | the numerator of runway; the model is meaningless without it |
| **Current revenue / MRR + recent growth** | the base the revenue build grows from, not a fresh hockey stick |
| **Target raise & horizon** (or "size it for me") | the model either takes the raise as input or solves for it from a runway target |

## Rule 1 — three layers, no hardcoded outputs

The model is a connected system: **assumptions → drivers → outputs.** Changing a few input cells must re-flow the whole plan. Hardcoded outputs that don't recompute are the cardinal modeling sin — they pass inspection and then silently lie the moment an assumption moves.

```text
assumptions   growth %, ARPA, churn %, CAC, GM target, hires, close date
     ↓ (formulas only)
drivers       new MRR, churned MRR, active customers, headcount cost
     ↓ (formulas only)
outputs       revenue, COGS, OpEx, net burn, ending cash, runway
```

```text
Bad   revenue_m6 = 95000                      # typed in; won't move when growth changes
Good  revenue_m6 = active_customers_m6 * arpa # formula; re-flows from the assumptions layer
```

One fact, one cell. If ARPA appears in two places, the second is a bug waiting to diverge.

## Rule 2 — revenue: bottom-up for the plan, top-down for the prize

Build the operating plan **bottom-up** and sanity-check it **top-down**. Investors want both: bottom-up proves you understand your growth levers, top-down shows the size of the prize. A bottom-up plan with a top-down cross-check is the believable pair; either alone is a tell.

| Approach | Use it for | Strength | Failure mode if used alone |
| --- | --- | --- | --- |
| **Bottom-up** (funnel × deal size × capacity) | the monthly operating plan | grounded in levers you control | can miss that the market is too small |
| **Top-down** (TAM × penetration) | the raise / market-size slide | shows the ceiling | hides whether you can actually acquire — "0.5% of a $10B market" is wishful |

Bottom-up funnel math: `leads → MQL → SQL → opportunity → win`, then `wins × deal size`, capped by `reps × quota` capacity. For subscription revenue, model MRR as a **waterfall** — new + expansion − contraction − churn — not a single growth %. Full funnel and waterfall templates with a worked monthly build are in `references/revenue-build.md`.

## Rule 3 — costs are headcount-driven, not a flat lump

Headcount is the largest cash driver for most early startups, so cost must be modeled per-hire, not as one salary blob. Each hire is `role × fully-loaded cost × start month` — fully-loaded (salary × ~1.25–1.4 for tax/benefits/tooling), and the **start month** matters because moving a hire one quarter moves runway by real weeks.

```text
Bad   opex_salaries = 150000/mo flat from day 1     # ignores who starts when
Good  per-hire schedule:
      Eng1   $11k/mo loaded, starts m1
      Eng2   $11k/mo loaded, starts m4
      AE1    $9k/mo  loaded, starts m6   (+ commission as a driver)
      → salary line is the sum of active hires each month, and it steps, not flat
```

Then layer COGS sized to hit your gross-margin target (subscription GM should land 75–80%+; total incl. services ~71–77%), and OpEx by function (S&M, R&D, G&A). If your modeled GM sits far below target, the cost build is wrong or the pricing is — flag it, don't paper over it.

## Rule 4 — cash, burn, runway (from cash, never from net income)

Runway is computed from **cash movements, not net income.** Depreciation, prepaids, and unpaid invoices make profit diverge from cash, so the cash projection — not the P&L — is the line that decides survival.

```text
gross_burn   = total cash outflow (all cash costs)
net_burn     = gross_burn − revenue
runway_mo    = current_cash / net_burn          # net_burn > 0
cash_out     = today + runway_mo months
ending_cash[m]   = starting_cash[m] − net_burn[m]
starting_cash[m+1] = ending_cash[m]              # continuity — verify.sh asserts this
```

Worked example: $400K cash, $25K MRR (~$300K revenue/yr early-ramping), gross burn $95K/mo, revenue $25K/mo → **net burn $70K/mo → runway ≈ 5.7 months.** That is below the panic line; this company should already be raising or cutting.

**Size the raise to the runway target, not to "what we can get."** Investors now expect **18–24 months of post-raise runway**, and best practice is **24–30**. ~12 months of runway has ~3.5× better survival odds than <6. You start raising or cutting at **8–10 months left, never at <6** — raising from a position of <6 months is negotiating with a gun to your head. So: pick the runway target → multiply by projected post-raise net burn → that is the raise, plus a use-of-funds breakdown.

## Rule 5 — scenarios are mandatory; gate assumptions against benchmarks

A single-line hockey stick with no downside reads as naive — investors stress-test the **downside first.** Build **base / downside / upside** off a small set of toggled drivers (growth rate, CAC, churn, hire timing, round close date), and report runway under each. Most cash surprises come from one of these toggles, especially the **round closing late**: model the gap and show runway if the close slips a quarter.

Then run the whole model through a reasonableness gate. Drivers far outside 2025/26 benchmarks are a red flag to **surface, not hide**:

| Check | Reasonable band | What it catches |
| --- | --- | --- |
| **Burn multiple** (net burn ÷ net new ARR) | <1.0 elite · 1.0–1.5 healthy · 1.5–2.0 ok early | capital efficiency — in SaaS Capital's 2025 survey 56% of seed / 83% of Series C+ investors call it critical |
| **Rule of 40** (growth % + FCF margin %) | ≥ 40 | the one-number sanity test; 200% growth AND positive margin is fantasy |
| **LTV:CAC** | ≥ 3:1 (top quartile 4–6:1) | acquisition economics imported from unit-economics |
| **CAC payback** | under ~12mo SMB (2025 median worsened to ~20mo) | how long cash is underwater per customer |
| **NRR** | ≥100% floor · 104–106% typical · 120%+ best | whether the install base grows itself |
| **Subscription gross margin** | 75–80%+ | is the cost build plausible |

Most companies miss Rule of 40 — McKinsey's run of 200+ software firms (2011–2021) cleared it only ~16% of the time, and Meritech's public-SaaS median sat near 12% in early 2025 — so don't claim it casually. The full benchmark sanity-table, the driver-toggle recipe, and a worked runway-under-scenarios example are in `references/benchmarks-and-scenarios.md`.

## Anti-patterns

| Anti-pattern | Do instead | Why |
| --- | --- | --- |
| Hockey-stick revenue, one line, no downside | base / downside / upside off toggled drivers | investors stress-test the downside first; no downside reads as naive |
| Runway computed from net income / P&L | runway from cash balance ÷ net cash burn | depreciation, prepaids, AR make profit ≠ cash; cash is the survival line |
| Outputs typed in as numbers | every output a formula off the assumptions layer | a model that doesn't re-flow is a static picture, not a model |
| Costs as one flat salary lump | per-hire schedule × fully-loaded cost × start month | headcount is the biggest early cash lever; timing moves runway by weeks |
| Revenue = TAM × wishful % only | bottom-up funnel plan, TAM as the sanity-check | top-down alone hides whether you can actually acquire |
| Raise sized to "what we can get" | sized to 18–24mo post-raise + a use-of-funds split | the runway target drives the ask, not vice-versa |
| Round closes instantly in the model | model the close date; show runway if it slips a quarter | timing risk is the most common cash surprise |
| Same ARPA / churn typed in three tabs | one fact, one cell, referenced everywhere | duplicates diverge silently and the model lies |

## Verify

The model emits a checkable artifact, so `scripts/verify.sh` runs against your generated `model.csv` (or assumptions + projection pair) and asserts **shape and internal consistency** — never whether the forecast is wise:

```bash
./scripts/verify.sh --path model.csv     # check one model file
./scripts/verify.sh --path build/        # scan a directory of model CSVs
./scripts/verify.sh --strict             # treat warnings as failures (CI gate)
```

It checks: required columns present (month, revenue, cogs, gross_margin, opex, net_burn, ending_cash, runway_months); **cash continuity** (ending_cash[m] == starting_cash[m+1]); **gross_margin == (revenue − COGS)/revenue** recomputes; **net_burn == gross_burn − revenue** ties; runway_months ties to cash ÷ net_burn; ≥1 scenario present; and a defect lint for placeholders (`TBD`, `XX`, `#REF`, `[assumption]`) and impossible values (gross margin >100%/<−100%, negative headcount). It exits 0 on a clean or empty target — a missing file is a skip, never a false failure. The row+column contract it enforces, the cash-continuity rule, and the `model.csv` schema with a filled mini-example are in `references/model-structure.md`.
