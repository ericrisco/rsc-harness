---
name: deployment
description: "Use when taking an app from source to live: choosing the deploy target from requirements (Hetzner+Coolify vs Vercel vs a third), then wiring container → CI → registry → host with build secrets, healthchecks and rollback. NOT one platform's mechanics (that is `coolify`, `vercel`, `railway`, `render`), NOT the Dockerfile alone (that is `docker`)."
tags: [deploy, docker, ci, github-actions, coolify]
recommends: [secure-coding]
origin: risco
---

# Ship it — Docker, GitHub Actions, and a deploy target (Coolify · Vercel · Hetzner)

Take any app in this repo from source → hardened container → green CI/CD → live on the right
host, with secrets that never leak into image layers or logs, and a defined rollback path.

```text
source → Dockerfile (multi-stage) → CI (lint·test·build·scan) → registry (ghcr) → target (Coolify·Vercel·Hetzner, rolling) → live + rollback
                                                                                     ▲
                                                              choose via references/hosting-targets.md
```

**Out of scope — say so and stop:** Kubernetes / Helm / ECS / Nomad orchestration; cloud IaC
(Terraform, Pulumi, CloudFormation — only the GHA↔cloud **OIDC handshake** is covered, not
provisioning); application runtime code and DB schema/migration logic (the per-stack skills at the
bottom own what runs *inside* the container).

## Decision rules

Consult these first. They settle 90% of choices before you write a line.

**Table A — Base image by stack**

| Stack | Base image | Notes |
| --- | --- | --- |
| FastAPI / Python | `gcr.io/distroless/python3-debian12:nonroot` (or `python:3.13-slim`) | UID 65532, no shell |
| Go | `gcr.io/distroless/static-debian12:nonroot` | `CGO_ENABLED=0` static, ~10 MB |
| Next.js | `node:24-bookworm-slim` | Active LTS; `output: "standalone"` |
| Flutter web | `nginxinc/nginx-unprivileged:1.27-alpine` | static SPA + `try_files` fallback |
| Postgres | `postgres:18-alpine` | managed/official — do NOT build a custom image |

**Table B — Coolify build pack**

| Situation | Pick |
| --- | --- |
| Repo has a Dockerfile | Dockerfile pack (always — CI/prod parity) |
| No Dockerfile, standard stack | Nixpacks / Railpack |
| Static SPA, no server | Static |
| Multi-service local parity | Docker Compose |
| CI already builds & pushes | Docker Image (deploy prebuilt ghcr image) |

**If it has a Dockerfile, use the Dockerfile pack.**

**Table C — Deploy strategy**

| Change type | Strategy |
| --- | --- |
| Backward-compatible | Rolling (Coolify default, healthcheck-gated) |
| Breaking / instant cutover / risky migration | Blue-green: two Coolify resources + domain swap |
| Want gradual % traffic (canary) | Canary = release to a small subset, watch metrics, then ramp. Vanilla Coolify has no traffic split — emulate with feature flags (in-app % gating) or a blue-green pair behind a flagged path |

**Table D — Secret delivery**

| Secret kind | Mechanism |
| --- | --- |
| Build-time non-secret | `ARG` |
| Build-time secret (private dep token) | BuildKit `--mount=type=secret` (NEVER `ARG`) |
| Runtime secret | Coolify env (Is Secret) / GHA `secrets` |
| Cloud auth | OIDC — never a stored key |

## Docker — the canonical multi-stage shape

One process per container: no supervisord-managed bundles, let the orchestrator scale.

```dockerfile
# syntax=docker/dockerfile:1
# ---- builder: full toolchain, deps cached before source ----
FROM <builder-base> AS builder
WORKDIR /app
COPY <lockfile> <manifest> ./           # lockfile FIRST → cached dep layer
RUN <install-deps-from-lockfile>        # changes only when the lockfile changes
COPY . .                                # source last
RUN <build>

# ---- runtime: minimal, non-root, no toolchain ----
FROM <runtime-base>                      # distroless / -slim / unprivileged nginx
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app/<artifact> ./
USER nonroot:nonroot
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["<readiness-probe>"]             # exec-form (distroless has no shell)
CMD ["<entrypoint>", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# GOOD: secret consumed in-layer, never persisted
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci
# BAD: ARG bakes the token into image history forever
ARG NPM_TOKEN
RUN npm ci   # token now visible in `docker history`
```

```text
# .dockerignore — write this before your first build
.git
node_modules
.env*
dist
.next
__pycache__
*.log
coverage
Dockerfile*
compose*
README.md
.github
```

```bash
DOCKER_BUILDKIT=1 docker build --secret id=npm_token,env=NPM_TOKEN -t app:dev .
```

→ full per-stack Dockerfiles: `references/dockerfiles-by-stack.md` · image-authoring depth
(shrinking, base-image choice, cache busting): `../docker/SKILL.md`

## docker-compose for local dev + Postgres

```yaml
# compose.yaml — Compose Spec, no `version:` key
services:
  app:
    build:
      context: .
      target: dev                       # dev stage of the multi-stage Dockerfile
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - .:/app                          # bind mount → hot reload
      - /app/.venv                      # anonymous volume guards container deps
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/app_dev
    develop:
      watch:
        - { path: ./pyproject.toml, action: rebuild }
        - { path: ./app, action: sync, target: /app/app }
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:18-alpine
    ports:
      - "127.0.0.1:5432:5432"           # host-only; NEVER 0.0.0.0 in prod
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_dev"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- GOOD: bind-mount source for dev hot reload; BAD: bind-mount source over a prod image (it shadows the baked build).
- GOOD: bind Postgres to `127.0.0.1`; BAD: bind it to `0.0.0.0` in prod (publicly reachable DB).

→ prod overlay + mailpit: `references/dockerfiles-by-stack.md`

## GitHub Actions — least-privilege pipeline

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read                        # default-deny; escalate per job
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/verify.sh
  build-push:
    needs: verify
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v7
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
      - uses: aquasecurity/trivy-action@57a97c7e7821a5776cebc9bb87c984fa69cba8f1 # v0.35.0
        with:
          image-ref: ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
          exit-code: "1"
          severity: "HIGH,CRITICAL"
          ignore-unfixed: true
```

- GOOD: scoped per-job `permissions` (only `build-push` gets `packages: write` / `id-token: write`).
- BAD: blanket `permissions: write-all` — any compromised step can push images or mint tokens.
- GOOD: third-party actions pinned to a full commit SHA with a version comment (`@<sha> # v0.35.0`). In the March 2026 `trivy-action` supply-chain incident ([GHSA-69fq-xp46-6x23](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23) / CVE-2026-33634), 76 of 77 tags were force-pushed to credential-stealing malware; the advisory's named known-safe ref is `v0.35.0` (commit `57a97c7e7821a5776cebc9bb87c984fa69cba8f1`), the one clean tag still pointing at the real `master` HEAD. A moving tag would have pulled the malware; this SHA pin does not. Let Dependabot bump the SHA once upstream re-tags cleanly.

→ matrix, reusable workflows, OIDC-to-cloud, environments/approvals, releases: `references/github-actions.md` ·
workflow-syntax depth: `../github-actions/SKILL.md`

## Choosing a deploy target (3 options)

Never recommend a single host. **Gather requirements → recommend exactly three targets with
trade-offs**, so the choice is made with eyes open. The canonical slate:

1. **Hetzner VPS + Coolify** — cheapest control, EU residency, sustained/always-on/stateful;
   you own ops. (The combo `references/coolify.md` runs on; see below.)
2. **Vercel** — zero-ops serverless/edge, ideal Next.js, scales to zero for spiky traffic;
   metered cost climbs at sustained scale, US-default region.
3. **A third that fits the case's sharpest constraint** — Railway (tiny/simple, predictable
   bill), Fly.io (true global edge, 30+ regions), or a hyperscaler (enterprise compliance).

Requirements to gather first: expected total/concurrent users · traffic shape (steady vs
spiky) · budget ceiling · data region/residency & compliance · team ops comfort · scaling
needs (scale-to-zero, global latency) · stateful needs (own DB/queue/websockets).

**Quick steer:** Next.js + spiky traffic + ops-averse → Vercel. Cost-sensitive / EU-resident /
sustained / own stateful services → Hetzner+Coolify. The Dockerfile this skill produces is the
escape hatch — start on Vercel, move to Hetzner+Coolify when the bill grows, same artifact.

→ deep coverage (limits, regions, pricing, decision matrix, worked examples): `references/hosting-targets.md`

## Coolify — wiring the chosen target

Only the parts that touch the pipeline; the platform walkthrough lives elsewhere.

- Pick the **Dockerfile** build pack when a Dockerfile exists — same artifact CI builds, full control, prod/CI parity.
- Set **Ports Exposes** to the container port your app listens on (e.g. `8000`); Traefik routes the domain to it.
- Set the **Health Check** path/port → this is what gates the rolling swap to the new container.
- Mark sensitive env vars **Is Secret** — encrypted at rest, masked in logs and UI.
- Enable **GitHub App auto-deploy** on push, OR call the deploy webhook from CI (one or the other, not both).
- **Rollback** = redeploy a previously stored image in one click; pair with backward-compatible migrations.

```bash
curl --fail -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "https://coolify.example.com/api/v1/deploy?uuid=$APP_UUID&force=false"
```

→ persistent storage, custom domains + Let's Encrypt, per-PR previews, CPU/memory limits, blue-green:
`references/coolify.md` and `../coolify/SKILL.md`

## Secrets flow (GitHub → registry → Coolify)

```text
GitHub secrets / OIDC ──mint short-lived creds──▶ build pushes to ghcr.io (no key stored)
     │                                                        │
     └──── nothing long-lived in a workflow file             ▼
                                       Coolify pulls (deploy-scoped registry cred)
                                                     │
                                                     ▼
                                runtime env injected by Coolify (encrypted at rest)
```

- A secret crosses **at most one** trust boundary per hop — never forward a GHA secret into the running container; let Coolify inject runtime env.
- Nothing long-lived lives in a workflow file: `GITHUB_TOKEN` and OIDC tokens are minted per run and expire.
- `${{ }}` secrets are masked in logs, but `set -x` and `echo "$SECRET"` defeat the mask — forbid both.

## 12-factor config & observability

Config from env, validated at boot, fail-fast — a bad config crashes on startup, never at request
time. Idiom per stack: pydantic-settings `BaseSettings` (raises at import), zod `envSchema.parse(process.env)`
(throws at boot), `env.Must(env.ParseAs[Config]())` for Go (exits at boot).

Log JSON to stdout (slog for Go, structlog/uvicorn JSON for FastAPI, pino for Next.js); never log
secrets; expose `/healthz` (liveness, no deps) + `/readyz` (checks deps).

```python
# FastAPI: liveness is dependency-free; readiness probes the DB so a node that
# can't reach Postgres never takes traffic during the rolling swap.
@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/readyz")
async def readyz() -> dict[str, str]:
    await db.execute("SELECT 1")   # raises 500 if the DB is unreachable
    return {"status": "ready"}
```

## Anti-patterns — rationalizations → STOP

| Rationalization | STOP — do this instead |
| --- | --- |
| `:latest` is fine for now | Pin tag+digest (`FROM img@sha256:…`); `:latest` breaks reproducibility and rollback |
| I'll pass the token as `ARG` | BuildKit `--mount=type=secret`; `ARG` persists in `docker history` |
| `permissions: write-all` is simpler | Default-deny; grant per job (`packages: write`, `id-token: write`) |
| Store a registry password in GHA secrets | Use OIDC / `GITHUB_TOKEN`; no long-lived key |
| Run as root, it's just a container | Non-root UID + read-only rootfs + `cap_drop: ALL` (add back only `NET_BIND_SERVICE` to bind <1024) |
| Skip the healthcheck, the app boots fast | No healthcheck = no rolling gate = downtime / bad version live |
| Copy the whole repo then `RUN install` | Copy the lockfile first; cache the deps layer |
| Nixpacks is easier than my Dockerfile | If a Dockerfile exists, use it — CI/prod parity |
| Secrets in `compose.yaml` env | `.env` (gitignored) / Coolify secret env |
| Migrate the DB destructively in deploy | Backward-compatible migrations, or rolling breaks |
| `echo $SECRET` to debug CI | Never; masked vars still leak via `set -x` and logs |
| Build once per env with different secrets | Build one image; inject config at runtime (12-factor) |

## Quick reference

| Task | Command / file |
| --- | --- |
| Build with secret | `DOCKER_BUILDKIT=1 docker build --secret id=npm_token,env=NPM_TOKEN -t app:dev .` |
| Scan image | `trivy image --severity HIGH,CRITICAL --exit-code 1 IMG` |
| Lint Dockerfile | `hadolint Dockerfile` |
| Lint workflows | `actionlint` |
| Run verify gate | `bash scripts/verify.sh` (hadolint+actionlint+trivy+build smoke, local and CI) |
| Local up | `docker compose up --watch` |
| Trigger Coolify deploy | `curl --fail -X POST …/api/v1/deploy?uuid=…&force=false` |
| Roll back | Coolify → redeploy prior image |

**Pre-ship checklist**

- [ ] Runs as non-root
- [ ] Base image pinned (tag + digest)
- [ ] `.dockerignore` present
- [ ] `HEALTHCHECK` hits a real readiness path
- [ ] No secrets in layers or logs
- [ ] Least-privilege `GITHUB_TOKEN`
- [ ] trivy clean (no HIGH/CRITICAL)
- [ ] Rollback path known

## Project grounding (02-DOCS)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), read
`02-DOCS/wiki/stack/deployment.md` first and stay consistent with it. Create or update it with this
project's real choices — base-image/container choices, the CI pipeline, the target config, the
secrets flow, the rollback strategy — index it in `02-DOCS/wiki/index.md` (the Knowledge map root
`CLAUDE.md` points to), and bump its `Updated` date in the same change. No `02-DOCS/` layer? Skip
silently (optionally suggest `harness`) — technical conventions are *recorded, not gated*; never
block the task on this.

## Hand off

- Platform mechanics once the target is chosen: `../coolify/SKILL.md`, `../vercel/SKILL.md`, `../railway/SKILL.md`, `../render/SKILL.md`, `../fly-io/SKILL.md`, `../hetzner/SKILL.md`.
- `../secure-coding/SKILL.md` — input validation, authn/z, and secret-handling this skill assumes the app already does.
- `../harness/SKILL.md` — 01-TOOLS provider creds (Stripe, Postgres, OAuth…) that become runtime env on the target.
- `../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../flutter/SKILL.md`, `../postgresdb/SKILL.md` — the application code that runs inside the container; this skill stops at that boundary.
