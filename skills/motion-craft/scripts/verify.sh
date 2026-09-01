#!/usr/bin/env bash
#
# verify.sh — the never-animate list of `motion-craft`, made mechanical.
#
# The SKILL.md declares rules as binding ("never animate layout", "never
# `transition: all`"). A rule declared binding without a mechanism that checks it
# is a decorative gate: it buys the feeling of safety without the safety. So each
# hard rule in the skill body has a row here, and each row has a fixture in
# tests/motion-craft-rules.test.js that watches it FAIL and then PASS.
#
# Static and network-free. Everything WARNS by default; --strict makes findings
# fatal, which is what CI should use.
set -u
TARGET="${1:-.}"
STRICT=0
[ "${2:-}" = "--strict" ] && STRICT=1
[ "${1:-}" = "--strict" ] && { STRICT=1; TARGET="."; }

warn_count=0
warn() { printf '  ⚠  %s\n' "$1"; warn_count=$((warn_count + 1)); }
ok()   { printf '  ✓  %s\n' "$1"; }

# id <TAB> grep -E pattern <TAB> message
# One row per hard rule in SKILL.md §"What must never animate". Adding a rule to
# the prose without adding it here is what the test suite refuses to allow.
#
# Fields are TAB-separated on purpose: the patterns are extended regexes and are
# full of `|`, so a pipe delimiter silently truncated every pattern at its first
# alternation and only the one rule without alternation ever fired.
rules() {
  printf '%b\n' \
    "transition-all\ttransition:[[:space:]]*all\t\`transition: all\` animates layout by accident — list the exact properties" \
    "layout-anim\ttransition:[^;]*(width|height|top:|left:|right:|bottom:|margin|padding)\tanimating layout properties forces reflow every frame — use transform and opacity" \
    "linear-move\t(transition|animation):[^;]*(transform|translate|scale)[^;]*linear\tlinear easing on positional movement reads as mechanical — nothing physical starts at full speed" \
    "long-duration\t(transition|animation):[^;]*[^0-9]([5-9][0-9][0-9]|[0-9][0-9][0-9][0-9])ms\tover 400ms stops being a transition and becomes a wait"
}

files=$(find "$TARGET" \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .next \) -prune -o \
  \( -name '*.css' -o -name '*.scss' -o -name '*.tsx' -o -name '*.jsx' -o -name '*.ts' -o -name '*.js' -o -name '*.vue' -o -name '*.svelte' \) -print 2>/dev/null)

echo "motion-craft — never-animate checks"
if [ -z "$files" ]; then
  echo "  (no style or component files found under $TARGET)"
  exit 0
fi

while IFS=$'\t' read -r id pattern message; do
  [ -z "$id" ] && continue
  hits=$(printf '%s\n' "$files" | xargs grep -lEi -- "$pattern" 2>/dev/null | head -5)
  if [ -n "$hits" ]; then
    warn "$id: $message"
    printf '        %s\n' $hits
  else
    ok "$id"
  fi
done <<< "$(rules)"

# reduced-motion is a finishing condition, not an edge case: if anything animates
# at all, the project must say what it does for people who asked for less motion.
if printf '%s\n' "$files" | xargs grep -lEi -- '(transition|animation|@keyframes)' >/dev/null 2>&1; then
  if printf '%s\n' "$files" | xargs grep -lEi -- 'prefers-reduced-motion' >/dev/null 2>&1; then
    ok "reduced-motion: honoured somewhere"
  else
    warn "reduced-motion: this project animates and never mentions prefers-reduced-motion — unchecked means unfinished"
  fi
fi

echo
if [ "$warn_count" -gt 0 ]; then
  echo "$warn_count finding(s)."
  [ "$STRICT" -eq 1 ] && exit 1
else
  echo "No findings."
fi
exit 0
