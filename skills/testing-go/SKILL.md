---
name: testing-go
description: "Use when writing or running Go tests — table-driven cases, named subtests, parallel isolation, fakes instead of mock frameworks, coverage profiles, benchmarks, fuzzing, golden files, and testing concurrent goroutines deterministically. NOT general Go code or modules (that is `go`), NOT pytest fixtures (that is `testing-py`), NOT browser user flows (that is `e2e-testing`)."
tags: [go, testing, table-driven-tests, benchmarks, coverage, synctest, mocks, fuzzing]
recommends: [go, secure-coding, testing-py, e2e-testing]
origin: risco
---

# Testing Go

You test **behavior at the package boundary**, not private internals. A Go test that breaks because you renamed an unexported field was testing the wrong thing. Target Go **1.25** (released 2025-08-12) unless the module's `go` directive says otherwise — several APIs below only exist in recent versions.

Default stack, in order of reach:
1. The standard `testing` package. It is enough for ~90% of tests.
2. `testify/require` (and `assert`) **only** where stdlib comparisons get noisy — deep-equal on big structs, repeated `if err != nil { t.Fatal }`. Not as a reflex.
3. Hand-written fakes over any mock generator. A 12-line fake beats `gomock` for code you own.

Run `go test ./...` early and often. Add `-race` for anything that touches a goroutine. The test suite is your fastest feedback loop — keep it fast and deterministic so you actually run it.

## What am I testing? Pick the tool

| Situation | Reach for |
|---|---|
| Pure logic, many input/output cases | Table-driven test + `t.Run` subtests |
| An HTTP client or `http.Handler` | `net/http/httptest` (server or recorder) |
| Goroutines, timers, timeouts, `context` deadlines | `testing/synctest` + `-race` |
| "Is it fast / did my change regress?" | `testing.B.Loop` + `benchstat` |
| "Does it crash or misbehave on weird input?" | `func FuzzXxx(f *testing.F)` |
| A dependency you own (DB, payment client, clock) | A hand-written interface fake |

If you find yourself reaching past the standard library for the first row, stop — table-driven tests need nothing else.

## Table-driven tests

The canonical shape: a slice of anonymous structs with a `name`, run as named subtests.

```go
func TestReverse(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: ""},
		{name: "ascii", in: "abc", want: "cba"},
		{name: "unicode", in: "héllo", want: "olléh"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Reverse(tc.in)
			if got != tc.want {
				t.Errorf("Reverse(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
```

- **Name every case.** `t.Run(tc.name, ...)` gives you `go test -run TestReverse/unicode` to target one case, and a readable failure path instead of "index 2".
- **Use `t.Errorf`, not `t.Fatalf`, inside the loop** unless the rest of the case is meaningless after the failure. `Fatalf` stops the whole subtest; `Errorf` lets the other cases still run.
- **One table per behavior, not per function.** If two functions share inputs and expectations, one table. If a case needs three extra fields only it uses, that case wants its own test.

Bad — copy-pasted near-identical functions:

```go
func TestAddOne(t *testing.T)  { if Add(1) != 2 { t.Fail() } }
func TestAddTwo(t *testing.T)  { if Add(2) != 3 { t.Fail() } }
func TestAddZero(t *testing.T) { if Add(0) != 1 { t.Fail() } }
```

Good — one table, each case named, failures localized (see the `TestReverse` shape above).

## Parallel & isolation

```go
for _, tc := range tests {
	t.Run(tc.name, func(t *testing.T) {
		t.Parallel() // this subtest runs concurrently with its siblings
		got := Process(tc.in)
		if got != tc.want {
			t.Errorf("Process(%q) = %v, want %v", tc.in, got, tc.want)
		}
	})
}
```

- **Do not write `tc := tc` before `t.Run`.** Go 1.22+ gives each loop iteration its own variable scope, so the historical copy is dead ceremony. Only modules whose `go.mod` declares `go 1.21` or older still need it — and you should bump the directive instead.
- **`t.Cleanup(fn)` over `defer`** for teardown that must run even when a helper calls `t.Fatal`. Cleanups run LIFO after the test, and they nest correctly through helpers where a `defer` in `main` would not.
- **`t.Helper()`** as the first line of any assertion helper, so failures point at the caller's line, not inside the helper.
- **`t.TempDir()`** for filesystem tests — auto-removed, unique per test, parallel-safe. Never hardcode `/tmp/mytest`.
- **`t.Context()`** (Go 1.24+) gives a context cancelled when the test and its cleanups finish — pass it to anything taking a `context.Context` instead of `context.Background()`.
- **`t.Setenv` and `T.Chdir` forbid `t.Parallel()`.** They mutate process-global state; the test panics if you call them in a parallel test. Keep env/cwd-mutating tests serial.

## Fakes over mocks

Define the interface where you **consume** it (the test's package), keep it tiny, and hand-roll a fake with func fields you set per test.

```go
// Charger is what the service needs — declared at the consumer, not the vendor.
type Charger interface {
	Charge(ctx context.Context, cents int64) (string, error)
}

type fakeCharger struct {
	charge func(ctx context.Context, cents int64) (string, error)
}

func (f fakeCharger) Charge(ctx context.Context, cents int64) (string, error) {
	return f.charge(ctx, cents)
}

func TestCheckout_chargesOnce(t *testing.T) {
	var calls int
	f := fakeCharger{charge: func(_ context.Context, c int64) (string, error) {
		calls++
		return "txn_123", nil
	}}
	if err := Checkout(t.Context(), f, 999); err != nil {
		t.Fatalf("Checkout: %v", err)
	}
	if calls != 1 {
		t.Errorf("Charge called %d times, want 1", calls)
	}
}
```

This is faster to read than a generated mock and never couples your test to call order. Reach for `go.uber.org/mock` (gomock) or `testify/mock` only when a team already mandates them or the interface is large and call-sequence assertions are the point — templates and the decision in `references/mocks-and-fakes.md`. For HTTP dependencies use `net/http/httptest` (server, recorder, or a fake `RoundTripper`) instead of a fake — same reference.

## Concurrency & time (synctest)

`testing/synctest` graduated to GA in **Go 1.25**. It runs your code in an isolated "bubble" with a fake clock that jumps forward instantly the moment every goroutine in the bubble is durably blocked — so a test of a 30-second timeout finishes in microseconds, deterministically.

```go
func TestTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()

		done := make(chan error, 1)
		go func() { done <- slowOperation(ctx) }()

		synctest.Wait() // wait until the goroutine is durably blocked
		select {
		case err := <-done:
			if !errors.Is(err, context.DeadlineExceeded) {
				t.Errorf("got %v, want DeadlineExceeded", err)
			}
		case <-time.After(time.Minute): // fake time — never really waits
			t.Fatal("operation did not time out")
		}
	})
}
```

- **Always run concurrent code with `-race`** (`go test -race ./...`). The race detector finds data races that pass silently otherwise.
- **`synctest.Wait()`** blocks the bubble until all other bubble goroutines are durably blocked, letting you assert at a known point.
- Use `synctest.Test(t, ...)`, not the old `synctest.Run` — `Run` is deprecated as of Go 1.26.
- Never use `time.Sleep` to "let the goroutine finish." That is the flaky-test factory. Full bubble semantics, durable-block definition, and goroutine-leak detection live in `references/synctest-and-concurrency.md`.

## Coverage

```bash
go test -cover ./...                                   # quick per-package %
go test -coverprofile=cover.out ./...                  # write a profile
go tool cover -html=cover.out                          # open annotated source
go test -coverpkg=./... -coverprofile=cover.out ./...  # cross-package coverage
go build -cover -o ./bin/app .                         # coverage for integration binaries (1.20+)
```

A coverage **percentage is a smoke alarm, not a goal.** 100% line coverage with no assertions on the values is worthless; 70% on the branches that actually carry logic is fine. Use `-coverpkg=./...` when your tests live in a separate package and exercise code across the module, or the number undercounts. Profiles, integration-binary coverage, and reading the HTML report are in `references/coverage-and-benchmarks.md`.

## Benchmarks

Use `for b.Loop()` (Go 1.24+), not the legacy `for i := 0; i < b.N; i++`. `b.Loop` manages the timer itself (setup before the loop and teardown after are excluded automatically), runs the body the right number of times, and the compiler is taught **not** to dead-code-eliminate calls inside it.

```go
func BenchmarkHash(b *testing.B) {
	data := bytes.Repeat([]byte("x"), 1024) // setup excluded from timing
	b.ReportAllocs()
	for b.Loop() {
		_ = Hash(data)
	}
}
```

Bad — legacy loop with manual timer juggling and a sink to fool the optimizer:

```go
func BenchmarkHash(b *testing.B) {
	data := bytes.Repeat([]byte("x"), 1024)
	b.ResetTimer()
	var sink uint64
	for i := 0; i < b.N; i++ {
		sink = Hash(data)
	}
	_ = sink
}
```

- **`b.ReportAllocs()`** always — allocation count regresses long before wall-clock does, and it is the first thing to optimize.
- **Compare runs with `benchstat`**, never eyeball two numbers — a single run's noise is larger than most real changes. Install and workflow in `references/coverage-and-benchmarks.md`.
- The `sink`/`runtime.KeepAlive` dance is only needed in pre-1.24 modules; inside `b.Loop()` it is redundant.

## Fuzzing

Built in since Go 1.18. Worth it for **parsers, decoders, and anything that ingests untrusted input** — places where a malformed byte sequence can panic or corrupt state.

```go
func FuzzParse(f *testing.F) {
	f.Add("key=value")        // seed corpus
	f.Add("")
	f.Fuzz(func(t *testing.T, s string) {
		got, err := Parse(s)
		if err != nil {
			return // rejecting bad input is fine; crashing is not
		}
		if out := got.String(); out != s {
			t.Errorf("round-trip: Parse(%q).String() = %q", s, out)
		}
	})
}
```

Run it with `go test -fuzz=FuzzParse -fuzztime=30s`. Without `-fuzz` the seed corpus runs as ordinary cases on every `go test`, so seeds are also free regression tests.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Testing unexported internals via `export_test.go` for everything | Tests rename-break on every refactor; you're testing structure, not behavior | Test through the public API; reserve `export_test.go` for genuinely untestable seams |
| Asserting on log output to check a code path ran | Couples tests to message wording; brittle and slow | Assert on returned values or fake-recorded calls |
| `time.Sleep` to synchronize goroutines | Flaky on loaded CI, slow always | `testing/synctest` + `synctest.Wait()`, or a channel |
| One giant `TestEverything` func | First failure hides the rest; no targetable subtests | Table-driven with named `t.Run` subtests |
| Chasing 100% coverage | Inflates with assertion-free tests; false confidence | Cover the branches that carry logic; read the profile |
| `tc := tc` before `t.Run` in a `go 1.22`+ module | Dead ceremony; signals copied-from-old-blog code | Delete it; bump the `go` directive if older |
| `gomock`/`testify/mock` to fake an interface you own | Ceremony + coupling to call order for a 12-line job | Hand-rolled func-field fake |
| Benchmark without `b.ReportAllocs()` | Misses allocation regressions, the cheapest win | Add `b.ReportAllocs()`; compare with `benchstat` |
| `t.Parallel()` in a test calling `t.Setenv`/`T.Chdir` | Panics — they mutate process-global state | Keep env/cwd tests serial |

## Verify & references

Run `scripts/verify.sh [dir]` to check emitted tests: it runs `gofmt -l`, `go vet ./...`, and `go test ./... -count=1` (with `-race` when supported) inside the first Go module it finds, and no-ops cleanly when there is none.

- `references/synctest-and-concurrency.md` — bubble model, durable-block definition, fake clock, `synctest.Wait`, `-race`, goroutine-leak detection, the `GOEXPERIMENT`→GA migration.
- `references/mocks-and-fakes.md` — fakes vs `testify/mock` vs gomock decision and minimal templates; `httptest` server/recorder/RoundTripper recipes.
- `references/coverage-and-benchmarks.md` — coverage profiles, `-coverpkg`, integration `go build -cover`, `benchstat` install and workflow, `-cpuprofile`/`-memprofile`.
