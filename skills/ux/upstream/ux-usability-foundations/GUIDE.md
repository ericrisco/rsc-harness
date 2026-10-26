# UX Usability Foundations

## Purpose

Help an agent make interfaces understandable, usable, forgiving, and aligned with user expectations. Treat usability as product behavior, not surface decoration. The agent should turn unclear or fragile UI into an interface where users can quickly answer: what is this, what can I do here, where am I, what happened, how do I recover, and is this worth the effort?

## When to use this skill

Use this skill when the user asks you to critique, redesign, create, or specify a UI, flow, form, app screen, website, dashboard, onboarding, settings page, checkout, navigation model, state behavior, or component interaction for usability. Use it for affordances/signifiers, feedback, constraints, errors, empty/loading/success states, recognition over recall, task clarity, and frontend behavior.

## When not to use this skill

Do not use as the primary skill for deep research operations, brand styling systems, visual polish, typography craft, frontend architecture, or persuasion/growth tactics unless those choices directly affect user understanding, control, or recovery.

## Core principles

1. **Start with goals, not screens.** Identify the user’s goal, task, context, and likely knowledge before changing controls or layout. Design requirements describe needs before widgets.
2. **Make the next action obvious.** Prefer self-evident interfaces. If the task is inherently novel or complex, make it self-explanatory with structure, labels, examples, and feedback.
3. **Show what is possible.** Interactive elements must look interactive. Read-only elements must not look editable. Hidden gestures need visible alternatives.
4. **Match the user’s mental model.** Use the concepts, names, and sequence users understand; do not expose database tables, file paths, internal IDs, or arbitrary system states unless users need them.
5. **Favor recognition over recall.** Keep needed options, context, examples, and state visible or easy to retrieve.
6. **Reduce work and excise.** Remove tasks that serve the system rather than the user’s goal: retyping, transferring data, hunting for controls, configuring obvious defaults, or answering inferable questions.
7. **Guide choices without overloading users.** Use progressive disclosure, sensible defaults, grouping, and prioritization.
8. **Give immediate, informative feedback.** Every consequential action needs a response that says whether the system received it, what changed, whether waiting is required, and what can happen next.
9. **Prevent errors before explaining them.** Use constraints, safe defaults, previews, tolerant input, inline validation, and undo where feasible.
10. **Blame the design, not the user.** Errors reveal a mismatch in expectations or an unsupported edge case. Preserve work and guide recovery.
11. **Respect platform and convention.** Use familiar patterns when they fit. Break convention only when the user’s goal clearly benefits and the new behavior can be discovered and recovered from.
12. **Accessibility is usability under pressure.** Design for perceptibility, operability, simplicity, and forgiveness across varied abilities, devices, literacy, stress, and environments.

See [references/principle-cards.md](references/principle-cards.md) for each principle as a reusable card.

## Default recommendations

### Product goal
Default to optimizing the primary user task before secondary business asks. Override only for legal, safety, fraud, privacy, or business-critical requirements. Ask: “Which obligation must interrupt or constrain the primary task, and what is the consequence of hiding or delaying it?”

### Audience
Default to motivated but distracted users with average domain knowledge and imperfect memory. Override for trained expert operators using the product frequently under stable conditions. Ask: “Is this primarily for first-time/infrequent users, frequent intermediates, or trained experts?”

### Platform and input
Default to platform conventions and support pointer, touch, keyboard, and assistive technology where relevant. Ask when platform/input constraints are unknown.

### Information density
Default to enough context for recognition and decision-making, while hiding rare advanced controls behind clear entry points. Override for comparison, monitoring, or expert workflows. Ask: “Do users need overview density for monitoring/comparison, or step-by-step focus for completion?”

### Navigation
Default to clear location, current object/state, access to major areas, and a visible route back or onward. Override only for intentional guided flows. Ask: “Should users be free to move around, or should this flow intentionally constrain navigation?”

### Labels and language
Default to plain, task-oriented labels from the user’s vocabulary. Ask before using internal, clever, legal, or domain-specific terms.

### Forms
Default to persistent labels, appropriate input types, upfront constraints, inline validation where helpful, preserved data, and a clear primary action. Ask only when density/speed for experts may be more important than first-time clarity.

### Error handling
Default to prevention first; if error occurs, explain what happened, why it matters, and how to fix it without losing work. Ask when error details are sensitive, regulated, or security-relevant.

### Destructive actions
Default to visually secondary destructive actions until the final review/confirmation step. Prefer undo for reversible actions; use confirmation for irreversible, costly, legal, or safety actions. Ask about reversibility and harm.

### Feedback and status
Default to instant receipt feedback, progress for delays, visible completion, and persistent state for long-running or consequential operations. Ask which status changes should interrupt.

### Accessibility
Default to WCAG-oriented basics: semantic controls, keyboard operation, focus visibility, programmatic labels, sufficient contrast, no color-only meaning, readable copy, and screen-reader-friendly state updates. Do not override basics.

## Required user questions

Do not ask routine best-practice questions. Ask one focused question only when the answer changes the recommendation:

- The primary user/task is unclear.
- The action has safety, financial, legal, privacy, medical, or irreversible consequences.
- Novices and experts need different behaviors.
- Platform/input constraints are unknown.
- Required terminology or compliance copy may apply.
- The user requests a nonstandard, hidden, or manipulative pattern.
- There is a real tradeoff between density and clarity or between guided flow and free navigation.

Use this pattern:

```js
question({
  question: "What is the primary task this interface must help users complete?",
  recommended_default: "Optimize for the most common successful task first, then make secondary actions available but visually quieter.",
  options: [
    "Complete one focused task",
    "Compare or monitor multiple items",
    "Explore and choose among options",
    "Other / custom"
  ]
})
```

Use the question-tool-ready prompts in [references/decision-prompts.md](references/decision-prompts.md) for the full decision set.

## Workflow for critiquing an existing UI

Inspect in this order:

1. User goal and task fit.
2. First-glance comprehension.
3. Orientation: current place, object, state, and path onward/back.
4. Action discoverability.
5. Choice quality and priority.
6. Labels and language.
7. Feedback and status.
8. Error prevention and recovery.
9. Recognition versus memory burden.
10. Accessibility and input coverage.
11. Frontend feasibility and edge states.
12. Prioritization by task impact, frequency, severity, and fix effort.

Report critique as: highest-impact usability issues, quick wins, behavior/spec details, accessibility notes, and risks/tradeoffs.

## Workflow for creating or improving an interface

1. Clarify the user, goal, success condition, and risk.
2. Choose the simplest useful flow.
3. Map user concepts and vocabulary.
4. Create visible structure and action hierarchy.
5. Select standard patterns unless a task reason justifies custom behavior.
6. Design default, hover, focus, active, loading, success, empty, validation, error, offline, disabled, and permission states.
7. Add constraints, validation, and recovery.
8. Support first use and repeated use.
9. Verify accessibility.
10. Explain decisions in terms of task progress, cognitive load, expectations, and risk.

## Decision framework

Ask yourself:

1. Is the problem comprehension, choice, control, feedback, navigation, or recovery?
2. Can the design prevent the problem rather than explain it?
3. Can the interface use recognition instead of recall?
4. Can a standard pattern solve this without new learning?
5. Which elements are primary, secondary, tertiary, or dangerous?
6. Does the user need more information, fewer choices, or a better sequence?
7. Will the user notice the state change?
8. What happens if the user is distracted, rushed, using touch, using keyboard, using assistive tech, or recovering from an error?
9. What is reversible, costly, or irreversible?
10. Is this serving the user’s task or the system’s convenience?

## Practical rules

### Obviousness and scanning
- Make each screen’s purpose visible in its heading, structure, and primary action.
- Use descriptive buttons: “Send invoice,” “Save changes,” or “Book appointment,” not “Submit.”
- Make click/tap targets look like controls without relying on hover.
- Use headings, grouping, whitespace, and lists so users can scan.
- Remove copy and decorative elements that compete with the task.

### Affordances, signifiers, and controls
- Use native controls when behavior fits.
- Use icons with labels for unfamiliar or consequential actions.
- Preserve distinctions between links, buttons, selected items, disabled items, editable fields, and static text.
- Do not hide essential actions behind gestures, long press, hover, or tiny overflow menus unless visible alternatives exist.

### Choices and progressive disclosure
- Limit initial choices to the current decision.
- Use safe, likely defaults.
- Reveal advanced options near the point of need.
- Use comparison structures when users must choose among similar plans, products, records, or settings.

### Feedback and state
- Give immediate micro-feedback for command receipt.
- Show progress for delays and async operations.
- Confirm completion when the result is not visible.
- Make current selection, current page, current filter, unsaved changes, and offline/sync status visible.
- Avoid noisy feedback for routine non-events.

### Errors and recovery
- Validate constraints before submission when feasible.
- Keep invalid user input visible and editable.
- Place errors next to affected controls and summarize long-form errors.
- Use undo for reversible actions and confirmation for irreversible or high-risk actions.
- Never make users start over after a recoverable problem.

### Navigation and orientation
- Show current section, object, state, and available next/back paths.
- Use breadcrumbs for deep hierarchy, not as a substitute for clear navigation.
- Use tabs only for peer sections of the same context.
- Use drawers/menus for infrequent or space-constrained actions; avoid hiding frequently needed primary navigation.
- Preserve route, filters, and scroll position when users return from detail to list.

### Learnability
- Make first-run help temporary and task-focused.
- Prefer inline examples and empty-state guidance over separate help documents.
- Let repeated successful use reduce beginner guidance.
- Design for “perpetual intermediates”: users know the basics but do not remember everything.

## Accessibility and inclusion requirements

- Use semantic HTML and native elements before custom widgets.
- Ensure all interactive elements have accessible names.
- Keep focus order aligned with visual/task order.
- Provide visible focus indicators.
- Support keyboard operation for all actions.
- Associate labels, hints, and errors with form controls.
- Do not rely on placeholder text as the only label.
- Do not rely on color alone.
- Announce async status and errors appropriately.
- Ensure dialogs trap focus while open and restore focus when closed.
- Respect reduced motion.
- Make target sizes suitable for touch and motor variability.
- Write at the simplest level compatible with the task and domain.

## Frontend implementation guidance

### Semantic structure
- Use `<button>` for actions and `<a>` for navigation.
- Use persistent programmatic labels for inputs.
- Use fieldsets/legends for related radio/checkbox groups.
- Use headings in logical order.
- Use tables for tabular data, not layout.

### State and feedback
- Include default, hover, focus-visible, active, selected, expanded/collapsed, disabled, loading, success, warning, error, empty, offline, and read-only states where relevant.
- Use `aria-expanded`, `aria-controls`, `aria-selected`, `aria-current`, `aria-invalid`, `aria-describedby`, and live regions as needed.
- Disable controls only when the reason is obvious or explained; otherwise allow the action and guide the user.
- Prevent duplicate submissions with pending state and idempotent server handling.

### Forms
- Use `type`, `autocomplete`, `inputmode`, `min`, `max`, `step`, and constraints appropriately.
- Keep input flexible when users may enter equivalent formats.
- Validate on blur or submit for complex fields; validate on input only when stable and helpful.
- Preserve entries across errors, refreshes, authentication interruptions, and network failures whenever possible.

### Responsive and input behavior
- Do not assume hover.
- Keep primary actions reachable without hiding context on small screens.
- Ensure text can zoom/reflow without loss of function.
- Test with keyboard only, screen reader basics, touch, narrow viewport, slow network, and high zoom.

## Quality checklist

- The primary user goal is stated.
- The screen’s purpose is clear at a glance.
- The primary action is stronger than secondary actions.
- Labels use user language.
- Interactive elements are discoverable without hover.
- Required choices are minimized and grouped.
- The interface provides status feedback after consequential actions.
- Errors are prevented where possible and recoverable where not.
- Destructive actions are reversible or clearly confirmed.
- Users do not lose work due to validation, auth, network, or navigation issues.
- Navigation answers “where am I?” and “where can I go?”
- Accessibility fundamentals are included.
- Frontend behavior is implementable.

Use the full checklists in [references/checklists.md](references/checklists.md).

## Common mistakes to avoid

- Starting with app chrome before the task.
- Treating “easy to use” as a checklist item.
- Hiding primary actions behind menus, gestures, or icons.
- Using clever labels where obvious labels would work.
- Making all actions equally important.
- Asking users questions the system can infer safely.
- Forcing users to remember hidden instructions or state.
- Replacing undo with constant confirmations.
- Blaming the user in error copy.
- Using disabled controls without explanation.
- Relying on color alone.
- Designing custom controls without keyboard and assistive-tech behavior.
- Treating accessibility as a final audit.
- Confusing visual simplicity with reduced task complexity.

See [references/anti-patterns.md](references/anti-patterns.md) for the full anti-pattern list.
- Ignoring empty, loading, offline, validation, permission, and edge states.

## How to explain recommendations to the user

Use this pattern:

```markdown
I recommend [change] because users are likely trying to [goal]. The current version makes them [think/remember/guess/recover] unnecessarily. This change makes [action/state/recovery] visible and reduces [specific risk or effort]. The main tradeoff is [cost], which is acceptable unless [context that would change the decision].
```

When disagreeing with a requested pattern:

```markdown
I would not hide this behind an icon-only menu because it is the primary path for the task. A better default is a visible labeled action. Use the menu only for secondary or infrequent actions.
```

