# Triage — ranking, dedupe, severity, report schema

The value of this skill lives here: scanner output is high-noise, and the job is
turning four overlapping logs into one ranked, gate-able report.

## Exploitability ranking rubric

Score each finding on three axes, then sort. Count of findings is irrelevant —
one reachable RCE outranks fifty theoretical lib advisories.

| Axis | High | Low |
|---|---|---|
| **Reachable** | the vulnerable code/dep is actually called (govulncheck-confirmed, in the import graph) | present but unused / behind a disabled flag |
| **Exposed** | on an untrusted path (HTTP handler, CLI arg, file upload, deserialization) | internal-only, dev-only, test fixture |
| **Sink sensitivity** | auth, money, PII, RCE, secret material | logging, cosmetic, info-leak of non-sensitive data |

- **Critical:** reachable **+** exposed **+** sensitive sink. Or any **verified
  live secret** (TruffleHog confirmed) — those are critical by definition.
- **High:** two of three axes high, or a reachable CVE with a public exploit.
- **Medium:** one axis high; present-but-not-clearly-reachable CVEs.
- **Low / informational:** theoretical, unreachable, or test-only.

Report criticals first with the concrete remediation (rotate / bump to fixed
version / parameterize), then summarize the rest. Do not emit a flat list.

## Cross-tool dedupe

Tools overlap: osv-scanner and Trivy both flag the same CVE; gitleaks and
TruffleHog both flag the same key.

- **Dedupe key:** `(class, normalized-id, path, line)`.
  - `normalized-id`: CVE/GHSA for SCA; rule id for SAST; secret fingerprint
    (provider + redacted last-4 + location) for secrets.
- **Keep the richest record** when two tools collide: prefer the one carrying
  **verification** (TruffleHog `verified: true`) or **reachability**
  (govulncheck), and merge the `tool` field into a list of contributors.

## Severity normalization

SARIF `level` (`error`/`warning`/`note`/`none`) and tool-native severities
disagree. Map everything to one scale before ranking or gating:

| Source signal | Normalized |
|---|---|
| SARIF `error` / CVSS ≥ 9.0 / verified secret | `critical` |
| SARIF `error` / CVSS 7.0–8.9 / Semgrep `ERROR` | `high` |
| SARIF `warning` / CVSS 4.0–6.9 / Semgrep `WARNING` | `medium` |
| SARIF `note` / CVSS < 4.0 / `INFO` | `low` |

Where a tool gives both CVSS and a label, take the **higher** of the two.

## Suppression discipline

A suppression is a per-finding record, not a silent ignore-file. Each one carries
`who`, `why`, and `expiry` so it surfaces again instead of hiding the next bug.
Use the tool-native suppression (osv-scanner.toml `ignoreUntil`, `.trivyignore`,
gitleaks allowlist, `// nosemgrep`) and set `status: "suppressed"` in the report.

## Report schema — `security-scan-report.json`

This is the contract `scripts/verify.sh` gates on.

```json
{
  "schemaVersion": "1.0",
  "scannedAt": "<ISO-8601 UTC>",
  "target": "<path or repo>",
  "tools": [{ "name": "<tool>", "version": "<pinned>" }],
  "summary": {
    "critical": 0, "high": 0, "medium": 0, "low": 0, "suppressed": 0
  },
  "findings": [
    {
      "class": "sast | sca | secrets | misconfig",
      "ruleId": "<CVE / GHSA / rule-id / secret-fingerprint>",
      "path": "<file>",
      "line": 0,
      "severity": "critical | high | medium | low",
      "status": "open | suppressed | fixed",
      "tool": "<tool name>",
      "exploitability": "reachable | exposed | theoretical",
      "title": "<short human description>"
    }
  ]
}
```

- `summary` counts must agree with `findings` (verify.sh tolerates an empty
  `findings` array as a clean pass).
- **Gate:** any `findings[]` with `status: "open"` and `severity: "critical"`
  → fail. Strict mode also fails on `open` + `high`. `suppressed`/`fixed` never
  fail. An empty/clean report exits `0`.
