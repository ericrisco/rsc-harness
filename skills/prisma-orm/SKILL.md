---
name: prisma-orm
description: "Use when modeling data or writing type-safe queries with Prisma ORM in TypeScript — `schema.prisma`, `prisma.config.ts`, the generated Prisma Client, and Prisma Migrate, including the v6 to v7 upgrade. NOT schema-as-TS with a SQL builder (that is `drizzle-orm`), NOT ORM-agnostic zero-downtime migration (that is `db-migrations`), NOT Postgres engine tuning (that is `postgresdb`)."
tags:
  - prisma
  - prisma-orm
  - typescript-orm
  - prisma-migrate
  - schema
  - migrations
  - orm
recommends:
  - drizzle-orm
  - db-migrations
  - postgresdb
  - neon
  - planetscale
  - supabase
  - sqlite-turso
  - typescript
  - sql
origin: risco
---

# Prisma ORM (v7)

You declare a data model in `schema.prisma`, generate a type-safe client, and query it
without the foot-guns: N+1, over-fetch, unbounded reads. This skill is **Prisma 7-native**.
If you are writing `prisma-client-js`, `binaryTargets`, or `new PrismaClient()` with no
adapter, you are writing v6 — stop and read the upgrade notes.

## Decide first

Prisma is a **schema DSL (`schema.prisma`) + a generated type-safe client + Prisma Migrate**.
The rival, Drizzle, is **schema-as-TypeScript with a SQL builder and no codegen** — if the
ask says `pgTable`, `drizzle-kit`, or `drizzle.config.ts`, that is `../drizzle-orm/SKILL.md`,
not here.

Prisma 7 has four non-negotiables. Get these wrong and nothing runs:

1. **Generator is `provider = "prisma-client"` and `output` is REQUIRED.** The client is no
   longer emitted into `node_modules` — you import it from your generated path. The legacy
   `prisma-client-js` generator is gone.
2. **A driver adapter is REQUIRED on the constructor.** `new PrismaClient({ adapter })`. Omit
   it and you get `requires either adapter or accelerateUrl` at runtime.
3. **Connection config lives in `prisma.config.ts`, not the datasource block.** `url`,
   `directUrl`, `shadowDatabaseUrl` in `schema.prisma` are deprecated in v7.
4. **Rust-free by default.** The query engine is TypeScript now — no native binaries, ~3x
   faster queries, ~90% smaller bundles. `binaryTargets` no longer exists.

Version note: stable is the **7.x** line — latest stable is 7.7.0 (2026-04-07) per the
[Prisma changelog](https://www.prisma.io/changelog) (accessed 2026-06-02); pin `>=7.7`.
"Prisma Next" — the future fully-TS foundation, first announced 2026-03-04 in
[The Next Evolution of Prisma ORM](https://www.prisma.io/blog/the-next-evolution-of-prisma-orm)
— reached **Early Access in May 2026** per the
[Prisma Next Roadmap](https://www.prisma.io/blog/prisma-next-roadmap) (2026-03-20, accessed
2026-06-02). Early Access is forward-looking only and **not** the install default; for
production work stay on stable 7.x.

## Install & config

Install the CLI, the client, and the adapter for your database. One adapter per DB.

```bash
# Postgres
npm i -D prisma
npm i @prisma/client @prisma/adapter-pg
# others: @prisma/adapter-better-sqlite3, -libsql, -mariadb, -mssql, -d1
```

Minimal `schema.prisma` — note the generator shape and the **no-url datasource**:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma" // REQUIRED in v7
}

datasource db {
  provider = "postgresql" // url moved to prisma.config.ts
}
```

`prisma.config.ts` holds the connection (replaces `url` in the datasource):

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL! },
});
```

`package.json` scripts:

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed"
  }
}
```

## Model the schema

`schema.prisma` is the single source of truth. Every relation needs an explicit FK field and
an index on that FK column — Prisma does **not** index foreign keys for you, and a join on an
unindexed column is a sequential scan.

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  role      Role     @default(MEMBER)
  posts     Post[]
}

model Post {
  id        String   @id @default(cuid())
  title     String
  body      String   @db.Text // native type
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())

  @@index([authorId])            // index the FK you join/filter on
  @@unique([authorId, title])    // composite uniqueness
}

enum Role {
  ADMIN
  MEMBER
}
```

```prisma
// Bad: relation with no index on the FK — every join scans the table
model Post {
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
// Good: add @@index([authorId]) — see the model above.
```

## Instantiate the client

**One `PrismaClient` per process.** A new client per request opens a fresh connection pool
each time and exhausts the database. In dev, pin it to `globalThis` so HMR reuses one instance.

```ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter, log: ["query"] }); // log surfaces emitted SQL

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```ts
// Bad: no adapter → throws "requires either adapter or accelerateUrl"
export const prisma = new PrismaClient();
// Bad: per-request instance → connection-pool exhaustion
app.get("/u", () => new PrismaClient({ adapter }).user.findMany());
```

## Query safely

Three rules cover most query bugs:

- **Prefer `select` over `include`.** `select` returns only the named fields; `include` adds a
  relation but otherwise returns **all** scalar fields (over-fetch). Never put `select` and
  `include` at the same level — Prisma rejects it.
- **Always pass `take` to `findMany`.** It is unbounded by default and will happily stream the
  whole table.
- **Never query inside a loop.** Batch with `where: { id: { in: ids } }`.

```ts
// Good: shape the row, bound the read
const users = await prisma.user.findMany({
  take: 20,
  where: { role: "MEMBER" },
  select: { id: true, email: true, posts: { select: { title: true } } },
});
```

```ts
// Bad: N queries in a loop
for (const id of ids) {
  await prisma.user.findUnique({ where: { id } });
}
// Good: one query
const users = await prisma.user.findMany({ where: { id: { in: ids } } });
```

Pagination — pick by table size:

| Need | Use | Why |
| --- | --- | --- |
| Small/medium set, jump to page N | `skip` + `take` (offset) | Simple; `skip` gets slow on huge offsets |
| Large set, infinite scroll, stable | `cursor` + `take` | Seeks by indexed id, constant cost |

Writes: `upsert` for create-or-update; `createMany({ data, skipDuplicates: true })` for bulk.

Transactions — pick by dependency:

| Situation | Form |
| --- | --- |
| Independent writes that must all commit | `prisma.$transaction([opA, opB])` (array) |
| Read, branch on the result, then write | `prisma.$transaction(async (tx) => { … })` (interactive) |

Lean on generated types instead of hand-writing shapes: `Prisma.UserGetPayload<…>` and
`Prisma.validator` keep a query and its type in sync. See
`references/queries-and-performance.md` for the full cookbook.

## Performance: kill N+1 and over-fetch

`relationLoadStrategy` decides how relations load:

- `"join"` (default) — one query: a LATERAL JOIN with JSON aggregation on Postgres (correlated
  subqueries on MySQL). This is the N+1 killer. The top-level choice cascades to nested loads.
- `"query"` — one query per relation, joined in the app. Sometimes wins when a join fans out
  rows badly.

```ts
const feed = await prisma.user.findMany({
  relationLoadStrategy: "join",
  take: 20,
  select: { id: true, email: true, posts: { select: { id: true, title: true } } },
});
```

Then: `select` only the fields you render, and `@@index` the columns you filter and order on.
To see what Prisma actually emits, set `log: ["query"]` on the client and read the SQL. For
the deep perf checklist (N+1 detection, index selection, reading the plan) see
`references/queries-and-performance.md`. For `EXPLAIN ANALYZE`, index theory, and pool sizing
— that is the database engine's job: `../postgresdb/SKILL.md`.

## Raw SQL safely

Use raw SQL **only** through the tagged-template form — it parameterizes. The `*Unsafe`
variants concatenate strings and open SQL injection.

```ts
// Good: parameterized tagged template
const rows = await prisma.$queryRaw`SELECT id FROM "User" WHERE email = ${email}`;

// Bad: interpolated string into the Unsafe API → SQL injection
const rows = await prisma.$queryRawUnsafe(`SELECT id FROM "User" WHERE email = '${email}'`);
```

Compose fragments with `Prisma.sql` / `Prisma.join`. For fully type-checked results, write
`.sql` files and use `$queryRawTyped`. Safety matrix in
`references/queries-and-performance.md`.

## Migrations

Pick the command by environment — this is the most common mix-up:

| Command | Use where | Does |
| --- | --- | --- |
| `prisma migrate dev` | **development only** | Creates a migration, applies it, regenerates the client; uses a shadow DB |
| `prisma migrate deploy` | **CI / production** | Applies pending migrations only — never generates, never resets |
| `prisma db push` | prototyping / spikes | Syncs schema to the DB with **no** migration file |

Rules with teeth:

- **Never run `migrate dev` against production.** It can reset the database.
- **Never edit a migration that has already been applied.** Create a new one.
- A shadow DB lets `migrate dev` detect drift; it must be a separate, disposable database.
- On drift or a failed migration, use `prisma migrate resolve --applied|--rolled-back`.
- Seed via the `seed` entry in `prisma.config.ts` and `prisma db seed`.

Failed-migration recovery, baselining an existing database, and the full Prisma 6 to 7
upgrade are in `references/migrations-and-v7-upgrade.md`. For ORM-independent evolution
strategy (expand/contract, dual-write, zero-downtime backfills) that is
`../db-migrations/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| `new PrismaClient()` with no adapter | v7 throws `requires either adapter or accelerateUrl` | Pass a driver adapter |
| New `PrismaClient` per request | Pool exhaustion, dropped connections | One instance per process; `globalThis` in dev |
| `prisma-client-js` generator | Legacy v6 generator, removed in v7 | `provider = "prisma-client"` + `output` |
| `binaryTargets` in the generator | Rust-era artifact; v7 is Rust-free | Delete it |
| Unbounded `findMany()` | Streams the whole table | Always pass `take` (and `cursor` for paging) |
| Fat `include` everywhere | Over-fetches every scalar | `select` only the rendered fields |
| Query inside a `for` loop | N+1 round trips | Batch `where: { id: { in: ids } }` or `relationLoadStrategy: "join"` |
| `$queryRawUnsafe(\`…${x}…\`)` | SQL injection | Tagged `$queryRaw\`…${x}\`` |
| `migrate dev` in CI/prod | Can reset the production DB | `migrate deploy` |
| Editing an applied migration | Drift, broken history | New migration; `migrate resolve` for drift |
| FK with no `@@index` | Joins do sequential scans | `@@index([fkColumn])` |

## Verify

Run `scripts/verify.sh <path>` to statically check emitted artifacts: it confirms the
`prisma-client` generator + `output`, an adapter on the constructor, and flags
`$queryRawUnsafe` injection, `binaryTargets`, unbounded `findMany`, and wrong-ORM
contamination. Read-only; no database connection.
