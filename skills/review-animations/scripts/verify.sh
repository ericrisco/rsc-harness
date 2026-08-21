#!/usr/bin/env bash
#
# verify.sh — the checkable half of the motion craft bar.
#
# WHAT THIS IS
#   The source material for these skills (emilkowalski/skills, MIT) ships its "Never Ship" bar as
#   a markdown table: prose an agent may or may not honor. Part of that bar is a plain pattern in
#   the code — `transition: all`, an entrance from `scale(0)`, `ease-in` on a UI transition — and
#   anything that is a pattern belongs in a binary, not in a paragraph (constitution P1).
#
#   So this script owns the countable half, and the SKILL.md bodies own the half that needs
#   judgement (is the frequency tier right? does the motion have a purpose? does it feel right?).
#   Nothing here can tell you whether an animation feels good. It tells you when it is definitely
#   wrong.
#
# WHAT IT CHECKS
#   - the tell registry: one row per checkable motion defect, iterated generically — see
#     motion_tell_table(). Every row has a fixture in tests/fixtures/motion-tells/ and is driven
#     from tests/motion-tells.test.js; a row without a fixture fails the suite.
#   - one counter that cannot be a row: motion present with no prefers-reduced-motion guard
#     anywhere. Absence of a guard is not a pattern match, so it gets its own check and its own
#     named test.
#
# HOW TO RUN (inside YOUR project, not the skills repo)
#   bash verify.sh              # fail-severity rows break the build; warns are advisory
#   bash verify.sh --strict     # treat warnings as failures too
#
# EXIT CODES
#   0  no fail-severity finding (and no warning, under --strict)
#   1  a fail-severity finding, or --strict with any warning
#   2  bad usage
#
# Missing tools are SKIPPED with a notice, never failed.

set -euo pipefail

# --- portability: runs on stock macOS bash 3.2 ------------------------------
# No mapfile, no associative arrays, no `${arr[@]}` under set -u — same constraint as design's
# verify.sh, for the same reason: the default /bin/bash on macOS is 3.2.
if [ -z "${BASH_VERSION:-}" ]; then
  printf 'This script requires bash (any version >= 3.2). Run: bash %s\n' "$0" >&2
  exit 2
fi

STRICT=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1; shift ;;
    -h|--help) sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; exit 2 ;;
  esac
done

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

ok_count=0; skip_count=0; warn_count=0; fail_count=0
SELF_NAME="$(basename "$0")"

ok()   { printf '%s  ok %s  %s\n'   "$GREEN" "$NC" "$1"; ok_count=$((ok_count + 1)); }
skip() { printf '%sskip %s  %s\n'   "$YELLOW" "$NC" "$1"; skip_count=$((skip_count + 1)); }
warn() { printf '%swarn %s  %s\n'   "$YELLOW" "$NC" "$1"; warn_count=$((warn_count + 1)); }
fail() { printf '%sfail %s  %s\n'   "$RED" "$NC" "$1"; fail_count=$((fail_count + 1)); }

have() { command -v "$1" >/dev/null 2>&1; }

search() {
  [ "$#" -gt 0 ] || return 1
  # VERIFY_FORCE_GREP=1 pins the grep branch so the suite can prove both engines agree, instead
  # of only exercising whichever one happens to be installed.
  if have rg && [ -z "${VERIFY_FORCE_GREP:-}" ]; then
    rg -n --no-heading --glob "!$SELF_NAME" "$@"
  else
    local pattern="${*: -1}"
    grep -rnE \
      --exclude="$SELF_NAME" \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
      --exclude-dir=dist --exclude-dir=build \
      "$pattern" . 2>/dev/null
  fi
}

# --- the tell registry ------------------------------------------------------
# Columns, delimited by %% (the pattern column needs `|` for ERE alternation):
#   id %% sev %% extensions %% POSIX-ERE pattern %% what to do instead / the legit exception
#
# Patterns are POSIX ERE: no lookahead, no \b, no \s — they must behave identically under rg and
# under grep -E. The bar they encode is adapted from emilkowalski/skills (MIT).
#
# Severity is load-bearing, not decoration. `fail` is for a defect with no legitimate reading;
# `warn` is for a pattern whose exception is real and cannot be seen from one line (a centered
# modal, an accordion animating height). A table where everything fails gets switched off (P7).
motion_tell_table() {
  cat <<'TELLS'
transition-all%%fail%%tsx,jsx,ts,js,css,scss,html,vue,svelte%%transition:[[:space:]]*all|transition-all%%transition: all animates every property that ever changes, including layout ones, and janks. Name the exact properties instead: transition-property: transform, opacity
scale-zero-entrance%%fail%%tsx,jsx,ts,js,css,scss,html,vue,svelte%%scale\(0\)|scale3d\(0,|scale:[[:space:]]*0[,;}[:space:]]%%nothing in the real world appears from nothing, so an entrance from zero scale reads as broken. Start from scale(0.9)-scale(0.97) plus opacity: 0
ease-in-ui%%fail%%tsx,jsx,ts,js,css,scss,html,vue,svelte%%(^|[^a-zA-Z])ease-in([^-]|$)%%ease-in starts slow, delaying the exact moment the user is watching, so the interface feels sluggish. Use ease-out, or the stronger cubic-bezier(0.23, 1, 0.32, 1). Legitimate exception: an exit that must accelerate off-screen
origin-center-popover%%warn%%tsx,jsx,ts,js,css,scss,html,vue,svelte%%transform-origin:[[:space:]]*center%%a popover, dropdown, menu or tooltip should grow out of the trigger that opened it, not out of its own middle. Use transform-origin: var(--transform-origin). Legitimate exception: a modal, which is not anchored to a trigger and stays centered
layout-property-animation%%warn%%css,scss%%transition-property:[[:space:]]*(width|height|margin|padding|top|left)|transition:[[:space:]]*(width|height|margin|padding|top|left)[[:space:]]%%animating a layout property triggers layout, paint and composite every frame. Animate transform and opacity instead. Legitimate exception: an accordion height, which has no transform equivalent
motion-shorthand-under-load%%warn%%tsx,jsx,ts,js%%animate=\{\{[[:space:]]*(x|y|scale):%%the Motion x/y/scale shorthands are not hardware-accelerated: they run on the main thread and drop frames while the page is busy. Use the full transform string: animate={{ transform: "translateX(100px)" }}
TELLS
}

run_motion_tell_table() {
  local line id sev globs pat msg hits exts rest
  # NOT `IFS='%%'`: IFS is a set of characters, so it would split on a single `%`. Parameter
  # expansion splits on the two-character delimiter exactly, which the pattern column needs to
  # keep its ERE `|`.
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    id="${line%%"%%"*}";    rest="${line#*"%%"}"
    sev="${rest%%"%%"*}";   rest="${rest#*"%%"}"
    globs="${rest%%"%%"*}"; rest="${rest#*"%%"}"
    pat="${rest%%"%%"*}";   msg="${rest#*"%%"}"
    exts="${globs//,/|}"
    # Two post-filters, both taken from design/scripts/verify.sh where they were learned from a
    # real run: keep only the extensions the row declares (anchored before the first colon, so it
    # behaves the same under rg and grep and never matches content that merely names a file), and
    # drop matches that sit inside a code comment. `ease-in` in `/* not ease-in */` is not code,
    # and flagging it trains the reader to ignore the tool.
    hits="$(search "$pat" 2>/dev/null \
      | grep -E "^[^:]*\.($exts):" \
      | grep -vE "^[^:]*:[0-9]+:[[:space:]]*(//|/\*|\*[^a-zA-Z]|#|<!--|\{/\*)" || true)"
    if [ -n "$hits" ]; then
      case "$sev" in
        warn) warn "$id: $msg" ;;
        *)    fail "$id: $msg" ;;
      esac
      printf '%s\n' "$hits" | head -n 5
    fi
  done <<EOF
$(motion_tell_table)
EOF
}

# --- the counter that cannot be a row ---------------------------------------
# Absence of a guard has no line to match, so it cannot ride the generic mechanism. It carries its
# own named test instead of pretending to be a row.
reduced_motion_counter() {
  # Only meaningful where motion actually exists: telling a backend repo to add a reduced-motion
  # guard is the noise that gets a checker switched off.
  if search 'transition:|transition-property|@keyframes|animation:|animate=\{|useSpring|animate-\[' >/dev/null 2>&1; then
    if search 'prefers-reduced-motion|useReducedMotion|motion-safe:|motion-reduce:' >/dev/null 2>&1; then
      ok "reduced-motion-missing: motion is present and a reduced-motion guard was found"
    else
      fail "reduced-motion-missing: this project animates but no prefers-reduced-motion guard was found anywhere. Reduced motion means fewer and gentler animations, not zero: keep opacity and color transitions that aid comprehension, drop movement and position changes"
    fi
  else
    skip "reduced-motion-missing: no motion found in this project, nothing to guard"
  fi
}

# --- run --------------------------------------------------------------------
run_motion_tell_table
reduced_motion_counter

printf '\nok=%d skip=%d warn=%d fail=%d\n' "$ok_count" "$skip_count" "$warn_count" "$fail_count"

if [ "$fail_count" -gt 0 ]; then exit 1; fi
if [ "$STRICT" -eq 1 ] && [ "$warn_count" -gt 0 ]; then exit 1; fi
exit 0
