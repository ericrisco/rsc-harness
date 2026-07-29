---
name: n8n
description: "Use when operating a live n8n instance programmatically — its REST API (`{host}/api/v1`, `X-N8N-API-KEY`) or the n8n-mcp server — to create, validate, test, activate, update, delete workflows and read executions on self-host or n8n.cloud. NOT designing the flow or its importable JSON (that is `automation-flows`), NOT another platform (`make`, `zapier`)."
tags: [n8n, automation, workflows, mcp, rest-api, no-code, integrations]
recommends: [automation-flows, automation-strategy, api-connector-builder, webhooks]
profiles: [full]
origin: risco
---

# n8n — operate a live instance over its REST API and MCP

You already have a workflow *design* — the trigger→steps→error shape and the importable JSON, which is
`automation-flows`' job and this skill does not re-teach it. This skill is the **operate** half: push
that JSON into a running n8n, validate it, test it, flip it live, watch its executions, and tear it
down safely — all without touching the UI. n8n has the richest programmatic story of the no-code
platforms: a first-party REST API **plus** a mature MCP server, both hitting the same instance.

## Connect first — REST API vs MCP

Two ways to drive the same instance. Pick by who is at the wheel.

| | **Public REST API** | **n8n-mcp** (czlonkowski, de-facto standard) |
|---|---|---|
| What it is | n8n's own HTTP API at `{host}/api/v1` | MCP server wrapping that API **+** offline node/expression knowledge |
| Best for | scripts, CI/CD, deterministic deploys, no extra dependency | an agent (Claude) building/fixing workflows in the loop — it can look up node schemas, then validate/autofix before it writes |
| Auth | API key in header `X-N8N-API-KEY` | management tools need `N8N_API_URL` + `N8N_API_KEY`; **node-knowledge tools need no auth** |
| Surface | identical on self-host **and** `*.app.n8n.cloud` | same underlying API; hosted trial at `dashboard.n8n-mcp.com` |

**Version reality (verify at author time — n8n moves fast):**
- API base is `{host}/api/v1`. Self-host ships interactive Swagger at `/api/v1/docs`; **cloud does not**
  — on cloud, work from the docs.
- `POST /workflows/{id}/execute` (run-by-id) is **recent** (n8n PR #20234). Older instances lack it —
  there, the only programmatic run is POSTing to a Webhook node's URL.

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
n8n-mcp side by side; every endpoint with pagination and scopes is in
`references/rest-api-cheatsheet.md`.

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
curl -sS -X POST "$N8N_API_URL/webhook-test/my-path" -H "Content-Type: application/json" -d '{"foo":"bar"}'
```
```
n8n_test_workflow       { "id": "$ID" }
```

### 4. Activate — the step people miss

`active` (and `tags`) in the create/update body are **read-only and silently ignored**. Setting
`"active": true` does nothing, which is why the workflow you just created never fires. You MUST call
the separate endpoint:

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

`DELETE` is a **hard delete: no trash, no undo**, so export the current JSON first, every time — this
one is absolute because nothing downstream can recover the workflow if you skip it.

```bash
curl -sS "$N8N_API_URL/api/v1/workflows/$ID" -H "X-N8N-API-KEY: $N8N_API_KEY" > backup-$ID.json  # export FIRST
curl -sS -X DELETE "$N8N_API_URL/api/v1/workflows/$ID" -H "X-N8N-API-KEY: $N8N_API_KEY"
```
```
n8n_get_workflow { "id": "$ID" }   →  save output  →  n8n_delete_workflow { "id": "$ID" }
```

The same applies to a full replace: export before `PUT`.

## Governance

If you expose n8n-mcp to an agent, lock down destructive tools with the `DISABLED_TOOLS` env var
(comma-separated), e.g. `DISABLED_TOOLS=n8n_delete_workflow,n8n_update_full_workflow`. Scope the API
key itself too — n8n supports scoped keys (e.g. grant `workflow:read` without `workflow:execute`).
Details in `references/n8n-mcp-tools.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `"active": true` (or `tags`) in the create/update body | Read-only fields, silently ignored — the #1 "why is my workflow inactive" bug | `POST /workflows/{id}/activate`; set tags via their own endpoint |
| Passing runtime input to `/workflows/{id}/execute` | It accepts no custom input, and older instances 404 the endpoint entirely | Trigger a Webhook workflow by POSTing to its URL |
| `PUT` with a partial body, or `DELETE` on a live workflow | Full replace drops every node you omitted; delete is a hard delete with no trash | GET and export first; prefer `n8n_update_partial_workflow` for edits |
| A `typeVersion` the target instance doesn't have | Create succeeds; it fails only at activate/execute time | Validate via MCP, or test, before activating |
| Inlining node credential secrets, or expecting to read them back | Credentials are not fully manageable over the public API — it can create some, but never returns a secret | Provision in the UI or via `n8n_manage_credentials`, then reference existing credentials by id/name |
| Treating a successful API activation as proof it works | The public API historically skips a few UI-side activation validations, so a workflow can be "active" yet non-functional | Run it live after activating and check the execution |

## Route elsewhere

| If the ask is | Skill |
|---|---|
| Designing the flow (trigger/steps/error path, dedup) and producing the importable JSON | `automation-flows` — start there if the logic isn't settled |
| Whether n8n is the right platform at all — cost model, self-host vs cloud | `automation-strategy` |
| Operating a different platform | `make`, `zapier`, `power-automate` (neither Zapier nor Power Automate can create flows via API — n8n's edge) |
| A generic typed HTTP client with auth/pagination/backoff — real code, not a workflow | `api-connector-builder` |
| The inbound webhook receiver in your own app (here webhooks are only n8n triggers) | `webhooks` |
