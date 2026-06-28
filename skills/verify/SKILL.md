---
name: verify
description: "Use when implementation is finished and someone is about to say it's done, shipped, working, or ready to merge in the rsc-sdd flow — the post-implementation GATE that demands evidence before any 'done' claim. Triggers: 'verify this feature', 'is it done?', 'run the checks', 'lint/type/test before merge', 'did the acceptance criteria pass', 'confirm the tasks are complete', 'gate before review', 'audit the change', 'are we green', 'prove it works'. Runs the relevant stack skill's scripts/verify.sh (lint, type-check, tests, coverage, dependency/vuln audit), then walks every task done-check and every spec acceptance criterion, attaching the actual command output as evidence. Writes the verification record under 02-DOCS/wiki/sdd/ and points to the review phase. NOT writing tests or features (that is implement), NOT adversarial code reading (that is review), NOT root-cause diagnosis of a failing test (that is debug). Honors the harness accompaniment dial."
tags: [sdd, verify, test]
recommends: [review]
profiles: [core, full]
origin: risco
---

# verify — the evidence gate before "done"

`verify` is the post-implementation **gate** in the rsc-sdd chain. Implementation just finished; nobody is allowed to call it *done*, *fixed*, *working*, or *ready to merge* until the evidence exists and has been read. This skill produces that evidence: it runs the project's real quality gate, walks every task's done-check and every acceptance criterion from the spec, and records the result. Pass or fail, the verdict is grounded in command output you actually saw — never in a hunch.

The one rule everything else serves: **a claim of done is a claim about evidence. No evidence, no claim.** A green feeling is not green output.

This is a process skill. It does not own the lint/type/test tooling — the **stack skills do** (`../fastapi/SKILL.md`, `../go/SKILL.md`, `../nextjs/SKILL.md`, `../flutter/SKILL.md`, each shipping `scripts/verify.sh`; data-layer checks come from `../postgresdb/SKILL.md`, security from `../secure-coding/SKILL.md`). `verify` orchestrates them and judges the whole against the spec.

## When to use / when not to

Use when:

- Implementation of a task or feature is complete and you (or the user) are about to say so.
- A fix has been applied and you need to confirm it actually resolves the issue, with the app's own checks.
- You're at the gate before the `review` phase, or before a merge / PR.
- Someone asks "is it done?", "are we green?", "did it pass?", "can I merge?".

Do NOT use when:

- You're still writing tests or production code → that's the `implement` phase (TDD lives there).
- A check is failing and you need to find out *why* → that's `debug` (reproduce → isolate → fix). `verify` reports the failure and hands off; it does not diagnose.
- You're reading the diff adversarially for design/correctness smells a test can't catch → that's `review`.
- There is no spec or task list to verify against → you're earlier in the chain; go to `specify`/`plan`/`tasks` first.

## Model tier — `balanced` (opt-in routing)

This phase's default model tier is **`balanced`** — it runs the checks and interprets failures with judgment. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Read the room first (accompaniment dial)

Before running anything, read `02-DOCS/wiki/harness/user-profile.md` for the technical + accompaniment level and adapt:

- **L0** — run the gate, show pass/fail and the one-line failing summary. Minimal words.
- **L1** — add one line of *why* per failing check.
- **L2** — narrate each gate (what lint/type/test/audit checks and why it matters here).
- **L3** — explain every result, what each acceptance criterion means in plain language, and what the user should decide next.

If no profile exists yet, default to non-technical framing and keep the verdict legible. The verdict itself (pass / fail per item) never changes with the dial — only how much you explain around it.

## The gate (run in this order)

```text
LOCATE  → find the spec, the task done-checks, and which stack(s) changed
RUN     → execute the relevant stack scripts/verify.sh (lint, type, test+coverage, audit)
WALK    → check every task done-check and every spec acceptance criterion against real output
RECORD  → write the verification record under 02-DOCS/wiki/sdd/, index it
VERDICT → PASS only if every item has passing evidence; otherwise FAIL with the gaps + handoff
```

Never collapse a step. Never write the verdict before RUN and WALK have produced output you read.

### 1 — LOCATE

- Read `02-DOCS/wiki/sdd/config.yaml` if present. Prefer `testing.commands.verify`
  from config for repo-level gates. If config is missing and the change is
  non-trivial, mark that as a verification risk and recommend `sdd-init`.
- Read the spec at `02-DOCS/wiki/sdd/specs/<slug>.md` for its **acceptance criteria**.
- Read the plan/task list at `02-DOCS/wiki/sdd/plans/<slug>.md` for each task's **done-check**.
- Read `02-DOCS/wiki/sdd/progress/<slug>.md` if present for apply evidence and
  completed tasks. Missing progress does not automatically fail, but it is a
  traceability gap to record.
- Determine which subprojects/stacks the change touched (from `git status`/`git diff --name-only` and the manifests). That tells you *which* stack `verify.sh` to run — possibly more than one in a monorepo.
- If the constitution exists (`02-DOCS/wiki/sdd/constitution.md`), note its quality bars (coverage floor, lint level) — they are part of the gate.

If the spec or task list is missing, stop: there is nothing to verify against. Say so and point back up the chain.

### 2 — RUN the stack gate

For each touched stack, run that stack skill's gate and **capture the output verbatim**:

```bash
# delegate to the stack that owns the tooling; do not reinvent it
./scripts/verify.sh            # from the subproject root the stack skill documents
```

If `config.yaml` provides `testing.commands.verify`, run those commands first or explain why a stack-specific `verify.sh` supersedes them. Do not silently invent a different command when the config already says what to run.

| Stack | Gate command (owned by the stack skill) | Covers |
| --- | --- | --- |
| FastAPI / async Python | `./scripts/verify.sh` (`../fastapi`) | ruff/black, mypy, pytest+coverage, pip-audit |
| Go module | `./scripts/verify.sh` (`../go`, run in the module root) | gofmt, vet, staticcheck, golangci-lint, `test -race -cover`, govulncheck |
| Next.js / React | `./scripts/verify.sh` (`../nextjs`) | eslint, tsc --noEmit, test, build |
| Flutter / Dart | `./scripts/verify.sh` (`../flutter`) | `dart format`, `flutter analyze`, `flutter test` |
| Postgres / data layer | migration + query checks (`../postgresdb`) | schema/migration apply, constraint + query checks |
| Security-sensitive change | audit per `../secure-coding` | input/authz/secrets review, dependency vuln scan |

Rules for RUN:

- The stack `verify.sh` **skips missing tools** (yellow SKIP) rather than failing on them — so a SKIP is not a pass. Note every SKIP; a skipped test suite means that criterion is **unverified**, which is not the same as verified-passing.
- A non-zero exit from a tool that actually ran is a hard FAIL. Record the failing tool and its output.
- Run from the directory the stack skill documents (Go runs from the module root; others from the subproject root). Don't guess paths.
- If no `scripts/verify.sh` exists for a touched stack, that's a gap — say the gate is incomplete and recommend the user add the stack skill, rather than hand-rolling a one-off check that drifts from the real gate.

### 3 — WALK the done-checks and acceptance criteria

The stack gate proves the code is *clean and tested*. It does **not** prove the feature does what the spec asked. Walk both lists explicitly:

- **Task done-checks** — for each task in the plan, confirm its done-check is satisfiable from evidence (a passing test, a file that exists, an endpoint that returns the documented shape). Mark each ✅ with the evidence or ❌ with what's missing.
- **Acceptance criteria** — for each criterion in the spec, point at the concrete evidence that satisfies it. A criterion with no test and no observable proof is **unverified** — treat it as a FAIL item, not a pass, until there is evidence.

Where a criterion needs runtime proof (a page renders, a command produces output), drive it through the relevant tool — defer browser/app runtime to the stack skill's own runtime guidance rather than inventing a check here.

A criterion you "reviewed by reading the code" is not verified. Reading is `review`; verifying needs an observable result.

### 4 — RECORD

Write a dated verification record to `02-DOCS/wiki/sdd/verifications/<slug>-YYYY-MM-DD.md` so the project's living knowledge carries the proof, then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) under the `sdd/` topic. It is an OKF v0.1 wiki article: open it with YAML frontmatter carrying a non-empty `type:`. Keep it short and factual:

```markdown
---
type: verification
title: Verification — <slug> — YYYY-MM-DD
description: Evidence-backed verdict for <slug> — stack gate, task done-checks, acceptance criteria.
tags: [sdd, verification]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: sdd
slug: <slug>
---

# Verification — <slug> — YYYY-MM-DD

## Stack gate
- fastapi/scripts/verify.sh → PASS (ruff ok, mypy ok, pytest 142 passed, coverage 87% ≥ 80 floor, pip-audit ok)
- nextjs/scripts/verify.sh  → FAIL (tsc: 2 type errors in app/checkout/page.tsx) — handed to debug

## Task done-checks
- [x] T1 create /orders endpoint — evidence: test_orders.py::test_create passed
- [ ] T4 idempotency key — done-check NOT met: no test exercises the duplicate-POST path

## Acceptance criteria (spec)
- [x] AC1 user can place an order — evidence: e2e test green
- [ ] AC3 duplicate submit is a no-op — UNVERIFIED: no observable proof

## Verdict: FAIL — 2 open items (T4 done-check, AC3). Not ready for review.
```

Append-only spirit: don't overwrite a prior run's record; a new run is a new dated file. The record is the receipt the `review` and `ship` phases trust.

### 5 — VERDICT

- **PASS** only when *every* stack gate that ran is green (no FAILs), *every* task done-check is met with evidence, and *every* acceptance criterion has observable proof. Then, and only then, say it's verified — and point to `review`.
- **FAIL** the moment any item lacks passing evidence. List the open items precisely (which check, which criterion, what's missing). Do not soften it. A single unverified acceptance criterion fails the whole gate.
- Hand each failing kind to the right place: a failing test/type error → `debug`; a missing test for a criterion → back to `implement`; a spec ambiguity that surfaced → `clarify`.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "The tests passed last run, I'll trust that." | Re-run now. Code changed since; stale green is not green. Evidence is current, or it isn't evidence. |
| "verify.sh printed SKIP for the tests — close enough." | A SKIP is *unverified*, not passing. The criterion it covers is still open until a real run passes. |
| "I read the code and the criterion is obviously satisfied." | Reading is `review`. Verifying needs an observable result — a test, a response, a rendered page. |
| "Lint and types are green, so it's done." | The stack gate proves clean code, not correct behavior. Walk the acceptance criteria too. |
| "Coverage dipped below the floor but the feature works." | The constitution's coverage bar is part of the gate. Below floor = FAIL, not a footnote. |
| "One acceptance criterion is unproven; ship the rest." | The gate is all-or-nothing. One unverified criterion fails the whole verdict. |
| "A test is failing — let me just fix it real quick." | That's `debug`, a different discipline. `verify` reports the failure and hands off; it does not patch mid-gate. |
| "I'll write the verdict, then run the checks to confirm." | Backwards. RUN and WALK first; the verdict is the *consequence* of output you already read. |

## Red flags — abort the verdict

- You're about to type "done"/"passing"/"works" and you cannot point to a specific line of command output that proves it. Stop; go run it.
- The stack `verify.sh` for a touched stack doesn't exist or didn't run — the gate is incomplete; say so instead of declaring PASS.
- An acceptance criterion has no test and no observable proof — it's unverified; the verdict is FAIL.
- A failing check tempts you to fix it inline — that's scope drift into `debug`; record the failure and hand off.

## Result envelope

End with:

```json result-envelope
{
  "status": "complete|failed",
  "executive_summary": "Verification PASS/FAIL with open evidence gaps.",
  "artifact": "02-DOCS/wiki/sdd/verifications/<slug>-YYYY-MM-DD.md",
  "next_recommended": "review|debug|implement|clarify",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["verify"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Run configured verify commands.", "Acceptance criteria need observable proof."]
  },
  "evidence": ["command outputs", "done-check walk", "acceptance walk"]
}
```

## Next in the chain

A **PASS** record is the entry ticket to the next phase: **`review`** (adversarial read of the diff for what the gate can't catch), then **`ship`** (PR/merge with Eric-only authorship). A **FAIL** routes back: failing checks to **`debug`**, missing coverage to **`implement`**, surfaced ambiguity to **`clarify`**. Either way the verification record under `02-DOCS/wiki/sdd/verifications/` travels with the work as its proof.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

