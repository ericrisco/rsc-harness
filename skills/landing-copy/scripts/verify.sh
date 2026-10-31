#!/usr/bin/env bash
#
# verify.sh — static copy linter for the `landing-copy` skill.
#
# WHAT IT DOES (read-only; never edits a file)
#   Network-free static checks over a generated landing-copy file (or a tree):
#     1. HARD  no CTA at all (no button-style line, no movement-verb call to act).
#     2. HARD  no proof block (no testimonial/quote, metric or demonstration marker).
#     3. SOFT  H1 over ~8 words or ~60 chars (warn — clarity beats clever).
#     4. SOFT  competing CTAs — more than one distinct primary action verb used
#              as a button-style line (decision fatigue).
#     5. SOFT  no benefit-led subhead detected under the headline.
#     6. SOFT  banlist hype / AI-tell phrases (world-class, cutting-edge,
#              revolutionize, game-changer, seamlessly, unlock the power,
#              "in today's fast-paced world").
#     7. SOFT  "Submit" as button copy (prefer a movement verb).
#
#   Hard violations exit 1. Soft violations warn and exit 0 (copy is judgement).
#   An empty or clean target is a clean pass (exit 0) — no false failure.
#
# HOW TO RUN (point it at YOUR copy, not the skills repo)
#   ./verify.sh path/to/landing.md     # check one file
#   ./verify.sh                        # scan ./ for *.{md,mdx,txt,html,tsx,jsx}
#   ./verify.sh --path src             # scan a subdirectory
#   ./verify.sh --strict               # treat soft warnings as failure (exit 1)
#
# EXIT CODES
#   0  clean, empty target, or warnings-only without --strict
#   1  a hard violation, or --strict with any warning
#   2  bad usage
#
# Bash 3.2+, no external deps beyond grep/wc. Runs on stock macOS /bin/sh.

set -eu

if [ -t 1 ]; then
  RED=$(printf '\033[31m'); GRN=$(printf '\033[32m'); YEL=$(printf '\033[33m'); NC=$(printf '\033[0m')
else
  RED=''; GRN=''; YEL=''; NC=''
fi

warn_count=0
fail_count=0

ok()   { printf '%s[ ok ]%s %s\n'  "$GRN" "$NC" "$*"; }
warn() { printf '%s[warn]%s %s\n'  "$YEL" "$NC" "$*"; warn_count=$((warn_count + 1)); }
fail() { printf '%s[fail]%s %s\n'  "$RED" "$NC" "$*"; fail_count=$((fail_count + 1)); }

usage() { sed -n '2,33p' "$0" | sed 's/^#\{0,1\} \{0,1\}//'; }

TARGET=""
STRICT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --path) shift; TARGET="${1:-}" ;;
    -h|--help) usage; exit 0 ;;
    -*) printf 'unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    *) TARGET="$1" ;;
  esac
  shift
done
[ -n "$TARGET" ] || TARGET="."

# --- collect files ----------------------------------------------------------
FILES=""
if [ -f "$TARGET" ]; then
  FILES="$TARGET"
elif [ -d "$TARGET" ]; then
  FILES=$(find "$TARGET" -type f \
    \( -name '*.md' -o -name '*.mdx' -o -name '*.txt' \
       -o -name '*.html' -o -name '*.tsx' -o -name '*.jsx' \) 2>/dev/null \
    | grep -v '/node_modules/' || true)
else
  printf 'no such file or directory: %s\n' "$TARGET" >&2
  exit 2
fi

if [ -z "$FILES" ]; then
  ok "no copy files found under '$TARGET' — nothing to check"
  exit 0
fi

# movement verbs that mark a real CTA (case-insensitive)
CTA_VERBS='start|get|see|book|claim|try|join|download|create|build|grab|reserve|unlock my|request|schedule|sign up|buy'

# banlist of hype / AI-tell phrases
BANLIST='world-class|cutting-edge|revolutioni[sz]e|game-changer|game changer|seamlessly|unlock the power|in today.?s fast-paced world|next-level|best-in-class'

checked=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  [ -s "$f" ] || continue
  checked=$((checked + 1))

  # 1. HARD: CTA present? look for a movement verb on a short line (button-style)
  #    or any markdown/HTML button-like construct.
  if grep -Eiq "$CTA_VERBS" "$f" || grep -Eiq '<button|\[[^]]+\]\(|role="button"' "$f"; then
    :
  else
    fail "$f: no CTA found (no movement verb, no button) — a page needs one primary action"
  fi

  # 2. HARD: a proof-shaped block exists. This heuristic does NOT verify truth or permissions.
  if grep -Eiq 'demonstration|demo:|demostración|demostracion|"|“|”|>|—|--|testimonial|trusted by|review' "$f" \
     || grep -Eq '[0-9]+%|[0-9]+x|\$[0-9]|[0-9][0-9,]+ (customers|teams|users)' "$f"; then
    :
  else
    fail "$f: no proof block found (add a sourced demonstration, testimonial or metric) — belief is built next to the ask"
  fi

  # 3. SOFT: H1 length. First markdown '# ' heading or first non-empty line.
  h1=$(grep -m1 -E '^#[^#]' "$f" 2>/dev/null | sed 's/^#\{1,6\} *//' || true)
  [ -n "$h1" ] || h1=$(grep -m1 -E '.' "$f" 2>/dev/null || true)
  if [ -n "$h1" ]; then
    words=$(printf '%s' "$h1" | wc -w | tr -d ' ')
    chars=$(printf '%s' "$h1" | wc -m | tr -d ' ')
    if [ "$words" -gt 8 ] || [ "$chars" -gt 60 ]; then
      warn "$f: headline is ${words} words / ${chars} chars (aim <=8 words / ~44-60 chars; clear beats clever)"
    fi
  fi

  # 4. SOFT: competing CTAs — count DISTINCT movement-verb button-style lines.
  #    a short line (<=6 words) that starts with a CTA verb counts as a button.
  distinct=$(grep -Eio "$CTA_VERBS" "$f" 2>/dev/null \
    | tr 'A-Z' 'a-z' | sort -u | wc -l | tr -d ' ')
  if [ "${distinct:-0}" -gt 1 ]; then
    warn "$f: ${distinct} distinct CTA verbs detected — use ONE primary action, repeated (decision fatigue)"
  fi

  # 5. SOFT: benefit-led subhead. Heuristic: a line near the top that frames an
  #    outcome ("so ", "for ", "without ", "in <n> ") under the headline.
  if grep -Eiq '(^|[^a-z])(so |so you|for [a-z]|without |in [0-9])' "$f"; then
    :
  else
    warn "$f: no benefit-led subhead detected — the subhead should carry the outcome (who + benefit)"
  fi

  # 6. SOFT: banlist hits.
  hits=$(grep -Eio "$BANLIST" "$f" 2>/dev/null | sort -u || true)
  if [ -n "$hits" ]; then
    for h in $hits; do
      warn "$f: hype/AI-tell phrase '$h' — replace with a number or a named result"
    done
  fi

  # 7. SOFT: "Submit" as button copy.
  if grep -Eiq '(^|[^a-z])submit([^a-z]|$)' "$f"; then
    warn "$f: 'Submit' as button copy — use a movement verb that states the value (e.g. 'Start my free trial')"
  fi
done <<< "$FILES"

printf '\n'
if [ "$fail_count" -gt 0 ]; then
  fail "$fail_count hard violation(s), $warn_count warning(s) across $checked file(s)"
  exit 1
fi
if [ "$warn_count" -gt 0 ]; then
  warn "$warn_count warning(s) across $checked file(s)"
  [ "$STRICT" -eq 1 ] && { printf '%s--strict: treating warnings as failure%s\n' "$RED" "$NC"; exit 1; }
  exit 0
fi
ok "clean — $checked file(s) checked, no violations"
exit 0
