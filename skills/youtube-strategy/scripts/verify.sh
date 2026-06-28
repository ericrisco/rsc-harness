#!/usr/bin/env bash
#
# verify.sh — structural lint for a youtube-strategy wiki under 02-DOCS/wiki/youtube/.
#
# WHAT IT DOES (read-only; never edits a file)
#   Static, network-free checks on the decision records the skill writes back.
#     1. The target directory exists.
#     2. At least one decision record is present: a file under decisions/*.md
#        OR a running decisions.md log at the target root.
#     3. Each decision record carries the three required signals:
#          - a date            (a YYYY-MM-DD anywhere in the file)
#          - a Decision: line   (the concrete choice)
#          - a named metric/bet (a "Bets on metric:" / "metric" / "bet" field)
#        A record missing the metric/bet field is a HARD FAILURE — a decision with
#        no metric is an opinion, not a checkable bet.
#     4. Each decision record carries a non-empty `type:` frontmatter field
#        (OKF v0.1 conformance). A record with no `type` is a HARD FAILURE.
#
#   Missing date or Decision line is also a hard failure. A missing/empty target
#   (a fresh channel with no wiki yet) is reported and exits 0 — no false failure.
#   Pure bash + grep, no dependencies. It is a lint, not a strategy oracle.
#
# HOW TO RUN
#   ./verify.sh 02-DOCS/wiki/youtube/    # lint a channel's strategy wiki
#   ./verify.sh                          # no target -> nothing to check, exit 0
#
# EXIT CODES
#   0  clean, or nothing to check
#   1  a hard structural failure
#   2  bad usage
#
# Runs on stock macOS bash 3.2.

set -euo pipefail

if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

ok_count=0; warn_count=0; fail_count=0
ok()   { printf '%s[ ok ]%s %s\n' "$GREEN"  "$NC" "$*"; ok_count=$((ok_count + 1)); }
warn() { printf '%s[warn]%s %s\n' "$YELLOW" "$NC" "$*"; warn_count=$((warn_count + 1)); }
fail() { printf '%s[fail]%s %s\n' "$RED"    "$NC" "$*"; fail_count=$((fail_count + 1)); }

usage() { sed -n '2,34p' "$0" | sed 's/^# \{0,1\}//'; }

summary_exit() {
  printf '\nok=%d warn=%d fail=%d\n' "$ok_count" "$warn_count" "$fail_count"
  [ "$fail_count" -gt 0 ] && exit 1
  exit 0
}

# --- arg parse --------------------------------------------------------------
TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -*) printf 'unknown flag: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    *) TARGET="$1"; shift ;;
  esac
done

# No target, or missing dir -> nothing to check, clean exit (no false fail).
if [ -z "$TARGET" ]; then
  ok "no wiki path given — nothing to lint"
  summary_exit
fi
if [ ! -d "$TARGET" ]; then
  warn "directory not found: $TARGET — nothing to lint (fresh channel?)"
  summary_exit
fi
ok "wiki directory exists: $TARGET"

# --- collect decision records ----------------------------------------------
# Per-decision files under decisions/, plus an optional running decisions.md log.
RECORDS=""
if [ -d "$TARGET/decisions" ]; then
  for f in "$TARGET"/decisions/*.md; do
    [ -f "$f" ] && RECORDS="$RECORDS$f
"
  done
fi
[ -f "$TARGET/decisions.md" ] && RECORDS="$RECORDS$TARGET/decisions.md
"

# Trim trailing newline / handle empty.
RECORDS="$(printf '%s' "$RECORDS" | sed '/^$/d')"

if [ -z "$RECORDS" ]; then
  warn "no decision records yet (decisions/*.md or decisions.md) — nothing to lint"
  summary_exit
fi

# --- per-record structural checks ------------------------------------------
DATE_RE='[0-9]{4}-[0-9]{2}-[0-9]{2}'

while IFS= read -r rec; do
  [ -z "$rec" ] && continue
  if [ ! -s "$rec" ]; then
    fail "$rec: empty record"
    continue
  fi

  miss=""
  grep -Eq "$DATE_RE"                    "$rec" || miss="$miss date"
  grep -Eiq '^[[:space:]-]*Decision:'    "$rec" || miss="$miss decision-line"
  grep -Eiq '(bets on metric:|metric|bet:)' "$rec" || miss="$miss metric/bet"
  # OKF v0.1: a non-empty `type:` frontmatter field is required.
  grep -Eiq '^[[:space:]]*type:[[:space:]]*[^[:space:]]' "$rec" || miss="$miss type"

  if [ -n "$miss" ]; then
    fail "$rec: missing required field(s):$miss"
  else
    ok "$rec: date + decision + metric present"
  fi
done <<EOF
$RECORDS
EOF

summary_exit
