# @solidjs/router & SolidStart

## @solidjs/router

The official router. Routes are components; params and location are reactive.

```tsx
import { Router, Route, A, useParams, useNavigate, useSearchParams } from "@solidjs/router";

function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserPage} />
      <Route path="/users/:id/posts/:postId" component={Post} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
```

Reactive params and navigation:

```tsx
const params = useParams();          // params.id is reactive — read it inside JSX/effects
const navigate = useNavigate();
navigate(`/users/${id}`, { replace: true });
const [search, setSearch] = useSearchParams();
setSearch({ page: "2" });
```

Always use `<A href="…">` for in-app links (client-side navigation, active class
support). A raw `<a>` triggers a full page reload.

### Data loading

`@solidjs/router` exposes a `load` function per route plus `query` for cached,
dedup'd reads. The loader runs before/parallel to rendering so data is ready when
the component mounts.

```tsx
import { query, createAsync } from "@solidjs/router";

const getUser = query(async (id: string) => fetchUser(id), "user");

function UserPage() {
  const params = useParams();
  const user = createAsync(() => getUser(params.id));   // suspends until resolved
  return <Suspense fallback={<Spinner />}><h1>{user()?.name}</h1></Suspense>;
}
```

Nested layouts: a parent `<Route>` with a `component` that renders `props.children`
wraps its child routes; the `root` prop on `<Router>` is the app-wide shell.

## SolidStart (1.x stable)

The meta-framework on top of Solid + `@solidjs/router` + Vite. Use it for SSR,
file-based routing, and server functions. This skill is reactivity-first — SolidStart
is the SSR/routing host, not the center of gravity.

- **File routing**: files under `src/routes/` map to URLs. `src/routes/users/[id].tsx`
  → `/users/:id`. `(group)` folders organize without affecting the path.
- **Server functions**: a function marked `"use server"` runs only on the server;
  the client calls it over RPC. Compose with router `query`/`action` for reads/mutations.

```tsx
// src/routes/todos.tsx
import { query, action, createAsync, useAction } from "@solidjs/router";

const getTodos = query(async () => {
  "use server";
  return db.todo.findMany();
}, "todos");

const addTodo = action(async (formData: FormData) => {
  "use server";
  await db.todo.create({ data: { title: String(formData.get("title")) } });
}, "addTodo");

export default function Todos() {
  const todos = createAsync(() => getTodos());
  const add = useAction(addTodo);
  // render with <Suspense>, submit via a <form action={addTodo}> or add(formData)
}
```

- **Deployment**: SolidStart uses Nitro-style adapters; for Vercel/Netlify/Node
  targets configure the adapter in `app.config.ts`. Deployment specifics →
  [`vercel`](../../vercel/SKILL.md).

Version note: SolidStart 1.x is the maintained stable line; **2.0.0-alpha** tracks
Solid 2.0. Default to 1.x unless the task targets the alpha.
