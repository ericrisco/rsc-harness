# Concept Landing Recipe — The Per-Concept Output Template

This is the deliverable. For every concept that survives the gap map (`course-analysis.md`), you produce one landing recipe: seven beats, in order, that take the student from "don't care / don't believe" to "I get it, I can do it, and I love whoever taught me this." It's the assembly line that runs the Brunson frameworks (`brunson-frameworks.md`) and the named models (`mental-models.md`) into a single shippable lesson unit.

---

## The seven beats

```text
LANDING RECIPE — <concept name>
1. HOOK ............. the tension/question that makes them lean in (open a loop)
2. EPIPHANY STORY ... backstory -> desire -> wall -> epiphany -> new opportunity -> result
3. MENTAL MODEL .... the named, ownable idea (the label they repeat)
4. GROUNDED ANALOGY  the concrete metaphor from THEIR world that makes it tangible
5. PROOF / DEMO .... show it working: a demonstration, before/after, or real receipt
6. APPLICATION ..... do-this-now: the smallest action that makes the idea theirs today
7. SO-WHAT ......... future-pace the payoff: what's now possible, why it mattered
```

### What each beat must do

| Beat | Job | Fails if |
| --- | --- | --- |
| **Hook** | Open a curiosity/tension loop in the student's world | It's an agenda slide or a definition |
| **Epiphany story** | Make the realization happen *in* them (6 beats, true) | The conclusion is stated, not arrived at |
| **Mental model** | Give a sayable, picturable, ownable name | Unnamed, or named in jargon |
| **Grounded analogy** | Map the mechanism onto something they know | Vibe-only; parts don't correspond |
| **Proof / demo** | Show it's real, not just plausible | Asserted, or fabricated |
| **Application** | Smallest action that makes it theirs today | "Go practice" with no concrete first step |
| **So-what** | Future-pace the payoff; close the loop | Ends on a recap/summary |

### Ordering rules

- **Hook before story.** Earn the lean-in before you spend their attention on a story.
- **Story before model.** The model's name only sticks if it's the punchline of a story they felt.
- **Break the belief inside the story.** The wall + epiphany beats do the false-belief work (→ `brunson-frameworks.md`); don't bolt on a separate "objection handling" section.
- **Analogy after the name, not instead of it.** Name first (so they can repeat it), then make it concrete.
- **Application before so-what.** Let them act, *then* feel the future payoff of having acted.

---

## Fully worked example — Before → After

A dry, accurate, forgettable lesson on a real concept, rebuilt into one the student loves.

### BEFORE (the flat lesson — every gap-map flag fires)

```text
Concept: Idempotency

Idempotency is a property of certain operations in computer science whereby they can be
applied multiple times without changing the result beyond the initial application. In the
context of HTTP, methods such as GET, PUT, and DELETE are idempotent, whereas POST is not.
To make a POST endpoint idempotent, one can use an idempotency key supplied by the client,
which the server stores and uses to deduplicate requests. This is important for reliability.
```

Why it fails: `no-story`, `unnamed`, `no-analogy`, `jargon-dense` (idempotency, HTTP methods, deduplicate), `no-application`, `no-so-what`, and it never breaks the student's false belief that "retrying is dangerous." It's correct and dead.

### AFTER (the landed lesson — seven beats)

```text
1. HOOK
   "Have you ever double-clicked a 'Pay' button, then sat there sweating, wondering if you just
    paid twice? Hold that feeling — because your users feel it about YOUR system every day."

2. EPIPHANY STORY  (six beats; illustrative, fictional — a real lesson uses the user's true story)
   - Backstory: "Two years in, I owned payments. 4am, on call."
   - Desire:    "I just wanted failed charges to retry on their own so I could sleep."
   - Wall:      "My retry fired before the first response came back. We charged 4,000 people twice.
                 Refunds, apology emails, the worst morning of my career."  (breaks the INTERNAL
                 belief 'I can't be trusted with retries' — it's not you, it's the design)
   - Epiphany:  "A senior eng asked one question: 'What if the second request just... did nothing?'
                 The bug wasn't retrying. It was that the server couldn't tell 'try again' from
                 'do it again.'"
   - New opp:   "Design the operation so doing it five times equals doing it once."
   - Result:    "We shipped one idempotency key. Retries became free. I slept."

3. MENTAL MODEL
   "The Elevator Button. That's the whole idea. Remember it by that name."

4. GROUNDED ANALOGY
   "Press the elevator call button. It lights up; one elevator is coming. Now press it five more
    times. Still one elevator. The button already knows it's been pressed — extra presses change
    nothing. An idempotency key is that 'already lit' state for your API: the first request lights
    it; duplicates see the light and do nothing.
    (Where it breaks: a real elevator comes no matter what; your API needs the KEY to recognize the
    duplicate — that recognition is the part you build.)"

5. PROOF / DEMO
   "Watch: I send the same request with the same idempotency key five times." [show the log]
   "Five requests in. One charge out. Here's the dedupe in the response — same charge ID every time."

6. APPLICATION  (do-this-now)
   "Before you close this lesson: open your most dangerous POST endpoint — the one that moves money
    or sends something. Add one header: `Idempotency-Key`. Store it, check it before you act. That's
    your first idempotent endpoint, today."

7. SO-WHAT  (future-pace)
   "Next time a deploy fails at 5pm and the retries start firing, you won't lunge for the kill switch.
    You'll watch them retry, safely, and go home. You just stopped being the engineer who fears the
    pager and became the one who builds systems that forgive themselves."
```

```text
Notice what changed:
- The DEFINITION still appears — but at beat 2's "new opportunity", AFTER they want it.
- Jargon ('deduplicate', 'HTTP methods') is replaced by the elevator picture.
- The student leaves with a NAME they'll repeat, a first ACTION, and an identity shift.
- Both journeys are present: the skill (add a key) and the identity ("the one who...").
```

---

## Assembling a module

Run the recipe per concept, then thread them on the reworked narrative spine from `course-analysis.md`:

```text
MODULE OUTPUT
- Big Domino: <the one belief>            (e.g. "retry fearlessly: outages stop being scary")
- Opening hook: <module-level lean-in>
- Concept 1 landing recipe  (breaks belief A) ─┐
- Concept 2 landing recipe  (breaks belief B)  ├─ each topples a domino toward the Big Domino
- Concept 3 landing recipe  (breaks belief C) ─┘
- Closing future-pace: <who they've become + what they can now do>
```

Then run the QA gate in `SKILL.md` and `scripts/verify.sh`. Every gap-map flag that fired in the BEFORE must be cleared in the AFTER.

## See Also

- `../SKILL.md` — the seven-beat recipe is the skill's core deliverable; the QA gate checks it.
- `brunson-frameworks.md` — the Epiphany Bridge (beat 2) and false-belief breaks inside the story.
- `mental-models.md` — the named model (beat 3) and grounded analogy (beat 4) craft.
- `course-analysis.md` — the gap map that decides which concepts need a recipe, and the spine that threads them.
