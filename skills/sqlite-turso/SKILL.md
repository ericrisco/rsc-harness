---
name: sqlite-turso
description: "Use when deciding whether plain SQLite is enough, or wiring SQLite, Turso or libSQL for local-first, edge and embedded-replica apps — a local file DB, a remote Turso URL, or a local replica synced to a remote primary — plus WAL mode and SQLite's single-writer model and its lock errors. NOT Drizzle schema or queries on libSQL (that is `drizzle-orm`), NOT versioned up/down migrations (that is `db-migrations`), NOT serverless Postgres with branching (that is `neon`)."
tags: [sqlite, turso, libsql, edge, embedded-replica, local-first, wal]
recommends: [drizzle-orm, db-migrations, postgresdb, neon, backups, sql]
origin: risco
---

# SQLite & Turso/libSQL — decide, connect, operate

SQLite is an in-process, single-file, **single-writer** relational engine. Turso/libSQL is the
fork that adds a remote edge database and — the part people actually want — **embedded replicas**:
a local SQLite file that syncs to a remote primary, so reads are microsecond-local and writes still
land durably in the cloud.

This skill is **decide + connect + operate**. It owns the engine truths (WAL, single writer,
pragmas), the three deployment shapes, and wiring the current `@libsql/client`. It does NOT own
schema modeling or type-safe queries (that is `drizzle-orm`), versioned migration files (that is
`db-migrations`), or backup strategy as a primary task (that is `backups`).

## Is SQLite/Turso the right tool?

Decide first. Picking SQLite for a high-write multi-writer workload is the mistake that wastes a week.

| Workload | Verdict | Why / route |
|---|---|---|
| Read-heavy, single-tenant, low-to-moderate writes | **SQLite/Turso** | One writer is plenty; reads are local and fast. |
| Local-first / offline / edge app needing cloud durability | **Turso embedded replica** | Local file for reads, syncs to a remote primary. |
| Database-per-user / per-tenant at scale | **Turso** | Unlimited databases on the free tier; cheap isolation. |
| Many concurrent writers, complex roles, extensions | No → `postgresdb` (or `mysql`) | SQLite serializes writers; one writer at a time. |
| Serverless Postgres with branching | No → `neon` | Turso is serverless *SQLite*, not Postgres. |
| MySQL-compatible serverless | No → `planetscale` | Different engine and protocol. |
| Auth + realtime + storage + Postgres bundled | No → `supabase` | You want a BaaS, not a raw SQL engine. |
| Columnar OLAP / analytical aggregates | No → `duckdb` | SQLite/Turso is OLTP, row-oriented. |
| Ephemeral cache / KV | No → `redis` | Not a durable relational store. |

## Three deployment shapes

Every Turso/libSQL decision reduces to which of these three you are wiring. The URL scheme picks the
transport automatically.

| Shape | `createClient` config | Latency | When |
|---|---|---|---|
| **Local file** | `url: "file:local.db"` | In-process | Dev, CLI tools, single-node app, tests. |
| **Remote edge DB** | `url: "libsql://<db>.turso.io"` + `authToken` | Network round-trip | Serverless/stateless functions; no local disk to sync. |
| **Embedded replica** | `url: "file:local.db"` + `syncUrl` + `authToken` | Microsecond reads | Local-first/edge with cloud durability — the flagship. |

`libsql://` resolves to HTTPS/WSS. `file:` is native. `https:`/`http:` is Hrana HTTP, `wss:`/`ws:`
is Hrana WebSocket. You rarely set the scheme by hand — you set the URL and the client chooses.

## Connect with `@libsql/client`

Current client is **`@libsql/client` v0.17.x**. Never hardcode the auth token — read it from the
environment. Convention: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

```ts
// 1. Local file — dev, tests, single node
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:local.db" });
```

```ts
// 2. Remote edge DB — serverless, no local disk
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,   // libsql://<db>.turso.io
  authToken: process.env.TURSO_AUTH_TOKEN!,
});
```

```ts
// 3. Embedded replica — local reads, syncs to the primary
import { createClient } from "@libsql/client";

const db = createClient({
  url: "file:local.db",                   // MUST be a local file
  syncUrl: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
  syncInterval: 60,                        // seconds; or call db.sync() manually
});
```

Rule: an embedded replica's `url` is **always** a local `file:` — `syncUrl` is the remote. If you
set `syncUrl` next to a `libsql://` url you have not built a replica, you have a confused remote
client. (verify.sh enforces exactly this.)

In serverless/edge runtimes the import is the same; just confirm the runtime exposes a writable temp
path for the `file:` replica, or fall back to shape #2 (remote-only).

## WAL and the pragmas you must set

For any **local file** or **embedded replica** connection, set these per-connection on open. They do
not apply to a remote-only client (the primary already runs WAL server-side).

```sql
PRAGMA journal_mode = WAL;     -- concurrent readers + one writer; default rollback-journal blocks readers during writes
PRAGMA busy_timeout = 5000;    -- wait up to 5s for the write lock instead of erroring SQLITE_BUSY immediately
PRAGMA foreign_keys = ON;      -- FK enforcement is OFF by default and is PER-CONNECTION — set it every time
PRAGMA synchronous = NORMAL;   -- safe with WAL; far fewer fsyncs than the default FULL
```

`journal_mode` is persistent once set on the file; `busy_timeout`, `foreign_keys`, and `synchronous`
are per-connection — re-issue them on every new connection (and in pooled environments, on checkout).

## Writes, batches, transactions

Always parameterize. String-concatenated SQL is an injection hole and defeats statement caching.

```ts
// Bad — string interpolation
await db.execute(`INSERT INTO users (email) VALUES ('${email}')`);

// Good — positional ? args (named $name and tuple [sql, args] forms also work)
await db.execute({ sql: "INSERT INTO users (email) VALUES (?)", args: [email] });
```

`batch` runs many statements **atomically in one transaction** — all commit or all roll back.

```ts
// mode: "write" (default), "read", or "deferred"
const rs = await db.batch(
  [
    { sql: "INSERT INTO orders (user_id, total) VALUES (?, ?)", args: [userId, total] },
    { sql: "UPDATE users SET order_count = order_count + 1 WHERE id = ?", args: [userId] },
  ],
  "write",
);
```

Single-writer rule: SQLite allows exactly one writer at a time. Under concurrent writes you get
`SQLITE_BUSY` / "database is locked". The fix is WAL + `busy_timeout` above, plus keeping write
transactions short. If you genuinely need many simultaneous writers, that is the signal to route to
`postgresdb` — do not paper over it with retries forever.

## Embedded replica sync

A replica keeps a local copy of the data and pulls changes from the primary. Reads hit the local
file; writes are sent to the primary and propagate back on the next sync.

- **Periodic**: pass `syncInterval` (seconds) to `createClient` and the client syncs in the background.
- **On-demand**: call `await db.sync()` yourself — it returns `{ frame_no, frames_synced }` (the
  replication frame you are now at, and how many frames this call pulled).
- `readYourWrites` (default `true`) guarantees a connection sees its own writes immediately. Set it
  to `false` only when you specifically want a sync's effect to become observable on its own timeline.
- **Gotcha**: calling `db.sync()` on a remote-only or pure HTTP/WS client throws `LibsqlError` with
  code `SYNC_NOT_SUPPORTED`. Only embedded-replica clients (those with a local `file:` + `syncUrl`)
  can sync.

Deeper material — sync internals, frame numbers, `readYourWrites` semantics, offline/bidirectional
writes, per-tenant database-per-user patterns, stale-read handling — lives in
[references/embedded-replicas.md](references/embedded-replicas.md).

## libSQL today vs Turso Database (Rust) tomorrow

Two things wear the "Turso" name; do not confuse them.

- **libSQL** is the SQLite fork and the battle-tested foundation. For production today, **use
  libSQL** via `@libsql/client`. This is the official guidance — mission-critical workloads run here.
- **Turso Database** is a from-scratch rewrite of SQLite in Rust (formerly "Limbo"), adding MVCC
  concurrent writes and bidirectional offline sync. It is the future direction and where new features
  land, but it is not the default production target yet.

Separately: **"edge replicas" are being discontinued for new users** (data showed ~70% never used
them), along with multi-DB schemas and `ATTACH`. Existing paid customers keep them. This is **not**
the same as embedded replicas — embedded replicas remain the flagship. Do not design a new account
around edge replicas.

Turso/libSQL also has native vector search (DiskANN). For a dedicated vector store, route to
`vector-db` regardless.

## Operate — the `turso` CLI

```bash
turso db create my-app                          # create a database
turso db show my-app --url                       # get the libsql:// URL for TURSO_DATABASE_URL
turso db tokens create my-app                    # mint an auth token for TURSO_AUTH_TOKEN
turso db shell my-app                            # interactive SQL shell against the primary
```

Pricing note: the free tier offers **unlimited databases** (post "Database Freedom Day", mid-2025),
usage-based with generous read/storage allowances — exact GB and row-read numbers shift, so verify on
turso.tech/pricing before quoting a figure. This is what makes database-per-user economical.

Route out: backups/restore strategy → `backups`; versioned migrations → `db-migrations`; type-safe
schema and queries → `drizzle-orm`; generic SQL authoring (window functions, tuning) → `sql`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Treating SQLite like multi-writer Postgres | One writer at a time → `SQLITE_BUSY` storms under load | Keep writes serial + short, or route to `postgresdb` |
| Forgetting `PRAGMA journal_mode=WAL` | Default journal blocks readers during every write | Set WAL on local file / replica connections |
| Embedded replica with a `libsql://` url | Not a replica — a confused remote client; reads aren't local | `url:` is a local `file:`, remote goes in `syncUrl` |
| Hardcoding the auth token in source | Leaks a credential into VCS | Read `process.env.TURSO_AUTH_TOKEN` |
| Calling `db.sync()` on a remote/HTTP client | Throws `LibsqlError` `SYNC_NOT_SUPPORTED` | Only sync embedded-replica clients |
| Assuming FK constraints are enforced | `foreign_keys` is OFF by default, per-connection | `PRAGMA foreign_keys=ON` on every connection |
| Designing a new account around edge replicas | Discontinued for new users | Use embedded replicas (the flagship) |
| String-concatenated SQL | Injection + no statement caching | Parameterize with `?` / `$name` / tuple args |
| Reaching for Turso for OLAP dashboards | Row-store, single writer — wrong shape | Use `duckdb` for columnar analytics |
| Layering migrations/ORM logic into this skill | Out of scope; duplicates sibling rigor | `db-migrations` / `drizzle-orm` |

## Verify

When you emit a connection/config file, gate it:

```bash
bash scripts/verify.sh path/to/db.ts        # or a directory; defaults to cwd
```

It statically checks (no network): `@libsql/client` import + `createClient` use; that a `syncUrl`
always sits next to a local `file:` url; no hardcoded token literal; and (advisory) WAL pragma
presence on file-backed clients. Read-only; exits 0 on a clean/empty target.
