# Eval harness — level-design

These evals assert two things about the `level-design` skill. **Triggering:** it
fires on level layout, pacing, encounter, guidance, and reward requests, and
stays out of systemic mechanic/economy design (`game-design`), narrative
(`game-storytelling`), and engine-specific level tooling (`godot`/`unity`/
`unreal`). **Capability:** when engaged, it delivers the craft — the
blockout→art pipeline, the sawtooth intensity graph with breathers, the
introduce→develop→twist→combine teaching pattern, light/color/affordance
guidance, and observe-don't-coach playtesting — rather than generic advice.

## How to run

Run through an agent harness with skills loadable on demand; `cases.yaml` is the
fixture. Use the same model for every trial; vary only which skills are loaded.

- **Triggering:** load the full catalog so the agent can route to siblings; feed
  each `should_trigger` / `should_not_trigger` prompt verbatim and record which
  skill fires. Run 3–5 trials per prompt (the choice is stochastic).
  - Pass: `should_trigger` selects **level-design** in the majority of trials;
    `should_not_trigger` does not (ideally routes to the listed `route_to`).
  - Bar: **≥90%** trigger accuracy across all prompts.
- **Capability:** run each scenario WITH only level-design loaded vs WITHOUT any
  skill (baseline), 3 times each. Grade responses against the `must_include`
  rubric, one point per checkable item genuinely present.
  - Bar: WITH covers **≥80%** of items on average AND beats WITHOUT by **≥25**
    percentage points (a skill that doesn't move the needle fails).

## Notes / honesty

- LLM-graded and stochastic — re-run on edits; treat small deltas as noise.
- `route_to` targets assume the sibling skills (`game-design`,
  `game-storytelling`, `godot`, `unity`, `unreal`) exist in the catalog; a
  missing sibling can cause a near-miss to mis-route without it being a
  level-design fault — note it, don't count it against this skill.
