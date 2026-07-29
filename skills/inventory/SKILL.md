---
name: inventory
description: "Use when deciding how much stock to hold and when to reorder it — classifying SKUs, sizing safety stock, setting reorder points and order quantities, and tracking the KPIs that keep a business from either stocking out or sitting on dead stock. NOT raising or negotiating the purchase order itself (that is `procurement`)."
tags: [reorder-point, safety-stock, eoq, abc-xyz, replenishment, inventory-kpis, ddmrp, min-max]
recommends: [procurement, logistics-ops, forecasting, dashboard, reporting, spreadsheet-ops]
origin: risco
---

# Inventory

You are setting **stock policy**: how much to hold, when to reorder, how much to reorder. You are not buying it (that is `procurement`) and not moving it (that is logistics-ops). You decide the numbers that tell the buyer what to order and when.

Leave behind **two checkable artifacts** every time:

1. **Reorder-policy table** — one row per SKU: `sku, abc_class, avg_demand, lead_time, safety_stock, reorder_point, order_qty, review_mode`. This is the standing policy.
2. **Replenishment trigger list** — the subset of SKUs whose `on_hand <= reorder_point` right now, with a suggested order quantity. This is the action.

`scripts/verify.sh` checks both for shape and the structural invariants (ROP ≥ safety stock, order_qty > 0, no false triggers). Run it before you hand anything off. It validates structure, not whether the buffers are commercially smart — that judgment is yours.

## Pick the job

The flow genuinely branches. Find the row that matches the ask before doing anything else.

| Ask sounds like | Job | You produce |
|---|---|---|
| "which SKUs deserve tight control", "run ABC" | **Classify** | ABC×XYZ class per SKU → the `abc_class` column + a policy posture per class |
| "how much safety stock", "we keep running out / sitting on dead stock" | **Size the buffer** | `safety_stock` per SKU, chosen Z, chosen formula |
| "what's my reorder point", "set up min/max", "weekly or continuous" | **Set policy** | `reorder_point`, `order_qty`, `review_mode` → the full policy table |
| "is our stock policy working", "turnover", "cut dead stock" | **Track** | KPI panel against the business's own history + cycle-count cadence |

Classify before you size, size before you set policy. A uniform policy across every SKU is the original sin (anti-patterns table).

## Classify first: ABC × XYZ

Rule: **never apply one uniform service level or review mode to every SKU** — control is a budget, spend it where the value and the volatility are. Bad: 95% service on all 800 SKUs. Good: 99% on the high-value/stable AX items, make-to-order or near-zero buffer on the low-value/erratic CZ items.

- **ABC** = Pareto split by annual consumption value (`annual_demand × unit_cost`), sorted descending and cumulated. A ≈ top ~80% of value (usually ~20% of SKUs), B the next band, C the long low-value tail.
- **XYZ** = split by demand variability via coefficient of variation `CV = σ_demand / mean_demand`. X = stable (low CV), Y = fluctuating, Z = erratic.

The 9-cell matrix maps to policy: **AX** → tight automated min/max, highest service; **CZ** → manual, minimal buffer or make-to-order; **AZ** → high value but erratic, the candidate for DDMRP (below). Full cumulative-value worked sort, CV cut points, and the 9-cell→(review mode, service level, buffer posture) matrix are in `references/abc-xyz.md`.

## Safety stock

Rule: **match the formula to which thing actually varies.** Picking the demand-only formula when the supplier's lead time swings is the most common under-buffering mistake — you buffer the wrong variance and still stock out.

```text
demand varies, lead time stable:     SS = Z · σ_demand · √LT
both vary, independent:              SS = Z · √(LT · σ_demand² + avg_demand² · σ_LT²)
both vary, correlated (King):        SS = Z · σ_demand · √LT + Z · avg_demand · σ_LT
```

`Z` is set by your **target service level**, never picked by feel:

| Service level | Z |
|---|---|
| 90% | 1.28 |
| 95% | 1.65 |
| 97.5% | 1.96 |
| 99% | 2.33 |

Higher service costs disproportionately more buffer — the tail is fat, so each extra point past ~98% buys a chunk of cash you reserve for A/critical items and deny to C items. Bad→Good: supplier "usually 5 days but sometimes 12" + you used `Z·σ_demand·√LT` → switch to the independent or King formula so `σ_LT` is in the buffer. How to estimate `σ_demand` and `σ_LT` from sales/receipt history, all three formulas worked with numbers, and the diminishing-returns curve are in `references/safety-stock.md`.

## Reorder point and order quantity

These are **two separate decisions** — conflating them is the classic beginner error. ROP answers *when*, order quantity answers *how much*.

```text
ROP = (avg daily demand × lead-time days) + safety_stock        ← when to trigger
EOQ = √(2 · D · S / H)                                          ← how much to order
        D = annual demand, S = cost per order, H = annual holding cost per unit
```

EOQ minimizes ordering + holding cost under stable demand. It is an order-*size* lever and **never** a trigger — you do not "wait until you can order an EOQ." Keep `reorder_point` and `order_qty` as separate columns.

**Continuous vs periodic review** is a real branch:

| Mode | How it works | Use when | Cost |
|---|---|---|---|
| Continuous (min-max / s,S) | Order the moment on-hand hits ROP `s`, bring up to `S` | A items, perpetual stock visibility | Fastest reaction, needs live counts |
| Periodic | Check on a fixed cadence (e.g. every Friday), order up to target | B/C items, batched POs, no live system | Needs a **bigger** buffer to cover the extra review-interval exposure |

Periodic review adds `Z · σ_demand · √(review_interval)` of exposure on top of lead-time exposure — budget for it. Worked ROP/EOQ examples, the review-interval buffer adjustment, and the exact policy-table + trigger-list schemas (the columns verify.sh checks) are in `references/reorder-policies.md`.

## Demand-driven option (DDMRP)

When a static ROP keeps whipsawing on erratic demand — you re-tune it monthly and it is still wrong — switch that SKU to **buffer zones** instead of a fixed point.

- **Red** = safety/critical, sized off lead-time and demand variability.
- **Yellow** = demand coverage over the lead time.
- **Green** = order cycle / order frequency.

Trigger fires when **net flow position** = `on_hand + on_order − qualified_demand` drops from green into yellow. The zones recalculate as demand ramps, so you are not hand-editing safety stock every cycle.

Decision rule: reach for DDMRP only on **erratic (Z-class), long-lead, or strategic** SKUs — never for steady C items where a flat ROP is cheaper to run. Zone sizing and the net-flow trigger are in `references/ddmrp.md`. Set `review_mode = ddmrp` for these SKUs.

## Track it

Prove the policy works with a KPI panel — and **recompute every metric against the business's own history**; the benchmarks below are sanity rails to flag against, not numbers to hallucinate or paste as targets.

| KPI | Formula | Rough rail |
|---|---|---|
| Inventory turnover | COGS / avg inventory | ≈6–8×/yr (consumer goods) |
| Days of inventory on hand | avg inventory / COGS × 365 | ≈30–60 days |
| GMROI | gross margin / avg inventory cost | target > 2.5 |
| Sell-through | units sold / units received | ≈70–85% / mo |
| Stockout rate | stockout events / order lines | target < 5% |
| Fill rate | lines filled complete / total lines | target > 95% |
| Dead-stock flag | SKUs with zero movement over a defined window | flag, don't reorder |

**Cycle counting, not an annual full count.** Count in a rolling sequence frequency-tiered off ABC: A items often (monthly/quarterly), C items rarely (annually). The warehouse never stops, and errors on high-value items surface fastest.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| One uniform service level / review mode across all SKUs | Overspends on C, under-protects A | ABC×XYZ → differentiated Z and review mode |
| Demand-only SS when lead time is volatile | Buffers the wrong variance, still stocks out | Independent or King formula so `σ_LT` is in the buffer |
| Treating ROP and order quantity as one number | "Wait to order a full batch" → late triggers | Separate `reorder_point` (when) and `order_qty` (how much) columns |
| Using EOQ as a reorder trigger | EOQ is a size lever, not a signal | Trigger on ROP; size with EOQ |
| Picking Z by feel | Service level is undefined and indefensible | Set service level → read Z from the table |
| Static safety stock on erratic demand | Re-tuned monthly and still wrong | DDMRP buffer zones, `review_mode = ddmrp` |
| Annual full physical count | Warehouse stops; high-value errors found too late | ABC-tiered rolling cycle counts |
| Placing/negotiating the PO here | Wrong skill owns the buy | Hand the trigger list to `procurement` |

## Hand-offs

- Raising/negotiating the purchase order, supplier choice, payment terms, PO approval, three-way match → `procurement` (see `../procurement/SKILL.md`). You hand it the trigger list; it executes the buy.
- Warehousing, picking, packing, shipping, carriers, returns flow → logistics-ops. You set the on-hand target; it physically fulfills.
- Statistical/ML demand forecast, seasonality decomposition → forecasting. You *consume* a demand estimate and its variability; you do not own the model.
- Live KPI dashboard → dashboard. Recurring KPI report → reporting.
- Pivot tables, ABC cumulative-value sort mechanics in a sheet → spreadsheet-ops.
