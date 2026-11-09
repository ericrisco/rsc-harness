# Eval harness — `debug` skill

`debug` is the on-demand rsc-sdd **diagnosis discipline**: reproduce → isolate →
hypothesize → fix → verify, refusing any fix before one root cause is reproduced
and confirmed. These evals check two things: that it **triggers** when there's a
real, unexplained failure to diagnose (and stays quiet on near-misses that
belong to a building/gating/reviewing/clarifying phase), and that it
**measurably changes the behavior** — turning a flake into a measured rate,
isolating one variable at a time, fixing the cause not the symptom, and refusing
to claim "fixed" without a regression test. Cases live in `cases.yaml`. Grading
is done by an **agent harness** (a Claude Code agent with skills loaded) plus a
human spot-check, because both routing and "did it actually find the cause
before patching" are judgment calls — there is no pure shell runner.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `debug` (8 cases, incl. non-obvious
  phrasings like "it works on my laptop but fails in CI", "the fix didn't stick",
  and "I can't reproduce it reliably").
- `should_not_trigger` — near-misses that must route to a real sibling
  (`route_to`): building a planned feature (`implement`), running the quality
  gate (`verify`), adversarial diff reading (`review`), resolving a spec
  ambiguity (`clarify`), cross-checking SDD artifacts (`analyze`). The recurring
  trap: anything that BUILDS, GATES, READS, or CLARIFIES is not root-cause
  diagnosis of a confirmed, reproducible defect.
- `capability` — one end-to-end scenario (an intermittent FastAPI 500 with a
  "just add a retry" shortcut on offer) with a `must_include` rubric to grade
  WITH vs WITHOUT the skill.

## Triggering eval

Goal: the skill fires when there's a real, unexplained failure to diagnose, and
never on a near-miss that belongs to another phase.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing (debug + the rsc-sdd phases it chains with — implement, verify,
   review, clarify, analyze, ship — plus the stack/process skills: fastapi, go,
   nextjs, flutter, postgresdb, security-audit, deployment, harness, init) so
   routing competes realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `debug` is the
   skill the agent loads. Run **3–5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `debug` does NOT load and that
   the chosen skill matches `route_to`. Same 3–5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: ≥ 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the known traps — "implement task 3 test-first"
(implement), "run the gate, are we ready to merge" (verify), and "read the diff
adversarially" (review). A prompt about *building*, *gating*, or *reviewing*
must not pull in `debug`; only a concrete, unexplained, reproducible failure does.

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For the `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `debug` loaded).
   - **WITH** the `debug` skill loaded.
2. Grade each output against the scenario's `must_include` checklist — one point
   per checkable item covered. A human or grading agent marks each present /
   absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers ≥ 80% of `must_include`; WITHOUT clearly
lower** (target a ≥ 30-point gap). The discriminating behaviors are the ones a
base agent skips: **refusing the retry shortcut** the user offered, turning
"intermittent" into a **measured k/N rate**, isolating **one variable at a
time**, encoding the bug as a **test that fails for the right reason** before
fixing, fixing the **cause not the symptom** (no sleep/retry/timeout bump), and
re-running until the **flake rate is zero** before handing the gate to `verify`.
If the base answer already scores ~80%, the case isn't discriminating — tighten
the rubric.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is the **discipline under pressure**: a
  correct answer declines the offered retry-patch, reproduces the flake as a
  rate, and refuses to call it fixed without a regression test that was red for
  the right reason. Treat a confident "wrapped it in a retry, suite's green now"
  as a **capability failure** even if it reads smoothly.
- The skill ships **no `scripts/verify.sh` of its own** — it is a process skill
  judged on its safety rails (no fix before a confirmed cause, one variable per
  isolate step, never ship around a red test), not on owning the tooling. It
  *delegates* the debugger/runner/profiler to the stack skills; eval whether it
  correctly drives the loop and hands the whole-gate re-run to `verify`.
- Re-run after any edit to `SKILL.md` — wording changes shift both triggering
  and rubric coverage.
