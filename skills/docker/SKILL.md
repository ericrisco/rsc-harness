---
name: docker
description: "Use when authoring or auditing a Dockerfile, shrinking a bloated image, hardening a container that runs as root, picking a base image, or wiring a Compose dev loop with hot reload. NOT CI builds or deploy-to-host (that is `deployment`), NOT k8s autoscaling (that is `scaling`), NOT app-level injection or secrets-in-code (that is `secure-coding`)."
tags: [docker, containers, dockerfile, compose, image-security]
recommends: [deployment, secure-coding, scaling, github-actions]
origin: risco
---

# docker — container-craft

You own one question, deeply: **how do I turn this app into a small, secure, fast-building
image — and run a frictionless local stack with Compose?** Your artifacts are the `Dockerfile`,
the `.dockerignore`, and the `compose.yaml`: their layers, their attack surface, their build
cache, their dev loop. You do not touch what happens after the image is built.

```text
source  →  Dockerfile (multi-stage, cache mounts)  →  small + scanned image  +  compose.yaml (dev loop)
                                                            └──────────────┬──────────────┘
                                                    hand off to ../deployment/SKILL.md
```

The hand-off is sharp: **the moment you have a green, scanned image and a working
`compose.yaml`, you are done.** Everything downstream is `../deployment/SKILL.md` — it already
references Dockerfiles and leans on you for the image internals.

## When NOT to use — and who owns it instead

| You're asked for… | Owner | Why it's not you |
|---|---|---|
| CI build, registry push, deploy to host, rollback | `../deployment/SKILL.md` | You build + harden the image; it moves the image through CI to prod |
| k8s manifests, HPA autoscaling, ingress | `scaling` | Orchestration above a single image |
| App SQL injection, secrets in source, dep CVE triage | `../secure-coding/SKILL.md` | You cover only *image/container* hardening |
| Install/operate a self-hosted PaaS | `../coolify/SKILL.md` | Host operation, not the image |
| Containerless PaaS deploy mechanics | `../railway/SKILL.md`, `../fly-io/SKILL.md` | Platform deploy, not the Dockerfile |

## Pick a base image (2026 reality)

| Base | Size | CVE / patch velocity | Debuggable? | Wins when |
|---|---|---|---|---|
| `*-slim` (e.g. `bookworm-slim`) | ~30–80 MB | moderate, glibc | yes (shell, apt) | pragmatic default, native deps / Python wheels |
| `distroless` (`gcr.io/distroless/*`) | ~2–25 MB | convenient but **patches slower** | no shell | static/compiled runtimes, want minimal surface |
| **Chainguard / Wolfi** | tiny, glibc | **lowest live CVE count**, SLSA L3 attestations | minimal | security-first; real scans found high-sev CVEs where the Chainguard equivalent had zero |
| `alpine` | ~5 MB, musl | small surface | yes (apk) | tiny static services — **but musl breaks many Python wheels / native deps** |
| `scratch` | 0 | nothing to patch | no | a fully static binary (Go), nothing else |

Rule of thumb: glibc app with native deps → `*-slim` or Wolfi. Static Go binary → `scratch` or
`distroless/static`. Security mandate → Chainguard. Reach for `alpine` only when you've confirmed
your wheels/native libs build against musl. Per-language tag maps, multi-stage templates for the
stacks not shown below (Rust, JVM `jlink`, static SPA → nginx) and multi-arch buildx live in
[references/base-images-and-stages.md](references/base-images-and-stages.md).

## Multi-stage skeletons

**Node — `npm ci` with a cache mount → distroless nonroot.** Bad: single-stage `node:20` ≈ 1.1 GB.
Good: this ≈ 180 MB. Tags track Node 24 (the active LTS as of mid-2026); Node 22 is in Maintenance
LTS, so swap `24`→`22` only when you deliberately want the conservative maintenance line.

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "dist/healthcheck.js"]
CMD ["dist/server.js"]
```

**Python — `uv` into a venv → slim, non-root.** Bad: `python:3.12` + `pip` ≈ 1 GB. Good: ≈ 130 MB.

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.13-slim-bookworm
RUN useradd --create-home --uid 10001 app
COPY --from=build --chown=app:app /opt/venv /opt/venv
COPY --chown=app:app . /app
WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH"
USER app
EXPOSE 8000
HEALTHCHECK CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Go — static binary → `scratch`.** Bad: `golang:1.26` ≈ 900 MB. Good: ≈ 12 MB. Pin a
supported toolchain: Go maintains only the latest two minors (1.26/1.25 as of mid-2026), so a
`golang:1.23` build image is two minors past EOL and no longer gets security patches.

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /app ./cmd/server

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /app /app
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/app"]
```

The cache-mount `target` differs per ecosystem: `/root/.npm`, `/root/.cache/uv` (or
`/root/.cache/pip`), `/go/pkg/mod`. The cache persists across builds without bloating any layer.

## `.dockerignore` — load-bearing, not optional

Without it the entire context (including `.git`, `node_modules`, `.env`) ships to the daemon: it
slows the build and can bake secrets into a layer via `COPY .`.

```gitignore
.git
.gitignore
node_modules
dist
.env
.env.*
*.log
.venv
__pycache__
Dockerfile
.dockerignore
README.md
```

Mirror `.gitignore`, then add build outputs and the Dockerfile itself.

## Harden the runtime

Non-root in the image (already shown above): create a user, `COPY --chown`, `USER`. Then lock the
runtime down where the container actually runs:

```bash
docker run \
  --read-only --tmpfs /tmp \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  myimage:1.4.0
```

`--read-only` rootfs + `--tmpfs /tmp` for scratch space; `no-new-privileges` blocks setuid
escalation; `--cap-drop=ALL` then add back only what you truly need (`--cap-add=NET_BIND_SERVICE`
to bind port < 1024).

**Build secrets — never `ARG`/`ENV`.** An `ARG TOKEN` lands in the image history and any
`ENV SECRET=...` persists in a layer. Use a BuildKit secret mount; it is never written to a layer:

```dockerfile
# Bad — leaks into image history:  ARG NPM_TOKEN
# Good:
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci
```

```bash
docker build --secret id=npm_token,env=NPM_TOKEN .
```

## Compose for dev

Canonical filename is `compose.yaml`; **omit the obsolete `version:` key**; use `docker compose`
(v2 subcommand), never the standalone `docker-compose` v1. One concern per container — the app, the
database and the seed job are separate services. `develop.watch` is GA since Compose 2.22.0 and
gives you a tight dev loop.

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - action: sync          # hot-reload: copy changed files into the container
          path: ./src
          target: /app/src
        - action: rebuild       # lockfile / compiled langs: rebuild the image
          path: ./uv.lock
        - action: sync+restart  # config change: sync then restart the process
          path: ./config.yaml
          target: /app/config.yaml
  db:
    image: postgres:17-bookworm
    environment:
      POSTGRES_PASSWORD: dev
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
  seed:
    profiles: ["tools"]         # only runs with: docker compose --profile tools up
    build: .
    command: ["python", "-m", "app.seed"]

volumes:
  pgdata:
```

Run the dev loop with `docker compose watch` (or `docker compose up --watch`). Fuller patterns —
watch-per-stack, multi-service healthcheck graphs, override files, `env_file` vs `secrets`, and
when to graduate to `deployment`/`scaling` — are in
[references/compose-recipes.md](references/compose-recipes.md).

## Verify the image

These are exactly what `scripts/verify.sh` automates (it skips a tool gracefully if absent):

- `hadolint Dockerfile` — static lint of the Dockerfile (no error-level findings).
- `docker compose config -q` — the `compose.yaml` parses and resolves.
- `trivy image myimage:1.4.0` — CVE + misconfig + secret scan of the built image.
- `trivy config .` — scan the Dockerfile/compose for misconfiguration without a build.
- `dockle myimage:1.4.0` — CIS-style image hygiene.
- size check — assert the final image is under your threshold (`docker image inspect -f '{{.Size}}'`).

## Anti-patterns

| Bad | Good | Why |
|---|---|---|
| `FROM node:latest` | `FROM node:24-bookworm-slim`, or pin a digest | `:latest` drifts under you; builds + scans become non-reproducible |
| runs as root (no `USER`) | `USER nonroot` / `USER 10001` | PID 1 defaults to root (UID 0), so a container escape == host compromise |
| `ARG TOKEN` / `ENV SECRET=` | `RUN --mount=type=secret,...` | ARG/ENV persist in image history & layers |
| `COPY . .` then `RUN npm ci` | copy lockfile → install → copy source | source edits bust the dep cache layer every build |
| single `FROM`, ship the SDK | multi-stage, copy only the artifact | runtime carries compilers & dev CVE surface |
| `apt-get install x` | `apt-get install --no-install-recommends x && rm -rf /var/lib/apt/lists/*` | recommends + apt lists bloat the layer |
| no `.dockerignore` | mirror `.gitignore` + build outputs | whole context ships; `.env`/`.git` can leak |
| `version: "3.8"` / `docker-compose` v1 | omit `version:`; `docker compose` v2 | the key is obsolete; v1 is EOL |
| `CMD npm start` (shell form) | `CMD ["node", "server.js"]` (exec) | shell form wraps the process in `/bin/sh -c`, which swallows `SIGTERM` — no graceful shutdown |
| no `HEALTHCHECK` | `HEALTHCHECK CMD [...]` | nothing for Compose/orchestrators to gate readiness on (`condition: service_healthy`) |
