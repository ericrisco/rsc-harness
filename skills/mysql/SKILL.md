---
name: mysql
description: "Use when designing, querying, indexing or operating a MySQL or MariaDB database and engine-specific behaviour matters — schema and type choices, index design, reading EXPLAIN, online schema change, replication and replica lag, locking and InnoDB deadlocks, charset traps, and server config. NOT portable SELECT/JOIN/window-function craft (that is `sql`), NOT PostgreSQL engine behaviour like VACUUM or JSONB (that is `postgresdb`), NOT the PlanetScale/Vitess branch-and-deploy workflow (that is `planetscale`)."
tags: [mysql, mariadb, innodb, explain, replication, indexing, online-ddl, database]
recommends: [sql, postgresdb, planetscale, db-migrations, backups]
origin: risco
---

# MySQL / MariaDB engine

You are working below portable SQL, at the layer where the answer depends on *which engine* is
running. This skill owns MySQL 8.4 LTS and MariaDB 11.8 LTS: the **InnoDB** clustered-index storage
model, MySQL-flavoured DDL and types, index design and the leftmost-prefix rule, reading `EXPLAIN`
and fixing the plan, online DDL, replication, locking/deadlocks, and day-2 server config.

The dividing line is simple: **if the answer is identical on PostgreSQL, it belongs in `sql`, not
here.** `sql` owns the dialect-independent SELECT grammar. `mysql` owns how *this* engine stores,
plans, locks, and replicates. `postgresdb` is the peer engine for the other database — same body
shape, different facts, never the same answer.

## When to use

- Designing or reviewing a MySQL/MariaDB schema: engine choice, integer/`DECIMAL`/`VARCHAR` sizing,
  `utf8mb4` charset/collation, `JSON` + generated/`STORED` columns, PK design for InnoDB.
- A query is slow or scans too many rows; reading `EXPLAIN` / `EXPLAIN ANALYZE` / `FORMAT=JSON`.
- Choosing or adding an index: composite column order, covering indexes, prefix indexes on `TEXT`,
  invisible indexes for safe rollout, why an index is *not* used.
- Schema change on a large/hot table without downtime: `ALGORITHM=INSTANT/INPLACE/COPY`, pt-osc, gh-ost.
- Replication: binlog row format, GTID (incl. tagged GTIDs), replica lag, semi-sync, group replication.
- Locking/concurrency: deadlocks, gap/next-key locks, `REPEATABLE READ`, `SELECT ... FOR UPDATE`.
- Operating the server: buffer pool, `caching_sha2_password` + TLS, slow-query log, `performance_schema`.
- Migrating 5.7/8.0 → 8.4 LTS, or reasoning about MySQL ↔ MariaDB divergence.

## When NOT to use

| The ask | Goes to |
|---|---|
| Portable query craft — joins, window functions, CTEs, NULL 3VL | `sql` |
| PostgreSQL engine behaviour — MVCC, VACUUM, RLS, JSONB, PgBouncer | `postgresdb` |
| PlanetScale / Vitess branch + deploy-request workflow, no-FK design | `planetscale` |
| Vendor-neutral migration *theory* — expand-contract, batched backfill | `db-migrations` |
| ORM / query-builder API ergonomics | `drizzle-orm`, `prisma-orm` |
| Backup *strategy* / retention / restore drills as a discipline | `backups` |
| OLAP / columnar analytics | `clickhouse-analytics`, `duckdb` |

The boundaries with `planetscale` and `db-migrations` are sharp: this skill owns the raw-MySQL
mechanics (`EXPLAIN`, index choice, `ALGORITHM=`, gh-ost). PlanetScale wraps those in its platform
workflow; `db-migrations` wraps them in vendor-neutral strategy. You own the knobs they ride on.

## Pick your version first

Get this wrong and every later decision (auth, vector, isolation defaults) is wrong too.

| Target | Use it when | Watch out |
|---|---|---|
| **MySQL 8.4 LTS** | Default for conservative production. GA 2024-04-30, supported through April 2032. | `mysql_native_password` is **disabled by default** here. |
| **MySQL 9.x Innovation** | Only if you need `VECTOR` or the newest features and accept short support. | Short-lived track; `mysql_native_password` is **removed**. Not for stable prod. |
| **MariaDB 11.8 LTS** | The fork; 2025 yearly LTS, first MariaDB LTS with native vector search. | Auth, vector syntax, and `RETURNING` differ from MySQL — **not drop-in compatible**; `innodb_snapshot_isolation` defaults **ON**. |

`VECTOR` is a MySQL 9.0 (Innovation) feature, *not* in 8.4 LTS. MariaDB 11.8 also has `VECTOR` but
with different functions (`VEC_DISTANCE_COSINE()` vs MySQL's `STRING_TO_VECTOR()`) — see
`references/mysql-vs-mariadb.md`. Do not assume one's vector SQL runs on the other.

## Non-negotiables

1. **`utf8mb4`, always — at the column level.** Legacy `utf8` (alias `utf8mb3`) is 3-byte and
   silently truncates emoji and supplementary characters. Default collation is `utf8mb4_0900_ai_ci`.
   Setting it on the connection only is not enough; set it on the column.
2. **Small monotonic PRIMARY KEY.** An InnoDB table *is* its PK B-tree, and every secondary index
   stores the PK as its row pointer. A random `UUID`/`CHAR(36)` PK bloats every secondary index and
   wrecks insert locality. Use `BIGINT AUTO_INCREMENT` or an ordered UUIDv7 stored as `BINARY(16)`.
3. **`binlog_format=ROW` + GTID.** ROW is the only reliable replication format; GTID gives each
   transaction a globally unique id with auto-skip so it applies at most once per replica.
4. **`caching_sha2_password` + TLS.** It is the default auth plugin and SHA-256 based; clients need
   TLS for first-time auth. `mysql_native_password` is disabled by default in 8.4 and gone in 9.0 —
   do not design around it.
5. **Index column order follows the leftmost prefix.** `INDEX (a,b,c)` serves `a`, `a,b`, `a,b,c` —
   never `b` alone. Put equality columns first, then the range/`ORDER BY` column.
6. **Never `ALTER` a hot table without choosing an algorithm.** Default `COPY` locks and rebuilds.
   Pick `INSTANT`/`INPLACE`, or use gh-ost / pt-osc, *before* you run it at peak.
7. **`REPEATABLE READ` + next-key (gap) locks → short, consistently-ordered transactions.** This is
   the InnoDB default and the usual deadlock source. Acquire rows in the same order everywhere.
8. **Measure with `EXPLAIN ANALYZE`, do not guess.** The optimizer's `rows` is an estimate;
   `EXPLAIN ANALYZE` runs the query and reports actual rows and timing.

## Index decision

| You have | Use |
|---|---|
| One column in `WHERE`, high selectivity | Single-column index |
| Multiple `WHERE` columns + an `ORDER BY` | Composite index: equality cols first, then range/sort col (leftmost prefix) |
| Query reads only indexed columns | Covering index (add the selected cols) — avoids the PK back-lookup |
| Filtering a long `TEXT`/`VARCHAR` prefix | Prefix index `col(20)` — can't be covering, watch selectivity |
| Rolling out an index on a hot table safely | `INVISIBLE` index, then flip `VISIBLE` once verified |

```sql
-- Bad: separate single-column indexes; the optimizer uses at most one, then filesorts.
CREATE INDEX idx_uid ON orders (user_id);
CREATE INDEX idx_created ON orders (created_at);
-- Query: WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC

-- Good: one composite index — equality (user_id) first, then the range/sort column.
-- This serves the WHERE and the ORDER BY with no separate sort step.
CREATE INDEX idx_user_created ON orders (user_id, created_at);
```

## Read EXPLAIN

`EXPLAIN` shows the plan; `EXPLAIN ANALYZE` runs it and reports actual rows/time;
`EXPLAIN FORMAT=JSON` shows cost and used-key-parts. Read the access `type` first — it is the ladder
from worst to best:

`ALL` (full scan) → `index` (full index scan) → `range` → `ref` → `eq_ref` → `const`.

Anything `ALL` on a large table is a red flag. Then check `rows` (estimated rows examined),
`filtered` (% surviving the `WHERE`), and the `Extra` flags: `Using filesort` (extra sort pass),
`Using temporary` (materialised temp table), `Using index` (covering — good, no back-lookup).

The most common cause of a missed index is a **non-sargable predicate** — a function or implicit
charset/type cast wrapping the indexed column:

```sql
-- Bad: DATE() wraps the indexed column → the index on created_at can't be used → type=ALL.
SELECT * FROM orders WHERE DATE(created_at) = '2026-06-01';

-- Good: range over the raw column → index range scan (type=range).
SELECT * FROM orders
WHERE created_at >= '2026-06-01' AND created_at < '2026-06-02';
```

A subtler version: joining a `utf8mb4` column to a `latin1` column, or a `VARCHAR` to an `INT`,
forces a per-row cast and disables the index. Make both sides the same type and collation. Full
field-by-field reading, the `type` ladder, and every "why no index" cause are in
`references/indexing-and-explain.md`.

## Online DDL chooser

| Operation / situation | Use |
|---|---|
| Add column at end, rename column, set default, drop index | `ALGORITHM=INSTANT` — metadata-only, near-free (8.0+) |
| Add secondary index, change column nullability inplace | `ALGORITHM=INPLACE, LOCK=NONE` — rebuilds without blocking most writes |
| What INSTANT/INPLACE can't do, on a small/cold table | `ALGORITHM=COPY` — locks + rebuilds; fine off-hours |
| Same change on a large/hot table, zero downtime | `gh-ost` or `pt-online-schema-change` — shadow table + swap |

```sql
-- INSTANT: adding a column at the end is metadata-only in 8.0+. Always be explicit so a
-- silent fall-through to COPY (which locks) can't happen.
ALTER TABLE orders ADD COLUMN note VARCHAR(255) NULL, ALGORITHM=INSTANT, LOCK=NONE;
```

```bash
# gh-ost: build a shadow table, copy + tail the binlog, then atomic cutover. Always --dry-run
# first; throttle on replica lag so you don't melt production.
gh-ost \
  --host=primary.db --database=shop --table=orders \
  --alter="ADD INDEX idx_user_created (user_id, created_at)" \
  --max-lag-millis=1500 --throttle-control-replicas="replica1.db" \
  --execute   # drop --execute to dry-run
```

If gh-ost refuses to read the binlog, run `pt-online-schema-change`, which uses triggers instead.
Both, plus the rollback path and how this composes with `db-migrations` expand-contract theory, are
in `references/online-ddl-and-migrations.md`.

## Copy-paste patterns

```sql
-- Covering index: the query reads only (user_id, status, total), so put them all in the index.
-- EXPLAIN then shows "Using index" — no trip back to the PK leaf for each row.
SELECT status, total FROM orders WHERE user_id = ?;
CREATE INDEX idx_cover ON orders (user_id, status, total);
```

```sql
-- GTID replication on the replica: GTID auto-positioning, no log file/pos bookkeeping.
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='primary.db', SOURCE_USER='repl', SOURCE_PASSWORD='***',
  SOURCE_SSL=1, SOURCE_AUTO_POSITION=1;
START REPLICA;
```

```sql
-- Replica lag: read the field, don't eyeball. Seconds_Behind_Source is coarse; for accuracy use
-- performance_schema replication tables. NULL means replication is broken, not "0 lag".
SHOW REPLICA STATUS\G   -- Replica_IO_Running / Replica_SQL_Running / Seconds_Behind_Source
SELECT * FROM performance_schema.replication_applier_status_by_worker;
```

```sql
-- Deadlock post-mortem: InnoDB rolls back the cheaper transaction and logs the cycle here.
SHOW ENGINE INNODB STATUS\G   -- read the LATEST DETECTED DEADLOCK section
```

```bash
# Consistent logical dump without locking every table: single transaction over InnoDB.
mysqldump --single-transaction --set-gtid-purged=AUTO --routines --triggers shop > shop.sql
```

Replication topologies (async / semi-sync / group replication / InnoDB Cluster + MySQL Router),
failover, and read-replica routing are in `references/replication-and-ha.md`.

## MySQL vs MariaDB divergence

They share a heritage and diverge in ways that break copy-pasted SQL. Do not assume parity.

| Area | MySQL 8.4 / 9.x | MariaDB 11.8 |
|---|---|---|
| Default auth | `caching_sha2_password` | `mysql_native_password` / `ed25519` |
| `VECTOR` | MySQL 9.0+ only; `STRING_TO_VECTOR()` | Native in 11.8; `VEC_DISTANCE_COSINE()` — different syntax |
| `RETURNING` | `INSERT ... RETURNING` only (8.0+) | `INSERT`/`UPDATE`/`DELETE ... RETURNING` |
| Sequences | No `CREATE SEQUENCE` | `CREATE SEQUENCE` supported |
| System-versioned (temporal) tables | Not supported | `WITH SYSTEM VERSIONING` supported |
| Snapshot isolation | RR snapshot, no write-conflict detection | `innodb_snapshot_isolation` defaults **ON** |
| JSON | Native binary `JSON` type | Historically a `LONGTEXT` alias; check version |

Depth and both-direction migration gotchas: `references/mysql-vs-mariadb.md`.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality | Do instead |
|---|---|---|
| "`utf8` is Unicode, it's fine." | `utf8` = 3-byte `utf8mb3`; emoji silently become `????`. | `utf8mb4` at the column level. |
| "A random UUID PK is clean and unique." | Random PK bloats every secondary index and kills insert locality in the clustered index. | `BIGINT AUTO_INCREMENT` or ordered UUIDv7 as `BINARY(16)`. |
| "`STATEMENT` binlog is smaller, use it." | Non-deterministic statements replicate wrong; silent data drift on replicas. | `binlog_format=ROW`. |
| "Just keep using `mysql_native_password`." | Disabled by default in 8.4, removed in 9.0 — your upgrade breaks. | `caching_sha2_password` + TLS. |
| "Wrapping the column in `DATE()`/`LOWER()` is readable." | Function on an indexed column → full scan. | Rewrite to a sargable range; or add a generated column + index. |
| "`SELECT *` is convenient." | Pulls wide InnoDB rows off-disk and defeats covering indexes. | Select only needed columns. |
| "I'll hold the transaction open while I do other work." | RR + gap locks held long → deadlocks and lock waits everywhere. | Keep transactions short; commit fast; order rows consistently. |
| "`ALTER` it now, traffic is fine." | `COPY` algorithm locks a multi-GB table; outage at peak. | Pick `INSTANT`/`INPLACE`, or gh-ost off-peak. |
| "`EXPLAIN` says 12 rows, so it's fast." | `rows` is an *estimate* from stats. | Confirm with `EXPLAIN ANALYZE` (actual rows/time). |
| "MyISAM is faster for our table." | No transactions, no FKs, table-level locks, crash-unsafe. | InnoDB for anything transactional. |

## Verify

Run `scripts/verify.sh` from your project root. It is read-only and **never connects to a
database** — it heuristically lints discovered `*.sql` and `*.cnf`/`my.cnf` files for the foot-guns
above (legacy `utf8`, MyISAM, random-UUID PK, `binlog_format=STATEMENT`, `mysql_native_password`,
function-wrapped indexed columns) and checks balanced delimiters. It exits non-zero only on
unbalanced delimiters or a committed `binlog_format=STATEMENT`; every schema heuristic is advisory.
It optionally runs `sqlfluff --dialect mysql` if installed.

## See Also

- `../sql/SKILL.md` — portable, engine-agnostic SELECT/JOIN/window-function craft.
- `../postgresdb/SKILL.md` — the peer engine (PostgreSQL): MVCC, VACUUM, RLS, JSONB.
- `../planetscale/SKILL.md` — the PlanetScale/Vitess platform workflow on top of MySQL.
- `db-migrations` — vendor-neutral migration strategy (expand-contract) that the `ALGORITHM=`/gh-ost
  mechanics here ride on.
- `backups` — backup strategy, retention, and restore drills as a discipline.
