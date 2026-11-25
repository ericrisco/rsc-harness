# API recipes — extended Node + Python

Longer, copy-paste recipes that did not fit in SKILL.md. All assume an authed
client built per SKILL.md "Build the authed client". Versions as of 2026-11-25:
`googleapis` latest 190.x (maintenance mode), `google-auth-library` 11.x.

## Gmail — raw MIME with an attachment

Gmail's `messages.send` wants a base64url-encoded RFC 822 message. For
attachments you build a `multipart/mixed` MIME body.

```python
# Python — MIME with one attachment, base64url-encoded.
import base64
from email.message import EmailMessage

msg = EmailMessage()
msg["To"] = "a@acme.com"
msg["From"] = "ops@acme.com"
msg["Subject"] = "Monthly report"
msg.set_content("Report attached.")
with open("report.pdf", "rb") as f:
    msg.add_attachment(
        f.read(), maintype="application", subtype="pdf", filename="report.pdf"
    )
raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
gmail.users().messages().send(userId="me", body={"raw": raw}).execute()
```

Hard cap: 500 recipients per message. For bulk, fan out in batches and keep the
per-user 6,000 units/min ceiling in mind (`send` costs 100 units each → ~60
sends/min/user before you risk 429).

## Drive — resumable upload of a large file

Use a resumable upload for anything large or over a flaky connection.

```javascript
// Node — resumable upload. googleapis handles the resumable protocol.
import fs from 'node:fs';
const res = await drive.files.create(
  {
    requestBody: { name: 'big.zip' },
    media: { mimeType: 'application/zip', body: fs.createReadStream('big.zip') },
    fields: 'id',
  },
  { /* per-call options */ },
);
```

To upload into a **shared drive**, set `supportsAllDrives: true` and pass the
parent folder id; `drive.file` scope lets the app manage files it created there.

## Sheets — batch read and write

One `values.batchUpdate` beats N single `update` calls against the 60/min
per-user limit.

```javascript
// Node — write several ranges in a single call.
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SID,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Sheet1!A2', values: [['2026-06-02', 1290]] },
      { range: 'Sheet1!A3', values: [['2026-06-03', 1310]] },
    ],
  },
});
```

```python
# Python — append rows (auto-finds the next empty row).
sheets.spreadsheets().values().append(
    spreadsheetId=SID, range="Sheet1!A1",
    valueInputOption="USER_ENTERED",
    insertDataOption="INSERT_ROWS",
    body={"values": [["2026-06-02", 1290], ["2026-06-03", 1310]]},
).execute()
```

```python
# Python — batch READ many ranges in one request (cheaper than N gets).
res = sheets.spreadsheets().values().batchGet(
    spreadsheetId=SID, ranges=["Sheet1!A:A", "Sheet2!B2:B"],
).execute()
```

Keep request payloads under ~2 MB and expect a 180s server timeout per request.

## Calendar — recurring, timezone-correct events

Always send an explicit IANA `timeZone`; never rely on the server default. Use
RFC 5545 `RRULE` for recurrence.

```python
# Python — weekly recurring event, 8 occurrences, explicit timezone.
event = {
    "summary": "Weekly sync",
    "start": {"dateTime": "2026-06-10T10:00:00", "timeZone": "Europe/Andorra"},
    "end":   {"dateTime": "2026-06-10T10:30:00", "timeZone": "Europe/Andorra"},
    "recurrence": ["RRULE:FREQ=WEEKLY;COUNT=8"],
    "attendees": [{"email": "a@acme.com"}],
}
cal.events().insert(
    calendarId="primary", body=event, sendUpdates="all"
).execute()
```

## Gmail — watch / push notifications

To get pushed mail events instead of polling, `users.watch` publishes change
notifications to a Cloud Pub/Sub topic; your endpoint receives them. The
delivery/handling side (verifying and processing the push) is the `webhooks`
sibling's territory — this skill only sets up the `watch`.

```javascript
// Node — start watching the mailbox; renew before the ~7-day expiry.
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/PROJECT/topics/gmail-events',
    labelIds: ['INBOX'],
  },
});
```

## Backoff helper (shared)

Wrap every quota-sensitive call. Retries only on `403 rateLimitExceeded` / `429`;
re-raises everything else immediately.

```javascript
// Node — exponential backoff with jitter, cap 64s.
async function withBackoff(call, { maxRetries = 6, maxBackoff = 64 } = {}) {
  for (let n = 0; ; n++) {
    try {
      return await call();
    } catch (e) {
      const status = e?.code ?? e?.response?.status;
      if ((status !== 403 && status !== 429) || n >= maxRetries - 1) throw e;
      const wait = Math.min(2 ** n + Math.random(), maxBackoff);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}
```
