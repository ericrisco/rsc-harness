---
name: supabase
description: "Use when building on Supabase as a backend over managed Postgres — wiring the supabase-js or SSR client, writing or debugging Row Level Security, cookie-based Auth, Storage buckets, Realtime, and Edge Functions, including local versus server JWT verification and the service-role key. NOT raw Postgres tuning (that is `postgresdb`)."
tags: [supabase, postgres, rls, auth, edge-functions, realtime, storage, baas]
recommends: [postgresdb, nextjs, db-migrations, secure-coding, drizzle-orm]
origin: risco
---

# Supabase — Postgres with RLS as the auth layer

Supabase is a managed Postgres database wrapped in thin SDKs, a PostgREST data API, Auth, Storage,
Realtime, and Deno Edge Functions. The one sentence that explains every footgun below:

> **Your authorization lives in the database (Row Level Security), not in your app code.**

The browser holds a key that can hit your database directly. That is safe *only* because RLS gates
every row. Get that wrong and you either leak everything or see nothing. Everything in this skill is
downstream of that fact. You can write SQL already — what you need is Supabase's specific abstractions
and where the trust boundary sits.

Use the current packages: **`@supabase/supabase-js` v2** (v1 is security-fixes only) and
**`@supabase/ssr`** for server frameworks (it replaced the deprecated `auth-helpers`).

---

## The two keys (the trust boundary)

Every Supabase project ships two classes of key. Confusing them is the one unrecoverable mistake.

| Key | Where it lives | RLS | If it leaks |
|-----|----------------|-----|-------------|
| **anon** / **publishable** (`sb_publishable_...`) | Browser, public env (`NEXT_PUBLIC_*`) | **Enforced** — safe in client only because RLS gates rows | Low: attacker still bound by your policies |
| **service_role** / **secret** (`sb_secret_...`) | Server only — Edge Functions, server env, never bundled | **Bypassed entirely** | Catastrophic: full read/write of all data |

The new `sb_publishable_` / `sb_secret_` format is rolling out alongside the legacy anon/service_role
JWTs; treat them by the same rules. **Why this matters:** the service_role key is a master key with
RLS turned off. One import into a client component is a full data breach.

```ts
// Bad — service_role key reachable from the browser bundle
"use client";
const supabase = createClient(URL, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!); // leaked

// Good — service_role only in server-side env, never NEXT_PUBLIC_*
// server-only module / Edge Function:
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

---

## Pick your client

| Context | Package | Where it lives |
|---------|---------|----------------|
| Browser-only SPA | `@supabase/supabase-js` (`createClient`) | Client bundle, anon key |
| Next.js / SvelteKit / Remix (SSR) | `@supabase/ssr` (`createBrowserClient` + `createServerClient`) | One client per context + middleware |
| Server job / Edge Function | `@supabase/supabase-js` with service_role from env | Server only |

Wrong client = broken sessions (no cookie refresh) or leaked keys. For SSR frameworks you need
**both** an `@supabase/ssr` browser client and a server client, plus middleware — see below.

---

## Auth that actually protects

Cookie-based auth in an SSR framework has one hard constraint: **Server Components cannot write
cookies**, so an expired access token can only be refreshed in **middleware**. Skip the middleware and
sessions silently die mid-request.

The non-negotiable rule for server-side gating: **never trust `getSession()`** — it only reads the
cookie, which a client can forge. What you reach for *instead* changed in late 2025.

> **Default: `supabase.auth.getClaims()`.** It verifies the JWT signature locally against your
> project's published public keys (`/.well-known/jwks.json`, cached on the edge and in memory) — no
> network round-trip. The current SSR docs say to *"always use `supabase.auth.getClaims()` to protect
> pages and user data."* This works because new projects sign tokens with **asymmetric keys by default
> since 2025-10-01** (RSA or Elliptic-Curve / ECC); the private key never leaves Auth, the public key is
> safe to verify with.

### getClaims vs getUser — pick by signing key + freshness need

| Situation | Use | Why |
|-----------|-----|-----|
| New project (asymmetric keys), gating a page or route | **`getClaims()`** | Local JWK signature check, zero latency per call — the documented default |
| Legacy project still on a **symmetric** JWT secret | `getClaims()` (auto-fallback) | With no public key to verify, `getClaims()` *itself* calls the Auth server — same cost as `getUser()`, so still the right default |
| You must detect a **just-banned / just-deleted** user mid-session | `getUser()` | Local verification trusts a still-valid signature; only a server round-trip sees a revoked user. Higher cost, stricter guarantee |

```ts
// Bad — getSession reads an unverified cookie; trivially spoofed
const { data: { session } } = await supabase.auth.getSession();
if (!session) redirect("/login"); // NOT a real check on the server

// Good (default) — getClaims verifies the JWT signature locally, no round-trip
const { data } = await supabase.auth.getClaims();
if (!data?.claims) redirect("/login");

// Good (strict fallback) — getUser revalidates against the Auth server every call;
// use only when you need live ban/delete detection
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");
```

Middleware token refresh is mandatory; full app-router code (browser client, server client,
`middleware.ts`, server-action sign-in/out, OAuth/PKCE callback, and the `auth-helpers`→`@supabase/ssr`
migration checklist) lives in [references/auth-ssr.md](references/auth-ssr.md). For the framework's own
RSC/caching/server-action mechanics see [../nextjs/SKILL.md](../nextjs/SKILL.md) — this skill only covers
the Supabase wiring inside it.

---

## RLS recipes + the performance cliff

Enable RLS on **every** table the data API can reach, then write policies. Four rules that cover most
real cases:

1. **`enable row level security`** on the table — without it, an exposed table is wide open to the anon key.
2. **Scope with `to authenticated`** — don't rely on `auth.uid()` alone to exclude the `anon` role; an
   anon request has a null uid and may slip through a sloppy predicate.
3. **Wrap `(select auth.uid())`** — Postgres caches a `select`-wrapped call once per statement instead of
   re-evaluating per row. Bare `auth.uid()` turns a lookup into a per-row function call → table-scan latency.
4. **Index the policy columns** — a policy filtering `user_id = (select auth.uid())` needs an index on
   `user_id`, or every query scans the table.

```sql
-- Bad — bare auth.uid() re-evaluated per row, no role scope, no index
create policy "owner reads" on documents
  for select using ( user_id = auth.uid() );

-- Good — cached subquery, role-scoped; pair with an index
create policy "owner reads" on documents
  for select to authenticated
  using ( user_id = (select auth.uid()) );

create index on documents (user_id);
```

For cross-table checks (is the user a member of this org?), use a `security definer` helper or a
`team_id` filter rather than a correlated subquery inside the policy. Multi-tenant `team_id` patterns,
public-read/private-write, storage policies, `realtime.messages` policies, and how to test policies with
`set role authenticated` live in [references/rls-cookbook.md](references/rls-cookbook.md). For
engine-level index choice and EXPLAIN reading, see [../postgresdb/SKILL.md](../postgresdb/SKILL.md).

---

## "My query returns nothing" — checklist

Silent empty results are the #1 confusion. Walk it in order:

1. **Is RLS enabled but you have no policy?** No policy = deny all. Add a `select` policy.
2. **Is the policy too strict / role-scoped wrong?** Test it: `set role authenticated;` with a faked
   `request.jwt.claims` (see the cookbook).
3. **Is the table even exposed to the data API?** This is the new trap. Supabase is flipping the
   "automatically expose new tables" default **off**: default for new projects since **2026-05-30**, and
   enforced on **all existing projects 2026-10-30**. An unexposed table is unreachable through PostgREST
   *even with perfect RLS* — you get empty results, not an error. Expose it explicitly in the dashboard
   (Data API settings) or grant access in the relevant schema.

---

## Storage

Buckets hold objects; access is governed by RLS policies on the `storage.objects` table — the same
engine as table RLS.

- **Public bucket**: objects served via a stable public URL, no auth. Good for avatars, bad for anything private.
- **Private bucket**: reads require a **signed URL** (`createSignedUrl`, time-limited) or an authed request that passes a policy.

**Why this bites:** a "public" bucket with no upload policy is either world-writable or fully closed
depending on your defaults. Always write explicit `insert`/`select` policies on `storage.objects`.

```ts
// Client upload (anon key) — RLS on storage.objects decides if it is allowed
await supabase.storage.from("avatars").upload(`${user.id}/photo.png`, file);

// Private read — short-lived signed URL, not a public link
const { data } = await supabase.storage.from("docs").createSignedUrl(path, 60);
```

---

## Realtime — default to Broadcast

Three features, and the choice between them is a scaling decision teams get wrong.

| Feature | Use for | Scaling |
|---------|---------|---------|
| **Broadcast** | Ephemeral messages (chat, cursors, custom events) | Scales for high fan-out; preferred default |
| **Presence** | Who's online / shared cursor state | Backed by Broadcast machinery |
| **Postgres Changes** | WAL-based row insert/update/delete events | Does **not** fan out well at scale |

> Default to **Broadcast**. Reach for Postgres Changes only for low-volume row-event needs.

For row changes that must reach many clients, use **"broadcast from the database"** — a trigger that
calls `realtime.broadcast_changes`/`realtime.send` — instead of Postgres Changes. Private channels are
authorized by RLS policies on the **`realtime.messages`** table (Broadcast and Presence support this).

```ts
const channel = supabase.channel("room:42", { config: { private: true } });
channel
  .on("broadcast", { event: "msg" }, ({ payload }) => render(payload))
  .subscribe();
channel.send({ type: "broadcast", event: "msg", payload: { text: "hi" } });
```

---

## Edge Functions

Edge Functions are Deno/TypeScript, deployed globally. The runtime injects `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

- Scaffold: `supabase functions new my-fn`. Each function may carry its own `deno.json`/`deno.jsonc`
  (requires CLI ≥ v1.215.0).
- Secrets: `supabase secrets set MY_KEY=...` (don't commit them).
- **Forward the caller's JWT** so RLS still applies: read the request's `Authorization` header and pass
  it into a per-request client. A function that uses the service_role client silently bypasses *all* RLS
  — only do that for genuinely trusted admin work.

```ts
// Good — per-request client carries the user's JWT; RLS enforced
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
);
```

Handle CORS for browser invocations (return `Access-Control-Allow-*` and answer the `OPTIONS` preflight).

---

## Local dev & migrations

- `supabase init` → `supabase start` (local stack) → `supabase link --project-ref <ref>`.
- Generate migrations from local changes with **`supabase db diff`** rather than editing prod schema in
  the dashboard (the dashboard drifts from source control).
- **Declarative schema** (experimental): describe schema as SQL files and let `supabase db diff`
  generate the migration via the pg-delta diff engine.
- Seed local data via `supabase/seed.sql`.

For migration discipline (expand-contract, concurrent indexes, batched backfills) the general practice
lives in `../db-migrations/SKILL.md`; for ORM-managed schema on top of Supabase Postgres see
[../drizzle-orm/SKILL.md](../drizzle-orm/SKILL.md).

Note: `pg_graphql` is disabled by default on new projects (since Feb 2026) — enable it if you need it.

---

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|--------------|----------------|------------|
| `service_role`/`sb_secret_` in a client component or `NEXT_PUBLIC_*` | Bypasses RLS → full data breach | Keep it server-only; browser uses anon/publishable |
| Authorizing with `getSession()` on the server | Reads an unverified cookie; spoofable | `getClaims()` — verifies the JWT signature locally (`getUser()` only when you need live ban/delete detection) |
| "I'll disable RLS for now" | An exposed table with RLS off is world-readable via the anon key | Enable RLS + write a permissive policy instead |
| Bare `auth.uid()` in a policy | Re-evaluated per row → table-scan latency | `(select auth.uid())` + index the column |
| Postgres Changes for chat / high fan-out | Doesn't scale; backpressure and dropped events | Broadcast (incl. broadcast-from-database triggers) |
| Empty results "must be RLS" | Often the table isn't exposed to the data API (2026 default flip) | Check Data API exposure first, then policies |
| Using `@supabase/auth-helpers` | Deprecated | Migrate to `@supabase/ssr` |
| service_role client inside an Edge Function for normal user work | Silently bypasses RLS for everyone | Forward the caller's `Authorization` header |

---

## Verify

Run `bash scripts/verify.sh` from a Supabase-backed repo. It hard-fails on `service_role`/`sb_secret_`
leaking into client-reachable files and warns on `getSession()` used for gating, bare `auth.uid()` in
policies, and `create table` migrations missing `enable row level security`.
