# Make MCP server & auth setup

The Make MCP server exposes your Make account to an MCP client (Claude, Cursor,
ChatGPT, or any MCP-capable agent) so it can run — and, on paid plans, manage —
scenarios as tools. It is **GA and free on every plan**; you pay only the normal
scenario **credits** each run consumes. Verify specifics at
[developers.make.com/mcp-server](https://developers.make.com/mcp-server) at
author time — tool names and transports move.

## Transports

Two ways to authenticate the connection:

### OAuth (remote, recommended for end users)

Point the client at the hosted endpoint:

```
https://mcp.make.com            # stateless (default)
https://mcp.make.com/stream     # streamable HTTP
https://mcp.make.com/sse        # server-sent events
```

The client runs an OAuth consent flow; the **scopes you grant at consent decide
which tools appear**. No token to manage by hand.

### MCP token (per-zone URL)

Generate an **MCP token** in Make (Profile → API/SDK) and embed it in a zoned URL:

```
https://{zone}.make.com/mcp/u/{MCP_TOKEN}/stateless
https://{zone}.make.com/mcp/u/{MCP_TOKEN}/stream
https://{zone}.make.com/mcp/u/{MCP_TOKEN}/sse
```

- `{zone}` is your org's zone (`eu1|eu2|us1|us2`, + `celonis`) — same **zone
  trap** as the REST API: wrong zone = auth failure.
- The MCP token is **separate** from the REST API token.

### Timeout — pick the transport by run length

| Transport | Timeout | Use for |
|---|---|---|
| `/stateless` | ~60 s | quick scenarios, simple clients |
| `/stream` | ~5 min 20 s | long-running scenarios |
| `/sse` | ~5 min 20 s | streaming clients |

A scenario that takes longer than 60 s on `/stateless` will time out — use
`/stream` or `/sse`.

## Tool tiers

Exact tool names change; confirm in the client's tool list. The **tiers** are
stable:

- **Run tools — all plans.** List the account's on-demand scenarios and execute
  a chosen one with inputs, returning its output bundle. This is what lets an
  agent *use* an automation you built.
- **Management tools — paid plans only.** View and modify scenarios,
  connections, hooks, data stores, teams, and organizations — effectively the
  REST CRUD surfaced as MCP tools. On a free plan these do not appear.

On the OAuth transport, missing scopes (not just plan tier) can also hide tools.

## Client config sketches

Token transport (generic `mcpServers` block; adapt to your client):

```json
{
  "mcpServers": {
    "make": {
      "url": "https://eu2.make.com/mcp/u/${MAKE_MCP_TOKEN}/stream"
    }
  }
}
```

For stdio-only clients, bridge a streamable-HTTP URL to stdio with a proxy such
as `mcp-proxy`.

## Legacy local server

`integromat/make-mcp-server` is the **older local stdio** server. It runs as a
local process and exposes your on-demand scenarios as tools over stdio. It
predates the cloud server; prefer the cloud MCP unless you specifically need a
local, offline-ish process (e.g. an air-gapped client that cannot reach
`mcp.make.com`).

## Credits, not a free lunch

The MCP *server* is free, but every scenario an MCP call runs burns the same
**credits** as any other run. An agent that loops over a run tool can quietly
drain credits — cap it the way you would any autonomous consumer.

## When NOT to use MCP

If the operator is your own deterministic script/CI, the REST API v2 is simpler
and fully controllable — MCP earns its keep only when an **agent** is the one
driving Make.
