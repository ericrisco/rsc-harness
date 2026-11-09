# Secrets & supply chain — the part that gets you breached

Keep secrets out of the repo and out of client bundles, pin every dependency,
and gate the result in CI. This file is about the **project's** secrets and
dependencies. How *you*, the agent, handle a credential during an audit or a fix
is `secrets-discipline.md` — read it before touching one.

Tools: `gitleaks`, `pip-audit` (or `uvx pip-audit`), `osv-scanner`,
`npm`/`pnpm`, `govulncheck`, `syft`. Versions: Python 3.12+ /
`pydantic-settings`, Next.js 15, Go 1.22+, Flutter / Dart 3, PostgreSQL 16. How to
run each scanner and read its output: `scanners.md`.

## The rules in one paragraph

Env var or secret manager, never the repo; `.env` gitignored. In Next.js only
`NEXT_PUBLIC_*` is public — a secret read in a Client Component ships to the
browser. In a project with the `01-TOOLS/` layer, provider credentials live in
`01-TOOLS/<PROVIDER>/.env` (gitignored) — same rule, never committed. Pin and
commit the lockfile; install with the frozen/verified flag. Audit per stack. On
exposure: **rotate the credential first, then scrub history**, then confirm
with gitleaks. SBOM via `syft`; provenance via `cosign`/SLSA.

## Env vs vaults

12-factor env vars for dev; a secret manager (HashiCorp Vault, a cloud Secrets
Manager, Doppler) for prod. **Fail fast** on a missing secret at startup so a
misconfigured deploy never runs half-authenticated.

```python
# GOOD (FastAPI) — pydantic-settings BaseSettings; missing secret = startup error.
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="forbid")
    database_url: str
    jwt_signing_key: SecretStr          # never logged when interpolated

settings = Settings()                   # raises if a required var is unset
```

```go
// GOOD (Go) — mustEnv panics at startup if the variable is missing.
func mustEnv(key string) string {
    v, ok := os.LookupEnv(key)
    if !ok || v == "" {
        panic("missing required env var: " + key)
    }
    return v
}
var dbURL = mustEnv("DATABASE_URL")
```

```ts
// Next.js — ONLY NEXT_PUBLIC_* reaches the browser bundle. Everything else is
// server-only. BAD: reading a secret in a Client Component ships it to users.
// "use client" + process.env.STRIPE_SECRET_KEY  -> leaked to the browser.
// GOOD: read secrets in Server Components, Route Handlers, or Server Actions.
const stripeKey = process.env.STRIPE_SECRET_KEY; // server-only file, no "use client"
```

```dart
// Flutter — there is NO server side; anything compiled into the app binary is
// extractable. NEVER ship a backend API secret in the client. Inject build-time
// public config with --dart-define; store per-user tokens in the OS keystore.
// BAD: const apiSecret = "sk_live_...";  // shipped in the APK/IPA, trivially dumped
const apiBaseUrl = String.fromEnvironment("API_BASE_URL");  // flutter run --dart-define=API_BASE_URL=...
```

### Which secret lives where

| Secret kind | Dev | Prod | Never |
|---|---|---|---|
| Backend API keys (Stripe secret, DB URL) | `.env` (gitignored) | Secret manager / platform env | Repo, client bundle, mobile binary, CI YAML |
| JWT signing key | `.env` | Secret manager (rotatable) | Repo, logs, `NEXT_PUBLIC_*` |
| Per-user access/refresh token | n/a | OS keystore (mobile) / `HttpOnly` cookie (web) | `localStorage`, `SharedPreferences` |
| Provider credentials for project tooling | `01-TOOLS/<PROVIDER>/.env` (gitignored) | CI secret store | Repo, transcript, command arguments |
| Public config (base URL, publishable key) | `.env` | env / `--dart-define` / `NEXT_PUBLIC_*` | — (public by design) |

`.env.example` holds placeholders only. A real value in an example file, a
README or a CI YAML is a committed secret.

## Never in repo

`.gitignore` patterns — ignore real env files, keep the example:

```text
.env
.env.*
!.env.example
```

Before writing anything secret-shaped into a file, prove the file is ignored:
`git check-ignore -q <path>` must succeed. A failing check, or a folder with no
git repository, means halt: fix `.gitignore` or use the platform's secret
manager.

Run `gitleaks` as a pre-commit hook, against history, and in CI. **Incident
order when a secret IS committed: rotate FIRST, then scrub history.** History
rewriting with `git filter-repo` is slow and forces every clone to re-sync; the
secret is already public the instant it's pushed, so revoke/rotate the
credential immediately and treat the scrub as cleanup. Deleting the line in a
new commit fixes nothing: the value stays in history and in every clone.

```bash
# Rotate the credential at the provider FIRST. Then:
git filter-repo --path config/secrets.yml --invert-paths   # scrub from history
gitleaks git . --no-banner --redact --exit-code 1          # confirm history is clean
gitleaks dir . --no-banner --redact --exit-code 1          # confirm working tree is clean
```

## Rotation

Rotate on a cadence (e.g. quarterly) and immediately on any suspected exposure.
After rotation, **invalidate active sessions and tokens** so credentials minted
under the old secret can't keep riding along (a JWT signing-key rotation must
revoke outstanding access/refresh tokens, or attackers keep their forged ones).

On-exposure runbook, in order — each step assumes the previous one is done:

1. **Revoke/rotate at the provider** (Stripe, AWS, the OIDC IdP). The leaked
   value is dead the moment a new one is minted; this is the only step that
   actually stops the bleed. The person who owns the account does this, or
   approves you doing it under `secrets-discipline.md`.
2. **Roll forward in prod** — push the new value to the secret manager and
   redeploy. Keep the old key valid for a short overlap only if a zero-downtime
   handoff requires it, then disable it.
3. **Invalidate derived credentials** — sessions, access/refresh tokens, and any
   cache keyed on the old secret (see the JWT note above).
4. **Scrub history** with `git filter-repo` (slow; do it after the rotation, not
   before) and force every clone to re-sync.
5. **Add a `gitleaks` rule / pre-commit hook** so the same class of leak can't
   recur, and note the incident in the audit log.

In an audit report, a leaked secret is named by provider, location and
fingerprint — never by its value (`scanners.md` → secrets).

## Dependency pinning & lockfiles

Commit the lockfile; install with the frozen/verified flag in CI.

| Ecosystem | Pin / lock | Verified install |
|---|---|---|
| Python | `uv lock` or `pip-tools` compile **with hashes** | `pip install --require-hashes -r requirements.txt` |
| Node | `package-lock.json` / `pnpm-lock.yaml` committed | `npm ci` / `pnpm i --frozen-lockfile` |
| Go | `go.sum` committed | `go mod verify` |
| Dart | `pubspec.lock` committed | `dart pub get --enforce-lockfile` |

`--require-hashes` and `go mod verify` defend against a registry serving a
different artifact than the one you locked (A08 integrity). `package.json`
without a lockfile is itself a finding: every install can resolve to something
new, and `npm audit` can't run (it needs the lockfile).

## Audit tooling — command, how to read, how to fix

| Tool | Command | A finding looks like | Fix |
|---|---|---|---|
| pip-audit | `pip-audit` | `Name Version ID Fix-Versions` row per vuln | Upgrade to a fix version; use constraints for a transitive |
| osv-scanner | `osv-scanner scan source -L pnpm-lock.yaml` | OSV id + severity + introduced/fixed range; lockfile-aware, multi-ecosystem (v2 CLI) | Upgrade; `overrides` for a transitive |
| npm audit | `npm audit --omit=dev --audit-level=high` | severity + path through the dep tree | `npm audit fix`, or `overrides` for a transitive |
| govulncheck | `govulncheck ./...` | only vulns your code **calls** (reachability) + the call trace | Upgrade; `go mod` `replace` for a transitive |
| dart | `dart pub outdated` | outdated (no CVE feed) — advisory only | Upgrade to latest resolvable; osv-scanner reads `pubspec.lock` for known advisories |

`govulncheck`'s reachability advantage: it won't flag a CVE in a function your
code never invokes, cutting false positives that `osv-scanner` (which matches
by version) reports. Use both — osv for breadth, govulncheck for Go precision.

Overriding a transitive (recap):

```json
{ "overrides": { "vulnerable-lib": "1.2.4" } }
```

```text
vulnerable-lib==1.2.4
```

```go
replace vulnerable-lib v1.2.3 => vulnerable-lib v1.2.4
```

## SBOM & provenance

Emit a Software Bill of Materials with `syft` so you can answer "are we
affected by CVE-X?" instantly:

```bash
syft dir:. -o cyclonedx-json=sbom.cdx.json     # or spdx-json
```

For build provenance, sign artifacts with `cosign` and target SLSA build levels
so consumers can verify an artifact came from your pipeline, not a tampered one.
For browser-loaded third-party scripts, use SRI (`integrity="sha384-…"
crossorigin`) — see A08 in `fixes-by-stack.md`. Your security tools are
dependencies too: pin and verify them the same way (`scanners.md`).

## CI security gate (the payoff)

Secret scan + SAST + per-stack CVE audit on every PR, failing the build on
high/critical findings. Every action and image is pinned to a full commit SHA or
digest and every tool to an exact version — a tag can be moved under you.

```yaml
name: security
on: [pull_request]
permissions:
  contents: read                         # least privilege for the job token
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<full-40-char-sha>    # pin the SHA, not @v4
        with: { fetch-depth: 0, persist-credentials: false }  # full history for gitleaks
      - name: gitleaks
        # Pinned, checksum-verified release binary; scans history and the tree.
        run: |
          gitleaks git . --redact --no-banner --exit-code 1
          gitleaks dir . --redact --no-banner --exit-code 1
      - name: semgrep
        # Run the CLI in its official image, pinned by digest. Explicit rulesets
        # keep metrics off; `--config auto` needs metrics and sends project data.
        run: >
          docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep@sha256:<digest>
          semgrep scan --config p/owasp-top-ten --error --severity ERROR --metrics off
      - name: python audit
        if: hashFiles('**/pyproject.toml', '**/requirements*.txt') != ''
        run: pipx run pip-audit==<exact-version>
      - name: node audit
        if: hashFiles('**/package-lock.json') != ''
        run: npm audit --omit=dev --audit-level=high
      - name: go audit
        if: hashFiles('**/go.mod') != ''
        run: go run golang.org/x/vuln/cmd/govulncheck@<exact-version> ./...
```

Add Dependabot or Renovate to open dependency-bump PRs automatically (e.g.
`.github/dependabot.yml` with a `package-ecosystem` entry per manifest, plus
`github-actions` so pinned SHAs get bumped too), so CVEs get patched on a
schedule rather than only when the gate fails.

A CI step that is skipped because its manifest is absent is fine. A step that
is skipped because the tool is missing is a hole: make the job fail, or report
that class as "not run" (`scanners.md`).

---

See `fixes-by-stack.md` (A06, A08) for the per-stack override/replace code,
`scanners.md` for local runs and triage, and `secrets-discipline.md` for how the
agent handles any credential it needs.
