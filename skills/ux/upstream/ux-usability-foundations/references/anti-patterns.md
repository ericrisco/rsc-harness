# Anti-patterns — UX Usability Foundations

## Anti-pattern: Starting with the shell

What it looks like:
- The design starts with nav bars, sidebars, dashboards, and layout chrome before the primary feature or task is defined.

Why it fails:
- The shell may optimize for an imagined product structure rather than the user’s actual goal.

Better approach:
- Start with the feature/task and design the smallest successful path. Add navigation and shell structure after core tasks are understood.

Ask the user when:
- The product has multiple competing primary audiences or workflows.

## Anti-pattern: Clever labels over obvious labels

What it looks like:
- Buttons and navigation use branded, cute, internal, or technical terms instead of plain user-language labels.

Why it fails:
- Users pause to decode meaning and may choose the wrong path.

Better approach:
- Use direct task labels; express brand voice in supporting copy.

Ask the user when:
- Legal, brand, or domain vocabulary is mandatory.

## Anti-pattern: Hidden primary action

What it looks like:
- The main task is behind an overflow menu, icon-only button, hidden gesture, drawer, hover state, or long press.

Why it fails:
- Users cannot act if they cannot discover the action.

Better approach:
- Show primary actions as visible labeled controls. Reserve hidden menus for secondary or infrequent actions.

Ask the user when:
- Severe space constraints exist.

## Anti-pattern: Ambiguous clickability

What it looks like:
- Text, cards, icons, images, or rows may or may not be clickable; interactive and static elements share the same treatment.

Why it fails:
- Users waste attention testing the interface instead of doing the task.

Better approach:
- Make links and buttons visually distinct; provide hover/focus/active states and accessible names.

Ask the user when:
- A brand system intentionally minimizes control styling.

## Anti-pattern: Icon-only mystery controls

What it looks like:
- Important actions are represented only by icons that are not universally recognized.

Why it fails:
- Icons are often ambiguous and require recall or experimentation.

Better approach:
- Pair icons with labels for primary, consequential, or unfamiliar actions. Ensure accessible names.

Ask the user when:
- The UI must fit a dense expert toolbar.

## Anti-pattern: Equal-weight action soup

What it looks like:
- Primary, secondary, tertiary, and destructive actions all look equally prominent.

Why it fails:
- Users must compare actions that should have been prioritized for them.

Better approach:
- Establish action hierarchy. Make the primary action obvious, secondary actions quieter, and destructive actions separated or delayed to confirmation/review.

Ask the user when:
- The primary action differs by role or object state.

## Anti-pattern: Asking users to think like the database

What it looks like:
- Navigation, forms, filters, and object labels mirror tables, internal statuses, IDs, queues, or org structures.

Why it fails:
- Users must translate implementation details into task meaning.

Better approach:
- Model objects and actions around user goals and domain concepts.

Ask the user when:
- Users are technical operators who explicitly need implementation-level control.

## Anti-pattern: Forcing nonhierarchical data into trees

What it looks like:
- A tree control is used for objects that are not naturally hierarchical.

Why it fails:
- Users cannot find items that belong to multiple categories or relationships.

Better approach:
- Use search, filters, tags, tables, graphs, network views, or grouped lists based on the real relationship.

Ask the user when:
- The domain relationship may genuinely be hierarchical.

## Anti-pattern: Choice wall

What it looks like:
- A page presents many equal options, filters, settings, plans, or actions with no grouping, default, or recommended path.

Why it fails:
- Decision time and abandonment increase; users satisfice unpredictably.

Better approach:
- Group choices, set safe defaults, recommend common paths, and progressively disclose advanced options.

Ask the user when:
- Users must compare many options simultaneously.

## Anti-pattern: Placeholder-only labels

What it looks like:
- Form fields rely on placeholder text that disappears after typing.

Why it fails:
- Users lose field meaning during review and correction; assistive technology support may be poor.

Better approach:
- Use persistent labels and supplemental hints.

Ask the user when:
- The user wants a very compact expert form.

## Anti-pattern: Validation as punishment

What it looks like:
- Users complete a form, submit, lose work, and receive vague errors.

Why it fails:
- The interface turns preventable problems into user blame and rework.

Better approach:
- Explain requirements before entry, validate at appropriate moments, preserve input, and guide direct correction.

Ask the user when:
- Validation details are security-sensitive or regulated.

## Anti-pattern: Confirmation spam

What it looks like:
- The interface asks “Are you sure?” for routine, reversible actions.

Why it fails:
- Users habituate and click through; confirmations become noise.

Better approach:
- Use undo for reversible actions and confirmation only for irreversible or high-risk actions.

Ask the user when:
- Reversibility and consequences are unclear.

## Anti-pattern: Loud but uninformative feedback

What it looks like:
- Toasts, modals, beeps, spinners, or animations appear often but do not explain state or next steps.

Why it fails:
- Feedback becomes distracting noise, and users still do not know what happened.

Better approach:
- Use proportionate, informative, state-specific feedback.

Ask the user when:
- Operational alerts compete for attention in monitoring or safety contexts.

## Anti-pattern: Silent system state

What it looks like:
- Save, sync, upload, offline, background job, filter, or permission status is hidden.

Why it fails:
- Users retry, duplicate, navigate away, or lose trust.

Better approach:
- Show current state, pending work, success/failure, and safe next actions.

Ask the user when:
- State visibility may reveal sensitive information.

## Anti-pattern: Disabled with no explanation

What it looks like:
- A button is greyed out and users cannot tell why or how to enable it.

Why it fails:
- Users must guess missing requirements.

Better approach:
- Keep the action enabled and explain missing requirements on click, or show inline requirements near the disabled control.

Ask the user when:
- Compliance or system constraints require disabled controls.

## Anti-pattern: Color-only meaning

What it looks like:
- Error, success, required, selected, active, or risk states are communicated only by color.

Why it fails:
- Color perception varies, and assistive technologies may not communicate color meaning.

Better approach:
- Pair color with text, icon, position, shape, or programmatic state.

Ask the user when:
- A design system currently encodes states with color only.

## Anti-pattern: Custom widget without interaction contract

What it looks like:
- A custom dropdown, combobox, carousel, tabs, dialog, drag/drop area, or menu is designed visually but lacks keyboard, focus, screen-reader, and state behavior.

Why it fails:
- It may look usable but fail for keyboard, assistive tech, mobile, and edge states.

Better approach:
- Use native elements or specify role, state, keyboard interaction, focus management, and error/loading behavior.

Ask the user when:
- The custom behavior is essential.

## Anti-pattern: Permanent beginner UI

What it looks like:
- Tooltips, tours, popovers, or instructional panels keep appearing after users understand the basics.

Why it fails:
- Beginner help becomes friction for intermediate users.

Better approach:
- Provide task-focused, dismissible, temporary help; support reference help separately.

Ask the user when:
- Users are legally required to acknowledge training or guidance.

## Anti-pattern: Dark pattern disguised as usability

What it looks like:
- Defaults, friction, wording, hierarchy, or hidden actions steer users into outcomes that benefit the business against user interests.

Why it fails:
- It violates user trust and the ethical role of usability as user advocacy.

Better approach:
- Make choices clear, reversible, and honest; align persuasion with user goals.

Ask the user when:
- The requested change appears manipulative or coercive.
