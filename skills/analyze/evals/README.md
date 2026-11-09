# Eval harness — `analyze` skill

`analyze` is the rsc-sdd **pre-implementation consistency gate**. These evals
check two things: that the skill **triggers** on the right prompts (a
cross-check of the planning artifacts before coding) and stays quiet on
near-misses (anything that resolves, builds, runs, or debugs code), and that it
**measurably changes the answer** — reporting and routing instead of editing
artifacts or jumping into code. Cases live in `cases.yaml`. There is no shell
runner: triggering and report quality are judgment calls graded by an agent
harness plus a human spot-check.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `analyze` (several avoid the word
  "analyze" to test intent, not keyword).
- `should_not_trigger` — near-misses routed to the correct existing sibling via
  `route_to` (debugging, verification via a stack skill, plan authoring, code
  review, harness bootstrap, db perf).
- `capability` — a full BLOCKED-gate scenario with a `must_include` rubric to
  grade with vs without the skill.

## Triggering eval

Goal: the gate fires when the four artifacts exist and a cross-check is wanted,
and never on a near-miss.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing (analyze + harness, init, the stack skills fastapi/nextjs/go/
   flutter/postgresdb, security-audit, deployment, design, marketing,
   presentations, course-storytelling, building-agents) so routing competes
   realistically. When the other rsc-sdd phase skills (clarify, plan, tasks,
   implement, verify, review, debug) are added to the repo, include them too —
   they are the closest competitors and the sharpest test of the boundary.
2. For each `should_trigger` prompt: feed it cold, record whether `analyze` is
   the skill the agent loads. Run **3-5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `analyze` does NOT load and the
   chosen skill matches `route_to`. Same 3-5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: >= 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the debugging and verification near-misses
(those are the known traps — "is it ready to ship / why is it failing" is a
post-implementation or runtime concern, not a pre-implementation artifact gate).

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For the `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `analyze` loaded).
   - **WITH** the `analyze` skill loaded.
2. Grade each output against the `must_include` checklist — one point per item
   covered. A human or grading agent marks each item present / absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers >= 80% of `must_include`; WITHOUT clearly
lower** (target a >= 30-point gap). The discriminating behaviors are the
report-only discipline (no artifact edits, no code), running all six analyses,
the constitution-violation + GAP double-flag on the missing rate limit, the
DRIFT call on the Redis cache, the coverage map, the verdict line, and the
hand-off to the next phase.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is **restraint**: a correct answer reports
  and routes, it does not "helpfully" rewrite the spec or start coding. Treat a
  confident answer that edits an artifact or begins implementation as a
  **capability failure** even if its analysis is otherwise sharp — that behavior
  defeats the gate.
- Re-run after any edit to `SKILL.md`. Wording changes shift both triggering and
  rubric coverage, and the report-only boundary is easy to soften by accident.
