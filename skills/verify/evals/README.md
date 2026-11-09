# Eval harness — `verify` skill

`verify` is the ASDD evidence **gate** (per task and at closing). These evals check two
things: that it **triggers** at the right moment (someone is about to claim
"done"/"green"/"ready to merge") and stays quiet on near-misses, and that it
**measurably changes the behavior** — running the real stack gate, walking the
done-checks and acceptance criteria, and refusing to claim done without
evidence. Cases live in `cases.yaml`. Grading is done by an **agent harness** (a
Claude Code agent with skills loaded) plus a human spot-check, because both
routing and "did it actually demand evidence" are judgment calls — there is no
pure shell runner.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `verify` (8 cases, incl. non-obvious
  phrasings like "are we ready for review yet?" and "prove the fix works").
- `should_not_trigger` — near-misses that must route to a real sibling
  (`route_to`): writing tests (`fastapi`), debugging a flaky test (`go`),
  building the gate script (`nextjs`), security audit (`security-audit`),
  migration/constraint checks (`postgresdb`). The recurring trap: anything that
  WRITES or RUNS code, or OWNS the tooling, is a stack skill — `verify` only
  orchestrates and judges.
- `capability` — one end-to-end scenario with a `must_include` rubric to grade
  WITH vs WITHOUT the skill.

## Triggering eval

Goal: the skill fires when a "done" claim is imminent and never on a near-miss.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing (verify + the ASDD phase skills it chains to — implement,
   debug, review, clarify, ship — plus the stack/process skills: fastapi, go,
   nextjs, flutter, postgresdb, security-audit, deployment, harness, init) so
   routing competes realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `verify` is
   the skill the agent loads. Run **3–5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `verify` does NOT load and that
   the chosen skill matches `route_to`. Same 3–5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: ≥ 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the "write the tests" / "debug the failing
test" / "build the gate script" near-misses — those are the known traps. A
prompt about *producing* tests or *fixing* a failure must not pull in `verify`.

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For the `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `verify` loaded).
   - **WITH** the `verify` skill loaded.
2. Grade each output against the scenario's `must_include` checklist — one point
   per checkable item covered. A human or grading agent marks each present /
   absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers ≥ 80% of `must_include`; WITHOUT clearly
lower** (target a ≥ 30-point gap). The discriminating behaviors are the ones a
base agent skips: actually *running* the stack `verify.sh` (not trusting a
prior run), treating a tool SKIP as unverified, walking *every* acceptance
criterion for observable proof, refusing to fix a failing check inline, and the
all-or-nothing verdict (one unverified criterion ⇒ FAIL). If the base answer
already scores ~80%, the case isn't discriminating — tighten the rubric.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is the **verdict discipline**: a correct
  answer refuses to call the feature done while one acceptance criterion is
  unproven, and hands a failing check to `debug` instead of patching it. Treat a
  confident "looks done, merge it" with no command output as a **capability
  failure** even if the reasoning reads well.
- The skill ships **no `scripts/verify.sh` of its own** — it is a process gate
  that *delegates* to the stack skills' gates. Do not eval it as if it owned the
  tooling; eval whether it correctly orchestrates and judges.
- Re-run after any edit to `SKILL.md` — wording changes shift both triggering
  and rubric coverage.
