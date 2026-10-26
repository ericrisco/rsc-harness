# Principle Cards — UX Usability Foundations

## Principle: Start with the user goal

Rule:
- Define the user’s goal, task, success condition, and risk before choosing layout, navigation, or controls.

Why it matters:
- Interfaces fail when they express implementation structure or stakeholder feature lists rather than the user’s outcome.

Use when:
- Creating or critiquing any flow, screen, form, or control set.

Do not use when:
- The user only asks for cosmetic styling and the task model is already fixed; still note usability risks.

Default recommendation:
- Optimize the most common successful task first.

Ask the user when:
- The primary task, audience, or consequence of failure is unclear.

Question prompt:
```js
question({
  question: "What is the primary task this interface must help users complete?",
  recommended_default: "Optimize for the most common successful task first, then make secondary actions available but visually quieter.",
  options: ["Complete one focused task", "Compare or monitor multiple items", "Explore choices", "Other / custom"]
})
```

Agent behavior:
- Begin recommendations with the task and success condition. Remove or demote UI that does not support that task.

## Principle: Remove question marks

Rule:
- Users should not have to wonder what the page is, where to begin, what is clickable, what words mean, or what happened.

Why it matters:
- Every unnecessary question adds cognitive load and reduces confidence.

Use when:
- Reviewing labels, controls, landing screens, dashboards, forms, navigation, and calls to action.

Do not use when:
- The interface is a game, puzzle, or deliberate learning environment where challenge is the point; even then controls should be understandable.

Default recommendation:
- Make important UI self-evident; make novel or complex UI self-explanatory.

Ask the user when:
- They request clever, branded, or intentionally mysterious wording.

Question prompt:
```js
question({
  question: "Should clarity or brand personality win if users may not understand the label immediately?",
  recommended_default: "Use the clearest user-language label first and express brand personality in supporting copy or tone.",
  options: ["Prioritize clarity", "Balance clarity and brand", "Use required brand/domain wording", "Other / custom"]
})
```

Agent behavior:
- Replace vague labels, hidden controls, and ambiguous icons with visible, descriptive cues.

## Principle: Signify every possible action

Rule:
- Controls must communicate what can be done and how to do it.

Why it matters:
- A possible action is useless if users cannot discover it.

Use when:
- Designing buttons, links, drawers, gestures, cards, menus, drag/drop, inputs, or custom components.

Do not use when:
- Hiding an action is a safety mechanism; even then authorized users need discoverable paths.

Default recommendation:
- Use standard labeled controls for important actions.

Ask the user when:
- Space or brand constraints push toward hidden or icon-only actions.

Question prompt:
```js
question({
  question: "Can this important action be shown with a visible label, or must it be hidden because of space or platform constraints?",
  recommended_default: "Show a visible label for primary and consequential actions; hide only secondary or infrequent actions.",
  options: ["Visible labeled control", "Icon with tooltip/accessible name", "Overflow/menu", "Other / custom"]
})
```

Agent behavior:
- Identify all actions and ensure each has a visible cue, accessible name, and state.

## Principle: Match mental models, not implementation models

Rule:
- Organize concepts, names, and flows around how users understand the work.

Why it matters:
- Users should not need to learn the database, architecture, file system, or org chart.

Use when:
- Designing navigation, settings, object models, tables, dashboards, admin interfaces, and enterprise workflows.

Do not use when:
- The users are technical operators whose task is to manipulate the implementation model itself.

Default recommendation:
- Use user-visible nouns and verbs; hide implementation artifacts unless meaningful to the task.

Ask the user when:
- The audience may be domain experts who expect specialized terms.

Question prompt:
```js
question({
  question: "Are the users domain experts who expect technical terms, or should the interface translate them into plain user language?",
  recommended_default: "Use plain task language, with domain terms only where users already expect them.",
  options: ["Plain language", "Domain-expert terminology", "Dual labels/help text", "Other / custom"]
})
```

Agent behavior:
- Rename and regroup features around user intent. Flag implementation leakage.

## Principle: Design for scanning and satisficing

Rule:
- Assume users scan for a plausible next step rather than reading everything and optimizing.

Why it matters:
- Important content must be findable at a glance, or users will choose the first plausible path.

Use when:
- Designing page structure, content hierarchy, tables, cards, menus, and help text.

Do not use when:
- The product is a long-form reading environment; still provide navigation and summaries.

Default recommendation:
- Use strong headings, meaningful grouping, visible primary actions, concise copy, and scannable lists.

Ask the user when:
- The screen must support dense monitoring or complex comparison.

Question prompt:
```js
question({
  question: "Does this screen need to support quick task completion or dense comparison/monitoring?",
  recommended_default: "Optimize for quick scanning and one clear next action unless comparison density is essential.",
  options: ["Quick task completion", "Dense comparison", "Real-time monitoring", "Other / custom"]
})
```

Agent behavior:
- Reorder, group, and cut content so the likely next step appears quickly.

## Principle: Prefer recognition over recall

Rule:
- Put needed context, choices, examples, and state in the interface instead of requiring memory.

Why it matters:
- Memory is fragile under distraction, stress, infrequent use, and complex tasks.

Use when:
- Designing settings, forms, commands, filters, multi-step flows, dashboards, and shortcuts.

Do not use when:
- Expert shortcuts are optional accelerators; still provide visible alternatives.

Default recommendation:
- Provide visible options and context first; add shortcuts as accelerators.

Ask the user when:
- The workflow is for trained experts and speed may justify denser memorized interaction.

Question prompt:
```js
question({
  question: "Are users expected to use this frequently enough to learn shortcuts, or must the interface stay discoverable each time?",
  recommended_default: "Keep visible, recognizable paths and add shortcuts only as optional accelerators.",
  options: ["Infrequent/discoverable", "Frequent intermediates", "Trained experts", "Other / custom"]
})
```

Agent behavior:
- Surface recent choices, examples, labels, current filters, and object context.

## Principle: Minimize unnecessary choices

Rule:
- Reduce the number and complexity of choices presented at one time.

Why it matters:
- More choices increase decision time, perceived effort, and error probability.

Use when:
- Designing menus, plans, settings, filters, onboarding, forms, and calls to action.

Do not use when:
- Users need broad comparison or expert control; still group and prioritize.

Default recommendation:
- Present common options first, group the rest, and hide rare advanced choices behind clear controls.

Ask the user when:
- Business requirements demand many visible options.

Question prompt:
```js
question({
  question: "Which choices are truly needed for the first decision, and which can be revealed after users choose a path?",
  recommended_default: "Show the common first-step choices and progressively disclose advanced or rare options.",
  options: ["Common choices only", "Grouped full list", "Search/filter first", "Other / custom"]
})
```

Agent behavior:
- Consolidate options, add defaults, group by task, and remove redundant decisions.

## Principle: Provide feedback that teaches system state

Rule:
- Every consequential action should produce timely, informative, proportionate feedback.

Why it matters:
- Without feedback, users retry, abandon, duplicate work, or lose trust.

Use when:
- Designing submits, saves, uploads, deletes, async tasks, sync, loading, filters, and state changes.

Do not use when:
- The action’s visible result is already immediate and obvious.

Default recommendation:
- Use inline status for local actions, progress for delays, persistent status for long-running tasks, and interruption only for blocking issues.

Ask the user when:
- The operation may take time, fail, or have delayed consequences.

Question prompt:
```js
question({
  question: "How long can this operation take, and what should users be able to do while it runs?",
  recommended_default: "Show immediate receipt, progress for delays, and allow safe continuation when possible.",
  options: ["Instant", "A few seconds", "Long-running/background", "Other / custom"]
})
```

Agent behavior:
- Specify state transitions and feedback copy/placement.

## Principle: Constrain before correcting

Rule:
- Prevent invalid or dangerous actions through constraints, defaults, input design, and sequencing before relying on error messages.

Why it matters:
- Prevention is faster and less stressful than recovery.

Use when:
- Designing forms, destructive actions, permissions, file uploads, scheduling, payments, medical/legal/financial data, and configuration.

Do not use when:
- Over-constraining blocks valid user intent; provide escape hatches where needed.

Default recommendation:
- Use safe defaults and clear constraints, with flexible input where possible.

Ask the user when:
- Constraints may block legitimate expert or edge-case behavior.

Question prompt:
```js
question({
  question: "Should this input be tightly constrained for safety, or flexible enough to handle edge cases?",
  recommended_default: "Constrain dangerous or invalid actions, but keep ordinary input flexible and correctable.",
  options: ["Tightly constrained", "Flexible with validation", "Expert override", "Other / custom"]
})
```

Agent behavior:
- Add constraints, validation, previews, and disabled/hidden behavior with explanations.

## Principle: Recover without blame

Rule:
- Error handling should guide recovery, preserve work, and avoid blaming the user.

Why it matters:
- Users blame themselves when interfaces fail. Good UI keeps them moving.

Use when:
- Writing validation, failure, offline, permission, destructive, and empty-state messages.

Do not use when:
- Security requires withholding details; still provide safe, non-blaming next steps.

Default recommendation:
- Explain the issue, show the affected item, preserve input, and provide a direct fix.

Ask the user when:
- Error details are sensitive, regulated, or security-relevant.

Question prompt:
```js
question({
  question: "Can the error message safely explain the exact problem, or must details be limited for security/compliance?",
  recommended_default: "Give specific recovery guidance unless revealing details creates risk.",
  options: ["Specific recovery guidance", "Limited details", "Contact/support handoff", "Other / custom"]
})
```

Agent behavior:
- Rewrite errors as recovery instructions and specify where fixes happen.

## Principle: Prefer undo over confirmation for reversible actions

Rule:
- If an action is reversible, let users do it and offer undo rather than interrupting with confirmation.

Why it matters:
- Repeated confirmations become noise and train users to click through.

Use when:
- Archiving, moving, hiding, dismissing, sorting, lightweight deletion, and changes that can be restored.

Do not use when:
- The action is irreversible, legally binding, costly, dangerous, or affects others irreversibly.

Default recommendation:
- Use undo for reversible actions and confirmation/review for irreversible or high-risk actions.

Ask the user when:
- Reversibility is unclear.

Question prompt:
```js
question({
  question: "Is this action fully reversible, and for how long?",
  recommended_default: "Use undo for reversible actions; reserve confirmation for irreversible or high-risk actions.",
  options: ["Fully reversible", "Reversible for limited time", "Not reversible", "Other / custom"]
})
```

Agent behavior:
- Specify undo duration, placement, copy, and state restoration.

## Principle: Keep users oriented

Rule:
- Users should know where they are, how they got there, where they can go, and what will happen next.

Why it matters:
- Disorientation causes backtracking, abandonment, and errors.

Use when:
- Designing navigation, breadcrumbs, app shells, multi-step flows, dashboards, and deep content.

Do not use when:
- A narrow wizard intentionally limits movement; still show progress and exit rules.

Default recommendation:
- Show current section, object, step, and major routes.

Ask the user when:
- Free navigation conflicts with completion requirements.

Question prompt:
```js
question({
  question: "Should users be able to move freely, or must this flow keep them in a guided sequence?",
  recommended_default: "Allow free orientation and safe backtracking unless the task requires a controlled sequence.",
  options: ["Free navigation", "Guided sequence", "Hybrid", "Other / custom"]
})
```

Agent behavior:
- Add current states, progress indicators, breadcrumbs, back paths, and stable navigation.

## Principle: Use conventions unless there is a task reason not to

Rule:
- Prefer familiar patterns when they support the task.

Why it matters:
- Familiar patterns let users transfer learning from other products.

Use when:
- Choosing navigation, dialogs, forms, menus, gestures, filtering, search, and selection patterns.

Do not use when:
- Existing conventions are harmful, inaccessible, or mismatched to the task.

Default recommendation:
- Use standard components and patterns; customize content and behavior where the task demands.

Ask the user when:
- A nonstandard interaction is requested.

Question prompt:
```js
question({
  question: "What user problem does the nonstandard pattern solve better than the familiar convention?",
  recommended_default: "Use the familiar convention unless the alternative is measurably clearer or faster for this task.",
  options: ["Use standard pattern", "Use nonstandard pattern with explanation", "Prototype/test both", "Other / custom"]
})
```

Agent behavior:
- Challenge novelty that increases learning cost without task benefit.

## Principle: Make accessibility structural

Rule:
- Accessibility is built through perceivable structure, operable controls, understandable language, forgiving flows, and robust implementation.

Why it matters:
- Accessibility failures are usability failures.

Use when:
- Designing or implementing any UI.

Do not use when:
- Never. Accessibility basics are non-optional.

Default recommendation:
- Use semantic controls and labels, keyboard support, focus visibility, non-color cues, and accessible feedback.

Ask the user when:
- Compliance level or procurement requirements are unknown in regulated/public products.

Question prompt:
```js
question({
  question: "Does this product have a required accessibility standard or procurement target?",
  recommended_default: "Meet core WCAG-oriented basics by default; confirm stricter targets for regulated, public-sector, education, healthcare, or enterprise contexts.",
  options: ["WCAG AA target", "Internal baseline only", "Regulated/procurement requirement", "Other / custom"]
})
```

Agent behavior:
- Include accessibility behavior in the spec, not as an afterthought.
