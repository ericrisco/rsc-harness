---
name: ab-testing
description: "Use when designing or analyzing a controlled experiment — falsifiable hypothesis, sample size from an MDE, reading significance/CI/power, CUPED, or rescuing tests that won't go significant. NOT recurring metric tracking (that is `analytics`), NOT north-star/KPI trees (that is `kpi-framework`), NOT projecting metrics forward (that is `forecasting`)."
tags: [ab-testing, experimentation, statistics, cuped, sample-size, hypothesis-testing]
recommends: [analytics, kpi-framework, forecasting, data-cleaning, python, reporting]
origin: risco
---

# A/B testing — design and read a defensible experiment

An experiment without a pre-committed sample size and a single primary metric is not an experiment.
It is a dashboard you stare at until it tells you what you wanted to hear. The discipline lives almost
entirely *before* traffic ships: a falsifiable hypothesis, one primary metric, a sample size derived
from the smallest effect worth detecting, and a stop rule you cannot renegotiate at 2pm on day four.

## Pre-test checklist — every line true before any traffic

Each one is a place experiments die silently.

- [ ] A **falsifiable hypothesis** — names the change, the direction, and the metric it moves.
- [ ] Exactly **ONE primary metric**. More than one primary = multiple comparisons = inflated false positives.
- [ ] **Guardrail metrics** — what you refuse to harm (latency, refunds, unsubscribes) even for a win.
- [ ] The **randomization unit = the analysis unit** (usually the user). Mixing them is pseudoreplication.
- [ ] An **MDE** — the smallest lift that would change a decision. Not "any difference."
- [ ] A **computed sample size** and the **duration** it implies at your real daily eligible traffic.
- [ ] A **fixed stop rule** — a date or an n you commit to before launch. No "we'll see how it looks."

## Step 1 — Hypothesis and metrics

State a null you can reject. "The new checkout button changes purchase conversion" with H0: conversion
equal across arms, H1: it differs. Vague aspirations ("improve the funnel") have no rejection region.

Pick one primary metric and freeze it. Why: every extra primary metric is another coin flip at α, so
three "primary" metrics turn a 5% false-positive rate into roughly 14%. Demote the rest to secondary.

Randomize on the same unit you analyze on. If a user sees the variant on every visit, randomize by user,
not by session — analyzing 50k sessions from 8k users treats correlated observations as independent and
fabricates significance.

```text
Bad:  "We think the redesign will improve engagement and revenue and retention."  (no null, 3 primaries, no number)
Good: "H0: 30-day purchase conversion is equal between control and the new one-click button.
       H1: it differs. Primary: purchase conversion. Guardrails: refund rate, p95 checkout latency.
       Randomize by user_id. MDE: +1.5pp absolute on a 12% baseline."
```

## Step 2 — Sample size from MDE, baseline, and power

Defaults: power 0.80, α 0.05 (two-sided). The MDE is yours to choose — it is the smallest effect that
would actually change what you do.

Rule: required n scales with ~1/MDE². Why: halving the smallest effect you care to detect roughly
**quadruples** the traffic and time. This is the single most expensive decision in the design, so set the
MDE to a business threshold, never to "whatever is small."

For a conversion rate (proportion):

```python
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

p1, p2 = 0.12, 0.135                       # baseline, baseline + MDE (1.5pp)
h = proportion_effectsize(p1, p2)          # Cohen's h (arcsine transform)
n = NormalIndPower().solve_power(effect_size=h, alpha=0.05, power=0.80, ratio=1.0)
print(int(-(-n // 1)))                      # n PER ARM, rounded up
```

For a continuous metric (revenue per user, time on page) use Welch-style sizing:

```python
from statsmodels.stats.power import TTestIndPower

effect = mde_in_units / pooled_std         # Cohen's d
n = TTestIndPower().solve_power(effect_size=effect, alpha=0.05, power=0.80, ratio=1.0)
```

Then convert n to a calendar plan: `days = ceil((n_per_arm * num_arms) / daily_eligible_users)`. If that
is 9 days, run a clean **two full weeks** anyway — weekday/weekend mix is part of the population, and a
6-day test oversamples whoever shows up Tuesday. Full worked example (12% baseline, +1.5pp MDE, 80%
power) plus runnable sizing, n→duration, CUPED θ and SRM snippets: `references/sample-size-and-cuped.md`.

## Step 3 — Run discipline

**Fixed horizon is the default.** Commit to the n/date from Step 2 and read the result once, at the end.

**Do not peek and stop at first significance.** Why: checking repeatedly and stopping the moment p < 0.05
inflates the Type-I error far above 5% — with enough looks, a null test crosses 0.05 most of the time.
If you genuinely need to stop early, use a *sequential / always-valid* method (confidence sequences,
e.g. Netflix's anytime-valid CIs) that holds Type-I error under continuous monitoring. Sequential is
strong for **killing losers early** and weak for **calling winners early** — for a confident win, the
fixed-horizon read is tighter.

**Gate on SRM before you trust anything.** Compute a chi-square test on the observed split versus the
intended ratio. If p < 0.001 the assignment or logging is broken — a bot filter dropping one arm, a
redirect, a caching bug. Fix the instrumentation and rerun; do not "adjust for it."

The peeking Type-I math, sequential/always-valid options, SRM diagnosis, novelty/primacy effects,
Simpson's paradox in segments and HARKing all live in `references/pitfalls.md`.

## Step 4 — Analyze

Pick the test by metric type:

| Metric type | Test |
|---|---|
| Binary conversion (proportion) | Two-proportion z-test (`statsmodels.stats.proportion.proportions_ztest`) |
| Continuous, roughly normal / large n | Welch's t-test (`scipy.stats.ttest_ind(..., equal_var=False)`) |
| Continuous, heavy-tailed / skewed (revenue) | Mann-Whitney U, or t-test on a log/winsorized metric |

Report **lift + confidence interval + p-value together**. Never p alone. Why: p < 0.05 with a CI of
[+0.1pp, +5pp] is "statistically there, practically a coin toss" — the CI tells you the size, p only
tells you it is not exactly zero. **Practical significance** = compare the CI to your MDE: if the whole
interval sits above the MDE, ship; if it straddles the MDE, you detected *something* too small to matter.

**Multiple comparisons.** Two regimes:
- Small set of pre-declared **decision** metrics → **Bonferroni** (divide α by the count). Conservative, simple.
- Large **exploratory** scan of many metrics/segments → **Benjamini-Hochberg (FDR)**. It keeps far more
  power than Bonferroni on big scans (in a 20-effect example, ~17 detected vs ~12 under Bonferroni).

## Step 5 — CUPED variance reduction

CUPED (Controlled-experiment Using Pre-Experiment Data) subtracts predictable pre-period noise so the
same traffic buys more power — or the same power needs less traffic. The adjusted metric:

```text
Y_cuped = Y − θ · (X − E[X])        where  θ = Cov(Y, X) / Var(X)
```

Estimate θ by regressing the in-experiment metric `Y` on the **pre-experiment** covariate `X` (e.g. each
user's spend in the 4 weeks before the test), then analyze `Y_cuped` with the same test as Step 4.

When it pays: recurring users with a strong pre-period signal. Reported wins — Netflix ~40% variance
reduction on engagement, Statsig 50%+ on common metrics → significance in roughly half the time/traffic.

When it does **nothing** — do not bother: brand-new users (no pre-period data), a covariate uncorrelated
with the outcome, or — the cardinal sin — a covariate measured *after* assignment, which biases the
estimate. The covariate MUST be pre-treatment and independent of which arm a user lands in. Runnable
θ-via-OLS snippet in `references/sample-size-and-cuped.md`.

## Anti-patterns

| Bad | Why it is wrong | Do instead |
|---|---|---|
| Peek daily, stop the day p < 0.05 | Repeated looks inflate Type-I error far above α | Fix n/date up front; or a sequential method that holds α |
| No sample size set before launch | You will stop on noise and call it a win | Compute n from MDE/baseline/power in Step 2 |
| Several "primary" metrics | Each is a coin flip at α; 3 metrics ≈ 14% false-positive | One frozen primary; the rest are secondary |
| Ignore the observed split | An SRM means assignment/logging is broken; results are garbage | Chi-square SRM gate before reading anything |
| Report only the p-value | Hides effect size — p < 0.05 can be practically zero | Always lift + CI + p; compare CI to MDE |
| CUPED on a post-assignment covariate | Covariate correlated with the arm biases θ | Use only pre-treatment, assignment-independent covariates |
| Call a winner from an underpowered test | "Not significant" then ≠ "no effect"; you lacked power | Reach planned n, or report the CI and say "inconclusive, here is the range" |
| Decide the hypothesis after seeing results (HARKing) | Turns the whole analysis into a fishing expedition | Pre-register hypothesis + primary metric before launch |
| Run 6 days because it "looks significant" | Oversamples one weekday slice of the population | Run full weeks; honor the fixed horizon |

## Checkable artifact

When this skill emits a Python sizing/analysis script or an experiment-design doc, run
`scripts/verify.sh` from your project root. It confirms the script executes under `python3` and prints a
numeric sample size, and that any design doc names a primary metric, an MDE, and power/alpha. It is
read-only and soft-passes when no artifact is present (a design-only conversation).
