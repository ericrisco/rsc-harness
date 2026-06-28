# Description, chapters & feedback-log formats

Offloaded depth for [../SKILL.md](../SKILL.md). Four things live here: the full
description template with a filled example, the chapter format spec with the four
failure cases worked through, the feedback-log entry schema with a filled row, and
the OKF v0.1 frontmatter shape for the package and log when persisted into the wiki.

## 1. Description template

Structure every description in this order. Only the first ~125 chars are
above-the-fold, so the first line carries the keyword and the audience.

```text
<ABOVE-FOLD LINE: primary keyword + who-it's-for, ~100-150 chars max>

<BODY: 2-4 short paragraphs, ~200-350 words total. Natural prose. Weave the
primary keyword + 1-2 variants in once each. Say what the video covers and the
payoff. No keyword lists.>

🔗 Resources
- <link 1>
- <link 2>

▶️ Watch next: <link to a relevant video>

👉 Subscribe for <one concrete promise>

#hashtag1 #hashtag2 #hashtag3
```

### Filled example (12-minute beginner Python tutorial)

```text
Learn Python from scratch in 2026 — a 12-minute beginner tutorial that takes you
from zero to your first working program, no prior coding needed.

In this beginner Python tutorial you'll install Python, write your first function,
and fix the error every newcomer hits. By the end you'll have a small program
running on your own machine and a clear path to the next step. I keep the jargon
out and the typing in — you build alongside me the whole way. If you've bounced off
Python before because tutorials moved too fast, this one is paced for a true
beginner.

🔗 Resources
- Starter code: https://example.com/python-starter
- Free cheat sheet: https://example.com/python-cheatsheet

▶️ Watch next: Python Projects for Beginners — https://example.com/next

👉 Subscribe for one beginner-friendly coding tutorial every week.

#Python #LearnToCode #ProgrammingForBeginners
```

The above-fold line is 132 characters — under the ~150 ceiling, keyword
("Learn Python") first, audience ("beginner") explicit. The body is ~150 words of
natural prose (scale to 200-350 for a longer video). Exactly 3 hashtags, all shown
above the title.

## 2. Chapter format spec

Four rules, all enforced by YouTube. Break ANY one and every chapter is ignored.

1. **≥ 3 timestamps.**
2. **First timestamp is `00:00`.**
3. **Each chapter ≥ 10 seconds long.**
4. **Ascending order.**

Compliant block:

```text
00:00 Intro — what you'll build
00:42 Installing the tools
03:15 Writing your first function
07:50 Debugging the common error
11:20 Recap & next steps
```

### The four failure cases

```text
# FAIL 1 — no 00:00 first (the silent killer): ALL chapters ignored
00:42 Installing the tools
03:15 Writing your first function
07:50 Debugging
Fix: add a 00:00 first line.

# FAIL 2 — only 2 timestamps: below the 3 minimum, chapters do not render
00:00 Intro
05:00 Outro
Fix: add at least one more chapter.

# FAIL 3 — a chapter shorter than 10s: 00:05 -> 00:11 is only 6s
00:00 Intro
00:05 Setup
00:11 Demo
Fix: no two adjacent timestamps closer than 10 seconds.

# FAIL 4 — out of order: 03:15 precedes 00:42
00:00 Intro
03:15 Demo
00:42 Setup
Fix: sort ascending.
```

Use `M:SS` or `MM:SS`; for videos over an hour use `H:MM:SS`. Each chapter title
should be short and scannable — it doubles as a search jump-to target.

## 3. Feedback-log entry schema

One markdown table in `02-DOCS/wiki/youtube/packaging-log.md`. One row per A/B
test, appended when Test & Compare resolves (~2 weeks).

`02-DOCS/wiki/` is an **OKF v0.1** bundle, so `packaging-log.md` carries
file-level frontmatter once at the top (a non-empty `type` plus the OKF surface
shared across all four youtube skills), then the table below it. Refresh
`timestamp` when you append a row; past rows are immutable.

```markdown
---
type: youtube-package
title: Packaging feedback log
description: One row per Test & Compare result — title sets tried, winner, and the transferable lesson.
tags: [youtube, packaging-log, ab-testing]
timestamp: 2026-05-28T00:00:00Z
---
# Packaging feedback log

| date | video | title set tried | winner | CTR | impressions | avg view duration | note |
|------|-------|-----------------|--------|-----|-------------|-------------------|------|
```

> Note: this frontmatter is for the **persisted wiki file**. The package *draft*
> you point `scripts/verify.sh` at uses labeled sections (`Titles:`,
> `Description:`, …) and stays frontmatter-free so the linter parses it cleanly.

Column meanings:

| Column | Meaning |
|---|---|
| `date` | resolution date of the test (YYYY-MM-DD) |
| `video` | video title slug or ID |
| `title set tried` | the 2-3 titles entered into Test & Compare, `\|`-separated |
| `winner` | which title YouTube auto-applied |
| `CTR` | click-through rate of the winner (%) |
| `impressions` | impressions over the test window |
| `avg view duration` | average view duration (mm:ss) — the retention half |
| `note` | the transferable lesson (the pattern, not the data point) |

Filled row:

```text
| date | video | title set tried | winner | CTR | impressions | avg view duration | note |
|------|-------|-----------------|--------|-----|-------------|-------------------|------|
| 2026-05-28 | python-beginner-tut | Learn Python in 2026: 12-Min Beginner Tutorial \| Python in 12 Minutes (Total Beginner) \| I Taught a Beginner Python in 12 Min | Learn Python in 2026: 12-Min Beginner Tutorial | 7.8% | 41,200 | 04:31 | Numeric + year title beat curiosity title again (3rd time) — keep leading with the number on tutorials |
```

The `note` column is the point: it turns one data row into a prior the next
package carries forward. Always grade the winner by watched-time-per-impression
(reflected in CTR *and* avg view duration together), never CTR alone — a high-CTR /
low-duration row is a warning, not a win.

## 4. Persisted package — the wiki file

When you persist a finished package under `02-DOCS/wiki/youtube/` (e.g.
`packages/<video-slug>.md`), wrap it in OKF v0.1 frontmatter — a non-empty `type`
plus the shared OKF surface — so the wiki bundle stays conformant and the
strategy/thumbnail siblings can read it. The body holds the human-readable
package; cross-references use standard markdown links, never `[[wikilinks]]`.

```markdown
---
type: youtube-package
title: Package — Learn Python in 2026 (beginner tutorial)
description: Title set, description, tags, hashtags and chapters for the 12-minute beginner Python tutorial.
tags: [youtube, packaging]
timestamp: 2026-05-28T00:00:00Z
---
# Package — Learn Python in 2026 (beginner tutorial)

## Titles (A/B set)
- Learn Python in 2026: 12-Min Beginner Tutorial
- Python in 12 Minutes (Total Beginner)
- I Taught a Beginner Python in 12 Min

## Description
<above-fold line + body + links + hashtag line, per §1>

## Tags
python, learn python, python tutorial, python for beginners, …

## Hashtags
#Python #LearnToCode #ProgrammingForBeginners

## Chapters
00:00 Intro — what you'll build
…
```

> The `scripts/verify.sh` linter runs on the package **draft** (labeled sections,
> no frontmatter). The persisted wiki file adds the frontmatter above the same
> body — do not feed the frontmatter'd wiki copy to the linter, since its `tags:`
> frontmatter key would be read as the Tags section.
