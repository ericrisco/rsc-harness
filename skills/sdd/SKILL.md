---
name: sdd
description: "Use when you want a disciplined, spec-driven path from a feature idea to shipped, verified software — the rsc-sdd dispatcher / front door. It states the SDD method, reads the accompaniment dial from 02-DOCS, and routes to the right phase skill: constitution -> specify -> clarify -> plan -> tasks -> analyze -> implement -> verify -> review -> ship, with debug / worktrees / parallel callable on demand. Use it to START a feature, when unsure which SDD phase you are in, or to govern the whole flow. Triggers: 'spec-driven development', 'sdd', 'build this feature properly', 'start a new feature', 'I have an idea, take it to production', 'which phase am I in', 'run the sdd flow', 'desarrollo dirigido por especificación', 'monta esta feature bien', 'munta aquesta feature bé', 'de la idea a producción', 'de la idea a producció', 'fem un SDD per X', 'quina fase soc', 'per-phase model routing', 'use a cheaper model for implementation', 'qué modelo por fase'. NOT itself a single phase (it dispatches), NOT the workspace harness (harness), NOT a stack build skill."
tags: [sdd, spec, workflow, plan]
recommends: [sdd-init, constitution, specify]
profiles: [core, full]
origin: risco
---

# sdd — the rsc Spec-Driven Development dispatcher

*The front door for building software the rsc way: intent in, shipped-and-verified software out, with the spec, plan and decisions recorded into the project's living knowledge model as you go.*

`sdd` is the **engineering counterpart of the `harness`**. The harness runs the chaos → knowledge loop (inbox → `02-DOCS` wiki). `sdd` runs the **intent → shipped software** loop, and it writes the artifacts of that loop — constitution, specs, plans, decisions — into the same `02-DOCS/wiki/sdd/` so the project's knowledge grows with every feature instead of leaking into chat history.

This skill does **not** do a phase itself. It is the dispatcher: it names the method, reads how much accompaniment you want, tells you which phase you are in, and hands off to the phase skill that owns the work. Each phase skill, when it finishes, points you at the next one — so once you enter the chain you rarely come back here.

## The method in one breath

Spec-Driven Development (SDD, GitHub Spec Kit lineage) says: **decide what and why before how, write it down, and let each written artifact gate the next step.** You do not jump from a sentence in chat to a pull request. You move through ordered phases, each producing a durable artifact that the next phase reads. The payoff is that the *intent* is reviewable before any code exists, drift is caught at a gate instead of in production, and the whole thing is legible to the next person (or the next session) because it lives in `02-DOCS`, not in a scrollback.

If you only remember one rule: **the artifact is the contract.** Code is checked against the plan, the plan against the spec, the spec against the constitution. When they disagree, you fix the disagreement before writing more code — you do not let the code silently win.

## Step zero: calibrate the SDD runtime

Before the first non-trivial feature in a repo, run `../sdd-init/SKILL.md`. It detects the stack, package manager, test runners, scripts, monorepo signals and review budget, refreshes `.rsc/skill-registry.json`, and writes:

```text
02-DOCS/wiki/sdd/config.yaml
```

If `config.yaml` is missing and the request is more than a tiny one-line change, route to `sdd-init` before `specify`. This is not the same as `init`: `init` profiles the user/workspace; `sdd-init` calibrates the technical SDD runtime.

## The chained phase map

The canonical chain runs left to right. Solid arrows are the default path; you move forward when the current phase's exit gate passes.

```text
constitution ─(once per project)─┐
                                 ▼
   sdd-init ─(once per repo/runtime)─┐
                                     ▼
   proposal? ─► specify ─► clarify ─► plan ─► tasks ─► analyze ─► implement ─► verify ─► review ─► ship ─► archive
                                                         ▲
                                          on demand ─────┴─────────────────────
                                          debug · worktrees · parallel
```

| Phase | Owns | Writes | Tier | Sibling skill |
| --- | --- | --- | --- | --- |
| **sdd-init** | Technical runtime calibration: stack, tests, commands, registry, budgets | `02-DOCS/wiki/sdd/config.yaml`, `.rsc/skill-registry.*` | light | `../sdd-init/SKILL.md` |
| **proposal** | Optional pre-execution briefing for ambiguous/architectural/risky work | `02-DOCS/wiki/sdd/proposals/<slug>.md` | — | handled by `../specify/SKILL.md` when needed |
| **constitution** | Project non-negotiables: stack canon, quality bars, conventions | `02-DOCS/wiki/sdd/constitution.md` | heavy | `../constitution/SKILL.md` |
| **specify** | Turn a fuzzy intent into a spec — what & why, no how | `02-DOCS/wiki/sdd/specs/<slug>.md` | balanced | `../specify/SKILL.md` |
| **clarify** | Surface ambiguities / edge cases, ask, bake answers back in | updates the spec | balanced | `../clarify/SKILL.md` |
| **plan** | Technical plan: architecture, interfaces, data flow, tests, risks | `02-DOCS/wiki/sdd/plans/<slug>.md` | heavy | `../plan/SKILL.md` |
| **tasks** | Break the plan into ordered, independently-verifiable tasks | task list in the plan artifact | balanced | `../tasks/SKILL.md` |
| **analyze** | Consistency gate: constitution ↔ spec ↔ plan ↔ tasks (report only) | a gap report | heavy | `../analyze/SKILL.md` |
| **implement** | Execute tasks with checkpoints; TDD discipline embedded | logs to `02-DOCS/wiki/sdd/decisions.md` | balanced | `../implement/SKILL.md` |
| **verify** | Post-build gate: run the stack's checks + done-checks + acceptance | evidence | balanced | `../verify/SKILL.md` |
| **review** | Adversarial code review — give and receive with rigor | review notes | heavy | `../review/SKILL.md` |
| **ship** | Close the branch: PR / merge / cleanup. **Git authorship = Eric** | the merge/PR and archive bundle | light | `../ship/SKILL.md` |
| **debug** | Root-cause diagnosis: reproduce → isolate → fix → verify | a diagnosis | heavy | `../debug/SKILL.md` |
| **worktrees** | Isolate feature work in a branch/worktree before executing a plan | an isolated workspace | light | `../worktrees/SKILL.md` |
| **parallel** | Fan out independent tasks across subagents, gather results | merged results | per-unit | `../parallel/SKILL.md` |

> The **Tier** column is the *default* model tier each phase routes to when **per-phase model
> routing** is enabled — see "Per-phase model routing" below. It is off by default and changes
> nothing about the chain or the gates; it only decides which model does the work.

> If a phase skill above does not yet exist in this repo, the chain still holds — do that phase's work inline following the method here, and skip the broken handoff. Never invent a sibling that is not installed.

## The invoke rule — route to the phase that fits

When a request lands, do not start typing code. Place it on the map first, then invoke the phase skill that owns it.

> **The new-feature gate (hard).** The moment the user is thinking about a new feature or change — "add…", "build…", "it should also…", "quiero añadir…" — it goes to `specify` first, *even if a stack skill (nextjs/fastapi/flutter/react…) also fired and could just build it*. **No feature code is written — by any skill — until a spec AND a plan exist and the user has approved them.** A stack skill about to build an unspec'd, non-trivial feature must stop and route here. The only exception is a genuinely one-line, low-risk change; name it and skip.

1. **No `02-DOCS/wiki/sdd/config.yaml` and this is non-trivial?** → `sdd-init`.
2. **No constitution yet AND this project will grow?** → `constitution` once, then come back to the chain.
3. **Ambiguous / architectural / risky change before spec?** → optional proposal artifact via `specify`.
4. **A new idea, fuzzy, no spec on disk?** → `specify`.
5. **A spec exists but feels risky / has open questions?** → `clarify`.
6. **A clarified spec, no technical plan?** → `plan`.
7. **A plan with no task breakdown?** → `tasks`.
8. **Tasks exist, about to code, want a safety check?** → `analyze`.
9. **Green light to build?** → `implement` (it embeds strict TDD from config and calls `parallel`/`worktrees` when useful).
10. **Code written, claiming it works?** → `verify`, then `review`, then `ship`/archive.
11. **Something is broken mid-flight?** → `debug`, then resume where you were.

If you genuinely cannot tell which phase you are in, ask the user one question: *"Do we have a written spec for this yet?"* The answer puts you before or after `specify`, and the rest follows.

### Skip rules (be honest about them)

- A **one-line, low-risk change** (typo, copy tweak, config bump) does not need the full chain. Say so, do it, and verify. The method serves shipping, not ceremony.
- `constitution` runs **once per project**, not per feature. If `02-DOCS/wiki/sdd/constitution.md` exists, read it as guardrails and move on.
- `clarify` and `analyze` are **gates, not paperwork**. If a spec is genuinely unambiguous and tiny, name that out loud and pass through — but the bias is to run them, because skipped gates are where drift hides.

## Read the accompaniment dial first

Before dispatching, read `02-DOCS/wiki/harness/user-profile.md` and adapt — exactly as every rsc skill does. The dial sets **how much you explain and how many questions you ask at each gate**, not whether the gates exist.

| Level | At each phase | At gates (clarify / analyze / decisions) |
| --- | --- | --- |
| **L0** "cavernícola" | Name the phase, do it, show the artifact. Minimal prose. | Ask only the questions that actually change the outcome. |
| **L1** "breve" | One line of *why this phase now*. | One-line rationale per question. |
| **L2** "explica decisiones" | Justify each significant choice as you go. | Walk the trade-offs before the user picks. |
| **L3** "acompañamiento total" | Explain the phase, why it matters, what it produces. | Ask broadly, teach the SDD reasoning, narrate every decision. |

If there is no profile yet, default to **non-technical + ask the two harness gauging questions** (technical level, accompaniment level) before dispatching, and persist them — that is the harness's job and `sdd` honors it.

## Per-phase model routing (opt-in)

Different phases reward different models: architecture and adversarial review want the strongest
one; scaffolding and git plumbing don't. SDD can route each phase to a **tier** — `heavy`
(deep reasoning), `balanced` (execution), `light` (mechanical) — that resolves to a concrete
model in `02-DOCS/wiki/sdd/config.yaml` under `models`. The default mapping is the **Tier**
column above (quality-biased: heavy on constitution/plan/analyze/review/debug, balanced on
execution, light on ship/worktrees/sdd-init).

It is **off by default** (`models.enabled: false`). When the user opts in, each phase applies it
two ways: **programmatically** — dispatching `Task`/`parallel` subagents on the tier's model
(real routing, e.g. Claude Code) — and **advisorily** — announcing the recommended switch at the
phase boundary, gated by the accompaniment dial, for inline work and assistants that can't switch
programmatically. Never switch unasked, never claim a switch a tool can't make, and skip routing
on trivial one-line changes. The `sdd` dispatcher itself never routes (staying on the session
model); `parallel` has no fixed tier (each unit inherits the tier of its work). Full protocol,
per-assistant mechanism, and the provider→model table: `references/model-routing.md`.

## Where the artifacts live (and why it matters)

Every phase writes under `02-DOCS/wiki/sdd/` so the feature's reasoning outlives the chat:

```text
02-DOCS/wiki/sdd/
├── config.yaml              ← repo runtime calibration from sdd-init
├── constitution.md          ← project non-negotiables (once)
├── proposals/<slug>.md      ← optional pre-execution briefing
├── specs/<slug>.md          ← one spec per feature
├── plans/<slug>.md          ← one plan per feature (tasks live inside)
├── progress/<slug>.md       ← append-only apply progress
├── verifications/<slug>-YYYY-MM-DD.md
├── archive/<slug>/          ← final report, state, verify/review/ship records
├── sessions/<date>-<slug>.md
└── decisions.md             ← append-only log of decisions taken while building
```

Index these in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) under an `sdd/` topic, so every other skill reads them before working in the area. The harness maintains and improves these files just like any other wiki topic — `sdd` produces them, the harness keeps them honest.

```markdown
# 02-DOCS/wiki/index.md
## Knowledge map
| Topic | Where | What |
| --- | --- | --- |
| sdd/ | 02-DOCS/wiki/sdd/ | Constitution, specs, plans, decisions for spec-driven feature work |
```

## Stack handoff

`sdd` and its phases are **process, not stack**. Concrete tooling — test runners, lint/type/build, framework idioms — belongs to the stack skills. `plan` defers stack specifics, `implement` borrows the stack skill's testing approach, and `verify` runs the stack skill's checks. Route to the stack that matches the work: `../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../postgresdb/SKILL.md`, `../flutter/SKILL.md`. Visual/UX work routes to `../design/SKILL.md` and copy to `../marketing/SKILL.md`.

## Skill registry and compact skill rules

The registry is the cheap index:

```text
.rsc/skill-registry.json
.rsc/skill-registry.md
```

Use it to choose the few relevant skill paths for the current phase/stack. Do not load the whole catalog. Before dispatching subagents, digest selected skills into 4-5 compact rules and include them in the brief. Each phase reports `skill_resolution`: which skills were used, which were missing, fallback behavior, and the compact rules handed to subagents.

## Standard result envelope

Every SDD phase ends with the same parseable block so the dispatcher can chain phases without interpreting a novel:

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "one short paragraph",
  "artifact": "path/to/artifact-or-none",
  "next_recommended": "sdd-init|specify|clarify|plan|tasks|analyze|implement|verify|review|ship",
  "risk": "low|medium|high",
  "model": { "tier": "heavy|balanced|light", "resolved": "model-id", "routing": "on|off" },
  "skill_resolution": {
    "used": [],
    "missing": [],
    "fallback": [],
    "compact_rules": []
  },
  "evidence": []
}
```

If a phase cannot produce the envelope because the user stopped it mid-flight, write a session summary instead.

## Session summary / compaction recovery

When a session is long, about to pause, or context is at risk, write:

```text
02-DOCS/wiki/sdd/sessions/<date>-<slug>.md
```

Include current phase, active artifacts, last verdict, completed tasks, next steps, risks, useful commands, and the current `skill_resolution`. This lets the next agent resume from artifacts instead of scrollback.

## Anti-patterns → STOP

| Rationalization | Reality / fix |
| --- | --- |
| "I get the feature, I'll just start coding." | That is the failure SDD prevents. At minimum write the spec; the artifact is the contract. |
| "`sdd` should write the spec itself." | No. `sdd` dispatches. Invoke `specify` — it owns the spec and asks the right questions. |
| "Clarify and analyze are bureaucracy, skip them." | Skipped gates are where drift hides. Run them; only pass through if the change is genuinely trivial and you say so. |
| "Profile says L0, so I'll skip the gates to be terse." | L0 changes verbosity, not the method. Fewer words, same gates. |
| "I'll keep the plan in chat, it's faster." | Chat is not durable. Write it under `02-DOCS/wiki/sdd/` or the next session is blind. |
| "I'll skip `sdd-init`; I remember the test command." | The runtime contract belongs in `config.yaml`, not memory. |
| "I'll load every skill into the subagent." | That contaminates context. Use registry -> selected paths -> compact rules. |
| "The phase wrote a nice summary, so no envelope needed." | The envelope is the phase contract. Add it. |
| "Run constitution again for this feature." | Constitution is once per project. If it exists, read it as guardrails and move on. |
| "Ship now, I'll add Co-Authored-By: Claude." | `ship` enforces Eric-only authorship. No Claude co-author, no generated-with footer. |
| "Invoke the `release` phase." | There is no such phase. Never invent a sibling — the chain is the chain. |
| "Routing sounds useful, I'll switch to the heavy model on my own." | Routing is opt-in (`models.enabled:false`). Don't switch models unless the user turned it on. |
| "I'll tell them I switched to Opus." (on an assistant with no per-subagent model) | Announce the recommended tier; never claim a switch the tool can't make. Honesty over magic. |

## Start here

- **New project, nothing on disk yet** → `../sdd-init/SKILL.md` for runtime calibration, `../constitution/SKILL.md` for non-negotiables, then `../specify/SKILL.md`.
- **Existing project, no SDD config** → `../sdd-init/SKILL.md`, then route by phase.
- **Existing project, new feature** → `../specify/SKILL.md` (or proposal first if risky/architectural).

Then follow the arrows: each phase ends by pointing at the next, all the way to `ship`.
