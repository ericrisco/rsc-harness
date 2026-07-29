---
name: fly-io
description: "Use when deploying or operating an app on Fly.io — writing fly.toml, placing Machines in regions near users, attaching Volumes, managing secrets, or picking a scaling lever (autostop/autostart, scale count, fly-replay). NOT choosing which host to deploy on (that is `deployment`), NOT a git-push PaaS with no regions model (that is `railway`)."
tags: [fly-io, deployment, machines, regions, scaling]
recommends: [docker, scaling, postgresdb, railway, domains-dns]
origin: risco
---

# Deploy on Fly.io

You are deploying an app to Fly.io: a `fly.toml`, Machines (Firecracker microVMs) placed in regions close to users, optional region-pinned Volumes, secrets, and the right scaling lever. Get the mental model right first, then the config follows. If none of that placement control matters, ../railway/SKILL.md is the git-push PaaS with no Machines/regions model.

## Mental model

- **App** is the logical unit. It owns a name, a `primary_region`, and config in `fly.toml`. Why: every command targets an app.
- **Process groups** (`[processes]`, e.g. `web`, `worker`) split one image into roles. Why: a web group takes traffic, a worker group does not — they bind services and VMs separately.
- **Machines** are Firecracker microVMs running your image. Each runs in exactly one region. Why: latency and volumes are per-Machine, so placement is the whole game.
- **Fly Proxy** is the anycast front door. It routes a request to the nearest running Machine, can start a stopped one, and obeys `fly-replay` headers. Why: it is what makes "global" cheap — you do not run a load balancer.
- **Volumes** are local NVMe disks pinned to one Machine in one region. No replication. Why: this single fact dictates every stateful architecture decision below.

## Deploy fast (4 commands)

```bash
fly launch                              # detects framework, generates fly.toml + Dockerfile, creates the app
fly secrets set DATABASE_URL=postgres://...  # restarts every Machine; never put this in [env]
fly deploy                              # builds image, runs release_command, rolls out Machines
fly scale count 2 --region iad,ams      # place Machines in Virginia + Amsterdam
```

`fly launch` is interactive and writes a starter `fly.toml`. Treat that file as a draft — review it against the next section before the first real deploy. Run `fly status` and `fly logs` after any deploy.

## A fly.toml that works

```toml
app            = "my-api"
primary_region = "iad"            # 3-letter region code: iad, ord, ams, syd, gru, nrt...

[build]
  # dockerfile = "Dockerfile"     # Fly builds from your Dockerfile; see ../docker/SKILL.md

[deploy]
  release_command = "npm run migrate"   # one-shot Machine that runs BEFORE the new version goes live
  strategy        = "rolling"            # rolling | bluegreen | canary | immediate

[processes]
  web    = "node server.js"
  worker = "node worker.js"

[http_service]
  internal_port       = 8080
  force_https         = true
  auto_stop_machines  = "stop"   # "off" | "stop" | "suspend" — set WITH auto_start_machines
  auto_start_machines = true
  min_machines_running = 0       # 0 = scale to zero; honored only in primary_region
  processes           = ["web"]

  [http_service.concurrency]
    type       = "requests"
    soft_limit = 200             # Proxy starts spreading load past this
    hard_limit = 250             # Proxy stops sending past this

[[vm]]                            # formerly [[compute]]
  size       = "shared-cpu-1x"
  memory     = "512mb"
  cpu_kind   = "shared"          # "shared" | "performance"
  processes  = ["web"]

[[mounts]]
  source       = "data"          # volume NAME, created with `fly volumes create data`
  destination  = "/data"
  processes    = ["web"]
  initial_size = "1gb"
```

Full field surface (`[[services]]` vs `[http_service]`, health checks, `[[statics]]`, `[[files]]`, all VM sizes, `[restart]`, `[metrics]`) lives in `references/fly-toml.md` — read it when you need a key that is not above. Custom domains, certs and registrar-level DNS are ../domains-dns/SKILL.md.

## Regions: place Machines near users

Pick the branch first, then run the commands.

| Your app is... | Strategy | How |
| --- | --- | --- |
| Stateless (no local disk; DB elsewhere) | Replicate the Machine into more regions | `fly scale count 2 --region iad,ams,syd` |
| Stateful with a Volume | Keep writes in `primary_region`, add read replicas + `fly-replay` | see `references/multi-region.md` |
| Needs one extra box now | Clone a single Machine (gets a fresh volume) | `fly machine clone <id> --region syd` |

```bash
fly platform regions              # list region codes + names
fly scale count web=2 --region ams   # per-process, per-region count
fly scale show                    # what runs where, right now
```

Rules:
- A request with no pinned region goes to the **fastest Machine for that caller** via anycast — multi-region is mostly "run Machines in more places."
- `fly scale count N --region a,b` is the per-region count, not a total. Why: `count 2 --region iad,ams` means 2 in *each*, i.e. 4 Machines.
- If any target region is **out of capacity, the whole scale op fails** — no partial placement. Retry with fewer regions or a different code.
- "Slow for users in Sydney, app runs in iad" => add `syd`, not a bigger VM. Latency is distance, not CPU.

## Volumes

A Fly Volume is a local NVMe disk **pinned to one Machine in one region**. There is **no automatic replication** between volumes. Encrypted at rest by default (`--no-encryption` to opt out — almost never do).

```bash
fly volumes create data --region iad --size 3
fly volumes list
```

- **One volume attaches to one Machine.** Two Machines cannot share a volume. Why: it is block storage on one host, not a network filesystem.
- `fly scale count` on a group with a `[[mounts]]` creates a **new empty volume per new Machine** — it does **not** copy your data. This is the #1 stateful gotcha.

```toml
# Bad: expecting two web Machines to "share" /data — they each get their own empty disk
[[mounts]]
  source      = "data"
  destination = "/data"
  processes   = ["web"]   # then `fly scale count web=3` => 3 separate, unsynced disks
```

```toml
# Good: one writer with the volume; replicas are stateless and read via the DB/fly-replay
[[mounts]]
  source      = "data"
  destination = "/data"
  processes   = ["writer"]   # a single-Machine process group; scale `web` separately, stateless
```

Replication is **your app's job** (LiteFS, app-level streaming, or a managed DB), never the volume's. See `references/multi-region.md`.

## Secrets

```bash
fly secrets set STRIPE_KEY=sk_live_... SESSION_SECRET=...   # one rollout
fly secrets list           # shows NAME + digest + timestamp — never the value
fly secrets unset OLD_KEY
```

- `fly secrets set` **updates every Machine and restarts them** — it resets the ephemeral filesystem. Why: batch your sets into one command so you trigger one rollout, not five.
- Secrets arrive as **environment variables** in the guest. Read `process.env.STRIPE_KEY`.
- Need a secret as a *file* on disk (a cert, a service-account JSON)? Use `[[files]]` with `secret_name` — see `references/fly-toml.md`.

```toml
# Bad: secret baked into the image / committed config
[env]
  STRIPE_KEY = "sk_live_51H..."   # in git, in the image layers, leaked
```

```bash
# Good: out of the repo, out of the image, encrypted in Fly's vault
fly secrets set STRIPE_KEY=sk_live_51H...
```

Treat secret hygiene as non-negotiable — see ../secure-coding/SKILL.md.

## Scaling: pick the right lever

| Lever | What it does | Reach for it when |
| --- | --- | --- |
| `auto_stop_machines` / `auto_start_machines` | Fly Proxy stops/starts a **pre-created pool** by load; never creates/destroys | Bursty or idle traffic; cut cost on quiet hours |
| `fly scale count` | You set how many Machines exist per region/process | Steady baseline capacity; geographic spread |
| `fly-autoscaler` (superfly/fly-autoscaler) | Scales **Machine count** off any Prometheus metric | Queue depth / custom-metric driven autoscaling |
| `fly-replay` header | App returns `fly-replay` so Proxy replays the request elsewhere | Forward writes to primary region; route by tenant |

Key distinction: **autostop ≠ autoscaler.** Autostop only toggles Machines that already exist; it never changes the count. The metrics autoscaler is what actually adds/removes Machines. Set `auto_stop_machines` and `auto_start_machines` **together** — configuring one without the other is undefined behavior.

`fly-replay` is the multi-region write-forwarding pattern: read-replicas serve local reads, a write replies with `fly-replay: region=<primary>` and the Proxy re-runs the request there. Full header forms and the primary/replica split are in `references/multi-region.md`. These are the Fly levers only; platform-agnostic scaling theory (queues, sharding, load shedding) is ../scaling/SKILL.md.

## Cost & HA

- **min 2 Machines for HA.** A single Machine = a single point of failure; Fly recommends ≥2 per group in production.
- **Stopped Machines are cheap** — you pay for rootfs/volume storage, not running compute. So a warm pool with `auto_stop_machines = "stop"` is the default cost play.
- **Scale to zero** (`min_machines_running = 0`) trades cost for a **cold start** on the next request. If the first-request latency hurts, set `min_machines_running = 1` to keep one warm. Note: `min_machines_running` is honored **only in the primary region**.
- `"suspend"` resumes faster than `"stop"` (keeps memory snapshot) but is supported on fewer setups — verify before relying on it.

## Verify

After writing or editing a `fly.toml`, run the checker:

```bash
scripts/verify.sh path/to/fly.toml   # defaults to ./fly.toml
```

It prefers `fly config validate` when flyctl is on PATH, else does structural checks (app, primary_region, an internal_port, and the autostop-pair lint). Read-only; exits nonzero on any FAIL.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Secrets in `[env]` or the Dockerfile | Committed to git, baked into image layers | `fly secrets set` |
| `fly scale count` on a `[[mounts]]` group expecting shared data | Each new Machine gets an empty volume | Single writer + stateless replicas + DB/fly-replay |
| Setting only `auto_stop_machines` | Half-configured autostop is undefined | Set start + stop keys together |
| Assuming autostop changes Machine count | It only toggles a fixed pool | Use `fly scale count` or `fly-autoscaler` |
| One Machine in production | No HA; a host blip = downtime | ≥2 Machines per group |
| Bigger VM to fix far-away latency | Distance, not CPU, is the cost | Add a Machine in the user's region |
| Volume in a different region than its Machine | Cannot attach across regions | Create the volume in the Machine's region |
| Treating Fly Postgres as managed | Fly Postgres is unmanaged; you operate it | Route to it here; operate it via ../postgresdb/SKILL.md |
| `min_machines_running` in a non-primary region | Ignored outside primary | Keep warm capacity via `scale count` there |
| `fly deploy` with no `release_command` for a schema change | New code hits an old schema mid-rollout | `release_command` runs the migration first |
