---
name: linkedin-content
description: "Use when writing the actual words of one LinkedIn feed post — turning a raw idea, story or asset into ready-to-paste copy: a text post, a document/carousel cover with slide copy and caption, or a short native-video script. Covers fixing a weak hook, reformatting a wall of text for the mobile feed, and a CTA that provokes a real comment. NOT planning what or when to post (that is `linkedin-strategy`), NOT designing the carousel slides and PDF export (that is `linkedin-carousels`), NOT DM sequences (that is `linkedin-outreach`), NOT programmatic publishing (that is `linkedin-api`)."
tags: [linkedin, social-copywriting, hooks, content-writing, dwell-time, ctas, document-posts]
recommends: [linkedin-strategy, linkedin-carousels, linkedin-outreach, linkedin-api, brand-voice, video-shorts]
origin: risco
---

# LinkedIn Content — The Words a Human Pastes Into the Feed

*You write the copy of one LinkedIn post.* You take a raw idea, a story, or an asset and turn it into finished text the user pastes straight into the composer. You do not pick the topic or the day, you do not design the carousel pixels, you do not write DMs, and you do not call the API. You hand over words.

**The one rule that governs every line: the 2026 algorithm pays for dwell time and comments, not likes or clicks.** That dwell drives ranking is not a marketing claim — LinkedIn's own engineering team documents it: they train a "Long Dwell" classifier and feed per-post dwell into the ranking model precisely because dwell captures the passive readers that likes miss (LinkedIn Engineering, "Leveraging Dwell Time to Improve Member Experiences on the LinkedIn Feed", Oct 2024 — [S1]). The *size* of the gap is reported by practitioner analyses, not LinkedIn: posts with 0–3s dwell are reported to average ~1.2% engagement vs. ~15.6% at 61+s, a ~13x gap ([S2], corroborated by [S3]). Treat the mechanism as solid and the multiplier as directional. A 30-second read beats 50 quick likes. So every line you write has exactly one job: earn the next line, or earn the comment. If a sentence does neither, cut it. *Why: dwell is the currency, and a line that doesn't pull the eye downward stops the clock.*

## Sources — what backs the numbers (and how hard)

Every figure below is keyed inline as `[S#]`. One primary source ([S1]) underpins the *mechanism*; the multipliers come from practitioner analyses and one named industry report, treated as directional, not gospel. All accessed 2026-06-02.

- **[S1] — primary, authoritative.** LinkedIn Engineering, "Leveraging Dwell Time to Improve Member Experiences on the LinkedIn Feed" (Oct 2024): `https://www.linkedin.com/blog/engineering/feed/leveraging-dwell-time-to-improve-member-experiences-on-the-linkedin-feed`. LinkedIn's own write-up of the Long-Dwell classifier and dwell-aware ranking. Backs *that dwell ranks* and *documents outdwell text* — NOT the exact 13x/15x multipliers.
- **[S2] — practitioner analysis.** dataslayer.ai, "LinkedIn Algorithm 2026: What Works Now (Documents, Newsletters, Video)": `https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now`. Backs the ~60% body-link reach hit, the first-comment-penalty claim, the ~2–5% golden-hour test sample, the ~5% recovery rate, and the sub-60s video figure.
- **[S3] — practitioner analysis, second source.** meet-lea.com, "LinkedIn Algorithm Explained 2026: Dwell Time, Comments & Reach": `https://meet-lea.com/en/blog/linkedin-algorithm-explained`. Independently states the 1.2% vs. 15.6% dwell figures and the ~15x comment weight — and flags the ~15x as an industry estimate with AuthoredUp's quality-aware ~2x as the conservative alternative.
- **[S4] — named industry research report.** Richard van der Blom, "LinkedIn Algorithm Insights Report 2026" (large-scale study, ~400k profiles): `https://richardvanderblom.com/`. Corroborates the dwell-over-likes weighting, the in-body-link reach loss (~18.8% median for one link), and the link-in-first-comment suppression as of early 2026.

When a fact rests on [S2] alone for a time-stamped algorithm behavior (notably the first-comment penalty), the body hedges it as *reported*, not confirmed — see the link rule below.

## Boundary — what is yours and what is the sibling's

The nearest miss is **strategy vs. words**. Deciding *whether to post, on what topic, at what cadence* is `../linkedin-strategy/SKILL.md`. Writing *the actual words of this one post* is you. "Plan my month of LinkedIn" routes away; "write this post" stays.

The second is **words vs. pixels**. For a document/carousel post, `../linkedin-carousels/SKILL.md` designs the slides — layout, visual system, PDF export. You write the document post's *text*: the cover-slide line, the per-slide copy, and the feed caption that frames it. Words here, pixels there.

Also route out: connection notes and DM sequences → `../linkedin-outreach/SKILL.md`; programmatic schedule/publish → `../linkedin-api/SKILL.md`; the durable brand tone the copy must obey → `../brand-voice/SKILL.md`; a cross-platform short-form video idea → `../video-shorts/SKILL.md`.

## Step 0 — pick the format first

Each format has a different engagement ceiling and a different structure, so choose before you write a word. This branches, so use the table.

| Format | 2026 avg engagement | Pick it when | Structure you write |
|---|---|---|---|
| Document / PDF (carousel) | ~6.6–7.0% (+14% YoY) — highest | The idea is a list, a framework, a teardown, or a before→after that wants pages | Cover line + 3–10 slides of copy + 100–200-word caption |
| Native video | ~5.6% (+36% YoY, growing 2x faster; ~3x a text post) | A face, a demo, a story that lands better spoken | 30–90s script beats + caption |
| Text only | Lowest of the three | A sharp story or insight that needs no asset; fastest to ship | One 1,300–1,900-char post |

Per-format engagement rates from [S3] and the named research report [S4]; the document-format edge is corroborated by LinkedIn Engineering's own finding that document/carousel updates generate longer dwell than text or image updates ([S1]). Format choice is a real lever, not a coin flip — a document post can clear ~6x a text-only one on the same idea.

## The hook — the first ~150 characters

The mobile feed truncates after ~150–210 characters (the first ~3 lines) before *see more* ([S2] / [S3]). If those lines don't earn the tap, dwell never starts and the rest of your post is invisible. The hook is the whole game.

Rules, each with its why:

- **Lead with specificity, a number, or tension — not context.** *Why: the reader is scrolling; an abstraction reads as skippable, a concrete claim reads as a promise.*
- **Front-load the most surprising true thing.** *Why: you have ~150 chars before the cut; spend them on the payoff-seed, not the setup.*
- **Never open with a greeting or "excited to share / thrilled to announce".** *Why: those words signal an ad, and the eye has learned to skip ads.*
- **One idea in the first line. The second line escalates it.** *Why: a line break in the visible zone earns its own micro-decision to keep reading.*

| Bad hook | Good hook |
|---|---|
| "Excited to share that we hit a new milestone this quarter! 🎉" | "We almost shut the product down in March. Then one churned customer told us why." |
| "I've been thinking a lot about leadership lately." | "I fired my best engineer. Revenue went up. Here's what that taught me about teams." |
| "Some thoughts on remote work and productivity." | "We went fully remote and our output dropped 30%. The fix wasn't more meetings." |
| "Happy to announce our new feature is live!" | "It took 4 rewrites and a near-mutiny to ship one button. Worth it." |

For the full 8–10 pattern library (number-lead, false-start, contrarian, open-loop, named-stakes), see `references/hooks-and-formats.md`.

## The story arc and the character budget

A text post runs **hook → turn → payoff → CTA**. The length sweet spot is **1,300–1,900 characters** — reported as ~47% higher engagement than short posts because it sustains dwell while staying consumable; the hard max is 3,000 ([S3] / [S4]). Budget it:

| Section | Budget | Job |
|---|---|---|
| Hook | ~150 chars (first ~3 lines) | Earn the *see more* tap |
| Turn | ~300–400 chars | The pivot — the thing that wasn't obvious |
| Payoff | ~600–900 chars | The lesson/story/proof the hook promised |
| CTA | ~100–200 chars | Provoke a comment only the reader can give |

Don't pad to hit the range; if the idea is genuinely a 700-char post, ship 700. The range is where most stories *should* land, not a quota.

## Line-break formatting — write for the thumb

Short 1–2 sentence paragraphs with line breaks are reported to sustain ~40% longer dwell than a wall of text ([S2] / [S3]). The composer has **no native bold or italic**, so Unicode is the only in-feed emphasis — use it on one or two phrases at most, never a whole line.

Rules: one idea per line; a blank line between thought-blocks; emoji as occasional bullets (▸, →, or a single 📌), never confetti.

```text
Bad (wall):
We tried three onboarding flows over six months and the first two failed because they front-loaded configuration before value, which meant users churned before they ever saw the product work, so we rebuilt it around a single first action and activation jumped from 19% to 54% in two weeks which taught us that time-to-value beats feature-completeness every time.
```

```text
Good (broken for the thumb):
We tried three onboarding flows in six months.

The first two failed for the same reason:
they made users configure before they saw value.

So we cut everything but one first action.

Activation went 19% → 54% in two weeks.

The lesson: time-to-value beats feature-completeness. Every time.
```

## The CTA that earns comments

Comments are widely reported as ~15x the weight of likes ([S2] / [S3]) — though that exact multiplier is an industry estimate, and AuthoredUp's quality-aware analysis puts it closer to ~2x ([S3]). Either way the direction holds: a comment outweighs a like, and a meaningful comment more still. So the CTA's only job is to provoke a comment the reader is *uniquely* able to give. *Why: a generic ask gets a generic like; a specific question gets a sentence, and a sentence is a comment.*

Ask for the reader's own experience, number, or disagreement — something they can answer without you. Banlist of dead CTAs that get scrolled past: "thoughts?", "agree?", "let me know below", "what do you think?", "drop a comment".

| Dead CTA | Live CTA |
|---|---|
| "Thoughts?" | "What's the one onboarding step you'd kill if you could?" |
| "Agree?" | "If you've shipped fully remote — did output go up or down for you? Curious where I'm wrong." |
| "Let me know below." | "What metric finally made *you* trust an activation number?" |

## Format-specific bodies

**Document / PDF post** — write three things, never the slide design:
1. **Cover line** — the hook, sized to be readable as a thumbnail; it does the *see more* job here too.
2. **Per-slide copy** — one idea per slide, **3–10 slides** (the high-performing range; [S2] / [S4]); each slide ends pulling the swipe.
3. **Caption** — ~100–200 words that frame the deck and carry the comment-CTA.

Hand the slide *text* to `../linkedin-carousels/SKILL.md` for layout and export.

**Native video** — best at **30–90 seconds**, and sub-60s short-form is reported to get ~53% more engagement than longer ([S2]). Write:
1. **Script beats** — hook in the first 3 seconds (the visual hook, since most watch muted), then turn → payoff → spoken CTA.
2. **Caption** — the text-post arc in miniature, ending on the comment-CTA.

Full templates with char budgets for all three formats live in `references/hooks-and-formats.md`.

## The link rule and the golden hour

**Put no link in the post body.** A body link is reported to cost ~60% of reach ([S2], with [S4] measuring one in-body link at ~18.8% median reach loss — both agree the hit is large; the exact figure varies by sample). The riskier, time-stamped claim is that the old "link in the first comment" workaround is *also* penalized as of early 2026 — reported by both [S2] and the named research report [S4], which describes external-link comments being suppressed. It is not confirmed by LinkedIn, so treat it as a strong reported signal, not a law: the safe default is to assume the escape hatch is at least partly closed. If a link is non-negotiable, accept the reach hit knowingly; otherwise put the URL nowhere and tell people to DM/comment for it. *Why: LinkedIn suppresses anything that pulls users off-platform, and the comment trick is widely reported as detected.*

**Work the golden hour.** LinkedIn first tests a post on only ~2–5% of your network in the first hour; only ~5% of posts that underperform in that window are reported to ever recover broader reach ([S2]). The first-hour-test mechanism is consistent with LinkedIn Engineering's described pipeline of scoring early engagement on an initial sample before expanding distribution ([S1]). So after posting: reply to every comment fast, and seed the thread with a real follow-up question. The post you abandon for an hour is the post the algorithm abandons.

## Learn from 02-DOCS

If the project has an `02-DOCS/` post log, read it before drafting: pull prior posts and their measured outcomes (impressions, dwell, comments, saves) and bias the new draft toward the hook patterns, formats, and CTA types that actually performed *for this account* — not generic best practice. Then log the new post back with its hook, format, and CTA type so the next draft is sharper. The front-matter schema (date, format, hook, cta_type, impressions, dwell_s, comments, saves) is in `references/hooks-and-formats.md`.

## Anti-patterns

| Anti-pattern | Why it kills the post | Fix |
|---|---|---|
| Link in the body (or "link in first comment") | ~60% reach hit; comment trick reported penalized too ([S2]/[S4]) | URL nowhere; offer it via DM/comment, or accept the hit knowingly |
| Greeting / "excited to share" hook | Reads as an ad; eye skips before *see more* | Open on the most surprising true thing, ≤150 chars |
| Wall of text | Tanks dwell ~40% vs. broken copy | 1–2 sentence paragraphs, blank line between blocks |
| "Thoughts?" CTA | Gets a like, not a comment; comments weigh ~15x | Ask what only the reader can answer |
| Post then ghost the golden hour | Underperforms the first-hour test → ~5% recover | Reply fast, seed a real question for 60–90 min |
| Chasing likes over comments | Likes are the weakest signal | Write the arc toward a comment, not applause |
| Padding to hit 1,900 chars | Padding lowers dwell, doesn't raise it | Ship the true length; the range is a target, not a quota |
| Picking text by default | Text is the lowest-ceiling format | Choose format from the idea (Step 0) — document/video often win |

## Before you hand over the draft

Run the mechanical lint on the drafted file — it catches reach-killers, not judgment:

```bash
scripts/verify.sh path/to/draft.md
```

It flags an over-long hook line, an http(s) link in the body, banned dead CTAs, and wall-of-text blocks. It is read-only and exits 0 on a clean or empty file. Judgment (does the hook actually pull? is the CTA answerable?) stays with you and the capability eval.
