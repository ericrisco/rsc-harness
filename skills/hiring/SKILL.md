---
name: hiring
description: "Use when a role is open and you must write the job post, screen inbound candidates, structure the interview loop, or score them to a defensible Hire / On-Hold / No-Hire — including whether an AI résumé filter is legal. NOT after the offer is accepted — onboarding, payroll, performance (that is `people-ops`), NOT offer terms (that is `contracts`)."
tags: [hiring, recruiting, job-description, interview-scorecard, candidate-screening, structured-interview]
recommends: [people-ops, brand-voice, contracts, compliance, cold-outreach, calendar-scheduling]
profiles: []
origin: risco
---

# Hiring

You run the **selection funnel up to the hire decision**: write the post, screen
the pile, structure the loop, and score candidates so the call is evidence-based
and defensible. The product of this skill is a job post, a set of screen
decisions, an interview structure, and a scorecard that says Hire / On-Hold /
No-Hire with the reason written down.

Hard boundary: the moment the offer is accepted, you are done. Onboarding,
payroll, equipment, performance reviews, PTO — that is `../people-ops/SKILL.md`.
Do not draft offer-letter terms here either; that is `../contracts/SKILL.md`.

## The funnel (the spine)

Every engagement walks this line, in order. Do not skip to scoring before the
rubric exists.

```text
define role → write post → screen pile → structured loop → independent scores → calibrated debrief → decision
```

One rule per stage, with the why:

- **Define the role first.** You cannot screen against criteria you have not
  named. Write the 3–6 competencies before the post, because they drive the
  post, the questions, and the scorecard.
- **Write the post from the competencies.** A post is the competencies turned
  outward, not a wish list.
- **Screen against one rubric.** Same criteria, same order, every candidate, or
  the comparison is meaningless.
- **Run a structured loop.** Same questions, same rubric, every candidate —
  structured interviews are the single highest-validity selection method
  (~.51 predictive validity vs ~.38 unstructured; the 2022 Sackett et al.
  re-analysis ranks them above cognitive-ability tests). Unstructured = lottery.
- **Score independently, then calibrate.** Each interviewer submits before the
  group talks. Debrief is calibration, not a re-vote.

## Write the job post

The job post is the top of the funnel and it leaks candidates if you write it
wrong. Apply the company voice from `../brand-voice/SKILL.md` if one exists — but
do not author the voice guide here, just apply it.

**Split must-haves from nice-to-haves, and keep must-haves short.** Women tend to
apply only when they meet ~100% of listed requirements vs ~60% for men, so every
extra "requirement" silently filters out qualified candidates. Cap must-haves at
~6. Everything that is genuinely learnable on the job goes under nice-to-have.

**Ban gender-coded language.** Removing gender-coded terms yields roughly 29%
more applications. Masculine-coded words skew the applicant pool male. Strip and
replace:

- Drop: *rockstar, ninja, dominant, aggressive, fearless, ambitious, competitive,
  driven, strong, crush it.*
- Prefer: *collaborate, support, partner, build, responsible, dependable, share.*

Full do/don't word list and a fill-in post skeleton: `references/templates.md`.

**State pay.** Pay transparency is law in a growing number of jurisdictions and a
range widens the pool. Put a band in the post.

Bad → Good, same role:

```text
BAD
We need a rockstar engineer — a fearless, aggressive self-starter who can crush
ambiguous problems. Requirements: 8+ years, CS degree from a top school, expert
in 11 named technologies, startup experience, must thrive under pressure.

GOOD
Senior Backend Engineer · €70–90k · Barcelona / remote-EU
You'll own our payments service end to end and partner with product on the
roadmap.
Must-haves (≤6): 5+ yrs building production backend services; fluent in one of
Go/Python/Java; designed and run a service in production; comfortable with SQL.
Nice-to-haves: payments domain, Kafka, prior on-call.
How to apply: send a short note + anything you've shipped.
```

## Screen the pile

Score every applicant against the **same job-related rubric** you derived from
the competencies (template: `references/templates.md`). No bespoke criteria per
candidate.

- **Blind to non-job factors.** School prestige, name, age, employment gaps,
  photo — none of it is in the rubric, so it does not enter the decision.
- **Work samples beat résumés.** Skills-based signals (a structured task, a code
  sample, a portfolio teardown) predict performance better than résumé history;
  >73% of companies now report a skills-based approach. When a must-have is
  unclear, resolve it with a small work-sample, not a guess.
- **Defer criminal history.** Fair-chance / "ban-the-box" laws in 37+ states and
  150+ US cities require deferring criminal-history questions until after a
  conditional offer, plus an individualized assessment. Do not put a
  criminal-history box on the application form. (Candidate-data retention and
  consent: `../gdpr-privacy/SKILL.md`.)

For each candidate, the call:

| Signal | Decision |
|---|---|
| Meets the must-haves on job-related evidence | Advance to loop |
| Strong on most, one must-have unclear | Send a short work-sample / structured task to resolve it |
| Misses a hard must-have (verified skill, legal eligibility) | Reject, with the job-related reason logged |
| Borderline, more reqs open soon | Parking lot — note why, revisit, do not silently ghost |
| Non-job factor (school name, age, gap, "vibe", name) | Ignore it — it is not in the rubric |

## Structure the interview loop

Turn the 3–6 competencies into a loop where each interviewer owns distinct
ground.

1. **Map competencies to stages.** Each competency gets a clear owner. If four
   people will all ask "tell me about a hard project", you have a duplicate-
   coverage bug — split the competencies so each stage probes something the
   others do not.
2. **Build a structured question bank.** Behavioral / STAR + work-sample, tied to
   each competency, asked in the same order for every candidate. Sample inline;
   full bank in `references/templates.md`.
3. **Calibrate before kickoff.** Run a 15-minute session on what a "5" vs a "3"
   means on the scale *before* anyone interviews, so scores are comparable.

Sample structured question (problem-solving, behavioral/STAR):

```text
"Walk me through the hardest technical tradeoff you owned in the last year."
Follow-ups (STAR): What was the situation? What were YOUR options and the one
you picked? What did you actually do? What was the measured result, and what
would you change?
```

## The scorecard

This is where gut-feel hiring dies. A structured scorecard with behavioral
anchors lifts interview validity from ~.20 to ~.51 (most rigorous scoring ~.57)
and a 2022 SHRM-cited figure puts bias reduction above 50% versus unstructured
scoring. Shape it exactly:

- **3–6 competencies.** Fewer misses dimensions; more than 6 dilutes focus and
  loads the interviewer.
- **5-point anchored scale.** Write the anchor text for at least the low / mid /
  high points so a "4" means the same thing to everyone.
- **A required evidence field.** Forces a quote or concrete example, not a vibe.
- **One overall: Hire / On-Hold / No-Hire.**
- **Score independently, submit before the debrief.** Fill it right after the
  session (recency) and submit before the group talks, so no one anchors on the
  loudest voice in the room.

Skeleton:

```text
Candidate: ___   Role: ___   Interviewer: ___   Stage: ___

Competency: Problem-solving
  Score (1–5): __
  Anchors — 1: gave a vague answer, no real tradeoff
            3: described a decision but thin on alternatives/result
            5: clear tradeoff, owned the call, measured the outcome
  Evidence (required, quote/example): "____________________"

[ repeat for each of the 3–6 competencies ]

Overall recommendation:  [ ] Hire   [ ] On-Hold   [ ] No-Hire
Rationale (one paragraph, tied to the evidence above): ______
```

Bad → Good entry:

```text
BAD:  Problem-solving: 7/10. Good vibes, seems smart, would grab a beer with him.
GOOD: Problem-solving: 4/5. Evidence: "chose eventual consistency to cut p99 from
      900ms to 120ms, named the staleness tradeoff and how they bounded it."
```

Full anchored template (one competency written out at all five levels) and the
question bank: `references/templates.md`.

## Debrief & decision

Turn independent scores into one calibrated call.

1. Collect all submitted scorecards — confirm they came in before the debrief.
2. Surface disagreements: where scores diverge, go to the **evidence**, not the
   loudest opinion. A "5" with a weak quote loses to a "3" with a strong one.
3. Reach Hire / On-Hold / No-Hire and **write the rationale**, tied to the
   evidence on the cards.
4. **Retain the records.** EEOC requires keeping interview notes and scoring
   tools at least 1 year after the decision (2 years for federal contractors).
   The anchored scorecards with documented evidence *are* the defense if the
   decision is ever challenged. Do not delete them.

A loop that "still can't decide after four interviews" almost always lacks
independent submitted scores and anchors — fix the structure, do not add a fifth
interview.

## AI & legal guardrails

Before you let any model rank, score, or reject candidates, know these triggers.
This skill *follows* the rules; it does not run the legal program — that is
`../compliance/SKILL.md`.

- **NYC Local Law 144** (enforced since 2023-07-05): any Automated Employment
  Decision Tool needs an annual independent bias audit, public posting of the
  results, and advance notice to candidates. No audit, no notice → do not deploy.
- **EU AI Act:** recruitment / CV-screening / candidate-ranking AI is classed
  *high-risk* (Annex III, Cat. 4). Obligations apply from **2 Dec 2027**
  (deferred from 2 Aug 2026 by the Nov-2025 AI-omnibus). Deployer fines reach
  €15M or 3% of global turnover. Colorado's AI Act effective date moved to 2027.
- **Never auto-reject without human review.** A model can sort or flag; a person
  makes the reject call. Keep the human in the loop and the evidence trail intact.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| "7/10, good vibes" rating | Unscoreable, bias-prone, indefensible | 5-point anchored scale + evidence quote |
| Different questions per candidate | No comparison is valid | Same structured bank, same order |
| Four interviewers, one question | Wastes the loop, no coverage | Map each competency to one owner |
| 15-item must-have list | Self-filters qualified candidates (100% vs 60%) | ≤6 must-haves; rest are nice-to-haves |
| Gender-coded words in the post | ~29% fewer applications, skews male | Strip and replace; check the word list |
| Criminal-history box on the form | Violates fair-chance / ban-the-box law | Defer to post-conditional-offer |
| Debrief before scores submitted | Groupthink anchors on the loudest voice | Independent scores in first, then talk |
| Model auto-rejects résumés | LL144 / EU AI Act exposure, no human in loop | Model flags, human decides, audit + notice |
| "Culture fit" as a competency | Coded bias, not job-related | Score job-related competencies only |
| Screening on school / name / gap | Non-job factor, not in the rubric | Blind to it; rubric only |
| Deleting interview notes | Breaks EEOC retention; no defense | Retain ≥1 yr (2 yr for fed contractors) |
| Drifting into onboarding/payroll | Out of scope, wrong skill | Stop at the decision → `../people-ops/SKILL.md` |
