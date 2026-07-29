#!/usr/bin/env bash
#
# verify.sh — static hygiene/currency check for the react-native skill content.
#
# Usage:
#   ./scripts/verify.sh [TARGET_PATH]    # defaults to the skill dir (this script's parent's parent)
#
# Greps SKILL.md + references/ for currency and rsc-hygiene violations and prints each hit
# with a fix hint. Read-only: never edits a file. On a clean tree — or a target with no
# SKILL.md at all — it prints an ok line and exits 0 (no false failure). Exits 1 only when a
# violation is present, so it doubles as a non-blocking lint signal.
#
# Compatible with stock macOS bash 3.2: no mapfile, no associative arrays.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$(dirname "$SCRIPT_DIR")}"

if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi

if [ ! -e "$TARGET" ]; then
  printf '%serror:%s target path %s does not exist.\n' "$RED" "$RESET" "$TARGET" >&2
  exit 2
fi

SKILL="$TARGET/SKILL.md"

# Empty/clean target with no skill content: nothing to check, succeed.
if [ ! -f "$SKILL" ]; then
  printf '%s[ ok ]%s no SKILL.md under %s — nothing to check.\n' "$GREEN" "$RESET" "$TARGET"
  exit 0
fi

findings=0

flag() { # message + matching lines
  findings=1
  printf '%s[finding]%s %s\n' "$YELLOW" "$RESET" "$1"
  [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/    /'
  return 0 # never let a message-only finding trip set -e and skip the remaining checks
}

md_files() { # SKILL.md + every references/*.md
  printf '%s\n' "$SKILL"
  [ -d "$TARGET/references" ] && find "$TARGET/references" -name '*.md' 2>/dev/null || true
}

# 1) No currency regression: never recommend disabling the New Architecture.
hits="$(grep -REn -- 'newArchEnabled:[[:space:]]*false' $(md_files) 2>/dev/null \
        | grep -Eiv 'no-op|never|do not|don.t|dodge|hides' || true)"
[ -n "$hits" ] && flag "newArchEnabled:false recommended -> New Arch is mandatory (RN 0.82+/SDK 55); fix the bug instead" "$hits"

# 2) The performance section must not push FlatList without the FlashList threshold.
if grep -qiE 'FlatList' "$SKILL" 2>/dev/null; then
  if ! grep -qiE 'FlashList' "$SKILL" 2>/dev/null; then
    flag "SKILL.md mentions FlatList but never FlashList -> add the FlashList migration threshold"
  fi
fi

# 3) Every fenced code block must be language-tagged (no bare ``` opener).
#    Count fence lines; opener lines (odd occurrences) must carry a language token.
bare="$(grep -nE '^```[[:space:]]*$' "$SKILL" 2>/dev/null || true)"
if [ -n "$bare" ]; then
  # A bare ``` is a violation only if it is an opener. Heuristic: flag any bare fence that
  # is immediately followed (within the file) by indented/code-looking content is hard in
  # sh; simplest correct rule for rsc skills: openers must be tagged, closers are bare. So a
  # bare fence is fine as a CLOSER. We detect unbalanced/untagged openers by checking that
  # the number of tagged openers + bare closers is consistent. Practical check: ensure no
  # two consecutive bare fences (which would mean an untagged opener+closer pair).
  prev_bare=""
  while IFS= read -r line; do
    case "$line" in
      '```'|'``` ') cur_bare="yes" ;;
      '```'*) cur_bare="no" ;;
      *) continue ;;
    esac
    if [ "$cur_bare" = "yes" ] && [ "$prev_bare" = "yes" ]; then
      flag "two consecutive bare \`\`\` fences -> the opener is untagged; tag it (e.g. \`\`\`tsx)"
      break
    fi
    prev_bare="$cur_bare"
  done < "$SKILL"
fi

# 4) Description shape: a "Use when/to" lead, a NOT-boundary, and no keyword trigger list
#    (the model matches by meaning; a phrase list is per-turn cost for every install).
desc="$(grep -m1 -E '^description:' "$SKILL" 2>/dev/null || true)"
if [ -n "$desc" ]; then
  printf '%s' "$desc" | grep -qE 'Use (when|to) ' || flag "description does not open with 'Use when/to'"
  printf '%s' "$desc" | grep -qE 'NOT ' || flag "description missing a 'NOT <x> (that is <sibling>)' boundary"
  printf '%s' "$desc" | grep -q 'Triggers:' && flag "description carries a 'Triggers:' keyword list -> delete it, the model matches by meaning" ""
fi

# 5) No cross-ref to a sibling that does not exist on disk next to this skill.
SKILLS_ROOT="$(dirname "$TARGET")"
refs="$(grep -hoE '\.\./[a-z0-9-]+/SKILL\.md' $(md_files) 2>/dev/null | sort -u || true)"
if [ -n "$refs" ]; then
  OLDIFS="$IFS"; IFS='
'
  for r in $refs; do
    sib="$(printf '%s' "$r" | sed -E 's#\.\./([a-z0-9-]+)/SKILL\.md#\1#')"
    if [ ! -f "$SKILLS_ROOT/$sib/SKILL.md" ]; then
      flag "cross-ref to ../$sib/SKILL.md but no such sibling on disk -> remove or fix the link"
    fi
  done
  IFS="$OLDIFS"
fi

if [ "$findings" -eq 0 ]; then
  printf '%s[ ok ]%s react-native skill content passes hygiene/currency checks.\n' "$GREEN" "$RESET"
  exit 0
fi

printf '%s[note]%s findings above are advisory; fix before shipping the skill.\n' "$RED" "$RESET"
exit 1
