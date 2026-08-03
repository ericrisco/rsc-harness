---
name: clarify
description: "Use when a spec exists and must be de-risked before planning — hunt its ambiguities, unstated assumptions and edge cases, ask the few build-changing questions, bake the answers back into the spec. The rsc SDD gate between `specify` (writes the spec) and `plan` (designs the build). NOT the cross-artifact consistency check (that is `analyze`)."
tags: [sdd, clarify, questions]
recommends: [plan]
profiles: [core, full]
origin: risco
---

# Clarify — the de-risking gate before planning

A spec written in one sitting always lies a little. It states what the author *thought of*, and stays silent on everything they didn't — the edge cases, the unstated defaults, the words that mean two things. Those silences don't disappear; they get discovered later, mid-implementation, where they cost ten times as much to fix. **Clarify is the gate that drags those silences into the open while they are still cheap.**

This is the fourth phase of the rsc SDD chain (`constitution` → `specify` → **`clarify`** → `plan` → `tasks` → `analyze` → `implement` → `verify` → `review` → `ship`); the method itself lives in `../sdd/SKILL.md`. `specify` turned a fuzzy intent into a spec; clarify interrogates that spec, asks the user the questions that actually change the build, and writes the answers back so the spec becomes safe to plan from. It produces **no new artifact** — it sharpens the existing one in place. The line is **specify creates, clarify de-risks, plan designs**: if you find yourself proposing how to *build* it, you have left clarify.

**Model tier: `balanced`** — this phase ranks and asks the few high-leverage questions, it does not design architecture. Resolve and apply it per `../sdd/references/model-routing.md`; routing is off unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`.

**Accompaniment dial.** Read the level from `02-DOCS/wiki/harness/user-profile.md` (the dial and the `02-DOCS/wiki/` convention are owned by `../harness/SKILL.md`). Clarify is question-heavy, so the dial matters here more than almost anywhere — it sets **how many questions you ask and how you frame them**. With no profile: default to non-technical framing, ask the two gauging questions (technical level + accompaniment) first, then proceed at the stated level.

| Dial | Ask |
| --- | --- |
| **L0** "cavernícola" | ONLY the questions whose answer changes the architecture or scope. Propose safe defaults for everything else and list them tersely as "assumed unless you object". Minimal prose. |
| **L1** "breve" | The high-leverage batch, one line of *why* per question. |
| **L2** "explica decisiones" | The batch plus the trade-off behind each option, so the user chooses informed. |
| **L3** "acompañamiento total" | Walk the taxonomy out loud, explain what each kind of gap costs if left unresolved, ask broadly (including the medium-leverage questions), and teach the *why* as you go. Ideal for non-technical users who benefit from seeing the hidden decisions. |

## Read first — the inputs

Clarify never works blind. Before asking a single question, load three things:

1. **The spec.** Read the target spec under `02-DOCS/wiki/sdd/specs/<slug>.md` end to end. If the path wasn't given, find the most recently touched spec or ask which one.
2. **The constitution.** Read `02-DOCS/wiki/sdd/constitution.md` if it exists. Its principles (stack canon, quality bars, conventions) resolve a surprising number of "ambiguities" without bothering the user — if the constitution already fixes the auth method or the data region, that's answered, not open.
3. **The harness profile.** `02-DOCS/wiki/harness/user-profile.md`, for the dial above.

Citing what you read ("checked the constitution — auth is already fixed to OAuth, so that's not an open question") shows your work and prevents re-litigating settled decisions.

## The ambiguity taxonomy — where specs hide their gaps

Scan the spec against these categories. Most real gaps fall into one of them; walking the list is how you find the ones the author didn't think to write down.

| Category | What to hunt | Tell-tale phrasing in the spec |
| --- | --- | --- |
| **Underspecified behavior** | A described feature with a missing branch — what happens in the *other* case | "the user logs in" (and if it fails? locked out? wrong password vs no account?) |
| **Unstated assumptions** | Defaults the author assumed everyone shares | no mention of auth, tenancy, currency, timezone, locale |
| **Edge & boundary cases** | Empty, zero, max, duplicate, concurrent, first-run, offline | lists with no empty-state, counts with no upper bound |
| **Ambiguous terms** | A word doing two jobs | "user" (end-user or admin?), "delete" (soft or hard?), "fast" (how fast?) |
| **Missing acceptance criteria** | A goal with no observable done-condition | "should be performant", "easy to use", "handle errors gracefully" |
| **Scope edges** | What's explicitly OUT vs left dangling | features hinted at but never bounded — "for now", "eventually" |
| **Data & state** | Lifecycle, ownership, retention, migration of existing data | new entity with no story for what happens to old records |
| **Failure & recovery** | What happens when a dependency is down, a write half-completes, input is hostile | happy-path-only flows |
| **Non-functional** | Performance, scale, security, accessibility, i18n targets | vague "non-functional requirements" or none at all |
| **Actors & permissions** | Who can do each thing | a verb with no subject — "can be edited" (by whom?) |

You are not filling every cell for every spec. You are scanning all ten so the gaps that *do* exist surface instead of hiding.

## The pass — five steps

Run in order. The discipline is: find many candidate gaps, keep only the ones that change the build, ask those well, write the answers back.

1. **Inventory.** Walk the spec against the taxonomy above. Produce a raw list of every candidate ambiguity, edge case, and unstated assumption. Over-collect here; you'll prune next. Note for each which category it is and where in the spec it lives.

2. **Resolve what you already can.** For each candidate, check the constitution and the spec's own later sections before asking the user. Many "gaps" are answered elsewhere. Mark each candidate **resolved-internally** (cite the source), **inferable** (a safe default you'll propose, not silently assume), or **must-ask** (only the user can decide).

3. **Rank by leverage.** Sort the must-ask list by impact: how much does the build change depending on the answer? A question whose two answers lead to two different architectures ranks above a cosmetic one. Cut low-leverage questions — clarify is not an interrogation, it's the *few* questions that matter. Cap the batch to the dial.

4. **Ask — one focused batch, sized to the dial.** How you ask determines whether you get a usable answer:
   - **Make it a decision, not an essay prompt.** "Should deletes be soft (recoverable, hidden) or hard (gone immediately)? I'd recommend soft because the spec mentions an audit trail — confirm?" beats "How should deletion work?".
   - **Carry your own recommendation** when there's a defensible default, matched to the constitution. The user confirms or overrides — far less effort than authoring from scratch.
   - **Quote the spec.** Anchor each question to the exact line or section it came from, so the user sees *why* it's open.
   - **One batch, ranked, then stop.** Don't drip questions one at a time over many turns unless the dial is L3; don't dump thirty at once. Then wait: never ask and answer in the same breath, and never assume the user's intent on a must-ask item.

5. **Bake the answers back into the spec.** This is the deliverable — an un-baked answer is a lost answer. For each resolved item, edit the spec in place:
   - Tighten the relevant section with the decided behavior.
   - Add or sharpen acceptance criteria so the decision is now observable.
   - Append a `## Clarifications` log to the spec: dated entries of `Q → decision → why`, so the *reasoning* survives, not just the result.
   - Move anything explicitly dropped into an `## Out of scope` section so it's bounded, not dangling.

   Then re-read the spec once more: did resolving one gap open a new one? If so, one more short loop. Otherwise, the gate is passed.

## Worked micro-example

Spec line: *"Users can upload a profile photo."*

Clarify's inventory against the taxonomy:

```text
- Ambiguous term  : "photo" — which formats? (PNG/JPG/HEIC/SVG?)
- Boundary        : max file size? max dimensions? what if it's 50 MB?
- Edge case       : no photo uploaded — is there a default/placeholder?
- Failure         : upload fails mid-transfer — retry, or lose it?
- Data lifecycle  : replacing a photo — is the old file deleted or orphaned?
- Actors          : can an admin change another user's photo?
- Non-functional  : is the image resized/compressed server-side? stored where?
- Security        : is the file type validated, or can someone upload an .svg with script?
```

Resolved-internally (cite): constitution fixes storage to the project's object store → "stored where" is answered. Must-ask, ranked: formats + max size (changes validation and UX), security validation (changes the upload path), old-file deletion (changes data model). Cosmetic placeholder choice → propose a default, don't burn a question on it.

After baking back, the spec line becomes a bounded, testable behavior with acceptance criteria ("rejects files >5 MB with a clear message", "accepts PNG/JPG/HEIC only", "replacing a photo deletes the prior file") and a `## Clarifications` entry recording why.

## Anti-patterns

| Anti-pattern | Why it breaks the gate / do instead |
| --- | --- |
| Skipping clarify because the spec "reads clear enough" | Clear to the author ≠ unambiguous. Run the taxonomy; the gaps you can't see are exactly the expensive ones. |
| Assuming the sensible default and moving on | An assumption is an unrecorded decision. Either it's resolvable from the constitution (cite it) or it's a must-ask. Silent defaults resurface as bugs — and "the user is busy" is not an exception; a wrong guess costs more than a one-tap question. |
| Sketching how you'd build it while you're in there | That's `plan`. Clarify decides *what*, not *how*. Proposing architecture means you left the gate. |
| Asking everything you can think of, to be safe | Thirty questions is noise that buries the three that matter. Rank by leverage, ask the few, default the rest — and batch them once instead of dripping one per turn. |
| Answering the questions in your head and leaving the spec as-is | The deliverable is the *edited spec* plus the Clarifications log, not a clean conscience. |
| Leaving edge cases "to the implementer" | Edge cases are *spec* problems. Resolving them now is the whole point of the gate. |

## Exit gate

The gate is passed when the spec, constitution and profile were all read (settled questions cited, not re-asked); all ten taxonomy categories were considered; only the build-changing gaps were put to the user, as dial-sized decisions with recommendations; every answer is baked into the spec body with observable acceptance criteria, logged under `## Clarifications` and bounded under `## Out of scope`; and the final re-read opened no new gap.

## Result envelope

End with the parseable block every SDD phase shares, so the dispatcher can chain without
interpreting prose (contract: `../sdd/SKILL.md`):

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "Open points resolved; the spec is de-risked and ready to plan against.",
  "artifact": "02-DOCS/wiki/sdd/specs/<slug>.md",
  "next_recommended": "plan",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["clarify"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Ask only what changes the spec.", "An unanswered question is recorded, never invented."]
  },
  "evidence": ["answers folded back into the spec", "remaining open points listed with their owner"]
}
```

## Next in the chain

Hand off to **`plan`** — turn the now-sharp spec into a technical implementation plan (architecture, interfaces, data flow, testing strategy, risks), deferring stack specifics to the relevant stack skill. The chain continues: clarify → **plan** → tasks → analyze → implement → verify → review → ship. `debug` is callable any time if what you are "clarifying" turns out to be a runtime fault, not a spec gap.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
