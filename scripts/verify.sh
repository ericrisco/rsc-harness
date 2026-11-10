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
# The fingerprints are split so this file does not match them itself (CI greps it too).
residue="sync-""bundles|\\.claude-""plugin/marketplace|/plugin install [^\"' ]*@rsc-""skills"
if grep -rIn -E "$residue" . \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=docs --exclude-dir=skill-build --exclude-dir=.github; then
  echo "✗ old marketplace-distribution residue found" >&2
  exit 1
fi
echo "✓ verify passed"
