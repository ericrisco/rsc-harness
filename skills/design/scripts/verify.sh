#!/usr/bin/env bash
#
# verify.sh — design-review gate for the `design` skill.
#
# WHAT IT DOES
#   1. If a dev server is reachable AND Lighthouse is available, runs a
#      performance + accessibility audit and checks Core Web Vitals against the
#      skill's hard thresholds (LCP < 2.5s, CLS < 0.1, INP proxy via TBT < 200ms,
#      a11y score >= 0.9).
#   2. Always runs static, network-free design-review grep checks (one <h1>,
#      no `transition: all`, hardcoded hex vs tokens, missing image alt, missing
#      prefers-reduced-motion, marketing ban-list words).
#   3. If Lighthouse did not run, prints the manual QA checklist. For a graded
#      0-10 critique, use the visual-audit rubric in SKILL.md instead.
#
# HOW TO RUN (inside YOUR project, not the skills repo)
#   ./verify.sh                       # static checks + Lighthouse if localhost:3000 is up
#   ./verify.sh --url http://localhost:3001
#   ./verify.sh --strict              # treat warnings as failures (exit 1 on any warn)
#
# EXIT CODES
#   0  no real failures (warnings allowed unless --strict)
#   1  a real failure (failed Lighthouse threshold), or --strict with any warning
#   2  bad usage
#
# Missing tools are SKIPPED with a yellow notice, never failed.

set -euo pipefail

# --- portability: runs on stock macOS bash 3.2 ------------------------------
# This script intentionally avoids bash 4+ features (no `mapfile`/`readarray`,
# no associative arrays, no `${arr[@]}` under set -u). It uses only scalar
# counters and `read` loops, so it degrades gracefully on the default macOS
# /bin/bash (3.2). If somehow run under an older/non-bash shell, warn and exit
# cleanly rather than crashing.
if [ -z "${BASH_VERSION:-}" ]; then
  printf 'This script requires bash (any version >= 3.2). Run: bash %s\n' "$0" >&2
  exit 2
fi

# --- color helpers (no escape codes when not a TTY) -------------------------
if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

ok_count=0; skip_count=0; warn_count=0; fail_count=0

ok()   { printf '%s[ ok ]%s %s\n'   "$GREEN"  "$NC" "$*"; ok_count=$((ok_count + 1)); }
skip() { printf '%s[skip]%s %s\n'   "$YELLOW" "$NC" "$*"; skip_count=$((skip_count + 1)); }
warn() { printf '%s[warn]%s %s\n'   "$YELLOW" "$NC" "$*"; warn_count=$((warn_count + 1)); }
fail() { printf '%s[fail]%s %s\n'   "$RED"    "$NC" "$*"; fail_count=$((fail_count + 1)); }

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
}

# --- arg parse --------------------------------------------------------------
URL="http://localhost:3000"
STRICT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --url)    URL="${2:?--url needs a value}"; shift 2 ;;
    --strict) STRICT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf '%sUnknown argument: %s%s\n\n' "$RED" "$1" "$NC"; usage; exit 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

# search wrapper: ripgrep if present, else portable grep -rnE. Both print file:line.
# Excludes build/vendor dirs and this script itself so it never matches its own
# source (e.g. the `transition: all` strings in its comments). Patterns passed
# here MUST be POSIX-ERE (no PCRE lookaheads) so the grep fallback behaves the
# same as the rg path — see note on the img-alt check below.
SELF_NAME="$(basename "$0")"
search() {
  [ "$#" -gt 0 ] || return 1
  # VERIFY_FORCE_GREP=1 pins the grep branch. It exists so the test suite can prove BOTH
  # engines agree on the multibyte patterns (em-dash, middot) on any machine, instead of
  # only exercising whichever one happens to be installed.
  if have rg && [ -z "${VERIFY_FORCE_GREP:-}" ]; then
    # rg already ignores .gitignore'd paths (node_modules, .next, dist); also skip self.
    rg -n --no-heading --glob "!$SELF_NAME" "$@"
  else
    # last arg is the pattern; everything before are paths/globs we ignore for grep.
    # `${*: -1}` (last positional) is supported on bash 3.2; the space before -1 is required.
    local pattern="${*: -1}"
    grep -rnE \
      --exclude="$SELF_NAME" \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
      --exclude-dir=dist --exclude-dir=build --exclude-dir=.next \
      "$pattern" . 2>/dev/null
  fi
}

LH_RAN=0

# --- Lighthouse step (guarded) ---------------------------------------------
run_lighthouse() {
  if ! { have lighthouse || have npx; }; then
    skip "lighthouse not found — skipping perf/a11y run"
    return
  fi
  if ! have curl || ! curl -sf --max-time 3 "$URL" >/dev/null 2>&1; then
    skip "no dev server at $URL — start it (e.g. npm run dev) to run Lighthouse"
    return
  fi

  local tmp; tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  local out="$tmp/lh.json"
  printf 'Running Lighthouse against %s ...\n' "$URL"
  if have lighthouse; then
    lighthouse "$URL" --quiet --chrome-flags="--headless=new" \
      --only-categories=performance,accessibility \
      --output=json --output-path="$out" >/dev/null 2>&1 || true
  else
    npx --no-install lighthouse "$URL" --quiet --chrome-flags="--headless=new" \
      --only-categories=performance,accessibility \
      --output=json --output-path="$out" >/dev/null 2>&1 || true
  fi

  if [ ! -s "$out" ]; then
    skip "Lighthouse produced no report (Chrome missing?) — skipping perf/a11y"
    return
  fi
  LH_RAN=1

  # metric extractor: jq preferred, node fallback
  metric() {
    local jqpath="$1" nodeexpr="$2"
    if have jq; then
      jq -r "$jqpath // empty" "$out" 2>/dev/null
    elif have node; then
      node -e "const d=require('$out');const v=$nodeexpr;process.stdout.write(v==null?'':String(v))" 2>/dev/null
    fi
  }

  local lcp cls tbt a11y
  lcp="$(metric '.audits["largest-contentful-paint"].numericValue' 'd.audits["largest-contentful-paint"].numericValue')"
  cls="$(metric '.audits["cumulative-layout-shift"].numericValue' 'd.audits["cumulative-layout-shift"].numericValue')"
  tbt="$(metric '.audits["total-blocking-time"].numericValue' 'd.audits["total-blocking-time"].numericValue')"
  a11y="$(metric '.categories.accessibility.score' 'd.categories.accessibility.score')"

  if [ -n "$lcp" ]; then
    if awk "BEGIN{exit !($lcp < 2500)}"; then ok "LCP ${lcp}ms < 2500ms"; else fail "LCP ${lcp}ms >= 2500ms"; fi
  else
    skip "LCP not reported"
  fi
  if [ -n "$cls" ]; then
    if awk "BEGIN{exit !($cls < 0.1)}"; then ok "CLS ${cls} < 0.1"; else fail "CLS ${cls} >= 0.1"; fi
  else
    skip "CLS not reported"
  fi
  if [ -n "$tbt" ]; then
    if awk "BEGIN{exit !($tbt < 200)}"; then ok "INP proxy (TBT) ${tbt}ms < 200ms"; else fail "INP proxy (TBT) ${tbt}ms >= 200ms"; fi
  else
    skip "TBT (INP proxy) not reported"
  fi
  if [ -n "$a11y" ]; then
    if awk "BEGIN{exit !($a11y >= 0.9)}"; then ok "a11y score ${a11y} >= 0.9"; else fail "a11y score ${a11y} < 0.9"; fi
  else
    skip "a11y score not reported"
  fi
}

# --- the tell registry ------------------------------------------------------
# One row per checkable AI tell. A row is DATA, not code, so the test suite can enumerate
# every row and demand a fixture for each: a check nobody has ever seen fire cannot ship.
# Add a tell by adding a row plus tests/fixtures/design-tells/tells/<id>.tsx — nothing else.
#
# Columns, delimited by %% (the pattern column needs `|` for ERE alternation):
#   id %% sev %% extensions %% POSIX-ERE pattern %% what to do instead / the legit exception
#
# Patterns are POSIX ERE: no lookahead, no \b, no \s — they must behave identically under rg
# and under grep -E. Part of the corpus is adapted from Leonxlnx/taste-skill (MIT).
tell_table() {
  cat <<'TELLS'
em-dash%%warn%%tsx,jsx,html,vue,svelte,mdx%%—|–%%em-dash or en-dash in rendered copy is the loudest AI tell. Use a period, a comma, a colon or parentheses instead
scroll-cue%%warn%%tsx,jsx,html,vue,svelte%%[Ss]croll to (explore|walk|discover|see|begin)|↓ *[Ss]croll%%a scroll cue explains scrolling to someone already looking at the hero. Delete it, or use a real anchor link instead
numbered-eyebrow%%warn%%tsx,jsx,html,vue,svelte%%(^|[^0-9A-Za-z])[0-9]{2,3} +(·|/) +[A-Za-z]%%numbered section eyebrow (001 · Capabilities). Name the topic in plain language instead
version-stamp%%warn%%tsx,jsx,html,vue,svelte%%v[0-9]+\.[0-9]+\.[0-9]+|Build [0-9]{3,4}%%a build or version stamp is devtool furniture on a marketing page. Delete it. Legitimate exception: a real devtool footer, a changelog or a release page
viewport-unit%%warn%%tsx,jsx,html,vue,svelte,css%%h-screen%%h-screen jumps when mobile browser chrome slides away. Use min-h-[100dvh] instead
middot-chain%%warn%%tsx,jsx,html,vue,svelte%%·[^·]*·%%more than one middot on a line is decoration pretending to be metadata. Use line breaks, columns or a hairline instead
transition-all%%warn%%tsx,jsx,css,html,vue,svelte%%transition:[[:space:]]*all|transition-all%%transition-all animates layout properties and janks. List the exact properties instead
ban-list%%warn%%tsx,jsx,html,md,mdx%%revolutionary|game-?changer|cutting-edge|supercharge|seamless|unlock%%hype words carry no value prop. Use the concrete benefit and a real number instead
TELLS
}

run_tell_table() {
  local line id sev globs pat msg hits exts rest
  # NOT `IFS='%%'`: IFS is a set of characters, so it would split on a single `%` and put an
  # empty field between every pair. Parameter expansion splits on the two-character
  # delimiter exactly, which is what the pattern column needs to keep its ERE `|`.
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    id="${line%%"%%"*}";    rest="${line#*"%%"}"
    sev="${rest%%"%%"*}";   rest="${rest#*"%%"}"
    globs="${rest%%"%%"*}"; rest="${rest#*"%%"}"
    pat="${rest%%"%%"*}";   msg="${rest#*"%%"}"
    exts="${globs//,/|}"
    # Both engines print `path:line:content`, so anchoring the extension before the first
    # colon filters identically under rg and grep (and never matches content that merely
    # mentions a filename).
    # Two post-filters, both learned from a real run over this repo:
    #   1. keep only the extensions the row declares (anchored before the first colon, so it
    #      behaves the same under rg and grep and never matches content that names a file);
    #   2. drop lines whose match sits in a code comment. A dash in `/* tokens — lifted */`
    #      is not rendered copy, and flagging it trains the reader to ignore the tool.
    hits="$(search "$pat" 2>/dev/null \
      | grep -E "^[^:]*\.($exts):" \
      | grep -vE "^[^:]*:[0-9]+:[[:space:]]*(//|/\*|\*[^a-zA-Z]|#|<!--|\{/\*)" || true)"
    if [ -n "$hits" ]; then
      # The sev column is real, not decoration: anything other than `warn` breaks the build.
      case "$sev" in
        warn) warn "$id: $msg" ;;
        *)    fail "$id: $msg" ;;
      esac
      printf '%s\n' "$hits" | head -n 5
    fi
  done <<EOF
$(tell_table)
EOF
}

# --- counters: the tells that are a ratio or a repetition, not a pattern -----
# These cannot be table rows because one match proves nothing — it takes a count. Each one
# carries its own named test instead of riding the generic row mechanism.
counter_checks() {
  local eyebrows sections ceiling hits variants v

  # Eyebrow ceiling. Threshold ceil(sections/3) is BORROWED from taste-skill and has never
  # been calibrated against a page of ours — the warning says so rather than implying rigour.
  eyebrows="$(search 'uppercase[^"]*tracking|tracking[^"]*uppercase' 2>/dev/null | grep -cE '^[^:]*\.(tsx|jsx|html|vue|svelte):' || true)"
  sections="$(search '<section' 2>/dev/null | grep -cE '^[^:]*\.(tsx|jsx|html|vue|svelte):' || true)"
  [ -z "$eyebrows" ] && eyebrows=0
  [ -z "$sections" ] && sections=0
  if [ "$sections" -eq 0 ]; then
    if [ "$eyebrows" -gt 0 ]; then
      skip "eyebrow ceiling: no <section> found, so there is no denominator — not guessing one"
    fi
  else
    ceiling=$(( (sections + 2) / 3 ))
    if [ "$eyebrows" -gt "$ceiling" ]; then
      warn "eyebrow count $eyebrows exceeds the ceiling $ceiling for $sections sections (uncalibrated threshold, borrowed): drop the uppercase micro-labels, or let the headline carry it instead"
    fi
  fi

  # A hairline above AND below every row of a long list is the laziest possible layout.
  hits="$(search 'border-t[^"]*border-b|border-b[^"]*border-t' 2>/dev/null | grep -cE '^[^:]*\.(tsx|jsx|html|vue|svelte):' || true)"
  [ -z "$hits" ] && hits=0
  if [ "$hits" -gt 3 ]; then
    warn "double border on $hits list rows: pick one edge, or use spacing instead of hairlines"
  fi

  # More than two radius scales in one tree means no radius system at all.
  variants=0
  for v in none sm md lg xl 2xl 3xl full; do
    if search "rounded-$v" >/dev/null 2>&1; then variants=$((variants + 1)); fi
  done
  if [ "$variants" -gt 2 ]; then
    warn "$variants different radius scales in use: one radius system per project — use a --radius-* token instead"
  fi
}

# --- static design-review checks (always run, no network) -------------------
static_checks() {
  local hits

  # 1. more than one <h1> in any single file
  if have rg; then
    while IFS= read -r line; do
      [ -n "$line" ] && warn "multiple <h1> in one file: $line"
    done < <(rg -c '<h1' --glob "!$SELF_NAME" --glob '*.{tsx,jsx,html,vue,svelte}' . 2>/dev/null | awk -F: '$NF>1' || true)
  else
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      case "$f" in */"$SELF_NAME"|"./$SELF_NAME") continue ;; esac
      if [ "$(grep -c '<h1' "$f" 2>/dev/null || echo 0)" -gt 1 ]; then warn "multiple <h1> in one file: $f"; fi
    done < <(grep -rl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next '<h1' . 2>/dev/null || true)
  fi

  # 2. (moved) `transition: all` is now a row in tell_table() — it is a plain pattern, so it
  #    gets the generic mechanism and its fixture for free.

  # 3. hardcoded hex when a token system exists (\b is not portable in ERE; a
  #    3-8 char hex run after # is a sufficient heuristic without the boundary).
  if search '@theme|--color-' >/dev/null 2>&1; then
    hits="$(search '#[0-9a-fA-F]{3,8}' 2>/dev/null | grep -E '\.(tsx|jsx|css)' || true)"
    if [ -n "$hits" ]; then warn "hardcoded hex colors despite a token system (heuristic):"; printf '%s\n' "$hits" | head -n 5; fi
  fi

  # 4. <img> / <Image without alt.
  #    POSIX ERE (the grep fallback) has NO lookahead, so we do it in two
  #    lookahead-free stages that behave identically under rg and grep:
  #    find single-line image tags, then drop the ones that carry alt=.
  #    Heuristic: tags split across multiple lines are not caught (acceptable —
  #    this is a fast lint, not an AST), and it never errors on either engine.
  hits="$(search '<(img|Image)[^>]' 2>/dev/null | grep -iE '\.(tsx|jsx|html|vue|svelte)' | grep -vE '\balt=' || true)"
  if [ -n "$hits" ]; then warn "image without alt= found (single-line tags):"; printf '%s\n' "$hits" | head -n 5; fi

  # 5. animations present but no prefers-reduced-motion anywhere
  if search '@keyframes|animation:|animate-' >/dev/null 2>&1; then
    if ! search 'prefers-reduced-motion' >/dev/null 2>&1; then
      warn "animations present but no prefers-reduced-motion guard found"
    fi
  fi

  # 6. (moved) the marketing ban-list is now a row in tell_table(), same reason as #2.
}

# --- fallback manual checklist ----------------------------------------------
print_checklist() {
  cat <<'EOF'

Manual design-review checklist (Lighthouse did not run):
  [ ] Value prop legible in 5 seconds above the fold.
  [ ] Text contrast >= 4.5:1 (3:1 for large text / UI).
  [ ] Visible focus state on all interactive elements.
  [ ] Touch targets 44x44px (recommended); never below the 24x24px WCAG 2.2 AA floor (SC 2.5.8).
  [ ] prefers-reduced-motion honored.
  [ ] Exactly one <h1> on the page.
  [ ] Semantic landmarks present (header/nav/main/section/footer).
  [ ] LCP image has priority.
  [ ] Fonts use next/font (no CLS / FOUT swap shift).
  [ ] No transition: all / transition-all.
  [ ] Tokens used (no magic hex / px).
  [ ] Ban-list words absent from copy.
  [ ] Text fits at 360px and desktop without overflow.
  [ ] Empty / loading / hover / error states designed.
EOF
}

# --- run --------------------------------------------------------------------
run_lighthouse
static_checks
run_tell_table
counter_checks
[ "$LH_RAN" -eq 0 ] && print_checklist

printf '\nok=%d skip=%d warn=%d fail=%d\n' "$ok_count" "$skip_count" "$warn_count" "$fail_count"

if [ "$fail_count" -gt 0 ]; then exit 1; fi
if [ "$STRICT" -eq 1 ] && [ "$warn_count" -gt 0 ]; then exit 1; fi
exit 0
