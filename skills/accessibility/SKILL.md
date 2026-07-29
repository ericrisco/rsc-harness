---
name: accessibility
description: "Use when making a web UI conform to WCAG 2.2 Level AA — axe-core or Lighthouse a11y violations, keyboard operability, focus management, ARIA roles/names/live regions, contrast, tap-target size. NOT palette or visual intent (that is `design`), NOT test-runner setup (that is `testing-web`), NOT LCP/page-speed (that is `performance`)."
tags: [wcag, accessibility, a11y, aria, axe-core]
recommends: [testing-web, e2e-testing, design, react, performance]
origin: risco
---

# Accessibility — Ship WCAG 2.2 AA, not vibes

*The bar is conformance to WCAG 2.2 Level AA. "Looks fine to me" is not a measurement. Fix the semantics, scan what a machine can scan, then walk the part it can't.*

## The loop (your 30-second model)

Run these in order. Skipping a step front-loads rework.

1. **Native semantics first.** A real `<button>` ships focus, keyboard, and role for free. Most "a11y bugs" are a `<div>` doing a button's job.
2. **Automated scan.** axe-core catches roughly **57%** of WCAG issues — missing labels, bad roles, contrast (in a real browser), duplicate ids. Cheap, run it every commit.
3. **Manual checklist for the rest.** The other **~43%** — keyboard order, focus traps, meaningful alt text, screen-reader flow — no engine can judge. A human (or you, deliberately) must.

**Decision rule: never ship on a green axe run alone.** A clean automated scan means "no machine-detectable failures," not "accessible." Treat it as necessary, never sufficient.

Legal stakes are real: the EU **European Accessibility Act became enforceable 2025-06-28** for many consumer products and services, on top of EN 301 549 / ADA. AA is the line.

## Rule 0 — reach for HTML before ARIA

The first rule of ARIA is: **don't use ARIA.** If a native element gives you the semantics and behavior, use it. Every `role` you add is behavior you now owe by hand — focus, keyboard, state.

```html
<!-- Bad: zero keyboard, no role, no focus, no Enter/Space -->
<div class="btn" onclick="save()">Save</div>

<!-- Good: focusable, Enter/Space fire it, announced as "Save, button" -->
<button type="button" onclick="save()">Save</button>
```

| You want…              | Use native…                | Not…                          |
| ---------------------- | -------------------------- | ----------------------------- |
| A click action         | `<button type="button">`   | `<div role="button" onClick>` |
| Navigation             | `<a href="…">`             | `<span onClick>` + JS routing |
| Show/hide section      | `<details><summary>`       | hand-rolled `aria-expanded`   |
| Form field             | `<input>`/`<select>`       | contenteditable div           |
| Modal                  | `<dialog>` + `showModal()` | a div with `role="dialog"`    |

Reach for ARIA only when no native element fits (tabs, comboboxes, toasts) — and then copy a vetted pattern (→ `references/aria-patterns.md`).

## Semantics & accessible names

- **One `<h1>` per page.** Headings describe structure; never skip a level (`<h2>` then `<h4>`) to get a font size — that's a CSS job.
- **Landmark every region:** `<header> <nav> <main> <footer>`. Exactly one `<main>`. Screen-reader users jump by landmark; a wall of `<div>` has no map.
- **Skip link first in the DOM** so keyboard users escape the nav: `<a href="#main" class="sr-only-focusable">Skip to content</a>`.
- **Accessible name precedence** (what a screen reader announces), highest wins: `aria-labelledby` → `aria-label` → associated `<label>` / element text → `title`. Don't stack them hoping one sticks; pick one source.

```html
<!-- Bad: announced as just "button" -->
<button><svg aria-hidden="true">…</svg></button>

<!-- Good: announced as "Close dialog, button" -->
<button aria-label="Close dialog"><svg aria-hidden="true">…</svg></button>
```

A `placeholder` is **not** a label — it vanishes on input and many SRs ignore it. Use a real `<label for>`.

## Keyboard operability

Everything a mouse can do, a keyboard must do.

- **All interactive elements reachable and operable** with Tab + Enter/Space. Native controls give this free; custom ones don't.
- **Tab order follows the DOM.** Fix order by reordering markup, not by patching `tabindex`.
- **Never a positive `tabindex`.** Only `0` (in natural order) or `-1` (focusable by script, skipped by Tab). A positive value hijacks the whole page's order and breaks the next dev's mental model.
- **Visible focus, always** (see next section). If you can't tell where focus is with the mouse unplugged, neither can the user.

**Overlays (dialogs, menus, drawers) need focus management** — three obligations:

1. **Move focus in** when it opens (to the dialog or its first control).
2. **Trap focus** inside while open — Tab from the last element wraps to the first.
3. **Escape closes**, and **focus returns to the trigger** that opened it.

Composite widgets (menus, tabs, grids) use **roving tabindex**: one element is `tabindex="0"`, the rest `-1`, arrow keys move the `0`. Full keyboard tables per pattern — modal, disclosure, tabs, combobox, menu, toast → `references/aria-patterns.md`.

## Visible focus & the WCAG 2.2 deltas

```css
/* Bad: kills the focus ring with nothing in its place */
:focus { outline: none; }

/* Good: ring only for keyboard users, not mouse clicks */
:focus-visible { outline: 3px solid; outline-offset: 2px; }
```

WCAG 2.2 (W3C Recommendation, 2023-10-05) **adds 9 success criteria and removes 4.1.1 Parsing**. The six that matter at **Level AA** — know the numbers:

- **2.4.11 Focus Not Obscured (Minimum)** — a focused element must not be fully hidden behind sticky headers/footers or cookie bars.
- **2.5.7 Dragging Movements** — anything done by dragging (sliders, reorder, map pan) needs a single-pointer alternative (tap, buttons).
- **2.5.8 Target Size (Minimum)** — interactive targets are at least **24×24 CSS px**, unless spacing keeps a 24px-radius circle from overlapping a neighbor (the spacing exception). 44×44 is the comfort bar; 24 is the floor.
- **3.2.6 Consistent Help** — help mechanisms appear in the same relative order across pages.
- **3.3.7 Redundant Entry** — don't make users re-enter info they already gave in the same process; auto-fill or let them pick it.
- **3.3.8 Accessible Authentication (Minimum)** — no cognitive-function test to log in (no puzzles, no "transcribe this", no math). Allow paste, password managers, and copy.

## Contrast & color

Measured ratios, AA minimums:

- **4.5:1** for normal text.
- **3:1** for large text (**≥24px**, or **≥18.66px bold**).
- **3:1** for UI components and graphical objects you must perceive (1.4.11) — input borders, icon glyphs, chart segments.

**Never encode meaning in color alone** (1.4.1). A red border on an invalid field is invisible to many users — pair it with text and an icon.

```html
<!-- Bad: only color signals the error -->
<input class="border-red-500" aria-invalid="true">

<!-- Good: text + icon + programmatic association -->
<input aria-invalid="true" aria-describedby="email-err">
<p id="email-err">⚠ Enter a valid email address.</p>
```

Note: **jsdom can't compute contrast** (no real layout/paint), so jest-axe disables the rule. Verify contrast in a real browser (Playwright / Lighthouse) or by hand.

## ARIA done right

Mental model: **Name, Role, Value.** Every custom control needs an accessible *name*, the right *role*, and current *state/value* — and you must keep state in sync.

- **State attributes:** `aria-expanded` on a disclosure trigger, `aria-controls` pointing at what it toggles, `aria-selected` / `aria-current` for the active item. Toggle them in the same handler that changes the visual state.
- **Live regions** announce async changes without moving focus:
  - `aria-live="polite"` — wait for a pause (status, "Saved", search-result counts). Default choice.
  - `aria-live="assertive"` — interrupt now (form submit error, session-expiry). Use sparingly.
- **Hiding — pick the right one:**

| Technique          | Visual | Screen reader | Use for                                   |
| ------------------ | ------ | ------------- | ----------------------------------------- |
| `display:none`     | gone   | gone          | truly removed content                     |
| `aria-hidden=true` | shown  | hidden        | decorative visuals — **never on a focusable element** |
| `.sr-only` class   | hidden | read          | labels/skip links for SR users only       |

```html
<!-- Bad: focusable AND hidden from SR = a keyboard trap nobody can hear -->
<button aria-hidden="true">Menu</button>

<!-- Good: decorative icon hidden, the button keeps its name -->
<button aria-label="Menu"><svg aria-hidden="true">…</svg></button>
```

## Automate it (versioned, 2026-06-02)

Three layers — each catches what the cheaper one can't.

**Lint (static, JSX only) — `eslint-plugin-jsx-a11y` 6.10.2.** Catches missing `alt`, label-less inputs, positive `tabindex`, invalid roles, at edit time.

```jsonc
// .eslintrc — extends, then runs in your existing lint step
{ "extends": ["plugin:jsx-a11y/recommended"] }
```

**Unit (fast, no browser) — `jest-axe` 10.0.0.** Asserts no axe violations on rendered output. Remember: **contrast is off in jsdom.**

```js
import { axe, toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

test("no a11y violations", async () => {
  const { container } = render(<SignupForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

**Browser (the real thing, catches contrast) — `@axe-core/playwright` 4.11.3** (on `axe-core` 4.12.0). Scope it to the WCAG 2.2 AA tags:

```js
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
  .analyze();
expect(results.violations).toEqual([]);
```

**Lighthouse a11y score** is a smoke signal for a quick pulse, not proof — it runs a subset of axe and gives a number, not a pass.

`scripts/verify.sh` ties this together: it detects whatever tooling the project has and runs it, failing only on serious/critical violations (read-only, skips cleanly when no tooling is present).

## Manual checklist (the ~43% a machine can't see)

Do these by hand before you call it done:

- [ ] **Unplug the mouse.** Tab through the entire flow — every control reachable, order logical, focus always visible, no trap, Escape closes overlays.
- [ ] **One screen-reader spot check** — VoiceOver (macOS, ⌘F5) or NVDA (Windows). Do names, roles, and state read sensibly? Are errors announced?
- [ ] **Zoom to 200%** — no content lost, no horizontal scroll, nothing clipped.
- [ ] **`prefers-reduced-motion`** honored — no autoplay parallax/animation that ignores it.
- [ ] **Alt text is meaningful, not decorative-as-content** — informative images describe; decorative images use `alt=""`.

Full AA checklist grouped by POUR, with the per-item auto/manual split and the 6 new 2.2 criteria flagged → `references/wcag22-checklist.md`.

## Anti-patterns

| Anti-pattern                                   | Why it fails                                              | Do instead                                          |
| ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `<div role="button" onClick>`                  | No keyboard, no focus, you owe all behavior by hand      | `<button>`                                          |
| `outline: none` with no replacement            | Keyboard users lose all focus location (2.4.7)           | `:focus-visible` ring                               |
| Positive `tabindex` (`tabindex="3"`)           | Hijacks page tab order, breaks for everyone              | DOM order + `tabindex="0"`/`-1`                      |
| Placeholder as the only label                  | Disappears on input, many SRs skip it                    | real `<label for>`                                  |
| `aria-label` on a non-interactive `<div>` text | Duplicates or overrides visible text confusingly         | label only interactive/landmark elements            |
| `aria-hidden="true"` on a focusable element    | Reachable by Tab but silent — a trap                     | remove from tab order too, or don't hide it         |
| Error shown by red color only                  | Invisible to color-blind / low-vision users (1.4.1)      | color **+** text **+** icon, `aria-describedby`     |
| Redundant `role="button"` on `<button>`        | Noise; native role is already correct                    | drop the role                                       |
| Shipping on a green axe run                    | Covers ~57%; keyboard/SR/cognitive untested              | run the manual checklist                            |
| Autoplaying motion, no reduced-motion guard    | Triggers vestibular disorders (2.3.3)                    | gate behind `prefers-reduced-motion`                |

## Hand off to

- Test harness, render setup, fixtures, CI runner mechanics → `../testing-web/SKILL.md` (this skill supplies the a11y *assertions* that run inside it)
- Full browser-driven flow orchestration → `../e2e-testing/SKILL.md`
- Visual intent, color palette, spacing scale → `../design/SKILL.md` (this skill checks the contrast/target-size *outcome*, not the aesthetic)
- Framework component architecture → `../react/SKILL.md` / `../nextjs/SKILL.md`
- Page speed / LCP / Core Web Vitals tuning → the **performance** skill (not an a11y concern)
