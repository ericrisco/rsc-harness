---
name: coolify
description: "Use when self-hosting apps, managed databases and deploys on a VPS you own with Coolify instead of paying a managed PaaS — installing Coolify on a fresh Ubuntu/Debian box, claiming the first-admin account, deploying from a Git repo (Nixpacks/Railpack/Dockerfile/compose), provisioning Postgres/MySQL/MongoDB/Redis in-product, wiring scheduled DB backups to S3-compatible storage, or custom domains + automatic SSL via the built-in Traefik proxy. Triggers: 'install Coolify', 'self-host my app on a cheap VPS', 'my Vercel/Heroku bill is killing me, move it to a box I own', 'control plane on my own server', 'nightly Postgres backups to R2 in Coolify', 'montar mi propio PaaS en un VPS barato con Coolify', 'autoallotjar les meves apps amb Coolify'. NOT the managed push-and-forget PaaS where someone else owns the box (that is railway), NOT sizing/hardening the VPS itself (that is hetzner / digitalocean), NOT generic Docker image authoring (that is docker)."
tags: [coolify, self-hosting, paas, vps, docker, deployment, devops]
recommends: [hetzner, digitalocean, docker, postgresdb, backups, domains-dns, github-actions]
origin: risco
---

# Coolify — own-the-box PaaS on your VPS

Coolify is an open-source, self-hostable control plane that turns a plain Linux VPS into a Vercel/Heroku
replacement: Git-to-deploy, managed databases, automatic SSL, scheduled backups — for a flat VPS bill
instead of per-request metering. This skill is operational. It produces the exact install one-liner, the
port matrix, env wiring, a lint-clean compose artifact, and a backup-to-S3 cron with a tested restore.
Coolify 4.x (stable in 2026); v4.1 added Railpack, structured audit logging, and a read-only MCP server.

## Mental model — read this first

1. **Coolify is the control plane, not the box.** It runs *on* a VPS you provisioned elsewhere. Hardware
   sizing, the cloud firewall, SSH hardening, OS patching → that is the VPS layer (hetzner /
   digitalocean), not this skill. Coolify orchestrates what runs on the box.
2. **You own the data and the uptime now.** No vendor takes nightly snapshots for you. So backups are
   non-optional and a backup you have never restored is not a backup (see the backup section).
3. **Everything underneath is Docker.** Coolify generates compose/Dockerfile runs and a Traefik proxy. So
   every Docker rule still applies — named volumes, healthchecks, pinned images, env-injected secrets.
   For image-authoring depth (multi-stage, layer caching) go to the `docker` skill; here we wire it.
4. **First account to register owns the instance — forever.** There is no "admin invite" recovery if a
   stranger registers first. Claim it within seconds of install (see step 4).

## Decision — where should this app actually run?

| Option | Who owns the box | Cost shape | Ops burden | Choose when |
| --- | --- | --- | --- | --- |
| **Coolify self-hosted** (this skill) | You (your VPS) | Flat VPS/month | You patch + back up | Predictable bill, data sovereignty, many apps on one box |
| **Coolify Cloud** | You bring the server; they host the control plane | VPS + small SaaS fee | They run the control plane | Want Coolify UX without babysitting the dashboard's own uptime |
| **Managed PaaS** (railway / render / fly-io / vercel / netlify) | The provider | Per-usage, scales up fast | Near-zero | Spiky scale-to-zero, no box to own — the inverse of Coolify |

Choose Coolify when a few always-on apps on a known-cost box beats per-request metering. If the user wants
`git push` and never touches a server, that is railway — route there.

## Install — the 6-minute path

Provision the box first (this is the hetzner / digitalocean step, not this skill). Floor is 2 CPU / 2 GB
RAM / 30 GB disk; Coolify itself idles around 1 GB RAM. For comfortable multi-app production aim for
4 vCPU / 8 GB / 100 GB NVMe. Ubuntu 22.04/24.04 LTS recommended (Debian, Fedora/Alma/Rocky, Alpine, Arch,
Raspberry Pi OS 64-bit also supported; non-LTS needs manual steps — see references).

```bash
# 1. SSH in AS ROOT. Non-root is not fully supported by the installer — log in as root.
ssh root@<server-ip>

# 2. One-liner install (root). Takes ~2–5 min: installs Docker, sets up Coolify's own stack.
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

```text
# 3. The installer prints the dashboard URL: http://<server-ip>:8000
# 4. CRITICAL — within seconds, open http://<server-ip>:8000 and REGISTER.
#    That first account becomes the permanent root admin of the instance. First-come-owns-the-box;
#    there is no later "claim ownership" flow. Do not walk away between step 2 and this.
# 5. In the dashboard: set the instance FQDN (coolify.example.com) and force HTTPS, so you stop
#    hitting the raw :8000 IP and the dashboard itself gets a real certificate.
```

Why root: the installer wires Docker and system services; the docs state non-root is not fully supported.
Why claim immediately: the registration page is open until someone takes it.

Full install transcript, non-LTS/other-OS notes, and dashboard-domain setup → `references/install-and-proxy.md`.

## Port & firewall matrix

Set these at the cloud firewall (hetzner/digitalocean layer) AND keep them in mind on the box.

| Port | Purpose | Exposure |
| --- | --- | --- |
| 22 | SSH | Restrict to your IP / VPN; key-only |
| 8000 | Coolify dashboard | **Restrict** to your IP after setup, or front with the proxy on a FQDN; never leave open to the world |
| 80 | Proxy HTTP (Traefik) → redirects to 443 | Public |
| 443 | Proxy HTTPS, app traffic + Let's Encrypt | Public |
| 6001 | Realtime / websocket | Open as the dashboard needs (same audience as 8000) |
| 6002 | Realtime / terminal websocket | Same as 6001 |

Rule: 80/443 are the only ports the public should reach. 8000/6001/6002 are operator surface — lock them
to your IP or put the dashboard behind its FQDN. Why: an open :8000 plus an unclaimed instance is a
takeover; an open :8000 on a claimed instance is still your full control plane exposed to brute force.

## Deploy an app

Pick the build pack first, then wire source → env → storage → domain.

| Build pack | Use when | Note |
| --- | --- | --- |
| **Nixpacks** (default) | Standard app, you want zero config | Auto-detects the language/runtime; start here |
| **Railpack** (v4.1, beta) | Need build-time env vars, config merge, or multi-stage control | Newer; reach for it when Nixpacks can't express the build |
| **Dockerfile** | You already have a Dockerfile / want full build control | You own the build; pin a base image |
| **docker-compose** | Multi-service app deployed as a unit | Coolify runs your compose; this is the verify.sh-linted artifact shape |

Then:

1. **Connect the Git source** — GitHub/GitLab app or a deploy key; pick branch; enable auto-deploy on push
   (or trigger from CI — that wiring is the `github-actions` skill).
2. **Set env vars as Coolify secrets** — inject at runtime via the UI/API; never bake secrets into the
   image or commit them to the compose. Why: a baked secret ships in every image layer and leaks on pull.
3. **Add persistent storage** — any path that must survive a redeploy (uploads, sqlite) gets a named
   volume. A container without one loses its writes on every recreate.
4. **Attach the domain + SSL** — add `app.example.com`, point its DNS A record at the box (DNS itself is
   the `domains-dns` skill), and the Traefik proxy provisions Let's Encrypt automatically on ports 80/443.

Build-pack deep-dive + a worked, lint-clean compose example → `references/deploy-recipes.md`.

## Managed databases

Coolify provisions Postgres, MySQL, MariaDB, MongoDB, Redis (and more) in-product — one-click, with
generated credentials.

- **Connect apps over the internal Docker network hostname**, not a public IP. Coolify gives each DB an
  internal service name; the app reaches it on the private network. Why: zero public attack surface.
- **Do NOT publicly expose the DB port** unless you genuinely need an external client. If you must, bind
  it deliberately and firewall it to known IPs — an open 5432/3306 is scanned within minutes.
- **Every DB gets a named volume.** Without it, recreating the service wipes the data. This is the single
  most common Coolify data-loss footgun.

This skill provisions and connects the DB; it does not teach SQL, indexing, or query tuning — that is the
`postgresdb` skill. Per-engine details and connection strings → `references/databases-and-backups.md`.

## Backups to S3 — non-negotiable

You own the data now. Coolify runs scheduled dumps (`pg_dump` / `mysqldump` / `mongodump`) on a cron
expression, stores them locally, and optionally pushes to S3-compatible storage: AWS S3, Cloudflare R2,
Backblaze B2, MinIO, Wasabi.

1. **Add an S3 destination** — endpoint, region, bucket, access key/secret (as Coolify secrets, never in
   a committed file). Off-box storage is the point: a backup on the same disk dies with the disk.
2. **Set the cron schedule** — e.g. `0 3 * * *` for nightly 03:00. Match frequency to how much data you
   can afford to lose (RPO doctrine across systems is the `backups` skill; here we wire the in-product job).
3. **Set retention** — keep N days/copies so the bucket doesn't grow unbounded.
4. **Run the restore drill — once, before you need it.** Download a dump, decompress, replay it into a
   throwaway DB, confirm the row counts. An untested backup is a guess. Schedule a recurring drill.

Per-provider S3 setup, per-engine dump/restore commands, and the full restore runbook →
`references/databases-and-backups.md`.

## Operate the box

- **Resource planning.** Coolify idles ~1 GB RAM; budget the rest for your apps + databases. Multi-app
  sweet spot is 4 vCPU / 8 GB / 100 GB NVMe. Watch RAM headroom before adding the next app.
- **Updates.** Update Coolify from the dashboard's settings; pin/snapshot before a major bump.
- **Logs & audit.** Per-resource logs live in the UI. v4.1 adds a structured audit log — use it to see who
  changed what.
- **MCP server (v4.1, read-only).** Coolify exposes an instance-level MCP server with read-only tools for
  AI-agent integration. Useful for letting an agent inspect status; it is read-only by design — do not
  treat it as a deploy channel, and still lock down the network in front of it.

## Anti-patterns → STOP

| Rationalization | Reality → STOP |
| --- | --- |
| "I'll install with my sudo user, root feels risky" | The installer wires Docker + system services and the docs say non-root is not fully supported. SSH in as root for install. |
| "I'll register the admin account later" | First account to hit `:8000` owns the instance permanently. A stranger registering first = takeover. Claim it within seconds. |
| "Leave :8000 open, it's password-protected" | That is your full control plane exposed to brute force. Restrict 8000/6001/6002 to your IP; only 80/443 are public. |
| "Pin the app image to `:latest`, it's simpler" | `:latest` floats — a silent base change breaks a redeploy you can't reproduce. Pin a tag or digest. |
| "The database doesn't need a named volume yet" | Recreating the service wipes an anonymous volume. Data gone. Named volume from day one. |
| "Put the DB password in the compose so deploys are reproducible" | Secrets in a committed file leak in git history and image layers. Inject via Coolify env/secrets, env-ref only. |
| "Expose 5432 so I can connect from my laptop" | An open DB port is scanned in minutes. Use the internal hostname; if you truly need external access, firewall it to known IPs. |
| "Backups are configured, we're covered" | A backup you've never restored is a guess. Run the restore drill before you need it. |
| "Coolify will harden the server for me" | Coolify is the control plane, not the OS-hardening layer. Firewall/SSH/patching is the VPS skill (hetzner/digitalocean). |
| "Use Coolify because I just want to git push and forget the server" | That's the opposite of own-the-box. Use a managed PaaS — railway. |

## Verify

Run `scripts/verify.sh` against your project (or this skill's `references/`). It statically lints the
example/your `docker-compose.y*ml`: fails on a hardcoded secret literal (must be env-ref), a DB service
without a named volume, a missing `healthcheck:`, or a floating `:latest` tag on a build-context service;
and confirms the canonical port matrix (8000/80/443/6001/6002) is documented. Read-only, no network, no
live deploy. Exits 0 on a clean/empty target.

## References

- `references/install-and-proxy.md` — full install transcript, non-LTS/other-OS steps, Traefik (default)
  vs Caddy, wildcard domains + DNS-01 challenge, common SSL failures and fixes.
- `references/databases-and-backups.md` — per-engine dump commands, S3 destination setup for
  R2/B2/MinIO/Wasabi/AWS, retention, the step-by-step restore runbook, consistency caveats.
- `references/deploy-recipes.md` — build-pack decision deep-dive and a worked, lint-clean
  `docker-compose.yml` (env-ref secrets, named volumes, healthcheck, pinned image) — the verify.sh target.

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the harness Karpathy wiki), record this
instance's deploy topology there and index it in `02-DOCS/wiki/index.md`, so the next agent inherits it
instead of re-deriving it.

1. **Find the article** `02-DOCS/wiki/stack/coolify.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the real choices — the box (provider/specs), instance
   FQDN, which apps/databases run on it, build packs in use, the backup destination + cron + retention,
   and the port/firewall decisions — then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when the topology changes, update the article (bump
   its `Updated` date) in the same change. Never commit credentials here — record *where* secrets live,
   not their values.

No `02-DOCS/` layer? Skip silently. Topology is recorded, not gated — never block the task on this.
