# Review checklist — auditing an application

Run the checklist by using the product, then fill it in. Each finding gets a severity, a location and
a concrete fix.

## Finding format

```
[Blocker|Major|Minor] <what is wrong> — <who it hurts and how>
  Where: <screen, component, or file:line>
  Fix: <the concrete change>
  Ref: <heuristic, WCAG success criterion, or reference file>
```

- **Blocker** — stops a person from finishing the job, loses data, or breaks an accessibility
  requirement that applies.
- **Major** — the job is finished, but slowly, unreliably or with confusion that will recur.
- **Minor** — polish, consistency, or an edge case that rarely appears.

Order findings by impact on the job, not by checklist order.

## The five-question screen test

For every screen reached in the walkthrough:

1. Where am I? (section, object, state)
2. What is this for?
3. What can I do here, and which action is primary?
4. What just happened, or what is happening now?
5. Where do I go next, and how do I go back?

A "no" to any of these is at least a Major finding.

## The state matrix

For each screen in the flow, check that each applicable state is designed and reachable:

| State | Designed? | Reachable and realistic? |
| --- | --- | --- |
| Default, populated | | |
| Loading (first load and refresh) | | |
| Empty (new account and filtered-to-zero, separately) | | |
| Partial (some data failed) | | |
| Error (request failed, with retry) | | |
| Offline or stale | | |
| No permission | | |
| Overflow (long text, many items, huge numbers) | | |
| Pending action on one item | | |

## Walkthrough checks

- [ ] The main job can be finished from a cold start with a new account.
- [ ] The main job can be finished with the keyboard only.
- [ ] The main job can be finished at 320px wide and at 200% zoom.
- [ ] Every primary action is visually the strongest on its screen.
- [ ] Every destructive action is separated, named with its consequence, and reversible or confirmed.
- [ ] Every form keeps input across errors, and its errors are next to their fields.
- [ ] Every list keeps its place when returning from detail.
- [ ] Every consequential action gives feedback within 100ms and a visible result.
- [ ] Every disabled control says why.
- [ ] Navigation shows where the person is and where they can go.
- [ ] Terms are the same on every screen, and in the person's vocabulary.
- [ ] No essential action requires hover, gesture or a label-less icon.
- [ ] Focus is visible everywhere and moves sensibly into dialogs and back out.
- [ ] Status changes are announced, and colour is never the only signal.
- [ ] Touch targets are large enough on a phone.
- [ ] Long translated strings and right-to-left layouts do not break the screen, if the product is
  localized.
- [ ] Nothing is blamed on the person in any message.

## Quick wins versus structural fixes

Separate the findings into two lists before reporting:

- **Quick wins** — copy, labels, spacing, a missing state, a visible disabled reason. Usually an hour or
  less.
- **Structural fixes** — a flow that needs a new step, navigation that must change, a pattern that is
  wrong for its job. Describe the change and the flow it affects.

## When nothing serious is found

Say so in one line, name what was checked, and list the residual risks you could not test (for example,
real data volume or a screen reader pass). Do not invent findings to fill the report.
