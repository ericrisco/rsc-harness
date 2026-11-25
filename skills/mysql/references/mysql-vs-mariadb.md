# MySQL vs MariaDB divergence

MariaDB began as a MySQL fork and the two have diverged enough that copy-pasted SQL, auth setup, and
operational assumptions break across them. Always know *which* engine the project runs before you
answer. This is the depth behind the small table in `SKILL.md`.

## Versions and support

| | MySQL | MariaDB |
|---|---|---|
| Current LTS | **8.4 LTS** (GA 2024-04-30, supported through April 2032) | **11.8 LTS** (2025 yearly LTS) |
| Innovation / short-cycle | **9.x** (9.0 GA 2024-07-01, …, 9.4.0 2025-07-22) | rolling releases between LTS years |
| Owner | Oracle | MariaDB Foundation / MariaDB plc |

MariaDB version numbers do **not** track MySQL's — MariaDB 11.8 is not "MySQL 11". Feature parity is
partial and one-directional in places (MariaDB has features MySQL lacks and vice versa).

## Authentication

| | MySQL 8.4 / 9.x | MariaDB 11.8 |
|---|---|---|
| Default plugin | `caching_sha2_password` (SHA-256, server-side cache; TLS for first auth) | `mysql_native_password` and `ed25519` |
| `mysql_native_password` | Disabled by default in 8.4, **removed in 9.0** | Still a first-class plugin |

This is the most common cross-engine connection failure: a client/driver configured for MariaDB's
native auth hits a MySQL 8.4 server and gets *"Authentication plugin caching_sha2_password cannot be
loaded"* — fix is a `caching_sha2_password`-aware client over TLS, not re-enabling the old plugin.

## Vector search — NOT drop-in compatible

Both engines added native vector search, but with **incompatible syntax**:

| | MySQL 9.0+ (Innovation only) | MariaDB 11.8 (LTS) |
|---|---|---|
| Type | `VECTOR(n)` — 4-byte floats, default max 2048, max 16383 entries | `VECTOR(n)` |
| Parse / format | `STRING_TO_VECTOR()` / `TO_VECTOR()`, `VECTOR_TO_STRING()` / `FROM_VECTOR()` | `VEC_FromText()` / `VEC_ToText()` |
| Distance | distance functions per the 9.x line | `VEC_DISTANCE_EUCLIDEAN()`, `VEC_DISTANCE_COSINE()`, `VEC_DISTANCE()` |
| Acceleration | — | SIMD (AVX2/AVX512/ARM/Power10) |
| Key constraint | A `VECTOR` column **cannot be any kind of key** (no PK/FK/UK/partition) | indexable for approximate search |
| LTS availability | **Not in 8.4 LTS** — Innovation 9.x only | In the 11.8 LTS line |

If a project needs vector search on a conservative LTS today, MariaDB 11.8 has it in LTS; MySQL only
has it on the short-lived 9.x Innovation track. The SQL is not portable between them — pick one and
write to its functions.

## Snapshot isolation

MariaDB 11.8 ships `innodb_snapshot_isolation` defaulting **ON**, which makes a `REPEATABLE READ`
transaction *detect write conflicts* (raising an error instead of silently applying a stale-snapshot
write). Stock MySQL `REPEATABLE READ` does **not** do this — it gives a consistent snapshot but no
write-conflict detection. Code that relies on MariaDB raising a conflict error will silently succeed
(and possibly lose an update) on MySQL, and vice versa code that doesn't expect the error will fail
on MariaDB.

## Other SQL surface divergences

| Feature | MySQL | MariaDB |
|---|---|---|
| `RETURNING` | Not supported (use `LAST_INSERT_ID()` / `ROW_COUNT()`) | `INSERT` / `UPDATE` / `DELETE ... RETURNING` |
| Sequences | No `CREATE SEQUENCE` (use `AUTO_INCREMENT`) | `CREATE SEQUENCE` supported |
| System-versioned (temporal) tables | Not supported | `WITH SYSTEM VERSIONING` + `FOR SYSTEM_TIME` queries |
| `JSON` type | Native binary `JSON` | Historically a `LONGTEXT` alias with JSON functions; check the version — behaviour and storage differ |
| Optimizer / hints | Oracle-style optimizer, `/*+ HINT */` hint syntax, hypergraph optimizer in newer Innovation | Different optimizer, different hint set and defaults; plans differ for the same query |
| Storage engines | InnoDB-centric | InnoDB plus Aria, ColumnStore, Spider, etc. |

## Migration gotchas, both directions

- **MariaDB → MySQL**: drop reliance on sequences, system-versioned tables, multi-statement
  `RETURNING`, and the snapshot-isolation conflict behaviour. Re-check JSON columns. Re-key any
  vector columns and rewrite vector SQL.
- **MySQL → MariaDB**: auth changes (native/ed25519 vs caching_sha2_password); rewrite MySQL 9
  vector SQL to `VEC_*`; expect `innodb_snapshot_isolation=ON` to start raising conflict errors your
  app didn't see before; verify optimizer-hint syntax and re-test query plans.
- **Don't trust `mysqldump` round-trips blindly** across engines — types, charsets, and engine
  clauses can differ. Dump, then read the DDL before loading into the other engine.

Bottom line: treat MySQL and MariaDB as two different databases that happen to share a wire protocol
and a lot of grammar. Confirm the engine, then write to its specifics.
