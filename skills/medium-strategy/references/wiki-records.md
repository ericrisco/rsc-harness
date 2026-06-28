# Wiki records — layout, templates, and the verify.sh contract

This is the persistence layer that makes medium-strategy compound. Read SKILL.md §1 and §9 first; this file is the exact format.

Every `.md` file written under `02-DOCS/wiki/medium/` is part of the OKF v0.1 bundle: it carries YAML frontmatter with a non-empty `type:` (the only required OKF field), and any cross-references use **standard markdown links** (`[Text](./pubs.md)`), never wikilinks (`[[...]]`). The domain lines `verify.sh` greps for (the dated heading, `Decision:`, the metric/bet field) stay exactly as shown below.

## Layout under `02-DOCS/wiki/medium/`

```text
02-DOCS/wiki/medium/
├── decisions/                # one file per strategy decision (append, never rewrite history)
│   ├── 2026-06-02-solo-vs-pub-ai-series.md
│   └── 2026-09-01-q3-review-double-down.md
├── what-worked.md            # running log of outcomes tied to stories/pubs/tags
├── pubs.md                   # accepted / pitched / dropped publications + their guidelines notes
└── tags.md                   # tag sets tried + which pulled member reading time
```

`decisions/` per-file is the primary form. A single running `decisions.md` at the root is also accepted by verify.sh if a writer prefers one log file.

## Decision record template

Every decision file MUST carry three signals: a **date**, a **Decision:** line, and a **named metric/bet**. The metric is mandatory — a decision with no metric is an opinion, not something you can check next quarter.

```markdown
---
type: medium-decision
title: Solo vs publication for the AI-tools series
description: Stay solo; canonical-import the evergreen blog posts; pitch one Boost-eligible AI pub.
tags: [medium, publications, monetization, distribution]
timestamp: 2026-06-02T00:00:00Z
topic: medium
status: stable
---

# 2026-06-02 — Solo vs publication for the AI-tools series

Decision: Stay solo profile; canonical-import the 6 evergreen blog posts; pitch one Boost-eligible AI publication with a new native original.
Rationale: ~400 followers and no editor nomination path; the owned blog already has search traffic worth importing (external read +5%, search budget 15%). Pitching one pub buys a Boost nomination path without giving up the solo home.
Bets on metric: member reading time from external + search referral over 90 days; ≥1 Boost nomination this quarter.
Status: open
```

`type:` (required) + `timestamp:` (ISO 8601, last meaningful edit) are the OKF surface; the `Status:` line in the body is the domain bet-lifecycle marker — distinct from the frontmatter `status:` (the OKF article lifecycle: draft | stable | stale). When the bet resolves, append a short outcome to the body (`Status: won — Boost nomination 2026-07; +2.1h member reading time`) rather than editing the original — append-only history. A running `decisions.md` log at the root carries one frontmatter block at the top (`type: medium-decision`).

## what-worked.md entry template

`what-worked.md` is one running file; new review blocks are prepended newest-first under a single frontmatter block at the top.

```markdown
---
type: medium-record
title: What worked — Medium
description: Running log of outcomes tied to specific Medium stories, publications, and tags.
tags: [medium, what-worked, member-reading-time, boost]
timestamp: 2026-09-01T00:00:00Z
topic: medium
status: stable
---

## 2026-09-01 — Q3 review
- `AI Coding Tools` (long-tail) + Boost → 3.2h member reading time on one story. Double down: keep the long-tail tag, pitch the same pub again.
- Imported blog post w/ canonical + newsletter push → +5% external bonus visible, but low member conversion. Keep importing; stop expecting member reads from cold list.
- Pitched "Big Generic Pub" twice, no reply → DEAD. Drop it.
```

## pubs.md / tags.md

Keep these lightweight. `pubs.md`: pub name | status (accepted/pitched/dropped) | niche fit | a one-line guideline note. `tags.md`: tag | popular-or-long-tail | did it pull member reading time?

Both still carry OKF frontmatter (one block at the top of each file):

```markdown
---
type: medium-record
title: Publications tracker   # or: Tag sets tried
description: Accepted / pitched / dropped Medium publications and their guideline notes.
tags: [medium, publications]   # or [medium, tags, distribution] for tags.md
timestamp: 2026-09-01T00:00:00Z
topic: medium
status: stable
---
```

## The verify.sh contract

`scripts/verify.sh` is a **structural lint, not a craft judge.** Run it after a session:

```bash
./scripts/verify.sh 02-DOCS/wiki/medium/
```

It checks, read-only:
1. The target directory exists.
2. At least one decision record is present (`decisions/*.md` or a root `decisions.md`).
3. Each record carries the three required signals: a date (`YYYY-MM-DD`), a `Decision:` line, and a named metric/bet (`Bets on metric:` / `metric` / `bet`).

A missing metric/bet is a **hard failure** — by design. A missing or empty target (a fresh account with no wiki yet) is reported and exits **0** — no false failure. It judges structure only; whether the *strategy* is good is the capability eval's job.
