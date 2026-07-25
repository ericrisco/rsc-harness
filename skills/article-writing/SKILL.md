---
name: article-writing
description: "Use when writing one long-form article end to end — answer-first lede, question-shaped headings, plus its on-page surface (title, meta, slug, FAQ, Article/FAQPage JSON-LD) — or fixing a draft that buries the answer or reads AI-padded. NOT keyword research or topic selection (that is `seo-geo`), NOT the editorial calendar (that is `content-engine`)."
tags: [article, blog, long-form, seo-writing, geo, on-page, eeat, copywriting]
recommends: [seo-geo, content-engine, brand-voice, landing-copy, technical-writing, case-studies]
origin: risco
---

# Article writing

Draft one long-form article end to end: the prose **and** the on-page surface that ships with it — answer-first lede, question-shaped headings, title tag, meta description, slug, FAQ block, and the JSON-LD that makes the piece machine-readable.

You own a single finished article. You do not pick the topic, build the calendar, or define the house voice — those are siblings below.

## When NOT to use

| You want… | Go to |
| --- | --- |
| Keyword research, SERP tracking, technical SEO, deciding which topics to target | [`../seo-geo/SKILL.md`](../seo-geo/SKILL.md) |
| Editorial calendar, topic-cluster plan, pipeline across many pieces | [`../content-engine/SKILL.md`](../content-engine/SKILL.md) |
| The reusable brand tone-of-voice spec the article is written in | [`../brand-voice/SKILL.md`](../brand-voice/SKILL.md) |
| A conversion landing or sales page (hero, offer, CTA) | [`../landing-copy/SKILL.md`](../landing-copy/SKILL.md) |
| An email newsletter issue (subject line, send) | [`../newsletter/SKILL.md`](../newsletter/SKILL.md) |
| Product docs, API reference, software how-tos | [`../technical-writing/SKILL.md`](../technical-writing/SKILL.md) |
| A customer outcome story / narrative | [`../case-studies/SKILL.md`](../case-studies/SKILL.md) |

Rule: if the deliverable is not *one publishable article*, you are in the wrong skill.

## Start from intent, not a word count

Before you write a sentence, read the top of the SERP for the target query. Name two things: the **dominant intent** (informational, transactional, comparison, navigational) and the **winning format** Google already rewards (listicle, step guide, definition + table, comparison). Match that format — fighting the shape Google already chose loses.

Then set depth from intent, not from a number you were handed. The first-page Google average is ~1,447 words across 11.8M results (Backlinko) — a *descriptive average*, never a target. Thoroughness and intent satisfaction rank, not length.

| Intent | Typical depth | Shape |
| --- | --- | --- |
| Simple how-to / quick answer | 400–800 words | Direct answer, short steps, one image |
| Standard informational post | 1,500–2,000 words | Answer-first lede + question H2s |
| Comprehensive guide | 1,700–2,500 words | Full subtopic coverage, tables, FAQ |
| Pillar page | 2,500–5,000 words | Hub with two-way cluster links |

Why: padding a 600-word answer to 2,000 to "look thorough" dilutes it and reads as filler. Cutting a guide to 800 words leaves the query half-answered. Length follows the question.

## The answer-first lede

The first ~200 words must directly and completely answer the primary query. Lead with the answer (TL;DR-first / inverted pyramid), then expand. This is the structure that wins featured snippets and AI Overview citations — and with zero-click hitting ~60% of searches (2024) and AI Overviews appearing in ~13% of queries (May 2025), being the extracted answer matters more than the click.

```markdown
<!-- Bad: warms up for three paragraphs before answering -->
## Should you compost in an apartment?
Composting has become increasingly popular in recent years as more people
look for sustainable lifestyle choices. Many city dwellers assume they can't
participate because of limited space. But is that really true? Let's explore
the fascinating world of urban composting and find out together.
```

```markdown
<!-- Good: answers in the first two sentences, then expands -->
## Can you compost in an apartment?
Yes — a sealed countertop bokashi bin or a small worm bin (vermicomposting)
lets you compost food scraps in a flat with no yard and no smell. Bokashi
ferments scraps in ~2 weeks; a worm bin yields finished compost in 3–6 months.
Here is how to choose between them and set one up in a 60×40 cm footprint.
```

If the query is a question, the H1 or first H2 should *be* that question and the next sentence should answer it. Worked lede examples are in [`references/on-page-seo.md`](references/on-page-seo.md).

## Outline as a question map

Build the skeleton from real subtopics, not from what you feel like writing.

- **One H1**, matching the primary query or its close paraphrase.
- **H2/H3 are questions or named subtopics** that mirror the SERP's "People also ask", related searches, and the headings competitors share — plus the gaps they all miss (that gap is your edge).
- **One idea per heading.** A heading that needs an "and" is two headings.
- Headings are subtopics, not slogans: `## How much does a standing desk cost?` not `## The Price Question`.

Why question-shaped headings: only ~38% of pages cited in AI Overviews rank top-10, so clean, extractable, question→answer structure can win citations without traditional authority. Make every section answerable on its own.

## Drafting for depth and E-E-A-T

Google does **not** penalize AI-assisted content as such. It penalizes *scaled content abuse* — high-volume, no-editorial-review, thin, no-first-hand-experience pages. The March 2026 core update named scaled content abuse a primary target; offending sites saw 50–80% traffic drops. The defense is not avoiding AI; it is genuine value, depth, and human review.

So every draft earns its keep with E-E-A-T (Experience, Expertise, Authoritativeness, **Trust** — Trust is the load-bearing member):

- **First-hand experience** — a thing you tested, measured, or saw. "We ran the worm bin for 90 days and weighed the output" beats "worm bins are effective".
- **Original data or insight** — a number, comparison, or angle not already on page one.
- **Credible cited sources** for claims you did not generate yourself — link them inline.
- **Clear authorship** — a named author with relevant standing, not "admin".
- **Match intent over keyword density.** Answer the question fully; the keywords fall out naturally. Never stuff.

Run a human-review pass before ship. If nothing in the draft could only have been written by someone who actually knows the topic, it is thin — add experience or do not publish.

## The on-page surface

Every article ships with these. Keep them in the file's front-matter or a clearly labelled block so [`scripts/verify.sh`](scripts/verify.sh) can lint them.

- **Title tag**: 50–60 characters / under ~580–600 px desktop (~480 px mobile). Put the primary keyword in the first ~30–35 characters. Titles of 51–55 chars are rewritten by Google least often.
- **Meta description**: 140–160 characters (desktop ~920 px ≈ 158 chars; mobile cuts at ~120). One to three sentences, lead with the value. It does not rank, but it drives CTR and is often the snippet AI engines echo.
- **H1**: exactly one, matching the query.
- **Slug**: short, lowercase, hyphenated, keyword-bearing, no stop-word noise — `/compost-in-apartment` not `/how-to-start-composting-in-your-apartment-today`.
- **FAQ block**: 3–6 real questions from "People also ask", each answered in 2–4 sentences.

Full pixel/char tables, slug rules, and copy-ready `Article`/`BlogPosting` + `FAQPage` JSON-LD (JSON-LD only — never microdata) live in [`references/on-page-seo.md`](references/on-page-seo.md). The JSON-LD must describe what is actually on the page; schema that does not match visible content is a quality flag, not a win.

## Internal links and topical authority

Place **3–5 contextual internal links** in the body of a standard article (more only for a long-form pillar). Rules:

- **Descriptive anchor text** — `worm bin setup guide`, never `click here` or a bare URL.
- Keep priority pages within ~3 clicks of the post.
- For a pillar, link **two ways**: pillar → each cluster article and each cluster article → pillar. That two-way map is the topical-authority signal AI engines read.

You insert the link *slots* and anchors that fit this article. Deciding the *cluster structure* — which pillar owns which clusters across the site — is [`../content-engine/SKILL.md`](../content-engine/SKILL.md)'s job, not yours.

## Cut the AI tells and the fluff

Do one ruthless pass: **delete every sentence that adds no fact.** If a sentence could sit in any article on any topic, it is filler.

Banned on sight (short sample): "In today's fast-paced world", "It's important to note that", "When it comes to", "Let's dive in", "the world of X", "navigating the landscape of", "unlock the power of", "in conclusion". The full banlist with Bad→Good rewrites and the depth self-review is in [`references/ai-tell-banlist.md`](references/ai-tell-banlist.md) — and that file is the single source `verify.sh` greps against.

```markdown
<!-- Bad: 28 words, zero facts -->
In today's fast-paced world, it's important to note that choosing the right
standing desk can really make a difference when it comes to your health.
```

```markdown
<!-- Good: 19 words, three facts -->
A standing desk adjustable from 70–120 cm fits users 1.5–2.0 m tall and cuts
the lower-back load reported across sit-all-day workdays.
```

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Padding to hit a word count | Dilutes the answer; reads as filler | Set depth from intent; ~1,447w is an average, not a target |
| Intro that warms up before answering | Loses snippets, AI Overviews, and ~60% zero-click readers | Answer the query in the first ~200 words |
| Keyword stuffing for density | Reads spammy; Google rewards intent match, not density | Answer fully; keywords fall out naturally |
| H2s that are slogans, not subtopics | Not extractable; misses People-also-ask citations | Question-shaped, one idea per heading |
| No named author or cited sources | Thin E-E-A-T; vulnerable in core updates | Add first-hand experience, data, citations, an author |
| FAQ with no FAQPage schema (or schema ≠ visible content) | Not machine-readable; mismatched schema is a quality flag | Ship matching `FAQPage` JSON-LD describing on-page Q&As |
| Generic AI-tell prose | Flagged as scaled, low-value content | Run the banlist + delete-no-fact-sentence pass |
| Ignoring the SERP's winning format | Fights the shape Google already rewards | Match the dominant format, then beat it on depth |

## Ship checklist

Restating the gates `verify.sh` enforces, for the human review:

- [ ] Answer-first lede — primary query fully answered in first ~200 words
- [ ] Exactly one H1; at least two question-shaped H2s
- [ ] Title 50–60 chars (keyword early); meta 140–160 chars
- [ ] JSON-LD present with `@type` `Article`/`BlogPosting`; `FAQPage` too if an FAQ section exists
- [ ] At least one contextual internal-link slot with a descriptive anchor (target 3–5)
- [ ] AI-tell / fluff banlist scan is clean
- [ ] Depth matches intent; first-hand experience or original data present; author + sources named

Run `scripts/verify.sh path/to/article.md`. It is a lint of structure and banned phrasing — it does not judge whether the content is *good*. That is the capability eval's job, and yours.
