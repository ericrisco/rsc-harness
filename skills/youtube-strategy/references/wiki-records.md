# Wiki records — the read/write loop on disk

This is where the channel's strategy memory lives. The skill READs it on entry and WRITEs to it on exit so sessions compound. Keep it append-only.

`02-DOCS/wiki/` is an **OKF v0.1** bundle, so every `.md` record this skill writes carries YAML frontmatter with a non-empty `type` (`youtube-strategy-record`) plus the OKF surface (`title`, `description`, `tags`, `timestamp`). These are shared, identically, across all four youtube skills. The strategy-specific body fields the loop and `verify.sh` rely on (`Decision:`, `Bets on metric:`, the date) stay in the body exactly as before — the frontmatter is purely additive. All cross-references use standard markdown links (`[text](./file.md)`), never `[[wikilinks]]`.

## File layout under `02-DOCS/wiki/youtube/`

```text
02-DOCS/wiki/youtube/
├── positioning.md            # current claim: niche, who-it's-for, the three-factor rationale
├── what-worked.md            # running log of wins/losses tied to specific videos/playlists
└── decisions/                # one dated file per strategy decision (append-only)
    ├── 2026-03-cadence.md
    └── 2026-06-niche-down.md
```

- `positioning.md` is the single living statement of what the channel is. Overwrite it when positioning changes, but record the change as a decision file.
- `decisions/` is never edited after the fact — supersede an old decision with a new dated file, do not rewrite history. *Why: the value is the audit trail of what was tried and what it bet on.*
- A single running `decisions.md` log is acceptable for small channels instead of per-file; `verify.sh` accepts either.

## Bootstrap (empty or absent dir)

When `02-DOCS/wiki/youtube/` does not exist, create it and a positioning stub before deciding anything:

```bash
mkdir -p 02-DOCS/wiki/youtube/decisions
```

`positioning.md` stub:

```markdown
---
type: youtube-strategy-record
title: Channel positioning
description: The channel's current niche, who-it's-for, and three-factor rationale.
tags: [youtube, positioning]
timestamp: 2026-06-02T00:00:00Z
---
# Channel positioning
- Niche: <to define — narrow 2-3 levels, not an industry>
- Who it's for: <specific viewer>
- Three-factor check: interest=<>, demand=<>, monetization=<>
- Last reviewed: <date>
```

## Decision-record template

Every decision file carries the frontmatter (`type` + OKF surface) **and** these body fields. The metric line is mandatory — a decision with no metric is an opinion, not a checkable bet. The body fields (`Decision:`, `Bets on metric:`, the date) are what `verify.sh` lints, so keep them verbatim; the frontmatter sits above them.

```markdown
---
type: youtube-strategy-record
title: <one-line decision title>
description: <one-sentence summary of the decision and what it bets on>
tags: [youtube, strategy-decision]
timestamp: <YYYY-MM-DDTHH:MM:SSZ>
---
# <YYYY-MM-DD> — <one-line decision title>
- Context read: <what the wiki/data said that drove this; cite files with markdown links>
- Decision: <positioning / cadence / series choice, stated concretely>
- Bets on metric: <the single metric this decision expects to move, with current value>
- Review date: <YYYY-MM-DD — when to check whether the bet paid off>
```

Worked example:

```markdown
---
type: youtube-strategy-record
title: Niche down to budget mechanical keyboards for programmers
description: Reposition from broad tech reviews to budget mechanical keyboards for programmers, holding 2/wk cadence.
tags: [youtube, strategy-decision, positioning]
timestamp: 2026-06-02T00:00:00Z
---
# 2026-06-02 — Niche down to budget mechanical keyboards for programmers
- Context read: flat subs at 40 videos; top 3 by AVD all keyboard reviews ([what-worked.md](../what-worked.md))
- Decision: reposition from "tech reviews" to "budget mechanical keyboards for programmers"; hold cadence 2/wk
- Bets on metric: AVD on keyboard videos (~48%) holds while non-keyboard topics are dropped
- Review date: 2026-09-02
```

## What-worked template

`what-worked.md` carries the file-level frontmatter once at the top; below it, **append one entry per observed win or loss** (append-only, ISO 8601 dates, past entries immutable), tied to a real asset so future sessions can pattern-match. Refresh `timestamp` when you append.

```markdown
---
type: youtube-strategy-record
title: What worked — wins and losses log
description: Running log of channel wins/losses tied to specific videos and playlists.
tags: [youtube, what-worked]
timestamp: 2026-05-20T00:00:00Z
---
# What worked

## <YYYY-MM-DD> — <video or playlist id/title>
- Metric: <CTR / AVD / session lift, with the number>
- Lesson: <the transferable insight — what to do more or less of>
```

Example entry (appended under the frontmatter + heading):

```markdown
## 2026-05-20 — "I Tested 5 Sub-$20 Keyboards" (vid abc123)
- Metric: CTR 9.1%, AVD 52% (channel best)
- Lesson: comparison + price ceiling in the title; double down on multi-product budget comparisons
```

## What `verify.sh` checks

`scripts/verify.sh 02-DOCS/wiki/youtube/` is a read-only structural lint, no network:

1. The target `02-DOCS/wiki/youtube/` directory exists.
2. At least one decision record is present (a `decisions/*.md` file or a `decisions.md` log).
3. Each decision record contains the three required signals: a date, a `Decision:` line, and a named metric/bet (a `Bets on metric:` line or equivalent `metric`/`bet` field).
4. Each decision record carries a non-empty `type:` frontmatter field (the OKF v0.1 conformance check). A record with no `type` is a hard failure.

A record missing the metric or `type` field is a hard failure with a clear message. An empty or missing target reports cleanly and exits 0 — no false failure on a fresh channel. The `type` check is additive: it does not touch the existing date/`Decision:`/metric checks.
