---
name: course-storytelling
description: "Use when you have course / lesson / module content and you need the teaching to LAND — so grounded, named, and emotionally resonant that the student loves the teacher. Ingests slides/transcripts/notes/outline, extracts the concepts AND the existing narrative spine, finds the abstract/jargon-heavy/ungrounded gaps, then reframes each concept with Russell Brunson's Expert Secrets methodology (Epiphany Bridge, the three false beliefs, the Big Domino, named mental models, story-selling, grounding analogies, future-pacing). Profiles the LEARNER and AUDIENCE first (hard gate). Outputs a per-concept 'landing recipe' and a reworked narrative spine. Triggers: 'make this lesson land', 'teach this concept', 'storytelling for my course', 'expert secrets', 'epiphany bridge', 'mental models for teaching', 'this lesson is too abstract', 'my students aren't getting it', 'name this concept'. NOT slide visuals (that's `presentations`/`design`) and NOT a content-audit/review pass (run review-content first, bring findings here)."
tags: [course, teaching, storytelling, content]
recommends: [presentations]
origin: risco
---

# Course Storytelling — Make the Teaching Land

*Take a concept the student would forget and turn it into one they can't unhear. Profile the learner first, then run every concept through the Expert Secrets machine: epiphany story → named model → grounded analogy → proof → do-this-now → the so-what.*

This skill owns **the teaching narrative**: extracting what a course actually teaches, finding where it stays abstract, and rebuilding each concept so the realization happens *in the student*, emotionally, not just on the slide. It borrows Russell Brunson's *Expert Secrets* frameworks as a **teaching methodology** (this is method, not text reproduction). The sibling `presentations` skill turns the result into a deck; `marketing` owns sales words; `design` owns pixels; a content-audit/review-content pass audits an existing lesson for gaps before you bring it here.

## When to use / When NOT to use

Use when:

- You have lesson/module/course material (slides, transcript, notes, outline) and the teaching feels flat, abstract, or forgettable.
- A concept is technically correct but "doesn't click" — students nod and forget.
- You want a sticky, ownable name + a grounded analogy + a story for an idea.
- You're sequencing a course and need a belief-building narrative spine, not just a topic list.
- You want the student to *feel* the epiphany the expert felt, so they trust the teacher.

Do NOT use when (delegate or decline):

- Designing the slide visuals, layout, or exporting a deck → `presentations` (+ `design` for the visual system).
- Writing sales/landing copy for the course → `marketing`.
- Auditing an existing lesson for gaps/redundancy/anachronisms with a written report → a content-audit/review-content pass (run it first; bring its findings here).
- Pure fact-checking or research of the subject matter → `deep-research`.

**Teaching ≠ selling.** Brunson's frameworks here serve comprehension and retention. The "sale" you're closing is *belief in the idea and trust in the teacher* — never bolt a pitch onto a lesson.

## Learner grounding (read this first)

**Hard rule: never reframe or rewrite teaching without a complete learner + audience profile.** Teaching into a void defaults to your AI-median explainer voice — abstract, jargon-true, emotionally dead. The cure is grounding every concept in a real, persisted profile of *who is learning and what must change in them*. An incomplete profile is a hard STOP, not a warning.

Run this gate before reframing a single concept:

1. **Locate the teaching profile.** Read the project's root `CLAUDE.md` and follow its short `## Knowledge map` pointer to the full index at `02-DOCS/wiki/index.md`, looking for the entry into `02-DOCS/wiki/teaching/` (the `harness` Karpathy-wiki convention: compiled profile articles live under `02-DOCS/wiki/teaching/`, raw inputs the user pastes live under `02-DOCS/raw/teaching/`). If `CLAUDE.md` is absent, the index entry is missing, or it points nowhere, treat the profile as ABSENT.

2. **Check completeness** against the checklist in `references/learner-grounding.md`. The profile is complete only when every dimension is filled: the LEARNER (level, prior knowledge, pains, desires, current false beliefs, what they want to DO after); the AUDIENCE (same as the buyer or not? live vs recorded? size? context?); the target TRANSFORMATION (the one result, before→after); and constraints/format. **Any empty dimension = INCOMPLETE.**

3. **If ABSENT or INCOMPLETE, STOP and interview the user.** Ask the question script from `references/learner-grounding.md`, **one focused batch at a time** (do not dump all questions at once; ask, wait, persist, then continue). Then:
   - **a.** Write/update the profile into `02-DOCS/wiki/teaching/` as wiki articles (`learner.md`, `audience.md`, `transformation.md`, `false-beliefs.md`, `constraints.md`, plus an `index.md`), following the article format in `references/learner-grounding.md`. Save any raw material the user pastes (transcripts, outlines, existing slides) verbatim into `02-DOCS/raw/teaching/` and link it from the article's `> Raw:` line. Create the directories if they do not exist.
   - **b.** Index the teaching profile in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer). Ensure root `CLAUDE.md` carries that short pointer to the index, creating `CLAUDE.md` if absent (additive only — never delete existing sections). The exact snippet is in `references/learner-grounding.md`.

4. **Only once the profile exists and is complete, proceed.** Cite which articles you used (e.g. "grounded in `02-DOCS/wiki/teaching/learner.md` and `false-beliefs.md`") so every reframing is traceable to a real learner, not an imagined one.

If the user explicitly says "skip the profile, just rough one concept", you may produce a clearly-labelled `DRAFT (ungrounded — not learner-checked)` and still recommend running the gate before anything ships. That is the only exception, and it must be labelled.

Full completeness checklist, the exact batched question script, and the persistence format → `references/learner-grounding.md`.

## The non-negotiables

These are constraints, not preferences. Violating any one is a defect.

1. **Learner profile first.** No reframing before the grounding gate passes (above). Cite the articles you used.
2. **Every concept gets a story.** A concept taught without a story is a fact the student will forget. Each concept carries at least one Epiphany Bridge beat. (→ `references/brunson-frameworks.md`)
3. **Every concept gets a name.** An unnamed idea can't be repeated, so it can't be retained. Give each concept a short, ownable, sticky label the student can say out loud. (→ `references/mental-models.md`)
4. **Every abstraction gets grounded.** No abstract claim ships without a concrete analogy from the learner's own world. "Abstract with no analogy" is a defect. (→ `references/mental-models.md`)
5. **Break the false belief before installing the new one.** Find the learner's current false belief (vehicle / internal / external), shatter it with a story, *then* teach. Teaching on top of an unbroken false belief bounces off. (→ `references/brunson-frameworks.md`)
6. **The realization happens in the student.** Tell the epiphany as a journey, don't state the conclusion. The student should *arrive* at the insight, feeling it, not be handed it.
7. **One Big Domino per module.** Name the single belief that, once believed, makes the rest fall. Build the module to knock it over. (→ `references/brunson-frameworks.md`)
8. **End every concept on the so-what.** The payoff the student future-paces: what's now possible, what they can do tomorrow. A concept with no so-what is trivia.
9. **Ground in the learner, not in the expert.** Explain it in the student's world and vocabulary, not the discipline's. Jargon density is a flagged defect. (→ `references/mental-models.md`)
10. **No fabricated proof or invented credentials.** Stories must be true. If you need a demo/result/proof the user hasn't supplied, mark `[[NEEDS PROOF]]` and ask — never invent a case study or a metric.

## The teaching workflow (one pass)

Run in order. Each step feeds the next; skipping one shows up as a flat lesson downstream.

1. **Ground.** Pass the learner-grounding gate. Load learner, audience, transformation, false beliefs, constraints from `02-DOCS/wiki/teaching/`.
2. **Analyze the content.** Ingest the material; extract the concept list AND the *existing* narrative spine; map ungrounded / jargon-heavy / story-less gaps. → `references/course-analysis.md`.
3. **Set the Big Domino.** For the module, name the one belief that makes everything else fall, and sequence concepts to build toward it. → `references/brunson-frameworks.md`, `references/course-analysis.md`.
4. **Per concept, find the false belief** the learner holds (vehicle / internal / external) and the epiphany that breaks it. → `references/brunson-frameworks.md`.
5. **Run the landing recipe** for each concept: hook → epiphany-bridge story → named mental model → grounded analogy → proof/demo → application (do-this-now) → so-what. → `references/concept-landing-recipe.md`.
6. **Name the models.** Engineer a sticky, ownable name + a concrete analogy for each. → `references/mental-models.md`.
7. **Rewrite the narrative spine.** Resequence the whole module/course as a belief-building arc (the Hero's Two Journeys), not a topic dump. → `references/brunson-frameworks.md`, `references/course-analysis.md`.
8. **Run the QA gate** (below) and `scripts/verify.sh`. Fix every flag or justify it.

## The Expert Secrets toolkit (applied to teaching)

These are the frameworks you run each concept through. Full templates, scripts, and worked teaching examples → `references/brunson-frameworks.md`. Source-confirmed sequence and naming via Brunson's *Expert Secrets* (see citations in that reference).

- **The Epiphany Bridge.** Tell the story of how *you* (or a relatable character) first realized this — so the student feels the same realization rather than being told the conclusion. Beats: **backstory → the desire → the wall (the struggle) → the epiphany (the "aha") → the new opportunity → the result/transformation.** Emotion first, mechanics second.
- **The three false beliefs.** Before a student adopts a concept they must drop the belief blocking it. There are exactly three kinds, each broken by its own epiphany story:
  - **Vehicle** — "this approach/tool/method won't work (for this)."
  - **Internal** — "even if it works, *I* can't do it."
  - **External** — "even if I can, something outside me (time, boss, budget, the system) will stop me."
- **The Big Domino.** The single belief that, if installed, makes every downstream concept fall on its own. Name it per module; aim the whole arc at knocking it over.
- **Named mental models.** Every concept gets a short, ownable name + a concrete analogy so the student can carry it, repeat it, and reuse it. (→ `references/mental-models.md`)
- **The Hero's Two Journeys.** The *outer* journey (the skill/result) runs alongside the *inner* journey (the identity shift). Teach both; the inner journey is what makes them love the teacher.
- **The Attractive Character.** The teacher persona that earns trust: a relatable backstory, admitted flaws, parables, and polarity (a clear point of view). Students bond to a character, not a curriculum.
- **Story-selling, grounded.** Ground abstractions to earth with concrete analogies/metaphors from the learner's world, "explain it like their day", and future-pacing so the idea becomes tangible enough to click emotionally.

## Analyze the course content

Before reframing, you must *see* what's there. Ingest the material and produce three artifacts. Full method, extraction prompts, and the gap-map template → `references/course-analysis.md`.

1. **Concept inventory** — every distinct idea the material teaches, in teaching order, with a one-line "what the student should be able to DO after this".
2. **Existing narrative spine** — the story/throughline already present (if any): where it hooks, where it goes flat, whether it builds belief or just stacks topics.
3. **Gap map** — per concept, flag: `no-story`, `unnamed`, `no-analogy`, `jargon-dense`, `no-application`, `no-so-what`, `belief-not-broken`. These flags drive the rework and mirror exactly what `scripts/verify.sh` greps for.

```text
GAP MAP (one row per concept)
concept            | has story? | named? | analogy? | jargon | application? | so-what? | false belief targeted
-------------------+------------+--------+----------+--------+--------------+----------+----------------------
"idempotency"      | no         | no     | no       | HIGH   | no           | no       | (none) -> internal
"retry w/ backoff" | partial    | no     | weak     | MED    | yes          | no       | vehicle
```

## The landing recipe (per-concept output)

This is the deliverable for every concept. Seven beats, in order. Full template + a fully worked Before→After example → `references/concept-landing-recipe.md`.

```text
LANDING RECIPE — <concept>
1. HOOK ............. the tension/question that makes them lean in (open a loop)
2. EPIPHANY STORY ... backstory -> desire -> wall -> epiphany -> new opportunity -> result
3. MENTAL MODEL .... the named, ownable idea (a label they can repeat)
4. GROUNDED ANALOGY  the concrete metaphor from THEIR world that makes it tangible
5. PROOF / DEMO .... show it working: a demonstration, before/after, or real receipt
6. APPLICATION ..... do-this-now: the smallest action that makes the idea theirs today
7. SO-WHAT ......... future-pace the payoff: what's now possible, why it mattered
```

```text
Bad  (lecture)  — "Idempotency means an operation can be applied multiple times without
                   changing the result beyond the initial application."
Good (landed)   — HOOK: "Ever double-clicked 'Pay' and panicked you'd be charged twice?"
                  STORY: the night a retry double-charged 4,000 customers...
                  MODEL: 'The Elevator Button' — pressing it five times still calls one elevator.
                  ANALOGY: the button's already lit; more presses change nothing.
                  PROOF: same request ID sent 5x -> one charge (show the log).
                  APPLICATION: add an idempotency key to your next POST today.
                  SO-WHAT: you can now retry fearlessly — failures stop being scary."
```

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "The concept is clear, it doesn't need a story" | Clear ≠ memorable. No story = forgotten by tomorrow. Add an Epiphany Bridge beat. |
| "Naming it is cutesy / unnecessary" | Unnamed ideas can't be repeated, so they aren't retained. Give it a sticky, ownable name. |
| "The definition IS the explanation" | A definition is the *destination*; the student needs the *journey* to arrive there. Ground it with an analogy. |
| "My audience is technical, skip the analogy" | Experts forgot they once didn't know. Analogy speeds the click for everyone; jargon density is a defect. |
| "I'll just tell them the insight" | Told insight bounces off; *arrived-at* insight sticks. Make the realization happen in them. |
| "Teach the right way first, address doubts later" | An unbroken false belief deflects the lesson. Break vehicle/internal/external *before* installing. |
| "Every lesson is equally important" | No — one Big Domino per module makes the rest fall. Find it; aim the arc at it. |
| "End on the summary" | Summaries are forgettable; future-paced so-whats are not. End on what's now possible. |
| "I'll invent a quick case study to prove it" | Never. Stories must be true. Mark `[[NEEDS PROOF]]` and ask the user. |
| "Just teach the skill (outer journey)" | The inner journey (identity shift) is why they love the teacher. Teach both. |

## Quick reference

| Lever | Default | Where |
| --- | --- | --- |
| Story per concept | mandatory — ≥1 Epiphany Bridge beat | `references/brunson-frameworks.md` |
| Epiphany beats | backstory → desire → wall → epiphany → new opportunity → result | `references/brunson-frameworks.md` |
| False beliefs | break vehicle + internal + external before teaching | `references/brunson-frameworks.md` |
| Big Domino | one per module; aim the arc at it | `references/brunson-frameworks.md` |
| Named model | short, ownable, repeatable; one per concept | `references/mental-models.md` |
| Analogy | concrete, from the learner's world | `references/mental-models.md` |
| Recipe beats | hook → story → model → analogy → proof → application → so-what | `references/concept-landing-recipe.md` |
| Jargon | flagged when dense / unglossed | `scripts/verify.sh` |
| End on | the so-what (future-paced payoff) | `references/concept-landing-recipe.md` |
| Profile | hard gate before any rework | `references/learner-grounding.md` |

## Teaching QA gate ("did it land?")

Run before claiming done. `scripts/verify.sh` automates the greppable subset.

- [ ] Learner + audience profile located, complete, and cited (which articles grounded this).
- [ ] Big Domino named for the module; the arc is sequenced to knock it over.
- [ ] Every concept has ≥1 story (Epiphany Bridge beat) — no `no-story` lessons.
- [ ] Every concept has a named, ownable mental model.
- [ ] Every abstraction has a concrete analogy from the learner's world.
- [ ] The targeted false belief (vehicle / internal / external) is named and broken before the concept is installed.
- [ ] Every concept ends with an application (do-this-now) and a so-what (future-paced payoff).
- [ ] Jargon is glossed or grounded; no unexplained term-dumps.
- [ ] The insight is *arrived at*, not stated; the realization happens in the student.
- [ ] Both journeys present: the skill (outer) and the identity shift (inner).
- [ ] No fabricated stories, proof, metrics, or credentials; gaps marked `[[NEEDS PROOF]]`.
- [ ] The reworked narrative spine builds belief, it doesn't just stack topics.

Automate → `scripts/verify.sh` (read-only; warns by default, `--strict` to gate CI).

## Project grounding (02-DOCS + CLAUDE.md)

This skill's 02-DOCS record has two parts, both indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer):

- The **learner + audience profile** at `02-DOCS/wiki/teaching/` — a hard gate (see "Learner grounding" above): if the index lacks the entry or any dimension is empty (learner, audience, transformation, false beliefs, constraints), ask until complete, persist it (raw inputs to `02-DOCS/raw/teaching/`), index it in `02-DOCS/wiki/index.md` and ensure root `CLAUDE.md` carries the short pointer to that index (create `CLAUDE.md` if absent), and only then teach.
- The **course teaching conventions** at `02-DOCS/wiki/stack/course-storytelling.md` (or alongside the profile under `02-DOCS/wiki/teaching/`) — the established narrative spine, the named mental models already coined, the Big Dominoes per module, and the teacher's Attractive Character. Recorded, not gated.

Create/update both as decisions are made and keep their entries current in `02-DOCS/wiki/index.md` (root `CLAUDE.md` keeps only a short pointer to it). Read them first on every use and keep every reframing consistent with them. If the project has no `02-DOCS` layer at all, skip this section silently and proceed with the in-session profile.

## See Also

- `../marketing/SKILL.md` — the WORDS that sell the course (value prop, landing copy, launch emails). This skill teaches; that one sells.
- `../presentations/SKILL.md` — turn the landed lesson into a deck (Marp/Slidev/PPTX, speaker notes).
- `../design/SKILL.md` — the visual system and pixels behind the slides/diagrams.
- A content-audit / review-content pass — audit an existing lesson/module/notebook for gaps, redundancy, anachronisms, and storytelling problems (run it first; bring its report here). This skill rebuilds; that pass diagnoses.
- `../harness/SKILL.md` — the `02-DOCS` Karpathy-wiki convention this skill persists the teaching profile into.
- References: `references/brunson-frameworks.md`, `references/learner-grounding.md`, `references/mental-models.md`, `references/course-analysis.md`, `references/concept-landing-recipe.md`.
