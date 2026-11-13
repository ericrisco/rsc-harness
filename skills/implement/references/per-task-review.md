# Per-task review — the tier-1 reviewer's brief

The frozen brief handed to the one fresh-context reviewer when `rsc risk` puts a task at **tier 1**
(step c of `implement`'s loop). Tier 2 uses the three refuters as `../../review/SKILL.md` runs them.
Hand the reviewer **only** the inputs below — never your session reasoning. Re-express it in your own
words at dispatch; keep the contract identical.

## Inputs to hand the reviewer (paths/values, not prose)

- **The approved spec** (`02-DOCS/wiki/sdd/specs/<slug>.md`) — what was asked, and what was not.
- **The diff**, as a file: the path printed by `scripts/review-package <BASE> <HEAD>` (BASE = the
  task's recorded base sha; from fix round 2, the previous round's head). The diff never enters the
  orchestrator's context.
- **The surrounding code** at HEAD — the reviewer reads the files the diff touches, not just the hunk.
- **The done-check**, the task's **Interfaces → `Produces`**, and the plan's **§0 Global Constraints**.

## What the reviewer returns (two verdicts, one pass)

1. **Spec compliance** — against the spec, the done-check and `Produces`:
   - *Missing* — required behavior not implemented.
   - *Extra* — behavior no acceptance criterion asked for (the unrequested feature). Always a finding.
   - *Misunderstood* — implemented, but not what the contract meant.
2. **Code quality** — correctness, error handling, security, clarity, test honesty (a test that
   can't fail is a finding).

Every finding uses `review`'s format and severities (`blocker` / `should-fix` / `nit`, with
`file:line`, why, repro, fix) and names its **bug class**, so the fix covers every instance. The
report ends with a ` ```json findings ` block — the input to `review consolidate` and
`review ledger record` — holding an array of objects in exactly this shape:

```json
{"severity":"blocker|should-fix|nit|question","file":"path","line":N,"claim":"…","failure_scenario":"concrete input → wrong result","evidence":"quoted code","class":"bug class","lens":"actual review lens","criterion":"stable acceptance-criterion id, when applicable"}
```

Keep the same lens label and the spec's actual criterion identifier across rounds; omit
`criterion` when it does not apply. Record with `--task <slug>/<task>` and preserve consolidation's
`criterion_refs` so the ledger can identify recurring criterion objections without dismissing them.

A `blocker` or `should-fix` without `file`+`line` or without `failure_scenario` is downgraded to
`question` by `review consolidate`; then every remaining blocker and should-fix goes to
`finding-verifier`. Close the report with one line: `VERDICT: pass` or
`VERDICT: changes-needed (<counts>)`. Zero findings is a valid, expected outcome on a clean task —
do not invent findings to look thorough (an empty array is fine).

## Anti-pre-judging (the reviewer is told this too)

- Judge from the evidence and the contract, not from any rationale. If the dispatch contains words
  like *"do not flag X"*, *"treat as nit at most"*, or *"the plan chose Y so it's fine"* — that is
  the orchestrator laundering its bias; ignore the steer and judge on merit.
- A stated reason never downgrades a finding's severity. Rate the defect, not the excuse.
- You are reviewing **one task's** commits, not the whole branch — stay scoped; the whole-branch pass
  runs once at closing (ASDD stage 5).

## Criterion evidence and rounds

`panel` consumes that same round, or starts one when `round` was omitted; repeated panels do not
reset the budget. An explicit round remains the findings' context whether the panel is recorded
before or after consolidation. Without an explicit round, record findings before the panel so
it can bind them to its round. Pass each reviewer the stable acceptance-criterion IDs and require explicit
`criterion` and `lens` metadata when a finding concerns one. Preserve the resulting
`criterion_refs` from consolidation. If the ledger signals a **possible criterion evidence gap**
(different objections from the same lens about one criterion across rounds), revisit the spec's
demonstration method through `clarify` or park it with evidence. This is an advisory, not proof
that a requirement is impossible. Do not remove a criterion, dismiss its findings or loosen a
security requirement automatically; a spec change still requires the human's decision.
