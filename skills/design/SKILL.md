---
name: design
description: "Use when designing, redesigning, restyling or reviewing a web page or app screen (landing, product site, portfolio, dashboard, docs) or when a UI looks generic or AI-made. Deals a researched direction, takes the idea from the subject, uses real pictures, proves it in a browser. NOT the words (landing-copy), NOT component state (ui-engineering)."
tags: [design, ui, ux, landing, dashboard, frontend, taste]
recommends: [landing-copy, ui-engineering, accessibility, brand-identity, nextjs]
profiles: [minimal, core, full]
origin: risco
---

# design

A model left to design picks the average of every page it has seen. This skill takes those
decisions away from the model and makes it look at what it built.

- **A script deals the direction.** You choose among researched directions; you never invent one.
- **The idea comes from the subject,** not from the category.
- **Real pictures and full content,** never empty space dressed as restraint.
- **A real browser measures the page** at three widths. A `FAIL` means it is not done.
- **You look at the screenshots,** fix the worst, and look again.

The engine is [taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT), shipped unmodified in
`engine/`. The modes, the fresh review and the design record adapt
[impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0). Credits and what
changed: `THIRD_PARTY.md`.

## 0. Name the surface and its mode

Decide before anything else. The mode is chosen from the surface, not from the product.

| Mode | The visitor… | Surfaces | Run |
| --- | --- | --- | --- |
| **Persuade** | decides and acts | landing, marketing, product site, pricing, event, local business | `engine/RUN.md`, the page run |
| **Experience** | is inside the work | portfolio, gallery, showcase | `engine/RUN.md`, the page run |
| **Operate** | completes a task | dashboard, admin, settings, inbox, editor | `engine/references/app-screens.md` |
| **Read** | understands something | docs, guide, article, changelog | the page run, under the Read rules |

What each mode allows and refuses: [references/modes.md](references/modes.md).

## 1. Brand first, when there is one

Look for an existing identity before dealing anything: `02-DOCS/wiki/brand/`, a `DESIGN.md` in the
repo, or a coherent identity already in the code. If one exists, its colours and faces win: pass
`--keep palette,type` to the draw and take only the composition. If none exists, do not stop to
interview the user about brand; the draw is how a starting point is made.

## 2. Run the engine

Follow [`engine/RUN.md`](engine/RUN.md) step by step. Read it whole before starting. In its commands,
`<skill>` is this skill's `engine/` folder. Nothing in it is optional:

1. Brief and inventory (eight to twelve things only this client has).
2. The argument: one claim per section; no claim, no section.
3. Deal three directions with `draw.mjs`, choose one against the inventory, write why.
4. The idea sentence, the competitor test, and one live thing.
5. The whole copy deck before markup. Never invent proof: customers, quotes, numbers, logos.
6. Build still: tokens, hero, sections, at least four real pictures (`assets.mjs`), the live thing.
7. Gate: `lint.mjs`, then `inspect.mjs` at 1440, 768 and 390. Zero `FAIL`.
8. Look: open every screenshot, critique with `engine/references/critique.md`. At most three rounds.
9. Move: the motion layer, then inspect again.

For a single component or section inside an existing design, skip the draw, inherit the system,
and still run the gate.

## 3. Fresh review

The builder believes its own page. When the gate passes, hand the screenshots to a reviewer with no
history of this conversation (a fresh subagent where the harness has one). It returns one of four
words: `recapture`, `rebuild`, `fix` or `ship`. Act on the word. The packet and the checks:
[references/finish-review.md](references/finish-review.md).

## 4. Record the system

A new or replaced visual system is written to `DESIGN.md` at the project root, from what was built,
so later edits keep the look. Format: [references/design-md.md](references/design-md.md). Extending
an existing surface does not rewrite it.

## When the browser cannot run

`inspect.mjs` and `scenes.mjs` need Node 22+ and an installed Chrome, Edge or Chromium. Without them:
run `lint.mjs` (Node 18+), take screenshots with any browser tool you have, critique those, and
write in the report: **"inspector not run: <reason>"**. Never report a gate as passed that did not
run. Without network, draw the pictures and say the open collections could not be searched.

## Report

Say briefly: the surface and mode; the direction dealt (name and seed) and any redraw with its
reason; the idea sentence and the live thing; the inspector result per width, or that it did not
run; the reviewer's word; every found picture with its credit; sample content to replace before
launch. Do not claim a check you did not run.

## Hand-offs

- The words on a conversion page → `../landing-copy/SKILL.md`.
- Component boundaries, state, loading and error behaviour → `../ui-engineering/SKILL.md`.
- WCAG conformance work → `../accessibility/SKILL.md`.
- A full brand system (logo, print colours, usage rules) → `../brand-identity/SKILL.md`.
- The App Router build → `../nextjs/SKILL.md`.
- A hero that is a pre-rendered camera flight in video, scrubbed by scroll → `../scroll-film/SKILL.md`.

## Files

| File | What |
| --- | --- |
| `engine/RUN.md` | The run, the house rules and the laws of the craft. |
| `engine/references/` | App screens, type, colour, layout, imagery, motion, scenes, copy, critique, tells, research. |
| `engine/scripts/` | `draw`, `assets`, `lint`, `inspect`, `scenes`. |
| `engine/library/` | The data the draw reads. Never read it whole; use the script. |
| `engine/UPSTREAM.json` | Which upstream versions are shipped here. |
| [references/modes.md](references/modes.md) | The four modes. |
| [references/finish-review.md](references/finish-review.md) | The fresh reviewer. |
| [references/design-md.md](references/design-md.md) | The `DESIGN.md` record. |
