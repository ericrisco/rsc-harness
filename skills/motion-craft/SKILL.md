---
name: motion-craft
description: "Use when an interface moves and the movement has to feel right — durations and easing, what must never animate, fixing motion that reads sluggish, cheap or janky, and reduced-motion. Web and native. NOT the visual system (that is `design`), NOT the graded critique (that is `design-loop`)."
tags: [motion, animation, interface, craft, frontend]
recommends: [design]
profiles: [full]
origin: risco
---

# Motion craft — movement that reads as intent

Motion is not decoration laid over an interface. It is the interface **explaining what just
happened**: what appeared, what it came from, what is still loading, what the user just did. When
motion feels wrong the complaint is almost never "the curve is off" — it is "this feels cheap", or
"slow", or "I don't know what happened". Those are the symptoms this skill exists to convert into
decisions.

## The one rule

**Every animation answers a question the user is already asking.** If you cannot name the question,
delete the animation — it is costing time and attention and returning nothing.

| The user is asking | The motion that answers it |
| --- | --- |
| "Where did this come from?" | It enters from its origin, not from nowhere |
| "Is it working?" | Immediate feedback, under 100ms, even before the result |
| "What did I just do?" | The changed thing moves; nothing else does |
| "Where did it go?" | It exits toward where it can be found again |
| nothing | **no animation** |

That table is the whole method. Everything below is how to honour it without shipping something
that janks.

## Duration: the only numbers worth memorising

Movement is read as *slow* long before it is read as *long*. The usable range is narrower than most
people expect, and the mistake is almost always **too slow**, not too fast.

| What moves | Range | Why |
| --- | --- | --- |
| State on an element already on screen (hover, toggle, press) | 100–150ms | It must feel like a response, not an event |
| Something entering or leaving in place (menu, tooltip, toast) | 150–250ms | Long enough to be seen, short enough not to be waited for |
| A region rearranging (list reflow, panel) | 250–350ms | Bigger travel needs more time to stay legible |
| A full view transition | 300–400ms | The ceiling. Past 400ms it is a wait, not a transition |

Two rules that come from those numbers, not from taste:

- **Exits are faster than entrances**, usually by about a third. The user has already decided; making
  them watch the decision leave is the single most common way an interface feels sluggish.
- **Distance and duration scale together, sub-linearly.** Doubling the travel does not double the
  time. If a value grows past 400ms because the element crosses the screen, the layout is the
  problem, not the timing.

## Easing: three curves cover almost everything

- **Entering, or responding to input** — start fast, settle slow (`ease-out` family). The user's
  attention is already there; arriving quickly and settling reads as responsive.
- **Leaving** — start slow, accelerate away (`ease-in` family). It matches how the eye lets go.
- **Moving between two on-screen positions** — accelerate and decelerate (`ease-in-out` family).

**Linear is for one thing only: continuous, non-positional change** — a progress bar filling, a
spinner rotating, a colour crossfade. Linear on anything that moves in space reads as mechanical,
because nothing physical starts at full speed.

Springs are worth reaching for when the motion should feel *physical* — dragging, dismissing,
anything the user's finger or pointer is still in contact with. They are the wrong tool for
appearing and disappearing, where a bounce reads as indecision.

## What must never animate

This is where most jank comes from, and it is not a matter of degree.

- **Never animate layout.** Width, height, top, left, margin, padding — each frame forces the engine
  to recompute geometry. Animate transform and opacity, which do not.
- **Never `transition: all`.** It is the shortest path to animating layout by accident. List the
  properties.
- **Never animate what the user is reading.** Text that moves while being read is illegible.
- **Never block input on an animation.** The interface accepts the next action immediately, even
  mid-motion. An animation that must finish before the user may act has become a modal dialog.
- **Never animate more than one thing per event.** If three things move when one changed, the user
  cannot tell which one mattered.

## Reduced motion is not an edge case

A real share of people have vestibular conditions for which large movement is nauseating, and they
have told their operating system so. Honouring it is not optional and it is not a fallback to
nothing:

- **Keep** the feedback: opacity changes, colour, instant state.
- **Remove** the travel: no sliding across the screen, no scaling, no parallax, no auto-playing loops.
- The interface must still say what happened — it just says it without moving.

An implementation with no reduced-motion branch is unfinished, the same way an interface with no
error state is unfinished.

## Diagnosing motion that feels wrong

The complaint names the symptom; this maps it to a cause.

| Complaint | Usually | Fix |
| --- | --- | --- |
| "Sluggish" | Duration too long, or the exit matches the entrance | Cut to the range above; make exits faster |
| "Cheap" / "amateur" | Linear easing on positional movement, or bounce on entrances | Match curve to direction |
| "Janky" / "stutters" | Animating layout properties | Move to transform and opacity |
| "Distracting" | More than one thing moving per event | Animate only what changed |
| "I don't know what happened" | Motion with no origin or destination | Move it from where it came from |
| "Nice, but I'd turn it off" | No reduced-motion branch, or motion that repeats | Honour the setting; never loop what is not loading |

## Anti-patterns → STOP

| If you're about to… | Reality / Fix |
| --- | --- |
| Add motion because the screen feels static | Static is not a defect. Motion with no question to answer is noise with a frame cost. |
| Copy a duration from a design you liked | You copied the number without its distance and its context. Take the range, verify against the feel. |
| Animate a list so every item cascades in | Stagger past ~4 items becomes a queue the user waits through. Cap it, or drop it. |
| Use a spring for a menu appearing | A bounce on an entrance reads as indecision. Springs are for what the pointer is still touching. |
| Ship motion without checking reduced-motion | It is not an edge case. Unchecked means unfinished. |
| Reach here for the visual system | Type, colour, spacing and composition are `../design/SKILL.md`. This skill only moves what that one placed. |

## See Also

- `../design/SKILL.md` — the visual system this motion serves.
- `../design-loop/SKILL.md` — the graded critique that judges a finished screen, motion included.
- `../design-dna/SKILL.md` — turning a look, motion rules included, into a reusable identity.
- `../accessibility/SKILL.md` — the wider ground reduced-motion sits in.
