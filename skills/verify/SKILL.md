---
name: verify
description: "Use when implementation is finished and about to be called done or merged — the rsc-sdd evidence gate: runs the stack's scripts/verify.sh (lint, type, test, audit), walks every task done-check and acceptance criterion, records a dated verdict. NOT judging the diff by eye (that is `review`, spec-less `code-review`), NOT diagnosis (that is `debug`)."
tags: [sdd, verify, test]
recommends: [review]
profiles: [core, full]
origin: risco
---

# verify — the evidence gate before "done"

`verify` is the post-implementation **gate** in the rsc-sdd chain. Implementation just finished; nobody is allowed to call it *done*, *fixed*, *working*, or *ready to merge* until the evidence exists and has been read. This skill produces that evidence: it runs the project's real quality gate, walks every task's done-check and every acceptance criterion from the spec, and records the result. Pass or fail, the verdict is grounded in command output you actually saw — never in a hunch.

The one rule everything else serves: **a claim of done is a claim about evidence. No evidence, no claim.** A green feeling is not green output.

This is a process skill. It does not own the lint/type/test tooling — the **stack skills do** (`../fastapi/SKILL.md`, `../go/SKILL.md`, `../nextjs/SKILL.md`, `../flutter/SKILL.md`, each shipping `scripts/verify.sh`; data-layer checks come from `../postgresdb/SKILL.md`, security from `../secure-coding/SKILL.md`). `verify` orchestrates them and judges the whole against the spec.

Not this phase: still writing tests or production code → `../implement/SKILL.md` (TDD lives there); a check is failing and you need to know *why* → `../debug/SKILL.md` (`verify` reports the failure and hands off, it does not diagnose); reading the diff adversarially for design/correctness smells a test can't catch → `../review/SKILL.md`, or `../code-review/SKILL.md` when there is no spec/plan chain to key off; nothing to verify *against* → you're earlier in the chain, go to `../specify/SKILL.md` / `../plan/SKILL.md` / `../tasks/SKILL.md` first.

## Model tier — `balanced` (opt-in routing)

This phase's default model tier is **`balanced`** — it runs the checks and interprets failures with judgment. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Read the room first (accompaniment dial)

Before running anything, read `02-DOCS/wiki/harness/user-profile.md` for the technical + accompaniment level; no profile yet → default to non-technical framing. The verdict itself (pass / fail per item) never changes with the dial — only how much you explain around it.

- **L0** — run the gate, show pass/fail and the one-line failing summary. Minimal words.
- **L1** — add one line of *why* per failing check.
- **L2** — narrate each gate (what lint/type/test/audit checks and why it matters here).
- **L3** — explain every result, what each acceptance criterion means in plain language, and what the user should decide next.

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
- A `GAP` is the third thing, and it is the one that looks most like a pass: **the layer ran and had nothing to fail with.** The fastapi gate reports it when coverage runs with no `--cov-fail-under` configured; the Go gate reports it always, because `go test -cover` takes no threshold. The script deliberately does not fail on a GAP — that judgement is yours. **Treat a GAP as an unverified criterion, which fails the verdict**, and record it (see the mapping below). A gate that reports and a gate that checks are indistinguishable on screen, and only the broken one is guaranteed to stay green.
- A non-zero exit from a tool that actually ran is a hard FAIL. Record the failing tool and its output.
- Run from the directory the stack skill documents (Go runs from the module root; others from the subproject root). Don't guess paths.
- If no `scripts/verify.sh` exists for a touched stack, that's a gap — say the gate is incomplete and recommend the user add the stack skill, rather than hand-rolling a one-off check that drifts from the real gate.

#### A home-grown gate must prove it can fail — and that it can pass

The dangerous way a checker breaks is not a crash — it is **fail-open**: nothing errors, the layer prints pass, and it prints pass forever. That failure can only ever produce green, so no failing run will ever surface it. The rule follows: **before you trust a home-grown gate's pass, watch it fail** on a known-bad input. It is the RED principle applied to the checker.

- **Third-party tools are exempt.** pytest, mypy, tsc, eslint, ruff, `go vet` have earned their failure behavior. This rule is for what we wrote: grep gates, one-off scripts, custom guards, anything whose exit codes nobody has tested.
- **A must-find-nothing grep has three outcomes, not two.** No matches = pass. A match = fail. **The scan itself breaking** (unreadable input, bad pattern) = fail too. Left unhandled, an unreadable file becomes a silent pass. No `|| true`, no `2>/dev/null`, no bare fallthrough.
- **State the limit where you state the pass.** Watching a gate fail once proves that *one* known-bad case reaches its failure path. It does **not** prove the gate recognizes every violation of the rule it claims to enforce — a gate can fail closed perfectly and still guard a spelling rather than a behavior. Record the control, and record what it does not buy.
- **Our own known fail-open:** the stack `verify.sh` scripts SKIP a missing tool instead of failing. That is a documented gap, not a pass — so it goes in the record's *Capas no ejecutadas* under `HERRAMIENTA-AUSENTE`, never left implied.

**Then run the other control: a known-GOOD input, and watch it pass.** Both directions or neither — a gate proven only against bad input is half-tested, and the untested half is the one that fires on every run.

**Over-blocking is not the safe side.** It feels like caution and it is not: a gate that fires on correct work gets muted, worked around, or wedges the pipeline that depends on it, which is the same damage as a gate that checks nothing with the sign reversed. And it is *harder* to notice, because the failure arrives dressed as diligence.

Where this bites hardest is a check that matches text rather than structure — **"the path appears in the string" is not "the write targets that location"**. Our own integrity gate learned this twice in one day: it flagged a transcript that merely *named* a protected path (the skill body it had been handed named it), then flagged a sandbox directory whose path *contained* the protected one as a substring. Twelve mutants had proven it could fail; not one had asked whether it could pass, so the defect shipped and surfaced on first real use with the filesystem provably untouched. → `02-DOCS/wiki/harness/puertas-y-mecanismos.md`

So when you write the negative control, write the positive one beside it, and prefer matching **structure** (a parsed tool call, a resolved path, an exit code) over matching text that happens to contain the thing you care about.

### 3 — WALK the done-checks and acceptance criteria

The stack gate proves the code is *clean and tested*. It does **not** prove the feature does what the spec asked. Walk both lists explicitly:

- **Task done-checks** — for each task in the plan, confirm its done-check is satisfiable from evidence (a passing test, a file that exists, an endpoint that returns the documented shape). Mark each ✅ with the evidence or ❌ with what's missing.
- **Acceptance criteria** — for each criterion in the spec, point at the concrete evidence that satisfies it. A criterion with no test and no observable proof is **unverified** — treat it as a FAIL item, not a pass, until there is evidence. A criterion you "reviewed by reading the code" is not verified either: reading is `review`; verifying needs an observable result.

Where a criterion needs runtime proof (a page renders, a command produces output), drive it through the relevant tool — defer browser/app runtime to the stack skill's own runtime guidance rather than inventing a check here.

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
source_state: 3f9a1c2 (clean)
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

## Capas no ejecutadas
- **NO-APLICA** — mutation: no logic module changed, only templates.
- **HERRAMIENTA-AUSENTE** — mypy: not installed in this environment; verify.sh printed SKIP and **nothing ran in its place**.
- **SUSTITUIDA** — suite health: ran the suite twice in a fixed order instead of randomized. Cannot detect whole-suite order dependence.

## Hallazgos descartados
- "the retry loop can spin forever" — dismissed: `client.py:88` caps it at 3 attempts; test_client.py::test_retry_cap covers it.

## Verdict: FAIL — 2 open items (T4 done-check, AC3). Not ready for review.
```

**`source_state:` is not decoration.** A verdict belongs to the commit it was measured against, not to the project: without it, nobody can tell whether the record describes the code that shipped. Record the short SHA plus `clean` or `dirty` — a dirty tree means the record describes bytes that exist on no commit, which is worth knowing when someone reads it three weeks later.

**All numbers come from one fresh run made after the last edit.** A figure from mid-task is stale and does not go in the record, however true it was when you saw it.

**Split "didn't run" three ways**, because one `SKIP` list collapses three different confidence claims and they read identically:

| Label | Means | Reader should conclude |
|---|---|---|
| `NO-APLICA` | the project has no such surface | nothing missing; this describes the project |
| `HERRAMIENTA-AUSENTE` | the surface exists, the tool was missing, **nothing ran** | that failure class was not looked for at all |
| `SUSTITUIDA` | something else ran instead | say what the substitute **cannot** detect; never write this as a pass |

`SUSTITUIDA` is the dangerous one. "Ran the suite twice" is not *suite health: stable* — it is a substitute that cannot see whole-suite order dependence, and a reader who can't tell the two apart reads "found nothing" where the truth is "did not look with that instrument".

**Where a `GAP` goes — and do not invent a fourth label.** A layer that ran without being able to fail is not `NO-APLICA` (the surface exists) and not `HERRAMIENTA-AUSENTE` (the tool ran). It is `SUSTITUIDA`: what ran was **a report in place of a gate**, and what it cannot detect is **coverage falling**. Write it that way:

```text
- **SUSTITUIDA** — coverage: ran without a threshold (GAP). A report, not a gate;
  cannot detect coverage regressing. Fix: --cov-fail-under=<n> in pyproject addopts.
```

**And while you are there: the global percentage is the wrong number.** A project-wide floor barely moves when your change lands untested — 200 new uncovered lines in a 20k-line codebase is a rounding error against an 85% floor, so the gate passes and the change is untested. What matters is whether **the lines you touched** are exercised: `diff-cover coverage.xml --fail-under=100` gates exactly those. This is guidance, not something the generated `verify.sh` scripts do — recommend it, don't assume it ran.

**A dismissed finding carries evidence, one line each.** A fix is self-evidencing — the test now passes. A dismissal is not: "not a real problem" is indistinguishable from "did not check". Name the command, the `file:line`, or the test that disproves it, or write "ninguno".

Append-only spirit: don't overwrite a prior run's record; a new run is a new dated file. The record is the receipt the `review` and `ship` phases trust.

### 5 — VERDICT

- **PASS** only when *every* stack gate that ran is green (no FAILs), *every* task done-check is met with evidence, and *every* acceptance criterion has observable proof. Then, and only then, say it's verified — and point to `review`.
- **FAIL** the moment any item lacks passing evidence. List the open items precisely (which check, which criterion, what's missing). Do not soften it. A single unverified acceptance criterion fails the whole gate.
- Hand each failing kind to the right place: a failing test/type error → `debug`; a missing test for a criterion → back to `implement`; a spec ambiguity that surfaced → `clarify`.

## Anti-patterns

| Anti-pattern | Why it fails / fix |
| --- | --- |
| "The tests passed last run, I'll trust that." | Re-run now. Code changed since; stale green is not green. Evidence is current, or it isn't evidence. |
| "verify.sh printed SKIP for the tests — close enough." | A SKIP is *unverified*, not passing. The criterion it covers is still open until a real run passes. |
| "I read the code and the criterion is obviously satisfied." | Reading is `review`. Verifying needs an observable result — a test, a response, a rendered page. |
| "Lint and types are green, so it's done." | The stack gate proves clean code, not correct behavior. Walk the acceptance criteria too. |
| "Coverage dipped below the floor but the feature works." | The constitution's coverage bar is part of the gate. Below floor = FAIL, not a footnote. |
| "One acceptance criterion is unproven; ship the rest." | The gate is all-or-nothing. One unverified criterion fails the whole verdict. |
| "A test is failing — let me just fix it real quick." | That's `debug`, a different discipline. `verify` reports the failure and hands off; it does not patch mid-gate. |
| "I'll write the verdict, then run the checks to confirm." | Backwards. RUN and WALK first; the verdict is the *consequence* of output you already read. |
| "The gate is mostly green, I'll call it done." | If you cannot point at the line of command output that proves a claim, you have no claim. Go run it. |
| "I looked at that finding; it's not a real problem." | A dismissal with no evidence is indistinguishable from a check you never made. Name the command, `file:line`, or test that disproves it — or fix it. |
| "The record is dated, that's enough to trace it." | A date does not identify code. Without `source_state`, nobody can tell whether the record describes what shipped. |
| "My grep gate passed, so the tree is clean." | Did you ever watch it fail? An unhandled broken scan exits like a pass. Prove it can fail before you trust its green. |

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

A **PASS** record is the entry ticket to the next phase: **`../review/SKILL.md`** (adversarial read of the diff for what the gate can't catch), then **`../ship/SKILL.md`** (PR/merge). A **FAIL** routes back per the VERDICT step. Either way the verification record under `02-DOCS/wiki/sdd/verifications/` travels with the work as its proof.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

