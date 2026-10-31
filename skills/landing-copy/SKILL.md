---
name: landing-copy
description: "Use when writing the words on a single conversion page — the hero headline and subhead, the offer, the proof and testimonials, and one primary CTA — or diagnosing a page that gets traffic and does not convert, as a copy problem rather than a layout one. NOT the paid ad that drives the click (that is `ads`), NOT the visual layout the words sit in (that is `design`), NOT the experiment that picks the winning variant (that is `ab-testing`)."
tags: [landing-page, copywriting, conversion, hero-headline, cta, social-proof]
recommends: [ads, design, brand-voice, ab-testing, case-studies, offer-design, sales-funnel, vsl-script]
origin: risco
---

# Landing Copy — The Words That Convert on One Page

*Hook, offer, proof, CTA. You write the words a visitor reads top to bottom; you do not draw the layout, build the page, or write the ad that sent them.*

This skill owns **conversion copy for a single page**: a hero headline under ~8 words plus a benefit subhead, a top-to-bottom page skeleton, the offer stated as a benefit, proof slotted next to the ask, and one primary CTA repeated without competing. It is a copy job. The pixels are `design`'s, the React/Next build is `nextjs`'s, the ad that drives the click is `ads`'s.

## When to use

- Writing or rewriting a hero: H1 + subhead + button copy.
- Structuring a full landing/sales page (hook → problem → offer → proof → CTA → objections).
- Choosing and writing one primary CTA and its repeated instances.
- Turning features into benefits ("preview before import" → "inspect exceptions before changing live records").
- Slotting supported proof — demonstrations, permitted testimonials or contextualized metrics — next to the ask.
- Making the page headline *match* the ad/email that drove the click (message match).
- Rescuing a page that gets traffic but does not convert — when the failure is the words.

## When NOT to use (route to the sibling that owns it)

- Visual layout, hierarchy, spacing, component system → `design` (`../design/SKILL.md`).
- Building the page in code, form wiring, routing → `nextjs` (`../nextjs/SKILL.md`) / `react`.
- The paid Google/Meta ad copy that drives traffic *to* the page → `ads`.
- The brand's tone, voice rules, lexicon, do/don't word list → `brand-voice`.
- Ranking in organic search or getting cited by AI answer engines → `seo-geo`.
- Designing and running the experiment that picks the winning variant → `ab-testing`.
- Writing the standalone customer story as its own asset → `case-studies`.
- A multi-channel launch plan, nurture emails, or campaign strategy → `marketing` (`../marketing/SKILL.md`).

Boundary in one line: **you own the words that convert on one page; `ads` owns the click that arrives, `design` owns the layout they sit in, `ab-testing` owns the proof of which words win.**

## When the page carries a sales video

Use the campaign's approved offer revision, research and funnel brief before drafting. When these exist under `02-DOCS/wiki/marketing/<campaign>/`, reuse them; keep established project paths. Read [the VSL page handoff](references/vsl-page-handoff.md) when a video is the main sales argument or its claims differ from the page.

Treat video and page as two ways to understand the same offer. Preserve the same deliverables, price, conditions, evidence IDs and primary action. A visitor who cannot play the video still needs the essential offer and purchase conditions in text. A short introduction can invite playback; it does not replace the written decision path.

- Offer is undecided → `offer-design` owns that decision, not a more forceful headline.
- Multiple pages or booking/payment paths → `sales-funnel` owns the route.
- Spoken narration, pacing and scene cues → `vsl-script` owns the video.
- Unsupported ad/video claim → flag the mismatch and draft from supported facts; repeating the claim does not validate it.

## Establish a baseline before predicting conversion

Use the account's observed traffic, eligible visitors and completed actions when available. Define the conversion and observation window before comparing rates. If no baseline exists, say so and route measurement to `analytics` and experiment design to `ab-testing`. External benchmarks need dated sources and comparable audiences; they are not promised outcomes.

## The four blocks — the spine of the page

Every conversion page is these four jobs, top to bottom. Each has a distinct question, a home on the page, and a failure mode. Diagnose a dead page by finding which block is weak.

| Block | Must answer | Lives where | Failure mode if weak |
| --- | --- | --- | --- |
| **Hook** | "What is this and why should I care?" in <5s | Hero, above the fold | Visitor cannot tell whether to continue |
| **Offer** | "What exactly do I get, and what does it cost me?" | Right after the hook / problem | Feature dump; reader can't tell what they walk away with |
| **Proof** | "Why should I believe you?" | Adjacent to each CTA | Claims read as marketing; trust never forms |
| **CTA** | "What is the one thing to do next?" | Hero, repeated down the page | Competing asks → decision fatigue → no click |

## The hook

The H1 carries the *what*; the subhead carries the *benefit*; both must stay consistent with the supported offer behind the visitor's click.

- **H1 under ~8 words / ~44 characters.** The constraint forces clarity, and a clear headline beats a clever one every time. If you can't say it in 8 words you don't understand the offer yet.
- **Subhead carries the benefit** — who it's for and the outcome they get, in one clause.
- **Message match:** maintain the supported offer and action from the ad/email. If its promise lacks evidence, flag it and draft from verified facts; consistency does not make an unsupported claim true. `ads` owns correction of the source ad.

```text
Bad  — "Reimagine The Future Of Financial Operations"   (clever, 6 words, says nothing)
Good — "Expense reports done in 30 seconds"             (clear, 5 words, names the outcome)
         Subhead: For finance teams drowning in receipts — snap, submit, approved.
```

## The offer

Name the thing, the outcome, and the cost in effort or money. Lead with the outcome the buyer gets, then the mechanism that delivers it. This feature→benefit transform is the highest-impact copy shift on most pages.

The scaffold is **FAB** — Feature → Advantage → Benefit — but you stop at the benefit the reader cares about and back it with the mechanism as proof, not the other way round.

```text
Feature — "Import preview."
Benefit — "Inspect the exceptions before you approve changes to live records."
Evidence — A verified demonstration of the actual preview and approval flow.
```

Rule: every feature line answers "so what?" with an outcome. If it can't, cut it.

## The proof

Choose evidence that supports the claim the visitor is deciding on. A product demonstration can establish behavior; a customer result needs its source, context and permission. A guarantee is a commercial condition, not evidence of effectiveness.

- Use permitted, attributable testimonials when available; there is no required quota of names or numerical results.
- Place relevant proof near the claim or action it supports. Keep its scope clear: one customer result does not establish a typical outcome.
- Without outcome evidence, show verified product behavior and narrow the promise. Mark unresolved evidence in draft notes, not as public endorsements.
- Preserve evidence IDs and publication status from the offer brief. A public review is not automatically cleared for promotional reuse.

## The CTA

One primary action, verb-led, repeated — not varied — down the page.

- **One primary CTA per page.** Competing asks cause decision fatigue and lower conversion. The same action appears in the hero and again at each decision point; secondary links may exist but must not compete visually or verbally with the primary.
- **Movement verbs, never "Submit".** "Start free trial", "Get my quote", "See plans" — the button states the value, not the form action.
- **First-person framing is one option to test:** "Start my free trial" reads as the visitor's own intent. Pair the button with one line of friction-reducing microcopy ("No credit card required").

```text
Bad  buttons — [Submit]            [Learn more]        [Contact sales]
Good buttons — [Start my free trial]  ...repeated...  [Start my free trial]
                under it: No credit card. Cancel anytime.
```

## Frameworks as scaffolds (fill with the reader's words)

These are skeletons to fill with the buyer's actual language, not fill-in templates:

- **PAS** — Problem → Agitate → Solution. Best for pain-aware traffic.
- **AIDA** — Attention → Interest → Desire → Action. Broad top-of-funnel.
- **BAB** — Before → After → Bridge. Transformation stories.
- **FAB** — Feature → Advantage → Benefit. The offer block.

Common stack: **PAS/AIDA hook → FAB offer → proof → CTA.** How much you agitate the problem before the offer depends on traffic temperature (cold needs more, warm goes straight to the offer). Full explanations with fresh examples and the awareness-stage note → `references/frameworks.md`.

## Banned phrases gate (before you deliver)

The project's forbidden phrases are enforced, not suggested. Before handing over copy meant to be
published, write it to a scratch file and run `npx @ericrisco/rsc copy check <file>`. On
`RSC_COPY_VIOLATION`, rewrite and check again. A negation still counts ("this is not X" uses X), so
say what it is instead. When the person states a new ban, record it in
`02-DOCS/wiki/brand/voice-guide.md` under `## Never use`, one phrase per bullet (`word*` also covers
its derivatives). In Claude Code a Stop hook runs the same check on your final answer.

## Anti-patterns → fix

| Rationalization | Reality / Fix |
| --- | --- |
| "A clever headline will stand out" | Clever is unclear. Name the outcome in <8 words; clear beats clever. |
| "More features = more value shown" | Feature dumps bury the benefit. Lead with the outcome, then the mechanism. |
| "Give them several CTAs to choose from" | Choice kills conversion. One primary action, repeated, not varied. |
| "Any testimonials will do" | Use relevant, permitted evidence; a verified demonstration may be the best available proof. |
| "World-class, cutting-edge, game-changing" | Hype words signal AI-template copy. Replace with a number or a named result. |
| "The page can say its own thing" | Keep the supported promise consistent; correct unsupported source claims instead of repeating them. |
| "Promise them a 12% conversion rate" | Use an observed baseline and explicit test; mark performance unmeasured when no data exists. |
| "I'll invent a plausible metric" | Never. Mark `[[NEEDS PROOF]]` and ask the user. |

## Page skeleton + worked example

The annotated top-to-bottom skeleton (hook → problem → offer → proof → CTA → objections/FAQ → final CTA), with a worked demonstration-led example and explicit source limits, lives in `references/page-skeleton.md`. Start there when you write a full page rather than a single block.

## Verify your copy

Run `scripts/verify.sh` over the file you wrote (or your project) before claiming done. It is a read-only, dependency-free static check: H1 length, exactly one primary CTA verb (flags competing asks), presence of a proof block and a benefit subhead, a banlist of hype/AI-tell phrases, and a "Submit" warning. It warns on soft issues and exits non-zero only on hard ones (no CTA, no proof). It detects proof-shaped text, not factual support or publication permission; those require source review. Demonstrations are valid proof markers when their claims match the behavior shown.

## See also

- `../design/SKILL.md` — the pixels: layout, hierarchy, the visual system the words sit in.
- `../nextjs/SKILL.md` — the build: rendering the page in code.
- `../marketing/SKILL.md` — the broader campaign: email sequences, channels, launch arc.
- `ads` — the paid ad copy that drives the click (route here; you only match the page to it).
- `ab-testing` — the experiment that proves which headline/CTA wins.
- `case-studies` · `brand-voice` · `seo-geo` — the proof asset, the voice rules, the search layer.
- References: `references/frameworks.md`, `references/page-skeleton.md`.
