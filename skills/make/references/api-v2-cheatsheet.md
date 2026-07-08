# Make API v2 — cheat-sheet

Current as of July 2026. Endpoints and query keys are **case-sensitive** and
every call is **zoned**. Verify anything you depend on at
[developers.make.com](https://developers.make.com/api-documentation) at author time.

## Base URL & auth

```
https://{zone}.make.com/api/v2
```

- `{zone}` ∈ `eu1 | eu2 | us1 | us2` (plus `celonis` for that deployment). The
  wrong zone returns an **authentication error** even with a valid token — this
  is the single most common Make API mistake.
- Header: `Authorization: Token {MAKE_API_TOKEN}` — literal `Token`, a space,
  the token. OAuth2 exists for multi-user apps.
- Content type for writes: `Content-Type: application/json`.

## Token scopes (frozen at creation)

Mint the token in **Profile → API/SDK**. You pick scopes **once**; they cannot
be widened afterward — a too-narrow token means minting a new one. Grant only
what you use, e.g. `scenarios:read scenarios:write connections:read
connections:write hooks:read hooks:write datastores:read datastores:write
teams:read organizations:read`.

## Response envelope

Most responses wrap the payload under a root key named for the resource, e.g.
`{ "scenario": {...} }`, `{ "scenarios": [...] }`, `{ "response": { "blueprint": {...} } }`.
Extract with `jq '.scenario'` etc. **Confirm the exact wrapper per endpoint at
author time** — a few endpoints differ.

## Endpoint map

### Scenarios (the core)

| Method | Path | Notes |
|---|---|---|
| GET | `/scenarios?teamId={id}` | list; paginate with `pg[limit]` / `pg[offset]` |
| POST | `/scenarios` | body: `teamId` (int), `blueprint` (**string**), `scheduling` (**string**); optional `folderId`, `basedon` |
| GET | `/scenarios/{id}` | metadata (not the blueprint) |
| PATCH | `/scenarios/{id}` | update — send `blueprint`/`scheduling`/`name` as strings |
| DELETE | `/scenarios/{id}` | **permanent, no trash** — export blueprint first |
| GET | `/scenarios/{id}/blueprint` | the editable JSON (round-trip source) |
| POST | `/scenarios/{id}/start` | activate scheduled execution |
| POST | `/scenarios/{id}/stop` | deactivate |
| POST | `/scenarios/{id}/run` | one manual run; `{"responsive":true}` waits for result |
| POST | `/scenarios/{id}/clone` | body `{teamId, name}` — copy into a team |

### Connections

`GET/POST /connections`, `GET/DELETE /connections/{id}`,
`POST /connections/{id}/test`. Modules reference a connection **by id** for app
auth — the blueprint holds the id, never the secret.

### Hooks (Make's inbound webhooks/mailhooks)

`GET/POST /hooks`, `GET/DELETE /hooks/{id}`, `POST /hooks/{id}/ping`,
`POST /hooks/{id}/learn-start` / `learn-stop` (structure learning). This is
Make's *own* webhook receiver; building an inbound endpoint in **your** app is
the `webhooks` skill.

### Data stores

`GET/POST /data-stores`, `GET/DELETE /data-stores/{id}`,
`GET/POST/DELETE /data-stores/{id}/data`. The idiomatic place for dedup keys and
cross-run state (see `automation-flows` for the dedup pattern).

### Templates

`GET /templates`, `GET /templates/{id}/blueprint`. A published template's
blueprint is the cleanest round-trip starting point.

### Teams & organizations

`GET /teams?organizationId={id}`, `GET /organizations/{id}`. Read your real
rate ceiling: `GET /organizations/{id}` → `license.apiLimit`.

## Rate limits (req/min, per plan)

| Plan | Limit |
|---|---|
| Core | 60 |
| Pro | 120 |
| Teams | 240 |
| Enterprise | 1000 |

Don't hard-code it — read `license.apiLimit` from your own org. On `429`, back
off and retry (generic retry/backoff engineering: `api-connector-builder`).

## Scheduling string

`scheduling` is a JSON **string**. Common shapes (verify fields at author time):

```json
{"type":"on-demand"}
{"type":"indefinitely","interval":900}   // interval in seconds
```

`on-demand` scenarios run only via `/run` or a webhook trigger; `indefinitely`
runs on the interval once `/start`ed.

## Errors you will actually hit

| Symptom | Cause | Fix |
|---|---|---|
| Auth error with a valid token | wrong `{zone}` | match the org's zone |
| 400 on create | `blueprint`/`scheduling` sent as objects | stringify them |
| 400 naming a module/field | malformed blueprint | fix that node, re-POST |
| 403 on a valid endpoint | token missing that scope | re-mint with the scope |
| 404 on a path that should exist | wrong case in the path | fix casing |
| 429 | over plan rate limit | back off; read `apiLimit` |
