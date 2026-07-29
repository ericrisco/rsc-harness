---
name: phoenix
description: "Use when building an Elixir web app with Phoenix — contexts, Ecto schemas, changesets and migrations, LiveView, channels and PubSub, the generators, and the boundary between domain logic and the web layer. Covers the classic LiveView over-rendering and Ecto N+1 traps. NOT pure OTP work with no web or Ecto layer — GenServers, supervision trees, releases (that is `elixir`)."
tags: [phoenix, elixir, liveview, ecto, channels, contexts, web, beam]
recommends: [elixir, postgresdb, docker]
origin: risco
---

# Phoenix

You are building a web application on the BEAM with Phoenix. There is one mental model that keeps a Phoenix app coherent as it grows: **contexts are the public API of your domain; the web layer (controllers, LiveViews, channels) is a thin caller of contexts.** A LiveView that reaches into `Repo` directly, or a controller stuffed with business rules, is the first crack. Push logic down into a context function and the web layer stays a presentation shell you can swap (HTML → JSON → LiveView) without rewriting the domain.

Target the current stack: **Phoenix 1.8.7** (1.8.0 shipped 2025-08-05), **LiveView 1.1** (1.1.x patch line; 1.0 shipped 2024-12-03), **Ecto** as the data layer, **Erlang/OTP 25+**. The headline 1.8 change is **scopes**: generators thread the current actor (user/org) through every context function and into the query, so *secure-by-default data access is the norm, not something you bolt on later*. New apps ship daisyUI + Tailwind theming, a single root layout, and an `AGENTS.md` for LLM-assisted work.

If the question has no web, Ecto or LiveView in it — it is a GenServer, a supervision tree, a `mix release` — that is the runtime, route to `../elixir/SKILL.md`.

## Where does this code go — generator decision

Pick the layer first, then the generator. Getting this wrong means rewriting the boundary later.

| You are building | Use | Generator |
|---|---|---|
| Stateless page or JSON endpoint, request→response | Controller + view | `mix phx.gen.html` / `phx.gen.json` |
| Stateful interactive UI, server-rendered, live updates | LiveView | `mix phx.gen.live` |
| Raw bidirectional WebSocket / fan-out to many clients | Channel + PubSub | hand-wire, no generator |
| Domain logic with no UI yet (just the boundary) | Context only | `mix phx.gen.context` |
| Login, sessions, password reset, scopes | Auth scaffold | `mix phx.gen.auth` |

Rule: **generate the context first, then the web layer on top of it.** `phx.gen.live` and `phx.gen.html` already produce a context — don't hand-write a controller that calls `Repo` and skip the context.

## Contexts — the domain boundary

A context is a module like `Accounts`, `Catalog`, `Orders` that owns a slice of the domain. The web layer calls `Catalog.list_products(scope)`; it never calls `Repo` and never builds an `Ecto.Query`.

Rule: **the public contract is plain data and functions, not Ecto schemas.** Schemas are an implementation detail. Leak them and every caller couples to your column names. Why: you can refactor the table without touching controllers.

Rule: **thread the scope through every context function** (1.8). The scope carries the current actor; the context filters every query by it. Why: a forgotten `where: user_id ==` is a data leak — scoping makes the safe path the default path.

```elixir
# Bad — Repo + business logic in the controller, no scope, anyone reads anyone's data.
def index(conn, _params) do
  products = Repo.all(Product)            # raw Repo in web layer
  render(conn, :index, products: products)
end

# Good — controller calls a context function that takes the scope.
def index(conn, _params) do
  products = Catalog.list_products(conn.assigns.current_scope)
  render(conn, :index, products: products)
end

# In lib/my_app/catalog.ex — the boundary owns the query and the scope filter.
def list_products(%Scope{} = scope) do
  Product
  |> where(org_id: ^scope.org.id)         # secure by default
  |> Repo.all()
end
```

Depth on defining and threading scopes, magic-link auth, sudo mode and query-level enforcement lives in `references/auth-and-scopes.md`.

## Ecto — the data layer

Ecto gives you `Repo`, schemas, `Ecto.Changeset` (cast + validate), `Ecto.Multi` (transactional pipelines) and `Ecto.Query`.

Rule: **validate at the boundary with a changeset, never with `try/rescue`.** A changeset casts external params, applies validations and constraints, and hands you `{:ok, struct}` or `{:error, changeset}` you can render straight into a form. Why: validation errors are expected data flow, not exceptions.

Rule: **multi-write operations go through `Ecto.Multi`** so they commit or roll back as a unit. Why: a half-written order with no payment row is corruption.

Rule: **preload associations — never trigger a query per row.** Why: the N+1 is the single most common Phoenix performance bug.

```elixir
# Bad — N+1: each post in the loop fires a separate query for post.author.
posts = Repo.all(Post)
for post <- posts, do: post.author.name   # one SELECT per post

# Good — one query for posts, one for all authors.
posts = Post |> preload(:author) |> Repo.all()
for post <- posts, do: post.author.name
```

Migrations are forward-only facts about schema history — write a new one, don't edit a shipped migration. Changeset recipes, `Ecto.Multi`, advanced queries/preloads, constraints and sandbox config are in `references/ecto-patterns.md`.

## LiveView — stateful server-rendered UI

A LiveView holds state in `socket.assigns`, renders HEEx, and reacts to events. The lifecycle:

| Callback | Fires when | Use it for |
|---|---|---|
| `mount/3` | First connect (and the dead render) | Load initial data, set up subscriptions |
| `handle_params/3` | Mount and every live patch | React to URL/query changes |
| `handle_event/3` | A client event (`phx-click`, form submit) | Mutate state, call a context |
| `handle_info/2` | A message arrives (PubSub, `send/2`) | Apply external/async updates |

Rule: **use streams for collections — do not hold the full list in an assign.** A stream keeps the list off the socket; `stream_insert/3` of one item sends only that item over the wire. Why: assigning the whole list re-sends and re-diffs every row on every change — that is exactly the "re-renders the entire list when one row is added" symptom. For per-row change tracking wrap each entry in a LiveComponent.

```elixir
# Bad — full list in assigns; one insert re-diffs the entire collection.
def mount(_p, _s, socket), do: {:ok, assign(socket, :messages, Chat.list_messages())}
def handle_info({:new, msg}, socket) do
  {:noreply, assign(socket, :messages, socket.assigns.messages ++ [msg])}
end

# Good — stream; only the new row crosses the wire.
def mount(_p, _s, socket), do: {:ok, stream(socket, :messages, Chat.list_messages())}
def handle_info({:new, msg}, socket), do: {:noreply, stream_insert(socket, :messages, msg)}
```

```heex
<div id="messages" phx-update="stream">
  <div :for={{dom_id, msg} <- @streams.messages} id={dom_id}>{msg.body}</div>
</div>
```

Build forms with `to_form/2` (carry the changeset, render errors). Route with **verified routes** — the `~p` sigil (`~p"/products/#{product}"`) is compile-checked, the default since 1.7. LiveView 1.1 adds **colocated hooks** (`<script :type={Phoenix.LiveView.ColocatedHook} name="...">`, extracted at compile time, requires Phoenix 1.8+), ColocatedJS, official TypeScript types for the JS client, and keyed comprehensions. Full lifecycle, streams + LiveComponent change tracking, forms/uploads, JS commands, colocated hooks and `assign_async` are in `references/liveview.md`.

## Channels & PubSub — real-time fan-out

Reach for a **channel** when you need raw bidirectional WebSocket messaging or to broadcast to many clients (chat fan-out, presence, live dashboards feeding many sockets). Reach for **LiveView** when one user drives a server-rendered UI — most "real-time" UI is just LiveView + `Phoenix.PubSub`.

```elixir
Phoenix.PubSub.subscribe(MyApp.PubSub, "room:42")   # in mount/3
Phoenix.PubSub.broadcast(MyApp.PubSub, "room:42", {:new, msg})  # from a context
```

`Phoenix.Presence` tracks who is online on a topic. Keep channel callbacks thin — they call contexts too.

## Auth & scopes

`mix phx.gen.auth` in 1.8 **defaults to magic-link (passwordless) auth**, with a re-auth "sudo mode" plug for sensitive operations; email+password is still available. It also sets up the **default scope** that generators thread through contexts. Treat scope-based filtering as the authorization layer: the query never returns rows the scope can't see, so authz is enforced in the data access, not in a forgotten `if`. Flow, sudo mode, custom scopes and testing authz are in `references/auth-and-scopes.md`.

## Testing — test at the right layer

| Test target | Helper | Isolation |
|---|---|---|
| Controllers / JSON | `Phoenix.ConnTest` via `ConnCase` | SQL sandbox |
| Context / Ecto logic | `DataCase` | SQL sandbox |
| LiveView UI | `Phoenix.LiveViewTest` (`live/2`, `render_click`, `element/2`) | SQL sandbox |
| Concurrent DB tests | `Ecto.Adapters.SQL.Sandbox` | per-test transaction |

Rule: **test domain rules at the context (DataCase), test interaction at the LiveView (LiveViewTest).** Why: a context test that drives the UI is slow and brittle; a LiveView test that re-asserts every validation rule duplicates the context test.

```elixir
test "creating a product shows it in the list", %{conn: conn} do
  {:ok, view, _html} = live(conn, ~p"/products")
  view |> form("#product-form", product: %{name: "Widget"}) |> render_submit()
  assert render(view) =~ "Widget"
end
```

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `Repo.all/insert` called from a controller or LiveView | Web layer couples to the DB; logic can't be reused or tested in isolation | Call a context function; keep `Repo` inside the context |
| Returning Ecto schemas as the public contract | Callers couple to column names; refactors ripple outward | Expose functions over plain data; schemas stay internal |
| Holding the full collection in `socket.assigns` | Every insert re-sends and re-diffs the whole list (lag, bandwidth) | `stream/3` + `stream_insert/3`; LiveComponent for per-row tracking |
| `try/rescue` around persistence to "validate" | Hides expected errors as exceptions; no field-level messages | `Ecto.Changeset` → `{:ok, _}` / `{:error, changeset}` |
| Looping over records touching an association | N+1 — one query per row | `preload/2` (or a join) before the loop |
| Forgetting to filter a query by the scope | Cross-tenant data leak — the worst kind of bug | Thread `scope` through every context fn; filter in the query |
| Multi-write without a transaction | Partial writes leave corrupt state | `Ecto.Multi`, commit or roll back as one |
| Fat schema modules full of business logic | Domain rules scatter; the boundary blurs | Logic lives in the context; schema holds fields + changeset |
| Hardcoded path strings in templates | Breaks silently when routes change | Verified routes — the `~p` sigil, compile-checked |

## See also

- `../elixir/SKILL.md` — OTP, GenServers, supervision trees, the runtime Phoenix builds on.
- `../postgresdb/SKILL.md` — raw SQL tuning, index design and DB ops below the Ecto line.
- `references/liveview.md`, `references/ecto-patterns.md`, `references/auth-and-scopes.md` — branch-specific depth.
