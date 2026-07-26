---
name: go
description: "Use when writing, reviewing, testing, or shipping Go code and HTTP services: idioms, `%w` error wrapping, goroutine/context/errgroup concurrency, net/http 1.22 routing, log/slog, project layout, table-driven tests, Go hardening. NOT language-agnostic threat modeling (that is `secure-coding`), NOT Dockerfile/CI shipping (that is `deployment`)."
tags: [go, golang, http, backend, service]
recommends: [postgresdb, secure-coding, deployment]
origin: risco
---

# Idiomatic Go services

Targets **Go 1.22+** (Go 1.26 is the current stable release): enhanced `net/http` routing
(`mux.HandleFunc("GET /users/{id}", h)` + `r.PathValue`), `log/slog` structured
logging, and fixed loop-variable semantics (no more `tt := tt`).

> **⚠️ SDD new-feature gate — read this first.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP — do **not** write feature code yet. Hand off to `../specify/SKILL.md` first: it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build here directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

## Boundary

Go error handling and HTTP contract design (status-code taxonomy, REST resource naming) live
**here** — this skill is the canonical authority for both in Go. Delegate outward:

- Language-agnostic abuse/authz review, threat modeling, OWASP-class bugs ->
  [`secure-coding`](../secure-coding/SKILL.md). This skill keeps the Go-specific controls:
  SQL params, server timeouts, `govulncheck`, TLS defaults.
- Containerfile / k8s / CI pipeline authoring -> [`deployment`](../deployment/SKILL.md).
  This skill ships only a Docker note + `ldflags`.
- Recording per-project conventions in a workspace wiki -> [`harness`](../harness/SKILL.md)
  (see "Project grounding" below).

Non-service Go (CLI tooling, codegen, ML): the patterns apply, but the HTTP/production half
is irrelevant.

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

**Early return.** Clear over clever: invert the error and `return`; keep the happy path flat
(no arrow code).

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

**Receivers.** Pick value or pointer per type and stay consistent across its method set;
mutating / large / contains-`sync` -> pointer.

**Go 1.22 loopvar.** Loop variables are per-iteration now. Stop emitting the workaround:
inside `for _, tt := range tests` the line `// tt := tt` is obsolete - DELETE it.

## Errors

**Sentinel vs typed.** Sentinels for identity; typed errors for data.

```go
var ErrNotFound = errors.New("not found")         // sentinel: identity
type ValidationError struct{ Field, Msg string }  // typed: carries data
func (e *ValidationError) Error() string { return fmt.Sprintf("%s: %s", e.Field, e.Msg) }
```

**Wrap and classify.** Wrap every crossed boundary with `%w`; never compare message strings.

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

## Concurrency (essentials)

`context.Context` is the **first** param of every call, never stored in a struct, never `nil`
(use `context.TODO()` while wiring). Bound work with a context deadline; bound concurrency
with `errgroup` — the derived `ctx` cancels siblings on first error, and `g.SetLimit(n)` caps
in-flight goroutines:

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
`t.Setenv()` for env. Run `go test -race -cover ./...`, and treat `go vet` / `staticcheck`
failures as build failures. Stdlib `testing` is the default; reach for `testify/require` only
for deep-equality or large suites.

Golden files, fuzzing, benchmarks, httptest matrices, interface fakes ->
`references/testing.md`.

## Security (embedded)

Validate at the boundary: parametrize SQL (PostgreSQL; prefer `pgx v5` over `database/sql`);
cap request bodies and reject unknown fields; set a TLS floor and trust the `crypto/tls`
defaults:

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

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| Storing `ctx` in a struct to avoid threading it | `ctx` is the first arg of every call. |
| `_ = err` because it "can't fail" | Handle, log, or document why; `errcheck` catches it. |
| String-comparing the error message | `errors.Is` / `errors.As`; messages are not API. |
| Global `db` / `logger` because it's "simpler" | Inject via constructor; globals kill testability. |
| Fire-and-forget goroutine ("it'll finish") | Unbounded/unstoppable goroutine = leak; give it ctx + buffer. |
| `tt := tt` added "to be safe" | Go 1.22 fixed loopvar; it's noise now. |
| Interface in the provider package, returning the interface | Return structs; interface lives with the consumer. |
| No timeouts because "the LB handles it" | Set all four `http.Server` timeouts; Slowloris is real. |
| `panic` on bad input | Return an error; panic only for programmer bugs / `main` wiring. |
| Skipping `-race` because tests pass | Race bugs are silent; `-race` in CI is mandatory. |
| `fmt.Sprintf` into SQL on "trusted" input | Parametrize (`$1`...); trust nothing at the boundary. |
| `testify` everywhere | Stdlib first; reach for testify only when it earns its weight. |

## Toolchain gate

| Task | Command |
| --- | --- |
| Format | `gofmt -w .` / `goimports -w .` |
| Vet | `go vet ./...` |
| Lint | `staticcheck ./...` / `golangci-lint run` |
| Test (race+cover) | `go test -race -cover ./...` |
| Fuzz | `go test -fuzz=Fuzz -fuzztime=30s` |
| Vulns | `govulncheck ./...` |
| Local gate | `./scripts/verify.sh` (run in your module root) |

## Project grounding (02-DOCS)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), this
project's service decisions live in `02-DOCS/wiki/stack/go.md`, indexed from
`02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
Read it first on every use and stay consistent. If it is missing or stale, write the project's
real choices there — the project layout, the router (stdlib 1.22 / chi), the error and `slog`
conventions, concurrency/timeout defaults — index it, and bump its `Updated` date in the same
change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the brand study,
technical conventions are *recorded, not gated* — never block the task on this.
