# Insights reference — metrics by media type, deprecations, ingest schema

Endpoint: `GET /{ig-media-id}/insights?metric=<comma,list>` on Graph API **v25.0**.
One invalid metric name fails the entire call (HTTP 400), so build the list per media type.

## Valid metric sets (v25.0)

### Reels

`reach`, `views`, `likes`, `comments`, `shares`, `saved`, `total_interactions`,
`ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`.

Optional / version-gated: `crossposted_views`, `facebook_views`, `reposts`.

- `ig_reels_avg_watch_time` — average watch time per view, **milliseconds** (convert if you report seconds).
- `ig_reels_video_view_total_time` — summed watch time across views, **milliseconds**.

### Feed (image / video / carousel)

`reach`, `views`, `likes`, `comments`, `shares`, `saved`, `total_interactions`,
`profile_visits`, `follows` (availability varies by media type).

### Stories

`reach`, `views`, `replies`, `shares`, `total_interactions`, `navigation`
(navigation breaks down to taps forward/back/exit via `breakdown` param).

### Account-level (`GET /{ig-user-id}/insights`)

`reach`, `follower_count`, `profile_views`, `accounts_engaged`, `total_interactions`
with required `metric_type` / `period` params. Different surface from per-media — do not mix.

## Deprecated → replacement (do not request)

| Deprecated metric | Use instead | Deprecated on |
|---|---|---|
| `plays` (reels) | `views` | 2025-04-21 — v22.0 and all versions |
| `clips_replays_count` | — removed | 2025-04-21 |
| `ig_reels_aggregated_all_plays_count` | `views` | 2025-04-21 |
| `impressions` | `views` / `reach` | 2025-04-21 (errors for media created on/after 2024-07-02) |
| `video_views` | `views` | 2025-01-08 |
| `profile_views` (per-media) | account-level only | 2025-03-25 |
| story / carousel `impressions` | `reach` / `views` | 2025-01-08 |

Symptom of requesting any of these: the whole `/insights` call returns a 400, not a partial result.

## Version-gated 2025–2026 additions

Added late 2025 / early 2026; present only on recent versions. Confirm against `GRAPH_VERSION` before requesting, or they trip the same 400:

- Reels **skip rate** / swipe-away signal.
- **Repost** counts (`reposts`).
- **Crossposted** Reel views (`crossposted_views`, `facebook_views`).

## Wiki ingest schema — `02-DOCS/wiki/shortform/`

One file per published media id. Idempotent: re-pulls overwrite the same file (media id is the key).

- **Filename:** `ig-reel-<media_id>.md`
- **Format:** YAML front-matter + a short human-readable body.

```markdown
---
type: instagram-metrics      # required OKF v0.1 field (non-empty)
title: "Reel <media_id>"     # OKF recommended surface
description: Performance snapshot for one Instagram Reel, pulled from Graph API v25.0.
tags: [instagram, reels, insights, shortform]
timestamp: "<ISO 8601 UTC>"  # OKF last-edit; re-stamped each re-run alongside pulled_at
topic: shortform
status: stable
platform: instagram          # always "instagram" for this skill
media_type: REELS            # REELS | IMAGE | CAROUSEL | STORIES
media_id: "<published media id>"   # NOT the container id
permalink: "<https permalink>"
published_at: "<ISO 8601 UTC>"
graph_version: v25.0         # the version the pull ran on
pulled_at: "<ISO 8601 UTC>"  # refreshed every re-run
metrics:                     # only valid, non-deprecated names
  reach: <int>
  views: <int>
  total_interactions: <int>
  saved: <int>
  shares: <int>
  ig_reels_avg_watch_time_ms: <int>          # raw API value, MILLISECONDS
  ig_reels_video_view_total_time_ms: <int>   # raw API value, MILLISECONDS
---

# Reel <media_id>

One-paragraph note: which valid metric set was pulled and on which graph_version.
```

`type` is the only required OKF v0.1 field; the rest of the OKF surface (`title`, `description`, `tags`, `timestamp`) is recommended. Required DOMAIN keys (kept byte-for-byte): `platform`, `media_type`, `media_id`, `published_at`, `graph_version`, `pulled_at`, `metrics`. The `metrics` block must contain only current metric names — verify.sh greps for deprecated tokens and a pinned `graph_version`. `pulled_at` (the API-pull instant) and the OKF `timestamp` are re-stamped together on each idempotent overwrite — keep both.

**Watch-time units:** `ig_reels_avg_watch_time` and `ig_reels_video_view_total_time` are returned by the API in **milliseconds** (see the metric notes above). Persist them raw under `_ms`-suffixed keys, matching the wire value. If you instead report seconds, divide by 1000 at ingest and rename to a `_s` suffix — do not keep the API key name while silently changing the unit.
