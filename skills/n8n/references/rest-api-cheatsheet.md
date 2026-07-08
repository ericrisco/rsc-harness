# n8n public REST API — cheat sheet

Base URL: `{host}/api/v1`. Auth header on every call: `X-N8N-API-KEY: $N8N_API_KEY`.
Same surface on self-host and `*.app.n8n.cloud`. Self-host has interactive Swagger at
`{host}/api/v1/docs`; cloud does not. Verify shapes at author time — n8n ships often.

Set once:

```bash
export N8N_API_URL="https://your-instance.app.n8n.cloud"   # or http://localhost:5678
export N8N_API_KEY="n8n_api_..."
auth=(-H "X-N8N-API-KEY: $N8N_API_KEY")
```

## Workflows

| Verb & path | What it does | Notes |
|---|---|---|
| `POST /workflows` | Create | Body needs `name, nodes, connections, settings`. `active` + `tags` in the body are **ignored** (read-only). Returns the new object incl. `id`. |
| `GET /workflows/{id}` | Get one | The full exportable JSON. Use to back up before delete/replace. |
| `GET /workflows` | List | Query: `limit` (default ~100), `cursor`, `active=true|false`, `tags`, `name`, `projectId`. Paginate with the returned `nextCursor`. |
| `PUT /workflows/{id}` | **Full replace** | Send the WHOLE object; omitted fields are dropped. GET → mutate → PUT. |
| `DELETE /workflows/{id}` | **Hard delete** | No trash, no undo. Export first. |
| `POST /workflows/{id}/activate` | Activate | The ONLY way to go live — the body `active` flag never does it. |
| `POST /workflows/{id}/deactivate` | Deactivate | Same, in reverse. |
| `POST /workflows/{id}/execute` | Run by id | **Recent (PR #20234); older instances 404.** Runs `executeManually`; **accepts no custom input** — needs `workflow:execute` scope. |
| `PUT /workflows/{id}/tags` | Set tags | Tags are managed here, not in the create/update body. |
| `PUT /workflows/{id}/transfer` | Move to a project | Enterprise/projects. |

```bash
curl -sS -X POST "$N8N_API_URL/api/v1/workflows" "${auth[@]}" \
  -H "Content-Type: application/json" -d @workflow.json
curl -sS "$N8N_API_URL/api/v1/workflows?limit=50&active=true" "${auth[@]}"
curl -sS "$N8N_API_URL/api/v1/workflows/$ID" "${auth[@]}" > backup-$ID.json
curl -sS -X POST "$N8N_API_URL/api/v1/workflows/$ID/activate" "${auth[@]}"
curl -sS -X POST "$N8N_API_URL/api/v1/workflows/$ID/execute"  "${auth[@]}"
curl -sS -X DELETE "$N8N_API_URL/api/v1/workflows/$ID" "${auth[@]}"
```

Paginate:

```bash
cursor=""
while :; do
  page=$(curl -sS "$N8N_API_URL/api/v1/workflows?limit=100&cursor=$cursor" "${auth[@]}")
  echo "$page" | jq -r '.data[].id'
  cursor=$(echo "$page" | jq -r '.nextCursor // empty')
  [ -z "$cursor" ] && break
done
```

## Executions

| Verb & path | What it does |
|---|---|
| `GET /executions` | List runs. Query: `workflowId`, `status` (`success|error|waiting`), `limit`, `cursor`, `includeData=true`. |
| `GET /executions/{id}` | One run; `?includeData=true` for the full item data. |
| `DELETE /executions/{id}` | Delete a run's stored data. |

```bash
curl -sS "$N8N_API_URL/api/v1/executions?workflowId=$ID&status=error&limit=20" "${auth[@]}"
```

## Triggering a run WITH input

`/execute` takes no body data. To pass runtime params, the workflow's trigger must be a **Webhook**
node; POST to its URL:

- Test URL (only while the editor's "Listen for test event" is armed): `{host}/webhook-test/<path>`
- Production URL (only once the workflow is active): `{host}/webhook/<path>`

```bash
curl -sS -X POST "$N8N_HOST/webhook/my-path" -H "Content-Type: application/json" -d '{"orderId":123}'
```

## Other resources

- `GET/POST/DELETE /credentials` — create/delete credentials and `GET /credentials/schema/{type}` for
  the field shape. **You cannot read secrets back.** Reference existing creds from a workflow by id/name.
- `GET/POST/PUT/DELETE /tags`, `/projects`, `/variables`, `/users` (admin), `/source-control/pull`,
  `/audit` (instance security audit).

## API-key scopes (least privilege)

Create a **scoped** key in Settings → n8n API. Scopes are grouped by resource, e.g. `workflow:read`,
`workflow:create`, `workflow:update`, `workflow:delete`, `workflow:execute`, `execution:read`,
`credential:create`, `tag:*`. Grant only what a given automation needs — e.g. a read-only dashboard
key gets `workflow:read` + `execution:read` and nothing that can mutate or run.

## Error responses

`401` bad/missing key · `403` key lacks the scope · `404` no such id (or `/execute` on an instance
too old to have it) · `400` malformed body (e.g. missing `connections`) · `500` server-side (often a
node the instance doesn't have installed).
