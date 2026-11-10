#!/usr/bin/env bash
# Evidence gate: the same checks as CI (.github/workflows/ci.yml), run locally or by a factory.
# Exits non-zero on the first failure. Needs the dependencies installed (npm ci).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "▸ validate";       npm run --silent validate
echo "▸ manifest";       npm run --silent manifest:check
echo "▸ test";           node --test
echo "▸ eval-lint";      bash scripts/eval-lint.sh
echo "▸ drift-check";    npm run --silent drift:check
echo "▸ cleanup gate"
if grep -rIn -E "sync-bundles|\.claude-plugin/marketplace|/plugin install [^\"' ]*@rsc-skills" . \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=docs --exclude-dir=skill-build --exclude-dir=.github --exclude=verify.sh; then
  echo "✗ old marketplace-distribution residue found" >&2
  exit 1
fi
echo "✓ verify passed"
