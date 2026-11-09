# Eval harness — `fastapi` skill

These evals are run by an **agent harness** (an LLM agent with the skill catalog
available), not a pure shell script. `cases.yaml` is the fixture; this file is the
procedure. Grading is done by a human or a judge-agent against the rubrics.

## 1. Triggering accuracy

Goal: the `fastapi` skill fires on in-scope prompts and stays silent on near-misses.

1. Load **only** the `fastapi` skill description into the agent (plus the bare names of the
   sibling skills for routing: nextjs, go, postgresdb, flutter, design, marketing,
   presentations, course-storytelling, building-agents, security-audit, deployment, harness,
   init). Do **not** load the skill bodies.
2. For each prompt in `should_trigger` and `should_not_trigger`, ask the agent which skill
   (if any) it would invoke. Run **3–5 trials per prompt** (temperature as in production) to
   catch flakiness.
3. Score each prompt:
   - `should_trigger` → PASS if `fastapi` is selected in the majority of trials.
   - `should_not_trigger` → PASS if `fastapi` is **not** selected; bonus-correct if it routes
     to the `route_to` sibling (or stays silent when `route_to: none`).
4. **Pass bar: >= 90% of prompts pass** (i.e. at most 1 miss across the ~13 prompts), and no
   `should_not_trigger` prompt may fire `fastapi` in a majority of its trials.

## 2. Capability uplift (with vs without)

Goal: the skill measurably improves the answer, not just gates it.

1. For each `capability` scenario, run the agent **twice**:
   - **WITHOUT**: base agent, no `fastapi` skill loaded.
   - **WITH**: same prompt, `fastapi` skill fully loaded.
2. Grade each output against that scenario's `must_include` checklist — count how many points
   are genuinely satisfied (a point only counts if correct, not merely mentioned).
3. Compute coverage = points satisfied / total points, for each run.
4. **Pass bar:**
   - WITH-skill coverage **>= 80%** of the rubric.
   - WITH must beat WITHOUT by a clear margin (the uplift is the point). A skill that doesn't
     raise coverage on at least one scenario fails the eval.
5. Run 2–3 trials per condition and average; note any rubric point the skill never produces —
   that's a gap to fix in `SKILL.md`.

## Notes

- Keep prompts varied and realistic; some deliberately omit the word "FastAPI" so triggering
  rests on the async-Python-HTTP-service signal, not keyword matching.
- Near-misses route to the genuinely correct sibling (Next.js → nextjs, raw SQL → postgresdb,
  generic security → security-audit, Docker/CI → deployment) or to `none` (Flask, framework-
  agnostic REST contract questions).
- This is judgment-based, not byte-exact; record trial counts and the judge (human or model)
  alongside results for reproducibility.
