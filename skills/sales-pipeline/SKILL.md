---
name: sales-pipeline
description: "Use when an operator runs deals out of a spreadsheet or Notion and wants real stages, win probabilities, deal hygiene, a weekly follow-up sweep, and a defensible roll-up forecast — including the case where the pipeline looks full but nothing closes. NOT statistical or scenario forecast modelling (that is `forecasting`), NOT sourcing prospects (that is `lead-gen`), NOT writing the outbound emails (that is `cold-outreach`), NOT the proposal or quote (that is `proposals`), NOT the post-close kickoff (that is `client-onboarding`)."
tags: [sales, crm, pipeline, forecasting, deal-hygiene, business-ops]
recommends: [forecasting, lead-gen, cold-outreach, proposals, client-onboarding, spreadsheet-ops]
origin: risco
---

# Sales Pipeline — A Disciplined CRM Out of a Flat File

*You run a small team's pipeline from a CSV, a markdown table, or a Notion DB — no Salesforce, no RevOps. Your one rule: the forecast is what the gated stages and current win rates say, not what the rep hopes. Happy-ears deals do not inflate the number on your watch.*

This skill does four jobs and refuses to drift into the siblings that own the rest: (1) define a **small set of gated stages** with objective exit criteria, (2) keep every open deal **hygienic** (next step + close date + last-touch, flag the stale), (3) run a **weekly follow-up sweep**, and (4) roll a **defensible weighted forecast** with a coverage ratio. The heavy statistical modeling, the lead sourcing, the outbound copy, the proposal, the post-close handoff — each belongs to a sibling. Route, do not improvise their job.

## When to use / when NOT

Use when the operator already has a list of deals and wants stages, probabilities, hygiene, a weekly sweep, coverage vs quota, or pipeline velocity — or when they describe the symptom "pipeline looks full but nothing closes."

Do NOT use when the ask is one of these — route to the owner:

| The ask | Owner | Why it is not here |
|---|---|---|
| 3-scenario revenue model, seasonality, cohort/time-series projection | `forecasting` | That is the statistical/scenario layer. This skill only does the simple stage-weighted roll-up that falls out of the pipeline. |
| Find / scrape / qualify NEW prospect companies to add | `lead-gen` | This skill operates on deals that already exist in the list. |
| Write the cold email or follow-up sequence to contact a prospect | `cold-outreach` | This skill schedules the next step; it does not write the words. |
| Write the proposal / quote / SOW for a qualified deal | `proposals` | A stage transition is not a document. |
| Post-close kickoff, account setup, onboarding | `client-onboarding` | The moment a deal is Closed-Won it leaves this skill. |
| Generic dashboard / charting of arbitrary metrics, KPI tree design | `dashboard` / `kpi-framework` | This skill emits pipeline numbers, not a charting layer. |

The boundary worth memorizing: **`forecasting` owns the math models; sales-pipeline owns the operational CRM.** When the request needs Monte Carlo, regression, or scenario trees, hand it over.

## The artifact first — the deal-record schema

Everything below lints against one table. Define it before anything else, because hygiene, the sweep, and the forecast are all just operations on these columns. One deal = one row. Required columns:

| column | meaning | rule |
|---|---|---|
| `id` | stable deal id | unique, never reused |
| `company` | the account | — |
| `value` | deal value (one currency, document which) | number, no symbols |
| `stage` | current stage | from the allowed set (next section) |
| `win_prob` | stage win-probability as a decimal | 0–1, **owned by the stage, not the rep** |
| `weighted_value` | `value × win_prob` | must equal the product (lint enforces it) |
| `close_date` | expected close (ISO `YYYY-MM-DD`) | required on every open deal |
| `next_step` | the next concrete action + its date | required on every open deal |
| `last_touch` | date of last real activity (ISO) | required on every open deal |
| `owner` | who owns the deal | — |
| `forecast_category` | Pipeline / Best Case / Commit / Closed / Omitted | a category, **not** a stage |

One good open row (CSV):

```csv
id,company,value,stage,win_prob,weighted_value,close_date,next_step,last_touch,owner,forecast_category
D-104,Acme,40000,Discovery,0.30,12000,2026-07-15,"2026-06-09 demo with VP Eng",2026-05-30,Dana,Best Case
```

Hard rule, no exceptions: **no open deal may be missing `next_step`, `close_date`, or `last_touch`.** A deal with no next step is not a deal, it is a wish. The sweep and the forecast both treat a missing field as a defect, not a blank.

## The stage model — small, gated, stage-owned probability

Default to **six stages**. Five stages with clear exit criteria beat nine stages with none. Each stage advances only on an objective, verifiable **buyer action** — never on rep optimism.

| stage | default `win_prob` | exit criterion (the verifiable buyer action that advances it) |
|---|---|---|
| Prospecting | 0.05 | Buyer agreed to a first real conversation (meeting on the calendar). |
| Qualification | 0.10 | BANT/MEDDIC documented "yes" — budget, authority, need, timeline confirmed. |
| Discovery | 0.30 | Buyer confirmed the problem + success criteria; you have the buying process and review layers. |
| Proposal/Demo | 0.40 | Proposal or demo delivered and acknowledged; buyer engaged on it. |
| Negotiation | 0.65 | Terms/price under active discussion; verbal intent + a mutual close plan. |
| Closed | 1.0 / 0.0 | Signed (Won) or formally lost (Lost). |

Rules that make the table hold:

- **Probability belongs to the stage, not the deal.** A rep who hand-sets one deal to 90% in Discovery is sandbagging or happy-ears; both poison the forecast. The stage carries the number, uniformly. *(Why: it removes the single biggest source of forecast inflation in small teams.)*
- **No stage advances without its exit criterion met AND a calendared next step.** "If you don't know the criteria, timeline, review layers and legal steps, the close date is a guess."
- **Negotiation 50–80% is a band, not a default 80.** Pick within the band on real signal (legal in motion → higher); never max it out reflexively.

Qualification gate: run **BANT as a ~60-second screen** for small deals; switch to **MEDDIC/SPICED above ~$25K ACV**. The full six-stage playbook — every exit criterion, required fields per stage, the BANT-vs-MEDDIC pillars, and the forecast-category mapping — lives in `references/stage-playbook.md`.

## Deal hygiene — the required-field gate and the stale rules

Roughly **40–60% of B2B CRM pipeline is stale** (no progression in 30+ days). A forecast built on a stale list is fiction. Apply an activity-decay model on every open deal:

| condition | action |
|---|---|
| Missing `next_step` / `close_date` / `last_touch` | **Defect** — flag, do not forecast until fixed. |
| No touch for **14+ days** | **Halve** the deal's effective weight in the forecast. |
| No touch for **30+ days** | **Exclude** from coverage entirely (treat as stale, not pipeline). |
| Sitting **> 1.5× the average time-in-stage** | Flag for review — it is stuck. |
| `close_date` already in the past, deal still open | Flag — the date is a lie; re-set or disqualify. |

Bad → Good on a single row:

```text
BAD  (open, but a wish dressed as a deal — fails the gate):
  D-220,Globex,60000,Proposal,0.80,48000,,,,Sam,Commit
  ^ win_prob hand-set to 0.80 in Proposal, no close_date, no next_step,
    no last_touch, Commit category on zero evidence.

GOOD (gated, hygienic, stage-owned probability):
  D-220,Globex,60000,Proposal,0.40,24000,2026-08-01,"2026-06-12 send revised SOW",2026-06-02,Sam,Best Case
  ^ win_prob = stage default, weighted_value recomputed, dated next step,
    fresh last_touch, category demoted to match the evidence.
```

## The weekly follow-up sweep

Build hygiene into a **~45-minute WEEKLY pipeline review**, not a quarterly cleanup — stale deals compound fast and a quarterly purge always finds the rot too late. The sweep is a fixed checklist; run it and emit a prioritized follow-up list:

- [ ] Every open deal has `next_step` + `close_date` + `last_touch` — list the defects first.
- [ ] Stale: no touch 14+ days (halve) and 30+ days (drop) — surface both buckets.
- [ ] `close_date` in the past on an open deal — re-set or disqualify.
- [ ] Slipped: `close_date` pushed two weeks in a row — flag; two slips is a pattern, not noise.
- [ ] Stuck: time-in-stage > 1.5× the average for that stage.
- [ ] Output: a ranked follow-up list (highest `weighted_value` × most stale first), each with the one concrete next action and its date.

Track coverage as a **4-week rolling trend**, not a single snapshot. **Two consecutive weeks of declining coverage with no closes is a red flag** — escalate, do not wait for quarter-end.

## The forecast roll-up

Three numbers fall out of a clean pipeline. Compute them; do not model beyond them (that is `forecasting`).

**Weighted forecast** = Σ over open deals of `value × stage win_prob`. Apply the stale decay first (halve at 14d, drop at 30d) so the number reflects live pipeline, not the wish list.

**Pipeline coverage ratio** = Total Qualified Pipeline Value ÷ Revenue Target. Read it against the segment, because win rates differ:

| segment | ACV / win rate | coverage min | coverage target |
|---|---|---|---|
| Enterprise | $100K+ / 15–20% win | 5× | 6–7× |
| Commercial | $25–100K / 20–30% | 3.5× | 4–5× |
| SMB | <$25K / 30–40% | 2.5× | 3–4× |

**Pipeline velocity** = `(Open opps × Avg deal size × Win rate) ÷ Sales-cycle length (days)` → dollars/day. Cycle length has the most leverage: a ~20% cut in cycle length lifts velocity ~25%.

Forecast categories are **not** stages — map them separately: Pipeline / Best Case / Commit / Closed / Omitted. As a sanity expectation, roughly **~25% of "Pipeline", a third-to-half of "Best Case", and near-all of "Commit"** typically lands in-quarter.

**The current-win-rate caveat — non-negotiable.** 2025 benchmarks moved against sellers: B2B win rates fell ~21% → ~18% and cycles lengthened ~12% YoY. **Forecast with the current ~18% win rate and your real cycle length, never last year's optimistic numbers.** A 24-month-old win rate is the quietest way to over-forecast.

Worked examples — weighted forecast on a 5-deal list, coverage by segment, velocity, and the exact column contract `verify.sh` enforces — are in `references/forecasting-math.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Rep hand-sets `win_prob` per deal | Happy-ears/sandbagging inflate the forecast; the number stops being comparable | Probability is owned by the stage, applied uniformly |
| Stages with no exit criteria | "Discovery" becomes a place deals go to die; no one can verify progression | Every stage gates on an objective buyer action |
| Counting stale deals (30+ days no touch) in coverage | 40–60% of pipeline is stale; coverage looks healthy while nothing moves | Drop 30d+ from coverage, halve 14d+, flag stuck deals |
| Forecasting off list price, not weighted value | Treats a Qualification deal like a signed one; massive over-forecast | `value × stage win_prob`, decayed for staleness |
| Quarterly cleanup instead of weekly | Rot is found three months too late; the quarter is already lost | 45-min weekly sweep; 4-week rolling coverage trend |
| Using a 24-month-old win rate | 2025 win rates fell to ~18%, cycles +12%; old numbers over-forecast | Use the current win rate and your real cycle length |
| `forecast_category` set to "Commit" on a Discovery deal | Category drifts from evidence; the commit number becomes a fantasy | Category must match documented evidence, not hope |
| Nine micro-stages "for granularity" | More stages, less discipline; reps can't tell them apart | Six gated stages beat nine ungated ones |
| Open deal with no `next_step` | It is a wish, not a deal; it silently ages into staleness | No next step → it is a defect, surface it in the sweep |

## References and siblings

- `references/stage-playbook.md` — the six stages in full, exit criteria, required fields per stage, BANT-vs-MEDDIC, forecast-category mapping.
- `references/forecasting-math.md` — worked weighted-forecast / coverage / velocity examples and the verify column contract.

Siblings that own the adjacent jobs — route to them by name: `../forecasting/SKILL.md` (the math models), `../lead-gen/SKILL.md` (sourcing), `../cold-outreach/SKILL.md` (the outbound copy), `../proposals/SKILL.md` (the quote/SOW), `../client-onboarding/SKILL.md` (post-close). For wiring the list to Sheets/Notion or bulk edits, `../spreadsheet-ops/SKILL.md`.

To lint a pipeline file you produced — required columns, required fields on open deals, stage names in the allowed set, `win_prob` in range, `weighted_value == value × win_prob`, and a coverage line present — run `scripts/verify.sh path/to/pipeline.csv` (read-only; a clean or empty file exits 0).
