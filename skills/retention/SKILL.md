---
name: retention
description: "Use when revenue is leaking out the bottom of the funnel and you need a program to keep, score and win back customers — a customer health score, NPS, catching churn signals before renewal, a cancellation save flow, or a win-back sequence, and reading GRR against NRR. NOT working a single live churn-risk ticket in the moment (that is `customer-support`), NOT the first-30-days welcome flow (that is `client-onboarding`)."
tags: [retention, churn, nps, health-score, save-play, win-back, nrr, grr, customer-success]
recommends: [customer-support, client-onboarding, unit-economics, pricing, forecasting, compliance, newsletter, review-management]
origin: risco
---

# Retention

You run retention as a *program*, not as a reaction. The customer is already won;
your job is to stop the slow leak out the bottom of the funnel — measure who is
healthy, catch the at-risk ones 30+ days before they cancel, run the right save
play, and win back the ones who already left.

This is the program layer. It is **not**:
- the single furious customer threatening to cancel right now — that live ticket
  is `../customer-support/SKILL.md`.
- the first-30-days welcome/activation flow for a brand-new account — that is
  `../client-onboarding/SKILL.md`. Onboarding prevents *early* churn; you start
  once the customer is established and the renewal is at stake.

## What you produce

Three decision artifacts — judgment, not prose:

1. **A health-score model** — weighted dimensions → a 0–100 number → green / yellow / red.
2. **A save-play decision table** — exit reason → the play that retains the most life.
3. **A win-back cadence** — a 30/60/90-day ladder with an escalating offer.

You do **not** write the production NPS or win-back email copy — that is
`../newsletter/SKILL.md`. You define the cadence and the offer ladder; the polished
words are a writing skill.

## The retention loop (the spine)

Work these five steps in order. Each one feeds the next.

1. **Measure** — build the health score and run NPS, so "at risk" is a number, not a hunch.
2. **Flag** — set leading-indicator thresholds that fire 30+ days before the churn event, so you have time to act.
3. **Intervene** — pick a save play *before* renewal, matched to the account's stated or signalled reason.
4. **Recover** — run a win-back sequence on the ones who left anyway.
5. **Read the meters** — NRR / GRR / logo churn / save rate tell you whether the loop is working and what to fix next.

## Build the health score

A single signal lies. A composite of **4+ weighted dimensions predicts churn ~34%
more accurately** than any one-dimension gauge (Totango 2025). Weight **activity
heaviest, because when customers stop showing up, everything else follows.**

Default weighting to start from, then tune to your product:

| Dimension | Weight | Example signals |
|---|---|---|
| Product usage / activity | ~40% | login recency, sessions/week, depth of feature adoption |
| Engagement | ~25–30% | response to emails, QBR attendance, champion still employed |
| Milestones / business fit | ~20% | onboarding goals hit, ROI realized, plan vs need match |
| Recency | ~10% | days since last meaningful action |

Normalize each dimension to 0–100, multiply by its weight, sum to one 0–100 score.
Starting cutoffs: **green ≥70, yellow 40–69, red <40** — then move the lines until
red reliably precedes real cancellations.

```text
Bad:  "Logins dropped, flag the account."   (one signal, fires late or false)
Good: usage 30/100×0.40 + engagement 60×0.28 + fit 80×0.20 + recency 20×0.10
      = 12 + 16.8 + 16 + 2 = 46.8 → yellow, worth a touch this week
```

The full dimension catalog, the normalization recipe, cutoff tuning, and a fully
worked scored account live in `references/health-score-and-metrics.md`.

## NPS done right

NPS = **%Promoters − %Detractors** on an 11-point 0–10 scale. Promoters 9–10,
Passives 7–8 (dropped from the math), Detractors 0–6. >0 is positive, 30+ strong,
50+ excellent, 70+ world-class — but **the raw number is meaningless without an
industry comparison.** Run it two ways:

- **Relational** — quarterly or annual, a pulse on the whole base.
- **Transactional** — fires right after a specific interaction (support close,
  onboarding done).

```text
Bad:  Collect NPS, put 42 on a dashboard, move on.
Good: Every detractor (0–6) triggers a follow-up call within 48h; the score is
      the start of a save motion, not the deliverable.
```

## Leading indicators & the flag

The threshold must buy **30+ days of lead time** — flag early enough to actually
intervene. Strongest signals, in roughly the order they predict:

- **days since last login** (the clearest "they left mentally already")
- **feature-adoption depth shrinking** (using less of what they pay for)
- **support-ticket velocity *rising*** — more tickets predict churn, not fewer
- **billing-cadence downgrade: annual → monthly is an early churn tell**, not a neutral preference
- seat contraction, repeated payment failures

The last two are the non-obvious ones. A customer quietly moving from annual to
monthly is telling you they no longer want to commit — treat it as a yellow flag
even while revenue looks flat.

## Save plays — the decision table

This is where the flow genuinely branches. The in-flow exit survey is **one
question, 5–7 preset reasons, one tap, answerable in <5 seconds — and the offer
must branch on the reason.** A flat single offer to everyone wastes the lever;
**personalized offers prevent ~23% of cancellations, generic ones do not.**

Rank plays by **retained life, not by gut.** Industry-average save rate ≈34%
(Churnkey 2025).

| Exit reason | Recommended play | Offer shape | Why (retained life) |
|---|---|---|---|
| "Too expensive" | **Downgrade**, then temporary discount | move to lower tier; or 20–30% off for 2–3 mo | downgraders stay **7–8 mo longer**; keeps the relationship at lower revenue beats $0 |
| "Not using it right now" | **Pause** + re-onboard | freeze 1–3 mo, schedule a setup touch | pausers stay **~5.5 mo longer**; ~25% of would-be churners pause instead of cancel |
| "Missing a feature" | **Human / roadmap** | show roadmap, connect to PM, no discount | tests real demand; a discount does not fix a capability gap |
| "Switching vendor" | **Save call** | book a human conversation fast | only a person can counter a competitor decision |
| Price-only, no fit | **Graceful let-go** | clean cancel + win-back enrollment | bad-fit retention just delays churn and inflates support cost |

Order of preference when the reason is fuzzy: **downgrade > pause > temporary
discount > human save call > let-go.** Discount is weakest — it permanently cuts
revenue and only tests price sensitivity. Use **temporary 20–30% off for 2–3
months, never a permanent cut.**

Full play library, the survey template, and offer skeletons are in
`references/save-and-winback-plays.md`.

## Win-back cadence

For customers who left anyway. A 30/60/90 ladder recovers **~5–15% of lost
customers.** Lead with value, *then* escalate the offer — so you do not train
people to churn for a deal.

```text
Day 30 — value reminder, NO discount ("here's what's new / what you're missing")
Day 60 — modest incentive: ~15–20% off for 3 months
Day 90 — best offer: ~30–40% off for 6 months
```

Guardrail: if Day 30 leads with the discount, your healthy customers learn that
cancelling is how you get a better price. Always value-first.

## Read the meters

| Metric | What it is | What it tells you |
|---|---|---|
| **NRR** | net revenue retention, includes expansion | can exceed 100%; 2025 B2B median ~106% |
| **GRR** | gross revenue retention, contraction + churn only | cannot exceed 100%; median ~90% |
| **Logo churn** | % of *customers* lost, each weighted equally | base erosion |
| **Revenue churn** | % of *dollars* lost | concentration risk |
| **Save rate** | % of cancel attempts saved | benchmark ≈34% |

The alarm: **if GRR < 80%, a few expanding accounts are masking a fundamental
retention failure — NRR is lying to you.** Likewise high NRR + high logo churn =
big accounts hiding broad base erosion; fix the base, do not celebrate expansion.

Mini decision:
- High logo churn + high NRR → fix the base (health score + save plays), not expansion.
- GRR < 80% → stop everything else; the product or fit is leaking.
- 43% of SMB losses happen in the first 90 days → that is a `client-onboarding`
  problem, not yours.

Retaining is cheaper than acquiring: cutting churn 5%→3% can lift LTV:CAC from
~2.5:1 to ~4:1 with **zero** extra acquisition spend. For the LTV/CAC/payback
model itself, hand off to `../unit-economics/SKILL.md`; for forecasting MRR from
the churn rate, `../forecasting/SKILL.md`.

## Compliance guardrail

Build the save flow so a frustrated user can **always reach cancel in one click.**

The law here is unsettled — **do not hard-code "the law."** The FTC
"Click-to-Cancel" rule was **vacated by the Eighth Circuit on 2025-07-08** on
procedural grounds; the FTC submitted a new draft ANPRM on 2026-01-30. With the
federal rule gone, **California's amended Automatic Renewal Law (effective
2025-07-01) is the de-facto national floor** and is in places stricter:
cancellation at least as easy as sign-up, click-to-cancel offered simultaneously,
a cap on retention offers shown during the flow. Treat CA ARL as the floor and
defer the actual legal text to `../compliance/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Discount-first save play | permanently cuts revenue, only tests price | rank downgrade > pause > temporary discount |
| One flat offer for every exit reason | wastes the lever; generic prevents ~0 vs ~23% personalized | branch the offer on the stated reason |
| Single-signal health score ("logins down") | misses ~34% accuracy; fires late or false | 4+ weighted dimensions, activity heaviest |
| Collect NPS, then ignore it | a number on a dashboard saves no one | every detractor triggers a 48h follow-up |
| Optimize NRR while logo churn bleeds | expansion masks base erosion | watch GRR; GRR<80% is the alarm |
| Dark-pattern cancel flow (cancel buried) | illegal under CA ARL, breeds public detractors | cancel reachable in one click, always |
| Win-back that leads with the discount | trains healthy customers to churn for a deal | Day 30 value-only, escalate later |
| Treating first-90-day churn as a retention problem | it is an activation problem | route to `../client-onboarding/SKILL.md` |

## Cross-references

- `../customer-support/SKILL.md` — the single live churn-risk ticket in the moment.
- `../client-onboarding/SKILL.md` — the first-30-days welcome / activation flow.
- `../unit-economics/SKILL.md` — the LTV / CAC / payback model.
- `../pricing/SKILL.md` — how deep a discount can go without breaking margin.
- `../forecasting/SKILL.md` — projecting MRR/ARR from the churn rate.
- `../compliance/SKILL.md` — the actual cancellation-law text.
- `../newsletter/SKILL.md` — production NPS / win-back email copy.
- `../review-management/SKILL.md` — responding when a detractor posts publicly.
