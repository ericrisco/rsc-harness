# n8n-mcp — tool reference & governance

`n8n-mcp` (github.com/czlonkowski/n8n-mcp, ~22k★, the de-facto community standard) is an MCP server
that gives an agent two things: **offline knowledge** of n8n's node/expression catalogue, and
**management** of a live instance via its REST API. Distinct from n8n's own first-party built-in MCP
node, which lets a *workflow* act as an MCP server/client — that is not this.

Tool names and counts move; **verify against the running server's tool list** (or
`dashboard.n8n-mcp.com` / the repo docs) before relying on any one name.

## Two tiers, two auth requirements

| Tier | Needs auth? | Purpose |
|---|---|---|
| **Node-knowledge tools** | **No** | Search/describe nodes, get property essentials, validate a node's config, browse templates — all offline. Safe to expose broadly. |
| **Management tools** | **Yes** — `N8N_API_URL` + `N8N_API_KEY` | CRUD/validate/test/run/inspect a real instance. These are the ones governance applies to. |

Set the same two env vars the REST API uses:

```bash
N8N_API_URL=https://your-instance.app.n8n.cloud   # host root, whole value
N8N_API_KEY=n8n_api_...
```

Without them the server still runs — you just get the node-knowledge tier only.

## Node-knowledge tools (no auth)

- `search_nodes`, `list_nodes`, `list_ai_tools` — find the right node.
- `get_node_essentials`, `get_node_info`, `get_node_documentation` — properties & docs for a node type.
- `validate_node_operation`, `validate_node_minimal` — check a single node's config before you wire it.
- `search_templates`, `get_template` — reuse community workflow templates.

Use these to author node JSON correctly instead of guessing `typeVersion`/property shapes.

## Management tools (need `N8N_API_URL` + `N8N_API_KEY`)

| Tool | Does |
|---|---|
| `n8n_create_workflow` | Create from a full workflow object. |
| `n8n_get_workflow` | Fetch one workflow (export before delete/replace). |
| `n8n_list_workflows` | List/filter workflows. |
| `n8n_update_full_workflow` | Replace the whole workflow (like REST `PUT`). |
| `n8n_update_partial_workflow` | **Atomic ordered batch of targeted edits** — if any op fails, nothing is saved. Prefer this for edits. |
| `n8n_delete_workflow` | **Hard delete.** Export first. |
| `n8n_validate_workflow` | Structural/connection/expression validation of a workflow object. |
| `n8n_autofix_workflow` | Repair common errors and return fixed JSON. |
| `n8n_test_workflow` | Trigger a run for testing. |
| `n8n_executions` | List/inspect execution runs. |
| `n8n_workflow_versions` | Version history of a workflow. |
| `n8n_deploy_template` | Deploy a catalogue template to the instance. |
| `n8n_manage_credentials` | Create/manage credentials (secrets not readable back). |
| `n8n_manage_datatable` | Manage n8n data tables. |
| `n8n_health_check` | Confirm API reachability + which features the instance supports. |
| `n8n_audit_instance` | Security audit (built-in audit API + deep workflow scan). |

**Note on activate/deactivate:** n8n-mcp intentionally does not surface these as tools (activation has
live side effects). Flip a workflow live with the REST `POST /workflows/{id}/activate` endpoint (see
`rest-api-cheatsheet.md`) or the UI. Verify the current tool list in case this changes.

## Governance — `DISABLED_TOOLS`

For agent-facing deployments, disable destructive/write tools with a comma-separated env var:

```bash
# read-only agent: no create/replace/delete/autofix/test/template/credential/datatable writes
DISABLED_TOOLS=n8n_create_workflow,n8n_update_full_workflow,n8n_update_partial_workflow,n8n_delete_workflow,n8n_autofix_workflow,n8n_deploy_template,n8n_test_workflow,n8n_manage_credentials,n8n_manage_datatable
```

Layer it with a **scoped API key** (grant only `workflow:read`/`execution:read` for a monitoring
agent) so a disabled tool can't be worked around and the key itself can't mutate. Two independent
locks: the tool gate and the key scope.

## Sketch: agent-driven deploy

```
search_nodes / get_node_essentials     → get the exact node property shapes
n8n_validate_workflow { workflow }      → catch structural errors offline
n8n_autofix_workflow  { workflow }      → auto-repair, re-validate
n8n_create_workflow   { name, nodes, connections, settings }  → capture returned id
n8n_test_workflow     { id }            → confirm it runs
# then activate via REST /workflows/{id}/activate (no MCP tool for it)
n8n_executions        { workflowId: id } → confirm the live run
```
