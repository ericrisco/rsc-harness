---
name: drizzle-orm
description: "Use when modeling data or querying with Drizzle ORM in TypeScript — `pgTable` schema in `.ts`, type-safe select/insert/relational queries, `drizzle-kit` migrations. NOT Prisma Client or `schema.prisma` (that is `prisma-orm`), NOT ORM-agnostic migration strategy (that is `db-migrations`), NOT Postgres engine tuning or EXPLAIN (that is `postgresdb`)."
tags: [drizzle, drizzle-orm, typescript-orm, drizzle-kit, sql, migrations, database, schema]
recommends: [prisma-orm, postgresdb, db-migrations, neon, sqlite-turso, planetscale, supabase, typescript, sql]
origin: risco
---

# Drizzle ORM — schema as code, type-safe queries, drizzle-kit migrations

Drizzle is the SQL-transparent TypeScript ORM: you declare tables in plain `.ts`, the query
builder emits SQL you can read, and there is no codegen client to regenerate. It runs in
edge/serverless runtimes. You own the schema, the queries, and the `drizzle-kit` workflow here —
the database engine, the ORM-agnostic migration *strategy*, and Prisma live in sibling skills.

## Decide first

Three decisions before you write a line. Each branches, so use the table.

| Decision | Pick | Why |
|---|---|---|
| Drizzle vs Prisma | Drizzle when you want SQL you can read, no codegen step, edge runtime | Prisma's generated client + `schema.prisma` DSL is the opposite trade — use `../prisma-orm/SKILL.md` if that is the ask |
| Version | `0.45.x` + `drizzle-kit@0.31.x` for production | npm `latest` is `drizzle-orm@0.45.2`; the 0.45 line has been `latest` since 2025-12-04 (checked 2026-06-02) |
| Version | `1.0.0-rc.x` (npm `rc` tag = `1.0.0-rc.3`, 2026-05-18) for a NEW edge-first project | v1 has moved past beta into release candidates with Relations v2 — close to stable, but still pin an exact rc and expect late API churn |
| Driver entrypoint | match it to your DB/host (see below) | Each driver has its own `drizzle-orm/<driver>` import and its own client |

Driver entrypoints (pick one; full matrix + edge caveats in `references/relations-and-drivers.md`):
`drizzle-orm/node-postgres`, `/postgres-js`, `/neon-http`, `/libsql` (Turso), `/planetscale-serverless`,
`/mysql2`, `/better-sqlite3`, `/bun-sqlite`.

## Install & config

```bash
npm i drizzle-orm
npm i -D drizzle-kit
npm i postgres            # the driver client — here postgres-js; swap per your DB
```

`drizzle.config.ts` — the four keys `drizzle-kit` reads. The `dialect` here MUST match your table
helper (`pgTable` ⇒ `'postgresql'`), or migrations target the wrong SQL.

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',          // 'postgresql' | 'mysql' | 'sqlite' | 'turso'
  schema: './src/db/schema.ts',   // where your tables live
  out: './drizzle',               // emitted migration SQL
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

`package.json` scripts — name them once so you never re-type the CLI:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

## Schema as code

A table is plain TypeScript. Declare columns with the helpers, then derive your row types from the
table — never hand-write a parallel `interface`, it will drift.

```ts
import { pgTable, integer, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'member']);

export const users = pgTable('users', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  email: text().notNull().unique(),
  role: roleEnum().notNull().default('member'),
  createdAt: timestamp().notNull().defaultNow(),
}, (t) => [index('users_email_idx').on(t.email)]);

export const posts = pgTable('posts', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  authorId: integer().notNull().references(() => users.id),  // FK
  title: text().notNull(),
});

export type User = typeof users.$inferSelect;       // row as read
export type NewUser = typeof users.$inferInsert;    // row as inserted
```

- **One schema file per domain, and export every table.** `drizzle-kit` and the relational query
  builder only see what you pass them — an unexported table is invisible to migrations.
- **Derive types with `$inferSelect` / `$inferInsert`.** They stay in sync with the column defs for
  free; a separate interface is one more thing to forget to update.

## Connect

`drizzle()` takes your driver client. Pass `{ schema }` (0.45 / v1-compat) or `{ relations }`
(v2, the 1.0 rc line) — without one of them, `db.query.*` is `undefined` and relational reads
silently break.

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });   // schema enables db.query.*
```

## Query

Filter, join, and shape in SQL — not in JavaScript after the fact.

```ts
import { eq, and, inArray, desc } from 'drizzle-orm';

// select a column subset, not the whole row
const admins = await db.select({ id: users.id, email: users.email })
  .from(users)
  .where(and(eq(users.role, 'admin'), inArray(users.id, [1, 2, 3])))
  .orderBy(desc(users.createdAt));

// insert + get the row back
const [created] = await db.insert(users)
  .values({ email: 'a@b.com', role: 'member' })
  .returning();

// update / delete take the same operators
await db.update(users).set({ role: 'admin' }).where(eq(users.id, created.id));
await db.delete(posts).where(eq(posts.authorId, created.id));

// transaction — all or nothing
await db.transaction(async (tx) => {
  const [u] = await tx.insert(users).values({ email: 'c@d.com' }).returning();
  await tx.insert(posts).values({ authorId: u.id, title: 'hello' });
});
```

Relational read (nested objects) needs `{ schema }`/`{ relations }` on the connection AND a `with`:

```ts
const withPosts = await db.query.users.findMany({
  where: (u, { eq }) => eq(u.role, 'admin'),
  with: { posts: true },          // <- the relation; omit it and you get no posts
});
```

For conditional builders use `$dynamic()`; for hot paths `prepare()` once and reuse.

```ts
const q = db.select().from(users).$dynamic();
const rows = await (role ? q.where(eq(users.role, role)) : q);
```

**Bad → Good — the classic foot-gun:**

```ts
// Bad: pull every row, filter in JS — full table scan, no index, ships rows you discard
const all = await db.query.users.findMany();
const admins = all.filter((u) => u.role === 'admin');

// Good: filter in the query — the DB uses the index and returns only what you need
const admins = await db.query.users.findMany({ where: (u, { eq }) => eq(u.role, 'admin') });
```

## Relations

Relations let `with` hydrate nested objects. Two flavors — do not mix them in one project.

| Line | Define | Connect | Read |
|---|---|---|---|
| 0.45 / v1-compat | `relations(users, ({ many }) => ({ posts: many(posts) }))` | `drizzle(client, { schema })` | `db.query.users.findMany({ with: { posts: true } })` |
| v2 (1.0 rc) | `defineRelations(schema, (r) => ({ users: { posts: r.many.posts() } }))` | `drizzle(client, { relations })` | `db.query.…` (RQBv2); `db._query.…` keeps v1 syntax for back-compat |

**Decision line:** use the relational query (`db.query` + `with`) for nested reads of related
records; drop to a manual `.leftJoin()` for flat projections, aggregates, or `GROUP BY` — relational
queries return trees, joins return rows. Full v1↔v2 migration walkthrough in
`references/relations-and-drivers.md`.

## Migrations

```bash
npm run db:generate   # diff schema.ts vs ./drizzle, emit a new .sql migration
# READ the emitted SQL in ./drizzle — confirm it does what you intended
npm run db:migrate    # apply pending migrations
```

- **`generate` → review the SQL → `migrate` is the production path.** The emitted SQL is the
  contract; eyeball it before applying so a rename does not silently become a drop+add.
- **`push` is for throwaway prototyping only.** It applies `schema.ts` straight to the DB with no
  migration file — fine for a scratch branch, never for an environment you cannot recreate.
- **Never hand-edit an applied migration; write a new one.** The migration journal tracks what ran;
  editing history desyncs every other environment.
- Recent `drizzle-kit` adds migration-conflict / commutativity detection (it checks whether open
  migration branches merge safely, with refined index/table footprint checks); `--ignore-conflicts`
  preserves open leaf parents when you intend to keep branches. `node:sqlite` is auto-detected for
  `migrate` and Studio.

Inspect data with `npm run db:studio` (Drizzle Studio GUI); pull an existing DB into a schema with
`drizzle-kit pull`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `push` against a real/shared DB | no migration record; irreproducible, unreviewable | `generate` → review → `migrate` |
| Hand-editing an applied migration | desyncs the journal across environments | write a new migration |
| `findMany()` then `.filter()` in JS | full scan, no index, ships discarded rows | filter in `where` |
| `db.query.*` with no `{ schema }`/`{ relations }` on `drizzle()` | `db.query` is `undefined`; relations never load | pass `{ schema }` (v1) or `{ relations }` (v2) |
| `with` omitted but relation expected | returns parent only, no nested rows | add `with: { posts: true }` |
| `dialect` in config ≠ table helper | migrations target the wrong SQL dialect | `pgTable`⇒`'postgresql'`, `mysqlTable`⇒`'mysql'`, etc. |
| Mixing `relations()` and `defineRelations` | the two relation systems conflict | pick one line per project |
| `select()` returning every column | over-fetches, fragile to schema growth | `select({ id, email })` subset |
| Not awaiting a query builder | a builder is a thenable, not a promise — un-awaited it never runs | `await db.select()…` |
| Hand-written `interface` mirroring a table | drifts from the column defs | `typeof t.$inferSelect`/`$inferInsert` |

## Verify

Run the static lint on any generated Drizzle file (no DB connection):

```bash
scripts/verify.sh src/db/schema.ts drizzle.config.ts
```

It checks a `drizzle()` call exists, the table helper matches the configured `dialect`, the config
carries `dialect`/`schema`/`out`, that any `db.query` usage has `{ schema }`/`{ relations }` passed
to `drizzle()`, and bans Prisma-isms (`schema.prisma`, `PrismaClient`, `prisma generate`) that mean
the wrong ORM leaked in.
