# Evals — n8n

`cases.yaml` has three groups. `should_trigger` covers the operate tasks this skill owns: deploying a
workflow JSON over the REST API, the read-only-`active` gotcha, wiring n8n-mcp management tools,
running a workflow by id, hard-delete safety, and validate/autofix — with a Spanish phrasing. Each
`should_not_trigger` names a real sibling: flow design + importable JSON → automation-flows,
platform/cost choice → automation-strategy, another platform → make, a typed code client →
api-connector-builder, an in-app inbound receiver → webhooks. `capability` is one end-to-end deploy
scenario whose `must_include` rubric pins the current API/MCP calls, the honesty limits (read-only
`active`, no-input `execute`), and the irreversibility rule (export before hard delete).

No automated runner. Score by judgement: feed each `should_trigger`/`should_not_trigger` prompt to the
routing layer and confirm it activates or routes to the listed sibling; for `capability`, have the
skill produce the deploy plan/commands and check every `must_include` bullet by hand.
