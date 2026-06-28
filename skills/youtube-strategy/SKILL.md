---
name: youtube-strategy
description: "Use when a YouTube channel needs a SYSTEM-level decision — positioning/niche, upload cadence, how videos chain into playlists and series, end-screen routing, or a 'what's working, what to do more of' review — read from and written back to the channel's own learning wiki, not one video's choices. Triggers: 'what should my channel be about', 'who is my channel for', 'how often should I post', 'should I niche down or stay broad', 'organize my videos so people binge several in a row', 'my end screens aren't keeping people watching', 'quarterly channel review what's working', 'qué temática para mi canal de YouTube', 'cada cuánto subo vídeos'. NOT generating next-video topics/hooks (that is youtube-ideation), NOT per-video titles/thumbnail-text (that is youtube-packaging), NOT designing the thumbnail image (that is youtube-thumbnails), NOT fetching metrics from the Data API (that is youtube-api)."
tags: [youtube, channel-strategy, positioning, cadence, playlists, retention]
recommends: [youtube-ideation, youtube-packaging, youtube-api, content-engine, decision-records]
origin: risco
---

# YouTube Strategy — The Channel as a System, Not the Next Video

*You operate at channel/portfolio altitude.* You decide the **territory** (what this channel is, who it is for) and the **system** (cadence, how videos chain, what to double down on) over months. You do not pick the next video's topic, write its title, or fetch its metrics — those are single-asset jobs you route out. Mixing altitudes is the #1 reason YouTube advice goes generic: a channel decision answered with per-video tactics produces noise.

Your spine is a read/write loop with the channel's own history. You **read** accumulated learnings before deciding and **write** the decision back, so the next session compounds instead of restarting from generic blog advice.

## Altitude boundary — route single-asset work out

| The ask | Skill | Why it is not you |
|---|---|---|
| Topics/hooks for the next upload | `../youtube-ideation/SKILL.md` | You set the territory; ideation fills it. |
| Title + thumbnail text + description for one video | `youtube-packaging` | You set the positioning packaging must express; it executes per upload. |
| The thumbnail image itself | `../youtube-thumbnails/SKILL.md` | Image design is a craft asset, not a channel decision. |
| Pull metrics / OAuth / quotas / report endpoints | `youtube-api` | You consume numbers; you do not fetch them. |
| Render or edit the video | `remotion-video` | Production, not strategy. |
| Cross-platform calendar / scheduling | `../content-engine/SKILL.md`, `../social-publisher/SKILL.md` | Multi-platform planning and posting, not YouTube channel architecture. |

You are the only YouTube skill that works at channel/portfolio altitude and persists decisions to the wiki. Every sibling works on a single asset.

## The wiki loop comes FIRST (this is the spine)

Before any strategy decision, **READ** `02-DOCS/wiki/youtube/`. *Why: a strategy decision made without the channel's own retention/CTR history regresses to generic advice that ignores what this specific audience rewards.*

Extract, in order:
1. **Prior positioning** — what the channel claimed to be, and whether it held.
2. **Current cadence + whether it held** — the stated rate and whether quality dropped at it.
3. **Top retention/CTR performers** — which videos/playlists earned the watch time, and what they share.
4. **Killed experiments** — series or formats already sunset, so you do not re-propose a dead bet.

If `02-DOCS/wiki/youtube/` is empty or absent → **bootstrap it**: create the directory and a positioning stub, then proceed. Do not skip the loop because the dir is missing — create it and start the record now. Layout and templates are in `references/wiki-records.md`.

Cite what you grounded in (e.g. "cadence held at 2/wk per `02-DOCS/wiki/youtube/decisions/2026-03-cadence.md`"). If you grounded in nothing because the wiki was empty, say so and say you are bootstrapping.

## Positioning & niche

Positioning sits at a **three-factor intersection**. Pick the niche where all three overlap:

- **Sustained interest** — you can make 100+ videos here without burning out. *Why: cadence dies the moment the topic bores the creator.*
- **Measurable audience demand** — searches/views exist for it. *Why: passion without demand is a diary.*
- **Monetization potential** — CPM and competition leave room. *Why: a niche with no advertiser value caps the channel's ceiling regardless of views.*

(TubeBuddy; OutlierKit CPM-ranked niches, 2026.)

**Niche down 2–3 levels.** "Gaming / cooking / tech" are *industries*, not niches. The algorithm matches a narrow channel to interested viewers more precisely, so at identical production quality a focused channel outgrows a topic-hopper, and "the go-to channel for X" is achievable in 6–12 months. Walk the ladder:

```text
industry   →  category          →  angle                    →  who-it's-for
tech       →  keyboards         →  budget mechanical boards  →  programmers who type all day
gaming     →  roguelikes        →  honest sub-$20 reviews    →  players who buy on a budget
```

- Bad: "a tech channel." (an industry — competes with everyone, recommended to no one specifically)
- Good: "honest reviews of budget mechanical keyboards for programmers." (a defensible go-to position)

**Broad vs narrow — decide by stage and goal:**

| Channel stage / goal | Lean | Why |
|---|---|---|
| New, <1k subs, finding fit | Narrow hard | Precision recommendation beats reach; you need a foothold, not a category. |
| Validated niche, want to grow share | Stay narrow, deepen | Become *the* answer in the niche before widening. |
| Established authority expanding | Adjacent widen only | Move to a neighboring angle, never jump industries — the audience graph breaks. |
| Topic-hopping with flat subs | Narrow now | Breadth is the diagnosis, not the cure. |

## Cadence

**Rule: pick the highest rate you can hold for 8 weeks without a quality drop.** *Why: cadence is an algorithmic channel-health signal — predictable channels get more aggressive recommendation pushes because YouTube knows there is consistent inventory to recommend (AIR Media-Tech, 2026) — but a quality cliff erases that benefit instantly. Consistency of strong videos beats raw frequency.*

Baselines, used as a starting frame, **then corrected by the wiki's own retention data, not by a blog number**:

- New channels: **1–2/week.**
- Many mid-size channels validate at **2–4/week.**

Run the gate before committing to a rate. If any answer is "no," step the cadence down a notch:

- [ ] Can the team sustain this rate for 8 weeks with no degradation in idea, script, or thumbnail quality?
- [ ] Is the idea backlog deep enough to feed it (no scraping-the-barrel uploads)?
- [ ] Is there thumbnail/packaging bandwidth for every slot at this rate?

If wiki retention shows watch time falling while cadence held steady, the problem is not "post more" — it is idea/packaging/structure (see the review loop). Raising cadence on a quality problem accelerates the decline.

## Channel architecture — playlists, series, end screens

The algorithm scores **session** watch time — whether your video extends the viewer's stay on the platform — and pushes channels that reliably start or extend sessions (SolveigMM, 2025). So you do not design videos in isolation; you design **chains**.

- **Playlists are binge paths, not folders.** A playlist titled to promise a journey ("Build a SaaS from zero") outperforms a dumping ground ("My videos 2026"). Strategic playlists + end screens can lift session time ~10–30% (Boss Wallah; Gyre, 2026).
- **Series Playlists** signal intended watch order and raise autoplay continuation. Use them when sequence matters.
- **End screens route to the next logical video**, not your most popular one — relevance keeps the session alive.

The reliable shape is a deliberate sequence:

```text
Part 1 (hook + promise)  →  Part 2 (payoff)  →  Case Study (proof)  →  Q&A (depth)
```

Each step end-screens to the next; the playlist holds them in order. Deeper patterns and session-time mechanics are in `references/channel-architecture.md`.

## Review & double-down loop

A review is not "are views up." It is reading the wiki to find the rising signal and acting on it:

```text
Read what-worked + retention notes
        │
   Is watch time rising while cadence held steady?
        │
   ┌────┴──────────────┬─────────────────────┐
 RISING            PLATEAUED              DECLINING
        │                │                     │
 idea/packaging/    diagnose: is it the    sunset the series —
 structure is        idea (CTR low) or      reallocate the slot;
 working → DOUBLE     the structure         log it killed so it
 DOWN: more of        (AVD low)? route       is never re-proposed
 that format/angle    the weak half out
```

Read CTR (>~6% is healthy for new channels) and AVD/retention from the wiki to choose the next bet (EntreResource; AIR Media-Tech, 2026). When watch time rises at steady cadence, the win is in idea/packaging/structure — that is the signal to scale that format. Kill series with flat or declining retention rather than nursing them; a dead slot is better spent.

## Write the decision back (on exit, always)

A strategy session that does not write back does not compound — the next session starts from zero. On exit, append a **dated decision record** under `02-DOCS/wiki/youtube/` and, when reviewing, a **what-worked** entry tied to specific videos/playlists. Minimal record inline; full templates in `references/wiki-records.md`:

```markdown
---
type: youtube-strategy-record
title: Niche down to budget mechanical keyboards for programmers
description: Reposition from broad tech reviews to budget mechanical keyboards for programmers; hold 2/wk cadence.
tags: [youtube, strategy-decision, positioning]
timestamp: 2026-06-02T00:00:00Z
---
# 2026-06-02 — Niche down to budget mechanical keyboards for programmers
- Context read: flat subs at 40 videos; top 3 by AVD all keyboard reviews ([what-worked.md](./what-worked.md))
- Decision: reposition from "tech reviews" to "budget mechanical keyboards for programmers"; cadence 2/wk held
- Bets on metric: AVD on keyboard videos (currently ~48%) holding while non-keyboard topics are dropped
- Review date: 2026-09-02
```

`02-DOCS/wiki/` is an OKF v0.1 bundle: every record carries a non-empty `type` (`youtube-strategy-record`) above the body, and cross-references use standard markdown links (never `[[wikilinks]]`). Every record names **the metric it is betting on** and a **review date**. A decision with no metric is an opinion, not a bet you can later check. Run `scripts/verify.sh 02-DOCS/wiki/youtube/` after writing to confirm the records are structurally complete (date, `Decision:`, metric, and `type`). Full templates in `references/wiki-records.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Chasing daily uploads | Hits the quality cliff; weak inventory drags the whole channel's recommendation health | Pick the rate you can hold 8 weeks at quality |
| Copying another channel's cadence | Their data is not yours; their audience rewards different things | Set cadence from your own wiki retention |
| Treating playlists as storage folders | No binge promise, no session lift | Build titled binge paths and series in watch order |
| Positioning as an industry ("a tech channel") | Competes with everyone, recommended to no one | Niche down 2–3 levels to a defensible angle |
| Deciding without reading the wiki | Regresses to generic blog advice that ignores this audience | READ `02-DOCS/wiki/youtube/` before any decision |
| Never writing the decision back | No compounding; every session restarts from zero | Append a dated record + the metric it bets on |
| "Post more" to fix falling retention | Accelerates the decline; the problem is idea/structure | Diagnose CTR vs AVD; fix the weak half |
| Jumping industries to grow | Breaks the audience graph; old subs churn | Widen only into adjacent angles |

## References & routing

- `references/wiki-records.md` — file layout under `02-DOCS/wiki/youtube/`, the decision-record and what-worked templates, and what `verify.sh` checks.
- `references/channel-architecture.md` — deeper playlist/Series-Playlist/end-screen patterns, session-time mechanics, and binge-sequence examples.
- Route out: next-video ideas → `../youtube-ideation/SKILL.md`; per-video packaging → `youtube-packaging`; raw metrics → `youtube-api`; decision-record discipline → `decision-records`.
