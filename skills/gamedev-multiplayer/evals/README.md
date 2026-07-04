# Eval harness — `gamedev-multiplayer` skill

`cases.yaml` is a human/CI-readable trigger-and-capability spec, not an automated runner. Load the full
skill-catalog descriptions into a routing agent and, for each `should_trigger` prompt, confirm this skill
fires (including the near-miss phrasings that never say "netcode"); for each `should_not_trigger` prompt,
confirm it stays silent and that whatever does fire matches the stated `route_to` sibling (godot, deployment,
gamedev-physics, webhooks, secure-coding). Because LLM routing is non-deterministic, run several trials and
take the majority. For the `capability` scenario, run it once with the skill body unavailable and once with
`SKILL.md` + references loaded, then check each output against `must_include` — the with-skill answer must
use current APIs (ENetMultiplayerPeer, `@rpc("any_peer", …)`, `is_server()` authority gate, no Godot 3.x
`master`/`puppet`/`rset`) and clearly beat the baseline. Keep `cases.yaml` in sync with SKILL.md's
"Fires on / When NOT" whenever scope changes.
