---
name: parallel
description: "Use when two or more pieces of work are genuinely independent — disjoint files, no shared state, no ordering edge — and should fan out across subagents, then be gathered and reconciled under a combined test suite. Decides WHAT can run concurrently; NOT the isolation it runs in (that is `worktrees`), NOT the per-unit TDD loop (that is `implement`)."
tags: [parallel, subagents, fanout]
recommends: []
profiles: [core, full]
origin: risco
---

# parallel — fan out independent work, then reconcile

*Parallelism is a property of the work, not a wish. Prove the pieces are disjoint, dispatch one subagent per piece with a self-contained brief, then gather and reconcile before anyone calls it done.*

This is an **on-demand process skill** in the SDD chain. You reach it from `implement` (or any phase) when the work in front of you splits into pieces that could each be handed to a different person who never talks to the others. It owns one discipline: **partition → dispatch → gather → reconcile**. It does *not* own the work inside each piece — a subagent building a module still runs its own red → green → refactor loop from `implement`; this skill only orchestrates the fan-out. It also does not own the *place* the work runs: a clean branch or checkout to work in is `worktrees`. `parallel` decides **what can run at the same time**; `worktrees` provides **the isolation it runs in**.

The whole value is in the gate at the front. Run work in parallel only when it is *actually* independent. Forcing parallelism onto coupled work does not make it faster — it makes it a merge disaster, and the time you save dispatching you lose tenfold reconciling. Most of this skill is about earning the right to parallelize.

## The independence test (run this before dispatching anything)

A set of tasks is safe to parallelize only when **every** answer below is yes. One no means serialize that pair.

```text
INDEPENDENCE TEST — for every PAIR of candidate tasks
- [ ] Disjoint files       — they never write the same file (and don't both edit a shared barrel/index/registry)
- [ ] No shared state       — no shared in-memory object, DB row, migration, global config, or env they both mutate
- [ ] No ordering edge      — neither needs the other's OUTPUT to start or to assert against
- [ ] No hidden coupling     — not the same schema/contract/type that must agree, not the same external resource
- [ ] Self-containable brief — each can be described fully on its own, with its own done-check, without "see the other task"
```

If a pair fails any line, they are one serial unit — run them in order in the same agent, or sequence them as a dependency. If a *group* passes for every internal pair, that group is a parallel batch. It is normal to end up with a mix: a few disjoint clusters you fan out, and a serial spine that holds them together.

```text
Good fan-out  — "add the users repository" ‖ "add the invoices repository" ‖ "write the README"
                (separate modules, separate files, no task reads another's output)
Bad fan-out   — "define the User type" ‖ "write the endpoint that returns a User"
                (the second needs the first's output — serialize: type, THEN endpoint)
Bad fan-out   — "add field to the orders migration" ‖ "add another field to the orders migration"
                (same file, same migration — one serial unit, not two)
```

## The four phases

```text
PARTITION → DISPATCH → GATHER → RECONCILE
```

Never skip RECONCILE. Green-in-isolation is not green-together — the point of failure in parallel work is always the seam, and the seam only shows up after you merge.

### 1. PARTITION — carve the work into disjoint units

Take the task list (from `tasks`, or the implicit list in front of you) and group it. For each candidate group, run the independence test above. Produce an explicit partition: the parallel batches and the serial spine between them. Write the partition down — even one line per batch — so the gather step has something to check against. Decide the **degree of parallelism**: one subagent per unit, but cap it where the units would contend on the same scarce resource (a single test database, a rate-limited API, your own review bandwidth). More subagents than you can reconcile is not faster.

### 2. DISPATCH — one subagent per unit, with a self-contained brief

Each subagent gets a brief it can execute **without reading the others**. A brief that says "do the auth part, coordinate with the other agent on the token shape" has already failed the independence test — go back and fix the partition. A complete brief carries:

```text
SUBAGENT BRIEF (one per unit)
- Scope        — exactly which files/dirs this unit owns, and the explicit boundary it must NOT cross
- Goal         — what to build, in its own words, no "see the other task"
- Done-check   — the verifiable condition that means this unit is finished (from the tasks phase)
- Constraints  — the constitution rules + stack skill it must honor (e.g. ../fastapi/SKILL.md testing)
- Selected skills — ids + paths resolved from .rsc/skill-registry.json
- Compact rules — 4-5 actionable rules digested from those skills for THIS unit
- Skill fallback — what to do if a referenced skill is unavailable
- Interface    — any contract it must conform to, FROZEN before dispatch (see the rule below)
- Model tier   — the tier this unit runs on, by the KIND of work it does (only when routing is enabled — see below)
- Report-back  — what to return: the diff, the test output, decisions worth logging, skill_resolution
```

**Freeze shared contracts before you dispatch, never during.** If two units both touch the same API shape, type, or schema, that interface is a *dependency*, not something to negotiate in flight. Define it in the serial spine first, hand the frozen version to every unit, and only then fan out. Cross-talk between live subagents is the smell that the partition was wrong.

Each subagent still owns its own discipline inside its scope — TDD via `implement`, the stack skill's test mechanics, decision logging. This skill does not relax any of that; it just runs several of them at once.

**Per-unit model tier (when routing is enabled).** `parallel` has *no fixed tier* — this is the most concrete place per-phase model routing pays off. When `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`, give each unit the tier of the *kind of work it does*, not one tier for the whole fan-out: an implement-type unit → `balanced`, a scan/research/boilerplate unit → `light`, a unit doing genuine design or root-cause reasoning → `heavy`. Resolve the tier to a concrete model via `models.tiers` and **dispatch that subagent on that model** (e.g. Claude Code's `model` field on the Task/subagent) — real routing, independent of the session model. If routing is off or no profile exists, dispatch on the session model and say nothing. Full protocol: `../sdd/references/model-routing.md`.

**Set the model on every dispatch — an omitted model silently inherits the session's, usually the most expensive one, and that is how a fan-out's cost quietly explodes.** rsc installs a `developer` subagent pinned to the **balanced** tier (Sonnet by default; the user's onboarding choice in `.rsc/developer.json`, never `light`). For implement-type units, **dispatch to the `developer` agent** (e.g. Claude Code `subagent_type: developer`) — that's the deliberate cost cap the user asked for. Only escalate a genuinely heavy unit (real design / root-cause) to a heavy model, and only when routing is enabled; otherwise balanced is the floor and the ceiling. If you dispatch a raw subagent instead, name its tier explicitly.

### The unit report contract (statuses & escalation)

Each unit reports **one of four statuses** — it does not guess or hack around a wall when unsure:

- `DONE` — done-check green, the unit's frozen interface honored.
- `DONE_WITH_CONCERNS` — green, but a flagged risk/assumption for the orchestrator to adjudicate.
- `BLOCKED` — cannot proceed (failing dependency, a contract that doesn't hold, missing access).
- `NEEDS_CONTEXT` — something it needed (an interface, a constraint) was not in its brief.

On `BLOCKED`/`NEEDS_CONTEXT`, **never re-dispatch the same brief to the same model unchanged** —
change something first: add the missing interface/constraint, fix the dependency, or escalate the
tier for a genuinely hard unit. An identical re-run burns budget without progress. A `BLOCKED` unit
is a partition signal too: if it blocked on another unit, the two were not independent — re-partition.

Every subagent result must also report:

```yaml
skill_resolution:
  used: []
  missing: []
  fallback: []
  compact_rules: []
```

The orchestrator folds these into the final parallel result. If a unit claims it used a skill that was not available in the registry or not included in the brief, treat that as a review risk and inspect the work before merging.

### 3. GATHER — collect every result, hold the merge

Wait for **all** units to report. Collect each one's diff, test output, and any decisions. Do not start merging the fast ones while slow ones are still running — partial merges create the exact shared-state races you partitioned to avoid. Check each result against its brief's done-check *before* it touches the integration branch: a unit that came back not-actually-done gets sent back, not merged hopefully.

**Per-unit review gate (before merge).** For each non-trivial unit, run the same fresh-eyes review `implement` runs per task, over *that unit's diff alone* — package it with `../implement/scripts/review-package <BASE> <HEAD>` and dispatch a reviewer that is **not** the unit's own implementer, given the diff path, the unit's done-check, and its frozen interface; never pre-rate severity or tell it what to skip. Fold `Critical`/`Important` findings back before merging. Full protocol: `../implement/references/per-task-review.md`. This is the cheap per-unit pass; the *combined* adversarial review over the whole merged diff is still `review`'s job at the end (RECONCILE only proves the seam compiles and tests green).

### 4. RECONCILE — merge, then prove the seam holds

This is where parallel work is actually finished. In order:

1. **Merge the units** onto the integration branch (or working tree). Resolve any conflict by hand — a conflict here means the partition leaked (two units touched the same line); note it so the next partition is cleaner.
2. **Run the *combined* suite.** Each unit was green alone; that proves nothing about together. Run the whole test suite (the stack skill's `scripts/verify.sh`) across the merged result.
3. **If the combined suite is red**, the failure lives in the seam between units. Switch to `debug` — reproduce → isolate → fix — instead of guessing which unit to blame.
4. **Reconcile the decision logs.** Fold each unit's decisions into `02-DOCS/wiki/sdd/decisions.md` (append-only), and if two units made a choice that now disagrees, resolve it explicitly and log the resolution.

Only after the combined suite is green is the parallel batch done. Hand the merged, green result back to the phase that called you (usually `implement`, heading for `verify`).

**How loud.** Match the accompaniment level in `02-DOCS/wiki/harness/user-profile.md`: it sets how much of the independence reasoning, the frozen contracts, the briefs and the seam check you narrate, and nothing else. At the tersest level you still run the independence test and the combined-suite gate in full — silently, but completely.

## Anti-patterns → STOP

| Rationalization | Reality |
| --- | --- |
| "These two touch the same file but I'll parallelize and merge later." | Same file = shared state. That's a merge race and lost work. One serial unit. |
| "I'll let the subagents coordinate the token shape between themselves." | Live cross-talk means the partition failed. Freeze the contract in the spine first, then dispatch. |
| "Both units are green on their own, so the feature is done." | Green-alone proves nothing about together. Run the combined suite before any done-claim. |
| "Fan out everything — more subagents is always faster." | Past the point you can reconcile, it's slower and riskier. Cap parallelism at what one serial spine can absorb. |
| "I'll merge the fast unit now and the slow one when it lands." | Partial merges reintroduce the races you partitioned away. Gather all, then reconcile once. |
| "It's only two small tasks, but parallel sounds efficient." | Orchestration overhead > the work. Just do them in a row. |
| "The brief says 'see the other agent's output' — close enough." | That's a dependency, not independence. Serialize, or freeze the output first. |
| "Combined suite is red, probably the slower unit — I'll tweak it." | Don't guess at the seam. Reproduce and isolate with `debug`. |
| "I just want an isolated branch, so I'll use parallel." | That's isolation, not concurrency. Use `worktrees`. |
| "Routing's on, so I'll run the whole fan-out on one tier." | `parallel` has no fixed tier — give each unit the tier of its own work (scan→light, build→balanced, design→heavy). |

## Result envelope

End with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Parallel units gathered, reconciled, and combined suite checked.",
  "artifact": "02-DOCS/wiki/sdd/progress/<slug>.md",
  "next_recommended": "implement",
  "risk": "low|medium|high",
  "model": { "per_unit": [{ "unit": "users-repo", "tier": "balanced", "resolved": "model-id" }], "routing": "on|off" },
  "skill_resolution": {
    "used": ["parallel"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Freeze shared contracts before dispatch.", "Run combined suite after merge."]
  },
  "evidence": ["partition", "unit reports", "combined suite output"]
}
```

## Where you are in the chain

`parallel` is on-demand, callable from any phase but most often from `implement`:

`constitution` → `specify` → `clarify` → `plan` → `tasks` → `analyze` → **implement** → `verify` → `review` → `ship`, with `debug` · `worktrees` · **parallel** callable on demand.

**Next:** when the fan-out is reconciled and the combined suite is green, return to the phase that called you — usually `../implement/SKILL.md`, continuing the task list toward `../verify/SKILL.md`. If the seam is red, go to `debug` first. If the ordered task list with done-checks does not exist yet, that is `tasks`, not this. If what you actually needed was an isolated branch rather than concurrency, that's `worktrees`.
