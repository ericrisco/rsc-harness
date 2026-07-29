---
name: planetscale
description: "Use when operating PlanetScale (Vitess serverless MySQL) — branches and the `pscale` CLI, schema changes through deploy requests (Online DDL cutover, ~30-min revert window), tables without foreign keys, or the edge HTTP driver. NOT MySQL engine work like EXPLAIN or index choice (that is `mysql`), NOT generic migration theory (that is `db-migrations`)."
tags: [planetscale, vitess, mysql, deploy-requests, serverless-db]
recommends: [mysql, db-migrations, prisma-orm, drizzle-orm, github-actions, postgresdb]
origin: risco
---

# PlanetScale — Vitess serverless MySQL: branches, deploy requests, no FKs

PlanetScale is serverless, MySQL-compatible database-as-a-service built on **Vitess** — the same
horizontal-scaling layer that runs YouTube. You do not `ALTER TABLE` against production. Schema
changes live on an isolated **branch** (a full copy of the schema), reach production through a
**deploy request** (a pull request for your schema), and apply via **Online DDL**: Vitess builds a
shadow table holding the new schema, replicates rows and in-flight writes old→new with VReplication,
then **cuts over** with no table lock. Because Online DDL and sharding are the platform's center of
gravity, you **design without foreign keys** (FKs are now an opt-in but unsharded-only feature). This
skill owns that workflow — not MySQL the engine.

Heuristic for the boundary: **would this answer be identical on RDS MySQL? Then it is not this skill.**

| When the question is really about | Route to |
| --- | --- |
| A slow query, an `EXPLAIN` plan, an index decision, JSON columns, locking | `../mysql/SKILL.md` for MySQL-engine work; `../postgresdb/SKILL.md` when you want the transferable engine reasoning |
| PostgreSQL engine/design — even PlanetScale's own managed Postgres SQL semantics | `../postgresdb/SKILL.md`. PlanetScale sells Postgres too; this skill is strictly the **Vitess/MySQL branch+deploy-request** flow |
| Engine-agnostic migration *theory* (expand-contract, backfill ordering) | `../db-migrations/SKILL.md`. Here you get the concrete PlanetScale realization, not the theory |
| Postgres copy-on-write branches | `../neon/SKILL.md`. Postgres BaaS → `../supabase/SKILL.md` |
| ORM client ergonomics (Prisma `updateMany`, Drizzle query builder) | `../prisma-orm/SKILL.md` / `../drizzle-orm/SKILL.md`. This skill owns only the PlanetScale-specific knobs those ORMs expose (`relationMode`, serverless driver adapter) |

## Mental model

| PlanetScale concept | Git analogue | What it actually is |
| --- | --- | --- |
| Branch | branch | A full, isolated copy of the schema. `main` is your production branch. |
| Deploy request | pull request | The gate that carries schema from a dev branch to production. |
| Schema diff | the PR diff | The exact DDL the deploy will run, computed by PlanetScale. |
| Online DDL | (no git analogue) | Shadow table + VReplication + non-blocking cutover. No `ALTER` lock. |
| Schema revert | revert commit | A **~30-minute** window after deploy to undo while preserving post-deploy writes. |

The revert window is the one thing people get wrong: it is **not** forever, and it has carve-outs
(dropped tables/columns and FK-constraint changes are not cleanly revertible). After ~30 minutes the
deploy is permanent. Plan rollbacks as new forward deploys, not as "I'll just revert later."

## The deploy-request workflow

Production branches should have **safe migrations** enabled — that is what forces every schema change
through a deploy request instead of letting a raw `ALTER` hit `main`. Production branches are protected
by default. The full lifecycle (numbered steps, real `pscale` commands):

```bash
# 0. Install + authenticate (once)
brew install planetscale/tap/pscale   # or scoop / apt — see pscale docs
pscale auth login

# 1. Create the database (region close to your app)
pscale database create my_app --region us-east

# 2. Create a dev branch off production to hold the change
pscale branch create my_app add-orders-table

# 3. Apply your DDL on the BRANCH, never on main.
#    Open a MySQL shell scoped to the branch and run your CREATE/ALTER:
pscale shell my_app add-orders-table
#    mysql> CREATE TABLE orders (id BIGINT PRIMARY KEY AUTO_INCREMENT, ...);
#    mysql> ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP NULL;

# 4. Open a deploy request from the branch back to production.
#    --disable-auto-apply gates the cutover behind a manual apply (recommended for risky drops).
pscale deploy-request create my_app add-orders-table --disable-auto-apply

# 5. Inspect the exact schema diff the deploy will run. ALWAYS read this.
pscale deploy-request diff my_app 42

# 6. Review / approve (the schema-PR review step)
pscale deploy-request review my_app 42 --approve

# 7. Deploy. PlanetScale runs Online DDL: shadow table -> VReplication -> cutover.
pscale deploy-request deploy my_app 42

# 8. If you disabled auto-apply, the change waits gated until you apply the cutover:
pscale deploy-request apply my_app 42

# 9. Verify on production. If wrong, REVERT within the ~30-minute window:
pscale deploy-request revert my_app 42
```

**Auto-apply is ON by default.** With it on, step 7 deploys *and* cuts over in one motion. For
anything destructive — dropping a column/table, narrowing a type — pass `--disable-auto-apply` at
step 4 so the cutover sits gated (step 8) until a human applies it. That gap is your last cheap exit
before the revert window starts ticking.

For queued/gated deploys that won't move, lint errors that block a deploy, declarative vs imperative
schema, and the exact revert carve-outs, see [deploy-requests](references/deploy-requests.md).

## Design without foreign keys

Vitess's first-class features are Online DDL and horizontal sharding. Native foreign keys fight both:
a cross-shard FK is meaningless once a table is sharded, and FK constraint checks degrade
high-concurrency writes. PlanetScale **historically disallowed FKs entirely**; they are now an opt-in
but **unsharded-only** feature. The scale-safe default is **app-level referential integrity** with
emulated relations, not database-enforced FKs.

```sql
-- Bad on PlanetScale at scale: a DB-enforced FK with ON DELETE CASCADE.
-- Blocks sharding, conflicts with Online DDL, and the cascade is a hidden write amplifier.
CREATE TABLE orders (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id   BIGINT NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Good: no DB FK. Index the relation column, enforce integrity in the app/ORM,
-- and do cascades explicitly in a transaction or background job.
CREATE TABLE orders (
  id        BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id   BIGINT NOT NULL,
  KEY idx_orders_user_id (user_id)   -- the relation still needs its index
);
```

With Prisma, declare `relationMode = "prisma"` so the client emulates relations and adds the implicit
indexes instead of emitting DB-level FKs:

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

With Drizzle, model the relation in app code (`relations()`), index the join column, and skip the
`references()`-backed FK constraint at the DB layer.

| Will this table shard? | FK strategy | Notes |
| --- | --- | --- |
| Yes, or unsure | No DB FK — emulate in app/ORM | Default. Index the relation column; cascade in code. |
| Never (small, bounded, unsharded) | Unsharded FK opt-in *is* acceptable | Accept Online DDL friction; document why it won't shard. |

See [no-foreign-keys](references/no-foreign-keys.md) for emulated cascades, ORM specifics, and the opt-in caveats.

## Connecting

Two connection paths. Pick by **runtime**, not by preference.

```ts
// Direct MySQL string — for Node/long-lived servers that can open a TCP socket.
// DATABASE_URL=mysql://user:pass@host/db?ssl-mode=require   (TLS required)

// Serverless HTTP driver — for edge/serverless where raw TCP MySQL is blocked.
import { connect } from "@planetscale/database";

const conn = connect({ url: process.env.DATABASE_URL });
const result = await conn.execute("SELECT id FROM users WHERE email = ?", [email]);
```

`@planetscale/database` is Fetch-API compatible: it speaks HTTP, so it works where you cannot open a
MySQL socket — Cloudflare Workers, Vercel Edge, Lambda. The spelling is exactly `@planetscale/database`;
there is no other official package name. Drizzle ships a matching adapter,
`drizzle-orm/planetscale-serverless`, that wraps this driver — see `../drizzle-orm/SKILL.md` for the
query-builder side.

| Runtime | Connection path | Why |
| --- | --- | --- |
| Node server, long-lived process | Direct `mysql://…?ssl-mode=require` | TCP socket available; pool it. |
| Vercel Edge / Cloudflare Workers | `@planetscale/database` (HTTP) | No raw TCP; the Fetch-based driver works. |
| AWS Lambda / short-lived serverless | `@planetscale/database` (HTTP) | Avoids per-invocation connection churn. |
| Drizzle on edge | `drizzle-orm/planetscale-serverless` | Wraps the HTTP driver; same constraints. |

## CI/CD

Wire the deploy-request flow into CI so schema changes are reviewed like code. A GitHub Actions job
installs `pscale`, authenticates with a service token (`PLANETSCALE_SERVICE_TOKEN` /
`PLANETSCALE_SERVICE_TOKEN_ID` as secrets), then drives the same verbs you run locally:

```yaml
# .github/workflows/schema.yml — open + diff a deploy request on PR
- run: |
    pscale deploy-request create "$DB" "${{ github.head_ref }}" --disable-auto-apply
    pscale deploy-request diff   "$DB" "$DR_NUMBER"   # surface the schema diff in the PR
```

For a **branch-per-PR preview database**, create a PlanetScale branch named after the PR head, run the
app's migrations against it, and tear the branch down when the PR closes. The orchestration (matrix,
secrets, cleanup-on-close) is generic CI — defer the Actions plumbing to `../github-actions/SKILL.md`
and keep the PlanetScale verbs here.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| `ALTER TABLE` on the `main` production branch | Skips the gate; no diff, no review, no revert window | Branch → DDL → deploy request → diff → deploy |
| Relying on DB-enforced foreign keys at scale | Blocks sharding, fights Online DDL, degrades high-concurrency writes | App/ORM-level integrity; `relationMode="prisma"`; index the relation column |
| Leaving auto-apply ON for a destructive change | Deploy + cutover happen in one motion; no gated last-look before the drop | `--disable-auto-apply`, inspect, then `deploy-request apply` |
| Opening a direct `mysql://` connection from Vercel Edge / Workers | Raw TCP MySQL is blocked on edge runtimes → connection timeouts | Use `@planetscale/database` HTTP driver |
| Treating revert as available forever | The window is **~30 min** and excludes dropped tables/cols and FK changes | Plan rollbacks as new forward deploys |
| Deploying without reading `deploy-request diff` | You ship DDL you never saw; surprise table rewrites | Always run the diff before `deploy` |
| Inventing a driver name (`@planetscale/serverless`, `planetscale-js`) | There is no such package; install fails | The package is exactly `@planetscale/database` |
