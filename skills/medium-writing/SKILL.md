---
name: medium-writing
description: "Use when crafting or rewriting ONE Medium story so it earns reads, claps, and Boost curation — writing the title/subtitle/kicker as a hook system, fixing a story that gets views but a low read ratio (title over-promises, intro buries the payoff, wall-of-text body), making a draft scannable and curation-eligible, or reshaping a blog post/newsletter into Medium-native form. Triggers: 'write a Medium article that gets read', 'my Medium post gets views but nobody finishes it', 'fix my read ratio', 'give me a title subtitle and kicker', 'make this Boost-eligible', 'curation-worthy Medium draft', 'escribe un artículo de Medium que enganche desde el primer párrafo', 'fes que aquest esborrany de Medium sigui llegible'. NOT scheduling/publishing/tags/submitting to a publication (that is medium-publishing), and NOT deciding what topics or cadence to write (that is medium-strategy)."
tags: [medium, writing, headlines, hooks, read-ratio, curation, boost, formatting]
recommends: [medium-publishing, medium-strategy, brand-voice, article-writing, content-engine]
origin: risco
---

# Medium Writing — One Story That Gets Read

*You produce a single paste-ready Medium story: the hook system, the first screen, the scannable body, the images, the alt text — tuned for the two metrics Medium's 2026 model rewards. You do not publish it and you do not decide what to write.*

You own the **craft of one Medium story**. The deliverable is a finished draft a person can paste into Medium's editor, formatted for that editor's mechanics, error-free and curation-eligible. Three things are explicitly out of scope:

- **Publishing mechanics** — connecting the account, scheduling, tags, choosing/submitting to a publication, canonical/import, distribution status. That is `medium-publishing`.
- **Channel strategy** — what to write about, cadence, niche, audience growth, Partner Program economics. That is `medium-strategy`.
- **The brand's reusable voice definition** — that is [`../brand-voice/SKILL.md`](../brand-voice/SKILL.md). This skill *applies* a voice; it does not author one. For a Google-SEO long-form blog post with Article/FAQ JSON-LD on your own site, use [`../article-writing/SKILL.md`](../article-writing/SKILL.md) — Medium owns its own on-page surface, so schema is irrelevant here.

## The two numbers that govern every choice

Medium's recommendation model is per-article and turns on two funnel ratios, not your follower count or tenure. Optimize for these or nothing else matters.

| Number | Rule-of-thumb aim | What it means | What earns it |
|---|---|---|---|
| Impressions → views | >10% | People who saw the card clicked it | Title + subtitle + cover |
| Views → reads | >50% | People who clicked stayed 30s+ | The first screen delivering the title's promise |

The two ratios are real and authoritative; the specific >10% and >50% targets are **community rule-of-thumb benchmarks**, not numbers Medium publishes. Treat them as "good enough to clear the bar," not as Medium's stated model. What Medium *does* document: a member read counts at **30s+**, and the read ratio "adjusts" earnings up or down (Help Center, "Medium Partner Program earnings calculation").

Rule: **the title earns the click, the first screen earns the read, and there can be no gap between them.** Why: the read ratio (members who read 30s+ ÷ members who loaded the story) adjusts your earnings and explicitly penalizes stories that "attract clicks but do not deliver on the promise of their title or preview" — verbatim from Medium's Distribution Guidelines. A title that over-promises does not just under-perform; it is taxed. (This penalty is about the title/preview promise, not story length — long reads are not penalized for being long.)

Rule: **claps feed the recommendation engine.** Why: passing roughly 200 claps materially raises the chance Medium surfaces the story to new readers, so write something a reader wants to applaud at the end, not just open.

## Title + subtitle + kicker = one hook system

These three are one mechanism, not three decorations. Write them together, last, after the body exists — you cannot promise what you have not yet delivered.

Pick a title archetype to match the payoff:

| Archetype | Use when | Example |
|---|---|---|
| Specific result | You have a concrete number/outcome | "How I Cut Our Build Time From 14 Minutes to 90 Seconds" |
| Contrarian | You disagree with received wisdom | "Stop Writing Unit Tests First" |
| How-to | The value is a repeatable method | "A 4-Step Way to Debug Any Flaky Test" |
| Narrative-I | The lesson rides on your story | "I Shipped to Production on Day One. Here's What Broke." |
| Question | The reader shares the open question | "Why Does Every Postgres Index Slow Down My Writes?" |

The **subtitle extends and qualifies the title** — it is indexed for on-Medium and external search and is the preview text under the title, so it is load-bearing, never filler. Use it to add the specificity the title leaves out.

- Bad → title "How I Cut Our Build Time" / subtitle "A story about CI."
- Good → title "How I Cut Our Build Time From 14 Minutes to 90 Seconds" / subtitle "The fix was three lines of cache config — but finding them took a week of profiling."

The **kicker** is a short phrase that frames the category, e.g. "Engineering" or "Lessons From a Failed Launch." It sets context before the title lands.

**Strong, not sensational.** Boost curation rejects shocking or sensational titles, subtitles, and covers. A strong title makes a specific, deliverable promise; a sensational one manufactures alarm or withholds to bait the click. "How I Cut Our Build Time From 14 Minutes to 90 Seconds" is strong. "This One Trick Will SHOCK Your DevOps Team" is sensational and disqualifying. The full archetype library, with annotated Bad→Good pairs and the sensational-vs-strong line, is in [`references/title-patterns.md`](references/title-patterns.md).

## The first screen earns the read

The read ratio is won or lost above the first scroll. The reader arrived because the title made a promise; pay it immediately.

- Rule: **open on the promise within ~3 sentences.** Why: every sentence of warm-up is a sentence in which a member can bounce before the 30-second read counts.
- Rule: **kill the meta-throat-clearing.** Delete "In this article, I'll…", "Before we dive in…", "We've all been there…". Why: it announces the article instead of being the article, and it reads as AI filler to curators.
- Rule: **land one concrete payoff before the first scroll.** Why: a number, a result, a sharp claim, or the single most useful line — proof the promise is real.

Bad → "Performance is something every engineer cares about. In this post, I want to share some thoughts on build times and why they matter to teams like ours."

Good → "Our CI took 14 minutes. After a week of profiling, three lines of cache config took it to 90 seconds. Here is exactly what those three lines were and how I found them."

## Scannable body

Most readers scan before they commit. Build the page so a scan still delivers value.

- **Section headers are scan anchors.** Let a reader lock onto the part they want; one header per distinct idea.
- **One idea per short block.** Paragraphs of 1–3 sentences. A wall of text is the second-most-common read-ratio killer after a weak first screen.
- **Pull-quote the one screenshot-worthy line.** Exactly one per story — the line you would want someone to share.
- **Drop cap is optional** and at most once, at the open.
- Rule: **less is more on styling.** Why: over-mixing drop caps, pull-quotes, bold runs, and embeds reads amateur and distracts from the argument; pick the few that earn their place.

## Images and alt text

- The **cover image sets the preview card** alongside the title and subtitle — it participates in impressions→views, and like the title it must not be sensational.
- **In-body images break long text stretches** and give the eye a rest; place one before any section that runs long.
- Rule: **every image gets alt text.** Why: it is an accessibility requirement and a free relevance signal; describe the image's content, not "image1.png".

## Boost-eligibility pass

Boost is human curation against Medium's Distribution Guidelines, and publications/editors remain a main discovery path into it — so the bar is "reads like a curated publication piece." (Medium closed the Boost Nomination Program on 2026-05-31 and is replacing it with an Editor Partner Program, expanded in July 2026; the *Distribution Guidelines applied to Boost are unchanged*, so this gate still holds.) Before delivering, run this gate — every item must pass:

- [ ] **Error-free** — spelling, grammar, broken links, and formatting all clean. Copyediting is gating, not cosmetic.
- [ ] **Appropriately sourced** — claims, stats, and quotes attributed with links; nothing asserted bare.
- [ ] **Narratively strong** — a clear arc with a beginning, a middle, and a payoff; not a loose list of tips.
- [ ] **Not sensational** — title, subtitle, and cover are strong but not shocking, explicit, or alarmist.
- [ ] **Human-written** — AI-generated content is not Boost-eligible; the prose must read as the author's, with specific lived detail, not generic.
- [ ] **Not aggressively promotional** — a sales pitch dressed as an article is deprioritized.

(The 180-day freshness window is a publishing-time concern — `medium-publishing` owns it. Your job is that the craft passes the moment it is published.)

## Editor mechanics — label the structural lines

Medium's editor derives structure from formatting, not metadata: the **first line** of the story is the title (large "T"), the line directly below it formatted small "t" is the **subtitle**, and a **kicker** is a short phrase on a line *above* the title, also small "t". Mis-formatting these can render the story **ineligible for curation**. So the delivered draft must label them explicitly so the author applies the right formatting:

```text
KICKER:   Engineering
TITLE:    How I Cut Our Build Time From 14 Minutes to 90 Seconds
SUBTITLE: The fix was three lines of cache config — but finding them took a week of profiling.

[body starts here…]
```

Tell the author plainly: in Medium's editor, type the kicker line first and format it small "t", then the title as the large "T" line, then the subtitle small "t" directly under it.

## Learn from the author's stats (02-DOCS)

If `02-DOCS/` exists, learn before you write:

- Read raw exports under `02-DOCS/raw/medium/` and any compiled patterns under `02-DOCS/wiki/medium/`.
- Bias toward the title/subtitle patterns and topics that historically beat a 50% read ratio for *this* author; avoid angles that drew clicks but bounced.
- After a notable result, append the learned pattern to `02-DOCS/wiki/medium/read-ratio-patterns.md` so the next draft inherits it.

`read-ratio-patterns.md` lives in the `02-DOCS/wiki/` OKF v0.1 bundle, so it carries YAML frontmatter with a non-empty `type:` — one block at the top, with new pattern blocks prepended newest-first below it. Use `type: medium-record` (the same type the `medium-strategy` skill writes under `02-DOCS/wiki/medium/`, keeping the two skills' wiki content consistent). Create it with this header if it does not yet exist:

```markdown
---
type: medium-record
title: Read-ratio patterns — Medium
description: Title/subtitle/topic patterns that historically beat a 50% read ratio for this author.
tags: [medium, read-ratio, titles, hooks]
timestamp: 2026-06-02T00:00:00Z
topic: medium
status: stable
---

## 2026-06-02 — <pattern learned>
- <title/subtitle archetype + topic that beat the 50% read ratio, with the number observed>
```

Cross-references use standard markdown links (`[Text](./what-worked.md)`), never wikilinks (`[[...]]`).

If `02-DOCS/` is absent, proceed from the craft defaults above and say so in one line, rather than inventing stats.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Sensational title ("SHOCKING", "You won't believe…") | Disqualifies the story from Boost curation | Strong, specific, deliverable promise |
| Title over-promises the body | Member read ratio penalizes the click-gap and taxes earnings | Write title + subtitle last, only promise what the body delivers |
| Warm-up intro ("In this article, I'll…") | Members bounce before the 30s read counts | Open on the promise in ~3 sentences with a concrete payoff |
| Wall of text | Scanners leave; read ratio drops | Section headers, 1–3 sentence blocks, one idea per block |
| Over-styled (drop cap + 5 pull-quotes + bold everywhere) | Reads amateur; distracts from the argument | Less is more; one pull-quote, headers, sparing bold |
| Generic AI-tell prose, no lived detail | Not Boost-eligible; readers don't clap | Specific numbers, names, and first-hand detail in the author's voice |
| Claims with no sources | Fails the "appropriately sourced" curation gate | Attribute every stat/quote with a link |

## Cross-references

- Publish, schedule, tag, or submit the finished draft → `medium-publishing`.
- Decide topics, cadence, niche, monetization → `medium-strategy`.
- Define the reusable voice this draft writes in → [`../brand-voice/SKILL.md`](../brand-voice/SKILL.md).
- A Google-SEO blog post with JSON-LD on your own site → [`../article-writing/SKILL.md`](../article-writing/SKILL.md).
- A multi-channel editorial calendar/pipeline → [`../content-engine/SKILL.md`](../content-engine/SKILL.md).
