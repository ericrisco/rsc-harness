---
name: hetzner
description: "Use when provisioning or hardening a Hetzner Cloud VPS: picking the plan/location (CX/CPX/CAX/CCX), bringing it up reproducibly with hcloud + cloud-init, locking down SSH, and wiring the Cloud Firewall to hand off a Docker-ready host. NOT app deploys on Coolify (that is `coolify`), NOT Dockerfiles (that is `docker`), NOT another provider (that is `digitalocean`)."
tags: [hetzner, vps, cloud-firewall, hcloud, ssh-hardening, cloud-init, self-hosting]
recommends: [coolify, docker, secure-coding, domains-dns, backups, monitoring]
origin: risco
---

# Hetzner — the cheap European box, made safe and reproducible

Hetzner Cloud is chosen for one reason: price/performance. A 2 vCPU / 4 GB AMD
box runs about €7.99/mo, the EU Intel line dips under €4, and EU locations
include 20 TB of egress. The risk is that "cheap" becomes "unhardened and
unmonitored" — a root-SSH box on a public IPv4 with password auth on. Your job
is to make the cheap box **safe** and **reproducible**: every server comes up
from a committed cloud-init file and a Cloud Firewall ruleset, never from
click-ops in the console. A box you can't recreate from a file isn't a box, it's
a pet.

## Decide before you create

Pick the line, then the location. Prices are post-2026-04-01 (a price adjustment
took effect that date); treat exact cents as "verify in the console."

| Line | Chip | When to pick | Price band | EU-only? |
|---|---|---|---|---|
| **CX** | Intel (shared) | Cost-optimized, tiny EU workloads | ~€3.99/mo (2 vCPU/4 GB/40 GB) | Yes |
| **CPX** | AMD (shared) | Default for apps; best general value | CPX22 ~€7.99, CPX32 ~€13.99, CPX42 ~€25.49 | No |
| **CAX** | ARM64 (shared) | Cheapest per-core; ARM-clean workloads | Cheapest per-core | Yes |
| **CCX** | Dedicated vCPU | Steady CPU load, no noisy-neighbor | CCX13 ~€15.99 (2 vCPU/8 GB) | No |

Rules:

- **IPv4 costs extra (~€0.50–0.60/mo); IPv6 is free.** An IPv6-only box is
  cheaper, but it breaks anything that can't reach IPv6: many container
  registries, some package mirrors, CI runners, SSH clients on IPv4-only nets.
  If `docker pull` or `apt` will run on the box, keep one IPv4 unless you've
  confirmed every upstream is dual-stack. Why: a saved €0.50/mo is not worth a
  broken `docker pull` at 2 a.m.
- **Location decides your traffic budget.** EU locations (Nuremberg, Falkenstein,
  Helsinki) include **20 TB/mo** egress; overage ~€1/TB. US (Ashburn, Hillsboro)
  and Singapore have **far lower** included transfer. Why: pick US "for latency,"
  serve a video, and the surprise bill is the traffic cap, not the instance.
- **No APAC own datacenter.** If your users are in Asia, this is a real latency
  cost — name it, don't hide it.

Full dated matrix, latency notes, and the no-SLA / no-managed-DB reality:
`references/plans-and-locations.md`.

## Provision reproducibly

Install the official CLI (latest **v1.65.0**, released 2026-05-21) and create a
context (the token comes from the project's *Security → API tokens*, Read &
Write):

```bash
brew install hcloud            # or: see github.com/hetznercloud/cli releases
hcloud context create my-project   # paste the Read+Write API token when prompted
hcloud server-type list        # confirm names/prices before you create
```

Bring the box up with cloud-init so hardening happens **before first login**:

```bash
hcloud server create \
  --name app-01 \
  --type cpx22 \
  --location fsn1 \
  --image debian-12 \
  --ssh-key my-laptop \
  --firewall app-edge \
  --user-data-from-file cloud-init.yaml
```

Use `--location`, not `--datacenter`: the `datacenter` attribute is **deprecated
and removed after 2026-07-01** for Servers and Primary IPs. Trimmed cloud-init
skeleton (full annotated file in `references/cloud-init.md`):

```yaml
#cloud-config
users:
  - name: deploy
    groups: [sudo]
    shell: /bin/bash
    sudo: ["ALL=(ALL) NOPASSWD:ALL"]
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... you@laptop   # your real public key, not a placeholder
disable_root: true                       # no root login at all
ssh_pwauth: false                        # no password auth, anywhere
package_update: true
packages: [ufw, fail2ban, unattended-upgrades]
runcmd:
  - sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  - sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  - ufw default deny incoming && ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
  - systemctl enable --now fail2ban
  - systemctl restart ssh
```

Rule: **never create a box with a bare root password and "I'll harden it later."**
Later is a window where the box is reachable as root with password auth on, and
Hetzner IPv4 space is scanned constantly. Bake it into boot.

## Two firewalls, in order

The Cloud Firewall runs at the network edge — stateful, applied before the
packet reaches the VM, and survives a misconfigured host. Create and apply it
**with or before** the server:

```bash
hcloud firewall create --name app-edge
hcloud firewall add-rule app-edge --direction in --protocol tcp --port 22  --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule app-edge --direction in --protocol tcp --port 80  --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule app-edge --direction in --protocol tcp --port 443 --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall apply-to-resource app-edge --type server --server app-01
```

Inbound is default-deny — you only describe what you *allow*. Then the host
`ufw` (set up in cloud-init above) is defense-in-depth: if you ever detach or
fat-finger the Cloud Firewall, the box still isn't wide open. Why both: the edge
firewall is your primary defense, but a single layer is a single point of
failure, and the two are configured through different surfaces (API vs host).

Tighten SSH to your own IP/range once you know it:

```bash
hcloud firewall delete-rule app-edge --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule    app-edge --direction in --protocol tcp --port 22 --source-ips 203.0.113.4/32
```

## SSH hardening rules

- **Key-only auth.** `PasswordAuthentication no`, `PubkeyAuthentication yes`. A
  password is brute-forceable; an ed25519 key is not.
- **No root login.** `PermitRootLogin no` + a sudo user. Root over SSH is the
  single most-targeted login on the internet.
- **fail2ban on.** Bans IPs after repeated failures — cheap insurance for the
  one port you must expose.
- **Moving port 22 is obscurity, not security.** It quiets log noise; it does not
  harden anything. Do it if you like clean logs, but never *instead* of key-only
  + a firewall.

## Hand off to Docker / Coolify

"Host ready" means all of the following are true:

- [ ] `ssh root@<ip>` is refused; `ssh deploy@<ip>` works with the key only.
- [ ] `sshd -T | grep -E 'permitrootlogin|passwordauthentication'` shows both `no`.
- [ ] Cloud Firewall attached; only 22 (scoped)/80/443 inbound.
- [ ] `ufw status` enabled with the same allowlist.
- [ ] `unattended-upgrades` and `fail2ban` running.

This skill stops at a clean, hardened host. Then route the install/deploy:
[`coolify`](../coolify/SKILL.md) for the Coolify install + app deploy flow,
[`docker`](../docker/SKILL.md) for Dockerfiles, compose, and image hardening.

## Day-2

- **Snapshot ≠ backup.** A snapshot is a one-off manual image you can boot from;
  the **Backups** add-on is automated, rotating, ~20% of the server price. A
  snapshot you took once in March is not a backup strategy — for that, see
  [`backups`](../backups/SKILL.md).
- **Resize grows, never shrinks.** You can scale the disk up; you cannot scale it
  back down. Size conservatively or you're stuck paying for it.
- **Volumes** for data you want to outlive/detach from the server. Keep databases
  and uploads on a volume so a server rebuild doesn't take the data with it.
- **Reverse DNS** must match for outbound mail to be accepted — set the PTR in the
  console/`hcloud` if the box sends email. Forward DNS records belong to
  [`domains-dns`](../domains-dns/SKILL.md).
- **No SLA, no managed DB.** There's no uptime guarantee, no managed-database
  product, and phone support only for dedicated-server customers — you run
  Postgres yourself, you monitor it yourself. For monitoring and alerting, see
  [`monitoring`](../monitoring/SKILL.md); treat the box as something you must
  watch, not something Hetzner watches for you. Name the trade-off to the user;
  don't pretend it's AWS.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Root SSH + password auth left on | The most-scanned login on the public internet; bots find it in minutes | `PermitRootLogin no`, `PasswordAuthentication no`, key + sudo user |
| Only host `ufw`, no Cloud Firewall | A host misconfig or reset exposes everything; no edge layer | Cloud Firewall default-deny first, `ufw` as defense-in-depth |
| `--source-ips 0.0.0.0/0` on everything "temporarily" | Temporary rules become permanent; the whole box is exposed | Scope inbound to 80/443 public, SSH to your IP/range |
| Click-ops in the console | Not reproducible — you can't recreate or review the box | cloud-init file + `hcloud` commands committed to the repo |
| Snapshot treated as backup | One stale manual image, no rotation, no schedule | Enable the Backups add-on or push to off-box storage |
| US location, then surprised by the bill | US/Singapore include far less than EU's 20 TB egress | EU location for egress-heavy apps; check the traffic cap first |
| IPv6-only to save €0.50 | Registry/CI/mirror pulls over IPv4-only break | Keep one IPv4 unless every upstream is confirmed dual-stack |
| Using `--datacenter` | Deprecated, removed after 2026-07-01 | Use `--location` |

## Verify

```bash
ssh -o BatchMode=yes root@<ip>                 # expect: refused / permission denied
ssh deploy@<ip> 'sshd -T | grep -E "permitrootlogin|passwordauthentication"'
# expect: permitrootlogin no / passwordauthentication no
hcloud firewall describe app-edge              # expect: only 22 (scoped)/80/443 inbound
ssh deploy@<ip> 'ss -tlnp'                      # expect: only expected listeners
```

To lint a cloud-init / hardening file before you ever create the box, run
`scripts/verify.sh path/to/cloud-init.yaml` — it statically checks for the
must-haves (no root login, no password auth, an SSH key, a firewall step,
fail2ban) with no network calls.
