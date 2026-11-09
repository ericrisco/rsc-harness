# Eval harness — `rust` skill

`cases.yaml` is a human/CI-readable trigger-and-capability spec, not an automated runner. To exercise
it, load the full skill catalog descriptions into a routing agent and, for each `should_trigger` prompt,
check that the `rust` skill fires; for each `should_not_trigger` prompt, check that it stays silent and
that any skill that does fire matches the stated `route_to` sibling (security-audit, deployment,
postgresdb, tauri, go). Because LLM routing is non-deterministic, run a few trials per prompt and take
the majority. For the `capability` scenario, run it once with the skill body unavailable and once with
`rust/SKILL.md` (plus references) loaded, then eyeball each output against the `must_include` rubric —
the with-skill answer should cover the rubric and clearly beat the baseline (a `thiserror` enum mapped
via `IntoResponse`, a `$1` bind parameter, `?` propagation with no `.unwrap()` on the request path).
Keep `cases.yaml` faithful to SKILL.md's "When to use / When NOT to use" whenever scope changes.
