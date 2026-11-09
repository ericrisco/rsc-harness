# Eval harness — `deployment`

This is an **agent-run** eval, not a shell script. You drive a Claude Code agent and judge
its behavior against `cases.yaml`. Two things are measured: **triggering** (does the skill
fire on the right prompts and stay silent on near-misses) and **capability** (does loading the
skill measurably improve the answer).

## Setup

- `cases.yaml` defines `should_trigger`, `should_not_trigger`, and `capability` blocks.
- "Load the skill" = make `skills/deployment/SKILL.md` (and its `references/`) available to the
  agent. "Without the skill" = the same agent with no deployment skill in context.
- Run each prompt in a fresh session (no carryover between cases).

## A. Triggering

For trigger tests, load the **full catalog** of skills (deployment + all siblings: fastapi,
nextjs, go, postgresdb, flutter, design, marketing, presentations, course-storytelling,
building-agents, security-audit, harness, init) so routing is realistic.

1. For each `should_trigger` prompt: feed it to the agent, run **3–5 trials**.
   - PASS if the agent invokes the `deployment` skill.
2. For each `should_not_trigger` prompt: run **3–5 trials**.
   - PASS if `deployment` does **not** fire. If `route_to` names a sibling, confirm the agent
     routes there (or asks to); if `route_to: none`, confirm it declines / calls it out of scope.
3. Record fires / trials per prompt.

**Pass bar:** ≥90% trigger accuracy across all trials — i.e. `should_trigger` fires ≥90% of
the time AND `should_not_trigger` fires deployment <10% of the time. A near-miss leaking into
deployment is a harder failure than a missed trigger; investigate any leak.

## B. Capability

For each `capability` scenario, run the agent **twice**: once **with** the skill loaded, once
**without**. Grade each output against that scenario's `must_include` checklist (one point per
checkable item, scored by a human or a judge agent).

1. Score = covered items / total `must_include` items.
2. **Pass bar:** with the skill ≥80% covered; AND the with-skill score beats the without-skill
   score by a clear margin (the skill must *measurably* improve the answer — if both score the
   same, the skill is adding no value on that scenario).
3. Spot-check that the with-skill answer follows the skill's hard rules (non-root, secrets via
   BuildKit not ARG, default-deny `GITHUB_TOKEN`, SHA-pinned actions, three hosting options).

## Reporting

For each run, capture: per-prompt fire rate, the routing target on near-misses, and the
with/without capability scores. The eval passes when **both** bars (A and B) are met. These are
judgment calls made by an agent/human reviewer — note any borderline cases rather than hiding
them; honest near-misses are more useful than a green checkmark.
