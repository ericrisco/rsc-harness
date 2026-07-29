---
name: sql
description: "Use when writing or reviewing advanced SQL query logic independent of any one engine — multi-table joins, window functions, CTEs including recursive ones, GROUP BY and GROUPING SETS aggregation, and set operations — or when a query returns too many rows, too few, or wrong totals. NOT engine internals, indexes or EXPLAIN (that is `postgresdb`), NOT MySQL config (that is `mysql`), NOT OLAP columnar specifics (that is `duckdb`)."
tags: [sql, query, joins, window-functions, cte]
recommends: [postgresdb, mysql, duckdb, drizzle-orm]
origin: risco
---

# SQL — engine-agnostic query craft

This skill is the portable query-writing layer that sits *above* any one database engine. It owns
the SELECT-side craft: joins and what each does to row count and NULLs, window functions
(`PARTITION`/`ORDER`/frame), CTEs (including recursive), aggregation (`GROUP BY`/`GROUPING SETS`/`HAVING`),
set operations (`UNION`/`INTERSECT`/`EXCEPT`), conditional logic (`CASE`/`COALESCE`/`NULLIF`), and the
NULL three-valued-logic traps that quietly corrupt results across *every* engine. You write queries a
reviewer accepts on Postgres, MySQL 8, SQLite, DuckDB, SQL Server, or BigQuery with minimal change, and
you flag exactly where a construct is non-portable and what the dialect substitute is. The target
standard is **SQL:2023 (ISO/IEC 9075:2023)**, the ninth edition published June 2023; window functions
have been standard since **SQL:2003**, so they are safe to assume everywhere.

This is about *thinking in sets and frames*, not about one product's planner, DDL, indexing, or ops.

## When to use

- Writing a non-trivial read query: multi-table join, "top-N per group", running totals,
  period-over-period deltas, dedup, pivots, cohort/funnel shaping.
- Reaching for a window function and unsure about `PARTITION BY` vs `GROUP BY`, or `ROWS` vs `RANGE`
  vs `GROUPS` frames.
- Structuring a query with CTEs or recursive CTEs (hierarchies, graph walks, generated series).
- Aggregation shaping: `GROUP BY`, `HAVING`, `GROUPING SETS`/`ROLLUP`/`CUBE`, conditional aggregates.
- Combining result sets with `UNION`/`INTERSECT`/`EXCEPT`; deciding `ALL` vs distinct.
- Debugging a query that returns *too many rows* (join fan-out), *too few* (NULL-eating `NOT IN`), or
  *wrong aggregates* (counting joined duplicates).
- Translating a procedural loop ("for each row, query again") into one set-based statement.
- Reviewing SQL for portability and correctness regardless of the target engine.

## When NOT to use

| The ask | Route to |
| --- | --- |
| Engine-level Postgres: DDL types, indexes, EXPLAIN, VACUUM, RLS, pooling | `../postgresdb/SKILL.md` |
| MySQL-specific behavior/config (InnoDB, buffer pool) | `../mysql/SKILL.md` |
| DuckDB local-analytics / columnar specifics | `../duckdb/SKILL.md` |
| ClickHouse columnar OLAP engine specifics | `../clickhouse-analytics/SKILL.md` |
| ORM/builder API ergonomics (the API, not the emitted SQL) | `../drizzle-orm/SKILL.md`, `../prisma-orm/SKILL.md` |
| Schema design / DDL / migrations | `../db-migrations/SKILL.md` |
| BI dashboards, reporting layout, metric definitions | `../business-intelligence/SKILL.md` |
| Cleaning messy data as a pipeline task | `../data-cleaning/SKILL.md` |

The defining line: **`sql` = portable query-language craft; engine skills = one product's behavior,
storage, and operations.** When the engine isn't decided, or the question is "how do I express this in
SQL at all" rather than "how does Postgres run it" — you are in the right place.

## Non-negotiables

1. **Explicit `JOIN` syntax, never comma-joins.** `FROM a, b WHERE a.id = b.a_id` hides the join
   condition in the filter — drop the `WHERE` clause by accident and you get a silent cross product.
2. **Alias and qualify every column in a multi-table query.** `SELECT id, name` is ambiguous and breaks
   the moment two joined tables share a column name; `SELECT o.id, c.name` survives schema changes.
3. **`NOT EXISTS` over `NOT IN` whenever the inner side is nullable.** `NOT IN` returns *zero rows* if the
   subquery yields a single NULL (3VL `UNKNOWN` is never `TRUE`); `NOT EXISTS` is NULL-safe. Standard, not
   engine-specific.
4. **Know your implicit window frame.** A window function with `ORDER BY` but no explicit frame defaults to
   `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, which lumps *tied* rows together — not `ROWS`. This
   silently wrong running total is the single most common window bug, identical across engines. Write the
   frame explicitly.
5. **Every non-aggregated SELECT column appears in `GROUP BY`.** Engines that let you skip it (old MySQL)
   return an arbitrary row per group — a correctness landmine, not a convenience.
6. **`UNION ALL` unless you genuinely need dedup.** Bare `UNION` sorts/hashes to remove duplicates — real
   cost — and silently collapses rows you meant to keep. Add `ALL` by default; remove it deliberately.
7. **Reason about NULL 3VL before writing any predicate.** `NULL = NULL` is `UNKNOWN`, `x <> 5` excludes
   NULL `x`, and `COUNT(col)` skips NULLs while `COUNT(*)` does not. Decide what NULL means before the WHERE.
8. **One set-based statement beats a procedural loop.** "For each row, run another query" is almost always a
   join or a window function — orders of magnitude faster and atomic. Reach for sets first.

## Decision tables

### JOIN chooser

| Want | Use | Row-count effect | NULL behavior |
| --- | --- | --- | --- |
| Only matching pairs | `INNER JOIN` | Can shrink **and** fan out on 1-to-many | Unmatched rows dropped |
| All left rows + matches | `LEFT JOIN` | ≥ left row count | Right columns NULL when no match |
| All rows from both | `FULL JOIN` | ≥ max(left, right) | NULLs on whichever side lacks a match |
| Every combination | `CROSS JOIN` | left × right (multiplies!) | None |
| "Left rows that have a match" | semi-join via `EXISTS` | = left, no duplication | No right columns added |
| "Left rows with no match" | anti-join via `NOT EXISTS` | ≤ left | NULL-safe (unlike `NOT IN`) |

A 1-to-many `JOIN` *fans out* the left row once per match. If you then `SUM`/`COUNT`, the aggregate is
inflated. Use a semi-join (`EXISTS`) when you only want existence, not the joined columns.

### GROUP BY vs window function

| You want… | Use | Result |
| --- | --- | --- |
| One row per group (collapse detail) | `GROUP BY` | Fewer rows; only group keys + aggregates survive |
| Keep every row **and** add a per-group number | `... OVER (PARTITION BY …)` | Same row count; aggregate alongside detail |

Rule of thumb: if the question is "per X, the total/rank/previous," and you still want the individual
rows, it is a window function. If you only want the rollup, it is `GROUP BY`.

### Frame chooser (`ROWS` / `RANGE` / `GROUPS`)

| Frame unit | Counts by | Use for | Portability |
| --- | --- | --- | --- |
| `ROWS` | Physical rows | Running totals, moving averages | Everywhere |
| `RANGE` | Value range of the `ORDER BY` key | "All rows within ±N of this value/date" | Everywhere |
| `GROUPS` | Peer groups (tied rows) | "N distinct ordering-value steps back" | **Not in MySQL 8** |

`ROWS` and `RANGE` plus `EXCLUDE` and numeric `RANGE` offsets work on Postgres 11+ and SQLite 3.28+.
**MySQL 8 supports only `ROWS` and `RANGE` — no `GROUPS`, no `EXCLUDE`.** See `references/window-functions.md`.

### Subquery vs JOIN vs CTE

| Need | Reach for |
| --- | --- |
| Existence / anti-existence test | correlated `EXISTS` / `NOT EXISTS` |
| Combine columns from another table | `JOIN` |
| Name an intermediate result, reuse or read it cleanly | CTE (`WITH`) |
| Hierarchy, graph walk, generated series | recursive CTE (`WITH RECURSIVE`) |

## Copy-paste patterns

Every fence is `sql`. Full depth in `references/`.

**Top-N per group** — never `LIMIT` inside a correlated subquery.

```sql
-- Bad: correlated subquery runs once per customer; non-portable LIMIT placement
SELECT * FROM orders o
WHERE o.id IN (
  SELECT id FROM orders i WHERE i.customer_id = o.customer_id
  ORDER BY i.amount DESC LIMIT 3
);

-- Good: one pass, ranked, then filtered
SELECT customer_id, id, amount
FROM (
  SELECT customer_id, id, amount,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC) AS rn
  FROM orders
) ranked
WHERE rn <= 3;
```

**Running total** — make the frame explicit so ties don't lump.

```sql
-- Bad: no frame -> implicit RANGE, tied dates collapse into one running value
SELECT day, SUM(amount) OVER (ORDER BY day) AS running FROM sales;

-- Good: explicit ROWS frame counts physical rows
SELECT day,
       SUM(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
FROM sales;
```

**Period-over-period with `LAG`.**

```sql
-- Good: previous row's value per partition; NULL on the first row is expected
SELECT month, revenue,
       revenue - LAG(revenue) OVER (PARTITION BY product_id ORDER BY month) AS delta,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (PARTITION BY product_id ORDER BY month))
             / NULLIF(LAG(revenue) OVER (PARTITION BY product_id ORDER BY month), 0), 2) AS pct_change
FROM monthly_revenue;
```

`NULLIF(prev, 0)` guards against divide-by-zero; the first row's `LAG` is NULL by design.

**Dedup keeping latest** — `QUALIFY` is convenient but narrow.

```sql
-- Portable: rank then filter in an outer query
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY updated_at DESC) AS rn
  FROM users
) d WHERE rn = 1;

-- DuckDB / BigQuery / Snowflake only: QUALIFY skips the wrapper. NOT in Postgres/MySQL/SQLite.
SELECT * FROM users
QUALIFY ROW_NUMBER() OVER (PARTITION BY email ORDER BY updated_at DESC) = 1;
```

**Recursive CTE with a depth guard** — always bound the recursion.

```sql
-- Good: org chart walk; depth column stops runaway / cyclic graphs
WITH RECURSIVE tree AS (
  SELECT id, manager_id, name, 1 AS depth
  FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.manager_id, e.name, t.depth + 1
  FROM employees e JOIN tree t ON e.manager_id = t.id
  WHERE t.depth < 50            -- hard ceiling; for true cycles track a path array
)
SELECT * FROM tree;
```

**Conditional aggregation / pivot** — `FILTER` reads cleaner than `CASE`.

```sql
-- Portable everywhere: CASE inside the aggregate
SELECT region,
       SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
       SUM(CASE WHEN status = 'open' THEN amount ELSE 0 END) AS open
FROM invoices GROUP BY region;

-- Postgres/SQLite/DuckDB: FILTER is the standard, more readable form. NOT in MySQL/SQL Server.
SELECT region,
       SUM(amount) FILTER (WHERE status = 'paid') AS paid,
       SUM(amount) FILTER (WHERE status = 'open') AS open
FROM invoices GROUP BY region;
```

**`GROUPING SETS` / `ROLLUP`** — one scan, multiple aggregation levels.

```sql
-- Good: subtotals per (region, product), per region, and grand total in one query
SELECT region, product, SUM(amount) AS total
FROM sales
GROUP BY ROLLUP (region, product);   -- = GROUPING SETS ((region,product),(region),())
```

**Anti-join via `NOT EXISTS`** — the NULL-safe "rows with no match."

```sql
-- Good: customers who never ordered; correct even if orders.customer_id has NULLs
SELECT c.id, c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**The `NOT IN`-NULL footgun.**

```sql
-- Bad: if ANY returned customer_id is NULL, this yields ZERO rows, silently
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);

-- Good: NOT EXISTS, or NOT IN with an explicit IS NOT NULL filter on the inner column
SELECT * FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

## Portability quick map

| Construct | Notes |
| --- | --- |
| `QUALIFY` | DuckDB / BigQuery / Snowflake only — elsewhere wrap in a subquery and filter `rn` |
| `FILTER (WHERE …)` | Postgres / SQLite / DuckDB — MySQL & SQL Server need `CASE` |
| `GROUPS` frame, `EXCLUDE` | Postgres 11+, SQLite 3.28+ — **not in MySQL 8** |
| `EXCEPT` | Standard; Oracle spells it `MINUS` |
| Row limiting | `LIMIT … OFFSET` (Postgres/MySQL/SQLite/DuckDB) vs `FETCH FIRST n ROWS ONLY` (standard/SQL Server 2012+) vs `TOP n` (SQL Server) |
| Set-op column match | By **position and type**, not by name — order your columns identically |

Full six-engine matrix in `references/portability.md`.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality | STOP |
| --- | --- | --- |
| "`NOT IN` is clearer than `NOT EXISTS`" | One NULL in the inner set returns zero rows, silently | Use `NOT EXISTS` for nullable inner columns |
| "`SELECT *` is fine in this query" | Hides which columns matter; breaks `GROUP BY`, ambiguous on joins | Project explicit, qualified columns |
| "Old MySQL let me skip the GROUP BY column" | You get an arbitrary row per group | List every non-aggregated column |
| "No frame needed, I just want a running sum" | Implicit `RANGE` lumps tied rows -> wrong total | Write `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| "I'll loop in app code and query per row" | N+1 round trips; a window function does it in one scan | Express it as one set-based statement |
| "`UNION` to merge these results" | Pays a dedup sort and drops rows you wanted | `UNION ALL` unless dedup is the goal |
| "`COUNT(*)` after the join is the real count" | A 1-to-many join fanned the rows out | Count on the base table or use a semi-join |
| "Add `DISTINCT` to fix the duplicate rows" | Masks a fan-out join instead of fixing it | Find the join multiplying rows; fix the grain |

## Verify

Run `scripts/verify.sh` from your project root. It is read-only, never connects to a database, and runs
on stock macOS bash 3.2. It heuristically scans discovered `.sql` files and warns on the footguns above
(`NOT IN (SELECT …)`, comma-joins with WHERE-join predicates, `SELECT *` alongside `GROUP BY`, window
`OVER (… ORDER BY …)` with no explicit frame) and, if `sqlfluff` is installed, lints with `--dialect ansi`.
It exits non-zero only on a real `sqlfluff` lint error or unbalanced parens/quotes (dollar-quote aware);
every heuristic is advisory `[warn]`, and an empty target passes clean.

## See Also

- `references/window-functions.md` — ranking/offset/aggregate-over catalog, every frame unit worked, `EXCLUDE`, named windows, implicit-frame trap, per-engine matrix.
- `references/joins-and-sets.md` — every join type with row-count reasoning, semi/anti/lateral joins, set ops + `ALL`/dedup/`MINUS`, the fan-out-inflates-aggregates bug.
- `references/ctes-and-recursion.md` — CTE structuring, recursive template (hierarchy/graph/series) with cycle + depth guards, the optimization-fence portability note.
- `references/portability.md` — full dialect matrix across Postgres / MySQL 8 / SQLite / DuckDB / SQL Server / BigQuery.
- Siblings: `../postgresdb/SKILL.md`, `../mysql/SKILL.md`, `../duckdb/SKILL.md`, `../clickhouse-analytics/SKILL.md`, `../drizzle-orm/SKILL.md`, `../prisma-orm/SKILL.md`, `../db-migrations/SKILL.md`. ORM/engine internals are out of scope here — this skill owns the SQL those tools ultimately emit.
