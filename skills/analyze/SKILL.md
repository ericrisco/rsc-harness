---
name: analyze
description: "Use when constitution, spec, plan and tasks all exist and you want them cross-read against each other before any code is written — the rsc-sdd pre-implementation gate. Reports coverage gaps, contradictions, duplication, ambiguity and scope drift; edits nothing. NOT the task breakdown (that is `tasks`), NOT the coding (that is `implement`), NOT the post-code test gate (that is `verify`), NOT resolving ambiguity (that is `clarify`)."
tags: [sdd, analyze, consistency]
recommends: [implement]
profiles: [core, full]
origin: risco
---

# Analyze — the pre-implementation consistency gate

You have a **constitution**, a **spec**, a **plan** and a **task list**. Four artifacts written at four different moments, by a mind that drifted a little each time. `analyze` reads all four *against each other* and surfaces where they disagree. It is the cheapest place in the whole chain to catch a problem — a contradiction found here costs a sentence; the same contradiction found mid-implement costs a rewrite.

Sixth phase of the rsc-sdd chain (`constitution → specify → clarify → plan → tasks → analyze → implement`); the method itself lives in `../sdd/SKILL.md`. It is a **gate, not a worker**: it produces a report and stops. The user reads the findings and decides what to fix, and which phase to send each fix back to.

**Report only. Resolve nothing.** Never edit the constitution, spec, plan or tasks; never open a code file to "just fix it"; never silently reconcile a contradiction by picking a side. This one is absolute because a gate that quietly fixes things stops being a gate: the user never learns the spec was wrong, the plan built on the old assumption stays stale, and the "consistency check" has manufactured a new inconsistency. Name the conflict, show both sides with locations, propose where it should be resolved, hand the decision back.

**Model tier: `heavy`** (adversarial cross-reading). Resolve and apply it per `../sdd/references/model-routing.md`; routing is off unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`.

**Accompaniment dial.** Read `02-DOCS/wiki/harness/user-profile.md` before reporting — default to **L2** and say the harness has not gauged the user yet if there is no profile. The dial flexes how the report reads, never what gets checked; the six analyses always run in full.

| Dial | The report renders as |
| --- | --- |
| L0 | Finding table only: severity, the two artifacts, the conflict in one line. No prose. |
| L1 | + a one-line *why it matters* per CRITICAL/HIGH finding. |
| L2 | + per finding, the recommended resolution phase and the trade-off of leaving it. |
| L3 | + full walk-through: quote both sides, explain the consequence at implement time in plain language, lay out the options so a non-technical user can choose. |

## Inputs — locate the four artifacts

Read all four before analyzing. The rsc-sdd artifacts live under `02-DOCS/wiki/sdd/`, indexed from `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it):

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
4. **Recommended routing** — group fixes by the phase that owns them (`clarify` for spec ambiguity, `plan` for missing architecture, `tasks` for a missing done-check, `constitution` if a principle itself is wrong). If findings pour in across all six checks, the artifacts diverged badly — recommend re-running `clarify`/`plan` before a line-by-line analyze is even useful.

Write the report to `02-DOCS/wiki/sdd/analysis/<slug>.md` (create the dir if absent) and index it in `02-DOCS/wiki/index.md` under the `sdd/` topic, so the next phase and the harness can find it. It is an OKF v0.1 wiki article: open it with YAML frontmatter carrying a non-empty `type:` (use `type: analysis`), a `timestamp` in ISO 8601, and standard markdown links — never wikilinks. The report is the artifact analyze owns — it is the *only* thing analyze writes. Per-run point-in-time; overwrite on re-run, the wiki keeps history.

Render it at the dial's verbosity. Do not log a decision to `decisions.md` — analyze decides nothing; the phase that resolves the finding logs its own decision.

## Anti-patterns

| Anti-pattern | Why it breaks the gate / do instead |
| --- | --- |
| Fixing a "trivial" contradiction in the spec yourself | Then you are `clarify`/`plan`/`tasks`, not `analyze`. Report it; the user resolves. |
| Starting to code because nothing CRITICAL turned up | Analyze never transitions to code. Hand the verdict to `implement`; that phase starts the work. |
| Waving through plan work the spec never asked for because it's obviously a good idea | That is DRIFT. Flag it. Good ideas still need the spec amended (user's call), or they are silent scope creep. |
| Siding with the plan when it contradicts the constitution | The constitution wins by definition — flag CRITICAL. If the principle itself is wrong, that is a `constitution` change the user makes, not a quiet override here. |
| Guessing what a vague requirement meant | Guessing defeats the gate. Mark AMBIGUOUS and route to `clarify`; do not encode your guess. |

## Result envelope

End with the parseable block every SDD phase shares, so the dispatcher can chain without
interpreting prose (contract: `../sdd/SKILL.md`):

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "Cross-read of spec/plan/tasks against the constitution; findings ranked.",
  "artifact": "02-DOCS/wiki/sdd/analysis/<slug>.md",
  "next_recommended": "implement",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["analyze"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Read adversarially across artifacts, not inside one.", "A finding without a location is an opinion."]
  },
  "evidence": ["report path exists", "blockers listed with artifact + location", "constitution conflicts named"]
}
```

## Next in the chain

On `GATE: PASS` (or once the user consciously accepts the remaining MEDIUM/LOW findings), proceed to **`implement`** — execute the tasks with TDD discipline, delegating concrete test tooling to the relevant stack skill (`fastapi`, `nextjs`, `go`, `flutter`, `postgresdb`). On `GATE: BLOCKED`, route each CRITICAL/HIGH finding to its owning phase (`clarify`, `plan`, `tasks`, or `constitution`), let the user resolve, then re-run `analyze`. The gate only opens once.
