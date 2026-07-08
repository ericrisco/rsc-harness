---
name: make
description: "Use when operating Make.com (formerly Integromat) programmatically — driving its REST API v2 or the Make MCP server from code or an agent to create, read, update, activate, run, clone, or delete scenarios, connections, hooks, and data stores. Triggers: 'create a Make scenario via the API', 'export a scenario blueprint, mutate it, and push it back', 'start/stop/run a Make scenario from a script', 'clone this Integromat scenario into another team', 'connect the Make MCP server so an agent runs my scenarios as tools', 'my valid Make API token returns an auth error' (zone trap), 'automatiza escenarios de Make.com desde la API'. NOT designing what the flow should do — trigger, branching, mapping, dedup, error path (automation-flows), NOT choosing Make vs n8n vs Zapier by billing model (automation-strategy), NOT operating n8n / Zapier / Power Automate (their skills), NOT a generic typed REST client with pagination/backoff (api-connector-builder) or an inbound webhook receiver in your own app (webhooks)."
tags: [make, integromat, automation, scenarios, blueprint, mcp, no-code, api, workflows]
recommends: [automation-flows, automation-strategy, api-connector-builder, webhooks]
profiles: [full]
origin: risco
---

# Make (Integromat) — operate scenarios by REST API and MCP

Drive a live Make.com account from code or an agent: create scenarios from a
blueprint, activate/run/stop/clone/delete them, and manage the connections,
hooks, data stores, and teams around them. This skill owns the **operate**
half — the API v2 calls and the MCP wiring. It does **not** design the flow;
what a scenario *should do* (trigger, routes, mapping, dedup, error handler)
lives in [`automation-flows`](../automation-flows/SKILL.md), and the
Make-vs-n8n-vs-Zapier billing call lives in
[`automation-strategy`](../automation-strategy/SKILL.md). Bring the design
here, and this skill turns it into API payloads and MCP tool calls.

Reality up top (verify at author time — Make ships fast):

- **REST API v2 is GA.** Base URL is **zoned**: `https://{zone}.make.com/api/v2`.
- **The Make MCP server is GA and free on every plan** — you only pay the
  scenario **credits** a run consumes. Cloud MCP has two tool tiers: run tools
  (all plans) and management tools (paid).

## Connect first — API token vs MCP

Two ways in, chosen by *who is driving*:

- **REST API v2** — deterministic CRUD from your own scripts/CI. Full control
  of the blueprint. Use for provisioning, bulk edits, activate/stop pipelines.
- **Make MCP server** — lets an MCP client (Claude, Cursor, ChatGPT) call your
  scenarios and (on paid plans) manage them as tools, no glue code. Use when an
  **agent** is the operator.

`.env` (never inline secrets — read from the environment):

```bash
MAKE_ZONE=eu2.make.com        # your org's zone — eu1|eu2|us1|us2 (+ celonis). WRONG ZONE = AUTH ERROR.
MAKE_API_TOKEN=xxxxxxxx        # Profile → API/SDK → API token. Scopes are FIXED at creation.
MAKE_TEAM_ID=123456            # teamId a scenario is created under (integer)
MAKE_MCP_TOKEN=yyyyyyyy        # separate MCP token, for the token-URL MCP transport
```

**Auth header (API):** `Authorization: Token {MAKE_API_TOKEN}` — the literal
word `Token`, a space, then the token. OAuth2 is the alternative for
multi-user apps. **Scopes are chosen when the token is minted and cannot be
widened later** — mint with `scenarios:read scenarios:write` (and
`connections`, `hooks`, `datastores`, `teams` as needed) up front; a
too-narrow token means re-minting, not patching.

## The scenario model (just enough to build the payload)

A **scenario** = exactly one trigger module, then a chain of action modules,
optionally split by **routers** into branches. Data flows by **mapping**:
a downstream field references an upstream output as `{{2.email}}` (module 2's
`email`). The whole thing serializes to a **blueprint** — the JSON you GET, edit,
and POST back. That is the entire operate-side model you need here.

Do **not** design the flow in this skill. Trigger choice (webhook vs polling),
branch logic, idempotency/dedup on a data store, and the error handler
(Break → Incomplete Executions, etc.) are all `automation-flows`. Take its
build sheet, then encode it as a blueprint below.

## API v2 surface

| Group | Endpoints (case-sensitive!) | Use |
|---|---|---|
| Scenarios | `GET/POST /scenarios`, `GET/PATCH/DELETE /scenarios/{id}`, `.../start`, `.../stop`, `.../run`, `.../clone`, `.../blueprint` | the core |
| Connections | `GET/POST /connections`, `.../{id}/test` | app auth the modules use |
| Hooks | `GET/POST /hooks`, `.../{id}/ping`, `.../learn-start` | inbound webhooks/mailhooks |
| Data stores | `GET/POST /data-stores`, `.../{id}/data` | dedup keys, state |
| Templates | `GET /templates`, `.../{id}/blueprint` | starting-point blueprints |
| Teams / Orgs | `GET /teams`, `GET /organizations/{id}` | scoping + rate limit |

Two rules that bite: **endpoints and query keys are case-sensitive**, and every
call is **zoned** — the same token against the wrong `{zone}` returns an auth
error, not a 404, which sends people chasing a token problem that does not exist.

**Rate limits are per plan** (req/min): Core 60 · Pro 120 · Teams 240 ·
Enterprise 1000. Read your own real ceiling rather than guessing:

```bash
curl -s -H "Authorization: Token $MAKE_API_TOKEN" \
  "https://$MAKE_ZONE/api/v2/organizations/$ORG_ID" | jq '.organization.license.apiLimit'
```

## Dynamic lifecycle — the blueprint round-trip

The core technique: **you rarely hand-write a blueprint.** You GET one from a
template or an existing scenario, mutate the JSON, and POST/PATCH it back **as a
string**. `blueprint` and `scheduling` are sent as JSON *strings*, not objects.

### 1. Get a starting blueprint

```bash
# From an existing scenario (or a template: GET /templates/{id}/blueprint)
curl -s -H "Authorization: Token $MAKE_API_TOKEN" \
  "https://$MAKE_ZONE/api/v2/scenarios/$TEMPLATE_ID/blueprint" \
  | jq '.response.blueprint' > bp.json   # wrapper key: verify .response.blueprint at author time
```

Mutate `bp.json` with your design — module parameters, the `{{n.field}}`
mappings, router filters. Keep secrets out; wire credentials via a
**connection id**, never a literal key in the blueprint.

### 2. Create the scenario (blueprint + scheduling as STRINGS)

```bash
curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://$MAKE_ZONE/api/v2/scenarios" \
  -d "$(jq -n --argjson team "$MAKE_TEAM_ID" \
        --arg bp "$(jq -c . bp.json)" \
        --arg sched '{"type":"on-demand"}' \
        '{teamId:$team, blueprint:$bp, scheduling:$sched}')"
# scheduling e.g. {"type":"indefinitely","interval":900} (interval seconds) — verify fields at author time.
# optional: folderId, basedon (template id)
```

### 3. Validate

The create call itself is the validator — a malformed blueprint returns a 400
naming the offending module/field. Fix the JSON and re-POST. There is no
separate schema-lint endpoint; a clean create *is* the pass.

### 4. Dry-run / test before you schedule

Run it once, watching one execution, while still `on-demand` (inactive):

```bash
curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" \
  "https://$MAKE_ZONE/api/v2/scenarios/$ID/run" \
  -H "Content-Type: application/json" -d '{"responsive":true}'
# inspect the returned execution/bundle output before trusting the flow
```

### 5. Activate

```bash
# switch scheduling off on-demand first (PATCH), then start
curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" \
  "https://$MAKE_ZONE/api/v2/scenarios/$ID/start"
```

### 6. Manage — patch, stop, clone

```bash
# Update: same round-trip — GET blueprint, mutate, PATCH back as a string
curl -s -X PATCH -H "Authorization: Token $MAKE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://$MAKE_ZONE/api/v2/scenarios/$ID" \
  -d "$(jq -n --arg bp "$(jq -c . bp.json)" '{blueprint:$bp}')"

curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" ".../scenarios/$ID/stop"
curl -s -X POST -H "Authorization: Token $MAKE_API_TOKEN" \
  -H "Content-Type: application/json" ".../scenarios/$ID/clone" \
  -d '{"teamId": 999, "name": "copy"}'   # clone into another team
```

### 7. Delete — export first (irreversible)

`DELETE /scenarios/{id}` is permanent; there is no undo and no trash. **Never
delete a live scenario without exporting its blueprint first.**

```bash
curl -s -H "Authorization: Token $MAKE_API_TOKEN" \
  ".../scenarios/$ID/blueprint" | jq '.response.blueprint' > backup-$ID.json  # export
curl -s -X DELETE -H "Authorization: Token $MAKE_API_TOKEN" ".../scenarios/$ID"
```

## Make MCP — run and manage scenarios as tools

The Make MCP server hands an MCP client your scenarios as callable tools. Two
transports:

- **OAuth (remote):** point the client at `https://mcp.make.com` (or the
  `/stream`, `/sse` variants). Scopes granted at consent decide which tools appear.
- **MCP token (per-zone):** `https://{zone}.make.com/mcp/u/{MCP_TOKEN}/stateless`
  (also `/stream`, `/sse`). `/stateless` times out at ~60 s; `/stream` and
  `/sse` allow ~5 min — a long scenario needs `/stream` or `/sse`.

Tool tiers (exact names move — confirm in the client's tool list at author time):

- **Run tools — all plans.** Enumerate on-demand scenarios and execute one with
  inputs, returning its output. This is what lets an agent *use* your automation.
- **Management tools — paid plans.** View/modify scenarios, connections, hooks,
  data stores, teams, organizations — the CRUD above, surfaced as tools.

Client config sketch (token transport):

```json
{ "mcpServers": { "make": {
  "url": "https://eu2.make.com/mcp/u/${MAKE_MCP_TOKEN}/stream"
} } }
```

MCP calls consume the scenario's normal **credits** — the server is free, the
runs are not. **Legacy note:** the local stdio server `integromat/make-mcp-server`
predates the cloud one and exposes on-demand scenarios as tools over stdio;
prefer the cloud server unless you specifically need a local process.

## Honesty / gotchas

- **Zone trap.** Wrong `{zone}` → auth error with a perfectly valid token. Check
  the zone before you suspect the token.
- **Case-sensitive paths.** `/scenarios` works, `/Scenarios` does not.
- **`blueprint` and `scheduling` are strings, not objects** — stringify them or
  the create/update fails.
- **Token scopes are frozen at creation.** Can't widen later; re-mint instead.
- **Delete is irreversible** — export the blueprint first, always.
- **Credits, not operations.** Make's billing unit became **credits** (was
  "operations"); API-triggered and MCP-triggered runs both burn them.
- **`.run` on an inactive scenario** is your dry run; scheduled execution needs
  `.start` — don't confuse the two.
- **Don't hand-author blueprints from scratch** — round-trip a template; the
  format is large and undocumented in full.

## Related skills

- [`automation-flows`](../automation-flows/SKILL.md) — **design** the flow
  (trigger, routes, mapping, dedup, error path). Build it there, encode the
  blueprint here. Design ↔ operate is the boundary.
- [`automation-strategy`](../automation-strategy/SKILL.md) — choose Make vs n8n
  vs Zapier by billing model *before* committing to this skill.
- [`webhooks`](../webhooks/SKILL.md) — building the inbound endpoint that
  *receives* events in your own app (vs Make's `hooks` API here).
- [`api-connector-builder`](../api-connector-builder/SKILL.md) — a generic typed
  REST client with auth/pagination/backoff, when you outgrow curl.
- Other platforms: `n8n`, `zapier`, `power-automate` (their own skills).

## Checklist

- [ ] `MAKE_ZONE` matches the org's actual zone (ruled out the zone trap).
- [ ] API token minted with all scopes needed (scenarios + connections/hooks/
      datastores as required) — scopes can't be widened later.
- [ ] Blueprint obtained by round-trip (template/existing), not hand-written.
- [ ] `blueprint` and `scheduling` sent as JSON **strings**; `teamId` set.
- [ ] Credentials referenced by connection id — no secrets in the blueprint.
- [ ] Dry-ran with `/run` and inspected output before `/start`.
- [ ] Blueprint exported to a file before any `DELETE`.
- [ ] For MCP: right transport for run length (`/stream`|`/sse` if >60 s), and
      manager tools confirmed present only if the plan is paid.

## References

- `references/api-v2-cheatsheet.md` — endpoints, auth, scopes, rate limits, the
  common response envelope, and error codes.
- `references/blueprint-round-trip.md` — the GET→mutate→POST recipe in depth,
  blueprint anatomy, and the stringify gotcha.
- `references/make-mcp-and-auth.md` — MCP transports, tool tiers, client configs,
  and the token-vs-OAuth decision.
