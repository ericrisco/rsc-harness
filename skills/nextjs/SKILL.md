---
name: nextjs
description: "Use when building, reviewing, testing, securing, or optimizing a Next.js App Router app: Server vs Client boundaries, `use server` actions, route handlers, the v15 vs v16 `use cache` caching model, metadata/SEO, auth, and Core Web Vitals. NOT framework-agnostic React or a Vite SPA (that is `react`), and NOT visual/UI design (that is `design`)."
tags: [nextjs, react, frontend, web, seo, ssr]
recommends: [design, secure-coding, deployment]
origin: risco
---

# Next.js App Router — RSC, Server Actions, React 19, TypeScript

> Build, review, test, secure and optimize App Router apps, handling both the Next.js 15 (uncached-by-default) and Next.js 16 (`use cache`) caching models correctly.

> **SDD gate — read before writing code.** If this fired on a **new, non-trivial feature or
> behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP and
> hand off to `../specify/SKILL.md` (brainstorm → spec → plan → tasks); it routes back here once the
> plan is approved. Build directly only for a genuinely one-line / low-risk change. Method:
> `../sdd/SKILL.md`.

**Not this skill:** Pages Router (`pages/`) — note the difference, defer to the Next.js Pages docs.
A pure React SPA (Vite/CRA) → `../react/SKILL.md`; React Native / Expo → `../react-native/SKILL.md`;
a generic React question with no Next/RSC dimension → keep it brief, from `references/react.md`.
Non-Next backends → `../fastapi/SKILL.md`, `../go/SKILL.md`; the data layer behind the DAL →
`../postgresdb/SKILL.md`; framework-agnostic security → `../secure-coding/SKILL.md`, complemented here, never duplicated.

## First: detect the project's version & caching model

**Run this before prescribing or reviewing any caching, middleware, or React-Compiler behavior.
Never mix v15 and v16 advice.**

1. Read `package.json` → the `next` version.
2. Read `next.config.{ts,js,mjs}` for `cacheComponents`, `ppr`, `reactCompiler`, `experimental`.
3. `proxy.ts` at the root ⇒ v16; `middleware.ts` ⇒ v15 (or v16 not yet migrated).
4. `cacheComponents: true` OR any `"use cache"` in the tree ⇒ **Cache Components model** (opt-in
   caching). Otherwise ⇒ **v15 model** (uncached `fetch` by default, `revalidate`/`tags`).

**Do not flag `proxy.ts`, `use cache`, or `cacheComponents` as errors — they are correct on
Next.js 16.**

| Signal in repo                                | Model                  | Caching API to use                                                              |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `cacheComponents: true` or any `"use cache"`  | Cache Components (v16) | `"use cache"` + `cacheLife()` + `cacheTag()`/`updateTag()`                       |
| `middleware.ts`, no `cacheComponents`         | v15 baseline           | `fetch(..., { next: { revalidate, tags } })`, `unstable_cache`, `revalidateTag` |
| `proxy.ts` present                            | v16 routing            | middleware logic lives in `proxy.ts` (NOT a security boundary)                  |
| `reactCompiler: true`                         | Compiler on            | drop manual `useMemo`/`useCallback`/`React.memo` (review-only)                  |

## The boundary: Server vs Client Components

Default is a Server Component (async, can touch the DB and secrets, ships zero JS). Opt into a
Client Component only for state, effects, event handlers, or browser APIs.

The four boundary laws:

- Server → Client: pass **serializable** props or `children` (no functions except Server Actions).
- Never `import` a Server Component into a Client Component; compose via `children`.
- `"use client"` marks a module **and its whole import subtree** as client.
- Keep `"use client"` leaves small; push the directive **down** the tree.

```tsx
// app/projects/[id]/page.tsx — Good: server async page + a tiny client island
import { getProject } from "@/lib/dal";
import { LikeButton } from "./like-button";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id); // DB call stays on the server
  return (
    <main>
      <h1>{project.name}</h1>
      <LikeButton projectId={project.id} initialLikes={project.likes} />
    </main>
  );
}
```

When a Client Component needs server content, give it a `children` (or prop) slot and pass the
Server Component from a server parent — `<ClientPanel><ServerChart /></ClientPanel>`. The
import-graph rule and the full Bad/Good contrast are in `references/react.md` (Server vs Client deep dive).

## "use server": Server Actions

**Every Server Action is a public POST endpoint. It MUST authenticate and authorize itself.
Middleware/proxy does NOT protect it.**

```ts
// app/projects/actions.ts
"use server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const RenameSchema = z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) });

type RenameResult =
  | { status: "ok"; data: { id: string; name: string } }
  | { status: "error"; message: string };

export async function renameProject(_prev: RenameResult | null, formData: FormData): Promise<RenameResult> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Not authenticated" };

  const parsed = RenameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Invalid input" };

  const owned = await db.project.findFirst({ where: { id: parsed.data.id, ownerId: session.user.id } });
  if (!owned) return { status: "error", message: "Forbidden" };

  const updated = await db.project.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } });
  revalidateTag(`project:${updated.id}`);
  return { status: "ok", data: { id: updated.id, name: updated.name } };
}
```

Two invocation modes: `<form action={renameProject}>` — progressive enhancement, works without JS —
or imperative from a client handler wrapped in `startTransition(() => renameProject(null, fd))`.

## Route Handlers (`route.ts`)

Use a Route Handler for: webhooks, a public JSON API, OAuth callbacks, streaming responses, and
non-form clients. Use a **Server Action instead** for internal form mutations. GET handlers are
uncached by default on v15 (control with `export const dynamic` / `runtime`), and every handler —
GET included — runs its own `auth()` check and scopes reads to the session user.

```ts
// app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const CreateSchema = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  const created = await db.project.create({ data: { name: parsed.data.name, ownerId: session.user.id } });
  return NextResponse.json({ project: created }, { status: 201 });
}
```

## Layouts, templates, loading & error boundaries

| File               | Role / when it runs                                           |
| ------------------ | ------------------------------------------------------------- |
| `layout.tsx`       | Wraps a segment; persists across navigation, does NOT remount |
| `template.tsx`     | Like layout but remounts on every navigation (fresh state)    |
| `loading.tsx`      | Instant Suspense fallback for the segment while it streams    |
| `error.tsx`        | `"use client"` error boundary for the segment, gets `reset()` |
| `not-found.tsx`    | Rendered by `notFound()` and unmatched routes                 |
| `global-error.tsx` | Replaces the root layout when the root throws                 |

An `error.tsx` is always `"use client"`, receives `{ error: Error & { digest?: string }, reset }`,
and should render `role="alert"` plus a button calling `reset()`.

```tsx
// app/dashboard/page.tsx — Good: stream the shell, Suspense the slow part
import { Suspense } from "react";
import { Stats } from "./stats";

export default function Page() {
  return (
    <main>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading stats…</p>}>
        <Stats /> {/* async Server Component; the shell paints immediately */}
      </Suspense>
    </main>
  );
}
```

## Routing: groups, parallel, intercepting, dynamic, metadata

- Route groups `(marketing)/` organize without affecting the URL; dynamic `[id]`, catch-all
  `[...slug]`, optional `[[...slug]]`.
- **`params` and `searchParams` are Promises on v15+ — `await` them.**
- Parallel routes `@modal` + `default.tsx`; intercepting `(.)photo` — modal-on-navigation.
- `generateMetadata` (async) + `generateStaticParams`.

```tsx
// Bad: treating params as a plain object (the top v15-migration bug)
function PageBad({ params }: { params: { id: string } }) {
  return <h1>{params.id}</h1>; // runtime/type error on v15+
}
// Good: params is a Promise — await it
async function PageGood({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <h1>{id}</h1>;
}
```

## Metadata & SEO

The App Router emits `<title>`, `<meta>`, OpenGraph/Twitter tags, `sitemap.xml`, and `robots.txt`
from code (identical API on v15/v16). Build-side patterns → `references/metadata.md`; the strategy
side — JSON-LD, GEO, keyword research — is `../marketing/SKILL.md`'s
(`../marketing/references/seo-geo.md`): this skill emits the tags, that one picks the content.

- `metadata`/`generateMetadata` are **Server-Component-only** — one or the other per file (static
  object when known at build; async `generateMetadata` when it depends on `params`/data, wrapped in
  `React.cache` to dedupe with the page). Set `metadataBase` once in the root layout so relative
  OG/canonical URLs resolve to absolute.
- `app/sitemap.ts` → `MetadataRoute.Sitemap` (50k-URL cap; shard with `generateSitemaps()` past that);
  `app/robots.ts` → `MetadataRoute.Robots` (link the sitemap, disallow private paths).
- Dynamic OG images: `opengraph-image.tsx` returning `ImageResponse` from `next/og` (flexbox-only CSS).

```tsx
// app/blog/[slug]/page.tsx — dynamic metadata + OpenGraph (sitemap.ts/robots.ts/next/og in references/metadata.md)
import type { Metadata } from "next";
import { getPost } from "@/lib/dal";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; // params is a Promise on v15+
  const post = await getPost(slug); // React.cache-shared with the page
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: post.title,
      type: "article",
      images: [{ url: post.cover, width: 1200, height: 630, alt: post.title }], // recommended OG size
    },
    twitter: { card: "summary_large_image", title: post.title },
  };
}
```

## Caching & data fetching (both models)

Which block applies is decided by the detection gate above. Optimistic UI, `useActionState` + zod
forms and the full mutation patterns are in `references/data-and-caching.md`.

**v15 model** — `fetch` is uncached by default; opt in explicitly.

```ts
// uncached on v15 (re-fetched every request):
const live = await fetch("https://api.example.com/now").then((r) => r.json());

// opt into the data cache + tag it:
const products = await fetch("https://api.example.com/products", {
  next: { revalidate: 3600, tags: ["products"] },
}).then((r) => r.json());

// from a Server Action: invalidate the tag (or a route with revalidatePath)
import { revalidateTag } from "next/cache";
revalidateTag("products");

// request-scoped dedupe (one query per render); see also unstable_cache + route segment config
import { cache } from "react";
export const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }));
```

**v16 Cache Components** — everything dynamic by default; opt in with `"use cache"`.

```ts
// lib/products.ts — Next.js 16: cacheLife/cacheTag/updateTag are STABLE (no unstable_ prefix;
// the v15 preview used `unstable_cacheLife as cacheLife`, `unstable_cacheTag as cacheTag`).
import { cacheLife, cacheTag, updateTag } from "next/cache";

export async function getProducts() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return db.product.findMany();
}

// from a Server Action: updateTag = immediate read-your-writes;
// revalidateTag("products", "hours") = stale-while-revalidate. See references/data-and-caching.md.
updateTag("products");
```

```ts
// Bad: reading request APIs inside "use cache" hangs/errors the build
export async function getCartBad() {
  "use cache";
  const c = await cookies(); // ✗ not allowed inside use cache
  return db.cart.find(c.get("cartId")?.value);
}

// Good: read the request value OUTSIDE, pass it as an argument
export async function getCart(cartId: string) {
  "use cache";
  cacheTag(`cart:${cartId}`);
  return db.cart.find(cartId);
}
```

## React 19 in the App Router (essentials)

The Next-relevant deltas (full discipline, hooks, state-location tree, composition →
`references/react.md`): `useActionState(fn, initial)` → `[state, action, isPending]` (replaces
`useFormState`); `useFormStatus()` for a child submit button; `useOptimistic` auto-reverts on
action error; `use(promise)` unwraps an RSC-passed Promise under `<Suspense>`; `ref` is a normal
prop (no `forwardRef`); `<Context value>` is the provider; React Compiler on
(`reactCompiler: true`) ⇒ drop manual memoization.

```tsx
"use client";
import { useActionState } from "react";
import { renameProject } from "./actions"; // the "use server" action defined above

export function RenameForm({ id }: { id: string }) {
  const [state, action, isPending] = useActionState(renameProject, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input name="name" aria-label="Project name" required />
      <button disabled={isPending}>{isPending ? "Saving…" : "Save"}</button>
      {state?.status === "error" && <p role="alert">{state.message}</p>}
    </form>
  );
}
```

## TypeScript discipline

- `strict: true` + `noUncheckedIndexedAccess: true`.
- Typed routes (`typedRoutes: true`, or `experimental.typedRoutes` on older v15).
- **zod-inferred end-to-end types** (`z.infer`) shared across action input, form, and DB layer.
- Discriminated-union action result `{ status: "ok"; data } | { status: "error"; message }`.
- `params`/`searchParams` typed as `Promise<...>`.

```ts
// Bad: untyped form data
const data: any = Object.fromEntries(formData);

// Good: validate + infer one shared type
const schema = z.object({ name: z.string().min(1), email: z.string().email() });
type Input = z.infer<typeof schema>; // reuse for form + DB layer
const r = schema.safeParse(Object.fromEntries(formData));
if (!r.success) return { status: "error", message: "Invalid" };
```

## Auth & security (deep dive → references/security.md)

Defense in depth with **three layers — middleware is NOT one of them**. Full wiring (Auth.js v5
`auth.ts`, the DAL, CSRF, cookies, CSP, SSRF) lives in `references/security.md`; apply this checklist
on every review:

- `proxy.ts`/`middleware.ts` is a coarse redirect only (NOT a security boundary).
- `auth()` check inside **every** Server Action and Route Handler (shown in those sections above);
  re-check the session in a **Data Access Layer (DAL)** before any read/write — the DAL is the real boundary.
- Secure cookies: `httpOnly`, `secure`, `sameSite: "lax"`; rotate the session on any privilege change.
- CSRF: Server Actions verify `Origin`/`Host`; never expose a mutation as an unauthenticated GET;
  set `serverActions.allowedOrigins` in `next.config.ts`.
- **Never put secrets in `NEXT_PUBLIC_*`** — they ship to the browser; proxy via a Route Handler and
  mark server-only modules with `import 'server-only'`.
- SSRF: allowlist host/scheme before `fetch` in Route Handlers; block internal/metadata ranges.
- CSP with a nonce via `proxy.ts`/headers. See also `../secure-coding/SKILL.md`.

## Performance (deep dive → references/performance.md)

- `next/image` — always width/height or `fill` + a sized parent; `priority` on the LCP image; `sizes`.
- `next/font` — self-host, `display: "swap"`, subset → zero CLS + no extra round-trip.
- `next/dynamic` for heavy client islands; `optimizePackageImports`; `@next/bundle-analyzer`.
- Kill waterfalls with parallel `Promise.all` / split sibling fetches into parallel children; PPR/streaming, reserve space to avoid CLS.
- Long lists: `content-visibility: auto` + virtualize (`@tanstack/react-virtual`) past ~50 rows; warm assets with `react-dom` `preload`/`preconnect`; narrow store selectors (Zustand) cut re-renders. Full lever→metric map in `references/performance.md`.
- Core Web Vitals targets: **LCP < 2.5s, CLS < 0.1, INP < 200ms** (INP replaced FID).

## Anti-patterns

| Common belief                                               | Reality / STOP                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| "The client already checks the user, the action is safe"   | Server Actions are public POST endpoints — authenticate inside the action  |
| "`fetch` caches by default, skip `revalidate`"             | v15: `fetch` is uncached by default; that's the v13/14 mental model        |
| "Read `cookies()` inside `use cache` for convenience"      | Build hangs/errors; read outside, pass the value as an argument            |
| "`proxy.ts` looks misnamed, rename to `middleware.ts`"     | Correct on v16; renaming breaks middleware execution                       |
| "Just `import` the Server Component into this client file"  | Compose via `children`; importing forces it client / breaks the build      |
| "Put the API key in `NEXT_PUBLIC_API_KEY`"                 | It ships to the browser; proxy through a Route Handler/Server Action       |
| "Add `useMemo` everywhere for perf"                        | Measure first; with React Compiler manual memoization is noise             |
| "`await params` is unnecessary"                            | v15+: `params`/`searchParams` are Promises — you must `await`              |
| "Middleware protects my dashboard, the data fetch is safe" | Middleware is not a security boundary; check in the DAL                    |
| "Snapshot-test the RSC page"                               | Async Server Components aren't jsdom-renderable; test data fns + Playwright |

## Verify

Run `bash scripts/verify.sh` from the Next.js project root. It runs ESLint, `tsc --noEmit`,
Vitest, and `next build`, skipping any tool not installed (a missing tool is a yellow warning, never
a failure). It reads the installed Next.js major version and only falls back to `next lint` on
**v15 and earlier** — `next lint` was removed in v16, so on a v16 repo a missing ESLint is a SKIP,
never a false failure. The lint/type/test steps are read-only; the final `next build` writes the
`.next/` output directory. No installs, no network mutations. Safe to re-run.

Test strategy — Vitest 3 + RTL + MSW 2 for units, Playwright for pages, and the RSC testing reality
behind that last anti-pattern row: `references/testing.md`.

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), this
project's app decisions live in `02-DOCS/wiki/stack/nextjs.md`, indexed from `02-DOCS/wiki/index.md`
(the Knowledge map; root `CLAUDE.md` keeps only a pointer). Read it first on every use and stay
consistent. Missing or stale → write the project's real choices there — caching model in use (v15
fetch-cache vs v16 `use cache`), auth approach, server-action and data-fetching conventions, runtime
(edge/node), design-system hookup — index it, and bump its `Updated` date in the same change as any
convention change. No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the
brand study, technical conventions are *recorded, not gated* — never block the task on this.
