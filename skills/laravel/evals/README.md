# Evals: laravel

`cases.yaml` is read by the skills harness/eval runner, not an automated PHP test suite.
`should_trigger` and `should_not_trigger` gauge whether the SKILL.md `description` routes
correctly — a model reading only the frontmatter should fire on the trigger prompts (including
the non-obvious "where did Kernel.php go" and "my job runs inline in tests" cases and the
Spanish/Catalan phrasings) and defer the negatives to the named sibling (`php`, `api-design`,
`security-audit`, `testing-web`, `mysql`). The single `capability` case gauges body coverage:
run the scenario and check the response against the `must_include` rubric by hand. Nothing here
spins up Laravel or runs Pest — that is what `scripts/verify.sh` does against a real project.
