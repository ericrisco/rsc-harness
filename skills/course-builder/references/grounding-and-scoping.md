# Grounding & scoping

Backward design starts from a destination. If you don't know WHO is travelling, WHAT they must
be able to DO at the end, and the FORMAT/constraints of the trip, every outcome you write is a
guess. This is the hard gate — incomplete grounding means STOP and ask, do not design on assumption.

## The three things you must know

1. **WHO — the learner and current level.** Not a demographic; a *capability baseline*. What can
   they already do today? Absolute beginner who has never opened a terminal? Practitioner who ships
   daily but never wrote a test? The baseline sets the floor of your first outcome.
2. **WHAT transformation.** State it as a DO, not a topic. "They can deploy a containerized service
   to production and roll it back" — not "Docker". The gap between the baseline and this is the course.
3. **FORMAT + constraints.** Duration (90 min / 1 day / 6 weeks / 12 weeks), modality (live cohort
   vs self-paced vs hybrid), group size, prerequisites you can assume, and stakes (does completion
   certify anything?). These bound how many outcomes are honest.

## The one-batch interview

Ask all of it at once. Dribbling one question per message wastes the learner's patience and yours.

```text
Before I design anything, I need three things:

1. WHO is this for, and what can they already DO today (their starting point)?
2. By the end, what must they be able to DO that they can't do now? (a verb, not a topic)
3. FORMAT: how long, live cohort or self-paced, group size, any prerequisites,
   and does finishing certify anything?

If you have a teaching profile in 02-DOCS/wiki/teaching/, point me at it and I'll reuse it.
```

If any answer is a topic ("they should know React"), push back once: *"What should they be able to
DO with React that they can't now?"* Topics don't scope; verbs do.

## The shared teaching profile (02-DOCS/wiki/teaching/)

This is the **same persistence convention** `course-storytelling` uses. If the workspace follows the
project harness, look for `02-DOCS/wiki/teaching/` first:

- `02-DOCS/wiki/teaching/learner-profile.md` — WHO + baseline (reusable across both skills).
- `02-DOCS/wiki/teaching/<course>-outcomes.md` — the outcomes you write here.
- `02-DOCS/wiki/teaching/<course>-matrix.md` — the alignment matrix you emit.

Reuse the learner profile if it exists rather than re-interviewing. When you write outcomes and the
matrix, persist them there so `course-storytelling` can pick up the same grounding for the hand-off.
Note in the file that the profile is shared, so neither skill clobbers the other's section.

Each persisted `02-DOCS/wiki/teaching/*.md` file is an OKF v0.1 wiki article: open it with YAML
frontmatter carrying a non-empty `type:` (`type: course-outline`), then the H1 and body. Use standard
markdown links between articles (`[Outcomes](./<course>-outcomes.md)`), never wikilinks. Mirror the
harness `wiki-article-template.md` shape:

```markdown
---
type: course-outline
title: <Course> — Outcomes
description: The measurable, ABCD-complete learning outcomes for <course>.
tags: [course, learning-outcomes]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: teaching
status: stable
---

# <Course> — Outcomes

> Sources: {user interview, YYYY-MM-DD}

...
```

## Right-sizing scope by format

The single most common failure is too many outcomes for the time. Honest ceilings:

```text
Format                     Outcomes   Bloom ceiling     Assessment shape
Workshop (<= half day)     1-2        Apply             one hands-on artifact, no exam
Full-day workshop          2-3        Apply / Analyze   one build + exit checklist
Multi-week cohort          4-6        up to Evaluate     staged formative + capstone
Bootcamp (8-12+ weeks)     5-8        up to Create       weekly formative + graded capstone
Onboarding track           3-5        Apply             on-the-job checklists + sign-off
Self-paced course          3-6        up to Create       auto-graded quizzes + a final build
```

Rules of thumb:

- If you can't assess an outcome in the available time, it isn't an outcome for this course — it's
  the next course. Cut it or split the course.
- Self-paced means every formative check must grade itself (auto-graded quiz, a test suite that
  runs). There is no instructor in the loop to give feedback.
- A cohort buys you cheap, high-value peer assessment and synchronous checkpoints — use them.
