---
name: aws-essentials
description: "Use when standing up the core AWS surface a small product needs: hardening a fresh account, a private S3 bucket, encrypted RDS Postgres, ECS Fargate vs EC2, CloudFront + OAC, or scoping an IAM policy to least privilege. NOT the CI pipeline that ships the container (that is `deployment`), NOT app-code access-control review (that is `secure-coding`)."
tags: [aws, cloud, iam, s3, infrastructure]
recommends: [deployment, secure-coding, dynamodb, postgresdb]
origin: risco
---

# AWS essentials — the core surface a small product needs, secured from the first command

Stand up the foundational AWS services a one-app product actually uses — IAM, S3, ECS Fargate,
RDS, CloudFront — with the security defaults that prevent the incidents (public buckets,
god-mode app roles, long-lived keys, unencrypted databases). Pick the right tier for *small*
(one app, modest traffic, two engineers), provision it correctly, and wire it without foot-guns.

```text
account hardening → IAM (roles + scoped policies) → S3 (private) / RDS (encrypted) / ECS Fargate → CloudFront (OAC) → infra exists, wired, least-privilege
```

## Service decision table

| Need | Use | Use instead if |
|------|-----|----------------|
| Object/file storage (uploads, assets, backups) | **S3** (private bucket) | — |
| Relational data (users, orders, anything with joins) | **RDS** (Postgres/MySQL) | key-value / serverless access pattern → `dynamodb` skill |
| Long-running container/API | **ECS Fargate** | steady ~70%+ CPU 24/7 → EC2 launch type with Savings Plans/Spot; GPU or >120 GB RAM → EC2 |
| Static site / SPA + public assets | **S3 + CloudFront** | edge functions / global KV → `../cloudflare/SKILL.md` |
| Tiny app, no real AWS need yet | be honest → `../vercel/SKILL.md` or `../deployment/SKILL.md` | you genuinely need AWS primitives → stay here |

Fargate cold start is ~30–60 s; for spiky/variable small-product load its operational simplicity
(no host patching, per-second billing, strong task isolation) wins. EC2 launch type only earns
its host-management cost at sustained high utilization. (ECS Managed Instances, Sept 2025, is a
newer hybrid — out of scope for a first setup.)

## Account zero-day hardening checklist

Do this once, before anything else. Each line has a reason; skip none.

- [ ] **Enable MFA on the root user** — prefer a passkey / security key (phishing-resistant). Root with no MFA is the single highest-blast-radius account.
- [ ] **Stop using root for daily work** — root is for the handful of root-only tasks (close account, change support plan). Everything else uses an IAM identity.
- [ ] **Create an admin identity via IAM Identity Center** (or an assumable admin role). Humans log in to a role with temporary creds, not a static user.
- [ ] **Delete any root access keys** — root should have zero access keys. If one exists, it is a liability with no upside.
- [ ] **No long-lived IAM-user access keys for apps or CI** — apps use task roles, CI uses OIDC (see `../deployment/SKILL.md`).
- [ ] **Set your home region** and create resources there consistently (one exception below: ACM certs for CloudFront must be in `us-east-1`).
- [ ] **Create a billing/cost budget alarm** — a misconfigured resource should page you, not surprise you on the invoice.

## IAM — least privilege without guessing

Two principal types. **IAM users** = long-lived humans/keys; avoid them for workloads. **Roles**
= an identity something *assumes* to get temporary credentials — this is what ECS tasks, Lambda,
CI, and federated humans use. Default to roles: a temporary credential beats a long-lived `AKIA…`
key that lives forever in a `.env`. (IAM governs who may call AWS APIs; access control *inside*
your app code is `../secure-coding/SKILL.md`.)

A policy is a JSON document. The four parts that matter:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::acme-uploads/users/*",
    "Condition": { "StringEquals": { "aws:SecureTransport": "true" } }
  }]
}
```

`Effect` (Allow/Deny) · `Action` (which API calls) · `Resource` (which ARNs) · `Condition`
(extra constraints). The whole game is keeping `Action` and `Resource` narrow.

**The workflow — start broad, then tighten (do not hand-author from zero):**

1. Attach the closest **AWS managed policy** to get the app working.
2. Let it run, then use **IAM Access Analyzer → generate policy from CloudTrail activity** to
   produce a fine-grained policy from what it *actually* called.
3. Replace the managed policy with the generated one.
4. **Validate** with Access Analyzer (runs 100+ policy checks) and review findings.
5. Periodically prune with **last-accessed data** — remove permissions nothing has used.

```jsonc
// Bad — one leak owns the account
{ "Effect": "Allow", "Action": "*", "Resource": "*" }

// Good — exactly what this service does, on exactly its resources
{ "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::acme-uploads/users/*" }
```

An ECS task needs a **trust policy** (who may assume the role) plus a **permission policy**
(what it may do). Trust policy for a task role:

```json
{ "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole" }] }
```

Policy JSON anatomy, condition keys, Access Analyzer CLI flow, and copy-ready scoped templates
(S3 one-prefix R/W, read one Secrets Manager secret, write CloudWatch logs, ECS trust) →
`references/iam-least-privilege.md`.

## S3 — private object storage

Create a bucket. The defaults are already what you want:

```bash
aws s3api create-bucket \
  --bucket acme-uploads \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
# Since Apr 2023, this bucket is already: Block Public Access ON (all four),
# Object Ownership = bucket-owner-enforced (ACLs disabled), SSE-S3 on every object.
```

**Keep all of that.** Do not re-enable ACLs; do not turn off Block Public Access. Grant access
two ways instead: a **bucket policy** (resource-side, e.g. allow one CloudFront distribution) or
an **IAM identity policy** (subject-side, e.g. the task role above). For browser uploads, hand
the client a **presigned URL** so the app never proxies the bytes and the bucket stays private:

```bash
aws s3 presign s3://acme-uploads/users/123/avatar.png --expires-in 900
```

```text
Bad:  set bucket to public-read so the <img> tags work
Good: bucket stays private → presigned URLs for direct upload/download,
      and CloudFront + OAC for public-read web content (see below)
```

## Compute — ECS Fargate first

Run the container on Fargate (rationale in the decision table). The mistake that costs an
afternoon every time:

> **Task role vs execution role — they are different.**
> - **Execution role**: lets *ECS itself* pull the image from ECR and push logs to CloudWatch. Start from the managed `AmazonECSTaskExecutionRolePolicy`.
> - **Task role**: the identity *your application code* assumes at runtime to call AWS (read the S3 bucket, read a secret). This is where your scoped least-privilege policy goes.
> Putting app permissions on the execution role (or vice-versa) is the classic "works in console, 403 at runtime" bug.

Network layout: **tasks in private subnets**, a load balancer (ALB) in public subnets, egress via
NAT. The DB and tasks never get public IPs. EC2 launch type only if you hit the steady-utilization
or hardware thresholds above. Full task-def + service CLI path lives in `../deployment/SKILL.md`
(that skill owns the ship step); this skill owns the roles and networking it runs on.

## RDS — managed relational DB

```bash
aws rds create-db-instance \
  --db-instance-identifier acme-prod \
  --engine postgres \
  --db-instance-class db.t4g.small \
  --allocated-storage 20 \
  --storage-encrypted --kms-key-id <your-rds-cmk> \
  --multi-az \
  --no-publicly-accessible \
  --master-username acme --manage-master-user-password \
  --vpc-security-group-ids sg-app-db
```

> **Encrypt at create time — you cannot encrypt an existing instance in place.** Storage
> encryption (AES-256 via KMS) must be set at creation; it then covers backups, read replicas,
> and snapshots. To fix an unencrypted instance you must snapshot → copy-snapshot *with*
> encryption → restore (Multi-AZ *clusters* can't even do that directly). Prefer a
> customer-managed KMS key dedicated to RDS.

Two more non-negotiables: the DB security group **references the app's security group**, never
`0.0.0.0/0` (a DB open to the internet is a breach, not a convenience); credentials live in
**Secrets Manager** with managed rotation (`--manage-master-user-password` above), never in task
env vars. Use `--multi-az` for production HA. Full recipe (SG wiring, Secrets Manager rotation,
connecting from ECS) → `references/rds-cloudfront-recipes.md`. Schema, indexes and query tuning
once the instance exists → `../postgresdb/SKILL.md`.

## CloudFront + OAC — public web content, private bucket

To serve S3 content publicly, do **not** make the bucket public. Put CloudFront in front and
grant it via **Origin Access Control (OAC)** — the modern replacement for the legacy OAI:

- OAC uses short-term, rotated credentials and a resource-based bucket policy scoped to the
  distribution ARN; CloudFront→S3 is always HTTPS with "Sign requests" (the default).
- OAC supports SSE-KMS origins and all regions. **OAI is legacy — never reach for it.**
- The bucket keeps Block Public Access **on**; you grant only the distribution, by bucket policy.
- Set the viewer protocol policy to **redirect-to-HTTPS**; ACM cert for a custom domain must be
  in **`us-east-1`**.

Full CLI: create OAC → distribution → S3 bucket policy JSON → invalidations → custom domain →
`references/rds-cloudfront-recipes.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Fix |
|---|---|---|
| Public-read S3 bucket | Anyone enumerates/downloads everything; classic breach headline | Keep Block Public Access on; presigned URLs or CloudFront+OAC |
| Re-enabling S3 ACLs | Brings back the confused-deputy/ownership mess April-2023 defaults removed | Leave bucket-owner-enforced; use bucket/IAM policies |
| `AdministratorAccess` on an app/task role | One leaked task credential = full account compromise | Scope to the exact actions+ARNs the service uses |
| `"Action": "*", "Resource": "*"` policy | Same blast radius, just hand-written | Generate from CloudTrail via Access Analyzer; validate |
| IAM-user access keys in app/`.env`/commit | Long-lived, never rotated, leak forever | Task role (app) / OIDC (CI) — temporary creds |
| Unencrypted RDS | Can't encrypt later without snapshot-copy-restore downtime | `--storage-encrypted` at create, customer-managed KMS key |
| DB security group open to `0.0.0.0/0` | Database directly reachable from the internet | SG references the app SG only; `--no-publicly-accessible` |
| CloudFront with OAI | Legacy; misses SSE-KMS, weaker credential model | Use OAC, bucket policy scoped to the distribution ARN |
| Secrets in task env vars | Leak via logs, console, task definition history | Secrets Manager + managed rotation, injected at runtime |
| Root user for daily ops | Highest blast radius, no per-action attribution | Root only for root-only tasks; admin via Identity Center |
| No MFA on root | One phished password = total account loss | Passkey/security-key MFA on root and every human |
| Confusing task role and execution role | App gets 403 at runtime, or ECS can't pull the image | Execution = pull image/logs; task = app's runtime perms |
