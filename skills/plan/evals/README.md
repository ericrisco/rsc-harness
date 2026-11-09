# Eval harness — `plan` skill

These evals are run by an **agent harness** (an LLM agent with the rsc-sdd + stack skill catalog
available), not a byte-exact shell script. `cases.yaml` is the fixture; this file is the procedure.
Grading is judgment-based — a human or a judge-agent scores against the rubrics.

`plan` is a process skill (the fourth SDD phase). It is judged on **routing accuracy** (does it
fire only when there's a clarified spec to design from) and **capability** (does the plan it
produces stay at the right altitude and cover the seven sections).

## 1. Triggering accuracy

Goal: `plan` fires when the user wants a technical design from a clarified spec, and stays silent
on the adjacent SDD phases and on stack-mechanics requests.

1. Load **only** the `plan` skill description into the agent, plus the bare names of the sibling
   skills for routing: the rsc-sdd phases (constitution, specify, clarify, tasks, analyze,
   implement, verify, review, ship, debug, worktrees, parallel) and the stack/other skills
   (fastapi, nextjs, go, postgresdb, flutter, design, marketing, presentations,
   course-storytelling, building-agents, security-audit, deployment, harness, init). Do **not** load
   any skill bodies.
2. For each prompt in `should_trigger` and `should_not_trigger`, ask the agent which skill (if any)
   it would invoke. Run **3–5 trials per prompt** at production temperature to catch flakiness.
3. Score:
   - `should_trigger` → PASS if `plan` is selected in the majority of trials.
   - `should_not_trigger` → PASS if `plan` is **not** selected; bonus-correct if it routes to the
     `route_to` sibling named in the case.
4. **Pass bar: ≥ 90% of prompts pass** (at most 1 miss across the 13 prompts), and no
   `should_not_trigger` prompt may fire `plan` in a majority of its trials. The two highest-value
   near-misses to get right are `clarify` (the phase immediately before — an unclarified spec must
   NOT trigger plan) and `tasks` (the phase immediately after).

## 2. Capability uplift (with vs without)

Goal: the skill measurably improves the plan, not just gates it.

1. For the `capability` scenario, run the agent **twice**:
   - **WITHOUT**: base agent, no `plan` skill loaded.
   - **WITH**: same prompt, `plan` skill fully loaded (it may read its `references/plan-template.md`).
2. Grade each output against the `must_include` checklist — count a point only if it is genuinely
   satisfied, not merely gestured at. The load-bearing points are: the seven-section artifact at
   the right path, language-neutral contracts (no framework code), a per-criterion testing
   strategy, and a ranked risk register.
3. Coverage = points satisfied / total points, per run.
4. **Pass bar:**
   - WITH-skill coverage **≥ 80%** of the rubric.
   - WITH clearly beats WITHOUT. The signature uplift to look for: the WITHOUT run tends to write
     framework code and a one-line "we'll add tests"; the WITH run stays stack-neutral, names test
     levels per acceptance criterion, and produces a ranked risk register at the correct artifact
     path.
5. Run 2–3 trials per condition and average; note any rubric point the skill never produces — that
   is a gap to fix in `SKILL.md` or `references/plan-template.md`.

## Notes

- Prompts deliberately vary phrasing; several omit the word "plan" so triggering rests on the
  signal "clarified spec → technical design before code", not keyword matching.
- Near-misses route to the genuinely correct sibling: fuzzy-idea → specify, vague-spec → clarify,
  approved-plan-to-checklist → tasks, DDL/indexes → postgresdb, real handler+tests → go,
  project-wide principles → constitution.
- This is judgment-based, not byte-exact. Record trial counts and the judge (human or model)
  alongside results for reproducibility.
