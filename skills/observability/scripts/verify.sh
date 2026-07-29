#!/usr/bin/env bash
#
# verify.sh - lint an emitted OpenTelemetry observability setup.
#
# Usage:
#   cd <dir containing the Collector config + SDK init>
#   ./verify.sh [path-to-collector-config.yaml]
#
# Read-only: never mutates anything. Checks the wiring, not just presence:
#   1. a Collector config exists (a *.yaml/*.yml with receivers: and service:)
#   2. it is valid: `otelcol validate` if the binary is on PATH, else
#      a required-keys check for receivers / exporters / service.pipelines
#   3. every exporter declared under exporters: is referenced in some
#      pipeline (the classic "exporter defined but never enabled" footgun)
#   4. SDK init sets the service name (OTEL_SERVICE_NAME /
#      OTEL_RESOURCE_ATTRIBUTES / a service.name resource attribute) -> warn
#   5. heuristic cardinality check: warn if user_id|request_id|email|session_id
#      is used as a metric label/attribute key
#
# Emits [ ok ]/[warn]/[fail] per check, then PASS or FAIL.
# Exits 0 on a clean setup AND when nothing relevant is found (no false failure).
# Exits 1 only on hard failures: no config, invalid config, unused exporter.
#
# Portable: stock macOS bash 3.2 + grep + awk. No associative arrays, no mapfile.

set -euo pipefail

if [ -t 1 ]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi

failed=0
fail() { printf '%s[fail]%s %s\n' "$RED" "$RESET" "$*"; failed=1; }
warn() { printf '%s[warn]%s %s\n' "$YELLOW" "$RESET" "$*"; }
ok()   { printf '%s[ ok ]%s %s\n' "$GREEN" "$RESET" "$*"; }
skip() { printf '%s[skip]%s %s\n' "$YELLOW" "$RESET" "$*"; }

# --- 1. locate a Collector config -------------------------------------------
cfg="${1:-}"
if [ -z "$cfg" ]; then
  # any yaml/yml that looks like a Collector config (has receivers: and service:)
  while IFS= read -r f; do
    if grep -Eq '^[[:space:]]*receivers[[:space:]]*:' "$f" \
       && grep -Eq '^[[:space:]]*service[[:space:]]*:' "$f"; then
      cfg="$f"; break
    fi
  done < <(find . -maxdepth 3 -type f \( -name '*.yaml' -o -name '*.yml' \) 2>/dev/null)
fi

if [ -z "$cfg" ] || [ ! -f "$cfg" ]; then
  skip "no OTel Collector config found (a *.yaml with receivers: + service:) - nothing to verify."
  exit 0
fi

printf -- '----- linting %s\n' "$cfg"

# --- 2. validity ------------------------------------------------------------
if command -v otelcol >/dev/null 2>&1; then
  if otelcol validate --config "$cfg" >/dev/null 2>&1; then
    ok "otelcol validate passed"
  else
    fail "otelcol validate rejected the config"
  fi
elif command -v otelcol-contrib >/dev/null 2>&1; then
  if otelcol-contrib validate --config "$cfg" >/dev/null 2>&1; then
    ok "otelcol-contrib validate passed"
  else
    fail "otelcol-contrib validate rejected the config"
  fi
else
  # no binary: required top-level/section keys must be present
  miss=""
  grep -Eq '^[[:space:]]*receivers[[:space:]]*:'  "$cfg" || miss="$miss receivers"
  grep -Eq '^[[:space:]]*exporters[[:space:]]*:'  "$cfg" || miss="$miss exporters"
  grep -Eq '^[[:space:]]*service[[:space:]]*:'    "$cfg" || miss="$miss service"
  grep -Eq '^[[:space:]]*pipelines[[:space:]]*:'  "$cfg" || miss="$miss service.pipelines"
  if [ -z "$miss" ]; then
    ok "required sections present (receivers, exporters, service.pipelines) [otelcol not on PATH; key-check only]"
  else
    fail "config missing required section(s):$miss"
  fi
fi

# --- 3. every declared exporter is referenced in a pipeline -----------------
# Collect exporter ids: indented one level under the top-level `exporters:` block,
# keys ending in ':' (e.g. "otlphttp/traces:"). Then confirm each id's bare name
# appears somewhere after a "service:"/"pipelines:" context.
exp_ids="$(awk '
  /^exporters[[:space:]]*:/        { in_exp=1; ind=-1; next }
  /^[a-zA-Z0-9_]+[[:space:]]*:/    { if (in_exp) in_exp=0 }   # next top-level block ends it
  in_exp {
    if ($0 ~ /^[[:space:]]+[A-Za-z0-9_\/.-]+[[:space:]]*:/) {
      line=$0
      sub(/:.*/, "", line); gsub(/[[:space:]]/, "", line)
      # only the first indentation level (exporter ids), skip deeper config keys
      lead=match($0, /[^ ]/)-1
      if (ind==-1) ind=lead
      if (lead==ind && line!="") print line
    }
  }
' "$cfg" 2>/dev/null || true)"

if [ -z "$exp_ids" ]; then
  skip "no exporter ids parsed under exporters: - skipping unused-exporter check"
else
  # body after the first `service:` line is where pipelines reference exporters
  svc_body="$(awk '/^service[[:space:]]*:/{s=1} s{print}' "$cfg")"
  unused=""
  for e in $exp_ids; do
    if printf '%s\n' "$svc_body" | grep -Fq "$e"; then
      :
    else
      unused="$unused $e"
    fi
  done
  if [ -z "$unused" ]; then
    ok "every declared exporter is wired into a pipeline"
  else
    fail "exporter(s) declared but never used in any pipeline:$unused (inert until added to service.pipelines)"
  fi
fi

# --- 4. service.name is set somewhere in the setup --------------------------
# Look across the whole dir's likely SDK-init files, not just the yaml.
sdk_hit=0
if grep -Rqs -E 'OTEL_SERVICE_NAME|OTEL_RESOURCE_ATTRIBUTES|service[._-]?name|ServiceName' . 2>/dev/null; then
  sdk_hit=1
fi
if [ "$sdk_hit" -eq 1 ]; then
  ok "service.name is set (OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES / resource attr found)"
else
  warn "no service.name found - telemetry will land as 'unknown_service'. Set OTEL_SERVICE_NAME or a service.name resource attribute."
fi

# --- 5. high-cardinality metric label heuristic -----------------------------
# Warn (don't fail) if an unbounded id is used as a metric label/attribute key.
card_hit="$(grep -RnsE '(user_id|request_id|session_id|email)[[:space:]]*[:=]' . 2>/dev/null \
            | grep -Ei 'label|attribute|metric|tags?|dimension' || true)"
if [ -n "$card_hit" ]; then
  warn "possible high-cardinality metric label(s) - keep these off metrics, put them on spans/logs:"
  printf '%s\n' "$card_hit" | sed 's/^/        /'
else
  ok "no obvious high-cardinality metric label (user_id/request_id/session_id/email)"
fi

# --- verdict ----------------------------------------------------------------
echo
if [ "$failed" -eq 0 ]; then
  printf '%sPASS%s - observability setup is wired.\n' "$GREEN" "$RESET"
  exit 0
else
  printf '%sFAIL%s - fix the items above.\n' "$RED" "$RESET"
  exit 1
fi
