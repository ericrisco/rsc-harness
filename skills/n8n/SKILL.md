---
name: n8n
description: "Use when operating a live n8n instance programmatically — driving its public REST API (`{host}/api/v1`, `X-N8N-API-KEY`) or the n8n-mcp server to create, validate, test, activate/deactivate, list, update, or delete workflows and read executions, on self-host or `*.app.n8n.cloud`. Triggers: 'deploy this workflow to my n8n over the API', 'push my workflow JSON to n8n with curl', 'I set active:true in the create call but it stays inactive', 'connect n8n-mcp / n8n_create_workflow to Claude', 'validate and autofix my n8n workflow', 'run an n8n workflow by id from a script', 'delete a workflow via the API', 'automatiza n8n por API', 'desplega el workflow a n8n.cloud'. NOT designing the flow's trigger-step-error logic or hand-building the importable workflow JSON (that is automation-flows), NOT operating Make / Zapier / Power Automate (their own skills), NOT a typed API client with auth+pagination+retry (api-connector-builder), NOT the inbound webhook receiver in your own app (webhooks)."
tags: [n8n, automation, workflows, mcp, rest-api, no-code, integrations]
recommends: [automation-flows, automation-strategy, api-connector-builder, webhooks]
profiles: [full]
origin: risco
---

# n8n — operate a live instance over its REST API and MCP

You already have a workflow *design* (the trigger→steps→error shape and the importable JSON).
This skill is the **operate** half: push that JSON into a running n8n, validate it, test it, flip it
live, watch its executions, and tear it down safely — all without touching the UI. n8n has the
richest programmatic story of the no-code platforms: a first-party REST API **plus** a mature MCP
server, both hitting the same instance.

Designing the flow itself (what fires it, how errors are handled, dedup) is **automation-flows** —
this skill *consumes* that skill's `references/n8n-workflow-json.md` payload; it does not re-teach
design.

## Connect first — REST API vs MCP

Two ways to drive the same instance. Pick by who is at the wheel.

| | **Public REST API** | **n8n-mcp** (czlonkowski, de-facto standard) |
|---|---|---|
| What it is | n8n's own HTTP API at `{host}/api/v1` | MCP server wrapping that API **+** offline node/expression knowledge |
| Best for | scripts, CI/CD, deterministic deploys, no extra dependency | an agent (Claude) building/fixing workflows in the loop — it can look up node schemas, then validate/autofix before it writes |
| Auth | API key in header `X-N8N-API-KEY` | management tools need `N8N_API_URL` + `N8N_API_KEY`; **node-knowledge tools need no auth** |
| Surface | identical on self-host **and** `*.app.n8n.cloud` | same underlying API; hosted trial at `dashboard.n8n-mcp.com` |

**Version reality (verify at author time — n8n moves fast):**
- API base is `{host}/api/v1`. Self-host ships interactive Swagger at `/api/v1/docs`; **cloud does not**.
- `POST /workflows/{id}/execute` (run-by-id) is **recent** (n8n PR #20234). Older instances lack it —
  there, the only programmatic run is POSTing to a Webhook node's URL. It also takes **no custom input**.
- The API surface is the SAME whether you self-host or run on `*.app.n8n.cloud`; only the host differs.

### `.env`

```bash
# host root only — you append /api/v1 for REST; n8n-mcp reads it whole
N8N_API_URL=https://your-instance.app.n8n.cloud   # or N8N_HOST for self-host, e.g. http://localhost:5678
N8N_API_KEY=n8n_api_...                            # Settings → n8n API → Create an API key
```

Never inline the key in a command that gets logged, and never put a *node* credential (Slack token,
etc.) in the workflow payload — reference it by the n8n **credential store** id/name (see
automation-flows' JSON schema). Full key-creation + self-host vs cloud + MCP install:
`references/auth-and-selfhost.md`.

## The payload you POST

The create/update body is exactly the automation-flows workflow JSON. Required top-level keys on
**create**: `name`, `nodes`, `connections`, `settings`. Build it per
`../automation-flows/references/n8n-workflow-json.md` — non-empty `nodes` with one trigger, a wired
`connections` map, `settings.errorWorkflow`, credentials referenced by store (never inlined).

**Node/expression essentials** (pointer, not a tutorial): node `type` is namespaced
(`n8n-nodes-base.webhook`), `typeVersion` must match a node version installed on the target instance
or activation/execution fails; field values use expressions like `={{ $json.email }}` or
`={{ $node["Webhook"].json.body.id }}`. If you are hand-authoring nodes, let n8n-mcp's node-knowledge
tools (`search_nodes`, `get_node_essentials`, `validate_node_operation`) fill in the exact property
shapes rather than guessing — that is the single biggest reason to drive via MCP.

## Dynamic lifecycle

create → **validate** → test → **activate** → manage → delete. A concrete sketch per step, curl and
n8n-mcp side by side.

### 1. Validate (do this BEFORE create)

REST has no validation endpoint — n8n only tells you at create/activate time. MCP does, so validate
first when it is available:

```
n8n_validate_workflow   { "workflow": { …the full JSON… } }
n8n_autofix_workflow    { "workflow": { … } }   # repairs common structural errors, returns fixed JSON
```

### 2. Create

```bash
curl -sS -X POST "$N8N_API_URL/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  -d @workflow.json          # body = { name, nodes, connections, settings }
# → returns the created workflow WITH its "id" — capture it for every step below
```
```
n8n_create_workflow     { "name": "...", "nodes": [ … ], "connections": { … }, "settings": { … } }
```

### 3. Test / dry-run

- **No input needed** → run by id (recent instances only): `POST /workflows/{id}/execute`.
- **Needs input** → the execute endpoint accepts none. Make the trigger a **Webhook node** and POST to
  its URL (test URL `/webhook-test/<path>` while "Listen for test event" is armed; production
  `/webhook/<path>` once active).

```bash
curl -sS -X POST "$N8N_API_URL/api/v1/workflows/$ID/execute" -H "X-N8N-API-KEY: $N8N_API_KEY"
curl -sS -X POST "$N8N_HOST/webhook-test/my-path" -H "Content-Type: application/json" -d '{"foo":"bar"}'
```
```
n8n_test_workflow       { "id": "$ID" }
```

### 4. Activate — the step people miss

`active` in the create/update body is **read-only and silently ignored**. Setting `"active": true`
does nothing. You MUST call the separate endpoint:

```bash
curl -sS -X POST "$N8N_API_URL/api/v1/workflows/$ID/activate"   -H "X-N8N-API-KEY: $N8N_API_KEY"
curl -sS -X POST "$N8N_API_URL/api/v1/workflows/$ID/deactivate" -H "X-N8N-API-KEY: $N8N_API_KEY"
```
n8n-mcp deliberately does not expose activate/deactivate as tools (activation has live side effects).
Check the current tool list; if absent, call the REST `/activate` endpoint as above.

### 5. Manage

```bash
curl -sS "$N8N_API_URL/api/v1/workflows?limit=50"      -H "X-N8N-API-KEY: $N8N_API_KEY"  # list (paginate via nextCursor)
curl -sS "$N8N_API_URL/api/v1/workflows/$ID"           -H "X-N8N-API-KEY: $N8N_API_KEY"  # get
curl -sS -X PUT "$N8N_API_URL/api/v1/workflows/$ID"    -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" -d @workflow.json                                  # FULL replace
curl -sS "$N8N_API_URL/api/v1/executions?workflowId=$ID&limit=20" -H "X-N8N-API-KEY: $N8N_API_KEY"
```
```
n8n_list_workflows {}        n8n_get_workflow { "id": "$ID" }        n8n_executions { "workflowId": "$ID" }
n8n_update_full_workflow    { "id": "$ID", "nodes": [ … ], "connections": { … } }   # replace everything
n8n_update_partial_workflow { "id": "$ID", "operations": [ … ] }                    # atomic diff — preferred
n8n_health_check {}          # confirm API reachable + which features the instance supports
```
`PUT` is a **full replace** — GET, mutate the whole object, PUT it back, or you drop the nodes you
omitted. n8n-mcp's `n8n_update_partial_workflow` applies a targeted, atomic batch instead (safer).

### 6. Delete — irreversible

`DELETE` is a **hard delete: no trash, no undo.** Export the current JSON first, every time.

```bash
curl -sS "$N8N_API_URL/api/v1/workflows/$ID" -H "X-N8N-API-KEY: $N8N_API_KEY" > backup-$ID.json  # export FIRST
curl -sS -X DELETE "$N8N_API_URL/api/v1/workflows/$ID" -H "X-N8N-API-KEY: $N8N_API_KEY"
```
```
n8n_get_workflow { "id": "$ID" }   →  save output  →  n8n_delete_workflow { "id": "$ID" }
```

**Irreversibility rule:** never DELETE (or full-replace) a live workflow without exporting it first.

## Governance

If you expose n8n-mcp to an agent, lock down destructive tools with the `DISABLED_TOOLS` env var
(comma-separated), e.g. `DISABLED_TOOLS=n8n_delete_workflow,n8n_update_full_workflow`. Scope the API
key itself too — n8n supports scoped keys (e.g. grant `workflow:read` without `workflow:execute`).
Details in `references/n8n-mcp-tools.md`.

## Honesty / gotchas

- **`active` and `tags` are read-only on create/update** — ignored in the body; activate/tag via the
  dedicated endpoints. This is the #1 "why is my workflow inactive" bug.
- **`/workflows/{id}/execute` takes no custom input** — for runtime params, trigger a Webhook workflow
  by POSTing to its URL. Also, it is a newer endpoint; older instances 404 it.
- **`DELETE` and `PUT` are destructive** — hard delete (no trash) and full replace. Export first; prefer
  `n8n_update_partial_workflow` for edits.
- **`typeVersion` must exist on the target** — a node version the instance doesn't have fails only at
  activate/execute time, not at create. Validate (MCP) or test before activating.
- **Credential secrets are not fully manageable over the public API** — you can reference existing
  credentials by id/name and create some, but you cannot read secrets back; provision credentials in
  the UI / n8n-mcp `n8n_manage_credentials` and reference them.
- **Cloud has no Swagger** — `/api/v1/docs` is self-host only; on cloud, work from the docs.
- **Activation can succeed via API where the UI would block it** — the public API historically skips a
  few UI-side activation validations, so a workflow can be "active" yet non-functional. Test it live.

## Related skills

- **automation-flows** — *design* the flow and produce the importable JSON this skill deploys. Design
  vs operate boundary: they decide the trigger/steps/error path; you push it live. Start there if the
  flow's logic isn't settled yet.
- **automation-strategy** — whether n8n is even the right platform (cost model, self-host vs cloud) vs
  Make/Zapier/Power Automate.
- **make / zapier / power-automate** — the other platforms' operate stories (Zapier and Power Automate
  can't create flows via API — n8n's edge).
- **api-connector-builder** — a generic typed HTTP client with auth/pagination/backoff, when the answer
  is real code, not a workflow.
- **webhooks** — building the inbound receiver *in your own app*; here webhooks are just n8n triggers.

## Checklist

- [ ] `.env` has `N8N_API_URL`/`N8N_HOST` + `N8N_API_KEY` (key from Settings → n8n API); key not logged.
- [ ] Payload has `name`, `nodes` (one trigger), `connections`, `settings` per automation-flows' schema;
      node credentials referenced by store, never inlined.
- [ ] Validated (`n8n_validate_workflow` / `n8n_autofix_workflow`) before create when MCP is available.
- [ ] Created via `POST /workflows` or `n8n_create_workflow`; captured the returned `id`.
- [ ] Tested — `execute`-by-id (no input) or POST to the webhook URL (with input) — and the run succeeded.
- [ ] Activated via `POST /workflows/{id}/activate` (NOT `active:true` in the body).
- [ ] Before any DELETE or full-replace: exported the current JSON (hard delete, no trash).
- [ ] If MCP is exposed to an agent: `DISABLED_TOOLS` set and/or the API key scoped.

## References

- `references/rest-api-cheatsheet.md` — every workflow/execution endpoint with curl, pagination, scopes.
- `references/n8n-mcp-tools.md` — the management + node-knowledge tool list, the auth split, `DISABLED_TOOLS`.
- `references/auth-and-selfhost.md` — API-key creation, self-host vs cloud, Swagger, installing/pointing n8n-mcp.
