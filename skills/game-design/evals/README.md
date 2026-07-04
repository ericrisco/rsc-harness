# Evals for game-design

`cases.yaml` is the trigger and capability spec for this skill, read by the catalog's
skill-eval harness. `should_trigger` asserts the skill fires on design-intent asks — core
loops, economy/inflation, balance, difficulty curves, feel, scope, and the vague "why isn't my
game fun" — including a Spanish phrasing. `should_not_trigger` asserts near-misses route to the
right sibling: engine code to `unity`/`godot`/`unreal`, story to `game-storytelling`, layout to
`level-design`, netcode to `gamedev-multiplayer`, release to `gamedev-shipping`.

The `capability` case checks that an economy/loop-repair answer stays engine-agnostic: it
diagnoses loop funding, models faucets vs sinks with the pseudo-formula, stops runaway inflation
with escalating sinks/prestige, names the MDA aesthetic, and defers implementation to the engine
skills.
