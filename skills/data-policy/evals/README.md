# Evals — data-policy

These cases are read by a human or an LLM grader; there is no automated runner in
this repo. The `should_trigger` and `should_not_trigger` lists check routing
intuition — does the description fire on the right prompts (including the
non-obvious "fix retention in backups" and the Spanish phrasing) and defer to the
named sibling on near-misses like a public privacy notice (`gdpr-privacy`), DPA
clauses (`contracts`), SOC 2 readiness (`compliance`), encryption
(`security-audit`), or TTL migrations (`db-migrations`). The `capability` case is
graded by generating a real retention schedule for the scenario and checking it
against the `must_include` rubric by hand. To run: paste a prompt to the skill,
read the output, and confirm the rubric items are present. The `scripts/verify.sh`
lint can be pointed at any generated schedule/ROPA/consent file to mechanically
catch missing periods, vague-only periods, a missing disclaimer, and a
deletion-without-backups gap.
