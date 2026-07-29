---
name: ads
description: "Use when running or fixing paid acquisition on Google or Meta — campaign structure (Performance Max, Demand Gen, Search, Advantage+), platform-fit creative, budget/scaling rules, break-even ROAS math, and Consent Mode v2 / CAPI tracking gaps. NOT the page the ad clicks into (that is `landing-copy`), NOT the channel-mix plan (that is `marketing`)."
tags: [paid-ads, google-ads, meta-ads, roas, performance-max, ppc, paid-acquisition]
recommends: [marketing, landing-copy, brand-voice, ab-testing, analytics, dashboard, forecasting, lead-gen]
origin: risco
---

# ads

You are the paid-acquisition operator. You run money through Google and Meta to buy
customers, and you answer four questions in this order: **structure → creative →
budget → ROAS**. Your subject is the live account and its economics — the campaign
shape, the asset sets, the bid/budget config, and the math that says *keep scaling*
or *kill it*.

The nearest miss is `marketing`: it decides *whether to run paid at all and the
channel mix* (`../marketing/SKILL.md`); you execute *the Google/Meta buy inside that
plan* down to asset groups, bids, and break-even ROAS.

## ROAS first — it gates everything

Do the money math before you touch a single campaign setting. Structure is
meaningless if the unit economics don't close.

- **Break-even ROAS = 1 ÷ gross-margin %.** 40% margin needs ≥**2.5x** to break even
  on contribution; 50% margin needs ≥**2.0x**. *Why:* below this every conversion
  loses money no matter how good the targeting.
- **Target by stage.** Profit-mode brands aim **3.5x–5x on Meta**, **5x–8x on Google
  Search**. Scaling-mode brands accept **2x–3x** and judge on blended MER, not
  campaign ROAS. *Why:* you trade margin for growth deliberately, not by accident.
- **Platform-reported ROAS lies.** It over-reports **30–100%** by double-counting
  conversions across campaigns and surfaces; true incremental revenue is often only
  **30–60%** of the platform number. *Why:* last-click attribution credits the ad for
  sales that would have happened anyway.
- **The truth check is incrementality, not the dashboard.** Geo-holdout / ghost-ad
  tests are the 2026 gold standard; for the scaling decision switch to **blended MER**
  (total revenue ÷ total ad spend). *Why:* it's the only number tied to your bank
  account.

```text
Bad:  "We hit 4.2x ROAS — scale it!"        (platform, last-click)
Good: "Platform 4.2x, geo-holdout incremental 2.1x, break-even 2.5x.
       Incremental is BELOW break-even — we're losing money. Cut."
```

Full worked math, the platform-vs-MER-vs-incrementality table, a geo-holdout test
design, and the scale/hold/kill rule live in `references/roas-model.md`.

## Pick the surface

Choose by goal, how much creative/audience control you need, and how much conversion
data the account already produces. Don't default to the most-automated option just
because it exists.

| Platform | Surface | Use when |
|---|---|---|
| Google | **Performance Max** | Full-funnel, you'll cede control for reach, and the account already has steady conversion volume to feed the algorithm. |
| Google | **Demand Gen** | You need creative + audience control PMax won't give: preview exact combinations, opt out of optimized targeting, report by placement/audience/asset. |
| Google | **Search** | Capturing existing high-intent demand; keyword/query control matters more than discovery reach. |
| Meta | **Advantage+ Shopping/Sales** | Acquiring new customers at volume, you can feed 15–20+ creatives, and the daily budget clears the learning floor. |
| Meta | **Manual (ABO/CBO)** | Tight audience control, small budgets, or testing a specific segment the algorithm would dilute. |

## Structure

- **Consolidate to feed the learning phase.** A campaign needs enough conversions to
  exit learning; many tiny campaigns each starve. *Why:* the algorithm can't optimize
  on noise.
- **Split budget by job:** broad/prospecting, a manual test slice, and retargeting —
  not eight clones of the same campaign. *Why:* each slice answers a different
  question.
- **Cap existing customers on Advantage+ at 20–30%.** Without the cap, Meta defaults
  to cheap retargeting conversions and you stop acquiring while the dashboard looks
  great. *Why:* easy reconversions inflate ROAS and hide that growth stalled.
- **Protect the learning phase: hold structure ≥4 weeks.** Budget changes >20%,
  bid-strategy switches, or adding asset groups all **restart** learning. *Why:* every
  reset throws away the data you paid to collect.

```text
Bad:  8 campaigns × $20/day, each restarted twice this week.
Good: 1 prospecting campaign above the conversion-data floor, untouched 4 weeks,
      then act on the data.
```

PMax allows max **25 asset groups** per campaign — start with **1–2**. Full structure
detail and the Google Ads API version note for scripting are in
`references/platform-specs.md`.

## Creative

Write the ad-surface copy only. It must obey the brand's voice (`../brand-voice/SKILL.md`)
and click into a page you do not write (`../landing-copy/SKILL.md`).

Per-surface caps (summary — full tables, image/video orientations and sizes, and the
Low/Good/Best rotation playbook in `references/platform-specs.md`):

| Surface | Headlines | Descriptions | Media |
|---|---|---|---|
| PMax (per asset group) | 15 × 30 char + 1 long × 90 char | 5 × 90 char | 20 images, 5 videos |
| Demand Gen | 5 × 40 char | 5 × 90 char | per format |
| Search (RSA) | 15 × 30 char | 4 × 90 char | — |
| Meta Advantage+ | feed 15–20+ creative variations | — | mixed orientations |

- **Feed 15–20+ variations on Advantage+.** With 3–5 creatives the algorithm can't
  test and you've built an expensive manual campaign. *Why:* automation needs raw
  material to compare.
- **Refresh on cadence to fight fatigue.** Google rates each asset **Low / Good /
  Best**; replace **Low** assets after **4–6 weeks**. *Why:* a dead creative drags the
  whole asset group's rating and delivery.
- **Never overflow a platform limit.** A 33-char "30-char" headline gets truncated or
  rejected and tanks the asset rating. *Why:* the limit is hard, not advisory — lint
  before you ship (see `scripts/verify.sh`).

## Budget & scaling

- **Meta Advantage+ floor ≈ 50× target CPA**, with a practical minimum around
  **$100/day**; below ~$50/day the algorithm can't exit learning. *Why:* it needs
  ~50 conversions/week to optimize.
- **Scale ≤ 20% per week.** Bigger jumps reset the learning phase and you start over
  at a worse CPA. *Why:* the algorithm re-explores after a large budget shock.

```text
target CPA $40  →  Advantage+ floor ≈ 50 × $40 = $2,000/day
                   (or ramp in ≤20%/week steps to get there)
```

## Measurement setup gate

Conversions you can't track don't count, and Smart Bidding degrades without them. Run
this gate before judging any campaign:

- [ ] **Consent Mode v2 (Advanced)** — mandatory for EEA/UK since 2024-03-06.
- [ ] **Enhanced Conversions** on Google — hashed first-party email/phone to recover
      modeled conversions.
- [ ] **Meta CAPI** — the server-side equivalent; most stores need both it and
      Enhanced Conversions.
- [ ] Account updated for the unified `ad_storage` parameter before **2026-06-15** —
      after that, un-updated accounts risk attribution gaps and bidding degradation.

Hand the reporting/dashboards to the `analytics` / `dashboard` skills — you set up
the signal; they build the read-out.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Scaling on platform ROAS | Over-reports 30–100% via double-counting | Validate with geo-holdout / blended MER first |
| Fragmenting budget across many tiny campaigns | None gets enough data to exit learning | Consolidate above the conversion-data floor |
| No existing-customer cap on Advantage+ | Meta drifts to cheap retargeting; acquisition stops | Cap existing customers at 20–30% |
| Launching with 3–5 creatives | Algorithm can't test; it's a manual campaign in disguise | Feed 15–20+ variations, refresh weekly |
| Tweaking budget/bids/assets every few days | Each >20% change resets the learning phase | Hold structure ≥4 weeks, then act on data |
| Target ROAS set below break-even | Every conversion loses money | Set target ≥ 1÷margin; profit-mode 3.5x–8x |
| Ignoring Consent Mode v2 / CAPI | Conversions go unattributed; Smart Bidding degrades | Advanced consent + Enhanced Conversions + CAPI |
| Copy that overflows the platform char limit | Truncated/rejected assets, Low rating | Lint headlines/descriptions to per-surface caps |

## Handoff

- **Real experiment design** (sample size, significance) → the `ab-testing` skill.
- **Blended/next-quarter revenue projection** → the `forecasting` skill.
- **Top-of-funnel B2B prospect lists** (not paid media) → the `lead-gen` skill.
