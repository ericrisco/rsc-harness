# Wiki schema — `02-DOCS/wiki/youtube/`

The point of this skill is not to print stats once; it is to grow a **feedback log** the strategy/packaging siblings can read. The log lives under `02-DOCS/wiki/youtube/` and every pull **appends** to it.

`02-DOCS/wiki/` is an **OKF v0.1** bundle, so every non-reserved `.md` file written here carries YAML frontmatter with a non-empty `type`. This skill writes `type: youtube-metrics` on its snapshots/logs and keeps the domain keys (`date`, `range`, `channel`, `source`) that the strategy/packaging siblings parse literally — `type` and `timestamp` are added *alongside* them, never replacing them. OKF allows arbitrary extra keys, so the shared keys stay stable. Links between wiki files are standard markdown links (`[text](./file.md)`), never Obsidian wikilinks.

## File tree

```text
02-DOCS/wiki/youtube/
  index.md                  # rolling: pointer to latest snapshot + open questions
  channel-2026-05-31.md     # one dated channel snapshot per pull
  channel-2026-05-24.md
  videos/
    dQw4w9WgXcQ.md          # per-video running log, newest entry on top
    abc123XYZ.md
```

Naming:

- Channel snapshots: `channel-YYYY-MM-DD.md` (the pull date). One file per pull — never overwrite an earlier date.
- Per-video logs: `videos/<VIDEO_ID>.md`. One file per video, **append** each new dated block at the top.
- `index.md`: the only file that gets rewritten — it points at the latest snapshot and lists open questions for the siblings.

## Channel snapshot template

```markdown
---
type: youtube-metrics
title: Channel snapshot 2026-05-31
description: Channel KPIs and traffic for 2026-05-01..2026-05-31.
tags: [youtube, channel-snapshot]
timestamp: 2026-05-31T00:00:00Z
date: 2026-05-31
range: 2026-05-01..2026-05-31
channel: MINE
source: youtube-analytics-api-v2
---
## KPIs
views: 41,233 | watch_min: 88,140 | avg_view_pct: 38.2% | avg_view_dur: 0:04:11
subs: +312 / -41 (net +271)

## Traffic (top 3 by views)
BROWSE 44% · SUGGESTED 31% · YT_SEARCH 12%

## What changed since last pull
avg_view_pct +2.1pts; SUGGESTED share +6pts after the Ep.13 packaging change.
```

## Per-video log file — `videos/<VIDEO_ID>.md`

The file carries frontmatter once (at the top); each new dated block is **prepended directly under the frontmatter** (newest entry first — this is an append-log, past entries are immutable). On the first write, create the frontmatter; on every later pull, refresh `timestamp` and insert the new block above the previous newest one. Keep the domain key `channel` so siblings can parse it.

```markdown
---
type: youtube-metrics
title: Video log — dQw4w9WgXcQ
description: Per-pull KPI/traffic/retention log for video dQw4w9WgXcQ, newest entry first.
tags: [youtube, video-log]
timestamp: 2026-05-31T00:00:00Z
channel: MINE
source: youtube-analytics-api-v2
---
## 2026-05-31  (range 2026-05-01..2026-05-31)
views: 8,902 | avg_view_pct: 41.0% | ctr(studio): 6.2%
traffic: SUGGESTED 52% · BROWSE 23% · YT_SEARCH 9%
retention: sharp 0.00→0.06 intro drop; second dip ~0.55; tail flat after 0.80
note: held suggested-traffic share week over week.
```

## index.md

OKF **reserved file**: a directory listing, so it carries **no frontmatter**. Point at the latest snapshot and tracked videos with standard markdown links (never wikilinks).

```markdown
# YouTube channel feedback log
latest snapshot: [channel-2026-05-31.md](./channel-2026-05-31.md)
videos tracked: [dQw4w9WgXcQ](./videos/dQw4w9WgXcQ.md), [abc123XYZ](./videos/abc123XYZ.md)

## Open questions for strategy/packaging
- Intro drop-off at 0.06 recurs across last 3 uploads — packaging or pacing?
- SUGGESTED now beats BROWSE on new uploads — lean into series framing?
```

## Rules

1. **Append, never overwrite.** A snapshot is a point in time; deleting it erases the trend. The history is the deliverable.
2. **One source of truth for derived numbers.** Store what the API returned. Mark Studio-sourced values explicitly (`ctr(studio)`) so a reader knows it was not API-derived.
3. **No interpretation in the log beyond a one-line "what changed."** Deeper reading ("we should change the hook") is the strategy/packaging sibling's job — this skill records, it does not prescribe.
4. **Siblings read this tree.** Keep the domain frontmatter keys stable (`date`, `range`, `channel`, `source`) so a sibling can parse the latest snapshot without guessing. The OKF keys (`type`, `title`, `description`, `tags`, `timestamp`) are added alongside them, never instead of them — all four youtube skills share this same key set and the same markdown-link style.
5. **OKF-conformant wiki content.** Every non-reserved `.md` here has a non-empty `type` (`youtube-metrics`). `index.md` is the lone reserved file (no frontmatter, a directory listing). Per-video logs are newest-first append-logs with ISO 8601 dates; past dated blocks are never edited. Cross-references use standard markdown links (`[text](./file.md)`), never `[[wikilinks]]`.
