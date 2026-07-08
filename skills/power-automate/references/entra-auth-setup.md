# Entra ID / OAuth2 setup for the Dataverse Web API

The Dataverse Web API accepts only OAuth2 bearer tokens from **Microsoft Entra ID**. Two flows:

- **Delegated (a user signs in)** — the token carries a real user's permissions. Scope:
  `{PA_DATAVERSE_URL}/user_impersonation`. Good for local/interactive work.
- **Application / service principal (client credentials)** — no user; a headless identity for CI.
  Scope: `{PA_DATAVERSE_URL}/.default`. This is the CI-friendly path and what the SKILL curl uses.

The **token audience is your org's Dataverse URL** (`PA_DATAVERSE_URL`), not Graph, not
`api.flow.microsoft.com`.

## App registration (both flows)

1. Entra admin center → **App registrations → New registration**. Note the **Application (client)
   ID** (`PA_CLIENT_ID`) and **Directory (tenant) ID** (`PA_TENANT_ID`).
2. **API permissions → Add → Dynamics CRM → `user_impersonation`** (delegated). Grant admin consent.
3. For the service-principal flow, create a **client secret** (`PA_CLIENT_SECRET`) under
   *Certificates & secrets*. (A certificate is preferable in production; a secret is fine to start.)

## Dataverse application user (service-principal flow only)

A service principal cannot touch Dataverse until it exists there as an **application user**:

1. Power Platform admin center → your **environment → Settings → Users + permissions →
   Application users → New app user**.
2. Add the app registration by its **client ID**.
3. Assign a **security role** with privileges on the Process (`workflow`) table (e.g. a role that can
   read/create/write/delete processes, such as *System Customizer* scoped appropriately, or a custom
   role). Without a role every call returns `403`.

## Get a token

Delegated (device code / auth code — pattern shown as client-credentials substitute for headless):

```bash
# Service principal (client credentials)
curl -s -X POST "https://login.microsoftonline.com/$PA_TENANT_ID/oauth2/v2.0/token" \
  -d "grant_type=client_credentials" \
  -d "client_id=$PA_CLIENT_ID" \
  -d "client_secret=$PA_CLIENT_SECRET" \
  -d "scope=$PA_DATAVERSE_URL/.default"
# → { "access_token": "...", "expires_in": 3599, "token_type": "Bearer" }
```

For the delegated flow use the same `/oauth2/v2.0/token` endpoint with `grant_type=authorization_code`
(after an interactive `/authorize` redirect) and `scope={PA_DATAVERSE_URL}/user_impersonation
offline_access`. Tokens last ~1 hour; cache and refresh — do not mint one per request.

## `.env`

```
PA_DATAVERSE_URL=https://contoso.crm.dynamics.com   # no trailing slash, no /api/data/...
PA_TENANT_ID=<tenant-guid>
PA_CLIENT_ID=<app-client-id>
PA_CLIENT_SECRET=<app-secret>                        # service-principal flow only
```

Never commit the secret; never inline it in a flow definition or a script.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | wrong scope/audience, or expired token | scope must be `{PA_DATAVERSE_URL}/.default` (app) or `/user_impersonation` (delegated); re-acquire |
| `403 Forbidden` on every call | app user missing, or no security role | create the Dataverse application user and assign a role with `workflow` privileges |
| `403` only on some flows | those are My Flows / outside your solution | only solution-aware flows are code-manageable |
| `AADSTS700016` | client ID not found in tenant | check `PA_TENANT_ID` / `PA_CLIENT_ID` |
| token works for Graph, `401` here | audience is Graph, not Dataverse | request the token for the Dataverse resource, not Graph |

## Generic client engineering

Token caching/refresh, retry/backoff on `429`, and pagination via `@odata.nextLink` are generic
concerns — build them once with `../../api-connector-builder/SKILL.md` rather than re-inventing per
script. This skill uses the endpoints; that skill engineers the client around them.
