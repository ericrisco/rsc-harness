---
name: clarify
description: "Use when a spec exists and must be de-risked before planning — run the gap checklist over its four ASDD questions and out-of-scope, ask only what changes what gets built (one question at a time, recommendation first), record every other call as an assumption, bake the answers back into the spec. The second half of ASDD stage 2 (Spec), between `specify` (writes the spec) and `plan` (designs the build). NOT the cross-artifact consistency check (that is `analyze`)."
tags: [sdd, clarify, questions]
recommends: [plan]
profiles: [core, full]
origin: risco
---

# Clarify — the de-risking gate before planning

A spec written in one sitting always lies a little. It states what the author *thought of*, and stays silent on everything they didn't — the edge cases, the unstated defaults, the words that mean two things. Those silences don't disappear; they get discovered later, mid-implementation, where they cost ten times as much to fix. **Clarify is the gate that drags those silences into the open while they are still cheap.**

This is the second half of ASDD stage 2, **Spec** (`../asdd/SKILL.md`): `specify` drafts → **`clarify`** hunts the gaps → answers go into the spec → the human approves. It produces **no new artifact** — it sharpens the existing spec in place. The line is **specify creates, clarify de-risks, plan designs**: if you find yourself proposing how to *build* it, you have left clarify.

**Model tier: `balanced`** — this phase finds and asks the few questions that matter, it does not design architecture. Resolve and apply it per `../asdd/references/model-routing.md`; routing is off unless `models.enabled: true` in `02-DOCS/wiki/sdd/config.yaml`.

**Register.** Read `technical_level` from `02-DOCS/wiki/harness/user-profile.md` (the `02-DOCS/wiki/` convention is owned by `../harness/SKILL.md`). Clarify is question-heavy, so the voice matters here more than almost anywhere. Each question carries one line of *why* and the trade-off behind each option, in the `orient` voice. For a `non-technical` reader, frame each option with an everyday analogy. With no profile: use analogies and ask once "technical or with analogies?".

## Read first — the inputs

Clarify never works blind. Before asking a single question, load:

1. **The spec.** Read the target spec under `02-DOCS/wiki/sdd/specs/<slug>.md` end to end. If the path wasn't given, find the most recently touched spec or ask which one. Its *Points to clarify* is a **typed** handoff, not a question list — read the types before you plan a single question (below).
2. **The constitution.** Read `02-DOCS/wiki/sdd/constitution.md` if it exists. Its principles (stack canon, quality bars, conventions) resolve a surprising number of "ambiguities" without bothering the user — if the constitution already fixes the auth method or the data region, that's answered, not open.
3. **What was already decided.** The project's brain if it has one; otherwise `02-DOCS/wiki/sdd/decisions.md` and the sibling specs. *What it must respect* is checked against these, not against memory.
4. **The harness profile.** `02-DOCS/wiki/harness/user-profile.md`, for the register above.

Citing what you read ("checked the constitution — auth is already fixed to OAuth, so that's not an open question") shows your work and prevents re-litigating settled decisions.

## The typed handoff — what `specify` already decided

*Points to clarify* holds four different objects, and each one gets a different action from you.
Treating all four as questions is how clarify re-asks what was already decided and disturbs what was
deliberately deferred:

| Type in the spec | What it means | Your action |
| --- | --- | --- |
| **pregunta abierta** | Formulable, unanswered | Ask it — this is your queue |
| **suposición tomada** | `specify` (or you) decided it; the basis is written | **Validate**, don't re-ask: state the assumption and its basis back, and ask only whether it still holds |
| **decisión diferida** | Sharp, out of this cycle on purpose | Leave it. Do not reopen scope the author closed |
| **área no formulable** | Known to be coming, not yet phrasable | Note it. If your pass sharpens it into a real question, it graduates — say that it did |

**Declare what you did with each entry.** Close the pass with one line per point: asked, validated
(held / broke), left deferred, or graduated. An entry you silently dropped is the gap that comes back
at implementation time.

**An untyped entry** (an older spec, or a hurried one) is read as **pregunta abierta** — the
costliest reading, so nothing gets skipped by accident. Type it as you go, so the spec improves on
the way through.

Sharpness, not difficulty, is what separates a question from an unformulable area: *can you state it
precisely now?* Not *can you answer it?*

## The gap checklist — where specs hide their gaps

Walk the spec's four ASDD questions and its out-of-scope against this **gap checklist**, one row at a time. Most real gaps sit in one of these cells; walking every row is how you find the ones the author didn't think to write down.

| Spec section | Hunt for |
| --- | --- |
| **What the user can do** | Who can and who can't (a verb with no subject — "can be edited", by whom?); what happens if the starting conditions fail; ambiguous terms ("user": end-user or admin?) |
| **What result they get** | Is there an approved reference (screenshot, sketch, expected response) — or only the agent's own judgement? Empty, error and loading states; boundaries (zero, max, duplicate, concurrent, first run) |
| **What it must respect** | Does it contradict a recorded decision or spec? What current behaviour must not break? Data already there (lifecycle, ownership, migration); security, accessibility, performance floors |
| **How it proves it** | Any criterion that cannot be checked ("fast", "easy", "handles errors gracefully"); what evidence remains after the check runs |
| **Out of scope** | Anything the agent might add "just in case" — a feature nobody asked for; hints left dangling ("for now", "eventually") |

On an older spec without the four sections, walk the same rows against *Behaviour* and *Acceptance criteria*.

## The pass — five steps

Run in order. The discipline is: find many candidate gaps, keep only the ones that change the build, ask those well, write the answers back.

1. **Inventory.** Walk the spec against the gap checklist. Produce a raw list of every candidate gap. Over-collect here; you'll prune next. Note for each its row and where in the spec it lives.

2. **Resolve what you already can.** Check each candidate against the constitution, the decisions and the spec's own later sections before asking. Many "gaps" are answered elsewhere — cite the source.

3. **Filter.** Ask only if the answer **changes what gets built**: two answers that lead to the same build are not a question. Everything that fails the filter, pick the most reasonable option yourself and record it in the spec's *Points to clarify* as a **suposición tomada**, with its basis — so the human sees every assumption in one block at approval instead of discovering them in the code. A silent default is an unrecorded decision; a recorded one is a cheap thing to veto.

4. **Ask — one question at a time, recommendation first.** Most important first. Each question is a decision, not an essay prompt, and leads with the answer you recommend so a "yes" suffices: "I'd make deletes soft (recoverable, hidden), because the spec mentions an audit trail — OK?" beats "How should deletion work?". Quote the spec line it came from. Wait for the answer, fold it in, then decide whether the next question still passes the filter — an answer often settles the next one. Never ask and answer in the same breath.

5. **Bake the answers back into the spec.** This is the deliverable — an un-baked answer is a lost answer. For each resolved item, edit the spec in place:
   - Tighten the relevant section with the decided behaviour.
   - Add or sharpen acceptance criteria so the decision is now observable.
   - Append a `## Clarifications` log to the spec: dated entries of `Q → decision → why`, so the *reasoning* survives, not just the result.
   - Move anything explicitly dropped into *Non-goals / out of scope* so it's bounded, not dangling.

   Then re-read the spec once more: did resolving one gap open a new one? If so, one more short loop. Otherwise, hand it to the human for approval.

## In autopilot — nobody to ask

Under an up-front autopilot yes there is no one to answer, so step 4 changes: **every question that
would have been asked is recorded instead** as a **suposición tomada** in the spec (your recommended
answer, its basis, the spec line it came from) and mirrored as a `review-after` entry in the
**decision queue** (`## Decision queue` in `02-DOCS/wiki/sdd/progress/<slug>.md`; create it if
absent). The run continues; the human reviews these afterwards and nothing waits on them. Only a gap
that would make the build **unsafe**, or whose answer would **contradict a recorded decision**, is a
`blocking` entry — and only `blocking` stops the branch from merging itself. Never ask and wait in
autopilot; never stay silent about what you assumed.

## Late gaps — found during implementation

A gap nobody saw until `implement` is running does not stop the run. It goes to the **decision queue** of `implement`'s per-task loop (`../implement/SKILL.md`): the task that needs the answer is parked, independent tasks continue, and when the human answers, the answer is written back into this spec (and its `## Clarifications` log) so the spec stays the contract.

## Worked micro-example

Spec line: *"Users can upload a profile photo."*

Inventory against the gap checklist:

```text
- Can do      : can an admin change another user's photo? what if the user is signed out?
- Result      : which formats? max size? no photo yet — placeholder? upload fails midway — retry?
- Respect     : replacing a photo — old file deleted or orphaned? decisions log fixes storage
- Proves it   : "accepts photos" cannot be checked — which file proves rejection of a 50 MB one?
- Out of scope: cropping and filters — an agent could add them "just in case"
```

Resolved (cited): the decisions log fixes storage. Changes what gets built, asked one at a time: formats + max size, then old-file deletion. Fails the filter: placeholder image → **suposición tomada** (generic avatar). Cropping → *Out of scope*.

After baking back, the spec line becomes a bounded, testable behaviour ("rejects files >5 MB with a clear message", "accepts PNG/JPG/HEIC only", "replacing a photo deletes the prior file") with a `## Clarifications` entry recording why.

## Anti-patterns

| Anti-pattern | Why it breaks the gate / do instead |
| --- | --- |
| Skipping clarify because the spec "reads clear enough" | Clear to the author ≠ unambiguous. Walk the checklist; the gaps you can't see are exactly the expensive ones. |
| Assuming a default and not writing it down | An unrecorded default resurfaces as a bug. Record it as **suposición tomada** with its basis, so the human vetoes it at approval. |
| Sketching how you'd build it while you're in there | That's `plan`. Clarify decides *what*, not *how*. Proposing architecture means you left the gate. |
| Asking everything you can think of, to be safe | Thirty questions bury the three that matter. Only what changes what gets built is asked; the rest is assumed and listed. |
| Answering the questions in your head and leaving the spec as-is | The deliverable is the *edited spec* plus the Clarifications log, not a clean conscience. |
| Leaving edge cases "to the implementer" | Edge cases are *spec* problems. Resolving them now is the whole point of the gate. |

## Exit gate

The gate is passed when the spec, constitution, prior decisions and profile were all read (settled questions cited, not re-asked); **every typed point in the handoff has its declared outcome** (asked / validated / left deferred / graduated), with nothing silently dropped; every gap checklist row was walked; only questions that change what gets built were asked, one at a time with a recommendation (in autopilot: recorded as assumptions with their `review-after` / `blocking` queue entries); every other call is a **suposición tomada** in the spec; every answer is baked into the spec body with observable acceptance criteria, logged under `## Clarifications` and bounded under out of scope; and the final re-read opened no new gap.

## Result envelope

End with the parseable block every SDD phase shares, so the dispatcher can chain without
interpreting prose (contract: `../asdd/SKILL.md`):

```json result-envelope
{
  "status": "complete|blocked|failed",
  "executive_summary": "Open points resolved; the spec is de-risked and ready for approval and plan.",
  "artifact": "02-DOCS/wiki/sdd/specs/<slug>.md",
  "next_recommended": "plan",
  "risk": "low|medium|high",
  "skill_resolution": {
    "used": ["clarify"],
    "missing": [],
    "fallback": [],
    "compact_rules": ["Ask only what changes what gets built.", "Every other call is a recorded suposición tomada."]
  },
  "evidence": ["answers folded back into the spec", "assumptions listed as suposición tomada", "remaining open points listed with their owner"]
}
```

## Next in the chain

Stage 2 closes when the human approves the spec (or the up-front autopilot yes covers it). Then hand off to **`plan`**, ASDD stage 3 (`plan` + `tasks` + `analyze`) — turn the now-sharp spec into a technical plan, deferring stack specifics to the relevant stack skill. `debug` is callable any time if what you are "clarifying" turns out to be a runtime fault, not a spec gap.

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
