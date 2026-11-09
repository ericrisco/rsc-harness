# Eval harness — `specify` skill

These evals check two things: that the skill **triggers** on the right prompts
(and stays quiet on near-misses that belong to other SDD phases or stack
skills), and that, when loaded, it **measurably changes the output** — a real
WHAT/WHY spec with no implementation leak, one-at-a-time questioning, the
canonical file path, and honest open points. Cases live in `cases.yaml`.

There is no shell runner. `specify` is a process skill judged on safety rails
and judgement, so grading is done by an **agent harness** (a Claude Code agent
with the rsc skill catalog loaded) plus a human spot-check.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `specify` (incl. Spanish and
  non-obvious phrasings where the word "spec" never appears).
- `should_not_trigger` — near-misses that must route to the correct sibling via
  `route_to` (`plan`, `clarify`, `constitution`, `tasks`, `fastapi`, `design`).
- `capability` — scenarios with a `must_include` rubric to grade with vs without.

## Triggering eval

Goal: the skill fires when an intent needs a spec, and never on the HOW, the
ambiguity sweep, or project-wide principles.

1. Configure an agent with the **full rsc skill catalog** available for routing
   (the SDD phases — constitution, specify, clarify, plan, tasks, analyze,
   implement, verify, review, ship — plus the stack/process skills: fastapi,
   nextjs, go, postgresdb, flutter, design, marketing, presentations,
   course-storytelling, building-agents, security-audit, deployment, harness,
   init) so routing competes realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `specify` is
   the skill the agent loads. Run **3-5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `specify` does NOT load and the
   chosen skill matches `route_to`. Same 3-5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: >= 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the `plan` and `clarify` near-misses — those are
the known traps. A prompt about an *existing* spec (architecture, or "find the
ambiguities") must NOT pull in `specify`.

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For each `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `specify` loaded).
   - **WITH** the `specify` skill loaded.
2. Grade each output against that scenario's `must_include` checklist — one
   point per item covered. A human or grading agent marks each present / absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers >= 80% of `must_include`; WITHOUT clearly
lower** (target a >= 30-point gap). The skill must demonstrably add: the
no-implementation-leak discipline, one-question-at-a-time elicitation, the
canonical `02-DOCS/wiki/sdd/specs/<slug>.md` path + Knowledge-map index,
Given/When/Then acceptance criteria, and an honest *Points to clarify* handoff
to the `clarify` phase. If the base answer already scores ~80%, the case isn't
discriminating — tighten the rubric.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is the **no-implementation-leak** rule: a
  correct answer describes observable behaviour and refuses to name a framework,
  table, or endpoint — pushing those to *Points to clarify*. Treat a confident
  spec that already designs the solution as a **capability failure** even if it
  reads well.
- The second-highest signal is **not over-asking**: a wall of questions, or
  inventing answers to look finished, both fail the elicitation discipline.
- Re-run after any edit to `SKILL.md` or its `references/` — wording changes
  shift both triggering and rubric coverage.
