# Eval harness — `gamedev-shaders` skill

These cases are run by the rsc skill-eval harness (a Claude agent with the full catalog loaded),
or read manually. They assert two things: **triggering** — the description fires on shader /
material / VFX / post-process / "how do I make X effect" prompts (including Spanish and
symptom-only phrasings like "slow on mobile") and stays quiet on near-misses, routing each to the
right sibling (`godot`/`unity`/`unreal` for gameplay-or-setup, `gamedev-physics` for simulation,
`gamedev-shipping` for variant stripping, `sql` for the false-friend "optimize"); and
**capability** — that with `SKILL.md` and its references loaded, the generated Godot 4 dissolve
shader satisfies the rubric (valid `shader_type`, `discard` against an animatable threshold, an
emissive `smoothstep` edge, `source_color` hints, no removed `SCREEN_TEXTURE`/`hint_color` APIs,
code-driven animation, and an overdraw note). Run 3–5 trials per prompt since routing is
non-deterministic; a prompt passes on a majority. No network needed — the capability rubric is
judged by reading the output against the points.
