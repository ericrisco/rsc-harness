---
name: tasks
description: "Use when an approved plan needs slicing into an ordered task list before any code — the SDD `tasks` phase. Each row carries a literal done-check, dependencies, a parallel-safe marker and a spec trace, appended to the plan artifact. NOT writing the plan (that is `plan`), NOT the consistency gate (that is `analyze`), NOT executing the tasks (that is `implement`)."
tags: [sdd, tasks, breakdown]
recommends: [analyze, implement]
profiles: [core, full]
origin: risco
---

# Tasks — turn an approved plan into a verifiable work list

The `tasks` phase is the hinge between *thinking* and *doing*. The plan already
decided the architecture, the interfaces, and the testing strategy. This phase
slices that plan into the **smallest units a coding agent can finish, prove, and
hand off** — each one ordered, each one carrying a *done-check* that a machine or
a reviewer can run without trusting anyone's word.

A task list is not a to-do list. A to-do list says "build the auth endpoint". A
task list says "T004: implement `POST /login`; done when `pytest
tests/auth/test_login.py` is green AND a 401 is returned for a bad password —
depends on T002, T003; parallel-safe with T005." The difference is that the
second one can be **handed to a subagent, executed, and verified** with no
further questions. This phase writes zero runtime code; it produces one artifact,
appended to the plan it was built from.

## Model tier — `balanced` (opt-in routing)

This phase's default tier is **`balanced`**: decomposing an approved plan is
structured work, not architecture. Routing is off unless `models.enabled: true`
in `02-DOCS/wiki/sdd/config.yaml`; when on, resolve the tier and apply it per
`../sdd/references/model-routing.md`, which owns the resolution order and the
announcement rules. Routing off or no profile → honor the session model silently.

## Read the harness profile first

Read `02-DOCS/wiki/harness/user-profile.md` before producing anything and match
the accompaniment dial: **L0** emit the task table and nothing else; **L1** add
one line of *why this slicing* above it; **L2** justify the ordering and the
parallel markers as you go, flagging the risky tasks; **L3** walk each dependency
and confirm the done-checks make sense to the user before writing. No profile →
assume non-technical and let `init` gauge the level; never invent one.

## Inputs (refuse to start without them)

You break down a **plan**, not an intent. Before slicing, confirm all three exist:

1. **The plan** — `02-DOCS/wiki/sdd/plans/<slug>.md`, written by the `plan`
   phase. It must contain the architecture, interfaces, and testing strategy.
2. **The spec** — `02-DOCS/wiki/sdd/specs/<slug>.md`, so every task traces to a
   requirement. A task with no spec line behind it is scope you are inventing.
3. **The constitution** — `02-DOCS/wiki/sdd/constitution.md`, the non-negotiable
   bars (stack canon, quality gates) every task must respect.
4. **The SDD config** — `02-DOCS/wiki/sdd/config.yaml`, if present. Use its
   `review_budget`, `delivery_strategy` and `testing.commands` when writing
   done-checks and review forecasts. If it is missing on non-trivial work,
   recommend `sdd-init`.

If the plan is missing, **stop and route to `plan`**. If the plan exists but is
vague on interfaces or testing, route back to `plan` to tighten it — do not
paper over a thin plan with guesswork in the task list. That guesswork is the
exact thing `analyze` will catch next, and you will have wasted the round trip.

## What makes a task well-formed

Every task is one row. A row is well-formed only when all six fields hold:

| Field | Rule |
| --- | --- |
| **ID** | `T001`, `T002`, … — sequential, zero-padded, no hyphen (GitHub Spec Kit canon). Stable, never renumbered once written (downstream phases cite it). |
| **[P]** | A **separate field after the ID**: `[P]` if the task is parallel-safe, blank otherwise. Never fold the marker into the ID. |
| **Title** | One imperative verb + object. "Implement", "Add", "Wire", "Migrate" — not "Handle" or "Support". |
| **Done-check** | The **literal** command or observation that proves done. Runnable, not a feeling. See below. |
| **Depends-on** | The task IDs that must finish first, or `—` for none. Drives the ordering and the parallel markers. |
| **Trace** | The spec section / acceptance criterion this task satisfies. Every task traces to one; if it can't, it's out of scope. |

Put `[P]` (parallel-safe) in its own field only when the task shares **no files
and no state** with another unblocked task. When in doubt, leave it blank — a
false `[P]` causes the merge collisions `parallel` exists to prevent.

## The done-check is the whole point

A done-check has to be **executable evidence**, owned by the stack, not a
self-graded claim. Delegate the *form* of the check to the relevant stack skill
and quote the actual command:

- Backend (Python/FastAPI) → a `pytest` invocation; route to `../fastapi/SKILL.md`.
- Go services → a `go test ./...` target; route to `../go/SKILL.md`.
- Frontend (Next.js) → a component/e2e test or a typed build; route to `../nextjs/SKILL.md`.
- Flutter → a `flutter test` target; route to `../flutter/SKILL.md`.
- Schema/migrations → a migration applies + a query returns expected rows; route to `../postgresdb/SKILL.md`.

```text
WEAK   done-check: "login works"
STRONG done-check: pytest tests/auth/test_login.py::test_bad_password_returns_401  → green
                   AND manual: POST /login {wrong pw} returns 401, no token in body
```

A done-check you cannot run is not a done-check. If the plan's testing strategy
doesn't support a runnable check for a slice, that is a **plan gap** — name it
and send it back, don't write a vague check to keep moving.

## TDD-shaped slicing (default)

The `implement` phase runs red → green → refactor. Slice so it can. For each
behavioral unit, the natural shape is a test-first pair the implementer executes
in order:

1. **Txxx (test):** write the failing test for the behavior. *Done when the test
   exists and fails for the right reason.*
2. **Txxx+1 (impl):** implement until that test is green. *Done when the test
   passes and nothing else regresses.*

You don't have to split every task in two, but the done-check of an
implementation task should always be *a test that was red and is now green*. This
is where `tasks` and `implement` shake hands: the list you write is the list TDD
will execute.

## The slicing procedure

```text
1. WALK the plan top to bottom. List every concrete deliverable
   (endpoint, model, migration, component, job, config).
2. For each deliverable, ask: smallest slice that produces a runnable
   done-check? Split until each task is verifiable on its own.
3. ORDER by dependency. Foundations first: schema → data layer →
   service → API → UI. A task never precedes what it depends on.
4. MARK [P] only on tasks that share no files/state with another
   unblocked task. Default to sequential.
5. TRACE each task back to a spec line. No trace → cut it (scope creep)
   or send the gap to `clarify`/`specify`.
6. ADD the cross-cutting closers: a final "all done-checks pass" task
   and a "verify.sh green" task that hands off to `verify`.
7. ADD a review workload + delivery forecast before implementation.
8. APPEND the table to the plan artifact (see below). Do not start a
   new file; the list lives with the plan it came from.
```

## Where the artifact lives

The task list is **not** a new document. Append it to the existing plan under a
`## Tasks` heading:

```text
02-DOCS/wiki/sdd/plans/<slug>.md
  ├─ ## Architecture        (from plan)
  ├─ ## Interfaces          (from plan)
  ├─ ## Testing strategy    (from plan)
  └─ ## Tasks               ← you append this
       T001 … T0NN as the table below, + a one-line "generated by tasks on <date>"
```

Then ensure the plan is indexed in `02-DOCS/wiki/index.md` (the Knowledge map;
root `CLAUDE.md` keeps only a short pointer) under the `sdd/` topic — the `plan`
phase usually added the row, so confirm it points at
`02-DOCS/wiki/sdd/plans/<slug>.md` and add it if missing. Additive only: never
delete a user's map entry.

### The table format

```markdown
## Tasks
<!-- generated by tasks on 2026-06-01; IDs are stable, do not renumber -->

| ID | [P] | Task | Done-check | Depends-on | Trace |
| --- | --- | --- | --- | --- | --- |
| T001 |  | Add `users` table migration | `alembic upgrade head` applies clean; `\d users` shows email UNIQUE | — | spec §3 Data |
| T002 | [P] | Add `sessions` table migration | migration applies; FK to users present | T001 | spec §3 Data |
| T003 |  | Write failing test for `POST /login` | `pytest tests/auth/test_login.py` fails: no route | T001 | spec §4 Auth |
| T004 |  | Implement `POST /login` | T003 test green; bad pw → 401 | T003 | spec §4 Auth |
| ... | ... | ... | ... | ... | ... |
| T0NN |  | All done-checks pass + `verify.sh` green | every row above checked; `scripts/verify.sh` exits 0 | all | spec §Acceptance |
```

### Per-task Interfaces (for context-isolated implementers)

`implement` and `parallel` dispatch tasks to **context-isolated** workers (the `developer`
subagent) that see *only their own task* — not the whole plan. Such a worker can't infer a
neighbor's function signature, payload shape, or column name from a one-line row. For any task
whose correctness depends on a contract it doesn't own, attach an **Interfaces block** right under
its row. Trivial, self-contained tasks don't need one — don't add ceremony where there's no
cross-task contract.

```markdown
**T004 — Interfaces**
- Consumes: `auth.verifyPassword(plain: str, hash: str) -> bool` (from T003); `users.email UNIQUE`
- Produces: `POST /login` → `200 {token}` | `401 {error}`; sets `Set-Cookie: sid=…; HttpOnly`
```

Quote **exact** signatures and shapes, not descriptions — the isolated worker copies them, it can't
go look them up. "Returns the user" is invisible; `-> {id, email}` is usable. `Consumes` names what
the task reads from a neighbor or the environment; `Produces` names the contract later tasks (and
the per-task reviewer) will hold it to. The plan's **§0 Global Constraints** are inherited by every
task implicitly — do **not** repeat them per task. Interfaces carry the *task-local* contract;
Global Constraints carry the *project-wide* one. Together they are everything a blind implementer
needs.

## Review workload + delivery strategy forecast

After the task table, append a short forecast. This protects the human reviewer
before a giant diff exists.

```markdown
## Review Workload Forecast

| Dimension | Forecast | Why |
| --- | --- | --- |
| Estimated changed lines | <number or range> | based on task count + touched areas |
| Files / areas | <count and names> | modules, migrations, UI, tests, docs |
| Review risk | low / medium / high | complexity, cross-stack scope, security/data changes |
| Suggested delivery | single-pr / ask-on-risk / autochain / exception | matched to config.review_budget |
```

Pick the delivery strategy from the forecast: tiny change → `single-pr`; estimated
lines over `config.sdd.review_budget.line_budget` (default 400) → recommend
splitting or `ask-on-risk`; many areas or cross-stack contracts touched →
`autochain` or a feature-track branch. A deadline or emergency that justifies a
large review is marked `exception` and requires explicit user approval later.

## Anti-patterns → STOP

| Tempting move | Why it's wrong / Fix |
| --- | --- |
| "I'll write tasks straight from the user's intent" | You're skipping `plan`. Tasks slice a plan, not a wish. Route to `plan`. |
| "Done-check: 'feature works'" | Not runnable, not evidence. Quote the literal test/command, or it's not a done-check. |
| "One giant task: 'build the backend'" | Unverifiable, un-handoffable. Split until each slice has its own runnable check. |
| "Mark everything `[P]` so it goes faster" | Shared files = merge collisions. `[P]` only when scope is truly disjoint. |
| "This task has no spec line but we obviously need it" | That's scope creep wearing a hat. Trace it or cut it; if it's real, send it to `clarify`. |
| "The plan is thin here, I'll guess the slice" | `analyze` will reject the guess next phase. Tighten the plan first. |
| "I'll start coding the easy task while I list the rest" | This phase writes zero runtime code. Implementation is `implement`. |
| "Renumber the IDs so they're contiguous" | Downstream phases cite IDs. They're stable once written. Append, don't renumber. |

## Result envelope

End with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Task list and review workload forecast appended to the plan.",
  "artifact": "02-DOCS/wiki/sdd/plans/<slug>.md",
  "next_recommended": "analyze",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["tasks"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Every task needs a runnable done-check.", "Forecast review load before implementation."]
  },
  "evidence": ["task table appended", "review workload forecast appended"]
}
```

## Next in the SDD chain

The task list is now the contract for the rest of the build. Hand off to
**`analyze`** — the consistency gate that cross-checks constitution ↔ spec ↔ plan
↔ **tasks** and surfaces orphan tasks and untraceable scope — and then to
**`implement`**, which executes the list TDD-style, using `parallel` for the `[P]`
tasks and `worktrees` for isolation.

Do not jump straight to `implement`. The whole point of writing a checkable list
was to let `analyze` audit it cheaply *before* code exists.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
