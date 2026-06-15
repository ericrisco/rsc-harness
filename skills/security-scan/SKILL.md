---
name: security-scan
description: "Use when running automated security scanners over a repo or app and turning the raw output into a triaged, ranked, gate-able report: scan for vulnerabilities before shipping, audit dependencies/lockfiles for known CVEs, find secrets committed to the tree or git history, run SAST, or wire scanners into CI. Triggers: 'scan this repo for vulnerabilities', 'check my package-lock for CVEs', 'did anyone commit AWS keys', 'scan git history for leaked keys', 'my lockfile has a transitive CVE', 'is aquasecurity/trivy-action@latest safe', 'set up Semgrep/gitleaks to fail CI', 'escanea el repo en busca de vulnerabilidades', 'audita las dependencias', 'analitza les dependències'. NOT threat-modeling, OWASP design reasoning, or authoring the fix (that is secure-coding)."
tags: [security, sast, sca, secrets, scanning, owasp]
recommends: [secure-coding, github-actions, verify]
origin: risco
---

# Security scan — orchestrate scanners, triage the noise, emit a gate

A **machine-first** vulnerability sweep. Point automated scanners at a codebase,
collect SARIF/JSON, then do the work that has actual value: dedupe cross-tool
overlap, rank by exploitability, and emit one gate artifact CI can act on. The
finding comes from a **tool run**, not a hunch — if you are reasoning about a
design or hand-writing a fix, that is [`secure-coding`](../secure-coding/SKILL.md),
not this skill.

Your job is orchestration + triage. Not eyeballing code, not authoring patches.

## Operating posture

- **Read-only by default.** Scan, triage, report. Apply fixes (version bumps,
  rotation, `.gitignore` edits) only when the user asks. *Why:* a security sweep
  that silently mutates the tree destroys the evidence and the trust.
- **Machine-first.** Every finding must trace to a scanner run with a `ruleId`
  and a source location. *Why:* "I think this looks injectable" is design
  reasoning — route it to `secure-coding`. This skill ships reproducible output.
- **Pin and verify your scanners.** Pin exact versions, verify checksums/SHAs,
  never pull `@latest` GitHub Actions. *Why:* in **March 2026 Trivy was
  supply-chain compromised** — malicious releases `v0.69.4/0.69.5/0.69.6` and a
  hijacked `aquasecurity/trivy-action` exfiltrated CI secrets. Your scanner runs
  with repo + CI-secret access; an unpinned scanner is itself the attack surface.
- **SARIF everything.** Make every tool emit SARIF (or JSON you normalize to it).
  *Why:* a common schema is what lets you merge four tools, dedupe, and feed one
  artifact into CI instead of four incompatible logs.
- **Triage before you report.** Raw scanner output is high-noise. Rank by
  exploitability and dedupe overlap; never dump 400 raw findings on the user.

## The four scan classes

| Class | What it catches | Primary tool | Backup / fast pass |
|---|---|---|---|
| **SAST** | injection, XSS, path traversal in *first-party* code | Semgrep | — |
| **SCA / deps** | known CVEs in dependency manifests + lockfiles | osv-scanner | `npm audit`, `pip-audit` |
| **Secrets** | credentials in the tree **or git history** | gitleaks (speed) | TruffleHog (depth + live verification) |
| **Misconfig / IaC** | Dockerfile, k8s, Terraform, exposed config | Trivy `config` | Semgrep rulesets |

### Tool selection by ecosystem

Pick by what is in the repo. This is the real branch point — match the tool to
the manifest, do not run everything everywhere.

| Repo contains | SAST | SCA | Secrets | Misconfig |
|---|---|---|---|---|
| Node (`package-lock.json`/`pnpm-lock.yaml`) | Semgrep | osv-scanner + `npm audit` (fast) | gitleaks → TruffleHog | Trivy |
| Python (`poetry.lock`/`requirements.txt`) | Semgrep | osv-scanner + `pip-audit` (fast) | gitleaks → TruffleHog | Trivy |
| Go (`go.mod`/`go.sum`) | Semgrep | osv-scanner (+ `govulncheck` for reachability) | gitleaks | Trivy |
| Containers (`Dockerfile`, images) | — | Trivy `fs`/`image` | Trivy `--scanners secret` | Trivy `config` |
| IaC (Terraform/k8s/Helm) | Semgrep (IaC rules) | — | gitleaks | Trivy `config` |
| Monorepo (mixed) | Semgrep `auto` | osv-scanner (multi-ecosystem) | gitleaks → TruffleHog | Trivy |

Full install (pinned), flag matrix, and suppression syntax: `references/tools.md`.

## Run recipes

All recipes emit SARIF or JSON so they merge into one report. **Pin the version
shown** — the placeholders below mark where to lock an exact tag/digest.

### SAST — Semgrep

Free OSS edition (latest `1.164.0`, 2026-05-27): 30+ languages, ~2,000 community
rules. SCA + Secrets rulesets are gated behind the hosted platform — use the
dedicated tools below for those, not Semgrep.

```bash
# Pin via the CLI version, not @latest. OWASP ruleset, SARIF out.
semgrep scan --config p/owasp-top-ten --sarif --output sast.sarif .
# Broader local sweep (community rules), no telemetry:
semgrep scan --config auto --sarif --output sast.sarif --metrics off .
```

### SCA — osv-scanner (primary), native auditors (fast pass)

osv-scanner (OpenSSF/Google) checks lockfiles against OSV.dev across ecosystems
and catches **transitive** CVEs the native auditors miss. Run native first for
speed, osv-scanner for coverage — never native alone.

```bash
# Primary: lockfile-aware, multi-ecosystem, SARIF.
osv-scanner scan source --format sarif --output sca.sarif .
# Fast first pass (ecosystem-native, weaker on transitive):
npm audit --omit=dev --audit-level=high --json > npm-audit.json   # Node
pip-audit --format json --output pip-audit.json                   # Python
```

### Secrets — gitleaks (tree + history), TruffleHog (verified)

gitleaks (~150+ patterns, sub-second on diffs) is the pre-commit/CI workhorse.
TruffleHog (800+ types) adds **live credential verification** — it auth-tests a
hit to tell a real leaked key from a sample. Scan **history, not just the tree**:
a key deleted in HEAD is still in the pack files and still rotatable.

```bash
# gitleaks: redacted SARIF over the working tree AND full git history.
gitleaks detect --redact --report-format sarif --report-path secrets.sarif
# TruffleHog: only verified (live) secrets across history.
trufflehog git file://. --only-verified --json > trufflehog.json
```

### Misconfig / IaC — Trivy (PINNED — see the caveat)

Trivy scans filesystems, images, and IaC and finds transitive CVEs `npm audit`
misses. After the March 2026 compromise, **never** run an unpinned Trivy.

```bash
# Pin the EXACT version (NOT v0.69.4/.5/.6 — those were the malicious releases).
# Verify the checksum/cosign signature before first use. See references/tools.md.
trivy fs --scanners vuln,secret,misconfig --format sarif --output trivy.sarif .
```

## Triage — turn noise into a ranked report

The deliverable is not the four SARIF files. It is a deduped, ranked report.

1. **Merge + dedupe.** Cross-tool overlap is real (osv-scanner and Trivy both
   flag the same CVE; gitleaks and TruffleHog both flag the same key). Key on
   `(class, normalized-id, path, line)` and keep the richest record — prefer the
   one with verification (TruffleHog) or reachability (govulncheck).
2. **Normalize severity.** SARIF `level` and tool-native severities disagree;
   map them all to one `critical/high/medium/low` scale (`references/triage.md`).
3. **Rank by exploitability, not by count.** A finding scores higher when it is
   **reachable** (called, not just present) **+ exposed** (on an untrusted path)
   **+ a sensitive sink** (auth, money, PII, RCE). A verified live secret or a
   reachable RCE CVE outranks a theoretical lib finding behind a feature flag.
4. **Suppress with a written justification, never a blanket ignore.** Each
   suppression records *who, why, and an expiry* — not a silent `.semgrepignore`
   that hides the next real bug too.

```text
BAD  — dump 412 raw findings from four tools, sorted alphabetically, no ranking.
GOOD — 3 unsuppressed criticals first:
       1. [secrets] VERIFIED live Stripe sk_live_… in config/.env (history) → ROTATE NOW
       2. [sca] CVE-2024-… lodash 4.17.20 transitive, reachable in src/api/parse.ts → bump 4.17.21
       3. [sast] SQL built from req.query in routes/search.js:48 → parameterize
       + 7 mediums summarized, + 18 suppressed (each with justification + expiry).
```

Full ranking rubric, dedupe keying, and severity-normalization map:
`references/triage.md`.

## The gate artifact

Emit one `security-scan-report.json` — the machine-checkable contract CI gates on.

```json
{
  "schemaVersion": "1.0",
  "scannedAt": "2026-06-02T10:00:00Z",
  "target": ".",
  "tools": [{ "name": "osv-scanner", "version": "2.0.2" }],
  "summary": { "critical": 1, "high": 2, "medium": 7, "low": 14, "suppressed": 18 },
  "findings": [
    {
      "class": "sca",
      "ruleId": "CVE-2024-XXXXX",
      "path": "package-lock.json",
      "line": 0,
      "severity": "critical",
      "status": "open",
      "tool": "osv-scanner",
      "exploitability": "reachable",
      "title": "Prototype pollution in lodash <4.17.21"
    }
  ]
}
```

- `status` is one of `open | suppressed | fixed`; `severity` one of
  `critical | high | medium | low`. Schema in full: `references/triage.md`.
- **Gate rule:** any `open` finding at `critical` (and, on a strict gate, `high`)
  → fail. `suppressed` never fails. `scripts/verify.sh` enforces exactly this and
  exits `0` on a clean/empty report (no false failure).

## CI wiring (brief)

- Pin actions to a **full commit SHA**, not a tag, never `@latest` — the hijacked
  `aquasecurity/trivy-action` was pulled by tag.

```yaml
# .github/workflows/security-scan.yml — pin the SHA, verify before bumping.
- uses: aquasecurity/trivy-action@<full-40-char-sha>  # NEVER @latest / @master
  with: { scan-type: fs, format: sarif, output: trivy.sarif }
- run: ./scripts/verify.sh   # gate on security-scan-report.json
```

- Upload SARIF to code scanning; gate the merge on `verify.sh`, not on a human
  reading logs. See [`github-actions`](../github-actions/SKILL.md) for the
  pipeline shell and [`verify`](../verify/SKILL.md) for the broader green gate
  this feeds.

## Anti-patterns

| Rationalization | Reality |
|---|---|
| "Pull `aquasecurity/trivy-action@latest`, it's official." | March 2026: a hijacked tag stole CI secrets. Pin a full SHA, verify provenance. |
| "Every scanner finding is a bug to fix." | Most are noise. Rank by reachable + exposed + sensitive sink; report the few that matter. |
| "Scanned the working tree, no secrets." | History holds the deleted keys. Scan git history; a removed-in-HEAD key is still leaked and live. |
| "`npm audit` is clean, deps are fine." | Native auditors miss transitive CVEs. Run osv-scanner/Trivy too; native is the fast pass, not the only pass. |
| "Commit a blanket `.semgrepignore` to quiet CI." | A blanket ignore hides the next real bug. Suppress per-finding with a written justification + expiry. |
| "We found a verified key, I deleted it from the file." | Deleting ≠ safe. Rotate the credential first, then scrub history. The committed value is already compromised. |
| "Trust the SARIF `level`, that's the severity." | Tools disagree. Normalize to one scale before you rank or gate. |
| "Dump all four tool outputs in the PR, let the reviewer sort it." | The reviewer won't. Merge, dedupe, rank, and emit one report. |
| "Run the scan; it'll auto-fix the deps." | Read-only by default. Propose bumps; apply only when asked — never mutate during a sweep. |

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md)
Karpathy wiki), record the scanner choices, pinned versions, gate thresholds, and
any accepted-risk suppressions in `02-DOCS/wiki/stack/security-scan.md`, and index
it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short
pointer to it). Read it first on every run so the
next agent inherits the pinned tools and thresholds instead of re-deriving them.
No `02-DOCS/`? Skip silently. Conventions are recorded, not gated — never block
the scan on this.

## See Also

- [`secure-coding`](../secure-coding/SKILL.md) — the human-reasoning sibling:
  threat-model a feature, hand-write the vulnerable→fixed diff. *If the answer
  comes from a tool run it's this skill; if it comes from reasoning about the
  design it's secure-coding.*
- [`review`](../review/SKILL.md) — adversarial review of a diff against a spec.
- [`code-review`](../code-review/SKILL.md) — general correctness/quality review.
- [`verify`](../verify/SKILL.md) — the broader lint/type/test green gate this
  feeds into.
- **References** — `references/tools.md` (pinned installs, flag matrix,
  suppression syntax); `references/triage.md` (ranking rubric, dedupe keying,
  severity map, full report schema).
</content>
</invoke>
