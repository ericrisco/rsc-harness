---
name: constitution
description: "Use when setting or amending a project's non-negotiables — stack canon, quality bars, conventions, security/a11y floors — as numbered, testable rules later phases obey, and drafting the REVIEW.md the reviewer reads. ASDD's base stage; writes 02-DOCS/wiki/sdd/constitution.md and REVIEW.md at the project root. NOT a feature spec (that is `specify`), NOT the technical plan (that is `plan`), NOT the wiki itself (that is `harness`)."
tags: [asdd, constitution, principles, review]
recommends: [specify]
profiles: [core, full]
origin: risco
---

# constitution — the project's non-negotiable principles

*ASDD's base stage (`../asdd/SKILL.md`). Run once per project, then amend. It writes down the rules every later phase obeys — stack canon, quality bars, conventions — and the `REVIEW.md` the reviewer reads first. Everything downstream — specify, plan, analyze, implement, verify, review — reads these as guardrails.*

A constitution is small, durable, and enforceable. It is **not** a wiki of everything you know about the project (that is what `02-DOCS/wiki/` already is, run by the `harness`). It is the short list of principles that, if violated, mean the work is wrong regardless of whether it runs. If a rule here cannot be checked or pointed at later, it does not belong here — move it to the stack wiki and link it.

Not this phase: *what to build* → `../specify/SKILL.md`; the technical approach for one feature → `../plan/SKILL.md`; setting up `01-TOOLS/` + `02-DOCS/` or capturing general project knowledge → `harness`; concrete stack mechanics (*how* to configure Ruff, pytest, Tailwind tokens) → the relevant stack skill (`../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../postgresdb/SKILL.md`, `../flutter/SKILL.md`, `../design/SKILL.md`, `../security-audit/SKILL.md`). The constitution *names* the bar; the stack skill *enforces* it.

## Model tier — `heavy` (opt-in routing)

This phase's default model tier is **`heavy`** — it sets the project's non-negotiables, the highest-leverage decisions in the repo. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../asdd/references/model-routing.md` — announce the switch in one line when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Honor the register first

Before asking anything, read `02-DOCS/wiki/harness/user-profile.md` and use its `technical_level`: technical terms, or plain words with analogies. No profile yet → use analogies and ask once "technical or with analogies?", or point the user at `init`; never assume fluency. The interview is the same for every reader:

- Infer almost everything from the codebase and stack wiki. Ask only the few questions that genuinely change a principle.
- Give one line of *why* per principle proposed, and the trade-off where a rule constrains the team — in the `orient` voice.
- For a `non-technical` reader, say in one sentence what a constitution is (the house rules every later step obeys) before drafting.

## Reconcile before you write (do not duplicate the stack wiki)

The harness may already hold real conventions under `02-DOCS/wiki/stack/*` (e.g. `nextjs.md`, `fastapi.md`, `postgresdb.md`). The constitution does not copy them — it **ratifies the principle and links the detail**. Run this reconciliation pass first:

1. **Read the Knowledge map** — `02-DOCS/wiki/index.md`. List every `02-DOCS/wiki/stack/*` article that exists.
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
          (gitignored). Enforced by security-audit + a pre-commit secret scan."
```

## The interview (requirements-first, batched)

Gather what you cannot infer, then draft. Ask in one short batch — only the questions that matter. Cover these dimensions — skip any the stack wiki already answers, and confirm rather than re-ask:

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

- **Git authorship is the human's.** Commits and PRs are authored by the responsible person — the configured git user. No `Co-Authored-By` an AI, no "generated with" footer. Enforced at the `ship` phase.
- **Decisions are logged.** Every significant decision is appended to `02-DOCS/wiki/sdd/decisions.md` (or the harness `decisions.md`) with date, options considered, and the why. The constitution itself is the highest-order decision record.

## Drafting the constitution

Write `02-DOCS/wiki/sdd/constitution.md` from the template in `references/constitution-template.md`. Keep it short — a readable constitution is 1-2 screens, not a manual. Structure:

- **Header** — project name, version (`v1.0.0`), ratified date, last-amended date.
- **Principles** — numbered, grouped by the dimensions above. Each is one testable statement; link the stack article or script that enforces it.
- **The bar (Definition of Done)** — the merge checklist every feature must pass. This is what `verify` runs against.
- **Amendment log** — append-only; every change recorded (see protocol below).

Create `02-DOCS/wiki/sdd/` if it does not exist. Do not overwrite an existing constitution — amend it.

**A draft is "complete me", not "amend me".** `rsc onboard` writes a skeleton with `status: draft` in the frontmatter: the template's headings, the facts onboarding knew (goal, kind, scope, workflow, detected stack) and no principle. Keep those facts, run the interview, fill the sections, then on ratification drop `status: draft`, set `version: v1.0.0` and log v1.0.0 in the amendment log.

## REVIEW.md — what the reviewer reads first

With the constitution, draft `REVIEW.md` at the project root (the code repo — the reviewer runs there). It is short, specific to this repo, and ratified with the constitution:

- **What failure looks like here** — the defect classes that actually hurt this project (e.g. "a query without the tenant filter", "a migration that is not reversible").
- **Paths to skip** — generated code, vendored files, fixtures.
- **Nit cap** — the most nits one review may report (e.g. 3); the rest are dropped.
- **Always-human paths** — what must never merge without a person (billing, auth, infra). Listing them here only informs; to be *enforced* they go into `.rsc/sello-config.json` `risk.raise`, which `rsc risk` reads — say so to the user.
- **Summary starts with a count** — "3 findings: 1 blocker, 2 nits", before anything else.

`review` adds to it when a finding keeps repeating; amend it like the constitution, never silently.

## Versioning & amendment protocol

The constitution is versioned so `analyze` and `review` can cite "constitution v1.2.0, principle 4".

- **Semantic-ish versioning.** MAJOR when a principle is removed or reversed (breaks existing work); MINOR when a principle is added or materially tightened; PATCH for wording/clarity with no behavior change.
- **Amendments are append-only in the log.** Never silently edit a ratified principle — strike it (mark superseded) and add the new one, bump the version, and record date + why in the amendment log.
- **Ratification.** A new or amended constitution is shown to the user and ratified explicitly before it takes effect. "Ratify" is an explicit yes on the shown draft; walk each change only if the user asks.
- **In autopilot** (`execution_mode: automatic`, or an up-front "take it all the way"), there is no one to ask: ratify **provisionally** (`status: provisional` in the frontmatter), log it in `decisions.md`, and add a `review-after` entry to the decision queue (`../asdd/SKILL.md`) so the human confirms it later. It does not block the run or a self-merge.
- **Downstream notice.** When a principle changes mid-project, flag that existing specs/plans may now be inconsistent — `analyze` will catch the drift on the next run.

## Anti-patterns

| Anti-pattern | Why it fails / fix |
|--------------|--------------------|
| "I'll write a thorough constitution covering everything about the project." | That's the wiki, not the constitution. Keep only enforceable non-negotiables; link the rest. |
| "This stack detail is important, I'll paste the lint config in here." | No. Ratify the principle, link `wiki/stack/*` for the mechanic. The constitution names the bar; the stack skill enforces it. |
| "Two stack articles disagree — I'll just pick the stricter one." | Contradictions are findings. Surface them; the user resolves. |
| "The principle is 'write good code' — everyone knows what that means." | Not checkable, not a principle. Make it testable or drop it. |
| "I'll rewrite the existing constitution to match what they said today." | Amend, don't overwrite. Strike + add + bump version + log the why. |
| "No profile yet, I'll assume they're technical." | Use analogies; ask once "technical or with analogies?" or send them to `init`. |
| "I'll add a Co-Authored-By so the commit credits the assist." | No. Git authorship is the human's — it's a fixed principle, enforced at `ship`. |
| "I'll ratify it myself since it's obvious." | The user ratifies. Show the draft, get the explicit yes, then it takes effect. Only autopilot ratifies provisionally, as a `review-after` queue entry. |

## Checklist before handing off

- [ ] `02-DOCS/wiki/harness/user-profile.md` read; register matched to `technical_level` (or the register question asked).
- [ ] Reconciliation pass done against every `02-DOCS/wiki/stack/*` article; contradictions surfaced, not auto-resolved.
- [ ] Every principle is numbered, imperative, testable, and links its enforcer where one exists.
- [ ] The Definition-of-Done checklist is present (what `verify` runs against).
- [ ] Fixed principles included: human git authorship + decisions logged.
- [ ] `02-DOCS/wiki/sdd/constitution.md` written with version + ratified date + amendment log.
- [ ] `REVIEW.md` drafted at the project root; always-human paths mirrored into `.rsc/sello-config.json` `risk.raise` (or the user told why they are not).
- [ ] The constitution is indexed in `02-DOCS/wiki/index.md` (the Knowledge map) under the `sdd/` topic.
- [ ] The constitution was shown to the user and explicitly ratified — or, in autopilot, ratified provisionally with a `review-after` queue entry.

## Project grounding (02-DOCS)

This skill's `02-DOCS` record is the constitution at `02-DOCS/wiki/sdd/constitution.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map) like every other sdd artifact:

```markdown
| Project constitution (SDD non-negotiables) | `02-DOCS/wiki/sdd/constitution.md` |
```

Never edit the root `CLAUDE.md` from here: it is owned by `harness` and is tier 2 in `rsc risk`. Every later ASDD phase reads the constitution before it works. The harness maintains and improves the article over the life of the project; this skill is the place that ratifies and amends it.

## Result envelope

End with the parseable block every phase shares, so the dispatcher can chain without
interpreting prose (contract: `../asdd/SKILL.md`):

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "Constitution written with N numbered, testable rules the later phases inherit.",
  "artifact": "02-DOCS/wiki/sdd/constitution.md",
  "next_recommended": "specify",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["constitution"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Principles are inherited constraints, not choices to re-make.", "Every rule is testable or it is a preference."]
  },
  "evidence": ["constitution path exists", "rules numbered and testable", "REVIEW.md drafted", "decisions log appended"]
}
```

## Next in the chain

The constitution is the guardrail; now describe what to build. Hand off to **`../specify/SKILL.md`** — turn a fuzzy intent into a spec (what & why, no implementation), grounded in these principles. The ASDD stages: **base → spec → plan → per-task loop → closing → learn** (with `debug`, `worktrees`, `parallel` callable on demand). The dispatcher is `../asdd/SKILL.md`.
