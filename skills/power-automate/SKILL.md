---
name: power-automate
description: "Use when operating Microsoft Power Automate cloud flows programmatically — creating, enabling, updating, listing or deleting flows through the Dataverse Web API (the workflow table, category 5) with Entra ID / OAuth2 auth, or reading action-level run history via the third-party FlowStudio MCP. Triggers: 'create a Power Automate cloud flow with the Dataverse API', 'enable my flow by code / set statecode to 1', 'why can't I create or edit a My Flow programmatically', 'PATCH the workflow clientdata', 'automatizar el despliegue de un flujo de Power Automate desde código'. NOT designing the flow or authoring its definition (automation-flows), NOT choosing a platform by billing model (automation-strategy), NOT a generic typed REST client with auth/pagination/backoff (api-connector-builder), NOT the endpoint receiving an HTTP-trigger POST in your app (webhooks), NOT scripting Microsoft 365 / Graph mail & calendar directly (no first-party skill — api-connector-builder, or google-workspace)."
tags: [power-automate, dataverse, microsoft, flows, entra, oauth, mcp, m365, automation]
recommends: [automation-flows, automation-strategy, api-connector-builder, webhooks]
profiles: [full]
origin: risco
---

# Power Automate — operate cloud flows through Dataverse, honestly

Drive Microsoft Power Automate **cloud flows** from code: create, enable, update, list, and delete them, plus pull run history for debugging. This skill operates the *live* surface. Deciding what the flow should do and shaping its trigger→actions→error definition is design — that lives in `../automation-flows/SKILL.md`; this skill wraps that definition, ships it, and manages it.

Read these three facts before you write a line — they set the boundary of what is even possible:

1. **Only flows inside a Dataverse *solution* are code-manageable.** Classic personal **"My Flows"** cannot be created or edited by code — the Microsoft docs say so explicitly. If the target is a My Flow, the honest answer is: move it into a solution first, or drive it by hand. There is no API workaround.
2. **`api.flow.microsoft.com` is unsupported.** Microsoft's own words: use it "at your own risk," it is subject to breaking changes. The supported programmatic surface is the **Dataverse Web API** (or the .NET SDK) against the `workflow` table. For admin-style operations the **Power Automate Management** connector is the other supported path.
3. **The unified Power Platform API (`api.powerplatform.com`) is maturing fast.** It already lists cloud flows (api-version `2024-10-01`) and its Inventory API went GA in early 2026. It may eventually supersede the Dataverse path for flow management. Treat the Dataverse-vs-Power-Platform-API split as fast-moving — verify the current recommendation at author time.

## Connect first — API vs MCP

Everything runs against your org's Dataverse Web API. **Base URL:** `https://{org}.{region}.dynamics.com/api/data/v9.2` (find yours under Power Platform admin → your environment → developer resources). Auth is **OAuth2 / Entra ID** — a user token or, for CI, a **service principal** (app registration). For a service principal the org needs a **Dataverse application user** mapped to that app plus a security role; the token audience is the Dataverse URL. Full setup, including the delegated `user_impersonation` vs app `.default` scope split and the 401/403 causes, is in `references/entra-auth-setup.md`.

Put these in `.env` (never inline a secret in a flow or a script):

```
PA_DATAVERSE_URL=https://contoso.crm.dynamics.com   # no trailing slash, no /api/...
PA_TENANT_ID=<entra-tenant-guid>
PA_CLIENT_ID=<app-registration-client-id>
PA_CLIENT_SECRET=<app-registration-secret>          # service-principal flow only
```

**When to use the REST API vs the MCP:**

| You need to… | Use | Why |
|---|---|---|
| Create / enable / update / delete / list flows | **Dataverse Web API** | The only supported CRUD surface; scriptable, CI-friendly, service-principal auth. |
| Read a flow's **action-level** run inputs/outputs to debug a failure | **FlowStudio MCP** (third-party) | Dataverse exposes run *records* (`flowrun` table) but not per-action I/O; the MCP does. See `references/flowstudio-mcp-and-limits.md`. |
| Admin-scope operations (turn on/off across an environment) | Power Automate **Management** connector | Supported management surface when raw Dataverse is awkward. |

**FlowStudio MCP is NOT Microsoft-affiliated** — it is a de-facto third-party server (`mcp.flowstudio.app/mcp`). Microsoft's own MCP story is Copilot Studio *consuming* MCP servers and a Dataverse MCP, neither of which authors Power Automate flows. Flag the third-party dependency to anyone before wiring it into a pipeline.

## The `workflow` table — the data model

Cloud flows are rows in the Dataverse **Process (`workflow`)** table. The columns that matter:

| Column | Meaning | Values you use |
|---|---|---|
| `category` | Kind of process | **`5` = modern cloud flow** (automated / instant / scheduled). (0 classic workflow, 4 business process flow, 6 desktop flow.) |
| `type` | Definition vs template | **`1` = Definition** (a runnable flow). |
| `statecode` | On/off state | **`0` = Draft (Off)**, **`1` = Activated (On)**, `2` = Suspended. |
| `name` | Display name | your string |
| `primaryentity` | Bound table | **`"none"`** for automated/instant/scheduled flows |
| `clientdata` | The flow itself | **string-encoded JSON** (see below) |
| `workflowid` | GUID key | returned on create; used in `workflows({id})` |

List the cloud flows that are on:

```bash
curl -s "$PA_DATAVERSE_URL/api/data/v9.2/workflows?\$filter=category eq 5 and statecode eq 1&\$select=name,statecode,type,workflowid" \
  -H "Authorization: Bearer $TOKEN" -H "OData-Version: 4.0" -H "Accept: application/json"
```

## `clientdata` — the payload, and the trap that bites everyone

`clientdata` is **a JSON string, not a nested JSON object.** It is the serialized form of:

```json
{
  "properties": {
    "connectionReferences": { "shared_commondataserviceforapps": { "runtimeSource": "embedded", "connection": {}, "api": { "name": "shared_commondataserviceforapps" } } },
    "definition": { "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#", "contentVersion": "1.0.0.0", "triggers": { }, "actions": { } }
  },
  "schemaVersion": "1.0.0.0"
}
```

Two load-bearing parts:

- **`definition`** — a Logic Apps workflow definition: `triggers` (exactly one) then `actions`. This is the *design* artifact. Do not invent it from scratch here — get the trigger→actions→branch→error shape from `../automation-flows/SKILL.md`, then drop it into `definition`. Fastest reliable way to get a real one: build the flow once in the maker portal, export the solution, and copy its `clientdata`.
- **`connectionReferences`** — the map from the definition's connectors to actual connections. **A flow whose connection references are not authorized will not turn on.** In a solution these are connection-reference records the target environment must resolve; unresolved references are the #1 reason a `PATCH statecode=1` "succeeds" but the flow never runs.

**The trap:** `clientdata` must be *escaped into a string* before it goes in the request body — a nested object is rejected. In a script, `JSON.stringify(clientDataObject)` and assign the result; do not paste the object raw. Full annotated example in `references/dataverse-web-api.md`.

## Dynamic lifecycle — token → create → validate → enable → manage → delete

**1. Get a token** (service-principal / client-credentials shown):

```bash
TOKEN=$(curl -s -X POST "https://login.microsoftonline.com/$PA_TENANT_ID/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" -d "client_id=$PA_CLIENT_ID" \
  -d "client_secret=$PA_CLIENT_SECRET" -d "scope=$PA_DATAVERSE_URL/.default" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
```

**2. Create the flow** (comes up `statecode=0`, Off — expected):

```bash
curl -s -i -X POST "$PA_DATAVERSE_URL/api/data/v9.2/workflows" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "OData-Version: 4.0" \
  -d '{ "category": 5, "type": 1, "name": "Nightly sync", "primaryentity": "none", "clientdata": "<string-encoded JSON>" }'
# → 204 No Content. The workflowid is in the OData-EntityId response header:
#   OData-EntityId: .../workflows(00aa00aa-bb11-cc22-dd33-44ee44ee44ee)
```

**3. Validate before enabling.** Read it back, confirm `category`/`type` are right, and confirm every `connectionReferences` entry resolves to an authorized connection in this environment. Enabling a flow with dangling connections is the classic silent failure.

**4. Enable** — flip `statecode` to `1` (use `If-Match: *` for the update):

```bash
curl -s -X PATCH "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "OData-Version: 4.0" -H "If-Match: *" \
  -d '{ "statecode": 1 }'
# → 204 No Content
```

**5. Manage** — update the definition or owner with the same `PATCH` (send only the fields you change; to reassign use `"ownerid@odata.bind": "systemusers(<id>)"`). To turn a flow off, `PATCH statecode=0`.

**6. Delete — irreversible; export first.** There is no undo on `DELETE`. **Before deleting, export the containing solution** (`POST /api/data/v9.2/ExportSolution` → base64 zip you save to source control), so the flow can be reimported:

```bash
curl -s -X DELETE "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)" \
  -H "Authorization: Bearer $TOKEN"
# → 204 No Content
```

**Debug a run** — Dataverse's `flowrun` table lists run records but not per-action I/O. To see *which action failed and with what payload*, use FlowStudio MCP: `list_live_flows` → `get_live_flow_runs` → `get_live_flow_run_action_outputs`. See `references/flowstudio-mcp-and-limits.md`.

## Microsoft 365 ecosystem fit

Power Automate is Microsoft's iPaaS across M365 and Dynamics; flows live in **Dataverse** and glue Outlook, Teams, SharePoint, Dynamics, and hundreds of connectors. That means the boundary is sharp: if the ask is *"send this email / read this calendar via Microsoft Graph from my own backend code,"* that is not a flow at all — build a typed Graph client with `../api-connector-builder/SKILL.md` (there is no first-party MS-Graph skill). If the equivalent is on Google, that is `../google-workspace/SKILL.md`. This skill is for when the automation genuinely *is* a Power Automate flow you must operate by code.

## Honesty / gotchas

| Trap | Why it bites | Do instead |
|---|---|---|
| Trying to CRUD a **My Flow** by code | Unsupported — silently impossible, not a bug you can fix | Move it into a Dataverse solution, or drive it by hand |
| `clientdata` sent as a nested object | Request rejected; the column expects an escaped **string** | Serialize (`JSON.stringify`) the definition+connectionReferences before sending |
| `PATCH statecode=1` "worked" but the flow never runs | Connection references unresolved/unauthorized in the target environment | Authorize every connection reference before enabling; validate on read-back |
| Building against `api.flow.microsoft.com` | Unsupported; breaks without warning | Dataverse Web API, or the Power Automate Management connector |
| `DELETE` with no export | No undo; the flow and its history are gone | `ExportSolution` first, save the zip, then delete |
| Hardcoding the Dataverse URL / secret | Env-specific, leaks in source | `.env`: `PA_DATAVERSE_URL`, `PA_TENANT_ID`, `PA_CLIENT_ID`, `PA_CLIENT_SECRET` |
| Assuming the Dataverse path is permanent | Power Platform API is superseding surfaces piecemeal | Re-check `api.powerplatform.com` coverage at author time; the split is fast-moving |

## Related skills

- **`../automation-flows/SKILL.md`** — design side: what the trigger→actions→branch→error should be, the importable definition. This skill *consumes* that shape as `clientdata.definition`. Design there, operate here.
- **`../automation-strategy/SKILL.md`** — choosing Power Automate vs n8n/Make/Zapier by billing and constraints. Decide there before you commit to operating here.
- **`../api-connector-builder/SKILL.md`** — a generic typed REST client with auth/pagination/backoff (including a Dataverse or MS Graph client). This skill uses the Dataverse API surgically; it does not build a general client.
- **`../webhooks/SKILL.md`** — building the inbound endpoint in *your* app that receives a flow's HTTP-trigger POST. This skill triggers/operates flows; it does not build the receiver.

## Checklist

- [ ] `.env` set: `PA_DATAVERSE_URL` (no trailing slash), `PA_TENANT_ID`, `PA_CLIENT_ID`, `PA_CLIENT_SECRET`.
- [ ] Confirmed the target is a **solution-aware** flow, not a My Flow.
- [ ] Token acquired against scope `{PA_DATAVERSE_URL}/.default` (or delegated `user_impersonation`).
- [ ] Create payload has `category:5`, `type:1`, `primaryentity:"none"`, and `clientdata` as an **escaped string**.
- [ ] Every `connectionReferences` entry maps to an authorized connection before enabling.
- [ ] Flow enabled via `PATCH statecode=1` and verified on read-back.
- [ ] Solution **exported** before any `DELETE`.
- [ ] No secrets or org URLs hardcoded; FlowStudio MCP (if used) flagged as third-party.

## References

- `references/dataverse-web-api.md` — endpoint cheat-sheet (token, list/filter, create, enable, update, delete, ExportSolution, share), the full annotated `clientdata`, OData headers, and error handling.
- `references/entra-auth-setup.md` — app registration, service principal vs delegated user, the Dataverse application user + security role, `.default` vs `user_impersonation`, and common 401/403 causes.
- `references/flowstudio-mcp-and-limits.md` — FlowStudio MCP tools and auth (third-party), what it exposes that Dataverse doesn't, and the platform limits (My Flows, `api.flow.microsoft.com`, Power Platform API evolution).
