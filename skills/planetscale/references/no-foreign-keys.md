# Designing without foreign keys on PlanetScale

Offloaded depth from SKILL.md §"Design without foreign keys". The body has the rule and one Bad→Good
fence; this file covers emulated cascades, the ORM specifics, and the unsharded opt-in caveats.

## Why FKs fight Vitess

Two of Vitess's first-class features make native FKs a poor default:

- **Horizontal sharding** — a foreign key between rows on different shards has no meaning; the
  constraint cannot be enforced across the shard boundary.
- **Online DDL** — FK constraints complicate the shadow-table copy + cutover dance.

On top of that, FK constraint checks add per-write overhead that **degrades high-concurrency
workloads**. PlanetScale historically disallowed FKs entirely; they are now an **opt-in but
unsharded-only** feature. So the scale-safe default is app-level referential integrity.

## Emulated relations

You keep the relationship — you just stop asking the database to enforce it.

- **Index the relation column.** A non-FK relation still needs its index for join/lookup performance.
  `KEY idx_orders_user_id (user_id)`.
- **Enforce existence in the app/ORM.** Validate that `user_id` points at a real user before insert.
- **Cascade explicitly.** There is no `ON DELETE CASCADE`. Delete dependents yourself, in a
  transaction or a background job:

```sql
-- App-side cascade, in one transaction (or a queued job for large fan-out):
START TRANSACTION;
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?);
DELETE FROM orders      WHERE user_id = ?;
DELETE FROM users       WHERE id = ?;
COMMIT;
```

For large fan-out, prefer a batched background job over one giant transaction so you do not hold writes.

## Prisma: relationMode = "prisma"

Setting `relationMode = "prisma"` tells Prisma to emulate relations in the client instead of emitting
DB-level foreign keys. Prisma then also creates the **implicit indexes** on relation scalar fields that
a real FK would have given you for free.

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}

model Order {
  id     BigInt @id @default(autoincrement())
  userId BigInt
  user   User   @relation(fields: [userId], references: [id])

  @@index([userId]) // required under relationMode="prisma" — no implicit FK index from the DB
}
```

ORM-client ergonomics beyond this knob belong to `../../prisma-orm/SKILL.md`, not here.

## Drizzle: app-level relations

Drizzle models relations in app code via `relations()` and queries them with the relational API. On
PlanetScale you index the join column and skip the `references()`-backed DB constraint; the relation
lives in code, not in the database. The query-builder side is `../../drizzle-orm/SKILL.md`.

## The unsharded FK opt-in

Native FKs are available again, but **only on unsharded keyspaces**. It is acceptable to use one when:

- you are certain the table will **never** shard (small, bounded, low-write reference data), and
- you accept the extra Online DDL friction the FK introduces, and
- you remember that FK constraint changes are **excluded from clean schema reverts** (see
  deploy-requests.md).

If any of those is shaky, default back to emulated relations. Document *why* a given table is allowed
an FK so the next person does not "fix" it.

## Bad → Good patterns

| Pattern | Bad on PlanetScale at scale | Good |
| --- | --- | --- |
| Relation | DB `FOREIGN KEY … REFERENCES` | Indexed column + app/ORM-emulated relation |
| Delete dependents | `ON DELETE CASCADE` | Explicit transactional or batched delete in app code |
| Index on relation column | Relying on the FK's implicit index | Declare the index yourself (`@@index`, `KEY`) |
| Integrity guarantee | "the database will reject orphans" | Validate before write; reconcile orphans in a job |
