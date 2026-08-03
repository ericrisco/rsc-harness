#!/usr/bin/env bash
set -euo pipefail

# eval-lint.sh — validate every skills/*/evals/cases.yaml against the eval minimums.
#
# Minimums per skill:
#   >= 5 should_trigger entries
#   >= 4 should_not_trigger entries
#   >= 1 capability scenario
#   every should_not_trigger route_to resolves (see below)
#
# route_to is the one that used to be decorative: the rubric listed "route_to names a
# real skill" as a deterministic gate and nothing checked it, so evals accumulated
# routes to skills that were never authored. Each value must now be one of:
#   - a real catalog skill id (a directory under skills/ with a SKILL.md)
#   - "none" — deliberately nothing to route to
#   - "external:<name>" — a skill outside this catalog, on purpose. Some skills
#     legitimately defer to tools that ship elsewhere; the prefix makes that a
#     visible, greppable claim instead of a typo indistinguishable from drift.
#
# Uses python3 for real YAML parsing when available. If python3 is missing,
# falls back to a basic structural grep check and SKIPs the deep validation
# with a warning (still enforces presence of evals/cases.yaml and the keys).
#
# bash 3.2-safe: no mapfile, no unguarded ${arr[@]} under set -u.

# Resolve repo root (parent of scripts/).
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SKILLS_DIR="$REPO_ROOT/skills"

MIN_TRIGGER=5
MIN_NOT_TRIGGER=4
MIN_CAPABILITY=1

HAVE_PY=0
if command -v python3 >/dev/null 2>&1; then
  HAVE_PY=1
fi

fail_count=0
skill_count=0
warned_skip=0

# Validate one cases.yaml. Echos "PASS"/"FAIL: reason". Returns 0 on pass, 1 on fail.
validate_py() {
  cy="$1"
  CASES_YAML="$cy" MIN_TRIGGER="$MIN_TRIGGER" MIN_NOT_TRIGGER="$MIN_NOT_TRIGGER" \
  MIN_CAPABILITY="$MIN_CAPABILITY" VALID_IDS="$VALID_IDS" python3 - <<'PYEOF'
import os, sys
try:
    import yaml
except Exception as e:
    sys.stderr.write("NOYAML\n")
    sys.exit(3)

path = os.environ["CASES_YAML"]
mt = int(os.environ["MIN_TRIGGER"])
mn = int(os.environ["MIN_NOT_TRIGGER"])
mc = int(os.environ["MIN_CAPABILITY"])

try:
    with open(path) as f:
        data = yaml.safe_load(f)
except Exception as e:
    print("FAIL: YAML parse error: %s" % e)
    sys.exit(1)

if not isinstance(data, dict):
    print("FAIL: top-level YAML is not a mapping")
    sys.exit(1)

def count(key):
    v = data.get(key)
    if v is None:
        return 0
    if not isinstance(v, list):
        return -1  # present but wrong type
    return len(v)

st = count("should_trigger")
sn = count("should_not_trigger")
cap = count("capability")

# --- route_to resolution -------------------------------------------------------
# Accepts a real catalog id, "none", or "external:<name>". A value may be a list,
# or a string holding several targets separated by comma / | / " or ".
valid = set(filter(None, os.environ.get("VALID_IDS", "").split(",")))
NOTHING = {"none", "n/a", "-", ""}
bad_routes = []

def targets(value):
    items = value if isinstance(value, list) else [value]
    out = []
    for item in items:
        for part in str(item).replace("|", ",").replace(" or ", ",").split(","):
            out.append(part.strip().strip("`"))
    return out

for case in (data.get("should_not_trigger") or []):
    if not isinstance(case, dict) or case.get("route_to") is None:
        continue
    for t in targets(case["route_to"]):
        low = t.lower()
        if low in NOTHING:
            continue
        if low.startswith("external:"):
            if not low[len("external:"):].strip():
                bad_routes.append('"external:" with no name')
            continue
        if valid and t not in valid:
            bad_routes.append(t)

reasons = []
if bad_routes:
    uniq = sorted(set(bad_routes))
    reasons.append("route_to does not resolve: %s (use a real skill id, \"none\", or \"external:<name>\")" % ", ".join(uniq))
if st < 0:
    reasons.append("should_trigger is not a list")
elif st < mt:
    reasons.append("should_trigger=%d (<%d)" % (st, mt))
if sn < 0:
    reasons.append("should_not_trigger is not a list")
elif sn < mn:
    reasons.append("should_not_trigger=%d (<%d)" % (sn, mn))
if cap < 0:
    reasons.append("capability is not a list")
elif cap < mc:
    reasons.append("capability=%d (<%d)" % (cap, mc))

if reasons:
    print("FAIL: " + "; ".join(reasons))
    sys.exit(1)

print("PASS (should_trigger=%d, should_not_trigger=%d, capability=%d)" % (st, sn, cap))
sys.exit(0)
PYEOF
}

# Fallback: basic structural grep check. Counts top-level list items as lines
# beginning with two-space indent + "- " that follow each section header.
# This is intentionally conservative; deep validation is SKIPPED.
validate_grep() {
  cy="$1"
  for key in should_trigger should_not_trigger capability; do
    if ! grep -Eq "^${key}:" "$cy"; then
      echo "FAIL: missing top-level key '${key}'"
      return 1
    fi
  done
  echo "SKIP: python3/yaml unavailable — structural keys present, deep validation skipped"
  return 0
}

echo "eval-lint: scanning $SKILLS_DIR"
echo "minimums: should_trigger>=$MIN_TRIGGER should_not_trigger>=$MIN_NOT_TRIGGER capability>=$MIN_CAPABILITY"
echo "route_to must resolve: a catalog skill id, \"none\", or \"external:<name>\""
echo

# The set of real skill ids, built once from disk — the same surface the router sees.
VALID_IDS=""
for sp in "$SKILLS_DIR"/*; do
  [ -f "$sp/SKILL.md" ] || continue
  VALID_IDS="$VALID_IDS,$(basename "$sp")"
done
VALID_IDS="${VALID_IDS#,}"

# Iterate skills deterministically; bash 3.2-safe (no mapfile).
for skill_path in "$SKILLS_DIR"/*; do
  [ -d "$skill_path" ] || continue
  [ -f "$skill_path/SKILL.md" ] || continue
  skill=$(basename "$skill_path")
  skill_count=$((skill_count + 1))

  evals_dir="$skill_path/evals"
  cases_yaml="$evals_dir/cases.yaml"

  if [ ! -d "$evals_dir" ]; then
    printf '%-22s FAIL: missing evals/ directory\n' "$skill"
    fail_count=$((fail_count + 1))
    continue
  fi
  if [ ! -f "$cases_yaml" ]; then
    printf '%-22s FAIL: missing evals/cases.yaml\n' "$skill"
    fail_count=$((fail_count + 1))
    continue
  fi

  if [ "$HAVE_PY" -eq 1 ]; then
    # Capture output and exit status without tripping set -e.
    set +e
    result=$(validate_py "$cases_yaml" 2>/tmp/eval-lint.$$.err)
    rc=$?
    set -e
    if [ "$rc" -eq 3 ] || grep -q NOYAML /tmp/eval-lint.$$.err 2>/dev/null; then
      # python3 present but pyyaml not installed -> fallback.
      set +e
      result=$(validate_grep "$cases_yaml")
      rc=$?
      set -e
      warned_skip=1
    fi
    rm -f /tmp/eval-lint.$$.err
  else
    set +e
    result=$(validate_grep "$cases_yaml")
    rc=$?
    set -e
    warned_skip=1
  fi

  printf '%-22s %s\n' "$skill" "$result"
  if [ "$rc" -ne 0 ]; then
    fail_count=$((fail_count + 1))
  fi
done

echo
echo "scanned $skill_count skill(s); $fail_count failure(s)"
if [ "$warned_skip" -eq 1 ]; then
  echo "WARNING: deep YAML validation was skipped for one or more skills (python3 or PyYAML unavailable)."
fi

if [ "$fail_count" -gt 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi

echo "RESULT: PASS"
exit 0
