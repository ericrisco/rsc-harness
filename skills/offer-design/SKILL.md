---
name: offer-design
description: "Use when deciding what a buyer receives, why it solves their problem, and which promises, extras and conditions the seller can support. Produces an evidence-backed offer brief. NOT setting price levels (that is `pricing`) or writing the page (that is `landing-copy`)."
tags: [offer, value-proposition, differentiation, guarantee, deliverables, commercial-terms]
recommends: [customer-research, pricing, sales-funnel, vsl-script, landing-copy]
origin: risco
---

# Offer design — a promise the business can fulfill

Define the exchange between seller and buyer before expressing it in a landing or video. An offer can be a paid service, a product, a trial or a free tool. Respect the actual business model; a free project does not need an invented price, bonus or refund promise.

## Read the facts once

Load existing buyer research, product facts, approved terms and campaign artifacts. Identify the buyer's desired result, the current alternative, available proof and delivery constraints. Missing buyer evidence goes to `customer-research`; choosing price levels, tiers and margin floors goes to `pricing`. You can draft around an unknown, but mark it as proposed or unresolved.

Use the user's approved price and conditions. Never replace them because a template favors a different offer. If two artifacts disagree, identify their revisions and resolve the conflict from owner-approved terms; otherwise ask which is authoritative before treating either as settled.

For an authorized saved campaign, reuse its location or write `02-DOCS/wiki/marketing/<campaign>/offer.md`, linked from `02-DOCS/wiki/index.md`. Give the offer a stable ID and revision, with the research revision it consumes. Analysis-only requests stay in the response.

## Construct the promise from delivery outward

Work through four connections. Each needs an answer or a visible unresolved decision.

| Connection | Decision to make |
| --- | --- |
| Buyer problem → promised result | Which specific result matters to this segment, and what remains outside the seller's control? |
| Result → deliverable | What does the buyer actually receive, when does work start, and what counts as completion? |
| Deliverable → reason to believe | Which real product behavior explains the result, and what evidence supports each step? |
| Commitment → operating capacity | Who must do the work, what inputs are required, and what limits the number of buyers served? |

Separate **deliverables the seller controls**, **outcomes that depend on the buyer**, and **aspirations still awaiting evidence**. A compelling aspiration is not permission to promise it.

### Explain the mechanism without inventing an invention

Describe the causal chain in plain language: product action → intermediate effect → buyer benefit. Link each step to an evidence ID or label it a hypothesis. Compare it with the buyer's current alternative, not an invented weak competitor.

A familiar method can still be useful. Claim exclusivity only when established; naming a method does not make it proprietary. Use a demonstration of verified behavior when outcome evidence is absent. Label synthetic examples as demonstrations, never customer results.

### Reconcile promises with capacity

Calculate the simplest delivery ceiling from supplied constraints: available hours divided by required hours per engagement, for example. Include support, review and rework if known; if not, identify the calculated ceiling as an upper bound. State customer prerequisites and when any delivery clock starts. Do not turn an unmeasured turnaround into a deadline guarantee.

For extras, specify the buyer obstacle each removes and its delivery cost. Keep extras that make the core offer easier to use. A reference value requires a real, relevant basis; without one, describe the utility without a currency valuation. Scarcity requires an actual constraint and current availability, not merely a theoretical capacity ceiling.

### Design terms as decisions, not decorative copy

Keep approved conditions exact. New terms are proposals until approved, including support limits, refund windows and availability. For a proposed remedy, state the triggering condition, eligible buyer action, remedy and operational owner. Discuss feasibility before recommending a guarantee the seller cannot honor.

An absent voluntary guarantee does not establish that all sales are legally final. Preserve known terms and flag missing policy for its owner; use `terms-conditions` when legal drafting is requested. Do not invent rights or waive existing obligations.

## Deliver the offer brief

Provide a usable version now, separating approved facts from proposals:

- **Identity:** offer ID/revision, buyer segment, source research revision and primary action.
- **Promise:** intended result, qualified wording, exclusions and dependencies.
- **Delivery:** included items, completion definition, required buyer inputs, timing basis and support boundary.
- **Differentiation:** causal explanation, relevant alternative and evidence IDs for demonstrable claims.
- **Commercial terms:** approved price, currency, tax treatment, payment schedule and policies; unknowns remain explicit.
- **Proof map:** claim → source → what it establishes → publication/use status. Private interview insights can guide the offer without becoming public testimonials.
- **Open decisions:** proposed changes, accountable owner and what must be resolved before publication.
- **Validation:** one remaining uncertainty, a practical check and the result that would change the offer.

If no single package dominates, compare a small number against the same buyer need, evidence and capacity constraints. Recommend one and explain the trade-off. Do not assign invented conversion percentages.

When revising an offer, list changed terms and affected artifacts. The landing, VSL and funnel must name the same approved offer revision before publication. A price change is incomplete while a linked video still quotes the old price. Hand off the brief; generating copy, publishing pages and taking payments remain separate tasks.

## Failure modes

| Failure | Correction |
| --- | --- |
| A new name is the only differentiator | Explain an observable process difference or narrow the comparison honestly. |
| Every buyer objection becomes another bonus | Check whether the core delivery itself needs improvement. |
| The cheapest package requires unbounded labor | Bound fulfillment first and route economic decisions to `pricing`. |
| Unknown terms disappear into confident copy | Preserve proposal status through the landing and video handoffs. |

This skill's evidence and feasibility decisions need semantic review. A grep cannot establish that a promise is supported; use the capability eval rather than a decorative artifact checker.

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
