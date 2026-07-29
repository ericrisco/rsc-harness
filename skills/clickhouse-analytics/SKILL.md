---
name: clickhouse-analytics
description: "Use when running a ClickHouse server for high-volume OLAP: choosing a MergeTree engine and ORDER BY/PARTITION BY keys, ingesting billions of event/log/metric rows, pre-aggregating with materialized views, or fixing a query that scans instead of pruning. NOT in-process file analytics (that is `duckdb`), NOT OLTP CRUD indexing (that is `postgresdb`)."
tags: [clickhouse, olap, columnar, mergetree, analytics, materialized-views, data-ingestion, sql]
recommends: [duckdb, postgresdb, dashboard, kpi-framework, reporting, business-intelligence]
origin: risco
---

# ClickHouse analytics

ClickHouse is a multi-user, always-on, replicated columnar server built to ingest continuous high-volume writes and answer aggregation queries over billions of rows in milliseconds. You reach for it when the workload is "append a firehose of events/logs/metrics, then GROUP BY them for dashboards." Target **26.3 LTS** (v26.3.12.3, 2026-05-22) — several defaults below changed in the 26.x line, so version matters.

The fork before you write any DDL: files on a laptop, in-process, no server, no concurrent writers → `../duckdb/SKILL.md`; app CRUD, point updates, foreign keys, row locks, RLS, migrations → `../postgresdb/SKILL.md`; `clickhouse-server`, replication, concurrent writers, 100M+ rows/s ingest → this skill.

Instrumenting capture (GA4/PostHog) is `../analytics/SKILL.md`; charting the result for humans is `../dashboard/SKILL.md`; deciding which metrics matter is `../kpi-framework/SKILL.md`. ClickHouse is the engine underneath all three.

## Pick the engine first

The engine decides dedup and merge behavior, and you cannot change `ORDER BY`/`PARTITION BY` later without a rebuild — so choose before typing `CREATE TABLE`.

| Engine | Use it for | Dedup / merge behavior | Gotcha |
|---|---|---|---|
| `MergeTree` | Append-only events, logs, metrics | No dedup of logical rows; inserts dedup'd by block since 26.2 | The default and 90% of tables |
| `ReplacingMergeTree(ver)` | Upserts / keep latest version per key | Collapses duplicate `ORDER BY` keys *eventually* during merges | Reads see dupes until merged; need `FINAL` to force — slow, keep off hot path |
| `AggregatingMergeTree` | Pre-aggregated rollups fed by a materialized view | Merges `-State` partials per `ORDER BY` key | Only useful behind an MV; query with `-Merge` |
| `SummingMergeTree` | Simple additive rollups (sum only) | Sums numeric columns per `ORDER BY` key on merge | Can't do uniq/quantile — use AggregatingMergeTree for those |
| `Replicated*` prefix | High availability / multi-replica | Same as base engine + ZooKeeper/Keeper replication | Production HA wrapper; combine with any of the above |

Default to `MergeTree`. Move to `AggregatingMergeTree` only when you are pre-aggregating through a materialized view. Full matrix and reasoning: `references/schema-and-engines.md`.

## Schema rules

1. **`ORDER BY` is your single biggest perf lever — a good one cuts query time ~100x.** It defines the sparse primary index that prunes which granules get read. Get this right above everything else.
2. **Order the key low-cardinality → high-cardinality, left to right, driven by `WHERE`/`GROUP BY` — never by join keys.** 3–5 columns. The leftmost column should be the one you filter on most; cardinality rises as you go right. Timeseries: put the raw timestamp last, often `(tenant_id, toStartOfDay(ts), event_type, ts)`.
3. **Treat `ORDER BY` and `PARTITION BY` as immutable.** Changing either almost always means a new table + `INSERT ... SELECT` migration. Decide deliberately now.
4. **Partition coarsely — by month, or by day only at very high volume.** Partitioning is for *data lifecycle* (TTL, `DROP PARTITION`), not query speed; the sparse index does speed. Per-hour or per-`toYYYYMMDD` on a high-cardinality stream creates thousands of partitions → too many parts → merge storms.
5. **Right-size types and use codecs.** `LowCardinality(String)` for columns under ~10k distinct values (enum-like: country, event_type, status). Smallest int that fits. `CODEC(Delta, ZSTD)` for monotonic timestamps/counters; `CODEC(ALP)` for float columns (26.3, beats Gorilla on many workloads); native `JSON` type (GA in 26.3) for semi-structured payloads instead of stringly-typed blobs.

```sql
CREATE TABLE events
(
    tenant_id    UInt32,
    ts           DateTime64(3) CODEC(Delta, ZSTD),
    event_type   LowCardinality(String),
    user_id      UInt64,
    country      LowCardinality(String),
    revenue      Float64 CODEC(ALP),
    props        JSON
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)             -- monthly: coarse, for TTL/drops
ORDER BY (tenant_id, toStartOfDay(ts), event_type, ts)
TTL toDateTime(ts) + INTERVAL 18 MONTH;
```

Depth (cardinality math, codec table, type mapping, partition-count budget): `references/schema-and-engines.md`.

## Ingestion rules

```sql
-- Bad: row-at-a-time. Each statement becomes its own tiny part.
INSERT INTO events VALUES (1, now(), 'click', 42, 'ES', 0, '{}');
INSERT INTO events VALUES (1, now(), 'view',  42, 'ES', 0, '{}');
-- ... 10k more single inserts -> 10k parts -> merges can't keep up
```

```sql
-- Good: one batch of many rows (aim 10k–100k+ per INSERT).
INSERT INTO events VALUES
  (1, now(), 'click', 42, 'ES', 0, '{}'),
  (1, now(), 'view',  42, 'ES', 0, '{}'),
  /* ...thousands more... */ ;

-- Or load straight from object storage, no client batching at all:
INSERT INTO events
SELECT * FROM s3('https://bucket.s3.amazonaws.com/events/2026/*.parquet', 'Parquet');
```

- **Async inserts are enabled by default starting 26.3 LTS.** The server buffers small inserts in memory and flushes on a size/time threshold, so many client-side batchers become unnecessary. Flush fires on the *first* threshold hit: `async_insert_max_query_number` (default 450) or the adaptive busy timeout, between `async_insert_busy_timeout_min_ms` (default 50ms) and a data-rate-driven max (adaptive since 24.2).
- **Insert deduplication is on by default for all inserts as of 26.2** (previously sync-only), and works end-to-end across async inserts and dependent materialized views since 26.1. **Net effect: retrying a failed insert is safe** — an identical block won't double-count. Pass `insert_deduplication_token` when you want explicit control over what counts as identical.
- **Keep inserts synchronous** when you must read-your-write immediately, or when you already batch large blocks yourself and want no buffering latency.

S3/Kafka/file recipes, async-insert tuning knobs, dedup tokens: `references/ingestion-and-mvs.md`.

## Materialized views and pre-aggregation

For anything beyond raw sum/count (uniq, quantiles, argMax), pre-aggregate incrementally with `AggregatingMergeTree` + a materialized view storing `-State` partials, queried back with `-Merge`.

```sql
CREATE TABLE events_hourly
(
    tenant_id  UInt32,
    hour       DateTime,
    users      AggregateFunction(uniq, UInt64),
    revenue    AggregateFunction(sum, Float64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(hour)
ORDER BY (tenant_id, hour);            -- MV GROUP BY MUST match this

CREATE MATERIALIZED VIEW events_hourly_mv TO events_hourly AS
SELECT tenant_id,
       toStartOfHour(ts) AS hour,
       uniqState(user_id) AS users,
       sumState(revenue)  AS revenue
FROM events
GROUP BY tenant_id, hour;              -- no POPULATE on a big base table
```

```sql
-- Read it back: -Merge collapses the partial states.
SELECT tenant_id, hour, uniqMerge(users) AS uniq_users, sumMerge(revenue) AS rev
FROM events_hourly
GROUP BY tenant_id, hour;
```

- **The MV's `GROUP BY` must match the target table's `ORDER BY`** so merges stay efficient.
- **Never `POPULATE` a billion-row base table** — it blocks the MV and can OOM. Create the MV empty (it captures new rows immediately), then backfill history in time-bounded `INSERT ... SELECT` windows. Full backfill walkthrough: `references/ingestion-and-mvs.md`.

## Query optimization

The sparse index only prunes on `ORDER BY` prefix columns. When a hot query filters on a column the primary key doesn't cover, in order of reach for:

1. **`PREWHERE`** — ClickHouse auto-applies it, but an explicit `PREWHERE` on a cheap, highly selective column reads that column first and skips other columns for non-matching rows. Cuts I/O.
2. **Projection** — an alternate `ORDER BY`/pre-aggregation stored with the table; ClickHouse picks it transparently. Best when one secondary access pattern is common and worth the storage.
3. **Data-skipping index** — `minmax` (correlated-with-PK ranges), `set` (low distinct count), `bloom_filter` (high-cardinality equality/`IN`). Cheaper than a projection, coarser pruning.

Decision: PK can't prune and you query *one* alternate sort order a lot → projection. You just need to skip granules on a side column → skip index (`bloom_filter` for high-cardinality `=`/`IN`, `minmax` for ranges). Inspect with `EXPLAIN indexes = 1` and `SET send_logs_level = 'trace'` to see granules read. Walkthrough + slow-query recipes: `references/query-optimization.md`.

```sql
SELECT event_type, count() FROM events
PREWHERE country = 'ES'                 -- cheap, selective: filter before reading the rest
WHERE ts >= now() - INTERVAL 7 DAY
GROUP BY event_type;
```

## Operations

- **Watch part count.** `SELECT table, count() FROM system.parts WHERE active GROUP BY table` — a growing number means inserts are too small/frequent or partitioning is too fine. Fix the insert pattern, not the merge settings.
- **Retention via TTL**, not `DELETE`. `TTL` on the table drops expired data during merges automatically.
- **`ALTER TABLE ... DROP PARTITION` is instant and free**; row-level `DELETE`/`ALTER DELETE` is a mutation that rewrites parts — avoid it for bulk cleanup. This is the payoff of coarse partitioning.
- **`ReplacingMergeTree` reads can see un-merged duplicates.** Use `FINAL` only on cold/admin queries, never in dashboards — it merges at query time.

## Anti-patterns

| Anti-pattern | Why it hurts | Do instead |
|---|---|---|
| `MergeTree` with no `ORDER BY` (or `ORDER BY tuple()`) on a queried table | No sparse index → every query full-scans | Pick a 3–5 col key, low→high cardinality, `WHERE`-driven |
| `PARTITION BY` a high-cardinality col / per-hour / per-day at low volume | Thousands of partitions → too many parts → merge storms | Partition by `toYYYYMM`; the sparse index does the speed |
| Single-row `INSERT ... VALUES` in a loop | Each becomes a tiny part; merges can't keep up | Batch 10k–100k+ rows, or rely on 26.3 async inserts |
| `POPULATE` on a billion-row base table's MV | Blocks the MV, can OOM | Create MV empty, backfill in time windows |
| `SELECT *` on a wide table | Reads every column, defeats columnar storage | Select only the columns you need |
| `FINAL` in a dashboard query | Forces merge at query time → slow | Keep `FINAL` off hot paths; accept eventual dedup |
| ClickHouse for OLTP point-updates / single-row reads by id | Wrong engine; no real updates, weak point lookups | Use `../postgresdb/SKILL.md` |
| MV `GROUP BY` not matching target `ORDER BY` | Inefficient merges, wrong rollups | Align them exactly |

## Verification

`scripts/verify.sh <file.sql>` is a static linter over candidate ClickHouse DDL/queries: flags `MergeTree` without `ORDER BY`, over-fine `PARTITION BY`, single-row `INSERT ... VALUES`, `POPULATE` on materialized views, `SELECT *`, and `FINAL`. Read-only, no live cluster needed, exits 0 on clean input.
