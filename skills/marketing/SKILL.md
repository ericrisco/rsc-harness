---
name: marketing
description: "Use when writing the WORDS for a landing page, marketing site, or launch — value proposition, hero/headline, section-by-section landing copy, microcopy, CTAs, email and launch sequences, channel-adapted messaging (X/LinkedIn/newsletter), SEO-aware copy structure, and SEO/GEO optimization (technical SEO, JSON-LD schema, and getting cited by AI engines like ChatGPT/Perplexity/Gemini/Claude). Grounds every output in the project's brand study under 02-DOCS; if that study is missing or incomplete, it STOPS and interviews the user first. Triggers: 'write the landing copy', 'write the hero', 'value proposition', 'rewrite this CTA', 'write the launch emails', 'turn features into benefits', 'adapt this for LinkedIn/X', 'this copy sounds like AI', 'marketing copy', 'seo', 'geo', 'ai search', 'schema', 'json-ld', 'get cited by ChatGPT', 'rank on Google', 'keyword research', 'meta description', 'AI Overview'. NOT the pixels (that's `design`) and NOT the build (that's `nextjs`)."
tags: [marketing, copywriting, landing, content]
recommends: [presentations, design]
origin: risco
---

# Marketing — Conversion Copy for Landings & Web Pages

*The words, not the pixels. Ground in the brand study first, then write copy that is specific, benefit-led, and unmistakably this brand.*

This skill owns **conversion copywriting**: value proposition, headlines, section-by-section landing copy, microcopy, CTAs, email/launch sequences, channel adaptation, and SEO-aware copy structure. The sibling `design` skill owns the visual/UX (type, color, layout, motion); `nextjs` owns the build. When asked for "a landing page", you write the copy; defer composition and tokens to `design` and rendering to `nextjs`.

## When to use / When NOT to use

Use when:

- Writing or rewriting a landing page, marketing site, or pricing page — the copy.
- Crafting a value proposition or positioning statement.
- Writing headlines, subheads, section copy, microcopy, or CTAs.
- Building an email sequence, launch announcement, or nurture flow.
- Adapting one message across channels (X, LinkedIn, newsletter, ads).
- Rescuing copy that "sounds like AI" or reads generic.

Do NOT use when (delegate or decline):

- Choosing type/color/spacing/layout/motion, or the section visual anatomy → `design`.
- Implementing the page in React/Next.js (Metadata API, rendering, components) → `nextjs`.
- Implementing schema/Metadata in React/Next.js code → `nextjs` (this skill specifies the title/description/JSON-LD; `nextjs` renders it). Technical SEO, GEO, schema, and keyword research themselves are owned here → `references/seo-geo.md`.
- Capturing or persisting a project's brand/voice profile → that is THIS skill's brand-grounding step, persisted under `02-DOCS` per `harness`.
- Long-form articles, blog posts, or social content systems with no landing/web surface → that is a content job, not landing copy; this skill stays on landings, web pages, and the launch/email/channel copy around them.

## Brand grounding (read this first)

**Hard rule: never produce landing, web-page, or marketing copy without a complete brand study.** Generic copy is the failure mode this skill exists to prevent, and the cure is grounding every word in a real, persisted brand profile. An incomplete brand study is a hard STOP, not a warning.

Run this gate before writing a single line of copy:

1. **Locate the brand study.** Read the project's root `CLAUDE.md` and look for a `## Brand & voice` section linking into `02-DOCS/wiki/brand/` (the `harness` Karpathy-wiki convention: compiled brand articles live under `02-DOCS/wiki/brand/`, raw inputs the user pastes live under `02-DOCS/raw/brand/`). If `CLAUDE.md` is absent, the link is missing, or it points nowhere, treat the study as ABSENT.

2. **Check completeness** against the checklist in `references/brand-grounding.md`. The study is complete only when every dimension is filled: brand name & one-line positioning; ICP / audience & their pains & desires; value proposition & differentiation; tone & voice WITH do/don't word lists and 3–5 voice samples pasted from the user's real writing; proof/credibility; offers & primary CTA; channels; SEO keywords. **Any empty dimension = INCOMPLETE.**

3. **If ABSENT or INCOMPLETE, STOP and interview the user.** Ask the targeted questions from `references/brand-grounding.md`, **one focused batch at a time** (do not dump all questions at once; ask, wait, then continue). Voice samples are mandatory — request 3–5 pieces of the user's real writing; never fabricate a voice. Then:
   - **a.** Write/update the brand study into `02-DOCS/wiki/brand/` as wiki articles (one article per dimension or a single `index.md` plus per-dimension articles), following the wiki article format in `references/brand-grounding.md`. Save any raw text the user pastes verbatim into `02-DOCS/raw/brand/` and link to it from the article's `> Raw:` line. Create the directories if they do not exist.
   - **b.** Add or update a `## Brand & voice` section in the root `CLAUDE.md` linking to the brand study. Create `CLAUDE.md` if absent (additive only — never delete existing sections). The exact snippet to insert is in `references/brand-grounding.md`.

4. **Only once the study exists and is complete, proceed.** Cite which brand articles you used (e.g. "grounded in `02-DOCS/wiki/brand/value-proposition.md` and `voice.md`") so the user can trace every claim back to the study.

If the user explicitly says "skip the brand study, just draft something rough", you may produce a clearly-labelled `DRAFT (ungrounded — not brand-checked)` and still recommend running the gate before anything ships. That is the only exception, and it must be labelled.

Full completeness checklist, the exact question script (batched), and the persistence format → `references/brand-grounding.md`.

## The non-negotiables

These are constraints, not preferences. Violating any one is a defect.

1. **Brand study first.** No copy before the grounding gate passes (above). Cite the articles you used.
2. **5-second value-prop test.** A stranger reads the hero and can say *what it is, who it's for, why it's better* — within 5 seconds. If not, rewrite before anything else.
3. **Specificity beats adjectives.** Replace "fast", "powerful", "seamless" with a number, a mechanism, or a receipt. "Fast" is a claim; "30 seconds" is evidence.
4. **Benefit-led, climbing feature → benefit → proof.** Stop at the rung the reader cares about (the benefit) and back it with proof.
5. **One primary CTA per viewport**, value on the button ("Start free", not "Submit"). Pair it with friction-reducing microcopy ("No credit card required").
6. **One claim per asset.** A post, an email, a section each carry one real claim — not five hedged ones.
7. **Match the voice samples.** Every line must plausibly come from the brand's own writing. If it reads like a different author, rewrite.
8. **The ban-list is enforced everywhere.** Hype words and AI tells are defects, not style. (See ban-list below; `scripts/verify.sh` greps for them.)
9. **No invented proof.** Never fabricate metrics, customers, quotes, or credentials. Mark `[[NEEDS PROOF]]` and ask.
10. **SEO-aware structure, not keyword stuffing.** One `<h1>`, scannable subheads that answer queries, benefit in the first 160 chars. Keyword stuffing *lowers* AI citation — full technical SEO/GEO is in `references/seo-geo.md`.

## Copy workflow (the one pass)

Run in order. Each step feeds the next; skipping one shows up as vague copy downstream.

1. **Ground.** Pass the brand-grounding gate. Load value prop, ICP, voice, proof, offer, channels, keywords from `02-DOCS/wiki/brand/`.
2. **Lock the value proposition.** Fill the value-proposition canvas (jobs / pains / gains → pain-relievers / gain-creators → headline). → `references/copy-frameworks.md`.
3. **Pick the framework** by traffic temperature and funnel position: PAS for pain-aware cold traffic; AIDA for broad top-of-funnel; FAB/JTBD for feature → benefit; BAB for transformation/case-study. → `references/copy-frameworks.md`.
4. **Write section by section.** Each landing section has one job and one framework. Map your copy to the design skill's section anatomy. → `references/landing-copy.md`.
5. **Write the microcopy and CTAs.** Value verbs on buttons, reassurance under them, human empty/loading/error states. → `references/copy-frameworks.md`.
6. **Adapt for channels** if the task spans more than the page (email sequence, launch, X/LinkedIn/newsletter). → `references/campaigns-and-channels.md`.
7. **Run the QA gate** (below) and `scripts/verify.sh`. Fix every flag or justify it.

## Headlines & value proposition in 60 seconds

The headline is the highest-leverage copy on the page. Build it from the canvas, not from a thesaurus.

```text
VALUE-PROP CANVAS (fill before writing the headline)
Customer job ....... the outcome they're hired to achieve
Top pain ........... the friction that blocks the job today
Top gain ........... what "great" looks like to them
Pain reliever ...... how the product removes that friction
Gain creator ....... the upside the product unlocks
Headline ........... compress the strongest reliever+gain into one line
Subhead ............ who it's for + how it works in one clause + proof if you have it
```

Headline formula slots (pick one, fill with brand specifics):

- **Outcome + timeframe** — "Preview every branch in 30 seconds".
- **X without Y** — "Live previews without a staging queue".
- **JTBD** — "When you open a PR, get a live URL automatically".
- **Specificity** — replace an adjective with a number: "Cut review setup from 20 min to 30 sec".

```text
Bad  — "Revolutionize your workflow with our seamless, cutting-edge platform"
Good — "Ship a fix in 4 minutes — no YAML, no on-call page"
```

Full canvas walk-through, PAS/AIDA/FAB/BAB/JTBD with Bad→Good rewrites, headline formulas, microcopy & CTA tables → `references/copy-frameworks.md`.

## Landing copy by section

Each section earns its place by doing one job. Cut any section with no job. This maps 1:1 to the `design` skill's section anatomy — `design` owns the visual treatment, this skill owns the words inside it.

| Section | Copy job | Framework |
| --- | --- | --- |
| Hero | State the value prop; pass the 5s test | Outcome + timeframe headline |
| Social-proof strip | Borrow credibility instantly | Quantified, attributed |
| Problem / agitation | Name the pain in the reader's words | PAS |
| Solution | Show the product doing the job | FAB |
| Features → benefits | Translate each capability into an outcome | FAB / JTBD per item |
| Objection handling | Preempt the top reason not to buy | "X without Y" |
| Pricing | Make the choice easy; frame value | Value framing, anchored |
| FAQ | Answer the real blockers | Question → direct answer |
| Final CTA | One action, value on the button | CTA verb + reassurance |

```text
Bad  (features list) — "Includes automated teardown, RBAC, and audit logs."
Good (benefit-led)   — "Environments tear down on merge, so you never pay for idle infra
                        or clean up by hand."
```

Full per-section copy patterns, hero variants, social-proof formats, pricing copy, FAQ writing → `references/landing-copy.md`.

## Campaigns & channels

When the task is bigger than the page — a launch, an email sequence, cross-channel messaging.

- **Email sequences:** welcome email inside 5 minutes of opt-in (highest open rate of the whole flow); 4-touch starter cadence Day 1 welcome → Day 4 educational → Day 8 case study → Day 12 soft pitch; nurture runs 7–10 emails every 1–2 weeks. One purpose per email. Hold promo language ("free", "limited time") out of early emails to protect deliverability and trust.
- **Launch:** sequence the beats (tease → reveal → proof → urgency → recap), one claim per beat, every claim traceable to the brand study's proof.
- **Channel adaptation:** adapt the *format* to the platform, never resize the same copy. X opens with the sharpest claim; LinkedIn expands just enough for outsiders; newsletter does real work in the first screen.
- **SEO-aware structure:** one `<h1>`, scannable subheads as query answers, benefit in the first 160 chars; full technical SEO/GEO in `references/seo-geo.md`.

Full email templates, subject-line patterns, launch arc, X/LinkedIn/newsletter adaptation, SEO-aware structure → `references/campaigns-and-channels.md`.

## SEO & GEO

The skill body keeps copy *SEO-aware* (one `<h1>`, query-answering subheads, benefit in the first
160 chars). When the task is the visibility layer itself — ranking on Google/Bing **and getting
cited by AI engines** — go to `references/seo-geo.md`. It owns technical + on-page SEO, JSON-LD
schema, per-engine GEO, and keyword/SERP research.

- **SEO** = rank in traditional results (**Google, Bing**). **GEO** (Generative Engine
  Optimization) = get *cited* inside an AI answer (**ChatGPT, Perplexity, Gemini/AI Overviews,
  Claude, Copilot**). GEO sits on top of SEO; do both.
- **The insight that reframes it:** AI engines don't rank pages, they **cite sources**. Being one of
  the few sources an answer is built from is the new "ranking #1" — you optimize to be *quoted and
  attributed*, not clicked.
- **GEO and this skill agree.** The top GEO moves (Princeton, KDD 2024) are *cite sources, add
  statistics, add quotations, authoritative tone* — the same "specificity beats adjectives, no
  invented proof, one claim per asset" discipline already enforced above. Keyword stuffing *lowers*
  AI citation (~−10%). The proof rule is absolute: **never fabricate the stat or quote that earns
  the lift** — mark `[[NEEDS PROOF]]` and source it.
- **Audit first, free, no API:** `python3 scripts/seo_audit.py "https://yoursite.com"` reports
  title/description lengths, single-`<h1>`, JSON-LD count, load time, robots/AI-bot access, sitemap.
- **Crawler reality (2026):** `OAI-SearchBot`/`Claude-SearchBot`/`PerplexityBot` (+ the `*-User`
  fetchers) earn citations; `GPTBot`/`ClaudeBot` are *training* crawlers — independently
  controllable. **INP replaced FID** in Core Web Vitals (Mar 2024; ≤ 200 ms good).

Full GEO method table, robots.txt template, schema library, per-engine factors, keyword workflow,
and SEO/GEO QA gate → `references/seo-geo.md`. Implementing schema/Metadata in code → `nextjs`.

## The ban-list

State once, enforce everywhere. These signal AI-template copy and erode trust. `scripts/verify.sh` greps for them.

`revolutionary` · `game-changer` · `cutting-edge` · `world-class` · `unlock` · `seamless` · `elevate` · `supercharge` · `next-level` · "In today's landscape" · "In today's fast-paced world" · bait questions ("Tired of slow deploys?") · "not X, just Y" / "not just X" · forced lowercase as a style · "Excited to share" · hollow proof ("thousands trust us") · generic CTAs ("Learn more", "Click here", "Submit") · fake urgency with no real deadline.

```text
Bad  — "Excited to share our game-changing, world-class platform!"
Good — "We rebuilt deploys around one CLI step. Here's what changed: 22 min → 90 sec."
```

The brand study's do/don't word lists EXTEND this list per project — always apply both.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I know the brand, I'll skip the study" | Your default voice is AI-median. Run the gate; cite the articles. |
| "The image sells it, the copy can be vague" | Copy carries the value prop. Pass the 5s test in words. |
| "Adjectives make it sound premium" | They make it sound generic. Replace with a number or mechanism. |
| "List every feature so they see the value" | Feature dumps bury the benefit. Climb to benefit, back with proof. |
| "Add a few testimonials, any will do" | A vague rave < one hard number. Quantify and attribute. |
| "Five CTAs give them options" | Choice kills conversion. One primary action per viewport. |
| "Hype words test well" | They erode trust and trip the ban-list. Specificity converts. |
| "I'll invent a plausible metric to fill the gap" | Never. Mark `[[NEEDS PROOF]]` and ask the user. |
| "Same copy works on X and LinkedIn" | Resize ≠ adapt. Different format per platform, same claim. |

## Copy QA gate

Run before claiming done. `scripts/verify.sh` automates the greppable subset.

- [ ] Brand study located, complete, and cited (which articles grounded this copy).
- [ ] Hero passes the 5-second test (what / who / why-better legible fast).
- [ ] Exactly one `<h1>`; subheads scannable and query-answering.
- [ ] Every claim is specific (number / mechanism / receipt), not an adjective.
- [ ] Copy climbs feature → benefit → proof; lands on the benefit.
- [ ] One primary CTA per viewport; value on the button; reassurance microcopy present.
- [ ] No invented proof; every gap marked `[[NEEDS PROOF]]`.
- [ ] Voice matches the brand study's samples and do/don't lists.
- [ ] Ban-list words absent (global list + brand don't-words).
- [ ] No passive-voice hedging or weasel words where a direct claim belongs.
- [ ] Email subjects match the body (no bait-and-switch); promo language held out of early emails.
- [ ] Channel copy adapted per platform, not resized.
- [ ] Title 50–60 chars, meta description 120–160, benefit in the first 160 chars.

Automate → `scripts/verify.sh` (read-only grep gate; warns by default, `--strict` to gate CI).

## Project grounding (02-DOCS + CLAUDE.md)

This skill's 02-DOCS record is the **brand & voice study** at `02-DOCS/wiki/brand/` — a hard
gate (see "Brand grounding" above): if the root `CLAUDE.md` lacks the link or the study is
incomplete (no voice samples, positioning, do/don't lists), ask until complete, persist it, and
index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short
pointer to it). Read it first on every use and ground all copy in it. Site and visual conventions
belong to the sibling `design` and `nextjs` articles in the same Knowledge map index.

## See Also

- `../design/SKILL.md` — the pixels: visual system, layout, section anatomy, motion, design QA.
- `../nextjs/SKILL.md` — the build: App Router, Metadata API, React 19 rendering.
- `../harness/SKILL.md` — the `02-DOCS` Karpathy-wiki convention this skill persists the brand study into.
- References: `references/brand-grounding.md`, `references/copy-frameworks.md`, `references/landing-copy.md`, `references/campaigns-and-channels.md`, `references/seo-geo.md` (technical SEO + GEO + schema + keyword research).
