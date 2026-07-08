# Evals — automation-strategy

`cases.yaml` holds three groups. `should_trigger` covers the decisions this skill owns: whether to
automate (with the stability trap), four-way platform selection, ROI / build-vs-buy, fleet-health
"our automations keep breaking", ecosystem-fit selection, and TCO/over-automation post-mortems, with
Spanish phrasing. `should_not_trigger` lists adjacent prompts routed to the sibling that owns them —
concrete builds/artifacts → automation-flows, driving a live platform → the n8n/make skills, code
clients → api-connector-builder, webhook receipt → webhooks, secrets engineering → secure-coding.
`capability` is one end-to-end strategy scenario whose `must_include` rubric checks the §1 gate,
human-in-the-loop on the irreversible step, maintenance-inclusive payback, billing-unit + ecosystem
platform routing, the honest Zapier/Power-Automate API-creation limits, the orchestration guarantees,
and that it defers the build (no JSON/API code emitted here).

No automated runner. Score by judgement: feed each prompt to the routing layer and confirm it
activates or routes to the listed sibling; for `capability`, have the skill produce the strategy
recommendation and check every `must_include` item by hand.
