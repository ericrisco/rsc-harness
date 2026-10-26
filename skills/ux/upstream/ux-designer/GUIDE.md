# UX Designer

Use this skill for three jobs: **reviewing** an interface (a screenshot, a URL, or code), **building** UI, and **advising** on a design decision. You know the general UX canon already. This file gives you the workflows, the numbers, and the calls that are easy to get wrong. The reference files go deeper, so load only the ones the task needs (see the routing table).

## Philosophy

- **Calm over clever.** Motion, color, and density have to help the user understand something. Decoration that only impresses is noise.
- **Judgment over polish.** Anyone can generate polished UI now, so the value is in correctness, research, and knowing what to leave out.
- **AI as copilot, not autopilot.** AI assistance is optional, labeled, reversible, and the user stays in control.
- **Adapt to real needs.** Avoid opaque or manipulative personalization.

## Workflow: Reviewing or auditing a UI

1. **Establish context.** Identify the users, their primary task, the platform, and any stated constraints (brand, design system, legal regime). If there's no context, assume a general audience and say so.
2. **Look at the real thing.** Render it if you can: take a screenshot or open it in the browser. Walk through the primary task with the keyboard only, and run an automated checker (axe, Lighthouse) when a browser is available. Reading code alone misses contrast, overflow, focus order, and layout at other widths.
3. **Check at the extremes.** Try 320px width, 200% zoom, a long translated string, empty data, huge data, a slow network, an error state, and `dir="rtl"` if the product is localized.
4. **Report findings ranked by user impact**, not in checklist order:

   ```
   [Blocker|Major|Minor] <what is wrong> — <who it hurts and how>
     Where: <screen/component or file:line>
     Fix: <concrete change>   Ref: <heuristic / WCAG SC / reference file>
   ```

   A blocker stops a user from completing the task, or it's a legal accessibility failure. Cite WCAG success criteria by number (for example, 2.4.11 Focus Not Obscured). Skip praise padding. If a pass finds nothing serious, say that plainly.

## Workflow: Building UI

1. **Reuse before inventing.** Look for an existing design system, tokens, component library, and nearby screens. Match them, even where your own taste differs.
2. **Design every state,** not only the happy path: empty, loading, partial, error, offline, permission-denied, and overflow (long names, 0/1/many items).
3. **Semantics first.** Start from native elements (`<button>`, `<label>`, `<dialog>`, `<details>`, `<input type=…>`). Add ARIA only when no native element fits.
4. **Verify by looking.** Render the result. Check it at mobile width, with the keyboard, and in dark mode if the product supports it. Fix what you see and check again.

### Generated-UI defaults to avoid

These are telltale marks of model-generated interfaces. Don't use them unless the brand calls for them:
- Purple/indigo gradients, glassmorphism, and glow shadows used as default styling
- Emoji standing in for icons, and decorative icons on every heading or list item
- A card around everything, nested cards, and every section centered with the same padding
- Hero sections, testimonials, and marketing filler inside app UI that doesn't need them
- Lorem-ipsum-perfect sample data: use realistic lengths, names from several locales, and edge cases
- Buttons that all carry equal visual weight, with no single primary action
- Gray-on-gray low-contrast "minimal" text
- Hover-only affordances with no touch or keyboard equivalent

## Core rules

**Visual.** Give each screen one dominant element. Body text is 16px or larger, with 1.4–1.6 line height and 50–75 characters per line. Text contrast is at least 4.5:1, or 3:1 for large text and UI component boundaries. Take all spacing from one 4px or 8px scale.

**Interaction.** Show visible feedback within 100ms. Most UI transitions run 150–300ms, and only large or spatial motion goes up to 500ms. Honor `prefers-reduced-motion`. On mobile, put primary actions in the thumb zone. Never disable a button without saying why.

**Forms.** Put labels above fields and never use placeholder-only labels. Validate on blur and re-validate on input once a field has shown an error. Show errors next to the field and summarize them at submit. Ask only for what you need. Mark whichever set of fields is the minority, required or optional.

**Navigation.** The current location is always visible. Keep the top level scannable: about 5–7 items on desktop and 3–5 in a mobile bottom bar. Miller's 7±2 is a working-memory figure, not a menu rule. On desktop, don't hide primary navigation behind a hamburger.

**Accessibility.** Everything is operable by keyboard, and focus is visible and never hidden behind sticky UI. Every control has an accessible name and role. Color is never the only signal. Images have meaningful alt text, or `alt=""` if they're decorative. Targets are at least 24×24 CSS px (WCAG 2.5.8 AA), with 44pt (iOS) or 48dp (Android) recommended on touch. Treat WCAG 2.2 AA as the legal target. WCAG 3 is still a draft.

**Collaboration.** Show presence (avatars, cursors, selections), make sync and offline state visible, keep undo per client, and state permission levels plainly.

**Canvas.** Zoom around the cursor, not the screen center. Snapping has a toggle. Provide a minimap for large boards, full keyboard navigation, and viewport culling.

**AI.** Label AI content, attribute sources, and provide stop/cancel, edit/regenerate, feedback, and undo for any AI-applied change. Keep a human override.

**Onboarding.** Guide the user to the first real value, not a tour. Make it skippable and never show it again once finished. Empty states give the next action.

**Notifications.** Match visual severity to real severity. Ask for push permission in context, after the user has seen value. Give users per-channel control. Toasts auto-dismiss after 4–8s, except toasts that carry an action, which stay until dismissed (WCAG 2.2.1).

**Ethics.** Accept and reject get equal prominence. Optional consent boxes start unchecked. Cancelling is as easy as signing up. No confirmshaming.

**i18n.** Use logical CSS properties and verify the layout in `dir="rtl"`. Allow 30–40% text expansion and no fixed-width labels. Externalize all strings and keep text out of images. Format dates, numbers, and currency with `Intl`, and handle plurals with ICU rules. Language switchers use endonyms, not flags.

## Decision trees

### Modal vs. side panel vs. full page

```
Quick confirmation or 1-3 fields?                 → Modal
Edit details while keeping context visible?
  narrow content (form, properties, chat)         → Side panel
  needs width                                     → Full-page overlay with back
Multi-step: short steps → modal + stepper; long steps / needs reference → full page + stepper
Creating a complex entity (document, project)?    → Full page
```

### Notification type

```
Blocking, must resolve now                        → Modal
Urgent, non-blocking                              → Banner, persistent until dismissed
Completed action: success/info                    → Toast, auto-dismiss 4-8s
Completed action: warning/error or has action     → Toast, manual dismiss
Background event, same context                    → Badge + inline indicator
Background event, elsewhere                       → Nav badge (+ optional push)
System status (maintenance, connectivity)         → Persistent banner
```

## Reference routing

Load the file when the task touches its topic. Each file opens with a table of contents, so you can jump to the section you need.

| Load when the task involves… | File |
|---|---|
| Heuristic evaluation, Nielsen's 10, Gestalt | [references/01-core-principles.md](references/01-core-principles.md) |
| Fitts, Hick, Jakob, Tesler, peak-end, and similar laws | [references/02-laws-of-ux.md](references/02-laws-of-ux.md) |
| WCAG 2.2 criteria, ARIA, EAA / legal compliance | [references/03-accessibility.md](references/03-accessibility.md) |
| Typography, color, spacing, hierarchy, dark mode | [references/04-visual-design.md](references/04-visual-design.md) |
| Navigation structure, sitemaps, card sorting | [references/05-information-architecture.md](references/05-information-architecture.md) |
| Modals, tooltips, drag-and-drop, motion timing | [references/06-interaction-design.md](references/06-interaction-design.md) |
| Form layout, validation, input types, errors | [references/07-forms-and-inputs.md](references/07-forms-and-inputs.md) |
| Touch targets, gestures, responsive, mobile nav | [references/08-mobile-ux.md](references/08-mobile-ux.md) |
| Microcopy, error messages, voice and tone | [references/09-ux-writing.md](references/09-ux-writing.md) |
| Interviews, usability tests, surveys, metrics | [references/10-user-research.md](references/10-user-research.md) |
| Tokens, component APIs, design system docs | [references/11-design-systems.md](references/11-design-systems.md) |
| Live cursors, avatars, typing/presence indicators | [references/12a-presence-awareness.md](references/12a-presence-awareness.md) |
| Conflicts, sync, offline, sharing, version history | [references/12b-conflict-resolution-sync.md](references/12b-conflict-resolution-sync.md) |
| Canvas zoom, pan, selection, manipulation | [references/13a-canvas-navigation.md](references/13a-canvas-navigation.md) |
| Canvas layers, snapping, LOD, rendering performance | [references/13b-canvas-objects-performance.md](references/13b-canvas-objects-performance.md) |
| Chat UI, copilots, agents, generative UI | [references/14-ai-ux-patterns.md](references/14-ai-ux-patterns.md) |
| Dark patterns, consent, DSA/GDPR UI rules | [references/15-ethical-design.md](references/15-ethical-design.md) |
| First-run, activation, empty states, checklists | [references/16-onboarding.md](references/16-onboarding.md) |
| Notification systems, push, toasts, preferences | [references/17-notifications.md](references/17-notifications.md) |
| Charts, dashboards, accessible data viz | [references/18-data-visualization.md](references/18-data-visualization.md) |
| Search, autocomplete, filters, zero results | [references/19-search-ux.md](references/19-search-ux.md) |
| Delight, trust, tone, error recovery emotion | [references/20-emotional-design.md](references/20-emotional-design.md) |
| Tables, sorting, pagination, bulk actions | [references/21-data-tables.md](references/21-data-tables.md) |
| Loading, skeletons, optimistic updates, Core Web Vitals | [references/22-performance-ux.md](references/22-performance-ux.md) |
| Localization, RTL, `Intl`, plurals, text expansion | [references/23-internationalization.md](references/23-internationalization.md) |
| Voice, multimodal, cross-device input | [references/24-voice-and-multimodal.md](references/24-voice-and-multimodal.md) |
| Camera barcode/QR scanning on phone or web, viewfinder, QR safety | [references/25a-barcode-camera-scanning.md](references/25a-barcode-camera-scanning.md) |
| Scan-driven apps: warehouse, POS, healthcare, rugged or wedge scanners, GS1 | [references/25b-barcode-scanner-workflows.md](references/25b-barcode-scanner-workflows.md) |
| Showing barcodes/QR: tickets, wallet passes, QR login, printed labels | [references/25c-barcode-display.md](references/25c-barcode-display.md) |

## Reference values

| Metric | Value | Source / note |
|---|---|---|
| Target size | ≥ 24×24 CSS px (AA); 44pt iOS / 48dp Android | WCAG 2.5.8; Apple HIG; Material |
| Body text | ≥ 16px, line height 1.4–1.6 | WCAG 1.4.12 tests up to 1.5 |
| Line length | 50–75 characters | |
| Text contrast | 4.5:1 normal, 3:1 large (≥ 24px, or ≥ 18.66px bold) | WCAG 1.4.3 |
| Non-text contrast | 3:1 (UI boundaries, focus rings, icons) | WCAG 1.4.11 |
| Feedback latency | < 100ms feels instant; > 1s show a spinner; > 10s show progress with cancel | Nielsen response-time limits |
| Transitions | 150–300ms typical, ≤ 500ms for large motion | Material motion |
| Loading indicator delay | ~300ms before showing, to avoid flashes | |
| Toast | 4–8s auto-dismiss (no actions) | |
| Text expansion | 30–40% (DE/FI/RU), up to 200%+ for short strings | W3C i18n |
| Working memory | ~4±1 chunks (Cowan); 7±2 (Miller) is dated | |
| Canvas | cursor updates 50–100ms, 60fps pan/zoom, 2–8px snap threshold, 10%–4000% zoom | Figma-class tools |
| Avatar stack | 3–5 visible, then "+N" | |
| AI response | first token < 1s, or show immediate progress | |
| Displayed QR code | 4-module quiet zone; module ≥ 0.25 mm physical; error correction M by default | ISO/IEC 18004; IATA BCBP; DENSO WAVE |
| QR size vs. distance | ≥ 2×2 cm, +1 cm per 10 cm of scan distance | NN/g heuristic |

Numbers like conversion rates, NPS targets, and completion percentages depend on context. Don't quote benchmarks as universal facts. Recommend measuring against the product's own baseline.

## Anti-patterns

Each one points to the reference file that covers the fix.

- Dark patterns, confirmshaming, asymmetric consent → [15](references/15-ethical-design.md)
- Hidden desktop navigation, no sense of location → [05](references/05-information-architecture.md)
- Infinite scroll without position or a footer → [21](references/21-data-tables.md)
- Autoplaying media, color-only signals, invisible focus → [03](references/03-accessibility.md)
- Disabled buttons with no explanation, modal overuse → [06](references/06-interaction-design.md)
- Walls of text, no hierarchy → [04](references/04-visual-design.md)
- Tiny touch targets → [08](references/08-mobile-ux.md)
- Missing loading, empty, or error states → [22](references/22-performance-ux.md)
- Silent sync failures, no offline indication → [12b](references/12b-conflict-resolution-sync.md)
- Cursor overload, no presence → [12a](references/12a-presence-awareness.md)
- Screen-center zoom → [13a](references/13a-canvas-navigation.md)
- Hidden AI, AI changes applied without consent or undo → [14](references/14-ai-ux-patterns.md)
- Mandatory long tours → [16](references/16-onboarding.md)
- Notification carpet bombing, push permission on first visit → [17](references/17-notifications.md)
- Hardcoded strings, fixed widths, LTR-only layout → [23](references/23-internationalization.md)
- Voice-only flows, hidden mic, no recognition feedback → [24](references/24-voice-and-multimodal.md)
- Scan-only flows with no manual entry, silent scan failures → [25a](references/25a-barcode-camera-scanning.md) / [25b](references/25b-barcode-scanner-workflows.md)

## Sources

[Laws of UX](https://lawsofux.com/) · [Nielsen Norman Group](https://www.nngroup.com/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Material Design](https://m3.material.io/) · [Apple HIG](https://developer.apple.com/design/) · [Baymard Institute](https://baymard.com/) · [Google PAIR](https://pair.withgoogle.com/guidebook) · [Microsoft HAX](https://www.microsoft.com/en-us/haxtoolkit/) · [Deceptive Design](https://www.deceptive.design/) · [EU DSA](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package) · [EU Accessibility Act](https://ec.europa.eu/social/main.jsp?catId=1202) · [W3C i18n](https://www.w3.org/International/) · [Liveblocks](https://liveblocks.io/) · [Figma Engineering](https://www.figma.com/blog/category/engineering/) · [Tufte](https://www.edwardtufte.com/) · [ColorBrewer](https://colorbrewer2.org/) · [web.dev](https://web.dev/)
