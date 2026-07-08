# FlowStudio MCP + platform limits

## FlowStudio MCP — third-party, not Microsoft

There is **no Microsoft first-party MCP server that authors Power Automate flows.** Microsoft's MCP
story is Copilot Studio *consuming* MCP servers, and a Dataverse MCP — neither builds/edits flows.

The de-facto tool is **FlowStudio MCP**, an independent third party. Flag this to anyone before it
enters a pipeline: it is **not Microsoft-affiliated**, it is a paid hosted service, and it sits
between your tenant and your agent.

- **Endpoint:** `https://mcp.flowstudio.app/mcp` (remote MCP).
- **Auth:** an `x-api-key` header. The key is issued after you sign in with your Microsoft account
  and grant Power Platform scopes to FlowStudio (delegated). Verify the exact scope list and pricing
  at author time — the free tier is a small monthly call allowance.
- **Why use it:** it exposes what the Dataverse Web API does **not** — **action-level run inputs and
  outputs**, so you can see which step in a live run failed and with what payload.

### Representative tools (verify the live list — 30+ tools, evolving)

| Tool | Does |
|---|---|
| `list_live_flows` | List flows in the tenant, filterable by name |
| `get_live_flow` | Read a flow's configuration/definition |
| `get_live_flow_runs` | Recent run history for a flow (status, timing) |
| `get_live_flow_run_action_outputs` | **Per-action inputs/outputs of a run** — the debugging payload |
| `update_live_flow` | Modify a live flow |

Typical debug loop: `list_live_flows` (find it) → `get_live_flow_runs` (find the failed run) →
`get_live_flow_run_action_outputs` (see the failing action's payload). For plain CRUD and enablement,
prefer the supported Dataverse Web API — reserve the MCP for the run-history depth it uniquely gives.

## Platform limits — teach these loudly

1. **My Flows are not code-manageable.** Only flows inside a **Dataverse solution** can be created or
   edited by code. Microsoft's docs state managing **My Flows** is not supported programmatically. If
   the target is a My Flow: move it into a solution in the maker portal first, or drive it by hand.
   There is no API that lets you CRUD a classic personal flow.

2. **`api.flow.microsoft.com` is unsupported.** Microsoft's exact stance: usable "at your own risk,"
   subject to breaking changes. Do not build on it. Supported alternatives:
   - **Dataverse Web API** (this skill's default) — full CRUD on the `workflow` table.
   - **Power Automate Management** connector (or **Power Automate for Admins**) — the supported
     management surface for turning flows on/off and admin operations across an environment.

3. **The Power Platform API is superseding surfaces — fast-moving.** `api.powerplatform.com` is a
   unified surface with its own Entra scopes. As of early 2026 it lists cloud flows
   (`GET https://api.powerplatform.com/powerautomate/environments/{environmentId}/cloudFlows`,
   api-version `2024-10-01`) and its **Inventory API is GA**. It may eventually be the recommended
   management path over Dataverse. **Re-check its coverage at author time** before committing a new
   project to either surface — this is the single most likely fact to have moved since this was
   written.

## What lives where

| Need | Surface |
|---|---|
| Create / enable / update / delete / list flows | Dataverse Web API (`workflow` table) |
| Turn on/off, admin ops across an environment | Power Automate Management connector |
| Action-level run inputs/outputs for debugging | FlowStudio MCP (third-party) |
| Emerging unified management (evolving) | Power Platform API (`api.powerplatform.com`) |
| Anything on `api.flow.microsoft.com` | unsupported — avoid |
