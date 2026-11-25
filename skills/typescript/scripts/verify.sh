#!/usr/bin/env bash
# verify.sh — prove the TS toolchain enforces strictness + exhaustiveness.
# Read-only on the target: writes ONLY to its own temp dir. Exits 0 with a clear
# message when no TS/node is available (no false failure on a clean machine).
set -euo pipefail

# Resolve a TypeScript 7 type-checker: a `tsc` on PATH that reports 7.x, else
# `npx` fetching typescript@^7 (the native compiler, binary `tsc`).
# Strict flags are passed on the CLI; --ignoreConfig keeps any tsconfig.json out of
# the way (TS 7 refuses CLI file names next to a tsconfig.json without it).
FLAGS="--ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --target esnext --module nodenext --moduleResolution nodenext"
if command -v tsc >/dev/null 2>&1 && tsc -v 2>/dev/null | grep -Eq 'Version ([7-9]|[1-9][0-9])\.'; then
  CHECK="tsc"
elif command -v npx >/dev/null 2>&1; then
  CHECK="npx -y -p typescript@^7 tsc"
else
  echo "SKIP: no TypeScript 7 tsc and no npx on PATH — cannot type-check. (exit 0)"
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "checker: $( (cd "$TMP" && $CHECK -v) 2>/dev/null || echo unknown)"

# good.ts: exhaustive never guard MUST pass.
cat > "$TMP/good.ts" <<'TS'
type S = { k: "a" } | { k: "b" };
export function f(s: S): number {
  switch (s.k) {
    case "a": return 1;
    case "b": return 2;
    default: { const _: never = s; return _; }
  }
}
TS

# bad.ts: missing "b" case -> never guard MUST fail to compile.
cat > "$TMP/bad.ts" <<'TS'
type S = { k: "a" } | { k: "b" };
export function f(s: S): number {
  switch (s.k) {
    case "a": return 1;
    default: { const _: never = s; return _; }
  }
}
TS

# index.ts: noUncheckedIndexedAccess — arr[0] is number | undefined, MUST fail.
cat > "$TMP/index.ts" <<'TS'
export function first(arr: number[]): number { return arr[0]; }
TS

run() { ( cd "$TMP" && $CHECK $FLAGS "$1" ) >/dev/null 2>&1; }

fail=0
if run good.ts;  then echo "PASS: good.ts type-checks"; else echo "FAIL: good.ts should compile"; fail=1; fi
if run bad.ts;   then echo "FAIL: bad.ts should NOT compile (exhaustiveness)"; fail=1; else echo "PASS: bad.ts rejected"; fi
if run index.ts; then echo "FAIL: index.ts should NOT compile (noUncheckedIndexedAccess)"; fail=1; else echo "PASS: index.ts rejected"; fi

if [ "$fail" -ne 0 ]; then echo "verify.sh: FAILED"; exit 1; fi
echo "verify.sh: OK — strict + exhaustiveness + indexed access enforced"
