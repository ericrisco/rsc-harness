---
name: notion-connector
description: "Use when wiring server code or a cron job to Notion as an ops backend over its HTTP API: pushing or mirroring database rows, two-way sync without duplicates, page blocks, or an integration broken by the 2025-09-03 data-source split. NOT generic REST wiring (that is `api-connector-builder`), NOT inbound Notion webhook events (that is `webhooks`)."
tags: [notion, ops-backend, api-integration, databases, sync]
recommends: [api-connector-builder, webhooks, automation-flows, spreadsheet-ops, secure-coding]
origin: risco
---

# Notion connector — Notion as a code-backed ops store

Wire server code to the Notion HTTP API so a database behaves like a small
operational store: push rows, pull rows, sync both ways idempotently, read and
write page blocks. This skill owns the **outbound** Notion API surface only —
the database/data-source data model, property-type write shapes, and the
rate-limit/pagination discipline that the API forces on you.

## Route elsewhere

| Situation | Route to |
|---|---|
| Generic "call any REST API", nothing Notion-specific | `../api-connector-builder/SKILL.md` |
| Receiving + verifying *inbound* Notion webhook events | `../webhooks/SKILL.md` |
| Notion is one node in a multi-tool sequence | `../automation-flows/SKILL.md` |
| CSV/tabular bulk transforms, column mechanics | `../spreadsheet-ops/SKILL.md` |
| Token handling, secret rotation, never-client-side rules | `../secure-coding/SKILL.md` |

## Setup (4 steps)

1. **Create an internal integration** in Notion → Settings → Integrations. Copy
   the secret — it looks like `ntn_...` (older ones `secret_...`).
2. **Put the token in an env var**, never in client-side JS, never committed. It
   is a bearer secret; treat it like a password. See `../secure-coding/SKILL.md`.
3. **Share the target database/page with the integration** in the Notion UI
   (the page `•••` menu → Connections). *Skip this and every call 404s or
   returns empty* — the integration sees nothing it was not explicitly granted.
4. **Construct the SDK client with a pinned `Notion-Version`.** Official JS SDK
   is `@notionhq/client` v5.12.0+ (latest 5.22.0, 2026-05-19); its default
   `notionVersion` is the current major **`2025-09-03`**, and it supports the
   latest **`2026-03-11`** if you opt in. The default and method names below are
   stable across the whole 5.x line. Behavior differs across versions, so pin it
   per client (or per request) — an unpinned client drifts when the default moves.

```ts
import { Client } from "@notionhq/client"; // v5.12.0+ (latest 5.22.0)

const notion = new Client({
  auth: process.env.NOTION_TOKEN,          // ntn_... — env only, never inlined
  notionVersion: "2025-09-03",             // pin it; do not ride the default
});
```

## The database → data source model (biggest gotcha)

Post `2025-09-03` a database is a **container** of one or more data sources, not
a queryable table: it holds a `data_sources` array and each data source has its
**own schema**. Resolve the data source *before* you query — query and read
schema against it, not against the database, or code that worked last year 404s
silently.

| You have… | Do this |
|---|---|
| A `database_id` | `GET /v1/databases/:id` → read `data_sources[]` ({id,name}) → use that `id` |
| Already a `data_source_id` | Use it directly for query/schema/pages |
| A DB with >1 data source | Pick the right one by `name`; never assume index 0 |

Endpoints moved to `/v1/data_sources`:

```diff
- POST /v1/databases/:database_id/query        # 2022-06-28 — 404s on 2025-09-03+
+ POST /v1/data_sources/:data_source_id/query  # query rows
+ GET  /v1/data_sources/:data_source_id         # schema (properties)
+ PATCH /v1/data_sources/:data_source_id        # update schema / title
```

```ts
// Resolve once, then reuse the data_source_id everywhere downstream.
const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
const dataSourceId = db.data_sources[0].id; // verify by name if >1 exists
```

## Query a data source

Send `filter` + `sorts` in the body. Page size maxes at **100**; results are
cursor-based. **Always loop** on `has_more` + `next_cursor` or you silently drop
every row past the first 100. Filter operand shapes per property type live in
`references/property-shapes.md`.

```ts
async function queryAll(dataSourceId: string, filter?: object) {
  const rows: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter,
      page_size: 100,                 // hard max
      start_cursor: cursor,
    });
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return rows;
}
```

## Property write shapes

Most write failures (HTTP 400) are a wrong property envelope. Each type has its
own JSON shape. The high-frequency ones:

| Type | Write shape (abridged) |
|---|---|
| `title` | `{ title: [{ text: { content } }] }` |
| `rich_text` | `{ rich_text: [{ text: { content } }] }` |
| `number` | `{ number: 42 }` |
| `select` | `{ select: { name } }` |
| `multi_select` | `{ multi_select: [{ name }] }` |
| `status` | `{ status: { name } }` |
| `date` | `{ date: { start, end? } }` (ISO 8601) |
| `checkbox` | `{ checkbox: true }` |
| `relation` | `{ relation: [{ id }] }` |
| `people` | `{ people: [{ id }] }` |
| `url` | `{ url: "https://…" }` |

Full write + read-parse JSON for every type → `references/property-shapes.md`.

## Create / update pages (rows)

A page's parent is the **data source**, not the database:

```ts
// CREATE a row
await notion.pages.create({
  parent: { type: "data_source_id", data_source_id: dataSourceId },
  properties: {
    Name: { title: [{ text: { content: "Ship invoice export" } }] },
    Status: { status: { name: "In progress" } },
    ExternalId: { rich_text: [{ text: { content: extId } }] },
  },
});

// UPDATE a row: PATCH the page by id; send only changed properties
await notion.pages.update({
  page_id,
  properties: { Status: { status: { name: "Done" } } },
});
```

To soft-delete: on `2025-09-03` set `{ archived: true }`; on `2026-03-11` that
field is renamed `{ in_trash: true }`. Match the field to the version you pinned
(see `references/api-versions.md`).

## Sync patterns

Idempotency is the whole game. **Store the Notion `page_id` keyed by your
external id** (a column in your DB, or a `rich_text` "ExternalId" property in
Notion). An upsert is: query-by-external-key → if a row exists, `pages.update`;
else `pages.create`. Never blind-create on a re-run — that is how you get
duplicate rows.

- **One-way (app → Notion):** upsert on every sync; the app is source of truth.
- **Two-way:** track a `last_edited_time` watermark on each side; last-writer
  wins, or flag conflicts for review. Cursor-checkpoint large pulls.

Dedupe, two-way reconcile, and checkpointing → `references/sync-patterns.md`.

## Rate limits & resilience

The integration is capped at **~3 requests/second average**. Over-limit calls
return **HTTP 429 with a `Retry-After` header (seconds)** — honor it, do not
guess a fixed sleep. Cap concurrency, batch reads, back off on 429.

```ts
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const after = Number(e?.headers?.["retry-after"]);
      if (e?.status === 429 && i < tries) {
        const wait = Number.isFinite(after) ? after * 1000 : 2 ** i * 500;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}
```

## Version migration

| From → To | What changed |
|---|---|
| `2022-06-28` → `2025-09-03` | DB is a container; query/schema move to `/v1/data_sources`; page parent is `data_source_id`; search filter value `"database"` → `"data_source"` |
| `2025-09-03` → `2026-03-11` | block `after` param → `position` object (`after_block`/`start`/`end`); `archived` → `in_trash` (pages/dbs/blocks/data sources); block type `transcription` → `meeting_notes` |

Exact field/endpoint diffs → `references/api-versions.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Unpinned `Notion-Version` | Behavior shifts when the default moves | Pin per request/client |
| `POST /v1/databases/:id/query` on 2025-09-03+ | 404 — that path is gone | Resolve data source → `/v1/data_sources/:id/query` |
| Forgetting to share the DB with the integration | 404 / empty results, looks like an auth bug | Share in the UI (step 3) |
| No pagination loop | Silently drops every row past 100 | Loop on `has_more` + `next_cursor` |
| Ignoring 429 / fixed sleep | Hammers the 3 req/s ceiling, gets banned | Honor `Retry-After`, exponential backoff |
| Blind `pages.create` on every sync | Duplicate rows on re-run | Upsert: query-by-external-key first |
| Token in client-side JS or committed | Leaked bearer secret = full workspace access | Env var + secret manager |
| Assuming one DB = one schema | Breaks on multi-data-source DBs | Resolve and select by data-source name |
| Using `database_id` as a page parent | Rejected on 2025-09-03+ | `{ type: "data_source_id", data_source_id }` |
| `archived` on 2026-03-11 | Field renamed | Use `in_trash` for that version |

## verify.sh

`scripts/verify.sh <file-or-dir>` statically lints a connector you (or the agent)
wrote: it flags a missing pinned `Notion-Version`/`notionVersion`, a deprecated
`databases/:id/query` query path, a query without a `has_more`/`next_cursor`
loop, and missing 429/`Retry-After` handling. Read-only; exits 0 on a clean or
empty target. It does not call Notion.
