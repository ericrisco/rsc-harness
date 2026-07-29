---
name: instagram-api
description: "Use when wiring an agent into Instagram's Graph API: publishing a Reel through the create/poll/publish container dance, reading per-media insights, checking the 24h publish cap, or ingesting Reel metrics into 02-DOCS/wiki/shortform. NOT TikTok (that is `tiktok-api`), NOT YouTube (that is `youtube-api`), NOT cross-platform cadence (that is `social-publisher`)."
tags: [instagram, graph-api, content-publishing, reels, insights, shortform]
recommends: [tiktok-api, youtube-api, social-publisher, shortform-strategy, api-connector-builder]
origin: risco
---

# instagram-api

The wire between an agent and Instagram's Graph API: publish Reels, pull the metrics that still exist, and write them to the wiki. You speak HTTP, OAuth scopes, container IDs, and metric names. You do not decide what to post, write the caption's voice, or cut the video — route those out.

All facts below are pinned to **Graph API v25.0** (current as of 2026-06-02). When you generate code, pin the version explicitly; Meta breaks metrics on version boundaries.

## Route out

| The ask | Skill |
|---|---|
| Post the same clip to **TikTok** | `tiktok-api` |
| Upload to **YouTube** / pull YouTube stats | [`youtube-api`](../youtube-api/SKILL.md) |
| Cadence, best-time, multi-platform calendar | [`social-publisher`](../social-publisher/SKILL.md) |
| What to make / shortform content strategy | `shortform-strategy` |
| Hook, cuts, on-screen captions | [`video-shorts`](../video-shorts/SKILL.md) |
| Generic OAuth/webhook plumbing not IG-specific | `api-connector-builder` |

## Prereqs & auth

You cannot publish from a personal account. Confirm these before writing any call.

- **IG professional account** (Business or Creator). Why: the publishing and insights endpoints reject personal accounts outright.
- **Auth path + host** — pick one and stay on it:
  - Facebook Login for Business → IG account linked to a FB Page → host `graph.facebook.com`.
  - Instagram Login (direct) → host `graph.instagram.com`.
  Why: the host is not interchangeable per call; mixing tokens and hosts throws auth errors.
- **Scopes (current names):** `instagram_business_content_publish` to publish, `instagram_business_manage_insights` to read metrics. Why: the old `instagram_basic` / `instagram_content_publish` were deprecated 2025-01-27 and silently grant nothing now.
- **Long-lived token = 60 days**, refreshable before expiry. A short-lived user token lasts ~1h. Why: anything in a script needs the long-lived token or it dies within the hour.

Env block — generate code that reads these, never hard-code the token:

```bash
export IG_USER_ID="17841400000000000"      # the IG professional account id (NOT the page id)
export IG_ACCESS_TOKEN="EAAG...long-lived"  # 60-day token, refresh before expiry
export GRAPH_VERSION="v25.0"                # pin it — never blank
export GRAPH_HOST="graph.facebook.com"      # or graph.instagram.com for IG Login
```

## Publish a Reel — the 3-step container dance

Publishing is never one call. It is create → poll → publish. Skipping the poll is the #1 failure.

**Step 1 — create the container.** `video_url` must be a publicly reachable MP4 (no auth header, no signed-URL-that-expires-in-30s) for the entire processing window.

```bash
curl -s -X POST "https://$GRAPH_HOST/$GRAPH_VERSION/$IG_USER_ID/media" \
  -d "media_type=REELS" \
  -d "video_url=https://cdn.example.com/clip.mp4" \
  -d "caption=Shipped it." \
  -d "share_to_feed=true" \
  -d "access_token=$IG_ACCESS_TOKEN"
# -> {"id":"17999999999999999"}   <- this is the CONTAINER id, not a published post
```

**Step 2 — poll status until `FINISHED`.** Meta recommends ~once per minute, ceiling ~5 minutes.

```bash
curl -s "https://$GRAPH_HOST/$GRAPH_VERSION/$CONTAINER_ID?fields=status_code,status" \
  -d "access_token=$IG_ACCESS_TOKEN"
# -> {"status_code":"FINISHED", ...}
```

**Step 3 — publish.** Only after `FINISHED`.

```bash
curl -s -X POST "https://$GRAPH_HOST/$GRAPH_VERSION/$IG_USER_ID/media_publish" \
  -d "creation_id=$CONTAINER_ID" \
  -d "access_token=$IG_ACCESS_TOKEN"
# -> {"id":"17888888888888888"}   <- THIS is the published media id
```

A compact Python helper that does the whole dance:

```python
import os, time, requests

HOST = os.environ["GRAPH_HOST"]
VER  = os.environ["GRAPH_VERSION"]          # v25.0 — pinned
UID  = os.environ["IG_USER_ID"]
TOK  = os.environ["IG_ACCESS_TOKEN"]
BASE = f"https://{HOST}/{VER}"

def publish_reel(video_url: str, caption: str) -> str:
    cid = requests.post(f"{BASE}/{UID}/media", data={
        "media_type": "REELS", "video_url": video_url,
        "caption": caption, "share_to_feed": "true",
        "access_token": TOK,
    }).json()["id"]

    for _ in range(10):                      # ~5 min ceiling at 30s steps
        st = requests.get(f"{BASE}/{cid}", params={
            "fields": "status_code", "access_token": TOK,
        }).json()["status_code"]
        if st == "FINISHED":
            break
        if st in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"container {cid} -> {st}")
        time.sleep(30)
    else:
        raise TimeoutError(f"container {cid} never reached FINISHED")

    return requests.post(f"{BASE}/{UID}/media_publish", data={
        "creation_id": cid, "access_token": TOK,
    }).json()["id"]
```

```text
Bad:  publish immediately after create -> "Media ID is not available" / silent fail.
Good: poll status_code until FINISHED, then media_publish.

Bad:  video_url behind auth or a 30s signed URL -> container stalls in ERROR.
Good: a plain public MP4 that stays reachable for the full ~5 min window.
```

Full container field reference (reels / carousel / story), cover & thumb handling, error codes, retry/backoff, and batch publish with cap check → `references/publish-reel.md`.

## Status polling rules

`status_code` is the only honest signal. Branch on it, do not guess from timing.

| `status_code` | Meaning | Action |
|---|---|---|
| `IN_PROGRESS` | Still transcoding | Keep polling (~60s) |
| `FINISHED` | Ready | Call `media_publish` now |
| `ERROR` | Failed (bad url, bad codec, eligibility) | Stop; read `status`, fix source |
| `EXPIRED` | Container unpublished too long | Stop; recreate from step 1 |

Why the 5-min ceiling: containers expire. If you poll forever you will eventually publish an `EXPIRED` id and get an error. Cap retries.

## Limits — check before a batch

| Rule | How |
|---|---|
| **50 API-published posts per rolling 24h** per IG account | `GET /{IG_USER_ID}/content_publishing_limit?fields=quota_usage,config` |
| Over the cap | `media_publish` rejects with **error subcode #51** ("publishing limit reached") |

```bash
curl -s "https://$GRAPH_HOST/$GRAPH_VERSION/$IG_USER_ID/content_publishing_limit?fields=quota_usage" \
  -d "access_token=$IG_ACCESS_TOKEN"
# -> {"data":[{"quota_usage": 12, "config": {"quota_total": 50}}]}
```

Why check first: in a batch, hitting #51 mid-run leaves half your queue unpublished and no clean resume point. Read `quota_usage` and stop early.

## Fetch insights

```bash
curl -s "https://$GRAPH_HOST/$GRAPH_VERSION/$IG_MEDIA_ID/insights" \
  -d "metric=reach,views,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time" \
  -d "access_token=$IG_ACCESS_TOKEN"
```

**Valid Reels metric set (v25.0):** `reach`, `views`, `likes`, `comments`, `shares`, `saved`, `total_interactions`, `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time` (plus optional `crossposted_views`, `facebook_views`, `reposts`). Why a fixed list: the metric set differs by media type (feed / story / reels), and one invalid name fails the **whole** call — not just that field.

**Units trap:** the API returns `ig_reels_avg_watch_time` and `ig_reels_video_view_total_time` in **milliseconds**, not seconds. Store the raw value verbatim (suffix the key `_ms`) so the artifact matches the API, or divide by 1000 at ingest and rename to `_s` — never label a raw millisecond value "seconds". A 7.4s avg watch arrives as `7400`.

## The deprecated-metric trap

Requesting any retired metric does not return null — it **400s the entire insights call**. Map old → new before you send.

| Deprecated | Replacement | Deprecated on |
|---|---|---|
| `plays` | `views` | 2025-04-21 (v22.0 + all versions) |
| `clips_replays_count` | — (removed) | 2025-04-21 |
| `ig_reels_aggregated_all_plays_count` | `views` | 2025-04-21 |
| `impressions` | `views` / `reach` | gone for media created after 2024-07-02 |
| `video_views` | `views` | 2025-01-08 |
| `profile_views` (media) | — | 2025-03-25 |

If a previously-working call started erroring, this table is almost certainly why: a metric you used to request was retired on a version boundary. Swap to `views` and drop the dead names.

Complete current metric tables per media type, the full deprecated→replacement map with dates, version-gated 2025–2026 additions, and the `02-DOCS/wiki/shortform/` ingest schema spec → `references/insights-metrics.md`.

## Ingest into 02-DOCS/wiki/shortform/

This is the checkable deliverable. One file per media id, idempotent overwrite (re-running a pull refreshes `pulled_at` and metrics, never duplicates).

- **Path:** `02-DOCS/wiki/shortform/ig-reel-<media_id>.md`
- **Naming:** always `ig-reel-` prefix + the published media id (not the container id).
- **Re-runs:** overwrite the same file in place — the media id is the natural key.

```markdown
---
type: instagram-metrics
title: "Reel 17888888888888888"
description: Performance snapshot for one Instagram Reel, pulled from Graph API v25.0.
tags: [instagram, reels, insights, shortform]
timestamp: "2026-06-02T08:00:00Z"
topic: shortform
status: stable
platform: instagram
media_type: REELS
media_id: "17888888888888888"
permalink: "https://www.instagram.com/reel/Cxxxxxx/"
published_at: "2026-05-30T09:12:00Z"
graph_version: v25.0
pulled_at: "2026-06-02T08:00:00Z"
metrics:
  reach: 41200
  views: 58800
  total_interactions: 3120
  saved: 410
  shares: 220
  ig_reels_avg_watch_time_ms: 7400        # raw API value — MILLISECONDS (avg per view)
  ig_reels_video_view_total_time_ms: 435120000 # raw API value — MILLISECONDS (summed)
---

# Reel 17888888888888888

Performance snapshot pulled from Graph API v25.0. Metric set is the
current valid Reels set; no deprecated names requested.
```

`type` is the only required OKF v0.1 field; `title`/`description`/`tags`/`timestamp` are the recommended OKF surface (`timestamp` mirrors the pull instant). The DOMAIN keys below are mandatory and stay byte-for-byte — `verify.sh` requires a pinned `graph_version` and greps the `metrics` block for deprecated names; `pulled_at` is the API-pull instant verify/diff rely on. Keep both `pulled_at` and `timestamp`. Why front-matter + media-id filename: the wiki is queried by key, and re-pulls must be diffable, not additive (the idempotent overwrite re-stamps `timestamp` and `pulled_at` together).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Publish right after `media` create | Container isn't `FINISHED`; publish errors | Poll `status_code` first |
| Requesting `plays` / `impressions` | 400s the whole insights call | Use `views`; consult the trap table |
| Leaving `GRAPH_VERSION` blank / using default | Metric set silently shifts on Meta's rollout | Pin `v25.0` in every call |
| Signed/auth-gated `video_url` | Container stalls in `ERROR` | Plain public MP4 for the full window |
| Batch publishing without cap check | Hit #51 mid-run, half-published queue | `content_publishing_limit` before the loop |
| Old scopes (`instagram_basic`, `instagram_content_publish`) | Grant nothing since 2025-01-27 | `instagram_business_basic` / `instagram_business_content_publish` |
| Storing the container id as "the post" | It's not the published media id | Persist the `media_publish` id |
| Sending a `graph.instagram.com` token to `graph.facebook.com` | Host is fixed by the login path, not chosen per call | Pick the host with the auth path and stay on it |
| Letting the 60-day long-lived token lapse | Every call fails with an auth error, not a 404 | Refresh before expiry |
| A source video outside Reel eligibility | Surfaces as container `ERROR`, not a clean validation message | 9:16, 5–90s, H.264/HEVC |
| Requesting the 2025–2026 additions (Reels skip rate, repost counts, crossposted views) blind | Version-gated — trips the same 400 trap as a deprecated name | Confirm they exist on `GRAPH_VERSION` first |
