# Learner Grounding — Checklist, Question Script & Persistence

The learner + audience profile is the source of truth every reframing is grounded in. You cannot make teaching *land* for a student you haven't profiled — you'll default to the AI-median explainer: abstract, jargon-true, emotionally dead. This file holds the **completeness checklist** (what "complete" means), the **question script** (how to interview the user, batched), and the **persistence format** (how to write it into `02-DOCS` and link it from `CLAUDE.md`). The runtime hard STOP that invokes this lives in `SKILL.md` under "Learner grounding (read this first)".

## Where the profile lives

Following the `harness` Karpathy-wiki convention:

```text
02-DOCS/
├── raw/teaching/        ← immutable: transcripts, outlines, existing slides, pasted verbatim
│   ├── transcript-module-1.md
│   ├── outline.md
│   └── …
└── wiki/teaching/       ← compiled profile, one article per dimension
    ├── index.md             ← the transformation one-liner + links to every dimension article
    ├── learner.md           ← level, prior knowledge, pains, desires, what they want to DO after
    ├── audience.md          ← buyer vs learner? live vs recorded? size? context?
    ├── transformation.md    ← the one result; before → after
    ├── false-beliefs.md     ← current false beliefs, typed vehicle / internal / external
    └── constraints.md       ← format, length, medium, tone, hard limits
```

Small projects may collapse this into a single `index.md` with all dimensions as `##` headings — but every dimension must still be present and filled.

## Completeness checklist

The profile is **COMPLETE** only when every dimension is filled with real, specific content. Any empty, placeholder, or "TBD" dimension = **INCOMPLETE** = hard STOP, interview the user.

- [ ] **1. Learner — level & prior knowledge** — who exactly is learning (role, experience), what they already know about this subject, what they definitely don't.
- [ ] **2. Learner — pains & desires** — in THEIR words: the top 2–3 frustrations/fears around this topic, and the top 2–3 things they actually want.
- [ ] **3. Learner — current false beliefs** — what they wrongly believe today that blocks the teaching, each typed as **vehicle** ("this approach won't work"), **internal** ("I can't do it"), or **external** ("something outside me will stop it"). (→ `brunson-frameworks.md`)
- [ ] **4. Learner — the "do" after** — the concrete action/capability they should be able to perform after the lesson/module ("after this they can add an idempotency key to a POST and explain why").
- [ ] **5. Audience — who's listening** — are the listeners the same as the buyer (decision-maker) or different? Live or recorded? Solo or cohort (size)? In what context do they consume it (commute, classroom, on the job)?
- [ ] **6. Transformation — the one result** — the single before→after the whole course/module exists to produce, stated as an identity + capability shift, not a topic list.
- [ ] **7. Constraints & format** — medium (video / live / written / slides), length budget, tone/voice expectations, hard limits (no code? must be language-agnostic? compliance constraints?).

## Question script (ask in batches, never all at once)

Ask **one batch at a time**. Send the batch, wait for the answer, persist what you learned, then send the next batch. Skip questions a located-but-incomplete profile already answers — only fill the gaps. Stop interviewing the moment all seven dimensions are complete.

### Batch 1 — the learner

```text
1. Who is this for, exactly? Role, experience level, and how familiar they already are with the topic.
2. What do they ALREADY know coming in, and what do they definitely NOT know yet?
3. In THEIR words, what frustrates or scares them about this topic? (top 2–3)
4. What do they actually want — the outcome that made them show up? (top 2–3)
```

### Batch 2 — false beliefs (the block)

```text
5. What do they wrongly BELIEVE about this topic today that gets in the way? For each, tell me
   whether it's: "this approach won't work" (vehicle), "I personally can't do it" (internal),
   or "something outside me will stop me" (external). I'll break each one with a story before teaching.
6. After this lesson/module, what should they be able to DO that they couldn't before? (be concrete)
```

### Batch 3 — the audience & the medium

```text
7. Are the listeners the same people as the buyer/decision-maker, or different?
8. Is this live or recorded? Solo learner or a cohort — roughly how many?
9. Where/how do they consume it (on a commute, in a classroom, at their desk while working)?
```

### Batch 4 — transformation & constraints

```text
10. In one sentence: what's the single before→after this whole thing exists to produce? Frame it as
    who they become + what they can now do, not a list of topics.
11. What's the format and length budget? (video, live, written, slides; minutes/pages)
12. Any hard constraints on tone, vocabulary, or content? (must be language-agnostic? no jargon?
    compliance limits? a voice to match?)
```

If the user can't answer a question, that dimension stays incomplete — note the gap, keep the STOP in place for that dimension, and offer to draft a hypothesis they can confirm rather than fabricating an answer.

## Persistence format

### Profile wiki article template

Each `02-DOCS/wiki/teaching/*.md` article follows the harness wiki format. It is an OKF v0.1 article: open it with YAML frontmatter carrying a non-empty `type:` (`teaching-profile`), then the H1 and body:

```markdown
---
type: teaching-profile
title: Teaching — Learner
description: Who is learning, their level and prior knowledge, their pains and desires, and what they can DO after.
tags: [teaching, learner, profile]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: teaching
status: stable
---

# Teaching — Learner

> Sources: {user interview, YYYY-MM-DD}
> Raw: [transcript-module-1](../../raw/teaching/transcript-module-1.md)

## Overview

One paragraph: who is learning and what must change in them.

## Level & prior knowledge

- Role / experience: …
- Already knows: …
- Does not know yet: …

## Pains & desires (their words)

- Pain: …
- Desire: …

## The "do" after

After this, the learner can: …

## See Also

- [Transformation](transformation.md)
- [False beliefs](false-beliefs.md)
```

### False-beliefs article specifics

`false-beliefs.md` must type every belief so `brunson-frameworks.md` can match it to a breaking story (same OKF frontmatter; `type: teaching-profile`):

```markdown
---
type: teaching-profile
title: Teaching — False Beliefs
description: The learner's blocking beliefs, typed vehicle / internal / external, each with a breaking story.
tags: [teaching, false-beliefs, profile]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: teaching
status: stable
---

# Teaching — False Beliefs

> Sources: {user interview, YYYY-MM-DD}

## Vehicle ("this approach won't work")

- "Tests just slow me down and don't catch real bugs." -> break with: the data-loss bug a
  test-first caught when review missed it.

## Internal ("I can't do it")

- "TDD is for real engineers, I just hack." -> break with: your year-one CRUD feature where
  test-first made you faster.

## External ("something outside me will stop it")

- "My deadline won't allow tests first." -> break with: the sprint where the test became the
  spec and shipped early.
```

### Raw inputs

Paste each user-provided transcript / outline / slide deck verbatim into its own `02-DOCS/raw/teaching/<name>.md` with a one-line provenance header:

```markdown
> Source: user-pasted, YYYY-MM-DD, origin: "Module 1 lecture transcript"

<the material, unedited>
```

### CLAUDE.md link

Add (or update) this section in the root `CLAUDE.md`. Additive only — never delete existing sections. Create `CLAUDE.md` if absent.

```markdown
## Knowledge map

Teaching is grounded in the learner + audience profile under `02-DOCS/wiki/teaching/`.
Read it before reframing any lesson:

- [Transformation (index)](02-DOCS/wiki/teaching/index.md)
- [Learner](02-DOCS/wiki/teaching/learner.md)
- [Audience](02-DOCS/wiki/teaching/audience.md)
- [Transformation](02-DOCS/wiki/teaching/transformation.md)
- [False beliefs](02-DOCS/wiki/teaching/false-beliefs.md)
- [Constraints & format](02-DOCS/wiki/teaching/constraints.md)

Course teaching conventions (narrative spine, named models, Big Dominoes, Attractive Character):
`02-DOCS/wiki/stack/course-storytelling.md`.
Raw transcripts / outlines / slides: `02-DOCS/raw/teaching/`.
The `course-storytelling` skill maintains this profile and stops to interview the user
if any dimension is missing.
```

If a `## Knowledge map` section already exists (e.g. from `marketing`/`design`), append the teaching links to it rather than creating a second one.

## See Also

- `../SKILL.md` — the runtime grounding mechanism (hard STOP) that uses this checklist.
- `brunson-frameworks.md` — consumes the typed false beliefs and the transformation.
- `course-analysis.md` — uses the "do after" + transformation to sequence the spine.
- `../../harness/SKILL.md` — the canonical `02-DOCS` wiki protocol and article templates.
