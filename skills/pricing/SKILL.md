---
name: pricing
description: "Use when setting or resetting what a product or service charges and how it is packaged — list price, margin floor, tiers, the value metric, the pricing model (flat, seat, usage, outcome or hybrid), discount rules and purchasing-power localisation. NOT issuing the actual bill (that is `invoicing`), NOT implementing prices in a billing system (that is `stripe`)."
tags: [pricing, packaging, margin, tiers, discounting, value-metric, willingness-to-pay, ppp]
recommends: [invoicing, stripe, unit-economics, proposals, forecasting, sales-pipeline]
origin: risco
---

# Pricing

You decide two things here: the **number** (the list price) and the **shape** (packaging, tiers, model, and the floor underneath each price). You produce a *price card* — a table where every tier has a price, a cost, a value metric, and a margin that someone else can recompute and disagree with. That artifact is the deliverable; opinions without a recomputable margin are not.

You do **not** charge the money (that is `../invoicing/SKILL.md`), build the billing objects (that is `../stripe/SKILL.md`), record revenue in the books, or validate the number against acquisition cost (that is `../unit-economics/SKILL.md`). Stay on the decision: what should this cost, and how is it boxed.

## The spine — run it in this order

The order matters because each step constrains the next. Skip a step and you set a price you cannot defend.

1. **Floor (cost).** Compute fully-loaded unit cost (COGS + must-cover). Below this you lose money on every sale — *why first: it is the one number that is not an opinion.*
2. **Ceiling (willingness-to-pay).** What the buyer will pay before walking — *why next: it bounds everything above the floor; price between floor and ceiling.*
3. **Value metric.** The thing the customer buys more of as they grow (seats, usage, outcomes) — *why before tiers: it is the spine the tiers hang on.*
4. **Model.** Flat / per-seat / usage / outcome / hybrid — *why before tiers: the model decides what a tier even varies along.*
5. **Tiers.** Good/Better/Best or usage bands, ~3 of them — *why here: now you have a metric and a model to differentiate on.*
6. **Discount floor.** Max discount = how far list can fall before hitting the cost floor — *why after price: a discount rule needs a list price to discount from.*
7. **Localize (optional).** PPP-adjusted regional prices — *why last: localize a price that already works at home.*

If you cannot answer step 1, stop and get the cost. Everything downstream is guesswork without it.

## Margin math you must not get wrong

Markup and margin use **different denominators**. Conflating them is the single most common pricing error.

```text
markup %  = (price - cost) / cost      <- denominator is COST
margin %  = (price - cost) / price     <- denominator is PRICE
```

Reference points to sanity-check any card (verify.sh uses these):

| Markup | Margin |
|--------|--------|
| 30%    | 23%    |
| 43%    | 30%    |
| 100%   | 50%    |

A 50% markup is only a 33% margin. A 50% margin needs a 100% markup. They diverge fast.

```text
Bad:  cost $70, want "30% margin", apply 30% markup -> price $91
      actual margin = (91-70)/91 = 23%. You undershot by 7 points.
Good: cost $70, want 30% margin -> price = cost / (1 - 0.30)
      = 70 / 0.70 = $100. Margin = (100-70)/100 = 30%. Correct.
```

The price-from-margin formula: `price = cost / (1 - target_margin)`. Memorize it; never apply a markup percentage when someone said "margin".

## Pick the model

Decide the model *before* drawing tiers — it determines what the tiers vary along.

| Model | Use when | Value metric | Watch out |
|-------|----------|--------------|-----------|
| Flat | One persona, predictable use, simple sell | none (one price) | Leaves money on the table at the high end |
| Per-seat | Value scales with users; collaboration tools | seats | Eroding — buyers cap seats and share logins; revenue stalls |
| Usage / consumption | Value scales with volume; infra, API, AI | units consumed | Estimate anxiety + overage shock; needs a meter |
| Outcome-based | You can attribute a result (resolutions, leads) | outcomes delivered | Attribution disputes; needs a credible counter |
| Hybrid | Platform value + variable use (most AI products) | base + usage/outcome | Two dials to explain; keep the base legible |

The market is moving off pure per-seat. ~85% of SaaS used some usage-based pricing by 2024 (up from ~30% in 2019), and Gartner expects ~40% of enterprise SaaS spend on usage/agent/outcome models by 2030. If you are defaulting to per-seat for an AI product, justify it.

**AI-COGS caveat — the margin assumption changes.** Classic SaaS runs 80-90% gross margin. AI products run **50-60%** because every query has real compute cost. A "we'll just take 80% margin" plan is wrong for AI: the cost floor (step 1) becomes load-bearing, and you reprice when compute cost moves. See `references/pricing-models.md` for the outcome credit + overage formula (platform fee ≈ 2× delivery cost, e.g. $12K/yr incl. 100 resolutions then $5K per additional 100) and seat-compression math.

## Package the tiers

Good/Better/Best is the dominant SaaS shape; the average SaaS company offers ~3.5 tiers. Three is the safe default — enough to anchor, not enough to paralyze.

- **Distinct on all three:** each tier must differ in features, limits, *and* price. If two tiers share limits, you have one tier with a typo.
- **Value metric is the axis.** Tiers move along the value metric you picked in step 3 (more seats, more usage, more outcomes), not a random feature grab-bag.
- **Anchor with the top tier.** The Best tier makes Better look reasonable; it is doing a job even if few buy it.
- **Name the limit, not just the feature.** "10 projects" beats "projects" — a limit is what a buyer hits and upgrades on.

```text
Good     Better        Best
$0/$X    $Y            $Z (anchor)
3 seats  25 seats      unlimited seats
1K calls 50K calls     500K calls + overage
email    + Slack       + SSO, SLA, CSM
```

## Set the discount floor

A discount needs a floor, not a vibe. Reps will give away the business if the only rule is "use judgment".

- **Floor = COGS + must-cover cost** for that tier. Below it the deal loses money.
- **Max discount % = (list − floor) / list.** This is the largest discount a rep can give without burning margin.
- **No sign-off, no floor-break.** Discounting below the floor requires explicit approval, recorded. The floor is the deal-desk's hard stop.

```text
Tier "Better": list $1,000, cost floor $400
max discount = (1000 - 400) / 1000 = 60%
A rep offering 35% off ($650) is fine; 65% off ($350) breaks the floor -> sign-off.
```

## Localize (optional branch)

Only if you sell across markets. Localizing beats raw FX conversion — PPP-adjusted regional pricing lifts revenue ~30% over straight currency math.

- Start from **home list price × PPP factor** (World Bank / OECD), not the spot exchange rate.
- **Charm vs round by market:** $99-style charm prices convert in US/DE/AU; round numbers are preferred in JP/CN/BR.
- **Review quarterly to semiannually** — PPP and FX drift.
- **Guard against VPN geo-arbitrage** with local payment-method / billing-address checks.

The per-region rounding conventions, PPP sourcing, and arbitrage guards live in `references/localization.md` — most operators skip this branch, so it is offloaded.

## Willingness-to-pay, fast

You usually do not need a survey. Two paths:

- **Cheap default:** raise the price until you feel friction (longer sales cycles, more "too expensive"). If nobody pushes back, you are underpriced.
- **When the number is high-stakes:** run a **Van Westendorp** four-question survey — *at what price is this (1) too expensive to consider, (2) getting expensive but worth a look, (3) good value, (4) so cheap you doubt the quality.* The curve intersections give an acceptable price band and an optimal point. Use it before committing a number you cannot easily change.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|--------------|-----------------|------------|
| Applying markup % when someone said "margin" | 30% markup is only a 23% margin — you undershoot every time | `price = cost / (1 - margin)`; recompute, never assume |
| Cost-plus only, ignoring willingness-to-pay | Leaves money on the table or prices below what buyers gladly pay | Floor from cost, ceiling from WTP, set price between |
| Five+ tiers to "cover everyone" | Choice paralysis; nobody self-selects | ~3 tiers, distinct on features + limits + price |
| Per-seat by default for an AI product | Seat revenue erodes and AI COGS breaks the 80% assumption | Pick the value metric first; consider usage/outcome/hybrid |
| Discount "by judgment" with no floor | Reps give away the business deal by deal | Floor = COGS+must-cover; max discount = (list−floor)/list; below = sign-off |
| Converting price by spot FX across markets | Mispriced vs local purchasing power; ~30% revenue left behind | PPP factor × home price; round per local convention |
| Assuming 80-90% margin for AI compute | Real per-query COGS makes it 50-60%; you over-promise margin | Use the cost floor as load-bearing; reprice when compute moves |

## The price card (the artifact)

Emit a `price-card.csv` (or `.md` table / `.yaml`) — one row per tier:

```csv
tier,price,cost,value_metric,margin
Good,29,11,seats,0.62
Better,99,38,seats,0.62
Best,299,110,seats,0.63
```

Rules the card must satisfy:
- Every row has `price`, `cost`, `value_metric`, and a stated `margin`.
- Stated margin matches recomputed `(price − cost) / price` within 0.5pt.
- No `price <= cost` and no `price < floor`.
- `margin` is a margin, not a markup (the classic conflation).

`scripts/verify.sh <price-card>` recomputes every margin, flags any tier below its floor, and warns when a stated "margin" is actually a markup. Run it before you ship the card. It is read-only and exits 0 on an empty or clean card.

## Siblings

- Charge it / format the bill -> `../invoicing/SKILL.md`
- Build products & prices in the billing system -> `../stripe/SKILL.md`
- Validate the number against CAC / payback -> `../unit-economics/SKILL.md`
- Put the price in front of one named buyer -> `../proposals/SKILL.md`
- Project revenue from the price -> `../forecasting/SKILL.md`
- Run the deal and pipeline stages -> `../sales-pipeline/SKILL.md`
