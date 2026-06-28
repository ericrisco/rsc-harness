# Brand Grounding — Checklist, Question Script & Persistence

The brand study is the source of truth every piece of marketing copy is grounded in. This file holds the **completeness checklist** (what "complete" means), the **question script** (how to interview the user, batched), and the **persistence format** (how to write it into `02-DOCS` and link it from `CLAUDE.md`). The runtime mechanism that invokes this — the hard STOP on an incomplete study — lives in `SKILL.md` under "Brand grounding (read this first)".

## Where the brand study lives

Following the `harness` Karpathy-wiki convention:

```text
02-DOCS/
├── raw/brand/         ← immutable: voice samples + raw inputs pasted verbatim by the user
│   ├── voice-sample-1.md
│   ├── voice-sample-2.md
│   └── …
└── wiki/brand/        ← compiled brand study, one article per dimension
    ├── index.md            ← positioning one-liner + links to every dimension article
    ├── audience.md         ← ICP, pains, desires
    ├── value-proposition.md← value prop, differentiation
    ├── voice.md            ← tone, do/don't word lists, links to raw voice samples
    ├── proof.md            ← credibility, metrics, customers, guarantees
    ├── offers.md           ← offers + primary/secondary CTA
    ├── channels.md         ← active channels + per-channel notes
    └── seo.md              ← target keywords + intent
```

Small projects may collapse this into a single `index.md` with all eight sections as `##` headings — but every dimension must still be present and filled.

## Completeness checklist

The study is **COMPLETE** only when every dimension below is filled with real, specific content. Any empty, placeholder, or "TBD" dimension = **INCOMPLETE** = hard STOP, interview the user.

- [ ] **1. Brand name & one-line positioning** — the name, and one sentence: "[Brand] helps [audience] [achieve outcome] by [mechanism]." No jargon, no feature list.
- [ ] **2. ICP / audience, pains & desires** — who exactly (role, context, sophistication); the top 2–3 pains in their own words; the top 2–3 desires/gains; the alternatives they use today.
- [ ] **3. Value proposition & differentiation** — the core benefit in one sentence; what makes it different from the named alternatives; the one thing only this brand can credibly say.
- [ ] **4. Tone & voice** — tone descriptors (3–5 adjectives); a **do-words** list; a **don't-words** list; and **3–5 voice samples pasted from the user's real writing** (posts, emails, docs, prior copy). Samples are mandatory; a voice cannot be inferred without them.
- [ ] **5. Proof & credibility** — real metrics, named customers/logos, quantified testimonials, certifications, guarantees, or traction the brand can stand behind. Mark anything aspirational as `[[NEEDS PROOF]]`, never present it as fact.
- [ ] **6. Offers & primary CTA** — what the visitor is being asked to do (sign up, book a demo, buy, join waitlist); the primary CTA verb; any secondary CTA; pricing model if relevant.
- [ ] **7. Channels** — where this brand actually publishes (landing page, X, LinkedIn, newsletter, email, ads); the priority order; any per-channel constraints.
- [ ] **8. SEO keywords** — the primary keyword/theme and 3–5 secondary keywords or query phrases the audience actually searches. (This captures intent only; the keyword/SERP workflow and technical SEO/GEO live in `seo-geo.md`.)

## Question script (ask in batches, never all at once)

Ask **one batch at a time**. Send the batch, wait for the answer, persist what you learned, then send the next batch. Skip questions a located-but-incomplete study already answers — only fill the gaps. Stop interviewing the moment all eight dimensions are complete.

### Batch 1 — identity & audience

```text
1. What's the brand/product name, and in one sentence: who is it for and what outcome does it deliver?
2. Describe your ideal customer precisely — their role, context, and how sophisticated they are about this problem.
3. In THEIR words, what are the top 2–3 pains that make them look for something like you?
4. What does "great" look like to them — the top 2–3 things they actually want?
5. What do they use today instead of you (tools, workarounds, "doing nothing")?
```

### Batch 2 — value & proof

```text
6. In one sentence, what's the core benefit — no feature list, no jargon?
7. What makes you genuinely different from the alternatives you just named?
8. What's the one thing only YOU can credibly claim?
9. What proof can you stand behind right now? (metrics, named customers, testimonials with
   numbers, certifications, guarantees). If something is aspirational, say so — I'll mark it
   as needing proof rather than state it as fact.
```

### Batch 3 — voice (samples are mandatory)

```text
10. Pick 3–5 adjectives for how the brand should sound (e.g. direct, dry, warm, technical).
11. Give me a DO list and a DON'T list of words/phrases — things you always say, and things
    you never want to see.
12. Paste 3–5 samples of your REAL writing — posts, emails, docs, prior copy. This is how I
    match your voice instead of inventing a generic one. (I'll save these verbatim under
    02-DOCS/raw/brand/.)
```

### Batch 4 — offer, channels, SEO

```text
13. What's the single action you want visitors to take? (sign up, book a demo, buy, join a
    waitlist…) And is there a secondary action?
14. What's your pricing model, if any?
15. Which channels do you actually publish on, and in what priority? (landing page, X,
    LinkedIn, newsletter, email, ads)
16. What 1 primary + 3–5 secondary keywords or phrases does your audience actually search?
```

If the user can't answer a question, that dimension stays incomplete — note the gap, keep the STOP in place for that dimension, and offer to draft a hypothesis they can confirm rather than fabricating an answer.

## Persistence format

### Brand wiki article template

Each `02-DOCS/wiki/brand/*.md` article follows the harness wiki format. It is an OKF v0.1 article: open it with YAML frontmatter carrying a non-empty `type:` (`brand-study`), then the H1 and body:

```markdown
---
type: brand-study
title: Brand — Value Proposition
description: The core benefit and what makes this brand different from the named alternatives.
tags: [brand, value-proposition]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: brand
status: stable
---

# Brand — Value Proposition

> Sources: {user interview, YYYY-MM-DD}
> Raw: [voice-sample-1](../../raw/brand/voice-sample-1.md)

## Overview

One paragraph: the core benefit and what makes it different.

## Core benefit

[Brand] helps [audience] [achieve outcome] by [mechanism].

## Differentiation

- vs [alternative A]: …
- vs [alternative B]: …

## The one credible claim

…

## See Also

- [Audience](audience.md)
- [Proof](proof.md)
```

### Voice article specifics

`voice.md` must contain the do/don't word lists and link to every raw sample (same OKF frontmatter; `type: brand-study`):

```markdown
---
type: brand-study
title: Brand — Tone & Voice
description: Tone descriptors, do/don't word lists, and the voice fingerprint extracted from real samples.
tags: [brand, voice, tone]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: brand
status: stable
---

# Brand — Tone & Voice

> Sources: {user interview, YYYY-MM-DD}
> Raw: [sample-1](../../raw/brand/voice-sample-1.md); [sample-2](../../raw/brand/voice-sample-2.md)

## Tone

direct · dry · technical · respects the reader's time

## Do-words

ship, concrete, mechanism, receipt, in <time>

## Don't-words

revolutionary, seamless, unlock, leverage, synergy, "excited to share"

## Voice fingerprint (extracted from samples)

- Sentence rhythm: short, declarative; one idea per sentence.
- Specifics over adjectives; numbers and mechanisms appear often.
- Parentheticals used for qualification, not for jokes.
- Never opens with a bait question.

## Voice samples

Stored verbatim under `02-DOCS/raw/brand/` — see Raw links above.
```

### Raw samples

Paste each user-provided writing sample verbatim into its own `02-DOCS/raw/brand/voice-sample-N.md` with a one-line provenance header:

```markdown
> Source: user-pasted, YYYY-MM-DD, origin: "LinkedIn post about the v2 launch"

<the sample text, unedited>
```

### CLAUDE.md link

Add (or update) this section in the root `CLAUDE.md`. Additive only — never delete existing sections. Create `CLAUDE.md` if absent.

```markdown
## Brand & voice

Marketing and landing copy is grounded in the brand study under
`02-DOCS/wiki/brand/`. Read it before writing any user-facing copy:

- [Positioning](02-DOCS/wiki/brand/index.md)
- [Audience](02-DOCS/wiki/brand/audience.md)
- [Value proposition](02-DOCS/wiki/brand/value-proposition.md)
- [Voice & tone](02-DOCS/wiki/brand/voice.md)
- [Proof](02-DOCS/wiki/brand/proof.md)
- [Offers & CTA](02-DOCS/wiki/brand/offers.md)
- [Channels](02-DOCS/wiki/brand/channels.md)
- [SEO keywords](02-DOCS/wiki/brand/seo.md)

Raw voice samples and inputs: `02-DOCS/raw/brand/`.
The `marketing` skill maintains this study and stops to interview the user
if any dimension is missing.
```

## See Also

- `../SKILL.md` — the runtime grounding mechanism (hard STOP) that uses this checklist.
- `copy-frameworks.md` — turns the value proposition and voice into headlines and copy.
- `harness` — the canonical `02-DOCS` wiki protocol and article templates.
