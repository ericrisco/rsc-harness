---
name: ux-saas
description: "Use when designing or auditing a whole SaaS app: full user flows from sign-up to the core job, navigation, forms, empty/loading/error states, undo, tables, dashboards and visual hierarchy, so anyone can use it without a manual. NOT landing pages (`design`), page copy (`landing-copy`), component code (`react`), dashboard data (`dashboard`)."
tags: [ux, usability, saas, product-design, flows, onboarding, navigation, forms, empty-states, dashboard, app-ui, accessibility]
recommends: [design, dashboard, accessibility, react]
profiles: [core, full]
origin: risco
---

# UX SaaS — flows, usability and visual clarity for applications

Use this skill when the object is an **application**: something people log into and work in, every
day, toward a task. The question it answers is not "does this look good?" but "can a new person finish
the job without asking anyone, and can an experienced one finish it fast?" Good looks follow from
that, and they never replace it.

Three jobs, in this order:

1. **Map the flow.** Name the person, the job, and every step from first contact to the moment the job
   is done. A screen without a place in a flow is decoration.
2. **Make each screen answer five questions** at a glance: where am I, what is this, what can I do
   here, what just happened, and where do I go next.
3. **Make it beautiful by subtraction.** One dominant element per screen, a clear type scale, one
   spacing scale, color used to mean something. Then check it by using it, not by looking at it.

The reference files go deeper. Load only the one the task touches (routing table at the end).

---

## Principles to hold

- **One job per screen.** If a screen serves two jobs, it becomes two screens or one screen with a
  clear primary path and a quiet secondary one.
- **The next action is obvious.** Exactly one primary action per view. Secondary actions are visible
  but quieter. Destructive actions are never the primary one.
- **Labels in the user's words.** "Invite teammate", not "Provision seat". Never expose table names,
  internal IDs or system states the person does not need.
- **Show, do not hide.** What can be clicked looks clickable. What is read-only does not look like an
  input. No essential action lives behind hover, a long press or an icon with no label.
- **Recognition over recall.** Keep the options, the current filter and the context on screen. Do not
  make people remember what they chose two steps ago.
- **Prevent before explaining.** Constrain input, default sensibly, validate as the person goes, and
  keep what they typed when something fails.
- **Feedback for every consequential action.** Did the system receive it? What changed? Is there
  something still running? What can happen next?
- **Forgive.** Undo for anything reversible. Confirmation only for what cannot be undone. Never make a
  person start over after a recoverable failure.
- **Accessible by default.** Keyboard reaches everything, focus is visible, state changes are
  announced, color is never the only signal, targets are large enough to tap.

---

## Workflow A — designing a complete flow

1. **Frame the person and the job.** Who uses it (first-time, occasional, daily expert, admin), what
   they are trying to finish, and what "done" looks like. One sentence each. If the job is unclear,
   ask one question about it before drawing anything.
2. **Write the flow as a path.** Entry → first value → core loop → finish or hand-off → exit or return.
   List every screen on that path, and every state each screen can be in. See `references/flows.md`.
3. **Cover the lifecycle.** Sign-up, first run, the empty account, the normal account, the account at
   its limit, the account with permission problems, the account that is offline, and the account that
   is being deleted or left. Missing one of these is the usual reason a flow feels broken.
4. **Pick the pattern per screen.** List, detail, form, wizard, settings, dashboard, search results,
   or an overlay. The decision table is in `references/screen-patterns.md`.
5. **Design every state of every screen:** default, loading, empty, partial, error, offline,
   no-permission, and overflow (long names, zero items, ten thousand items). A screen that is only
   designed in its happy state is not designed.
6. **Set the orientation chrome:** where the person is, how to go back, how to switch context. Keep
   the top level short and visible. Desktop navigation is not hidden behind a menu icon.
7. **Walk the flow yourself** with the keyboard only, at a phone width, and with one hand. Note every
   hesitation. Fix the hesitations before polishing anything.

## Workflow B — reviewing an existing app

1. Establish the job and the user. Without them, you can only review consistency, not usability.
2. **Use it.** Run the main job from a cold start: a new account, then a used account. If a browser
   is available, drive it and take screenshots. Reading the code alone misses layout, focus order and
   what the loading state actually looks like.
3. **Check the extremes:** 320px wide, 200% zoom, a long translated string, empty data, huge data,
   slow network, a failed request, and a right-to-left locale if the product is localized.
4. **Score each finding by user impact**, not by checklist order, using the format in
   `references/review-checklist.md`. A blocker stops the job or breaks an accessibility requirement.
5. Say plainly when a pass finds nothing serious. Do not pad with praise.

## Workflow C — building the screens

1. **Reuse first.** Look for the existing design system, tokens, components and sibling screens, and
   match them even where your taste differs. The system owns consistency; this skill owns the flow.
2. **Build from the states down.** Write the empty, loading and error states before the populated one.
   They are where people decide whether the product is trustworthy.
3. **Use native semantics first.** Real buttons, links, labels, dialogs and inputs. Add ARIA only when
   no native element fits.
4. **Render it and look at it** at phone width, at desktop width, with the keyboard, and in dark mode
   if the product supports it. Fix what you see, then look again.

---

## Usability rules that catch most problems

| Problem | Rule | Where it lives |
| --- | --- | --- |
| "What do I click?" | One primary action per view, named with a verb and an object: "Save changes", "Send invoice". | `references/usability-rules.md` |
| "Did it work?" | Immediate receipt, visible progress for anything over a second, visible result on completion. | `references/usability-rules.md` |
| "I lost what I typed." | Preserve input across validation, auth and network failures. | `references/forms-and-errors.md` |
| "Where am I?" | A visible location: section, object, and state (unsaved, syncing, offline). | `references/screen-patterns.md` |
| "I'm new and lost." | An empty state that names the next action; onboarding that reaches first value, skippable. | `references/flows.md` |
| "There are too many things." | Progressive disclosure: the common path first, advanced options near the point of need. | `references/usability-rules.md` |
| "I'm scared to click." | Undo beats confirmation. Confirm only the irreversible, and say what it will destroy. | `references/forms-and-errors.md` |

## Visual clarity — what makes an app look expensive

- **Hierarchy before decoration.** Three levels of emphasis is enough: the primary thing, the context,
  the detail. Size, weight and position do the work; color and borders confirm it.
- **One type scale, few sizes.** Body text 14–16px in dense apps, never below 12px for anything a
  person must read. Line length 50–75 characters for prose.
- **One spacing scale** in 4px or 8px steps. Group with space before you group with boxes.
- **Color means something.** A small palette: neutrals for structure, one accent for the primary
  action, semantic colors (success, warning, danger) used only for state. Text contrast at least 4.5:1.
- **Density follows the job.** A monitoring dashboard can be dense. An onboarding screen should not.
- **Restraint.** Each card, badge, gradient or icon has to earn its place. Full list of defaults that
  mark an interface as generated: `references/visual-craft.md`.

---

## Anti-patterns → stop and fix

- A screen that only shows the populated state.
- A "Submit" button on a form whose job is "Create invoice".
- Equal visual weight on every button.
- A disabled button with no explanation.
- Hover-only tooltips carrying essential information.
- Infinite scroll with no position, no count and no way back.
- Errors that say "Something went wrong" and nothing else.
- Confirmation dialogs for actions that can be undone.
- Settings buried three levels down that users need weekly.
- A modal for a task that needs the whole screen, or a full page for a yes/no question.
- Onboarding tours that cannot be skipped.
- Decorative cards nested inside cards.

Each anti-pattern has a fix in the reference files.

---

## Reference routing

| Load when the task involves… | File |
| --- | --- |
| Mapping a whole journey, sign-up, first run, lifecycle states | `references/flows.md` |
| Choosing a pattern: list, detail, wizard, settings, dashboard, overlay | `references/screen-patterns.md` |
| Labels, feedback, undo, destructive actions, progressive disclosure | `references/usability-rules.md` |
| Forms, validation, errors, recovery, confirmations | `references/forms-and-errors.md` |
| Typography, color, spacing, dark mode, the generated-UI tells | `references/visual-craft.md` |
| Auditing an app, severity format, the state matrix, the checklist | `references/review-checklist.md` |

## Sources and credits

The reference files are original rewrites of ideas from two MIT-licensed skill libraries:
`szilu/ux-designer-skill` (usability heuristics, screen and form patterns, the state matrix) and
`hueyexe/frontend-agent-skills` › `ux-usability-foundations` (principles, the questions to ask before
designing, the anti-pattern list). Wording is rewritten for rsc. The underlying canon is Nielsen's
heuristics, the Laws of UX, WCAG 2.2, and Material and Apple platform guidance.
