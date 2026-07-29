---
name: linkedin-strategy
description: "Use when a LinkedIn presence — personal brand or company page — needs an account-level decision spanning months: positioning and point of view, three to five content pillars, posting cadence, whether content lives on the founder's profile or the company page, and the social-selling rhythm, read from and written back to the presence's own learning wiki. NOT writing the post copy or hook (that is `linkedin-content`), NOT building a carousel deck (that is `linkedin-carousels`), NOT sending DMs (that is `linkedin-outreach`), NOT pulling raw analytics (that is `linkedin-api`)."
tags: [linkedin, positioning, content-pillars, cadence, thought-leadership, ssi, social-selling]
recommends: [linkedin-content, linkedin-outreach, linkedin-api, content-engine, decision-records]
origin: risco
---

# LinkedIn Strategy — The Presence as a System, Not the Next Post

*You operate at account/presence altitude.* You decide the **territory** (what this presence is known for, who it is for) and the **system** (pillars, cadence, where content lives, the social-selling rhythm) over months. You never write the post, build the carousel, run the DMs, or hit the API — those are single-asset jobs you route out. Mixing altitudes is the #1 reason LinkedIn advice goes generic: an account-level question answered with a tactic about one post produces noise and regresses to blog-post defaults.

Your spine is a read/write loop with the presence's own history. You **read** the accumulated learnings before deciding and **write** the decision back, so the next session compounds instead of restarting from a generic "post 3 times a week" template.

## Altitude boundary — route single-asset work out

| The ask | Skill | Why it is not you |
|---|---|---|
| Post copy, hook, body for one update | `../linkedin-content/SKILL.md` | You set the pillar and POV; content writes inside it. |
| A carousel / document-post deck | `../linkedin-carousels/SKILL.md` | A single asset's format craft, not the system. |
| Connection requests, DMs, sequences | `../linkedin-outreach/SKILL.md` | You set the social-selling *rhythm*; outreach runs the individual threads. |
| Raw analytics, OAuth, rate limits | `../linkedin-api/SKILL.md` | You *consume* the numbers; the API *fetches* them. |
| Cross-platform calendar / scheduling | `../content-engine/SKILL.md`, `../social-publisher/SKILL.md` | Multi-platform planning/posting, not LinkedIn presence architecture. |
| Abstract tone/voice rules | `../brand-voice/SKILL.md` | Voice in the abstract; you decide positioning and pillars. |

You are the only LinkedIn skill that operates at account altitude and persists its decisions to the wiki. Every sibling works on a single asset or a single thread.

## 1. Read the wiki FIRST — before any decision

Read `02-DOCS/wiki/linkedin/` before you decide anything. Why: a positioning or cadence call made without the account's own dwell-time and SSI history is just generic advice with a name on it. The whole value of this skill is that decisions compound.

Extract, in this order:
1. **Prior positioning / POV** — what was the presence supposed to be known for, and did it hold?
2. **Current pillars** — the 3-5 topics in play; which carry engagement.
3. **Stated cadence + whether it held at quality** — "3/week" that slipped to ~1 is the real signal, not the stated number.
4. **Top dwell-time / engagement performers** — which specific posts and formats earned the most read time.
5. **SSI trend** — the 0-100 score's direction over the trailing window.
6. **Killed pillars / dead experiments** — so you do not re-propose what already failed.

If the directory is empty or absent, **bootstrap it** — create `02-DOCS/wiki/linkedin/` with `positioning.md`, `decisions/`, and `what-worked.md`. Do not skip the read because the dir is missing; an empty wiki is a starting state, not a license to free-associate. When you decide, **cite what you grounded in** ("based on the two carousels that earned top dwell time…").

Full file layout and templates: `references/wiki-records.md`.

## 2. Positioning & POV + where content lives

**Niche of authority.** Be known for a clear point of view in one domain. The 2026 algorithm cross-references each post's topic against your title, skills, and background — posting purposefully inside a demonstrated domain builds topical authority; posting about whatever trends suppresses it. Thought leaders post inside a POV; creators just post often. 95% of decision-makers say thought leadership influences purchasing — so the POV is the asset, not the post count.

**Where the content lives — the distribution decision.** Personal profiles out-distribute company pages by a wide margin. Decide with this table, not by habit:

| Goal / stage | Lean | Why |
|---|---|---|
| Build reach, inbound, trust | Founder / exec personal profile | Personal content engages ~8x more than the page; profiles get ~65% of feed allocation. |
| Recruiting, official announcements, ad retargeting base | Company page (secondary) | Pages lost ~60-66% organic reach 2024-2026, now ~5% of feed; useful as a base, not a megaphone. |
| Scale reach without paying | Employee advocacy | Advocacy yields ~561% greater reach and ~7x more lead conversion than the page alone; CEO/founder posts get ~4x the page's engagement. |

**Rule: humans are the main event.** The page amplifies; it never carries.

```text
Bad:  All content posted on the company page; the founder reshares occasionally.
Good: The founder posts the POV from their profile; the page reshares as amplification;
      5 employees advocate the same week. Reach compounds across human graphs.
```

## 3. Content pillars — the territory, not the posts

Define **3-5 pillars**. Fewer than 3 is a single-note feed; more than 5 dilutes topical authority and confuses the cross-reference. Each pillar must align to the professional graph — the title, skills, and background LinkedIn already knows — so the 2026 topic match rewards you instead of flagging you off-domain.

Pillars are the **territory**. `../linkedin-content/SKILL.md` writes the individual posts inside them; you do not.

```text
Bad:  "I post about whatever's trending that week."
Good: A B2B data-platform founder runs 4 pillars:
      1. Pipeline reliability war stories   (graph-aligned: their actual job)
      2. Hiring/scaling a data team
      3. Build-vs-buy decision frameworks
      4. Behind-the-scenes founder lessons
```

Worked pillar sets for a solo consultant and a company page: `references/ssi-and-pillars.md`.

## 4. Cadence — the rate you can hold, not the rate a blog quotes

Pick the **highest rate you can sustain for 8 weeks at quality**. The sweet spot is **2-5 posts/week**, with **3-4/week the highest-ROI band**; consistency beats volume — 8 posts/month for 24 months beats 20/month for 6 months then quitting, because the algorithm rewards a sustained schedule, not a burst. Aim ~20-28h between posts; Tue-Thu is strongest for B2B.

Gate every cadence number through this checklist — answer all YES before you commit:

- [ ] Is the idea backlog deep enough to feed this rate for 8 weeks?
- [ ] Is there bandwidth to *engage* daily (see §5), not just publish?
- [ ] Is there format bandwidth for carousels/documents, not only text?

If any answer is NO, lower the cadence. A held 3/week beats an aspirational 5/week that collapses to 1.

**Format weight.** Carousels and document posts earn 2-3x more dwell time than text or image — and dwell time is the primary 2026 quality signal, not likes. Weight the calendar toward them.

**Tie the number to the wiki, not the blog.** If the account's own data shows carousels on one topic earning the best dwell time, the cadence recommendation weights toward that — a number justified by §1's read, never a default.

## 5. The social-selling rhythm — engage-vs-create and SSI

**Engagement outweighs raw posting frequency for inbound.** Accounts posting 3x/week *with* active inbound engagement beat daily-posting-no-engagement accounts by ~4.2x in lead gen. The split that works: roughly **~80% of LinkedIn time engaging** (commenting on others' posts, replying in your own threads), **~20% creating**. "20 min creating + 40 min engaging" beats "60 min creating + 0 engaging." Set this as the rhythm; the individual threads belong to `../linkedin-outreach/SKILL.md`.

**SSI as a habit system, not a vanity number.** The Social Selling Index is a 0-100 score over four 25-point dimensions, refreshed daily on a trailing 90-day window, free at `linkedin.com/sales/ssi`:

| Dimension (25 pts each) | Weekly habit |
|---|---|
| Establish a professional brand | Publish inside your pillars; complete profile. |
| Find the right people | Targeted search + connect within your niche. |
| Engage with insights | The ~80% engage block — comment with substance. |
| Build relationships | Convert engagement into 1:1 conversations. |

Targets: **65+** for active B2B sellers, **75+** is thought-leader territory, all-user average ~40-50. SSI is benchmarked relative to your industry (not absolute) and responds within ~90 days to habit changes — which makes it a usable steering metric, not a scoreboard. Deep per-dimension habit breakdown: `references/ssi-and-pillars.md`.

## 6. The review & double-down loop

On a quarterly or monthly review, read §1's what-worked + dwell/SSI trend, then branch:

```text
Engagement rising while cadence held?
  RISING     -> a pillar/format is working. Double down: more slots to that pillar,
                more of that format. Log which one and why.
  PLATEAUED  -> diagnose, do not just post more. Weak pillar topical fit
                (off-graph topic suppressed) OR weak format/dwell (text where a
                carousel would earn read time)?
  DECLINING  -> sunset the dead pillar. Reallocate its calendar slot to a rising
                one. Log it KILLED so no future session re-proposes it.
```

"Post more" never fixes falling engagement — diagnose pillar fit vs format/dwell first.

## 7. Write the decision back — on exit, always

Append a dated decision record under `02-DOCS/wiki/linkedin/decisions/`. Every record names the **single metric it bets on** and a **review date** — a decision without a metric is an opinion, not a checkable bet.

```markdown
---
type: linkedin-decision
title: Move distribution to founder profile
description: Founder profile carries the POV; the company page amplifies; refine to 4 pillars and hold 3/week.
tags: [linkedin, distribution, positioning, cadence]
timestamp: 2026-06-02T00:00:00Z
topic: linkedin
status: stable
---

# 2026-06-02 — Move distribution to founder profile

Context read: SSI 48 (flat 90d); top-2 dwell-time posts both carousels on
"pipeline reliability"; stated cadence 3/week slipped to ~1; company page reach near zero.

Decision: Founder profile carries the POV; company page amplifies; refine to 4 pillars
weighted toward the reliability carousel topic; hold 3/week with carousels Tue/Thu.
Social-selling rhythm: 80/20 engage/create.

Bets on metric: SSI 48 -> 65 within 90 days (proxy for inbound).
Review date: 2026-09-02.
```

The `type:` field is required (OKF v0.1); `timestamp` is ISO 8601. The dated heading and the `Decision:` / `Bets on metric:` / `Review date:` lines are domain signals `verify.sh` greps for — keep them.

After writing, run `scripts/verify.sh 02-DOCS/wiki/linkedin/` to confirm the record is structurally complete. Full templates and the what-worked format: `references/wiki-records.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Dumping content on the company page | ~5% feed allocation; reach is near dead | Founder/employee profiles carry it; the page amplifies |
| Chasing daily posting | Hits a quality cliff, no bandwidth to engage | 3-4/week held + the engage split |
| Posting outside your pillars / domain | 2026 topic cross-reference suppresses authority | Stay inside graph-aligned 3-5 pillars |
| Optimizing for likes | Misses dwell time, the real 2026 signal | Weight carousels/docs; measure dwell time |
| Treating SSI as a vanity score | Ignores it as a steerable habit system | Run the four dimensions as weekly habits |
| Create-only, no engaging | ~4.2x worse inbound | ~80/20 engage-to-create split |
| Deciding without reading the wiki | Regresses to generic blog advice | READ `02-DOCS/wiki/linkedin/` first |
| Never writing the decision back | No compounding; every session restarts | Append a dated record + metric + review date |

## References & routing

- `references/wiki-records.md` — file layout under `02-DOCS/wiki/linkedin/`, decision-record and what-worked templates, and exactly what `verify.sh` checks.
- `references/ssi-and-pillars.md` — the four SSI dimensions as concrete weekly habits with targets, pillar-design worked examples, and the personal-vs-page + employee-advocacy reach mechanics.

Route single-asset work out: post copy → `../linkedin-content/SKILL.md`; carousels → `../linkedin-carousels/SKILL.md`; DMs/sequences → `../linkedin-outreach/SKILL.md`; raw metrics → `../linkedin-api/SKILL.md`; decision discipline → `../decision-records/SKILL.md`.
