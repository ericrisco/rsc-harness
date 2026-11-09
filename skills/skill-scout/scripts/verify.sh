#!/usr/bin/env bash
#
# verify.sh — validator for skill-scout's optional artifact: skill-gaps.jsonl.
#
# WHAT IT DOES (read-only; never edits or writes a file)
#   Static, network-free checks over a skill-gaps.jsonl produced by skill-scout.
#   You may point it at the file directly or at a directory containing it:
#     1. Every non-blank line is well-formed JSON                  -> FAIL each bad line.
#     2. Every "recommended_id" present is a member of the known   -> FAIL each unknown id.
#        catalog id set (the skill's worst failure mode is
#        hallucinating an id that does not exist).
#
#   skill-scout can run in advice-only mode and emit no artifact at all. So an
#   absent file, an empty file, or a whitespace-only file is a clean PASS — the
#   verifier never invents a failure where there is nothing to check.
#
# HOW TO RUN (inside YOUR project, not the skills repo)
#   ./verify.sh                              # checks ./skill-gaps.jsonl if it exists
#   ./verify.sh path/to/skill-gaps.jsonl     # check a specific file
#   ./verify.sh path/to/dir                  # check <dir>/skill-gaps.jsonl
#
# EXIT CODES
#   0  clean, or nothing to check (absent / empty file)
#   1  a malformed JSON line, or a recommended_id not in the known catalog set
#   2  bad usage (target path given but does not exist)
#
# Runs on stock macOS bash 3.2: no mapfile, no associative arrays. Uses python3
# for JSON parsing when available, with a conservative grep/sed fallback.

set -euo pipefail

if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; NC=''
fi
ok()   { printf '%s[ ok ]%s %s\n' "$GREEN" "$NC" "$*"; }
fail() { printf '%s[fail]%s %s\n' "$RED"   "$NC" "$*"; }

# --- known catalog id set (keep in sync with the catalog manifest) ------------
KNOWN_IDS="analyze author-skill building-agents clarify constitution course-storytelling debug deployment design fastapi flutter go harness implement init marketing nextjs parallel plan postgresdb presentations review sdd security-audit ship specify suggest tasks verify worktrees finance-ops invoicing bookkeeping pricing sales-pipeline lead-gen cold-outreach proposals contracts customer-support client-onboarding retention hiring people-ops inventory logistics-ops procurement meeting-notes sop-builder project-ops seo-geo content-engine social-publisher brand-voice brand-identity newsletter landing-copy ads article-writing case-studies video-shorts podcast market-research competitor-watch press-kit community webinar review-management pitch-deck investor-materials financial-model fundraising unit-economics grants gdpr-privacy terms-conditions compliance data-policy ip-trademark stripe email-connector google-workspace notion-connector whatsapp-telegram automation-flows api-connector-builder webhooks data-scraper spreadsheet-ops calendar-scheduling document-processing e-signature analytics dashboard kpi-framework reporting ab-testing forecasting data-cleaning business-intelligence rag embeddings-search prompt-engineering llm-pipeline agent-eval chatbot ai-media replicate-images structured-extraction agent-safety cost-tracking react react-native vue-nuxt nodejs django laravel rails swift-ios kotlin-android rust api-design wordpress shopify no-code-app chrome-extension mysql redis prisma-orm db-migrations backups clickhouse-analytics code-review testing-py testing-web testing-go e2e-testing accessibility performance error-handling observability docker github-actions git-workflow domains-dns monitoring email-deliverability scaling knowledge-ops codebase-onboarding research-ops decision-records continuous-learning skill-scout context-budget course-builder technical-writing translation-l10n youtube-api youtube-strategy youtube-ideation youtube-thumbnails youtube-packaging remotion-video tiktok-api instagram-api shortform-strategy shortform-ideation shortform-packaging shortform-editing linkedin-api linkedin-strategy linkedin-content linkedin-carousels linkedin-outreach medium-writing medium-publishing medium-strategy typescript python java csharp-dotnet php ruby cpp elixir bash-scripting sql angular svelte astro solid-js htmx nestjs spring-boot phoenix tauri electron expo compose-multiplatform mongodb supabase neon planetscale sqlite-turso drizzle-orm firebase dynamodb vector-db duckdb vercel netlify cloudflare railway render fly-io coolify hetzner digitalocean aws-essentials gcp-essentials replicate runpod modal huggingface ollama together-fireworks fal"

is_known() {
  # whole-word membership test against the space-delimited set
  case " $KNOWN_IDS " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

# --- resolve the target -------------------------------------------------------
TARGET="${1:-skill-gaps.jsonl}"

if [ -d "$TARGET" ]; then
  FILE="$TARGET/skill-gaps.jsonl"
else
  FILE="$TARGET"
fi

# Absent artifact: advice-only mode, nothing to check.
if [ ! -e "$FILE" ]; then
  # If the user explicitly named a path that doesn't exist (and isn't the
  # default), that's a usage error; otherwise it's a clean no-op.
  if [ "${1:-}" != "" ] && [ ! -d "${1:-}" ]; then
    ok "no skill-gaps.jsonl at '$FILE' — advice-only mode, nothing to check"
    exit 0
  fi
  ok "no skill-gaps.jsonl found — advice-only mode, nothing to check"
  exit 0
fi

# Empty / whitespace-only: nothing to check.
if [ ! -s "$FILE" ] || ! grep -q '[^[:space:]]' "$FILE" 2>/dev/null; then
  ok "empty skill-gaps.jsonl — nothing to check"
  exit 0
fi

printf 'skill-scout verify — %s\n\n' "$FILE"

HAVE_PY=0
if command -v python3 >/dev/null 2>&1; then HAVE_PY=1; fi

fail_count=0
checked=0
lineno=0

while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  # skip blank lines
  case "$line" in
    ''|*[!\ ]*) : ;;
  esac
  if ! printf '%s' "$line" | grep -q '[^[:space:]]'; then
    continue
  fi
  checked=$((checked + 1))

  if [ "$HAVE_PY" -eq 1 ]; then
    # Parse JSON and print the recommended_id (or empty) on success; fail loudly.
    rid="$(printf '%s' "$line" | python3 -c '
import sys, json
try:
    obj = json.loads(sys.stdin.read())
except Exception as e:
    sys.stderr.write("BADJSON")
    sys.exit(3)
if not isinstance(obj, dict):
    sys.stderr.write("NOTOBJ")
    sys.exit(3)
rid = obj.get("recommended_id", "")
sys.stdout.write(rid if isinstance(rid, str) else "")
' 2>/tmp/skill_scout_err.$$ )" || {
      reason="$(cat /tmp/skill_scout_err.$$ 2>/dev/null || true)"
      rm -f /tmp/skill_scout_err.$$
      if [ "$reason" = "NOTOBJ" ]; then
        fail "line $lineno: JSON is not an object"
      else
        fail "line $lineno: malformed JSON"
      fi
      fail_count=$((fail_count + 1))
      continue
    }
    rm -f /tmp/skill_scout_err.$$
  else
    # Fallback without python3: shallow well-formedness + id extraction.
    # Must look like a single JSON object.
    case "$line" in
      \{*\}) : ;;
      *) fail "line $lineno: does not look like a JSON object (no python3 to verify deeply)"
         fail_count=$((fail_count + 1)); continue ;;
    esac
    rid="$(printf '%s' "$line" \
      | sed -n 's/.*"recommended_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  fi

  if [ -n "$rid" ]; then
    if is_known "$rid"; then
      ok "line $lineno: recommended_id '$rid' is a known catalog id"
    else
      fail "line $lineno: recommended_id '$rid' is NOT in the known catalog set (hallucinated id?)"
      fail_count=$((fail_count + 1))
    fi
  else
    ok "line $lineno: valid JSON (no recommended_id — e.g. a NONEXISTENT verdict)"
  fi
done < "$FILE"

printf '\n'
if [ "$fail_count" -gt 0 ]; then
  printf '%s%d problem(s) across %d line(s)%s\n' "$RED" "$fail_count" "$checked" "$NC"
  exit 1
fi
printf '%sall %d line(s) valid%s\n' "$GREEN" "$checked" "$NC"
exit 0
