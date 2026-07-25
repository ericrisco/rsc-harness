---
name: postgresdb
description: Use when PostgreSQL engine behaviour decides the answer — schema and type design, index choice, reading EXPLAIN on a slow query, zero-downtime DDL and backfills, or ops (roles, RLS, pooling, vacuum, partitioning, PITR). PG16, ORM-agnostic. NOT portable query logic (that is `sql`), NOT a managed provider's platform surface (that is `neon`).
tags: [postgres, sql, database, migrations]
recommends: [secure-coding]
origin: risco
---

# PostgreSQL — schema, indexing, queries, ops

Engine-level PostgreSQL 16 guidance: design correct schemas, pick the right index, read EXPLAIN and
fix slow SQL, run zero-downtime migrations, and operate/secure the database. Tooling-agnostic; every
example is runnable.

New, non-trivial feature with no approved spec + plan under `02-DOCS/wiki/sdd/`? Hand off to
[`specify`](../specify/SKILL.md) before writing feature code (method: [`sdd`](../sdd/SKILL.md)); build
straight from here only for a genuinely one-line, low-risk change.

Deep dives: [schema-and-indexing](references/schema-and-indexing.md) (types, constraints, every index
kind, bloat) · [query-optimization](references/query-optimization.md) (EXPLAIN, joins, concurrency,
JSONB/FTS/pgvector) · [migrations](references/migrations.md) (zero-downtime DDL, per-ORM) ·
[operations-and-security](references/operations-and-security.md) (roles, RLS, pooling, vacuum,
partitioning, backups).

**Not this skill.** ORM-API ergonomics (Prisma `updateMany` count trap, SQLAlchemy session lifecycle)
and per-runner migration wiring → that tool's own docs; this skill owns the **SQL the ORM emits and
the engine behavior underneath**. Other engines → [`mysql`](../mysql/SKILL.md),
[`sqlite-turso`](../sqlite-turso/SKILL.md), [`clickhouse-analytics`](../clickhouse-analytics/SKILL.md)
(different MVCC, locking, planner). App-layer caching / Redis / Kafka as products are out — only
Postgres-as-queue via `SKIP LOCKED` is in scope. Cloud-vendor console clicks →
[`deployment`](../deployment/SKILL.md); we give the SQL and params, not the RDS/Cloud SQL UI path.

## Decision rules

Fast lookups; runnable DDL lives in the references.

### Pick the column type

| Use case | Correct type | Avoid | Why |
| --- | --- | --- | --- |
| Surrogate PK (internal) | `bigint GENERATED ALWAYS AS IDENTITY` | `serial`, `int` | identity is SQL-standard, no sequence-ownership gotchas; `bigint` avoids 2.1B overflow |
| Surrogate PK (public/distributed) | `uuid` v7 | `uuid` v4 | v7 is time-ordered → less B-tree fragmentation than random v4 |
| Natural text id (slug, sku) | `text` + `UNIQUE` + `CHECK` | `varchar(n)` | length via CHECK; no rewrite to widen later |
| Money / exact decimal | `numeric(19,4)` | `float8`, `money` | binary floats drift; `money` has locale issues |
| Timestamp (event) | `timestamptz` | `timestamp` | stores a UTC instant; naive timestamp loses zone |
| Duration | `interval` | int seconds | self-documenting, arithmetic-safe |
| Small closed set, stable | `enum` | `text` w/o CHECK | type safety; but see lookup-table note |
| Evolving set, joinable | lookup table + FK | `enum` | `ALTER TYPE ... ADD VALUE` is awkward; FK gives joins + soft-retire |
| Flag | `boolean` | `int`, `varchar` | three-valued NULL still possible — add `NOT NULL DEFAULT` |
| Tags (read-mostly) | `text[]` + GIN | comma string | array ops + GIN containment |
| Tags (relational) | join table | `text[]` | when you need FK integrity / per-tag rows |
| Semi-structured | `jsonb` | `json`, `text` | binary, indexable, dedup keys; promote hot keys to columns |
| IP / CIDR | `inet` / `cidr` | `text` | validation + operators |
| Time range (booking) | `tstzrange` + GiST | two columns | `&&` overlap + exclusion constraint |

### Pick the index

| Access pattern | Index | DDL | Notes |
| --- | --- | --- | --- |
| `=` / `<` `>` / range / `ORDER BY` | btree (default) | `CREATE INDEX ix_orders_status ON orders (status)` | also enforces uniqueness |
| `LIKE 'prefix%'` | btree + `text_pattern_ops` | `CREATE INDEX ix_users_email_pat ON users (email text_pattern_ops)` | only for C-locale/prefix; not `%suffix` |
| Case-insensitive eq | expr index or `citext` | `CREATE INDEX ix_users_lemail ON users (lower(email))` | query must use `lower(email)` too |
| `@>` jsonb / array containment | GIN | `CREATE INDEX ix_orders_meta ON orders USING gin (meta)` | `jsonb_path_ops` if only `@>` |
| Full-text `@@` | GIN on tsvector | `CREATE INDEX ix_orders_search ON orders USING gin (search)` | index a generated `tsvector` column |
| Range overlap / exclusion / geo | GiST | `CREATE INDEX ix_book_during ON bookings USING gist (during)` | also PostGIS geometry |
| Huge append-only time-series | BRIN | `CREATE INDEX ix_events_ts ON events USING brin (created_at)` | needs physical correlation |
| Vector similarity | hnsw (pgvector) | `CREATE INDEX ix_docs_embed ON docs USING hnsw (embedding vector_cosine_ops)` | see query-optimization |
| Dedup only | unique btree | `CREATE UNIQUE INDEX uq_users_email ON users (email)` | constraint = index |

Hash indexes: almost never — equality-only, no multicolumn, rarely beats btree even though WAL-logged
since PG10.

Read the plan **before** adding an index — `EXPLAIN (ANALYZE, BUFFERS)` or it didn't happen. An index
the planner never picks is pure write tax on every insert and update, forever.

### When NOT to add an index

- Low-selectivity boolean / `status` with few distinct values (planner ignores it; seq scan wins).
- Tiny tables (a seq scan reads one page; the index adds maintenance for nothing).
- Write-heavy columns rarely filtered — every index is a write tax.
- A column already the **left prefix** of an existing composite index.
- Redundant with a `UNIQUE` constraint — the constraint already created an index.

## Copy-paste patterns

### Canonical table (types + constraints + identity)

```sql
-- GOOD: identity PK, public uuid, FK with action, numeric money, timestamptz,
-- status via lookup FK, generated tsvector, CHECK constraints.
CREATE TABLE orders (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id    uuid NOT NULL DEFAULT gen_random_uuid(),  -- v4; see schema ref for v7
    user_id      bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status       text NOT NULL REFERENCES order_statuses (code) ON UPDATE CASCADE,
    amount       numeric(19,4) NOT NULL CHECK (amount >= 0),
    currency     text NOT NULL CHECK (length(currency) = 3),
    note         text,
    search       tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(note, ''))) STORED,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (public_id)
);
CREATE INDEX ix_orders_user_id ON orders (user_id);     -- FKs are NOT auto-indexed
CREATE INDEX ix_orders_status  ON orders (status);
```

```sql
-- BAD: every column is a future migration or a bug.
CREATE TABLE orders (
    id          serial PRIMARY KEY,            -- sequence-ownership gotchas; use IDENTITY
    user_id     int REFERENCES users(id),      -- int overflows at 2.1B; no FK index
    status      varchar(20),                   -- length hack; no constraint on values
    amount      float,                         -- money drift
    created_at  timestamp DEFAULT now()        -- naive: loses the zone
);
```

`updated_at` is not auto-maintained — add a `BEFORE UPDATE` trigger (see schema ref) or set it in the
app; Postgres has no `ON UPDATE` clause.

### Composite index column order

Equality columns first, then the range/sort column.

```sql
-- Query: WHERE user_id = $1 AND created_at >= $2 ORDER BY created_at DESC
-- GOOD: equality (user_id) then range (created_at)
CREATE INDEX ix_orders_user_created ON orders (user_id, created_at DESC);

-- BAD: range-first index cannot satisfy the equality efficiently for this query
CREATE INDEX ix_orders_created_user ON orders (created_at, user_id);
```

Confirm with `EXPLAIN` that the plan shows `Index Cond: (user_id = ... AND created_at >= ...)`, not a
`Filter:`.

### Partial + covering (INCLUDE) index

```sql
-- Partial: index only the rows you query (smaller, hotter)
CREATE INDEX ix_orders_active ON orders (user_id, created_at DESC)
WHERE status <> 'cancelled';

-- Covering: INCLUDE non-key columns to enable an index-only scan
CREATE INDEX ix_orders_user_cover ON orders (user_id) INCLUDE (amount, created_at);
```

Index-only scan requires a recently-`VACUUM`ed table; confirm `Heap Fetches: 0` in `EXPLAIN (ANALYZE)`.

### Keyset (cursor) pagination — not OFFSET

```sql
-- GOOD: keyset on a stable composite sort; uses ix_orders_user_created
SELECT id, amount, created_at
FROM orders
WHERE user_id = $1
  AND (created_at, id) < ($2, $3)   -- row-value comparator = last row of prev page
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- BAD: OFFSET scans and discards 100000 rows every page (O(n))
SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 100000;
```

The index must match the `ORDER BY` direction exactly; include the tiebreaker (`id`).

### UPSERT done right

```sql
-- GOOD: insert-or-update; EXCLUDED is the row that failed to insert
INSERT INTO inventory (sku, qty)
VALUES ($1, $2)
ON CONFLICT (sku)
DO UPDATE SET qty = inventory.qty + EXCLUDED.qty
WHERE inventory.qty + EXCLUDED.qty >= 0   -- guard
RETURNING id, qty;

-- DO NOTHING returns no row on conflict; wrap to always get the row:
WITH ins AS (
    INSERT INTO tags (name) VALUES ($1)
    ON CONFLICT (name) DO NOTHING
    RETURNING id
)
SELECT id FROM ins
UNION ALL
SELECT id FROM tags WHERE name = $1 LIMIT 1;
```

### Queue with SKIP LOCKED

```sql
-- GOOD: contention-free job claim; concurrent workers never block each other
UPDATE jobs
SET status = 'processing', locked_at = now()
WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, payload;
```

`SKIP LOCKED` skips rows another txn holds; `FOR UPDATE` alone would serialize all workers.

### Kill the N+1

```sql
-- BAD: application loops, one query per order (N+1)
--   for o in orders: SELECT * FROM order_items WHERE order_id = o.id
-- GOOD: one set-based query
SELECT o.id, json_agg(i.*) AS items
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.user_id = $1
GROUP BY o.id;

-- Top-N-per-group: JOIN LATERAL, not a window-filter scan
SELECT u.id, recent.*
FROM users u
JOIN LATERAL (
    SELECT id, amount, created_at FROM orders
    WHERE user_id = u.id ORDER BY created_at DESC LIMIT 3
) recent ON true;
```

An ORM emitting N queries is the same bug — fix it at the SQL boundary, not with a cache.

### EXPLAIN, the right way

```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = $1 AND created_at >= $2;
```

Read these four first:

1. **Estimated vs actual rows** — a large gap means stale stats; run `ANALYZE`.
2. **The most expensive node** — highest `actual time` × `loops`.
3. **`Seq Scan` on a big table** where you expected an index.
4. **`Rows Removed by Filter`** — the predicate was not pushed to an index.

Full method in [query-optimization](references/query-optimization.md).

## DDL on a live table

Full sequences (zero-downtime expand-contract, batched backfills, per-ORM runners) in
[migrations](references/migrations.md). These four are absolute because each one is a lock you cannot
take back once traffic is on the table:

1. Index creation on a live table is **always** `CONCURRENTLY` — plain `CREATE INDEX` holds ACCESS
   EXCLUSIVE for the entire build and blocks every writer. It therefore cannot run inside a txn.
2. Never `ADD COLUMN ... NOT NULL` without a default/backfill plan, and never add a **volatile**
   default (`now()`, `gen_random_uuid()`) on a large table without a batched backfill — a volatile
   default rewrites the whole table under ACCESS EXCLUSIVE. A non-volatile constant is instant (PG11+).
3. `SET lock_timeout` + `SET statement_timeout` around DDL on hot tables, so a blocked statement fails
   fast instead of parking an ACCESS EXCLUSIVE request that every reader behind it then queues on.
4. Migrations are forward-only in prod; never edit an applied migration — it has already run
   somewhere, so the next environment replays a history that no longer matches the one in production.

Lock modes: `CREATE INDEX CONCURRENTLY` takes SHARE UPDATE EXCLUSIVE (allows writes); plain
`CREATE INDEX`, `ALTER TABLE ... TYPE`, `ADD COLUMN` with a volatile default, and `VACUUM FULL` take
ACCESS EXCLUSIVE (blocks everything). Full table in
[migrations](references/migrations.md#lock-impact-reference).

## Anti-patterns

| Claim | Reality |
| --- | --- |
| "I'll add the FK index later, the query works now" | Unindexed FK = seq scan + heavy lock cascade on parent `DELETE`/`UPDATE`. Index it now. |
| "UUID PK is fine everywhere" | Random v4 fragments the B-tree and bloats WAL. Use `IDENTITY` internally or uuid **v7**. |
| "`SELECT count(*)` to check existence" | Counts the whole match. Use `EXISTS (SELECT 1 ...)`. |
| "CTEs are just for readability" | Pre-12 they were optimization fences; PG12+ inlines unless `MATERIALIZED`. Know which you want. |
| "`NOT IN (subquery)`" | NULL-unsafe (one NULL → empty result) and slow. Use `NOT EXISTS`. |
| "Store money as float, round on display" | Silent drift across arithmetic. `numeric(19,4)`. |
| "`ADD COLUMN ... NOT NULL DEFAULT now()`" | Volatile default rewrites the table under ACCESS EXCLUSIVE. Non-volatile constant is instant (PG11+). |
| "One big `jsonb` blob beats columns" | No constraints, no per-key stats, GIN bloat. Promote hot keys to typed columns. |
| "RLS is on, so the table is protected" | RLS is opt-in per table and the **table owner bypasses it**. Verify with a non-owner role; add `FORCE ROW LEVEL SECURITY` to cover the owner too. |
| "RLS policy calling `auth.uid()` per row" | Re-evaluated per row. Wrap: `(SELECT auth.uid())` so it runs once. |
| "`CREATE INDEX` in the migration is fine" | Blocks writes for the whole build. `CREATE INDEX CONCURRENTLY` (outside a txn). |
| "`VACUUM FULL` will fix bloat" | Takes ACCESS EXCLUSIVE, rewrites the table. Use autovacuum tuning / `REINDEX CONCURRENTLY`. |

## Quick reference

### Isolation levels

| Level | Prevents | Use when | Note |
| --- | --- | --- | --- |
| Read Committed (default) | dirty reads | most OLTP | each statement sees a fresh snapshot |
| Repeatable Read | + non-repeatable / phantom (snapshot) | multi-statement consistent read | may raise `40001`; retry |
| Serializable (SSI) | + write skew | invariants across rows | retry `40001` with backoff |

Retry the txn on SQLSTATE `40001` (serialization_failure) and `40P01` (deadlock_detected).

### Diagnostic one-liners

```sql
-- Unindexed foreign keys
SELECT c.conrelid::regclass AS tbl, a.attname AS col
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND (i.indkey::int2[])[0] = a.attnum
  );

-- Top slow queries (needs pg_stat_statements)
SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms,
       round(total_exec_time::numeric, 2) AS total_ms, query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- Dead tuples / bloat candidates
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC;

-- Blocking locks
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid, blocked.query AS blocked_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks gl ON gl.locktype = bl.locktype AND gl.database IS NOT DISTINCT FROM bl.database
  AND gl.relation IS NOT DISTINCT FROM bl.relation AND gl.granted
JOIN pg_stat_activity blocking ON blocking.pid = gl.pid;

-- Cache hit ratio (aim > 0.99)
SELECT sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0) AS ratio
FROM pg_statio_user_tables;

-- Unused indexes
SELECT relname, indexrelname, idx_scan
FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY relname;
```

## Verify

Run `scripts/verify.sh` from your project root: it lints discovered SQL with `sqlfluff` (if
configured), syntax-sanity-checks migration files (the quote/paren balance check is dollar-quote and
block-comment aware), flags foot-guns (`CREATE INDEX` without `CONCURRENTLY` in a migration,
`ADD COLUMN ... NOT NULL` without `DEFAULT`, `VACUUM FULL`), and — only if `DATABASE_URL` and `psql`
are present — checks that `pg_stat_statements` is enabled. It exits non-zero **only** on a real
`sqlfluff` lint error; everything else (missing tools, heuristic warnings, DB unreachable) is advisory
`[skip]`/`[warn]`. Runs on stock macOS bash 3.2; never writes, never connects without `DATABASE_URL`.

## Project grounding

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), read
`02-DOCS/wiki/stack/postgresdb.md` first and stay consistent with it. Missing or stale? Write the
project's real choices there — schema and naming conventions, migration tool, indexing/partitioning
decisions, pooling setup, RLS policies — index it in `02-DOCS/wiki/index.md` (the Knowledge map; root
`CLAUDE.md` keeps only a pointer), and bump its `Updated` date in the same change, so the next agent
inherits the conventions instead of re-deriving them. No `02-DOCS/` layer? Skip silently (optionally
suggest `harness`) — technical conventions are *recorded, not gated*; never block the task on this.
