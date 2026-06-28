# Wiki schema for `02-DOCS/wiki/shortform/`

How a TikTok pull becomes durable, queryable account history the shortform siblings
read. The rule that matters: **append, never overwrite.** A snapshot that replaces
yesterday's destroys the trend — and erases the 24–48h metric settling you only see
across pulls.

## File tree

```text
02-DOCS/wiki/shortform/
  index.md                       # rolling pointer: latest snapshot per platform + open questions
  tiktok-account-2026-06-02.md   # dated account snapshot, one file per pull
  tiktok-account-2026-06-09.md
  videos/
    tiktok-<video_id>.md         # per-video running log, newest entry on top
```

### Why the `tiktok-` prefix

The `shortform/` wiki may also hold Instagram and YouTube pulls (sibling transport
skills write here too). Platform-namespacing the filenames keeps cross-platform pulls
from colliding and lets a sibling grep `tiktok-*` for just this account.

## Account snapshot entry (one file per pull)

Frontmatter is **OKF v0.1 conformant**: a non-empty `type` is the only hard
requirement; `title`/`tags`/`timestamp` are the recommended OKF surface. The
domain keys (`date`, `range`, `account`, `platform`, `source`, `provisional`) are
preserved verbatim — siblings parse them, and OKF tolerates arbitrary extra keys.
`date` is the snapshot's reporting day; `timestamp` is the ISO 8601 moment the file
was written. Keep both.

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
provisional: true            # set while inside the 24–48h metric-lag window
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

## Per-video running log (`videos/tiktok-<id>.md`)

Newest entry on top, so a glance shows the latest. Each pull **prepends** a block —
this is where the 24–48h settling becomes visible (the same video's
`full_video_watched_rate` will drift between pulls). This is an OKF append-log:
the frontmatter header is written once and stays immutable; new dated blocks are
prepended **above** older ones (newest-first), past blocks are never edited, and
dates are ISO 8601.

```markdown
---
type: shortform-record
title: tiktok-7399 — "cold open hook test"
tags: [tiktok, video-log]
timestamp: 2026-06-02T09:00:00Z
video_id: "7399..."
platform: tiktok
posted: 2026-05-28
duration: 21s
---
# tiktok-7399... — "cold open hook test"

## 2026-06-02 (final-ish)
views 52,140 | completion 28.4% | avg_watched 6.1s | FYP 71%

## 2026-05-29 (provisional, <48h)
views 18,900 | completion 24.1% | avg_watched 5.3s | FYP 64%
```

On each prepend, bump the header `timestamp` to the new pull's ISO moment; never
edit a past dated block.

## index.md

A thin pointer, not a data dump. As an OKF **reserved** file it carries **no
frontmatter**, and its cross-references are standard markdown links (never
wikilinks), so an OKF consumer can follow them straight to the snapshot files:

```markdown
# shortform wiki — index
- tiktok: latest snapshot → [tiktok-account-2026-06-02.md](./tiktok-account-2026-06-02.md)
- open questions:
  - is the cold-open change holding completion above 27%? (watch next 2 pulls)
```

## Rules

- **Append, never overwrite.** New pull → new dated snapshot file + prepended per-video
  block. Never edit a past snapshot in place.
- **Mark provisional pulls.** Set `provisional: true` (or a label) while inside the
  24–48h lag window; the next pull supersedes it without deleting it.
- **Namespace by platform.** `tiktok-` prefix on every file so IG/YouTube pulls coexist.
- **Numbers only, no interpretation.** "What changed" is a factual delta line, not a
  recommendation — what to *do* about it belongs to `shortform-strategy`.
- **OKF v0.1 conformant.** Every snapshot and per-video file carries YAML frontmatter
  with a non-empty `type` (`shortform-metrics` / `shortform-record`) plus the OKF
  `title`/`tags`/`timestamp` surface; domain keys like `date` are kept additively. The
  reserved `index.md` carries no frontmatter. All cross-references are standard markdown
  links — never `[[wikilinks]]` — so the `shortform/` tree is a portable OKF bundle the
  siblings (and any OKF consumer) read without translation.
