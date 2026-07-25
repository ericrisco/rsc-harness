---
name: plan
description: "Use when an approved, clarified spec must become a technical blueprint before any code — the SDD phase between clarify and tasks: architecture, contracts, data flow, testing strategy, sequencing and risks, at structure altitude, never framework syntax. NOT the what/why spec (that is `specify`), NOT the ambiguity sweep (that is `clarify`), NOT the task breakdown (that is `tasks`), NOT the code (that is `implement`)."
tags: [sdd, plan, design]
recommends: [tasks]
profiles: [core, full]
origin: risco
---

# Plan — the technical blueprint between spec and tasks

The spec says **what** and **why**. `plan` decides **how**: the components, the contracts between
them, the data that flows, how each claim gets proven, and what is most likely to bite. It reads the
clarified spec and the constitution, writes ONE artifact — `02-DOCS/wiki/sdd/plans/<slug>.md` — and
hands off to `tasks`, which slices it into an ordered, independently-verifiable checklist.

```text
constitution → specify → clarify → [ plan ] → tasks → analyze → implement → verify → review → ship
```

## Decide structure, not syntax

A plan names components, contracts, shapes and flows. It does not write the framework's route
decorators, the ORM's session boilerplate or the test runner's flags — those are stack mechanics,
owned by the stack skill (`../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`,
`../flutter/SKILL.md`, `../postgresdb/SKILL.md`) at `implement` time. This altitude is what makes a
plan reviewable against intent and slice-able by `tasks`; drop it and you get code no one approved.

```text
reservation.reserve(cartId: CartId) -> Reservation | OutOfStock | CartNotFound
  - idempotent on cartId (calling twice returns the same Reservation)
  - holds stock for 15 min, then auto-releases
  - never partially reserves: all lines or none
```

That is the altitude. The stack skill later decides whether it becomes a POST handler with a
Pydantic model or a Go method on a struct — it can, because the contract is unambiguous.

## Entry gate

1. **The spec** — `02-DOCS/wiki/sdd/specs/<slug>.md`. Missing → STOP, route to
   `../specify/SKILL.md`. Still carrying `[NEEDS CLARIFICATION]` markers or open questions → STOP,
   route to `../clarify/SKILL.md`. A plan built on an unclarified spec is a guess wearing a diagram,
   and every phase downstream inherits the guess.
2. **The constitution** — `02-DOCS/wiki/sdd/constitution.md` holds the project's non-negotiables
   (stack canon, quality bars, conventions). Every architectural choice must be consistent with it;
   where the design needs to bend a principle, say so with a reason instead of bending it silently.
3. **The Knowledge map** — `02-DOCS/wiki/index.md` points at `02-DOCS/wiki/stack/*` and prior
   plans/decisions. Reusing what the project already settled is the difference between a plan and
   scope drift.
4. **The dial** — `02-DOCS/wiki/harness/user-profile.md` (see below).

## What a plan contains

The sections of the artifact, in order; fill them top-down, later ones lean on earlier ones. The
fill-in skeleton with per-section guidance is `references/plan-template.md` — use it verbatim.

| § | Section | The question it answers |
| --- | --- | --- |
| 0 | Global constraints | Which exact values must every task honor? (verbatim, not paraphrased — a context-isolated implementer and its reviewer see nothing else) |
| 1 | Context & constraints | Which spec/constitution facts pin this design down? Cite (`spec §Acceptance #3`), don't re-paste |
| 2 | Architecture | What are the components and how do they fit together? |
| 3 | Interfaces & contracts | What does each component promise the others? |
| 4 | Data model & flow | What data exists, where it lives, how it moves and changes? |
| 5 | Testing strategy | How will we *prove* each part does what it claims? |
| 6 | Sequencing & dependencies | In what order can this be built and verified? |
| 7 | Risks & open decisions | What is most likely to be wrong, and what is still undecided? |

Three of them carry the weight and fail quietly:

- **§2 Architecture** — a box-and-arrow diagram, one sentence of single responsibility per
  component, internal vs. external marked (the arrows are the seams you will test and parallelize).
  State the **one** decision that matters most — sync vs. async, split service vs. monolith, read
  model vs. single table — and defend it against a constraint from §1. If two designs are genuinely
  viable, give both, the trade-off, *and* your recommendation; leaving the reader to choose is not a
  plan.
- **§5 Testing strategy** — per acceptance criterion: the level that proves it (unit / contract /
  integration / e2e), what it asserts, what it fakes to stay fast. Deciding this before code exists
  is what makes `implement`'s TDD possible. You choose the seams; the stack skill owns the tooling.
- **§7 Risks** — ranked, each with trigger, impact, and the mitigation or spike that retires it. A
  plan claiming zero risk is the riskiest one. Significant decisions taken while planning also get
  appended to `02-DOCS/wiki/sdd/decisions.md`, so later phases can trace the *why*.

## The artifact

Write `02-DOCS/wiki/sdd/plans/<slug>.md`, `<slug>` matching the spec's slug exactly — one plan per
spec, same name, because that is how `tasks`, `analyze` and `implement` find it. Then index it in
`02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a pointer). If a plan for
this slug already exists, update it in place and note what changed — never fork a `-v2`.

## Model tier — `heavy` (opt-in routing)

Architecture, interfaces, data flow and risk are the heaviest reasoning in the chain, so this
phase's default tier is **`heavy`**. Routing is off unless `models.enabled: true` in
`02-DOCS/wiki/sdd/config.yaml`; the resolution order, the announce rule and the model table live in
`../sdd/references/model-routing.md`. Routing off or no profile → session model, silently.

## Adapting to the dial

The accompaniment level in `02-DOCS/wiki/harness/user-profile.md` (owned by `../init/SKILL.md`)
changes how much you *say*, never whether a section exists. Even at L0 the plan is complete; it is
just quiet.

| Level | How `plan` behaves |
| --- | --- |
| **L0** | Terse plan, no narration in chat — write the file, point to it. |
| **L1** | Same artifact, one line of *why* on the top architectural decision. |
| **L2** | Justify each significant design choice in the artifact; surface the trade-offs weighed. |
| **L3** | Walk a non-technical user through the architecture in plain language, define terms inline, and ask about constraints you cannot infer — one focused question at a time. |

## Anti-patterns

| Anti-pattern | Why it fails / the fix |
| --- | --- |
| Writing the real code in the plan "because it's faster" | You dropped an altitude. Syntax is the stack skill's job at `implement`. Pull back to contracts. |
| Planning around a spec that is "a bit fuzzy but I get the gist" | A plan on an unclarified spec is a guess. STOP, route to `clarify`, then plan. |
| Testing strategy = "we'll write tests" | Not a strategy. Name the level per acceptance criterion and what each test fakes. |
| Keeping risks short because they read negative | The plan that claims no risk is the riskiest. Rank the real ones, give each a mitigation. |
| Picking the framework, ORM and config here | Stack canon lives in the constitution; mechanics live in the stack skill. Stay above the seam. |
| Listing two designs and letting the reader choose | Decide. Alternatives ship only with a trade-off and a recommendation matched to the constitution. |
| One big undifferentiated sequencing step | Then `tasks` cannot slice it and nothing is independently verifiable. Order it into checkable steps. |
| Starting a fresh plan when one exists for the slug | Forked plans rot and later phases read the wrong one. Update in place, note the change. |

## Always propose isolation before the build

Once the plan is written, **always propose isolating the work in a git worktree/branch** before any
code is implemented — every feature, not just the risky ones. One line, calibrated to the dial:

> *"Antes de implementar, ¿aíslo este trabajo en un worktree/rama propia (`../worktrees/SKILL.md`)
> para no tocar tu rama actual? (recomendado)"*

Accepted → hand to `../worktrees/SKILL.md` first. Declined → note it and continue. Already on the
default branch (`main`/`master`) → isolation is **not** optional: say so and route to `worktrees`
regardless. (`implement` re-checks this as a hard gate before its first commit.)

## When NOT to use

- Fuzzy idea, no spec yet → `../specify/SKILL.md`; ambiguity in an existing spec →
  `../clarify/SKILL.md`; project-wide non-negotiables → `../constitution/SKILL.md`.
- Slicing an approved plan into an ordered checklist → `../tasks/SKILL.md`.
- Concrete framework/ORM/test-runner mechanics → the stack skill (`../fastapi/SKILL.md`,
  `../nextjs/SKILL.md`, `../go/SKILL.md`, `../flutter/SKILL.md`, `../postgresdb/SKILL.md`).

## Next in the chain

Plan written, indexed, decisions logged → propose isolation (above), then hand off to
**`../tasks/SKILL.md`**, which turns §6 into an ordered task list with a done-check per task. If
planning surfaced an ambiguity the spec never resolved, loop back to **`../clarify/SKILL.md`** first.
