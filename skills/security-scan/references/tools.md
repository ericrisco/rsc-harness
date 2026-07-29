# Tools — pinned installs, flags, suppression syntax

Facts accessed 2026-06-02. Pin the exact versions shown; treat the scanner as a
supply-chain dependency, not a throwaway CLI.

## Semgrep (SAST)

- Latest OSS `1.164.0` (2026-05-27). Community/OSS edition: 30+ languages, ~2,000
  community rules. **SCA + Secrets rulesets are gated behind the hosted AppSec
  platform** (login required) — do not rely on Semgrep for those; use osv-scanner
  and gitleaks/TruffleHog instead.

```bash
pip install semgrep==1.164.0        # or pipx install semgrep==1.164.0
semgrep scan --config p/owasp-top-ten --sarif --output sast.sarif --metrics off .
semgrep scan --config auto          --sarif --output sast.sarif --metrics off .
```

- Severity: gate on `ERROR`; treat `WARNING`/`INFO` as informational.
- Suppression: inline `// nosemgrep: rule-id` on the line, or a `.semgrepignore`
  for **paths** (`vendor/`, `test/fixtures/`) — never a blanket rule mute.

## osv-scanner (SCA — primary)

- OpenSSF/Google. Checks lockfiles against OSV.dev across ecosystems; ships
  guided remediation. v2 CLI: `osv-scanner scan source`.

```bash
# Install a pinned release binary from github.com/google/osv-scanner/releases.
osv-scanner scan source --format sarif --output sca.sarif .
osv-scanner scan source -L package-lock.json --format sarif --output sca.sarif
```

- Suppression: `osv-scanner.toml` with an `[[IgnoredVulns]]` block per CVE,
  including `reason` and `ignoreUntil` (expiry).

## Native auditors (SCA — fast pass)

Weaker on transitive CVEs; a first pass, never the only pass.

```bash
npm audit --omit=dev --audit-level=high --json > npm-audit.json     # Node
pip-audit --format json --output pip-audit.json                     # Python (PyPA + Trail of Bits; OSV + PyPI feed)
govulncheck ./...                                                   # Go — reachability-aware
```

## gitleaks (Secrets — speed)

- ~150+ default regex patterns, sub-second on diffs. Ideal pre-commit + CI diff.

```bash
# Pin a release from github.com/gitleaks/gitleaks/releases.
gitleaks detect --redact --report-format sarif --report-path secrets.sarif   # tree + full history
gitleaks protect --staged --redact                                           # pre-commit (diff only)
```

- Suppression: `.gitleaks.toml` `[allowlist]` (regexes/paths/commits) or an inline
  `# gitleaks:allow` comment on the offending line.

## TruffleHog (Secrets — depth + verification)

- 800+ secret types. **Credential verification:** live-tests a detected secret via
  auth, so a hit is a *confirmed* live leak, not a guess. Scans git history, S3,
  Docker, etc.

```bash
trufflehog git file://. --only-verified --json > trufflehog.json
```

- Pattern most teams use: **gitleaks pre-commit** (speed) + **TruffleHog in CI**
  (depth + verification).

## Trivy (Misconfig / IaC / containers) — PINNED, VERIFIED

- Aqua Security, scans containers/filesystems/IaC/language deps, generates SBOM,
  catches transitive CVEs `npm audit` misses.
- **Supply-chain caveat (March 2026):** malicious releases `v0.69.4`, `v0.69.5`,
  `v0.69.6` and a hijacked `aquasecurity/trivy-action` GitHub Action stole CI
  secrets. **Pin an exact known-good version, verify the cosign signature /
  checksum before first use, and pin the Action to a full commit SHA — never a
  tag, never `@latest`.**

```bash
# Install a pinned, signature-verified release (NOT 0.69.4/.5/.6).
trivy fs --scanners vuln,secret,misconfig --format sarif --output trivy.sarif .
trivy config --format sarif --output trivy-iac.sarif ./infra
trivy image --format sarif --output trivy-img.sarif <pinned-image@sha256:...>
```

- Suppression: `.trivyignore` (one CVE/check id per line) or inline
  `#trivy:ignore:<id>` in IaC files. Record a reason in review, not just the id.

## SARIF notes

- Every recipe emits SARIF 2.1.0 so findings merge into one report. Where a tool
  only emits native JSON (`npm audit`, `pip-audit`, TruffleHog), normalize it to
  the report schema in `triage.md` rather than gating on its raw shape.
