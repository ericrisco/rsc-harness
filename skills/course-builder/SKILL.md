---
name: course-builder
description: "Use when turning \"I want to teach X\" into a defensible course skeleton — measurable outcomes (Bloom + ABCD), assessment that proves each one, sequenced modules, and an outcome×module×assessment matrix — for a workshop, bootcamp, cohort or onboarding track. NOT making one concept land emotionally with story or analogy (that is course-storytelling)."
tags: [course, curriculum, instructional-design, learning-outcomes, assessment]
recommends: [course-storytelling, presentations, sop-builder]
origin: risco
---

# Course Builder — The Course Is a Contract

*Outcomes promise what the learner can DO. Assessment is the proof. Modules are the build order. If the three don't line up, you have a content dump, not a course. You design them backward — outcomes first, assessment second, content last — and you emit a matrix that makes the alignment checkable.*

This skill owns the **skeleton**: the measurable outcomes, the assessment that certifies each one, the module sequence that builds toward them, and the alignment matrix tying it all together. It does not own the *teaching* of any one concept.

**The litmus.** If the question is *"what must the learner be able to DO, how do we prove it, and in what order do we build it?"* → here. If it's *"how do I make THIS concept click and stick?"* → `../course-storytelling/SKILL.md`.

Route elsewhere when: auditing a *finished* course for gaps, redundancy, anachronisms with a written report → `../review/SKILL.md`; turning a designed module into slides/decks → `../presentations/SKILL.md` (+ `../design/SKILL.md` for the visual system); sales/landing copy and launch emails → `../marketing/SKILL.md` (you design the learning contract, never the pitch); fact-checking or sourcing the subject matter → `../research-ops/SKILL.md` (you structure what the user already knows); a repeatable internal procedure with steps but no outcomes/assessment → `../sop-builder/SKILL.md` (an SOP tells someone the steps; a course changes what they can DO and proves it).

## The grounding gate (read first — STOP if unmet)

You cannot design a course backward without knowing the destination. Do not write a single outcome until you have all three. Why: an outcome scoped for a senior engineer in a 90-minute workshop is wrong for a beginner in a 12-week cohort — same topic, different contract.

1. **WHO** — the learner and their *current* level (absolute beginner? practitioner? what can they already do?).
2. **WHAT transformation** — what must they be able to DO at the end that they cannot do now.
3. **FORMAT + constraints** — duration, modality (live cohort vs self-paced), group size, prerequisites, certification stakes.

If a `02-DOCS/wiki/teaching/` profile exists (the convention shared with `../course-storytelling/SKILL.md`), read it first and reuse it. Otherwise interview in ONE batch — ask all three at once, do not dribble questions. **Incomplete grounding = STOP and ask.** Depth, the interview script, and scope right-sizing by format → `references/grounding-and-scoping.md`.

## The build workflow (one backward pass)

Run it in order. Do not jump to modules. UbD has exactly three stages in order — desired results → acceptable evidence → learning experiences (Wiggins & McTighe, *Understanding by Design*). Content designed first is a dump with no destination, and "I already have these slides, build a course around them" inverts the contract: outcomes decide what content survives.

```text
Stage 0  Grounding gate         WHO + WHAT transformation + FORMAT. Incomplete → STOP.
Stage 1  Outcomes               3–8 course-level outcomes. Measurable Bloom verb + ABCD.
                                Verb banlist enforced. Right-sized to format.
Stage 2  Assessment             For EACH outcome, the evidence that proves it.
                                Verb-match the outcome. Place formative + summative.
                                Check content validity (covers the breadth of outcomes).
Stage 3  Modules + sequence     One focus per module, prerequisite order. Each module
                                maps to >=1 outcome. No orphans, no unproven outcomes.
Stage 4  Alignment matrix       Emit outcome x module x assessment. The checkable artifact.
Stage 5  QA gate                Run scripts/verify.sh over the curriculum doc. Fix warnings
                                or justify them. Then hand modules to course-storytelling.
```

## Stage 1 — Writing measurable outcomes

Pick the verb at the level the learner must actually operate. Recall ≠ build. The revised taxonomy (Anderson & Krathwohl, 2001) is six ascending levels of *verbs*, each supplying observable action verbs — a verb you can't observe, you can't assess.

```text
Level         What the learner does          Sample verbs
Remember      recall facts                   list, define, name, label, recall
Understand    explain in own words           explain, summarize, classify, compare
Apply         use in a new situation         apply, use, implement, solve, run
Analyze       break apart, find relations    analyze, differentiate, debug, diagram
Evaluate      judge against criteria         evaluate, critique, justify, prioritize, review
Create        produce something new          design, build, compose, construct, ship
```

**Banlist — never "understand", "know", "learn about", "appreciate", "be aware", "be familiar".** They name a private mental state, not an observable behavior. Replace with what the learner *does*: list, explain, build, debug, evaluate, design.

Every outcome is **ABCD-complete** — a bare verb without a condition and a degree is not yet assessable ("write code" vs "given a failing test, write code that makes it pass"):

```text
[Audience]   the learner
[Behavior]   <Bloom verb> + <object>
[Condition]  given <situation / tools / inputs>
[Degree]     <criterion that counts as success>
```

Bad → Good (the banlist verb is the tell):

```markdown
Bad:  Students will understand REST APIs.
Good: Given a spec, the learner builds a REST endpoint that returns the correct
      status code for 3 named error cases (400, 404, 500).

Bad:  Learners will know SQL joins.
Good: Given two tables, the learner writes a query joining them that returns the
      expected rows for 2 of 2 test cases.

Bad:  Participants will appreciate good test design.
Good: Given a 20-line module, the learner writes 3 tests that cover the happy path
      and 2 edge cases, all passing.
```

Full per-level verb tables, the banlist, more worked ABCD examples, and course-level vs module-level granularity → `references/outcomes-and-blooms.md`.

## Stage 2 — Designing aligned assessment

Assessment is the proof, not an afterthought. For every outcome, ask: *what would I have to SEE the learner do to believe they achieved it?* — and make that the assessment. Place **both** kinds: an outcome with no evidence is a promise you never keep, and a course with only the final exam gives the learner no feedback loop.

```text
                 Formative (during)              Summative (at the end)
Job              feedback, guide improvement     certify mastery / accountability
Stakes           low / none                      high — the grade, the cert
Examples         quizzes, skill checklists,      capstone project, final exam,
                 drafts, peer review, exit        portfolio, graded build
                 tickets
Bloom fit        Remember/Understand/Apply        Apply/Analyze/Evaluate/Create
```

Two hard checks:

- **Verb match** (constructive alignment, Biggs). The assessment must require the *same* verb as the outcome. Outcome "build" → assessment is a build, not a multiple-choice quiz. Outcome "evaluate" → assessment asks for a judgement with justification, not recall. If the outcome says "design" and the quiz tests "recall", the assessment proves the wrong thing.
- **Content validity.** The set of assessments must cover the *breadth* of the outcomes — every outcome touched, none over-weighted into a vanity exam. Competency-based design maps this via the matrix and certifies demonstrated mastery, not seat time.

The full formative↔summative menu mapped to Bloom levels, the content-validity / blueprint checklist, and the verb-match rule worked end-to-end → `references/assessment-design.md`.

## Stages 3–4 — Sequencing modules + the alignment matrix

Order modules by **prerequisite** (you can't build before you can run), give each **one focus**, and map each to ≥1 outcome. Then emit the matrix — this is the artifact `scripts/verify.sh` checks.

```markdown
| Outcome                          | Module(s)        | Assessment (F=formative, S=summative) |
|----------------------------------|------------------|---------------------------------------|
| O1 build a REST endpoint         | M2, M3           | F: M2 quiz · S: capstone API          |
| O2 debug a failing request       | M4               | F: M4 debug drill · S: capstone API   |
| O3 evaluate an API's error model | M5               | F: M5 peer review · S: capstone rubric|
```

Read the matrix two ways: down a column finds **orphan modules** (a module in no row → content the contract never asked for, so cut it or write the outcome it serves); across the outcome list finds **unproven outcomes** (an outcome with an empty assessment cell → design evidence). A complete matrix has no empty cells.

## Decision table (branch only where the flow actually splits)

```text
Situation                         Then
Live cohort                       Schedule synchronous formative checkpoints; peer
                                  assessment is cheap and valuable.
Self-paced                        Formative must be self-graded/auto-graded (quizzes,
                                  tests that run); no instructor in the loop.
Short workshop (<= half day)      1-2 outcomes, mostly Apply; one summative artifact, no exam.
Full course / bootcamp            5-8 outcomes spanning up to Create; staged formative +
                                  a capstone summative.
Knowledge outcome                 Assess with explanation/application, not recognition alone.
Skill outcome                     Assess with a performance/build, never a quiz.
Attitude/disposition outcome      Assess with reflection + observed behavior; hardest to
                                  prove — keep few and honest.
```

## Anti-patterns

| Bad | Why it fails | Do instead |
|-----|--------------|------------|
| Content-first: "build a course around my slides" | Inverts the contract; content with no destination | Write outcomes first; let them decide what content survives |
| Vanity outcome: "students will understand X" | Names a private state, not observable → unassessable | Use a measurable Bloom verb in ABCD form |
| Orphan module: a module mapped to no outcome | Content the contract never asked for | Cut it, or write the outcome it serves |
| Unproven outcome: an outcome with no assessment | A promise you never verify | Design evidence that requires the outcome's verb |
| Verb mismatch: outcome "design", quiz tests "recall" | Proves the wrong thing | Make the assessment require the outcome's verb |
| Summative-only: just a final exam | No feedback loop during learning | Place formative checkpoints throughout |
| Scope creep: bootcamp outcomes in a workshop | None are actually achievable in the time | Right-size outcome count to the format |

## Stage 5 — QA gate and hand-off

`scripts/verify.sh` checks your curriculum's STRUCTURE and ALIGNMENT (measurable verbs, the matrix, proven outcomes, formative + summative). Fix its warnings or justify them.

Then hand **each module** to `../course-storytelling/SKILL.md` to make the teaching land (epiphany, named models, grounded analogies). You built *what* and *in what order*; that skill makes it stick. The boundary is executable: this skill's verify.sh does not judge whether the teaching lands, and `course-storytelling`'s checks narrative, not structure.
