---
name: implement
description: "Use when executing a planned feature into working, tested code — turning the tasks list into commits, writing code task-by-task under TDD discipline (failing test first, then the code that passes it, then refactor), with a stop-and-show checkpoint after each task. Triggers: 'implement the plan', 'build out the tasks', 'start coding this feature', 'work through the task list', 'execute the implementation', 'write the code for this spec', 'do task 3', 'continue implementing', 'red-green-refactor this', 'implement with tests first'. The SDD phase AFTER analyze and BEFORE verify. Embeds red→green→refactor and delegates concrete test tooling to the stack skill (fastapi/go/nextjs/flutter); fans independent tasks out via parallel; logs every non-obvious choice to 02-DOCS/wiki/sdd/decisions.md and stays inside the constitution. NOT spec writing, NOT planning, NOT the final lint/audit gate."
tags: [sdd, implement, code]
recommends: [verify]
profiles: [core, full]
origin: risco
---

# implement — turn the task list into tested code

You have a spec, a plan, and an ordered task list (from `specify` → `plan` → `tasks`), and the
`analyze` gate has cleared. This skill does the building: it walks the tasks in order, writes each
one **test-first**, stops to show its work after every task, and records the decisions it makes
along the way. It is the *intent → shipped code* engine's hands — `verify` is the gate that comes
after, not part of this skill.

This is a **process skill**. It owns the discipline (red → green → refactor, checkpoints, decision
logging, constitution adherence). It does **not** own the test tooling — pytest fixtures, `go test`
table-drivers, Vitest/Playwright, `flutter test` — those belong to the stack skill, and you call
into them rather than reinventing them.

## Before you write a line of code

Run this short gate. Skipping it is the most common way an implement session goes sideways.
**This gate is a hard refuse, not a checklist to feel good about:** if it fails you stop and route
back — you do not write feature code anyway.

1. **The spec + plan must exist AND be approved.** Open the spec (`02-DOCS/wiki/sdd/specs/<slug>.md`),
   the plan (`02-DOCS/wiki/sdd/plans/<slug>.md`, which holds the task list), and the constitution
   (`02-DOCS/wiki/sdd/constitution.md`). If any is missing, **you are not allowed to implement** —
   route back: no spec → `specify`; no plan → `plan`; no task list inside the plan → `tasks`;
   unresolved `analyze` findings → resolve them first. If a spec/plan exists but the user has not
   actually seen and **approved** it, get that approval first. Never "start coding to discover the
   plan as you go", and never accept "just build it, skip the spec" on a non-trivial feature — name
   the gate in one friendly line and route to `specify`. (Only a true one-line, low-risk change
   earns a skip, and you say so.)
2. **Read the SDD runtime config.** Open `02-DOCS/wiki/sdd/config.yaml`. If it is missing on
   non-trivial work, stop and route to `sdd-init`. Use `testing.strict_tdd`,
   `testing.commands.apply`, `testing.commands.verify`, `sdd.review_budget` and
   `sdd.registry_path`. Do not choose a different test command from memory while config exists.
3. **Read the skill registry.** Open `.rsc/skill-registry.json` if present. Select only the
   relevant stack/process skills for this task, then digest them into compact rules. If the
   registry is missing, run or recommend `npx @ericrisco/rsc registry refresh` and record the fallback.
4. **Read the accompaniment dial.** Open `02-DOCS/wiki/harness/user-profile.md` and read the
   technical + accompaniment level. It sets how loud you are at each checkpoint (see the dial table
   below). No profile yet → assume non-technical, narrate more, and ask before any irreversible step.
5. **Confirm isolation.** Implementation happens on a feature branch or worktree, never directly on
   the default branch. If you are on `main`/`master`, stop and hand to `worktrees` before the first
   commit.
6. **Scan the tasks for independence.** Mark which tasks share files/state and which are disjoint.
   Disjoint clusters are candidates for `parallel`; everything else runs in order.

## The loop — one task at a time

For **each task** in the list, in order (or dispatched per the parallel rule below):

```text
RED      → write the smallest failing test that encodes the task's done-check. Run it. Watch it FAIL
           for the right reason (assertion, not import error). A test that was never red proves nothing.
GREEN    → write the least code that makes that test pass. No extra features, no "while I'm here".
           Run the test. Watch it PASS.
TRIANGULATE → add the smallest edge-case test that proves the behavior is not hard-coded
           (only when config.testing.strict_tdd is true and the task has meaningful edge cases).
REFACTOR → with the test green, clean up names/duplication/shape. Re-run; still green. Only now.
CHECK    → re-read the task's done-check. Met? Constitution still honored? Decision worth logging?
PROGRESS → append task/test/blocker/decision state to 02-DOCS/wiki/sdd/progress/<slug>.md.
COMMIT   → commit this task as one logical unit (authorship = Eric; see ship for the rule).
CHECKPOINT → stop and show: what changed, test output, the next task. Wait per the dial.
```

The order is load-bearing. **Red before green** is not a suggestion — a test you write *after* the
code tells you nothing about whether it can fail. **Refactor only on green** keeps every cleanup
reversible against a passing bar. **Checkpoint after each task** is what makes this resumable and
reviewable instead of a 2000-line surprise diff.

### The done-check is the contract

Each task carries a done-check from the `tasks` phase ("returns 409 on duplicate email", "list
renders empty state when zero items"). That sentence **is** your first failing test. Do not invent a
looser check, and do not mark a task done because the code "looks right" — done means the done-check's
test is green and the relevant acceptance criterion in the spec is satisfied.

## Delegating the test tooling (do not reinvent it)

Write the *intent* of the test here; get the *mechanics* from the stack skill. The discipline is
yours; the fixtures, runners and idioms are theirs.

| Stack | Where the test mechanics live | What you delegate |
| --- | --- | --- |
| FastAPI / async Python | `../fastapi/references/testing.md` | `ASGITransport` in-process client, `dependency_overrides`, transactional rollback fixture, `pytest-asyncio` |
| Go services | `../go/references/testing.md` | table-driven subtests, `httptest`, interface fakes, golden files, `errors.Is` checks |
| Next.js / React | `../nextjs/references/testing.md` | Vitest + Testing Library for units, Playwright for flows, server-action / RSC testing |
| Flutter | `../flutter/references/testing.md` | `flutter test` widget tests, `pump`/`pumpAndSettle`, golden tests, mocked repositories |

If the feature spans two stacks (a Next.js front-end calling a FastAPI back-end), each task names its
stack and pulls that stack's testing reference — you do not mix idioms inside one task.

## Skill digestion and resolution

When a task or subagent needs skill context, use the registry path from config:

```text
.rsc/skill-registry.json
```

Select the smallest set of skills that match the task. Digest each selected skill into 4-5 compact rules that affect this task. A task brief or checkpoint includes:

```text
Selected skills: fastapi, postgresdb, implement
Compact rules:
- Use the configured apply command from config.yaml.
- Red test first; verify it fails for the right reason.
- Keep DB migrations expand-contract when touching production tables.
Skill resolution:
- used: [...]
- missing: [...]
- fallback: [...]
```

If a skill is referenced but unavailable, say so and record the fallback. Do not silently pretend it was used.

## Apply progress

Maintain an append-only progress file:

```text
02-DOCS/wiki/sdd/progress/<slug>.md
```

Entry shape:

```markdown
## T004 — 2026-06-02
- status: complete
- red: `pytest tests/auth/test_login.py::test_bad_password_returns_401` failed for expected missing route
- green: same test passed
- triangulation: blank title returns 422
- files: app/auth.py, tests/auth/test_login.py
- decision: none
- blocker: none
```

This file is what makes resumes and archive reliable. Never rewrite old entries; append corrections as new entries.

## Running independent tasks in parallel

When two or more tasks are genuinely disjoint — **no shared files, no shared state, no ordering
dependency** — fan them out with `parallel` rather than serializing. The rule of thumb:

- **Serialize** when a later task imports, edits, or asserts against an earlier task's output, or
  when they touch the same file.
- **Parallelize** when each task could be done by a different person who never talks to the others
  (e.g. "add the `users` repository" and "add the `invoices` repository" in separate modules).

Each parallel branch still runs its own full red → green → refactor loop and reports back its diff +
test output. You merge the branches, then run the *combined* test suite before the next checkpoint —
green-in-isolation is not green-together. Hand the orchestration to `parallel`; keep the TDD
discipline inside each branch.

## Model tier — `balanced` (opt-in routing)

This phase's default model tier is **`balanced`** — it is the bulk of TDD execution: cost-sensitive, with quality balanced handles well. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model (this is where routing pays off most — fan-out runs on `balanced` while a hard sub-problem can be escalated to `heavy`). Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## The accompaniment dial — how loud at each checkpoint

Read the level from `02-DOCS/wiki/harness/user-profile.md` and match it. Same work, different volume.

| Level | At each checkpoint you show… | Questions you ask |
| --- | --- | --- |
| **L0** terse | one line: task done, tests green, moving on | none unless blocked or about to do something irreversible |
| **L1** brief | task + the one *why* behind any non-obvious choice | only where the plan genuinely forked |
| **L2** decisions | task + each relevant decision and its trade-off | confirm before deviating from the plan |
| **L3** full | task + reasoning, test output read aloud, what's next and why | ask to contextualize each decision; teach as you go |

The dial changes verbosity and question count — it **never** changes the engineering. TDD, the
done-checks, the constitution and decision logging hold at every level, including L0.

## Logging decisions (the 02-DOCS trail)

When you make a choice the plan did not fully specify — a library, a data shape, an error contract, a
deviation from the plan — append it to `02-DOCS/wiki/sdd/decisions.md` (append-only; create it if
absent and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) under the `sdd/` topic). One entry:

```text
## YYYY-MM-DD — <short title>  (feature: <slug>, task: <n>)
Context   — what forced the choice
Options    — the 2–3 real alternatives weighed
Decision   — what you chose
Why        — the trade-off that decided it
```

Log the **non-obvious** ones — the choices a reviewer would otherwise have to reverse-engineer from
the diff. Do not log "named the variable `count`". If a decision contradicts the constitution, you do
not get to log your way around it: stop (see red flags).

## Staying inside the constitution

`02-DOCS/wiki/sdd/constitution.md` holds the project's non-negotiables (stack canon, quality bars,
naming, security posture). Every task you implement must honor it. If a task can only be done by
breaking a constitutional rule, that is a contradiction the `analyze` phase should have caught —
surface it and stop; do not quietly violate the constitution to make a test pass. The constitution
outranks the plan, and the plan outranks your in-the-moment preference.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "I'll write the tests after, once the code settles" | Then the test only confirms what you built, not what was asked. Red first, always. |
| "This task is trivial, skip the failing test" | Trivial code breaks too, and the next task may lean on it. Smallest red test still goes first. |
| "I'm here anyway, I'll also fix that other thing" | Scope creep buries the diff and breaks the done-check contract. One task, one commit. |
| "The test passed first try without ever being red" | It tests nothing. Make it fail on purpose, then make it pass. |
| "I'll batch ten tasks into one big commit to save time" | You just made the work unreviewable and un-resumable. One logical unit per task. |
| "The constitution's rule doesn't fit here, I'll bend it" | The constitution outranks you. Surface the conflict; don't bend it silently. |
| "These two tasks touch the same file but I'll parallelize anyway" | Shared file = shared state = merge pain and lost work. Serialize them. |
| "Refactor now, the test is still red" | Never refactor on red — you can't tell a cleanup from a regression. Get green first. |
| "I'll mark it done, the code looks correct" | Done = the done-check's test is green and the acceptance criterion holds. Looks ≠ green. |
| "I'll just write the .env so the integration test runs" | Never. Secrets are the user's; mock/stub the boundary or use a test fixture. |

## Red flags — stop and re-route

- **No plan or no task list** → you cannot implement intent you haven't planned. Route to `plan` /
  `tasks`.
- **Unresolved `analyze` findings** (contradiction between constitution ↔ spec ↔ plan ↔ tasks) →
  resolve them before any code; they will only get more expensive after the diff exists.
- **A task forces a constitution violation** → surface it, stop, kick it back to `analyze`/`plan`.
- **You're on the default branch** → stop before the first commit; hand to `worktrees`.
- **A test won't go red** (wrong reason — import error, syntax) → fix the test before trusting it.
- **The combined suite is red after a parallel merge** → do not checkpoint as done; debug with
  `debug` before continuing.
- **You're tempted to disable/skip a failing test to "make progress"** → that's the bug talking.
  Diagnose with `debug`; never ship around a red test.

## Checklist (copy per task)

```text
- [ ] Read the task's done-check; it is my first test's assertion
- [ ] RED: smallest test written, run, fails for the RIGHT reason
- [ ] GREEN: least code to pass; test now green
- [ ] REFACTOR: cleaned up on green; still green
- [ ] Constitution honored; no banned pattern introduced
- [ ] Non-obvious decision (if any) logged to 02-DOCS/wiki/sdd/decisions.md
- [ ] Apply progress appended to 02-DOCS/wiki/sdd/progress/<slug>.md
- [ ] Skill resolution recorded (used/missing/fallback/compact rules)
- [ ] Committed as one logical unit (authorship = Eric)
- [ ] Checkpoint shown at the dial's level; next task named
```

## Result envelope

End every implementation checkpoint or completed batch with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Implemented task(s) with red/green/triangulate/refactor evidence.",
  "artifact": "02-DOCS/wiki/sdd/progress/<slug>.md",
  "next_recommended": "implement|verify",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["implement"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Use config testing commands.", "Append progress after every task."]
  },
  "evidence": ["red test output", "green test output", "progress entry path"]
}
```

## What this skill is NOT

- **Not the lint/type/audit gate.** Per-task tests prove the task; the *whole-suite* run plus
  lint/type/security audit and acceptance-criteria sign-off is `verify`'s job. Don't claim the
  feature is done here — that claim belongs to `verify`, on evidence.
- **Not spec or plan writing.** If you find the plan is wrong mid-build, stop and amend it via
  `plan`; don't silently re-architect inside a commit.
- **Not the deep-debug protocol.** When a test fails for a reason you don't understand, switch to
  `debug` (reproduce → isolate → hypothesize → fix → verify) instead of guessing.

## Where you are in the chain

`constitution` → `specify` → `clarify` → `plan` → `tasks` → `analyze` → **implement** → `verify` →
`review` → `ship`. On-demand from here: `debug` (a test fails mysteriously), `worktrees` (need
isolation), `parallel` (independent tasks to fan out).

**Next:** when every task's done-check is green and committed, go to `verify` — run the stack skill's
`scripts/verify.sh`, confirm the spec's acceptance criteria, and let evidence (not assertion) declare
the feature done.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

