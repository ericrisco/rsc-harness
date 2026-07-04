# Eval harness — `gamedev-physics` skill

These cases are read by the rsc skill-eval harness (a Claude agent with the full catalog loaded), or
by hand. They check two things. **Triggering:** the description fires on real physics symptoms —
tunneling, jitter, layer/mask filtering, forces-vs-impulses, character controllers — and stays quiet
on near-misses, routing shader shimmer to `gamedev-shaders`, navmesh/pathfinding to
`gamedev-pathing`, editor/export setup to `godot`, netcode to `gamedev-multiplayer`, and gameplay
design to `game-design`. **Capability:** with `SKILL.md` and its references loaded, the answer uses
the version-correct API (Godot 4 `move_and_slide()` with no args, Unity 6 `linearVelocity`, UE5
Chaos), puts simulation in the fixed tick, scales delta correctly, and picks the right body type /
collider / layer-mask / CCD fix. Routing is non-deterministic — run 3–5 trials per prompt and pass
on a majority; capability is judged by reading the output against the `must_include` bullets.
