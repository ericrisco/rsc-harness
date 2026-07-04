# Eval harness — `gamedev-pathing` skill

`cases.yaml` is a human/CI-readable trigger-and-capability spec, not an automated runner. It asserts two
things. **Triggering**: the skill fires on real navigation asks — engine-specific ("enemies stuck in
Godot 4", "Unreal navmesh won't see a spawned crate"), representation/algorithm theory (A* heuristics,
grid vs navmesh), crowd/avoidance ("units dance and pile up"), and a Catalan off-mesh-link phrasing — and
stays quiet on near-misses that route to `gamedev-physics` (collision response), `game-design` (what the
AI decides), `unity` (lightmap baking — the "bake" false friend), `godot` (animation state machine), and
`gamedev-multiplayer` (netcode). **Capability**: with `SKILL.md` + references loaded, the answer uses
the current Godot 4.x API (`target_position`, `get_next_path_position`, `velocity_computed` — never the
Godot-3 names), separates global pathfinding from per-frame steering, and reaches for a flow field for
many-agents-to-one-goal. Run 3–5 trials per prompt (LLM routing is non-deterministic); a prompt passes on
a majority. Judge `capability` by reading the output against `must_include`; the with-skill answer should
clearly beat a no-skill baseline.
