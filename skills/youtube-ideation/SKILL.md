---
name: youtube-ideation
description: "Use when deciding which videos a channel should make next and tracking whether each bet beat baseline — generating, scoring and prioritising candidate ideas from the channel's own performance log plus outlier and search-trend research, then recording each promoted idea as a dated hypothesis with its measured outcome. NOT writing the title or thumbnail text for a chosen idea (that is `youtube-packaging`)."
tags: [youtube, video-ideas, ideation, idea-validation, outlier-analysis, content-strategy, hypothesis-tracking, learning-loop, niche-research, prioritization]
recommends: [youtube-strategy, youtube-packaging, youtube-thumbnails, youtube-api, competitor-watch, market-research]
origin: risco
---

# youtube-ideation

You decide **what to make next, and you learn from whether it worked**. You own the
funnel from "what should the next 5 videos be" down to a ranked, scored shortlist where
every survivor carries an explicit bet — "this will beat our baseline because X" — that
the *next* run can audit. You are bets plus a scoreboard, not a brainstorm.

This is not the place to write the title or thumbnail of a chosen idea, design the image,
set the channel's positioning, or pull raw analytics. Three hard stops so you don't drift
into a neighbour's job:

- You do **not** word the title / thumbnail-text / description of a chosen idea — that is
  `../youtube-packaging/SKILL.md`. You pick *which* idea; packaging picks *how it's worded*.
- You do **not** design or critique the thumbnail image — that is `../youtube-thumbnails/SKILL.md`.
- You do **not** set durable positioning, format mix, niche, or cadence — that is
  `../youtube-strategy/SKILL.md`. Strategy is doctrine; you operate inside it.

You also do **not** call the Analytics/Data API for raw views/CTR/retention — that is
`../youtube-api/SKILL.md`. You *read* the performance log it produces. And you *mine*
competitors for outliers as one-time input; running a standing watch on a named rival is
`../competitor-watch/SKILL.md`.

## What you produce

Two coupled Markdown artifacts, both written to `02-DOCS/` so the next run sees them:

1. **An idea ledger** — candidate ideas scored on a fixed rubric, ranked, with the top
   picks promoted to `produce`, each tagged with its demand evidence (outlier links,
   search signal) and a one-line hypothesis.
2. **An append-only hypothesis/outcome log** — idea → predicted outlier multiple → actual
   result (views vs baseline, CTR, retention) → verdict (validated / killed / inconclusive)
   → the lesson that updates the next scoring pass.

The single governing rule, said once and loudly:

> **Every promoted idea carries a dated hypothesis with a predicted outlier multiple that
> you WILL grade after publish.** An idea without a falsifiable bet does not get promoted.

*Why:* "more ideas" never grew a channel; better, audited *decisions* do. The deliverable
is decisions and a scoreboard — not scripts (`../video-shorts/SKILL.md`) and not images.

Exact templates for both artifacts: `references/idea-ledger-and-loop.md`.

## Read the log first — you cannot score what you can't measure

Before you generate a single idea, load the channel performance history from `02-DOCS/`
and compute each past video's **outlier multiple = views ÷ the channel's average views**.

```text
outlier_multiple = video_views / channel_average_views
# 50,000 views on a channel averaging 6,250  -> 8.0x  (a real hit)
# 500,000 views on a channel averaging 1,800,000 -> 0.3x  (a miss, despite the big number)
```

The multiple normalizes across channel size, so it is the only fair way to compare a small
channel's win to a large one's — *why* you score "outlier signal" on the multiple, never on
raw views.

Decision at the top of every run:

| Found in `02-DOCS/`? | Do this |
| --- | --- |
| A performance log with views per video | Use it. Compute the channel average → that is your **baseline**. |
| Nothing | Bootstrap: compute the average from whatever videos you can get, write `baseline = N views (from M videos, YYYY-MM-DD)` to `02-DOCS/`, and say so out loud. |

You cannot grade a hypothesis "vs baseline" if there is no baseline. The raw numbers are
populated by `../youtube-api/SKILL.md` — you read them, you do not pull them.

## Generate research-led, not blind

The 2026 workflow that actually works is research-led, not brainstorm-led. Run these six
steps in order — do not skip to step 6:

1. Analyze the successful channels in the niche.
2. Find their **outlier videos** (high multiple, not high raw views).
3. Study the title + thumbnail patterns those outliers share.
4. Identify the **content gaps** — what the outliers prove demand for but nobody owns well.
5. Check audience + trend signals (next section).
6. Generate **original variations** — your angle, not a copy.

Two non-negotiable rules from the data:

- **3x or better is a real signal; 2x is likely noise.** *Why:* a 2x sits inside normal
  channel variance, so betting on it is betting on luck.
- **Find 5–10 outliers and extract the shared trait.** *Why:* one outlier is an anecdote;
  a pattern across many is a signal you can name and reproduce.

```text
Bad:  "Make a video about X because it's trending right now."
Good: "Make OUR angle on X: 6 niche outliers (3.4x–7.1x) all open on the same stakes
       in the first 8 seconds, and we hold first-hand proof none of them have."
```

Outlier math worked end to end, plus the expanded pipeline: `references/research-and-signals.md`.

## Score on the rubric — a fixed scorecard beats vibes

Score every surviving idea 1–5 on seven dimensions, sum to a total out of 35.

| # | Dimension | 1 | 5 |
| --- | --- | --- | --- |
| 1 | Audience fit | off-niche | dead center for our core viewer |
| 2 | Proven demand | no signal | strong search/trend evidence on the row |
| 3 | Outlier signal | no outliers found | 5+ niche outliers at 3x+ share the trait |
| 4 | Packaging potential | hard to title/thumbnail | obvious strong title + thumbnail exist |
| 5 | Retention potential | thin payoff | a hook + payoff that holds to the end |
| 6 | Originality | a copy of an outlier | a genuinely new angle / unique proof |
| 7 | Monetization fit | off-brand for sponsors | natural fit for our revenue |

Verdict bands (out of 35):

- **30–35 → produce.** Promote it (and it must carry a hypothesis — see below).
- **24–29 → improve the angle first**, then rescore.
- **18–23 → gray middle**: re-angle or shelve; do not produce as-is.
- **under 18 → abandon.** Say why in one line so the next run doesn't re-raise it.

Worked example — two ideas, same niche:

| Idea | Fit | Demand | Outlier | Pkg | Ret | Orig | Money | Total | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| "I rebuilt X the way the pros do" | 5 | 4 | 5 | 5 | 4 | 4 | 4 | **31** | produce |
| "My honest thoughts on X this year" | 4 | 2 | 2 | 2 | 3 | 3 | 3 | **19** | re-angle (gray) |

*Why a fixed rubric:* it makes "no" defensible and makes every hypothesis comparable across
runs — without it, last month's score and this month's score mean nothing to each other.

## Validate demand before committing a week of editing

Three fast pre-tests before any idea earns `produce`:

1. Can you state the idea in **one sentence**? If not, it isn't ready.
2. Does it serve the **core audience AND** have reach to **new** viewers? Need both.
3. Does **search/trend demand** exist for the topic? Prove it, don't assume it.

Where to get the signal:

| Free (use first) | Paid (for real volume numbers) |
| --- | --- |
| YouTube Studio **Trends** tab — top searches for *your* audience + saved topics, last 28 days | OutlierKit, Keywords Everywhere |
| Google Trends (direction, seasonality) | vidIQ (volume + trending, ~50 Daily Ideas/day) |
| YouTube **autocomplete** (real query phrasings) | TubeBuddy (weights score vs *your* channel authority), Semrush |

Hard rule: **record the evidence on the idea's ledger row** — the outlier links and the
search number. An unsupported `proven demand: 5` is vibes laundered as rigor and is not
allowed. (TubeBuddy and vidIQ also do title/thumbnail A/B testing — that is a *packaging*
job; route it to `../youtube-packaging/SKILL.md`.) Source table: `references/research-and-signals.md`.

## Write the hypothesis, then promote

Every `produce`-tier idea gets a bet in this exact shape:

```text
idea → predicted outlier multiple → why (the mechanism) → judge-by metric (vs baseline) → date
```

```text
Bad:  "This one should do well."
Good: "Predict 2.5x baseline. Bet: the contrarian title + we own first-hand proof no
       outlier has. Judge by 28-day views vs trailing-10 average AND CTR vs channel
       median. 2026-06-02."
```

Promote the **top 3–5** by score (default). Each promoted row moves into the
hypothesis/outcome log as a `pending` bet, dated. Template:
`references/idea-ledger-and-loop.md`.

## Close the loop — the part most creators skip

This is why the skill exists. After the video publishes, **append** an outcome row to the
log:

- actual outlier multiple, CTR, retention vs baseline;
- **verdict**: `validated` / `killed` / `inconclusive`;
- the **lesson** that adjusts the next scoring pass.

| Verdict | What it means | What it changes next run |
| --- | --- | --- |
| validated | beat the predicted multiple | double down on the shared trait that worked |
| killed | missed baseline clearly | demote that dimension's weight for similar ideas |
| inconclusive | too small a sample / confounded | note the confound, re-run, don't conclude |

Hard rules: the log is **append-only and dated**. **Never overwrite a past bet** — the
entire value is the audit trail of what you predicted versus what happened. A log you can
rewrite teaches you nothing.

## 2026 context that weights the bet

- **Shorts-first storytelling is the dominant discovery force.** Weight format reach when
  scoring — a Shorts-shaped idea tests messaging cheaply and fast.
- **YouTube is rolling out AI-content disclosure labels** (voluntary or auto-applied). If an
  idea leans on AI-generated media, **flag it on the row** — the label can dampen reach.

Both are inputs to *this* bet, not a durable format-mix decision; that durable call belongs
to `../youtube-strategy/SKILL.md`. Dated notes: `references/research-and-signals.md`.

## Anti-patterns

| Bad | Why it costs you | Good |
| --- | --- | --- |
| Brainstorm 50 ideas with no channel data | "outlier signal" becomes fiction | read the log + find real outliers first |
| Promote an idea with no hypothesis | you can't learn from the outcome | every `produce` idea gets a falsifiable bet |
| Treat one outlier as a trend | anecdote, not signal | require 5–10 outliers sharing a trait |
| Overwrite the log when a bet fails | destroys the audit trail | append-only, dated, never rewrite |
| Chase a 2x like it's a hit | inside normal variance — likely noise | use the 3x+ threshold |
| Score "proven demand: 5" with no evidence | vibes laundered as rigor | attach outlier links + a search number |
| Write the title/thumbnail here | wrong skill | route to youtube-packaging / youtube-thumbnails |
| Run ideation as a one-shot | no learning loop | outcomes feed the next scoring pass |

## Verify + references

Lint a produced ledger before you trust it:

```bash
scripts/verify.sh path/to/idea-ledger.md
```

It is read-only: it checks every idea is scored on all 7 dimensions with a /35 total that
matches its verdict band, every `produce` idea carries a hypothesis + numeric predicted
multiple + judge-by metric, and the outcome log is append-only-shaped (dated rows; each bet
either `pending` or carrying `actual + verdict + lesson`). An empty/clean target is a skip,
never a failure.

- Templates + a fully worked example (3 ideas scored, 1 promoted, outcome appended):
  `references/idea-ledger-and-loop.md`.
- Outlier math, the 6-step pipeline expanded, the signal-source table, 2026 context:
  `references/research-and-signals.md`.
