---
name: constitution
description: "Use when setting or amending a project's non-negotiables — stack canon, quality bars, conventions, security/a11y floors — as numbered, testable rules later phases obey. First rsc-sdd phase; writes 02-DOCS/wiki/sdd/constitution.md. NOT a feature spec (that is `specify`), NOT the technical plan (that is `plan`), NOT the wiki itself (that is `harness`)."
tags: [sdd, constitution, principles]
recommends: [specify]
profiles: [core, full]
origin: risco
---

# constitution — the project's non-negotiable principles

*The first rsc-sdd phase. Run once per project, then amend. It writes down the rules every later phase obeys: stack canon, quality bars, conventions. Everything downstream — specify, plan, analyze, implement, verify, review — reads this file as guardrails.*

A constitution is small, durable, and enforceable. It is **not** a wiki of everything you know about the project (that is what `02-DOCS/wiki/` already is, run by the `harness`). It is the short list of principles that, if violated, mean the work is wrong regardless of whether it runs. If a rule here cannot be checked or pointed at later, it does not belong here — move it to the stack wiki and link it.

Not this phase: *what to build* → `../specify/SKILL.md`; the technical approach for one feature → `../plan/SKILL.md`; setting up `01-TOOLS/` + `02-DOCS/` or capturing general project knowledge → `harness`; concrete stack mechanics (*how* to configure Ruff, pytest, Tailwind tokens) → the relevant stack skill (`../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../postgresdb/SKILL.md`, `../flutter/SKILL.md`, `../design/SKILL.md`, `../secure-coding/SKILL.md`). The constitution *names* the bar; the stack skill *enforces* it.

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — it sets the project's non-negotiables, the highest-leverage decisions in the repo. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Honor the accompaniment dial first

Before asking anything, read `02-DOCS/wiki/harness/user-profile.md` and match its `technical_level` and `accompaniment_level`. No profile yet → default to non-technical and ask the two gauging questions, or point the user at `init`; never assume fluency. The constitution interview adapts:

| Level | How this skill behaves |
|-------|------------------------|
| L0 — cavernícola | Infer almost everything from the codebase and stack wiki. Ask only the 1-2 questions that genuinely change a principle. Draft, show, ratify. |
| L1 — breve | One line of *why* per principle proposed. Ask 3-4 questions max. |
| L2 — explica decisiones | Justify each principle as you propose it; surface trade-offs where a rule constrains the team. |
| L3 — acompañamiento total | Explain what a constitution is and why each section matters, one kind question at a time, before writing anything. Non-technical framing. |

## Reconcile before you write (do not duplicate the stack wiki)

The harness may already hold real conventions under `02-DOCS/wiki/stack/*` (e.g. `nextjs.md`, `fastapi.md`, `postgresdb.md`). The constitution does not copy them — it **ratifies the principle and links the detail**. Run this reconciliation pass first:

1. **Read the Knowledge map** — the full index lives in `02-DOCS/wiki/index.md` (root `CLAUDE.md` keeps only a short pointer to it). List every `02-DOCS/wiki/stack/*` article that exists.
2. **Read each stack article.** Pull out anything already phrased as a rule (a version pin, a lint config, a test threshold, a naming convention).
3. **For each existing rule, decide:** is it a *project-wide non-negotiable* (→ ratify it as a principle, linking the stack article for detail) or a *local mechanic* (→ leave it in the stack wiki, do not lift it into the constitution)?
4. **Contradictions are findings, not fixes.** If two stack articles disagree, or a stack article contradicts what the user states now, surface it and let the user resolve — never silently pick a winner.

The rule of thumb: the constitution says *"every endpoint is typed and tested to ≥80% line coverage — see `wiki/stack/fastapi.md` for the pytest setup"*. It does not paste the pytest config.

## What a principle must have

Every principle in the constitution is one numbered, testable statement. A vague aspiration is not a principle.

- **Imperative and specific.** "Code is formatted with the repo's formatter on every commit" — not "we value clean code".
- **Checkable.** There must be a way for `../analyze/SKILL.md` and `verify` to tell whether it held. Prefer a number, a command, or a named artifact.
- **Owned.** If enforcement lives in a stack skill or a script, link it.
- **Falsifiable in review.** A reviewer can point at a diff and say "this violates principle 4".

```text
Weak   — "We care about security."
Strong — "4. No secret is ever committed; secrets load from 01-TOOLS/<provider>/.env
          (gitignored). Enforced by secure-coding + a pre-commit secret scan."
```

## The interview (requirements-first, batched)

Gather what you cannot infer, then draft. Ask in batches sized to the accompaniment level (L0: the 1-2 that matter; L3: one at a time, explained). Cover these dimensions — skip any the stack wiki already answers, and confirm rather than re-ask:

1. **Stack canon** — languages, frameworks, runtime/versions, package manager. What is fixed vs. open?
2. **Quality bar** — formatter/linter (must pass clean?), type checking (strict?), test discipline (TDD? coverage floor? what kind of tests gate a merge?).
3. **Conventions** — naming, directory structure, module boundaries, API/error shapes, commit message format.
4. **Branching & shipping** — branch naming, PR required?, who/what gates a merge, release cadence. (Authorship rule is fixed — see below.)
5. **Security & privacy floor** — secret handling, authn/z baseline, data residency, dependency policy.
6. **Accessibility & UX floor** (if there's a UI) — the minimum bar (e.g. WCAG AA, keyboard-navigable).
7. **Performance budgets** (where they matter) — a named budget, not "should be fast".
8. **Documentation & knowledge** — what must be written down (decisions log, the wiki) and when.

For any significant either/or (e.g. "strict types or gradual?", "squash or merge commits?"), use the harness **"siempre 3 opciones"** shape where it applies: gather the constraint, present up to 3 honest options with a recommendation matched to the team's level, then ratify the choice and log it.

## Fixed principles (always present)

Two principles are inherited from the rsc ecosystem and appear in every constitution unless the user explicitly overrides them:

- **Git authorship is the human's.** Commits and PRs are authored by the human (Eric, or whoever owns the repo). No `Co-Authored-By` an AI, no "generated with" footer. Enforced at the `ship` phase.
- **Decisions are logged.** Every significant decision is appended to `02-DOCS/wiki/sdd/decisions.md` (or the harness `decisions.md`) with date, options considered, and the why. The constitution itself is the highest-order decision record.

## Drafting the constitution

Write `02-DOCS/wiki/sdd/constitution.md` from the template in `references/constitution-template.md`. Keep it short — a readable constitution is 1-2 screens, not a manual. Structure:

- **Header** — project name, version (`v1.0.0`), ratified date, last-amended date.
- **Principles** — numbered, grouped by the dimensions above. Each is one testable statement; link the stack article or script that enforces it.
- **The bar (Definition of Done)** — the merge checklist every feature must pass. This is what `verify` runs against.
- **Amendment log** — append-only; every change recorded (see protocol below).

Create `02-DOCS/wiki/sdd/` if it does not exist. Do not overwrite an existing constitution — amend it.

## Versioning & amendment protocol

The constitution is versioned so `analyze` and `review` can cite "constitution v1.2.0, principle 4".

- **Semantic-ish versioning.** MAJOR when a principle is removed or reversed (breaks existing work); MINOR when a principle is added or materially tightened; PATCH for wording/clarity with no behavior change.
- **Amendments are append-only in the log.** Never silently edit a ratified principle — strike it (mark superseded) and add the new one, bump the version, and record date + why in the amendment log.
- **Ratification.** A new or amended constitution is shown to the user and ratified explicitly before it takes effect. At L0, "ratify" is a quick yes; at L3, walk each change.
- **Downstream notice.** When a principle changes mid-project, flag that existing specs/plans may now be inconsistent — `analyze` will catch the drift on the next run.

## Anti-patterns

| Anti-pattern | Why it fails / fix |
|--------------|--------------------|
| "I'll write a thorough constitution covering everything about the project." | That's the wiki, not the constitution. Keep only enforceable non-negotiables; link the rest. |
| "This stack detail is important, I'll paste the lint config in here." | No. Ratify the principle, link `wiki/stack/*` for the mechanic. The constitution names the bar; the stack skill enforces it. |
| "Two stack articles disagree — I'll just pick the stricter one." | Contradictions are findings. Surface them; the user resolves. |
| "The principle is 'write good code' — everyone knows what that means." | Not checkable, not a principle. Make it testable or drop it. |
| "I'll rewrite the existing constitution to match what they said today." | Amend, don't overwrite. Strike + add + bump version + log the why. |
| "No profile yet, I'll assume they're technical and skip the dial." | Default non-technical; ask the two gauging questions or send them to `init`. |
| "I'll add a Co-Authored-By so the commit credits the assist." | No. Git authorship is the human's — it's a fixed principle, enforced at `ship`. |
| "I'll ratify it myself since it's obvious." | The user ratifies. Show the draft, get the explicit yes, then it takes effect. |

## Checklist before handing off

- [ ] `02-DOCS/wiki/harness/user-profile.md` read; verbosity matched to the dial (or gauging questions asked).
- [ ] Reconciliation pass done against every `02-DOCS/wiki/stack/*` article; contradictions surfaced, not auto-resolved.
- [ ] Every principle is numbered, imperative, testable, and links its enforcer where one exists.
- [ ] The Definition-of-Done checklist is present (what `verify` runs against).
- [ ] Fixed principles included: human git authorship + decisions logged.
- [ ] `02-DOCS/wiki/sdd/constitution.md` written with version + ratified date + amendment log.
- [ ] Root `CLAUDE.md` `## Knowledge map` pointer has the read-first row for the constitution.
- [ ] The constitution was shown to the user and explicitly ratified.

## Project grounding (02-DOCS + CLAUDE.md)

This skill's `02-DOCS` record is the constitution at `02-DOCS/wiki/sdd/constitution.md`. It is a **read-first** pointer entry, so its row stays in the short `## Knowledge map` pointer in the root `CLAUDE.md` (create `CLAUDE.md` if absent, additive only — never delete existing sections) — unlike other sdd artifacts, which are indexed in `02-DOCS/wiki/index.md` (the full Knowledge map that root `CLAUDE.md` points to). Add this row to the root pointer if it is not already present:

```markdown
| Project constitution (SDD non-negotiables) | `02-DOCS/wiki/sdd/constitution.md` |
```

Every later rsc-sdd phase reads this file before it works. The harness maintains and improves the article over the life of the project; this skill is the place that ratifies and amends it.

## Next in the chain

The constitution is the guardrail; now describe what to build. Hand off to **`../specify/SKILL.md`** — turn a fuzzy intent into a spec (what & why, no implementation), grounded in these principles. The full chain: **constitution → specify → clarify → plan → tasks → analyze → implement → verify → review → ship** (with `debug`, `worktrees`, `parallel` callable on demand). The dispatcher is `../sdd/SKILL.md`.
