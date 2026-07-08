# Dataverse Web API — cloud-flow cheat-sheet

The supported programmatic surface for Power Automate cloud flows. Base URL:
`https://{org}.{region}.dynamics.com/api/data/v9.2` (your `PA_DATAVERSE_URL` + `/api/data/v9.2`).
Cloud flows are rows in the **Process (`workflow`)** table, exposed as the `workflows` entity set.

All examples assume `$TOKEN` holds an Entra bearer token (see `entra-auth-setup.md`) and
`$PA_DATAVERSE_URL` is set without a trailing slash.

## Standard OData headers

Send these on requests (the API is OData v4):

```
Authorization: Bearer <token>
Content-Type: application/json          # on POST/PATCH
Accept: application/json
OData-MaxVersion: 4.0
OData-Version: 4.0
If-Match: *                             # on PATCH (update)
Prefer: odata.include-annotations="*"   # optional; adds FormattedValue / lookuplogicalname to reads
```

`$` in query options must be escaped as `\$` in a shell to stop the shell expanding it.

## Column reference (workflow table)

| Column | Type | Notes |
|---|---|---|
| `category` | choice | `0` classic workflow · `1` dialog · `2` business rule · `3` classic action · `4` business process flow · **`5` modern cloud flow** · `6` desktop flow |
| `type` | choice | **`1` Definition** (runnable) · `2` Activation · `3` Template |
| `statecode` | choice | **`0` Draft/Off** · **`1` Activated/On** · `2` Suspended |
| `name` | string | display name |
| `description` | string | optional |
| `primaryentity` | string | `"none"` for automated/instant/scheduled flows |
| `clientdata` | string | escaped-JSON: `properties.definition` + `properties.connectionReferences` |
| `ismanaged` | bool | true if installed from a managed solution |
| `workflowid` | guid | key used in `workflows({id})` |
| `_ownerid_value` | lookup | owner; set via `ownerid@odata.bind` on write |

## List / read

```bash
# All cloud flows that are currently on
curl -s "$PA_DATAVERSE_URL/api/data/v9.2/workflows?\$filter=category eq 5 and statecode eq 1&\$select=name,statecode,type,workflowid&\$top=50" \
  -H "Authorization: Bearer $TOKEN" -H "OData-Version: 4.0" -H "Accept: application/json"

# One flow with its clientdata
curl -s "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)?\$select=name,statecode,clientdata" \
  -H "Authorization: Bearer $TOKEN" -H "OData-Version: 4.0"
```

## Create

Required properties for automated/instant/scheduled flows: `category`, `name`, `type`,
`primaryentity`, `clientdata`.

```bash
curl -s -i -X POST "$PA_DATAVERSE_URL/api/data/v9.2/workflows" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "OData-Version: 4.0" \
  -d '{
        "category": 5,
        "type": 1,
        "name": "Sample flow name",
        "description": "Reads some data from Dataverse.",
        "primaryentity": "none",
        "clientdata": "<escaped JSON string>"
      }'
```

Response is `204 No Content`. The new `workflowid` is in the **`OData-EntityId`** response header:
`OData-EntityId: .../workflows(00aa00aa-bb11-cc22-dd33-44ee44ee44ee)`. New flows are always
`statecode=0` (Off) — you must enable them.

### The `clientdata` string, unescaped for reading

`clientdata` is the *string* form of this object. Serialize it (`JSON.stringify`) before assigning
it to the property — a nested object is rejected.

```json
{
  "properties": {
    "connectionReferences": {
      "shared_commondataserviceforapps": {
        "runtimeSource": "embedded",
        "connection": {},
        "api": { "name": "shared_commondataserviceforapps" }
      }
    },
    "definition": {
      "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
      "contentVersion": "1.0.0.0",
      "parameters": {
        "$connections": { "defaultValue": {}, "type": "Object" },
        "$authentication": { "defaultValue": {}, "type": "SecureObject" }
      },
      "triggers": {
        "manual": {
          "type": "Request", "kind": "Button",
          "inputs": { "schema": { "type": "object", "properties": {}, "required": [] } }
        }
      },
      "actions": {
        "List_rows": {
          "runAfter": {},
          "type": "OpenApiConnection",
          "inputs": {
            "host": {
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
              "connectionName": "shared_commondataserviceforapps",
              "operationId": "ListRecords"
            },
            "parameters": { "entityName": "accounts", "$select": "name", "$top": 1 },
            "authentication": "@parameters('$authentication')"
          }
        }
      }
    }
  },
  "schemaVersion": "1.0.0.0"
}
```

- `definition` — a Logic Apps workflow definition (`triggers`, exactly one; then `actions`). Design
  this in `../../automation-flows/SKILL.md`, or export a hand-built flow's solution and copy its
  `clientdata`. Do not hand-write a complex definition blind.
- `connectionReferences` — maps each connector the definition uses to a connection. **Unresolved /
  unauthorized references mean the flow cannot turn on** even though `PATCH statecode=1` returns 204.

## Enable / update

```bash
# Enable (turn on)
curl -s -X PATCH "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "OData-Version: 4.0" -H "If-Match: *" \
  -d '{ "statecode": 1 }'

# Update definition + reassign owner (send only changed fields)
curl -s -X PATCH "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "OData-Version: 4.0" -H "If-Match: *" \
  -d '{ "clientdata": "<escaped JSON string>", "ownerid@odata.bind": "systemusers(<systemuserid>)" }'
```

To turn a flow off: `PATCH { "statecode": 0 }`.

## Export (do this before delete)

```bash
curl -s -X POST "$PA_DATAVERSE_URL/api/data/v9.2/ExportSolution" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "OData-Version: 4.0" \
  -d '{ "SolutionName": "FlowContainer", "Managed": false }'
# → 200 with { "ExportSolutionFile": "<base64 zip>" }. Save it to source control.
```

Reimport later with the `ImportSolution` action (`CustomizationFile` = the base64 zip,
`OverwriteUnmanagedCustomizations: true`).

## Delete (irreversible)

```bash
curl -s -X DELETE "$PA_DATAVERSE_URL/api/data/v9.2/workflows(<workflowid>)" \
  -H "Authorization: Bearer $TOKEN"
# → 204 No Content. No undo — always ExportSolution first.
```

## Run history

The `flowrun` table holds run *records* (status, start/end) but not per-action inputs/outputs.
Query it for a status overview; for action-level payloads use FlowStudio MCP
(`flowstudio-mcp-and-limits.md`).

## Sharing

`RetrieveSharedPrincipalsAndAccess` (who a flow is shared with), `GrantAccess` / `ModifyAccess` /
`RevokeAccess` — standard Dataverse record-sharing messages, called as Web API actions.

## Error handling

- `401` — token missing/expired or wrong audience/scope. Re-acquire; confirm scope is
  `{PA_DATAVERSE_URL}/.default`.
- `403` — authenticated but the (application) user lacks a Dataverse security role, or the flow is a
  My Flow / outside a solution you can touch.
- `404` on `workflows({id})` — wrong id, or the flow isn't in Dataverse (My Flow).
- `400` on create — almost always `clientdata` sent as an object instead of an escaped string, or a
  missing required property.
