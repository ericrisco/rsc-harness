---
name: cloudflare
description: "Use when working on Cloudflare's edge platform — wrangler.jsonc bindings, choosing between D1/KV/R2/Durable Objects/Queues, deploying a Worker or SPA via Static Assets, or designing around a Workers runtime limit. NOT generic CI/release (that is `deployment`), NOT Next.js framework wiring (that is `nextjs`), NOT DNS records (that is `domains-dns`)."
tags: [cloudflare, workers, edge, r2, d1, kv, queues, wrangler, serverless]
recommends: [deployment, nextjs, domains-dns, postgresdb, redis, secure-coding]
origin: risco
---

# Cloudflare Workers & edge primitives

## The model in one paragraph

A Worker is a `fetch` handler that runs at the edge. Everything else — R2, D1, KV, Queues, static assets, Durable Objects — is a **binding** declared in `wrangler.jsonc` and reached through `env`. If a resource is not bound, it is not reachable from your code. There is no connection string and no `import` of the bucket; you wire it in config, type it on `Env`, and call `env.BINDING`. Hold this picture and most "how do I access X" questions answer themselves: declare the binding, redeploy, use `env`.

## Quick start

`npm create cloudflare@latest` (the C3 scaffolder) bootstraps a Worker or a full framework. Use it — it pins a correct `compatibility_date` and generates types.

```bash
npm create cloudflare@latest my-app          # plain Worker
npm create cloudflare@latest my-app -- --framework=react   # Vite + React SPA, GA plugin
cd my-app
npx wrangler dev          # local edge emulation at http://localhost:8787
npx wrangler deploy       # ships Worker + bound assets in one operation
```

Wrangler is **v4** (an incremental release over the v3 rewrite — same config model, updated deps). Pin it: `npx wrangler@4`.

## wrangler.jsonc anatomy

Config may be `wrangler.toml`, `wrangler.json`, or `wrangler.jsonc`. Prefer **jsonc** so you can comment bindings. Minimum keys: `name`, `main`, `compatibility_date`.

```jsonc
{
  "name": "my-app",
  "main": "src/index.ts",
  // Set to TODAY's date when you start. Why: it pins runtime + flag behavior;
  // bumping it later opts into new defaults (e.g. nodejs_compat auto-enables at 2025-10-01+).
  "compatibility_date": "2026-06-02",
  "compatibility_flags": ["nodejs_compat"],

  // Static Assets — the default way to host a SPA / full-stack app.
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",                       // env.ASSETS.fetch(request)
    "not_found_handling": "single-page-application"
  },

  // Non-secret config only. Secrets go via `wrangler secret put`, never here.
  "vars": { "API_BASE": "https://api.example.com" },

  "r2_buckets":   [{ "binding": "BUCKET",  "bucket_name": "uploads" }],
  "d1_databases": [{ "binding": "DB", "database_name": "app", "database_id": "<id>" }],
  "kv_namespaces":[{ "binding": "CACHE",  "id": "<namespace-id>" }],
  "queues": {
    "producers": [{ "binding": "JOBS", "queue": "thumbnails" }],
    "consumers": [{ "queue": "thumbnails", "max_batch_size": 10, "max_retries": 3,
                    "dead_letter_queue": "thumbnails-dlq" }]
  }
}
```

Named environments inherit top-level config and override per `env.<name>`. See `references/wrangler-config.md` for the full annotated config, routes, custom domains, and compatibility flags.

## Pick the right storage primitive

This is the decision that shapes the architecture. Pick by access pattern and consistency, not by familiarity.

| Primitive | Use for | Consistency | Hard limit | Don't use for |
|---|---|---|---|---|
| **D1** | Relational app data, per-tenant DBs | Strong (single SQLite) | 10 GB per database | A single >10 GB monolith; Postgres features (it is SQLite) |
| **KV** | Read-heavy config, cached lookups, feature flags | Eventual (~60s to propagate globally) | 25 MiB per value | Counters, sessions you read-after-write, anything strongly consistent |
| **R2** | Files, blobs, uploads, backups | Strong on object | Object storage; **no egress fees** | Querying/indexing structured data |
| **Durable Objects** | Strongly-consistent coordination, per-entity state, WebSockets | Strong (single-threaded per object) | One object = one serialized actor | Bulk storage; high-fanout reads |
| **Queues** | Async/batch work, decoupling, retries | At-least-once delivery | Batch ≤100 (default 10) | Synchronous request/response |

Rule of thumb: **need read-after-write? Not KV.** Need SQL joins? D1. Need a file? R2. Need a counter or lock? Durable Object. Per-primitive binding config and code, consistency semantics, the complete limits/pricing tables, and Hyperdrive for external Postgres are in `references/storage-primitives.md`.

## Static & full-stack hosting

Workers **Static Assets** is the recommended way to host SPAs and full-stack apps. The Worker and the assets deploy together.

- `assets.directory` — your build output, e.g. `./dist`.
- `assets.binding: "ASSETS"` — lets the Worker serve files via `env.ASSETS.fetch(request)`.
- `assets.not_found_handling` — `"single-page-application"` (serve `index.html` on miss, for client-side routing) or `"404-page"`.
- `assets.run_worker_first` — run the Worker before serving static assets, e.g. so `/api/*` hits your handler not a file.

Do **not** use Workers Sites for new projects — it is deprecated in Wrangler v4 and unsupported by the Cloudflare Vite plugin. Migrating off Pages? Pages still works, but new full-stack work targets Workers; the asset-routing rules and the migration checklist are in `references/wrangler-config.md`.

## Bindings in code

Type every binding on `Env`. Why: without the interface you lose autocompletion and ship `undefined` binding bugs to the edge.

```ts
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  CACHE: KVNamespace;
  JOBS: Queue<{ key: string }>;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/user")) {
      const row = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(url.searchParams.get("id")).first();
      return Response.json(row);
    }
    if (req.method === "PUT" && url.pathname.startsWith("/upload/")) {
      await env.BUCKET.put(url.pathname.slice(8), req.body);
      await env.JOBS.send({ key: url.pathname.slice(8) }); // enqueue thumbnail job
      return new Response("ok", { status: 201 });
    }
    const cached = await env.CACHE.get("config", { cacheTtl: 3600 });
    if (url.pathname === "/config" && cached) return new Response(cached);

    return env.ASSETS.fetch(req); // fall through to the SPA
  },
} satisfies ExportedHandler<Env>;
```

## Secrets, env vars, local dev

```bash
wrangler secret put STRIPE_KEY      # encrypted, never in wrangler.jsonc or git
echo "STRIPE_KEY=sk_test_..." >> .dev.vars   # local only — gitignore it
```

- Secrets via `wrangler secret put` only. Why: `vars` in `wrangler.jsonc` is committed plaintext.
- `.dev.vars` supplies secrets for `wrangler dev`; add it to `.gitignore`.
- `vars` block = non-secret config (API base URLs, feature flags).
- `wrangler dev` emulates bindings locally; add `--remote` to run against real edge resources.

## Queues wiring

Producer and consumer are both bindings/handlers — same Worker or different Workers.

```ts
// Producer (in fetch): enqueue work
await env.JOBS.send({ key });

// Consumer: a queue() handler on the same module
export default {
  async fetch(/* ... */) { /* ... */ },
  async queue(batch: MessageBatch<{ key: string }>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processThumbnail(msg.key, env); // make this idempotent — delivery is at-least-once
        msg.ack();
      } catch {
        msg.retry();   // up to max_retries (default 3), then dead-letter
      }
    }
  },
};
```

Defaults: `max_batch_size` 10 (max 100), `max_retries` 3, plus `max_batch_timeout`. Route exhausted messages to a `dead_letter_queue`. Make consumers idempotent — at-least-once means a message can arrive twice.

## Limits that reshape your design

These numbers are architecture inputs, not trivia. Read them before you design.

- **Subrequests per request** are capped — fan-out to dozens of origins fails. Batch, cache in KV, or move work to a Queue consumer.
- **CPU time per request** is bounded (raised on the paid plan). Long CPU work → Queue + consumer, or Durable Object alarms.
- **KV value ≤ 25 MiB** and eventually consistent — large or write-hot data belongs in R2 or D1.
- **D1 ≤ 10 GB per database** — shard per tenant/user (D1 is built for many small DBs), don't grow one monolith.
- **Queue batch ≤ 100** — size `max_batch_size` to your downstream throughput, not the max.

Plan note: the **Workers Paid** plan is a $5/mo minimum bundling Workers, Pages Functions, KV, Hyperdrive, and Durable Objects; a Free plan exists with reduced limits (D1 free-tier limits enforced since 2025-02-10).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| KV for sessions / counters you read after writing | Eventual consistency: a read after a write can be stale up to ~60s | D1 (strong) or a Durable Object (per-entity strong) |
| Growing one D1 database past 10 GB | Hard cap; you hit a wall mid-scale | Shard per tenant/user; large blobs go to R2 |
| Omitting `compatibility_date` | Runtime/flag behavior drifts; deploys become non-reproducible | Set it to today's date at project start; bump deliberately |
| Avoiding R2 over egress cost | R2 has **no egress charges** — you're optimizing a cost that doesn't exist | Use R2 for files/blobs; pay only storage + ops |
| Workers Sites for a new SPA | Deprecated in Wrangler v4; unsupported by the Vite plugin | `assets` (Static Assets) with `not_found_handling` |
| Secrets in `vars` or committed | Plaintext in repo / config = leak | `wrangler secret put`; `.dev.vars` (gitignored) for local |
| Treating D1 like a pooled SQL connection | D1 is accessed over HTTP, not a persistent pool — no transactions across requests, no long-held connections | One prepared statement per call; batch with `db.batch()` |
| Heavy fan-out to many subrequests | Hits the subrequest cap and fails the request | Cache in KV, batch, or offload to a Queue consumer |
