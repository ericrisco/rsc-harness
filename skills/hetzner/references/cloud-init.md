# Reference: cloud-init + Cloud Firewall

The full, annotated first-boot configuration and the firewall script the SKILL
trims. Everything here runs **before first login** so the box is never reachable
in an unhardened state.

## Full annotated `cloud-init.yaml`

```yaml
#cloud-config
# Runs on first boot via: hcloud server create --user-data-from-file cloud-init.yaml

# --- non-root sudo user (root SSH gets disabled below) ---
users:
  - name: deploy
    groups: [sudo]
    shell: /bin/bash
    sudo: ["ALL=(ALL) NOPASSWD:ALL"]   # drop NOPASSWD if you want a sudo password
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... you@laptop  # YOUR real public key — never a placeholder

# --- kill root + password login at the cloud-init layer (belt) ---
disable_root: true        # cloud-init disables the root account's SSH
ssh_pwauth: false         # cloud-init disables password auth

# --- packages for hardening + patching ---
package_update: true
package_upgrade: true
packages:
  - ufw
  - fail2ban
  - unattended-upgrades

# --- drop-in sshd hardening (braces) so an image default can't re-enable it ---
# sshd keeps the FIRST value it reads and loads drop-ins in lexical order, so the
# file must sort before the image's 50-cloud-init.conf: 00-, never 99-.
write_files:
  - path: /etc/ssh/sshd_config.d/00-hardening.conf
    content: |
      PermitRootLogin no
      PasswordAuthentication no
      PubkeyAuthentication yes
      KbdInteractiveAuthentication no
      # Optional: move the port. Obscurity, not security — keep key-only + firewall regardless.
      # Port 2222
  - path: /etc/apt/apt.conf.d/20auto-upgrades
    content: |
      APT::Periodic::Update-Package-Lists "1";
      APT::Periodic::Unattended-Upgrade "1";
  - path: /etc/fail2ban/jail.d/sshd.local
    content: |
      [sshd]
      enabled = true
      maxretry = 4
      bantime = 1h

# --- apply it on first boot ---
runcmd:
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp        # change to your moved port if you set Port above
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
  - systemctl enable --now fail2ban
  - systemctl enable --now unattended-upgrades
  - systemctl restart ssh
```

Notes:

- `disable_root` + `ssh_pwauth: false` are the cloud-init-native way; the
  `sshd_config.d` drop-in is the redundant explicit layer so a base-image default
  can't quietly re-enable password/root login. Both saying the same thing is
  intentional.
- If you move the SSH port, change **both** the `Port` directive and the `ufw
  allow` line, and add the moved port to the Cloud Firewall before you reboot —
  or you lock yourself out.
- Optional Docker install (only if you're not handing off to the `coolify` skill
  to install it): append the official `get-docker.sh` convenience step in
  `runcmd`, then add `deploy` to the `docker` group.

## Cloud Firewall script

Create the edge firewall, scope it, and attach it. Inbound is default-deny — you
only enumerate what you allow.

```bash
#!/usr/bin/env bash
set -euo pipefail
FW=app-edge
SRV=app-01
MY_IP=203.0.113.4/32   # your admin IP/range for SSH

hcloud firewall create --name "$FW"

# Public web
hcloud firewall add-rule "$FW" --direction in --protocol tcp --port 80  --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule "$FW" --direction in --protocol tcp --port 443 --source-ips 0.0.0.0/0 --source-ips ::/0

# SSH scoped to you (open to the world only during initial setup, then tighten)
hcloud firewall add-rule "$FW" --direction in --protocol tcp --port 22 --source-ips "$MY_IP"

hcloud firewall apply-to-resource "$FW" --type server --server "$SRV"
hcloud firewall describe "$FW"
```

To open SSH to the world for the first connection, then lock it down:

```bash
hcloud firewall add-rule    "$FW" --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0 --source-ips ::/0
# ... do initial setup, confirm key login works ...
hcloud firewall delete-rule "$FW" --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule    "$FW" --direction in --protocol tcp --port 22 --source-ips "$MY_IP"
```

Two layers, why each:

- **Cloud Firewall (edge):** stateful, filters before the packet reaches the VM,
  configured via API/console — survives a broken host config. Primary defense.
- **Host `ufw`:** defense-in-depth — if the Cloud Firewall is ever detached or
  mis-edited, the box still isn't wide open. Keep the two allowlists in sync.
