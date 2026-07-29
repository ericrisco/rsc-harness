---
name: duckdb
description: "Use when analytical SQL must run in-process with no server: Parquet/CSV/JSON/Arrow queried in place, OLAP embedded in an app or notebook, a slow pandas groupby on multi-GB data, or S3/lakehouse data read without downloading. NOT a multi-user analytics server (that is clickhouse-analytics), NOT an app's transactional CRUD store (that is postgresdb)."
tags: [duckdb, olap, analytics, parquet, embedded-database, sql, columnar]
recommends: [clickhouse-analytics, postgresdb, sql, sqlite-turso, data-cleaning, business-intelligence]
origin: risco
---

# DuckDB — embedded columnar OLAP, no server

DuckDB is an in-process analytical (OLAP) database: it links into your process like SQLite, but stores
data column-by-column and vectorizes execution for aggregates, joins, and window functions. There is no
server, no port, no daemon — you `pip install duckdb` (or drop one CLI binary) and query. Its killer move
is reading Parquet/CSV/JSON/Arrow **in place**, without a load step, so a folder of files becomes a table.

The fact that drives every routing decision below: DuckDB is **one writer, many readers, single process**.
It is brilliant for analysis on one machine and wrong for multi-user serving or transactional app writes.

Latest stable is **v1.5.3** (released 2026-05-20). Pin the **LTS line (v1.4.x; v1.4.4 LTS shipped
2026-01-26)** for anything long-lived — LTS gets ~1 year of patches and a stable storage format. Use 1.5.x
for greenfield exploration.

## Is DuckDB the tool? (decide first)

| Your workload | Reach for |
| --- | --- |
| Analytics over local/remote files, one process, one writer | **duckdb** (this skill) |
| Many concurrent users, production query API, dashboards-as-a-service, petabyte scale | [`clickhouse-analytics`](../clickhouse-analytics/SKILL.md) |
| App transactional CRUD: users, orders, many small writes, FKs, connection pool | [`postgresdb`](../postgresdb/SKILL.md) |
| Embedded single-file **transactional** store / edge / sync | [`sqlite-turso`](../sqlite-turso/SKILL.md) |
| Pure SQL syntax question, engine-agnostic (window fns, CTEs) | [`sql`](../sql/SKILL.md) |
| Similarity / embedding search as the core workflow | [`vector-db`](../vector-db/SKILL.md) |

The two you will confuse most: DuckDB vs ClickHouse is **embedded-single-node vs server-distributed** —
under ~10GB on one box DuckDB usually wins; pick ClickHouse when many people query concurrently. DuckDB vs
SQLite is **same niche, opposite workload** — both embedded single-file, but SQLite is row-store OLTP and
DuckDB is column-store OLAP. Don't run your app's writes through DuckDB.

## Install & version

```bash
# Python (replacement-scan + relational API)
pip install 'duckdb==1.4.4'        # LTS, for long-lived projects — stable storage format + patches
pip install duckdb                  # current stable, for greenfield exploration

# CLI (single static binary)
curl https://install.duckdb.org | sh   # or: brew install duckdb
duckdb -version
```

Why pin LTS for production: the on-disk `.duckdb` format and extension ABI are stable within an LTS line,
so a routine upgrade won't strand a persisted database or break an installed extension mid-project.

## Query files directly — the killer feature

Do **not** load a file into pandas just to query it. Point DuckDB at the path and let it scan only the
columns and row groups it needs (Parquet metadata pushdown). A bare string path is a replacement scan, so
`FROM 'data/*.parquet'` works without naming a reader.

```python
import duckdb

# BAD: read the whole file into RAM, then aggregate in pandas
import pandas as pd
df = pd.read_parquet("sales/")          # pulls every column of every file into memory
out = df.groupby("region")["amount"].sum()

# GOOD: scan in place, only the two needed columns ever touch memory
out = duckdb.sql("""
    FROM 'sales/*.parquet'
    SELECT region, sum(amount) AS revenue
    GROUP BY ALL
    ORDER BY revenue DESC
""").df()
```

Readers and globs you will actually use:

```sql
SELECT * FROM read_parquet('s3://bkt/y=*/m=*/*.parquet', filename = true);  -- glob + source col
SELECT * FROM read_csv_auto('events.csv');         -- sniff delimiter/types/header
SELECT * FROM read_csv('raw.csv', header = false, types = {'id': 'BIGINT'});  -- when sniffing is wrong
SELECT * FROM read_json_auto('logs/*.ndjson');     -- newline-delimited or array JSON
```

`filename = true` adds a `filename` column — essential when a glob mixes partitions and you need to know
which file a row came from.

## In-memory vs persistent

```python
con = duckdb.connect()                    # in-memory: default, gone when the process exits
con = duckdb.connect("analytics.duckdb")  # single file, created if absent; extension is not significant
```

Persist when: the dataset is reused across runs, an intermediate result is larger than RAM (DuckDB spills
to the file), or you are curating a dataset to share. Otherwise stay in-memory — it is the fast path and
needs no cleanup. The whole database is **one file**; copy it to move the database.

## Python / dataframe interop

In-scope pandas/Polars/Arrow frames are queryable **by variable name** — that is a replacement scan, no
registration needed. The relational API is lazy; nothing executes until you materialize.

```python
import duckdb, pandas as pd
orders = pd.read_parquet("orders.parquet")        # ordinary frame in local scope

rel = duckdb.sql("FROM orders SELECT region, sum(amount) AS rev GROUP BY ALL")  # lazy, by name
rel.df()        # -> pandas        rel.pl()       # -> Polars
rel.arrow()     # -> Arrow table   rel.fetchall() # -> list[tuple]
```

Use a single connection per thread, never share one cursor across threads. Full client surface —
parameterized queries, relational operators, NumPy/torch round-trips, threading rules — is in
[references/python-and-interop.md](references/python-and-interop.md).

## Friendly SQL — use the dialect

DuckDB's dialect removes the boilerplate that makes analytics SQL tedious. Prefer it in DuckDB-only code.

```sql
FROM events SELECT count(*);                 -- FROM-first: pipe-friendly, valid on its own
SELECT * EXCLUDE (raw_payload) FROM events;  -- everything but the noisy column
SELECT * REPLACE (lower(email) AS email) FROM users;  -- transform one column, keep the rest
SELECT region, sum(amount) FROM sales GROUP BY ALL;   -- no restating non-aggregates
SELECT * FROM sales ORDER BY ALL;            -- deterministic order without listing columns
SELECT COLUMNS('amount_.*') FROM sales;      -- regex over column names
SELECT 1, 2, 3,                              -- trailing commas are legal
```

`GROUP BY ALL` / `ORDER BY ALL` are the biggest wins: add a column to the SELECT and the grouping follows
automatically, so the two clauses can't drift out of sync.

## Remote + lakehouse data

Read from S3/GCS/HTTP without downloading first: load `httpfs` and store credentials in a secret.

```sql
INSTALL httpfs; LOAD httpfs;
CREATE SECRET s3 (TYPE s3, PROVIDER credential_chain);  -- picks up env/role creds
SELECT region, sum(amount) FROM read_parquet('s3://bkt/sales/*.parquet') GROUP BY ALL;
```

Iceberg, Delta, and DuckLake (DuckDB's own SQL-catalog lakehouse format) are read via extensions. Secret
config, hive-partition globs, and the lakehouse one-liners live in
[references/remote-and-lakehouse.md](references/remote-and-lakehouse.md).

## Export & handoff

```sql
COPY (SELECT region, sum(amount) AS rev FROM 'sales/*.parquet' GROUP BY ALL)
  TO 'summary.parquet' (FORMAT parquet);

COPY sales TO 'out/' (FORMAT parquet, PARTITION_BY (year, month));  -- hive-partitioned dataset
```

Parquet is the default handoff: it keeps types and reads straight back into DuckDB, Spark, pandas, or
ClickHouse. Use `PARTITION_BY` so downstream readers can prune partitions.

## Outgrowing DuckDB

DuckDB scales **up** (more RAM/threads, out-of-core spill), not **out**. Tune within one box:

```sql
PRAGMA threads = 8;            -- match cores
PRAGMA memory_limit = '12GB';  -- cap RAM; the rest spills to the temp dir / database file
```

Hand off when you hit the single-process wall: concurrent **writers** or a multi-user query API or an
always-on service → [`clickhouse-analytics`](../clickhouse-analytics/SKILL.md). Want managed/shared/hybrid
DuckDB without running infra → MotherDuck (managed DuckDB-as-a-service; `ATTACH 'md:'`) — the scale-out
escape hatch, not the default.

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| Loading a file into pandas, then querying the frame | Pages the whole file through RAM. `FROM 'file.parquet' SELECT ...` scans only needed columns. |
| Making DuckDB the app's database | One writer, single process — concurrent CRUD writers corrupt the workflow. App OLTP is `postgresdb`. |
| Serving a dashboard API for 200 users from DuckDB | It's embedded, not a server; concurrent users serialize on the writer. That's `clickhouse-analytics`. |
| Running the latest version in prod | Pin the **LTS** (1.4.x; v1.4.4 shipped 2026-01-26) so a future upgrade doesn't break the on-disk format / extension ABI. |
| Downloading the S3 files, then reading them | `INSTALL httpfs` + `CREATE SECRET` reads `s3://...` in place with row-group pushdown. No download. |
| `SELECT *` over a 200-column Parquet | Columnar engine — list the columns you need so it skips the rest. `SELECT *` reads everything. |
| `GROUP BY a, b, c` — restating every column | Drift bait. `GROUP BY ALL` tracks the SELECT automatically. |
| Treating "embedded" as "no need to think about RAM" | Set `memory_limit` / `threads`; without a cap a runaway aggregate can thrash before it spills. |
| Using DuckDB as the embeddings/vector store | VSS exists but vector search is `vector-db`'s workflow, not DuckDB's home turf. |

## Verify

Run `scripts/verify.sh` from anywhere. It runs a tiny self-contained smoke test — prefers the `duckdb`
CLI, falls back to `python3 -c "import duckdb"` — that runs an aggregate and a `read_csv_auto` over a
generated file and asserts a known scalar, proving the documented commands execute on your installed
version. If neither the CLI nor the Python module is present it prints `SKIP` and exits 0. No network.

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), record this project's
DuckDB decisions — version pin, file layout, persistent vs in-memory, remote/secret setup — in
`02-DOCS/wiki/stack/duckdb.md` and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md`
keeps only a short pointer to it). Read it first on
every use and keep choices consistent. No `02-DOCS/`? Skip silently. Conventions are recorded, never gated.
