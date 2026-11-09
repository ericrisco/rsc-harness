# Eval harness — `mongodb`

These cases check two things: **triggering** (does the skill fire on real MongoDB problems and stay
quiet on near-misses?) and **capability** (does loading it measurably improve the answer?). Cases
live in `cases.yaml` and are **LLM-graded against the rubric — no live MongoDB is needed**; run them
through the repo's agent eval harness, not a shell script.

## Triggering

For each prompt, start a fresh agent session with only the `mongodb` skill discoverable (its
`SKILL.md` description in scope, no siblings loaded), paste the prompt verbatim, and run 3–5 trials
(the trigger decision is stochastic):

- `should_trigger`: PASS if the skill fires in the majority of trials. Several prompts deliberately
  avoid the words "index" / "MongoDB" (the COLLSCAN complaint, the Spanish modeling request) to test
  intent recognition over keyword matching.
- `should_not_trigger`: PASS if the skill does **not** fire. Each names a `route_to` sibling
  (`postgresdb`, `nodejs`, `security-audit`, `redis`, `vector-db`); a wrong-but-not-`mongodb` route
  still passes this skill's gate.

Pass bar: ≥ 90% trigger accuracy across all trigger cases.

## Capability

Run the `capability` scenario twice — once WITHOUT the skill (clean agent) and once WITH it — and
grade each transcript against the `must_include` checklist, one point per bullet that is correctly
and specifically covered (not merely name-dropped). Pass bar: WITH the skill covers ≥ 80% of bullets
and clearly beats WITHOUT (target ≥ +30 points). Record trial counts and per-bullet verdicts so a
reviewer can audit; don't report a bare pass/fail.
