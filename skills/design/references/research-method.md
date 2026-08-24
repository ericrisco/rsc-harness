# Research-First Design Method

The engine that keeps design output current and non-generic. Run it before you prescribe type, color, layout, or copy — every time.

## Why re-research every project

- **Trends churn quarterly.** What read as premium 18 months ago (neumorphism, heavy glassmorphism, blob backgrounds) now reads as dated. The reference set has a short half-life.
- **Model taste skews to the AI-template median.** Your built-in aesthetic prior is the average of every scraped landing page — purple→blue gradients, centered hero over atmospheric mesh, oversized cards. That average is the slop you must escape.
- **Competitors moved.** The benchmark is the current best work in *this* domain, not last year's. A dev tool that looked sharp against 2024 peers looks soft against 2026 peers.
- **The domain dictates the reference set.** A fintech dashboard, a developer CLI, and a DTC skincare store have nothing in common. Pull references from the right neighborhood, not a generic "good design" bucket.

Your built-in aesthetic prior is the problem this protocol fixes. Treat your first instinct as a hypothesis to be corrected by evidence, not as the answer.

## The loop

1. **Define 2–3 reference archetypes** from the DIRECTION BRIEF in `../SKILL.md`. Name them concretely: "Linear-grade dev tool, dark, type-led" beats "modern SaaS".
2. **WebSearch award galleries + tier-1 product sites.** Query the galleries by domain and year; query named competitors by page.
3. **WebFetch 3–5 exemplars,** prompting each for type, color, layout, motion, and copy voice. Demand concrete values, not adjectives.
4. **Extract a pattern table** — the shared moves (what every exemplar does) and the differentiators (where they diverge). Shared moves are table stakes; differentiators are where you choose.
5. **Synthesize a one-paragraph DESIGN DIRECTION** with citations: which URL contributed which decision.
6. **Build** against the direction.
7. **Re-check against references in QA** — open the exemplars side by side and confirm you matched the bar (density, type, motion restraint), not the pixels.

```text
WebSearch: "best <domain> landing page 2026 site:awwwards.com OR site:godly.website"
WebSearch: "<competitor> pricing page design"
WebFetch(url, "Extract: typeface pairing, color palette (approx OKLCH/hex),
  layout system (grid/bento/asymmetry), motion (what animates, on what trigger),
  hero copy voice. List concrete details, not adjectives.")
```

If WebSearch/WebFetch tools are unavailable in the current run, state that explicitly to the user, fall back to your strongest current knowledge of the named tier-1 sites, and flag the output as un-verified so it can be re-checked.

### What to extract per exemplar

Force every fetch to produce concrete, comparable data. Vague notes ("clean", "modern") are useless; you cannot build from an adjective.

| Field | Capture | Example |
| --- | --- | --- |
| Typeface pairing | display + text faces, weights | Geist Semibold / Inter Regular |
| Type scale | base size + ratio | 16px base, ~1.25 ratio |
| Palette | bg / fg / accent in OKLCH or hex | near-black bg, single blue accent |
| Layout | grid system, max-width, measure | centered hero, bento below, 1024px |
| Motion | what animates, on what trigger, duration | bento cells reveal on scroll, ~280ms |
| Copy voice | sentence length, hype level, verbs | short, no hype, imperative |
| Hero structure | what is shown above the fold | terminal recording + one CTA |

### Time-box the loop

Research is a means, not the deliverable. Spend ~15–25 minutes: 3–5 exemplars, one pattern table, one synthesis paragraph. If you are still browsing after 30 minutes you are procrastinating the build — commit to a direction and start.

## Source map

| Source | Mine for |
| --- | --- |
| awwwards.com | Bold direction, motion, art direction |
| godly.website | Current premium web aesthetics |
| land-book.com | Landing-page structure + section order |
| mobbin.com | Real app UI flows and patterns |
| Refactoring UI | Spacing, hierarchy, color rules |
| Linear | Restraint, dark UI, dense product surfaces |
| Stripe | Docs + marketing balance, gradients done right |
| Vercel | Type-led minimalism, dev-tool voice |
| Cursor / Resend | Dev-tool landing conventions |

Pick sources by domain. For a developer tool, weight Linear / Vercel / Cursor / Resend heavily and skip the expressive Awwwards entries. For an editorial or portfolio piece, invert that weighting.

## Synthesis template

Fill this block before writing markup. It is the contract the build must satisfy and the artifact QA checks against.

```text
DESIGN DIRECTION
Archetype ...... <e.g. "Linear-grade dev tool, dark, type-led">
Type pairing ... display=<face> / text=<face>, scale ratio <1.25>
Palette ........ bg/fg/brand/accent in OKLCH (list values)
Layout ......... <12-col | bento | asymmetric editorial>, max-width <px>, measure <ch>
Motion budget .. <reveals on entry only | none | expressive>, timings
Copy voice ..... <direct/compressed | warm | technical>; one-line value prop
Citations ...... <url 1>, <url 2>, <url 3>  (what each contributed)
```

## Worked example

Brief: a developer-tool landing page for **Driftway**, a fictional CLI that deploys preview environments from a Git branch in one command. Audience: backend and platform engineers. Tone: technical, dense, quiet.

References fetched and what each contributed:

- `https://linear.app` — dark, near-monochrome surface; tight type with a single accent; restraint as the whole aesthetic.
- `https://vercel.com` — type-led hero with the product (a terminal) shown immediately; minimal motion; high-contrast mono code blocks.
- `https://resend.com` — dev-tool voice in copy (verbs, no hype); a clean bento for feature → benefit; annual-default pricing.

Extracted pattern table:

| Dimension | Shared move | Differentiator chosen |
| --- | --- | --- |
| Type | One sans display + mono for code | Geist display, Geist Mono for CLI snippets |
| Color | Dark bg, one cool accent | bg near-black, single blue brand accent |
| Layout | Hero shows the product, then bento proof | Terminal recording as the hero visual |
| Motion | Subtle entry reveals only | Scroll-reveal on bento cells, ≤ 280ms |
| Copy | Outcome + "no X" phrasing | "Preview every branch — no staging queue" |

Resulting filled direction (token values match the `@theme` block in `visual-system.md`):

```text
DESIGN DIRECTION
Archetype ...... Linear-grade dev tool, dark, type-led, terminal-forward
Type pairing ... display=Geist / text=Inter (mono=Geist Mono for code), scale ratio 1.25
Palette ........ bg=oklch(0.17 0.01 256) fg=oklch(0.96 0.01 256)
                 brand=oklch(0.62 0.19 256) accent=oklch(0.78 0.13 256)
Layout ......... asymmetric bento under a centered hero, max-width 1024px, measure 65ch
Motion budget .. entry reveals only via animation-timeline: view(), enter 280ms / exit 150ms
Copy voice ..... direct, compressed, technical; value prop = "Preview every branch — no staging queue"
Citations ...... linear.app (restraint + dark surface), vercel.com (product-forward hero),
                 resend.com (dev voice + bento + annual pricing)
```

That direction now drives `visual-system.md` (tokens), `landing-anatomy-and-cro.md` (section order), and `copywriting-frameworks.md` (voice) with zero guesswork.

## Anti-pattern

Copying a reference pixel-for-pixel reproduces someone else's product constraints, not yours — and it shows. Extract *principles* (restraint, product-forward hero, one accent) and re-derive the specifics for your domain.

```text
Bad  — Clone Linear's exact gradient, spacing, and copy onto a skincare store.
Good — Take Linear's PRINCIPLE (radical restraint, one accent, product-forward)
       and re-derive a warm, editorial skincare palette + layout from it.
```

A second failure mode is **research theater**: fetching five sites, then ignoring them and building your default gradient hero anyway. The synthesis paragraph and its citations are the guardrail — if the built page does not visibly trace back to a cited decision, the research did not happen. In QA, open the exemplars beside the result and confirm each major decision (type, palette, layout, motion restraint) has a source.

## Feeding the result into the build

The filled DESIGN DIRECTION block is not a document for humans; it is the input to the rest of the skill:

- **Palette + type + radius + shadow** → become the `@theme` tokens in `visual-system.md`. Do not invent new values at build time; promote the direction's values into tokens verbatim.
- **Layout + section order** → drive the section stack in `landing-anatomy-and-cro.md`. The archetype decides whether you lead with a product shot (dev tool) or an editorial headline (portfolio).
- **Copy voice + value prop** → seed the VOICE block and headline work in `copywriting-frameworks.md`.
- **Motion budget** → sets the timing tokens and the reveal-or-not decision in `motion-and-interaction.md`.

When the direction changes mid-project (new competitor, pivot), re-run the loop rather than patching the old tokens — a stale direction silently reintroduces the generic default you escaped.

## See Also

- `visual-system.md` — turn the filled direction into tokens.
- `../../nextjs/SKILL.md` — implement the chosen direction on the App Router stack.
- *frontend-design-direction* — product-domain direction judgment (external reference, not a repo skill).

## Where to look

`inspiration-sources.md` is the dated registry of where to browse: whole pages to beat, SaaS and
conversion surfaces, real product flows (Mobbin, Page Flows — the bucket most people skip), single
patterns like footers and empty states, and the design systems that are specification rather than
inspiration. Extract principles, not pixels, and come back with a named page rather than a gallery.
