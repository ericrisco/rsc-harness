# Eval harness — `java` skill

These are routing/trigger fixtures plus one capability rubric, not an automated CI harness.
`cases.yaml` is the fixture; this file is how to run it by hand or with a grader-agent.

**Triggering.** Load the full skill catalog so the routing layer sees every sibling
(spring-boot, kotlin-android, security-audit, deployment, postgresdb, go, python, harness, …).
Feed each `should_trigger.prompt` in a fresh session and confirm the agent invokes the `java`
skill; feed each `should_not_trigger.prompt` and confirm it does NOT fire `java` and instead
routes to the stated `route_to` sibling. LLM routing is non-deterministic, so run 3–5 trials
per prompt and pass on the majority; aim for ≥90% trigger accuracy. Watch the non-obvious case
("ThreadLocal disappears inside submitted tasks") — it should still fire `java` and land on
ScopedValue, and the Spanish case ("modela este dominio de pagos") should fire too.

**Capability.** Run the `capability.scenario` once without the skill body and once with
`java/SKILL.md` (plus `references/`) loaded, and grade each answer against the `must_include`
rubric (fraction of points present and correct). The skill earns its place only if the
with-skill answer clearly beats the baseline — chiefly: sealed interface + record cases (no
JavaBean), compact-constructor validation, an exhaustive `switch` with deconstruction and no
`default`, no instanceof ladder, a virtual-thread-per-task executor (not a pool), no `null`
returns, and a `pom.xml` pinned to `<release>25</release>`. Grading is judgment-based; a human
or grader-agent reads each rubric point against the output. Keep `cases.yaml` faithful to the
SKILL's "When to use / When NOT to use" — update both in the same change when scope shifts.
