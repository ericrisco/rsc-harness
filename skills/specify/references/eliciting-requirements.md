# Eliciting requirements — infer first, then ask one thing

The whole point of this skill is to reach a complete-enough spec with the
fewest questions. That means inferring hard before asking, and asking surgically
when you must. This reference holds the inference checklist and the elicitation
patterns the SKILL body summarizes.

## Inference checklist — answer these from existing material before asking

Run down this list using the `constitution`, the existing wiki, sibling specs,
and the intent itself. Only what survives as unknown becomes a question or a
*point to clarify*.

- **Problem** — does the intent already state the pain, or only the wanted
  feature? If only the feature, the problem is the first thing to recover.
- **Primary user** — who triggers this? The constitution's ICP / users article
  usually answers it.
- **Trigger** — what event or need makes someone want this? Often implicit in
  the intent.
- **Success** — what does the user get that they didn't have before? That's a
  goal, in outcome terms.
- **Boundaries** — what's adjacent but deliberately excluded? Derive non-goals
  from the constitution's scope and quality bars.
- **Happy path** — the common-case behaviour is usually inferable from the
  intent; write it, then test it with the user if L2/L3.
- **Edges** — empty / none / one / many / max, concurrent, repeated, expired,
  unauthorized. Walk these mechanically; each is a candidate criterion.
- **Errors** — what does the user see when it fails, and what must NOT be
  revealed? Security/privacy constraints often live in the constitution.

What you genuinely cannot resolve here is exactly what `clarify` exists for.
Naming it is the correct outcome, not a failure.

## The frontier pattern

A gap earns a question only if a *different answer would change the contract*.
Apply this test before asking:

> "If they answer A vs B, does a goal, a user, the scope, or an acceptance
> criterion change?" — No → don't ask; infer or type it as a point to clarify.
> Yes → it is a question.

Then decide *when* to ask it. Model the gaps as a tree: every decision branches
into the decisions hanging off it. The **frontier** is every gap whose
prerequisites are already settled — what you can ask now without guessing at
answers you have not heard. Ask the whole frontier in one round; ask nothing
that depends on an answer still pending in that same round.

```text
Round 1 (frontier: 3 independent gaps)
❓ **Q1 — <title>**: <body, options if you have them>
➡️ <your recommended answer>
---
❓ **Q2 — <title>**: …
➡️ …
---
❓ **Q3 — <title>**: …
➡️ …

→ user answers → fold in → recompute the frontier → Round 2
```

Where the harness offers a native question selector, emit the round through it;
otherwise emit the numbered text above. Same content either way.

**Facts are yours, decisions are theirs.** A gap that needs a fact from the
environment (a file, a config, a version) is legwork, not a question: go find
it. Don't block the round on it — a running search is an unsettled prerequisite,
so only its dependents wait. Ask the rest of the frontier now.

**A frontier of one** is one question, and needs no apology. **A frontier of
zero** is silence: never invent a question to look diligent.

**If an answer redefines a question you already emitted this round**, say so and
drop it. Re-ask it next round. An answer given under a premise that has since
moved is worse than no answer, because it looks settled.

Phrase by register:

- **Non-technical / L3** — plain language, one concept, offer a concrete
  example to react to rather than an open void:
  > "When someone's link has expired, should they be able to ask for a fresh
  > one right there, or is that a separate step?"
- **Technical / L0-L1** — terse, decision-shaped:
  > "Expired-link recovery in scope, or defer?"

Always: emit the round → wait → record each answer in its section → confirm at
L2/L3 → recompute the frontier. The thing to avoid was never two questions in
one message; it was ten questions whose answers depend on each other, which is
what crossing a dependency produces.

## Turning answers into testable criteria

Once you have an answer, convert it immediately to a Given/When/Then so it's not
lost as prose:

```text
Answer: "Yes, they can request a new link from the expired page."
becomes
Given an expired link, When the user opens it, Then they see a "request a new
link" action that issues a fresh one.
```

If the answer is fuzzy ("it should feel fast"), do not invent a number — push
once for a concrete figure; if none is available, file it as a
**suposición tomada** with its basis and its risk, which is what makes it
something `clarify` can validate instead of re-ask.

## When to stop

Stop when the frontier is empty: every branch visited, nothing left silently
assumed. Then run the exit gate (`npm run spec:gate <path>`) on the written
file — the bound is a property of the artifact, not of your confidence.
Lingering unknowns are fine, and belong in *Points to clarify*, typed. Over-asking to feel thorough is itself an anti-pattern: it burns the
user's patience and pushes them to rubber-stamp answers they haven't thought
through. A short spec with three honest open points beats a long spec with three
fabricated ones.
