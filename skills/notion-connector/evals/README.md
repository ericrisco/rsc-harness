# Evals — notion-connector

`cases.yaml` holds three things: `should_trigger` (prompts that must route into
this skill — including the non-obvious "`POST /v1/databases/:id/query` returns
404" post-2025-09-03 symptom and a Spanish phrasing), `should_not_trigger`
(prompts that belong to a named sibling — `api-connector-builder`, `webhooks`,
`automation-flows`, `spreadsheet-ops`, `security-audit` — marking the generic-REST,
inbound-event, orchestration, bulk-CSV, and secret-handling boundaries), and one
`capability` scenario with a `must_include` rubric. There is no live runner and
no Notion calls: route each trigger prompt through your skill-selection harness
and confirm it lands (or doesn't) as labelled, then have an agent produce code
for the capability scenario and hand-score it — every `must_include` line should
be present. To structurally check any connector the skill produces, run
`../scripts/verify.sh <file-or-dir>`; a clean rubric pass plus a clean verify run
is the bar.
