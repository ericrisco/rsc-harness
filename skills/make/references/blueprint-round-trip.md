# The blueprint round-trip

You almost never author a Make blueprint by hand. You **export** one, **mutate**
the JSON, and **send it back as a string**. This file is that recipe in depth.

## Why round-trip

A blueprint is a large, only-partially-documented JSON structure. Writing one
from scratch means guessing internal module parameter keys and metadata that the
create endpoint will reject. Exporting a working scenario (or a published
template) gives you a guaranteed-valid skeleton to edit — the diff you make is
small and reviewable.

## Blueprint anatomy (top level)

```jsonc
{
  "name": "My scenario",
  "flow": [                     // ordered modules — index 1, 2, 3…
    {
      "id": 1,
      "module": "gateway:CustomWebHook",   // module type
      "version": 1,
      "parameters": { "hook": 123456 },    // references a hook by id
      "mapper": {},                        // inbound mapping for this module
      "metadata": { "designer": { "x": 0, "y": 0 } }
    },
    {
      "id": 2,
      "module": "notion:createDatabaseItem",
      "version": 2,
      "parameters": { "__IMTCONN__": 78910 }, // connection id — NOT a secret
      "mapper": { "title": "{{1.body.name}}" } // maps module 1's output
    }
  ],
  "metadata": {
    "instant": true,
    "scenario": { "roundtrips": 1, "maxErrors": 3, "autoCommit": true },
    "designer": { "orphans": [] }
  }
}
```

Key ideas:

- **`flow`** is the ordered module list. Each module has an integer `id`; a
  trigger sits at index 1.
- **Mapping** is `{{sourceId.path}}` — `{{1.body.name}}` = module 1's
  `body.name`. This is the same mapping `automation-flows` designs; here you are
  only serializing it.
- **Connections and hooks are referenced by id** (`__IMTCONN__`, `parameters.hook`).
  Create the connection/hook first (or reuse one), put its id here. Never inline
  an API key or token.
- **Routers/branches** appear as nested `routes` arrays inside a router module.
- `metadata.scenario` carries run settings (max errors, sequential processing,
  auto-commit) — design decisions from `automation-flows`, encoded here.

## Step 1 — export

```bash
curl -s -H "Authorization: Token $MAKE_API_TOKEN" \
  "https://$MAKE_ZONE/api/v2/scenarios/$SRC_ID/blueprint" \
  | jq '.response.blueprint' > bp.json     # verify the .response.blueprint wrapper at author time
```

Or from a template: `GET /templates/{id}/blueprint`.

## Step 2 — mutate

Edit `bp.json`: rename it, repoint `parameters.__IMTCONN__` /
`parameters.hook` at *your* connection/hook ids, adjust `mapper` expressions,
add/remove modules in `flow`. If you add a module, give it a fresh integer `id`
and wire downstream mappers to it.

Validate it is still JSON before sending:

```bash
jq empty bp.json && echo "valid json"
```

## Step 3 — send back as a STRING

The create/update endpoints want `blueprint` (and `scheduling`) as JSON
**strings**, not objects. Build the body with `jq` so the stringify is correct:

```bash
# CREATE
curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://$MAKE_ZONE/api/v2/scenarios" \
  -d "$(jq -n \
        --argjson team "$MAKE_TEAM_ID" \
        --arg bp "$(jq -c . bp.json)" \
        --arg sched '{"type":"on-demand"}' \
        '{teamId:$team, blueprint:$bp, scheduling:$sched}')"

# UPDATE (same scenario)
curl -s -X PATCH -H "Authorization: Token $MAKE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://$MAKE_ZONE/api/v2/scenarios/$ID" \
  -d "$(jq -n --arg bp "$(jq -c . bp.json)" '{blueprint:$bp}')"
```

`jq -c . bp.json` compacts the blueprint to one line; passing it via `--arg`
makes it a **string** field. `--argjson team` keeps `teamId` a number.

## The stringify gotcha

The most common failure is sending `blueprint` as a nested object:

```jsonc
// WRONG — object, 400
{ "teamId": 123, "blueprint": { "flow": [ ... ] }, "scheduling": {"type":"on-demand"} }

// RIGHT — string
{ "teamId": 123, "blueprint": "{\"flow\":[...]}", "scheduling": "{\"type\":\"on-demand\"}" }
```

If you build the request in Python/JS, `json.dumps()` / `JSON.stringify()` the
blueprint value itself and assign the resulting string.

## Verify, then activate

The create/PATCH call is the validator — a bad blueprint returns a 400 naming
the offending module. On success, dry-run with `POST /scenarios/{id}/run`
(`{"responsive":true}` to get the output inline), inspect the bundle, then
`POST /scenarios/{id}/start`. Before any `DELETE`, re-export the blueprint to a
file — deletion is permanent.
