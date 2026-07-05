# Eval harness — `godot` skill

These cases are read by the rsc skill-eval harness (a Claude agent with the full skill catalog
loaded) or by hand. They assert two things. **Triggering**: the `godot` description fires on each
`should_trigger` prompt — including symptom-only and Spanish phrasings — and stays quiet on the
`should_not_trigger` near-misses, routing each to its named sibling (`unity`, `unreal`,
`gamedev-shaders`, `cpp`, `game-design`, `gamedev-multiplayer`) instead. **Capability**: with
`SKILL.md` and its references loaded, the generated Godot code satisfies every
`capability.must_include` bullet — the Godot 4 flow (`velocity` property + no-arg `move_and_slide()`),
typed GDScript, Callable signals, `@export`/`@onready`, zero Godot 3 leftovers, and a correct C#
parity block — and clearly beats the no-skill baseline. Because LLM routing is non-deterministic,
run 3–5 trials per prompt and pass on a majority. No network is required; the capability rubric is
judged by reading the output against the bullets.
