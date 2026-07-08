# Zapier MCP — tools, lifecycle, and call sketches

Depth overflow for `SKILL.md`. The hosted Zapier MCP server exposes two layers of tools:

1. **Static meta-tools** — a fixed set (~14; **verify the current list at `docs.zapier.com/mcp`**, it changes) that let an agent discover, enable, configure, and execute actions dynamically. These are always present once the server is connected.
2. **Enabled app actions** — the specific actions you turned on for this MCP server (e.g. `slack_send_channel_message`). These appear as their own callable tools after you enable them.

Zapier hosts the server (`mcp.zapier.com/api/v1/connect`) and it is closed-source, so treat the exact tool names below as representative, not a contract. Confirm names against the live server's advertised tool list before hardcoding.

## The meta-tool families

| Family | Representative tool(s) | Purpose | Read/write |
| --- | --- | --- | --- |
| **Discover** | `discover_zapier_actions` | Search the 40,000+ action catalog by natural language; returns action ids you can enable. | read (free) |
| **Enable / manage** | `enable_zapier_action`, and list/disable/remove companions | Add a discovered action to this server so it becomes callable; list what is enabled; remove one. | read/config |
| **Configure** | an edit/config tool | Pre-fill or constrain an enabled action's fields (e.g. pin a default Slack channel). | config |
| **Execute — read** | `execute_zapier_read_action` | Run a search/find/get/list/lookup action. | read |
| **Execute — write** | `execute_zapier_write_action` | Run a send/create/update/add/delete action — real side effect. | **write** |

The server distinguishes read from write **in the tool name itself** — that is your safety signal (see the write-safety rule in `SKILL.md`). When in doubt, the verb in the action name (find/get/list = read; send/create/update/delete = write) decides.

## Lifecycle, end to end

```text
# 1. DISCOVER — what can Slack do here? (free read)
discover_zapier_actions({ query: "send a message to a Slack channel" })
  → [ { id: "slack_send_channel_message", label: "Send Channel Message", ... }, ... ]

# 2. ENABLE — make that action callable on this server
enable_zapier_action({ action: "slack_send_channel_message" })
  → { enabled: true, tool: "slack_send_channel_message" }

# 3. (optional) CONFIGURE — pin defaults so the agent can't pick the wrong channel
#    e.g. lock channel = "#alerts", leave text as the only agent-supplied field

# 4. INVOKE — read first if you need to look something up (free-to-just-do)
execute_zapier_read_action({
  action: "slack_find_message",
  inputs: { query: "deploy failed" }
})

#    …then the write, ONLY after showing the user the exact payload and getting approval
execute_zapier_write_action({
  action: "slack_send_channel_message",
  inputs: { channel: "#alerts", text: "Deploy #4821 succeeded ✅" }
})
  → 2 Zapier tasks consumed on success
```

## Cost accounting

- **2 Zapier tasks per successful tool call.** Failed calls cost nothing.
- Discovery and enablement are lightweight; the expensive unit is each successful read/write **invocation**.
- A polling or retrying agent multiplies this fast. Prefer a single precise call; do not loop `discover` in production paths (discover once, enable, then invoke the concrete tool by name).
- Task quota is your Zapier plan's quota — MCP draws from the same bucket as your Zaps.

## First-connect and error handling

- If no Zapier tools are visible, the server is installed but **not authenticated** — the user must connect it in their client's MCP settings (the client redirects to `mcp.zapier.com` to sign in). Do not call Zapier tools until they appear.
- `401 / unauthorized` → key expired or missing; re-authenticate at `mcp.zapier.com`.
- `authentication required` on one app → that app's connection needs its own OAuth; the user connects it at `mcp.zapier.com`.
- `tool/action not found` → not enabled on this server; discover + enable it, or the user adds it in the dashboard.
- `rate limit` → space calls out.
- Empty results are **not** an error — report "nothing found", don't silently retry with broader terms (each retry is real quota if it succeeds).

Translate errors into plain language for the user; never dump the raw 401.

## Handy patterns

- **Scope the key.** Enable only the actions a given agent needs. The MCP key can fire everything enabled on that server, and Enterprise org restrictions are **not** enforced through MCP.
- **Native MCP beats Zapier for a single app.** If a dedicated app MCP exists (e.g. a native Slack/Notion server), prefer it for that app; use Zapier for long-tail apps and cross-app chains. Never call both for one operation.
- **Trigger vs action.** MCP invokes actions. To *start* a Zap the user built, POST to its Catch Hook URL instead — no MCP call, no 2-task charge for the trigger itself (the Zap's own steps bill as normal Zapier tasks).
