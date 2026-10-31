---
name: sales-funnel
description: "Use when planning the steps from an offer to purchase or booking: pages, transitions, recovery paths and measurement handoffs. NOT writing one page (that is `landing-copy`), running deals (that is `sales-pipeline`) or implementing payment (that is `stripe`)."
tags: [sales-funnel, vsl, buyer-journey, conversion, checkout, campaign]
recommends: [customer-research, offer-design, vsl-script, landing-copy, marketing, analytics, stripe]
origin: risco
---

# Sales funnel — connect the buying decisions

Turn an offer into the smallest coherent route a buyer can complete. Deliver a build brief:
which steps exist, why each exists, how people leave or recover, and what proves a step completed.
Do not turn a request for one page into a multi-page campaign.

## Establish the campaign record

Read the existing campaign and brand material before asking for missing facts. By default use
`02-DOCS/wiki/marketing/<campaign>/research.md` and `offer.md`; honor an established location instead.
Record the offer ID and revision in `funnel.md`, link its source and retain the same evidence IDs.
Index new campaign artifacts in `02-DOCS/wiki/index.md`. For an explanation-only request, respond
without saving files. Writing a brief authorizes that brief, not messages, purchases or deployment.

An existing offer can be enough; the user need not run another skill just to satisfy a sequence.
If offer documents conflict, identify the authoritative revision before treating disputed terms as
publishable. Continue with the undisputed route and visibly unresolved terms. Price, included work,
conditions and primary action must agree across all downstream handoffs.

Establish traffic source, buyer readiness, intended action, delivery method and existing pages.
Ask only for missing facts that change the route. Distinguish observations from assumptions;
use `customer-research` for missing buyer evidence and `offer-design` for an unsettled offer.

## Choose the fewest useful steps

Each added step needs a buyer reason. Price alone does not decide whether someone needs a call,
email sequence or checkout. Use the actual buying uncertainty, qualification needs and delivery
constraints. A free or open-source product can end in a trial, installation or download.

| Buyer needs before acting | Route choice |
| --- | --- |
| Understand a demonstrated offer and buy | Sales page or VSL → checkout → confirmation/delivery |
| Assess suitability with a person | Explanation → necessary qualification → booking → confirmation |
| Learn before deciding, and wants follow-up | Optional resource/capture → delivery → permissioned follow-up → offer |
| Already understands the offer | Preserve the existing short route; remove repeated explanations |

Choose one route and explain the trade-off. Add a complementary offer only when it exists and the
user's scope includes it; declining must lead onward. A VSL does not require hiding the purchase
action until a timer expires. Give people who cannot watch a readable way to understand the offer.

## Specify transitions, not just page names

For each step write: **entry context; buyer question; information/proof needed; one primary action;
success condition; next destination; decline/exit; failure/recovery; data collected; implementation owner**.
Keep the brief about decisions and handoffs. `landing-copy` writes final page text, `vsl-script`
writes the video, `marketing` writes follow-up, and the existing web stack builds the pages.

Attach each consequential claim to its evidence ID and explain the scope of support. A screenshot
of a feature proves its visible behavior, not the revenue it will generate. Carry missing evidence
as a draft gap with an owner; never fill the page with fabricated social proof.

Where money or access changes hands, map **checkout requested → pending → confirmed or failed**
separately from the pages showing them. A return URL, button click or thank-you view is not payment
confirmation. Specify the authoritative success signal as an integration requirement and have
`stripe` or the chosen provider specialist verify it against current documentation.

For pending payments, show status and a way to return or obtain help. For failure/cancellation,
preserve context and provide a deliberate retry or exit. Refreshes and revisits must not by
themselves create a new charge or repeat delivery. State the order/booking identity that persists
across retries, and require deduplication at the operation that fulfills the order. Do not claim a
hosted provider supports this until checked. Include confirmed-payment/delivery-failure recovery
when delivery is separate; a buyer should not pay again to retrieve an already-paid purchase.

## Make completion measurable

Give `analytics` an event brief, not speculative tracking code. For each important transition name
the event, its verified trigger, the entity counted, deduplication key, numerator and denominator.
Separate visits, checkout attempts, confirmed orders and fulfilled orders. Purchase counts come
from unique confirmed orders, not refreshes or callback deliveries. Report refund/cancellation
outcomes separately; do not silently redefine initial conversion.

State the observation window and attribution limits. If the account has no baseline, mark targets
unmeasured and collect one before promising a rate or choosing a winner. Route experiment design
to `ab-testing`; a sample of a few purchases does not establish a causal improvement. Collect only
data required for the journey and ask the relevant privacy/analytics skills about consent wiring.

## Deliver the brief and reconcile it

Deliver the chosen route, per-step decisions, event brief, dependency order and unresolved questions
with owners. Put payment/delivery uncertainty before cosmetic refinements in the build order.
Include a continuity check: **offer revision, price, inclusions, conditions, evidence IDs and action**
must match the page and video assignments. Name each stale artifact and the required correction.

Review the journey as a buyer who succeeds, declines, fails, refreshes and comes back later. A
complete planning brief can still be marked **implementation unverified**. Publication readiness
requires observed implementation tests; planning alone proves neither charges nor delivery work.

## Failure patterns

| Pattern | Repair |
| --- | --- |
| More screens are assumed to mean more revenue | Remove steps with no distinct buyer question or existing offer. |
| Email signup and purchase are mixed into one success rate | Define each conversion and its eligible denominator separately. |
| A polished page hides an undefined handoff | Name the completion signal, receiving owner and failure path. |

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
