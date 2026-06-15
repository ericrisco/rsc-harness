---
name: go
description: "Use when writing, reviewing, testing, securing, or shipping Go code or HTTP services - Go idioms (simplicity, useful zero value, accept-interfaces/return-structs, functional options, embedding), error wrapping with %w and errors.Is/As, goroutines/channels/context/errgroup concurrency, net/http with Go 1.22 routing, log/slog structured logging, graceful shutdown, cmd/-internal/-pkg/ layout, table-driven tests with httptest/-race/fuzz, and govulncheck/SQL-parametrization security. Triggers - \"write a Go service/handler\", \"review this Go code\", \"add tests\", \"fix a goroutine leak\", \"is this idiomatic Go\", .go files, go.mod, net/http, slog, chi, errgroup."
tags: [go, golang, http, backend, service]
recommends: [postgresdb, secure-coding, deployment]
origin: risco
---

# Idiomatic Go services

Write, review, test, secure, and ship idiomatic Go HTTP services.

Targets **Go 1.22+** (Go 1.26 is the current stable release): enhanced `net/http` routing
(`mux.HandleFunc("GET /users/{id}", h)` + `r.PathValue`), `log/slog` structured
logging, and fixed loop-variable semantics (no more `tt := tt`).

## When to use / When NOT to use

> **⚠️ SDD new-feature gate — read this first.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP — do **not** write feature code yet. Hand off to `../specify/SKILL.md` first: it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build here directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

**Use when:**

- Authoring, reviewing, or testing any `.go` file.
- Designing or wiring a Go HTTP API (`net/http`, chi, middleware, handlers).
- Debugging concurrency: goroutine leaks, data races, deadlocks, context plumbing.
- Structuring a Go module (`cmd/`, `internal/`, `pkg/`, constructor injection).
- Hardening or shipping a Go binary (timeouts, TLS, `govulncheck`, graceful shutdown).

**When NOT to use (delegate):**

- Language-agnostic abuse/authz review, threat modeling, OWASP-class bugs -> `secure-coding`
  (this skill keeps Go-specific controls: SQL params, server timeouts, `govulncheck`, TLS defaults).
- Containerfile / k8s / CI pipeline authoring -> `deployment` (this skill ships only a Docker note + `ldflags`).
- Recording per-project conventions in a workspace wiki -> `harness` (see "Project grounding" below).
- Non-service Go (CLI tooling, codegen, ML): patterns apply, but the HTTP/production half is irrelevant.

Go error handling and HTTP contract design (status-code taxonomy, REST resource naming) live
**here**, not in a separate skill — this skill is the canonical authority for both in Go.

## Decision rules

Apply these on every Go edit:

1. Clear over clever; return early, keep the happy path unindented.
2. Accept interfaces, return concrete structs; define interfaces in the **consumer** package.
3. Make the zero value useful; never ship a type that panics before a constructor runs.
4. `context.Context` is the **first** param, never stored in a struct, never `nil` (use
   `context.TODO()` while wiring).
5. Wrap every crossed boundary with `fmt.Errorf("verb: %w", err)`; classify with
   `errors.Is`/`errors.As`, never string-match messages.
6. No package-level mutable state; inject dependencies through constructors.
7. Every goroutine needs a known exit path (context or a closed channel); a started
   goroutine you cannot stop is a leak.
8. Validate at the boundary; parametrize every SQL query; set all server timeouts; run
   `govulncheck` before shipping.
9. Tests are table-driven with subtests; run `-race` in CI; treat `go vet`/`staticcheck`
   failures as build failures.
10. Pick value-or-pointer receiver per type and stay consistent; mutating / large /
    contains-`sync` -> pointer.

## Idioms

**Useful zero value.** Design types so the zero value works before any constructor.

```go
// Good: zero-value Counter is ready; the zero-value mutex is unlocked. var b bytes.Buffer too.
type Counter struct {
	mu sync.Mutex
	n  int
}

func (c *Counter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() }

// Bad: nil map field panics on first write (assignment to entry in nil map); hidden init step.
type Registry struct{ items map[string]int }

func (r *Registry) Add(k string) { r.items[k]++ } // panic if items was never make()'d
```

**Accept interfaces, return structs.** Return the concrete type; declare the interface
where it is consumed.

```go
type UserStore interface { // declared in package service - only what it needs
	GetUser(ctx context.Context, id string) (*User, error)
}
func NewService(s UserStore) *Service { return &Service{store: s} } // Good: return *Service
// Bad: func NewService(s UserStore) UserStore - returning the interface hides the type.
```

**Functional options.** Defaults first, then apply options.

```go
type Server struct {
	addr    string
	timeout time.Duration
	logger  *slog.Logger
}
type Option func(*Server)

func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func WithLogger(l *slog.Logger) Option   { return func(s *Server) { s.logger = l } }

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second, logger: slog.Default()} // defaults first
	for _, opt := range opts {
		opt(s)
	}
	return s
}
```

Use a plain `Config` struct once options exceed ~5; options are for optional, composable
tuning, not required fields.

**Embedding for composition.** Embed to borrow a behavior, not to fake inheritance.

```go
// Good: the service gets .Info/.Error for free from the embedded logger.
type Service struct {
	*slog.Logger
	store UserStore
}
// Bad: deep type trees (Base -> Middle -> Leaf) modeling "is-a" inheritance - avoid.
```

**Early return.** Invert the error and `return`; keep the happy path flat (no arrow code).

```go
// Good: each failure returns immediately; the success path is unindented.
func save(ctx context.Context, u *User) error {
	if u == nil {
		return errors.New("nil user")
	}
	if err := validate(u); err != nil {
		return fmt.Errorf("validate: %w", err)
	}
	return store.Put(ctx, u)
}
// Bad: if u != nil { if err := validate(u); err == nil { ... } else { ... } } - arrow code.
```

**No package-level mutable state.** Inject via constructor (`func New(db *sql.DB) *Server`),
never a global `var db *sql.DB` opened in `init()` - globals couple everything and kill
testability.

**Go 1.22 loopvar.** Loop variables are per-iteration now. Stop emitting the workaround:
inside `for _, tt := range tests` the line `// tt := tt` is obsolete - DELETE it.

## Errors

Go error handling is owned here — the sentinel/typed/wrap/classify model below is canonical.

**Sentinel vs typed.** Sentinels for identity; typed errors for data.

```go
var ErrNotFound = errors.New("not found")         // sentinel: identity
type ValidationError struct{ Field, Msg string }  // typed: carries data
func (e *ValidationError) Error() string { return fmt.Sprintf("%s: %s", e.Field, e.Msg) }
```

**Wrap and classify.** Wrap with `%w`; never compare message strings.

```go
err := fmt.Errorf("find user %s: %w", id, ErrNotFound)
if errors.Is(err, ErrNotFound) { /* sentinel match through the wrap chain */ }
var verr *ValidationError
if errors.As(err, &verr) { /* typed match: verr.Field, verr.Msg */ }
joined := errors.Join(err1, err2) // 1.20+: aggregate; Is/As traverse both
```

**3-layer boundary (the canonical flow).** Repo wraps the driver sentinel into a domain
sentinel; service passes it through; handler classifies once and maps to a status, logging
only the unexpected.

```go
// repository: translate sql.ErrNoRows into a domain sentinel, keep the chain.
func (r *Repo) GetUser(ctx context.Context, id string) (*User, error) {
	var u User
	err := r.db.QueryRowContext(ctx, "SELECT id, name FROM users WHERE id = $1", id).
		Scan(&u.ID, &u.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
	}
	if err != nil {
		return nil, fmt.Errorf("query user %s: %w", id, err)
	}
	return &u, nil
}

// handler: classify once, map to HTTP status.
func (h *Handler) getUser(w http.ResponseWriter, r *http.Request) {
	u, err := h.svc.GetUser(r.Context(), r.PathValue("id"))
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, u)
	case errors.Is(err, ErrNotFound):
		http.Error(w, "not found", http.StatusNotFound)
	default:
		slog.Error("get user", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
```

Full handler adapter (error-returning `apiHandler`) -> `references/http-services.md`.

**`defer` + named return** to capture `Close()` errors:

```go
func read(name string) (err error) {
	f, e := os.Open(name)
	if e != nil {
		return e
	}
	defer func() { err = errors.Join(err, f.Close()) }() // capture Close() into the return
	return nil
}
```

**Anti-patterns:** `if err.Error() == "not found"` (string match); `panic` for control flow;
swallowing with `_ = err`.

## Concurrency (essentials)

Bound work with a context deadline; bound concurrency with `errgroup` — the derived `ctx`
cancels siblings on first error, and `g.SetLimit(n)` caps in-flight goroutines:

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(8)
for _, id := range ids {
	g.Go(func() error { return process(ctx, id) }) // Go 1.22+: no id := id needed
}
err := g.Wait()
```

Three rules cover most service code: every goroutine needs a known exit path (a started
goroutine you cannot stop is a leak); an unbuffered `ch <- v` with no receiver after a cancel
blocks forever, so buffer it and `select` on `ctx.Done()`; **run `-race` in CI**. Low-level
needs map to `sync.Once` (lazy init), `sync.RWMutex` (read-heavy state), `sync/atomic`
(`atomic.Int64` counters).

Full implementations — context plumbing, channel/select patterns, leak detection, worker
pools, pipelines, fan-in/out, semaphores, `singleflight`, and a `withRetry` helper (backoff +
full jitter, `ctx`-aware, **never retries 4xx**) -> `references/concurrency.md`.

## HTTP services (essentials)

Go 1.22 routed mux — method and path live in the pattern; the `error`-returning adapter
centralizes status mapping:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /users/{id}", getUser) // 405 on wrong method, 404 on no match
id := r.PathValue("id")                    // inside the handler

type apiHandler func(http.ResponseWriter, *http.Request) error
func (h apiHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil { /* classify via errors.Is/As -> status + slog */ }
}
```

Set **all four** `http.Server` timeouts (`ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`,
`IdleTimeout`) — an unbounded read is a Slowloris DoS. Graceful shutdown on signal:
`signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)`, then `srv.Shutdown(shutdownCtx)`
on `<-ctx.Done()`.

Routing patterns, chi vs stdlib, the full middleware chain (request-id, slog, panic-recovery,
timeout), config, timeout values, functional-options server, and JSON helpers ->
`references/http-services.md`.

## Project layout

```text
cmd/api/main.go        # entrypoint: wiring only
internal/handler/      # HTTP adapters
internal/service/      # business logic; defines the interfaces it needs
internal/repository/   # data access (pgx); implements service interfaces
internal/config/       # env parsing, validation
pkg/                   # ONLY genuinely reusable, stable public API
testdata/              # fixtures, golden files
go.mod go.sum
```

Wire the layers with **constructor injection**, outermost depends inward:
`repo := repository.New(db); svc := service.New(repo); h := handler.New(svc)`.

Package naming: short, lowercase, no underscores, no `util`/`common`, avoid stutter
(`user.User`, not `user.UserStruct`). Interfaces live on the **consumer side**: the
`service` package declares `UserStore`; the `repository` package implements it without
importing the interface.

## Testing (essentials)

Table-driven with subtests and parallelism:

```go
func TestParse(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		wantErr error
	}{
		{"ok", "42", nil},
		{"bad", "x", ErrInvalid},
	}
	for _, tt := range tests { // Go 1.22+: no tt := tt needed
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := Parse(tt.in)
			if !errors.Is(err, tt.wantErr) { // classify, not just != nil
				t.Fatalf("got %v, want %v", err, tt.wantErr)
			}
		})
	}
}
```

HTTP handlers via `httptest`: `req := httptest.NewRequest("GET", "/users/1", nil)`;
`w := httptest.NewRecorder()`; `h.ServeHTTP(w, req)`; then assert on `w.Code` / `w.Body`.

Use `t.Helper()` in assertions, `t.TempDir()` for files, `t.Cleanup()` for teardown,
`t.Setenv()` for env. Run `go test -race -cover ./...`. Stdlib `testing` is the default;
reach for `testify/require` only for deep-equality or large suites.

Golden files, fuzzing, benchmarks, httptest matrices, interface fakes ->
`references/testing.md`.

## Security (embedded)

Parametrize SQL (PostgreSQL; prefer `pgx v5` over `database/sql`); cap request bodies and reject unknown
fields; set a TLS floor and trust the `crypto/tls` defaults:

```go
// Good                                       // Bad: string interpolation = SQL injection.
db.QueryContext(ctx, "... WHERE id = $1", id) // db.QueryContext(ctx, fmt.Sprintf("... '%s'", id))

r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap
dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields()

tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12} // do not hand-pick cipher suites
```

**Server timeouts** are a DoS control - set all four (see HTTP services above).

Run `govulncheck ./...` in CI; keep deps honest with `go mod tidy` + `go mod verify`. Read
secrets from env / a secret manager, never log them; redact tokens with slog `ReplaceAttr`.
Deeper authz/abuse review -> `secure-coding`.

## Production

Wire `log/slog` JSON in `main` (level from env), then `slog.SetDefault`:

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
slog.SetDefault(logger)
```

Stamp the version with `ldflags` and read module info at runtime:

```bash
go build -ldflags "-X main.version=$(git describe --tags --always)" ./cmd/api
# at runtime: if info, ok := debug.ReadBuildInfo(); ok { slog.Info("build", "go", info.GoVersion) }
```

Mount `net/http/pprof` on a **separate internal** mux/port (never the public listener);
expose `/healthz` (static 200 liveness) and `/readyz` (calls `db.PingContext` with a short
timeout, 503 on failure). Graceful shutdown as shown above.

Docker note: distroless/static base, `CGO_ENABLED=0`, multi-stage build. Full Containerfile
-> `deployment`.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality / Do instead |
| --- | --- |
| "I'll store ctx in the struct to avoid threading it" | No. `ctx` is the first arg of every call. |
| "`_ = err` here, it can't fail" | Handle, log, or document why; `errcheck` catches it. |
| "string-compare the error message" | `errors.Is`/`errors.As`; messages are not API. |
| "global `db`/`logger` is simpler" | Inject via constructor; globals kill testability. |
| "fire the goroutine, it'll finish" | Unbounded/unstoppable goroutine = leak; give it ctx + buffer. |
| "I'll add `tt := tt` to be safe" | Go 1.22 fixed loopvar; it's noise now. |
| "interface in the provider package, return the interface" | Return structs; interface lives with the consumer. |
| "no timeouts, the LB handles it" | Set all four `http.Server` timeouts; Slowloris is real. |
| "`panic` for this bad input" | Return an error; panic only for programmer bugs / `main` wiring. |
| "skip `-race`, tests pass" | Race bugs are silent; `-race` in CI is mandatory. |
| "`fmt.Sprintf` into SQL, the input's trusted" | Parametrize ($1...); trust nothing at the boundary. |
| "testify everywhere" | Stdlib first; reach for testify only when it earns its weight. |

## Quick reference

| Task | Idiom / command |
| --- | --- |
| Format | `gofmt -w .` / `goimports -w .` |
| Vet | `go vet ./...` |
| Lint | `staticcheck ./...` / `golangci-lint run` |
| Test (race+cover) | `go test -race -cover ./...` |
| Fuzz | `go test -fuzz=Fuzz -fuzztime=30s` |
| Vulns | `govulncheck ./...` |
| Wrap error | `fmt.Errorf("verb: %w", err)` |
| Classify error | `errors.Is` / `errors.As` |
| Route | `mux.HandleFunc("GET /p/{id}", h)` + `r.PathValue("id")` |
| Log | `slog.Info("msg", "key", val)` |
| Shutdown | `signal.NotifyContext` + `srv.Shutdown(ctx)` |
| Leak guard | buffered chan + `select { case ch<-v: case <-ctx.Done(): }` |
| Local gate | `./scripts/verify.sh` (run in your module root) |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this
project's service decisions there and index them in `02-DOCS/wiki/index.md`, so the next
agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/go.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — the project layout, the router (stdlib 1.22 / chi), the error and `slog` logging conventions, and concurrency/timeout defaults —
   then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the
   article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the
brand study, technical conventions are *recorded, not gated* — never block the task on this.

## See Also

Sibling skills (all resolve under `skills/`):

- [`secure-coding`](../secure-coding/SKILL.md) - threat modeling and language-agnostic authz/abuse/OWASP review (this skill keeps the Go-specific controls).
- [`deployment`](../deployment/SKILL.md) - Docker multi-stage, GitHub Actions CI, Coolify/Vercel/Hetzner shipping (this skill ships only the Docker note + `ldflags`).
- [`harness`](../harness/SKILL.md) - the `02-DOCS/` workspace wiki where per-project Go conventions are recorded (see "Project grounding").

Local references (read when):

- `references/concurrency.md` - goroutines, channels, errgroup, leaks, race detector.
- `references/http-services.md` - routing, middleware, slog, graceful shutdown, full skeleton.
- `references/testing.md` - table tests, httptest, fakes, golden files, fuzz, benchmarks.
