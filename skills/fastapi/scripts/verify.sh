#!/usr/bin/env bash
#
# verify.sh — quality gate for a FastAPI / async Python project.
#
# Usage:
#   ./scripts/verify.sh [TARGET_PATH]
#
# Runs lint, format-check, type-check, tests+coverage, and a dependency audit.
# Auto-detects each tool. If a tool is missing it prints a yellow SKIP and continues
# (it never FAILs on a missing tool). Prefers `uv run <tool>` when `uv` is present,
# else the bare tool on PATH. Exits non-zero only if a tool actually ran and reported
# a failure. Idempotent: re-running yields the same result (read-only beyond whatever
# the project's pytest does).
#
# COVERAGE IS ONLY A GATE IF YOUR PROJECT MAKES IT ONE. The threshold is deliberately
# delegated to the project (--cov-fail-under in pyproject.toml / setup.cfg / .coveragerc)
# rather than hardcoded here. But when the project sets none, `pytest --cov` prints a
# percentage and exits 0 however far coverage falls — and a layer that prints a number and
# exits 0 is a report, not a gate. That case is reported as [gap] instead of PASS, because
# the two are indistinguishable on screen and the broken one can only ever produce green:
# no failing run will ever surface it.
#
# A [gap] does NOT change the exit code — breaking every repo that passes today is not this
# script's call. This script reports; the `verify` skill judges, and there a gap counts as
# an unverified criterion, which fails the verdict.
#
# Compatible with stock macOS bash 3.2: no `mapfile`, no associative arrays, and every
# array access is guarded so `set -u` never trips on an "unbound" empty array.

set -euo pipefail

TARGET="${1:-.}"

# --- color helpers (guarded for non-TTY) ---
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi
warn() { printf '%s%s%s\n' "$YELLOW" "$*" "$RESET"; }
ok()   { printf '%s%s%s\n' "$GREEN" "$*" "$RESET"; }
fail() { printf '%s%s%s\n' "$RED" "$*" "$RESET"; }

PASSED=0; SKIPPED=0; FAILED=0; GAPS=0

# gap <reason> — the layer ran and had nothing to fail with. Counted and printed, but it
# deliberately does NOT touch FAILED: see the header note on why the exit code is unchanged.
gap() { printf '%sGAP: %s%s\n' "$YELLOW" "$*" "$RESET"; GAPS=$((GAPS + 1)); }

# coverage_threshold_configured — does the project actually gate on coverage?
# Looks for pytest's --cov-fail-under (addopts or a bare flag) and coverage.py's fail_under.
# Grep rc: 0 = found, 1 = not found, >=2 = the scan itself broke. Treat "broke" as NOT
# configured so the answer errs toward reporting a gap; a broken scan must never buy a pass.
coverage_threshold_configured() {
  local f rc
  for f in "$TARGET/pyproject.toml" "$TARGET/setup.cfg" "$TARGET/tox.ini" "$TARGET/.coveragerc" "$TARGET/pytest.ini"; do
    [ -f "$f" ] || continue
    grep -qE 'cov-fail-under|fail_under' "$f" && return 0
    rc=$?
    if [ "$rc" -ge 2 ]; then
      warn "NOTE: could not read '${f}' while checking for a coverage threshold; treating it as absent"
    fi
  done
  return 1
}

have() { command -v "$1" >/dev/null 2>&1; }

# Detect-or-skip: a real Python project has a project manifest or at least one *.py
# under TARGET. With neither, there is nothing to verify, so SKIP (exit 0) instead of
# letting pytest report "no tests collected" as a FAIL. This guards only the empty case;
# inside a real project every tool still runs and real failures still surface.
python_project_present() {
  if [ -f "$TARGET/pyproject.toml" ] || [ -f "$TARGET/setup.py" ] || [ -f "$TARGET/setup.cfg" ]; then
    return 0
  fi
  # Any .py file under TARGET (bash 3.2: use find, no globstar).
  if [ -n "$(find "$TARGET" -type f -name '*.py' -print -quit 2>/dev/null)" ]; then
    return 0
  fi
  return 1
}

if ! python_project_present; then
  warn "SKIP: no Python project found under '${TARGET}' (no pyproject.toml/setup.py/setup.cfg and no *.py)"
  ok "verify.sh: ok (nothing to verify)"
  exit 0
fi

# Do we have uv? When yes, tools run through `uv run`, which can resolve a tool from the
# project venv even if it is not on PATH.
USE_UV=0
if have uv; then USE_UV=1; fi

# tool_available <tool>
# True when the tool can actually be invoked: either it is on PATH, or (under uv) it can
# be resolved and reports a version. Probing under uv is what lets us SKIP (not FAIL) a
# tool that is genuinely absent from the project's environment.
tool_available() {
  local tool="$1"
  if have "$tool"; then
    return 0
  fi
  if [ "$USE_UV" -eq 1 ]; then
    if uv run --quiet "$tool" --version >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

# run_step <label> <tool> <args...>
run_step() {
  local label="$1"; local tool="$2"; shift 2
  if ! tool_available "$tool"; then
    warn "SKIP: ${label} (${tool} not installed)"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi
  printf '==> %s\n' "$label"
  if [ "$USE_UV" -eq 1 ]; then
    if uv run "$tool" "$@"; then
      ok "PASS: ${label}"; PASSED=$((PASSED + 1))
    else
      fail "FAIL: ${label}"; FAILED=$((FAILED + 1))
    fi
  else
    if "$tool" "$@"; then
      ok "PASS: ${label}"; PASSED=$((PASSED + 1))
    else
      fail "FAIL: ${label}"; FAILED=$((FAILED + 1))
    fi
  fi
}

run_step "ruff check"        ruff check "$TARGET"
run_step "ruff format check" ruff format --check "$TARGET"
run_step "mypy"              mypy "$TARGET"
run_step "pytest + coverage" pytest --cov --cov-report=term-missing
# Only meaningful if pytest actually ran; a SKIP already says nothing was measured.
if tool_available pytest && ! coverage_threshold_configured; then
  gap "coverage ran without a threshold (no --cov-fail-under / fail_under found) — this layer cannot fail. Add --cov-fail-under=<n> to pyproject.toml addopts to make it a gate."
fi
run_step "pip-audit"         pip-audit

printf '\n%d passed, %d skipped, %d failed, %d gap(s)\n' "$PASSED" "$SKIPPED" "$FAILED" "$GAPS"
if [ "$GAPS" -gt 0 ]; then
  warn "A GAP is neither a pass nor a failure: the layer ran and could not have failed. Report it as unverified."
fi
if [ "$FAILED" -gt 0 ]; then
  fail "verify.sh: failures detected"
  exit 1
fi
# "every check that could fail, passed" rather than a bare ok: with a GAP present, the
# stronger claim would be false in exactly the way this script now exists to prevent.
ok "verify.sh: ok (every check that could fail, passed)"
exit 0
