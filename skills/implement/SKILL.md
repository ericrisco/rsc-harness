---
name: implement
description: "Use when an approved plan and task list exist and it is time to turn them into working, reviewed code — ASDD stage 4, the per-task loop after `analyze`: TDD build and self-check, `rsc risk` on the diff, review scaled by tier (0/1/3 reviewers), mandatory controls (tests, build, security, traceability), at most 3 fix rounds, then fix-and-record or park in the decision queue. Progress ledger survives compaction; disjoint tasks fan out via `parallel`. NOT spec writing (that is `specify`), NOT planning (that is `plan`), NOT the closing whole-branch gate (stage 5: `verify` + `review`)."
tags: [asdd, sdd, implement, code]
recommends: [verify, review]
profiles: [core, full]
origin: risco
---

# implement — turn the task list into tested code

You have a spec, a plan, and an ordered task list (from `specify` → `plan` → `tasks`), and the
`analyze` gate has cleared. This skill is **ASDD stage 4**: it walks the tasks in order and runs each
one through a build → risk → review → controls → fix → decide loop before the next starts. Review
lives *inside* the task, not after the branch: tests prove the code works, not that it is what was
asked, and an unrequested feature caught at one commit is cheap — caught under thousands of green
tests at the end, it is not.

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
4. **Read the register.** Open `02-DOCS/wiki/harness/user-profile.md` and read `technical_level`.
   It picks technical terms or plain words with analogies at each checkpoint (see "Checkpoints"
   below). No profile yet → use analogies, and ask before any irreversible step.
5. **Confirm isolation.** Default branch open for this project → work on it. Closed → stop before
   the first commit and ask: this branch, a new one, or unlock (`worktrees`)? Never branch on your
   own; another session in this folder makes the worktree mandatory.
6. **Scan the tasks for independence.** Mark which tasks share files/state and which are disjoint.
   Disjoint clusters are candidates for `parallel`; everything else runs in order.

## The loop — seven steps per task

For **each task** in the list, in order (or dispatched per the parallel rule below), run a → g.

### a) Build and self-check (TDD)

```text
RED      → write the smallest failing test that encodes the task's done-check. Run it. Watch it FAIL
           for the right reason (assertion, not import error). A test that was never red proves nothing.
GREEN    → write the least code that makes that test pass. No extra features, no "while I'm here".
           Run the test. Watch it PASS.
TRIANGULATE → add the smallest edge-case test that proves the behavior is not hard-coded
           (only when config.testing.strict_tdd is true and the task has meaningful edge cases).
REFACTOR → with the test green, clean up names/duplication/shape. Re-run; still green. Only now.
COMMIT   → commit this task as one logical unit (authorship = Eric; see ship for the rule).
```

The order is load-bearing. **Red before green** is not a suggestion — a test you write *after* the
code tells you nothing about whether it can fail. **Refactor only on green** keeps every cleanup
reversible against a passing bar. Self-check means evidence: the test output you saw, not "I tested it".
**ESM (and any language where a missing module fails at load):** a test importing a module that
does not exist dies on the import, not on the assertion — that red proves nothing. Create the module
first with a stub export (`export function total() { return 0 }`), then the red must fail on the
assertion.

### Four things you may never do to reach green

1. **Never weaken a test to make it pass.** Not broadening an assertion, not adding a skip, not
   raising a tolerance, not deleting it. A test that looks wrong is a **spec conversation** — surface
   it, don't bury it.
2. **Never edit a test and the implementation in the same step to reach green.** Change one, run,
   then the other. Simultaneous edits let you redefine correctness to match your bug without
   noticing you did it.
3. **Never mock the unit under test**, or mock so much that the test only exercises the mocks. Mock
   boundaries you don't own — network, clock, filesystem, third-party SDK — never the logic you are
   being paid to verify.
4. **Never chase the coverage number.** Coverage detects untested code; it is not a target. A test
   added to touch lines, with no meaningful assertion, is gaming — and mutation testing exists
   precisely to catch it (`../testing-py/SKILL.md`, `../testing-web/SKILL.md`, `../testing-go/SKILL.md`).

**The done-check is the contract.** The task's done-check **is** your first failing test. Never
invent a looser one; done means that test is green and the traced acceptance criterion holds.

### b) Risk — computed, never chosen

```bash
npx @ericrisco/rsc risk --base <task base sha> --json
```

It reads the task's **actual** diff through the sello's path table (sello on or off) and prints the
tier, the touched classes, `reviewers: 0|1|3` and `human approval: required|not required`. Tier 2 =
auth, billing, CI workflows, migrations, secrets, harness config. The computed tier wins over the
task's risk forecast. **The agent never picks or argues down its own tier.**

### c) Review scaled by tier — fresh context

Tier 1 or 2: first call `npx @ericrisco/rsc review ledger round <slug>/<task>` — before **every**
review of the task, this first one included. Round 1 is the task's first review, not its first fix.

| Tier | Review |
| --- | --- |
| 0 | none — the controls (e) still run |
| 1 | one fresh-context reviewer; frozen brief in `references/per-task-review.md` |
| 2 | the three refuters (`refuter-correctness` · `refuter-security` · `refuter-tests`) in parallel, as `../review/SKILL.md` runs them; then `review ledger panel <slug>/<task> --lenses correctness,security,tests` — the push gate checks it. Wait for every reviewer inside the turn; never end the turn to ask whether to continue |

Every reviewer gets the **spec**, the **diff as a file** (`scripts/review-package <BASE> <HEAD>`, BASE
= the task's *recorded* base sha, never `HEAD~1`), the **surrounding code** at that sha (not just the
hunk), the task's done-check, its **Interfaces → Produces** and the plan's **§0 Global Constraints**.
Never your session reasoning. **Anti-pre-judging (hard rule):** the dispatch never says what not to
flag, pre-rates a severity, or explains why a choice is fine — a stated rationale never downgrades a
finding.

### d) Consolidate, verify, record

Exactly as `../review/SKILL.md` → *Consolidate, then verify*: `npx @ericrisco/rsc review consolidate
<reports…>` (tier 1 too: it applies the downgrade), then `finding-verifier` on every finding it
marks `verify` — every blocker and should-fix. Findings use the JSON shape in
`references/per-task-review.md`. Then `npx @ericrisco/rsc review ledger record <findings.json>`. A
finding the ledger already holds comes back `repeat`: **never raise it again**. When a finding
closes, record its outcome: `review ledger outcome <id> fixed|false|intentional|irrelevant|parked`
(`parked` = its task went to the decision queue). The ledger is local (`.rsc/`, not committed);
what lasts is the review-evals cases and rules `review` writes from it.

### e) Mandatory controls — every tier

These are `verify`'s per-task mode (`../verify/SKILL.md`):

- **Tests** — the affected suite, not just the new test (`testing.commands.apply`).
- **Build** — the project compiles and type-checks.
- **Security** — the stack's audit; `../security-audit/SKILL.md` when input, authz or secrets are touched.
- **Traceability** — every new behaviour in the diff traces to a spec acceptance criterion.
  **Untraced behaviour is a finding.** This is the control that catches the unrequested feature: a
  QR nobody asked for passes every test.

A control that did not run is reported as **not run**, never as passed — and the task is not done.

### f) Fix loop — at most 3 rounds

Each re-review opens with another `review ledger round <slug>/<task>` (step c). It exits non-zero
on the 4th round with the action to take; obey it (step g).

- **From round 2, re-review only the new diff** (BASE = the previous round's head).
- **Fix the bug class, not the line**: name the class and fix every instance in the task's scope.
- **Never repeat a finding** — the ledger marks repeats; drop them.
- Re-run the controls (e) before the next round.

### g) Decide

| Situation | Action |
| --- | --- |
| Trivial, or no business weight | Fix it and record it in `decisions.md` with the task id |
| Tier 2, contradicts a decision in `decisions.md`, or no convergence in 3 rounds | Park the task in the **decision queue** (`blocking`) and continue with independent tasks |

The **decision queue** is a `## Decision queue` section in `02-DOCS/wiki/sdd/progress/<slug>.md`, one
entry per item: its kind, task id, tier, the question, the options, your recommendation, the
evidence path. **Kind is `blocking` or `review-after`.** Tier 2, a contradiction with a recorded
decision and no convergence are `blocking`: the task is parked, its dependents wait, and the branch
cannot merge itself. An assumption you took so work could continue is `review-after`: nothing waits
and it does not stop a self-merge — the human reads it afterwards. Only a human closes an entry —
an agent's approval never counts as human.

Then append the progress entry and show the checkpoint (below).

**`verify` and `review` run twice.** Per task, inside this loop (steps c–e); and once more at
**closing** (stage 5), over the whole branch against main.

## Delegating the test tooling (do not reinvent it)

Write the *intent* of the test here; get the *mechanics* (fixtures, runners, idioms) from the stack
skill's testing reference: `../fastapi/references/testing.md`, `../go/references/testing.md`,
`../nextjs/references/testing.md`, `../flutter/references/testing.md`. A feature spanning two stacks
names the stack per task and never mixes idioms inside one task.

## Skill digestion and resolution

Select the smallest set of skills from `.rsc/skill-registry.json` that match the task and digest
each into 4-5 compact rules. Every task brief or checkpoint carries `Selected skills`, `Compact
rules` and `Skill resolution` (`used` / `missing` / `fallback`). A referenced skill that is
unavailable is named with its fallback — never silently pretended.

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
- risk: tier 2 (auth) — 3 refuters
- review: 5 reported → 2 unique → 1 confirmed (fixed, round 2)
- controls: tests ✅ build ✅ security ✅ traceability ✅ (AC3)
- decision: parked in decision queue (tier 2)
```

This file is what makes resumes and archive reliable. Never rewrite old entries; append corrections as new entries.

### Resume & recovery — trust the ledger, not memory

The progress file is the source of truth across compaction and restarts:

- **A task recorded `status: complete` here is DONE — never re-dispatch it.** Re-running completed
  tasks (re-implementing, re-committing) is the single most expensive recovery failure: it rebuilds
  work that already exists and can clobber later commits.
- **After a compaction or a fresh session, reconstruct state from this ledger + `git log`, not from
  memory.** Read the progress entries and the commit history first; resume at the first task not
  marked complete. If the ledger and the working tree disagree, believe the tree and append a
  correction entry — do not silently re-run.

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

**Dispatch implementation work to the `developer` subagent.** rsc installs a `developer` agent
pinned to the balanced tier (Sonnet by default, chosen at onboarding, never `light`). When you
delegate a task or fan out via `parallel`, dispatch it to that agent (e.g. Claude Code
`subagent_type: developer`) so the bulk of TDD execution runs on the cheaper-but-capable model
while you stay on the session model to orchestrate. Full rationale: `../asdd/references/model-routing.md`.

### The dispatch contract (carriers, statuses, escalation)

A dispatched worker is **context-isolated** — it sees only what you hand it, not your session. Make
each dispatch self-sufficient and make its return machine-checkable:

- **Carry the task, not your context.** Hand the worker its task brief, its **Interfaces** block
  (`Consumes`/`Produces`, exact signatures — from `tasks`), and the plan's **§0 Global Constraints**.
  Anything not in those three is invisible to it. Prefer **file paths over pasted text** —
  `scripts/task-brief <plan> <N>` (N as `1`, `001` or `T001`; reads the `tasks` table row, its `**T001 — Interfaces**` block and
  any `### T1` detail block) and `scripts/review-package` — pasted briefs and diffs stay resident in
  your context and get re-read every turn.
- **Native isolation leaves worktrees behind.** A subagent dispatched with worktree isolation
  works in `.claude/worktrees/`. `rsc risk` ignores that folder, but after you cherry-pick the
  worker's commits, remove it (`git worktree remove <path>`).
- **Model is REQUIRED on every dispatch.** Always set the subagent's model explicitly (the
  `developer` agent already pins balanced). An omitted model silently inherits the session's model —
  usually the most expensive one — which is the quiet way fan-out cost explodes.
- **The worker reports one of four statuses** (it does not guess when unsure):
  - `DONE` — done-check green, `Produces` contract met.
  - `DONE_WITH_CONCERNS` — green, but it flagged a risk/assumption for you to adjudicate.
  - `BLOCKED` — cannot proceed (failing dependency, contradiction, missing access). Stops; does not
    hack around it.
  - `NEEDS_CONTEXT` — a `Consumes`/constraint it needed was not in the brief. Stops; names what's missing.
- **Never force the same model to retry unchanged.** On `BLOCKED`/`NEEDS_CONTEXT` you must *change
  something* before re-dispatching: add the missing context/interface, fix the dependency, or
  escalate the tier (balanced → heavy) for a genuinely hard sub-problem. Re-running an identical
  prompt on an identical model is how a loop burns budget without progress.

## Model tier — `balanced` (opt-in routing)

Default **`balanced`**. Routing is **off** unless `models.enabled: true` in `config.yaml`; when on,
apply `../asdd/references/model-routing.md` (hard sub-problem → `heavy`); off → session model.

## Checkpoints — what to say

In the `orient` voice and the `technical_level` register, show: the task, tier, review verdict
(reported → unique → confirmed), controls (passed / **not run**), rounds, the *why* of any
non-obvious choice, and the next task. Ask only where the plan forked; confirm before deviating or
anything irreversible. In autopilot, log it and continue. Brevity never changes the engineering.

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
| "I'll batch ten tasks into one big commit to save time" | You just made the work unreviewable and un-resumable. One logical unit per task. |
| "The constitution's rule doesn't fit here, I'll bend it" | The constitution outranks you. Surface the conflict; don't bend it silently. |
| "These two tasks touch the same file but I'll parallelize anyway" | Shared file = shared state = merge pain and lost work. Serialize them. |
| "I'll mark it done, the code looks correct" | Done = the done-check's test is green and the acceptance criterion holds. Looks ≠ green. |
| "I'll just write the .env so the integration test runs" | Never. Secrets are the user's; mock/stub the boundary or use a test fixture. |
| "This diff is obviously low-risk, skip the review" | The tier is `rsc risk`'s, not yours. Run it and obey it. |
| "The security scan didn't run, but nothing changed there" | Report it **not run**. The task is not done. |
| "Round 4 will crack it" | The ledger stops at 3. Park the task; continue with independent ones. |

## Red flags — stop and re-route

- **No plan or no task list** → you cannot implement intent you haven't planned: `plan` / `tasks`.
- **Unresolved `analyze` findings** (contradiction between constitution ↔ spec ↔ plan ↔ tasks) →
  resolve them before any code; they will only get more expensive after the diff exists.
- **A task forces a constitution violation** → surface it, stop, kick it back to `analyze`/`plan`.
- **You're on the default branch** → stop before the first commit and ask: branch or default branch (`worktrees`).
- **A test won't go red** for the right reason (import error, syntax) → stub the module, fix the test.
- **The combined suite is red after a parallel merge** → do not checkpoint as done; debug with
  `debug` before continuing.
- **You're tempted to disable/skip a failing test to "make progress"** → that's the bug talking.
  Diagnose with `debug`; never ship around a red test.

## Checklist (copy per task)

```text
- [ ] a) RED for the right reason → GREEN → REFACTOR; committed as one unit (authorship = Eric)
- [ ] b) `rsc risk` on the task diff; tier recorded
- [ ] c) `review ledger round <slug>/<task>` before each review (≤ 3); by tier, fresh context, no pre-judging
- [ ] d) `review consolidate` + `finding-verifier`; `review ledger record`; outcomes closed
- [ ] e) tests, build, security, traceability — each passed or **not run**
- [ ] f) re-review only the new diff; class fixed, no repeats
- [ ] g) fixed + logged in decisions.md, or in the decision queue (`blocking` / `review-after`)
- [ ] Progress entry appended; skill resolution recorded; checkpoint shown
```

## Result envelope

End every implementation checkpoint or completed batch with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Implemented task(s): red/green evidence, tier, review, controls, decision-queue state.",
  "artifact": "02-DOCS/wiki/sdd/progress/<slug>.md",
  "next_recommended": "implement|verify",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["implement"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Tier comes from rsc risk, never the agent.", "Max 3 fix rounds; park, don't loop."]
  },
  "evidence": ["red/green output", "rsc risk output", "ledger record", "controls", "progress entry path"]
}
```

## What this skill is NOT

- **Not the closing gate** — whole branch, rollback plan and explanation are stage 5 (`verify`, `review`, `ship`).
- **Not plan writing** — a plan found wrong mid-build is amended via `plan`, never inside a commit.
- **Not deep debugging** — a failure you don't understand goes to `debug`, not to guessing.

## Where you are in ASDD

Base → Spec → Plan (`plan` · `tasks` · `analyze`) → **Build loop (this skill)** → Close (`verify` ·
`review` · `ship`) → Learn. On demand: `debug`, `worktrees`, `parallel`. Front door: `../asdd/SKILL.md`.

**Next:** when every task is done or parked, go to stage 5 — `verify` in closing mode over the whole
branch. Parked tasks travel in the decision queue for the human.

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
