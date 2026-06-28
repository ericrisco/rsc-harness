---
name: tiktok-api
description: "Use when connecting a real TikTok account to code via the Content Posting API + Display API + Business Account API — OAuth v2 (Login Kit), chunked video publish (FILE_UPLOAD / PULL_FROM_URL with init → PUT → status poll), and pulling views / watch time / full_video_watched_rate / impression sources — then logging that performance into 02-DOCS/wiki/shortform/ as a dated feedback log. Triggers: 'publish a video to my TikTok account via the API and poll until it's live', 'my TikTok access token dies after 24 hours so the cron breaks', 'the Display API won't give me watch time / full_video_watched_rate', 'publish init returns url_ownership_unverified for my PULL_FROM_URL', 'rate_limit_exceeded — 6 requests per minute', 'append this week's FYP vs profile impression sources to the wiki', 'subir vídeos a TikTok por API y guardar las métricas del canal en el wiki', 'treure la retenció i el watch time de TikTok cap al wiki'. NOT what-to-post or how-to-package it (that is shortform-strategy / shortform-packaging)."
tags: [tiktok, content-posting-api, tiktok-display-api, tiktok-business-api, oauth2, chunked-upload, video-publish, watch-time, completion-rate, shortform-feedback-log]
recommends: [shortform-strategy, shortform-packaging, shortform-ideation, shortform-editing, social-publisher, instagram-api, youtube-api, api-connector-builder, automation-flows, knowledge-ops]
origin: risco
---

# TikTok API — Transport + Ingestion for a Real Account

*You own the wire: authenticate to a TikTok account, publish video, pull the numbers, and write those numbers into the wiki as a durable feedback log. You do not decide what to make, when to post it, or how to caption it — that is the shortform strategy/packaging family. Deliver clean transport and a queryable log; let the siblings interpret.*

TikTok splits across **three** separate APIs, and a real account touches all three:

- **Content Posting API** — `https://open.tiktokapis.com/v2/post/publish/...` — the *write* side: init a publish, transfer the file, poll status. Audit-gated.
- **Display API** — `https://open.tiktokapis.com/v2/video/...` — the *cheap read* side: your own profile and basic per-video counters (`view_count, like_count, comment_count, share_count`).
- **TikTok API for Business** — the *rich read* side: watch time, completion, impression sources. Enabled through a **separate business portal**, not the standard developer app.

Auth is **user OAuth v2 via Login Kit**, never a service token. A human owns the account; you act on their behalf with a refresh token. There is **no official TikTok SDK** — you call the REST endpoints directly with any HTTP client. Treat the access token as a short-lived, refreshable credential object, never a hardcoded literal.

## When to use / When NOT

Use when:

- Wiring a script or agent to publish to an account: Direct Post or upload-to-draft via `/v2/post/publish/video/init/` (or `/inbox/` for a draft), then `FILE_UPLOAD` chunked PUT or `PULL_FROM_URL`, then poll `/v2/post/publish/status/fetch/`.
- Pulling an account's own video stats: counters via Display `POST /v2/video/query/` (or `/v2/video/list/`); watch-time / completion / impression-source via the Business Account API.
- Building the recurring "fetch performance → write to `02-DOCS/wiki/shortform/`" loop that turns API responses into an account feedback log siblings can read.
- Debugging TikTok-specific failures: `scope_not_authorized`, `url_ownership_unverified`, `rate_limit_exceeded` (6 req/min), 24-hour access-token expiry, audit/`video.publish` not approved, unaudited-app private-only posting.

Do NOT use when (route to the sibling that owns it):

| You actually want | Go to |
| --- | --- |
| What to post / cadence / niche / hook strategy | `shortform-strategy` *(catalog id)* |
| Clip ideas, hooks, a topic backlog | `shortform-ideation` *(catalog id)* |
| Caption / cover / title packaging, A/B framing | `shortform-packaging` *(catalog id)* |
| Cut/caption/render the actual clip file | `shortform-editing` *(catalog id)* |
| Render a video file programmatically | `../remotion-video/SKILL.md` |
| Post one asset to TikTok + IG + YouTube at once | `../social-publisher/SKILL.md` |
| Instagram's Graph / Content Publishing API | `../instagram-api/SKILL.md` |
| YouTube's two APIs (same family, other platform) | `../youtube-api/SKILL.md` |
| Wrap an arbitrary REST provider with OAuth + retries | `api-connector-builder` *(catalog id)* |
| Chain publish → Notion row → Slack across tools | `automation-flows` *(catalog id)* |

One line: **this skill authenticates, calls, and ingests TikTok's Content Posting + Display + Business APIs into the wiki. What to post and how to package it belong to the shortform-strategy / shortform-ideation / shortform-packaging siblings; multi-network posting belongs to social-publisher.**

## 1. One-time setup (do this before any code)

A checklist, because each missing step produces a distinct, confusing failure later:

1. Register a **TikTok developer app** in the developer portal.
2. **Add the products you need**: Login Kit (OAuth), Content Posting API (publish), Display API (read counts). Insights live in the **separate TikTok for Business portal** — enable that account access too if you need watch time/completion.
3. Set an exact **redirect URI** for the OAuth flow.
4. **Submit the app for audit before posting public content.** An unaudited app can only post **privately** (`SELF_ONLY`) and only to a limited set of test users. This is the #1 "works on my machine, breaks in prod" surprise — see rule below.
5. If you publish by URL (`PULL_FROM_URL`), **verify the domain / URL-prefix** in the portal (DNS TXT or URL-prefix), or every init returns `url_ownership_unverified`.

The three gates are independent. Do not assume one approval covers everything:

```text
Bad:  "My app is approved, so publish + insights both work."
Good: Content Posting *audit* gates public publish;
      Display *scope* (video.list) gates own-video counts;
      Business *portal* access gates watch time / completion / impression sources.
      Three separate gates — check each.
```

Scope table — request only what the job needs:

| Scope | Grants | Use for |
| --- | --- | --- |
| `video.publish` | Direct Post to the public feed | `/post/publish/video/init/` (audit-gated) |
| `video.upload` | Upload to drafts/inbox for the user to finish | `/post/publish/inbox/video/init/` |
| `video.list` | Read your own videos + basic counters | Display `POST /v2/video/query/` |
| `user.info.basic` | Read profile (open_id, display name, avatar) | `POST /v2/user/info/` |

Full app-registration + product-enable walkthrough, the audit gate, and `scope_not_authorized` troubleshooting live in `references/oauth-setup.md`.

## 2. Get an authed client and keep the token alive

OAuth v2: send the user to `https://www.tiktok.com/v2/auth/authorize/`, receive a `code` at your redirect URI, exchange it at `https://open.tiktokapis.com/v2/oauth/token/`, and **store the refresh token**.

The lifecycle is the load-bearing fact: **access token expires in 24 hours** (`expires_in: 86400`); **refresh token lasts 365 days** (`refresh_expires_in: 31536000`) and renews without user re-consent. So a daily-pull cron **MUST refresh the access token every run**, and a long-idle account silently dies at the 365-day refresh boundary.

```python
# python: raw REST, no official TikTok SDK. requests/httpx both fine.
import time, json, os, requests

TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
STORE = "tiktok_token.json"   # gitignored — holds the rotating refresh_token

def load(): return json.load(open(STORE)) if os.path.exists(STORE) else {}
def save(t): t["obtained_at"] = int(time.time()); json.dump(t, open(STORE, "w"))

def access_token():
    t = load()
    fresh = t.get("access_token") and time.time() < t.get("obtained_at", 0) + t["expires_in"] - 60
    if fresh:
        return t["access_token"]
    r = requests.post(TOKEN_URL, data={                 # refresh every run, 24h expiry
        "client_key": os.environ["TIKTOK_CLIENT_KEY"],
        "client_secret": os.environ["TIKTOK_CLIENT_SECRET"],
        "grant_type": "refresh_token",
        "refresh_token": t["refresh_token"],            # 365-day lifetime; rotates
    }, headers={"Content-Type": "application/x-www-form-urlencoded"})
    r.raise_for_status()
    new = r.json()
    save(new)                                           # persist the NEW refresh_token
    return new["access_token"]
```

```javascript
// node: built-in fetch, no SDK.
import fs from "node:fs";
const STORE = "tiktok_token.json";

async function accessToken() {
  const t = JSON.parse(fs.readFileSync(STORE, "utf8"));
  if (t.access_token && Date.now() / 1000 < t.obtained_at + t.expires_in - 60) return t.access_token;
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: t.refresh_token,
    }),
  });
  const n = await r.json();
  n.obtained_at = Math.floor(Date.now() / 1000);
  fs.writeFileSync(STORE, JSON.stringify(n));          // persist rotated refresh_token
  return n.access_token;
}
```

Rule: persist the **refresh token** and re-read it each run, never a bare `access_token`. A hardcoded `access_token=...` literal is a guaranteed failure within 24 hours — and is exactly what `verify.sh` flags.

Full token-exchange flow (authorize URL params, PKCE, code exchange) is in `references/oauth-setup.md`.

## 3. Publish a video (init → transfer → poll)

Publishing is always **three steps**: init the publish, transfer the bytes, poll until processing finishes (it is async). Pick the transfer mode first:

| Situation | Source | Endpoint |
| --- | --- | --- |
| File is local / in your control | `FILE_UPLOAD` | `/post/publish/video/init/` |
| File is at a **verified** HTTPS URL | `PULL_FROM_URL` | `/post/publish/video/init/` |
| Should land as a draft the user finalizes | `FILE_UPLOAD` | `/post/publish/inbox/video/init/` |

**Init** (FILE_UPLOAD) — returns `publish_id` and an `upload_url`:

```python
import math, requests

CHUNK = 10 * 1024 * 1024                      # 10 MB, inside the 5–64 MB window
size = os.path.getsize("clip.mp4")
chunk_count = 1 if size < 5 * 1024 * 1024 else math.ceil(size / CHUNK)

init = requests.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    headers={"Authorization": f"Bearer {access_token()}",
             "Content-Type": "application/json; charset=UTF-8"},
    json={
        "post_info": {"title": "caption #fyp", "privacy_level": "SELF_ONLY"},  # public needs audit
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": size,
            "chunk_size": CHUNK if size >= 5 * 1024 * 1024 else size,
            "total_chunk_count": chunk_count,
        },
    }).json()
publish_id = init["data"]["publish_id"]
upload_url = init["data"]["upload_url"]
```

**Transfer** — PUT chunks **sequentially** to `upload_url` with a `Content-Range` header. Chunk **min 5 MB, max 64 MB** (final chunk up to 128 MB), **1–1000 chunks**; a file under 5 MB is one chunk equal to the file size. Each PUT returns **206** (more to send) or **201** (last chunk accepted):

```python
with open("clip.mp4", "rb") as f:
    for i in range(chunk_count):
        first = i * CHUNK
        data = f.read(CHUNK)
        last = first + len(data) - 1
        r = requests.put(upload_url, data=data, headers={
            "Content-Type": "video/mp4",
            "Content-Range": f"bytes {first}-{last}/{size}",  # exact byte span
        })
        assert r.status_code in (206, 201), r.text     # 206 = continue, 201 = done
```

**Poll** — TikTok processes asynchronously; check status until `PUBLISH_COMPLETE`. Respect the cap below — do not tight-loop:

```python
import time
while True:
    s = requests.post(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        headers={"Authorization": f"Bearer {access_token()}",
                 "Content-Type": "application/json; charset=UTF-8"},
        json={"publish_id": publish_id}).json()
    status = s["data"]["status"]
    if status in ("PUBLISH_COMPLETE", "FAILED"):
        break
    time.sleep(10)                                      # 6/min cap — sleep, never spin
```

**Rate limit: 6 requests/minute per user access token** → `rate_limit_exceeded`. Throttle init/status calls and back off; a tight status-poll loop blows the budget in seconds.

`PULL_FROM_URL` requires the domain/URL-prefix to be verified in the portal (HTTPS only, no redirects, 1-hour download timeout) or init returns `url_ownership_unverified`. Full PULL_FROM_URL init body and verification steps are in `references/metrics-and-publish.md`.

## 4. Pull performance (two APIs, one rule)

The load-bearing distinction: **Display gives you counters; only the Business API gives you watch time, completion, and traffic.**

```python
# (a) Display API — basic counters only. scope video.list, up to 20 ids/request.
counts = requests.post(
    "https://open.tiktokapis.com/v2/video/query/",
    params={"fields": "id,title,view_count,like_count,comment_count,share_count,duration,create_time"},
    headers={"Authorization": f"Bearer {access_token()}",
             "Content-Type": "application/json"},
    json={"filters": {"video_ids": ["<id1>", "<id2>"]}}).json()
# returns: view_count, like_count, comment_count, share_count, duration, title, create_time
```

```python
# (b) Business Account API — the real engagement signal.
# Returns the metrics Display CANNOT: average_time_watched, total_time_watched,
# full_video_watched_rate (completion), impression_sources (FYP / Following / profile /
# search), audience_countries. (Endpoint shape in references/metrics-and-publish.md.)
```

```text
Bad:  expect average_time_watched / full_video_watched_rate from /v2/video/query/
Good: counters from Display /v2/video/query/;
      watch time + completion + impression_sources from the Business Account API.
```

Caveat: **Business insight metrics lag 24–48h** and can differ from the in-app numbers. Treat a fresh pull as provisional — the wiki log (next section) is where you watch them settle. Full metric catalog split by API is in `references/metrics-and-publish.md`.

## 5. Ingest into the wiki — the actual deliverable

A pull that prints to stdout and vanishes is wasted. **Every pull appends a dated entry under `02-DOCS/wiki/shortform/`**, platform-namespaced, so the account's numbers become queryable history the strategy/packaging siblings can read.

```text
02-DOCS/wiki/shortform/
  index.md                       # rolling pointer to latest snapshot + open questions
  tiktok-account-2026-06-02.md   # dated account snapshot (one per pull)
  videos/tiktok-<video_id>.md    # per-video running log, newest entry on top
```

Filenames carry the `tiktok-` prefix because the same `shortform/` wiki may also hold Instagram and YouTube pulls — namespacing keeps platforms from colliding.

Per-pull entry template. The frontmatter is **OKF v0.1 conformant** — a non-empty `type` is the only hard requirement; `title`/`tags`/`timestamp` are the recommended OKF surface; the domain `date`/`range`/`account`/`platform`/`source` keys the siblings parse are preserved additively (OKF tolerates extra keys). `date` is the reporting day; `timestamp` is the ISO 8601 write moment:

```markdown
---
type: shortform-metrics
title: TikTok account snapshot — 2026-06-02
tags: [tiktok, metrics, snapshot]
timestamp: 2026-06-02T09:00:00Z
date: 2026-06-02
range: 2026-05-26..2026-06-01
account: <open_id>
platform: tiktok
source: display-api + business-account-api
---
## KPIs
views: 52,140 | likes: 3,902 | comments: 211 | shares: 488

## Watch
full_video_watched_rate: 28.4% | avg_time_watched: 6.1s | total_time_watched: 88h

## Impression sources (top 3)
For You 71% · Personal profile 14% · Search 7%

## What changed since last pull
completion +3.1pts after the tighter cold-open; FYP share up 5pts.
```

Rule: **append, never overwrite.** The feedback log *is* the value — overwriting yesterday's snapshot destroys the trend the siblings need, and erases the 24–48h settling you only see across pulls. The per-video log (`videos/tiktok-<id>.md`) is an OKF append-log: write its frontmatter header once, prepend each new dated block newest-first, never edit a past block. `index.md` is the OKF reserved file — no frontmatter, standard markdown links only. Exact file tree, frontmatter, naming, and how siblings read the log: `references/wiki-schema.md`.

## 6. Rate & failure math

The publish token is capped at **6 requests/minute**. Wrap publish/status calls in a token-bucket or backoff-with-jitter helper, and refresh the access token (24h expiry) before each cron run.

Error → cause map:

| Symptom | Cause | Fix |
| --- | --- | --- |
| `scope_not_authorized` | Scope missing or not approved for the app | Add the scope; re-consent; check app approval |
| Only `SELF_ONLY` posts work | App not audited | Submit for audit; use test users until approved |
| `url_ownership_unverified` on init | PULL_FROM_URL domain not verified | Verify domain/URL-prefix (DNS TXT) in the portal |
| `rate_limit_exceeded` | >6 req/min on the user token | Throttle + backoff; stop tight-looping the poll |
| 401 / `access_token_invalid` mid-cron | 24h access token expired | Refresh before each run; persist refresh_token |
| Empty watch time / completion | Wrong API **or** <24–48h since post | Use the Business API, not Display; wait for lag |
| Refresh fails after long idle | 365-day refresh token expired | Re-run the OAuth consent flow |

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Commit `client_secret` / a token file holding `refresh_token` | Leaks full account control to anyone with repo read | Gitignore it; load from env/secret store |
| Hardcode a 24h `access_token` literal | Dead within a day; breaks every cron | Persist the refresh token; refresh each run |
| Tight-loop the status poll | Blows the 6/min cap → `rate_limit_exceeded` | Sleep ~10s between polls; back off on 429 |
| Expect watch time from Display `video/query` | That field does not exist there | Counts from Display, watch time from Business |
| Treat an unaudited app as production | Only `SELF_ONLY` posts work for real users | Submit for audit before public posting |
| `PULL_FROM_URL` without domain verification | Every init returns `url_ownership_unverified` | Verify domain/URL-prefix first, HTTPS, no redirects |
| Assume one approval covers publish + insights | Three independent gates | Posting audit + Display scope + Business portal |
| Overwrite yesterday's wiki snapshot | Destroys the trend + the 24–48h settling | Append a new dated entry every pull |

## Cross-references

- `../social-publisher/SKILL.md` — when the asset goes to many networks, not just TikTok.
- `../instagram-api/SKILL.md` — same family pattern, Instagram's Graph/Content Publishing API.
- `../youtube-api/SKILL.md` — same transport+ingestion shape, YouTube's two APIs.
- `../remotion-video/SKILL.md` — produce the clip file this skill only uploads.
- `shortform-strategy`, `shortform-ideation`, `shortform-packaging`, `shortform-editing` *(catalog ids)* — what the numbers *mean*, what to make, and how to package/edit it.
- `api-connector-builder`, `automation-flows`, `knowledge-ops` *(catalog ids)* — generic connector wrapping, cross-tool chaining, and wiki conventions.
