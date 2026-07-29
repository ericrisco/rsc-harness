---
name: mongodb
description: "Use when modeling MongoDB documents (embed versus reference, the 16MB cap, bucket and subset patterns), choosing or fixing indexes (compound order by the ESR rule, partial, TTL, multikey, reading explain), writing aggregation pipelines that stay index-eligible, running multi-document transactions with retry, or operating and securing a deployment (replica set, read/write concern, Atlas tiers, Vector Search, Queryable Encryption). MongoDB 8.2, driver-agnostic. NOT relational schema, SQL or EXPLAIN ANALYZE (that is `postgresdb`)."
tags: [mongodb, nosql, database, aggregation, indexing]
recommends: [secure-coding, harness]
profiles: []
origin: risco
---

# MongoDB — modeling, indexing, aggregation, transactions, ops

Engine-level MongoDB 8.2 guidance: model documents for the queries you actually run, pick the
index the planner will use, write aggregation pipelines that stay index-eligible, run
multi-document transactions with correct retry, and operate/secure a deployment. Driver-agnostic —
every example is `mongosh` shell syntax that maps 1:1 to the official drivers (Node, Python, Go,
Java, Rust). This skill owns the **server's query and the index it picks**, not any ODM's API.

## When to use / When NOT to use

**When to use:**

- Document modeling: embed vs reference, the 16 MB cap, one-to-many/many-to-many, the
  subset/extended-reference/bucket/computed/outlier patterns, taming unbounded array growth.
- Index decisions: single-field, compound (the ESR ordering rule), multikey, partial, TTL, text,
  wildcard, `2dsphere`; and when an index is NOT worth it.
- Any query that is slow or scans too much; reading `explain("executionStats")`.
- Aggregation pipelines: stage order so `$match`/`$sort` hit an index, `$lookup` cost, `$unwind`
  explosion, `$group`/`$sort` memory limits and `allowDiskUse`, `$merge`/`$out`, faceting.
- Multi-document transactions: sessions, `withTransaction` retry semantics, read/write concern.
- Operating/securing: replica set, read preference, write concern, Atlas tier choice, Atlas Search
  & Vector Search, Queryable Encryption, role-based access, connection-pool knobs.

**When NOT to use:**

- Relational schema / SQL / `EXPLAIN ANALYZE` → [`postgresdb`](../postgresdb/SKILL.md). Different
  engine, planner, and concurrency model.
- ODM/driver API ergonomics (Mongoose pre-save hooks, the Node driver's `bulkWrite` return shape,
  `updateMany`'s result object) → that tool's own docs. This skill owns the server query and the
  index the server picks, not the JS object the driver hands back.
- App-layer caching as a product (Redis-in-front-of-reads).
- Cloud-console click-paths — we give the shell command / connection string, not the Atlas UI tour.
- Picking a vector store *across engines* (Pinecone vs Weaviate). Atlas Vector Search *inside* Mongo
  is in scope; cross-engine selection is not.

Deep dives: [data-modeling](references/data-modeling.md) (embed/reference tree, all six patterns,
16 MB math, polymorphic & schema versioning) · [aggregation](references/aggregation.md) (per-stage
index eligibility, `$lookup` variants, `$facet`, window fns, `$merge`/`$out`, reading pipeline
`explain`) · [transactions-and-ops](references/transactions-and-ops.md) (retry wrappers, concern
semantics, Atlas tiers, Vector Search, Queryable Encryption, RBAC, pooling, change streams).

## Non-negotiables

1. **Design for the queries you run, not the shape of your data.** The schema is the set of
   documents that make your common reads single-document and index-eligible.
2. **Never let an array grow unbounded inside a document.** It walks toward the 16 MB cap, bloats
   every read of the parent, and kills update performance — reference or bucket it.
3. **The hard ceiling is 16 MB per document.** If a one-to-many can exceed it, you reference; there
   is no `TOAST`-style overflow here.
4. **A single-document write is already atomic.** Reach for a multi-document transaction *only* when
   two or more documents must change together — otherwise you are paying for nothing.
5. **Every transaction retries on the `TransientTransactionError` label** (and commit retries on
   `UnknownTransactionCommitResult`). `withTransaction` does both for you; a hand-rolled loop must.
6. **Index by ESR: Equality fields, then the Sort field, then Range fields.** This order lets one
   compound index serve the filter, the sort, and the range without an in-memory sort.
7. **Read `explain("executionStats")` before and after adding an index** — confirm `IXSCAN`, not
   `COLLSCAN`, and `totalKeysExamined ≈ nReturned`. Or it didn't happen.
8. **`w:"majority"` for money and state transitions**, read concern `"majority"`/`"snapshot"` when a
   read must reflect a durable write. `w:1` can be rolled back on a primary failover.
9. **Money is `Decimal128` (`NumberDecimal("...")`), never a JS `double`.** Binary floats drift;
   `0.1 + 0.2 !== 0.3` in your ledger.
10. **Never store a secret in plaintext.** Use Queryable Encryption / client-side field-level
    encryption; never commit a `mongodb://user:pass@` literal.

## Decision rules

### Embed or reference

| Relationship | Choose | Why |
| --- | --- | --- |
| Read together, small, bounded (address on a user) | embed | one read, no `$lookup`, atomic update |
| One-to-few, bounded (≤ a few dozen, won't grow) | embed | stays well under 16 MB |
| One-to-many, growth not bounded (comments on a post) | reference | array would chase the 16 MB cap |
| Many-to-many (students↔courses) | reference (array of ids on the lighter side) | shared, independently mutated |
| Child shared across parents | reference | one source of truth, no duplication drift |
| Child independently and frequently mutated | reference | avoid rewriting a big parent per child edit |
| High-cardinality / huge child set | reference (+ optional subset embed) | keep the hot read small |

### Which schema pattern

| Symptom | Pattern | What it does |
| --- | --- | --- |
| List view reads 3 fields of a heavy doc | **subset** | embed only the hot fields, reference the rest |
| `$lookup` on every read just to show a name/price | **extended reference** | copy the few joined fields you display |
| Unbounded time-ordered events (readings, logs) | **bucket** | group N events per doc by time window |
| Same `count`/`sum` recomputed on every read | **computed** | store the rollup, update it on write |
| 1% of docs break the shape (a few mega-children) | **outlier** | flag them, overflow into linked docs |
| One collection holds several entity shapes | **polymorphic** | a `type` discriminator + shared `_id` space |

Full Bad→Good documents for each in [data-modeling](references/data-modeling.md).

### Which index type

| Access pattern | Index | Note |
| --- | --- | --- |
| `=` on one field | single-field | also covers the field's sort |
| filter + sort + range together | compound, ordered **ESR** | one index serves all three |
| query into an array field | multikey (automatic on an array key) | one multikey field per compound index |
| query only a subset of docs (`status:"active"`) | partial (`partialFilterExpression`) | smaller, cheaper to maintain |
| auto-expire docs after a time | TTL (`expireAfterSeconds` on a Date) | single-field only; deletes in background |
| language-aware text search | text **or** Atlas Search | Atlas Search is far richer; text is legacy |
| unpredictable / many query shapes on subdocs | wildcard (`"$**"`) | last resort; never beats a targeted index |
| geospatial proximity / within | `2dsphere` | GeoJSON `Point`/`Polygon` |
| vector similarity (8.2, Community+) | Atlas/Vector Search index | see transactions-and-ops ref |

### When NOT to add an index

- Low-cardinality field (a boolean, a 3-value status) — the planner skips it; `COLLSCAN` wins.
- Tiny collection — a collection scan reads one or two pages; the index is pure write tax.
- A field already the **left prefix** of an existing compound index — redundant.
- Write-heavy field rarely filtered — every index is paid on every insert/update.
- "Just in case" indexes — an unused index costs writes and RAM, returns nothing.

## Copy-paste patterns

Every fence is `mongosh` syntax.

### Model the document for the read (Bad → Good)

```javascript
// BAD: comments embedded in the post — array grows without bound toward 16 MB,
// every post read drags the entire comment history, money is a float.
db.posts.insertOne({
  _id: ObjectId(),
  title: "Indexing 101",
  authorId: ObjectId(),
  price: 9.99,                       // double — drifts in arithmetic
  comments: [ /* ...unbounded... */ ] // chases the 16 MB cap
})

// GOOD: post stays small; comments referenced; money is Decimal128;
// the few fields the feed needs are duplicated (extended reference).
db.posts.insertOne({
  _id: ObjectId(),
  title: "Indexing 101",
  author: { _id: ObjectId(), name: "Ada" }, // extended ref: name shown without a $lookup
  price: NumberDecimal("9.99"),
  commentCount: 0,                            // computed rollup, bumped on write
  createdAt: new Date()
})
db.comments.insertOne({ _id: ObjectId(), postId: ObjectId(), body: "…", createdAt: new Date() })
```

### Compound index in ESR order + the query that uses it

```javascript
// Feed query: filter by author (equality), sort by date (sort), bound by a date (range).
// ESR => author first, then the sort/range key.
db.posts.createIndex({ "author._id": 1, createdAt: -1 })

db.posts.find({ "author._id": authorId, createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(20)
// Confirm the plan: IXSCAN on the index above, no in-memory SORT stage.
```

### Partial + TTL indexes

```javascript
// Partial: index only the rows you actually query (active orders), not the archive.
db.orders.createIndex(
  { customerId: 1, createdAt: -1 },
  { partialFilterExpression: { status: "active" } }
)

// TTL: expire sessions 30 minutes after lastSeen. Field MUST be a Date.
db.sessions.createIndex({ lastSeen: 1 }, { expireAfterSeconds: 1800 })
```

### Aggregation: `$match` first, `$lookup`, `$group` with `allowDiskUse`

```javascript
db.orders.aggregate([
  // $match FIRST so it uses the compound index and shrinks the working set early.
  { $match: { status: "paid", createdAt: { $gte: since } } },
  { $sort:  { createdAt: -1 } },                  // index-eligible here, before any $group/$project
  { $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer",
      pipeline: [ { $project: { name: 1 } } ]     // project inside $lookup: pull only what you need
  }},
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } }
], { allowDiskUse: true })  // $group/$sort spill past 100 MB/stage; this lets large groups complete,
                            // it is NOT a substitute for a missing $match index — see anti-patterns.
```

### Read `explain("executionStats")` — the four numbers

```javascript
db.posts.find({ "author._id": authorId }).sort({ createdAt: -1 })
        .explain("executionStats")
```

Read these before declaring a fix:

1. **`winningPlan.stage`** — must be `IXSCAN` (or `FETCH`→`IXSCAN`), not `COLLSCAN`.
2. **`totalKeysExamined` vs `nReturned`** — close means the index is selective; a huge ratio means
   the index scans far more than it returns (wrong key order, low selectivity).
3. **A `SORT` stage** — an in-memory sort the index should have satisfied; reorder by ESR to remove it.
4. **`rejectedPlans`** — what the planner considered and dropped; a near-miss hints at a better index.

### Multi-document transaction with full retry

```javascript
// Use withTransaction — it retries the body on TransientTransactionError and retries the
// commit on UnknownTransactionCommitResult for you. Requires a replica set / sharded cluster.
const session = db.getMongo().startSession();
try {
  session.withTransaction(() => {
    const orders  = session.getDatabase("shop").orders;
    const ledger  = session.getDatabase("shop").ledger;
    orders.updateOne({ _id: orderId, status: "pending" }, { $set: { status: "paid" } }, { session });
    ledger.insertOne({ orderId, amount: NumberDecimal("9.99"), at: new Date() }, { session });
  }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
} finally {
  session.endSession();
}
// If both writes target ONE document, drop the transaction — that write is already atomic.
```

### `bulkWrite` upsert

```javascript
db.inventory.bulkWrite([
  { updateOne: {
      filter: { sku: "ABC-1" },
      update: { $inc: { qty: 5 }, $setOnInsert: { createdAt: new Date() } },
      upsert: true
  }}
], { ordered: false })  // ordered:false keeps going past one failed op and parallelizes
```

### Change stream (resumable tail)

```javascript
// Watch only the events you care about; persist resumeToken to restart without gaps.
const cs = db.orders.watch([{ $match: { operationType: { $in: ["insert", "update"] } } }]);
while (cs.hasNext()) { const change = cs.next(); /* process; save change._id as resume token */ }
```

More variants (`$facet`, window functions, `$merge`/`$out`, vector search) live in the references.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality → STOP |
| --- | --- |
| "Embed all the comments, it's one read" | Array grows unbounded toward 16 MB and bloats every post read. Reference or bucket. |
| "`$lookup` is just a JOIN, use it everywhere" | Mongo is not relational; per-document `$lookup` is expensive. Prefer modeling (extended reference) so the read needs no join. |
| "Wrap this single-document update in a transaction to be safe" | A single-doc write is already atomic. The transaction adds latency and a replica-set requirement for zero gain. |
| "`COLLSCAN` is fine, it's fast on my 100 docs" | It is O(n); at 4M docs it is a full table read. Add the index now and prove `IXSCAN`. |
| "Set `allowDiskUse:true` and the slow pipeline is fixed" | That masks a missing `$match` index by spilling to disk. Fix stage order / add the index first. |
| "Store the price as a number, round on display" | JS doubles drift across `$sum`/`$inc`. Use `NumberDecimal` (`Decimal128`). |
| "Group the whole collection, no `$match`" | A blocking `$group` over everything blows the 100 MB/stage limit. `$match` first to shrink it. |
| "One collection for users, orders, logs — fewer to manage" | Mixed shapes kill index selectivity and balloon working set. Split by access pattern. |
| "`$where` lets me run a quick JS predicate" | Runs JS per document, no index, a server-side injection surface. Use query operators / `$expr`. |
| "Index every field just in case" | Each index is a write tax and RAM cost; unused indexes return nothing. Index for real query shapes only. |

## Quick reference

### Read/write concern matrix

| Need | Write concern | Read concern | Note |
| --- | --- | --- | --- |
| Money / state transition | `w:"majority"` | `"majority"` | survives a primary failover |
| Read your own durable write | `w:"majority"` | `"majority"` (+ causal session) | no rollback window |
| Transaction default | `w:"majority"` | `"snapshot"` | consistent point-in-time |
| Logs / fire-and-forget | `w:1` | `"local"` | fast, may be rolled back |

### Atlas tier chooser

| Tier | Use it for | Limits |
| --- | --- | --- |
| **M0** | learning, tiny prototypes | free forever, up to 5 GB, shared, no SLA |
| **Flex** (GA Feb 2025) | small prod / variable load | $8 base capped at $30/mo, 100 ops/sec (burst 500), 5 GB; supports Atlas Search, Vector Search, Change Streams, Triggers |
| **M10+** (dedicated) | production, isolation, scale-up | from ~$0.08/hr (~$57/mo); dedicated resources, full features |

M0 does **not** run Vector Search well for real workloads — move to Flex or dedicated. Legacy
Serverless / M2 / M5 were auto-migrated to Flex.

### Aggregation memory

Each blocking stage (`$group`, `$sort` without an index, `$bucket`) is capped at **100 MB**. Past it
the stage errors unless `allowDiskUse:true` lets it spill. Spilling is a correctness fallback for
genuinely large groups, not a performance fix for a missing index.

## Verify

Run `scripts/verify.sh` from your project root. It is read-only, never connects to a database, and
never writes. It scans discovered `.js`/`.mongodb.js` files and flags foot-guns: a committed
plaintext `mongodb://user:pass@` credential (the **only** hard failure), `createIndex` calls with no
options, redundant compound-index prefixes, `$where` predicates, unbounded `$lookup`,
`allowDiskUse:true` that may be masking a missing index, and money stored as a JS number in seed
scripts. If `node` is present it runs `node --check` for a syntax pass; otherwise that step is
`[skip]`. Everything except a committed credential is advisory `[warn]`/`[skip]`. It runs on stock
macOS bash 3.2 and exits 0 on a clean or empty target.

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md)
Karpathy wiki), record this project's MongoDB decisions there and index them from the root
`CLAUDE.md`, so the next agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/mongodb.md`, indexed in `02-DOCS/wiki/index.md` (the
   Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — collection layout and
   embed/reference decisions, the index set and its ESR rationale, read/write concern policy, the
   Atlas tier, and any encryption/RBAC setup — then index it in `02-DOCS/wiki/index.md` (the
   Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the article
   (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Technical conventions are
*recorded, not gated* — never block the task on this.

## See Also

- [references/data-modeling.md](references/data-modeling.md) — embed/reference tree, the six
  patterns with worked documents, 16 MB math, polymorphic & schema versioning.
- [references/aggregation.md](references/aggregation.md) — per-stage index eligibility, `$lookup`
  variants, `$facet`, window functions, `$merge`/`$out`, hybrid `$scoreFusion`, reading pipeline
  `explain`.
- [references/transactions-and-ops.md](references/transactions-and-ops.md) — retry wrappers, concern
  semantics, replica-set requirement, Atlas tiers, Search/Vector Search, Queryable Encryption, RBAC,
  pooling, change streams.
- Sibling skills: [`harness`](../harness/SKILL.md) (scaffolds the `01-TOOLS/MONGODB` operational
  tool) and [`secure-coding`](../secure-coding/SKILL.md) (auth, encryption, least-privilege).
- For relational work — SQL, foreign keys, `EXPLAIN ANALYZE`, MVCC — use
  [`postgresdb`](../postgresdb/SKILL.md), not this skill. Different engine and planner.
- Out of scope here — external tools with their own docs: ODM/driver API surface (Mongoose hooks,
  the Node driver's `bulkWrite`/`updateMany` return shapes) and cross-engine vector-store selection.
  This skill owns the server query and the index the server picks.
