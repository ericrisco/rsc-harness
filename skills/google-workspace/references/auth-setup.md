# Auth setup — full walkthrough

The end-to-end path from a fresh GCP project to a working authed client, plus the
complete scope catalog, domain-wide delegation authorization, keyless setup, and
a troubleshooting matrix. Facts current as of 2026-06-02.

## 1. Enable the APIs

In the Cloud console, for the project that owns the service account, enable each
API you will call:

- **Gmail API**
- **Google Drive API**
- **Google Calendar API**
- **Google Sheets API**

A disabled API returns `403` (`accessNotConfigured` / `SERVICE_DISABLED`) no
matter how the scopes or delegation are set. Enable first, debug later.

## 2. Create the service account

IAM & Admin → Service Accounts → Create. You get an account with:

- `client_email` — `name@project.iam.gserviceaccount.com`, the SA's identity.
- a numeric **`client_id`** — used for the DWD authorization step (NOT the email).

Two ways to give code its credentials:

- **Keyless (preferred):** attach the SA to the runtime (Cloud Run/GKE/Functions)
  or federate from CI via Workload Identity Federation. No key file exists.
- **JSON key:** Service Account → Keys → Add key → JSON. This downloads a
  long-lived private key. Treat it like a root password: never commit it, store
  it in a secret manager, rotate it.

## 3. Scope catalog

Request the narrowest scope that does the job. Common ones:

| API | Scope | Grants |
|---|---|---|
| Gmail | `gmail.send` | Send only; no inbox read |
| Gmail | `gmail.readonly` | Read messages/labels; no modify |
| Gmail | `gmail.modify` | Read + modify labels/state; no settings/delete-all |
| Gmail | `gmail.labels` | Manage labels only |
| Gmail | `mail.google.com/` | Full mailbox incl. permanent delete — avoid unless required |
| Drive | `drive.file` | Only files this app created or was shared into |
| Drive | `drive.readonly` | Read all of the user's Drive |
| Drive | `drive` | Full read/write to all Drive — broad, avoid by default |
| Drive | `drive.metadata.readonly` | Metadata only, no content |
| Calendar | `calendar.events` | Read/write events |
| Calendar | `calendar.readonly` | Read events/calendars |
| Calendar | `calendar` | Full calendar management |
| Sheets | `spreadsheets.readonly` | Read values/metadata |
| Sheets | `spreadsheets` | Read + write values and structure |

Picking a broad scope (`drive`, full Gmail) also triggers Google's stricter app
verification and restricted-scope review. Narrow scopes ship faster.

## 4. Domain-wide delegation (only if impersonating users)

You only need this when the SA must act AS a Workspace user (send from their
address, read their inbox/calendar). App-owned resources need none of it.

1. Note the SA's numeric **client ID** (step 2).
2. Admin console → Security → Access and data control → API controls →
   **Manage Domain Wide Delegation** → Add new.
3. Enter the **client ID** and a **comma-separated list of the exact scope
   strings** your code requests. They must match character-for-character.
4. In code set `subject` (Node) / `.with_subject(...)` (Python) to the email of
   the user to impersonate.

A scope your code requests that is missing from this list → `unauthorized_client`.
Adding or removing a scope in code means updating this list too.

## 5. Keyless: ADC and Workload Identity Federation

Downloaded JSON keys are long-lived, leak-prone, and a top GCP credential-exposure
source. Prefer keyless:

- **ADC on GCP runtimes:** attach the SA to Cloud Run/GKE/Functions. The
  metadata server mints short-lived tokens; `GoogleAuth` / ADC picks them up
  automatically — no key in code or env.
- **Workload Identity Federation (CI / non-GCP):** federate your CI's OIDC
  identity (e.g. GitHub Actions) to impersonate the SA without a stored key. The
  provider exchanges a short-lived OIDC token for SA credentials.

Both eliminate the static secret. Reserve JSON keys for environments that
genuinely cannot federate, and then secret-manage + rotate them.

## 6. Troubleshooting matrix

| Symptom | Cause | Fix |
|---|---|---|
| `unauthorized_client` | Client ID/scope not authorized for DWD | Add client ID + exact scopes in Manage DWD |
| `403 accessNotConfigured` / `SERVICE_DISABLED` | API not enabled on the project | Enable it in the Cloud console |
| `403 insufficient permissions` | Scope too narrow for the call | Use the correct (still least) scope |
| `400 failedPrecondition` ("Precondition check failed") | Gmail called as the bare SA, no `subject` — an SA has no mailbox | Set `subject` to a Workspace user and authorize DWD |
| `invalid_grant` | Clock skew, or rotated/revoked key | Sync clock (NTP); re-issue key |
| `404` on a user's resource via SA, no DWD | SA can't see resources it doesn't own | Share the resource to the SA, or impersonate via DWD |
| `403 rateLimitExceeded` / `429` | Per-user/project quota hit | Exponential backoff + jitter; batch; spread load |
