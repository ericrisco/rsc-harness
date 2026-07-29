---
name: sop-builder
description: "Use when a repeated process lives in one person's head, breaks when they are away, gets re-explained to every new hire, or produces inconsistent results — and needs writing down once so anyone or any agent can run it the same way. Also for auditing and rewriting an SOP that is stale, ignored or missing its branches. NOT capturing a meeting's decisions and action items (that is `meeting-notes`), NOT running a one-time project plan with milestones (that is `project-ops`)."
tags:
  - sop
  - process-documentation
  - standard-operating-procedure
  - runbook
  - process
  - business-ops
recommends:
  - meeting-notes
  - project-ops
  - compliance
  - technical-writing
  - automation-flows
  - people-ops
profiles: []
origin: risco
---

# SOP builder

You keep re-explaining the same process. Write it down once, correctly, so it
runs without you. That is the whole job: take a workflow living in one person's
head, a Slack thread, or a screen recording, and turn it into a **standard
operating procedure** — a document another human or agent can follow to get the
same result every time.

An SOP is not a meeting note and not a project plan. Hold the line:

- **What was decided + who does what by when** → [`meeting-notes`](../meeting-notes/SKILL.md). That records a moment; you record a *recurring task*.
- **Milestones, status, a thing with an end date** → [`project-ops`](../project-ops/SKILL.md). A project finishes; an SOP repeats forever.
- **External help-center docs / product manuals** → [`technical-writing`](../technical-writing/SKILL.md). That writes for a customer; you write for the person inside the org who runs the routine.
- **Regulated GxP quality-system SOPs with formal approval + audit trail** → [`compliance`](../compliance/SKILL.md) owns the regulatory gating. You write the operational document; defer the sign-off framework to them.
- **Turning the documented steps into a flow / webhook / script** → [`automation-flows`](../automation-flows/SKILL.md). You document; they automate.
- **One specific new hire's first-week checklist + accounts** → [`people-ops`](../people-ops/SKILL.md). You write the *reusable* procedure they'll follow, not their personal tracker.

The payoff is real but conditional: standardizing a process can cut errors by
up to ~90% — **only when the SOP is clear and easy to follow**. A correct SOP
nobody can read changes nothing. Usability is the whole game.

## The capture-to-SOP loop

This is the spine. Run it in order; do not skip the test step.

1. **Pick one process.** One trigger in, one defined output out. If you can't
   name the trigger and the output, you're scoping a department, not an SOP.
2. **Capture the real flow** — interview the owner *or* read their recording/
   transcript. Capture how it actually runs, not how it's supposed to.
3. **Find the decisions and exceptions.** Where does it fork? Where does it
   break when the owner is out? These are what a linear draft will miss.
4. **Choose the format by flow shape** (next section). Linear ≠ branching ≠
   parallel, and each wants a different shape.
5. **Draft at the right altitude** — who does what and when, not every keystroke.
6. **Test it on someone who has never done the task.** If they get stuck or ask
   a question, the SOP has a gap — fix the document, not the person.
7. **Assign an accountable owner and a review date.** Unowned, undated SOPs are
   dead on arrival.

Steps 3 and 6 are the ones teams skip and the reason most SOPs fail in the
wild — a happy-path document breaks the moment reality forks.

## Scope the right altitude

An SOP and a work instruction are different documents. Per ISO 9001:2015 a
procedure is "a specified way to carry out an activity." Don't bloat an SOP with
keystroke detail — that's a separate work instruction, and one SOP links to
several of them.

| Altitude | Answers | Example line | Belongs in |
| --- | --- | --- | --- |
| SOP | *who* does *what* and *when* (the roadmap) | "The editor approves the draft before it's scheduled." | The SOP body |
| Work instruction | *how* one operator does one task (the GPS) | "Click Settings → Schedule → pick 09:00, hit Confirm." | A linked WI, not inline |

Rule of thumb: if removing a line wouldn't change *who* is accountable or *what*
the next decision is, it's probably a keystroke — link it out or cut it. A
reader who already knows the tool should not have to scroll past click-by-click
detail to find the one decision that matters.

## Pick the format by flow shape

Match format to the shape of the work, not to preference. A mismatched format is
a top adoption killer — people abandon an SOP that fights how the task actually
moves.

| Flow shape | Use | Why |
| --- | --- | --- |
| Strictly linear, every time the same | Numbered step-by-step | The order *is* the procedure; numbers carry it. |
| Many parallel pieces, done by experienced people | Checklist | They know *how*; they need to not forget a piece, not be walked through it. |
| Has decision points / forks / "it depends" | Flowchart or decision table | A numbered list hides branches inside prose and readers miss them. |

If the process has even one real "if X then Y" fork, do **not** force it into a
flat numbered list. The fork is exactly the part that breaks under pressure, and
a flat list buries it.

## The capture step

Garbage in, garbage SOP. Capture how the work *actually* runs.

**From a recording (the fast path).** A team hand-writing one SOP spends ~3–5
hours; recording the task once (10–15 min) and extracting steps from the
video/transcript is reported 10–20x faster. Treat the recording as the single
source of truth, then prune to the SOP. Crucially: **do not invent steps the
source never shows.** If the transcript skips a step, flag the gap — don't
backfill it from imagination.

**From an interview**, surface the hidden branches with probes the owner won't
volunteer:

- "Walk me through the last time you did this, start to finish."
- "Where does this break when you're on holiday?" — the single best
  branch-finder; it surfaces the tacit knowledge that lives only in their head.
- "What's the most common thing that goes wrong, and what do you do then?"
- "When do you have to ask someone else before continuing?" (→ an escalation).
- "Is there a case where you skip a step or do it differently?" (→ a branch).

People who actually do the work must be in the capture loop. An SOP written
*about* people instead of *with* them is the classic reason it goes unfollowed.
The full 10–12 question interview script is in
[`references/sop-skeleton.md`](references/sop-skeleton.md).

## The SOP skeleton

Four sections are load-bearing and appear in essentially every credible
template: **purpose, scope, responsibilities, procedure**. Everything else is
supporting structure. Mark sections mandatory vs optional-by-size:

| Section | Status | Note |
| --- | --- | --- |
| Title + ID/version | Mandatory | One process, one document. |
| Purpose | Mandatory | Why this exists, in one sentence. |
| Scope | Mandatory | What's in, what's out, when it triggers. |
| Owner (the "A" in RACI) | Mandatory | Exactly one accountable person. |
| Trigger | Mandatory | The event that starts the procedure. |
| Steps | Mandatory | The numbered/checklist/branched body. |
| Decision points | If it branches | The forks, written explicitly. |
| Quality check | Mandatory | How you know the output is correct. |
| Output | Mandatory | The defined thing produced. |
| Exceptions / escalation | If it can fail | What to do when it goes wrong. |
| RACI matrix | If >1 role | Only when the process spans roles. |
| Change log | Mandatory | Version, date, author, one-line what-changed. |
| Next-review date | Mandatory | See "Keep it alive". |

A RACI clarifies ownership when more than one role touches the process:
Responsible does it, Accountable owns the outcome (exactly one), Consulted gives
input, Informed is kept in the loop. A solo task does **not** need a matrix —
don't add ceremony the process doesn't carry. The full copy-paste template with
per-field guidance lives in
[`references/sop-skeleton.md`](references/sop-skeleton.md).

## Write it so it's actually used

SOPs go unfollowed because of the document, not the people: lack of clarity,
cognitive overload from length and jargon, and staleness. Under pressure people
default to memory over a wall of text. So write short, active, and concrete.

- **One action per step.** Two verbs in a step means a reader can do half and
  think they're done.
- **Active voice, named actor.** Who does it must be unambiguous.
- **No internal jargon** the next hire won't know — or define it once.

Bad → Good:

```markdown
Bad:  The newsletter should be reviewed and then it gets scheduled, making
      sure that everything is fine before it goes out.
Good: 1. Editor reviews the draft against the checklist in §4.
      2. Editor schedules the approved draft for 09:00 Tuesday.
      3. Editor confirms the send shows in the queue.
```

The bad version hides three actions, names no actor, and uses passive voice that
lets everyone assume someone else did the check.

## Branches and exceptions — the section people skip

Branching logic, exceptions/escalations, and the change log are the three
sections SOPs most often omit, and the reason they fail in production. Write the
fork explicitly; don't bury it in prose.

```markdown
Step 4 — Check the invoice total.
  - If total ≤ €1,000 → approve and proceed to Step 5.
  - If total > €1,000 → route to Finance lead for sign-off, then Step 5.
  - If the PO number is missing → STOP. Escalate to <owner>; do not approve.
```

Every exception needs a named escalation target and a clear stop condition. "If
unsure, ask someone" is not an escalation — name the role and the trigger. You
don't need a sprawling flowchart for three forks; inline `if X then Y` lines are
enough until the branch count makes a decision table or flowchart clearer (see
"Pick the format").

## Keep it alive

An SOP without an owner and a review date is already dead. Every SOP carries:

- **One accountable owner** — the person who answers for the outcome.
- **A change log** — version, date, author, one line on what changed. Without
  it, nobody trusts which version is current.
- **A next-review date.** Reviews are annual minimum *plus* trigger-based: after
  a process or tool change, after an incident, or after an audit.

Treat an SOP unreviewed for **18+ months as unreliable** — it likely describes a
process that no longer exists. When the review fires, re-run the capture loop on
the diff, not the whole document.

For **regulated** quality systems (GxP, formal approval workflows, audit-trail
sign-off), write the operational content here and hand the approval/gating
framework to [`compliance`](../compliance/SKILL.md). Once the SOP is stable and
you want the steps executed automatically, hand it to
[`automation-flows`](../automation-flows/SKILL.md).

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Keystroke-level SOP ("click Settings, then…") | Bloats the doc; rots the day the UI changes | Keep SOP at who/what/when; link work instructions |
| Flat numbered list for a branching process | Hides the forks that break under pressure | Use a decision table / flowchart for branches |
| Happy-path only, no exceptions | Breaks the first time reality forks | Write `if X then Y` + a named escalation |
| No owner, no review date | Goes stale silently, nobody trusts it | Name one accountable owner + a next-review date |
| Written *about* the doer, not *with* them | Misses tacit steps; gets ignored | Interview/record the person who runs it |
| Inventing steps the recording never showed | Ships a procedure that doesn't match reality | Flag gaps; capture the missing step, don't guess |
| Wall of passive-voice prose | Cognitive overload; people fall back to memory | One action per step, active voice, named actor |
| RACI on a solo task | Ceremony the process doesn't carry | Add a matrix only when >1 role touches it |

## Reference

Pull the full fill-in template, the 10–12 question capture interview script, the
format-selection decision table, and a complete worked Bad→Good example SOP from
[`references/sop-skeleton.md`](references/sop-skeleton.md). Keep this body lean;
reach for the template when you're actually drafting.
