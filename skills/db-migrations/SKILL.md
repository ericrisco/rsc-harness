---
name: db-migrations
description: "Use when a schema change must ship without downtime — NOT NULL, rename, type change, or backfilling millions of live rows — for the expand-contract sequence and the lock/batching discipline that keeps each step from freezing prod. NOT lock internals or EXPLAIN (that is `postgresdb`), NOT drizzle-kit mechanics (that is `drizzle-orm`), NOT PITR (that is `backups`)."
tags: [migrations, zero-downtime, expand-contract, schema, backfill, ddl]
recommends: [postgresdb, drizzle-orm, backups, sql, planetscale]
origin: risco
---

# Database migrations without downtime

A production migration is a **sequence**, not a statement. The moment you treat `ALTER TABLE ... NOT NULL`
as one atomic change, you have already lost: the lock blocks every writer, the deploy that depends on the
new column races the deploy that still reads the old one, and a rollback means a second outage. Your job
is to decompose one risky change into a chain of small steps where **every intermediate state is
independently deployable** — the old app keeps working, the new app keeps working, and you can stop at any
point without an outage.

This skill is engine-neutral. It owns the *choreography* — what order to run things in and how to keep each
DDL from freezing the table — across Postgres, MySQL, and serverless variants, whatever runner you use
(Flyway, Alembic, golang-migrate, drizzle-kit, raw SQL).

## Route elsewhere

- Postgres lock internals, EXPLAIN/ANALYZE, indexing strategy, RLS, PgBouncer → `../postgresdb/SKILL.md`.
- Writing schema and running drizzle-kit specifically → `../drizzle-orm/SKILL.md`.
- PlanetScale deploy-request / branch cutover (Vitess online DDL) → `../planetscale/SKILL.md`.
- Creating/verifying backups, restore drills, PITR → `../backups/SKILL.md` (a migration *requires* a backup; making it lives there).
- Pure query logic — joins, windows, CTEs → `../sql/SKILL.md` (backfill batching is here; query correctness is there).

## Step 1 — Is this change online-safe in one step?

Most outages come from running a multi-step change as a single statement. Decide first:

| Change | One step? | Why |
|---|---|---|
| Add nullable column, no volatile default | Yes | Metadata-only on PG 11+/modern MySQL; no rewrite, no long lock. |
| Add column with a **constant** default | Yes (PG 11+) | Stored as a catalog default, no table rewrite. |
| Add column with a **volatile/expression** default | No | Rewrites every row under lock → expand-contract. |
| Add `NOT NULL` to existing/new column | No | Full-table validation scan under lock → add-nullable → backfill → validate. |
| Rename column / table | No | App reads the old name; needs dual-name window → expand-contract. |
| Change column type (non-trivial) | No | Rewrites rows, may invalidate the running app → new column + backfill. |
| Split / merge columns | No | Two-sided data move → expand-contract. |
| Drop column / table | No | Running app may still reference it → contract only after a cooling period. |
| Add foreign key | No | `ADD CONSTRAINT` validates all rows under lock → add `NOT VALID` then `VALIDATE`. |
| Create index | No, but cheap | Plain `CREATE INDEX` locks writes → use `CONCURRENTLY`. |

If the row says **No**, you are doing expand-contract. Go to Step 2.

## Step 2 — The expand-contract loop

Three phases, each tied to a **distinct deploy**. Worked example: rename `users.email` → `users.email_address`.

**Expand** — add the new structure, start dual-writing, leave the old one fully working.

```sql
-- migration 1 (deploy A): additive only, old app untouched
SET lock_timeout = '1s';
ALTER TABLE users ADD COLUMN email_address text;  -- nullable, no default → metadata-only
```

```text
App deploy A: write BOTH columns on every insert/update; keep READING email.
```

**Backfill** — copy historical data in small background batches (Step 4), then verify counts/checksums.

**Switch reads** — once backfilled and verified, deploy the app that reads `email_address`.

```text
App deploy B: read email_address; still dual-write both.  ← cooling period starts here
```

**Contract** — only after a cooling period (hours to days) where the new app has run clean and you can
still roll back the app without touching schema, stop writing the old column and drop it.

```sql
-- migration 2 (deploy C): runs days later, after cooling period
SET lock_timeout = '1s';
ALTER TABLE users DROP COLUMN email;
```

The cooling period is the point. It is what lets you roll back app deploy B to app deploy A with **zero
schema change** — because the old column still exists and is still being written. Contracting early throws
that safety away.

## Step 3 — The N/N-1 rule

At every moment, two app versions can be live: the one running and the one rolling out. **The schema must
be compatible with both, and each app must tolerate the other's schema.** That is the entire reason
dual-write exists — it makes the schema a superset that satisfies app N and app N+1 simultaneously.

```text
schema:  +email_address ......................... -email
apps:    [N reads email] [N+1 reads email_address] [N+2 ignores email]
              ^ both alive during rollout ^         ^ safe to drop now ^
```

If you ever have a single instant where one deployed app version cannot run against the current schema,
your migration is not zero-downtime — it is a timed outage.

## Step 4 — Make each DDL statement safe

**Always set a short `lock_timeout` first.** A DDL waiting on a lock builds a *queue* — every query behind
it stalls too, and one slow ALTER freezes the whole table. A short timeout makes the migration fail fast so
traffic keeps flowing; you retry instead of taking the site down.

```sql
-- Bad: unbounded wait; if a lock is held, this queues every reader/writer behind it
ALTER TABLE orders ADD COLUMN region text;

-- Good: fail fast, retry
SET lock_timeout = '1s';
ALTER TABLE orders ADD COLUMN region text;
```

**Create indexes `CONCURRENTLY`, outside a transaction.** Plain `CREATE INDEX` takes a SHARE lock and
blocks all writes for its whole duration — that is the "our deploy deadlocks when we add an index" symptom.
`CONCURRENTLY` takes SHARE UPDATE EXCLUSIVE and does not block writes, but **cannot run inside a transaction
block**. Runners (Flyway, Alembic, Django, Rails) wrap each migration in a transaction by default, so you
must opt that step out — see `references/tools-and-runners.md`.

```sql
-- Bad: locks out every writer for the full build
CREATE INDEX idx_orders_region ON orders (region);

-- Good: non-blocking; this statement must NOT be inside BEGIN/COMMIT
CREATE INDEX CONCURRENTLY idx_orders_region ON orders (region);
```

> A failed `CONCURRENTLY` build leaves an INVALID index behind. Drop it (`DROP INDEX CONCURRENTLY`) before
> retrying. For PG-specific lock-level detail, see `../postgresdb/SKILL.md`.

**Add NOT NULL in four steps, never in one.** A single `ALTER ... SET NOT NULL` (or `ADD COLUMN ... NOT
NULL DEFAULT <volatile>`) scans/rewrites the whole table under lock.

```sql
-- Bad: full-table validation/rewrite under an exclusive lock
ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active';  -- on a 40M-row table = outage

-- Good: add nullable, backfill in batches (Step 5), then add a constraint without a blocking scan
SET lock_timeout = '1s';
ALTER TABLE users ADD COLUMN status text;                              -- 1. nullable
-- 2. backfill in batches (Step 5), app dual-writes the new column
ALTER TABLE users ADD CONSTRAINT users_status_nn
  CHECK (status IS NOT NULL) NOT VALID;                                -- 3. instant, no scan
ALTER TABLE users VALIDATE CONSTRAINT users_status_nn;                 -- 4. scans WITHOUT blocking writes
-- PG 12+: a validated CHECK (col IS NOT NULL) lets SET NOT NULL skip its own scan
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
```

Same `NOT VALID` → `VALIDATE` pattern for adding a foreign key. The full per-change checklists live in
`references/expand-contract-playbook.md`.

## Step 5 — Backfill at scale

**Never one giant `UPDATE`.** A single statement over millions of rows holds locks, bloats WAL/undo, and
pins replicas behind a wall of lag. Loop bounded chunks, commit each, throttle on lag, then verify.

```sql
-- Bad: one statement locks rows, balloons WAL, spikes replica lag for minutes
UPDATE users SET email_address = email WHERE email_address IS NULL;
```

```sql
-- Good: bounded PK-range batches, committed individually, throttled between batches
-- pseudo-loop (driven by your runner/script): a few thousand rows per batch
UPDATE users
SET email_address = email
WHERE id BETWEEN :lo AND :hi
  AND email_address IS NULL;
-- commit; check replica lag; sleep if lag/error-rate is high; advance :lo/:hi; repeat
```

Watch replication lag and the app error rate between batches; back off when either climbs. **Verify before
contracting** — row counts and a checksum of old-vs-new must match. For very large sets, snapshot + CDC
instead of an online loop. Postgres and MySQL backfill scripts, the lag-throttle, and checksum queries are
in `references/backfill-and-batching.md`.

## Step 6 — Rollback reality

**Forward-only is the prevailing 2025-2026 production stance.** Reliable `down()` migrations are rarely
worth the effort — whether a rollback is even safe depends on the migration type and how much time has
passed (data has changed under you). Treat applied migrations as immutable and **fix forward**.

Your real safety net is not a `down()` script — it is the expand-contract structure itself: because the old
column/table still exists during the cooling period, "rolling back" is just redeploying the previous app.
A reversible down-migration is only worth writing when the change is **additive-only and pre-traffic**
(e.g. a brand-new table no app version reads yet). For anything that touched live data, a down-migration is
a trap that looks like a seatbelt.

## Step 7 — Pick a runner / OSC tool

Versioned runners replay ordered scripts; declarative tools diff your target schema. Pick by stack:

| Stack / need | Tool (2026) | Note |
|---|---|---|
| JVM, SQL-first, 50+ DBs | Flyway 12.6.x | Version-based; Redgate dropped the Teams tier in 2025. |
| Max format flexibility | Liquibase | SQL/XML/YAML/JSON changelogs; most verbose. |
| Python / SQLAlchemy | Alembic 1.18.x | Requires Python ≥3.10; plugin system since 1.18.0. |
| Go | golang-migrate | The Go standard. |
| TypeScript / Drizzle | drizzle-kit | Mechanics in `../drizzle-orm/SKILL.md`; safety sequence here. |
| Schema-as-code, planned diffs | Atlas | Declarative — you give the target, it plans the diff. |
| Big MySQL ALTER, native online DDL can't keep it online | gh-ost or pt-osc | See below. |

**gh-ost vs pt-osc** for a large MySQL ALTER: **gh-ost** is triggerless — it copies in chunks and replays
the binlog, throttles on replica lag, and gives easier pause/cutover control; prefer it on a very busy
master. **pt-osc** is trigger-based — strictly consistent, but the triggers add write overhead and can fail
to acquire the metadata lock under highly concurrent or long-transaction load. Decision detail and
per-runner transaction opt-out in `references/tools-and-runners.md`.

## Step 8 — Gate migrations in CI

Add a static linter for migration SQL **before merge**, so a bare `CREATE INDEX` or a one-shot `NOT NULL`
never reaches review. **Squawk** is the standard for Postgres migration SQL — it flags adding NOT NULL
columns, non-concurrent index creation, blocking constraint adds, and column drops.

```yaml
# CI step: fail the PR on dangerous migration DDL
- name: Lint migrations
  run: npx squawk@latest migrations/*.sql
```

Config snippet and rule notes in `references/tools-and-runners.md`. `scripts/verify.sh` in this skill runs
the same static checks against the example migrations shipped in `references/`.

## Anti-patterns

| Anti-pattern | Why it hurts | Do instead |
|---|---|---|
| `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT <expr>` on a big table | Full-table rewrite under lock = outage | add nullable → backfill → `NOT VALID` → `VALIDATE` (Step 4) |
| Plain `CREATE INDEX` in prod | SHARE lock blocks all writes for the build → deploy "deadlock" | `CREATE INDEX CONCURRENTLY`, outside a transaction |
| DDL with no `lock_timeout` | Builds a lock queue; one slow ALTER freezes the table | `SET lock_timeout='1s'` first, fail fast, retry |
| One giant backfill `UPDATE` | Locks rows, bloats WAL, spikes replica lag | bounded batches, commit each, throttle on lag (Step 5) |
| Renaming a column the running app still reads | Instant errors for app version N | dual-name window: add new, dual-write, switch reads, then drop |
| Contracting before the cooling period | Kills your no-schema-change rollback path | wait until the new app has run clean; then drop |
| Relying on `down()` in prod | Data already changed; rollback is unsafe or wrong | forward-only; expand-contract IS the rollback (Step 6) |
| Coupling app + schema in one deploy | Breaks N/N-1; an instant where some app can't run | separate deploys; schema is a superset of both (Step 3) |
