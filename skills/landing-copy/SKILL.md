---
name: landing-copy
description: "Use when writing the words on a single conversion page — the hero headline and subhead, the offer, the proof and testimonials, and one primary CTA — or diagnosing a page that gets traffic and does not convert, as a copy problem rather than a layout one. NOT the paid ad that drives the click (that is `ads`), NOT the visual layout the words sit in (that is `design`), NOT the experiment that picks the winning variant (that is `ab-testing`)."
tags: [landing-page, copywriting, conversion, hero-headline, cta, social-proof]
recommends: [ads, design, brand-voice, ab-testing, case-studies]
origin: risco
---

# Landing Copy — The Words That Convert on One Page

*Hook, offer, proof, CTA. You write the words a visitor reads top to bottom; you do not draw the layout, build the page, or write the ad that sent them.*

This skill owns **conversion copy for a single page**: a hero headline under ~8 words plus a benefit subhead, a top-to-bottom page skeleton, the offer stated as a benefit, proof slotted next to the ask, and one primary CTA repeated without competing. It is a copy job. The pixels are `design`'s, the React/Next build is `nextjs`'s, the ad that drives the click is `ads`'s.

## When to use

- Writing or rewriting a hero: H1 + subhead + button copy.
- Structuring a full landing/sales page (hook → problem → offer → proof → CTA → objections).
- Choosing and writing one primary CTA and its repeated instances.
- Turning features into benefits ("AES-256 encryption" → "your security team signs off in days").
- Slotting proof — testimonials, metrics, logos, a guarantee — next to the ask.
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

## The conversion reality (calibrate, never promise)

These numbers set expectations. State them as a band; the moment you promise a flat conversion rate you are lying to the user.

- **Cross-industry median is ~6.6%; strong pages in any vertical reach 10–15%+.** Per-vertical the spread is wide: Events & Entertainment ~12.3%, Financial Services ~8.4%, SaaS/Tech ~3.8%, Ecommerce ~2.35%, B2B services ~1–3%. *Why:* a SaaS team told "you'll hit 12%" was quoted the events median; quote the band for *their* vertical so the goal is real. (Foundry CRO benchmarks 2026, citing Unbounce's analysis of 464M visits / 41k pages.)
- **Visitors decide whether to stay in ~5 seconds, and ~80% rarely scroll past the fold.** *Why:* the hero is the single highest-leverage copy on the page — if it does not answer "what is this and why should I care" before a scroll, the rest is unread. (Hero-section research / NN/g attention studies 2026.)

## The four blocks — the spine of the page

Every conversion page is these four jobs, top to bottom. Each has a distinct question, a home on the page, and a failure mode. Diagnose a dead page by finding which block is weak.

| Block | Must answer | Lives where | Failure mode if weak |
| --- | --- | --- | --- |
| **Hook** | "What is this and why should I care?" in <5s | Hero, above the fold | Visitor bounces before scrolling; ~80% never see the rest |
| **Offer** | "What exactly do I get, and what does it cost me?" | Right after the hook / problem | Feature dump; reader can't tell what they walk away with |
| **Proof** | "Why should I believe you?" | Adjacent to each CTA | Claims read as marketing; trust never forms |
| **CTA** | "What is the one thing to do next?" | Hero, repeated down the page | Competing asks → decision fatigue → no click |

## The hook

The H1 carries the *what*; the subhead carries the *benefit*; both must echo whatever the visitor clicked.

- **H1 under ~8 words / ~44 characters.** The constraint forces clarity, and a clear headline beats a clever one every time. If you can't say it in 8 words you don't understand the offer yet.
- **Subhead carries the benefit** — who it's for and the outcome they get, in one clause.
- **Message match:** the headline must echo the promise of the ad/email that drove the click. Aligning a single claim across ad + page has produced a 66% CVR lift in documented cases (and 212% from fixing message match alone). *You match the page to the ad; writing the ad is `ads`.*

```text
Bad  — "Reimagine The Future Of Financial Operations"   (clever, 6 words, says nothing)
Good — "Expense reports done in 30 seconds"             (clear, 5 words, names the outcome)
         Subhead: For finance teams drowning in receipts — snap, submit, approved.
```

## The offer

Name the thing, the outcome, and the cost in effort or money. Lead with the outcome the buyer gets, then the mechanism that delivers it. This feature→benefit transform is the highest-impact copy shift on most pages.

The scaffold is **FAB** — Feature → Advantage → Benefit — but you stop at the benefit the reader cares about and back it with the mechanism as proof, not the other way round.

```text
Bad  — "Our platform has advanced AES-256 encryption."
Good — "Protect customer data with AES-256 encryption, so your security team
         signs off in days, not months."
```

Rule: every feature line answers "so what?" with an outcome. If it can't, cut it.

## The proof

Belief is built next to the ask, not in a wall of quotes elsewhere.

- **3–5 specific, named testimonials, each with a concrete result.** "Great product!" persuades no one; "cut our close time from 9 days to 2 — Maria, CFO at Lumen" does. Specific beats superlative.
- **Place proof adjacent to the primary CTA.** Social proof next to the ask has lifted conversion ~68% in documented cases; reviews/testimonials are decisive for ~93% of buyers and ~88% trust them like a personal recommendation. *Why:* belief and the decision happen in the same moment — put the evidence where the click is.
- Numbers, recognizable logos, and a risk-reversal (money-back, no card required) are proof too. One hard number outweighs three adjectives.
- **Never fabricate proof.** If a metric, quote, or logo isn't real, mark `[[NEEDS PROOF]]` and ask the user — do not invent it.

```text
Bad  — "Loved by teams everywhere. World-class results!"
Good — "We cut expense-report time 82% in the first month."
         — Maria Ortiz, CFO, Lumen (47-person finance team)
```

## The CTA

One primary action, verb-led, repeated — not varied — down the page.

- **One primary CTA per page.** Competing asks cause decision fatigue and lower conversion. The same action appears in the hero and again at each decision point; secondary links may exist but must not compete visually or verbally with the primary.
- **Movement verbs, never "Submit".** "Start free trial", "Get my quote", "See plans" — the button states the value, not the form action.
- **First-person framing often lifts clicks:** "Start my free trial" reads as the visitor's own intent. Pair the button with one line of friction-reducing microcopy ("No credit card required").

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

## Anti-patterns → fix

| Rationalization | Reality / Fix |
| --- | --- |
| "A clever headline will stand out" | Clever is unclear. Name the outcome in <8 words; clear beats clever. |
| "More features = more value shown" | Feature dumps bury the benefit. Lead with the outcome, then the mechanism. |
| "Give them several CTAs to choose from" | Choice kills conversion. One primary action, repeated, not varied. |
| "Any testimonials will do" | Generic raves don't persuade. 3–5 named quotes with a hard result, near the CTA. |
| "World-class, cutting-edge, game-changing" | Hype words signal AI-template copy. Replace with a number or a named result. |
| "The page can say its own thing" | If the headline ignores the ad's promise, you lose the message-match lift. Echo the click. |
| "Promise them a 12% conversion rate" | Never promise a flat number. Quote the band for their vertical. |
| "I'll invent a plausible metric" | Never. Mark `[[NEEDS PROOF]]` and ask the user. |

## Page skeleton + worked example

The annotated top-to-bottom skeleton (hook → problem → offer → proof → CTA → objections/FAQ → final CTA), with one fully worked B2B SaaS example and the variable slots marked, lives in `references/page-skeleton.md`. Start there when you write a full page rather than a single block.

## Verify your copy

Run `scripts/verify.sh` over the file you wrote (or your project) before claiming done. It is a read-only, dependency-free static check: H1 length, exactly one primary CTA verb (flags competing asks), presence of a proof block and a benefit subhead, a banlist of hype/AI-tell phrases, and a "Submit" warning. It warns on soft issues and exits non-zero only on hard ones (no CTA, no proof). It is a backstop, not the judgement — the four-block table is.

## See also

- `../design/SKILL.md` — the pixels: layout, hierarchy, the visual system the words sit in.
- `../nextjs/SKILL.md` — the build: rendering the page in code.
- `../marketing/SKILL.md` — the broader campaign: email sequences, channels, launch arc.
- `ads` — the paid ad copy that drives the click (route here; you only match the page to it).
- `ab-testing` — the experiment that proves which headline/CTA wins.
- `case-studies` · `brand-voice` · `seo-geo` — the proof asset, the voice rules, the search layer.
- References: `references/frameworks.md`, `references/page-skeleton.md`.
