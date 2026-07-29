---
name: vue-nuxt
description: "Use when building or reviewing a Vue 3 + Nuxt 4 app — `<script setup>` reactivity, SSR/SSG/hybrid `routeRules`, the `app/`+`server/` layout, SSR-safe fetching (`useFetch`/`useAsyncData`) and state (`useState`/Pinia), Nitro routes, hydration mismatches, Nuxt 3→4 migration. NOT React/RSC (that is nextjs), NOT a static islands site (that is astro)."
tags: [vue, nuxt, frontend, web, ssr]
recommends: [design, deployment, secure-coding]
origin: risco
---

# Vue 3 + Nuxt 4 — Composition API, SSR, SSR-safe data & state

Build and review Vue 3 (`<script setup>` + Composition API) on the Nuxt 4 meta-framework:
SSR/SSG/hybrid rendering, the `app/` + `server/` layout, SSR-safe fetching and state, Nitro
server routes, and the reactivity discipline that keeps hydration correct. Nuxt's render model
is **whole-component render-then-hydrate** — there is no React-style "server component" boundary,
so never import RSC mental models here.

Not this skill: React / Next App Router / server actions → [`nextjs`](../nextjs/SKILL.md) or
[`react`](../react/SKILL.md). Content-first site mixing frameworks/islands →
[`astro`](../astro/SKILL.md); fine-grained signals → [`solid-js`](../solid-js/SKILL.md);
compiler-first no-VDOM peer → [`svelte`](../svelte/SKILL.md); [`angular`](../angular/SKILL.md).
Backend not in Nitro/JS → [`fastapi`](../fastapi/SKILL.md), [`go`](../go/SKILL.md),
[`laravel`](../laravel/SKILL.md). Test *strategy* beyond the Vitest + `@vue/test-utils` +
`@nuxt/test-utils` setup named here → [`e2e-testing`](../e2e-testing/SKILL.md) /
[`testing-web`](../testing-web/SKILL.md). Generic security review →
[`secure-coding`](../secure-coding/SKILL.md); SEO/content strategy →
[`marketing`](../marketing/SKILL.md); component visual language → [`design`](../design/SKILL.md).

## First: detect Nuxt vs plain Vue, and the version

Never prescribe `useFetch`/`useState`/auto-imports in a project that does not have them. Detect
before you write a line.

| Signal in the repo | Verdict | What is available |
|---|---|---|
| `nuxt.config.{ts,js,mjs}` + `app/` dir holding `pages/`,`components/` | **Nuxt 4** (current) | full auto-imports, `useFetch`/`useState`, `server/`, `routeRules` |
| `nuxt.config.*` + root `pages/`,`components/` (no `app/`) | **Nuxt 3 layout** | same APIs; flag the migration (see [`references/migration-nuxt4.md`](references/migration-nuxt4.md)) |
| `vite.config.*` + `createApp(...).mount(...)`, no `nuxt.config` | **plain Vue 3 SPA** | Vue reactivity only — NO `useFetch`/`useState`/Nitro/auto-imports |

Rule: in a plain-Vue SPA, fetch with the browser `fetch`/a client library inside `onMounted` or a
composable, manage shared state with `reactive`/`provide`/Pinia — `useFetch`/`useState` do not
exist there. Confirm `nuxt` is in `package.json` before reaching for any Nuxt API.

## Composition API & reactivity core

Use `<script setup lang="ts">` for every SFC. Prefer `ref` over `reactive` — `ref` survives
destructuring through `.value`, works for primitives, and reads uniformly. Reach for `reactive`
only for a grouped object you never destructure.

```vue
<script setup lang="ts">
import { ref, computed, watch, onWatcherCleanup } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)        // cached, recomputes on dep change

watch(count, async (next, _prev, onCleanup) => {        // explicit dep, gets old value
  const ctrl = new AbortController()
  onCleanup(() => ctrl.abort())                          // or onWatcherCleanup(...) (3.5)
  await fetch(`/api/log?n=${next}`, { signal: ctrl.signal })
})
</script>
```

`watch` vs `watchEffect`: use `watch` when you need the previous value or an explicit dependency;
use `watchEffect` for "run now and re-run when anything I touched changes". Register teardown with
`onWatcherCleanup()` (Vue 3.5) or the `onCleanup` arg to cancel stale async work — why: a watcher
that fires faster than its async settles will otherwise apply an out-of-order result.

Reactive props destructure is **stable in Vue 3.5** — the compiler rewrites `count` to
`props.count`, so the binding stays reactive and you get clean default syntax:

```vue
<script setup lang="ts">
const { count = 0, label } = defineProps<{ count?: number; label: string }>()
// `count`/`label` here ARE reactive — compiler maps them back to props.x
</script>
```

Two-way binding uses `defineModel()` (stable since 3.4), replacing the manual
`props`+`emit('update:x')` pair. Template DOM refs use `useTemplateRef('name')` (3.5), not a
manually-named `ref`.

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
const model = defineModel<string>()          // parent: <Comp v-model="x" />
const input = useTemplateRef('inputEl')       // <input ref="inputEl">
</script>
```

### Bad → Good: do not destructure a `reactive()`

```vue
<script setup lang="ts">
import { reactive, toRefs } from 'vue'
const state = reactive({ name: 'a', age: 1 })

// Bad — `name` is a detached plain string; mutating state.name won't update it.
const { name } = state

// Good — keep the proxy, or toRefs to preserve reactivity per key.
const { name: nameRef } = toRefs(state)   // nameRef.value stays linked
// or just read state.name where you need it.
</script>
```

Deep reactivity, effect scope, advanced `provide/inject`, and render-function/JSX notes live in
[`references/reactivity.md`](references/reactivity.md).

## Components & composables

Type `defineProps`/`defineEmits` with generics, not the runtime object form — you get
compile-time checking for free:

```vue
<script setup lang="ts">
const props = defineProps<{ id: string; tags?: string[] }>()
const emit = defineEmits<{ select: [id: string]; close: [] }>()
defineExpose({ focus })   // only what a parent template-ref may call
</script>
```

Extract reusable logic into `composables/useX.ts` returning refs — **a composable, never a mixin**
(why: mixins merge invisibly and collide on names; composables are explicit and tree-shakeable).
No side effects at module scope (that runs once per server process and leaks across requests — see
state below). Use typed `provide`/`inject` with an `InjectionKey` for dependency injection down a
tree instead of prop-drilling.

## The data-fetching boundary (core)

This is where most Nuxt bugs live. Pick deliberately:

| API | Use it for | SSR behavior |
|---|---|---|
| `useFetch(url, opts)` | the common case — fetch a URL in a page/component | fetches **once on server**, transfers payload to client, no refetch on hydration |
| `useAsyncData(key, fn)` | wrap custom logic / multiple `$fetch` calls / a non-URL source | same once-then-transfer; you control the fn |
| `$fetch(url)` | inside event handlers, server routes, or after mount | a plain request; **NOT** for top-level `setup` data |

### Bad → Good: bare `$fetch` in setup double-fetches on SSR

```vue
<script setup lang="ts">
// Bad — runs on the server render AND again during client hydration (2× the API hit,
// possible mismatch). $fetch does not transfer a payload.
const product = await $fetch(`/api/products/${id}`)

// Good — one server fetch, payload serialized into the page, reused on hydration.
const { data: product, status, error, refresh } = await useAsyncData(
  `product:${id}`,                       // stable key → dedupe + shared ref across components
  () => $fetch(`/api/products/${id}`),
)
// equivalently for a plain URL: useFetch(`/api/products/${id}`, { key: `product:${id}` })
</script>
```

Key options: `key` (shared/deduped result — same key returns the same `data`/`error`/`status` ref,
auto-cleaned on last unmount), `lazy: true` (don't block navigation), `server: false` (client-only
fetch), `transform` (reshape before storing), `pick` (keep only listed fields — shrinks payload),
`watch`/reactive keys (a `ref`/`computed`/getter key refetches when it changes). Type the result
with `useFetch<T>()` / `useAsyncData<T>()`. In **Nuxt 4 the returned `data` is a `shallowRef`** —
replace the whole value, don't deep-mutate, to trigger updates. Nuxt 4.2 adds `AbortController`
signal support for request cancellation. Re-run with the returned `refresh()`, or invalidate
broadly with `refreshNuxtData(key)`.

Full option matrix, custom `$api` factory, optimistic UI, and error/pending patterns are in
[`references/data-and-state.md`](references/data-and-state.md).

## SSR-safe state

On the server one Node process serves many requests. A module-level `ref` is created **once** and
shared by every visitor — a textbook cross-request data leak.

| Approach | Per-request? | When |
|---|---|---|
| module-level `ref`/`reactive` | **NO — leaks across requests** | never for request data; fine only for true constants |
| `useState(key, init)` | yes — serialized after SSR, restored on hydration, shared by key | lightweight shared value |
| Pinia store (`@pinia/nuxt`) | yes — hydrated from Nuxt payload | structured state, actions, multiple consumers |

### Bad → Good: module `ref` → `useState`

```ts
// Bad — module scope: one instance for the whole server, shared between users.
import { ref } from 'vue'
export const user = ref(null)

// Good — per-request, hydration-safe, shared by key.
export const useUser = () => useState('user', () => null)
```

Pinia 3 (dropped Vue 2) with `@pinia/nuxt` auto-imports stores from `app/stores/`. Use the
**setup-store** form; SSR state hydrates from the payload automatically:

```ts
// app/stores/cart.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<Item[]>([])
  const count = computed(() => items.value.length)
  function add(i: Item) { items.value.push(i) }
  return { items, count, add }
})
```

## Hydration mismatches

A mismatch means the server-rendered HTML differs from the client's first render. Common causes:
`Date.now()`/`new Date()`/`Math.random()` in render, reading `localStorage`/`window`/`document` in
`setup`, locale/timezone differences, invalid HTML nesting (`<p>` wrapping a `<div>`), and
non-deterministic iteration order.

Fix kit: wrap genuinely client-only UI in `<ClientOnly>`; branch with `import.meta.client` /
`import.meta.server`; do browser work in `onMounted` (never in `setup` body); and pin a
server-generated value with `useState` so the client reuses the exact same value instead of
recomputing it.

```vue
<template>
  <ClientOnly><LiveClock /></ClientOnly>
</template>
<script setup lang="ts">
const seed = useState('seed', () => Math.random())   // generated once on server, reused on client
onMounted(() => { /* safe: window/localStorage here */ })
</script>
```

## Nitro server routes

Files in `server/api/*` and `server/routes/*` run on Nitro (Nuxt's server engine). Name by method
with `.get.ts`/`.post.ts`. Validate input; throw `createError` for HTTP errors.

```ts
// server/api/products/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { fields } = getQuery(event)
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const config = useRuntimeConfig()              // private keys server-only
  const data = await fetchFromDb(id, config.dbUrl)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return data
})
```

`useRuntimeConfig()` exposes top-level keys **only on the server**; only `config.public.*` reaches
the browser bundle. Rule: a secret in `runtimeConfig.public` (or any `NUXT_PUBLIC_*` env) ships to
every client — keep API keys, DB URLs, and tokens at the top level, never under `public`. Type
calls to your own API with `$fetch<ProductDto>('/api/...')`. Handlers, route-rule recipes,
middleware, and `defineCachedEventHandler` caching live in
[`references/nitro-and-rendering.md`](references/nitro-and-rendering.md).

## Rendering strategy

Set per-route rendering in `nuxt.config.ts` with `routeRules`; the right mix is usually hybrid,
not all-SSR.

```ts
export default defineNuxtConfig({
  routeRules: {
    '/':            { prerender: true },             // SSG at build
    '/blog/**':     { swr: 3600 },                   // stale-while-revalidate cache 1h
    '/products/**': { isr: true },                   // incremental static regeneration
    '/admin/**':    { ssr: false },                  // client-only SPA island
    '/old':         { redirect: '/new' },
    '/api/**':      { headers: { 'cache-control': 's-maxage=60' } },
  },
})
```

`nuxt build` produces an SSR server; `nuxt generate` prerenders a fully static site. The **Nitro
preset** chooses the deploy target (node-server, vercel, netlify, cloudflare-pages, …) — pick the
preset here, then hand platform specifics to [`deployment`](../deployment/SKILL.md),
[`vercel`](../vercel/SKILL.md), [`netlify`](../netlify/SKILL.md), or
[`cloudflare`](../cloudflare/SKILL.md).

## Performance

- `shallowRef`/`shallowReactive` for large payloads/lists — skip deep proxy cost; replace the whole
  value to update. Why: deep reactivity on a 10k-row array is pure overhead.
- `v-memo` to freeze a subtree on stable deps; `v-once` for render-once static content.
- `defineAsyncComponent` and Nuxt's auto `Lazy<Component>` prefix to code-split below the fold.
- `<NuxtImg>` / `@nuxt/image` for responsive, optimized images (a top LCP lever).
- Shrink the SSR payload with `pick`/`transform` on `useFetch`/`useAsyncData`.
- Vue 3.6 **Vapor Mode** (compile-time, no-VDOM, opt-in per component via `<script setup vapor>`) is
  a 2026 preview targeting mid-2026 stable — treat as opt-in, not the default.
- Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms.

## Anti-patterns → STOP

| Smell | Why it is wrong | Do instead |
|---|---|---|
| `await $fetch()` for page data in `setup` | runs on server AND client → double API hit, mismatch | `useAsyncData(key, () => $fetch(...))` / `useFetch` |
| Module-level `ref`/`reactive` for shared state | one instance per server process → leaks across requests | `useState(key, init)` or a Pinia store |
| `window`/`localStorage`/`document` in `setup` body | undefined on server → hydration mismatch | `onMounted`, `import.meta.client`, or `<ClientOnly>` |
| Treating Nuxt like Next RSC ("use server", server components) | Vue has no RSC boundary; whole component renders + hydrates | model it as SSR + client hydration |
| Destructuring a `reactive()` object | detaches the value from the proxy → loses reactivity | `toRefs()`, or read `state.x`, or prefer `ref` |
| Secret in `runtimeConfig.public` / `NUXT_PUBLIC_*` | shipped into the client bundle | top-level `runtimeConfig`, server-only |
| `useFetch`/`useState` in a plain-Vue (non-Nuxt) app | those auto-imports don't exist there | client `fetch` in `onMounted` + Pinia/`provide` |
| `<ClientOnly>` wrapping everything to "fix" mismatches | kills SSR, hurts SEO/LCP, hides the real bug | find the non-deterministic source; pin with `useState` |
| Same fetch in two components without a shared `key` | duplicate requests, divergent refs | one stable `key` → shared deduped result |
| `ref(hugeArray)` / deep `reactive` on big lists | per-element proxy overhead | `shallowRef`/`shallowReactive`, replace whole value |

## Verify

`scripts/verify.sh` runs from the project root. With a `nuxt.config.{ts,js,mjs}` it runs `nuxi
typecheck` (fallback `vue-tsc --noEmit`), the package `lint` script if present, `vitest run` if
Vitest is present, then `nuxi build`; with no Nuxt config, `vue-tsc --noEmit`, lint, vitest, then
`vite build`. Keep `strict: true` in tsconfig so the typecheck is worth running. Every missing tool
is a yellow SKIP, never a failure; everything is read-only except the final build, which writes
`.nuxt/`/`.output/` (or `dist/`). No installs, no network mutations, safe to re-run, exits 0 on a
clean/empty target.

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), read
`02-DOCS/wiki/stack/vue-nuxt.md` first and stay consistent with it. If it is missing or stale,
create/update it with this app's real choices — rendering mode per route (`routeRules`), the
`useFetch`/`useAsyncData` conventions, `useState` vs Pinia, the Nitro preset/deploy target, the
design-system hookup — bump its `Updated` date, and link it from a `## Knowledge map` section in
the root `CLAUDE.md` (creating that section, and `CLAUDE.md` itself, if absent). No `02-DOCS/`
layer? Skip silently. Technical conventions are *recorded, not gated* — never block the task.

Nuxt 3 → 4 deltas (`app/` move, `compatibilityVersion`, shared-key data, shallowRef payload,
renamed APIs) and Vue 3.4 → 3.5 changes are in
[`references/migration-nuxt4.md`](references/migration-nuxt4.md).
