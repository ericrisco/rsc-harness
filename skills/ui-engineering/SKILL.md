---
name: ui-engineering
description: "Use when the question is how interface should be BUILT — component boundaries, state that belongs in the URL vs the component, loading/empty/error states, forms, optimistic updates, build vs adopt. NOT the visual system (`design`), NOT framework mechanics (`react`/`nextjs`)."
tags: [interface, frontend, architecture, components, state, craft]
recommends: [design, motion-craft]
profiles: [core, full]
origin: risco
---

# UI engineering — the decisions between the design and the framework

There is a layer that neither the design skill nor the framework skill owns. The design says what
the screen should be. The framework says how its API works. **In between sits every decision that
makes an interface either durable or a maintenance tax** — and it is where most interface work
actually goes wrong.

Nothing here is framework-specific. These decisions are the same in React, Vue, Svelte, SwiftUI and
plain HTML; only the syntax moves.

## The one rule

**State goes to the outermost place that still needs it, and no further.** Almost every interface
tangle is that rule broken in one of two directions: state hoarded in a component that others need,
or state hoisted into a global store that only one component ever reads.

| Where the state lives | When that is right |
| --- | --- |
| **The URL** | Anything a user would bookmark, share, or expect the back button to restore: filters, tabs, pagination, the open item |
| **The server** | Anything that outlives the session or belongs to more than one user |
| **A shared parent** | Two siblings genuinely need it, and it dies with the screen |
| **The component** | Nobody else reads it: hover, focus, an open menu, an in-flight draft |

The most common and most expensive mistake is the first row: state that belongs in the URL kept in a
component. It looks fine until someone reloads, shares a link, or presses back — and then the
interface silently loses what the user did.

## Every state, not just the happy one

An interface is not finished when it renders data. It is finished when it renders **all five**:

| State | The question it answers | The usual failure |
| --- | --- | --- |
| **Loading** | "Is it working?" | A spinner where the shape is already known — use the shape |
| **Empty** | "Is it broken, or is there nothing?" | Blank. It must say which, and what to do next |
| **Error** | "What now?" | A message with no action. Every denial carries its own way out |
| **Partial** | "Some of it failed" | Ignored entirely; the screen shows a half-truth |
| **Success** | "It worked" | Silence, so the user does it twice |

The empty state is the one that gets skipped, and it is the first state a new user ever sees.

## Component boundaries

A component earns its existence by **hiding a decision**, not by being reused. Splitting for reuse
alone produces the worst interfaces: a wrapper around a wrapper, each passing props through, none
owning anything.

Draw the boundary where:

- it owns a piece of state nothing outside needs;
- it can be described in one sentence without "and";
- swapping its internals changes nothing outside it.

Do **not** draw a boundary because a file is long. Long is not a defect; a file that does two
unrelated things is, and it is usually short.

## Forms

Forms are where interfaces most often insult people, and the rules are unglamorous:

- **Validate on blur, not on keystroke.** Telling someone their email is invalid while they are on
  the third character is scolding them for not having finished.
- **Never clear what they typed.** Not on error, not on refresh, not on navigation. Their input is
  theirs.
- **Disable the submit only while submitting**, never as a way of enforcing validity — a disabled
  button with no reason is a dead end.
- **The error goes next to the field**, and says what to do, not what is wrong.

## Optimistic updates

Show the result before the server confirms **only** when you can honestly undo it. That means: the
operation is idempotent, the failure is rare, and reverting it is visible and comprehensible.

Optimism on a destructive or an expensive action is a lie you will have to retract in front of the
user. Deleting, paying, sending — those wait.

## Build or adopt

Adopting a component costs bundle size, an API you did not design, and an upgrade you will owe
later. Building costs the accessibility work you will get wrong.

The split is not about difficulty, it is about **who is the authority on the behaviour**:

- **Adopt** for behaviour with a specification you would otherwise be reimplementing badly: focus
  trapping, combobox semantics, date handling, virtualisation.
- **Build** for anything that is your product's own logic wearing a UI, or where the library gives
  you 60% and you fight the remaining 40% forever.

## Anti-patterns → STOP

| If you're about to… | Reality / Fix |
| --- | --- |
| Put a filter or tab selection in component state | It belongs in the URL. Reload, share and back are part of the interface. |
| Add a global store because passing props feels tedious | Tedious is not broken. Global state that one component reads is a leak with ceremony. |
| Ship a screen with only the loaded state | Loading, empty, error and partial are not extras. The empty one is what a new user sees first. |
| Split a component because the file got long | Length is not the defect. Two unrelated responsibilities are, and they are usually short. |
| Show a delete as done before the server confirms | Optimism on a destructive action is a lie you will retract in public. |
| Reach here for how the framework's hooks work | That is `../react/SKILL.md` or `../nextjs/SKILL.md`. This skill decides what to build; those decide how to express it. |

## See Also

- `../design/SKILL.md` — the visual system these decisions serve.
- `../motion-craft/SKILL.md` — how the pieces here move once they exist.
- `../design-loop/SKILL.md` — the graded critique that judges the result.
- `../accessibility/SKILL.md` — the ground under focus, semantics and forms.
