---
name: plan
description: "Use when turning an approved, clarified spec into a technical implementation plan — the SDD phase between clarify and tasks. Covers architecture and component boundaries, the public interfaces/contracts, data model and data flow, the testing strategy, sequencing, and the risk register. Triggers: 'plan this feature', 'how should we build this', 'design the architecture', 'write the implementation plan', 'plan.md', 'what's the data flow', 'how do we test this', 'what are the risks', 'we have the spec, now what'. Reads the spec under 02-DOCS/wiki/sdd/specs/ and the constitution; writes 02-DOCS/wiki/sdd/plans/<slug>.md; defers concrete stack mechanics (framework APIs, ORM, test tooling) to the relevant stack skill. NOT requirements capture (that's specify), NOT ambiguity removal (that's clarify), NOT the task breakdown (that's tasks). Honors the harness accompaniment dial."
tags: [sdd, plan, design]
recommends: [tasks]
profiles: [core, full]
origin: risco
---

# Plan — the technical blueprint between spec and tasks

You have a spec that says **what** and **why**. `plan` decides **how** — the architecture, the
interfaces, the data flow, the way you'll prove it works, and the things most likely to bite you.
It is the engineering counterpart of the spec: a spec a human signed off on becomes a plan an
engineer (or an agent) can execute without re-deciding the shape of the system halfway through.

`plan` sits fourth in the SDD chain:

```text
constitution → specify → clarify → [ plan ] → tasks → analyze → implement → verify → review → ship
```

It reads the clarified spec and the constitution, produces ONE artifact —
`02-DOCS/wiki/sdd/plans/<slug>.md` — and hands off to `tasks`, which slices that plan into an
ordered, independently-verifiable checklist.

## The one rule that defines this phase

**Decide structure, not syntax.** A plan names the components, their contracts, the data that
flows between them, and how each piece is proven. It does **not** write the framework's route
decorators, the ORM's session boilerplate, or the test runner's flags. Those are stack mechanics,
and they belong to the stack skill (`../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`,
`../flutter/SKILL.md`, `../postgresdb/SKILL.md`). The plan says *"the orders service exposes a
`reserve(cartId) → Reservation` operation, transactional, idempotent on cartId"*; the stack skill
later decides whether that's a POST handler with a Pydantic model or a Go method on a struct.

If you find yourself writing real code in the plan, you have dropped an altitude. Pull back up.

## Before you write a line

Run this gate. Skipping it produces a plan that drifts from intent on contact.

1. **Read the accompaniment dial.** Open `02-DOCS/wiki/harness/user-profile.md`. The technical +
   accompaniment level (L0..L3) sets how much you explain and how many questions you ask — see
   "Adapting to the dial" below. No profile yet → assume non-technical, ask the two gauging
   questions first (the harness owns that flow).
2. **Read the spec.** `02-DOCS/wiki/sdd/specs/<slug>.md`. If it is missing, STOP — there is nothing
   to plan from; route to `../specify/SKILL.md`. If it still carries `[NEEDS CLARIFICATION]` markers
   or open questions, STOP — route to `../clarify/SKILL.md`. **A plan built on an unclarified spec
   is a guess wearing a diagram.**
3. **Read the constitution.** `02-DOCS/wiki/sdd/constitution.md` holds the project's non-negotiables
   (stack canon, quality bars, conventions). Every architectural choice must be consistent with it;
   when the plan needs to bend a principle, say so explicitly with a reason — don't bend it silently.
4. **Read the Knowledge map.** The full index at `02-DOCS/wiki/index.md` (root `CLAUDE.md` keeps only a short pointer to it) points at existing
   `02-DOCS/wiki/stack/*` and prior plans/decisions. Reuse what's already established. A plan that
   reinvents a pattern the project already settled is scope drift.

Only when the spec is present and clarified do you plan.

## What a plan contains

A plan is the answer to seven questions, in this order. Each is a section of the artifact
(template in `references/plan-template.md`). Fill them top-down; later sections lean on earlier ones.

| # | Section | The question it answers |
| --- | --- | --- |
| 1 | Context & constraints | What spec/constitution facts pin this design down? |
| 2 | Architecture | What are the components and how do they fit together? |
| 3 | Interfaces & contracts | What does each component promise to the others? |
| 4 | Data model & flow | What data exists, where it lives, how it moves and changes? |
| 5 | Testing strategy | How will we *prove* each part does what it claims? |
| 6 | Sequencing & dependencies | In what order can this be built and verified? |
| 7 | Risks & open decisions | What is most likely to be wrong, and what's still undecided? |

Detailed guidance and the fill-in template live in `references/plan-template.md`. The essentials of
each section:

### 1. Context & constraints

Restate, in one or two lines each, the spec facts and constitution rules that actually constrain
the design — the acceptance criteria, the non-functional bars (latency, scale, data residency),
the stack canon. Don't re-paste the spec; cite it (`spec §Acceptance #3`). This section is the
plan's contract with intent: if a reviewer disagrees with the design, this is where they check
whether you misread the constraints.

### 2. Architecture

Name the components and draw the relationship — a small box-and-arrow diagram in a fenced block,
plus a sentence per component stating its single responsibility. Mark each component's boundary:
what's inside the system you're building vs. an external dependency. Show where the seams are,
because the seams are where you'll test, mock, and parallelize later.

```text
[ client ] --HTTP--> [ api: orders ] --calls--> [ svc: reservation ]
                            |                            |
                            v                            v
                     [ db: orders ]              [ external: payments ]
```

State the **one** architectural decision that matters most and why you made it (sync vs. async,
monolith vs. split service, read model vs. single table). One real decision, defended, beats five
hedged ones. If two designs are genuinely viable, present both with the trade-off and a
recommendation matched to the constitution — don't leave the reader to guess which you'd ship.

### 3. Interfaces & contracts

For each seam in the architecture, define the contract at the **shape** level, not the
implementation: the operation name, its inputs and outputs, its error modes, and its invariants
(idempotent? transactional? ordered?). This is where most integration bugs are prevented or born.

```text
reservation.reserve(cartId: CartId) -> Reservation | OutOfStock | CartNotFound
  - idempotent on cartId (calling twice returns the same Reservation)
  - holds stock for 15 min, then auto-releases
  - never partially reserves: all lines or none
```

Keep it language-neutral. The stack skill turns this into a typed signature, a route, or an
interface later — and it will, because you gave it an unambiguous contract.

### 4. Data model & flow

Name the entities, their key fields, and their relationships — again at the model level, not DDL.
Then trace the **flow**: for the primary scenario in the spec, follow one request from entry to
persistence and back, naming what reads and writes each store. Call out the consistency boundaries
(what's transactional together, what's eventually consistent) and the migration impact (new table?
new column? backfill?). Concrete schema, indexes, and migration mechanics → `../postgresdb/SKILL.md`.

### 5. Testing strategy

Decide *how each claim in the spec gets proven* before any code exists — this is what makes
`implement`'s TDD discipline possible. For each acceptance criterion, name the level that proves it
(unit / contract / integration / e2e), what the test asserts, and what it has to fake to stay fast.
You are choosing the *strategy* (which seams to test, what to mock, where the e2e line is); the
stack skill owns the *tooling* (the runner, the fixtures, the assertion library). A plan whose
testing section is "we'll add tests" has no testing strategy — name the levels and the seams.

### 6. Sequencing & dependencies

Order the work so each step is independently verifiable and the dependency graph is explicit. Mark
which steps are independent (candidates for fan-out via the `parallel` phase when it's available)
and which must be serial. This section is the bridge to `tasks`: a clean sequence here becomes a
clean task list there.

### 7. Risks & open decisions

List what is most likely to be wrong, ranked. For each risk: the trigger, the impact, and the
mitigation or the spike that would retire it. Separately, log any decision still genuinely open
(and what input would close it). Honesty here is the whole point — a plan that claims zero risk is
the riskiest plan. Significant design decisions taken during planning also get appended to
`02-DOCS/wiki/sdd/decisions.md` (the SDD decisions log), so later phases can trace the *why*.

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — architecture, interfaces, data flow and risks are the heaviest cognitive load in the chain. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Adapting to the dial

Read `02-DOCS/wiki/harness/user-profile.md` and match the artifact and your narration to it:

| Level | How `plan` behaves |
| --- | --- |
| **L0** | Terse plan: the seven sections, minimal prose, diagram + contracts + risks. No narration in chat — write the file, point to it. |
| **L1** | Same artifact, one line of *why* on the top architectural decision. |
| **L2** | Justify each significant design choice in the artifact; surface trade-offs you weighed. |
| **L3** | Explain-everything: walk the non-technical user through the architecture in plain language, ask about constraints you can't infer (one focused question at a time), define terms inline. |

The dial changes how much you *say*, never whether the seven sections exist. Even at L0 the plan is
complete; it's just quiet.

## The artifact

Write to `02-DOCS/wiki/sdd/plans/<slug>.md`, where `<slug>` matches the spec's slug exactly (one
plan per spec, same name — that's how `tasks`, `analyze`, and `implement` find it). Use
`references/plan-template.md` verbatim as the skeleton. Then index it in `02-DOCS/wiki/index.md`
(the Knowledge map; root `CLAUDE.md` keeps only a short pointer) pointing at the new plan, so the harness wiki and
every later phase can find it. If a plan for this slug already exists, update it in place and note
what changed — don't fork a `-v2`.

## Anti-patterns → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I'll just write the actual code in the plan, it's faster" | You dropped an altitude. The plan owns structure; syntax is the stack skill's job at `implement`. Pull back to contracts. |
| "The spec's a bit fuzzy but I get the gist, I'll plan around it" | A plan on an unclarified spec is a guess. STOP, route to `clarify`, then plan. |
| "Testing strategy = 'we'll write tests'" | That's not a strategy. Name the level per acceptance criterion and what each test fakes. |
| "Risks section feels negative, I'll keep it short" | The plan that claims no risk is the riskiest. Rank the real risks and give each a mitigation. |
| "I'll pick the framework and ORM and config here" | Stack canon lives in the constitution; mechanics live in the stack skill. The plan stays stack-neutral above the seam. |
| "Two designs are fine, I'll list both and let them choose" | Decide. Present alternatives only with a trade-off and a recommendation matched to the constitution. |
| "I'll plan the whole sequence as one big step" | Then `tasks` can't slice it and nothing's independently verifiable. Break it into ordered, checkable steps. |
| "There's already a plan for this slug, I'll start a fresh one" | Update in place and note the change. Forked plans rot; later phases read the wrong one. |

## When NOT to use

- Capturing what to build and why, from a fuzzy idea → `../specify/SKILL.md`.
- Removing ambiguity / edge cases from an existing spec → `../clarify/SKILL.md`.
- Slicing an approved plan into an ordered task checklist → `../tasks/SKILL.md`.
- Concrete framework/ORM/test-runner mechanics → the relevant stack skill
  (`../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../flutter/SKILL.md`,
  `../postgresdb/SKILL.md`).
- Project-wide non-negotiables (stack canon, quality bars) → `../constitution/SKILL.md`.

## Always propose isolation before the build

Once the plan is written, **always propose isolating the work in a git worktree/branch** before
any code is implemented — every feature, not just the risky ones. One line, calibrated to the dial:

> *"Antes de implementar, ¿aíslo este trabajo en un worktree/rama propia (`../worktrees/SKILL.md`)
> para no tocar tu rama actual? (recomendado)"*

Propose it here at the plan→build boundary so the decision is made before `implement` writes a line.
If the user accepts, hand to `../worktrees/SKILL.md` first; if they decline, note it and continue.
If you are already on the default branch (`main`/`master`), isolation is **not** optional — say so
and route to `worktrees` regardless. (`implement` re-checks this as a hard gate before its first commit.)

## Next in the chain

Plan written, indexed, decisions logged → propose isolation (above), then hand off to
**`../tasks/SKILL.md`**, which turns the sequencing section into an ordered, independently-verifiable
task list with a done-check per task. If planning surfaced an ambiguity the spec never resolved,
loop back to **`../clarify/SKILL.md`** before tasking.
