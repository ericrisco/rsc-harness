---
name: design
description: "Use when designing or refreshing a web UI or landing page — visual concept, type/color/spacing/motion tokens, composition, rescuing a UI that reads AI-generic, or a graded design review. Brand-grounded and research-first; ships Tailwind v4 + Next.js 15 under WCAG 2.2 AA and Core Web Vitals budgets. NOT the words on the page (that is `marketing`), NOT the App Router build (that is `nextjs`)."
tags: [design, ux, ui, landing, conversion]
recommends: [design-loop, design-dna, nextjs, marketing]
profiles: [full]
origin: risco
---

# Design — Product UI, Landing Pages & Conversion Copy

**Hand-off — the visual system vs the craft of motion.** This skill owns the visual system and page
composition, and sets motion *intent + budget* only. The **implementation** of an animation is
`../animate/SKILL.md`'s; reviewing motion is `../review-animations/SKILL.md`'s; gesture physics and
translucent materials are `../apple-design/SKILL.md`'s. When a frontend request could belong to
several of those, `../design-eng/SKILL.md` is the umbrella that routes it. The motion reference in
this skill defers its mechanics to them rather than restating them.


*Research the best current work, then ship a premium, accessible, fast, high-converting interface.*

> **SDD gate.** If this fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, hand off to `../specify/SKILL.md` first — it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build straight from here only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

**Hand-offs.** The WORDS are `../marketing/SKILL.md`'s: it co-owns the `02-DOCS/wiki/brand/` study (the words dimensions there, the visual ones here), and deep keyword research, GEO, or a technical SEO audit belongs to it — this skill only enforces SEO-aware *structure* in markup. The BUILD (App Router / React 19) is `../nextjs/SKILL.md`'s. Mirroring the brand tokens into a Flutter app is `../flutter/SKILL.md`'s. Pure backend/data/infra with no UI surface: decline — there is nothing to design. Three references live outside this repo and are named for direction only, not invocable here: *frontend-design-direction* for dense internal tooling used daily (never paint a marketing skin on a tool that needs repeated daily use — fold its judgment in via the DIRECTION BRIEF); *liquid-glass-design* for native iOS 26 SwiftUI Liquid Glass (this skill ships the *web* glass approximation only); *motion-ui* / *motion-foundations* for motion-code mechanics (springs, `AnimatePresence` internals, layout animations — this skill sets motion *intent + budget*).

## Brand grounding — before you design anything

A design with no brand behind it is a guess, and a guess defaults to your AI-generic prior. That is why this gate is a hard stop rather than a warning: **an incomplete brand study blocks the work.**

Follow the harness 02-DOCS convention (brand study = wiki articles under `02-DOCS/wiki/brand/`, raw inputs under `02-DOCS/raw/brand/`, linked from root `CLAUDE.md`):

1. **Locate the brand study.** Read the project root `CLAUDE.md` and look for a `## Brand & voice` section pointing into `02-DOCS/wiki/brand/...`. If present, read those articles.
2. **If the link is MISSING, or the brand study is ABSENT or INCOMPLETE** (any checklist dimension empty), STOP. Do not design yet. Ask the user the targeted question script — **ONE focused batch at a time**, not a wall of questions — until every dimension in the completeness checklist is filled (→ `references/brand-grounding.md`). Write/update the brand study into `02-DOCS/wiki/brand/` (and paste any raw inputs the user gives — screenshots, existing palettes, competitor lists — into `02-DOCS/raw/brand/`), following the wiki article format, update `wiki/index.md` + `wiki/log.md`, and add/update a `## Brand & voice` section in the root `CLAUDE.md` linking to it (create `CLAUDE.md` if absent).
3. **Only once the brand study exists and is sufficient, proceed** — and cite which brand articles drove which decisions in your output (e.g. "palette from `02-DOCS/wiki/brand/visual-identity.md`").

The completeness checklist spans visual identity (OKLCH color system, type pairing & scale, logo, imagery/illustration mood, density, radius/shadow/motion personality), reference/inspiration sites the user loves, layout preferences, dark-mode stance, accessibility & performance constraints, and brand voice/positioning (so copy and design agree). Full checklist + exact question script → `references/brand-grounding.md`.

The order is: **brand grounding → trend research → build.**

## Pick a direction first

Fill the direction brief before you write a single line of markup:

```text
DIRECTION BRIEF (fill before coding)
1. Purpose .......... what job does this interface do, in one sentence?
2. Audience ......... who repeats this workflow; what do they scan first?
3. Tone ............. pick: utilitarian | editorial | playful | industrial | refined | technical | minimal | dense | calm
4. Memorable detail . the ONE idea that makes it feel intentional (not a gradient)
5. Constraints ...... framework, a11y, perf budget, existing design system/tokens
```

Then map the project type to composition, density, and motion budget. Density and composition follow the audience and the job, not a template — a SaaS operations tool should be dense, quiet, and scannable.

| Project type | Composition | Density | Motion budget |
| --- | --- | --- | --- |
| SaaS marketing | Full landing stack, hero→CTA | Generous | Tasteful reveals, hover affordances |
| Dev tool | Show the product/CLI first, then proof | Medium | Subtle, fast (≤200ms) |
| Dashboard / internal tool | Data-first, no hero | Dense, scannable | State-only (loading, success) |
| Portfolio / editorial | Expressive, asymmetric | Airy | Expressive but reduced-motion-safe |
| E-commerce | Product grid, fast PDP | Medium | Micro-interactions on add-to-cart |
| Docs | Sidebar + reading column | Calm, 65ch measure | Near-zero |

## Research-first protocol

Trends churn quarterly and your built-in aesthetic prior is the median of every AI template ever scraped. Never prescribe from stale memory; counter it with a loop:

1. Define 2–3 reference archetypes from the DIRECTION BRIEF (e.g. "Linear-grade dev tool, dark, type-led").
2. WebSearch award galleries and tier-1 product sites: `awwwards.com`, `godly.website`, `land-book.com`, `mobbin.com`, Refactoring UI, and the tier-1 sites (Linear, Stripe, Vercel, Cursor, Resend).
3. WebFetch 3–5 exemplars, prompting each for type, color, layout, motion, and copy voice — concrete details, not adjectives.
4. Extract a pattern table from what they share and where they differ.
5. Synthesize a one-paragraph DESIGN DIRECTION with citations (which URL contributed what).
6. Only THEN build; re-check the result against the references in QA.

Re-research per project — trends churn, competitors moved, and the domain dictates the reference set. Whenever the brand study lacks aesthetic direction or the user asks for "modern" / "2026" / "premium", run this loop, fold the findings into the output **with citations + dates**, and refresh `references/trends-2026.md`. Full loop, source map, and synthesis template → `references/research-method.md`. Current snapshot (dated, cited) → `references/trends-2026.md`.

## From competent to premium (the part that earns the score)

Obeying every constraint gets you to *competent* — a page that ships and passes review. It does NOT get you to premium, because every constraint catches an *absence* (no missing `<h1>`, contrast passes), while premium is a *presence*: a point of view. Competent-but-generic is the default failure mode of under-specified design output. Close it with four deliberate moves, in order, before and during the build:

1. **Choose a visual concept.** One sentence the whole page answers to — `[feeling] + [structural metaphor] for [audience doing job]` (e.g. "quiet instrument-panel precision for ops engineers"). Drawn from the brand study + research exemplars, never your prior. If you cannot name what makes this surface different from the median SaaS page, you have no concept yet, and the output will default to generic.
2. **Manufacture the ONE signature element** the brief asks for — the thing you'd describe first to a friend. Pick exactly one from a real vocabulary, biased by domain: a hero that *demonstrates not describes* (live terminal / real chart / actual diff), an owned type moment, a structural signature (asymmetric split, horizontal feature rail, editorial index), a material signature (hairline grid, one grain pass, duotone), a motion signature, or a real-number/proof signature. Never default to "a gradient". It must be true to the product, and cite the research exemplar that inspired it.
3. **Force scale contrast.** Generic pages are tonally flat — headline, titles, body all within ~1.5×. Make the hero dominant **3–5× the body**, demote eyebrows/labels/metadata smaller and quieter than feels comfortable, and allow **one focal point per viewport**. If a section feels flat, add contrast, not elements.
4. **Give the page rhythm.** Ten identical `py-24` white card-grid sections read as one stripe. Vary format (full-bleed vs. contained, alternate media sides), background (a dark section between light ones anchors a CTA), density (a breathing statement after a dense grid), and container idiom (not everything is a bordered card). Inter-section gap > intra-section gap, padding stepping on the scale.

Then, **before claiming done, run the senior-designer crit** and make at least one concrete change as a result: What is the one idea here (name it in a sentence)? Would this place on Awwwards/Godly or just pass review? What is the single most generic element right now — and replace it. Where does the eye land first, and is that what should win? If the logo were removed, would anyone know whose product this is? Does every section earn its place, or is one there out of habit (cut it)?

Concept formula, signature vocabulary, scale/rhythm rules, the crit, and a worked generic→signature dev-tool hero → `references/signature-and-craft.md`.

## Visual system in 90 seconds

Copy-pasteable foundation. Tokens once, consume everywhere — design tokens, never magic numbers.

- Tailwind v4 `@theme` block (OKLCH): tokens become CSS vars and utilities automatically — no `tailwind.config.js`.
- Type scale via `next/font` (one display + one text face) plus a fluid `clamp()` ladder.
- Spacing, radius, and shadow are tokens too, never inline numbers.
- The rule: arbitrary hex + random px = Bad; token references = Good.

```css
/* Good — Tailwind v4 @theme: OKLCH palette, tokens become CSS vars + utilities */
@import "tailwindcss";
@theme {
  --color-bg:        oklch(0.99 0 0);
  --color-fg:        oklch(0.21 0.01 256);
  --color-muted:     oklch(0.55 0.01 256);
  --color-brand-500: oklch(0.62 0.19 256);
  --color-brand-600: oklch(0.55 0.19 256);
  --font-display:    "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-text:       "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-card:     0.875rem;
  --shadow-card:     0 1px 2px oklch(0 0 0 / 0.06), 0 8px 24px oklch(0 0 0 / 0.08);
  --ease-out:        cubic-bezier(0.22, 1, 0.36, 1);
}
```

```html
<!-- Bad — magic hex + arbitrary px, no system -->
<div style="background:#5b54ff;border-radius:13px;padding:17px">…</div>
<!-- Good — token-driven utilities -->
<div class="bg-brand-500 rounded-card p-4">…</div>
```

Full token system, type scale, OKLCH ramp, bento, glass → `references/visual-system.md`.

## Landing page build recipe ("the brutal landing")

Each section has ONE job. Cut any section that has none.

1. **Hero** — state the value prop; pass the 5s test.
2. **Social-proof strip** — borrow credibility immediately (logos, a hard metric).
3. **Problem / agitation** — name the pain in the reader's words.
4. **Solution** — show the product doing the job.
5. **Features → benefits (bento)** — translate each capability into an outcome.
6. **Objection handling** — preempt the top reason they won't buy.
7. **Pricing** — anchor, highlight one tier, default to annual.
8. **FAQ** — answer the real blockers, not filler.
9. **Final CTA** — one clear action, value on the button.
10. **Footer** — navigation, legal, trust signals.

```tsx
// app/page.tsx — Server Component, LCP-safe hero (Next.js 15 / React 19)
import Image from "next/image";

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 pt-24 text-center">
        <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Ship the change in an afternoon, not a sprint
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-fg/70">
          Concrete benefit, who it is for, and why now — no hype.
        </p>
        <a
          href="#start"
          className="mt-8 inline-flex min-h-11 items-center rounded-card bg-brand-500 px-6 font-medium text-white transition-colors hover:bg-brand-600"
        >
          Start free
        </a>
        <Image
          src="/hero.avif"
          alt="Product dashboard showing a one-click deploy"
          width={1200}
          height={720}
          priority
          className="mt-16 rounded-card shadow-card"
        />
      </section>
    </main>
  );
}
```

Full section-by-section anatomy, CTA cadence, pricing psychology, JSON-LD → `references/landing-anatomy-and-cro.md`.

## Conversion copy in one pass

Copy is benefit-led and specific, or the page has no value prop. One `<h1>` per page; semantic landmarks (`header`/`nav`/`main`/`section`/`footer`).

- The 5s value-prop test: a stranger reads the hero and can say what it is, who it's for, why it's better — legible above the fold in 5 seconds.
- Headline formula slots: outcome + timeframe; "X without Y"; the job-to-be-done.
- Framework picker: PAS for pain-aware cold traffic; AIDA for broad / top-of-funnel; FAB/JTBD for feature → benefit translation.
- CTA: put the value on the button ("Start free", "Get my estimate"), never "Submit".

```text
Bad  — "Revolutionize your workflow with our seamless platform"
Good — "Deploy a fix in 4 minutes — no YAML, no on-call page"
```

Ban: `revolutionary` · `game-changer` · `cutting-edge` · "In today's landscape" · `unlock` · `seamless` · `elevate` · `supercharge` · bait questions · "not X, just Y" · forced lowercase · "Excited to share".

Frameworks, value-prop canvas, Bad→Good rewrites, VOICE block → `references/copywriting-frameworks.md`.

## Motion & interaction budget

- Purposeful-only: motion must guide attention, communicate state, or preserve continuity — else delete it.
- Timing defaults: enter 200–350ms, exit ~150ms, press `scale(0.97)`.
- Never `transition: all` — it animates layout props and janks.
- Compositor-only properties: `transform`, `opacity`, `filter`.
- `prefers-reduced-motion` is required, not optional.
- Scroll-driven via native CSS `animation-timeline: view()` FIRST (no JS, no CLS) before any JS library.

```css
/* Good — native scroll-driven reveal, zero JS, explicit @supports fallback */
.reveal { opacity: 1; } /* default visible: no scroll-timeline support => never hidden */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    .reveal {
      animation: reveal linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 30%;
    }
  }
}
@keyframes reveal {
  from { opacity: 0; translate: 0 16px; }
  to   { opacity: 1; translate: 0 0; }
}
```

Timing tokens, micro-interactions, scroll/parallax, when to escalate to motion/react → `references/motion-and-interaction.md`.

## Premium details that compound

Small things, applied consistently, are what reads as "designed".

| Detail | Bad | Good |
| --- | --- | --- |
| Nested radius | Same radius parent + child | `outer = inner + padding` (concentric) |
| Shadows | One hard `0 4px 8px #000` | Layered transparent OKLCH shadows |
| Separation | Heavy drop shadow everywhere | Hairline 1px border first, shadow only for lift |
| Headings | Ragged wrap | `text-wrap: balance` |
| Body / captions | Orphan last word | `text-wrap: pretty` |
| Numbers/prices | Width jitters | `font-variant-numeric: tabular-nums` |
| Images | Edge blurs into bg | 1px neutral `outline`, `outline-offset: -1px` |
| Glass | `backdrop-blur` on everything | Blur + 1px hairline + subtle noise, sparingly |

```css
html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
img  { outline: 1px solid oklch(0 0 0 / 0.1); outline-offset: -1px; }
.price { font-variant-numeric: tabular-nums; }
```

Depth recipes, glass, noise, concentric math → `references/visual-system.md`.

## The three locks, and who checks them

A long page generated in passes drifts against itself. Three things must be **one** thing for
the whole page, and they are not preferences — a page that breaks one of them is defective:

1. **Theme lock.** One theme for the page (light, dark, or auto). No section flipping to
   inverted halfway down because it looked good alone.
2. **Accent lock.** One accent, used identically in every section. **This one is judgement**:
   deciding which token is the accent needs to read the system's intent, so no script claims
   to check it — you do, before you claim done.
3. **Radius lock.** One radius system. Four different `rounded-*` scales in one tree means
   there is no system, and `scripts/verify.sh` counts them.

## The tells the script owns, and the ones you own

`scripts/verify.sh` carries a **registry of mechanical tells** and reports each with file and
line: dashes in rendered copy, scroll cues, numbered eyebrows, build stamps on marketing
pages, unstable viewport heights, middot chains, hype words, plus counted ratios (eyebrows
against sections, double-bordered rows, radius scales). Run it; do not re-derive that list
from memory, and do not treat its silence as a design review.

What it cannot see is the other half: fabricated substance (a product UI built from divs,
invented photo credits, the Jane Doe cast), decoration posing as information, labels that say
nothing, and composition habits like three identical feature cards. That half is
`references/ai-tells.md`, and it is read with your eyes on the page.

When the brief corresponds to an official, maintained design system rather than an aesthetic —
UK or US public sector, Shopify admin, Carbon, Atlassian, Primer, Fluent — install the
official package instead of approximating it: `references/design-systems.md`.

## Anti-patterns

| Rationalization | Reality / Fix |
| --- | --- |
| "Purple→blue gradient on everything looks modern" | It reads AI-generic. Pick a domain-true palette; gradients are seasoning. |
| "Centered text over an atmospheric gradient is a hero" | Show the product. Vague hero fails the 5s test. |
| "Cards inside cards add structure" | They add noise. Flatten; use spacing + one border. |
| "I know good design, I'll skip research" | Taste ≠ current trend. Re-research every project. |
| "The image sells it, copy can be vague" | Copy carries the value prop. Pass the 5s test. |
| "Animate everything on scroll" | CLS + INP cost. Reveal sparingly, transform/opacity only. |
| "Ship now, check contrast later" | Contrast is a constraint, not polish. 4.5:1 or it ships broken. |
| "Glass everywhere looks premium" | Glass on everything looks cheap. Reserve for floating surfaces. |
| "`transition: all` is convenient" | It animates layout props → jank. List exact properties. |

## Quick reference

Accessibility and Core Web Vitals are **design constraints, not post-launch tuning** — violating one is a defect, not a style choice. **WCAG 2.2 AA:** 4.5:1 text contrast (3:1 large text / UI), visible focus, `prefers-reduced-motion` honored. Target size: 24×24px is the AA floor (SC 2.5.8 Target Size (Minimum)); 44×44px is the recommended quality bar (Apple HIG / pointer comfort) — aim for 44, never ship below 24. **Core Web Vitals:** LCP < 2.5s, INP < 200ms, CLS < 0.1. (INP replaced FID in March 2024 — measure INP.)

| Lever | Default | Token / where |
| --- | --- | --- |
| Type scale ratio | 1.25 | modular scale |
| Body size | 16–18px | `--font-text` |
| Line-height | 1.5 body / 1.1 display | per element |
| Spacing base | 4 / 8px | Tailwind spacing |
| Color allocation | 60-30-10 | bg / fg / brand |
| Text contrast | ≥ 4.5:1 (3:1 large) | verify with checker |
| Card radius | 0.875rem | `--radius-card` |
| Touch target | 44×44px recommended; 24×24px AA floor (SC 2.5.8) | `min-h-11` |
| Enter / exit motion | 250ms / 150ms | `--ease-out` |
| LCP | < 2.5s | `next/image priority` |
| INP | < 200ms | compositor-only motion |
| CLS | < 0.1 | reserved space, `next/font` |
| Hero | passes 5s test | value prop above fold |

## Design-review QA checklist

Run before claiming done. Same checks `scripts/verify.sh` falls back to.

- [ ] Value prop legible in 5 seconds above the fold.
- [ ] Text contrast ≥ 4.5:1 (3:1 for large text / UI).
- [ ] Visible focus state on all interactive elements.
- [ ] Touch targets 44×44px (recommended); never below the 24×24px WCAG 2.2 AA floor (SC 2.5.8).
- [ ] `prefers-reduced-motion` honored.
- [ ] Exactly one `<h1>` on the page.
- [ ] Semantic landmarks present (`header`/`nav`/`main`/`section`/`footer`).
- [ ] LCP image has `priority`.
- [ ] Fonts use `next/font` (no CLS / FOUT swap shift).
- [ ] No `transition: all` / `transition-all`.
- [ ] Tokens used (no magic hex / px).
- [ ] Ban-list words absent from copy.
- [ ] Text fits at 360px and desktop without overflow.
- [ ] Empty / loading / hover / error states designed.

Automate → `scripts/verify.sh` (runs Lighthouse if a dev server is up, else static grep checks + this list).

### Optional: graded visual-audit rubric (0–10)

The checklist above is pass/fail. When the user asks for a *design review*, a *critique*, or a quality grade — or when you want to argue a surface is genuinely premium rather than merely compliant — score these 11 dimensions 0–10 and report the weighted total. Pass/fail tells you it ships; the rubric tells you how good it is.

| # | Dimension | What a 10 looks like | Weight |
| --- | --- | --- | --- |
| 1 | First impression & value clarity | Passes the 5s test instantly; product shown, not a gradient | 1.5 |
| 2 | Concept & signature | A nameable visual concept; one distinctive, domain-true signature element; logo-removed it's still recognizably this product, not a template | 1.5 |
| 3 | Typographic craft | Modular scale, ≤2 families, balanced headings, 45–75ch measure, tabular numerals; deliberate 3–5× scale contrast | 1.0 |
| 4 | Color & contrast | Disciplined 60-30-10 OKLCH system, all text ≥ 4.5:1, dark mode via token swap | 1.0 |
| 5 | Layout, spacing & rhythm | Consistent 4/8px scale, intentional asymmetry/bento, clear focal point; sections vary in format/background/density, not one repeated stripe | 1.0 |
| 6 | Hierarchy & scannability | Eye lands in the right order; one primary action per viewport | 1.0 |
| 7 | Depth & detail polish | Concentric radius, layered shadows, hairline borders, restrained glass | 1.0 |
| 8 | Motion quality | Purposeful only, compositor-only props, reduced-motion + `@supports` guards | 1.0 |
| 9 | Accessibility | Landmarks, one `<h1>`, visible focus, 24px+ targets (44 ideal), no motion-only meaning | 1.0 |
| 10 | Performance (CWV) | LCP < 2.5s, INP < 200ms, CLS < 0.1; LCP image `priority`, `next/font` | 1.0 |
| 11 | Copy & brand fidelity | Benefit-led, specific, ban-list clean, voice matches the `02-DOCS/wiki/brand/` study | 0.5 |

Score = Σ(dimension × weight), max 115 (normalize to /100 by ×100/115 if you want a percentage). **Bands (on the /115 raw total):** < 69 ships generic — redo; 69–91 competent but improvable — name the lowest two and fix; 92–108 premium; 109+ award-tier. (These are the prior 60/80/95-per-100 cutoffs rescaled to 115.) A surface that scores well on every constraint dimension but low on #1–2 is the classic "competent but generic" result — fix concept and signature first, it has the most leverage. For each dimension below 8, give one concrete, actionable fix (not "improve spacing" but "section padding jumps 48→96px with no 64px step — add `py-16` on mobile"). Cite the brand article or trend source that sets the bar where relevant.

## Recording the decisions (02-DOCS)

Two records, both indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it), both read first on every use so outputs stay consistent with them:

- The **brand study** at `02-DOCS/wiki/brand/` — the hard gate above: missing or incomplete → ask until complete before designing.
- The **design-system decisions** at `02-DOCS/wiki/stack/design.md` — the chosen tokens (color/OKLCH, type scale, spacing, radius, shadow, motion), the 2026 direction picked, and the reference sites. Recorded, not gated; create/update it as decisions are made. **Read it before fixing type and palette on a new surface**, and either reuse what is there or state why you are departing — otherwise every surface of the project drifts into a different design. (Across *different* projects this record cannot help: it lives inside each one. Distrusting your own second default is the only guard there — see the repetition note in `references/ai-tells.md`.)

The wiki article protocol both follow is `../harness/SKILL.md`'s.
