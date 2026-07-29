---
name: logistics-ops
description: "Use when an order is paid and packed and the box now has to move, go sideways, or come back — picking a carrier and service and cutting a label, reacting to a delivery exception, getting ahead of where-is-my-order tickets, running a return, exchange or refund with its reverse label, filing a carrier claim before the window closes, and setting return-window and restocking-fee policy. NOT setting stock levels or reorder points (that is `inventory`), NOT sourcing or buying from suppliers (that is `procurement`), NOT writing the apology to the customer (that is `customer-support`)."
tags: [logistics, shipping, carriers, returns, reverse-logistics, fulfillment, tracking]
recommends: [inventory, procurement, customer-support, api-connector-builder, webhooks, bookkeeping]
origin: risco
---

# Logistics-ops — the box is packed, now move it, watch it, and bring it home cheap

You run the parcel as an operation. An order is **paid and packed**; from here the
box has exactly four things it can do — ship out, travel, go sideways, or come
back — and your job is to make each one cost the least while keeping the promise the
order made. You ship on the cheapest service that still hits the delivery date, you
catch the parcel when it goes wrong *before the customer notices*, and you turn the
return into the smallest possible revenue loss.

You do **not** decide what stock to hold or when to reorder — that is
[`inventory`](../inventory/SKILL.md). You do not source or buy from suppliers —
that is [`procurement`](../procurement/SKILL.md) (inbound from vendors, not outbound
to customers). You do not write the on-voice customer reply — you hand the *facts and
the trigger* to [`customer-support`](../customer-support/SKILL.md) and it writes the
apology around them. You do not host the carrier-API webhook listener — that is
[`api-connector-builder`](../api-connector-builder/SKILL.md) /
[`webhooks`](../webhooks/SKILL.md). And you do not post the refund to the books —
that is [`bookkeeping`](../bookkeeping/SKILL.md). You decide *what calls to make and
when*, and *what to do with the box*.

## The parcel lifecycle — the spine

Every parcel moves through four legs. Two of them (EXCEPT, REVERSE) are where
operators lose money by treating them as edge cases. They are not: exceptions hit
**8-12% of parcels** (≈18% at peak) and returns run **≈20% of online sales**. Build
both as first-class paths.

```text
  SHIP            TRACK             EXCEPT             REVERSE
  rate-shop  ──►  watch the    ──►  tiered        ──►  return / exchange /
  + cut label     tracker           response           refund + reverse label
  + validate      (event-driven)    by severity        + carrier claim
  address                              ▲                   ▲
                       └── exception ──┘                   │
                       └────────── return requested ───────┘
```

- **SHIP** — order is paid and packed; choose carrier + service against the delivery
  promise, validate the address, buy the label.
- **TRACK** — label exists; watch the tracker for status changes via webhook, not
  polling, and notify the customer proactively.
- **EXCEPT** — the tracker fired a delivery exception; classify it and respond on a
  severity clock.
- **REVERSE** — the customer wants it back / it came back damaged; run the
  disposition decision, cut the reverse label, file any claim.

## Ship — rate-shop, don't reflex

Pick the service against **the delivery promise the order actually made**, not your
habit. "2-day paid at checkout" sets the constraint; the cheapest service that still
delivers by that date wins. Shipping everything one way leaves money on the table on
every order.

**Audit the surcharges — the headline is a lie.** The 2026 carrier increase reads as
**5.9%** (UPS GRI effective 2025-12-22, FedEx 5.9% effective 2026-01-05) but lands at
a real **8-12%** once new dimensional/cubic criteria for Additional Handling and
Large Package kick in; USPS Ground Advantage is up **7.8%**, and the residential
surcharge climbed ~8% into the mid-$6 range. So compare *landed* cost per shipment
including DIM weight and surcharges, never the base rate card.

**Validate the address before you buy the label.** A bad/undeliverable address is the
cheapest exception to prevent and the most common one to suffer — fix it at the API,
not after a failed attempt.

```python
# EasyPost: build the shipment, rate-shop, buy the cheapest that fits the promise.
shipment = client.shipment.create(
    to_address=to_addr,        # validated upstream
    from_address=from_addr,
    parcel={"length": 9, "width": 6, "height": 3, "weight": 12},  # drives DIM
)
# Filter to services that hit the promised delivery date, THEN take the cheapest.
rate = shipment.lowest_rate(carriers=["USPS", "UPS", "FedEx"])
bought = client.shipment.buy(shipment.id, rate=rate)
# `bought.tracker` is now live (pre_transit → ... → delivered).
```

```text
Bad : "We always ship UPS Ground." → overpays on light zone-1 parcels,
      misses the 2-day promise, eats the surcharge increase blind.
Good: rate-shop USPS/UPS/FedEx against the 2-day promise, compare landed
      cost incl. DIM + surcharges, buy the cheapest service that still hits
      the date. Validate the address first.
```

## Track — kill WISMO before it becomes a ticket

WISMO ("where is my order") is **30-40% of ecommerce support contacts** (50%+ at peak)
and each human-handled ticket costs **$5-$22**. The whole game is to message the
customer *before* they message you.

**Use the tracker webhook, not a polling loop.** EasyPost pushes `tracker.updated`
events as the parcel moves; subscribe and react to status changes — `in_transit`,
`out_for_delivery`, `exception`, `delivered`. Polling burns API calls and lags reality.
(The listener *hosting* is [`webhooks`](../webhooks/SKILL.md)' job; you decide which
events fire which message.)

**The window is tiny.** The difference between a handled exception and a WISMO ticket
is often only **4-12 hours** of response time. Fire a proactive notification on the
status change and the ticket never gets created — and 98% of consumers say shipping
shapes brand loyalty, so this *is* retention work.

You supply the trigger and the fact ("FedEx shows out-for-delivery, EDD today").
[`customer-support`](../customer-support/SKILL.md) writes the tone and owns the SLA on
the reply. Never let support invent an ETA the carrier hasn't given.

## Except — the tiered exception protocol

A failed delivery costs **~$20-30 direct and $140+ in lost future revenue**, so triage
by severity, don't treat every exception the same. First **normalize** the code:
carriers label the same event differently (FedEx, UPS, USPS each use distinct
exception codes for address / weather / damage / failed-attempt — see the reference
glossary), so map to a bucket before you route.

| Exception type        | Act on the parcel                              | Customer-comms SLA            |
| --------------------- | ---------------------------------------------- | ----------------------------- |
| Damage / past EDD     | Open claim path, prep replacement/refund       | Proactive outreach **same business day** |
| Address / access      | Correct address, intercept, break reattempt    | Resolve within **24 h**       |
| Weather / operational | Hold, let carrier recover, monitor             | **48-h** check-in cadence     |
| Failed attempt        | Reattempt or redirect to pickup before cycle 2 | Within **24 h**               |

Sequence is always **act → notify → escalate**: fix the parcel first (intercept,
reattempt, claim), *then* send the proactive message, *then* escalate to the carrier
if the clock runs out. Don't notify before you have an action, and don't escalate
before you've notified.

## Claims — file before the window closes

Claim windows are hard deadlines. Miss them and the money is simply gone. Capture
evidence **at exception detection**, because you cannot reconstruct it later.

| Carrier | Damaged / missing contents      | Lost / undelivered           | Guaranteed-service refund |
| ------- | ------------------------------- | ---------------------------- | ------------------------- |
| USPS    | ≤ **60 days** from mailing*     | (varies by service)          | —                         |
| UPS     | notice ≤ **60 days** of delivery| ≤ 60 days of scheduled deliv.| ≤ **15 days** of invoice  |
| FedEx   | ≤ **60 days** of ship date (intl **21 d**) | up to **9 months** | ≤ **15 days** of invoice  |

\*Windows vary by service class; confirm against the full matrix in references before
relying on a date.

Evidence checklist — gather **now**, at detection:

- [ ] Tracking number + the exception event/screenshot (timestamped)
- [ ] Photos of the damaged item *and* the packaging
- [ ] Declared/invoice value and the original label
- [ ] Weight and dimensions as shipped
- [ ] For guaranteed-service refunds: the carrier invoice (15-day clock starts there)

## Reverse — turn the return into the smallest loss

Returns are **≈20% of online sales** (NRF: 19.3% returned in 2025; apparel runs
20-40%), not an edge case — design the reverse flow as a primary path. Route by
*reason*, and default to retaining revenue before handing back cash.

| Return reason       | Default disposition                          | Why                                   |
| ------------------- | -------------------------------------------- | ------------------------------------- |
| Defective / damaged | Refund or replacement, **no restocking fee** | Your fault — fee kills the relationship |
| Wrong item sent     | Replacement + free reverse label             | Your fault — fix fast                  |
| Changed mind / size | **Instant exchange** or store credit first   | Retains the revenue, often cheaper than reverse freight |
| Not as described    | Refund or store credit                       | Listing risk — fix the listing too    |
| Low-value bulky     | **Keep-it / refund** (no return)             | Reverse freight > item value          |

**Tune the policy as both a conversion lever and a cost lever.** 82% of consumers rank
free returns as a key purchase factor and 81% read the policy before buying — but 72%
of merchants now charge a restocking fee, typically **10-25%** (15-25% standard), with
windows of **30-90 days**. Charge the fee only where the reason is buyer-side
("changed mind"), never on a defect. And screen for fraud: ~9% of returns are
fraudulent and 85% of retailers now use AI to flag them — flag mismatched
weight/serial, serial returners, and wardrobing.

```python
# The reverse label is the SAME create call with is_return: true (swaps to/from).
return_shipment = client.shipment.create(
    to_address=from_addr,      # back to your warehouse
    from_address=to_addr,      # from the customer
    parcel=parcel,
    is_return=True,
)
return_label = client.shipment.buy(
    return_shipment.id, rate=return_shipment.lowest_rate()
)
```

Hand the **restock quantity** to [`inventory`](../inventory/SKILL.md) (does it go back
to sellable stock?) and the **refund accounting** to
[`bookkeeping`](../bookkeeping/SKILL.md) (the credit-note entry). You decide the
disposition; they record the consequence.

## Anti-patterns

| Anti-pattern | Why it costs you | Do instead |
| ------------ | ---------------- | ---------- |
| Ship by habit, one carrier always | Overpays per order, misses promises | Rate-shop the three against the promise |
| Trust the "5.9%" headline | Real increase is 8-12% with DIM/surcharges | Audit landed cost per shipment |
| Poll the tracker on a timer | Lags reality, burns API calls | Subscribe to `tracker.updated` webhooks |
| Wait for the WISMO ticket | Ticket costs $5-22; you missed the 4-12 h window | Notify proactively on status change |
| Same urgency for damage and weather | Wastes effort or misses the costly one | Tier by severity (table above) |
| Cash-refund by default | Hands back revenue you could keep | Offer exchange / store-credit first |
| No return-window or restocking policy | Can't defend the cost or the conversion | Set 30-90 d window, 10-25% fee buyer-side only |
| Restocking fee on a defect | Burns the relationship on your own fault | Free reverse label for defective/wrong-item |
| Capture claim evidence "later" | Window closes, money gone; can't reconstruct | Photograph + record value/weight at detection |
| Let support invent the ETA | A wrong promise becomes a second complaint | Give support the tracker fact, not a guess |
| Treat returns as an edge case | They're ~20% of orders | Design REVERSE as a primary path |

## References

Full per-carrier exception-code glossary (FedEx/UPS/USPS → the four buckets), the
complete claim-window matrix with required evidence per claim type, and runnable
EasyPost snippets (rate-shop + one-call buy, tracker webhook handler shape, the
`is_return: true` reverse label) live in
[`references/carriers-and-claims.md`](references/carriers-and-claims.md).
