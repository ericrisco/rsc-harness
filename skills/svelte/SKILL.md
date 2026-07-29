---
name: svelte
description: "Use when building, reviewing or fixing Svelte 5 (runes) and SvelteKit code — components with the rune primitives, rune modules versus stores, file routing, universal versus server load functions, form actions with progressive enhancement, remote functions, SSR/CSR/prerender choices, and adapters. Covers migrating Svelte 4 reactive statements to runes and hydration mismatches. NOT Next.js or RSC (that is `nextjs`)."
tags: [svelte, sveltekit, runes, frontend, ssr, web]
recommends: [typescript, vercel, design]
origin: risco
---

# Svelte 5 runes + SvelteKit

> Explicit, signal-based reactivity (runes) plus the SvelteKit data-loading contract: knowing *where code runs* and *how `load` data reaches a page*.

Two things break Svelte code more than anything else: treating `$effect` as the default for computed values, and confusing server-only `load` with universal `load`. This skill keeps you on the right side of both.

## When to use

- Authoring or editing `.svelte` / `.svelte.js` / `.svelte.ts` files.
- Choosing `$state` vs `$derived` vs `$effect`; migrating Svelte 4 `let` / `$:` / `export let` to runes.
- Writing or reviewing `+page.svelte`, `+page.ts`, `+page.server.ts`, `+layout*`, `+server.ts`, `+error.svelte`, `hooks.server.ts`.
- `load` design (universal vs server), `PageData` typing, `depends`/`invalidate`, streaming promises, form actions with `use:enhance`.
- Remote functions (`query`/`form`/`command`/`prerender` in `*.remote.ts`).
- Adapter choice and SSR/CSR/prerender flags; hydration-mismatch debugging.

## When NOT to use

- Next.js / React Server Components → `../nextjs/SKILL.md`. Different reactivity model and data-loading contract. Never cross runes with RSC.
- Pure TypeScript typing (generics, mapped/conditional types) with no Svelte dimension → `../typescript/SKILL.md`.
- Deploy-target specifics (env, edge, project config) → `../vercel/SKILL.md`, `../netlify/SKILL.md`, `../cloudflare/SKILL.md`. This skill *picks the adapter*; those skills own the platform.
- React, Vue/Nuxt, Astro, SolidJS, Angular are not in this catalog yet — keep any framework comparison brief and inline; do not link them.

Current as of June 2026: **Svelte 5.56.x**, **SvelteKit 2.61.x**. Svelte 5 (runes) shipped Oct 2024.

## First: detect Svelte 4 vs 5 — before you write a single rune

The #1 way to hand someone broken advice is to mix Svelte 4 reactivity (`$:`, `export let`) with runes in the same file. They are silently incompatible: a `$:` block in a runes component does nothing reactive. Detect the mode first.

1. Read `package.json` → `dependencies`/`devDependencies` `svelte`. `^5` (or `5.x`) = runes era. `^4` = legacy.
2. Read `svelte.config.js`. `compilerOptions.runes: true` forces runes everywhere; absent = per-file auto-detect (a file is in runes mode iff it uses any rune).
3. Grep the target file: `$state(` / `$props(` / `$derived(` → runes mode. `export let` / `$:` / `<slot` → legacy.

Rule: **never give `$:`/`export let` advice and `$state`/`$props` advice for the same component.** If the codebase is Svelte 4 and the task is new work, migrate the file to runes first (see `references/runes.md` migration map) rather than appending runes onto legacy syntax.

## Runes decision table

Pick the rune by what the value *is*, not by habit. Reading a rune registers a dependency; writing one schedules an update.

| You need | Rune | Why |
| --- | --- | --- |
| A reactive value you mutate | `$state(v)` | The cell tracked for reads/writes; deep objects/arrays are proxied. |
| A value computed from others | `$derived(expr)` / `$derived.by(fn)` | Recomputed lazily from deps read *synchronously*; no manual wiring. |
| A side effect (DOM, subscription, log) | `$effect(fn)` | Runs *after* DOM update; return a cleanup fn. Escape hatch, not default. |
| A component input | `let { x } = $props()` | Destructure props; supports defaults and rest. |
| A two-way-bindable prop | `let { x = $bindable() } = $props()` | Opts the prop into parent `bind:x`. |

**`$effect` is the escape hatch.** If an effect's only job is to set state from other state, it's a `$derived` in disguise — and worse, writing `$state` inside an effect that also reads it can loop.

```svelte
<!-- Bad: effect used to compute → extra render, can loop -->
<script>
  let count = $state(0);
  let doubled = $state(0);
  $effect(() => { doubled = count * 2; });
</script>

<!-- Good: derived value, no effect -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>
```

Deep mutation *is* reactive on `$state` (it returns a proxy), so mutate in place — you don't need to reassign.

```svelte
<script>
  let todos = $state([{ done: false }]);
  // Good: proxied, the push is tracked
  function add() { todos.push({ done: false }); }
  // Also fine: todos[0].done = true;
</script>
```

Props with defaults and renaming:

```svelte
<script>
  // Good: default + rename a reserved-ish name + rest props
  let { title = 'Untitled', class: klass = '', ...rest } = $props();
</script>
```

## Shared / global state across modules

Reactive shared state must live in a **`.svelte.js`** or **`.svelte.ts`** module (the `.svelte` part tells the compiler to process runes). A plain `.js` file cannot use runes.

The trap: you cannot `export let count = $state(0)` and reassign it elsewhere — importers get the *value* at import time, not the live cell, so it appears to "stop being reactive." Export a container whose identity is stable.

```js
// counter.svelte.js
// Bad: importers bind the value, not the reactive cell
export let count = $state(0); // reassigning count elsewhere won't propagate

// Good: object identity is stable; .value stays reactive
export const counter = $state({ value: 0 });

// Good: getter/setter object
let _n = $state(0);
export const n = {
  get value() { return _n; },
  set value(v) { _n = v; },
};

// Good: a class instance (fields are reactive)
export class Counter {
  value = $state(0);
  increment() { this.value += 1; }
}
```

Classic `writable`/`readable`/`derived` stores from `svelte/store` are still valid and still work — prefer them when you need the `$store` auto-subscription sugar in templates or are integrating Svelte 4 code. For new runes-first code, the module patterns above are simpler. Depth in `references/runes.md`.

## SvelteKit file map — what runs where

| File | Runs | Purpose |
| --- | --- | --- |
| `+page.svelte` | client + SSR | The page component; reads `data: PageData`. |
| `+page.ts` / `+layout.ts` | server (SSR) **and** browser (client nav) | Universal `load`. No secrets — code ships to the client. |
| `+page.server.ts` / `+layout.server.ts` | server only | Server `load` + `actions`. DB, secrets, filesystem live here. |
| `+server.ts` | server only | API route: `GET`/`POST`/… returning `Response`. |
| `+error.svelte` | client + SSR | Rendered when a `load`/render throws. |
| `hooks.server.ts` | server only | `handle`, `handleFetch`, `handleError` middleware. |

## Data loading

Universal vs server is the core decision. **Secrets, DB clients, and `$env/static/private` belong in `+page.server.ts`** — `+page.ts` code is shipped to the browser. Type the return with the generated `./$types`.

```ts
// +page.server.ts — server only; safe to touch DB/secrets
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, depends }) => {
  depends('app:post'); // custom dep, target of invalidate('app:post')
  const post = await db.post.find(params.id);
  // Top-level promise streams: the page renders, comments arrive later.
  return { post, comments: db.comment.forPost(params.id) };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<h1>{data.post.title}</h1>

{#await data.comments}
  <p>Loading comments…</p>
{:then comments}
  <ul>{#each comments as c}<li>{c.body}</li>{/each}</ul>
{/await}
```

Streaming a top-level promise works only from a **server** `load`. Universal `load` cannot stream the same way — await there or move the slow fetch to the server. Re-run a `load` with `invalidate('app:post')` (matches `depends`) or `invalidateAll()`. Patterns for `parent()`, named actions, and validation live in `references/sveltekit-data.md`.

## Mutations: form actions first, remote functions second

**Default to form actions.** They live in `+page.server.ts`, are posted to by a real `<form method="POST">`, and **work without JS**. `use:enhance` upgrades them to no-reload submission progressively.

```ts
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '');
    if (!email) return fail(400, { email, missing: true });
    cookies.set('session', '…', { path: '/' });
    throw redirect(303, '/dashboard');
  },
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  let { form }: { form: ActionData } = $props();
</script>

<form method="POST" action="?/login" use:enhance>
  <input name="email" type="email" />
  {#if form?.missing}<p>Email required</p>{/if}
  <button>Log in</button>
</form>
```

**Remote functions are EXPERIMENTAL** (available since SvelteKit 2.27, iterated through 2.61; API subject to change). They live in `*.remote.ts` and require opting in with **both** flags in `svelte.config.js` — `kit.experimental.remoteFunctions: true` **and** `compilerOptions.experimental.async: true` (the latter enables top-level `await`/awaited deriveds the feature relies on; without it remote functions do not actually enable). Four kinds: `query` (cached server read), `form` (progressive, parses its own FormData, no schema), `command` (mutation outside a form — requires JS), `prerender` (build-time). Use them for JS-driven flows where a plain form action is awkward; otherwise stick to form actions. Full usage in `references/sveltekit-data.md`.

## SSR / CSR / prerender + adapters

Control rendering per route with module-level exports in `+page.ts`/`+page.server.ts`:

```ts
export const prerender = true; // render at build time → static HTML
export const ssr = false;      // skip server render; client-only
export const csr = false;      // no client JS; pure SSR/static
```

Pick the adapter for the deploy target, then hand platform details to the platform skill:

- `adapter-auto` — zero-config on Vercel / Netlify / Cloudflare. Good default.
- `adapter-node` — long-running Node server (your own host, Docker).
- `adapter-static` — full prerender; the whole site is static (needs `prerender = true` reachable everywhere).

Env vars, edge runtime, KV/D1 bindings, build settings: that's `../vercel/SKILL.md`, `../netlify/SKILL.md`, `../cloudflare/SKILL.md`, not this skill.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do this instead |
| --- | --- | --- |
| `$effect` to compute a value from `$state` | Extra render pass; can loop if it reads what it writes | `$derived(expr)` / `$derived.by(fn)` |
| `export let count = $state(0)` for shared state | Importers bind the value, not the live cell → "not reactive" | Export an object / getter / class instance |
| Runes in a plain `.js` file | Compiler doesn't process runes there | Name it `.svelte.js` / `.svelte.ts` |
| Mixing `$:` / `export let` with runes in one file | `$:` is dead in runes mode → silent non-reactivity | Migrate the whole file to runes (see references) |
| DB call / secret in `+page.ts` | Universal `load` ships to the browser; secret leaks | Move to `+page.server.ts` (server-only) |
| Streaming a top-level promise from universal `load` | Only server `load` streams | Await in load, or move the fetch server-side |
| Mutating a non-`$state` object expecting reactivity | Only `$state` proxies are tracked | Wrap the value in `$state(...)` |
| Reaching for remote functions by default | Experimental, JS-required, API may change | Form actions first; remote functions only when needed |

## Verify

Run `scripts/verify.sh` from the SvelteKit project root: `svelte-check` → `tsc --noEmit` → Vitest → `vite build`. Each tool is detected and skipped (not failed) if absent; it exits non-zero only on a real failure. The build step writes the output dir — not read-only.
