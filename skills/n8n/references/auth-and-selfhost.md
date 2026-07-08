# n8n auth, self-host vs cloud, and pointing n8n-mcp

## Get an API key

1. In n8n, open **Settings → n8n API**.
2. **Create an API key.** Prefer a **scoped** key — pick only the resource scopes the automation needs
   (e.g. `workflow:read`, `workflow:create`, `workflow:execute`, `execution:read`). An unscoped key can
   do everything the user can, including delete.
3. Copy it once (it is shown once) and store it as `N8N_API_KEY`. Rotate by deleting + recreating.

Every REST call carries it as a header: `X-N8N-API-KEY: <key>`. It is NOT a bearer token and NOT in
the query string.

```bash
export N8N_API_KEY="n8n_api_..."
export N8N_API_URL="https://your-instance.app.n8n.cloud"   # host root; append /api/v1 for REST
```

## Self-host vs cloud — what actually differs

| | Self-host | Cloud (`*.app.n8n.cloud`) |
|---|---|---|
| API base | `{host}/api/v1` (e.g. `http://localhost:5678/api/v1`) | `https://<tenant>.app.n8n.cloud/api/v1` |
| API surface | **identical** | **identical** |
| Interactive Swagger | **Yes** at `/api/v1/docs` | **No** — work from docs.n8n.io |
| Where data lives | your infra | n8n's | 
| Enabling the API | on by default; can be toggled via `N8N_PUBLIC_API_DISABLED=true` | always on |
| Base URL override | `WEBHOOK_URL` / `N8N_HOST`/`N8N_PROTOCOL`/`N8N_PORT` shape the host + webhook URLs | fixed |

The only thing that changes between environments is the host and (self-host) the Swagger page.
Scripts written against one work against the other by swapping `N8N_API_URL`.

Webhook URLs on self-host derive from `WEBHOOK_URL` (or host/protocol/port). If your production webhook
URLs look wrong (localhost behind a proxy), that env var is usually why.

## Pointing n8n-mcp at your instance

`n8n-mcp` reads the **same two env vars** for its management tier:

```bash
N8N_API_URL=https://your-instance.app.n8n.cloud
N8N_API_KEY=n8n_api_...
```

Ways to run it:

- **Hosted** — `dashboard.n8n-mcp.com`: add an instance (URL + key), get an MCP endpoint. Fastest trial;
  free tier caps daily tool calls.
- **Local (npx)** — run the `n8n-mcp` package and register it in your MCP client's config
  (Claude Code / Claude Desktop / Cursor / Windsurf), passing the two env vars.
- **Docker** — the repo ships an image; inject the env vars.

Node-knowledge tools work with **no** auth; only the management tools need the two vars. Confirm the
link with `n8n_health_check` — it reports reachability and which features (e.g. the `/execute`
endpoint) the target instance supports.

## Governance quick-set

- **Scope the key** at creation (least privilege) — see above.
- **`DISABLED_TOOLS`** on n8n-mcp to gate destructive tools — see `n8n-mcp-tools.md`.
- **Never** commit `N8N_API_KEY` or inline node-credential secrets in a workflow payload; reference
  credentials from the n8n credential store by id/name.
