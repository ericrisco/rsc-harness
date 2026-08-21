# Motion & Interaction

Motion intent and budget, current-first. CSS is the default engine; reach for a JS library only when CSS cannot express the animation. Deep mechanics (springs, layout animations, `AnimatePresence` internals) live in the external *motion-ui* and *motion-foundations* references (not repo skills) — this skill owns intent + budget and defers mechanics outward.

## Purpose gate

Every animation must do one of three things: **guide** attention, **communicate** state, or **preserve** continuity between views. If it does none, delete it. Decorative motion costs performance budget and attention while adding no information.

## Timing & easing tokens

Define duration and easing as tokens; never hand-tune per element.

```css
@theme {
  --dur-instant: 80ms;   /* checkbox tick, instant feedback */
  --dur-fast:   180ms;   /* hover, small state changes */
  --dur-normal: 280ms;   /* entrances, panel open */
  --dur-slow:   600ms;   /* large hero / staged sequences */
  --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* decelerate; the default for UI */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* on-screen movement, A to B */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* iOS-like drawer / sheet (Ionic) */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* playful overshoot, sparingly */
}
```

**Never `ease-in` on UI.** It starts slow, delaying the exact moment the user is watching most, so
the interface feels sluggish — `ease-out` at 200ms *feels* faster than `ease-in` at 200ms. And the
built-in CSS easings are too weak to read as intentional; the curves above are the ones to reach for.
Need one that is not here? Take it from [easing.dev](https://easing.dev/), do not hand-roll it.

The choice, in decision order: entering or exiting → `ease-out`; moving on screen → `ease-in-out`;
hover or color → `ease`; constant motion (marquee, progress) → `linear`; unsure → `ease-out`.
`../../animate/SKILL.md` owns the full build sequence and the per-element duration table, and
`../../review-animations/scripts/verify.sh` flags an `ease-in` that slips through.

- **Enter vs exit asymmetry:** entrances are slower and softer (`--dur-normal`, `--ease-out`); exits are quicker and quieter (~150ms) so dismissals feel responsive.
- **Press feedback:** `scale(0.97)` on `:active` gives a tactile button without distracting movement.

```css
/* Button press — explicit properties, never `transition: all` */
.button {
  transition-property: transform, background-color, box-shadow;
  transition-duration: 150ms;
  transition-timing-function: var(--ease-out);
}
.button:active { transform: scale(0.97); }
```

## Micro-interactions

CSS-first, state-driven, interruptible (CSS transitions retarget mid-flight when intent changes).

```css
/* Hover + focus affordance on a card */
.card {
  transition-property: transform, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: var(--ease-out);
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.card:focus-visible { outline: 2px solid var(--color-brand-500); outline-offset: 2px; }
```

```css
/* Icon cross-fade — fade + scale instead of an instant visibility toggle */
.icon-swap { transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out); }
.icon-swap[data-state="off"] { opacity: 0; transform: scale(0.8); }
```

```css
/* Skeleton shimmer for loading state */
.skeleton {
  background: linear-gradient(90deg, oklch(0.9 0 0), oklch(0.95 0 0), oklch(0.9 0 0));
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
```

For **optimistic state** (toggle/like), flip the visual immediately on click and reconcile when the request resolves — the UI never waits on the network for feedback.

## Scroll-driven, CSS-first

Native `animation-timeline: view()` and `scroll()` are the default for scroll-linked animation: zero JS, no main-thread scroll handler, no CLS. Use them before any library.

Guard scroll-driven animation behind a `@supports (animation-timeline: view())` feature query so the fallback is **explicit and visible**, not accidental. Elements start fully visible (`opacity: 1`); only inside the feature query — and only when motion is allowed — do they start hidden and animate in. A browser without scroll-timeline support (or a reduced-motion user) never enters the query, so content is never stuck invisible.

```css
/* Default: fully visible. No scroll-timeline support => content is never hidden. */
.reveal { opacity: 1; }

/* Progressive enhancement: only browsers WITH scroll-timeline opt in. */
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

```css
/* Parallax — element drifts as the page scrolls, driven by the scroll timeline */
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    .parallax {
      animation: drift linear both;
      animation-timeline: scroll(root block);
    }
  }
}
@keyframes drift { to { translate: 0 -40px; } }
```

Browser support note (verified June 2026): scroll-driven timelines (`animation-timeline` with `scroll()`/`view()`) now ship in Chromium (Chrome/Edge 115+) and Safari (18+, full support in Safari 26). Firefox has it implemented but still behind a flag (`layout.css.scroll-driven-animations.enabled`), so it is off by default for most users. That gap is exactly why the `@supports (animation-timeline: view())` query is load-bearing, not cosmetic: where the feature is unsupported (Firefox today, older engines), the feature query is skipped entirely and the element renders in its default (visible, un-drifted) state — a graceful, non-broken fallback. Always gate scroll-driven effects behind that `@supports` guard.

## Performance budget

- **Animate `transform`, `opacity`, `filter` only.** These run on the compositor and skip layout/paint.
- **Never animate `width`, `height`, `top`, `left`, `margin`.** They trigger layout on every frame and jank.
- **`will-change` sparingly** — only to fix a first-frame stutter on a compositor-friendly property, and remove it after. Never `will-change: all`.
- **Scroll handlers cost INP.** Prefer scroll-driven CSS; if you must use JS, throttle and keep handlers passive.
- **`content-visibility: auto`** on long offscreen sections skips their rendering work until they approach the viewport.

## Accessibility

Honor `prefers-reduced-motion` at both layers.

```css
/* CSS layer — kill non-essential motion globally */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```ts
// JS layer — branch behavior when motion must be coded
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduce) {
  // run the orchestrated entrance
}
```

- **No motion-only meaning:** never convey state (error, success) by movement alone; pair it with color, icon, or text.
- **Pause controls for loops:** any auto-playing or looping animation needs a way to stop it.
- **Vestibular safety:** cut large translate and parallax for reduced-motion users — big movement triggers nausea for some people.

## When to escalate to motion/react

Stay in CSS for hover, press, reveal, and parallax. Escalate to `motion/react` only for what CSS cannot express: orchestrated sequences, layout animations (`layout` prop), and exit animations of unmounting components.

```tsx
"use client";
import { motion, AnimatePresence } from "motion/react";
// Use only for orchestration/exit that CSS can't express. Tokens + springs: motion-foundations.

export function Toast({ open, message }: { open: boolean; message: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          role="status"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Once you are in `motion/react`, defer the mechanics (spring config, variants, `layoutId` shared transitions) to the external *motion-foundations* and *motion-ui* references.

## Escalating past the native path

Native `animation-timeline: view()` covers reveals, progress rails and parallax. Two effects it
cannot express are **pinning** (a section holds still while its content advances) and a
**horizontal pan** driven by vertical scroll. Those need a scroll library, and the improvised
version is always wrong in the same three ways. Escalate deliberately:

**Never listen to scroll directly.** `window.addEventListener('scroll')` fires off the main
thread's budget, blows INP, and never gets a passive-listener or cleanup story right. The
allowed inputs are `IntersectionObserver`, a scroll-driven CSS timeline, `useScroll()` from
`motion/react`, or GSAP's ScrollTrigger. Nothing else.

**Sticky stack** (pin a section, advance its layers):

```ts
// 'use client' leaf only. One trigger per pinned section, killed on unmount.
const st = ScrollTrigger.create({
  trigger: sectionRef.current,
  start: "top top",          // pin the moment the section's top reaches the viewport top
  end: () => `+=${panels.length * window.innerHeight}`,
  pin: true,
  pinSpacing: true,          // without this the next section slides under the pin
  scrub: 1,                  // 1 = follow scroll with a 1s catch-up, not a hard 1:1 jump
  invalidateOnRefresh: true, // recompute on resize, or the end point is stale on rotate
});
// cleanup is not optional: return () => st.kill();
```

**Horizontal pan** is the same trigger with `end: () => "+=" + track.scrollWidth` and the
track moved via `x`, not `left` — `transform` is compositor-only, `left` triggers layout.

Both are opt-in above a motion budget, both stay inside
`@media (prefers-reduced-motion: no-preference)`, and both collapse to a plain vertical stack
below `768px` rather than pinning on a phone.

## See Also

- `visual-system.md` — the easing and duration tokens these animations consume.
- *motion-ui* — production motion patterns and library mechanics (external reference, not a repo skill).
- *motion-foundations* — spring physics and timing theory (external reference, not a repo skill).
- `../../nextjs/SKILL.md` — Client vs Server Component boundaries for animated UI.
