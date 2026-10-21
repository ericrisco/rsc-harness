# Extend, polish, distill, audit — working on a surface that already exists

*Most design requests are not a new identity. They are a screen to add, a surface to finish, a
screen to calm down, or a verdict on what is there. Each one has a different rule about what is
allowed to change, and getting that rule wrong is how a working product gets restyled without
anyone asking.*

The modes, the drift classes, the triage order and the audit dimensions are adapted from
[Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0, skill-v4.6.0), as
redistributed in Uizze's `ui-taste`. The text is ours, rewritten to fit this skill's gates.

## What all four share

- **The code is the authority.** Read the tokens, the shared components, two or three neighbouring
  screens, and the brand study if it exists. A missing brand study or `DESIGN.md` does not erase a
  coherent identity that is already in the code. Note its absence in the hand-off and point at
  `../../design-dna/SKILL.md` to codify the look; never block on it.
- **Ask only what changes the result.** A precise request is enough to start. Do not turn a spacing
  fix into a discovery workshop, and do not re-ask what the brief already settled.
- **Walk the real task, not the first viewport.** Run it. Use real copy and the awkward cases: long
  names, empty collections, slow or failed loads, large text. A source read or a pretty screenshot
  does not prove a working path.
- **Stay in scope.** Working areas outside the request are left alone, including their code.

## Extend — a new screen or section inside an established product

The addition inherits the identity *and* the composition of the surface it sits in. A whole new
surface in the same product inherits the system (type, palette, components, density) but may need
its own structure. Resolve the new content, hierarchy, interaction and states in context. Changing a
durable rule (a token, a shared component's look) is a separate decision the user approves.

## Polish — finish what exists without replacing it

**Polish does not conceal a redesign.** If the pass shows the concept itself is wrong, stop and say
so, and propose a Replace as its own piece of work.

If a critique is handed to you, note which artifact and revision it was written against. Re-check
its high-impact findings against the current surface: a stale critique is context, not a defect
list. Do your own pass either way.

**Classify drift before fixing it**, then fix it at the narrowest level that removes the cause:

| Drift | What it is | Fix |
| --- | --- | --- |
| Missing token | A genuinely reusable value the system lacks | Add the token, then consume it |
| One-off | A local copy of something a shared component already does | Reuse the shared component |
| Conceptual mismatch | Flow, hierarchy or IA differs from comparable screens | Align with the neighbours |
| Local defect | Incomplete or inconsistent implementation | Fix it in place |

Do not build a system abstraction for one local exception.

**Triage the whole path in this order**, and do not perfect one corner while the rest of the path
sits below the same bar:

1. Broken or blocked tasks, data loss, misleading state, inaccessible paths.
2. Missing feedback: loading, empty, error, success, disabled, permission, recovery.
3. Flow, hierarchy, responsive behaviour, drift from the system.
4. Visual, content and motion inconsistencies.
5. Clean-up that this pass made necessary, and only that.

What to look at while you do it:

- **Flow:** the neighbours' terminology, navigation, save behaviour and state conventions.
- **Layout and type:** the project's grid and spacing scale, optical alignment, same-role type kept
  identical, wrapping at zoom and with longer translated strings.
- **What is actually visible:** sticky bars, menus, popovers and dialogs in their open state; labels
  clipped by an overflow ancestor; errors rendered off-screen. Being in the DOM is not being seen.
- **Contrast on the real background:** resolve opacity, overlays, gradients and images; do not
  read it off a token name or assume white. If the effective background cannot be established,
  say so instead of producing a ratio.
- **Icons and media:** one family, one stroke weight, optical centring, stable image dimensions.
  Do not swap approved assets just to make the pass look busy.
- **Interaction:** hover, focus, active, selected, expanded, disabled, loading, error, success.
  A narrow viewport is not a touch test.
- **Content:** facts and claims stay as they are unless the user approves the change.

Make one coherent pass, re-inspect the affected path, and allow one targeted follow-up for what is
still off. Compare the regions you did not touch against the screenshot you took before starting:
they must be unchanged.

## Distill — take out what stands between the user and the task

- Name the primary goal and the information it really needs. Everything else is a candidate.
- Remove repeated copy, duplicate actions, decorative noise, and containers that do not clarify a
  group. Reduce variation in colours, type sizes, button styles, spacing and surfaces.
- One obvious primary action and a few clearly subordinate ones. Rare or advanced controls go
  behind progressive disclosure; essential information stays visible.
- **Never remove capability, labels, focus states, semantics, error messages or recovery paths.**
  Do not flatten information that is genuinely complex until it gets harder to understand.
- Spacing and alignment before nested cards; plain language before explanatory copy.

Finish by running the complete task, including its important states, at the sizes that matter.

## Audit — read-only, unless fixes were asked for

An audit reports what can be observed. It is not permission to redesign, to invent requirements, or
to file personal taste as a defect. It changes nothing unless the user also asked for fixes.

**Record the coverage before the findings:** build or URL, browser, viewports, themes, states,
roles and input methods actually inspected. Keep four piles apart: issues confirmed in source,
defects reproduced at runtime, suspected risks, and checks that could not run. **Unknown is not
clean.** A preview that never loaded, a scan that failed or an unvisited state is partial coverage,
reported as such.

Five dimensions, each judged on evidence:

1. **Accessibility** — semantics, names, keyboard path, visible focus, contrast on the real
   background, zoom and reflow, reduced motion, target size against WCAG 2.2 (24px floor). Depth
   and tooling: `../../accessibility/SKILL.md`.
2. **Performance** — loading, layout shift, interaction latency, animation smoothness. Separate
   what you measured from what the source merely suggests: `../../performance/SKILL.md`.
3. **Theming and system consistency** — token use against the project's own conventions, every
   supported theme exercised. Do not penalise a theme the product does not claim to support.
4. **Responsive layout and input** — narrow, intermediate and wide; long content; large text;
   touch on custom drags and sliders. Say whether touch evidence was emulated or real.
5. **Implementation integrity** — controls that serve the task rather than imitate it, shared
   components used consistently, states that are honest. A familiar pattern is not a defect.

**Report:**

- **Coverage**, as above, per dimension: done, partial, not run.
- **Findings by priority.** **P0** blocks the task or risks data loss. **P1** materially impairs
  use, or is a confirmed accessibility failure. **P2** is friction with a workaround. **P3** is
  minor polish; do not bury the report in P3s.
- **Each finding:** dimension, screen and state, file and line when known, how it was reproduced,
  the user impact, the standard only when verified, the smallest concrete correction. Label
  suspected risks as suspected.
- **Patterns and positives:** shared root causes with their locations, and what is worth keeping.
- **Next actions** in priority order, ending with a re-audit after the fixes.

When nothing material turns up, write *no material findings in the inspected scope* and name that
scope. If a grade is also asked for, it comes from the rubric in `../SKILL.md`, and a dimension that
could not be assessed is reported as *not assessed*, never as a number.
