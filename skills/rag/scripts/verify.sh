#!/usr/bin/env bash
set -euo pipefail

# verify.sh — rag skill gate. Read-only, idempotent, no network.
#
# Checks the skill's own checkable artifacts (the grounding prompt-contract + eval rubric),
# NOT model output:
#   1. SKILL.md frontmatter keys exactly = {name, description, tags, recommends, origin}.
#   2. `recommends` is a subset of the KNOWN catalog ids.
#   3. The grounding section contains the contract markers: answer-only-from-context,
#      an explicit refusal phrase, and a citation requirement (banlist guard so a grounding
#      prompt missing refusal fails).
#   4. references/pipeline.md and references/evaluation.md exist and are non-empty.
#   5. The four RAGAS metric names all appear in references/evaluation.md.
#   6. Every code fence in SKILL.md is language-tagged.
#
# Resolves the skill dir relative to this script, so it runs from anywhere. If SKILL.md is
# absent (empty/clean target) it exits 0 with a skip — no false failure.

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; NC=$'\033[0m'
EXIT=0
skip() { printf '%s[skip]%s %s\n' "$YELLOW" "$NC" "$*"; }
ok()   { printf '%s[ok]%s %s\n'   "$GREEN"  "$NC" "$*"; }
err()  { printf '%s[fail]%s %s\n' "$RED"    "$NC" "$*"; EXIT=1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SKILL="$SKILL_DIR/SKILL.md"
PIPELINE="$SKILL_DIR/references/pipeline.md"
EVALDOC="$SKILL_DIR/references/evaluation.md"

if [ ! -f "$SKILL" ]; then
  skip "no SKILL.md at $SKILL_DIR — nothing to verify"
  ok "verify.sh passed (empty target)"
  exit 0
fi

# --- 1. frontmatter keys ---
fm="$(awk 'NR==1 && $0=="---"{f=1;next} f&&$0=="---"{exit} f{print}' "$SKILL")"
keys="$(printf '%s\n' "$fm" | grep -E '^[a-z_]+:' | sed -E 's/^([a-z_]+):.*/\1/' | sort | tr '\n' ' ' | sed 's/ $//')"
expected="description name origin recommends tags"
if [ "$keys" = "$expected" ]; then
  ok "frontmatter keys exact: $keys"
else
  err "frontmatter keys mismatch — got [$keys], want [$expected]"
fi

# --- 2. recommends subset of KNOWN ids ---
KNOWN="analyze author-skill building-agents clarify constitution course-storytelling debug deployment design fastapi flutter go harness implement init marketing nextjs parallel plan postgresdb presentations review sdd security-audit ship specify suggest tasks verify worktrees finance-ops invoicing bookkeeping pricing sales-pipeline lead-gen cold-outreach proposals contracts customer-support client-onboarding retention hiring people-ops inventory logistics-ops procurement meeting-notes sop-builder project-ops seo-geo content-engine social-publisher brand-voice brand-identity newsletter landing-copy ads article-writing case-studies video-shorts podcast market-research competitor-watch press-kit community webinar review-management pitch-deck investor-materials financial-model fundraising unit-economics grants gdpr-privacy terms-conditions compliance data-policy ip-trademark stripe email-connector google-workspace notion-connector whatsapp-telegram automation-flows api-connector-builder webhooks data-scraper spreadsheet-ops calendar-scheduling document-processing e-signature analytics dashboard kpi-framework reporting ab-testing forecasting data-cleaning business-intelligence rag embeddings-search prompt-engineering llm-pipeline agent-eval chatbot ai-media replicate-images structured-extraction agent-safety cost-tracking react react-native vue-nuxt nodejs django laravel rails swift-ios kotlin-android rust api-design wordpress shopify no-code-app chrome-extension mysql redis prisma-orm db-migrations backups clickhouse-analytics code-review testing-py testing-web testing-go e2e-testing accessibility performance error-handling observability docker github-actions git-workflow domains-dns monitoring email-deliverability scaling knowledge-ops codebase-onboarding research-ops decision-records continuous-learning skill-scout context-budget course-builder technical-writing translation-l10n youtube-api youtube-strategy youtube-ideation youtube-thumbnails youtube-packaging remotion-video tiktok-api instagram-api shortform-strategy shortform-ideation shortform-packaging shortform-editing linkedin-api linkedin-strategy linkedin-content linkedin-carousels linkedin-outreach medium-writing medium-publishing medium-strategy typescript python java csharp-dotnet php ruby cpp elixir bash-scripting sql angular svelte astro solid-js htmx nestjs spring-boot phoenix tauri electron expo compose-multiplatform mongodb supabase neon planetscale sqlite-turso drizzle-orm firebase dynamodb vector-db duckdb vercel netlify cloudflare railway render fly-io coolify hetzner digitalocean aws-essentials gcp-essentials replicate runpod modal huggingface ollama together-fireworks fal"
rec_line="$(printf '%s\n' "$fm" | grep -E '^recommends:' | sed -E 's/^recommends:[[:space:]]*\[?//; s/\]//')"
rec_ids="$(printf '%s' "$rec_line" | tr ',' ' ')"
bad=""
for id in $rec_ids; do
  id="$(printf '%s' "$id" | tr -d ' ')"
  [ -z "$id" ] && continue
  case " $KNOWN " in *" $id "*) ;; *) bad="$bad $id";; esac
done
if [ -z "$bad" ]; then ok "recommends are all known ids"; else err "recommends not in KNOWN:$bad"; fi

# --- 3. grounding contract markers ---
if grep -qi 'ONLY using' "$SKILL" || grep -qi 'answer ONLY' "$SKILL"; then
  ok "grounding: answer-only-from-context present"
else
  err "grounding: missing answer-only-from-context clause"
fi
if grep -qi "don't have enough information" "$SKILL" || grep -qi 'No tengo suficiente' "$SKILL"; then
  ok "grounding: explicit refusal phrase present"
else
  err "grounding: missing explicit refusal phrase (banlist guard)"
fi
if grep -qi 'cite' "$SKILL" && grep -q 'chunk_id' "$SKILL"; then
  ok "grounding: citation requirement present"
else
  err "grounding: missing citation requirement"
fi

# --- 4. references exist and non-empty ---
for f in "$PIPELINE" "$EVALDOC"; do
  if [ -s "$f" ]; then ok "reference present: ${f#$SKILL_DIR/}"; else err "missing/empty reference: ${f#$SKILL_DIR/}"; fi
done

# --- 5. four RAGAS metric names in evaluation.md ---
if [ -f "$EVALDOC" ]; then
  for m in "faithfulness" "answer relevancy" "context precision" "context recall"; do
    if grep -qi "$m" "$EVALDOC"; then ok "metric present: $m"; else err "metric missing in evaluation.md: $m"; fi
  done
fi

# --- 6. every code fence in SKILL.md is language-tagged ---
untagged="$(awk '/^```/{n++; if(n%2==1 && $0=="```") print NR}' "$SKILL")"
if [ -z "$untagged" ]; then
  ok "all code fences language-tagged"
else
  err "untagged code fence(s) at SKILL.md line(s): $(printf '%s' "$untagged" | tr '\n' ' ')"
fi

printf '\n'
if [ "$EXIT" -eq 0 ]; then ok "verify.sh passed"; else err "verify.sh found failures"; fi
exit "$EXIT"
