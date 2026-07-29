---
name: railway
description: "Use when deploying an app to Railway — pushing a repo or running railway up, provisioning a managed database, wiring env and reference variables across services, attaching a volume, or fixing a deploy that builds but will not serve. NOT Render (that is `render`), NOT Fly machines (that is `fly-io`), NOT a self-hosted PaaS on your own box (that is `coolify`)."
tags: [railway, paas, deploy, services, env-vars, volumes, databases, private-networking, railway-json]
recommends: [render, fly-io, coolify, postgresdb, db-migrations, domains-dns, deployment, docker]
origin: risco
---

# Railway — ship a repo to a managed PaaS

Railway is an opinionated PaaS: connect a GitHub repo or run `railway up`, and it builds your
code (Railpack by default, or your Dockerfile), runs the container, networks it, and hands you a
domain. You manage *services, environments, variables, volumes, and databases* — not servers,
not an OS. This skill makes you fast and correct on Railway's specific surface, not generic
deploy theory.

```text
repo / `railway up`  →  Railpack (or Dockerfile) build  →  container runs (binds 0.0.0.0:$PORT)
   →  variables + reference vars injected  →  private net (*.railway.internal) + public domain
```

## Is Railway the right target?

Settle this before touching config. If the user named the platform, honor it and route.

| Want | Use | Why / route |
| --- | --- | --- |
| Push a repo, get a built+running app with zero ops | **Railway** (this skill) | Managed PaaS, Railpack build, by-the-minute billing |
| `render.yaml` Blueprint, free static sites, their dashboard model | `render` | Different PaaS — route to the `render` skill |
| `fly.toml`, Firecracker microVMs, `fly machine`, multi-region edge | `fly-io` | Railway has no `fly machine` equivalent — route to `fly-io` |
| Self-host the PaaS on your own Hetzner/DO box | `coolify` | Railway is fully managed; Coolify is BYO-server |
| Raw VPS, you manage the OS | `hetzner` / `digitalocean` | IaaS, not PaaS |
| Platform-agnostic release strategy (rolling, blue-green theory) | `deployment` | This skill is Railway mechanics, not strategy |

## The 60-second path

```bash
# Install the CLI (pick one). npm form needs Node 16+.
brew install railway                          # macOS
npm i -g @railway/cli                          # any Node 16+ host
bash <(curl -fsSL railway.com/install.sh)      # shell installer

railway login            # opens browser; for CI use RAILWAY_TOKEN instead (no login)
railway init             # create a NEW project from this dir, OR:
railway link             # link this dir to an EXISTING project/service
railway up               # build + deploy the current dir; streams build/deploy logs
```

Why `link` vs `init`: `init` makes a fresh project; `link` attaches an already-created project
(the common case once the project exists in the dashboard). `railway up` deploys whatever is in
the working dir — no git push required.

## Two ways to deploy — pick one per service

- **GitHub auto-deploy** (default for most teams): connect the repo in the dashboard; every push
  to the watched branch triggers a build + deploy. Best when you want CI-style "merge to ship".
- **CLI `railway up`**: deploy the working tree directly. Best for first setup, hotfixes, or
  hosts without git. Use `railway up --detach` to not block on logs, `--service api` to target a
  specific service in a multi-service project (otherwise it prompts).

```bash
railway up --detach --service api --environment production
```

There is no `railway deploy --prod` — that command does not exist. Use `railway up` (or push to
the connected branch). To re-run the last deploy unchanged: `railway redeploy`.

## Bind 0.0.0.0:$PORT — the #1 first-deploy failure

Railway's edge proxy and private network reach your container over an injected `$PORT`. If you
bind `localhost`/`127.0.0.1`, the build succeeds but every request 502s and healthchecks fail.

```ts
// Bad — only reachable from inside the container; proxy gets connection refused -> 502
app.listen(3000, "127.0.0.1");

// Good — listen on the injected port, bind all interfaces
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => console.log(`up on :${port}`));
```

Same rule for every stack: read `$PORT`, bind `0.0.0.0` (or `::` — see private networking).
Never hardcode the port the proxy talks to.

## Config as code — railway.json (or railway.toml)

Commit `railway.json` to make build/deploy reproducible. **Code config overrides the
dashboard** for the fields it sets. Per-environment overrides go under `environments.<name>`.

```jsonc
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node dist/server.js",
    "healthcheckPath": "/healthz",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "environments": {
    "production": {
      "deploy": { "numReplicas": 2 }
    }
  }
}
```

`builder` is `RAILPACK` (default; Railway's successor to Nixpacks) or `DOCKERFILE` (a Dockerfile
is also auto-detected). `restartPolicyType` is `ON_FAILURE` | `ALWAYS` | `NEVER`. The full field
list — `watchPatterns`, `dockerfilePath`, `railpackVersion`, `preDeployCommand`,
`multiRegionConfig`, `cronSchedule`, `overlapSeconds`, `drainingSeconds`, and TOML variants —
lives in [references/config-as-code.md](references/config-as-code.md).

## Variables & reference variables

Set plain variables via CLI or dashboard; never inline secrets into `railway.json` (it's
committed).

```bash
railway variables                         # list
railway variables --set "LOG_LEVEL=info"  # set (older: railway variable set KEY=value)
```

Wire one service's value into another with template syntax instead of copying it. References
stay correct across credential rotations and across environments.

```bash
# Bad — hardcoded, breaks the moment Railway rotates the DB password
DATABASE_URL=postgresql://user:p4ss@containers-us-west-12.railway.app:6543/railway

# Good — reference the Postgres service's own variable
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Also available: `${{shared.SENTRY_DSN}}` (project-shared vars) and Railway-provided vars like
`${{RAILWAY_PUBLIC_DOMAIN}}`. The left side of the dot is the *service name* exactly as it
appears in the project.

## Managed databases

Add Postgres / MySQL / Redis / MongoDB as services from Railway's official templates, then
reference their connection vars into the app.

```bash
railway add            # interactive: pick a database template (or use + New / cmd-K in dashboard)
railway connect        # open a db shell (psql / mongosh / redis-cli) against the service
```

The DB service exposes vars (e.g. `DATABASE_URL`, `PGHOST`) on its Variables tab. Reference them
into the app service as `${{Postgres.DATABASE_URL}}` — do not paste the literal URL. Schema
design and SQL live in `postgresdb`; migrations live in `db-migrations`. This skill only
provisions and wires.

## Volumes

Attach a volume to a service via the dashboard or CLI. Railway auto-injects
`RAILWAY_VOLUME_NAME` and `RAILWAY_VOLUME_MOUNT_PATH` at runtime — read them, never define them
yourself.

```ts
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "/data";
```

Gotcha: a volume pins the service to a single replica — **a volume blocks horizontal scaling**.
If you need many replicas, keep state in a managed DB or object storage, not a volume.

## Environments

A project has `production` plus any environments you add (`staging`, PR environments). Each gets
its own variables and its own `environments.<name>` config override. Switch with
`railway environment <name>`; target a deploy with `railway up --environment staging`. Variables
and reference targets resolve *within* the active environment.

## Private networking

Every service gets a DNS name under `*.railway.internal`. Talk service-to-service over it —
internal egress is free, and traffic never leaves Railway.

```bash
# from the app service, reach the API service privately
curl http://api.railway.internal:8080/internal/ping
```

IPv6 gotcha: environments created **before 2025-10-16 are IPv6-only** internally — bind `::`
(not just `0.0.0.0`) or recreate the environment. Newer environments resolve both IPv4 and IPv6.
Cross-project and cross-environment private traffic is blocked by design.

## Domains

```bash
railway domain         # generate a *.up.railway.app domain for the current service
```

For a custom domain, add it in the service settings and Railway gives you a CNAME target. The
registrar-side DNS record work (CNAME/ALIAS at your provider) belongs to `domains-dns` — this
skill stops at "here is the CNAME target".

## Healthcheck & failed-deploy triage

Set `healthcheckPath` in `railway.json` so Railway gates the deploy on a real readiness route.
When a deploy builds but won't go live, read `railway logs` and walk these in order:

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 502 on every request, healthcheck times out | App bound `localhost`, not `0.0.0.0:$PORT` | Bind `0.0.0.0` (or `::`), listen on `$PORT` |
| "no start command" / container exits 0 immediately | No `startCommand` and Railpack can't infer one | Set `deploy.startCommand` |
| App crashes on boot referencing a config key | Missing variable / unresolved `${{...}}` reference | Set the var; check the service name in the reference |
| Healthcheck 404s | `healthcheckPath` points at a route that doesn't exist | Point it at an existing route or remove it |

## Cost awareness

There is **no permanent free tier**. New accounts get a one-time **$5 trial credit**. Hobby is
$5/mo (includes $5 usage), Pro is $20/mo (includes $20 usage); usage is billed **by the minute**
and the included subscription credit is consumed first, then you pay the delta. An idle service
left running still bills. Don't leave throwaway preview services up; delete environments you're
done with.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Binding `localhost` / `127.0.0.1` | Proxy + private net can't reach it → 502 | Bind `0.0.0.0` (or `::`), listen on `$PORT` |
| Inlining a secret/connection string in `railway.json` | It's committed → leaked secret | Put secrets in variables; reference them |
| Hardcoding `DATABASE_URL` into the app's vars | Breaks on credential rotation / env change | Use `${{Postgres.DATABASE_URL}}` |
| One mega-service running web + worker + cron | No independent scaling/restart, tangled logs | Split into services in one project |
| Assuming a free tier exists | Surprise — trial credit runs out, deploys stop | Plan for Hobby/Pro; watch by-the-minute usage |
| Assuming IPv4 on a pre-2025-10-16 environment | Private DNS resolves IPv6-only → connection refused | Bind `::` or recreate the environment |
| Committing the `.railway` link as if it were config | It's local link state, not portable config | Config-as-code goes in `railway.json` |

## Verification

- App reads `$PORT` and binds `0.0.0.0` (or `::`) — not a hardcoded port on localhost.
- No secret/connection string is inlined in `railway.json`; secrets are variables.
- Cross-service values use `${{Service.VAR}}` references, not copied literals.
- `builder` ∈ {RAILPACK, DOCKERFILE}; `restartPolicyType` ∈ {ON_FAILURE, ALWAYS, NEVER}.
- A real `healthcheckPath` route exists if one is configured.

Run `bash scripts/verify.sh` from the target dir to structurally lint a present `railway.json`.
It is a no-op pass when no config file exists (CLI/dashboard-only use is valid). For the deeper
CLI recipe catalog (CI deploys with `RAILWAY_TOKEN`, `railway run` for local dev against prod
vars, db shells, multi-service deploys), see [references/cli-cookbook.md](references/cli-cookbook.md).
