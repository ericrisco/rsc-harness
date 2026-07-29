---
name: solid-js
description: "Use when building, reviewing or debugging a SolidJS app — signals, stores, effects, memos and resources, and JSX that compiles to real DOM with no virtual DOM. Covers the classic traps: a signal that does not update the UI, For versus Index, effect loops, components that run once, and props losing reactivity when destructured. NOT React's re-render model (that is `react`)."
tags: [solidjs, signals, reactivity, frontend, jsx, web]
recommends: [vercel, testing-web, design]
origin: risco
---

# SolidJS — fine-grained reactivity, no VDOM

One rule governs everything else: **the component function runs ONCE.** Reactivity does not live in re-running the body — it lives in the *reads*. You read state by calling a getter (`count()`), and Solid re-runs only the exact DOM expression or effect that read it. There is no virtual DOM and no reconciliation; JSX compiles straight to DOM nodes. If you carry React habits here (destructuring props, expecting the body to re-run, deriving state in an effect), reactivity breaks silently — the code runs, it just stops updating.

Versions: **stable is `solid-js` 1.9.x** (1.9.11/1.9.13 line). **Solid 2.0 is in beta on the `next` npm tag** with a new reactive core (`@solidjs/signals`), `createAsync`, and automatic batching. Default to 1.9.x APIs unless the task says 2.0; flag the divergence where it matters.

## When to use / when not

| Situation | Skill |
|---|---|
| Solid signals/stores/effects/memos/resources, JSX-to-DOM, `<For>`/`<Index>` | **this skill** |
| React `useState`/hooks/re-render model (the body re-runs) | `react` |
| Next.js routing, server actions, RSC | `nextjs` |
| Svelte 5 `$state`/`$derived` runes (similar look, different compiler) | `svelte` |
| Vue/Nuxt `ref`/`reactive`/`computed` | `vue-nuxt` |
| Astro island architecture / what ships to the client (can host a Solid island) | `astro` |
| Plain TypeScript questions with no Solid surface | [`../typescript/SKILL.md`](../typescript/SKILL.md) |
| Deploying the built app (Vercel/SolidStart adapter) | [`../vercel/SKILL.md`](../vercel/SKILL.md) |

## The mental-model shift (read this first)

React re-runs the component body on every state change; Solid runs it once and re-runs only the tracked reads. So the value is the *call*, not the variable.

```tsx
// Bad — React reflex: treats `count` as a value, body assumed to re-run.
function Counter() {
  const [count, setCount] = createSignal(0);
  console.log("body ran");        // prints ONCE, ever
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
  //                                          ^ NaN: count is the getter fn, not a number
}

// Good — read by calling the getter; the JSX read is what re-runs.
function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
  //                                                      ^ tracked read
}
```

Why: the body is setup that runs once. Only getter reads inside JSX, effects, or memos are tracked and re-executed. `count` is the accessor function; `count()` is its current value.

## Signals — single reactive values

`createSignal(initial)` returns `[getter, setter]`. Read with `getter()`, write with `setter(next)` or `setter(prev => next)`.

```tsx
const [name, setName] = createSignal("Ada");
setName("Grace");          // replace
setName((n) => n + "!");   // update from previous
```

Derived state is just a function — no API needed:

```tsx
const [first, setFirst] = createSignal("Ada");
const [last, setLast]  = createSignal("Lovelace");
const fullName = () => `${first()} ${last()}`;   // re-reads on access, always fresh
```

Reach for `createMemo` only when the computation is **expensive or shared by many readers** — it caches and re-runs only when its dependencies change:

```tsx
const sorted = createMemo(() => [...items()].sort(byName));  // expensive: memoize
```

Rule: derive with a plain `() => …` by default; promote to `createMemo` for cost/sharing. Why: a memo adds a reactive node; a plain function is free and recomputes lazily on read.

## Props — the destructuring trap

Props are a reactive proxy. Destructuring or assigning `.x` reads the value **once at run-once time**, freezing it.

```tsx
// Bad — both snapshot a dead value; updates from the parent never arrive.
function Hi(props) { const { name } = props; return <p>{name}</p>; }
function Hi(props) { const name = props.name; return <p>{name}</p>; }

// Good — read inline, or wrap in an accessor to pass reactivity along.
function Hi(props) { return <p>{props.name}</p>; }
function Hi(props) { const name = () => props.name; return <p>{name()}</p>; }
```

To split or default props while keeping reactivity, use `splitProps` / `mergeProps` — never the spread/destructure idiom:

```tsx
import { splitProps, mergeProps } from "solid-js";

function Button(props) {
  const merged = mergeProps({ variant: "primary" }, props);   // reactive defaults
  const [local, rest] = splitProps(merged, ["variant", "children"]);
  return <button class={local.variant} {...rest}>{local.children}</button>;
}
```

Why: `splitProps`/`mergeProps` return proxies that preserve getter tracking; `{ ...props }` and `const { x } = props` collapse it to a one-time copy.

## Stores — nested object / array state

`createSignal` is for one value. Use `createStore` for nested objects or arrays so updates are **fine-grained per path** (only the components reading the changed leaf re-run), with no cloning of the whole tree.

```tsx
import { createStore, produce } from "solid-js/store";

const [state, setState] = createStore({ user: { name: "Ada" }, todos: [] });

setState("user", "name", "Grace");               // path update — only name readers re-run
setState("todos", (t) => [...t, { id: 1, done: false }]); // append
setState("todos", 0, "done", true);              // update one item field by index
setState(produce((s) => { s.todos[0].done = true; }));    // mutate-style, still fine-grained
```

```tsx
// Bad — replacing the whole object kills path-level reactivity and re-renders everything.
setState({ user: { name: "Grace" }, todos: state.todos });

// Good — target the path that changed.
setState("user", "name", "Grace");
```

Why: stores diff at the path you touch; whole-object replacement is a single coarse change that defeats the entire point of a store.

## Effects & lifecycle — side effects only

`createEffect` runs **after render** and re-runs when any signal it reads changes. It is for *side effects* (DOM, logging, subscriptions, network) — not for computing state.

```tsx
createEffect(() => {
  document.title = `Count: ${count()}`;   // side effect, tracks count()
});

onMount(() => {                            // runs once after first render
  const id = setInterval(tick, 1000);
  onCleanup(() => clearInterval(id));      // before re-run AND on disposal
});

batch(() => { setA(1); setB(2); });        // one update pass instead of two (1.x; auto in 2.0)
const snapshot = untrack(() => raw());     // read without subscribing
```

The signature anti-pattern — deriving state by writing a signal inside an effect — causes an infinite loop and is the most common "Solid is broken" report:

```tsx
// Bad — effect reads total(), writes total → re-triggers itself forever.
const [total, setTotal] = createSignal(0);
createEffect(() => setTotal(price() * qty()));

// Good — derive, don't store.
const total = createMemo(() => price() * qty());   // or: const total = () => price() * qty();
```

Why: an effect that writes one of its own dependencies is a feedback loop. Derived values are reads, not writes.

## Control flow — use Solid's primitives, not raw JS

Early `return`, bare `&&`, and `.map()` defeat tracking or leak falsy values. Use the components, which Solid can track and dispose precisely.

```tsx
<Show when={user()} fallback={<Login />}>{(u) => <Profile user={u()} />}</Show>
<Switch fallback={<NotFound />}>
  <Match when={state() === "loading"}><Spinner /></Match>
  <Match when={state() === "ready"}><Data /></Match>
</Switch>
<Dynamic component={tagFor(kind())} {...props} />
```

`<For>` vs `<Index>` is a real decision:

| Your list is… | Use | Why |
|---|---|---|
| Keyed objects that reorder/insert/remove | `<For each={items()}>{(item) => …}</For>` | keys by reference; DOM nodes **move**, not rebuild |
| Fixed-position rows, primitives, or inputs bound to the index | `<Index each={items()}>{(item) => … item() …}</Index>` | keys by position; `item` is an **accessor** (`item()`) |

```tsx
// Bad — <For> with index-bound inputs: nodes move on reorder, inputs desync.
<For each={fields()}>{(f, i) => <input value={f.value} onInput={(e) => setField(i(), e)} />}</For>

// Good — <Index> when the position is the identity.
<Index each={fields()}>{(f, i) => <input value={f().value} onInput={(e) => setField(i, e)} />}</Index>
```

Why: `<For>` tracks *which value* lives where (great for keyed data); `<Index>` tracks *what's at slot N* (great for fixed slots). Picking wrong rebuilds or desyncs nodes.

## Async — resources + Suspense

In **1.x** use `createResource`; in **2.0** the standard primitive is `createAsync`. Both surface loading/error through `<Suspense>` and `<ErrorBoundary>`.

```tsx
// 1.x
const [user] = createResource(userId, (id) => fetchUser(id));   // refetches when userId() changes

<ErrorBoundary fallback={(err) => <p>Failed: {err.message}</p>}>
  <Suspense fallback={<Spinner />}>
    <p>{user()?.name}</p>
  </Suspense>
</ErrorBoundary>
```

The 1.9→2.0 async migration (`createAsync`, automatic batching, `@solidjs/signals`) lives in [references/reactivity-deep-dive.md](references/reactivity-deep-dive.md).

## Project setup

```bash
npm create vite@latest my-app -- --template solid-ts   # Vite + vite-plugin-solid + TS
cd my-app && npm install && npm run dev
```

Routing with `@solidjs/router`:

```tsx
import { Router, Route, A } from "@solidjs/router";

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserPage} />
    </Router>
  );
}
// inside UserPage: const params = useParams(); params.id  (reactive)
// nav links use <A href="…"> (not raw <a>) for client-side routing
```

For SSR, file-based routing, and server functions (`"use server"`, `query`/`action`), reach for **SolidStart** (1.x stable; 2.0.0-alpha tracks Solid 2.0). The full router + SolidStart map is in [references/router-and-start.md](references/router-and-start.md). Deploying the build → [`../vercel/SKILL.md`](../vercel/SKILL.md).

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| `const { x } = props` / `const x = props.x` | snapshots a non-reactive value at run-once | read `props.x` inline or `const x = () => props.x` |
| Reading `count` instead of `count()` | passes the accessor function, not the value | call it: `count()` |
| Expecting the component body to re-run | it runs once; only tracked reads re-run | move reactive work into JSX / effect / memo |
| Deriving state via `createEffect` that sets a signal | feedback loop / stale order | `createMemo` or a plain `() => …` |
| `<For>` for index-bound inputs | nodes move on reorder, inputs desync | `<Index>` (keyed by position, `item()`) |
| `setStore(wholeNewObject)` | one coarse change defeats fine-grained paths | `setStore("path", …, value)` / `produce` |
| Early `return null` / `cond && <X/>` for conditionals | leaks falsy values, escapes tracking | `<Show when={…} fallback={…}>` / `<Switch>` |
| `{...props}` to forward reactively | spread copies once, drops getters | `splitProps` / `mergeProps` |

## Verify

If the project emits Solid components/JSX/config, run the gate:

```bash
bash scripts/verify.sh
```

It detects the package runner from the lockfile, then runs `tsc --noEmit` → ESLint → Vitest → `vite build`. Missing tools are SKIPPED (yellow), not failed; it exits non-zero only on a real failure.

## References

- [references/reactivity-deep-dive.md](references/reactivity-deep-dive.md) — ownership & disposal, `createRoot`/`getOwner`/`runWithOwner`, `on()` explicit deps, `createComputed`/`createRenderEffect`, `createSelector`, store `reconcile`/`produce`, and the 1.9→2.0 migration.
- [references/router-and-start.md](references/router-and-start.md) — full `@solidjs/router` surface (params, data loading, navigation, nested layouts) and a concise SolidStart 1.x map.
