# Evals — spring-boot

These cases are LLM-graded routing and capability checks, not a runtime test harness. Run them
through the repo's eval runner against this skill's `description` + body. `should_trigger`
asserts the router selects `spring-boot` (including the non-obvious symptom prompts like the
`@Transactional` rollback and `LazyInitializationException` cases and the Spanish/Catalan
phrasings); `should_not_trigger` asserts it prefers the named sibling instead (`java`,
`fastapi`, `postgresdb`, `deployment`, `security-audit`). The `capability` case is graded by
checking the produced solution against the `must_include` rubric — each bullet is a modern
Boot 4 idiom that must appear (and the corresponding legacy idiom must be absent). There is no
compilation step here; `scripts/verify.sh` is the static lint that complements these grades.
