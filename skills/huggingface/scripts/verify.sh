#!/usr/bin/env bash
#
# verify.sh — static linter for Hugging Face integration code/config.
#
# Usage:
#   ./scripts/verify.sh [TARGET_PATH]   (default: current directory)
#
# Read-only. No network, no HF token, nothing executed from the target. It greps emitted
# CODE/CONFIG artifacts (.py/.sh/.toml/.yaml/.yml) for the hard mistakes this skill warns
# about and exits non-zero only on HARD violations. Soft issues print a yellow WARN and do not
# fail. Prose docs (.md/.txt) are NOT scanned — they legitimately quote anti-patterns as
# examples, so scanning them would false-positive. This script and the skill's own files are
# skipped. An empty or clean target exits 0 — never a false failure.
#
# Compatible with stock macOS bash 3.2: no mapfile, no associative arrays, find|while loop.

set -euo pipefail

TARGET="${1:-.}"

if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi
fail_msg() { printf '%sFAIL%s %s\n' "$RED" "$RESET" "$*"; }
warn_msg() { printf '%sWARN%s %s\n' "$YELLOW" "$RESET" "$*"; }
ok_msg()   { printf '%sOK%s   %s\n' "$GREEN" "$RESET" "$*"; }

if [ ! -e "$TARGET" ]; then
  warn_msg "target '$TARGET' does not exist — nothing to check"
  exit 0
fi

HARD=0

# Collect candidate files (skip VCS and dependency dirs).
FILES=""
while IFS= read -r f; do
  FILES="$FILES
$f"
done <<EOF
$(find "$TARGET" \
    \( -name .git -o -name node_modules -o -name .venv -o -name venv -o -name __pycache__ \) -prune -false \
    -o -type f \( -name '*.py' -o -name '*.sh' \
                  -o -name '*.toml' -o -name '*.yaml' -o -name '*.yml' \) \
    ! -name 'verify.sh' -print 2>/dev/null)
EOF

# Trim leading blank line.
FILES="$(printf '%s\n' "$FILES" | sed '/^$/d')"

if [ -z "$FILES" ]; then
  ok_msg "no HF-related source/config files found — clean"
  exit 0
fi

scan() { # scan <regex> <label>; returns 0 if a match was found
  printf '%s\n' "$FILES" | while IFS= read -r f; do
    [ -n "$f" ] || continue
    grep -nE "$1" "$f" 2>/dev/null | sed "s#^#$f:#"
  done
}

# --- HARD: InferenceClient.post() was removed ---
HITS="$(scan '\.post\s*\(' || true)"
if printf '%s' "$HITS" | grep -q .; then
  # only treat as HF .post if the file mentions InferenceClient
  PHITS="$(printf '%s\n' "$FILES" | while IFS= read -r f; do
    [ -n "$f" ] || continue
    if grep -q 'InferenceClient' "$f" 2>/dev/null; then grep -nE '\.post\s*\(' "$f" 2>/dev/null | sed "s#^#$f:#"; fi
  done)"
  if printf '%s' "$PHITS" | grep -q .; then
    fail_msg "InferenceClient.post() is removed (hub v0.31.0) — use task methods (chat.completions.create / feature_extraction):"
    printf '%s\n' "$PHITS"
    HARD=1
  fi
fi

# --- HARD: hardcoded hf_ token literal ---
THITS="$(scan '["'\'']hf_[A-Za-z0-9]{8,}' || true)"
if printf '%s' "$THITS" | grep -q .; then
  fail_msg "hardcoded hf_ token literal — read os.environ[\"HF_TOKEN\"] instead:"
  printf '%s\n' "$THITS"
  HARD=1
fi

# --- HARD: big LLM routed to hf-inference (CPU/small-model niche) ---
BHITS="$(scan 'provider\s*=\s*["'\'']hf-inference["'\'']' || true)"
if printf '%s' "$BHITS" | grep -q .; then
  BIG="$(printf '%s\n' "$BHITS" | grep -iE '(-|_)(7b|8b|13b|34b|70b|72b|405b)|llama-?3|mixtral|qwen2|deepseek' || true)"
  if printf '%s' "$BIG" | grep -q .; then
    fail_msg "large LLM routed to provider=\"hf-inference\" (CPU/small-model niche; will 404/stall) — use a partner provider:"
    printf '%s\n' "$BIG"
    HARD=1
  fi
fi

# --- HARD: wrong OpenAI-compat router host ---
URLHITS="$(scan 'router\.huggingface\.co' || true)"
if printf '%s' "$URLHITS" | grep -q .; then
  BADURL="$(printf '%s' "$URLHITS" | grep -E 'router\.huggingface\.co' | grep -vE 'router\.huggingface\.co/v1([^A-Za-z0-9]|$)' || true)"
  if printf '%s' "$BADURL" | grep -q .; then
    fail_msg "router host must be https://router.huggingface.co/v1 for OpenAI-compat:"
    printf '%s\n' "$BADURL"
    HARD=1
  fi
fi

# --- HARD: huggingface-cli was removed in huggingface_hub 2.0 ---
CLIHITS="$(scan 'huggingface-cli ' || true)"
if printf '%s' "$CLIHITS" | grep -q .; then
  fail_msg "'huggingface-cli' was removed in huggingface_hub 2.0 — use 'hf <resource> <action>':"
  printf '%s\n' "$CLIHITS"
  HARD=1
fi

if [ "$HARD" -ne 0 ]; then
  fail_msg "hard violations found"
  exit 1
fi

ok_msg "no hard violations"
exit 0
