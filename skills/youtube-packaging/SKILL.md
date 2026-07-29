---
name: youtube-packaging
description: "Use when writing or fixing the text that ships with a YouTube upload — title, description, tags, hashtags and chapters — when click-through is weak and the words are the suspect, or when closing the loop on what last performed. NOT designing the thumbnail image (that is `youtube-thumbnails`), NOT inventing the idea or angle (that is `youtube-ideation`), NOT the channel growth plan (that is `youtube-strategy`), NOT pushing the fields via the Data API (that is `youtube-api`)."
tags: [youtube, video-seo, titles, descriptions, chapters]
recommends: [youtube-thumbnails, youtube-ideation, youtube-strategy, youtube-api, video-shorts, seo-geo, social-publisher]
profiles: []
origin: risco
---

# YouTube packaging

You write the text that ships with the upload — title, description, tags,
hashtags, chapters — and you optimize it against what actually performed, not
against a hunch. A strong video dies on a weak package. You are not the picture,
not the idea, not the channel plan, and not the API that uploads any of it.

## What you produce

Five concrete text artifacts plus one feedback entry, every time:

1. **A title SET** — 2-3 titles, never one. (Why: YouTube tests titles, so you
   ship a hypothesis to measure, not a guess to defend.)
2. **A description block** — above-the-fold line + body + links + hashtag line.
3. **A tag list** — 5-8 tags, first = exact target phrase.
4. **A hashtag line** — 3-5 hashtags inside the description.
5. **A chapter list** — timestamps that obey four exact rules.
6. **A feedback-log update** in `02-DOCS` — what you tried, what won, the numbers.

**Co-ownership note, up front:** YouTube tests the title+thumbnail pair as ONE
unit. The *title hypothesis to test* is co-owned with
[youtube-thumbnails](../youtube-thumbnails/SKILL.md); the **wordsmithing of the
title and all other metadata lives here**. Draw the image there, write the words
here.

## Ground first (STOP gate)

Before you write a single title, read the channel. Skipping this is how you
produce generic copy in someone else's voice.

- Read `02-DOCS/wiki/youtube/` for the channel's **brand voice**, prior packages,
  and the **performance feedback log** (winners and losers from past tests).
- Pull the decided **idea/angle** from [youtube-ideation](../youtube-ideation/SKILL.md)
  output if it exists.
- **No decided topic/angle yet? Route OUT to `youtube-ideation`. Never invent the
  topic here.** (Why: packaging a video with no settled angle is guessing at the
  hook, the keyword, and the audience all at once.)

Persist what you write under `02-DOCS/wiki/youtube/` (the package) and raw test
results under `02-DOCS/raw/youtube/`. `02-DOCS/wiki/` is an **OKF v0.1** bundle:
every package or log file persisted there carries YAML frontmatter with a
non-empty `type` (`youtube-package`) plus the OKF surface (`title`, `description`,
`tags`, `timestamp`) shared with the strategy/thumbnail/api siblings, and all
cross-references use standard markdown links — never `[[wikilinks]]`. The OKF
frontmatter shape for the persisted package and log is in
[references/description-and-chapters.md](references/description-and-chapters.md).

## The title

The single highest-leverage field. Rules, each with one reason:

- **Hard limit 100 chars; visible budget ~60.** Titles truncate around 60-70 chars
  on desktop and ~50-60 on mobile. The most compelling words + the primary keyword
  must land in the first ~60 chars / first 5 words — everything after that may
  never be seen.
- **Front-load the keyword and the hook.** Shape: Hook + Keyword + Benefit inside
  the first 60 chars. Channels report 15-25% higher CTR for titles kept in the
  60-70 char range.
- **Use numbers and specificity.** Titles with numbers report ~20-30% higher CTR;
  a parenthetical qualifier (year, difficulty, format) adds precision without
  burning the budget.
- **Emit a SET of 2-3 titles framed as an A/B hypothesis** — never ship one.
  Test & Compare auto-applies the variant with the highest *watched time per
  impression*, **not raw CTR**. (Why this matters: a clickbait title that wins the
  click but loses the viewer will LOSE the test. Write for the click AND the stay.)

Bad -> Good (front-load, cut the filler, add specificity):

```text
Bad   In this video I'll show you how to learn Python
Good  Learn Python in 2026: 12-Minute Beginner Tutorial

Bad   My honest thoughts after using the new framework for a while
Good  I Shipped 3 Apps on This Framework — Here's the Verdict

Bad   Tips for better sleep that actually work I promise
Good  7 Sleep Fixes That Doubled My Deep Sleep (No Pills)
```

Decide the title shape by how the video will be found — this is a real branch:

| Discovery mode | Title shape | Example |
|---|---|---|
| Search-led (tutorial, how-to, "best X") | Keyword first, literal, benefit-clear | `Fix Slow Next.js Builds: 5 Proven Steps` |
| Browse-led (commentary, vlog, story) | Curiosity/stakes first, keyword secondary | `I Rebuilt My App and Regretted Everything` |

Search-led titles answer a query; browse-led titles win a scroll. Most videos
lean one way — pick it deliberately, then write the set inside that shape.

## The description

Only the first ~125 chars are above the fold — the rest hides behind "Show more"
and is unseen by most viewers.

- **First 1-2 lines (~100-150 chars): primary keyword + who-it's-for.** This is
  the one part that shows in search and the watch page before the fold. Spend it on
  substance, not "Welcome to my channel."
- **Body: ~200-350 words of natural, keyword-rich prose. No stuffing.** Write for a
  human; weave the keyword and 1-2 variants in naturally. Keyword lists read as
  spam and help nothing.
- **Links block** (resources, socials, gear) then the **3-5 hashtag line**.
- **One clear CTA** (subscribe / next video / comment prompt).

The full template + a fully filled example live in
[references/description-and-chapters.md](references/description-and-chapters.md).

## Chapters

Chapters obey **four exact rules. Break any one and YouTube ignores ALL chapters.**
Run this checklist on every chapter block:

- [ ] **At least 3 timestamps.**
- [ ] **The first timestamp is `00:00`.** (This is the silent killer — omit `0:00`
      and every later timestamp is discarded.)
- [ ] **Each chapter is at least 10 seconds long.**
- [ ] **Timestamps are in ascending order.**

Compliant block:

```text
00:00 Intro — what you'll build
00:42 Installing the tools
03:15 Writing your first function
07:50 Debugging the common error
11:20 Recap & next steps
```

Why bother: chapters lift watch time and give search a jump-to target. The four
failure cases worked through line by line are in
[references/description-and-chapters.md](references/description-and-chapters.md).

## Tags & hashtags

Different fields, different rules — and one of them barely matters:

| Field | Count | Placement | Weight |
|---|---|---|---|
| Tags | 5-8 (up to 10-20), ~500-char budget | the Tags input box | **minimal ranking impact**; first tag weighted slightly more |
| Hashtags | 3-5 relevant; **max 15** | inside the description | first 3 render above the title; **>15 = ALL stripped** |

- **Tags: make the first tag the exact target phrase; do not over-invest.** YouTube
  calls tags' discovery role "minimal" — they mainly fix misspellings and
  disambiguate. Spend 2 minutes here, not 20.
- **Hashtags: pick 3-5 relevant ones; never exceed 15.** Only the first three show
  above the title, so order them best-first. Exceed 15 and YouTube strips every
  hashtag — you get zero, not 15.

## The learning loop

This is what makes the skill *learn* instead of guess. Because Test & Compare
measures variant performance directly, every package is logged and graded.

**Read before you write.** Open the feedback log in `02-DOCS/wiki/youtube/` and
carry forward what won as priors: if numeric titles beat curiosity titles 3 tests
running on this channel, the new set leans numeric. If a hashtag set tanked, drop
it.

**Append after you test.** One row per test, into `02-DOCS/wiki/youtube/packaging-log.md`
(OKF v0.1: file-level `type: youtube-package` frontmatter at the top, the table
below it, newest rows appended, past rows immutable):

```text
| date | video | title set tried | winner | CTR | impressions | avg view duration | note |
```

The cycle: read winners/losers -> write the new package as informed priors ->
ship the A/B set -> when Test & Compare resolves (~2 weeks), append the result ->
the next package is a little less of a guess. The full schema with a filled row is
in [references/description-and-chapters.md](references/description-and-chapters.md).

**Grade by watched-time-per-impression, not raw CTR.** A title can win clicks and
still lose the test by losing viewers. Log both so the lesson is honest.

## Handoffs

Stay inside the text fields. Everything else routes out:

| Ask | Owner |
|---|---|
| Design/generate the thumbnail image | [youtube-thumbnails](../youtube-thumbnails/SKILL.md) |
| Come up with the idea / topic / angle | [youtube-ideation](../youtube-ideation/SKILL.md) |
| Channel growth plan, niche, cadence | [youtube-strategy](../youtube-strategy/SKILL.md) |
| Upload/update metadata via the Data API | [youtube-api](../youtube-api/SKILL.md) |
| Cross-platform short caption/hook (TikTok/Reels) | [video-shorts](../video-shorts/SKILL.md) |
| Keyword research for web/AI search (not YouTube) | [seo-geo](../seo-geo/SKILL.md) |
| Schedule/publish the post to socials | [social-publisher](../social-publisher/SKILL.md) |

The tell: if the ask is **the text fields of the YouTube upload**, it is here. The
picture, the idea, the channel plan, the API call — each is a sibling.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| "In this video I'll show you…" opener | Burns the visible ~60-char budget on filler | Front-load keyword + hook in the first 5 words |
| Shipping ONE title | No hypothesis, nothing to learn | Always a SET of 2-3 for Test & Compare |
| Keyword-stuffing the description | Reads as spam, helps nothing | ~200-350 words of natural prose, keyword woven in |
| Clickbait the video can't cash | Wins the click, loses the viewer, LOSES the A/B | Promise what the video delivers |
| Chapters with no `00:00` / <3 / <10s / out of order | YouTube silently ignores ALL chapters | Run the four-rule checklist |
| >15 hashtags | YouTube strips every one — you get zero | 3-5 relevant, best three first |
| Obsessing over tags | They have minimal ranking impact | 5-8, first = target phrase, move on |
| Ignoring the feedback log | Every package stays a fresh guess | Read prior winners, carry them as priors |
| Optimizing CTR while view duration tanks | Test & Compare scores watched-time-per-impression | Log both; write for click AND stay |

## Verify

Run [scripts/verify.sh](scripts/verify.sh) on an emitted package file (the title
set, description, tags, hashtags, and chapters as one structured block). It is
read-only and lints the mechanical constraints: ≥2 titles, each ≤100 chars;
above-the-fold first line present and not over-long; ≥3 chapters with first `0:00`,
ascending, ≥10s gaps; 1-15 hashtags; tags within the ~500-char budget. A clean or
empty file exits 0.

## See also

- [youtube-thumbnails](../youtube-thumbnails/SKILL.md) — the image the title sits on; the pair is tested together.
- [youtube-ideation](../youtube-ideation/SKILL.md) — the idea/angle you package here.
- [youtube-strategy](../youtube-strategy/SKILL.md) — channel positioning, niche, cadence.
- [youtube-api](../youtube-api/SKILL.md) — programmatic upload/update of these fields.
