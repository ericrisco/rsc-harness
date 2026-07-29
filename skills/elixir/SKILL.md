---
name: elixir
description: "Use when writing or refactoring Elixir/OTP on the BEAM — GenServers, supervision trees and restart strategies, pattern matching, mix projects and releases — or when processes misbehave (restart loops, mailbox growth, call timeouts). NOT a Phoenix web app, LiveView, Ecto or channels (that is `phoenix`)."
tags: [elixir, otp, genserver, supervision, beam, mix, concurrency, functional]
recommends: [phoenix, postgresdb, docker]
origin: risco
---

# Elixir

You are writing Elixir on the BEAM. The runtime gives you cheap isolated processes, preemptive scheduling, and supervision. The single mental shift that separates idiomatic Elixir from ported imperative code: **let it crash and supervise it, do not defend every call**. A process that hits an impossible state should die and be restarted clean by its supervisor — that is more correct than a `try/rescue` that limps on with corrupt state.

Default to **pure functions**. Most of your code is data transformation and needs no process at all. Reach for a process only when you need state, concurrency, or fault isolation. Target Elixir **v1.19.5** (stable, requires Erlang/OTP 28.1+) or **v1.20-rc** (full type inference, OTP 27+/29). Use the modern stdlib: built-in `JSON`, set-theoretic type warnings, `mix format`.

## Decision: do you even need a process?

A process is not "an object": spawning one to hold a value you could pass as an argument is the most common beginner mistake, and it adds a serialization bottleneck and a failure mode for nothing.

| Situation | Use | Why |
|---|---|---|
| Pure transform of input -> output | plain function / module | No state, no concurrency: a process only adds overhead and a mailbox |
| Hold mutable state behind an API | `GenServer` (or `Agent` for trivial state) | Serializes access, owns a lifecycle, supervisable |
| Run N independent jobs concurrently | `Task.async_stream` / `Task.Supervisor` | Bounded fan-out, results collected, crashes isolated |
| Isolate a risky/external boundary | a supervised process | A crash there restarts clean without taking down callers |
| Shared read-heavy cache | `:ets` table | Concurrent lock-free reads, no single-process bottleneck |

Rule: if two pieces of code never run at the same time and share no mutable state, they are functions, not processes.

## The functional core

**Match in function heads, not with `if`** — branches become exhaustive and self-documenting, and a non-match crashes loudly instead of silently falling through.

```elixir
# Bad - imperative branching, easy to miss a case
def area(shape) do
  if shape.type == :circle do
    :math.pi() * shape.r * shape.r
  else
    shape.w * shape.h
  end
end

# Good - one clause per shape, unmatched input crashes (which a supervisor handles)
def area(%Circle{r: r}), do: :math.pi() * r * r
def area(%Rect{w: w, h: h}), do: w * h
```

**Return tagged tuples `{:ok, value}` / `{:error, reason}`** — the caller pattern-matches the outcome; this is the protocol the whole ecosystem speaks.

```elixir
# Good
def fetch(id) do
  case Repo.get(id) do
    nil -> {:error, :not_found}
    record -> {:ok, record}
  end
end
```

**Chain fallible steps with `with`** — it reads as the happy path and short-circuits on the first non-match, no nested `case` pyramids.

```elixir
# Good - any step returning a non-{:ok, _} falls straight to else
with {:ok, user} <- fetch_user(id),
     {:ok, acct} <- fetch_account(user),
     :ok <- authorize(acct) do
  {:ok, acct}
else
  {:error, reason} -> {:error, reason}
end
```

**Use guards to constrain clauses** (`when is_integer(n) and n > 0`) — keeps validation declarative and lets the compiler reason about types.

**Pipe left-to-right for data flowing through transforms** — `data |> step1() |> step2()`. Do not pipe just to avoid an intermediate variable; if a step needs the value in a non-first argument, name it.

**There is no mutation.** Rebinding `x = f(x)` makes a new binding; data you passed elsewhere is unchanged. Stop reaching for mutable accumulators — use `Enum.reduce/3`, comprehensions, or recursion.

## Processes and message passing

Raw `spawn`/`send`/`receive` exists and is fine for a throwaway fire-and-forget where supervision genuinely does not matter, but in production you almost always want an OTP behaviour (GenServer/Task/Agent) so you get `child_spec`, supervision, and shutdown handling for free.

- **Link** (`spawn_link`) couples lifetimes: if one dies abnormally, the other gets an exit signal. This is how supervision works.
- **Monitor** (`Process.monitor/1`) is one-directional and non-fatal: you get a `{:DOWN, ...}` message but you do not die. Use it when you care *that* something died but should survive it.

## GenServer

Split the **client API** (runs in the caller) from the **server callbacks** (run in the GenServer process). Callers never touch state directly.

```elixir
defmodule Counter do
  use GenServer

  # --- Client API (caller's process) ---
  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts[:start] || 0, name: opts[:name] || __MODULE__)
  end

  @spec increment(GenServer.server()) :: :ok
  def increment(server \\ __MODULE__), do: GenServer.cast(server, :increment)

  @spec value(GenServer.server()) :: integer()
  def value(server \\ __MODULE__), do: GenServer.call(server, :value)

  # --- Server callbacks (GenServer's process) ---
  @impl true
  def init(start), do: {:ok, start, {:continue, :warm_up}}

  @impl true
  def handle_continue(:warm_up, state) do
    # heavy/slow init goes here, AFTER start_link has returned
    {:noreply, state}
  end

  @impl true
  def handle_cast(:increment, count), do: {:noreply, count + 1}

  @impl true
  def handle_call(:value, _from, count), do: {:reply, count, count}
end
```

- **Never block in `init/1`.** `start_link` blocks until `init` returns, so a slow `init` stalls the whole supervision tree boot. Return `{:ok, state, {:continue, term}}` and do the work in `handle_continue/2`.
- **`use GenServer` auto-defines `child_spec/1`** — you rarely write one by hand; override only to change `:restart` or `:shutdown`.
- **`call` is synchronous (with a 5s default timeout), `cast` is fire-and-forget.** Use `call` when the caller needs the result or backpressure; `cast` when it does not. A flood of `cast`s with no backpressure is the classic mailbox-growth bug — timeouts and backpressure recipes in `references/otp-patterns.md`.
- **Name via `Registry`, not a global atom**, when you have many dynamic instances — atoms are never garbage-collected (see anti-patterns).

## Supervision trees

The supervision tree starts in `lib/<app>/application.ex`, wired via the `mod:` key in `mix.exs`. `mix new <app> --sup` scaffolds this.

```elixir
defmodule MyApp.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Registry, keys: :unique, name: MyApp.Registry},
      {DynamicSupervisor, name: MyApp.WorkerSup, strategy: :one_for_one},
      Counter
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)
  end
end
```

**Restart strategy** — how siblings react when one child dies:

| Strategy | On a child crash | Use when |
|---|---|---|
| `:one_for_one` | restart only that child | children are independent (the default, most common) |
| `:one_for_all` | restart all children | children depend on each other and shared state is invalidated |
| `:rest_for_one` | restart that child and the ones started after it | later children depend on earlier ones |

**Restart value** per child — `:permanent` (always restart, the default), `:transient` (restart only on abnormal exit), `:temporary` (never restart). A pool worker is often `:transient`; a one-shot job is `:temporary`.

**Let it crash**: do not wrap business logic in `try/rescue` to keep a process alive. Validate inputs at the boundary, then trust the happy path; if an invariant breaks, crashing and restarting from a known-good `init` state is the recovery mechanism. Reserve `rescue` for boundaries where you must convert an exception into a tagged tuple for a caller.

For runtime-spawned children (a worker per connection/job) use `DynamicSupervisor` + `Registry` for lookup. Full recipe — plus `Task`, `Agent`, `:ets` and how to choose an OTP behaviour — in `references/otp-patterns.md`.

## mix project

```text
my_app/
  mix.exs               # project, deps, application/0 with mod: callback
  config/
    config.exs          # compile-time config (read once, at build)
    runtime.exs         # runtime config — reads System.get_env at boot
  lib/
    my_app.ex
    my_app/
      application.ex     # supervision tree
  test/
```

- **`config.exs` is compile-time; `runtime.exs` is runtime.** Anything coming from the environment of the running release (DB URL, secrets, ports) goes in `runtime.exs` — it is the only config evaluated inside the built release at boot. Putting secrets in `config.exs` bakes build-time values into the artifact.
- **`mix release`** produces a self-contained tarball with its own ERTS; no Elixir/Erlang needed on the target. Run it with `bin/<app> start`.

```bash
MIX_ENV=prod mix release
_build/prod/rel/my_app/bin/my_app start
```

`mix.exs` anatomy, deps, environments, env vars, releases and the umbrella decision live in `references/mix-and-releases.md`.

## Types and modern stdlib

- **Add `@spec` to public functions.** The set-theoretic type system (gradual, sound; v1.18 inferred patterns/calls, v1.19 added protocol + anonymous-fn inference, v1.20 targets full inference) uses them and surfaces warnings at compile time — **treat type warnings as bugs**, they catch real mismatches before runtime.
- **Use built-in `JSON`** (`JSON.encode!/1`, `JSON.decode!/1`, since v1.18) for basic encoding/decoding — no Jason/Poison dependency needed unless you require their extras.
- **`mix format`** is the canonical formatter; run it and gate CI on `mix format --check-formatted`.
- **`mix compile --warnings-as-errors`** in CI. Dialyzer and Credo are optional add-ons, not required for correct OTP code.
- v1.19 perf: lazy module loading (>2x faster compiles on large projects) and `MIX_OS_DEPS_COMPILE_PARTITION_COUNT` for parallel dep compilation.

## Anti-patterns

| Bad | Why it bites | Do instead |
|---|---|---|
| `String.to_atom(user_input)` | Atoms are never garbage-collected; attacker-controlled input exhausts the atom table and crashes the VM | `String.to_existing_atom/1`, or keep it a string / map key |
| One god GenServer all calls route through | Serializes everything into one mailbox — a hard concurrency ceiling and a single point of failure | Split by responsibility; use a `Registry` of per-entity processes or `Task` for parallel work |
| Heavy work inside `init/1` | `start_link` blocks until `init` returns, stalling the supervision tree boot | `{:ok, state, {:continue, msg}}` + `handle_continue/2` |
| `try/rescue` wrapping all logic | Defeats let-it-crash; the process limps on with corrupt state | Validate at the boundary, trust the path, let the supervisor restart |
| A new process per trivial call | Spawn + mailbox + scheduling overhead for nothing | A plain function; processes are for state/concurrency/isolation |
| Unbounded `cast` into a slow GenServer | Producer outruns consumer, mailbox grows without bound, OOM | Use `call` for backpressure, or a bounded queue / `GenStage` |

## Verify

Run `scripts/verify.sh` from your mix project root (the directory containing `mix.exs`). It checks `mix format --check-formatted` and `mix compile --warnings-as-errors`, and skips cleanly with exit 0 when Elixir/mix is not installed so it never blocks a toolchain-free CI.
