---
name: google-workspace
description: "Use when server-side code reads or writes Gmail, Drive, Calendar, or Sheets with a GCP service account and no human in the OAuth loop: picking the auth mode (app-owned vs domain-wide delegation vs keyless), scoping to least privilege, building the authed Node/Python client, staying under per-user quota, and debugging unauthorized_client / 403 / 429. NOT SMTP providers or deliverability (that is `email-connector`), NOT slot-finding and booking UX (that is `calendar-scheduling`)."
tags: [google-workspace, gmail-api, drive-api, calendar-api, sheets-api, service-account, domain-wide-delegation, oauth-scopes]
recommends: [email-connector, calendar-scheduling, spreadsheet-ops, document-processing, automation-flows, secure-coding, webhooks]
origin: risco
---

# Google Workspace — auth + calling Gmail/Drive/Calendar/Sheets

This skill owns one layer: **authenticating to and calling the four Google
Workspace REST APIs from server-side code.** Everything here is service-account
/ machine auth — if a real user must click "Allow", that is interactive OAuth and
out of scope.

Where the neighbouring layers live:

| Not this skill | Goes to | This skill's slice |
|---|---|---|
| SMTP/provider choice, transactional/marketing sends | `email-connector` | Gmail-the-API inside a Workspace mailbox |
| SPF/DKIM, inbox placement | `email-deliverability` | — |
| Availability search, booking-link UX, timezone-as-a-feature | `calendar-scheduling` | Raw Calendar event CRUD underneath |
| Sheet data modeling, formulas, pivots | `spreadsheet-ops` | Sheets API read/write transport |
| Doc/PDF parsing, extraction, OCR | `document-processing` | Drive as storage transport (upload/download/move/permissions) |
| Chaining several connectors into one flow | `automation-flows` | The individual Google calls |
| Notion as the backend / generic REST wrapping | `notion-connector`, `api-connector-builder` | — |
| Receiving Gmail/Drive push notifications | `webhooks` | — |

## Pick your auth mode

Choose first — it dictates scopes, the Admin-console step, and the client build.

| Situation | Mode | Why |
|---|---|---|
| App owns the data (its own Drive folder, its own calendar, a shared drive it was added to) | Service account, **no** delegation | The SA is its own identity; no need to act as a human. Simplest, no Admin step. |
| Must act AS each Workspace user (send from `ops@acme.com`, read their inbox/calendar) | Service account + **domain-wide delegation** + `subject` | Gmail has no "shared mailbox via SA" — to touch a user's mail/calendar you impersonate them. Requires a Workspace admin to authorize the SA. |
| Code runs on GCP (Cloud Run, GKE, Functions) or CI with WIF | **Keyless**: Application Default Credentials / Workload Identity Federation | No long-lived key file to leak or rotate. The runtime mints short-lived tokens. Always prefer this when the platform supports it. |

Rule: **never reach for domain-wide delegation if app-owned resources suffice.**
DWD lets the SA impersonate *anyone* in the org for the granted scopes — it is a
large blast radius. Use it only when you genuinely must act as the user.

## Setup checklist

Do these in order. `references/auth-setup.md` has the full Cloud + Admin
click-path, the scope catalog, DWD authorization, keyless WIF/ADC, and a longer
troubleshooting matrix.

1. **Enable the APIs** you will call in the Cloud console (Gmail, Drive,
   Calendar, Sheets) for the project. A disabled API returns `403` regardless of
   scopes.
2. **Create the service account** in IAM & Admin → Service Accounts. For keyless
   you stop here and attach the SA to the runtime; for a key you create a JSON
   key (and treat it like a password — see Security).
3. **Decide scopes** (next section) — the exact scope *strings* you will request.
4. **Authorize DWD only if impersonating.** In the Admin console →
   Security → Access and data control → API controls → **Manage Domain Wide
   Delegation**, add the SA's **client ID** (the numeric `client_id`, not the
   email) plus the **exact** comma-separated scope list. A scope requested in
   code but not authorized here is the #1 cause of `unauthorized_client`.

## Scopes: least privilege

Request the narrowest scope that does the job. Broad scopes also force a stricter
Google verification review and widen what a leaked key can touch.

```text
# Bad — full read/write to ALL of the user's Drive
https://www.googleapis.com/auth/drive

# Good — only files this app created or was explicitly shared
https://www.googleapis.com/auth/drive.file
```

| Task | Scope | Note |
|---|---|---|
| Send mail only | `gmail.send` | Cannot read the inbox — ideal for notifications. |
| Read mail | `gmail.readonly` | Read, no modify/delete. |
| Modify labels/state | `gmail.modify` | Avoid full `mail.google.com` unless you truly need delete + settings. |
| App-created Drive files | `drive.file` | Cannot see the user's other files — smallest footprint. |
| Read all Drive | `drive.readonly` | Prefer over full `drive`. |
| Calendar events | `calendar.events` | Narrower than full `calendar`. |
| Read/write Sheets | `spreadsheets` | Use `spreadsheets.readonly` if you only read. |

## Build the authed client

Node uses `googleapis` (latest 173.x, maintenance mode — bugs/security only) with
`google-auth-library` (10.6.2). Python uses `google-auth` +
`google-api-python-client`. The impersonation line is the `subject` / `with_subject`.

```javascript
// Node — service account, optionally impersonating a Workspace user.
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.SA_CLIENT_EMAIL,
  key: process.env.SA_PRIVATE_KEY.replace(/\\n/g, '\n'), // from secret mgr, never a file in the repo
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
  subject: 'ops@acme.com', // omit this line for app-owned (no-delegation) mode
});
const gmail = google.gmail({ version: 'v1', auth });
```

```javascript
// Node — keyless on GCP (Cloud Run / GKE / CI with WIF). No key in code at all.
import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });
```

```python
# Python — service account from credentials, impersonating a user.
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
creds = service_account.Credentials.from_service_account_info(
    sa_info, scopes=SCOPES         # sa_info loaded from secret mgr, not a tracked file
).with_subject("ops@acme.com")     # drop .with_subject(...) for app-owned mode
gmail = build("gmail", "v1", credentials=creds, cache_discovery=False)
```

## Per-API recipes (short)

Copy-paste-ready minimums. Longer recipes (raw MIME with attachments, resumable
uploads, `batchUpdate`, recurring/timezone-correct events) are in
`references/api-recipes.md`.

```javascript
// Gmail: send. Body must be base64url-encoded RFC 822 (note -_ , no padding).
const raw = Buffer.from(
  'To: a@acme.com\r\nSubject: Report\r\n\r\nHello.'
).toString('base64url');
await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
```

```javascript
// Drive: create a file, then grant read to one person (least-privilege share).
const file = await drive.files.create({
  requestBody: { name: 'report.pdf' },
  media: { mimeType: 'application/pdf', body: stream },
  fields: 'id', // partial response — ask only for what you use
});
await drive.permissions.create({
  fileId: file.data.id,
  requestBody: { role: 'reader', type: 'user', emailAddress: 'a@acme.com' },
});
```

```python
# Calendar: insert an event (always send explicit IANA timeZone).
event = {
    "summary": "Sync",
    "start": {"dateTime": "2026-06-10T10:00:00", "timeZone": "Europe/Andorra"},
    "end":   {"dateTime": "2026-06-10T10:30:00", "timeZone": "Europe/Andorra"},
}
cal.events().insert(calendarId="primary", body=event).execute()
```

```python
# Sheets: write a range. Use values.batchUpdate to write many ranges in one call.
sheets.spreadsheets().values().update(
    spreadsheetId=SID, range="Sheet1!A2",
    valueInputOption="USER_ENTERED",
    body={"values": [["2026-06-02", 1290]]},
).execute()
```

## Stay under quota

The per-user ceiling is the one that bites a cron looping over a mailbox.

- **Gmail:** 1.2M units/min per project, **6,000 units/min per user**, 80M
  units/day. Costs: `messages.send` 100, `messages.get` 20, `messages.list` 5,
  `messages.modify` 5, `drafts.create` 10. Hard cap **500 recipients/message**.
- **Drive:** 1M units/min per project, **325,000 units/min per user**, 1 TB/day
  egress.
- **Sheets:** read and write each 300/min per project, **60/min per user**; 429
  on overage; 180s request timeout; keep payloads under ~2 MB.
- **Policy shift:** as of 2026-05-01 Google updated Workspace quota policy —
  projects active Nov 2025–Apr 2026 keep legacy quotas, new projects get the new
  model, and overage will start incurring Cloud billing charges later in 2026.
  Treat quota as a cost line, not a free ceiling.

Three habits keep you under it:

1. **`fields` partial responses** — ask only for the fields you read; smaller
   responses, lower cost, faster.
2. **Batch** — Sheets `values.batchUpdate`, Gmail batch requests, Drive batch —
   one call instead of N cuts per-user request count directly.
3. **Exponential backoff with jitter** on `403 rateLimitExceeded` and `429` —
   retrying immediately just burns more quota.

```python
# Backoff: min((2^n) + random_ms, max_backoff). Cap 32–64s. Jitter avoids
# thundering-herd retries syncing up.
import random, time
from googleapiclient.errors import HttpError

def with_backoff(call, max_retries=6, max_backoff=64):
    for n in range(max_retries):
        try:
            return call()
        except HttpError as e:
            if e.resp.status not in (403, 429) or n == max_retries - 1:
                raise
            time.sleep(min((2 ** n) + random.random(), max_backoff))
```

## Security rules

- **Never commit the SA key JSON.** It is a long-lived bearer credential — a
  committed `service_account.json` is game over. Add `*.json` SA patterns to
  `.gitignore`; the `verify.sh` here flags tracked keys.
- **Prefer keyless.** A leaked key is the single most common Workspace credential
  compromise. On GCP/CI use ADC or Workload Identity Federation so there is no
  file to leak. If you must use a key, store it in a secret manager
  (env-injected, not a file beside the code) and rotate it.
- **Least scope.** A leaked `drive.file` key sees app files; a leaked full
  `drive` key sees everything. The scope IS the blast radius.
- **Map the error before you change anything:**

| Error | Likely cause | Fix |
|---|---|---|
| `unauthorized_client` | SA client ID / scope not authorized for DWD | Add the client ID + **exact** scopes in Admin console Manage DWD |
| `403 insufficient permissions` | Scope too narrow, or API not enabled | Widen to the right scope (still least), enable the API |
| `403 rateLimitExceeded` / `429` | Per-user or per-project quota hit | Exponential backoff + jitter; batch; spread load |
| `400 failedPrecondition` on impersonation | `subject` set but DWD not configured | Either remove `subject` (app-owned) or finish DWD setup |
| `invalid_grant` | Clock skew or stale/rotated key | Sync clock; re-issue the key |

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| Committing `service_account.json` to the repo | Long-lived key in git history = full compromise; can't un-leak | Keyless ADC/WIF, or key in a secret manager + `.gitignore` |
| Requesting `auth/drive` / `mail.google.com` "to be safe" | Max blast radius, stricter Google review, more to leak | Narrowest scope: `drive.file`, `gmail.send`, `spreadsheets.readonly` |
| Using DWD `subject` for app-owned data | Impersonating users when the SA could own the resource — needless blast radius + an Admin dependency | Drop `subject`; let the SA own the folder/calendar/shared drive |
| Looping `messages.send`/`values.update` per row with no backoff | Trips the 6k/min (Gmail) or 60/min (Sheets) per-user cap → 429 storm | Batch (`values.batchUpdate`) + exponential backoff with jitter |
| Reading whole resources without `fields` | Bigger payloads, higher quota cost, slower | Request only the fields you use (`fields: 'id'`) |
| Hardcoding the private key inline in source | Can't rotate, leaks via logs/screenshots/history | Inject from env/secret manager; `\n`-unescape at load |
| Pasting raw text into Gmail `raw` | API needs base64url RFC 822, not plain text → 400 | Build a MIME message, `base64url`-encode it |

Before this connector ships, run the secret-handling and key-rotation pass in
`../secure-coding/SKILL.md`.
