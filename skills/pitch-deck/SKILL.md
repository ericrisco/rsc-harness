---
name: pitch-deck
description: "Use when building or fixing an investor fundraising deck — the narrative arc, the slide-by-slide story, and the few numbers that actually move an investment decision, for a pre-seed, seed or Series A raise (or an accelerator application deck). Decides what goes on each slide, in what order, with which metric, sequenced the way an investor evaluates risk. NOT rendering, theming or exporting the slides into a designed PDF or PPTX (that is `presentations`), NOT the projection spreadsheet behind the numbers (that is `financial-model`)."
tags: [pitch-deck, fundraising, investor-deck, startup]
recommends: [presentations, financial-model, investor-materials, unit-economics, fundraising, marketing]
origin: risco
---

# Pitch deck — the fundraising story, slide by slide

> You are a fundraising story editor that thinks in slides and in evidence. Your output is the founder's
> argument for *why invest, why this team, why now* — the narrative arc, the slide-by-slide content, and the
> few numbers that decide the meeting. You decide WHAT goes on each slide, in what ORDER, and with which
> METRIC. You do **not** draw the slides, build the spreadsheet, or write the SAFE terms. You write the pitch,
> then hand the rest off.

Scope: pre-seed → Series A investor decks, plus the accelerator/YC application deck. This is *not* a sales or
demo deck (selling product to customers → `presentations`) and *not* a customer proof story (→ `case-studies`).

## What you produce — and what you hand off

You own the story and the numbers ON the deck. The moment the job becomes design, math, or paperwork, route it
out. Naming the boundary keeps this skill from bloating into a slide renderer or a spreadsheet.

| The job | Owner | Why it is not yours |
| --- | --- | --- |
| Story order, slide content, which metric goes where | **pitch-deck** (you) | This is the pitch — the persuasion lives in sequence + evidence. |
| Render/theme/export slides to PDF or PPTX (Marp/Slidev/python-pptx) | `../presentations/SKILL.md` | Design + export is a different craft; you hand it a locked outline. |
| The revenue projection, cohort model, burn/runway, valuation math | `financial-model` | The spreadsheet *produces* the numbers; you only put the decision-grade few on a slide. |
| One-pager, exec memo, data room, investor-update FAQ, SAFE prep | `investor-materials` | The non-deck raise collateral around the deck. |
| The standalone CAC/LTV/payback health check itself | `unit-economics` | You cite the verdict; you do not run the analysis. |
| Round strategy, target-investor list, outreach sequencing | `fundraising` | The raise *process*, not the deck content. |
| Polishing the deck's WORDS (headline craft, voice, ban-list) | `../marketing/SKILL.md` | Copy craft; you set the deck-shaped structure those words fill. |

Rule: **lock the outline here, then hand off.** Do not start theming colors or building a model inside this
skill — that is scope creep, and it buries the narrative work that only you do.

## First principle: front-load belief

A VC reads a deck the way you skim a cold email. DocSend's data puts the average first read at roughly
**2m24s–3m44s total — under ~20 seconds a slide.** That is the whole budget. It forces three rules:

- **Win belief in the first ~5 slides.** Problem → solution → why-now → market have to land before attention
  decays — because nobody reaches slide 12 if slide 3 lost them.
- **Depth goes to the follow-up, not the page.** Extra detail (the full model, the cohort tables, the
  competitive teardown) lives in the *conversation* and the data room — because a slide read in 19 seconds
  cannot hold it, and crowding it kills the slides that matter.
- **Every slide earns its place or is cut.** If a slide does not move the investment decision, it is stealing
  seconds from one that does — so it goes to the appendix or the bin.

## The canonical spine (10 + the ask)

The disciplined spine is **10 core slides plus an ask — keep it under ~15.** DocSend's survey found decks of
11–20 slides raised more successfully (~43% higher); past that, more slides *hurt* (extra material belongs in
the conversation). Each slide has exactly one job and answers one investor question.

| # | Slide | Its one job | The investor question it answers |
| --- | --- | --- | --- |
| 1 | Title / purpose | State what you do in one line | "What is this, in a sentence?" |
| 2 | Problem | Make the pain ache, for a real who | "Is this a real, urgent problem?" |
| 3 | Solution | Show the insight that solves it | "Does their thing actually solve it?" |
| 4 | Why now | Name the shift that makes this the moment | "Why hasn't this been done — why now?" |
| 5 | Market | TAM/SAM/SOM, bottom-up and sourced | "Is the prize big enough to matter?" |
| 6 | Product | One concrete proof it works (a visual, a flow) | "Is this real or a slide?" |
| 7 | Business model | How a dollar in becomes more dollars out | "How does this make money?" |
| 8 | Traction | The growth SHAPE + the few key metrics | "Is it working, and accelerating?" |
| 9 | Competition | Honest landscape + your wedge | "Why don't incumbents just crush them?" |
| 10 | Team | Why *this* team wins *this* | "Can these people actually pull it off?" |
| 11 | The ask | Amount → use-of-funds → milestone it buys | "What do you need, and what does it buy?" |

Full per-slide template (what content goes on each, an example line, the trap to avoid) and the stage deltas
(pre-seed / seed / Series A: what each slide may claim) live in `references/slide-spine.md`. Read it before
drafting; do not improvise the order.

## Sequence is the persuasion

Investors read in **risk-evaluation order**: believe the problem → understand the solution → trust the market
→ see the proof → back the team → know the ask. Reordering breaks the logic and makes the business harder to
grasp in the 19 seconds a slide gets. The order *is* the argument.

```text
Bad  (founder-centric)              Good  (investor-risk order)
1 Look at our product!              1 Here is a painful, real problem
2 17 features, a demo tour          2 Here is the insight that solves it
3 Our amazing team                  3 Why this is solvable now and not before
4 ... oh, the problem               4 The market is big and reachable
5 The ask                           5 Proof: it works and it is growing
                                    6 This team is why it wins → the ask
```

Open with the *problem*, never with a feature tour. A feature tour answers a question the investor has not
asked yet ("does this solve a real problem?") and burns the front-loaded attention on the wrong thing.

## The numbers that matter

At seed, the decision rides on a **small set** of numbers — not the whole P&L. Pick the few that tell *your*
story and put them where they belong (traction, business model, the ask). The set and healthy bands:

| Metric | What it shows | Healthy band (2025/26) |
| --- | --- | --- |
| MRR/ARR + MoM growth | Are you growing, and how fast | ~15–20% MoM (<$1M ARR); ~8–15% MoM ($1M–$10M ARR) |
| LTV : CAC | Is acquisition profitable | **≥ 3:1** |
| CAC payback | Months to earn back acquisition cost | **< ~18 months** (the 2024 median; lower = above average) |
| Gross margin | How much of revenue is yours to keep | software typically 70%+ |
| Net revenue retention | Do existing customers expand | **> 110%** |
| Burn / runway | Cash out per month / months left | runway names the ask (below) |

Formulas and the full glossary → `references/numbers-that-matter.md`. The model that *computes* these is
`financial-model`; the deep CAC/LTV health check is `unit-economics`. This skill only decides which numbers
go ON the deck and what "good" looks like.

**Growth shape beats absolute size.** Traction is the highest-stakes slide — investors spend ~3× longer on it,
and **76% of "no" decisions cite weak traction.** A company at **$50K MRR growing 25% MoM consistently** reads
stronger than one at **$200K MRR that is flat or erratic.** Show the curve, not just the point.

```text
Bad traction slide                 Good traction slide
"We have 10,000 users."            "$50K MRR, +22% MoM for 5 straight months (curve shown);
"Huge interest!"                    NRR 118%; 40 paying logos incl. [2 names]; LTV:CAC 4:1."
 (a vanity number, no shape,        (a number + a unit + a trend + a band — the SHAPE is visible)
  no unit, no trend)
```

Never show registered users without an activation/paying rate behind them — a count with no engagement is a
vanity metric, and a sharp investor reads it as hiding the real number.

## The ask slide

The ask names three things, in this order: **the amount → the use-of-funds allocation → the milestone it
buys.** An ask with no number, or no milestone, reads as "we have not done the math."

```text
Raising $1.5M (SAFE).
Use of funds:  60% engineering · 25% go-to-market · 15% ops
Buys:          18 months runway to $100K MRR — Series-A ready.
```

The milestone is the point. "$1.5M for 18 months" is a burn statement; "$1.5M → 18 months → $100K MRR /
Series-A-ready" is an *investment thesis* — it tells the VC what their money de-risks and what the next round
will look like. Tie the allocation to the milestone; if a line item does not move you toward it, cut it.

## Market sizing, honestly

Size **bottom-up first**, then sanity-check top-down — and source every number. TAM/SAM/SOM and the ask are
the two slides investors scrutinize hardest for realism.

```text
Bad   "The market is $1.2 trillion — we only need 1% of it."
Good  "120,000 target SMBs in our segment × $4.8K ACV = $576M SAM (sourced: [registry/report]).
       Bottom-up reachable in 3 yrs (SOM): 3,000 accounts = $14.4M ARR."
```

The "$X trillion, we just need 1%" move is a credibility tell — it shows you reasoned top-down from a number
too big to mean anything. Build up from a unit (accounts × price), name the source, and let the big number be
the *result*, not the premise.

## Stage deltas (short)

What each stage is allowed to claim — full table in `references/slide-spine.md`:

- **Pre-seed** sells the **team + the insight**. Little traction yet; the bet is the founders and the wedge.
- **Seed** sells the **early traction shape** — growth trend, early retention, the first signs of a model.
- **Series A** sells a **repeatable growth engine** — efficient, predictable acquisition and expansion you can
  pour fuel on.

Claiming above your stage (Series-A "engine" language on a pre-seed deck with no data) reads as naive; claiming
below it (a seed deck that hides real traction behind a vision) wastes your best card.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| "No competition" / "we have no competitors" | Reads as naive or as "no market" | Map the honest landscape + your specific wedge |
| Ask slide with no amount or no milestone | "They have not done the math" | Amount → use-of-funds → the milestone it buys |
| Vanity metrics (registered users, no activation) | Hides the real number; investors notice | Show the metric WITH its rate/trend (paying, active, MoM) |
| 25–30 slide deck | Past ~15 it hurts; attention is gone | 10 + ask; depth to the data room / conversation |
| Designing/theming before the story is locked | Polishing the wrong outline | Lock the spine here, THEN hand to `presentations` |
| Hockey-stick projection with no driver | A curve with no mechanism is fiction | Tie growth to a named driver; cite the model |
| Opening with a feature tour | Answers a question not yet asked | Open with the problem (risk order) |
| "$X trillion × 1%" market | Top-down hand-wave, credibility tell | Bottom-up: accounts × price, sourced |
| Buzzwords ("revolutionary", "disruptive", "world-class") | Hollow; says nothing falsifiable | A number, a mechanism, a receipt |
| Reading the deck aloud verbatim | Slide and voice become redundant | Slide = the claim + proof; you narrate the story |

## Verify + references

Run the structural linter against a deck outline (markdown, one slide per heading) before handing off:

```bash
./scripts/verify.sh path/to/deck.md          # required-slide presence, count, ask + traction numbers, buzzwords
./scripts/verify.sh --strict path/to/deck.md # warnings become failures (CI gate)
```

It is a structural/numeric lint only — required core slides present, count ≤ 15, the ask names an amount + a
use-of-funds/milestone token, traction carries a metric with a unit, and a buzzword warning. **Narrative
quality is graded by the capability eval, not by grep.** Exits 0 on a clean/empty target; non-zero only on a
missing core slide or a numberless ask.

References:

- `references/slide-spine.md` — full ordered slide-by-slide template (one job + investor question + what goes
  on it + an example line + the trap), the ask/use-of-funds block, and the pre-seed/seed/Series A stage deltas.
- `references/numbers-that-matter.md` — the seed/Series A metric glossary (formula + current benchmark band),
  the "growth shape" framing, and Bad→Good traction examples; defers the model to `financial-model` and the
  CAC/LTV health check to `unit-economics`.

See also: `../presentations/SKILL.md` (renders + exports the locked outline), `../marketing/SKILL.md` (polishes
the words), `../harness/SKILL.md` (the `02-DOCS` wiki where deck/raise conventions persist). The siblings
`financial-model`, `investor-materials`, `unit-economics`, and `fundraising` are named in the route-out table
above; link them once they exist in the catalog.
