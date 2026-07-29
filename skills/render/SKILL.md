---
name: render
description: "Use when deploying or fixing an app on Render — web services, background workers, cron jobs, private services, managed Postgres and Key-Value, and especially the render.yaml Blueprint. Covers deploys that fail with no open ports detected, 502s on first deploy, free-tier cold starts, and a free Postgres about to expire with its data. NOT the generic ship and release flow (that is `deployment`), NOT another PaaS such as `railway` or `fly-io`."
tags: [render, paas, deployment, render-yaml, cron, background-worker, infrastructure-as-code]
recommends: [deployment, postgresdb, docker, domains-dns, github-actions, scaling]
origin: risco
---

# Render — make this repo deploy correctly, wired as code

Take any repo and make it deploy on **Render** (render.com) in one pass: pick the right
service type, declare everything in a version-controlled `render.yaml` Blueprint, bind the
port the way Render expects, and wire `DATABASE_URL` / secrets across services so they
survive rotation. Steer clear of the four traps that eat first deploys: the
"no open ports detected" 502, the free-tier spin-down, the 30-day free-Postgres expiry,
and the 12-hour cron kill.

```text
pick service type → render.yaml at repo root → bind 0.0.0.0:$PORT → wire env across services → push (auto-deploy)
        │                                                                                            │
   web|worker|cron|pserv|static|keyvalue                                       full key surface → references/blueprint-reference.md
```

Facts here are dated to **2026-06-02** against render.com/docs. Render ships changes; if a
key or limit looks off, confirm against the live Blueprint spec before betting a deploy on it.

## The one decision that decides everything: service type

Pick the type **before** you write a line of YAML. The type sets the billing model, whether
the process gets a public URL, and whether Render expects it to bind a port. Choosing wrong
means a worker that never starts because Render waited for a port, or a 12-hour job that dies
silently as a cron.

| The process… | Type | `runtime` required? | Gets a public URL? |
| --- | --- | --- | --- |
| serves HTTP/WebSocket traffic | `web` | yes | yes |
| runs forever, no inbound URL (queue consumer, Celery) | `worker` | yes | no |
| runs, does work, exits — on a schedule | `cron` | yes | no |
| internal-only API, reachable only inside Render's network | `pserv` | yes | no (internal host only) |
| pre-built static assets (SPA, docs) | `web` + `runtime: static` | yes (`static`) | yes |
| cache / queue / Redis-compatible store | `keyvalue` | **no** | no (internal) |

`runtime` enum (everything except `keyvalue`): `node`, `python`, `docker`, `image`,
`static`, `go`, `ruby`, `elixir`, `rust`.

## Blueprint-first: everything lives in render.yaml

**Rule: declare every service, database, and env var group in `render.yaml` at the repo
root. Touch the dashboard only for `sync: false` secrets and one-off debugging.** Why: the
Blueprint is the reproducible, reviewable source of truth — it powers preview environments
and a clean re-deploy, while dashboard-only config is invisible state that drifts and can't
be code-reviewed.

Top-level keys: `services`, `databases`, `envVarGroups`, `projects`, `previews`.

## Minimal correct render.yaml (annotated)

A multi-service app — a Node web service, a Python worker, a nightly cron, a Postgres db,
and a shared env group. Every load-bearing key is commented.

```yaml
databases:
  - name: app-db
    plan: starter            # NOT free for anything you care about — free expires in 30 days
    postgresMajorVersion: "17"
    region: frankfurt

envVarGroups:
  - name: app-shared
    envVars:
      - key: LOG_LEVEL
        value: info
      - key: SENTRY_DSN
        sync: false          # prompt once at setup; never stored in git

services:
  - type: web
    name: api
    runtime: node
    region: frankfurt
    plan: starter            # $7/mo — avoids the free-tier 15-min spin-down on an API
    buildCommand: npm ci && npm run build
    startCommand: npm start  # MUST bind 0.0.0.0 and read $PORT — see next section
    healthCheckPath: /healthz # gates zero-downtime rollout; new instance must pass first
    preDeployCommand: npm run migrate  # runs before the new instance serves traffic
    autoDeployTrigger: commit          # commit | checksPass | off
    envVars:
      - fromGroup: app-shared
      - key: DATABASE_URL
        fromDatabase:
          name: app-db
          property: connectionString   # never hardcode the URL
      - key: SESSION_SECRET
        generateValue: true            # Render generates a random secret

  - type: worker
    name: jobs
    runtime: python
    plan: starter
    buildCommand: pip install -r requirements.txt
    startCommand: celery -A app worker -l info  # no port — workers don't bind one
    envVars:
      - fromGroup: app-shared
      - key: DATABASE_URL
        fromDatabase: { name: app-db, property: connectionString }
      - key: API_URL
        fromService:                   # reference another service
          name: api
          type: web
          property: hostport

  - type: cron
    name: nightly-cleanup
    runtime: python
    schedule: "0 3 * * *"              # required for cron; 03:00 UTC daily
    buildCommand: pip install -r requirements.txt
    startCommand: python -m app.cleanup
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: app-db, property: connectionString }
```

## Port binding — do this first (the #1 first-deploy failure)

**Rule: a `web` service MUST listen on host `0.0.0.0` and read the `PORT` env var (Render
sets it, default `10000`).** If Render detects no bound port within its window, the deploy
**fails with "no open ports detected"** and visitors get a **502**. This is the single most
common first-deploy break — binding `localhost`/`127.0.0.1` or a hardcoded port does it.

```javascript
// Bad — binds the wrong host and ignores Render's PORT → "no open ports detected"
app.listen(3000);

// Good — bind 0.0.0.0 and honor $PORT
app.listen(process.env.PORT || 3000, "0.0.0.0");
```

```bash
# Bad — gunicorn on a fixed local port
gunicorn app:app --bind 127.0.0.1:8000

# Good — bind 0.0.0.0 and Render's $PORT
gunicorn app:app --bind 0.0.0.0:$PORT
```

Only `web` services need this. A `worker`/`cron` that tries to bind a port is fine but
pointless; a `web` service that doesn't is broken.

## Wiring env vars across services

**Rule: never hardcode `DATABASE_URL`, `REDIS_URL`, or shared secrets as literal `value:`
strings. Reference the resource** so the value survives a rotation, recreate, or region
move, and so secrets never land in git.

| Form | Use it for |
| --- | --- |
| `fromDatabase: { name, property: connectionString }` | the Postgres connection string |
| `fromService: { name, type, property }` | another service's host/port/URL (`property: hostport`, `host`, or `port`) |
| `fromGroup: <group-name>` | pull a whole shared env var group |
| `generateValue: true` | a random secret Render generates and stores (session keys) |
| `sync: false` | a secret you type once at setup; not stored in the repo |

For a Key Value store, reference its connection string the same way you reference Postgres,
via `fromService` against the `keyvalue` service.

## Migrations and zero-downtime deploys

- `preDeployCommand` — runs **once**, before the new instance starts serving traffic. Put
  migrations here, not in `startCommand` (a startCommand migration runs on every instance
  and races under multiple replicas).
- `healthCheckPath` — Render polls it on the new instance and only shifts traffic once it
  passes, giving zero-downtime rollout. Point it at a route that checks real readiness.
- `autoDeployTrigger` — `commit` (deploy every push), `checksPass` (wait for CI status),
  or `off` (manual / deploy-hook only).

## Free-tier traps

Render's free tier is generous for hobby work and a landmine for anything you care about.

| Trap | What happens | Fix |
| --- | --- | --- |
| Free web spin-down | after **15 min** of no inbound traffic the instance sleeps; next request waits **30–60s** to wake | Starter at **$7/mo** per service |
| 750 free instance-hrs/mo | shared across the workspace; spun-down time doesn't count toward it | budget it, or pay Starter |
| Free Postgres expiry | **deleted 30 days after creation** (14-day grace to upgrade), all data gone; only **one** free Postgres per workspace | Starter Postgres ($7/mo) from day one for anything real |
| Free Key Value | no disk persistence — data is lost on restart | paid plan if you need durability |

## Cron specifics

- `schedule:` (standard cron expression) is **required** for `type: cron`.
- Render guarantees **at most one active run at a time** — runs don't overlap.
- **A run is killed after 12 hours.** Anything that can exceed that must be a `worker` with
  its own scheduler/queue, not a cron. A long cron fails silently mid-job — partial work,
  no clean error.

## Scaling and disk knobs

This is the concrete Render surface, not capacity strategy (that's `scaling`).

```yaml
services:
  - type: web
    name: api
    runtime: node
    scaling:
      minInstances: 1
      maxInstances: 4
      targetCPUPercent: 70
      targetMemoryPercent: 80   # autoscale between min/max on CPU/mem
    disk:
      name: data
      mountPath: /var/data
      sizeGB: 10                # a disk PINS the service to ONE instance — blocks horizontal scale
```

Use `numInstances` for a fixed replica count instead of `scaling` when you don't want
autoscaling. A persistent `disk` and horizontal scaling are mutually exclusive — pick one.

Regions: `oregon`, `ohio`, `virginia`, `frankfurt`, `singapore`. Plans: `free`, `starter`,
`standard`, `pro`, `pro plus`, `pro max`, `pro ultra`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Hardcoding a port (`listen(3000)`) | "no open ports detected" → deploy fails / 502 | bind `0.0.0.0` and `$PORT` |
| Hardcoding `DATABASE_URL` | breaks on rotation / db recreate | `fromDatabase` reference |
| A long job as a `cron` | killed at 12h, silent partial work | `worker` + its own scheduler/queue |
| Free Postgres for production | deleted 30 days after creation | Starter ($7/mo) from day one |
| Secrets as literal `value:` in render.yaml | leaked in git history | `sync: false` or `generateValue: true` |
| Migrations in `startCommand` | runs on every instance, races under replicas | `preDeployCommand` |
| Free web service for a real API | cold-start 502s after idle | Starter, or accept it only for a hobby toy |
| Dashboard-only config | invisible drift, no preview envs, no review | declare in `render.yaml` |

## When to hand off

- Schema design, queries, indexing, tuning → `../postgresdb/SKILL.md`. This skill only
  *provisions and connects* Render's managed Postgres.
- Writing the `Dockerfile` Render consumes via `runtime: docker` → `docker`.
- Registrar-side DNS records for a custom domain → `domains-dns`. (The Render `domains:`
  block and verification stay here.)
- Cross-platform release strategy, promotion, rollback flow → `../deployment/SKILL.md` and
  `ship`. This skill is Render config and platform mechanics.
- Build steps Render's native build doesn't run (custom CI) → `github-actions`. Render
  auto-deploys on push; only reach for Actions when you genuinely need it.
- Capacity/load strategy beyond the `scaling:` knobs → `scaling`.
- A different PaaS → its own sibling: `../fly-io/SKILL.md`, `railway`, `vercel`,
  `../netlify/SKILL.md`, `coolify`, `digitalocean`.

## Full key surface

The exhaustive `render.yaml` key tables per service type, all database keys
(`postgresMajorVersion`, `diskSizeGB`, `readReplicas`, `highAvailability`, `previewPlan`),
every env-var reference form, region/plan enums, and four complete copy-paste recipes
(Next.js web+pg; FastAPI web+worker+cron+keyvalue; Docker monorepo with `rootDir`; static
SPA with `routes` rewrites) live in `references/blueprint-reference.md` — pull it open when
you need a key this body didn't cover.
