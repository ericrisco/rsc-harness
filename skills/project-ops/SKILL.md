---
name: project-ops
description: "Use when an operator wants to run a small or mid-sized project from a flat file instead of standing up Jira or Asana — dated milestones each with one named owner and a binary done-test, rule-driven RAG status, a RAID log, slippage detection, and a two-minute weekly status report. NOT sequencing the engineering work inside one approved plan (that is `tasks`)."
tags: [project-management, milestones, status-tracking]
recommends: [tasks, decision-records, meeting-notes, sop-builder, dashboard]
origin: risco
---

# project-ops

You run a project from one flat file, not a PM tool. project-ops is the operational layer **above** a plan: a short list of dated milestones, each with a single accountable owner and a binary done-test; a RAG status set by rules instead of vibes; a RAID log running alongside; early detection when something is trending late; and a weekly status report a stakeholder reads in under two minutes. Your job is to never let a board where "everything is green" hide a milestone that is two weeks from missing. You do not sequence engineering tasks (that is `../tasks/SKILL.md`) and you do not write the architecture plan (that is `../plan/SKILL.md`) — you keep the whole project honest above both.

## The artifact comes first

Before any process, there is one file. Everything else updates it. A milestone table:

```markdown
| id | milestone | owner | target | status | done_test | depends_on |
|----|-----------|-------|--------|--------|-----------|------------|
| M1 | Pricing copy approved | @ana | 2026-06-10 | done | Final copy signed off in doc | |
| M2 | Pricing page built | @ben | 2026-06-18 | amber | URL returns 200 with new copy | M1 |
| M3 | Page live in prod | @ben | 2026-06-24 | green | prod URL 200, analytics firing | M2 |
```

Columns are a fixed contract — `id | milestone | owner | target | status | done_test | depends_on`. CSV with the same header is equivalent and is what `scripts/verify.sh` lints. This file is the single source of truth; the status report is a *view* of it, never a second copy that drifts.

Rules for the contract, each with its why:
- **`id` is unique and stable** — `depends_on` references it, so renaming breaks the graph.
- **`owner` is exactly one person, with an `@handle`** — "accountability without a named owner defaults to no accountability." Never a team (`@marketing`) or two people.
- **`target` is an ISO date** (`YYYY-MM-DD`) — so "trending late" is arithmetic, not opinion.
- **`status` is one of `{green, amber, red, done}`** — a closed set the report and the linter both trust.
- **`done_test` is binary and verifiable** — you can point at it and say yes/no, no "improve" or "work on".
- **`depends_on` is a comma-separated list of real ids** — the dependency edges that reveal the critical path.

## Milestone discipline

A milestone is a **checkpoint that marks a significant achievement** — it has a target date but no duration. The smaller actionable steps that get you there are *tasks*; track milestones at the project level, not every task. Each milestone proves a SMART-shaped goal (the done-test is the "Measurable").

Bad → Good, because most plans fail right here:

```text
Bad:  "Marketing improvements"          (no owner, no date, not testable)
Good: | M7 | Landing page live | @ana | 2026-06-15 | green | prod URL returns 200 with new hero | M6 |

Bad:  "Ben & Ana own the launch"        (accountability split = no accountability)
Good: owner @ben on M2; @ana is named in done_test as reviewer if needed — still one A.

Bad:  done_test = "page is better"       (not binary — never finishable)
Good: done_test = "Lighthouse perf >= 90 on /pricing, checked in CI"
```

If the operator hands you a loose goal, decompose it into 3–8 milestones with one owner and a binary done-test each, then draw `depends_on` edges. More than ~10 milestones means you are tracking tasks — push those down to `../tasks/SKILL.md`.

## RAG status from rules, not vibes

Set status by the table below and write the *reason* next to any non-green item. Re-evaluate every milestone at each update.

| Condition | Status |
|-----------|--------|
| On track; on or ahead of date; dependencies met | `green` |
| Trending late: days of slip accumulating, OR a blocking `depends_on` has shifted, OR past ~halfway to target with little visible progress | `amber` |
| Missed its target, OR critically late with no credible recovery, OR a hard blocker with no owner-driven mitigation | `red` |
| Done-test satisfied and verified | `done` |

Two rules that do the real work:
- **Amber is an early warning, not a soft red.** Flag amber *before* the due date passes — the whole point is to course-correct while there is still time. A milestone that only turns red on its due date was mis-tracked.
- **All-green is a smell.** A board that is always green means you are either not tracking closely or not being honest. On any real project at least one item is usually amber. If everything is genuinely green, say so explicitly so it is a claim, not a default.

## Slippage and the critical path

The **critical path** is the longest chain of `depends_on` edges that sets the finish date — its milestones have zero buffer, so any slip there slips the whole project. Mark which milestones are on it. Watch **near-critical** paths too: a small slip there can promote them onto the critical path.

At every update: re-confirm which milestones are critical (the path moves as dates change), track **days of slip** per milestone (today minus target for anything late), and surface any milestone whose amber rule just tripped. The full early-warning decision table and a worked slippage example live in `references/raid-and-rag.md`.

## RAID log

Run a RAID log alongside the milestone table from project initiation. Four buckets — keep them distinct, because the confusion between a risk and an issue is where projects rot:

- **Risk** — *might* happen; plan a mitigation ahead of time. (likelihood × impact)
- **Assumption** — believed true but unverified; if it breaks, a milestone breaks.
- **Issue** — already happening, needs action now (a risk that materialized).
- **Dependency** — a handoff or relationship that can bottleneck (often the cross-team `depends_on` edges).

Each item carries: description, likelihood, impact/severity, owner, and a review date. Review the log **at least weekly and at every phase transition** — phase boundaries are exactly when hidden risks surface and old assumptions break. Example rows and the RACI-on-milestones note are in `references/raid-and-rag.md`.

## The weekly status report

A status report is scannable in **under 2 minutes** and takes you **under 15 minutes to write**. It is a delta view, not a re-dump of the plan. Structure:

```markdown
## Status — Pricing launch — week of 2026-06-02
**Overall: AMBER** — M2 slipped 3 days; recovery in place, finish date still 2026-06-24.

### Hit this week
- M1 Pricing copy approved (@ana) — done, signed off.

### Next steps
- M2 Pricing page built — @ben — due 2026-06-18 (was 06-15; +3 days)
- M3 Page live — @ben — due 2026-06-24

### Blockers / escalations
- M2: design assets arrived 2 days late (dependency). Mitigation: @ben cut scope of v1 hero. No decision needed.

### RAID changes
- New RISK: analytics tag may not fire on prod CDN (owner @ben, review 06-16).
- Moved to ISSUE: staging deploy flaky → now blocking M2 testing.
```

The honesty rule, non-negotiable: **name at least one amber/red item with its mitigation**, and if a milestone slipped, **lead with it and the recovery plan**. Stakeholders who discover problems late lose trust permanently; a credible report surfaces the bad news first. The fill-in template and a fully worked example are in `references/status-report-template.md`.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|--------------|--------------|------------|
| Owner is a team (`@marketing`) or two people | Accountability splits to nobody; nobody chases the slip | Exactly one named `@owner` per milestone |
| Status set by gut feel | Two people disagree; amber never trips early | Apply the RAG rule table; write the reason |
| Tracking every task as a milestone | The board becomes a to-do list, signal drowns | 3–8 milestones; tasks go to `../tasks/SKILL.md` |
| `done_test` = "improve X" / "work on Y" | Never binary, so never finishable | A yes/no check: "URL 200", "signed off in doc" |
| Board is always green | You are not tracking, or not honest | Expect ≥1 amber; state "all green" explicitly if true |
| Only flag red on the due date | Too late to recover | Trip amber early on the trending-late rule |
| RAID created once, never reviewed | Stale risks, broken assumptions go unseen | Review weekly + at every phase transition |
| Status report re-dumps the whole plan | Nobody reads 3 pages; the delta is buried | Report deltas only: hit / next / blockers / RAID changes |
| `depends_on` points at a deleted id | Critical path is wrong; slip propagation invisible | Keep ids stable; `verify.sh` catches dangling refs |

## References

- `references/status-report-template.md` — the fill-in weekly report, a worked Good example, and the artifact column contract `verify.sh` enforces.
- `references/raid-and-rag.md` — RAID bucket definitions with example rows, the full RAG + early-warning decision table, and the RACI-on-milestones note for teams that need it.

Run `scripts/verify.sh` against the milestone file to lint structure (unique ids, one owner, parseable date, allowed status, non-empty done-test, resolvable `depends_on`) and to audit the status-report honesty rule. It is a structural lint, never a judgement of whether the plan is good.
