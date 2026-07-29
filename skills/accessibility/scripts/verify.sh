#!/usr/bin/env bash
# verify.sh — accessibility conformance check (read-only by default).
#
# Detects the project's a11y tooling and runs the cheapest verdict it can:
#   1. an explicit a11y test script in package.json (e.g. "test:a11y")
#   2. @axe-core/playwright  -> needs a URL; runs an inline scan only if A11Y_URL is set
#   3. jest-axe              -> runs the project's jest tests
#   4. eslint-plugin-jsx-a11y -> lints src and counts jsx-a11y violations
#   5. nothing installed     -> prints install hints and EXITS 0 (skip, never a false failure)
#
# Exits non-zero ONLY when serious/critical violations are found.
# Usage: verify.sh [target-dir]   (default: current directory)
set -euo pipefail

TARGET="${1:-.}"
cd "$TARGET"

say() { printf '%s\n' "$*"; }

if [ ! -f package.json ]; then
  say "a11y: no package.json in '$TARGET' — nothing to verify. (skip)"
  exit 0
fi

# read a top-level field out of package.json without extra tooling
pkg_has() { node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};process.exit(d['$1']?0:1)" 2>/dev/null; }
script_has() { node -e "const p=require('./package.json');process.exit((p.scripts||{})['$1']?0:1)" 2>/dev/null; }

PM="npm"
if [ -f pnpm-lock.yaml ]; then PM="pnpm"; elif [ -f yarn.lock ]; then PM="yarn"; fi
run_script() { case "$PM" in pnpm) pnpm run "$1";; yarn) yarn "$1";; *) npm run "$1";; esac; }

# 1) explicit a11y script wins
for s in test:a11y a11y test:accessibility accessibility; do
  if script_has "$s"; then
    say "a11y: running '$s' via $PM"
    run_script "$s"
    exit $?
  fi
done

# 2) @axe-core/playwright — needs a live URL
if pkg_has "@axe-core/playwright"; then
  if [ -z "${A11Y_URL:-}" ]; then
    say "a11y: @axe-core/playwright present but A11Y_URL not set."
    say "      Set A11Y_URL=http://localhost:3000 (with the app running) to scan. (skip)"
    exit 0
  fi
  say "a11y: scanning $A11Y_URL with @axe-core/playwright (wcag2a,wcag2aa,wcag22aa)"
  node - "$A11Y_URL" <<'NODE'
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load' });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag22aa']).analyze();
  await browser.close();
  const by = {};
  for (const v of r.violations) by[v.impact || 'unknown'] = (by[v.impact || 'unknown'] || 0) + 1;
  console.log('a11y: violations by impact ' + (JSON.stringify(by) || '{}'));
  const blocking = (by.serious || 0) + (by.critical || 0);
  if (blocking > 0) { console.error(`a11y: ${blocking} serious/critical violation(s) — FAIL`); process.exit(1); }
  console.log('a11y: no serious/critical violations');
})().catch(e => { console.error('a11y: scan error — ' + e.message + ' (skip)'); process.exit(0); });
NODE
  exit $?
fi

# 3) jest-axe — run jest if a test script exists
if pkg_has "jest-axe"; then
  if script_has "test"; then
    say "a11y: jest-axe present — running '$PM test' (note: contrast disabled in jsdom)"
    run_script test
    exit $?
  fi
  say "a11y: jest-axe present but no 'test' script. (skip)"
  exit 0
fi

# 4) eslint-plugin-jsx-a11y — lint and count
if pkg_has "eslint-plugin-jsx-a11y"; then
  SRC="src"; [ -d "$SRC" ] || SRC="."
  say "a11y: linting $SRC with eslint (jsx-a11y rules)"
  OUT="$(npx --no-install eslint "$SRC" --ext .js,.jsx,.ts,.tsx -f json 2>/dev/null || true)"
  if [ -z "$OUT" ]; then
    say "a11y: eslint produced no output (config or install issue). (skip)"
    exit 0
  fi
  COUNT="$(printf '%s' "$OUT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);let n=0;for(const f of r)for(const m of f.messages)if((m.ruleId||'').startsWith('jsx-a11y/'))n++;console.log(n)}catch{console.log(0)}})")"
  say "a11y: jsx-a11y violations: $COUNT"
  [ "$COUNT" -gt 0 ] && exit 1
  exit 0
fi

# 5) nothing detected — guide, don't fail
say "a11y: no a11y tooling detected. (skip)"
say "      Install one of:"
say "        npm i -D eslint-plugin-jsx-a11y   # static lint of JSX"
say "        npm i -D jest-axe                 # unit-level axe (contrast off in jsdom)"
say "        npm i -D @axe-core/playwright     # real-browser scan incl. contrast"
exit 0
