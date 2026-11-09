# Eval harness — `go` skill

These evals are run by an **agent harness** (a Claude agent loading skills), not a pure
shell script. `cases.yaml` is the fixture; this file is the procedure. Two things are
measured: **triggering** (does the right skill fire?) and **capability** (does the skill
make the answer better?).

## 1. Triggering

Goal: the `go` skill fires on `should_trigger` prompts and stays silent on
`should_not_trigger` near-misses.

Setup:
- Load the **full skill catalog descriptions** (the routing layer sees every sibling:
  fastapi, nextjs, go, postgresdb, flutter, design, marketing, presentations,
  course-storytelling, building-agents, security-audit, deployment, harness, init).
- For each prompt, start a fresh agent session (no prior context bleed).

Procedure:
- Feed each `should_trigger.prompt`; record whether the agent invokes the `go` skill.
- Feed each `should_not_trigger.prompt`; record which skill (if any) it invokes, and
  confirm it matches the stated `route_to` (or `none`).
- Run **3–5 trials per prompt** (LLM routing is non-deterministic); a prompt passes if it
  fires correctly in the **majority** of trials.

Pass bar:
- **≥90% trigger accuracy** across all prompts (should_trigger fires AND should_not_trigger
  does not fire `go`).
- A `should_not_trigger` that routes to the *wrong* sibling but still avoids `go` is a
  partial pass — log it; routing precision matters for the catalog.

## 2. Capability

Goal: the skill **measurably improves** the answer, not just decorates it.

Procedure for each `capability.scenario`:
1. **Without** the skill: run the scenario with the skill body unavailable. Grade the
   answer against `must_include`.
2. **With** the skill: run the same scenario with `go/SKILL.md` (and references) loaded.
   Grade again against `must_include`.
3. Score = fraction of `must_include` points present and correct. Run 3 trials per
   condition and average.

Pass bar:
- **With** the skill: **≥80%** of `must_include` points covered.
- The with-skill score must **beat** the without-skill score by a clear margin (the skill
  is earning its place). If a baseline model already hits the rubric without the skill,
  the rubric is too easy — tighten it.

## Notes

- Grading is rubric-based and partly judgment (e.g. "no string-matching of error
  messages"); a human or a grader-agent reads each point against the output.
- Keep `cases.yaml` faithful to `SKILL.md`'s "When to use / When NOT to use" — when the
  skill's scope changes, update the cases in the same change.
- These evals do not run in CI as-is; they are a reproducible manual/agent procedure.
