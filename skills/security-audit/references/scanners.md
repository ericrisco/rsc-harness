# Scanners — run them, dedupe them, rank them, never trust them blindly

Automated scanners are the cheap, wide first pass of the code audit: SAST,
dependency CVEs, secrets in the tree and history, IaC misconfiguration. They are
fast and reproducible, and they are noisy. This file covers which tool to run,
how to run it safely, and how to turn four overlapping outputs into a short,
ranked list of candidates.

## Two rules that override everything below

1. **A scanner hit is a candidate, never a finding.** Every hit enters the audit
   as unverified. It becomes a confirmed finding only after you trace it in the
   code (reachable, attacker-controlled, meaningful sink) or reproduce it in
   isolation, following the verdicts in `verification.md`. A confirmed finding
   carries evidence that exists on disk. Scanner severity is a triage hint for
   *what to verify first*; the finding's severity is assigned only on
   confirmation.
2. **A scanner that did not run is "not run", never "clean".** Missing binary,
   no config, network failure, crash, unsupported lockfile, or a step you
   skipped — each one is recorded with its reason, and the scan class it covers
   appears in the report as not reviewed. Silence is not a pass. An empty
   output file is only "clean" when the tool ran, exited with its success code,
   and you recorded its version.

**Read-only by default.** Scan, triage, report. Version bumps, rotations and
`.gitignore` edits are fixes: propose them, apply only with permission. A sweep
that silently changes the tree destroys the evidence and the trust.

## Scan classes and tool selection

Four classes: **SAST** (injection, XSS, path traversal in *first-party* code),
**SCA / deps** (known CVEs in manifests + lockfiles), **Secrets** (credentials
in the tree **or git history**), **Misconfig / IaC** (Dockerfile, k8s,
Terraform, exposed config). Pick tools by what is in the repo — match the tool
to the manifest, don't run everything everywhere.

| Repo contains | SAST | SCA | Secrets | Misconfig |
|---|---|---|---|---|
| Node (`package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`) | Semgrep | osv-scanner + `npm audit`/`pnpm audit` (fast) | gitleaks → TruffleHog | Trivy |
| Python (`poetry.lock`/`uv.lock`/`requirements*.txt`/`pyproject.toml`) | Semgrep | osv-scanner + `pip-audit` (fast) | gitleaks → TruffleHog | Trivy |
| Go (`go.mod`/`go.sum`) | Semgrep | osv-scanner + `govulncheck` (reachability) | gitleaks | Trivy |
| Dart / Flutter (`pubspec.lock`) | Semgrep | osv-scanner; `dart pub outdated` (staleness only, no CVE feed) | gitleaks | — |
| Containers (`Dockerfile`, images) | — | Trivy `fs`/`image` | Trivy `--scanners secret` | Trivy `config` |
| IaC (Terraform/k8s/Helm) | Semgrep (IaC rules) | — | gitleaks | Trivy `config`, Semgrep rulesets |
| Monorepo (mixed) | Semgrep, explicit rulesets | osv-scanner (multi-ecosystem) | gitleaks → TruffleHog | Trivy |

Detect by manifest and run **every** row that matches, not the first one.

## Pin and verify the scanners themselves

Your scanner runs with read access to the whole repo, its history and, in CI,
the pipeline's secrets. An unpinned scanner is itself attack surface.

- Exact versions, verified checksums or signatures, installed **outside the
  project**, called by absolute path. Never `npx <scanner>`, never a
  project-local binary or package script: the project you are auditing can
  replace those.
- **In March 2026 Trivy was supply-chain compromised:** malicious releases
  `v0.69.4`, `v0.69.5`, `v0.69.6` and a hijacked `aquasecurity/trivy-action`
  exfiltrated CI secrets. Pin an exact known-good version, verify the cosign
  signature / checksum before first use, and pin every GitHub Action to a full
  commit SHA — never a tag, never `@latest`.
- Record each tool's exact version in the audit. Facts below were checked
  2026-06-02; re-check current versions from the official release pages before
  pinning.

## Run recipes

Every recipe writes SARIF (or JSON you normalize) into the audit directory
(`02-DOCS/security/audit-<date>/`, gitignored — it describes open
vulnerabilities). A common shape is what lets you merge tools and dedupe.
Scanner outputs can embed matched source lines, so a hardcoded secret may ride
along: raw outputs stay in the audit directory, are read with filters, and are
never pasted whole into the transcript or the report.

### SAST — Semgrep

Free OSS edition (latest `1.164.0`, 2026-05-27): 30+ languages, ~2,000 community
rules. SCA and Secrets rulesets sit behind the hosted platform (login required)
— use osv-scanner and gitleaks/TruffleHog for those instead.

```bash
# Install pinned:  pipx install semgrep==1.164.0
semgrep scan --config p/owasp-top-ten --sarif --output sast.sarif --metrics off .
# Project rules first when they exist: .semgrep.yml / .semgrep.yaml / semgrep.yml / .semgrep/
semgrep scan --config .semgrep.yml --sarif --output sast-local.sarif --metrics off .
```

- `--config auto` picks rules from the project's languages, but it downloads
  rules and requires metrics, which sends project metadata to the vendor. Use it
  only with the person's consent; explicit rulesets with `--metrics off` are
  the default.
- Gate on `ERROR`; treat `WARNING`/`INFO` as informational.
- Suppression: inline `// nosemgrep: rule-id` on the line, or `.semgrepignore`
  for **paths** (`vendor/`, `test/fixtures/`) — never a blanket rule mute.

### SCA — osv-scanner (primary), native auditors (fast pass)

osv-scanner (OpenSSF/Google) checks lockfiles against OSV.dev across ecosystems
and catches **transitive** CVEs the native auditors miss. It ships guided
remediation. Run native first for speed, osv-scanner for coverage — never native
alone.

```bash
# Install a pinned release binary from github.com/google/osv-scanner/releases.
osv-scanner scan source --format sarif --output sca.sarif -r .
osv-scanner scan source -L package-lock.json --format sarif --output sca.sarif
# Fast first pass (ecosystem-native, weaker on transitive):
npm audit --omit=dev --audit-level=high --json > npm-audit.json   # needs package-lock.json
pnpm audit --prod --audit-level high --json > pnpm-audit.json     # pnpm-lock.yaml
yarn npm audit --severity high --json > yarn-audit.json           # Yarn Berry only
pip-audit --format json --output pip-audit.json                   # PyPA + Trail of Bits; OSV + PyPI feed
govulncheck -json ./... > govulncheck.json                        # Go, reachability-aware
dart pub outdated --json > dart-outdated.json                     # staleness only
```

- `npm audit` errors without a lockfile (`ENOLOCK`); `package.json` with no
  lockfile is a supply-chain finding of its own, and SCA for Node is "not run"
  unless osv-scanner covered it.
- Classic Yarn (v1) has no severity-gated audit: use osv-scanner.
- `govulncheck` reports only vulns your code **calls** — the best reachability
  signal you will get for Go. `dart pub outdated` is advisory: it has no CVE
  feed, so it never confirms a vulnerability.
- Suppression: `osv-scanner.toml` with an `[[IgnoredVulns]]` block per id,
  including `reason` and `ignoreUntil` (expiry).

### Secrets — gitleaks (tree + history), TruffleHog (depth + verification)

gitleaks (~150+ patterns, sub-second on diffs) is the pre-commit and CI
workhorse. TruffleHog (800+ types) adds **live credential verification**. Scan
**history, not just the tree**: a key deleted in HEAD is still in the pack files,
still in every clone, and still valid until rotated.

```bash
# Install a pinned release from github.com/gitleaks/gitleaks/releases.
# v8.19+ split scanning: `dir` = working-tree files, `git` = commit history.
# The old `detect` equals `git` and MISSES an uncommitted secret in a file.
gitleaks dir . --redact --no-banner --report-format sarif --report-path secrets-tree.sarif
gitleaks git . --redact --no-banner --report-format sarif --report-path secrets-history.sarif
gitleaks git --pre-commit --staged --redact      # pre-commit hook (staged diff only)
```

```bash
# TruffleHog JSON carries the raw secret (Raw / RawV2 fields). Strip them
# before anything touches disk or the transcript.
trufflehog git file://. --only-verified --json \
  | jq -c 'del(.Raw, .RawV2)' > trufflehog.json
```

- `--redact` is mandatory on gitleaks; without it the report holds the values.
- TruffleHog verification authenticates against the issuing provider with the
  found credential. Run it only on the person's own project, after telling them
  it contacts the provider (it leaves a trace in their logs). Without consent,
  use `--no-verification` and treat every hit as unverified.
- Pattern most teams use: **gitleaks pre-commit** (speed) + **TruffleHog in CI**
  (depth + verification).
- A secret is identified in the audit by **provider + location (file, line,
  commit) + fingerprint** — e.g. the first 12 hex characters of its SHA-256,
  computed without printing the value. Never the value, and not a "last four
  characters" excerpt either.
- Suppression: `.gitleaks.toml` `[allowlist]` (regexes/paths/commits) or an
  inline `# gitleaks:allow` comment on the line.

### Misconfig / IaC / containers — Trivy (pinned, verified)

Trivy scans filesystems, images, IaC and language deps, generates SBOMs and
catches transitive CVEs `npm audit` misses.

```bash
# Install a pinned, signature-verified release (NOT 0.69.4 / 0.69.5 / 0.69.6).
trivy fs --scanners vuln,secret,misconfig --format sarif --output trivy.sarif .
trivy config --format sarif --output trivy-iac.sarif ./infra
trivy image --format sarif --output trivy-img.sarif <pinned-image@sha256:...>
```

- Suppression: `.trivyignore` (one CVE/check id per line) or inline
  `#trivy:ignore:<id>` in IaC files. Record the reason in review, not just the id.

### SARIF notes

SARIF 2.1.0 is the merge format. Where a tool emits only native JSON
(`npm audit`, `pip-audit`, `govulncheck`, TruffleHog), normalize it into the
same candidate fields (below) rather than gating on its raw shape.

## The scanner ledger — ran, not run, failed

Before triage, write one line per planned tool. This is what lets the report say
honestly what was and wasn't covered.

| Tool | Version | Class | Status | Exit code | Output file | Reason if not `ran` |
|---|---|---|---|---|---|---|
| semgrep | 1.164.0 | sast | ran | 0 | sast.sarif | — |
| osv-scanner | (exact) | sca | ran | 1 | sca.sarif | — |
| trivy | — | misconfig | not run | — | — | no verified binary available |
| govulncheck | (exact) | sca | failed | 2 | — | build error in ./cmd/x |

- **Status** is `ran`, `not run`, or `failed`. Only `ran` contributes coverage.
- Learn each tool's exit codes: most return non-zero both for "found issues" and
  for "crashed". Distinguish them from the output, not the exit code alone (e.g.
  osv-scanner: `1` = vulnerabilities found, `127`/`128` = error or nothing to
  scan). A crash is `failed`, never "findings" and never "clean".
- A class with no tool at `ran` is reported as **not reviewed** for that class,
  with the reason, and the person gets the command to run it themselves.

## Triage — from raw hits to a short candidate list

The deliverable is not four SARIF files. It is a deduped, ranked set of
candidates, verified top-down.

### 1. Merge + dedupe

Tools overlap: osv-scanner and Trivy flag the same CVE; gitleaks and TruffleHog
flag the same key.

- **Dedupe key:** `(class, normalized-id, path, line)`.
  - `normalized-id`: CVE/GHSA for SCA; rule id for SAST; secret fingerprint
    (provider + location + hash prefix, above) for secrets.
- **Keep the richest record** when two tools collide: prefer the one carrying
  **verification** (TruffleHog `Verified: true`) or **reachability**
  (govulncheck), and merge the tool names into a list of contributors.

### 2. Normalize severity (a triage hint)

SARIF `level` (`error`/`warning`/`note`/`none`) and tool-native severities
disagree. Map them to one scale so you know what to verify first:

| Source signal | Triage priority |
|---|---|
| CVSS ≥ 9.0 / verified live secret | `critical` |
| SARIF `error` / CVSS 7.0–8.9 / Semgrep `ERROR` | `high` |
| SARIF `warning` / CVSS 4.0–6.9 / Semgrep `WARNING` | `medium` |
| SARIF `note` / CVSS < 4.0 / `INFO` | `low` |

Where a tool gives both CVSS and a label, take the **higher**. This is the
order you verify in. It is not the finding's severity: that is set when the
candidate is confirmed (`verification.md`).

### 3. Rank by exploitability, not by count

Score each candidate on three axes, then sort. One reachable RCE outranks fifty
theoretical library advisories.

| Axis | High | Low |
|---|---|---|
| **Reachable** | the vulnerable code/dep is actually called (govulncheck-confirmed, in the import graph, traced from an entry point) | present but unused / behind a disabled flag |
| **Exposed** | on an untrusted path (HTTP handler, CLI arg, file upload, deserialization, webhook) | internal-only, dev-only, test fixture |
| **Sink sensitivity** | auth, money, PII, RCE, secret material | logging, cosmetic, info-leak of non-sensitive data |

- **Critical candidate:** reachable **+** exposed **+** sensitive sink, or any
  verified live secret.
- **High:** two of three axes high, or a reachable CVE with a public exploit.
- **Medium:** one axis high; present-but-not-clearly-reachable CVEs.
- **Low / informational:** theoretical, unreachable, or test-only.

Verify criticals first, then highs. Mediums and lows may be summarized; they
still need a verdict before they appear as findings.

### 4. Suppress with a written justification, never a blanket ignore

A suppression is a per-finding record: **who, why, and an expiry**, so it
surfaces again instead of hiding the next real bug. Use the tool-native
mechanism (osv-scanner.toml `ignoreUntil`, `.trivyignore`, gitleaks allowlist,
`// nosemgrep`) and record it in the audit as suppressed with the same three
fields. A candidate you rejected after verification is not a suppression — it is
a verdict, with its reason.

### What a good triage looks like

```text
BAD  — dump 412 raw hits from four tools, sorted alphabetically, call them findings.
GOOD — 3 candidates verified first, each now confirmed with evidence:
       1. [secrets] VERIFIED live Stripe key (fingerprint 3f9a1c0e7b2d) in
          config/.env, commit a1b2c3d (history) → ROTATE NOW, then scrub
       2. [sca] CVE-2024-… lodash 4.17.20 transitive, reachable from
          src/api/parse.ts:31 → bump to 4.17.21 via overrides
       3. [sast] SQL built from req.query in routes/search.js:48 → parameterize
       + 7 medium candidates summarized, pending verification
       + 18 suppressed (each with who / why / expiry)
       + not run: trivy (no verified binary) → misconfig not reviewed
```

## Candidate record

Each deduped candidate carries, at minimum: `class` (`sast | sca | secrets |
misconfig`), rule id (CVE / GHSA / rule id / secret fingerprint), contributing
tool(s) with versions, `path`, `line` (0 for a whole-lockfile CVE), triage
priority, exploitability notes (`reachable | exposed | theoretical`), and a short
title. Candidates live in your working notes, not in `findings.json`. Each one
enters `findings.json` only with a verdict (`confirmed`, `needs_validation` or
`rejected`, per `verification.md` and `schema/findings.schema.json`), and only a
`confirmed` record carries a severity; the validator rejects any other record
that claims one. A real but unexploitable weakness (an unreachable CVE, a missing
header with no shown harm) goes to the report's hardening notes with its
`path:line`, not into findings. Never put a secret value in any field.

## CI wiring

Scanners in CI follow the same rules: pinned, verified, and a missing tool fails
the job instead of skipping silently.

```yaml
# .github/workflows/security-scan.yml — pin every action to a full SHA.
permissions:
  contents: read
  security-events: write               # only for the SARIF upload step
steps:
  - uses: actions/checkout@<full-40-char-sha>
    with: { fetch-depth: 0, persist-credentials: false }
  - uses: aquasecurity/trivy-action@<full-40-char-sha>  # NEVER @latest / @master / a tag
    with: { scan-type: fs, format: sarif, output: trivy.sarif }
  - uses: github/codeql-action/upload-sarif@<full-40-char-sha>
    with: { sarif_file: trivy.sarif }
```

- Upload SARIF to code scanning so hits appear on the PR; gate the merge on the
  job's exit status, not on a human reading logs.
- The full per-stack CI gate (gitleaks + semgrep + audits) is in
  `secrets-and-supply-chain.md`. The pipeline shell itself belongs to the
  catalog's CI skill; the broader lint/test gate is `verify`.

## Anti-patterns

| Anti-pattern | Do instead |
|---|---|
| Reporting scanner hits as findings | Every hit is a candidate. Verify, then confirm with evidence (`verification.md`). |
| "No output, so it's clean" | A tool that didn't run, crashed or wasn't installed is "not run". Report the class as not reviewed. |
| Pulling `aquasecurity/trivy-action@latest` because it's the official action | March 2026: a hijacked tag stole CI secrets. Pin a full SHA, verify provenance. |
| `npx <scanner>` or a scanner from `node_modules/.bin` | The audited project controls those. Pinned binary outside the project, absolute path. |
| Treating every scanner hit as a bug to fix | Most are noise. Rank by reachable + exposed + sensitive sink; verify the few that matter. |
| Calling the repo clean after scanning only the working tree | History holds the deleted keys. Scan history; a removed-in-HEAD key is still leaked and live. |
| Using `gitleaks detect` alone | It scans history only and misses uncommitted secrets. Run `gitleaks dir` and `gitleaks git`. |
| Declaring deps fine because `npm audit` is clean | Native auditors miss transitive CVEs. Run osv-scanner/Trivy too; native is the fast pass. |
| Committing a blanket `.semgrepignore` to quiet CI | Suppress per finding with who / why / expiry. |
| Deleting a verified key from the file and moving on | Rotate the credential first, then scrub history. The committed value is already compromised. |
| Running gitleaks without `--redact`, or saving TruffleHog JSON raw | The report becomes a second leak. Redact; drop `Raw`/`RawV2`. |
| Taking SARIF `level` as the severity | Tools disagree. Normalize for triage; set severity only on confirmation. |
| Dumping all tool outputs in the PR for the reviewer to sort | Merge, dedupe, rank, verify, and report the confirmed few. |
| Letting the scan auto-fix the deps it finds | Read-only by default. Propose bumps; apply only with permission. |

## Record the choices

In a project with a `02-DOCS/` layer, record the scanner choices, pinned
versions, gate thresholds and accepted-risk suppressions in
`02-DOCS/wiki/stack/security-scan.md`, indexed from `02-DOCS/wiki/index.md`.
Read it first on every run so the next audit inherits the pinned tools instead
of re-deriving them. No `02-DOCS/`? Skip silently — conventions are recorded,
never a gate.
