---
name: ux
description: "Use when an app or SaaS must be easy to use: designing complete user flows, screens and every state, navigation, forms, onboarding, tables, dashboards, search or AI features, or auditing usability and accessibility. Anyone finishes the job without a manual; experts go fast. NOT the visual direction (design), NOT the words (landing-copy)."
tags: [ux, usability, user-flows, flows, screens, states, empty-state, signup, modal, saas, app, product-design, navigation, forms, onboarding, dashboard, productivity, accessibility, wcag, interaction-design, usabilidad, flujos, pantallas]
recommends: [design, accessibility, landing-copy, react]
profiles: [minimal, core, full]
origin: risco
---

# ux

The bar: someone who has never seen the product finishes the main job **without asking anyone**,
someone who uses it every day finishes it **fast**, and nobody loses work when something fails. A
screen that looks good and misses that bar is not done.

- **The flow comes before the screen.** Map the whole journey, from arrival to the job done and back
  again, before drawing anything.
- **Every screen answers five questions:** where am I, what is this, what can I do, what just
  happened, where do I go next.
- **Every state is designed,** not only the full one: empty, loading, error, offline, no permission,
  too much data.
- **You prove it by using it,** in a real browser, with the keyboard, at phone width. Reading the
  code is not a check.

The depth ships in `upstream/`, two MIT skills copied unmodified (`THIRD_PARTY.md`). This file is the
method; load only the reference the task touches (table in **Files**).

## 0. Name the job

Write four lines before anything else: **who** (first-time, occasional, daily expert, admin),
**the job** in their words, **done when** (what they can see), and **the risk** (money, data, legal,
irreversible). Assume motivated but distracted people with average domain knowledge and imperfect
memory.

Ask one question only when the answer changes the design: the main task is unclear, the action is
risky or irreversible, novices and experts need different things, the platform is unknown, or the
request asks for a hidden or manipulative pattern. The ready-made questions, each with its default,
are in `upstream/ux-usability-foundations/references/decision-prompts.md`. Everything else is
decided by the defaults in `upstream/ux-usability-foundations/GUIDE.md`.

## 1. Map the whole flow

Use [references/flows.md](references/flows.md): the flow map, the lifecycle (sign-up, empty
account, first value, the daily loop, limits, permissions, failures, offline, leaving and coming
back), the second role (whoever is invited, not only the admin who set it up), and the step count of
the core loop. Output a table with one row per step and screen. Missing lifecycle rows are the usual
reason an app "feels broken".

## 2. Design each screen

1. **One job and one primary action.** The primary action is named with a verb and an object
   ("Send invoice"), it is the strongest element, and the destructive action is never the primary
   one.
2. **Pick the pattern from the job:** list, detail, form, wizard, settings, dashboard, search, or an
   overlay. Decision trees (modal, side panel or page; which notification type) are in
   `upstream/ux-designer/GUIDE.md`. Navigation and IA in `05-information-architecture.md`.
3. **Fill the state matrix** in `references/flows.md` for every screen: default, loading, empty
   (new account and filtered to zero), partial, error, offline, no permission, overflow, pending.
4. **Prevent, then recover:** constraints and safe defaults first, inline validation, input kept
   across every failure, undo for anything reversible, confirmation only for the irreversible.
   Forms in `07-forms-and-inputs.md`.
5. **Speed for experts:** keyboard shortcuts, command search, bulk actions, saved views, remembered
   filters, sensible defaults. They never replace the visible route for everyone else.
6. **Accessible from the start:** native elements first, keyboard reaches everything, visible focus,
   labels, colour never the only signal, targets of at least 24×24 CSS px. WCAG 2.2 AA in
   `03-accessibility.md`.

The rules with their numbers (contrast, type, timing, targets, toasts) are in
`upstream/ux-designer/GUIDE.md` › *Core rules* and *Reference values*. Use them; do not invent
others.

## 3. How it looks

The visual direction (type, palette, composition, pictures) is `../design/SKILL.md`'s, and it runs its
engine on the screens this skill has specified. What stays here is the hierarchy that serves the job:
one dominant element per screen, three levels of emphasis, one spacing scale, colour that means state,
density chosen by the job (monitoring dense, onboarding calm). The tells of generated interfaces are
listed in `upstream/ux-designer/GUIDE.md` › *Generated-UI defaults to avoid*, and visual detail in
`04-visual-design.md`.

## 4. Prove it by using it

Walk the main job from a cold start in a real browser (the Chrome DevTools tools, when present): a new
account, then one with data. Then the extremes: keyboard only, 320px wide, 200% zoom, a long
translated string, empty data, a lot of data, a slow network, a failed request. Run axe or Lighthouse
when the browser is there. Write down every hesitation and fix the hesitations before polishing
anything. A check that could not run is reported as not run.

## Review mode

When the task is to audit an existing interface: steps 0 and 4 first, then report findings ranked
by impact on the job, in the format of `upstream/ux-designer/GUIDE.md` › *Reviewing or auditing a
UI* (Blocker / Major / Minor, where, fix, reference). Inspection order and the full checklists:
`upstream/ux-usability-foundations/GUIDE.md` › *Workflow for critiquing* and
`references/checklists.md`. Split quick wins from structural changes. If nothing serious turns up,
say so in one line.

## Report

Say briefly: the person and the job; the flow map; the screens with their primary action and the
states covered; what was walked in the browser and what was not; the findings or decisions with
their reference; what still needs real data or real users to confirm.

## Hand-offs

- Visual direction, type, palette, pictures, landing pages → `../design/SKILL.md`.
- The words on a marketing or conversion page → `../landing-copy/SKILL.md`.
- A formal WCAG conformance programme or audit → `../accessibility/SKILL.md`.
- Component code, state and data fetching → `../react/SKILL.md` or `../nextjs/SKILL.md`.
- Measuring a flow with real users at scale → `../analytics/SKILL.md`, `../ab-testing/SKILL.md`.

## Files

| Load when the task involves… | File |
| --- | --- |
| The whole journey, lifecycle, roles, state matrix | [references/flows.md](references/flows.md) |
| Workflows, core rules, numbers, decision trees, generated-UI tells | `upstream/ux-designer/GUIDE.md` |
| Principles, defaults, questions to ask, critique order | `upstream/ux-usability-foundations/GUIDE.md` |
| Questions with their recommended default | `upstream/ux-usability-foundations/references/decision-prompts.md` |
| Principles as cards, full checklists, anti-patterns | `upstream/ux-usability-foundations/references/` › `principle-cards.md`, `checklists.md`, `anti-patterns.md` |
| Nielsen's heuristics, Gestalt | `upstream/ux-designer/references/01-core-principles.md` |
| Fitts, Hick, Jakob, Tesler, peak-end | `…/02-laws-of-ux.md` |
| WCAG 2.2, ARIA, EAA | `…/03-accessibility.md` |
| Type, colour, spacing, hierarchy, dark mode | `…/04-visual-design.md` |
| Navigation, sitemaps, card sorting | `…/05-information-architecture.md` |
| Modals, tooltips, drag and drop, motion timing | `…/06-interaction-design.md` |
| Forms, validation, input types, errors | `…/07-forms-and-inputs.md` |
| Touch, gestures, responsive, mobile navigation | `…/08-mobile-ux.md` |
| Microcopy, error messages, tone | `…/09-ux-writing.md` |
| Interviews, usability tests, surveys, metrics | `…/10-user-research.md` |
| Tokens, component APIs, design system docs | `…/11-design-systems.md` |
| Presence, cursors, avatars | `…/12a-presence-awareness.md` |
| Conflicts, sync, offline, sharing, history | `…/12b-conflict-resolution-sync.md` |
| Canvas zoom, pan, selection; layers, snapping, performance | `…/13a-canvas-navigation.md`, `…/13b-canvas-objects-performance.md` |
| Chat, copilots, agents, generative UI | `…/14-ai-ux-patterns.md` |
| Dark patterns, consent, DSA and GDPR interface rules | `…/15-ethical-design.md` |
| First run, activation, empty states, checklists | `…/16-onboarding.md` |
| Notifications, push, toasts, preferences | `…/17-notifications.md` |
| Charts and dashboards | `…/18-data-visualization.md` |
| Search, autocomplete, filters, zero results | `…/19-search-ux.md` |
| Trust, delight, recovering from errors | `…/20-emotional-design.md` |
| Tables, sorting, pagination, bulk actions | `…/21-data-tables.md` |
| Loading, skeletons, optimistic updates, Core Web Vitals | `…/22-performance-ux.md` |
| Localisation, RTL, `Intl`, plurals | `…/23-internationalization.md` |
| Voice and multimodal input | `…/24-voice-and-multimodal.md` |
| Barcodes and QR: scanning, scanner workflows, display | `…/25a-barcode-camera-scanning.md`, `…/25b-barcode-scanner-workflows.md`, `…/25c-barcode-display.md` |
| Which upstream versions ship here, with file hashes | `upstream/UPSTREAM.json` |

`…/` is `upstream/ux-designer/references/`.
