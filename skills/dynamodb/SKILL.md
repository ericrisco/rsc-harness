---
name: dynamodb
description: "Use when modeling or operating a DynamoDB table: deriving partition/sort keys from access patterns, single-table vs table-per-entity, adding a GSI/LSI, on-demand vs provisioned capacity, or diagnosing hot-partition throttling. NOT relational schema/SQL/EXPLAIN (that is `postgresdb`), NOT aggregation-pipeline document modeling (that is `mongodb`)."
tags: [dynamodb, nosql, single-table-design, aws, data-modeling]
recommends: [postgresdb, mongodb, redis, vector-db, aws-essentials, deployment, secure-coding]
origin: risco
---

# DynamoDB — access-pattern-first modeling and capacity

DynamoDB is not a relational database with a different syntax. It has no joins, no ad-hoc queries, no
server-side aggregation, and it punishes schema changes after launch. So the modeling discipline IS the
work: enumerate every read and write the app must perform, THEN design keys so each one is a single
`GetItem` or `Query`. Add an index only when the base table physically cannot serve a pattern. Decide
capacity last.

Your job here is to stop the user from treating DynamoDB like SQL.

## What you produce / what you refuse

You deliver three artifacts, in this order:

1. **An access-pattern list** — a table of every query and write, with key condition, read/write,
   frequency, and what serves it. This is the contract the keys must satisfy.
2. **A key-design document** — entity → PK/SK encoding → which table or named GSI serves each pattern.
3. **A capacity + cost recommendation** — on-demand vs provisioned vs reserved, and the hot-partition risk.

You **refuse** to: click through the AWS console, wire the IaC/CI provisioning pipeline (that is
`../deployment/SKILL.md`), or model the data as normalized tables you then "join" in application code.
You emit DDL, IaC snippets, and example SDK calls — you do not provision the infrastructure.

The steps below run in sequence — access patterns, then keys, then indexes, then capacity. Reordering
them is the single most common DynamoDB mistake.

## Step 1 — Enumerate access patterns

You cannot query what your keys do not express, and there is no `WHERE` over arbitrary columns, so
produce this table before you name a single attribute. It is also exactly what `scripts/verify.sh`
checks: run `scripts/verify.sh <path-to-key-design.{md,json}>` and every row must carry a key target
(`pk`/`sk` or a named `gsi`) and a `query_type`. It FAILS on any pattern served by `Scan`, WARNS on
`FilterExpression`, and asserts ≤20 GSIs / ≤5 LSIs. Read-only; exits 0 on an empty or clean target.

| pattern | entity | key condition | read/write | est. freq | served by |
|---|---|---|---|---|---|
| Get a user by id | User | `PK=USER#<id>` | read | high | base table `GetItem` |
| Get a user's orders, newest first | Order | `PK=USER#<id>`, `SK begins_with ORDER#` | read | high | base table `Query` |
| Look up a user by email | User | `GSI1PK=EMAIL#<email>` | read | medium | GSI1 `Query` |
| List open orders across all users | Order | sparse `GSI2PK=OPEN` | read | low | GSI2 (sparse) `Query` |

Bad → Good. The whole game is moving from vague to executable:

- Bad: "store users and orders." (No key condition is derivable from this.)
- Good: "get all orders for a user, newest first, page size 25." (PK + SK range + sort direction fall out.)

Rule: if a pattern needs a `FilterExpression` over more than ~10% of the items it scans, that is a
modeling smell — redesign the key, do not patch it with a filter.

## Step 2 — Key design + single-table decision

Get this wrong and you pay for it forever: changing a table's key schema after launch means a full
migration (new table + backfill + dual-write).

**Composite-key encoding.** Use prefixed, sortable strings so one partition holds an entity and its
children — items read together are co-located, so one `Query` returns them — and so a sort-key range
query slices them:

```text
PK = USER#123
SK = USER#123                      <- the user item itself
SK = ORDER#2026-06-02T10:15#A91    <- an order, ISO-8601 timestamp sorts lexically = chronologically
SK = ORDER#2026-06-02T11:40#B07
```

```json
{ "PK": "USER#123", "SK": "ORDER#2026-06-02T10:15#A91",
  "Type": "Order", "Total": 4200, "Status": "OPEN" }
```

One `Query` with `PK = USER#123 AND SK begins_with("ORDER#")` returns all of that user's orders,
already sorted. That is a **one-to-many** relationship with no join.

**Many-to-many** uses an adjacency list: store the edge twice (or use an inverted GSI, see Step 3) so
you can traverse it from either side. Worked end-to-end in
[references/access-patterns.md](references/access-patterns.md) — a multi-tenant SaaS / e-commerce model
(pattern table → PK/SK map → GSI map → AWS SDK v3 `@aws-sdk/lib-dynamodb` calls), adjacency-list
many-to-many, time-series and leaderboard patterns.

**Single-table vs table-per-entity** — decide honestly, do not cargo-cult:

| signal | single-table | table-per-entity |
|---|---|---|
| Many entities read together in one request | yes | no |
| Many access patterns over related entities | yes | no |
| Entities are independent, patterns are few/simple | no | yes (simpler, fine) |
| Team unfamiliar with overloaded keys | weigh the cost | yes |
| Need clean per-entity IAM / TTL / capacity isolation | no | yes |

Single-table design earns its complexity when many related entities share access patterns. When entities
are independent and the queries are few, separate tables are simpler and perfectly correct — say so.

## Step 3 — GSIs (only when the base table can't serve it)

Three named patterns, each with a one-line why:

- **Inverted index** — swap PK and SK on the GSI so you can read the relationship from the other side
  (`GSI1PK = SK_value`, `GSI1SK = PK_value`). Serves "given an order, who owns it" / many-to-many reverse.
- **Sparse index** — only items that carry the GSI's key attribute are indexed. Write the attribute
  only on the few items you want to find ("OPEN" orders, flagged accounts) so the index is tiny and the
  query is "find the few" instead of "scan the many."
- **Overloaded GSI** — reuse generic `GSI1PK`/`GSI1SK` attributes across multiple entity types so one
  index serves several patterns. Keeps you under the index quota.

**Rule: add a GSI only when the base table physically cannot answer the pattern.** Every GSI is a
standing cost.

Warnings that bite people:

- GSIs are **always eventually consistent** — you cannot read-your-own-write through a GSI. If a pattern
  needs strong consistency, it must hit the base table.
- Each write to the base table replicates to **every GSI whose keys changed**, each consuming its own
  write capacity. More indexes = multiplied write cost.
- **Project only the attributes each pattern needs.** Blanket `ProjectionType: ALL` doubles storage and
  write cost; use `KEYS_ONLY` or `INCLUDE` when you can.

Quotas (default, adjustable for GSIs): up to **20 GSIs** and **5 LSIs** per table. LSIs must be defined
at table creation, share the base partition key, and impose a **10 GB item-collection cap** (all items
under one partition key). GSI-only tables have no such cap — a real reason to prefer GSIs over LSIs.

## Step 4 — Capacity & cost

Capacity mode is a billing decision, not a modeling one — it changes nothing about the keys, so pick it
after the model is stable. Decision table:

| traffic shape | recommendation | why |
|---|---|---|
| Spiky / unpredictable, or < ~10M req/month | **On-demand** (the AWS default) | Nov-2024 ~50% price cut made it cheapest for most workloads; no capacity planning |
| Sustained utilization > ~40% | Provisioned + auto-scaling | provisioned writes (~$0.047/M) are far cheaper than on-demand at high utilization |
| Predictable, long-running, > ~70% util | Provisioned + reserved capacity | 3-year reserved (~$0.013/M write) is dramatically cheaper still |

On-demand request unit pricing (us-east-1, standard table class): **RRU $0.125 / million**,
**WRU $0.625 / million**. **Warm throughput** (the instantaneous read/write a table can serve) is shown
by default at no cost and rises automatically as you scale; you pay only if you **proactively pre-warm**
ahead of a known spike.

**Hot partitions.** Each physical partition has a hard ceiling of **3,000 RCU and 1,000 WCU per second**,
regardless of the table's total capacity. Drive one partition key past that and you are throttled even
while well under your table limit — this is why "writes throttled but I'm under capacity" means a hot key.
Fix with high-cardinality keys or **write-sharding**: append a suffix bucket to the PK.

```text
# Hot: every write lands on one partition
PK = METRIC#daily_total

# Sharded: spread writes across N buckets, scatter-gather on read
PK = METRIC#daily_total#<0..9>
```

Capacity math, full pricing detail (including the Nov-2024 cut), warm throughput, the full quota table,
and hot-partition diagnosis + the sharding recipe live in
[references/capacity-and-limits.md](references/capacity-and-limits.md).

## Step 5 — Operational guardrails

- **Item size is hard-capped at 400 KB** (attribute names + values). Offload large blobs to S3 and store
  the S3 key in the item.
- **Query/Scan return at most 1 MB per request.** That is why a `Query` "only returns some rows" — loop on
  `LastEvaluatedKey` until it is absent.

```bash
aws dynamodb query --table-name App \
  --key-condition-expression 'PK = :pk' \
  --expression-attribute-values '{":pk":{"S":"USER#123"}}' \
  --starting-token "$LAST_EVALUATED_KEY"   # paginate; absent => done
```

- **TransactWriteItems / TransactGetItems** group up to **100 unique items**; a transactional write
  consumes **2× WCU**.
- **BatchWriteItem** takes up to **25 put/delete requests** per call.
- **FilterExpression runs AFTER the read consumes capacity** — it saves bandwidth, not RCU. Never use a
  filter as a substitute for a key condition.
- **TTL** for automatic expiry (set an epoch-seconds attribute); deletion is best-effort, not instant.
- **DynamoDB Streams** for change capture / building derived & denormalized views.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Designing keys before listing access patterns | The keys won't express the queries; post-launch fix is a full migration | List every read/write first; derive keys from them |
| `Scan` + `FilterExpression` as your "query" | Scan reads (and bills) the whole table; the filter only trims the response | Make the pattern a `Query` on a key or GSI |
| One GSI per attribute "just in case" | Each GSI multiplies write cost and counts against the 20-GSI quota | Add a GSI only when the base table can't serve a real pattern |
| Normalizing into separate tables joined in app code | DynamoDB has no joins; app-side joins are N round-trips and races | Co-locate related items under one PK; query once |
| Low-cardinality PK (e.g. `status`, `tenant`) | All traffic funnels to one partition → throttling at 3000 RCU / 1000 WCU | High-cardinality PK; write-shard hot keys |
| Expecting strong consistency from a GSI | GSIs are always eventually consistent — stale reads | Read consistency-critical patterns from the base table |
| `ProjectionType: ALL` on every GSI | Doubles storage and write cost on each indexed write | Project `KEYS_ONLY` / `INCLUDE` only what the pattern needs |
| Storing > 400 KB inline (images, docs, logs) | Hits the 400 KB item cap; bloats every read | Put the blob in S3, store the pointer in the item |
| Picking capacity mode before the model is done | Mode is billing, not modeling — premature and often wrong | Stabilize keys/GSIs first, then choose on-demand vs provisioned |

## Route elsewhere when the engine is different

Relational schema / SQL / EXPLAIN / indexing → `../postgresdb/SKILL.md`; MySQL-engine schema → `mysql`;
document modeling + aggregation pipeline → `mongodb`; cache / queue / rate-limiter → `redis`; vector
store / semantic search → `vector-db`; AWS account / IAM / VPC setup → `aws-essentials`; provisioning the
table in CI/CD → `../deployment/SKILL.md`; API-layer auth/secrets in front of the table →
`../secure-coding/SKILL.md`.
