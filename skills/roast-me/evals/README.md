# Eval harness — `roast-me`

Evaluates the `roast-me` skill on two axes: **triggering** (does it fire on
the right prompts and stay quiet on near-misses) and **capability** (does loading
it produce a correct, useful roast run with both scores, the right habit list,
and the trend tracking). Cases live in `cases.yaml`. These run via an **agent
harness** — a human or driver agent feeds prompts to the assistant and judges
the result against the rubrics.

## What is in `cases.yaml`

- `should_trigger` (7) — prompts that MUST invoke `roast-me`. Includes:
  - verbatim "roast me"
  - time-window variant ("last two weeks")
  - cost-only angle (no mention of prompting quality)
  - two non-English triggers (Spanish, Catalan)
  - non-obvious phrasing ("honest score", "am I wasting money")
- `should_not_trigger` (5) — near-misses that must route elsewhere, each with
  a real sibling `route_to`: `code-review`, `prompt-engineering`, `analyze`,
  `chatbot`, `llm-pipeline`.
- `capability` (2) — scenarios with `must_include` rubrics:
  1. A full 14-day run with realistic data: error rates, tier distribution,
     top issues, scoring, and history tracking.
  2. Unknown runtime degradation: exits 0, clear message, no crash.

## A. Triggering eval

1. Load **only** `roast-me` into the agent (no other rsc skills, so routing is honest).
2. For each `should_trigger` prompt: fresh session, paste verbatim, record
   whether the five-phase pipeline starts. Run **3–5 trials** per prompt.
3. For each `should_not_trigger` prompt: same, but a **pass** = `roast-me`
   does NOT fire. Sanity-check that the `route_to` sibling genuinely owns
   that prompt.
4. Score: a prompt passes if the **majority of its trials** go the expected way.

**Pass bar**: >= 90% trigger accuracy across all 12 prompts (at most 1 misbehaving).

## B. Capability eval

1. **Without the skill**: fresh session, skill NOT loaded, give the `scenario`
   prompt. Save output A.
2. **With the skill**: fresh session, `roast-me` loaded, same prompt. Save output B.
3. Grade each output against that scenario's `must_include` points.
4. Repeat across **3 trials** per scenario per condition and average.

**Pass bar**: WITH the skill covers >= 80% of `must_include` points. WITHOUT
should be materially lower (target >= 30-point gap). If the skill does not
beat the baseline, the skill or the rubrics need work.

## Key differentiators WITH the skill loaded

- **Effective vs raw error rate**: the skill uses `effective_error_rate`
  (unrecovered errors only), never the raw rate. A high raw / low effective
  split is praised, not penalised.
- **Parallel subagents**: the skill explicitly batches prompts into ~30-item
  groups and spawns parallel analysis passes per batch — a baseline answer
  typically analyses sequentially.
- **Dual scoring formula**: Prompt Quality (base 70 ± issue penalties/bonuses)
  and Compute Efficiency (base 80 − overuse penalties + mix-down bonus) are
  computed independently to the documented formula.
- **Trend tracking**: history is written to `~/.roast-me-history.json` and a
  trend line is printed if prior entries exist.
- **Runtime degradation**: unknown `--runtime` exits 0 with a clear message —
  no crash, no invented data.
- **Original rsc voice**: no copied phrasing from other skill ecosystems.

## Judging notes

- This is LLM-as-judge / human-in-the-loop, not deterministic. Use a consistent
  grader (same model + rubric) across A/B.
- `scripts/eval-lint.sh` checks case-count minimums; it does not grade prose.
- Re-run after any edit to `SKILL.md` or its `description` — both axes are
  wording-sensitive.
- The key confusable: `roast-me` reviews the user's **prompting behaviour**
  (how they write prompts), not their code and not the agent's output quality.
  Any eval that conflates these is testing the wrong thing.
