#!/usr/bin/env bash
#
# verify.sh - local quality gate for a Go module (superset of CI).
#
# Usage:
#   cd <your-go-module-root>   # the directory containing go.mod
#   ./verify.sh
#
# Runs: gofmt, go vet, staticcheck, golangci-lint, go test -race -cover, govulncheck.
# Tools that are not installed are skipped with a yellow warning (not a failure).
# Real problems (unformatted code, vet/test/vuln failures) exit non-zero.
# Read-only: never mutates your source.
#
# ONE LAYER HERE IS A REPORT, NOT A GATE. `go test -cover` takes no threshold flag, so
# coverage can print any number — 4%, 0% — and still exit 0. It is therefore reported as
# [gap]: the layer ran and had nothing to fail with. Said out loud because a layer that
# prints a number and exits 0 looks exactly like a layer that passed, and that shape can
# only ever produce green — no failing run will ever tell you about it. Want a real
# coverage gate in Go? Parse `go tool cover -func` and compare, or use a CI action; this
# script does not pretend to be one.
#
# A [gap] does NOT change the exit code: this script reports, the `verify` skill judges,
# and there it counts as an unverified criterion, which fails the verdict.
#
# Portability: runs on stock macOS bash 3.2 (no mapfile, no associative arrays,
# no unguarded array expansions under `set -u`).

set -euo pipefail

# Colors only when stdout is a TTY (keeps logs/CI output clean).
if [ -t 1 ]; then
  YELLOW=$'\033[33m'; RED=$'\033[31m'; GREEN=$'\033[32m'; RESET=$'\033[0m'
else
  YELLOW=''; RED=''; GREEN=''; RESET=''
fi

failed=0
gaps=0

have()  { command -v "$1" >/dev/null 2>&1; }
warn()  { printf '%s[skip]%s %s\n' "$YELLOW" "$RESET" "$*"; }
fail()  { printf '%s[fail]%s %s\n' "$RED" "$RESET" "$*"; failed=1; }
ok()    { printf '%s[ ok ]%s %s\n' "$GREEN" "$RESET" "$*"; }
info()  { printf -- '----- %s\n' "$*"; }
# A layer that ran but had nothing to fail with. Deliberately does NOT set `failed`:
# breaking every repo that passes today is not this script's call to make.
gap()   { printf '%s[gap ]%s %s\n' "$YELLOW" "$RESET" "$*"; gaps=$((gaps + 1)); }

# Must run from a module root.
if [ ! -f go.mod ]; then
  printf '%serror:%s no go.mod in %s - cd into your module root first.\n' \
    "$RED" "$RESET" "$(pwd)" >&2
  exit 2
fi

# 1. gofmt - ships with the Go toolchain; formatting is non-negotiable.
info "gofmt"
if have gofmt; then
  fmt_out="$(gofmt -l . 2>/dev/null || true)"
  if [ -n "$fmt_out" ]; then
    fail "unformatted files (run: gofmt -w .):"
    printf '%s\n' "$fmt_out"
  else
    ok "gofmt clean"
  fi
else
  warn "gofmt not found (is Go installed?)"
fi

# 2. go vet - ships with the Go toolchain.
info "go vet"
if have go; then
  if go vet ./...; then ok "go vet clean"; else fail "go vet reported issues"; fi
else
  warn "go not found - cannot run go vet/test"
fi

# 3. staticcheck - optional.
info "staticcheck"
if have staticcheck; then
  if staticcheck ./...; then ok "staticcheck clean"; else fail "staticcheck reported issues"; fi
else
  warn "staticcheck not found (go install honnef.co/go/tools/cmd/staticcheck@latest)"
fi

# 4. golangci-lint - optional.
info "golangci-lint"
if have golangci-lint; then
  if golangci-lint run; then ok "golangci-lint clean"; else fail "golangci-lint reported issues"; fi
else
  warn "golangci-lint not found (https://golangci-lint.run/usage/install/)"
fi

# 5. go test -race -cover. -race needs cgo + a working C compiler; detect and degrade.
#    The C compiler is whatever `go env CC` reports (gcc/clang/cc), so check that one
#    rather than assuming `cc` exists. CGO_ENABLED must actually be "1".
info "go test -race -cover"
if have go; then
  cgo_enabled="$(go env CGO_ENABLED 2>/dev/null || echo 0)"
  cgo_cc="$(go env CC 2>/dev/null || echo cc)"
  if [ "$cgo_enabled" = "1" ] && have "$cgo_cc"; then
    if go test -race -cover ./...; then ok "tests pass (race+cover)"; else fail "tests failed"; fi
  else
    warn "cgo disabled or C compiler '$cgo_cc' not found; running plain go test -cover"
    if go test -cover ./...; then ok "tests pass (no race)"; else fail "tests failed"; fi
  fi
  # The tests above are a gate; the coverage number printed alongside them is not.
  # `go test -cover` has no threshold flag, so coverage cannot fail this script no matter
  # how far it falls. Reported so nobody reads the percentage as a checked constraint.
  gap "coverage: reported, not gated — 'go test -cover' takes no threshold, so this layer cannot fail"
else
  warn "go not found - skipping tests"
fi

# 6. govulncheck - optional; findings are a real failure.
info "govulncheck"
if have govulncheck; then
  if govulncheck ./...; then ok "no known vulnerabilities"; else fail "govulncheck found vulnerabilities"; fi
else
  warn "govulncheck not found (go install golang.org/x/vuln/cmd/govulncheck@latest)"
fi

echo
if [ "$gaps" -ne 0 ]; then
  printf '%s%d layer(s) ran without being able to fail (see [gap] above).%s\n' "$YELLOW" "$gaps" "$RESET"
  printf 'Not a pass and not a failure: report them as unverified rather than green.\n'
fi
if [ "$failed" -ne 0 ]; then
  printf '%sFAIL:%s one or more checks failed.\n' "$RED" "$RESET"
  exit 1
fi
# Deliberately "checks that could fail, passed" and not "all checks passed": with a [gap]
# present the second sentence would be false in the way this whole change exists to stop.
printf '%sPASS:%s every check that could fail, passed.\n' "$GREEN" "$RESET"
