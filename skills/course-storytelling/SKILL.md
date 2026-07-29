---
name: course-storytelling
description: "Use when lesson or course content is correct but forgettable and a concept has to LAND: profiles the learner, breaks the blocking false belief, then rebuilds it as epiphany story → named model → grounded analogy → proof → so-what. NOT outcomes, assessment or module order (that is `course-builder`), NOT slide visuals (that is `presentations`)."
tags: [course, teaching, storytelling, content]
recommends: [presentations]
origin: risco
---

# Course Storytelling — Make the Teaching Land

*Take a concept the student would forget and turn it into one they can't unhear. Profile the learner first, then run every concept through the Expert Secrets machine: epiphany story → named model → grounded analogy → proof → do-this-now → the so-what.*

This skill owns **the teaching narrative**: extracting what a course actually teaches, finding where it stays abstract, and rebuilding each concept so the realization happens *in the student*, emotionally, not just on the slide. It borrows Russell Brunson's *Expert Secrets* frameworks as a **teaching methodology** (this is method, not text reproduction).

Boundaries: `course-builder` decides what the course must prove — outcomes, assessment, module order — and hands you the skeleton; this skill makes each concept inside it land. `presentations` turns the landed lesson into a deck, `design` owns the pixels, `marketing` owns the words that sell the course, and a content-audit/review-content pass diagnoses an existing lesson (run it first, bring its findings here — that pass audits, this one rebuilds).

**Teaching ≠ selling.** Brunson's frameworks here serve comprehension and retention. The "sale" you're closing is *belief in the idea and trust in the teacher* — never bolt a pitch onto a lesson.

## Learner grounding (hard gate — read this first)

**Never reframe teaching without a complete learner + audience profile.** Teaching into a void defaults to your AI-median explainer voice — abstract, jargon-true, emotionally dead. An incomplete profile is a hard STOP, not a warning, because everything downstream (which false belief to break, which analogy lands) is derived from it.

1. **Locate the profile.** Read the root `CLAUDE.md`, follow its `## Knowledge map` pointer to `02-DOCS/wiki/index.md`, and look for the entry into `02-DOCS/wiki/teaching/` (the `harness` Karpathy-wiki convention: compiled articles in `02-DOCS/wiki/teaching/`, raw user-pasted material in `02-DOCS/raw/teaching/`). No `CLAUDE.md`, no index entry, or a pointer that goes nowhere = ABSENT.
2. **Check completeness** against the checklist in `references/learner-grounding.md`: the LEARNER (level, prior knowledge, pains, desires, current false beliefs, what they DO after), the AUDIENCE (same as the buyer? live vs recorded? size? context?), the target TRANSFORMATION (one result, before→after), and constraints/format. **Any empty dimension = INCOMPLETE.**
3. **If ABSENT or INCOMPLETE, STOP and interview** with the batched question script in `references/learner-grounding.md` — one focused batch at a time, wait, persist, continue. Then write the profile as wiki articles under `02-DOCS/wiki/teaching/` (`learner.md`, `audience.md`, `transformation.md`, `false-beliefs.md`, `constraints.md`, `index.md`), save pasted transcripts/outlines/slides verbatim under `02-DOCS/raw/teaching/` and link them from each article's `> Raw:` line, index the profile in `02-DOCS/wiki/index.md`, and ensure root `CLAUDE.md` carries the short pointer to that index (create it if absent; additive only). Article format and the exact `CLAUDE.md` snippet → `references/learner-grounding.md`.
4. **Only then proceed**, citing which articles you used ("grounded in `02-DOCS/wiki/teaching/learner.md` and `false-beliefs.md`") so every reframing is traceable to a real learner, not an imagined one.

Sole exception: if the user explicitly says "skip the profile, just rough one concept", produce a clearly-labelled `DRAFT (ungrounded — not learner-checked)` and still recommend running the gate before anything ships.

## The teaching workflow (one pass)

Run in order. Each step feeds the next; skipping one shows up as a flat lesson downstream.

1. **Ground.** Pass the gate above. Load learner, audience, transformation, false beliefs, constraints from `02-DOCS/wiki/teaching/` and cite them.
2. **Analyze the content.** Ingest the material; extract the concept list AND the *existing* narrative spine; map the ungrounded / jargon-heavy / story-less gaps. → `references/course-analysis.md`.
3. **Set the Big Domino.** Name the one belief per module that makes everything else fall, and sequence concepts to build toward it — not every lesson is equally important. → `references/brunson-frameworks.md`, `references/course-analysis.md`.
4. **Per concept, find the false belief** the learner holds (vehicle / internal / external) and the epiphany that breaks it. Break it *before* teaching: a lesson landing on an unbroken false belief bounces off. → `references/brunson-frameworks.md`.
5. **Run the landing recipe** for each concept: hook → epiphany-bridge story → named mental model → grounded analogy → proof/demo → application (do-this-now) → so-what. Every concept gets all seven; a concept with no story is forgotten by tomorrow, and one with no so-what is trivia. → `references/concept-landing-recipe.md`.
6. **Name the models.** Engineer a sticky, ownable name + a concrete analogy for each — an unnamed idea can't be repeated, so it can't be retained, and an abstraction with no analogy from the learner's own world is a defect. → `references/mental-models.md`.
7. **Rewrite the narrative spine.** Resequence the whole module/course as a belief-building arc (the Hero's Two Journeys), not a topic dump. → `references/brunson-frameworks.md`, `references/course-analysis.md`.
8. **Run the QA gate** (below) and `scripts/verify.sh`. Fix every flag or justify it.

Throughout: tell the epiphany as a journey so the student *arrives* at the insight rather than being handed the conclusion, explain it in the student's vocabulary instead of the discipline's, and **never invent proof** — if a demo, result, metric or credential wasn't supplied by the user, mark it `[[NEEDS PROOF]]` and ask.

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

Before reframing you must *see* what's there. Ingest the material and produce three artifacts — full method, extraction prompts and the gap-map template → `references/course-analysis.md`:

1. **Concept inventory** — every distinct idea the material teaches, in teaching order, with a one-line "what the student should be able to DO after this".
2. **Existing narrative spine** — the throughline already present (if any): where it hooks, where it goes flat, whether it builds belief or just stacks topics.
3. **Gap map** — per concept, flag `no-story`, `unnamed`, `no-analogy`, `jargon-dense`, `no-application`, `no-so-what`, `belief-not-broken`. These flags drive the rework and mirror exactly what `scripts/verify.sh` greps for.

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

## Anti-patterns

| Anti-pattern | Reality / fix |
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

## Teaching QA gate ("did it land?")

Run before claiming done. `scripts/verify.sh` automates the greppable subset (read-only; warns by default, `--strict` to gate CI).

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

## Project grounding (02-DOCS)

Beyond the gated learner profile, record the **course teaching conventions** at `02-DOCS/wiki/stack/course-storytelling.md` (or alongside the profile under `02-DOCS/wiki/teaching/`): the established narrative spine, the named mental models already coined, the Big Dominoes per module, and the teacher's Attractive Character. Recorded, not gated — update it as decisions are made, keep its entry current in `02-DOCS/wiki/index.md`, read it first on every use, and keep every reframing consistent with it. The wiki convention itself belongs to `../harness/SKILL.md`. If the project has no `02-DOCS` layer, skip this silently and proceed with the in-session profile.
