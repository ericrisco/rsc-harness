#!/usr/bin/env bash
# verify.sh — Astro project static gate.
#
# Usage:
#   bash scripts/verify.sh            # run from the Astro project root
#
# What it does (read-only, grep-based, no install required):
#   1. FAIL  if a v6 project still uses src/content/config.ts instead of
#            src/content.config.ts (the legacy path is removed on v6 →
#            LegacyContentConfigError).
#   2. WARN  on over-hydration smells: many `client:load`, or `client:only`
#            with no framework string.
#   3. CHECK content schemas import from `astro:content`.
#   4. If the `astro` binary resolves, OPTIONALLY run `npx astro check`
#      (type/diagnostic check; read-only). Skipped if not resolvable.
#
# Exit code: non-zero ONLY on a real FAIL. Warnings are advisory. On an empty
# or clean tree it prints OK and exits 0 (no false failure).
#
# Portability: targets stock macOS bash 3.2. No `mapfile`, no jq, no node
# required for the grep checks. `set -e` is intentionally NOT used; `set -u` is.

set -u

if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  RED="$(tput setaf 1)"; GREEN="$(tput setaf 2)"; YELLOW="$(tput setaf 3)"; RESET="$(tput sgr0)"
else
  RED=""; GREEN=""; YELLOW=""; RESET=""
fi

failures=0
warnings=0
have() { command -v "$1" >/dev/null 2>&1; }
fail() { printf '%s\n' "${RED}FAIL: $1${RESET}"; failures=$((failures + 1)); }
warn() { printf '%s\n' "${YELLOW}WARN: $1${RESET}"; warnings=$((warnings + 1)); }
ok()   { printf '%s\n' "${GREEN}OK: $1${RESET}"; }
skip() { printf '%s\n' "${YELLOW}SKIP: $1${RESET}"; }

# Is this even an Astro project? If not, exit clean (no false failure).
if [ ! -f astro.config.mjs ] && [ ! -f astro.config.ts ] && [ ! -f astro.config.js ] \
   && ! grep -rq '"astro"' package.json 2>/dev/null; then
  ok "no Astro project detected here — nothing to check"
  exit 0
fi

# Source files to scan (skip node_modules / dist / .astro). Empty list is fine.
src_files() {
  find . \( -name node_modules -o -name dist -o -name .astro -o -name .vercel \
            -o -name .netlify \) -prune -o \
    -type f \( -name '*.astro' -o -name '*.ts' -o -name '*.tsx' \
               -o -name '*.jsx' -o -name '*.mdx' \) -print 2>/dev/null
}

# Detect Astro major version (best-effort, bash-3.2 safe). Echoes a bare integer or nothing.
astro_major() {
  [ -f node_modules/astro/package.json ] || return 0
  ver="$(grep -m1 '"version"' node_modules/astro/package.json 2>/dev/null \
         | sed -e 's/.*"version"[^0-9]*//' -e 's/[^0-9].*//')"
  [ -n "$ver" ] && printf '%s' "$ver"
}

# --- 1. content config path ------------------------------------------------
# On v6 the only valid path is src/content.config.ts. The old src/content/config.ts
# is removed (LegacyContentConfigError). Treat its presence as a FAIL on v6, a WARN if version unknown.
if [ -f src/content/config.ts ]; then
  amajor="$(astro_major)"
  if [ -n "$amajor" ] && [ "$amajor" -ge 6 ] 2>/dev/null; then
    fail "src/content/config.ts exists on Astro ${amajor} — rename to src/content.config.ts (legacy path removed in v6)"
  else
    warn "src/content/config.ts found — on Astro 6 this must be src/content.config.ts"
  fi
elif [ -f src/content.config.ts ]; then
  ok "content config at src/content.config.ts"
else
  skip "no content config found — collections not in use"
fi

# --- 2. content schema imports ---------------------------------------------
# A content config should import defineCollection from astro:content (z comes from astro/zod).
if [ -f src/content.config.ts ]; then
  if grep -q 'astro:content' src/content.config.ts; then
    ok "content schema imports from astro:content"
  else
    warn "src/content.config.ts does not import from astro:content — schemas may be untyped"
  fi
fi

# --- 3. over-hydration smell -----------------------------------------------
# Count client:load occurrences and flag a high count; flag client:only without a framework.
load_count=0
only_bad=0
files="$(src_files)"
if [ -n "$files" ]; then
  load_count="$(printf '%s\n' "$files" | xargs grep -ho 'client:load' 2>/dev/null | grep -c 'client:load')"
  # client:only that is NOT immediately followed by ="<framework>"
  only_bad="$(printf '%s\n' "$files" \
    | xargs grep -hoE 'client:only(="[^"]+")?' 2>/dev/null \
    | grep -c 'client:only$' )"
fi
[ -z "$load_count" ] && load_count=0
[ -z "$only_bad" ] && only_bad=0

if [ "$load_count" -gt 5 ] 2>/dev/null; then
  warn "client:load appears ${load_count} times — prefer client:visible/idle/media; first-paint JS hurts LCP"
elif [ "$load_count" -gt 0 ] 2>/dev/null; then
  ok "client:load used sparingly (${load_count})"
else
  ok "no client:load directives (static-first)"
fi

if [ "$only_bad" -gt 0 ] 2>/dev/null; then
  warn "client:only used without a framework string (e.g. client:only=\"react\") in ${only_bad} place(s)"
fi

# --- 4. optional astro check ----------------------------------------------
if [ -x node_modules/.bin/astro ] || have astro; then
  printf '%s\n' "Running astro check... (read-only diagnostics)"
  if [ -x node_modules/.bin/astro ]; then
    if node_modules/.bin/astro check; then ok "astro check"; else fail "astro check"; fi
  elif have npx; then
    if npx --no-install astro check; then ok "astro check"; else fail "astro check"; fi
  fi
else
  skip "astro binary not resolvable — skipping astro check"
fi

# --- summary ---------------------------------------------------------------
printf '\n'
if [ "$warnings" -gt 0 ]; then
  printf '%s\n' "${YELLOW}verify.sh: ${warnings} warning(s) — advisory${RESET}"
fi
if [ "$failures" -gt 0 ]; then
  printf '%s\n' "${RED}verify.sh: ${failures} check(s) failed${RESET}"
  exit 1
fi
printf '%s\n' "${GREEN}verify.sh: all runnable checks passed${RESET}"
exit 0
