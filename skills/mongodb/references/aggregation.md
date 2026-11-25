# Aggregation pipelines (MongoDB 8.2)

A pipeline is stages run in order; the order decides whether an index is used and whether a stage
blows the memory limit. The single most important rule: **put `$match` and `$sort` as early as
possible**, because once a `$group`, `$project`, `$unwind`, or `$lookup` has reshaped the stream, the
original index no longer applies.

## Per-stage index eligibility

| Stage | Uses an index? | Notes |
| --- | --- | --- |
| `$match` (first stage) | yes | behaves like a `find` filter; ESR rules apply |
| `$sort` (before any reshape) | yes, if a compound index covers filter+sort | after `$group`/`$project` it is an in-memory SORT |
| `$match` after `$group`/`$project` | no | runs on computed/in-memory docs |
| `$lookup` | uses the *foreign* collection's index on `foreignField` | index the join target |
| `$group` | no (blocking) | 100 MB/stage; `allowDiskUse` to spill |
| `$unwind` | no | can multiply document count — `$match` before it |
| `$limit` / `$skip` | benefits from a preceding indexed `$sort` | push `$limit` up where correctness allows |

## `$lookup` variants

```javascript
// Simple equality join — index customers._id (it is the _id, already indexed).
{ $lookup: { from: "customers", localField: "customerId", foreignField: "_id", as: "customer" } }

// Subpipeline join — project/filter the foreign side so you pull only what you display.
{ $lookup: {
    from: "customers",
    let: { cid: "$customerId" },
    pipeline: [
      { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
      { $project: { name: 1, tier: 1 } }
    ],
    as: "customer"
}}
```

`$lookup` runs the foreign lookup per input document — it is not a hash join. If you do it on every
read, model it away with the **extended reference** pattern (see data-modeling) instead.

## `$facet` — multiple aggregations in one pass

```javascript
db.products.aggregate([
  { $match: { active: true } },
  { $facet: {
      byCategory: [ { $group: { _id: "$category", n: { $sum: 1 } } } ],
      priceStats: [ { $group: { _id: null, avg: { $avg: "$price" }, max: { $max: "$price" } } } ],
      page:       [ { $sort: { createdAt: -1 } }, { $limit: 20 } ]
  }}
])
// Note: the input to a $facet is materialized; the per-facet sub-pipelines do NOT use indexes.
// Keep the upstream $match selective so the materialized set is small.
```

## Window functions (`$setWindowFields`)

```javascript
// Running total of amount per customer, ordered by date — no self-join.
db.orders.aggregate([
  { $setWindowFields: {
      partitionBy: "$customerId",
      sortBy: { createdAt: 1 },
      output: { runningTotal: { $sum: "$amount", window: { documents: ["unbounded", "current"] } } }
  }}
])
```

## `$merge` / `$out` — materialized output

```javascript
// $merge: upsert results into a target collection (incremental rollups, materialized views).
{ $merge: { into: "daily_rollup", on: "_id", whenMatched: "merge", whenNotMatched: "insert" } }

// $out: replace the target collection wholesale. Destructive — overwrites. Prefer $merge for
// incremental jobs; reach for $out only for a full rebuild.
{ $out: "report_snapshot" }
```

## Hybrid search (8.2)

MongoDB 8.2 adds the `$scoreFusion` stage, which combines the ranked results of multiple subqueries
(for example an Atlas Search full-text query and a Vector Search semantic query) into one fused
ranking — the building block for hybrid search without doing the score blending in application code.
Pair it with a `$vectorSearch`/`$search` stage per input ranking. (Atlas/Search-index setup lives in
transactions-and-ops.)

## Memory limit and `allowDiskUse`

Each blocking stage (`$group`, `$sort` without a supporting index, `$bucket`,
`$setWindowFields`) is capped at **100 MB**. Past it the stage spills to temporary files on disk:
since 6.0 the `mongod` parameter `allowDiskUseByDefault` is `true`. The stage errors instead when that
parameter is `false` (then pass `allowDiskUse: true` to spill) or the query passes `allowDiskUse: false`.

Spilling is the right tool for a genuinely large aggregation (an analytics rollup over the whole
collection). It is the **wrong** tool to "fix" a slow pipeline whose real problem is a `$match` that
isn't using an index — that just makes the unindexed scan spill instead of fixing it. Always check
the explain first.

## Reading a pipeline's explain

```javascript
db.orders.explain("executionStats").aggregate([
  { $match: { status: "paid", createdAt: { $gte: since } } },
  { $sort:  { createdAt: -1 } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } }
])
```

Look for:

- The first stage shows `IXSCAN`, not `COLLSCAN` — the leading `$match` used an index.
- No surprise in-memory `SORT` stage where a compound index (ESR) should have served the order.
- `totalDocsExamined` close to the count the `$match` should return — a big gap means the index
  isn't selective enough or the wrong one was chosen.
- For `$lookup`, the sub-explain shows an `IXSCAN` on the foreign `foreignField`.
