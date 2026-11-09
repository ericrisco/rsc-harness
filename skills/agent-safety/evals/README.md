# Evals: agent-safety

These cases are the trigger contract and capability rubric for the `agent-safety` skill.
`should_trigger` and `should_not_trigger` assert that the description routes correctly —
each negative names the real sibling it should route to instead (building-agents,
security-audit, agent-eval, prompt-engineering, cost-tracking). Run them through the repo's
eval harness if one is wired up, or read them directly as the routing spec when reviewing
the description. The `capability` block is not a pass/fail script: it is a rubric a human or
an LLM-as-judge scores a sample guardrail design against — the design must cover every
`must_include` item (deny-by-default tools, untrusted-content mediation, HITL on
irreversible actions, memory hygiene, runtime caps) and map them to the OWASP Agentic Top
10. This is a process/review skill, so there is no `verify.sh`; rigor lives in this eval.
