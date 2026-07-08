# Evals — power-automate

`cases.yaml` has three groups. `should_trigger` covers the programmatic operate cases: create+enable
via the Dataverse Web API, the My-Flows honesty question, enable-via-statecode, a Spanish
solution-aware CI deploy, FlowStudio-MCP run debugging, and a clientdata update. `should_not_trigger`
lists adjacent prompts owned by a named sibling — flow *design*/definition (automation-flows),
platform selection by billing (automation-strategy), generic typed-client engineering
(api-connector-builder), the inbound webhook receiver (webhooks), and direct Microsoft Graph
scripting (api-connector-builder, no first-party MS-Graph skill). `capability` is one end-to-end
lifecycle scenario whose `must_include` rubric checks the concrete API calls (token, POST, PATCH
statecode, DELETE), the string-encoded `clientdata`, the My-Flows/`api.flow.microsoft.com` honesty
limits, the ExportSolution-before-DELETE irreversibility rule, and the third-party FlowStudio-MCP
flag.

No automated runner. Score by judgement: feed each `should_trigger` / `should_not_trigger` prompt to
the routing layer and confirm it activates (or routes to the listed sibling); for `capability`, have
the skill produce the lifecycle walkthrough and check every `must_include` bullet by hand.
