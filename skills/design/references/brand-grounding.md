# Brand Grounding — Checklist, Question Script & Persistence (visual)

The brand study is the source of truth every design decision is grounded in. This file holds the **completeness checklist** (the visual/design dimensions a brand study must cover before you paint a single pixel), the **question script** (how to interview the user, batched), and the **persistence format** (how to write it into `02-DOCS` and link it from `CLAUDE.md`). The runtime mechanism that invokes this — the hard STOP on an incomplete study — lives in `SKILL.md` under "Brand grounding (read this first)".

This skill **co-owns the brand study with the `marketing` skill**. Marketing owns the *words* dimensions (positioning, audience, value prop, voice & tone, proof, offers, channels, SEO/GEO keywords — see `../../marketing/references/brand-grounding.md`). Design owns the *visual* dimensions below. They write into the **same** `02-DOCS/wiki/brand/` study and the **same** `## Brand & voice` section of root `CLAUDE.md` — never a parallel copy. If marketing already created the study, extend it with the visual articles; do not duplicate the words articles.

## Where the brand study lives

Following the `harness` Karpathy-wiki convention (compiled articles in `wiki/`, immutable raw inputs in `raw/`):

```text
02-DOCS/
├── raw/brand/             ← immutable: pasted inputs (screenshots, palettes, competitor lists, mood refs)
│   ├── inspiration-linear.png
│   ├── existing-palette.txt
│   └── …
└── wiki/brand/            ← compiled brand study, one article per dimension
    ├── index.md             ← positioning one-liner + links to every dimension article
    ├── visual-identity.md   ← color (OKLCH), type pairing & scale, logo, radius/shadow/motion personality  [DESIGN]
    ├── imagery.md           ← photography vs illustration mood, iconography, texture/grain  [DESIGN]
    ├── layout.md            ← density, composition, dark-mode stance, reference/inspiration sites  [DESIGN]
    ├── constraints.md       ← accessibility level, performance budget, existing design system/tokens  [DESIGN]
    ├── audience.md          ← ICP, pains, desires  [MARKETING]
    ├── value-proposition.md ← value prop, differentiation  [MARKETING]
    ├── voice.md             ← tone, do/don't word lists, voice samples  [MARKETING]
    ├── proof.md             ← credibility, metrics, customers  [MARKETING]
    ├── offers.md            ← offers + primary/secondary CTA  [MARKETING]
    ├── channels.md          ← active channels  [MARKETING]
    └── seo.md               ← target keywords  [MARKETING]
```

Small projects may collapse the visual dimensions into one `visual-identity.md` with each dimension as a `##` heading — but every dimension below must still be present and filled.

## Completeness checklist (visual dimensions)

The visual side of the study is **COMPLETE** only when every dimension below is filled with real, specific content. Any empty, placeholder, or "TBD" dimension = **INCOMPLETE** = hard STOP, interview the user. (The words dimensions are checked by `marketing/references/brand-grounding.md`; design needs the voice/positioning articles present so copy and design agree, but design only *interviews* for the visual gaps.)

- [ ] **V1. Color system** — brand hue(s) and neutrals expressed (or convertible) to OKLCH; a target ramp (50→900); the accent's role; the 60-30-10 intent. Capture any existing hex/brand colors so they can be converted to OKLCH tokens (OKLCH is the source of truth; sRGB hex is an approximation — see `visual-system.md`).
- [ ] **V2. Typography** — display face + text face (and mono if code is shown), or a single superfamily with weight contrast; the modular scale ratio (e.g. 1.25); any licensed/owned fonts the brand must use. Never three+ families.
- [ ] **V3. Logo & wordmark** — does one exist? light/dark variants, clear-space, min size, and whether a favicon/app icon is needed. If absent, note it as a gap (`[[NEEDS ASSET]]`) — never invent a logo silently.
- [ ] **V4. Imagery & illustration mood** — photography vs 3D vs illustration vs abstract; realistic vs stylized; iconography style (line vs filled, corner radius); texture/grain/noise stance. This sets whether the hero shows a product screenshot, a render, or an editorial image.
- [ ] **V5. Density & personality** — how the surface should *feel*: airy/editorial vs dense/utilitarian; the radius personality (sharp 0–4px vs soft 12px+); shadow personality (flat vs layered elevation); motion personality (still/quiet vs expressive). These become token values.
- [ ] **V6. Reference / inspiration sites** — 2–5 sites the user loves and *why* (e.g. "Linear for restraint", "Stripe for gradients done right"). These anchor the research-first protocol's archetypes; without them you research blind.
- [ ] **V7. Layout preferences** — composition leanings (centered hero vs asymmetric/bento vs editorial), max-width feel, any required sections or a sitemap, mobile-first vs desktop-first emphasis.
- [ ] **V8. Dark-mode stance** — light-only, dark-only, or both with a token-swap; if both, which is the default. (Dark mode via semantic token swap, not per-component overrides — see `visual-system.md`.)
- [ ] **V9. Accessibility & performance constraints** — target conformance (WCAG 2.2 AA is the floor here; AAA if mandated); Core Web Vitals budget (LCP/INP/CLS); locales/RTL; reduced-motion seriousness; any device/bandwidth constraints.
- [ ] **V10. Existing design system / tokens** — is there a Tailwind `@theme`, a `tokens.json`, a Figma library, or component kit to extend? Reusing the system beats inventing a parallel one.
- [ ] **V11. Voice & positioning present (cross-check)** — the marketing-owned `voice.md` and `value-proposition.md` articles exist and are filled, so copy and design agree. If absent, hand off to the `marketing` sibling skill (or interview for them too) — a premium surface with off-voice copy is not premium.

## Question script (ask in batches, never all at once)

Ask **one batch at a time**. Send the batch, wait for the answer, persist what you learned, then send the next batch. Skip questions a located-but-incomplete study already answers — only fill the gaps. Stop interviewing the moment every dimension is complete.

### Batch 1 — references & feel

```text
1. Show me 2–5 sites or apps whose look you love — and for each, what specifically (the
   restraint, the type, the color, the motion)? Paste links or screenshots.
2. In three words, how should this feel? (e.g. calm/editorial, dense/technical,
   playful/vivid, refined/luxury)
3. Airy or dense? Should it breathe with whitespace, or pack information tightly?
4. Light mode, dark mode, or both? If both, which is the default?
```

### Batch 2 — color & type

```text
5. Do you have brand colors already? Paste any hex/RGB values, a palette, or a brand guide —
   I'll convert them to an OKLCH token ramp (I'll save the raw input under 02-DOCS/raw/brand/).
6. If not: pick a brand hue direction (cool/blue, warm/orange, green, violet, near-neutral)
   and how saturated it should read (muted vs vivid).
7. Any required or owned fonts? If not, do you lean geometric-sans, humanist-sans, serif/
   editorial, or mono-forward (dev tool)?
8. How loud should the type be — understated, or oversized expressive headlines?
```

### Batch 3 — assets, imagery & layout

```text
9. Is there a logo/wordmark? Send light + dark versions if you have them. Need a favicon/app icon?
10. What imagery direction — product screenshots, photography, 3D renders, illustration, or
    abstract? Realistic or stylized? Any reference for the icon style?
11. Radius/shadow/motion personality: sharp & flat, or soft & elevated? Still & quiet, or
    expressive motion? (I'll bake these into tokens.)
12. Any must-have sections or a required sitemap? Centered hero or asymmetric/bento?
```

### Batch 4 — constraints & system

```text
13. Accessibility target — is WCAG 2.2 AA enough, or is AAA / a specific standard mandated?
    Any RTL/locale needs?
14. Performance budget or device constraints I should design within? (slow networks, low-end
    devices, a hard LCP target?)
15. Is there an existing design system, Tailwind @theme, tokens.json, or Figma library to
    extend rather than replace?
```

If the user can't answer a question, that dimension stays incomplete — note the gap, keep the STOP in place for that dimension, and offer to propose a researched default they can confirm, rather than silently defaulting to your generic prior. **How to actually propose one: `starting-point.md`.** It is the difference between offering something and improvising something: what the project already owns is checked first, the value comes from a reference you opened and measured, and it is written marked `propuesto`. A proposed-and-unconfirmed dimension does **not** count as complete against the checklist above — the STOP stays up until the user confirms it.

## Persistence format

### Visual-identity wiki article template

Each `02-DOCS/wiki/brand/*.md` article follows the harness wiki format. It is an OKF v0.1 article: open it with YAML frontmatter carrying a non-empty `type:` (`brand-study`), then the H1 and body:

```markdown
---
type: brand-study
title: Brand — Visual Identity
description: The visual personality — OKLCH color system, type pairing & scale, and radius/shadow/motion personality.
tags: [brand, visual-identity, design]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: brand
status: stable
---

# Brand — Visual Identity

> Sources: {user interview, YYYY-MM-DD}
> Raw: [existing-palette](../../raw/brand/existing-palette.txt); [inspiration-linear](../../raw/brand/inspiration-linear.png)

## Overview

One paragraph: the visual personality and the ONE memorable detail.

## Color (OKLCH source of truth)

| Token | OKLCH | Role |
| --- | --- | --- |
| brand-500 | oklch(0.62 0.19 256) | primary accent (10% allocation) |
| bg | oklch(0.99 0 0) | background (light) |
| fg | oklch(0.21 0.01 256) | foreground |

(Any sRGB hex the user gave is recorded as an approximation, not the source — see `visual-system.md`.)

## Typography

- Display: Geist Semibold · Text: Inter Regular · Mono: Geist Mono (code)
- Scale ratio: 1.25 (major third), 16px base

## Personality

- Radius: soft (0.875rem cards) · Shadow: layered transparent elevation · Motion: quiet, entry reveals only

## See Also

- [Layout](layout.md)
- [Constraints](constraints.md)
```

### Raw inputs

Paste each user-provided input (palette text, competitor list, screenshots saved as files) under `02-DOCS/raw/brand/` with a one-line provenance header on text files:

```markdown
> Source: user-pasted, YYYY-MM-DD, origin: "current brand guide, page 3 palette"

<the pasted values, unedited>
```

Binary inputs (screenshots, logo files) go in verbatim and are linked from the article's `> Raw:` line; never compiled or edited.

### CLAUDE.md link

Add (or **extend**, never duplicate) the shared `## Brand & voice` section in the root `CLAUDE.md`. Additive only — never delete existing sections. Create `CLAUDE.md` if absent. If `marketing` already created this section, append the visual links to it rather than writing a second section.

```markdown
## Brand & voice

Design and marketing/landing copy are grounded in the brand study under
`02-DOCS/wiki/brand/`. Read it before any user-facing design or copy:

- [Positioning](02-DOCS/wiki/brand/index.md)
- [Visual identity (color, type, personality)](02-DOCS/wiki/brand/visual-identity.md)
- [Imagery & illustration](02-DOCS/wiki/brand/imagery.md)
- [Layout & references](02-DOCS/wiki/brand/layout.md)
- [Accessibility & performance constraints](02-DOCS/wiki/brand/constraints.md)
- [Audience](02-DOCS/wiki/brand/audience.md)
- [Value proposition](02-DOCS/wiki/brand/value-proposition.md)
- [Voice & tone](02-DOCS/wiki/brand/voice.md)

Raw inputs (palettes, screenshots, voice samples): `02-DOCS/raw/brand/`.
The `design` skill owns the visual articles; `marketing` owns the words
articles. Either stops to interview the user if its dimensions are missing.
```

Also update `02-DOCS/wiki/index.md` (add the new brand articles) and append a one-line entry to `02-DOCS/wiki/log.md` per the harness wiki protocol.

## See Also

- `../SKILL.md` — the runtime grounding mechanism (hard STOP) that uses this checklist.
- `visual-system.md` — turns the captured color/type/personality into Tailwind v4 `@theme` tokens.
- `research-method.md` — uses the reference sites (V6) as archetypes for the research loop.
- `trends-2026.md` — researched defaults to offer when a visual dimension has no user direction.
- `../../marketing/references/brand-grounding.md` — the co-owned words dimensions (incl. SEO/GEO) of the same study.
- `../../harness/SKILL.md` — the canonical `02-DOCS` wiki protocol and article templates.
