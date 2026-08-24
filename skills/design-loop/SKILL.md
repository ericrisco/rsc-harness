---
name: design-loop
description: "Use when something must be built well and there is a real reference it should beat: turn what makes the reference good into measured mechanisms, then run a builder and three fresh-context critics until all three pass. Fires on 'design loop', 'make it as good as <site>', 'it looks generic'. NOT keeping an already-won look (that is `design-dna`)."
tags: [design, critique, loop, reference, quality, convergence]
recommends: [design, design-dna, marketing, nextjs]
origin: risco
---

# Design Loop — the front door of the design area

*A reference you can open, mechanisms you can check, and three judges who did not build the thing.*

This is where a design request **enters**. It owns the method: the bar, the judges, the rounds. It
does not own the visual system — `../design/SKILL.md` does, and this skill invokes it as the builder.

**Why the method and not a rubric.** A rubric scored by whoever built the piece measures *intent*,
because the builder knows what they were going for and so they see it there. And scores drift upward
every round: a 7 that becomes an 8 with nothing changed is how a loop declares itself finished early.
Binary verdicts from someone who did not build it are the fix for both.

Four phases. Do not skip ahead, and do not start building during 1 to 3.

## Phase 1 — Interview

Ask exactly these three, together, then stop and wait.

1. What are you building, and how long or how big?
2. Name something that already does this brilliantly — a site, a video, a doc, anything I can open.
   If nothing comes to mind, say skip.
3. Any files I should work from? Design system, brand doc, script, existing draft.

**A vague bar is the number one reason this method fails.** If they name something vague ("Apple's
website", "good SaaS design"), push once for the specific page or file: a critic with no concrete
reference invents the comparison and approves everything on round one.

On *skip*, propose three candidate bars, one line each on why, and wait. No answer → take the
hardest one and say so. **Where they come from:** `../design/references/starting-point.md` — run its
step 0 first, because a bar the project already owns outranks anything you would pick from outside,
and proposing from memory is how this promise used to resolve to the AI-template median.

**Where to go looking.** For a whole page to beat, and for the flows and single patterns behind it:
`../design/references/inspiration-sources.md`. For a component idea rather than a whole reference:
`../pick-ui-library/references/component-galleries.md`. Browse for the technique, never to clone a
competitor's exact grid — and come back with **a specific page you can open**, because a gallery
is not a bar.

## Phase 2 — Preflight

A check, not a question. Run it before any work and report in one block.

- **Fetch the bar now.** Screenshot the URL or read the file. Blocked or missing → say so, ask for
  another. Never substitute a description from memory.
- **Confirm you can render our output**: screenshots for a site, a filmstrip for animation, a PDF
  render for a doc.
- **Name the generation tools the goal needs** (image, video, voice) and confirm they are connected.
- **Confirm the input files exist**: design system, brand doc, script.
- **Read the harness identity if it exists** — `02-DOCS/wiki/brand/`, reached from the root
  `CLAUDE.md` `## Brand & voice` section, the same place `design`, `marketing` and
  `presentations` read. A bar from outside cannot silently overrule the identity this project
  already committed to: if the reference contradicts it, say which rule conflicts and let the
  user decide which one wins. If no identity exists yet, say so — this run is what creates it.

Then print what is working, what is missing, and **which critic goes blind** if something is
missing. Never carry on quietly with a critic that cannot see — a verdict from a judge who cannot
see the thing is worse than no verdict, because it looks like evidence.

## Phase 3 — Teardown

Read the reference properly and write **5 to 7 mechanisms** to `bar.md`.

Mechanisms, not adjectives. "Feels premium" is useless. These are useful:

- headline is 5x body size, three type sizes total
- one accent colour, used at most twice per screen
- motion always resolves in one direction
- nothing animates for under 400ms
- whitespace above the fold is at least 40% of the frame

Every line must be something a critic can check by looking. Show `bar.md` to the user before
continuing — and where a mechanism contradicts the harness identity, mark the conflict rather
than resolving it silently in favour of the reference.

## Phase 4 — Loop

Split the goal into the smallest pieces that can be improved and judged on their own. You choose
them. Keep it to three or four unless told otherwise: **every extra piece multiplies the run, and so
does every extra round.**

For each piece: fan out a builder, then three critics, each with fresh context and no knowledge of
how the builder worked.

- **Brief critic** — judges against the stated goal only. Does it do the thing? Ignore aesthetics.
- **System critic** — judges against the project's design system only. Objective adherence.
- **Craft critic** — judges against `bar.md` and rendered output only. Put ours next to the
  reference blind, labels stripped, say which is better, name the single biggest gap.

Write each critic's brief yourself, adapted to this goal. Do not reuse generic wording across
different goals.

### Rules

- **Critics judge rendered output, never the code.** Reading the implementation makes a critic
  evaluate intent instead of result.
- **Binary verdicts, not scores.** Scores drift upward every round.
- **Critics are harsh, and harshness has a floor.** A critic has explicit permission to say a piece
  passes. A judge under standing orders to find fault will manufacture one, and then "all three must
  pass" is a door that recedes as you approach it.
- **All three must pass.** Any fail goes back to the builder with the single biggest gap named — one,
  not a list.
- **No fixed round count.** The exit is winning, or the user stopping the run, or the halt below.

### The halt — how this loop is allowed to end

Fresh-context critics cannot see the gap history, so nothing arbitrates across rounds. Left alone,
two incompatible gaps ("more air" / "more density") make the builder ping-pong forever, and the only
brake is a human watching. Keep the gap history and use it:

> **The same biggest gap named twice for the same piece halts that piece.** Put the two competing
> demands side by side and ask the user to decide. Do not spend a third round on it.

This is not a nicety. A loop whose declared exit is "all three pass" and which cannot detect that it
will never get there is a gate that cannot close.

### Progress and cost

Keep a live progress page: piece status, each critic's verdict, gap history, round count.

There is **no reliable self-reported token cost, so do not show one.** Show round count and pieces
instead. If the user names a ceiling, treat it as a checkpoint: pause and ask before passing it, and
tell them plainly that the real brake is them watching and stopping the run.

## When the piece wins

Hand the winner to `../design-dna/SKILL.md` to codify it: measured ratios, bans and tests that can
fail, so piece eight still sits beside piece one as a set. Winning once and not writing down why is
how the look drifts back to generic by the fifth piece.

## What breaks this

| Symptom | Cause | Fix |
|---|---|---|
| Everything approved on round one | Vague bar | Push for the specific page or file |
| Approvals that do not survive a second look | Builder judged its own work | Critics need fresh context |
| Verdicts creep upward each round | Scores instead of binaries | Binary job, not a score |
| Loop never exits | No halt on a repeated gap | Apply the halt above |
| Loop exits with the piece still weak | Fixed round count | The exit is winning |
| Obeys the letter, misses the point | Over-specifying | Every extra instruction is one fewer decision the model makes with its own judgment |

## Hand-offs

- **The visual system, brand grounding, page composition** → `../design/SKILL.md`. It is the builder
  this loop invokes; it stays reachable directly when there is no bar to beat and no loop to run.
- **Codifying the winner into a permanent identity** → `../design-dna/SKILL.md`.
- **The words** → `../marketing/SKILL.md`. **The build** → `../nextjs/SKILL.md`.
- **Motion craft, and routing among the frontend craft siblings** → `../design-eng/SKILL.md`.
- **"Show me a few versions and I'll pick"** → `../prototype/SKILL.md`. That is selection among
  variants; this is convergence against a bar.
- **SDD gate.** This skill runs a method; it does not outrank the chain. If the request is a new
  feature or a non-trivial behaviour change in a real app, `../specify/SKILL.md` runs first, then
  `plan`, then the loop builds what was approved.
