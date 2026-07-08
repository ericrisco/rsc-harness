# Evals — make

`cases.yaml` holds three groups scored by an LLM judge against the rendered
skill. `should_trigger` confirms Make owns programmatic/MCP operation of a
Make.com account (create/run/clone/activate/delete scenarios, the blueprint
round-trip, the zone trap). `should_not_trigger` confirms clean deferral to the
real siblings — `automation-flows` for flow design, `automation-strategy` for
platform choice, `n8n` for that platform, `api-connector-builder` for generic
clients, `webhooks` for inbound receivers. The `capability` case checks the body
carries the load-bearing facts: the zoned/case-sensitive API, the
string-not-object blueprint/scheduling, the round-trip, run-before-start,
export-before-delete irreversibility, frozen token scopes, and the Make MCP
tiers. Run via the repo's eval runner; treat a miss as a cue to sharpen the
description's triggers/boundary or fill a body gap.
