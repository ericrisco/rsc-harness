---
name: neon
description: "Use when you have picked Neon (serverless Postgres) and need to connect correctly from a serverless or edge runtime, wire database branching into dev, preview and CI, or stop being burned by scale-to-zero cold starts and pooler limits — including choosing HTTP versus WebSocket connections and pooled versus direct endpoints for migrations. NOT generic Postgres schema, index, EXPLAIN, RLS or migration-engine work (that is `postgresdb`)."
tags: [neon, postgres, serverless, database, branching, edge]
recommends: [postgresdb, drizzle-orm, prisma-orm, vercel]
origin: risco
---

# Neon — serverless Postgres as a platform

Neon is Postgres with three platform features the engine doesn't have: a **serverless driver** that
talks over HTTP/WebSocket (so you can query from edge runtimes), **built-in connection pooling**, and
**copy-on-write branching** that makes a fork of production data appear instantly. This skill owns
that platform layer. The Postgres *engine* underneath — schema, indexes, EXPLAIN, RLS, zero-downtime
DDL — is identical to any Postgres 16 and belongs to `../postgresdb/SKILL.md`. Don't re-derive engine
craft here; connect correctly and branch correctly.

## When to use / When NOT to use

**When to use:**

- Code imports `@neondatabase/serverless`, or `DATABASE_URL` points at `*.neon.tech` / `*.aws.neon.tech`.
- Connecting from Vercel (Edge/Node), Cloudflare Workers, AWS Lambda, or any serverless/edge function — choosing HTTP `neon()` vs WebSocket `Pool`.
- Setting up branching: dev branch off production, a branch per PR in CI, `neonctl` usage, the Neon + Vercel preview integration.
- Neon-specific symptoms: cold start after scale-to-zero, "too many connections" despite being serverless, pooled-vs-direct string confusion, autoscaling CU sizing/cost.
- Picking the connection string for migrations (direct) vs app queries (pooled).

**When NOT to use — route to the sibling:**

- Schema design, index choice, EXPLAIN/ANALYZE, query tuning, RLS, VACUUM, partitioning, expand-contract migrations → `../postgresdb/SKILL.md`. Neon adds nothing to the engine; defer.
- Drizzle schema/migrations → `../drizzle-orm/SKILL.md`; Prisma → `prisma-orm`. Neon supplies only the *driver adapter* line.
- A different managed Postgres/BaaS: Supabase (auth + storage + realtime) → `supabase`; PlanetScale → `planetscale`; Turso/libSQL → `sqlite-turso`.
- Where to deploy the app talking to Neon → `../vercel/SKILL.md` / `cloudflare` / `railway`.
- Backup/PITR strategy as a discipline → `backups` (Neon branch-as-restore is mentioned here, not owned).

## Non-negotiables

1. A WebSocket `Pool`/`Client` is **created and closed inside one request handler** — never at module scope in a serverless function. Module scope = a connection that outlives the invocation and leaks.
2. **App queries use the pooled string** (host contains `-pooler`). **Migrations / DDL / advisory locks / session features use the direct string** (no `-pooler`). Mixing them is the #1 Neon foot-gun.
3. The HTTP `neon()` driver **always** uses the pooled endpoint — don't hand it a direct string and expect session state.
4. HTTP `neon()` has **no interactive transactions**. Need `BEGIN ... COMMIT` across round-trips? Use `sql.transaction([...])` (batched, non-interactive) or a WebSocket `Pool`.
5. On Node.js ≤ 21 you **must** set `neonConfig.webSocketConstructor = ws` before opening a Pool/Client. Node 22+ and edge runtimes have a global `WebSocket`; don't set it there.
6. Pin the driver: `@neondatabase/serverless` is at **v1.1.0** (npm latest, 2026-04-17). It is a drop-in replacement for `pg`.

## Pick your connection method

Keyed by runtime and what the query needs. Pick the lightest transport that satisfies the need.

| You need | Use | Why |
| --- | --- | --- |
| One independent read/write per request (edge, Lambda, RSC) | HTTP `neon()` | Single fetch round-trip (~3 round trips vs ~8 for TCP setup); no connection to manage or leak. |
| Several queries that must be atomic, no logic between them | `sql.transaction([q1, q2])` over HTTP | One round-trip, real transaction, still no socket lifecycle. |
| Interactive transaction — read a row, branch in app code, then write | WebSocket `Pool` (open+close in handler) | HTTP can't hold `BEGIN` open; WebSocket keeps the session alive within the request. |
| Full `pg`-API compatibility (cursors, LISTEN/NOTIFY, COPY) | WebSocket `Client`/`Pool` | HTTP is one-shot; node-postgres semantics need the socket. |
| Migrations / DDL / `pg_advisory_lock` / session GUCs | direct (non-`-pooler`) string with `pg` or WebSocket `Client` | PgBouncer transaction-pooling breaks session-level state. |

If you're behind Drizzle or Prisma, you don't call these directly — you pass the driver to the
adapter. See the ORM pointers below.

## Connection strings: pooled vs direct

Neon gives every branch two connection strings that differ in **one** thing: the host of the pooled
one contains `-pooler`.

```text
pooled:  postgresql://user:pass@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/db?sslmode=require
direct:  postgresql://user:pass@ep-cool-name-123456.us-east-2.aws.neon.tech/db?sslmode=require
```

| Use case | String | Reason |
| --- | --- | --- |
| App runtime (queries from your functions) | **pooled** (`-pooler`) | PgBouncer fans many short-lived serverless invocations onto a small pool; up to 10,000 concurrent client connections per project. |
| HTTP `neon()` driver | **pooled** (it forces it regardless) | The HTTP path is stateless; pooling is the right model. |
| Migrations, DDL, schema introspection | **direct** | Transaction pooling drops session state; advisory locks and prepared statements need a stable session. |
| `psql` interactive / debugging | **direct** | You want one real session, not a pooled handle. |

Bad → Good for a typical setup:

```bash
# Bad: one string everywhere — migrations sporadically fail under PgBouncer.
DATABASE_URL="postgresql://...-pooler.../db?sslmode=require"

# Good: split them. App uses the pooled one; the migration tool uses DIRECT.
DATABASE_URL="postgresql://...-pooler.../db?sslmode=require"          # app runtime
DIRECT_URL="postgresql://....../db?sslmode=require"                    # migrations/DDL
```

## Serverless driver patterns

All examples assume `@neondatabase/serverless@1.1.0`.

HTTP one-shot — the default for edge/serverless reads and writes:

```ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!); // pooled endpoint, no socket to manage
export async function getUser(id: string) {
  const [row] = await sql`select id, email from users where id = ${id}`;
  return row; // parameterized; ${id} is bound, not interpolated
}
```

Batched atomic writes over HTTP — atomicity without a WebSocket and without interactivity:

```ts
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
await sql.transaction([
  sql`insert into orders (id, total) values (${id}, ${total})`,
  sql`update inventory set qty = qty - 1 where sku = ${sku}`,
]); // one round-trip, both succeed or both roll back
```

Interactive transaction — WebSocket `Pool`, opened **and closed inside the handler**:

```ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws"; // Node ≤21 only; omit on edge / Node 22+

neonConfig.webSocketConstructor = ws; // required on Node ≤21; do NOT set on edge runtimes

export async function transfer(from: string, to: string, cents: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); // inside the handler
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query("select balance from accounts where id=$1 for update", [from]);
    if (rows[0].balance < cents) throw new Error("insufficient");
    await client.query("update accounts set balance=balance-$1 where id=$2", [cents, from]);
    await client.query("update accounts set balance=balance+$1 where id=$2", [cents, to]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
    await pool.end(); // close before the function returns — no leaked connection
  }
}
```

Edge runtime (Vercel Edge, Cloudflare Workers): use HTTP `neon()`; the global `WebSocket` exists, so a
`Pool` works without `ws`, but prefer HTTP unless you truly need an interactive transaction.

ORM adapters — you wire the driver, the ORM owns the query API:

- Drizzle: pass `neon()`/`Pool` into `drizzle-orm/neon-http` or `neon-serverless` → `../drizzle-orm/SKILL.md`.
- Prisma: use the `@prisma/adapter-neon` driver adapter → `prisma-orm`.

## Branching for dev / preview / CI

A Neon branch is **copy-on-write**: created instantly with no data copied, it forks production at a
point in time, gets its own compute endpoint, and scales to zero independently. That makes a branch a
cheap, isolated, full-data environment — not a backup substitute (test the restore).

| Situation | Do | Why |
| --- | --- | --- |
| Per-developer or per-PR isolated data | **branch off production** | Instant, real prod-shaped data, separate endpoint, auto scale-to-zero → near-free idle. |
| A genuinely separate product/tenant with its own billing & limits | **new project** | Branches share the project's quotas and pooled-connection ceiling. |
| Throwaway query you can run against staging | **same branch** | Don't manufacture a branch for a one-off SELECT. |

`neonctl` (alias `neon`) drives create/connect/teardown:

```bash
neonctl branches create --name pr-$PR_NUMBER --parent main
neonctl connection-string pr-$PR_NUMBER --pooled   # feed to the preview app
neonctl branches delete pr-$PR_NUMBER              # on PR merge/close
```

**Vercel preview integration:** with the Neon + Vercel integration, each preview deployment gets its
own branch forked from production, auto-deleted when the PR merges or closes — zero CI code. If you're
not on Vercel, replicate it in CI: create branch on PR open → run migrations (direct string) → seed →
expose the pooled connection string to the app → delete on PR close. Full GitHub Actions workflow,
`neonctl` reference, and the Neon API endpoints: [branching-ci](references/branching-ci.md).

**Branch-as-restore (PITR):** to recover, branch from an earlier point in time and either read from it
or promote it. It's a fast undo, not a tested backup discipline — own that in `backups`.

## Autoscaling & scale-to-zero

Each branch's compute endpoint **autoscales** between a min and max CU (vCPU/RAM) on its own, with no
noisy neighbors across branches. Idle compute **scales to zero** after **5 minutes** of inactivity
(default), then resumes on the next connection with a millisecond-to-sub-second cold start.

Cost mental model: non-prod branches sit at zero almost always, so a dozen PR branches cost close to
nothing. The cold start is the price.

Prod endpoint sizing checklist:

- [ ] Set a sane **min/max CU** for the prod branch — not maxed "just in case" (you pay for the max headroom you actually use).
- [ ] Latency-sensitive prod with sparse traffic? **Disable scale-to-zero** or set **min CU > 0** so there's no cold start in p99.
- [ ] Treat the cold start as real: warm the connection on deploy, or accept it on non-prod and account for it in latency SLOs.
- [ ] Keep non-prod branches on scale-to-zero — that's where the near-free economics come from.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| `new Pool(...)` at module scope in a serverless function | Connection outlives the invocation; you exhaust the pool → "too many connections". | Create and `await pool.end()` inside the handler, or use HTTP `neon()`. |
| Pooled (`-pooler`) string for migrations/DDL | PgBouncer transaction-pooling drops session state; advisory locks/prepared statements fail intermittently. | Use the **direct** string for migrations; pooled only for app runtime. |
| Direct (non-`-pooler`) string as the app `DATABASE_URL` | No pooling → serverless concurrency exhausts raw connections fast. | App runtime always uses the **pooled** string. |
| Expecting `BEGIN`/interactive txns from HTTP `neon()` | HTTP is one-shot, stateless — there's no open session to hold a transaction. | `sql.transaction([...])` for batched atomicity, or a WebSocket `Pool` for interactive. |
| Opening a `Pool` without `neonConfig.webSocketConstructor = ws` on Node ≤21 | No global `WebSocket` → the connection silently fails. | Set `webSocketConstructor = ws` on Node ≤21; omit on edge / Node 22+. |
| Ignoring scale-to-zero in p99 latency | First request after 5 min idle pays the resume cold start; users see a slow request. | Disable scale-to-zero or set min CU > 0 on latency-sensitive prod. |
| One shared branch for all PRs | PRs clobber each other's data; no isolation. | One branch per PR, deleted on close. |
| Treating a branch as a backup without testing restore | Branches share project quotas and aren't an exercised recovery path. | Verify branch-as-restore; own real backup strategy in `backups`. |
| Maxing CU "to be safe" | You pay for headroom you don't use; autoscaling already handles spikes. | Set a realistic min/max; let autoscaling expand. |
| Doing schema/index design in this skill | Engine craft is identical to any Postgres; duplicating it drifts. | Defer to `../postgresdb/SKILL.md`. |

## Cross-references

- Engine craft (schema, indexes, EXPLAIN, RLS, zero-downtime DDL): `../postgresdb/SKILL.md`.
- Next.js App Router data layer that calls Neon: `../nextjs/SKILL.md`.
- ORM query APIs over the Neon driver: `../drizzle-orm/SKILL.md`, `prisma-orm`.
- Deployment targets: `../vercel/SKILL.md`, `cloudflare`, `railway`. Backups discipline: `backups`.
- Other managed DBs (route away): `supabase`, `planetscale`, `sqlite-turso`.
