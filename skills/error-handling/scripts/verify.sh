#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# NAME
#   verify.sh — error-handling anti-pattern scanner
#
# USAGE
#   ./verify.sh [PATH]            # default PATH = .
#   ./verify.sh --strict [PATH]   # exit non-zero if anything is flagged
#
# WHAT IT DOES
#   Greps the working tree for the highest-signal anti-patterns this skill
#   teaches and prints file:line for each hit:
#     - empty `catch {}` / `catch (e) {}`            (swallowed failure)
#     - Python `except: pass` and bare `except:`     (swallowed / over-broad)
#     - `alert(` as a handler, lone `console.log(err)` / `console.error(e)`
#     - retry loops with no cap: `while (true)`/`while True` near "retry"
#
# POSTURE
#   - READ-ONLY. Never writes, never auto-fixes.
#   - HEURISTIC and ADVISORY. It flags candidates; a human judges each one.
#   - Exits 0 by default even with findings (warnings only). Pass --strict to
#     make any finding exit non-zero (for CI). Exits 0 cleanly on an empty or
#     clean target — no false failure.
#   - Portable to stock macOS bash 3.2 (no mapfile, no associative arrays).
#
# EXIT CODES
#   0  no findings, OR findings in advisory (default) mode
#   1  findings AND --strict was passed
# ============================================================================

RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; RST=$'\033[0m'
if [ -n "${NO_COLOR:-}" ]; then RED=""; YEL=""; GRN=""; RST=""; fi

STRICT=0
TARGET="."
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) TARGET="$arg" ;;
  esac
done

if [ ! -e "$TARGET" ]; then
  printf '%s[skip]%s target not found: %s\n' "$YEL" "$RST" "$TARGET" >&2
  exit 0
fi

HITS=0

# Prefer ripgrep (respects .gitignore, fast); fall back to grep -r.
if command -v rg >/dev/null 2>&1; then
  search() { rg --line-number --no-heading --color=never -e "$1" "$TARGET" 2>/dev/null || true; }
  searchP() { rg --line-number --no-heading --color=never -P -e "$1" "$TARGET" 2>/dev/null || true; }
else
  search() { grep -rEn --exclude-dir=.git --exclude-dir=node_modules -- "$1" "$TARGET" 2>/dev/null || true; }
  searchP() { grep -rEn --exclude-dir=.git --exclude-dir=node_modules -- "$1" "$TARGET" 2>/dev/null || true; }
fi

# report <label> <matches> : print a section if there are matches, bump HITS.
report() {
  label="$1"; matches="$2"
  if [ -n "$matches" ]; then
    count=$(printf '%s\n' "$matches" | grep -c . || true)
    printf '\n%s[flag]%s %s (%s)\n' "$YEL" "$RST" "$label" "$count"
    printf '%s\n' "$matches"
    HITS=$((HITS + count))
  fi
}

# 1. Empty catch blocks: `catch {}`, `catch (e) {}`, `catch(err){ }`
report "empty catch block — swallows the failure" \
  "$(searchP 'catch\s*(\([^)]*\))?\s*\{\s*\}')"

# 2. Python `except: pass`  (allow whitespace / one-liners)
report "Python 'except ...: pass' — swallows the failure" \
  "$(searchP 'except[^\n:]*:\s*pass\b')"

# 3. Python bare `except:`  (over-broad; catches SystemExit/KeyboardInterrupt)
report "Python bare 'except:' — over-broad, catch the specific type" \
  "$(searchP 'except\s*:')"

# 4. alert() used as an error handler (leaks internals, blocks UI)
report "alert() as a handler — leaks internals, no recovery" \
  "$(searchP 'alert\s*\(\s*(e|err|error)(\.message)?\s*\)')"

# 5. console.log/error of the error as the ONLY handling (log-and-forget)
report "lone console.log/error(err) — log without classify/surface" \
  "$(searchP 'console\.(log|error)\s*\(\s*(e|err|error)\s*\)\s*;?\s*$')"

# 6. Uncapped retry loops: while(true)/while True within a couple lines of 'retry'
report "possible uncapped retry loop — needs an attempt cap + jitter" \
  "$(searchP 'while\s*\(\s*true\s*\)|while\s+True\s*:' | grep -iE 'retry|attempt|backoff' || true)"

# ----------------------------------------------------------------------------
printf '\n=== Summary ===\n'
if [ "$HITS" -eq 0 ]; then
  printf '%s[ok]%s no anti-patterns flagged under %s\n' "$GRN" "$RST" "$TARGET"
  exit 0
fi

printf '%s%s candidate(s) flagged%s — heuristic; review each against ../SKILL.md.\n' \
  "$YEL" "$HITS" "$RST"
if [ "$STRICT" -eq 1 ]; then
  printf '%s--strict: failing.%s\n' "$RED" "$RST" >&2
  exit 1
fi
printf 'advisory mode (exit 0); pass --strict to gate.\n'
exit 0
