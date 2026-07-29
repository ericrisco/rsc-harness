---
name: digitalocean
description: "Use when deploying or operating a workload on DigitalOcean — Droplet vs App Platform vs Functions, doctl, app spec YAML, Managed Postgres/MySQL/Valkey on the VPC, S3-compatible Spaces + CDN. NOT host-agnostic CI/CD or rollback strategy (that is `deployment`), NOT a bare Hetzner VPS (that is `hetzner`), NOT another managed PaaS (that is `railway`)."
tags: [digitalocean, doctl, app-platform, droplets, spaces, deployment, paas, vps]
recommends: [deployment, postgresdb, docker, domains-dns, monitoring, scaling, hetzner]
origin: risco
---

# DigitalOcean — Droplet vs App Platform, doctl, Managed DBs, Spaces

You own one decision: **where on DO does this run, and how do I ship it.** Host-agnostic
CI/CD, release gating and rollback strategy are `../deployment/SKILL.md`; authoring the
Dockerfile is `docker`; DNS records and the registrar are `domains-dns`; a bare Hetzner box
and its economics are `hetzner`. Pick the compute model first, then wire data and storage,
then the ops that bite in production.

```text
workload → [Droplet | App Platform | Functions] → Managed DB (VPC private host) → Spaces (S3 + CDN)
              raw VPS    managed PaaS   event fn        Postgres/MySQL/Valkey         object store
```

## The core decision: Droplet vs App Platform vs Functions

Settle this before writing a single command. Most web apps want App Platform; reach for a
Droplet only when you need the box itself.

| Axis | Droplet (VPS) | App Platform (PaaS) | Functions |
| --- | --- | --- | --- |
| Control | Full root, any daemon, any port | Build+run only, no SSH | Per-invocation, no host |
| Ops burden | You patch/secure/restart it | DO runs it, auto TLS, auto deploy | Zero infra |
| Price floor | Per-second billing since 2026-01-01, min 60s or $0.01 | 3 static sites free; dynamic from $5/mo per service | Pay per call |
| Scaling | Resize/clone/load-balance yourself | Set instance count + size, autoscale | Implicit |
| Best for | Stateful daemons, cron hosts, custom networking, "give me a Linux box" | Web service / API / worker / static site from a repo | Event glue, webhooks |

Rules of thumb:

- **Stateless web service or API from a Git repo → App Platform.** It builds, deploys, gives
  you TLS and a URL, and re-deploys on push. No box to patch. **Static frontend → App
  Platform static site (free, up to 3)**; don't run a Droplet to serve HTML.
- **You need root, a long-lived stateful daemon, custom ports, or a cron host → Droplet.**
- **A managed Postgres/MySQL/Valkey → always the Managed Database product**, never a DB you
  hand-install on a Droplet, unless you have a hard reason.

## doctl setup

`doctl` is the official DO CLI; it drives everything below.

```bash
# macOS
brew install doctl
# Linux: download the release tarball from github.com/digitalocean/doctl/releases, then:
#   tar xf doctl-*.tar.gz && sudo mv doctl /usr/local/bin

# Authenticate with a token from cloud.digitalocean.com/account/api/tokens
doctl auth init                       # pastes a token, validates, stores a context
doctl auth init --context prod        # a named context per account/env
doctl auth switch --context prod      # switch the active context
doctl account get                     # verify the token works
```

**Never commit the token.** It is a full-account credential. Keep it in your shell keychain,
a secret manager, or CI secret — never in the repo, never in an app spec. Why: a leaked
`dop_v1_…` token lets anyone create/destroy your whole account.

## App Platform via app spec

App Platform deploys from an **app spec** (YAML or JSON). Treat the spec as the source of
truth, version it, and apply it with doctl.

```yaml
# .do/app.yaml — minimal web service + managed Postgres
name: my-api
region: nyc
services:
  - name: web
    github:
      repo: me/my-api
      branch: main
      deploy_on_push: true
    instance_size_slug: apps-s-1vcpu-1gb   # ~$5/mo basic; sizes go up to dedicated
    instance_count: 1
    http_port: 8080
    envs:
      - key: NODE_ENV
        value: production
        scope: RUN_TIME              # RUN_TIME | BUILD_TIME | RUN_AND_BUILD_TIME
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}    # injected from the managed DB below
        scope: RUN_TIME
      - key: API_SIGNING_KEY
        value: ${API_SIGNING_KEY}
        type: SECRET                 # encrypted at rest; never plaintext
        scope: RUN_TIME
databases:
  - name: db
    engine: PG
    production: true
```

Lifecycle — validate, then create or update:

```bash
doctl apps spec validate .do/app.yaml          # structural lint, no deploy
doctl apps create --spec .do/app.yaml          # first deploy; prints the app id
doctl apps update <app-id> --spec .do/app.yaml # apply changes (and to roll back: re-apply the prior spec)
doctl apps list                                # find the id
```

Env scoping that matters:

- `type: SECRET` encrypts the value at rest and hides it in the dashboard. Use it for every
  key, token, password. Plain `value:` is readable.
- `scope: BUILD_TIME` for things only the build needs; `RUN_TIME` for runtime; don't leak
  build-only secrets into the running container.
- `${db.DATABASE_URL}` (and `${db.HOSTNAME}`, `${db.PORT}`, etc.) are auto-injected when the
  service references a `databases:` entry — you never paste the connection string.

Operate:

```bash
doctl apps logs <app-id> --type run --follow     # run | build | deploy
doctl apps logs <app-id> <component> --type run  # one component
```

**Rollback = re-apply the previous spec** (git-revert `.do/app.yaml` and `doctl apps update`),
or redeploy a prior deployment from the dashboard. There is no magic rollback verb — your
git history of the spec is the rollback mechanism.

For multi-component apps (web + worker + static_site + job + db, health checks, ingress
routes, autoscaling, instance-size table, alerts) see `references/app-spec.md`.

## Droplets

A Droplet is a Linux VPS. Bootstrap it declaratively, lock it down with a *cloud* firewall.

```bash
doctl compute droplet create web-1 \
  --region nyc3 --size s-1vcpu-1gb --image ubuntu-24-04-x64 \
  --ssh-keys <fingerprint> \
  --vpc-uuid <vpc-uuid> \
  --user-data-file cloud-init.yaml \
  --wait
```

- **Cloud firewall, not just `ufw`.** A cloud firewall filters at DO's edge before traffic
  reaches the box, and applies to a tag/group of Droplets. Use it as the real perimeter;
  host `ufw` is defense-in-depth, not the only line. Why: a misconfigured `ufw` after a
  reboot still leaves the edge firewall protecting you.
- **Reserved IP is free while assigned to a Droplet** (you pay only when it's unassigned).
  Assign one so you can re-point it to a replacement Droplet without DNS changes — that's
  your failover handle.
- **Snapshots/backups** are your restore path; enable automated backups or snapshot before
  risky changes.
- **Per-second billing since 2026-01-01** (min 60s or $0.01): short-lived Droplets are cheap
  to spin up and destroy, but a powered-off Droplet still bills for storage — destroy, don't
  just power off, to stop charges.

Cloud-init recipes, firewall inbound/outbound rule sets, snapshot cadence + restore,
reserved-IP failover, and the VPC + private-DB layout live in `references/droplet-ops.md`.

## Managed Databases

Use the Managed Database product for Postgres/MySQL/Valkey — DO handles patching, failover,
and backups.

- **Provision sizing:** managed Postgres starts ~$15/mo single node; HA (primary+standby)
  from ~$30/mo; read replicas available for read scaling.
- **Connect over the VPC private host, not the public one.** Same-region Droplets and
  Managed DBs talk over the VPC with no bandwidth charge and sub-ms latency, and the private
  host keeps the DB off the public internet. Add the app's Droplet/App as a **trusted source**
  so only it can connect.
- **Connection pooling (PgBouncer) is built in.** Use a pool when many short-lived clients
  (serverless, lots of App Platform instances) would otherwise exhaust connections — a
  cluster supports up to ~21 pools / up to ~1,000 connections depending on size, and the
  pool listens on a **separate pool port** from the raw DB port. Point your app at the pool
  connection string, not the raw one.
- For schema design, indexing, query tuning, migrations → that's `../postgresdb/SKILL.md`,
  not here. This skill only provisions and wires the cluster.

## Spaces (S3-compatible object storage + CDN)

Spaces is S3-API-compatible object storage with a built-in CDN.

- **$5/mo includes 250 GiB storage + 1 TiB outbound transfer**; inbound is free; the CDN is
  included at no extra cost across 200+ edge locations.
- **Spaces keys are NOT your API token.** Generate a separate Spaces access key + secret;
  the doctl/API token does not work for S3 operations.
- **Use any S3 SDK or `aws-cli`/`s3cmd`** against the regional endpoint:

```python
# boto3 against DO Spaces (nyc3 region/endpoint)
import boto3
s3 = boto3.client(
    "s3",
    endpoint_url="https://nyc3.digitaloceanspaces.com",
    region_name="nyc3",
    aws_access_key_id="<SPACES_KEY>",       # Spaces key, not the DO API token
    aws_secret_access_key="<SPACES_SECRET>",
)
s3.upload_file("photo.jpg", "my-bucket", "photo.jpg", ExtraArgs={"ACL": "public-read"})
```

Serve public assets through the bucket's CDN edge URL; set **CORS** on the bucket if a
browser fetches it cross-origin, and a **lifecycle** rule to expire/transition old objects.

## Basic ops + cost gotchas

- Set **alerts** on the app/DB (deploy failures, CPU, restart count) so you hear about
  trouble before users do. App-level dashboards/alerting *strategy* is `../monitoring`.
- **Scale** by editing `instance_count`/`instance_size_slug` in the spec and re-applying;
  capacity *strategy* that's host-agnostic is `../scaling`.
- **App Platform data transfer overage is $0.02/GiB**, billed separately from Droplet
  transfer — a chatty media app can run up a bill; front heavy static assets with Spaces+CDN.
- **An unassigned reserved IP is billed.** Release reserved IPs you're not using.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Hardcoding a `dop_v1_…` token or DB password as a plain `value:` in the app spec | Spec is in git, value is readable, full-account compromise | `type: SECRET` env, or `${db.*}` injection; token only in `doctl auth` |
| Connecting app→DB over the public host | Public exposure + egress cost + latency | VPC private host + trusted source |
| Running a stateful long-lived daemon as an App Platform service | Components are restartable/stateless; state is lost | Droplet (or a job/worker designed to be stateless) |
| Sizing a dedicated `apps-d-2vcpu-4gb` (~$78/mo) for a hobby app | Paying enterprise rates for toy traffic | Start `apps-s-1vcpu-1gb` (~$5) and scale up on real metrics |
| `ufw` on the Droplet as the only firewall | A bad reboot/config leaves the host open | Cloud firewall at the edge + host `ufw` as defense-in-depth |
| Hand-installing Postgres on a Droplet "to save money" | You now own patching, backups, failover | Managed Database unless you have a hard reason |
| Powering off a Droplet to stop billing | Powered-off Droplets still bill for storage | Snapshot then destroy |
| Leaving a reserved IP unassigned | It's billed when not attached | Release it |
