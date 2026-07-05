# Eval harness — `unreal` skill

These cases are run by the rsc skill-eval harness (a Claude agent with the full catalog loaded)
or read manually. **Triggering**: the `unreal` description must fire on real UE5 Blueprint/C++
requests — including symptom-only ones (a garbage-collected UObject) — while staying quiet on
near-misses that belong to `godot`, `unity`, `cpp`, `game-design`, or `gamedev-shipping`, routing
each to that sibling. **Capability**: with `SKILL.md` + references loaded, the generated UE5 code
must satisfy the `must_include` rubric — Enhanced Input (never legacy mappings), GC-safe
`UPROPERTY() TObjectPtr<T>` refs, `GENERATED_BODY()`, no logic in the constructor, correct
Blueprint exposure, a dynamic multicast delegate, and the right `.Build.cs` module — and beat the
no-skill baseline. Run 3–5 trials per prompt (LLM routing is non-deterministic); a prompt passes
on a majority.
