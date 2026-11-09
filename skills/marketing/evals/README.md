# Eval harness — `marketing` skill

These evals check two things: that the skill **triggers** on the right prompts
(and stays quiet on near-misses), and that it **measurably improves** copy/SEO
output. Cases live in `cases.yaml`. There is no pure shell runner — grading is
done by an **agent harness** (a Claude Code agent with skills loaded) plus a
human spot-check, because triggering and copy quality are judgment calls.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `marketing`.
- `should_not_trigger` — near-misses that must route elsewhere (`route_to`).
- `capability` — scenarios with a `must_include` rubric to grade with vs without.

## Triggering eval

Goal: the skill fires when it should and never on a near-miss.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing (marketing + design, nextjs, postgresdb, security-audit, go,
   flutter, presentations, course-storytelling, building-agents, deployment,
   harness, init) so routing competes realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `marketing`
   is the skill the agent loads. Run **3-5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `marketing` does NOT load, and
   that the chosen skill matches `route_to` (or that it correctly declines when
   `route_to: none`). Same 3-5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: >= 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the `design`/`nextjs` near-misses (those are the
known traps — a landing-page prompt about pixels or the build must not pull in
marketing).

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For each `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `marketing` loaded).
   - **WITH** the `marketing` skill loaded.
2. Grade each output against that scenario's `must_include` checklist — one
   point per checkable item covered. A human or a grading agent marks each
   item present / absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers >= 80% of `must_include`; WITHOUT clearly
lower** (target a >= 30-point gap). The skill must demonstrably add the
brand-grounding STOP, specificity-over-adjectives, single-CTA discipline, the
ban-list, `[[NEEDS PROOF]]`, and the SEO/GEO + JSON-LD spec. If the base answer
already scores ~80%, the case isn't discriminating — tighten the rubric.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- Brand-gate behavior is the highest-signal capability check: a correct answer
  refuses to write grounded copy with no brand study and interviews instead.
  Treat a confident, ungrounded full-page draft as a **capability failure** even
  if the prose reads well.
- Re-run after any edit to `SKILL.md` or its `references/` — wording changes
  shift both triggering and rubric coverage.
