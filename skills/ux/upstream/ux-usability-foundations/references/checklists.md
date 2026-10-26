# Checklists — UX Usability Foundations

## Discovery/context checklist

- [ ] The primary user type is identified.
- [ ] The primary task and success condition are stated.
- [ ] Task frequency is known or reasonably assumed.
- [ ] The user’s likely knowledge level is known.
- [ ] Platform and input methods are known.
- [ ] High-risk actions are identified.
- [ ] Required domain, legal, compliance, or brand terms are identified.
- [ ] Business goals are separated from user goals.
- [ ] Technical constraints are separated from user-facing requirements.
- [ ] The agent has not asked for routine best-practice decisions.

## Core usability quality checklist

- [ ] The screen’s purpose is understandable at a glance.
- [ ] The primary action is easy to find and meaningful.
- [ ] Secondary actions are available but visually quieter.
- [ ] Destructive actions are separated from safe actions.
- [ ] Important controls look interactive without relying on hover.
- [ ] Noninteractive elements do not look clickable/editable.
- [ ] Labels use user language.
- [ ] Ambiguous icons have labels or accessible text.
- [ ] Related items are grouped by proximity, headings, or shared visual treatment.
- [ ] Users are not required to remember prior instructions or hidden state.
- [ ] Users can recognize options at the point of decision.
- [ ] Visible choices are appropriate for the task.
- [ ] Advanced/rare options are progressively disclosed.
- [ ] The system does not ask for information it can infer safely.
- [ ] Empty states explain what is missing and what to do next.
- [ ] Loading states indicate work is happening.
- [ ] Success states make completion clear when the result is not visible.

## Navigation and orientation checklist

- [ ] Users can tell where they are.
- [ ] Users can tell what object/account/context they are editing.
- [ ] The current section/view is visibly marked.
- [ ] Major navigation labels are descriptive and stable.
- [ ] Breadcrumbs or equivalent orientation exist for deep hierarchies.
- [ ] Back behavior preserves useful context.
- [ ] Tabs represent peer sections, not arbitrary actions.
- [ ] Drawers/menus do not hide frequently needed primary actions.
- [ ] Multi-step flows show progress and back/exit rules.
- [ ] Search and filters show active criteria and make clearing easy.

## Forms and data-entry checklist

- [ ] Every input has a persistent label.
- [ ] Placeholder text is not the only label.
- [ ] Required and optional fields are clear.
- [ ] The form asks only for information needed now.
- [ ] Field order follows task order.
- [ ] Input type, autocomplete, inputmode, and constraints match the data.
- [ ] Help text appears before or during entry.
- [ ] Validation is not too early or too late.
- [ ] Error messages are near affected fields.
- [ ] Error messages say what happened and how to fix it.
- [ ] Invalid input remains visible and editable.
- [ ] User-entered data is preserved across errors and interruptions.
- [ ] Submit actions prevent accidental duplicates.
- [ ] Confirmation/review is used for irreversible or consequential submissions.

## Feedback, status, and recovery checklist

- [ ] Every consequential action has immediate feedback.
- [ ] Feedback is proportionate to importance and risk.
- [ ] Routine feedback is quiet.
- [ ] Blocking problems are prominent and persistent.
- [ ] Long operations show progress or background status.
- [ ] Users know whether they can safely continue, retry, cancel, or close.
- [ ] Save/sync/offline states are visible when integrity matters.
- [ ] Undo exists for reversible actions.
- [ ] Confirmations are reserved for irreversible/high-risk actions.
- [ ] Confirmation copy names the object and consequence.
- [ ] Recovery does not require starting over.
- [ ] Support/error codes are secondary to recovery guidance.

## Accessibility checklist

- [ ] Semantic HTML or native controls are used where possible.
- [ ] Buttons are actions; links are navigation.
- [ ] All controls have accessible names.
- [ ] Labels, hints, and errors are associated with controls.
- [ ] Keyboard users can reach and operate all controls.
- [ ] Focus order matches visual/task order.
- [ ] Focus indicators are visible.
- [ ] Dialogs trap and restore focus.
- [ ] Expanded/collapsed/selected/current states are exposed.
- [ ] Async status, validation, and errors are announced appropriately.
- [ ] Color is not the only cue.
- [ ] Text has sufficient contrast and can zoom/reflow.
- [ ] Touch targets support motor variability.
- [ ] Motion respects reduced-motion preferences.
- [ ] Time limits can be paused, extended, or justified.

## Frontend implementation feasibility checklist

- [ ] All UI states are named.
- [ ] Async operations have pending, success, failure, retry, cancel, and offline behavior as relevant.
- [ ] Error handling covers client validation, server validation, permissions, and network failures.
- [ ] Component APIs include labels, descriptions, error text, disabled/read-only reasons, and loading states.
- [ ] Custom components include keyboard interaction specs.
- [ ] State changes update accessible names/roles/states.
- [ ] Routes preserve context where appropriate.
- [ ] Responsive behavior preserves task clarity.
- [ ] Performance supports quick feedback and low interaction latency.

## Critique checklist

- [ ] Issues are ranked by task impact, severity, frequency, and fix effort.
- [ ] Each issue includes evidence from the interface.
- [ ] Each fix explains how it reduces cognitive load, prevents error, or improves recovery.
- [ ] High-risk issues are separated from cosmetic issues.
- [ ] Accessibility issues are treated as product behavior issues.
- [ ] The critique includes quick wins and deeper structural fixes.
- [ ] The critique avoids shaming the original designer/team.

## Final response checklist

- [ ] The recommendation states the likely user goal.
- [ ] The answer gives a clear default.
- [ ] Tradeoffs are explicit.
- [ ] Any necessary user question is specific and includes a recommended default.
- [ ] Accessibility and edge states are covered when relevant.
- [ ] Frontend behavior is specified enough for implementation when relevant.
- [ ] Long copyrighted quotes are avoided.
- [ ] Recommendations are explained in terms of usability, not taste.
