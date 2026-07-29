---
name: shortform-ideation
description: "Use when a Reels/TikTok/Shorts account needs its next video ideas scored into a ranked backlog, grounded in its own performance log plus dated trending sounds, each bet logged so its outcome feeds the next batch. NOT scripting a chosen idea (that is `video-shorts`), NOT pillars or cadence (that is `shortform-strategy`), NOT packaging a finished cut (that is `shortform-packaging`)."
tags: [shortform, reels, tiktok, ideation, content-ideas, trend-jacking, experiment-log]
recommends: [video-shorts, shortform-strategy, shortform-packaging, analytics, content-engine]
origin: risco
---

# Shortform Ideation — The Idea Engine and the Bet Ledger

*You run the closed loop for a Reels/TikTok/Shorts account: hypothesis → bet → measured outcome → a better next batch.* You own the idea list, the priority score, and the experiment ledger.

**Your output stops at a ranked, evidenced idea carrying a chosen trend hook and a written hypothesis.** The moment you start writing spoken lines or beat timecodes you have crossed into [`video-shorts`](../video-shorts/SKILL.md) — hand off, do not squat.

An idea you cannot defend with (a) this account's own performance log and (b) a dated trend signal is a brainstorm, not a bet. This skill refuses to emit a brainstorm dump.

## Decision gate — are you even in ideation?

Read the ask against this table before you generate anything, and hand off by the same table when a request lands outside your column. *Why: half the misfires here are scope creep into a sibling that owns the real deliverable.*

| The ask | Owner | Why it is not you |
|---|---|---|
| "Give me N ranked ideas / which do we shoot first" | **you** | generating + scoring + ranking is the core loop |
| "Fold this week's trending sounds into ideas" | **you** | trend-grounded ideation is the signature move |
| "Why did the bets we made flop?" | **you** | the outcome ledger ties bet → result; that is yours |
| "Write the shot-by-shot script / edit sheet for this idea" | [`video-shorts`](../video-shorts/SKILL.md) | you stop at the idea + hook angle + chosen sound |
| "What should our pillars / cadence / positioning be?" | [`shortform-strategy`](../shortform-strategy/SKILL.md) | you consume pillars as input, you do not set them |
| "Write the caption + hashtags + cover for this finished cut" | [`shortform-packaging`](../shortform-packaging/SKILL.md) | you may *suggest* a hashtag as a trend signal, not finalize one |
| "YouTube ideas with thumbnail-first packaging" | [`youtube-ideation`](../youtube-ideation/SKILL.md) | that pipeline is packaging-led and decays slower |
| "Run the cross-channel calendar across blog/email/social" | [`content-engine`](../content-engine/SKILL.md) | you feed ranked ideas *into* a calendar, you don't run it |
| "Build me a metrics dashboard" | [`analytics`](../analytics/SKILL.md) | you *read* the perf log to score ideas, you don't build reporting |

## The loop — four phases, in order

```text
Phase 1 GROUND        Phase 2 SOURCE TRENDS     Phase 3 GENERATE+SCORE   Phase 4 LOG THE BET
read 02-DOCS perf  ─▶ capture dated trend    ─▶ idea = topic × format ─▶ write hypothesis to
log; pull winning     signals (legally, no       × trend-hook × pacing    02-DOCS/shortform/
hooks/formats and     scraping); flag stale      → score → rank backlog   experiments/, leave
proven flops          signals                                             result fields pending
```

**Never skip Phase 1.** Ideas not grounded in this account's own data are guesses dressed as a plan. Grounding is what makes the score mean something. *Why: a hook that won on a cooking account can die on a B2B SaaS account; only the log tells you which one you are.*

## Phase 1 — Ground in 02-DOCS

The account's performance log lives at `02-DOCS/shortform/performance.md` (or `performance.csv`). Read it first, every cycle.

Extract four things and keep them in working memory for scoring:

1. **Winning hooks** — the opening 1–3s patterns that earned >60% 3s-hold.
2. **Winning formats** — talking-head, faceless voiceover, screen-record, skit, listicle — whichever over-indexed.
3. **Dead topics/formats** — what under-indexed twice or more. These are negative evidence; do not re-pitch them with a fresh coat of paint.
4. **Best 3s-hold patterns** — the specific first-frame moves that held viewers, because the 3s-hold is the metric the whole batch is optimizing for (see Metrics).

**If no log exists, bootstrap a minimal one** at `02-DOCS/shortform/performance.md` with columns `date | url | format | hook line | 3s-hold | shares | saves | views | note`, seed it with whatever the user can recall, and mark every idea this cycle as `unvalidated` so the next cycle knows the score was a prior, not a posterior. *Why: a missing log is not a reason to guess silently — it is a reason to start measuring.*

## Phase 2 — Source trends (legally)

Capture trending sounds, formats, and hashtags and **date every single signal**, because short-form trend windows are short and a stale signal is worse than no signal.

**Hard rule: never scrape. TikTok Creative Center has no public trends API and automated harvesting violates its ToS** (reinforced by the April 2026 rule updates). Trend Discovery (trending songs/hashtags/Top Ads) is browsable in-app without login by switching the region to United States; programmatic access requires the sanctioned Research API or Commercial Content API on developers.tiktok.com. You instruct *manual or assisted* capture — ask the user to paste the Creative Center view, or read from a sanctioned API — and you bake **zero** scraping commands into any artifact you emit. *Why: a scraper is both a ToS violation and a brittle dependency that breaks the loop.*

Four capture lanes, summarized here, with the per-source recipes in `references/trend-sources.md`:

- **TikTok Creative Center** — region-switch to US, and **compare 7-day vs 30-day movement.** Data refreshes every 24–48h. A sound that only moves on the 30-day view may already be dying; weight 7-day-rising signals higher.
- **Instagram trending audio** — the native Trending Audio list is gated to US Professional accounts; a trending sound shows an **upward-arrow indicator** next to its name in-app. Non-US/non-pro accounts lean on Explore, niche-creator repeat-use, and cross-platform origin tracking.
- **TikTok → Reels lead window** — Reels trends often lag TikTok by **3–7 days.** A sound viral on TikTok with **<5,000 Reels** using it on Instagram is a documented head-start window; flag it as `early` and prioritize it.
- **Niche-creator repeat-use** — when 3+ creators in the account's niche reuse the same sound/format inside a week, treat it as a niche-validated signal even before it shows on a global list.

Tag each captured signal: `signal | platform | first-seen date | 7d trend | 30d trend | freshness(early|peaking|stale)`. A signal with no date does not enter Phase 3.

## Phase 3 — Generate + score

**An idea is a product, not a topic:**

```text
idea = topic × format × trend-hook × pacing-archetype
```

- **topic** — drawn from the account's pillars and winning topics (Phase 1).
- **format** — a winning format from the log, or one deliberate experiment.
- **trend-hook** — a *dated, non-stale* signal from Phase 2, or "evergreen" if none fits.
- **pacing-archetype** — and a target length, because watch-time-per-length beats raw length: education tolerates +5–10s and proof, entertainment wants 1–2s cuts. Attach a target length so the bet is testable.

Score every idea on a weighted 1–5 rubric. The weights encode what actually drives short-form reach — hook strength and shareability, not topic interest.

| Criterion | Weight | What 5 looks like |
|---|---|---|
| Hook strength | ×3 | first 3s opens a loop / pattern-break that matches a proven winning hook |
| On-account fit | ×2 | topic+format both over-indexed in this account's log; never a proven flop |
| Trend freshness | ×2 | 7-day-rising sound, or TikTok→Reels `early` (<5k Reels) window |
| Shareability / save | ×2 | viewer has a clear reason to send or save it (utility, status, "this is so us") |
| Effort (inverse) | ×1 | low production lift; score 5 = shoot today with what you have |

`weighted_score = 3·hook + 2·fit + 2·fresh + 2·share + 1·(6−effort)` → max 50. Rank descending into the backlog.

**Backlog table schema** (this is the checkable artifact — `02-DOCS/shortform/backlog.md`):

| id | idea | hook line | trend signal + date | format | target len | score | status |
|---|---|---|---|---|---|---|---|
| SF-001 | … | … | … (2026-06-01, 7d↑) | … | … | 42 | planned |

`status` ∈ `{planned, shooting, posted, killed}`.

**Bad → Good idea:**

- **Bad:** "Do a video about our espresso machine." — a topic with no hook, no format, no trend, no score. Unrankable.
- **Good:** `SF-007 | "The €4 latte lie" cost-breakdown | hook: pour shot + on-screen "your café charges 900% markup" | trend: voiceover-receipt format, TikTok 7d↑, 3k Reels (early) 2026-06-01 | faceless voiceover | 18s | score 45 | planned` — a defensible bet with a loop-opening hook, a fresh dated signal, and a save reason (people screenshot the math).

## Phase 4 — Log the bet

Every idea you advance to `shooting`/`posted` gets a hypothesis file at `02-DOCS/shortform/experiments/<YYYY-MM-DD>-<slug>.md`. Schema and a worked before/after example are in `references/experiment-ledger.md`.

The hypothesis is one falsifiable sentence:

> **Hypothesis:** *trend* `voiceover-receipt` **+ hook** `"900% markup"` **will lift** `3s-hold` **above** `60%` **for topic** `café pricing`.

Then leave the **result fields pending** — `result: pending | 3s-hold: __ | hook-rate: __ | shares: __ | saves: __ | verdict: __` — to be filled after the video runs. The next cycle reads these verdicts in Phase 1: a confirmed hypothesis becomes a winning pattern; a falsified one becomes a dead pattern. *Why: logging the bet but never the outcome turns the ledger into a graveyard of guesses — the loop only learns if the result loop closes.*

To structurally lint an emitted backlog or experiment file, point `scripts/verify.sh` at it (read-only): `bash scripts/verify.sh 02-DOCS/shortform/`.

## Metrics that matter

Score and judge on these, not on raw views. *Why: views are lagging and gameable; these are the levers the algorithm actually rewards.*

| Metric | Read | Source fact |
|---|---|---|
| **3s-hold** | >60% = strong; <40% = kill the pattern | up to ~50% drop in first 3s; >60%-hold Reels can out-reach <40% ones by 5–10× |
| **Hook rate** | ~28% is the Meta short-form average; beat it | a hook/jump-cut in the first 3s correlates ~72% higher viral likelihood |
| **Shares + saves** | the discovery currency — weight in scoring | the algorithm rewards watch-time and shares for distribution |
| **Watch-time-per-length** | a 10s @ 80% beats a 60s @ 30% | optimize retention-for-length, not duration |

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Brainstorm dump with no scores | unrankable; the user can't decide what to shoot first | always emit the ranked backlog table with a score per idea |
| Chasing a 30-day-only trending sound | 30-day-only movement often means the sound is already dying | weight 7-day-rising; flag 30d-only as `stale` |
| Re-pitching a topic the log proved dead | ignores the account's own negative evidence | check Phase-1 flops before scoring; never pitch a proven flop |
| Scraping Creative Center for trends | violates ToS, breaks the loop, ships brittle code | manual/assisted capture or sanctioned API; zero scrape commands in artifacts |
| Scoring by topic interest, not hook strength | a fascinating topic with a dead first 3s still flops | hook strength carries ×3 weight; score the first frame first |
| Logging the bet but never the outcome | the loop never learns; next batch re-guesses | leave result fields and fill them; Phase 1 reads the verdicts |
| Writing the full script/timecodes here | crosses into `video-shorts`; muddies the idea ledger | stop at hook line + chosen sound; hand off |
| Capturing a trend signal with no date | freshness is unscorable; you may brief a dead sound | every signal carries a first-seen date or it doesn't enter Phase 3 |
