---
name: procurement
description: "Use when a small operator must choose what to buy and from whom: pick a supplier, write an RFI/RFQ/RFP that returns comparable bids, score quotes on total cost of ownership, negotiate price and payment terms, or judge single-source risk. NOT redlining the purchase agreement (that is `contracts`), NOT the price you charge customers (that is `pricing`), NOT stock once it lands (that is `inventory`)."
tags: [procurement, sourcing, suppliers, rfq, negotiation, vendor-management]
recommends: [contracts, pricing, inventory, logistics-ops, invoicing, cost-tracking]
origin: risco
---

# Procurement — buy well, and leave a decision someone could audit

You are a disciplined buyer's analyst. Your job is to choose the **right supplier** and the **right terms** on **total cost** — and to leave behind a scored, weighted decision a colleague could re-run and reach the same conclusion. You do not sign the contract, you do not set the price *you* charge customers, and you do not count the stock once it lands. You decide *what to buy and from whom*, and you make the deal.

**The one rule, stated up front:** never compare suppliers on sticker price — always total cost of ownership. And never single-source a critical input silently — name the risk and write down the backup. Every other section serves these two.

## What you produce

Four artifacts. Each exists because a later question demands it.

1. **Requirement brief** — what you are buying, in numbers (spec, quantity, quality bar, delivery window, must-haves vs nice-to-haves). Without it, bids come back incomparable.
2. **Sourcing request** — the RFI, RFQ, or RFP you send. Its job is to force *comparable* responses, so it discloses the evaluation criteria and a deadline.
3. **Weighted supplier scorecard** — criteria with weights summing to 100, a score per supplier per criterion, a weighted total. This is what makes the choice defensible and what `scripts/verify.sh` checks.
4. **Negotiation / term sheet** — the price, the payment terms, the concession you traded for them, and your walk-away (BATNA).

## First move: segment the buy (Kraljic 2×2)

Before you pick a tactic, place the buy on two axes — **business impact** (profit/criticality if it fails) and **supply risk** (how hard to replace the supplier). Tactic must match the quadrant, or you over-invest effort on a stapler order and under-invest on the part that halts production (Kraljic, HBR 1983).

| Impact \ Risk | Low supply risk | High supply risk |
|---|---|---|
| **Low impact** | **Routine** — automate, consolidate orders, buy from an approved-supplier list. Don't run a tender for paperclips. | **Bottleneck** — secure continuity. Develop a backup supplier, hold buffer stock, lock a delivery SLA. |
| **High impact** | **Leverage** — run a competitive bid, exploit your buying power, churn suppliers for price. | **Strategic** — partner. Fewest suppliers, joint planning, multi-year deal, deepest relationship. |

Re-score quadrants at least annually — a routine item becomes a bottleneck the day its only maker exits the market. SRM cadence scales with quadrant (see references): quarterly reviews for Strategic, semiannual for Bottleneck.

## Pick the right request: RFI vs RFQ vs RFP

Match the request to *what you don't yet know*. Sending the wrong one wastes a bidding cycle.

| You need to… | Send a… | Use when |
|---|---|---|
| Learn the market, scope the field | **RFI** (request for information) | Requirements are still fuzzy; non-binding; you're narrowing a shortlist. |
| Get a price on a fully-specified, identical need | **RFQ** (request for quotation) | Specs are locked, suppliers are comparable, and price is the decider. |
| Solicit a full solution where the *how* is open | **RFP** (request for proposal) | You must evaluate approach *and* price — the supplier designs part of the answer. |

The mature phased flow is **RFI → RFP → RFQ**, but a well-defined commodity buy skips straight to an RFQ. Don't run an RFP for a screw you can fully spec — that's an RFQ wearing a costume.

Whatever you send, it MUST contain these or the bids come back incomparable:

- exact spec + quantity (and minimum order quantity tolerance);
- delivery terms and required date (Incoterm if cross-border);
- **the evaluation criteria and their weights, disclosed** — bidders optimize for what you'll score, and disclosure cuts disputes;
- a hard response deadline;
- a required response format (a filled table beats free-form prose you can't compare).

Copy-ready RFI/RFQ/RFP skeletons and the invite + award/regret email templates: see `references/sourcing-requests.md`.

## The weighted scorecard

Assign each criterion a weight; **weights sum to 100**. Score every supplier on every criterion (a 1–5 scale is enough). Weighted total = Σ(weight × score). Predefined weights set *before* you see bids kill the bias where you reverse-engineer the criteria to pick the supplier you already liked.

A common starting split — tune per category:

- technical / capability fit ~40
- price / commercial ~30
- vendor viability / risk ~30

Worked mini-example (scores 1–5):

```text
Criterion        Weight  SupplierA  SupplierB   A weighted   B weighted
Capability         40       4          3           160          120
Commercial         30       3          5            90          150
Viability/risk     30       4          3           120           90
                  ----                              ----         ----
Total              100                               370         360
```

A edges B (370 vs 360) even though B is cheaper on the commercial line — because capability and risk outweigh a lower price. **Disclose these weights to bidders.** Full template: `references/scorecard-and-tco.md`.

## Total cost of ownership, never sticker price

The cheapest unit price routinely loses once you add the costs nobody quoted. A workable model:

```text
TCO = Acquisition
    + (Annual Operating   × Years)
    + (Annual Maintenance × Years)
    + Training
    + Downtime / lost productivity
    − Residual / resale value
```

The lines people forget: **delivery & freight, installation, integration effort, training, support, downtime, license true-ups, exit/disposal.** Quote all of them or you're comparing fiction.

**Bad → Good.** You are buying 5,000 units a year.

- Bad — compare on unit price: Supplier A at **$9.00** beats Supplier B at **$11.00**. Pick A.
- Good — compare on TCO:

```text
Line              Supplier A         Supplier B
Unit × 5,000      $9.00 → $45,000    $11.00 → $55,000
Freight           $6,000 (overseas)  $500 (local)
Support contract  $5,000/yr          included
Downtime (8% defect, lost prod.)  $4,000   $0
                  --------           --------
Year-1 TCO        $60,000            $55,500
```

Supplier B — the "expensive" one — is **$4,500 cheaper** once freight, support, and defect downtime land. Always recompute on TCO before you award.

## Negotiation

Rules, each with its why:

- **Separate price from terms; settle price first.** Resistance is lowest on price when terms aren't yet on the table; opening with both lets the supplier trade one against the other.
- **Trade something for every concession — never ask free.** Want Net 60 or a volume discount? Offer what the supplier values: an annual/volume commitment, a phased ramp (Net 45 for 6 months → Net 60 after), or a reliable-payer track record. A free ask gets a free no.
- **Know your BATNA (walk-away).** Your leverage is the credible alternative supplier. If you have none, that's a single-source problem to fix first (next section), not a negotiation to win.
- **Anchor on TCO, not line items.** Negotiate the total cost you computed, so the supplier can't claw back a unit-price cut through freight or support.

**The early-payment discount is math, not a vibe.** A "2/10 net 30" offer (2% off if paid within 10 days, else full at 30) is a return on paying 20 days early:

```text
Annualized return = (Discount% ÷ (1 − Discount%)) × (365 ÷ DaysSaved)
                  = (0.02 ÷ 0.98)        × (365 ÷ 20)
                  ≈ 0.0204               × 18.25
                  ≈ 37.2% annualized
```

Take the discount whenever your cost of capital is below ~37.2%. "We're tight on cash" is rarely a reason to skip a 37.2% return — borrow against it before you pass. Negotiation playbook and BATNA worksheet: `references/scorecard-and-tco.md`.

## Supply risk + the maverick-spend leak

Name which case any critical input falls in — they are different risks:

- **Single source** — you *chose* one supplier though alternatives exist. A concentration risk you accepted; document why and a switch plan.
- **Sole source** — only one supplier exists. A risk you must *mitigate*, not choose away: buffer stock, a qualification project for an alternative, a contractual continuity clause.
- **Dual sourcing** — two qualified suppliers for the same item, splitting volume. Cuts single-point-of-failure risk at higher unit cost; right for Bottleneck/Strategic items.

**Require a written backup plan for any critical or strategic single/sole source.** A critical input with no named backup is an outage waiting for a date.

**Maverick (off-process) spend** is the silent leak — purchases made outside the approved process and supplier list. APQC measured it around **1.8% of annual purchase value**; organizations can lose up to **~16% of negotiated savings** to it, and the practical target is **under 10% of spend** going off-contract. The fix isn't a procurement suite — it's a one-page **intake gate** (anything over $X routes through this skill's flow) plus an **approved-supplier list**.

## Ongoing: scorecard, cadence, re-source triggers

A supplier you picked once is not a supplier you can ignore. Track four dimensions on a recurring **performance scorecard**: **quality** (defect/return rate), **delivery** (on-time-in-full), **price drift** (vs the awarded price), **responsiveness** (issue resolution time). Review on the SRM cadence set by Kraljic quadrant.

Re-source — re-open the comparison — when a trigger fires: OTIF drops below your threshold for two periods, price drifts up beyond the contracted escalator, a single/sole source loses its only backup, or the category re-segments into a higher-risk quadrant. Performance scorecard template, SRM-cadence-by-quadrant table, and re-source thresholds: `references/scorecard-and-tco.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Compare suppliers on unit price only | The cheapest unit routinely loses once freight, support, and downtime land | Recompute every shortlist on TCO before awarding |
| One vague RFP for a commodity you can fully spec | Wastes a bidding cycle; bids come back incomparable | Send an RFQ with fixed specs when price is the decider |
| Evaluation weights kept secret (or invented after bids arrive) | Invites bias and post-award disputes | Set weights before bids, disclose them, score predefined criteria |
| Ask for Net 60 / a discount with nothing offered | A free ask earns a free no | Trade a volume commit, phased ramp, or reliable-payer record |
| Skip the early-payment discount because "we're tight" | You pass on a ~37.2% annualized return | Compute it; take it whenever cost of capital is lower |
| Single-source a critical part and say nothing | An outage with no named owner or backup | Label single/sole/dual, write the backup plan |
| Negotiate price and terms in one breath | The supplier trades one against the other | Settle price first, then negotiate terms separately |
| Let small buys skip the process | Maverick spend quietly burns negotiated savings | A one-page intake gate + approved-supplier list |

## Hand-offs

You own the decision and the deal. The moment it becomes something else, route:

- Drafting/redlining the binding purchase agreement, MSA, liability/IP clauses, signature → `../contracts/SKILL.md`.
- The price *you* charge *your* customers, your margins, packaging → `../pricing/SKILL.md`.
- Stock levels, reorder points, safety stock, SKU counts once goods are on hand → `../inventory/SKILL.md`.
- Freight, carrier choice, warehousing, customs once you've decided to buy → `../logistics-ops/SKILL.md`.
- Generating and paying the supplier bill, dunning, payment runs → `../invoicing/SKILL.md`.
- Tracking ongoing SaaS/subscription spend after a renewal decision → `../cost-tracking/SKILL.md`.

> Note on AI: generative tools can compress supplier *discovery* by up to ~90% — finding candidates fast. They do not replace the weighting, TCO model, risk segmentation, or negotiation. Use AI to widen the shortlist; keep the judgment human and on paper.
