---
name: content-engine
description: "Use when a content operation needs a SYSTEM — a dated editorial calendar built top-down from pillars and a production pipeline that moves every slot through stages — not when writing one piece. Use for building/refreshing an editorial calendar, defining pillars/clusters/cadence/mix, standing up stage gates and a brief template, planning the 1:10 atomization of a flagship into derivatives, or setting WIP limits and the calendar of record. Triggers: 'build a content calendar', 'set up a content pipeline', 'what should we post and when', 'turn this pillar post into everything', 'our content is chaos, nobody knows what to post' (symptom, no calendar word), 'móntame un calendario de contenidos', 'atomiza este artículo en piezas'. NOT writing the pieces (that is article-writing), NOT distributing them (that is social-publisher), NOT keyword/cluster research (that is seo-geo), NOT codifying tone (that is brand-voice)."
tags: [content, editorial-calendar, content-pipeline, repurposing, marketing-ops]
recommends: [brand-voice, seo-geo, social-publisher, article-writing, video-shorts, newsletter, automation-flows]
origin: risco
---

# Content Engine — The Calendar and the Pipeline That Feeds It

*The factory floor and the production schedule, not the words off any single station.* You own two machines: the **calendar** (what gets made and when) and the **pipeline** (how each slot moves from idea to publish-ready). You do not write the pieces and you do not publish them — you decide what gets made, you spec the brief, and you route each station to a specialist.

Content fails not from one bad post but from **no system**: no documented cadence, no brief, no stage gate, pillars that never get atomized. ~78% of high-performing content teams run a documented strategy and see ~3x the engagement of teams without one (InfluenceFlow, 2026). This skill is that system.

## The two machines

- **Calendar = what + when.** A dated, slotted plan anchored to pillars. "What do we post Thursday?" becomes a lookup, not a weekly panic.
- **Pipeline = how it moves.** Every slot travels `idea → brief → draft → edit → atomize → publish-ready` through stage gates, so output is consistent regardless of who writes.

**Hard rule: build top-down, slot last.** Personas → Pillars → Clusters → Assets, in that order. The calendar is derived from this architecture; it is never a bottom-up pile of "post ideas." Bottom-up calendars are the #1 failure mode — they have no theme, no leverage, and no reason any given post exists. *Why: structure makes topic choice a lookup, not a creative emergency every Monday.*

## Ground first (STOP gate)

You plan content for a real brand; you do not invent its strategy. Before building anything, read what already exists.

1. Read the brand study and pillars from `02-DOCS/` (the project wiki). If the project uses the harness convention, that is `02-DOCS/wiki/` — see `../harness/SKILL.md`.
2. **If voice/tone is missing → STOP.** Route the user to `brand-voice` to codify do/don't words and voice samples. Do not invent a voice; a calendar built on a guessed voice produces off-brand drafts at every station.
3. **If pillars/clusters/keywords are missing → STOP for the research half.** Route topic-cluster and keyword work to `seo-geo`. You consume pillars and clusters; you do not derive them from search data — that is its job.
4. Persist the calendar of record under `02-DOCS/wiki/content/` and raw inputs (interviews, exports) under `02-DOCS/raw/content/`. *Why: the calendar must be a durable artifact of record, not a chat message that scrolls away.*
5. Cite what you grounded in (e.g. "pillars from `02-DOCS/wiki/brand-study.md`"). If you grounded in nothing, say so and stop.

## Build the calendar

**Four-layer architecture (counts are defaults, state them):**

| Layer | Count | What it is |
|---|---|---|
| Personas | 2–4 | who you are writing for |
| Pillars | 4–6 | durable themes you own; fewer is too narrow, more dilutes effort |
| Clusters | 3–5 per pillar | sub-topics under each pillar |
| Assets | concrete | the actual dated formats (the slots) |

*Why 4–6 pillars: calendars anchor to pillars so topic choice is structural. Below 4 you are too narrow to sustain a cadence; above 6 effort scatters and no theme compounds (Entasher 2025-11-29; InfluenceFlow 2026).*

**Cadence baseline (sustainable, the default you propose):**

- ~1 **flagship** piece / month — a guide, report, or webinar; the thing you atomize.
- 4–8 **supporting** posts / week.
- ~1 **proof** piece / month — case study or result.

Consistency for 6–12 months beats a one-month sprint. The real constraint is *creating*, not posting — brands already averaged ~9.5 social posts/day across networks in 2024 (Kontent.ai). The pipeline exists to relieve creation, not posting.

**Slot-mix rule (encode these as allocation defaults):**

- **70 / 20 / 10**: ~70% evergreen, ~20% timely/seasonal, ~10% experimental.
- Leave **20–30% of slots OPEN** for reactive content — do not fully pre-fill the calendar.
- Budget **15–25% of weekly capacity for UPDATING** existing winners, not only net-new.

*Why: a 100%-planned calendar with zero slack cannot react and rots into a graveyard; never refreshing winners throws away your highest-ROI slots (InfluenceFlow 2026).*

**Decision table — cadence by team size** (a real branch, so the table earns its place):

| Team | Flagship | Supporting | Atomize per flagship | WIP cap |
|---|---|---|---|---|
| Solo | 1 / 6–8 wks | 3–4 / wk | 5–7 derivatives | 1–2 in flight |
| Small (2–5) | 1 / mo | 4–6 / wk | ≥10 derivatives | 3–4 in flight |
| Multi-stakeholder | 1–2 / mo | 6–8 / wk | ≥10 + paid cutdowns | 5–6, gated by owner |

Slot schema — emit the calendar as CSV (one row per slot) so `scripts/verify.sh` can lint it:

```csv
date,pillar,cluster,format,owner,stage,brief_link,atomization,mix
2026-07-07,Onboarding,activation-checklist,flagship-guide,ana,brief,02-DOCS/wiki/content/briefs/onboarding-guide.md,planned,evergreen
2026-07-09,Onboarding,activation-checklist,linkedin-post,ana,idea,,,evergreen
2026-07-15,Trends,q3-benchmarks,reactive-open,,idea,,,timely
```

`mix` is one of `evergreen|timely|experimental` (plus leave `reactive-open` slots with empty owner). Full column docs + a filled example live in `references/brief-and-pipeline.md`.

## The brief

A slot **cannot leave the `idea` stage without a brief.** One canonical brief format means consistent output regardless of who writes it. The brief is a `.md` page in the `02-DOCS/wiki/` OKF v0.1 bundle: its YAML frontmatter carries a non-empty `type: content-brief` (plus the OKF-recommended `title`/`description`/`tags`/`timestamp`) alongside the domain fields below, and any body cross-references use standard markdown links, never wikilinks. Required fields (inline minimum):

- **objective** — the one outcome this piece drives.
- **persona** — which of the 2–4 you target.
- **pillar / cluster** — where it sits in the architecture.
- **angle** — the specific take (not the topic).
- **format** — flagship-guide / linkedin-post / video-short / newsletter-issue / …
- **owner** — the human accountable for the slot.
- **target keyword** — handed off from `seo-geo`, not invented here.
- **success metric** — how you will know it worked.
- **atomization intent** — for flagships, the derivative count and target channels.

Full template with a filled example → `references/brief-and-pipeline.md`. *Why one brief: the brief is where "AI is a station, not the author" gets enforced — a human sets objective, angle, and what "good" is before a draft exists.*

## The pipeline: stages + gate

`idea → brief → draft → edit → atomize → publish-ready`. Each stage has an entry gate (what must be true to enter) and an exit gate (what must be true to leave). Run the gates as a checklist — this is a real branch, so the checklist earns its place:

- **idea → brief:** slot exists in the calendar with a pillar/cluster assigned. Exit: brief written and owner set.
- **brief → draft:** brief complete, target keyword present, voice reference linked. Exit: a draft exists.
- **draft → edit:** draft hits the brief's format and angle. Exit: edited against the brief and the voice guide.
- **edit → atomize:** flagship has a passing edit. Exit: atomization plan filled (≥ derivative count). Non-flagships skip to publish-ready.
- **atomize → publish-ready:** derivatives are planned and routed. Exit: every asset has an owner and a destination.

**WIP limits matter more than throughput.** Cap in-flight slots per the team-size table; pulling a new idea before finishing the last one is how the calendar becomes a graveyard.

**Who fills each station — route, do not write:**

- Draft/edit of a long-form article → `../article-writing/SKILL.md`.
- Newsletter issue copy → `newsletter`.
- Short-form video script/storyboard → `video-shorts`.
- Landing/launch page copy → `../marketing/SKILL.md`.

**AI is a station, not the author.** Use AI for research, outlines, drafts, repurposing, and angle-testing. Humans decide which pillars matter, which stories to tell, and what "good" is. Voice is grounded via `brand-voice`, never invented (Entasher 2025-11-29).

## Atomization (1:10)

Every flagship carries an atomization plan, not just a publish date. Aim for **≥10 distinct derivatives** per flagship — repurposing yields ~3–5x reach, ~60% less creation time, and 94% of B2B marketers say it extends content ROI (DigitalApplied 2026-01-16).

Three phases:

1. **Audit** — pick the high-value source by traffic / intent / conversion.
2. **Atomize** — extract the reusable atoms: stats, quotes, frameworks, how-to steps, case studies.
3. **Reformat** — reassemble atoms into platform-**native** formats, each adapted to its destination's length and language. Channel-native, never copy-paste: LinkedIn = numbered insights + an engagement question; an X thread = a bold hook in tweet 1, links back in the final tweet.

The derivative menu, a worked 1→10 example, and per-channel Bad→Good rewrites live in `references/atomization.md`.

**Route the derivatives, do not write or ship them:** each derivative goes to its specialist (`../article-writing/SKILL.md`, `newsletter`, `video-shorts`); the **act of shipping** goes to `social-publisher`; wiring publish/atomize into a cron or webhook flow goes to `automation-flows`.

## Handoffs — who owns what

| Ask | Owner |
|---|---|
| Write the long-form article body | `../article-writing/SKILL.md` |
| Write the newsletter issue copy | `newsletter` |
| Write/schedule/queue posts to platforms (the act of publishing) | `social-publisher` |
| Script/storyboard a short-form video | `video-shorts` |
| Keyword research, topic clustering, schema | `seo-geo` |
| Codify tone, do/don't words, voice samples | `brand-voice` |
| Landing/launch/web-page conversion copy | `../marketing/SKILL.md` |
| One-off reminders / scheduling meetings | `calendar-scheduling` |
| Automate publish/atomize as a cron/webhook flow | `automation-flows` |

The tell: if the ask is **the system that decides what gets made, when, and how it moves**, it is here. If the ask is **producing one artifact** or **the act of distributing**, it is a sibling.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Bottom-up calendar (pile of post ideas) | no theme, no leverage, no reason a post exists | derive slots from Personas→Pillars→Clusters |
| Slot with no brief | output drifts per author; can't enforce voice | block exit from `idea` until brief is complete |
| Flagship with no atomization plan | 1:10 leverage left on the floor | require an atomization plan to leave `edit` |
| Inventing brand voice | off-brand at every station | STOP, route to `brand-voice` |
| AI as author | nobody owns angle, story, or "good" | AI is a station; humans set objective and bar |
| Calendar-as-graveyard | slots planned but never pulled | enforce WIP limits; pull, don't pile |
| 100%-planned, zero slack | can't react to anything timely | leave 20–30% of slots open |
| Net-new only, never updating | discards highest-ROI winners | budget 15–25% capacity for updates |
| Copy-paste cross-posting | each channel punishes non-native content | reformat per channel (`references/atomization.md`) |
| >7 pillars | effort scatters, no theme compounds | hold to 4–6 |

## Verify

`scripts/verify.sh path/to/calendar.csv` lints an emitted calendar: required columns present, every `stage` is a valid pipeline state, every flagship row has a `brief_link` and an `atomization` plan, and it warns on mix sanity (>80% evergreen, or 0% reactive/open). It is read-only and exits 0 on a clean or empty target — it gates structure, not whether the plan is good.
