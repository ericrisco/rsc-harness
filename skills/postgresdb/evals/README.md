# Eval harness — `postgresdb`

This harness checks two things: **triggering** (does the skill fire on the right
prompts and stay quiet on near-misses?) and **capability** (does loading the skill
measurably improve the answer?). Cases live in `cases.yaml`. These run through an
**agent harness**, not a pure shell script — a human or a driver agent feeds prompts
and grades outputs. Keep grading honest.

## 1. Triggering

For each prompt in `cases.yaml`:

1. Start a fresh agent session with **only the `postgresdb` skill** discoverable
   (its `SKILL.md` description in scope; no sibling skills loaded).
2. Paste the prompt verbatim. Observe whether the agent invokes / routes to
   `postgresdb`.
3. Run **3–5 trials per prompt** (the trigger decision is stochastic).
4. Score:
   - `should_trigger`: PASS if the skill fires in the majority of trials.
   - `should_not_trigger`: PASS if the skill does **not** fire. When the case names
     a `route_to` sibling, sanity-check the agent would plausibly route there (or to
     `none`); a wrong-but-not-postgresdb route still passes this skill's gate.

**Pass bar:** ≥ 90% trigger accuracy across all `should_trigger` + `should_not_trigger`
prompts (i.e. at most ~1 miss out of the 14 cases). A `should_trigger` that fires < 50%
of trials is a fail; a `should_not_trigger` that fires at all in a majority of trials is
a fail.

## 2. Capability

For each `capability` scenario, run it **twice**:

- **WITHOUT** the skill: a clean agent, no `postgresdb` skill available.
- **WITH** the skill: same prompt, `postgresdb` loaded.

Grade each transcript against that scenario's `must_include` checklist — one point per
bullet that is correctly and specifically covered (not just name-dropped). Compute
coverage = points / total bullets.

**Pass bar:**
- WITH the skill: ≥ 80% of `must_include` bullets covered.
- The skill must **measurably improve** the output: WITH coverage should clearly beat
  WITHOUT (target ≥ +30 percentage points, or crossing from fail→pass). If a baseline
  agent already nails the rubric without the skill, the rubric is too easy — tighten it.

## Notes

- Prompts are deliberately varied: some never say "Postgres", "SQL", or "index"
  (slow-query, multi-tenant isolation, duplicate-job-processing) — these test intent
  recognition, not keyword matching.
- Near-misses route to the genuinely correct sibling (`fastapi`, `flutter`,
  `deployment`, `security-audit`) or `none` when the request is out of every sibling's
  scope (Prisma ORM trap, Redis caching).
- This is judgment-based grading. Record trial counts and the per-bullet verdicts so a
  reviewer can audit; don't report a bare pass/fail.
