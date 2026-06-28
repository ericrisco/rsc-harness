# Experiment log format

The wiki layout, schema, filled example, and pattern-mining heuristic for the
feedback loop in SKILL.md. Everything lives under `02-DOCS/wiki/youtube/`.

`02-DOCS/wiki/` is an **OKF v0.1** bundle, so both files below carry file-level
YAML frontmatter with a non-empty `type` (`thumbnail-experiment`) plus the OKF
surface (`title`, `description`, `tags`, `timestamp`) — the same shared key set the
api/strategy/packaging siblings use. The frontmatter sits once at the top of each
file, above the table. Refresh `timestamp` when you append/rewrite. Any
cross-reference uses a standard markdown link (`[text](./file.md)`), never an
Obsidian `[[wikilink]]`.

## Files

- `thumbnail-experiments.md` — append-only log, one row per Test & Compare run.
- `thumbnail-patterns.md` — derived, human-maintained summary of what wins on this
  channel. You rewrite the relevant line after each logged test.

## `thumbnail-experiments.md` schema

File-level frontmatter once at the top, then the append-only table below it:

```markdown
---
type: thumbnail-experiment
title: Thumbnail experiments log
description: One row per Test & Compare run — variants, axis tested, winner, and the takeaway.
tags: [youtube, thumbnails, ab-testing]
timestamp: 2026-06-01T00:00:00Z
---
# Thumbnail experiments

| date | video | variants | axis tested | winner | CTR | watch-time share | note |
```

- **date** — ISO date the test concluded.
- **video** — title or video ID.
- **variants** — short labels, e.g. `A: face-shock / B: object`.
- **axis tested** — the single axis you varied (subject, expression, text, color,
  layout, zoom).
- **winner** — which variant YouTube auto-promoted.
- **CTR** — reported click-through for the winner (context only; not the deciding
  metric).
- **watch-time share** — the metric that actually decided the test.
- **note** — one-line takeaway, especially any over-promise signal.

### Filled example

```text
| date       | video                | variants                  | axis tested | winner | CTR  | watch-time share | note |
|------------|----------------------|---------------------------|-------------|--------|------|------------------|------|
| 2026-05-20 | I built a PC in 24h  | A: face-shock / B: object | subject     | A      | 6.1% | 41%              | face beat the build photo clearly |
| 2026-05-28 | $200 budget PC       | A: shock / B: confident   | expression  | B      | 5.4% | 39%              | calm-confident edged shock for this niche |
| 2026-06-01 | Worst PC parts       | A: text / B: no-text      | text        | A      | 5.9% | 38%              | one bold word helped; thin margin, re-test |
```

## `thumbnail-patterns.md` shape

```markdown
---
type: thumbnail-experiment
title: What wins on this channel
description: Derived summary of the settled thumbnail axes and their confidence.
tags: [youtube, thumbnails, patterns]
timestamp: 2026-06-01T00:00:00Z
---
# What wins on this channel

| axis | settled winner | evidence | confidence |
|------|----------------|----------|------------|
| subject    | human face        | 4/5 tests | high   |
| expression | confident > shock | 2 tests   | low    |
| text       | 1 bold word       | 2 tests, thin margins | low |
```

## Pattern-mining heuristic

1. Group logged rows by `axis tested`.
2. For each axis, count which level won and by what watch-time margin.
3. Promote a level to "settled winner" only when it holds across ~3+ tests OR wins
   by a large, repeated margin. Mark confidence honestly.
4. The next thumbnail keeps every settled winner and tests the next unsettled axis.

## Minimum-sample caveat

On a small channel, watch-time-share differences inside a single ~2-week test are
mostly noise. A single result is a hint, not a rule. Resist rewriting your whole
thumbnail style off one win — wait for the margin to repeat. When content type or
audience shifts noticeably, re-open settled axes; yesterday's winning pattern was
fit to yesterday's audience.
