---
name: youtube-api
description: "Use when connecting a real YouTube channel to code via the Data API v3 (uploads, metadata) and Analytics API v2 (performance) — OAuth, resumable video upload, editing title/description/tags/privacy after publish, pulling views/watch time/averageViewPercentage/retention/traffic sources — and logging that performance into 02-DOCS/wiki/youtube/ as a dated feedback log. Triggers: 'upload a video to my channel via the API and set its tags', 'videos.insert returns 403 quotaExceeded / uploadLimitExceeded', 'my YouTube refresh token keeps dying after about 7 days', 'pull the audienceWatchRatio retention curve for video X', 'fetch this month's traffic sources and write them into the wiki', 'subir vídeos a YouTube por API y guardar las estadísticas del canal', 'treure les estadístiques del canal i guardar-les al wiki'. NOT what-to-publish or how-to-package it (that is youtube-strategy / youtube-packaging)."
tags: [youtube, youtube-data-api, youtube-analytics-api, oauth2, resumable-upload, video-metadata, audience-retention, channel-feedback-log]
recommends: [social-publisher, api-connector-builder, automation-flows, knowledge-ops]
origin: risco
---

# YouTube API — Transport + Ingestion for a Real Channel

*You own the wire: authenticate to a YouTube channel, upload and edit videos, pull the numbers, and write those numbers into the wiki as a durable feedback log. You do not decide what to make or how to title it — that is the strategy/packaging family. Deliver clean transport and a queryable log; let the siblings interpret.*

YouTube has **two separate APIs** and you will touch both:

- **Data API v3** — `https://www.googleapis.com/youtube/v3` — the *write* side: `videos.insert` (upload), `videos.update` (edit metadata), `thumbnails.set`. Default quota: a shared 10,000 units/day pool *plus* separate per-day caps of ~100 uploads and ~100 `search.list` calls (see §7).
- **Analytics API v2** — `https://youtubeanalytics.googleapis.com/v2/reports` — the *read* side: views, watch time, retention, traffic sources. Separate scopes, separate quota.

Auth is **user OAuth 2.0, not a service account.** A human owns the channel; you act on their behalf with a refresh token. A service account cannot own a YouTube channel — if you reach for one, stop. (Service-account Google auth for Gmail/Drive/Sheets is `google-workspace`, a different model.)

## When to use / When NOT

Use when:

- Wiring a script or agent to upload to a channel (`videos.insert`), set metadata, schedule a publish, or set a custom thumbnail.
- Editing an existing video's title/description/tags/privacy after publish (`videos.update`).
- Pulling channel or per-video stats: views, `estimatedMinutesWatched`, `averageViewPercentage`, the audience-retention curve, the traffic-source breakdown.
- Building the recurring "fetch performance → write to `02-DOCS/wiki/youtube/`" loop that turns API responses into a channel feedback log.
- Debugging `403 quotaExceeded`, `uploadLimitExceeded` (429), `401 invalid_credentials`, scope errors, or a refresh token that dies after a week.

Do NOT use when (route to the sibling that owns it):

| You actually want | Go to |
| --- | --- |
| What videos to make / niche / cadence / growth plan | `youtube-strategy` *(catalog id)* |
| Video ideas, hooks, a topic backlog | `youtube-ideation` *(catalog id)* |
| Title + thumbnail packaging, CTR copy, A/B framing | `youtube-packaging` *(catalog id)* |
| The thumbnail image itself | `../youtube-thumbnails/SKILL.md` |
| Render/produce the actual video file in code | `../remotion-video/SKILL.md` |
| Post one asset across many networks at once | `../social-publisher/SKILL.md` |
| Wrap an arbitrary REST provider with OAuth + retries | `api-connector-builder` *(catalog id)* |
| Chain upload → Notion row → Slack across tools | `automation-flows` *(catalog id)* |
| Service-account auth to Gmail/Drive/Sheets | `google-workspace` *(catalog id)* |

One line: **this skill authenticates, calls, and ingests the two YouTube APIs into the wiki. What to publish and how to package it belong to the youtube-strategy / youtube-ideation / youtube-packaging siblings.**

## 1. One-time setup (do this before any code)

A checklist, because each missing step produces a distinct, confusing error later:

1. Create (or pick) a **GCP project**.
2. **Enable both APIs** in that project: "YouTube Data API v3" *and* "YouTube Analytics API". Enabling one is the most common cause of a `403 ... has not been used in project` on the other.
3. Configure the **OAuth consent screen** and **publish it to "In production."** Why: an app left in "Testing" status issues refresh tokens that **expire in 7 days** — your cron silently dies the following week. This is the single most common YouTube-ingestion breakage.
4. Create an **OAuth client**: *Desktop app* for a personal/local script, *Web application* (with an exact redirect URI) for a hosted app.
5. Request **least-privilege scopes** — not the full management scope.

Scope table — request only what the job needs:

| Scope | Grants | Use for |
| --- | --- | --- |
| `https://www.googleapis.com/auth/youtube.upload` | Upload videos | `videos.insert` |
| `https://www.googleapis.com/auth/youtube.force-ssl` | Manage/edit/delete | `videos.update`, `thumbnails.set` |
| `https://www.googleapis.com/auth/yt-analytics.readonly` | Read performance | Analytics reports |
| `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` | Read revenue metrics | only if you pull `estimatedRevenue` etc. |

Bad → Good on scopes:

```text
Bad:  scopes = ["https://www.googleapis.com/auth/youtube"]   # full account control
Good: scopes = ["https://www.googleapis.com/auth/youtube.upload",
                "https://www.googleapis.com/auth/youtube.force-ssl",
                "https://www.googleapis.com/auth/yt-analytics.readonly"]
```

Full GCP + consent-screen walkthrough, Desktop-vs-Web choice, and `unauthorized_client` / `access_denied` / redirect-URI troubleshooting live in `references/oauth-setup.md`.

## 2. Get an authed client and keep the token alive

Build both service clients from **one** set of OAuth credentials.

```python
# python: google-api-python-client + google-auth-oauthlib
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import json, os
from google.oauth2.credentials import Credentials

SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.force-ssl",
          "https://www.googleapis.com/auth/yt-analytics.readonly"]
TOKEN = "token.json"   # gitignored — holds the refresh_token

def creds():
    c = Credentials.from_authorized_user_file(TOKEN, SCOPES) if os.path.exists(TOKEN) else None
    if not c or not c.valid:
        if c and c.expired and c.refresh_token:
            c.refresh(Request())               # silent renewal — needs "In production" app
        else:
            c = InstalledAppFlow.from_client_secrets_file(
                "client_secret.json", SCOPES).run_local_server(port=0)
        with open(TOKEN, "w") as f:
            f.write(c.to_json())
    return c

c = creds()
data = build("youtube", "v3", credentials=c)
yta  = build("youtubeAnalytics", "v2", credentials=c)
```

```javascript
// node: googleapis + google-auth-library
import { google } from "googleapis";
import fs from "node:fs";

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2.setCredentials(JSON.parse(fs.readFileSync("token.json", "utf8"))); // { refresh_token, ... }
oauth2.on("tokens", (t) => {                 // persist the refreshed token
  if (t.refresh_token) fs.writeFileSync("token.json", JSON.stringify(t));
});
const data = google.youtube({ version: "v3", auth: oauth2 });
const yta  = google.youtubeAnalytics({ version: "v2", auth: oauth2 });
```

Rule: persist the **refresh token**, never a bare `access_token`. Access tokens expire in ~1 hour; the credential object refreshes itself. A hardcoded `access_token=...` literal is a guaranteed 401 within the hour — and is exactly what `verify.sh` flags.

## 3. Upload a video (resumable, always)

Decision: any file over a few MB → use the **resumable** protocol. A plain multipart POST drops the whole upload on one network hiccup; resumable survives it.

The protocol is two steps:

1. **Init the session** — POST to the upload endpoint with `uploadType=resumable` and the metadata body. The response `Location` header is your session URL.
2. **PUT the bytes** to that session URL — one shot or in chunks. On a dropped connection, query with `Content-Range: bytes */*`; the server returns the byte offset already received, and you resume from there.

The client libraries do this for you via a media-upload helper:

```python
from googleapiclient.http import MediaFileUpload

body = {
  "snippet": {"title": "Ep. 14", "description": "...", "tags": ["x", "y"], "categoryId": "27"},
  "status":  {"privacyStatus": "private", "publishAt": "2026-06-10T15:00:00Z",
              "selfDeclaredMadeForKids": False},
}
media = MediaFileUpload("ep14.mp4", chunksize=8 * 1024 * 1024, resumable=True)
req = data.videos().insert(part="snippet,status", body=body, media_body=media)
resp = None
while resp is None:
    status, resp = req.next_chunk()          # resumes automatically on a transient drop
video_id = resp["id"]
data.thumbnails().set(videoId=video_id, media_body=MediaFileUpload("ep14.jpg")).execute()
```

Two separate limits, not one — and uploads no longer come out of the 10k unit pool. As of the official quota docs (Last updated 2026-06-01 UTC, `https://developers.google.com/youtube/v3/getting-started`), a project's default allocation is *"100 search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints."* So `videos.insert` has its **own dedicated cap of ~100 uploads/day**, charged against that allocation rather than spending ~1,600 units of the 10k pool like the older model. That ~100/day call cap is exactly what trips `uploadLimitExceeded` (429) while your 10k unit pool still looks untouched. Throttle the upload **count** against the 100/day allocation, not just the unit spend — space automated uploads out and back off on 429.

## 4. Edit metadata after publish

`videos.update` does **read-modify-write** semantics on whole parts. The trap: any field you omit inside a part you send gets **cleared**.

```python
# Bad: wipes description and tags because they aren't in the body
data.videos().update(part="snippet",
    body={"id": vid, "snippet": {"title": "New title", "categoryId": "27"}}).execute()

# Good: fetch the current snippet, change one field, send it back whole
cur = data.videos().list(part="snippet", id=vid).execute()["items"][0]["snippet"]
cur["title"] = "New title"
data.videos().update(part="snippet", body={"id": vid, "snippet": cur}).execute()
```

`categoryId` is required when you send a `snippet` part — another reason to read-modify-write. An update costs **~50 units**.

## 5. Pull performance (Analytics API v2)

Every report is `GET /v2/reports?ids=channel==MINE&startDate=&endDate=&metrics=...&dimensions=...&filters=...`. Four recipes cover the loop:

```python
# (a) Channel KPIs over a date range
yta.reports().query(ids="channel==MINE", startDate="2026-05-01", endDate="2026-05-31",
  metrics="views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage"
).execute()

# (b) Per-video KPIs
yta.reports().query(ids="channel==MINE", startDate="2026-05-01", endDate="2026-05-31",
  metrics="views,estimatedMinutesWatched,averageViewPercentage",
  filters="video==VIDEO_ID").execute()

# (c) Audience-retention curve for one video
yta.reports().query(ids="channel==MINE", startDate="2026-05-01", endDate="2026-05-31",
  metrics="audienceWatchRatio,relativeRetentionPerformance",
  dimensions="elapsedVideoTimeRatio", filters="video==VIDEO_ID").execute()

# (d) Traffic sources
yta.reports().query(ids="channel==MINE", startDate="2026-05-01", endDate="2026-05-31",
  metrics="views,estimatedMinutesWatched",
  dimensions="insightTrafficSourceType").execute()
```

Notes that save an afternoon:

- `elapsedVideoTimeRatio` runs 0.0–1.0 (playback position); `audienceWatchRatio` is the absolute retention at that point. Plot one against the other to find the drop-off.
- `insightTrafficSourceType` values include `YT_SEARCH`, `SUGGESTED`, `BROWSE`, `EXT_URL`, `NOTIFICATION`, `PLAYLIST`, `END_SCREEN`, `NO_LINK_EMBEDDED`.
- **Impressions / CTR** (`impressions`, `impressionClickThroughRate`) are **content-owner-report metrics**, not reliably available on a plain channel query. If the API returns nothing for them, fall back to the value Studio shows — do not block the pull.

Full metric+dimension catalog and copy-paste bodies for geography, device, and subscribed-status reports are in `references/analytics-queries.md`.

## 6. Ingest into the wiki — the actual deliverable

A pull that prints to stdout and vanishes is wasted. **Every pull appends a dated entry under `02-DOCS/wiki/youtube/`** so the channel's numbers become queryable history that the strategy/packaging siblings can read.

```text
02-DOCS/wiki/youtube/
  index.md                  # rolling pointer to latest snapshot + open questions
  channel-2026-05-31.md     # dated channel snapshot (one per pull)
  videos/<VIDEO_ID>.md      # per-video running log, newest entry on top
```

Per-pull entry template (OKF v0.1: non-empty `type` + the domain keys siblings parse):

```markdown
---
type: youtube-metrics
title: Channel snapshot 2026-05-31
description: Channel KPIs, traffic and retention for 2026-05-01..2026-05-31.
tags: [youtube, channel-snapshot]
timestamp: 2026-05-31T00:00:00Z
date: 2026-05-31
range: 2026-05-01..2026-05-31
channel: MINE
source: youtube-analytics-api-v2
---
## KPIs
views: 41,233 | watch_min: 88,140 | avg_view_pct: 38.2% | avg_view_dur: 0:04:11

## Traffic (top 3)
BROWSE 44% · SUGGESTED 31% · YT_SEARCH 12%

## Retention
Sharp drop 0.00→0.06 (intro), recovers, second dip ~0.55.

## What changed since last pull
avg_view_pct +2.1pts; SUGGESTED share up 6pts after the Ep.13 packaging change.
```

Rule: **append, never overwrite.** The feedback log *is* the value — overwriting yesterday's snapshot destroys the trend the siblings need. `02-DOCS/wiki/` is an OKF v0.1 bundle: keep the domain keys (`date`, `range`, `channel`, `source`) the siblings parse, add `type`/`timestamp` alongside them, use standard markdown links (never `[[wikilinks]]`), and leave the reserved `index.md` frontmatter-free. Exact file tree, naming, per-video log shape, and how siblings read the log: `references/wiki-schema.md`.

## 7. Quota & failure math

| Call | Cost / allocation |
| --- | --- |
| `videos.insert` (upload) | own daily cap: **~100 uploads/day**, not 10k-pool units |
| `search.list` | own daily cap: ~100 calls/day |
| write: `videos.update`, `thumbnails.set` | ~50 units (from the 10k pool) |
| `*.list` read | 1–5 units (from the 10k pool) |
| Analytics `reports.query` | (separate Analytics quota) |

Per the official docs (Last updated 2026-06-01 UTC, `https://developers.google.com/youtube/v3/getting-started`; per-method costs at `https://developers.google.com/youtube/v3/determine_quota_cost`), a project's default allocation is **100 `search.list` calls + 100 `videos.insert` calls + 10,000 units/day combined for all other endpoints**. Uploads and search each draw on their *own* daily call cap; everything else (writes, reads) spends the shared 10k-unit pool. All quotas reset at midnight Pacific. This is a change from the older single-pool model where `videos.insert` cost ~1,600 units — confirm the live figure on the quota-cost page before relying on it, since Google notes the allocation "is subject to change."

On `403 quotaExceeded` / `rateLimitExceeded` or `429`: **exponential backoff with jitter**, then stop for the day on a hard quota cap — retrying a daily-quota 403 in a tight loop just burns the next day too.

Error → cause map:

| Symptom | Cause | Fix |
| --- | --- | --- |
| Refresh token dies after ~7 days | App still in "Testing" | Publish consent screen to "In production" |
| `unauthorized_client` | Consent/client misconfig or wrong client type | Re-check OAuth client + authorized scopes |
| `403 insufficient permissions` | Missing scope | Add the right scope, re-consent |
| `uploadLimitExceeded` (429) | Hit the ~100 `videos.insert`/day cap (separate from the 10k unit pool) | Throttle upload count, back off |
| Empty `impressions`/CTR | Not a content-owner channel query | Read it from Studio |
| `403 ... API has not been used` | Other API not enabled | Enable both Data v3 and Analytics v2 |

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Commit `client_secret.json` / `token.json` with `refresh_token` | Leaks full channel control to anyone with repo read | Gitignore both; load from env/secret store |
| Request full `auth/youtube` scope | Grants total account control; fails review | Least set: `youtube.upload` + `youtube.force-ssl` + `yt-analytics.readonly` |
| Hardcode an `access_token` | Dead in ~1 hour | Persist the refresh token; use a refreshable credential |
| `videos.update` with a partial part | Omitted fields get wiped | Read-modify-write the whole part |
| Plain multipart upload for a big file | One drop kills the whole upload | Resumable protocol with chunked PUT |
| Treat the 10k unit pool as the upload budget | Uploads use a separate ~100/day call cap, so `uploadLimitExceeded` 429 hits with the pool untouched | Throttle upload count against the ~100/day cap |
| Overwrite yesterday's wiki snapshot | Destroys the trend the siblings read | Append a new dated entry every pull |
| Leave the app in "Testing" | Token silently dies in 7 days | Publish to "In production" |

## Cross-references

- `../youtube-thumbnails/SKILL.md` — the thumbnail image this skill only *sets*.
- `../social-publisher/SKILL.md` — when the asset goes to many networks, not just YouTube.
- `../remotion-video/SKILL.md` — produce the video file this skill uploads.
- `youtube-strategy`, `youtube-ideation`, `youtube-packaging` *(catalog ids)* — what the numbers *mean* and what to do next.
- `api-connector-builder`, `automation-flows`, `knowledge-ops` *(catalog ids)* — generic connector wrapping, cross-tool chaining, and wiki conventions.
