---
name: gcp-essentials
description: "Use when running a small product on core Google Cloud via the gcloud CLI: a project, Cloud Run deploys, a locked-down Cloud Storage bucket, managed Cloud SQL, and least-privilege IAM wiring them together. NOT AWS (that is `aws-essentials`), NOT the CI pipeline that ships the image (that is `deployment`), NOT Postgres schema/query tuning (that is `postgresdb`)."
tags: [gcp, cloud-run, cloud-sql, cloud-storage, iam, gcloud, serverless, devops]
recommends: [aws-essentials, docker, github-actions, secure-coding, postgresdb, deployment, monitoring, backups]
origin: risco
---

# GCP essentials

Get a small product running on the core of Google Cloud — safely and cheaply — with
the `gcloud` CLI as the source of truth. The console is fine for reading; the CLI is
what you commit, review, and reproduce. Bias toward **secure-by-default and near-zero
bill**, not "every GCP service".

Four primitives carry most products, plus the project/billing scaffold under them:

- **IAM** — who can do what. Get this wrong and nothing else matters.
- **Cloud Run** — serverless containers, scale to zero.
- **Cloud Storage** — object storage (buckets).
- **Cloud SQL** — managed Postgres/MySQL.

Out of scope, route elsewhere: AWS -> [`../aws-essentials/SKILL.md`](../aws-essentials/SKILL.md).
Building/shipping the image itself -> [`../docker/SKILL.md`](../docker/SKILL.md)
/ [`../github-actions/SKILL.md`](../github-actions/SKILL.md) / [`../deployment/SKILL.md`](../deployment/SKILL.md).
Postgres schema/index/query tuning -> [`../postgresdb/SKILL.md`](../postgresdb/SKILL.md).
App-level injection/secret-handling review -> [`../secure-coding/SKILL.md`](../secure-coding/SKILL.md).
Logging/alerting/SLOs as a practice -> [`../monitoring/SKILL.md`](../monitoring/SKILL.md).
Backup strategy as a discipline -> [`../backups/SKILL.md`](../backups/SKILL.md).
One-click PaaS where you never touch IAM/VPC -> [`../vercel/SKILL.md`](../vercel/SKILL.md)
/ [`../railway/SKILL.md`](../railway/SKILL.md) / [`../render/SKILL.md`](../render/SKILL.md)
/ [`../fly-io/SKILL.md`](../fly-io/SKILL.md).

## 0. Bootstrap a project

One project per environment (e.g. `acme-prod`, `acme-staging`). Projects are the IAM
and billing boundary; mixing prod and dev in one project is how a staging credential
deletes prod data.

```bash
# Create the project and point gcloud at it
gcloud projects create acme-prod --name="Acme prod"
gcloud config set project acme-prod
gcloud config set run/region europe-west1   # set once; every run command inherits it

# Link billing (no billing = APIs 403). Find your account id first:
gcloud billing accounts list
gcloud billing projects link acme-prod --billing-account=0X0X0X-0X0X0X-0X0X0X

# Enable ONLY the APIs this product needs. Why: every enabled API widens the
# attack surface and some bill the moment they are on.
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com
```

## 1. IAM without footguns

A binding is `member + role` on a resource. Members come in three flavours you will
actually type:

| Member type      | Syntax                              | Use for                          |
|------------------|-------------------------------------|----------------------------------|
| User             | `user:alice@acme.com`               | a human                          |
| Group            | `group:eng@acme.com`                | a team (manage in Workspace)     |
| Service account  | `serviceAccount:NAME@PROJ.iam.gserviceaccount.com` | a workload identity |

Grant grammar — bind at the smallest resource that works (project here, but prefer
bucket/instance scope when the role supports it):

```bash
gcloud projects add-iam-policy-binding acme-prod \
  --member="serviceAccount:api@acme-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

Choosing a role:

| Role kind      | Example                       | When                                                        |
|----------------|-------------------------------|-------------------------------------------------------------|
| Primitive      | `roles/owner`, `roles/editor` | Almost never on a workload — project-wide, far too broad.   |
| **Predefined** | `roles/storage.objectAdmin`   | **Default.** Google-maintained, scoped to one service.      |
| Custom         | your own permission list      | Only when no predefined role fits — you now own the upkeep. |

Two hard rules, each with teeth:

1. **Never run a workload as the default compute service account.** It carries
   `Editor` on the whole project, so a single RCE in your container = full project
   takeover. Mint a dedicated SA per service and pass it explicitly (see Cloud Run).
   ```bash
   gcloud iam service-accounts create api-sa --display-name="api runtime"
   ```
2. **Never create service-account JSON keys.** A leaked key is a long-lived,
   un-rotated credential. Use the *attached* SA on Cloud Run/Compute, and Workload
   Identity Federation for external/CI auth (GitHub Actions). If `... keys create` is
   in your runbook, the runbook is wrong.

The predefined-role catalog, WIF for keyless CI, SA impersonation, IAM Recommender and
Conditions live in [`references/iam-and-auth.md`](references/iam-and-auth.md).

## 2. Cloud Run

Minimal *safe* deploy: dedicated runtime SA, explicit region, no anonymous ingress.

```bash
gcloud run deploy api \
  --image=europe-west1-docker.pkg.dev/acme-prod/app/api:1.4.0 \
  --region=europe-west1 \
  --service-account=api-sa@acme-prod.iam.gserviceaccount.com \
  --no-allow-unauthenticated
```

- `--service-account` sets the runtime identity. Omit it and the revision runs as the
  over-privileged default compute SA — the rule-1 footgun. Always pass it.
- `--no-allow-unauthenticated` keeps the service private (callers need
  `roles/run.invoker`). Flip to `--allow-unauthenticated` *only* for a genuinely public
  endpoint. Open by accident and you have shipped an unauthenticated API.

Production knobs:

```bash
# Cold starts hurt: pin a warm instance and boost CPU on startup.
# Default min-instances is 0 (scales to zero); default max is 100 (your cost ceiling).
gcloud run services update api --region=europe-west1 \
  --min-instances=1 --cpu-boost --max-instances=20
```

Config vs secrets — **secrets never go in `--set-env-vars`**, because env vars show up
in plaintext in `describe`, logs and the console. Mount them from Secret Manager:

```bash
gcloud run deploy api --region=europe-west1 \
  --service-account=api-sa@acme-prod.iam.gserviceaccount.com \
  --set-env-vars="LOG_LEVEL=info" \
  --set-secrets="DB_PASSWORD=db-password:latest"
```

## 3. Cloud Storage

Create buckets locked down; loosen deliberately, never the reverse.

```bash
gcloud storage buckets create gs://acme-prod-uploads \
  --location=europe-west1 \
  --uniform-bucket-level-access \
  --public-access-prevention
```

- `--uniform-bucket-level-access` (UBLA) turns off per-object ACLs so access is *only*
  IAM — one place to reason about, one place to audit. There is a 90-day window to
  revert UBLA; after that it is permanent, so set it at creation.
- `--public-access-prevention` makes a public grant impossible even by mistake.

Grant access to the workload, not the world:

```bash
gcloud storage buckets add-iam-policy-binding gs://acme-prod-uploads \
  --member="serviceAccount:api-sa@acme-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Need to hand a file to an anonymous browser? Use a **signed URL** (time-limited),
never `allUsers`:

```bash
gcloud storage sign-url gs://acme-prod-uploads/report.pdf --duration=15m \
  --impersonate-service-account=api-sa@acme-prod.iam.gserviceaccount.com
```

`--impersonate-service-account` is not decoration. Signing needs a private key, and the
keyless model this skill mandates (attached SA, no JSON keys) hands you an ADC *token*,
not a key. The flag tells gcloud to sign via the IAM `signBlob` API instead — so the
caller must hold `roles/iam.serviceAccountTokenCreator` (which grants
`iam.serviceAccounts.signBlob`) **on `api-sa`**. Without it, the command fails or
silently wants a key file, which would reopen the rule-2 footgun. Grant it once:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  api-sa@acme-prod.iam.gserviceaccount.com \
  --member="serviceAccount:api-sa@acme-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Durability one-liners:

```bash
gcloud storage buckets update gs://acme-prod-uploads --versioning      # keep old versions
gcloud storage buckets update gs://acme-prod-uploads \
  --lifecycle-file=lifecycle.json                                      # auto-expire/age out
```

## 4. Cloud SQL

Create a managed Postgres with a private IP and **no** public IP — the public IP is
the part that gets scanned and brute-forced.

```bash
gcloud sql instances create acme-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --region=europe-west1 \
  --tier=db-f1-micro \
  --no-assign-ip \
  --network=projects/acme-prod/global/networks/default
```

`--edition=ENTERPRISE` is **mandatory** here, not optional. From POSTGRES_16 up the
default edition is Enterprise *Plus*, which only runs on N2/C4A/N4 machine series — the
shared-core `db-f1-micro` is an Enterprise-only tier, so the create **fails** without
this flag. Want the cheapest box? Stay on Enterprise. Reach for Enterprise Plus only
when you actually need its dedicated cores and faster failover, and drop `--tier` for a
`--cpu`/`--memory` pair then.

Put the password in Secret Manager, not in a flag or a file:

```bash
gcloud sql users create app --instance=acme-db --password="$(openssl rand -base64 24)"
printf '%s' "$(openssl rand -base64 24)" | \
  gcloud secrets create db-password --data-file=-
```

Attach the instance to Cloud Run — serverless connects over a Unix socket, **no Auth
Proxy sidecar needed**:

```bash
gcloud run deploy api --region=europe-west1 \
  --service-account=api-sa@acme-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=acme-prod:europe-west1:acme-db \
  --set-secrets="DB_PASSWORD=db-password:latest"
# In the app, connect via the socket:
#   host=/cloudsql/acme-prod:europe-west1:acme-db
```

The Cloud SQL **Auth Proxy** (short-lived certs, TLS 1.3) is for connecting from
*outside* — local dev or a non-serverless host — not for Cloud Run. Direct VPC egress vs
legacy connectors, private IP / PSC, proxy invocation and pooling are in
[`references/networking-and-sql.md`](references/networking-and-sql.md).

## 5. Wire it together

One service, one dedicated SA, exactly the roles it needs — and nothing else.

```bash
# Identity
gcloud iam service-accounts create api-sa --display-name="api runtime"
SA=api-sa@acme-prod.iam.gserviceaccount.com

# Exactly four predefined roles. No Editor, no Owner.
gcloud projects add-iam-policy-binding acme-prod \
  --member="serviceAccount:$SA" --role="roles/cloudsql.client"
gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud storage buckets add-iam-policy-binding gs://acme-prod-uploads \
  --member="serviceAccount:$SA" --role="roles/storage.objectAdmin"

# Deploy with all three wired in
gcloud run deploy api --region=europe-west1 \
  --image=europe-west1-docker.pkg.dev/acme-prod/app/api:1.4.0 \
  --service-account="$SA" \
  --no-allow-unauthenticated \
  --add-cloudsql-instances=acme-prod:europe-west1:acme-db \
  --set-secrets="DB_PASSWORD=db-password:latest" \
  --set-env-vars="BUCKET=acme-prod-uploads"
```

Note the scoping: `cloudsql.client` is project-wide (the role needs it), but the
storage and secret grants are bound to the *specific* bucket and secret, not the
project. Grant narrow.

Copy-paste runbooks for each piece — image build and push, private container deploy,
attach SQL, mount a secret, full teardown — are in
[`references/deploy-recipes.md`](references/deploy-recipes.md).

## 6. Cost & teardown

- Cloud Run scales to zero by default — an idle service costs ~nothing. Keep
  `--min-instances=0` on staging.
- Cap blast radius with `--max-instances` and a budget alert (full command in
  [`references/deploy-recipes.md`](references/deploy-recipes.md)):
  ```bash
  gcloud billing budgets create --billing-account=0X0X0X-0X0X0X-0X0X0X \
    --display-name="acme-prod" --budget-amount=50 \
    --threshold-rule=percent=0.9
  ```
- Tear down in dependency order so nothing dangles:
  ```bash
  gcloud run services delete api --region=europe-west1
  gcloud sql instances delete acme-db
  gcloud storage rm --recursive gs://acme-prod-uploads
  ```

## Anti-patterns

| Bad | Good | Why |
|-----|------|-----|
| Deploy with no `--service-account` | Pass a dedicated per-service SA | Default compute SA has Editor; an RCE becomes project takeover |
| `gcloud iam service-accounts keys create key.json` | Attached SA + Workload Identity Federation | JSON keys are long-lived, leak, and are rarely rotated |
| `--role=roles/editor` on a workload SA | Scoped predefined roles (`cloudsql.client`, …) | Primitive roles grant far more than the service needs |
| Bucket public via `allUsers` | Signed URL via `--impersonate-service-account` (+ Token Creator) | A public bucket is a data leak; keyless signing needs `signBlob`, not a key file |
| Bucket created without UBLA/PAP | `--uniform-bucket-level-access --public-access-prevention` at create | ACLs sprawl; PAP blocks accidental public grants |
| Cloud SQL with public IP open to `0.0.0.0/0` | `--no-assign-ip` + private IP / Auth Proxy | Public DB IPs get scanned and brute-forced |
| Secrets in `--set-env-vars` | `--set-secrets` from Secret Manager | Env vars are plaintext in `describe`, logs, console |
| `gcloud services enable` everything | Enable only the APIs you use | Each API widens attack surface; some bill on enable |
| No `--min-instances` on prod, then blame cold starts | `--min-instances=1 --cpu-boost` on prod | Scale-to-zero is the cause; pin a warm instance |
| Auth Proxy sidecar on Cloud Run | `--add-cloudsql-instances` + `/cloudsql/...` socket | Serverless connects natively; the proxy is for outside-VPC |

## Verify

`scripts/verify.sh` is an offline static linter (no GCP calls, no network) over files
that contain `gcloud` command blocks. It flags the unsafe patterns above: JSON key
creation, `roles/owner|roles/editor` bound to a service account, bucket creates missing
UBLA/PAP, Cloud SQL public IP without private IP, and Cloud Run deploys missing
`--service-account`.

```bash
bash scripts/verify.sh path/to/runbook.sh        # one file
bash scripts/verify.sh path/to/dir/              # recurse a directory
```

It prints `PASS`/`FAIL` per check and exits nonzero on any FAIL. An empty or
clean target passes (exit 0).
