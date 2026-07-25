---
name: brand-identity
description: "Use when a project needs its visual foundation built or consolidated into one system: logo brief, color system in HEX/RGB/CMYK/OKLCH with proven AA contrast, type system, usage rules, and an exported W3C design-tokens.json that later skills consume. NOT the applied UI pixels (that is design), NOT the words or tone (that is brand-voice)."
tags: [brand, identity, logo, color, typography]
recommends: [design, brand-voice, press-kit, presentations]
origin: risco
---

# Brand Identity — Define the Foundation, Not the Pixels

*This skill emits the brand book — logo brief, color system, type system, usage rules — and a machine-readable `design-tokens.json` that `design` consumes. You write the rules every later pixel must obey; you do not paint the live UI.*

A brand identity with nothing checkable behind it is a mood board. The bar here is a **brand book that compiles**: roles named, every color carrying four channels, contrast pairs proven against WCAG, and a tokens file that `scripts/verify.sh` can validate.

All four parts ship together — logo brief, color system, type system, usage guidelines with the tokens export. A part missing its bar is incomplete, not "lite".

The one-line boundary test: "define what our brand looks like everywhere" → here. "make *this surface* look premium" → `design`.

## Logo brief

Specify a system, not a single picture. The mark must survive from favicon to billboard, in color and in one ink.

- **Variation set** — primary (horizontal lockup), stacked (vertical, for square/tight slots), mark-only (the symbol alone, for avatars/favicons), monochrome (single-ink: black, white-knockout). A logo with no mono version fails the moment it lands on a colored background or a fax. Test the mono version first; if it dies in one color, the design is too fragile.
- **Clear space** — define it relative to the mark, not in fixed px, so it scales: clear space = the cap-height (or x-height of the mark) on all four sides. Nothing intrudes inside it.
- **Minimum size** — below this, detail collapses. Defaults: 24px wide digital, 10mm wide print for the full lockup; the mark-only may go smaller (favicon).
- **File + favicon matrix** — ship the formats below. SVG is the digital primary (scales, tiny); PNG carries transparency; JPEG is print-safe; 72 DPI digital / 300 DPI print.

| Asset | Format | Notes |
| --- | --- | --- |
| Logo (digital primary) | SVG | Vector, scales infinitely, smallest |
| Logo (raster, transparency) | PNG | @1x/@2x, transparent bg |
| Logo (print) | JPEG/PDF | 300 DPI, CMYK |
| Favicon (modern) | `favicon.svg` | <1KB, can embed `prefers-color-scheme` for dark mode |
| Favicon (legacy fallback) | `favicon.ico` | At site root |
| Favicon PNG | `favicon-16.png`, `favicon-32.png` | Tab/bookmark |
| Apple touch | `apple-touch-icon.png` 180×180 | iOS home screen |
| Android | `android-chrome-192.png`, `-512.png` | PWA/manifest |
| Manifest | `site.webmanifest` | Declares the icon set |

Full variation grid, clear-space/min-size formulas, and the favicon HTML markup + `prefers-color-scheme` SVG snippet → `references/logo-and-assets.md`.

## Color system

Assign roles first, values second. A color with no role is decoration waiting to be misused.

- **Role taxonomy** — 2–3 primary (the brand's signature), 2–3 secondary (support), a neutral ramp (text, surfaces, borders), and exactly **one accent** reserved for CTAs/highlights. One accent keeps "click here" unambiguous.
- **Four channels, every color, no exceptions** — HEX (web), RGB (screen math), CMYK (print), OKLCH (perceptual + wide-gamut). This one is absolute because a HEX-only palette silently breaks the two places nobody tests: print (no CMYK) and wide-gamut screens (no OKLCH). The W3C Design Tokens Color Module (2025.10) supports CSS Color 4 spaces including OKLCH and Display P3, so wide-gamut color lives in the token file natively — author in OKLCH and let HEX be the fallback.
- **AA contrast pairing** — every text-on-background pair you document clears WCAG 2 AA: **4.5:1 normal text, 3:1 large text** (≥18.66px bold or ≥24px). Not negotiable — it is a conformance threshold, not a taste call, and shipping under it ships an inaccessible product. AAA is 7:1 / 4.5:1 — reach for it on body text where you can. Pair colors explicitly ("`fg` on `bg`: 12.4:1 ✓").
- **Logo-text exemption caveat** — WCAG 1.4.3 exempts logos and brand-name text from the contrast minimums. But a *typed* sub-brand or tagline that is plain text (not a graphical logo) IS subject to text-contrast rules. Mark logo-only tokens exempt; hold everything else to 4.5:1.
- **Light/dark roles** — define the role in both schemes from day one (`bg`/`fg` invert, brand stays anchored). Retrofitting dark mode onto a light-only palette produces muddy, low-contrast surfaces.

Full role taxonomy, a fully worked palette in HEX/RGB/CMYK/OKLCH, the contrast-pair matrix with computed ratios, and the dark-mode token strategy → `references/color-and-tokens.md`.

## Type system

Two to three typefaces, no more. Most brands need exactly two: one display (headlines, personality) and one text (body, ≤16px legibility); a third is justified only for monospace/data.

- **Scale** — pick a modular ratio (1.2 minor third for dense UI, 1.25 major third for marketing) and ladder the sizes from it. Document the ladder; do not re-guess sizes per screen.
- **Weights** — name which weights ship (e.g. 400 body, 500 UI, 600/700 display) and which are banned (no faux-bold, no faux-italic).
- **Pairing rationale** — one line on *why* the pair works (contrast in structure: a geometric sans display over a humanist text face; or a serif display over a neutral sans body). "They both look nice" is not a rationale.
- **Variable-font note** — prefer a variable font where available: one file spans the weight axis, cuts requests, and removes the faux-bold temptation. Pin the named instances you use.

## Emit the tokens (the hand-off contract)

Ship `design-tokens.json` even when the client only asked for a PDF — it is the one artifact `design` can read, and without it the palette gets re-derived by eye and drifts. Use the **W3C Design Tokens format**, which reached its first stable version (2025.10) on 2025-10-28 — a vendor-neutral JSON for sharing design decisions, with light/dark and multi-brand themes via group inheritance / `$extends`.

```json
{
  "$schema": "https://tokens.designtokens.org/2025.10/schema.json",
  "color": {
    "brand": {
      "$type": "color",
      "primary": {
        "$value": { "colorSpace": "oklch", "components": [0.55, 0.19, 256], "hex": "#3b5bdb" }
      },
      "accent": {
        "$value": { "colorSpace": "oklch", "components": [0.72, 0.17, 50], "hex": "#f08c00" }
      }
    },
    "bg": { "$type": "color", "$value": { "colorSpace": "oklch", "components": [0.99, 0, 0], "hex": "#fcfcfc" } },
    "fg": { "$type": "color", "$value": { "colorSpace": "oklch", "components": [0.21, 0.01, 256], "hex": "#1f2430" } }
  }
}
```

Map the tokens to CSS custom properties (and, if the consumer is Tailwind v4, an `@theme` block) so the values flow into utilities — author once, consume everywhere:

```css
/* design consumes these — generated from design-tokens.json, never hand-edited */
:root {
  --color-brand-primary: oklch(0.55 0.19 256);
  --color-brand-accent:  oklch(0.72 0.17 50);
  --color-bg:            oklch(0.99 0 0);
  --color-fg:            oklch(0.21 0.01 256);
}
```

Full tokens file with light/dark via `$extends`, the Tailwind v4 `@theme` mapping, and the dark-mode strategy → `references/color-and-tokens.md`.

## Usage guidelines + anti-patterns

State the misuse rules explicitly — the gap a brand book exists to close is the well-meaning teammate who stretches the logo to fit.

| Misuse in the wild | Why it breaks / Fix |
| --- | --- |
| "Stretch the logo to fill the space" | Non-uniform scaling distorts the mark. Lock aspect ratio; pick the variation that fits (stacked vs primary). |
| "This blue is close enough" | Off-palette colors fracture recognition. Use the token; if a need is unmet, add a role, don't eyeball one. |
| "HEX is enough, we're a web brand" | Print and wide-gamut break. Every color carries HEX + RGB + CMYK + OKLCH or it is not in the system. |
| "Four fonts give us range" | Reads as chaos and bloats load. Cap at 2–3; get range from weights + scale. |
| "We'll add dark mode later" | Light-only palettes go muddy when inverted. Define light/dark roles from day one. |
| "Contrast is a design detail" | It is a WCAG requirement. Document each text/bg pair at ≥4.5:1 before shipping. |
| "Drop the logo on any background" | Color/photo backgrounds kill legibility. Provide and require the mono/knockout variation with clear space. |
| "The tokens file is optional, the PDF is the brand" | A PDF can't be consumed by code; `design` will drift. The `design-tokens.json` is the contract. |

Do/don't rules, the full misuse grid with examples, and lockup rules → `references/logo-and-assets.md`.

## Verify

The skill emits a checkable artifact, so verify it before claiming done. Run against your tokens file:

```bash
./scripts/verify.sh path/to/design-tokens.json
```

It checks: the file parses as JSON; required color roles are present (primary, neutral, accent at minimum); every color token carries a HEX value; and, for each documented text/background pair (declared via `$extensions["com.risco.contrast"]` pairs), it computes the WCAG relative-luminance contrast ratio and **fails any normal-text pair below 4.5:1**. Logo-only tokens are exempt. On an empty or clean target it exits 0 — no false failures.

## Boundary + hand-off

| Request | Route to | Why |
| --- | --- | --- |
| Tone of voice, tagline, naming, messaging pillars | `../brand-voice/SKILL.md` | Verbal identity — the words, not the pixels. Pair it with this so copy and visuals agree. |
| Make this page premium, pick layout + motion, ship the Tailwind | `../design/SKILL.md` | The applied UI layer: it reads `design-tokens.json` and builds the accessible, fast UI. This skill produces the brand study's visual half that `design` STOPS without. |
| Hero headline, value prop, CTA copy | `../marketing/SKILL.md` | Page words, not the visual system. |
| Press kit — boilerplate, logos-for-press, fact sheet | `../press-kit/SKILL.md` | Media packaging of finished assets, not system definition. |
| Investor pitch deck visuals | `../presentations/SKILL.md` | Deck composition consuming the tokens, not the brand foundation. |
