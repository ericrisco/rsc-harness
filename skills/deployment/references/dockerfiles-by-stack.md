# Dockerfiles by stack

Complete, runnable, hardened multi-stage Dockerfiles for every stack in this repo, each with a matching `.dockerignore`, the build command, an image-size expectation, and stack-specific gotchas. Back to the entrypoint: `../SKILL.md`.

## FastAPI + uv (Python 3.13)

```dockerfile
# syntax=docker/dockerfile:1
# ---- builder: uv resolves & installs into /app/.venv ----
FROM ghcr.io/astral-sh/uv:0.11-python3.13-bookworm-slim AS builder
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
# Deps layer first: cache survives source edits (--no-install-project skips your code).
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-dev --no-install-project
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---- runtime: distroless, non-root (UID 65532), no shell ----
FROM gcr.io/distroless/python3-debian12:nonroot
WORKDIR /app
COPY --from=builder --chown=nonroot:nonroot /app /app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Multi-core production variant — replace the final `CMD` with gunicorn managing uvicorn workers:

```dockerfile
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000"]
```

```text
.venv
__pycache__
*.pyc
.pytest_cache
.git
.env
.env.*
tests/
```

```bash
docker build -t api:prod .
```

Image size: ~70–90 MB.

**Gotchas:**

- Distroless has **no shell** → exec-form (JSON array) `CMD`/`HEALTHCHECK` only, and no `curl`/`wget` — probe with `python -c urllib`.
- The `-debian12` suffix is **intentional**. An unsuffixed `gcr.io/distroless/python3-debian12` would be `gcr.io/distroless/python3`, which now defaults to **debian13** (Google moved the default forward). We pin `-debian12` to glibc-match the `-bookworm-slim` (Debian 12) builder: the venv's compiled C-extension wheels are linked against the builder's glibc, and running them on a newer-glibc runtime can fail. Keep builder and runtime on the same Debian release; move both together.
- `uv sync --frozen` requires a committed `uv.lock`; CI fails fast if the lock is stale.
- Keep `--no-install-project` on the deps layer so editing your source code never busts the cached dependency layer.
- `gunicorn`/`uvicorn`/`urllib` must resolve on `PATH` — that's why `/app/.venv/bin` is prepended.
- Keep the builder on **`-bookworm-slim`** to match the Debian 12 runtime: uv 0.9+ defaults its derived images to Debian 13 (Trixie), but the venv (with any compiled C-extension wheels) is copied into `gcr.io/distroless/python3-debian12`, so a Trixie builder's newer glibc can fail at runtime. Bump the runtime to a `debian13` distroless tag in the same change if you ever move the builder to Trixie.

## Go (1.26, static + distroless)

```dockerfile
# syntax=docker/dockerfile:1
# ---- builder: static binary, cached module + build caches ----
FROM golang:1.26-bookworm AS builder
WORKDIR /src
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=bind,source=go.sum,target=go.sum \
    --mount=type=bind,source=go.mod,target=go.mod \
    go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/server ./cmd/server

# ---- runtime: static distroless, no libc, no shell ----
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /bin/server /server
USER nonroot:nonroot
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["/server", "-health"]
ENTRYPOINT ["/server"]
```

Go 1.22+ routing and structured logging the binary should use (so the healthcheck subcommand and `/healthz` exist):

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
slog.SetDefault(logger)
// `-health` flag: dial localhost:8080/healthz, exit 0/1 — used by HEALTHCHECK.
```

```text
.git
bin/
.env
.env.*
*_test.go
```

```bash
docker build -t svc:prod .
```

Image size: ~8–12 MB.

**Gotchas:**

- No shell or `wget` in static distroless → the healthcheck must be a self `-health` subcommand of the binary.
- `CGO_ENABLED=0` is mandatory for a fully static binary that runs on `static-debian12`; CGO pulls in libc and breaks it.
- The `-debian12` suffix is **intentional**: an unsuffixed `gcr.io/distroless/static` now defaults to **debian13**. We pin `-debian12` to glibc-match the `golang:1.26-bookworm` (Debian 12) builder. A `CGO_ENABLED=0` static binary carries no glibc dependency so the runtime Debian version is mostly cosmetic here, but keeping the pin explicit prevents the default from drifting under you and keeps builder/runtime aligned with the FastAPI image.
- `-trimpath` strips absolute build paths for reproducible builds; `-ldflags="-s -w"` drops the symbol table and DWARF to shrink the binary.

## Next.js 15 (standalone)

```typescript
// next.config.ts
const nextConfig = { output: "standalone" as const };
export default nextConfig;
```

```dockerfile
# syntax=docker/dockerfile:1
# ---- deps: install once, cache on lockfile ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the standalone server ----
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---- runner: minimal, non-root ----
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
ENV HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
```

```text
node_modules
.next
.git
.env
.env.*
npm-debug.log*
```

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t web:prod .
```

Image size: ~150–200 MB.

**Gotchas:**

- `NEXT_PUBLIC_*` are inlined into the client bundle at **build time** → they are NOT secret; never put a runtime secret behind a `NEXT_PUBLIC_` name.
- Standalone output does NOT bundle `public/` or `.next/static` — copy both manually or assets and static pages 404.
- Set `HOSTNAME=0.0.0.0` or the standalone `server.js` binds to `localhost` only and the container refuses external connections.

## Flutter web (Dart 3 stable)

```dockerfile
# syntax=docker/dockerfile:1
# ---- builder: compile the web bundle ----
FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /app
COPY pubspec.* ./
RUN flutter pub get
COPY . .
RUN flutter build web --release --base-href=/

# ---- runtime: non-root nginx serving static SPA ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    gzip on;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \.(js|css|png|woff2)$ {
        expires 30d;
    }
}
```

```text
build/
.dart_tool/
.git
.env
.env.*
```

```bash
docker build -t flutterweb:prod .
```

Image size: ~25–40 MB.

**Gotchas:**

- `nginx-unprivileged` listens on **8080** (non-root), not 80 — set Coolify's Ports Exposes to 8080.
- A SPA needs the `try_files … /index.html` fallback or every deep link (`/users/42`) returns 404 on refresh.
- Runtime config: pass it at build with `--dart-define=API_URL=…` (baked) or fetch a `config.json` at runtime — like `NEXT_PUBLIC_*`, dart-defines are baked unless fetched.

## Postgres (18)

**Do NOT build a custom Postgres image for prod** — use a Coolify managed database or the official `postgres:18-alpine`. A custom image means you own patching, backups, and tuning that the official image and Coolify already handle.

Local-dev service with init SQL and tuning:

```yaml
services:
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    command: ["postgres", "-c", "shared_buffers=256MB", "-c", "max_connections=100"]
    volumes:
      - pgdata:/var/lib/postgresql        # postgres 18+ volume root; PGDATA is /var/lib/postgresql/18/docker
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 3s
      retries: 5
volumes:
  pgdata:
```

- `$$` escapes `$` in Compose so the shell inside the container expands `$POSTGRES_USER`, not Compose.
- `init.sql` runs **only** on first init (empty data dir); it is ignored once `pgdata` exists.
- Backups: use Coolify's scheduled S3 backups (or `pg_dump` to object storage) — never rely on the container filesystem, which is ephemeral.

## Cross-cutting

### `.dockerignore` master template

```text
.git
.gitignore
node_modules
.venv
__pycache__
*.pyc
.dart_tool
build
dist
.next
coverage
.pytest_cache
*.log
.env
.env.*
Dockerfile*
compose*
docker-compose*
README.md
.github
```

### HEALTHCHECK patterns by base

| Base | Healthcheck |
| --- | --- |
| Shell base (slim/alpine) | `CMD wget -qO- http://localhost:PORT/healthz || exit 1` |
| Distroless python | `CMD ["python","-c","import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"]` |
| Distroless static (Go) | `CMD ["/server","-health"]` (binary self-probe; no shell/wget available) |

### Reproducible builds

- Pin the digest, not just the tag: `FROM gcr.io/distroless/static-debian12:nonroot@sha256:<digest>` — tags move, digests are immutable.
- Set `SOURCE_DATE_EPOCH` (e.g. the commit timestamp) so timestamps in layers are deterministic across rebuilds.
- `--no-cache` defeats layer caching and slows every build — use it only for a deliberate clean rebuild, never as a default.

### Scanning

```bash
hadolint Dockerfile
trivy image --severity HIGH,CRITICAL --exit-code 1 --ignore-unfixed myimg
```

### Multi-arch

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t img --push .
```

`buildx` builds both architectures and pushes a single multi-arch manifest — required if Coolify runs on arm64 servers while CI builds on amd64.
