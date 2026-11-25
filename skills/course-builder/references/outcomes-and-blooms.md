# Outcomes & Bloom's revised taxonomy

An outcome is a promise about what the learner can DO. Two things make it defensible: it sits on a
**measurable verb** from Bloom's revised taxonomy, and it is **ABCD-complete** so it's actually
assessable. This file is the verb reference, the banlist, and worked examples.

## Bloom's revised taxonomy (Anderson & Krathwohl, 2001)

The 2001 revision turned Bloom's original nouns into **verbs** and reordered the top two levels.
Six ascending levels — pick the verb at the level the learner must operate at. Recall is not build.

```text
Level 1  Remember     recall, list, define, name, label, identify, state, recognize, repeat
Level 2  Understand*  explain, summarize, classify, compare, describe, paraphrase, interpret
Level 3  Apply        apply, use, implement, execute, run, solve, demonstrate, compute
Level 4  Analyze      analyze, differentiate, debug, diagram, distinguish, examine, deconstruct
Level 5  Evaluate     evaluate, critique, justify, prioritize, defend, review, assess, recommend
Level 6  Create       design, build, compose, construct, develop, ship, formulate, generate
```

\* "Understand" is a LEVEL NAME, not an outcome verb. Write the *verb* at that level ("explain",
"compare") — never the bare word "understand" in an outcome. See the banlist below.

## The verb banlist

These name a private mental state no one can observe, so they can't be assessed. Replace every one.

```text
Banned          Why                              Use instead (observable)
understand      can't see "understanding"        explain, apply, predict, classify
know            can't see "knowing"              list, define, recall, use
learn (about)   describes activity, not result   produce, demonstrate, solve
appreciate      a feeling, not a behavior        justify, critique, prioritize
be aware of     awareness is invisible           identify, flag, distinguish
be familiar     familiarity is unmeasurable      describe, locate, recognize
```

A quick test: can two independent graders watch the learner and agree on whether they did it? If
not, the verb is too vague — go down to a concrete action.

## The ABCD template

A bare verb is not yet an outcome. Add the conditions and the success criterion.

```text
[A] Audience    the learner / the participant
[B] Behavior    <Bloom verb> + <object>
[C] Condition   given <inputs / tools / situation>
[D] Degree      <what counts as success: count, accuracy, time, rubric>
```

Read as one sentence: *"Given <C>, the learner will <B> to <D>."*

## Worked examples

```markdown
Bad:  Students will understand functions in Python.
Why:  banlist verb, no condition, no degree — unassessable.
Good: Given a problem statement, the learner writes a Python function with correct
      parameters and return value that passes 3 of 3 provided unit tests.
      [A] learner [B] writes a function [C] given a problem statement
      [D] passes 3/3 unit tests

Bad:  Learners will know how to handle errors.
Good: Given an endpoint that can fail 3 ways, the learner adds error handling that
      returns the correct status code (400/404/500) for each, verified by a test run.

Bad:  Participants will appreciate clean architecture.
Good: Given a 200-line module, the learner critiques its layering against 4 named
      criteria and proposes one concrete refactor with justification.
```

## Course-level vs module-level outcomes

- **Course-level outcomes** (1–8, sized to the format: 1–2 for a workshop, 5–8 for a full course) are the contract: what the learner can DO when the whole course
  ends. They tend to sit at Apply→Create and are proven by the *summative* assessment.
- **Module-level outcomes** are the steps that build toward a course outcome. They can sit lower
  (Remember/Understand/Apply) and are proven by *formative* checks. Each module-level outcome should
  ladder up to at least one course-level outcome — if it doesn't, the module is an orphan.

Keep the course-level list short and the module-level list a build sequence beneath it. The matrix
(see assessment-design.md and SKILL.md) ties module work back to course outcomes so nothing floats.
