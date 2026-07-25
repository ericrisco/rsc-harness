---
name: react
description: "Use when building or reviewing a client-side React SPA bundled by Vite (React 19.2): components, where state lives, hooks, server data fetching, client routing, re-render and effect bugs. NOT App Router / server components / SSR (that is `nextjs`); NOT native screens (that is `react-native`)."
tags: [react, vite, spa, frontend, hooks, tanstack-query]
recommends: [typescript, design, testing-web]
origin: risco
---

# React + Vite SPA — Components, State, Data Fetching (React 19.2, 2026)

> Build or review a fast, typed, correctly-architected **client-side** React single-page app bundled by Vite. No server runtime, no RSC tree, no framework router. Server-rendered React (App Router, server actions, SSR/SSG) is not this skill — that is `../nextjs/SKILL.md`.

**SDD gate — before writing feature code.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, stop and hand off to `../specify/SKILL.md`: it runs brainstorm → spec → plan → tasks, then routes back here once the plan is approved. Build directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

## First: confirm it's a Vite SPA, not a framework

Read `package.json` before giving any advice — it stops you applying SSR/RSC patterns to a client SPA.

| Signal in package.json                | Read it as            | Where                  |
| ------------------------------------- | --------------------- | ---------------------- |
| `vite` + `react`, no `next`           | Vite SPA              | here                   |
| `next`                                | metaframework / RSC   | `../nextjs/SKILL.md`   |
| `@react-router/dev`                   | RR framework mode/SSR (Remix successor) | `../nextjs/SKILL.md`-shape |
| `react-router` only                   | RR library mode       | here (Routing)         |
| `expo` / `react-native`               | native                | `../react-native/SKILL.md` |

Then pick the data layer (**TanStack Query**, always) and the router (React Router v7 library mode *or* TanStack Router).

Adjacent jobs route out: the type system itself (generics, discriminated unions, `tsconfig` theory) with no React shape → `../typescript/SKILL.md`; visual design, tokens, spacing, button states → `../design/SKILL.md`; writing the Vitest/RTL or E2E suite as the task → `../testing-web/SKILL.md`; hosting the built `dist/` → `../deployment/SKILL.md`.

## Component & state architecture

- **Colocate state** next to where it's used; only **lift** when two siblings must share it. Lifting earlier than needed is the #1 cause of re-render spread.
- **Derive, don't duplicate.** If a value is computable from props/state, compute it in render — never mirror it into another `useState` synced by an effect.
- **Context for low-frequency, wide values** (theme, current user, locale). It re-renders every consumer on every change.
- **External store (Zustand) for high-frequency global state** read by many components; subscribe with **narrow selectors** so only readers of a slice re-render.
- **URL is state too.** Filters, tabs, pagination belong in search params so they're shareable and survive reload.

| Where does this state live?            | Trigger                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| Local `useState`/`useReducer`          | only one component cares                                       |
| Lifted to nearest common parent        | a few siblings share it                                       |
| URL search params                       | it should be shareable / bookmarkable / survive reload         |
| Context                                 | wide read, **low** write frequency (theme, auth user)          |
| External store (Zustand) + selectors    | wide read, **high** write frequency, or deep prop-drilling     |
| TanStack Query cache                    | it's **server** data (anything fetched)                        |

```tsx
// Bad: syncing a derived value into state with an effect → stale + extra render
const [fullName, setFullName] = useState("");
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// Good: derive in render
const fullName = `${first} ${last}`;
```

## Hooks discipline (React 19.2)

- `useState` for one or two independent values; `useReducer` when the next state depends on the previous one or several fields move together.
- **The `useEffect` rule:** effects exist to *synchronize with a non-React external system* (a subscription, a DOM node, a non-React widget). They are **not** for transforming data and **not** for fetching server data. If you can compute it in render or in an event handler, do that instead.
- **`useEffectEvent`** (stable in 19.2): extract the non-reactive part of an effect so it reads the latest props/state without being a dependency. Fixes the stale-closure / over-firing class of effect bug.

```tsx
// Effect re-subscribes only when roomId changes, but still logs the latest theme.
const onConnected = useEffectEvent(() => log("connected", theme));
useEffect(() => {
  const c = connect(roomId);
  c.on("open", onConnected);
  return () => c.close();
}, [roomId]); // theme is NOT a dependency
```

- **`use(promise)`** reads a promise during render under `<Suspense>` + an error boundary. The promise **must** come from a cache (TanStack Query, a stable module cache) — never created inline, or you make a new promise every render and suspend forever.

```tsx
// Bad: new promise each render → infinite suspense loop
function Profile({ id }: { id: string }) {
  const user = use(fetch(`/api/users/${id}`).then(r => r.json())); // ❌
}
// Good: the promise is owned by a cache (useSuspenseQuery, below)
```

- **`useTransition` / `useDeferredValue`** keep the UI responsive: mark a slow state update non-urgent so typing/clicks stay live.
- **`ref` is a plain prop** in React 19 — no `forwardRef`. The provider is `<Context value={...}>` (no `.Provider`). Refs may return a cleanup function.

## Data fetching — TanStack Query, not useEffect (the headline rule)

Fetching server data in `useEffect` gives you waterfalls, race conditions, no caching, no dedupe, and double-fires under Strict Mode. Use **TanStack Query v5** for *all* server state.

```tsx
// Bad: the effect-as-fetch anti-pattern — races, no cache, refetches on every mount
const [user, setUser] = useState<User | null>(null);
useEffect(() => {
  fetch(`/api/users/${id}`).then(r => r.json()).then(setUser); // ❌ stale id, race, no error/loading
}, [id]);

// Good
const { data: user, isPending, isError } = useQuery({
  queryKey: ["user", id],          // identity + cache key + dedupe
  queryFn: () => getUser(id),       // typed fetcher
  staleTime: 60_000,                // 1 min "fresh" → no needless refetch
});
```

- **Mutations** invalidate the cache so reads refetch:

```tsx
const qc = useQueryClient();
const remove = useMutation({
  mutationFn: deleteUser,
  onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
});
```

- **`useSuspenseQuery`** + `<Suspense fallback>` + an error boundary moves loading/error out of the component body and is the correct source for `use()`-style reads.
- **Optimistic delete**: `onMutate` snapshots + writes the expected state, `onError` rolls back, `onSettled` invalidates.
- Query-key factory, `invalidateQueries` vs `setQueryData`, infinite queries, prefetch, Zustand store + selectors, the full Bad→Good set → `references/data-and-state.md`.

## Routing (client-side)

**React Router v7 — library mode** is the default SPA router:

```tsx
const router = createBrowserRouter([
  { path: "/", element: <Layout />, children: [
    { index: true, element: <Home /> },
    { path: "users/:id", lazy: () => import("./routes/user") }, // code-split route
  ]},
]);
// <RouterProvider router={router} />
```

- Use **lazy routes** so each route is its own chunk.
- **TanStack Router** is the type-safe alternative — fully typed params/search, first-class loaders. Pick it when route/search typing matters.
- `@react-router/dev` **framework mode** is SSR → treat like nextjs, out of scope.
- Nested/lazy routes, client loaders, protected-route wrapper, `useSearchParams`-as-state → `references/routing.md`.

## Performance

**Measure first** with the React DevTools Profiler — guessing wastes effort. Then:

- **Correct `key`**: a stable id, never the array index when the list can reorder/insert/delete (index keys leak state and update the wrong row — see anti-patterns).
- **Virtualize** lists past ~50–100 rows with `@tanstack/react-virtual`.
- **Code-split** routes and heavy components with `lazy()` + `<Suspense>`; Vite splits automatically on dynamic `import()`.
- **React Compiler on** ⇒ delete manual `useMemo`/`useCallback`/`React.memo` — it auto-memoizes; leaving them in is dead noise.
- **Narrow store selectors** so a slice change doesn't re-render the whole subtree.
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1. Profiler workflow, React Compiler Vite setup, bundle analysis, re-render map → `references/performance.md`.

## TypeScript + Vite project setup

- Type props explicitly; no `any`. Turn on `strict` and `noUncheckedIndexedAccess` so `arr[i]` is `T | undefined`.
- **Env & the secret-leak warning:** only `VITE_`-prefixed vars reach the client via `import.meta.env.VITE_*` — and **everything `VITE_` ships in the browser bundle**. A `VITE_API_SECRET` is public. Proxy real secrets through a backend.
- Declare custom env vars in `vite-env.d.ts`.
- Define path aliases in **both** `vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`paths`) or imports break in one place.
- `vite build` emits `dist/` — the deployable artifact. Deep types → `../typescript/SKILL.md`.

## Anti-patterns → STOP

| Anti-pattern                                          | Reality                                                                 | Do instead                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| "Fetch in `useEffect`, it's simpler"                  | Waterfalls, races, double-fire, no cache/dedupe                          | `useQuery` / `useSuspenseQuery`                     |
| "Create the promise inline for `use()`"               | New promise every render → suspends forever                              | Promise owned by a cache (TanStack Query)           |
| "Index as `key`, the list looks fine"                 | On reorder/delete, state sticks to the wrong row, list flickers          | Stable id as `key`                                  |
| "Put it in context so anyone can read it"             | High-write context re-renders the whole consumer tree                    | Zustand + narrow selector                           |
| "Sync the prop into state with an effect"             | Duplicated, stale state + an extra render                                | Derive in render, or `key` to reset a subtree       |
| "`useMemo`/`useCallback` everywhere for speed"        | Noise; with React Compiler it's redundant                                | Measure first; let the compiler memoize             |
| "`VITE_API_SECRET` is fine, it's an env var"          | It ships in the browser bundle — fully public                            | Proxy the secret through a backend                  |
| "`useEffect` to compute a derived value"              | Extra render + a stale window                                            | Recompute in render                                 |

## Verify

`scripts/verify.sh` runs from the project root: **ESLint → `tsc --noEmit` → Vitest → `vite build`**, in that order. Each tool is detected and **skipped with a warning (never a failure) if absent**. The final `vite build` writes `dist/`; the lint/type/test steps are read-only. No installs, no network mutations, safe to re-run. It exits non-zero only on a real tool failure, and exits 0 on a clean/empty target.

## Project grounding (02-DOCS)

If the workspace has `02-DOCS/`, record stack-specific React conventions (chosen router, store, query defaults) in `02-DOCS/wiki/stack/react.md` and index it from `CLAUDE.md`. Recorded, not gated — skip silently if there is no `02-DOCS/`.
