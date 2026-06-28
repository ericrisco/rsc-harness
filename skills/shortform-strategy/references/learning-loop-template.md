# Learning-loop template

The forms that keep SKILL.md a playbook instead of a worksheet. Copy these verbatim into the project so the ledger stays machine-readable and decisions stay traceable.

## Per-post metrics ledger

Write to `02-DOCS/raw/shortform/metrics.csv`. One row per published post. The non-vanity columns — `completion_pct`, `sends`, `saves` — are the ones that drive reach in 2026; logging only `likes`/`views` makes you blind to the actual signal.

```csv
date,platform,format,hook,length_s,sound,completion_pct,sends,saves,follows,notes
2026-06-02,tiktok,reel,"3 tabs every remote worker should close",18,trending-niche,68,42,77,9,"series #07; rode niche sound <24h"
2026-06-04,instagram,carousel,"the 4pm energy crash fix",,,,31,120,4,"sales angle; saves high, sends low"
```

Column notes:
- `format`: `reel` | `carousel` | `static` | `tiktok`.
- `length_s`: blank for non-video (carousel/static).
- `sound`: `trending-niche` | `trending-global` | `original` | blank.
- `completion_pct`: integer percent; the account's primary KPI.
- `sends`: DM-shares (top Reels distribution signal in 2026).
- `saves`: outrank likes; depth/intent signal.
- `notes`: series tag, trend call, anything to read next month.

Deliberately **no `likes` column** — if you want it, add it last, never first.

## Monthly review checklist

Run once a month, reading `02-DOCS/raw/shortform/metrics.csv`:

- [ ] Sort by `completion_pct`: name the top 3 and bottom 3 posts. What do the top 3 share?
- [ ] Sort by `sends`: same — which hooks/formats earned shares?
- [ ] Compare actual cadence to the planned cadence (3–5 TikTok / 4–7 Reels). Over the ceiling?
- [ ] Did any series episode beat the account average? Keep, kill, or re-pilot it.
- [ ] Which trend calls paid off (rode within 24h, on-niche) vs which were forced?
- [ ] Make exactly **one** change to positioning, cadence, mix, or series — not five.
- [ ] Record it as a dated decision (template below). Set a `revisit on` date.
- [ ] Write the compiled state back to `02-DOCS/wiki/shortform/strategy.md`.

## Decision-record template

`02-DOCS/wiki/shortform/decisions.md` is an OKF v0.1 append-log: the frontmatter header (a non-empty `type` is the only OKF hard requirement; `title`/`tags`/`timestamp` are recommended) is written once, then each new block is **prepended newest-first** under the H1. Every block is dated (ISO 8601), rests on a named metric, and carries a revisit date so it is an experiment, not folklore. Past blocks are immutable; bump the header `timestamp` on each append.

```markdown
---
type: shortform-decision-log
title: Shortform strategy decisions
tags: [shortform, strategy, decisions]
timestamp: YYYY-MM-DDTHH:MM:SSZ
---
# Shortform strategy decisions

## YYYY-MM-DD — <short decision title>
**Decision:** <what changes, concretely — cadence/positioning/series/trend rule>
**Rationale:** <the one-line why>
**Rests on:** <ledger metric(s) + which platform signal, e.g. completion avg 31%, cadence ceiling>
**Revisit on:** YYYY-MM-DD — <the condition that confirms or reverses this>
```
