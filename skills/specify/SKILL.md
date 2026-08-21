---
name: specify
description: "Use when a feature, change, or product idea is still fuzzy and must become an approved WHAT/WHY spec before any planning or code — the brainstorming front door of SDD. Turns a one-line intent into problem, goals, users, scope, behaviour and acceptance criteria, via frontier-round dialogue and 2-3 approaches with a recommendation, carrying zero implementation detail. Fires whenever someone jumps to HOW before WHAT is agreed, in any language. NOT the technical plan (that is `plan`), NOT the de-risking ambiguity sweep (that is `clarify`), NOT project-wide principles (that is `constitution`)."
tags: [sdd, spec, requirements]
recommends: [clarify, plan]
profiles: [core, full]
origin: risco
---

# Specify — intent becomes a spec

This is the **specify** phase of the rsc-sdd chain: `constitution` → **`specify`** → `clarify` → `plan` → `tasks` → `analyze` → `implement` → `verify` → `review` → `ship`. Its single job is to turn a fuzzy intent into a written specification that states **WHAT** the change is and **WHY** it matters — and nothing about **HOW** it gets built.

A spec is a contract about behaviour and outcomes, readable by a non-technical stakeholder and precise enough that a `plan` can be derived from it. The output is one file: `02-DOCS/wiki/sdd/specs/<slug>.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer).

## Detect the moment — and hold the gate

Fire on the **faintest** sign the user is thinking about a new feature or change — not just "spec this", but any musing: "I want to add…", "can we build…", "it should also…", "wouldn't it be nice if…", "what if we…", "I've been thinking about…", "let's brainstorm…", "tengo una idea", "se me ha ocurrido", "¿y si…?", "estaría guapo que…", "quiero añadir…", "necesito que haga…". This phase owns that moment, *even if a stack skill (nextjs/fastapi/flutter…) also fired and is itching to build it*. Catch it here first — being too eager to brainstorm is cheap; skipping it is expensive.

**The hard gate — every feature, including the "obvious" ones:**
> No implementation starts — not a stack skill, not `plan`-to-code, not "just a quick version" — until the user has **approved a design** (the spec at step 9 below) and `plan` has produced the technical plan + task list. If the user says "just build it", do not; name the gate in one friendly line and run the loop. "Too simple to need a design" is the rationalization that wastes the most work — every feature gets the loop. The only thing that skips it is a literal one-line, zero-risk change (typo/copy/config) — say so out loud and do it.

You are not slowing them down; you make the intent reviewable *before* code exists, which is far cheaper than discovering the misunderstanding in a PR. End every spec by handing to `clarify`/`plan` — never to `implement`.

**Offer autopilot once, right here.** At this boundary, propose how to run the rest of the chain:
> *"¿Quieres que lo lleve hasta el final yo solo — spec → plan → código → verify, parando solo si algo es ambiguo — o prefieres que pare a que apruebes en cada fase?"*

A **yes engages autopilot** (`../sdd/SKILL.md`): you still write the spec and every artifact, but you auto-advance through the phases without re-asking — that up-front yes is the approval that satisfies the hard gate above, for the whole run. A **no** (or silence) keeps the default gated flow: write the spec, hand to `clarify`/`plan`, stop for approval before code. Either way the spec gets written; autopilot only changes whether you pause *between* phases — and it still stops for genuine ambiguity, hard failures, or destructive/outward actions (ship still confirms). If `sdd.autopilot: true` in config, autopilot is the default — still surface it once.

## The one rule that defines this skill

A spec is a **contract**: what the system will observably do, and why that matters. Every line either belongs in the contract or belongs to how the contract gets honoured — and the second kind is `plan`'s, not yours. Framework, table schema, library, endpoint shape, file path, algorithm: all of them are how, so the moment one appears the document has stopped being a contract.

One question settles every judgement call in this skill: **is this a clause of the contract, or a detail of how it gets met?**

If you cannot state a requirement without naming the technology, that is a real open question — record it as a typed point to clarify, do not guess the answer.

## Model tier — `balanced` (opt-in routing)

This phase's default model tier is **`balanced`** — it drafts the what/why spec through dialogue, not architecture. Routing is **off** unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`. When on: resolve this phase's tier (`models.overrides` wins over `models.phases`), map it to a model via `models.tiers`, and apply per `../sdd/references/model-routing.md` — announce the switch per the accompaniment dial when it differs from the session model, and dispatch any `Task`/`parallel` subagents on that model. Routing off or no profile → honor the session model silently. Never fake a switch a tool can't make; skip routing on a one-line change.

## Read the room first (accompaniment dial)

Before asking anything, read `02-DOCS/wiki/harness/user-profile.md` for the technical level and accompaniment level, and adapt:

- **L0 "cavernícola"** — infer aggressively from the intent and any existing wiki/constitution. Ask only the questions whose answer would change the contract. Draft, show, move on.
- **L1 "breve"** — one line of *why* per question; ask the few that genuinely matter.
- **L2 "explica decisiones"** — justify each requirement as you record it; surface the trade-offs you inferred.
- **L3 "acompañamiento total"** — explain what a spec is and is not, walk every section, ask freely (still one round per frontier, never crossing a dependency), confirm each answer before recording it. Ideal for non-technical users.

If no profile exists, default to non-technical framing and keep questions plain. Never assume fluency.

## Questioning discipline — ask the frontier, never cross a dependency

The failure mode of specs is the wall of twenty questions. The cure is not one question per turn: that spends a turn of the user's time per question even when the questions do not touch each other. The cure is the **frontier**.

1. **Infer first.** Read the `constitution` (`02-DOCS/wiki/sdd/constitution.md`), the existing wiki, and sibling specs. Fill every section you reasonably can from what already exists.
2. **Ask only the gaps that change the contract.** A gap earns a question only if a different answer would move scope, a goal, a user, or an acceptance criterion. Cosmetic gaps become typed *points to clarify*, not questions.
3. **Ask the whole frontier in one round.** The frontier is every remaining gap whose prerequisites are already settled — the questions you can ask *now* without guessing at answers you have not heard yet. Number them, give each your recommended answer, then wait. Where the harness offers a native question selector, use it; where it does not, emit the same round as numbered text.
4. **Never cross a dependency.** A gap whose answer depends on another question open in *this* round belongs to a later round. Recompute the frontier after every set of answers: settled decisions push it outward and unblock what waited on them. If an answer redefines a question you already emitted in the same round, discard that question out loud and re-ask it next round rather than using an answer given under a premise that just moved.
5. **Facts are your job; decisions are the user's.** When a frontier question needs a fact from the environment, go find it — and do not block on it. A running search is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now.
6. **When inference and asking both fail, type it.** Anything unresolved becomes a typed entry in *Points to clarify* — the handoff contract to `clarify`, not a defect.

A frontier of one is one question, and needs no apology. A frontier of zero is no question at all: never invent one to look diligent.

## What a good spec contains

Write these sections into `02-DOCS/wiki/sdd/specs/<slug>.md` using `references/spec-template.md`. Keep every line about behaviour and intent.

| Section | Holds | Watch for |
| --- | --- | --- |
| Problem & why | The pain, the cost of not solving it, the trigger | A "solution" disguised as a problem |
| Goals | What success delivers, in outcome terms | A "goal" that's actually a HOW |
| Non-goals / out of scope | What is explicitly NOT done now — adjacent work, deferred features | Silence — unsaid scope becomes assumed scope |
| Users & context | Who acts, their context, what they're trying to achieve | An imagined user no one asked for |
| Behaviour | What the system does, in observable terms, incl. main + edge + error paths | A verb that's actually a HOW ("queries", "caches") |
| Acceptance criteria | Testable, binary checks that say "done" | Vague critera ("works well", "is fast") |
| Points to clarify | The typed handoff to `clarify` — see the four types below | An untyped list, or pretending there are none |

### Acceptance criteria carry the weight

Each criterion is a binary, observable statement — true or false, no judgement call — phrased so `verify` can later check it and `tasks` can derive a done-check from it. Prefer the **Given / When / Then** shape; it forces a concrete trigger and a concrete outcome.

```text
Given a signed-in user with an empty cart
When they open the checkout page
Then they see an empty-cart message and the "pay" button is disabled
```

A criterion that needs a human to "decide if it's good enough" is not done yet — sharpen it or move the soft part to *Points to clarify*.

### Points to clarify carry a type

*Points to clarify* is the handoff to `clarify`, and it holds four different objects that need four
different actions. An untyped list makes `clarify` treat all of them as questions, so it re-asks what
you already decided and touches what you deliberately deferred. Type every entry:

| Type | What it is | What `clarify` does with it |
| --- | --- | --- |
| **pregunta abierta** | Formulable with precision right now, unanswered | Asks it |
| **suposición tomada** | You decided it; the basis is written down | Validates it — does it still hold? |
| **decisión diferida** | Sharp, out of this cycle on purpose | Leaves it alone |
| **área no formulable** | Known to be coming, not yet sharp enough to phrase | Notes it; it graduates when it sharpens |

The test that separates the last two from a question is **sharpness, not difficulty**: *can you state
the question precisely now?* — not *can you answer it?* Sharp → **pregunta abierta**. Not sharp →
**área no formulable**. Beyond what this change is for → `Non-goals`, where it never graduates.

Write the type in bold at the head of the entry, and give a `suposición tomada` its basis:

```text
- **suposición tomada** — el enlace caduca en minutos, no en horas. *Base:* el patrón de los
  proveedores que ya usamos. *Riesgo:* si el soporte pide horas, el criterio de aceptación cambia.
```

An entry with no type is read as **pregunta abierta**, the costliest of the four. The default never
saves you work.

## The pass, end to end

Run these in order. It is a collaborative dialogue, not a form you fill in silence — and **you do not skip to a design dump.** Track the steps with a todo list so none is dropped.

```text
1. EXPLORE context        → profile + sdd config + constitution + existing specs + wiki + recent git
2. SCOPE check            → if the request is several independent subsystems, DECOMPOSE into sub-specs first,
                            then brainstorm the FIRST one; each gets its own spec → plan → build cycle
3. RESTATE in one sentence→ confirm you understood the intent before anything else
4. ASK the frontier       → only gaps that change the contract; whole frontier per round, numbered, each
                            with your recommendation; never cross a dependency; wait, record, recompute
5. PROPOSE 2-3 approaches → distinct directions with honest trade-offs; lead with your recommendation and why
6. PRESENT the design     → section by section (problem, users, behaviour, acceptance), scaled to complexity;
                            after EACH section ask "does this look right?" and adjust before moving on
7. WRITE the spec         → 02-DOCS/wiki/sdd/specs/<slug>.md (WHAT/WHY), index it in 02-DOCS/wiki/index.md
                            (the Knowledge map; root CLAUDE.md keeps only a short pointer), commit if a repo
8. SELF-REVIEW            → run the EXIT GATE (below) until green; scan for contradictions, ambiguity,
                            scope creep; fix inline. On L2/L3 or high risk, add a FRESH-EYES review
9. USER APPROVES          → ask them to read the written spec and confirm; loop on changes until they approve
10. HAND OFF              → only now, result envelope → clarify/plan. NEVER to implement.
```

**Steps 5-9 are the gate**, stated once under *Detect the moment* above and not restated here: approval at step 9 is what unlocks implementation.

`<slug>` is a short kebab-case name derived from the feature (e.g. `bulk-csv-import`, `magic-link-login`). If a spec with that slug exists, read it and update rather than overwrite.

### Exit gate — checked, not felt

"Complete enough to plan against" cannot tell done from not-done, and the write/review/approve steps
are visible while you are still asking, pulling attention toward being finished. So the bound is a
property of the **file**, not of your confidence:

> Every template section carries content or an explicit typed open point, and no section holds an
> unmarked assumption.

Run `npm run spec:gate <path>` on the spec you just wrote (no path: the whole corpus). It reports the
missing and the empty sections by name, and it prints what it does **not** check — the unmarked
assumption is yours to catch, because no parser can. A red gate means the spec is not closed: name
the section that failed and fix it before step 9.

A gate that has never been seen fail is not known to work, so this one ships with the test that
watches it fail and pass (`tests/spec-gate.test.js`).

### Fresh-eyes spec review (step 8, scaled to the dial)

The author's own context is blind to its own gaps — the same mind that wrote the spec self-reviews it
with the same blind spots. For an L2/L3 user or a **high-risk** spec (multi-subsystem, security/data,
irreversible, or large scope), dispatch a **fresh-context subagent** to read the written spec cold,
*before* the user-approval gate (step 9), and fold its findings in:

- **Hand it only the spec file** (and the constitution), not your dialogue or reasoning — a fresh
  reviewer that inherits your context inherits your blind spots.
- **Calibrated checklist:** placeholders/TODOs, internal contradictions, ambiguity that would stall
  planning, unstated assumptions, scope creep, and YAGNI (asked-for-but-unneeded). Tell it to *only
  flag issues that would cause a real problem at planning time* and to **approve unless there are
  serious gaps** — a fresh reviewer that nitpicks everything is as useless as no reviewer.
- **It returns** `Approved` or `Issues found` with a short list; you fix the real ones inline, then
  proceed to step 9.

**Skip it** for L0/L1 on a small, low-risk spec — the self-review scan is enough there; don't spin up
a subagent to vet a two-paragraph spec. Like the rest of the chain, ceremony scales to the stakes.

### Approval is its own exchange (step 9)

**An answer to a question is not an approval.** If you asked the user to decide something, they
answered *that question* and nothing else. Their answer is an **input** to the spec — and it
*changes* the spec, which means any approval you were holding before the question is the approval
of a document that no longer exists.

Questions and approval are two exchanges, in that order:

```text
ask → user answers → fold it in → say what changed → show the revised spec → ask for approval
```

- **The recommended-option shape is where this fails most easily.** When the user picks the option
  you recommended, the spec *looks* unchanged and consent *looks* implied. Neither is true — you
  proposed, they chose, the spec moved.
- **None of these are approval:** an answer to your question; a "go ahead" about some other step;
  silence; the request that started the task. If you cannot quote the words that approved **this**
  spec, you do not have approval.
- **Autopilot is still valid** — an up-front "run it all yourself" authorizes the whole run, and
  that is a real answer to a real question. What changes is the bookkeeping: record it as
  **approved in autopilot, not item by item**, in the spec's `status:`. The spec then becomes the
  artifact the user reviews *after the fact*, and the work claims correspondingly less certainty
  about having captured their intent. Writing "aprobada" flat, when what happened was a blanket
  go-ahead, is the record telling a small lie about the strongest gate in the chain.
- **Rejection is information — keep it.** If the user turns the spec down, revise it in place and
  append the reason to `## Revisions`. Never delete and start clean: what they rejected, and why,
  is the most useful thing in the file.

## Worked shape (abridged)

```markdown
# Spec — Magic-link login

## Problem & why
Password resets are the #1 support ticket and a sign-up drop-off point.
A passwordless email link removes the password entirely.

## Goals
- A user can sign in with only their email, via a one-time link.
- No password is ever stored or required.

## Non-goals / out of scope
- Social login (Google/Apple) — deferred.
- Replacing existing sessions for already-signed-in users.

## Users & context
A returning user on a new device who does not remember a password.

## Behaviour
- Main: user enters email → receives a link → following it signs them in.
- Edge: an expired link shows a "request a new link" path.
- Error: an unknown email reveals nothing (same response as a known one).

## Acceptance criteria
- Given a registered email, When the user requests a link and follows it within
  its validity window, Then they are signed in.
- Given an expired link, When it is followed, Then sign-in is refused and a new
  link can be requested.

## Points to clarify
- **pregunta abierta** — ¿cuánto vale la ventana de validez del enlace?
- **suposición tomada** — la ventana es corta, en minutos. *Base:* el patrón de los proveedores que
  ya usamos. *Riesgo:* si soporte pide horas, cambia el criterio de aceptación.
- **decisión diferida** — límite de peticiones por email; fuera de este ciclo.
- **área no formulable** — qué pasa con las cuentas compartidas; sospecho que hay una pregunta y
  todavía no sé enunciarla.
```

Note what is *absent*: no token format, no table, no email provider, no framework. Those are `plan`'s job.

## Optional proposal / pre-execution briefing

For a tiny feature, skip this. For ambiguous, architectural, high-risk, high-review-cost or research-heavy work, write a proposal before the spec:

```text
02-DOCS/wiki/sdd/proposals/<slug>.md
```

Proposal grammar:

```markdown
# Proposal — <slug>

## Problem
## Intent
## Scope / Non-scope
## Research input
## Alternatives considered
## Tradeoffs
## Risks
## Rollback
## Success criteria
## Recommendation
```

The proposal is allowed to mention options and tradeoffs; the spec that follows still stays WHAT/WHY. If research came from a transcript, doc, spike, or external briefing, cite it in `Research input` so the decision trail survives the chat.

## Anti-patterns → STOP

Only failures with no positive statement elsewhere in this skill. The rules about the frontier, the
constitution, the 2-3 approaches, the gate, and answer-is-not-approval are stated positively above
(§Questioning discipline, §Detect the moment, the pass, §Approval is its own exchange) and are not
repeated here as prohibitions: naming a behaviour makes it more available, not less.

| If you're about to… | Reality / Fix |
| --- | --- |
| Name a framework, table, endpoint, or library | That's HOW. Strip it; describe the behaviour instead, or log the open question. |
| Write "it should work well / be fast / be intuitive" | Not testable. Make it a binary Given/When/Then or move it to Points to clarify. |
| Hand to `plan`/`implement` before the user approved the written spec | The approval at step 9 is the gate. No design approved → nothing gets built. |
| Skip non-goals because "it's obvious" | Unsaid scope becomes assumed scope. State what you are *not* doing. |
| Resolve every ambiguity yourself to look finished | Inventing answers is worse than naming gaps. List them in Points to clarify. |
| Start designing the solution because it's clearer | Stay on WHAT/WHY. The plan is a later, separate phase. |
| Write the spec somewhere other than 02-DOCS/wiki/sdd/specs/ | That's the canonical location the rest of the chain reads. Use it. |

## Project grounding (02-DOCS + CLAUDE.md)

- Read `02-DOCS/wiki/sdd/config.yaml` if present. If it is missing and the change is non-trivial, recommend `sdd-init` before proceeding; if the user asks to continue, record the missing config as a risk.
- Read `02-DOCS/wiki/sdd/constitution.md` first — its principles are inherited constraints, not things to re-decide. If it's missing, note that the project has no constitution yet and suggest the `constitution` phase before continuing (you can still draft a spec, but flag the absence).
- **No constitution yet?** Still write the spec, but inherit nothing — lean harder on the wiki and the user's answers, and record every constraint you would have inherited as a *point to clarify* instead of assuming it.
- Write the spec to `02-DOCS/wiki/sdd/specs/<slug>.md`. Create the directory if absent.
- Add a row in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) linking the new spec under the `sdd/specs` topic (additive only — never delete existing rows). Create the index if absent.
- Log the spec's creation and any significant scoping decision to `02-DOCS/wiki/sdd/decisions.md` (append-only), so the chain keeps a trace of why scope landed where it did. This is the canonical SDD decisions log shared with `constitution` and `plan` — not the harness's own `02-DOCS/wiki/harness/decisions.md`.

## Result envelope

End with:

```json result-envelope
{
  "status": "complete",
  "executive_summary": "Spec written with open points ready for clarify.",
  "artifact": "02-DOCS/wiki/sdd/specs/<slug>.md",
  "next_recommended": "clarify",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["specify"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Keep specs WHAT/WHY only.", "Acceptance criteria must be observable."]
  },
  "evidence": ["spec path exists", "proposal path if used", "open points listed"]
}
```

## Next in the chain

A spec is the input to **`clarify`**, not the finish line. End by pointing there:

> "Spec written to `02-DOCS/wiki/sdd/specs/<slug>.md` with N open points. Next: run **`clarify`** to resolve them and de-risk the spec before planning."

If `clarify` surfaces answers, they get baked back into this same spec file. Only once the spec is de-risked does `plan` derive the technical approach.

## See Also

- `../constitution/SKILL.md` — the project principles this spec inherits as constraints.
- `../clarify/SKILL.md` — the next phase: resolves the Points to clarify and de-risks the spec.
- `../plan/SKILL.md` — turns the de-risked spec into a technical implementation plan (the HOW).
- `../harness/SKILL.md` — the 02-DOCS wiki + accompaniment dial + decisions log this skill honors.
- `references/spec-template.md` — the exact section template written to `02-DOCS/wiki/sdd/specs/<slug>.md`.
- `references/eliciting-requirements.md` — inference checklist + the frontier-round elicitation pattern.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

