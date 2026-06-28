---
name: analyze
description: "Use when the spec, plan and task list are written and you want a last consistency check BEFORE any code is touched — the pre-implementation GATE of the rsc-sdd chain. It cross-reads constitution vs spec vs plan vs tasks and reports gaps, contradictions, duplication, ambiguity and scope drift, mapping every artifact to the requirements it claims to satisfy. Report-only: it never edits artifacts and never writes code; the user decides each resolution. Triggers: 'analyze', 'analiza la spec antes de implementar', 'cross-check constitution spec plan tasks', 'consistency gate', 'are spec and plan aligned', 'did we miss any requirement', 'scope drift check', 'gap analysis before coding', 'is the plan complete', 'sanity-check before implement', 'coverage of requirements'. NOT clarifying a single spec (that is `clarify`), NOT writing the plan or tasks, NOT running tests/lint (that is `verify`), NOT root-causing a bug (that is `debug`)."
tags: [sdd, analyze, consistency]
recommends: [implement]
profiles: [core, full]
origin: risco
---

# Analyze — the pre-implementation consistency gate

You have a **constitution**, a **spec**, a **plan** and a **task list**. Four artifacts written at four different moments, by a mind that drifted a little each time. `analyze` is the last checkpoint before the first line of code: it reads all four *against each other* and surfaces where they disagree. It is the cheapest place in the whole chain to catch a problem — a contradiction found here costs a sentence; the same contradiction found mid-implement costs a rewrite.

This is the **sixth phase** of the rsc-sdd chain (`constitution → specify → clarify → plan → tasks → analyze → implement`). It is a **gate, not a worker**: it produces a report and stops. It does not patch the spec, does not reorder tasks, does not touch code. The user reads the findings and decides what to fix, and which phase to send each fix back to.

## The one rule that defines this skill

**Report only. Resolve nothing.** `analyze` never edits the constitution, spec, plan or tasks, never opens a code file to "just fix it", never silently reconciles a contradiction by picking a side. It names the conflict, shows both artifacts with their locations, proposes where it should be resolved, and hands the decision back. The moment you feel the urge to edit an artifact, you have left this skill — stop and route the fix to the phase that owns it.

Why so strict? Because a gate that quietly fixes things stops being a gate. If `analyze` patches the spec on its own, the user never learns the spec was wrong, the plan built on the old assumption stays stale, and the "consistency check" has manufactured a new inconsistency. The value is the *honest report*, not the patch.

## When to use / when NOT to use

Use when:

- The plan and tasks exist and you are about to start implementing — run this first, every time.
- A spec or plan changed after the others were written and you want to re-check alignment.
- Implementation stalled because the artifacts seem to contradict each other.
- You want a requirements-coverage map: which task satisfies which spec requirement, and what is orphaned.

Do NOT use when (route elsewhere):

- A single spec is fuzzy and you need to ask the user questions and bake answers in → `clarify` (analyze reports the ambiguity; clarify resolves it).
- The plan or tasks don't exist yet → write them first (`plan`, then `tasks`).
- You want to run lint/types/tests/acceptance after coding → `verify` (post-implementation gate; analyze is pre-implementation).
- A test is failing or behavior is wrong → `debug`.
- You intend to fix what you find right now → that is `implement`/`clarify`/`plan`/`tasks` work, not analyze. Analyze only reports.

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — it is the adversarial consistency gate across constitution ↔ spec ↔ plan ↔ tasks. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Read the accompaniment dial first

Before reporting, read `02-DOCS/wiki/harness/user-profile.md` for the technical + accompaniment level (the harness dial, L0..L3). It shapes how the report reads — not what gets checked. The six analyses always run in full; verbosity flexes:

- **L0** — the finding table only: severity, the two artifacts, the conflict in one line. No prose.
- **L1** — the table plus a one-line *why it matters* per CRITICAL/HIGH finding.
- **L2** — the table plus, per finding, the recommended resolution phase and the trade-off of leaving it.
- **L3** — full walk-through: for each finding, quote both sides, explain the consequence at implement time in plain language, and lay out the options so a non-technical user can choose.

If no profile exists, default to L2 and note that the harness has not gauged the user yet.

## Inputs — locate the four artifacts

Read all four before analyzing. The rsc-sdd artifacts live under `02-DOCS/wiki/sdd/` (the harness Karpathy-wiki convention), indexed from `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it):

| Artifact | Canonical location | Role in the check |
| --- | --- | --- |
| Constitution | `02-DOCS/wiki/sdd/constitution.md` | The non-negotiables. Everything below must obey it. |
| Spec | `02-DOCS/wiki/sdd/specs/<slug>.md` | WHAT & WHY. The source of truth for requirements. |
| Plan | `02-DOCS/wiki/sdd/plans/<slug>.md` | HOW. Must cover every spec requirement, add nothing the spec didn't ask for. |
| Tasks | task list inside the plan artifact | The ordered, verifiable steps. Must implement the plan, no more. |

If any artifact is missing, **stop and say so** — analyze cannot gate what isn't there. Name the missing one and the phase that produces it. If a `<slug>` is ambiguous (several specs), ask which feature is being gated; do not analyze all of them blindly.

## The six analyses

Run every one. Each compares a specific pair (or the whole set against the constitution) and emits findings.

1. **Constitution compliance** — does any spec requirement, plan decision or task violate a non-negotiable (stack canon, quality bar, convention)? A constitution breach is the highest-severity finding there is; the constitution wins by definition.
2. **Requirement coverage (spec → plan → tasks)** — map every spec requirement forward. Each must trace to at least one plan section and at least one task. A requirement with no task is a **gap** (it will silently not ship). Build the coverage map below.
3. **Scope drift (tasks/plan → spec)** — map backward. Any plan section or task that satisfies *no* spec requirement is **drift** — work the spec never asked for. Flag it; the fix is either cut the work or amend the spec, and that is the user's call.
4. **Contradiction** — direct disagreements between two artifacts: the spec says Postgres, the plan says SQLite; the spec says "no auth in v1", a task adds login. Quote both sides.
5. **Duplication** — the same requirement stated twice in conflicting words, or two tasks doing the same job. Duplication is where contradictions breed later.
6. **Ambiguity / underspecification** — requirements or tasks too vague to implement or to verify ("handle errors gracefully", "make it fast" with no number, a task with no done-check). These do not block by themselves but feed back to `clarify` (spec) or `tasks` (missing done-check).
   - **Carrier completeness (isolated-implementer check).** Because `implement`/`parallel` dispatch tasks to **context-isolated** `developer` subagents that see only their own task, also confirm the plan carries a **§0 Global Constraints** block (verbatim project-wide values) and that every task whose correctness depends on a contract it doesn't own has an **Interfaces** block (`Consumes`/`Produces`, exact signatures). A constraint or neighbor-signature that lives only in prose is invisible to the blind worker — flag a missing carrier as `AMBIGUOUS` (it will surface as drift or breakage at implement time). See `../plan/references/plan-template.md` §0 and `../tasks/SKILL.md` (Per-task Interfaces).

### Requirement coverage map (build this every run)

A copy-able table that makes gaps and drift visible at a glance:

```text
REQ-ID | Spec requirement (short)        | Plan section | Task(s) | Status
------ | ------------------------------- | ------------ | ------- | ----------
R1     | Email/password sign-up          | §3 Auth      | T2,T3   | covered
R2     | Rate-limit login (5/min/IP)     | §3 Auth      | —       | GAP
R3     | —                               | §5 Webhooks  | T9      | DRIFT
R4     | "Fast" search                   | §4 Search    | T6      | AMBIGUOUS (no metric)
```

- `GAP` — spec requirement with no task → it won't be built.
- `DRIFT` — plan/task with no spec requirement → unrequested scope.
- `AMBIGUOUS` — covered but not specific enough to verify later.
- `covered` — traces cleanly spec → plan → task.

## Severity scale

Rank every finding so the user triages fast:

- **CRITICAL** — constitution violation, or a contradiction that makes the artifacts un-implementable as written. Must resolve before `implement`.
- **HIGH** — a coverage GAP on a core requirement, or scope DRIFT that adds real cost. Resolve before implement.
- **MEDIUM** — duplication, or AMBIGUOUS items with no number/done-check. Resolve or consciously accept.
- **LOW** — wording mismatches, cosmetic inconsistencies. Note and move on.

## Output — the report (and where it goes)

Produce a single consistency report:

1. **Verdict line** — `GATE: PASS` (zero CRITICAL/HIGH) or `GATE: BLOCKED` (one or more CRITICAL/HIGH), with the counts.
2. **Coverage map** — the table above.
3. **Findings table** — `# | Severity | Type | Artifact A (loc) | Artifact B (loc) | Conflict | Resolve in (phase)`.
4. **Recommended routing** — group fixes by the phase that owns them (`clarify` for spec ambiguity, `plan` for missing architecture, `tasks` for a missing done-check, `constitution` if a principle itself is wrong).

Write the report to `02-DOCS/wiki/sdd/analysis/<slug>.md` (create the dir if absent) and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) under the `sdd/` topic, so the next phase and the harness can find it. It is an OKF v0.1 wiki article: open it with YAML frontmatter carrying a non-empty `type:` (use `type: analysis`), a `timestamp` in ISO 8601, and standard markdown links — never wikilinks. The report is the artifact analyze owns — it is the *only* thing analyze writes. Per-run point-in-time; overwrite on re-run, the wiki keeps history.

Adapt the rendered verbosity to the dial (L0 = table only; L3 = full walk-through). Do not log a decision to `decisions.md` — analyze decides nothing; the phase that resolves the finding logs its own decision.

## Anti-patterns → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "This contradiction is trivial, I'll just fix the spec myself" | Then you are `clarify`/`plan`, not `analyze`. Report it; the user resolves. A gate that edits stops being a gate. |
| "No CRITICAL findings, so I'll start coding from here" | Analyze never transitions to code. Pass the verdict to `implement`; that phase starts the work. |
| "The plan adds caching the spec didn't mention — obviously a good idea, I'll allow it" | That is DRIFT. Flag it. Good ideas still need the spec amended (user's call), or they are silent scope creep. |
| "I'll only check coverage; contradictions are rare" | Run all six analyses every time. The one you skip is the one that bites at implement time. |
| "The spec is vague but I can guess what they meant" | Guessing defeats the gate. Mark AMBIGUOUS and route to `clarify`; do not encode your guess. |
| "I'll fold the findings straight into the task list to save a step" | No. Editing tasks is the `tasks` phase. Report, route, hand back. |
| "Constitution says Postgres but plan picked Mongo for good reasons — I'll side with the plan" | The constitution wins by definition. Flag CRITICAL. If the principle is wrong, that is a `constitution` change the user makes, not a quiet override here. |
| "I read the spec and tasks; the constitution is boilerplate, skip it" | The constitution is analysis #1 and the highest severity. Never skip it. |

## Red flags — stop and report instead of analyzing

- An artifact is missing (no plan, no tasks) → say which, name the phase, do not fabricate it.
- Multiple specs match the slug → ask which feature; don't analyze the wrong one.
- You catch yourself opening a source file → you have left the gate; close it.
- Findings are pouring in across all six checks → the artifacts diverged badly; recommend the user re-runs `clarify`/`plan` before a line-by-line analyze is even useful.

## Next in the chain

When the verdict is `GATE: PASS` (or the user has consciously accepted the remaining MEDIUM/LOW findings), proceed to **`implement`** — execute the tasks with TDD discipline, delegating concrete test tooling to the relevant stack skill (`fastapi`, `nextjs`, `go`, `flutter`, `postgresdb`). If the verdict is `GATE: BLOCKED`, route each CRITICAL/HIGH finding to its owning phase (`clarify`, `plan`, `tasks`, or `constitution`), let the user resolve, then re-run `analyze`. The gate only opens once.
