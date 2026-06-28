# Spec template

Copy this into `02-DOCS/wiki/sdd/specs/<slug>.md`, fill it, and delete the
italic guidance lines. Every line stays on WHAT and WHY — no framework, table,
endpoint, library, file path, or algorithm. If you can't phrase it without
naming the tech, it's a *point to clarify*, not a requirement.

```markdown
---
type: spec
title: Spec — <Feature name>
description: WHAT and WHY for <feature> — problem, goals, behaviour, acceptance criteria.
tags: [sdd, spec]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: sdd
slug: <slug>
status: draft
---

# Spec — <Feature name>

> Slug: `<slug>` · Status: draft · Created: <YYYY-MM-DD>
> Inherits: [constitution](../constitution.md)

## Problem & why
<The pain, who feels it, and the cost of leaving it unsolved. One short
paragraph. State the problem, not a pre-chosen solution.>

## Goals
- <What success delivers, in outcome terms. One bullet per goal.>

## Non-goals / out of scope
- <What is explicitly NOT done in THIS change — adjacent features, deferred
  work, things a reader might assume are included. Be explicit, not silent:
  unsaid scope becomes assumed scope.>

## Users & context
<Who acts, the situation they're in, and what they're trying to achieve.
Real users from the constitution/wiki, not invented personas.>

## Behaviour
- Main path: <what the system does, observably, in the common case>
- Edge cases: <empty, maximum, boundary, concurrent, repeated…>
- Error paths: <what the user sees when it goes wrong; what is NOT revealed>

## Acceptance criteria
<Binary, observable checks. Prefer Given / When / Then. Each must be later
checkable by `verify` and convertible to a `tasks` done-check.>
- Given <state>, When <action>, Then <observable outcome>.
- Given <state>, When <action>, Then <observable outcome>.

## Points to clarify
<The handoff to the `clarify` phase. Open questions, assumptions you made and
on what basis, decisions deferred. This list being non-empty is normal.>
- [ ] <Open question> — (assumption made: <…>, basis: <…>)
- [ ] <Deferred decision>
```

## Field notes

- **Status** moves `draft` → `clarified` (after the `clarify` phase) → `planned`
  (once `plan` exists). Don't invent other states.
- **Behaviour** is where HOW leaks in most. Audit every verb: "queries",
  "caches", "calls", "stores in" are implementation. Replace with the observable
  effect ("shows", "lets the user", "prevents", "remembers across visits").
- **Acceptance criteria** are the contract `verify` checks at the end of the
  chain. A criterion a human has to subjectively judge is not done — sharpen it
  or move the soft part to *Points to clarify*.
- **Updating an existing spec** (same slug): read it, merge new understanding,
  keep the history of resolved clarifications visible rather than silently
  rewriting. Never overwrite blind.
