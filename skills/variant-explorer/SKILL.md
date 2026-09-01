---
name: variant-explorer
description: "Use when someone wants OPTIONS rather than an answer — 'show me a few versions', picking between approaches by seeing them. Genuinely different candidates, cheap to throw away, trade-off named. NOT the critique that judges one (`design-loop`), NOT the spec (`specify`)."
tags: [prototyping, divergence, options, exploration, decision]
recommends: [design-loop]
profiles: [full]
origin: risco
---

# Variant explorer — several real options, cheap enough to discard

"Show me a few versions and I'll pick" is a different request from "build this". It asks for
**divergence**: several candidates that are actually different, each cheap enough that throwing it
away costs nothing, with the difference between them stated out loud so a human can decide.

Done badly it produces the thing that wastes the most time in creative work: three variations of one
idea, dressed up as a choice.

## The one rule

**Variants must differ in a decision, not in a detail.** If two candidates could both be reached by
editing the other, there is one candidate.

```text
Not variants:   the same layout in blue, in green, in dark
Variants:       a single scrolling page · a three-step wizard · a table with inline editing
```

The test before showing anything: **name the decision each variant is taking.** If you cannot name
it, or two share it, that set is not ready.

## How many, and how finished

- **Three.** Two reads as a false dichotomy; five past the point where a person can hold them side by
  side. Three forces the middle option to justify itself.
- **Finished enough to judge the decision, and no more.** If the decision is about structure, the
  copy can be placeholder. If it is about tone, the layout can be crude. Polish that is not being
  judged is polish you are asking someone to ignore.
- **Comparable.** Same content, same constraints, same fidelity across all three. A variant that is
  prettier wins for reasons nobody chose.

## Making them genuinely different

The failure mode is anchoring: the first idea contaminates the rest. Force divergence by generating
each from a different starting constraint.

| Angle | Ask |
| --- | --- |
| **Cheapest** | What if this had to ship this week? |
| **Boldest** | What if we ignored what similar products do? |
| **Fewest steps** | What if the user only did one thing? |
| **Familiar** | What if it worked exactly like the thing they already know? |
| **Inverted** | What if the primary and secondary swapped? |

Pick three angles that are actually in tension for this problem. Do not run all five — the point is
tension, not coverage.

## Presenting them so a decision is possible

Each candidate carries three things, and no more:

1. **What decision it takes** — one sentence, in the user's terms.
2. **What it costs** — the honest downside, not a hedge. A variant with no downside is one you have
   not thought about.
3. **What it would take to be wrong** — the fact that would kill it.

Then: **a recommendation.** Presenting three options and standing back is not neutrality, it is
handing the work back. Say which one you would pick and why, and make it easy to overrule.

## When this is the wrong skill

- The answer is already known and only needs building → build it. Manufacturing options to look
  thorough wastes everyone's time.
- The decision is reversible and cheap → just pick one and ship. Exploration is for decisions that
  are expensive to unwind.
- What is needed is a **judgement on one thing** → that is critique, not divergence.

## Anti-patterns → STOP

| If you're about to… | Reality / Fix |
| --- | --- |
| Show the same idea in three colours | Those are not variants. Name the decision each takes; if you cannot, you have one. |
| Polish one candidate more than the others | It will win on polish, not on the decision. Same fidelity, always. |
| Present five or six to be thorough | Past three, they stop being compared and start being skimmed. |
| Give options with no recommendation | Standing back is not neutrality; it hands the work back to the person who asked. |
| Explore a decision that is cheap to reverse | Just ship one. Divergence is for what is expensive to unwind. |
| Keep iterating on the winner here | Once one is chosen, refining it is `../design-loop/SKILL.md` or the relevant build skill. |

## See Also

- `../design-loop/SKILL.md` — the graded critique that takes over once a direction is chosen.
- `../specify/SKILL.md` — when what is missing is an agreed WHAT/WHY, not options.
- `../design/SKILL.md` — building the chosen direction properly.
