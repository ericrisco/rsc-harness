---
name: rust
description: "Use when writing, reviewing, testing, or shipping Rust code or async services - ownership/borrowing (move vs borrow vs clone, Arc/Rc/RefCell, lifetimes), error modeling with Result/?/thiserror/anyhow, async on tokio (.await, JoinSet, select!, spawn_blocking, Send-across-await), axum 0.8 HTTP handlers/extractors/State, cargo test (unit/integration/doctests), and sqlx + cargo-audit security. Triggers: \"write an axum/tokio service\", \"is this idiomatic Rust\", \"add tests\", compiler error text like \"value moved here\", \"borrow of moved value\", \"future cannot be sent between threads safely\", \"does not live long enough\", \"cannot borrow as mutable\", \"el borrow checker no em deixa\", \"petición async en Rust\", .rs files, Cargo.toml, thiserror, sqlx. NOT desktop/GUI shells (that is tauri)."
tags: [rust, tokio, axum, async, backend, service]
recommends: [go, postgresdb, secure-coding, deployment]
origin: risco
---

# Idiomatic Rust services

Write, review, test, and ship idiomatic async Rust services with the ownership model working *for*
you, not against you.

Targets **Rust 1.85+ / edition 2024** as the floor: native `async fn`
in traits (no reflexive `#[async_trait]`), **tokio 1.x** as the runtime, **axum 0.8** for the HTTP
surface (`{id}` path-capture syntax, async-trait-free extractors), **thiserror 2** for library error
enums and **anyhow** at the application edge, **sqlx** for compile-time-checked SQL, and **tracing**
for structured observability.

The thing an agent gets wrong in Rust is almost never syntax — it is *ownership*. Most "bugs" are
compile errors about moves, borrows, and `Send + Sync` across `.await`. Front-load that mental model;
the rest follows.

## When to use / When NOT to use

**Use when:**

- Authoring, reviewing, or testing any `.rs` file, `Cargo.toml`, or workspace.
- Fighting the borrow checker: "value moved here", "cannot borrow as mutable", "does not live long
  enough", or choosing between `Rc`/`Arc`/`RefCell`/`Mutex`.
- Modeling errors: `Result<T, E>`, `?`, a `thiserror` enum vs `anyhow::Result`, `#[from]` conversions,
  mapping a domain error to an HTTP status.
- Async on tokio: `#[tokio::main]`, `.await`, `JoinSet`, `select!`, channels, `spawn_blocking`,
  cancellation, the "future is not `Send`" / "held across await" error class.
- Building an axum service: routers, extractors, `State`, `IntoResponse`, tower middleware, shutdown.

**When NOT to use (delegate):**

- Language-agnostic threat modeling / authz / OWASP review -> `secure-coding` (this skill keeps the
  Rust-specific controls: sqlx parametrization, `#![forbid(unsafe_code)]`, `cargo audit`).
- Dockerfile / CI pipeline / shipping infra -> `deployment` (this skill carries only a multi-stage
  Docker note + release-profile flags).
- Pure SQL schema/index tuning -> `postgresdb` (this skill covers only the Rust-side sqlx query).
- Native GUI / desktop shell with a webview -> `tauri`; cross-platform app work is out of scope.
- A Go / Python / Node service -> `go` / `fastapi` / `nodejs` respectively.

Rust error modeling and the HTTP error->status contract live **here**, in Rust terms — they are not a
separate skill. `go` is the structural twin: same shape, GC + goroutines instead of ownership + futures.

## Decision rules

Apply these on every Rust edit:

1. Prefer borrowing (`&T`) over moving over cloning; `.clone()` to silence the borrow checker is a
   smell, not a fix — it hides the real ownership question.
2. Take `&str`/`&[T]` in function params, return owned `String`/`Vec<T>`; borrow on the way in, own on
   the way out. It is the most flexible and the cheapest.
3. `?` over `.unwrap()`/`.expect()` everywhere off the test path; an `.unwrap()` on untrusted input is a
   remote panic.
4. Model errors with a `thiserror` enum when callers branch on the failure mode; reach for `anyhow` only
   at the application boundary (`main`, top-level handlers) where you just need context + a backtrace.
5. Never hold a `MutexGuard` (or any non-`Send` value) across an `.await` — it deadlocks or fails to
   compile with "future cannot be sent between threads".
6. Bound concurrency with a `JoinSet` (or a semaphore); a loop of bare `tokio::spawn` is unbounded
   fan-out that can exhaust the runtime.
7. `spawn_blocking` for CPU-bound or synchronous-blocking work; blocking inside an async task starves
   the executor's worker threads.
8. Validate at the boundary, parse into a typed domain model; "parse, don't validate" — make illegal
   states unrepresentable.
9. Parametrize every sqlx query with bind args; `format!` into SQL is injection.
10. `#![forbid(unsafe_code)]` at the crate root unless you have a measured, reviewed, documented reason;
    `clippy -D warnings` and `cargo fmt --check` are build gates, not suggestions.

## Ownership & borrowing (essentials)

This is the skill's center of gravity. Three moves: **move** (transfer ownership), **borrow** (`&`/`&mut`,
no transfer), **clone** (a real copy, real cost).

```rust
fn print_name(name: &str) { println!("{name}"); }   // borrows; caller keeps ownership

let s = String::from("ada");
print_name(&s);                                       // Good: lend a reference
println!("{s}");                                      // still usable

// Bad: takes by value, moves it, then the caller can't use `s` anymore.
fn consume(name: String) { /* ... */ }
consume(s);
// println!("{s}");  // error[E0382]: borrow of moved value: `s`
```

The four borrow-checker errors you will actually hit, with the fix:

```rust
// 1. "value moved here" (E0382): you used a value after moving it.
//    Fix: borrow instead of move, or .clone() only if you genuinely need two owners.
let v = vec![1, 2, 3];
let first = &v[0];           // Good: borrow
// let taken = v; let _ = first;  // Bad: moves v while `first` borrows it.

// 2. "cannot borrow as mutable more than once" (E0499): two &mut alive at once.
//    Fix: scope the first borrow so it ends before the second begins.
let mut data = vec![1, 2, 3];
{ let a = &mut data; a.push(4); }   // borrow ends here
let b = &mut data; b.push(5);       // Good: non-overlapping

// 3. "cannot borrow as mutable, already borrowed as immutable" (E0502).
//    Fix: don't hold a shared ref across a mutation; collect indices first, mutate after.

// 4. "does not live long enough" (E0597): a reference outlives the value it points to.
//    Fix: return an owned value, or restructure so the owner outlives the borrow.
```

Shared state: pick the smallest tool that fits. Decision table —

| Need | Use | Why |
| --- | --- | --- |
| One owner, sized value | the value, or `Box<T>` | `Box` only when heap/indirection/`dyn` is required |
| Shared ownership, single thread | `Rc<T>` | cheap refcount, **not** thread-safe |
| Shared ownership, across threads/await | `Arc<T>` | atomic refcount; the default for async app state |
| Interior mutability, single thread | `RefCell<T>` | runtime borrow check; panics on violation |
| Shared mutable state, async | `Arc<Mutex<T>>` (tokio's) | but prefer a channel if it is really message passing |
| Read-heavy shared state | `Arc<RwLock<T>>` | many readers, rare writer |

Shared async state is `Arc<AppState>` injected through axum `State` — never a global `static mut`.
Lifetimes, `'static`, `Cow`, and the full smart-pointer tree -> `references/ownership.md`.

## Errors

Error modeling is owned here. The model: `Result<T, E>` + `?`, typed enums for libraries, `anyhow` at
the edge, one mapping from a domain enum to an HTTP status.

```rust
use thiserror::Error;

// Library / domain layer: a typed enum callers can match on. #[from] gives free `?` conversion.
#[derive(Debug, Error)]
pub enum UserError {
    #[error("user {0} not found")]
    NotFound(i64),
    #[error("database error")]
    Db(#[from] sqlx::Error),   // any sqlx::Error becomes UserError::Db via `?`
}
```

```rust
// Application edge: anyhow when you just need context, not a match.
use anyhow::Context;
let config = std::fs::read_to_string(path)
    .with_context(|| format!("reading config at {path}"))?;   // adds a human breadcrumb
```

**The 3-layer flow (twin of go's).** Repository returns the typed domain error; service propagates with
`?`; the handler maps the enum to a status *once*, via `IntoResponse` — pattern-match the variant, never
string-match the message, and log only the unexpected one (no internal leak to the client).

```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

impl IntoResponse for UserError {
    fn into_response(self) -> Response {
        let status = match self {
            UserError::NotFound(_) => StatusCode::NOT_FOUND,            // 404
            UserError::Db(ref e) => {                                  // 500
                tracing::error!(error = %e, "unexpected db error");    // log here, not to the client
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}
```

**Anti-patterns:** `.unwrap()`/`.expect()` on the request path (a panic = 500 + a stack trace, or a
crashed worker); stringly-typed errors you `match` on by message; `Box<dyn Error>` smeared everywhere so
nothing can branch on the failure. Full repo->service->handler skeleton -> `references/axum-service.md`.

## Async (tokio, essentials)

`#[tokio::main]` boots the multi-thread runtime; futures do nothing until `.await`. Bound your fan-out:

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();
for id in ids {                                  // Good: a JoinSet you can drain and cap
    set.spawn(async move { fetch(id).await });
}
let mut out = Vec::new();
while let Some(res) = set.join_next().await {
    out.push(res??);                             // join error, then task error
}
```

The two pitfalls that bite agents, with the fix:

```rust
// Bad: std Mutex guard held across .await -> "future cannot be sent between threads safely".
let guard = state.lock().unwrap();
do_io().await;                  // guard is still alive here -> not Send
guard.update();

// Good: drop the lock before awaiting, or use tokio::sync::Mutex if the lock must span the await.
{
    let mut g = state.lock().unwrap();
    g.update();
}                               // guard dropped here
do_io().await;                  // nothing non-Send is held across the await
```

```rust
// Bad: a CPU-bound parse on the async worker thread starves every other task.
let parsed = heavy_parse(&blob);          // blocks the executor
// Good: move blocking/CPU work off the runtime.
let parsed = tokio::task::spawn_blocking(move || heavy_parse(&blob)).await?;
```

`select!` races futures (handle a cancellation token in one arm); `tokio::sync::mpsc` for message
passing — prefer a channel over `Arc<Mutex<T>>` when the data flows one way. Cancellation, a
bounded-concurrency + jittered-retry helper (ctx-aware, never retries a 4xx), and the full `Send + Sync`
rules -> `references/async-tokio.md`.

## Service (axum, essentials)

axum 0.8: `{id}` capture in the path, `Path`/`State`/`Json` extractors, your error enum as the return:

```rust
use axum::{extract::{Path, State}, routing::get, Router, Json};
use std::sync::Arc;

async fn get_user(
    State(app): State<Arc<AppState>>,            // shared state, not a global
    Path(id): Path<i64>,                         // {id} parsed and typed
) -> Result<Json<User>, UserError> {             // UserError: IntoResponse maps it
    let user = app.users.find(id).await?;        // `?` propagates the typed error
    Ok(Json(user))
}

let app = Router::new()
    .route("/users/{id}", get(get_user))         // 0.8 syntax: {id}, not :id
    .with_state(state);
```

Full skeleton — tower middleware (`TraceLayer`, timeout, request-id), graceful shutdown via
`axum::serve(...).with_graceful_shutdown(...)`, and JSON helpers -> `references/axum-service.md`.

## Project layout

Keep the binary thin; put logic in the library so tests and integration tests can reach it.

```text
my-service/
  Cargo.toml          # [dependencies], [profile.release], optional [workspace]
  src/
    main.rs           # entrypoint: parse config, build state, axum::serve — wiring only
    lib.rs            # pub mod error; pub mod app; pub mod users; — the testable surface
    error.rs          # the thiserror enum + IntoResponse
    users/
      mod.rs          # handlers + the domain model
      repo.rs         # sqlx queries
  tests/
    users_api.rs      # integration tests that spin up the Router
```

A larger system becomes a Cargo **workspace** (`[workspace] members = [...]`) with one crate per bounded
context. Gate optional deps behind `[features]`. The `lib.rs` carries `#![forbid(unsafe_code)]`.

## Testing (essentials)

`#[test]` for sync, `#[tokio::test]` for async; integration tests under `tests/` exercise the real
`Router`; doctests keep examples honest.

```rust
#[tokio::test]
async fn get_user_404_when_missing() {
    let app = build_router(test_state());            // the same Router main builds
    let res = app
        .oneshot(Request::get("/users/999").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
```

Use `cargo nextest run` for faster, cleaner parallel runs; `cargo test --doc` for doctests. Trait-based
fakes (a `UserRepo` trait the handler depends on, a fake impl in tests) keep the DB out of unit tests.
Integration matrices, `insta` snapshots, and the full `tests/` HTTP setup -> `references/testing.md`.

## Security (embedded)

Parametrize SQL, forbid unsafe, audit dependencies, read secrets from the environment:

```rust
// Good: bound parameters; sqlx checks the query at compile time against the DB schema.
sqlx::query_as!(User, "SELECT id, name FROM users WHERE id = $1", id).fetch_one(&pool).await?;

// Bad: format! into SQL is injection, full stop.
// sqlx::query(&format!("SELECT * FROM users WHERE id = {id}")).fetch_one(&pool).await?;
```

`#![forbid(unsafe_code)]` at the crate root; run `cargo audit` (RustSec advisories) and `cargo deny` (license
+ ban + advisory policy) in CI; never `.unwrap()` on untrusted input — a malicious request becomes a
panic. Read secrets from env or a secret manager, never hardcode or log them. Deeper authz / threat
modeling -> `secure-coding`.

## Production

Structured logs and a lean release binary:

```rust
// JSON tracing subscriber, level from RUST_LOG; do this once in main before serving.
tracing_subscriber::fmt().json().with_env_filter(tracing_subscriber::EnvFilter::from_default_env()).init();
```

```toml
[profile.release]
lto = true              # link-time optimization: smaller, faster binary
codegen-units = 1       # better optimization at the cost of compile time
panic = "abort"         # no unwinding in prod; smaller binary, fail fast
strip = true            # strip symbols
```

Expose `/healthz` (static 200 liveness) and `/readyz` (pings the DB pool, 503 on failure). Docker:
multi-stage build, `cargo build --release`, copy the binary onto a distroless/slim base. Full
Containerfile + CI -> `deployment`.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality / Do instead |
| --- | --- |
| ".clone() to make the borrow checker happy" | It hides the real ownership question; borrow, or restructure who owns what. |
| ".unwrap() here, it can't fail" | It can, and a panic on the request path is a 500/crash; use `?` + a typed error. |
| "`Box<dyn Error>` everywhere is simpler" | Nothing can branch on the failure; use a `thiserror` enum the caller can match. |
| "`#[async_trait]` on every async trait" | Edition 2024 has native async fn in traits; drop the macro for most cases. |
| "lock the Mutex, then .await" | Guard held across await = deadlock / not-`Send`; drop it first or use `tokio::sync::Mutex`. |
| "`block_on` inside this async fn" | Nesting a runtime panics/deadlocks; restructure to `.await`. |
| "just `tokio::spawn` in the loop" | Unbounded fan-out exhausts the runtime; bound it with `JoinSet`/semaphore. |
| "`unsafe` to get past the borrow checker" | `unsafe` turns a compile error into UB; the checker was right — restructure. |
| "`format!` the id into the SQL, it's trusted" | Injection; bind parameters with `$1` always. |
| "skip clippy, it's just style" | clippy catches correctness (`.unwrap()` on `Option`, await-holds-lock); gate on `-D warnings`. |
| "`Arc<Mutex<T>>` for everything shared" | If data flows one way it is a channel; reach for `mpsc` first. |
| "`String` params everywhere" | Take `&str`; you force needless allocations and lose flexibility. |

## Quick reference

| Task | Command / idiom |
| --- | --- |
| Format check | `cargo fmt --all -- --check` |
| Lint (gate) | `cargo clippy --all-targets -- -D warnings` |
| Test | `cargo test` / `cargo nextest run` |
| Doctests | `cargo test --doc` |
| Audit deps | `cargo audit` / `cargo deny check` |
| Propagate error | `let v = thing()?;` |
| Library error | `#[derive(Error)]` enum + `#[from]` |
| App error | `anyhow::Result<T>` + `.context(...)` |
| Async test | `#[tokio::test] async fn ...` |
| Bound concurrency | `JoinSet` + `join_next().await` |
| Off-runtime work | `spawn_blocking(move || ...).await?` |
| Local gate | `./scripts/verify.sh` (run in your crate root) |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this project's service decisions there and index
them from the root `CLAUDE.md`, so the next agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/rust.md`, indexed in `02-DOCS/wiki/index.md` (the
   Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — the crate/workspace layout,
   the runtime (tokio), the HTTP framework (axum 0.8), the error strategy (thiserror enum + IntoResponse
   mapping), the DB layer (sqlx + pool), and tracing/concurrency defaults — then index it in
   `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the article
   (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Technical conventions are *recorded,
not gated* — never block the task on this.

## See Also

Sibling skills (all resolve under `skills/`):

- [`go`](../go/SKILL.md) - the structural twin: same write/review/test/ship service shape, GC + goroutines + multi-return errors instead of ownership + futures + `Result`.
- [`secure-coding`](../secure-coding/SKILL.md) - threat modeling and language-agnostic authz/abuse/OWASP review (this skill keeps the Rust-specific controls).
- [`postgresdb`](../postgresdb/SKILL.md) - SQL schema/index/query-plan tuning (this skill covers only the Rust-side sqlx query).
- [`deployment`](../deployment/SKILL.md) - Docker multi-stage, CI, shipping infra (this skill ships only the Docker note + release-profile flags).
- [`harness`](../harness/SKILL.md) - the `02-DOCS/` workspace wiki where per-project Rust conventions are recorded (see "Project grounding").

Local references (read when):

- `references/ownership.md` - move/borrow/clone deep dive, the borrow-checker error catalog, lifetimes, `'static`, `Cow`, smart-pointer tree, interior mutability.
- `references/async-tokio.md` - runtime model, `JoinSet`/`select!`/channels, cancellation, `spawn_blocking`, `Send + Sync` across await, bounded-concurrency + retry helper.
- `references/axum-service.md` - full skeleton: router, extractors, `State`, error->response, tower middleware, graceful shutdown, JSON helpers.
- `references/testing.md` - unit/integration/doctests, `#[tokio::test]`, `tests/` HTTP tests against the Router, fakes/trait mocks, `cargo nextest`, `insta` snapshots.
