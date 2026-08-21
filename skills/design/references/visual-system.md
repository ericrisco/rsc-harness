# Visual System — Tokens, Type, Color, Layout, Depth

The full design-token and aesthetics system. Define tokens once with Tailwind v4 `@theme`; consume them everywhere as utilities and raw `var()`. Targets the current stack (verified June 2026): Tailwind CSS v4.3, Next.js 15, React 19, OKLCH-native color.

## Spacing scale

Spacing rhythm is what separates "designed" from "thrown together". Anchor every gap, padding, and margin to a 4/8px base scale so vertical and horizontal rhythm stays consistent.

| Step | rem | px | Typical use |
| --- | --- | --- | --- |
| 0 | 0 | 0 | reset |
| 1 | 0.25rem | 4 | icon gap, hairline inset |
| 2 | 0.5rem | 8 | tight label/input gap |
| 3 | 0.75rem | 12 | button padding-y |
| 4 | 1rem | 16 | base block gap |
| 6 | 1.5rem | 24 | card padding |
| 8 | 2rem | 32 | section inner gap |
| 12 | 3rem | 48 | sub-section gap |
| 16 | 4rem | 64 | section padding-y (mobile) |
| 24 | 6rem | 96 | section padding-y (desktop) |

Tailwind utilities (`p-4`, `gap-6`, `py-24`) map directly to this scale. **When to break it:** only for *optical* alignment — nudging an icon 1px to look centered, or trimming 2px off cap-height padding. Optical fixes are deliberate exceptions, not a second arbitrary scale.

## Typographic scale

Pick a modular ratio and step every size from a 16px base. Larger ratios read more editorial; smaller ratios read denser and more utilitarian.

| Ratio | Name | Ladder from 16px (rounded) |
| --- | --- | --- |
| 1.200 | Minor third | 16 · 19 · 23 · 28 · 33 · 40 |
| 1.250 | Major third | 16 · 20 · 25 · 31 · 39 · 49 |
| 1.333 | Perfect fourth | 16 · 21 · 28 · 38 · 51 · 67 |

Use fluid `clamp()` so headings scale with the viewport instead of jumping at breakpoints:

```css
/* min, preferred (rem + vw), max — never snaps, never overflows */
.h1   { font-size: clamp(2.25rem, 1.5rem + 3vw, 3.75rem); line-height: 1.05; text-wrap: balance; }
.h2   { font-size: clamp(1.75rem, 1.25rem + 2vw, 2.5rem);  line-height: 1.1;  text-wrap: balance; }
.lead { font-size: clamp(1.125rem, 1rem + 0.5vw, 1.375rem); line-height: 1.5; }
```

Rules:

- **Line-height:** 1.5 for body, 1.05–1.15 for display. Tighter type wants tighter leading.
- **Measure:** keep body text at 45–75ch (`max-w-prose` ≈ 65ch). Long lines kill readability.
- **Pairing:** one display face + one text face, or a single superfamily with weight contrast. Never three+ families.

Self-host with `next/font` so there is no FOUT swap shift (a CLS source):

```tsx
// app/fonts.ts — next/font, self-hosted, no layout shift
import { Geist, Inter } from "next/font/google";
export const display = Geist({ subsets: ["latin"], variable: "--font-display", display: "swap" });
export const text = Inter({ subsets: ["latin"], variable: "--font-text", display: "swap" });
```

```tsx
// app/layout.tsx — apply the font variables on <html>
import { display, text } from "./fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

`next/font` auto-computes a size-adjusted fallback so the layout does not shift when the web font loads. Pair `display: "swap"` with that fallback to keep CLS at 0.

## Color theory (OKLCH)

OKLCH is the modern default: `oklch(L C H)` where **L** is perceptual lightness (0–1), **C** is chroma, **H** is hue (0–360). Unlike HSL, equal L steps look equally bright across hues, and OKLCH reaches the wider P3 gamut on capable displays.

Build a ramp by **holding hue and chroma, stepping L**:

```css
/* Brand ramp — hold hue 256 + chroma, step lightness */
@theme {
  --color-brand-50:  oklch(0.97 0.02 256);
  --color-brand-100: oklch(0.93 0.05 256);
  --color-brand-300: oklch(0.78 0.13 256);
  --color-brand-500: oklch(0.62 0.19 256);
  --color-brand-700: oklch(0.48 0.17 256);
  --color-brand-900: oklch(0.32 0.10 256);
}
```

- **60-30-10 allocation:** ~60% background/neutral, ~30% foreground/structure, ~10% brand/accent. The brand color earns attention precisely because it is rare.
- **Semantic tokens** decouple meaning from value: `bg`, `fg`, `muted`, `brand`, `accent`, `destructive`. Components reference meaning, never raw hex.
- **Accessible contrast:** verify body text ≥ 4.5:1, large text / UI ≥ 3:1. Check with an APCA-aware contrast checker or browser DevTools (the Color Picker shows the live ratio). Do not eyeball it.
- **Dark mode via token swap,** not per-component overrides — swap the semantic values at the root and every component follows.

```css
:root { --color-bg: oklch(0.99 0 0); --color-fg: oklch(0.21 0.01 256); }
@media (prefers-color-scheme: dark) {
  :root { --color-bg: oklch(0.17 0.01 256); --color-fg: oklch(0.96 0.01 256); }
}
```

Gradients and mesh are seasoning. A single subtle gradient on one surface (a CTA, a hero glow) can lift a page; the same gradient on every card flattens it into AI-slop. **Do not** gradient text, borders, and backgrounds simultaneously, and never make a gradient the value prop.

```css
/* Good — one restrained brand-tinted glow behind the hero, low chroma */
.hero-glow { background: radial-gradient(60% 50% at 50% 0%, oklch(0.62 0.19 256 / 0.15), transparent); }
```

## Grid & layout

- **12-column grid** for marketing pages; **container queries** (`@container`, core in Tailwind v4) for components that must adapt to their slot rather than the viewport.
- **Bento** is the 2026 standard for feature → benefit sections: an asymmetric grid with one focal cell that scans because the eye lands on the largest tile first, then sweeps the supporting cells.
- **Asymmetry / optical balance:** an off-center focal point with balanced negative space reads more intentional than a rigid symmetric grid.
- **Max-width + measure:** cap content at ~1024–1200px and body copy at ~65ch.

```html
<!-- Good — responsive bento: stacks on mobile, focal cell spans 2x2 on desktop -->
<section aria-label="Features" class="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-6 md:grid-cols-3 md:grid-rows-2">
  <article class="rounded-card border border-fg/10 bg-bg p-6 md:col-span-2 md:row-span-2">
    <h3 class="text-2xl font-semibold">Preview every branch</h3>
    <p class="mt-2 text-pretty text-fg/70">One command spins up an isolated environment.</p>
  </article>
  <article class="rounded-card border border-fg/10 bg-bg p-6">
    <h3 class="font-semibold">No staging queue</h3>
  </article>
  <article class="rounded-card border border-fg/10 bg-bg p-6">
    <h3 class="font-semibold">Auto-teardown</h3>
  </article>
</section>
```

```html
<!-- Bad — symmetric 3-up of identical cards: nothing to anchor the scan -->
<section class="grid grid-cols-3 gap-4">
  <div class="card">A</div><div class="card">B</div><div class="card">C</div>
</section>
```

## Depth

Depth is layered transparent shadow + hairline border + concentric radius — not one hard drop shadow.

```css
/* Layered transparent shadows read as real elevation across any background */
--shadow-card:
  0 1px 2px oklch(0 0 0 / 0.06),
  0 8px 24px oklch(0 0 0 / 0.08),
  0 16px 48px oklch(0 0 0 / 0.06);
```

**Concentric radius:** `outer = inner + padding`. Worked number — an inner element with `border-radius: 8px` and `16px` of padding wants an outer `border-radius: 24px` so the corners stay parallel. Same-radius nesting (parent and child both `12px`) looks subtly wrong.

**Hairline borders before shadows.** Use a 1px `fg/10` border for separation; add shadow only when a surface genuinely floats (dropdown, popover, modal).

**Tasteful glass — floating surfaces only:**

```html
<div class="rounded-card border border-white/10 bg-white/5 shadow-card backdrop-blur-xl">
  <!-- floating surface only — never the whole page -->
</div>
```

**Film grain / noise** via an inline SVG `data:` background adds texture without an image request:

```css
.grain {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
}
```

**When depth becomes slop:** glass on every card, a drop shadow on every element, or multiple competing elevations on one screen. Reserve depth for the few surfaces that genuinely sit above the page.

## Design tokens end-to-end

The canonical Tailwind v4 `@theme` block — colors, type, spacing, radius, shadow, easing — consumed as utilities (`bg-brand-500`, `rounded-card`) AND raw `var(--color-brand-500)`:

```css
@import "tailwindcss";
@theme {
  /* color */
  --color-bg:          oklch(0.99 0 0);
  --color-fg:          oklch(0.21 0.01 256);
  --color-muted:       oklch(0.55 0.01 256);
  --color-brand-500:   oklch(0.62 0.19 256);
  --color-brand-600:   oklch(0.55 0.19 256);
  --color-accent-500:  oklch(0.78 0.13 256);
  --color-destructive: oklch(0.58 0.22 27);
  /* type */
  --font-display: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-text:    "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "Geist Mono", ui-monospace, monospace;
  /* radius + shadow */
  --radius-card: 0.875rem;
  --shadow-card: 0 1px 2px oklch(0 0 0 / 0.06), 0 8px 24px oklch(0 0 0 / 0.08);
  /* easing — same values as references/motion-and-interaction.md; two definitions that drift
     is worse than one, so change them together */
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
}
```

Mirror the source-of-truth tokens in a `tokens.json` so other tools (Flutter, icon pipelines, Figma sync) consume the same values:

```json
{
  "color": {
    "bg":    "oklch(0.99 0 0)",
    "fg":    "oklch(0.21 0.01 256)",
    "brand": "oklch(0.62 0.19 256)"
  },
  "radius": { "card": "0.875rem" }
}
```

Make the cross-platform parity concrete — the Flutter app uses the same brand hue. OKLCH is the source of truth; the sRGB hex is an **approximation** (Flutter's `Color` is sRGB-only, so the wider-gamut OKLCH value cannot round-trip exactly). Label it as such so no one treats the hex as canonical:

```dart
// lib/theme.dart — Flutter mirror of the brand token (Dart 3 / Flutter stable).
// 0xFF5B54FF is an sRGB APPROXIMATION (≈) of the canonical oklch(0.62 0.19 256);
// regenerate from the OKLCH source token, never hand-edit this hex.
final brand = const Color(0xFF5B54FF); // ≈ oklch(0.62 0.19 256)
final theme = ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: brand));
```

```html
<!-- Bad — magic hex, hand-tuned per component, drifts instantly -->
<button style="background:#5b54ff;border-radius:13px">Buy</button>
<!-- Good — semantic token utilities, single source of truth -->
<button class="bg-brand-500 rounded-card px-6 py-3 text-white">Buy</button>
```

## See Also

- `motion-and-interaction.md` — animate these tokens with intent.
- `landing-anatomy-and-cro.md` — apply the system across a full page.
- `../../flutter/SKILL.md` — implement the mirrored tokens in the Flutter app.
