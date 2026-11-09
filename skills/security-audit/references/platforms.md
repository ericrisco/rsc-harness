# Platforms: detect, get read access, check by code

A project is not only its code. The repository on GitHub, the deploy on Vercel, the database, the
server, the DNS: each one has settings that can open the door no matter how clean the code is. This
reference covers how the audit finds those platforms, how it gets read-only access to them, how it
checks them **with a script instead of with judgment**, and how a failed check becomes a finding.

Ground rules that apply to every section below:

- **Live systems are read, never touched.** Read-only configuration access, plus harmless external
  checks (security headers, TLS, which ports answer from outside, DNS records). No exploit, no
  brute force, no fuzzing, no "let's see if this write works". Details: `auditor-safety.md`.
- **The vendor docs decide, never memory.** Every setting name below is a pointer, not a spec.
  Vendors rename screens and API fields every few months. Read the current docs at audit time and
  write the URL and the date into the platform's `README.md`.
- **Credentials follow `secrets-discipline.md`.** Never pasted in chat when there is another way.
- **Only the user's own assets.** Every host, domain and account checked is one the user confirmed
  is theirs. A third-party API the project calls is not a platform to audit.

## (a) Detection

Read the repository for the signals below. Each hit adds a candidate platform with the evidence
that revealed it (`detected_by`: the file and line, the dependency, the env var name). Read env
**names** only: from `.env.example`, config files, CI files and code. Never open a real `.env` to
detect anything.

| Platform | Repo signals | Load skill |
|---|---|---|
| GitHub (repo, org, Actions) | `.git/config` remote on `github.com`; `.github/workflows/*.yml`, `.github/dependabot.yml`, `CODEOWNERS`, `.github/` templates | `github-actions` |
| Vercel | `vercel.json`, `vercel.ts`, `.vercel/project.json` (usually gitignored), `@vercel/*` deps, `VERCEL_*` env names, `vercel` CLI in CI, `*.vercel.app` URLs | `vercel` |
| Netlify | `netlify.toml`, `_headers`, `_redirects`, `netlify/functions/`, `@netlify/*` deps, `NETLIFY_*` env names, `*.netlify.app` | `netlify` |
| Cloudflare | `wrangler.toml` / `wrangler.json[c]`, `.dev.vars`, `@cloudflare/*` deps, `CLOUDFLARE_API_TOKEN` / `CF_*` names, nameservers `*.ns.cloudflare.com`, `*.workers.dev` / `*.pages.dev` | `cloudflare` |
| Supabase | `supabase/config.toml`, `supabase/migrations/`, `@supabase/supabase-js` / `@supabase/ssr`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `*.supabase.co` | `supabase`, `postgresdb` |
| Neon | `@neondatabase/serverless`, hosts `*.neon.tech`, `NEON_API_KEY`, `DIRECT_URL` next to a `-pooler` URL, Neon GitHub Action | `neon`, `postgresdb` |
| PostgreSQL (self-hosted or any provider) | `DATABASE_URL=postgres…` in `.env.example`, `pg` / `psycopg` / `asyncpg` / Prisma `provider = "postgresql"`, `postgres` image in compose, `migrations/*.sql` | `postgresdb` |
| PlanetScale | `pscale` in CI, `PLANETSCALE_SERVICE_TOKEN*`, `@planetscale/database`, hosts `*.psdb.cloud` | `planetscale`, `mysql` |
| MySQL / MariaDB | `mysql://` URLs, `mysql2` / `mysqlclient` / `PyMySQL`, `mysql` or `mariadb` image in compose | `mysql` |
| MongoDB (Atlas or self-hosted) | `mongodb://` / `mongodb+srv://`, `mongoose` / `mongodb` driver, `MONGODB_URI`, `mongo` image, `*.mongodb.net` | `mongodb` |
| Redis (self-hosted or managed) | `redis://` / `rediss://`, `ioredis` / `redis` / `bullmq` / `celery[redis]`, `REDIS_URL`, `UPSTASH_*`, `redis`/`valkey` image | `redis` |
| Turso / SQLite | `@libsql/client`, `libsql://` URLs, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `*.db` files in repo | `sqlite-turso` |
| Firebase | `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firebase` / `firebase-admin` deps, `FIREBASE_*` names | `firebase`, `gcp-essentials` |
| AWS | `aws-actions/*` in workflows, `AWS_*` names, `*.tf` with `provider "aws"`, `cdk.json`, `serverless.yml`, `samconfig.toml`, `@aws-sdk/*`, `boto3` | `aws-essentials` |
| Google Cloud | `google-github-actions/*`, `gcloud` in CI, `app.yaml`, `cloudbuild.yaml`, `*.tf` with `provider "google"`, `GOOGLE_APPLICATION_CREDENTIALS`, `@google-cloud/*` | `gcp-essentials` |
| DigitalOcean | `.do/app.yaml`, `doctl` in CI, `DIGITALOCEAN_ACCESS_TOKEN`, `*.tf` with `digitalocean` provider, `*.ondigitalocean.app` | `digitalocean` |
| Hetzner | `cloud-init*.yaml`, `hcloud` in scripts or CI, `HCLOUD_TOKEN`, `*.tf` with `hetznercloud/hcloud`, IPs in Hetzner ranges in docs | `hetzner` |
| Railway | `railway.json` / `railway.toml`, `RAILWAY_TOKEN`, `*.railway.internal`, `*.up.railway.app` | `railway` |
| Render | `render.yaml`, `RENDER_*` names, `*.onrender.com` | `render` |
| Fly.io | `fly.toml`, `FLY_API_TOKEN`, `superfly/flyctl-actions`, `*.fly.dev`, `*.internal` with Fly 6PN | `fly-io` |
| Coolify | `COOLIFY_*` names, Coolify deploy webhook in CI, compose files with Coolify labels, docs mentioning the Coolify panel | `coolify`, plus the VPS provider's skill |
| Docker host (any VPS running containers) | `docker-compose*.yml` / `compose.yaml` used for production, `Dockerfile` plus a deploy script over SSH, `DOCKER_HOST` | `docker`, plus the VPS provider's skill |
| DNS and domains | domains in config, `CNAME` file, `vercel.json`/`netlify.toml` domains, `README` links, CORS origins, email `From:` domains | `domains-dns` |
| Stripe | `stripe` deps, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `/webhook` routes calling `constructEvent` | `stripe` |
| Backups | backup scripts, `pgbackrest`/`wal-g`/`restic`/`borg` config, provider backup flags in IaC | `backups` (cross-cutting, see below) |
| Monitoring | Uptime Kuma, UptimeRobot, Sentry, Better Stack config or env names | `monitoring` (cross-cutting, see below) |

Repo signals miss what the repo does not mention: the DNS provider, the registrar, a database
someone created by hand. After the scan:

1. Show the user the detected list with the evidence for each, in one message.
2. Ask what is missing ("anything else in production that is not in the code: a server, a database,
   a domain, an admin panel?") and what is wrong ("is anything here no longer used?").
3. Audit only the confirmed list. Each confirmed platform gets one entry in `platforms[]` from the
   start, with `detected_by`, `access: none` and `status: not_reviewed` until its check has run.

If a catalog skill above is not installed, read it from the catalog before checking that platform;
it holds the platform's own failure modes.

## (b) What to check, per platform

Each list is the minimum. Every item is a read: an API `GET`, a read-only query, a config file in the
repo, or a harmless external request. If the project manages the setting in code (Terraform,
`render.yaml`, `vercel.json`, `wrangler.jsonc`, cloud-init, compose), check **both** the code and
the live value: they drift.

### External checks (every public URL, domain and IP)

Run these from outside, against hosts the user confirmed as theirs, at low rate:

- **TLS**: certificate valid, full chain served, not expiring within 21 days, TLS 1.2+ only,
  HTTP redirects to HTTPS.
- **Security headers** on the main pages and the API: `Strict-Transport-Security`,
  `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, frame protection
  (`frame-ancestors` or `X-Frame-Options`), `Referrer-Policy`; cookies `Secure`, `HttpOnly`,
  `SameSite`. No `Server`/`X-Powered-By` version banners.
- **CORS**: an `OPTIONS` or `GET` with a foreign `Origin` header must not come back with that origin
  reflected plus `Access-Control-Allow-Credentials: true`.
- **Exposed files**: a `GET` (no crawling) for a short fixed list: `/.git/HEAD`, `/.env`,
  `/.DS_Store`, source maps for production bundles, `/server-status`, framework debug pages.
  A `200` with real content is a finding. Record only the status code, the `Content-Type`, the size
  in bytes and, for `/.env` and similar, a count of lines that look like `KEY=value`. Never keep any
  of the content, not even the first line: it is the secret itself.
- **Open ports**: a TCP connect test (no banner grabbing beyond the protocol greeting, no login
  attempts) to the user's own IPs on a short list: 22, 80, 443, 3000, 5432, 3306, 6379, 27017,
  8000, 8080, 9200, 2375/2376 (Docker API), 6001/6002 (Coolify). Anything beyond 80/443 answering
  from the internet goes on the list for that host.

### GitHub (repository, organisation, Actions)

- Default branch protected by a branch protection rule or a ruleset: pull request required, at
  least one approving review, stale approvals dismissed, required status checks, no force push,
  no deletion, admins not exempt (or the exemption is deliberate).
- Actions: default `GITHUB_TOKEN` permissions set to read-only at repo and org level; "allow
  Actions to create and approve pull requests" off unless needed; which actions are allowed (all,
  verified creators, or an allowlist).
- Workflows (read from `.github/workflows/`): a top-level `permissions:` block on every workflow;
  `pull_request_target` or `workflow_run` that checks out the PR head or runs PR code; untrusted
  input (`github.event.*.title`, `body`, `head_ref`, branch names) interpolated straight into
  `run:`; third-party actions not pinned to a full commit SHA; secrets passed to third-party
  actions; long-lived cloud keys where OIDC is possible; OIDC trust policies scoped to `repo:ORG/*`
  instead of one repo and ref; self-hosted runners on public repos.
- Environments: production environment with required reviewers and branch restrictions; secrets
  scoped to the environment, not the repo.
- Secret scanning and push protection on; open secret scanning alerts (count and age; never the
  secret value).
- Dependabot alerts on; open critical/high alerts and their age; code scanning alerts if enabled.
- Deploy keys: list them, flag any with write access and any nobody can explain.
- Collaborators: outside collaborators and their permission; admins count; stale members.
- Organisation: 2FA required for members; base member permission (read, not write/admin);
  who can create public repositories; third-party OAuth app access policy; installed GitHub Apps
  and their permissions.
- Visibility: public repositories that look internal (names, contents, `.env` history). Check git
  history for committed secrets with the code audit, not here.
- Webhooks: URLs over HTTPS, a secret configured.

### Vercel

- Deployment Protection: which method and which scope. Preview deployments and generated
  deployment URLs protected; note whether production is reachable through generated URLs.
- Protection bypass tokens and shareable links that exist and who has them.
- Env vars: which are set for `preview` and `development` that should be production-only (live
  keys on previews mean anyone with a preview link can reach production data); any secret behind a
  client prefix (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, `REACT_APP_`); values flagged sensitive.
  Read names and targets only; the check never prints values.
- Team members and roles; pending invites; members who left the company.
- Domains: every domain and alias points where expected; no domain in the project that the user no
  longer owns; `*.vercel.app` aliases that expose production without protection.
- Git integration: which branches auto-deploy to production; fork PR deploys and whether they get
  env vars.
- Headers in `vercel.json` and the live response (see external checks). Firewall/WAF rules if the
  plan has them. Log drains: destination is the user's own.

### Netlify

- Deploy previews and branch deploys: password or team-only protection where previews carry real
  data.
- Env vars per deploy context: production secrets not present in `deploy-preview` / `branch-deploy`;
  secrets not behind a client prefix; sensitive-variable flag set.
- Build settings: secrets scanning not disabled (`SECRETS_SCAN_ENABLED`, omit keys) without reason.
- Team members and roles; site-level access.
- Headers from `netlify.toml` / `_headers` actually served (external checks).
- Forms and functions: function endpoints that should require auth.

### Cloudflare

- SSL/TLS encryption mode **Full (strict)** for proxied hostnames (Flexible means the hop to the
  origin is plain HTTP). Always Use HTTPS, minimum TLS version 1.2, HSTS.
- Origin exposure: DNS records for the same origin that are **not** proxied (grey cloud), MX/`mail`
  records on the origin IP, and a direct `GET` to the origin IP with the site's `Host` header that
  serves the site. The origin firewall should only accept Cloudflare's IP ranges, or use a tunnel.
- WAF: managed rulesets enabled; custom rules that skip security for broad paths; rate limiting on
  login and API paths.
- Bot protection mode where the plan allows it.
- Access (Zero Trust) in front of admin paths and internal tools (`/admin`, dashboards, staging);
  policies that allow "everyone" or a whole email domain the user does not control.
- API tokens: list them, flag Global API Key use, tokens with account-wide edit, no expiry, no IP
  filter.
- Account members and their roles; 2FA enforcement.
- Workers/Pages: secrets in `vars` (plaintext in `wrangler.jsonc`) instead of secrets; routes on
  admin paths without Access; `*.workers.dev` routes left enabled for a Worker meant to sit behind
  Access.
- DNSSEC status. DNS records are also checked under DNS below.

### Supabase

- RLS enabled on **every** table in exposed schemas (`public` and any schema in the API's exposed
  list); tables with RLS on and **no** policy, or a policy `USING (true)` for `anon`; `FORCE ROW
  LEVEL SECURITY` where the owner role is used by code. Read from the catalog (`pg_class.relrowsecurity`,
  `pg_policies`), never by querying data with the anon key.
- Views and functions in exposed schemas: views without `security_invoker`, `SECURITY DEFINER`
  functions callable by `anon` / `authenticated`.
- Service role / secret key: not in any client bundle or `NEXT_PUBLIC_*` (code side), not in
  preview environments.
- Storage buckets: public buckets that hold private files; bucket policies.
- Auth: email confirmation, leaked-password protection, MFA availability, redirect URL allowlist
  without wildcards on foreign domains, rate limits, JWT expiry.
- Network: network restrictions (allowed IPs) on direct database access; SSL enforcement on.
- The project's Security Advisor output (export it; it is the vendor's own list).
- Backups and PITR enabled for production; project members and roles.

### Neon

- IP Allow list on production (plan permitting); protected branches for production.
- Roles: the app does not connect as the owner role used for migrations; a separate migration role.
- Connection strings use `sslmode=require` (or `verify-full`); `channel_binding` where supported.
- Preview branches created from production carry production data (PII in previews); who can read
  them.
- API keys: org vs project scope, owner, expiry. Organisation members.
- Restore window (history retention) matches the user's RPO.
- Engine checks: see PostgreSQL.

### PostgreSQL (engine, any host)

- Reachability: does the port answer from the internet (external check)? `listen_addresses`.
- `pg_hba.conf` / `pg_hba_file_rules`: no `trust`, no `password` (plain), `scram-sha-256` only,
  `hostssl` for remote, no `0.0.0.0/0` for superusers.
- `ssl = on`, `password_encryption = scram-sha-256`, minimum TLS version.
- Roles: which role the app uses (from env names and config, confirmed by the user); that role is
  not superuser, not `CREATEROLE`/`CREATEDB`, not the owner of the tables unless that is the design;
  roles with `rolcanlogin` and no password expiry; default or well-known role names with default
  passwords (`postgres` role reachable remotely).
- Privileges on `public` schema (`CREATE` revoked from `PUBLIC`); `pg_read_server_files`,
  `pg_execute_server_program` granted to nobody unexpected.
- RLS where the design expects it (multi-tenant tables): enabled and forced.
- Extensions installed (`pg_available_extensions` vs installed); untrusted languages.
- Logging: `log_connections`, failed auth visible somewhere.
- Backups and PITR: WAL archiving configured or the provider's PITR on; last successful backup
  time; a restore test exists (see Backups).
- Version supported and patched.

### MySQL / MariaDB / PlanetScale

- Port reachable from the internet (external check); `bind_address`.
- `require_secure_transport = ON`; TLS version; auth plugin `caching_sha2_password` (no
  `mysql_native_password` accounts left).
- Accounts: no `root@'%'`, no anonymous users, no accounts without password, app user without
  `SUPER`/`GRANT OPTION`/`FILE`/`ALL ON *.*`.
- `local_infile` off; `secure_file_priv` set.
- PlanetScale: production branch has safe migrations / deploy requests on; service tokens and their
  permissions; passwords per branch with role (reader/writer/admin) and expiry; IP restrictions.
- Backups and binlog retention for PITR.

### MongoDB (Atlas or self-hosted)

- Self-hosted: `security.authorization: enabled`; `net.bindIp` not `0.0.0.0` with port open to the
  internet; TLS on.
- Atlas: Network Access list without `0.0.0.0/0`; database users with least role (no
  `atlasAdmin`/`readWriteAnyDatabase` for the app); project/org members; API keys and their access
  lists; auditing if the tier has it; backups/continuous cloud backup on production.

### Redis / Valkey

- Port answers from the internet (external check: a TCP connect only; never send commands to an
  unknown host).
- `requirepass` or ACL users set; `default` user disabled or with a password; `protected-mode yes`;
  `bind` not public.
- Dangerous commands (`CONFIG`, `FLUSHALL`, `DEBUG`, `MODULE`) unavailable to the app user.
- TLS (`rediss://`) when traffic leaves a private network.
- Managed (Upstash, Redis Cloud, provider-managed): TLS required, IP allowlist, read-only token for
  clients that only read.

### Turso / SQLite

- Database auth tokens: app tokens scoped to one database, read-only where the client only reads,
  with expiry; group tokens avoided.
- Platform API tokens and organisation members.
- SQLite files: no `*.db`/`*.sqlite` with real data committed or served from a public folder
  (external `GET` on the known path).

### Firebase

- Firestore and Storage rules (the repo files **and** the deployed version, which can differ):
  no `allow read, write: if true`, no `if request.auth != null` as the only condition on user data,
  no expired test-mode date rules.
- Realtime Database rules if used.
- App Check enforcement on Firestore, Storage, Functions where the client is public.
- Auth: authorised domains list; providers enabled but unused; email enumeration protection.
- Cloud Functions callable or HTTP functions without auth checks (code side) and their invoker
  setting (`allUsers`).
- Project IAM members (see Google Cloud); service account keys downloaded.
- API key restrictions (browser keys restricted by HTTP referrer and API).

### AWS

- Root user: MFA on, no access keys, not used recently.
- IAM: users with access keys older than 90 days or unused; users without MFA; policies with
  `"Action": "*"` / `"Resource": "*"` on workloads; roles trusted by `*` or by a broad GitHub OIDC
  `sub`.
- S3: Block Public Access on at account and bucket level; bucket policies granting `Principal: *`;
  ACLs; default encryption; buckets served through CloudFront with OAC instead of public.
- RDS: `PubliclyAccessible` false; encryption at rest; automated backups and retention; deletion
  protection; security groups.
- Security groups: `0.0.0.0/0` / `::/0` on 22, 3389, database ports.
- CloudTrail on in all regions, logs protected; GuardDuty or Security Hub findings if enabled
  (export, don't re-judge).
- Secrets Manager / SSM for app secrets, not plaintext Lambda/ECS env.

### Google Cloud

- IAM: primitive roles (`owner`, `editor`) on humans or workloads; default compute service account
  used by workloads; user-managed service account keys (age, unused); external members.
- Cloud Run: services with `allUsers` as invoker that should be private; ingress settings.
- Cloud Storage: `allUsers`/`allAuthenticatedUsers` bindings; uniform bucket-level access; public
  access prevention.
- Cloud SQL: public IP with authorised networks `0.0.0.0/0`; SSL required; backups and PITR;
  deletion protection.
- Firewall rules open to `0.0.0.0/0` on admin and database ports.
- Audit logs enabled; Security Command Center findings if enabled.
- Workload Identity Federation for CI instead of keys; its attribute condition limited to the repo.

### DigitalOcean

- Droplets: Cloud Firewall attached; SSH and database ports not open to the world; host checks under
  VPS host below.
- Managed databases: Trusted Sources set (not empty, which means open); SSL required; backups.
- App Platform: env vars with secrets typed `SECRET`; build-time vs run-time scope.
- Spaces: bucket and file ACLs not public unless intended; CDN.
- API tokens: scopes, expiry, unused tokens. Team members and roles; 2FA.

### Hetzner

- Cloud Firewall exists **and is applied** to every server (a firewall attached to nothing protects
  nothing); inbound rules: 22 from known IPs only (or via VPN/tunnel), 80/443 public, nothing else
  public; database ports never public.
- Servers: backups enabled or snapshots on a schedule; protection against delete/rebuild on
  production; Private Networks used for internal traffic; Primary IPs.
- API tokens: one per purpose, read-only where possible, unused ones; project members and roles.
- Host-level checks: VPS host below.

### VPS host (Hetzner, DigitalOcean, any Linux server, Coolify hosts)

Read over SSH with a dedicated non-sudo user, or from output the user sends:

- `sshd` effective config: `PermitRootLogin no` (or `prohibit-password` as a deliberate choice),
  `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PubkeyAuthentication yes`;
  `AllowUsers`/`AllowGroups` if used.
- Authorised keys: list key comments and fingerprints per user; keys nobody can name.
- Host firewall (ufw/nftables) active as the second layer; listening sockets (`ss -tln`) vs what
  should listen; services bound to `0.0.0.0` that should be `127.0.0.1`.
- Docker publishing ports bypasses ufw: any `ports:` in compose without `127.0.0.1:` is public even
  with ufw on.
- Unattended security upgrades enabled; pending security updates; reboot required; OS release still
  supported.
- fail2ban or equivalent on SSH if SSH is public.
- Time sync; disk not full (a full disk stops logs and backups).

### Railway / Render / Fly.io

- Railway: services that need no public domain have none; databases reachable only on the private
  network (no TCP proxy unless needed); variables with secrets not inlined in `railway.json`;
  project members and roles; tokens (account vs project) and their owners; backups for databases
  and volumes.
- Render: services that should be private are Private Services, not Web Services; databases with
  an access control list (no `0.0.0.0/0` external connections unless needed); secrets as `sync:
  false` / `generateValue`, not literal `value:` in `render.yaml`; free Postgres expiry; team
  members; API keys.
- Fly.io: `[http_service]`/`[[services]]` exposing only what should be public; internal apps on
  Flycast/6PN without public IPs (`fly ips list`); secrets via `fly secrets`, none in `[env]` or
  the image; volumes have snapshots and retention; organisation members; deploy tokens scoped to one
  app.

### Coolify

- Panel on port 8000 and realtime 6001/6002 not reachable from the internet (external check); the
  panel behind its own domain with TLS, ideally behind Access/VPN.
- First admin claimed; registration disabled; 2FA on admin accounts; team members.
- API tokens and their permissions; unused tokens.
- Databases: not publicly exposed (the "make it publicly available" toggle off) unless needed;
  backups scheduled to S3-compatible storage off the box; a restore was tested.
- Env vars marked as secrets; build vs runtime.
- Host-level: VPS host and Docker host checks.

### Docker host

- Docker API not exposed on TCP (2375/2376) without mTLS; Docker socket not mounted into app
  containers (except deliberate, audited tools).
- Containers: running as root, `--privileged`, added capabilities, host network/PID, writable root
  filesystem where avoidable; images pinned by tag or digest, not `latest`, and not end-of-life.
- Secrets in `docker inspect` env of images (baked via `ENV`/`ARG`): names only in the evidence.
- Published ports (see VPS host about ufw bypass).

### DNS and domains

All public, no credential needed for the reads:

- Email: SPF present and ending in `-all` or `~all` (one record, under 10 lookups); DKIM for each
  sending service; DMARC with `p=quarantine` or `p=reject` once reports are clean (a `p=none`
  forever is a finding of low severity); domains that send no mail have `v=spf1 -all` and a reject
  DMARC.
- CAA records restricting issuance to the CAs in use.
- Dangling records (subdomain takeover): `CNAME` to a provider target that no longer exists
  (deleted app, bucket, Pages project, Heroku/Netlify/Vercel/GitHub Pages/Azure/S3 hostnames that
  answer "not found" or "no such app"), `A` records to IPs the user no longer owns, `NS` delegations
  to zones that do not exist. Detect by resolving and by a single `GET` to the hostname; never
  claim the resource to prove it.
- DNSSEC status; registrar lock on the domain; domain and certificate expiry dates.
- Wildcard records that route unknown subdomains to an app.
- Registrar and DNS provider accounts: 2FA (manual question, usually no API).

### Stripe

- Secret keys: live secret keys (`sk_live_`) only in the server environment; restricted keys
  (`rk_`) for anything that does not need full access; no secret key in a client bundle, public
  repo or preview environment (code side and env var targets).
- Webhooks: every endpoint uses HTTPS; the handler verifies the signature with the endpoint's
  signing secret on the raw body (code side); unused endpoints; events subscribed are the ones the
  code handles.
- Account: team members and roles; 2FA required; API key list with last-used dates; IP restrictions
  on keys where offered.
- Never create charges, customers or test events on a live account to "test" anything.

### Backups (cross-cutting)

For each datastore found above: a backup exists, is recent (last success time), lives off the
primary (other account, region or provider), is immutable or versioned, and a restore was tested
(date). No restore test on record is a finding; the audit does not run a restore on production.

### Monitoring (cross-cutting)

An external uptime probe on the main URL; TLS expiry alert; alerts reach a person; logs of
authentication failures kept somewhere. Missing alerting is a finding when another finding's
impact depends on someone noticing.

## (c) Access: read-only, least privilege, short-lived

For each confirmed platform, the order is fixed:

1. **No credential needed?** DNS, TLS, headers, open ports and repo files need none. Do these first.
2. **A read-only credential exists?** Use it. Scope it to the one project, team or zone; set the
   shortest expiry the vendor allows (one to seven days covers an audit).
3. **Only read-write exists?** Say so plainly, with the docs link. Offer, in this order: the
   narrowest scope the vendor has (one project, one team) with the shortest expiry, revoked right
   after the audit, and the check script's own read-only guard (below) as the second lock; or the
   user exports the configuration themselves and hands over the file; or manual steps (section d).
   The user chooses.
4. **No API at all?** Manual steps (section d).

What to ask for, per platform. These are starting points to look up, not settings to trust:
confirm the current screen and scope names in the vendor's docs before telling the user.

| Platform | Read-only route to look for | Where to look in the docs |
|---|---|---|
| GitHub | Fine-grained personal access token, one repo (or the org), read-only permissions: Metadata, Administration, Secret scanning alerts, Dependabot alerts, Code scanning alerts, Actions, Environments, Webhooks; org: Members, Administration (read). Short expiry. Org settings may need an org owner to approve the token. | GitHub Docs: fine-grained PATs, "permissions required for fine-grained PATs" |
| Vercel | Access tokens are scoped to a team with an expiry; check whether a read-only scope exists today. If not: team-scoped, shortest expiry, revoked after. | Vercel Docs: access tokens, REST API |
| Netlify | Personal access tokens with expiry; usually full access. Same fallback as Vercel. | Netlify Docs: API authentication |
| Cloudflare | API token from a custom template, **read** permissions only (zone settings, DNS, WAF/firewall, SSL, Access apps and policies, account members, API tokens read), limited to the zones in scope, with TTL and client IP filtering. Never the Global API Key. | Cloudflare Docs: create API token, API token permissions |
| Supabase | A database role for catalog reads (below) plus the Management API if a read-only scope exists; otherwise the user exports the Security Advisor and settings. | Supabase Docs: Management API, database roles |
| Neon | Database read role (below); API key scoped to the project if offered, else user export. | Neon Docs: API keys, roles |
| PostgreSQL (any) | A dedicated login role: `NOSUPERUSER NOCREATEDB NOCREATEROLE`, `default_transaction_read_only = on`, member of `pg_read_all_settings` and `pg_monitor`, `CONNECT` on the database, `USAGE` on schemas; no data `SELECT` needed for these checks. `pg_hba_file_rules` may need more; if so the user sends the file. Over TLS, from the user's machine or a private network. The `connect-tool` write-refused test proves it. | PostgreSQL docs: predefined roles, `pg_hba_file_rules` |
| MySQL / MariaDB | A user with `PROCESS` (if needed) and `SELECT` on `mysql.user` columns needed for account checks, or the user runs `SHOW GRANTS` / `SHOW VARIABLES` and sends output. | MySQL docs: privileges provided |
| PlanetScale | Service token with read permissions only on the one database. | PlanetScale docs: service tokens |
| MongoDB Atlas | API key or service account with Project Read Only / Organization Read Only, with an access list. | Atlas docs: programmatic access, roles |
| Redis | Managed: the console's read view or a read-only API token. Self-hosted: the user runs `CONFIG GET` for named keys and sends output (an ACL user for `CONFIG GET` is effectively admin). | Vendor / Redis ACL docs |
| Turso | Platform API token for org reads if available read-only; otherwise user export. | Turso docs: platform API |
| Firebase / Google Cloud | The user's own `gcloud auth login` session with a role limited to review (`roles/iam.securityReviewer`, `roles/viewer` or narrower predefined viewer roles), or a short-lived impersonation of a reviewer service account. Never a downloaded service account key. | Google Cloud IAM docs: roles, short-lived credentials |
| AWS | A role or Identity Center permission set with the `SecurityAudit` managed policy (plus `ViewOnlyAccess` if needed), temporary credentials from SSO, 1–12 hours. Never IAM user access keys. | AWS docs: job-function policies, IAM Identity Center |
| DigitalOcean | Custom-scoped API token with read scopes only and an expiry. | DigitalOcean docs: API token scopes |
| Hetzner Cloud | Project API token with **Read** permission (not Read & Write). | Hetzner Docs: API tokens |
| VPS host | A dedicated user with an SSH key the user adds, no sudo; for the few reads that need root (`sshd -T`, firewall status), a sudoers line allowing **only those exact commands**, or the user runs them and sends output. Removed after the audit. | The OS's sudoers and sshd docs |
| Railway / Render | Tokens are usually full-access; team/project-scoped where offered, shortest life, revoked after; or user export. | Vendor API docs |
| Fly.io | A read-only or app-scoped token if `fly tokens` offers one today; else org-scoped deploy token is too broad, prefer user export. | Fly docs: access tokens |
| Coolify | API token with read-only permission, if the version offers it. | Coolify docs: API authorization |
| Docker host | Docker socket access equals root: no read-only form. The user runs `docker ps`, `docker inspect` (filtered) and sends output, or the read happens over the VPS read user with a sudoers line for exactly those commands. | Docker docs: daemon attack surface |
| DNS / domains | None needed for records. Registrar and DNS provider settings: manual. | — |
| Stripe | Restricted key (`rk_…`) with **Read** on the resources checked (webhook endpoints, account) and None on the rest, test mode first to prove the script. | Stripe docs: restricted API keys |

**Handing it over.** Follow `secrets-discipline.md`. In short:

1. The user stores the credential in the OS keychain or their secret manager, typing it into a
   hidden prompt in their own terminal (macOS `security add-generic-password … -w`, Linux
   `secret-tool store`, `pass insert`).
2. The check reads it from there at run time, or receives it on stdin from a subshell that read it
   from there. Never an `export` in the agent's shell: every child process (the project's test
   suite, package scripts, hooks) would inherit it.
3. Only if the platform's own tooling needs a file: `01-TOOLS/security/<platform>/.env`,
   `chmod 600`, filled by the user in their editor, after `git check-ignore -q` has confirmed the
   path is ignored. If git does not report it ignored, stop until it is.

Never accept a token pasted in the chat, even if the user insists: the value is now in the
transcript. Ask them to revoke it and create a fresh one through step 1.
At the end of the audit, list every credential created, with where to revoke it, under
`user_actions` ("Revoke the audit token in GitHub: Settings > Developer settings > …").

**Prove it is read-only.** Before the first real check, the test proves the credential cannot write,
following `connect-tool`: list the token's scopes from the vendor's token endpoint and fail if a write
scope is present; for a database role, a write inside a rolled-back transaction must fail with a
permission or read-only error. Never fire a real write to see what happens. When the vendor has no
read-only credential, the test proves the next best thing: the script's own guard refuses writes.

## (d) No access at all

When there is no API, the user cannot or will not grant access, or the credential needs an org owner
who is not available:

1. Write manual steps for the user, one platform at a time, in the user's language and technical
   level. Each step has: where to click (menu path as the vendor docs name it today, with the docs
   link and date), what setting to look at, **what a good value looks like and what a bad one looks
   like**, and what to send back (a screenshot of that panel, a copied value, an exported JSON).
   Example:

   > 1. Open GitHub, your repository, then **Settings > Branches** (or **Rules > Rulesets**).
   > 2. Look for a rule that covers `main`.
   > 3. Good: the rule exists and "Require a pull request before merging" is ticked with at least 1
   >    approval. Bad: no rule, or the rule exists but the tick is off.
   > 4. Send me a screenshot of the rule page. Hide nothing: there are no secrets on this page.

   Warn the user when a screen **does** show secrets, and tell them what to cover before sending.
2. The steps go in the finding's `manual_steps[]` (when a suspected issue is known) or in
   `user_actions[]` (when it is a whole platform to review).
3. The platform is recorded `status: not_reviewed`, `access: none`, with `reason` saying exactly
   why ("Vercel offers no read-only token; user declined a full-access token"). The report shows it
   as not reviewed. **Never** as passed.
4. If the user sends the answers back, the agent stores them only in the audit directory
   (`evidence/<platform>-user/`, redacted like any evidence), never in `01-TOOLS/`, and runs the
   check against them offline (`check --fixture <audit-dir>/evidence/<platform>-user`), so the
   result still comes from code. The platform becomes `reviewed`, `access: none`, and the evidence
   says the input was supplied by the user.

## (e) From check output to findings

Each run of a check script writes its JSON to the audit dir, for example
`<audit-dir>/evidence/platform/<platform>/check-<YYYYMMDD-HHMM>.json`, already redacted by the
script (no tokens, no secret values, no personal data beyond account emails the user agrees to keep).

- Every check with `status: fail` becomes a finding (or joins one: the same failed check on five
  servers is one finding with five locations).
  - `surface: platform`, `platform: <name>` exactly as in `platforms[]`.
  - `verdict: confirmed` when the failed check read the live setting; `needs_validation` when the
    value came from the repo or a user screenshot and could differ live, or when a mitigation may
    exist outside what was read (say which in `missing_evidence`).
  - `locations[]`: `{resource: ...}` naming the resource (`github:org/repo#branch:main`, `hetzner:server/app-01`,
    `cloudflare:zone/example.com/ssl`, `dns:old.example.com CNAME`).
  - `evidence[]`: `{kind: "command_output", path: "evidence/platform/<platform>/check-<timestamp>.json" (relative to the audit dir), summary: "<check id>
    observed X, expected Y"}`. Add the docs page as a second evidence item when the expected value
    comes from it.
  - `principal`: who can exploit it (anyone on the internet, any org member, the author of a fork
    PR, anyone with a preview link). `boundary`: the line it crosses (internet to database,
    preview to production data, fork to repo secrets). `impact`: what that person gets, in one
    sentence.
  - `severity`: by principal and impact, not by the check's name. An open port 5432 with
    `scram-sha-256` and a strong password is lower than the same port with `trust`.
  - `fix.proposal`: the setting change, in words; `fix.recheck.command`: the exact command that
    re-runs this check (`01-TOOLS/security/<platform>/check --only <check-id>`).
- `status: unknown` (permission missing, API error) never becomes a pass. It becomes a
  `needs_validation` finding when there is reason to suspect a problem, or a note under the
  platform's `reason`.
- A check the agent looked at and decided is fine despite failing (the setting is intended and
  compensated) is a finding with `verdict: rejected` and `rejection_reason`, so the decision is on
  record.
- The platform entry: `status: reviewed`, `access: read_only`, `tool_path:
  01-TOOLS/security/<platform>/`.

Run `scripts/validate-findings.mjs <audit-dir>` after adding platform findings.

## Writing the check script

Platform checks are code. The model decides **what** to check from the vendor docs; the script
decides **pass or fail**. The same script re-run after a fix is the proof the fix worked. Built
fresh in each project, following the `connect-tool` method: research the vendor's real docs first,
pick the least dangerous route, least-privilege credential, prove it with a test.

### Layout

```
01-TOOLS/security/<platform>/
  README.md        what it checks, the route, the credential, sources (URL + date read)
  CREDENTIALS.md   which credential, where to create it, scope, expiry, how to revoke
  .env.example     variable names only
  check            the read-only check (check.sh / check.mjs / check.py: the project's language,
                   or bash + curl + jq, or Node with no dependencies)
  test             proves the check (test.sh / test.mjs / test.py)
  fixtures/        synthetic responses: pass/ and fail/ per check (see "test: rules")
```

`<platform>` is lowercase (`github`, `vercel`, `cloudflare`, `hetzner`, `postgres`, `dns`,
`vps-<host>`). Add a row to `01-TOOLS/README.md`. Any `.env` under `01-TOOLS/security/` is
gitignored before it exists: add the rule, then confirm with `git check-ignore -q <path>` before
anything is written to it.

`01-TOOLS/` is committed, and rsc's knowledge sync pushes it to git. Nothing in this folder may
describe the live platform: no recorded response, no real identifier, IP, hostname or secret. Live
output goes only to the gitignored audit directory, as evidence.

### README.md

- What the script checks: a table `check id → setting → expected value → why → vendor docs URL`.
- The route (API, CLI, SQL, SSH reads, public DNS/HTTP) and why it is the least dangerous one.
- Sources: every vendor page used, with URL and the date read. If older than 60 days at the next
  audit, re-read them before running (vendors move settings).
- What the script cannot see, so nobody reads a pass as more than it is.

### check: rules

- **Only read requests.** The script declares its allowlist at the top and refuses everything else
  with exit code 3 before sending anything:
  - HTTP: `GET` and `HEAD` only (and `OPTIONS` for the CORS check). A GraphQL endpoint is allowed
    only for documents that start with `query` and contain no `mutation`. All requests go through
    one helper that enforces this; no other code path makes network calls.
  - CLI: only named read subcommands, listed in the script (for example `gh api --method GET`,
    `hcloud firewall list`, `hcloud firewall describe`, `hcloud server list`, `doctl compute
    firewall list`, `aws … describe-*` / `get-*` / `list-*`, `gcloud … list` / `describe` /
    `get-iam-policy`). Anything else: refuse.
  - SQL: connect with the read-only session flag (`PGOPTIONS='-c default_transaction_read_only=on'`
    for Postgres, `SET SESSION TRANSACTION READ ONLY` for MySQL), and send only fixed `SELECT` /
    `SHOW` statements written in the script; no statement built from input.
  - SSH: a fixed list of read commands (`sshd -T`, `ss -tln`, `ufw status verbose`, `cat` of named
    config files, `apt list --upgradable`); no shell built from input.
  - External checks: the target list comes from the confirmed asset list; rate-limited; TCP connect
    only for ports.
- **Output JSON on stdout**, one document:

  ```json
  {
    "platform": "github",
    "target": "org/repo",
    "checked_at": "2026-11-09T10:12:00Z",
    "script_version": "1",
    "checks": [
      {"id": "branch-protection-default", "title": "Default branch requires PR review",
       "status": "fail", "observed": "no rule on main", "expected": "PR + 1 approval",
       "resource": "github:org/repo#branch:main", "doc_url": "https://…"}
    ],
    "errors": []
  }
  ```

  `status` is `pass`, `fail`, `unknown` or `not_applicable`. Logs go to stderr.
- **Exit codes**: `0` every check passed or not applicable; `1` at least one fail; `2` could not
  check (auth, network, missing permission: those checks are `unknown`); `3` refused a request
  outside the allowlist.
- **Never prints secrets.** Values of env vars, keys, connection strings and tokens are never
  read into output; the script reports names, flags, scopes and timestamps. A final redaction pass
  masks anything that looks like a credential (`ghp_`, `github_pat_`, `sk_live_`, `rk_live_`,
  `whsec_`, `sb_secret_`, `AKIA`, JWTs, `://user:pass@`) before writing.
- `--only <check-id>` re-runs one check (used for rechecks); `--fixture <dir>` reads responses from
  files instead of the network (used by the test and for user-supplied exports).
- Idempotent and safe to run any number of times.

### test: rules

The test runs offline by default and must:

1. Run every check against `fixtures/pass/` and assert `pass`, and against `fixtures/fail/` and
   assert `fail` with the right `observed` value. A check with no failing fixture is not proven.
2. Call the request helper with a write (`DELETE`, `POST`, `PUT`, `PATCH`, a GraphQL `mutation`, a
   non-listed CLI subcommand, an `UPDATE` statement) and assert exit `3` and that nothing was sent.
3. Assert the output of a run over fixtures that contain fake secrets has none of them.
4. With `--live`, prove the credential is read-only (scope listing, or the rolled-back write that
   must fail with a permission error, as in `connect-tool`) and make one cheap read.

Fixtures are **synthetic**: written by hand from the response shape the vendor documents, with
made-up values (`example-org`, `203.0.113.10`, `app.example.com`, fake tokens). Never a recorded live
response, never a real identifier, IP, hostname or secret, because `01-TOOLS/` is committed and
synced. The failing fixture is the passing one with only the setting under test changed, so the
test shows the check reacts to that setting and nothing else.

### Re-running after a fix

The fix loop (`fixing.md`) re-runs `check --only <check-id>` against the live platform. A pass is
saved next to the original output and becomes the finding's `fix.recheck.artifact`. The scripts stay
in the project: running them again next month is how the user finds out a setting drifted back.
