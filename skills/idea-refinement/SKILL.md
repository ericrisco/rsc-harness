---
name: idea-refinement
description: "Use when a rough product, service, workflow or feature idea needs divergent options and assumption pressure-testing before it becomes a spec. Produces a decision brief with alternatives, evidence gaps, Not Now and a cheap experiment. NOT requirements or acceptance criteria (`specify`), NOT market sizing (`market-research`)."
tags: [ideation, idea-refinement, product-discovery, assumptions, decision-brief]
recommends: [specify, market-research, competitor-watch, ab-testing]
profiles: [core, full]
origin: risco
---

# idea-refinement — make the idea earn its direction

Use this before `specify`, while the question is still “which version of this idea is worth pursuing?” The output is not a backlog or a polished pitch. It is a short decision brief that widens the option space, exposes what is merely assumed, and recommends the cheapest sensible direction to test.

Inspect any brief, notes, product or repository already supplied before asking questions. Ask one question at a time only when the answer would change the option space. The user may delegate a choice; “use your judgment” is valid authority when the decision is reversible and the assumptions are made visible.

## The refinement loop

```text
FRAME → DIVERGE → CHALLENGE → CONVERGE → TEST
```

### 1. FRAME the real opportunity

Write five lines, no solution language yet:

- **Actor:** who is struggling, in what situation?
- **Current workaround:** what do they do now, including “do nothing”?
- **Desired progress:** what observable change would make this useful?
- **Constraints:** time, money, channel, trust, regulation, existing product.
- **Known / assumed:** separate evidence already seen from hypotheses that only sound plausible.

If the idea is phrased as a feature (“an AI dashboard”), reframe it as a problem and outcome (“operators need to spot failed jobs before customers report them”). Keep the original idea as one candidate, not as the conclusion.

### 2. DIVERGE deliberately

Produce **five to eight meaningfully different directions**. Variants that only change colors, names, pricing tiers or implementation technology count as one direction.

Choose two lenses that attack the largest uncertainty:

- **Remove / replace / combine / reverse:** change the mechanism, not the wording.
- **Job and workaround:** improve, automate or eliminate the thing people already do.
- **Constraint inversion:** assume the budget, time, data or integration is unavailable.
- **Trust ladder:** begin with advice, then approval, then automation; do not jump to full autonomy.
- **Pre-mortem:** imagine the idea failed in six months and design away the most likely cause.
- **Narrow wedge:** find the smallest audience and moment where the pain is strongest.

For each direction give: target actor, promised progress, mechanism, largest assumption, and what makes it distinct. Do not advocate yet.

### 3. CHALLENGE the attractive options

Take the three strongest directions and try to disprove them. Check:

- Does the pain happen often and cost enough to change behaviour?
- Does the user control the data, budget and permissions the idea requires?
- Is the proposal replacing a habit or tool with a worse switching cost?
- What dependency, incentive or trust failure could make the value impossible?
- Which claim could be tested this week without building the product?

State the strongest objection fairly. If an option survives only because a critical fact is unknown, label it **unverified**, not “promising.” Route market-size and demand evidence to `../market-research/SKILL.md`; route a named-rival comparison to `../competitor-watch/SKILL.md`.

### 4. CONVERGE with explicit criteria

Choose three to five criteria that fit the situation, then compare the finalists on the same scale. Typical criteria are user value, evidence strength, time to learning, reversibility, distribution access and operational risk. Weight only when one criterion genuinely dominates; decorative arithmetic is not evidence.

Make one recommendation with:

- the direction and the dominant reason;
- confidence: high / medium / low;
- assumptions it depends on;
- what was rejected and why;
- the fact that would most likely reverse the choice.

If two options remain genuinely tied, recommend the experiment that distinguishes them. Do not ask the user to choose between indistinguishable summaries.

### 5. TEST before specifying

Name the cheapest next test that can change the decision: five problem interviews, a concierge workflow, a fake-door measure with consent, a manual prototype, a pricing conversation, or a data audit. Define the signal that would support the direction and the signal that would kill it.

Only after a direction survives does it hand off to `../specify/SKILL.md` for goals, scope, behaviour and acceptance criteria.

## Decision brief

```markdown
# Idea decision — <working title>

## Opportunity
Actor · workaround · desired progress · constraints

## Evidence and assumptions
- Seen: ...
- Assumed: ...

## Directions considered
1. ...

## Comparison
Same criteria across the three finalists.

## Recommendation
Direction · confidence · deciding reason · reversal fact.

## Not Now
Ideas deliberately excluded from the first test.

## Next experiment
Method · audience · support signal · kill signal · timebox.
```

## Anti-patterns

| Smell | Correction |
|---|---|
| Brainstorming becomes an implementation plan | Stop at direction + falsifier; `plan` comes after an approved spec. |
| A long questionnaire precedes any thinking | Inspect first; ask one decision-changing question at a time. |
| A score hides missing evidence | Put the evidence gap beside the score and lower confidence. |
| The starting idea returns as cosmetic variants | Change mechanism, trust, audience, workflow or constraint. |
| Ideation continues after direction and falsifier are clear | Stop and run the cheapest distinguishing experiment. |

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el “¿instalo la skill que falta?”.)
