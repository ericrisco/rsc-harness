# Evals: typescript

`cases.yaml` checks two things. **Routing**: `should_trigger` lists prompts (including
non-obvious narrowing symptoms and Spanish/Catalan phrasings) that must select this skill, and
`should_not_trigger` lists adjacent prompts that must route to a named sibling (`nodejs`,
`react`, `drizzle-orm`, `python`, `testing-web`) instead. **Capability**: the scenario gives a
loosely-typed module with no tsconfig and grades the output against the `must_include` rubric
(any -> precise types, discriminated union with a literal discriminant, exhaustive `never`
guard, a strict tsconfig valid on TypeScript 7, `import type` usage, no error-silencing casts).

To run, feed each prompt to the skill router and confirm the trigger/route decision, then run
the capability scenario through an agent loaded with this skill and score the result by hand
against the rubric. There is no automated runner here; the rigor is the rubric plus
`scripts/verify.sh`, which runs TypeScript 7 `tsc` and independently proves the toolchain
enforces strictness, exhaustiveness and unchecked-index safety on sample files.
