---
name: backups
description: "Use when designing or auditing a backup-and-restore program that must survive a real disaster: setting defensible RPO/RTO targets, laying out 3-2-1-1-0 copies that are offsite and immutable, wiring point-in-time recovery, and proving restores work on a schedule. NOT tuning Postgres internals or writing the archive_command (that is `postgresdb`)."
tags: [backups, disaster-recovery, pitr, rpo-rto, restore]
recommends: [postgresdb, secure-coding, monitoring]
origin: risco
---

# Backups & disaster recovery

## Start here

One question decides whether you have backups or a hope: **if you restored right now, would it work — and how do you know?**

If the answer is "we have a nightly job and it hasn't errored," you do not have backups. You have a job. A backup you have never restored is an untested assertion about the future. This skill exists to turn that assertion into evidence: pick the numbers, lay out the copies so ransomware can't reach them, and run a *real* restore on a schedule so the answer becomes "yes, we restored it last Tuesday in 41 minutes."

This is the cross-engine **strategy + verification** skill. Engine-specific SQL knobs (the actual `archive_command`, VACUUM, schema migrations) belong to `../postgresdb/SKILL.md`. Encryption-key management as a general security control belongs to `../secure-coding/SKILL.md`.

## 1. Decide RPO and RTO first — numbers, not adjectives

Everything downstream derives from two numbers. Never start from "what does the tool do."

- **RPO** = maximum acceptable *data loss*, the gap between the disaster and your last good copy. It sets **backup frequency**. "RPO 1 hour" means a copy at least hourly.
- **RTO** = maximum acceptable *downtime* until you're serving again. It sets **topology**: a snapshot restore is hours; a warm standby you promote is minutes.

Get a real number from whoever owns the revenue, not "as little as possible." Then map it:

| RPO target | Required cadence + mechanism |
|---|---|
| 24 h | Nightly full/snapshot is enough |
| ~5 min | Continuous change-log shipping: WAL / binlog / transaction-log → PITR |
| ~0 | Synchronous replica **plus** PITR (the replica covers hardware loss, PITR covers the bad `DELETE`) |

| RTO target | Required topology |
|---|---|
| Hours | Restore from snapshot / object-storage backup is fine |
| Minutes | Warm standby or read-replica you promote; pre-provisioned restore target |
| Seconds | Multi-AZ / failover cluster (and you still need backups for logical corruption) |

Rule: a replica is **not** a backup — it faithfully replicates your `DROP TABLE` in milliseconds. You need point-in-time recovery to step *back before* the mistake.

## 2. The 3-2-1-1-0 layout

The classic 3-2-1 rule grew two digits because ransomware now targets the backup infrastructure itself in ~96% of attacks — an attacker who can delete your backups has no reason to fear your backups. The current rule:

- **3** copies of the data (production + 2 backups). Why: one extra copy still dies with a correlated failure.
- **2** different media / storage types. Why: a single storage class has a single failure mode.
- **1** offsite. Why: fire, flood, region outage, or a billing-locked cloud account kills everything in one place. Offsite ≠ another folder on the same host.
- **1** immutable or offline. Why: a mutable copy an attacker (or a buggy script) can delete is not a safety net. See §5.
- **0** verification errors. Why: an unverified backup is Schrödinger's backup — both good and corrupt until you restore it. See §6–7.

Map it concretely: production Postgres (copy 1) → pgBackRest repo on local disk, different media (copy 2) → same repo replicated to an S3 bucket in another region with **Object Lock** (offsite + immutable) → `pgbackrest verify` + a scheduled test restore (the 0).

## 3. Pick the mechanism per data store

PITR availability is the column that decides whether you can hit a sub-hour RPO.

| Data store | Tool | PITR? | The one gotcha |
|---|---|---|---|
| Managed DB (RDS, Cloud SQL, Supabase, Neon) | Built-in automated backups | Yes | Set retention to your real window; know the ceiling (RDS caps at 35 days). Add a cross-region/cross-account copy you control. |
| Self-hosted PostgreSQL | pgBackRest or WAL-G + WAL archiving | Yes | Single-threaded `archive_command` falling behind = WAL storm (see §4). Use `archive-async=y`. |
| MySQL / MariaDB | Percona XtraBackup + binlog | Yes (binlog) | `mysqldump` alone has no PITR — you also need `--single-transaction` and binlog shipping. |
| Redis | RDB snapshot + AOF | Partial | Cache-first caveat: if Redis is just a cache, a backup may be pointless; if it's a system of record, enable AOF `everysec` and treat it like a DB. |
| Files / app data + object storage | restic or BorgBackup → Object-Lock bucket | n/a (versions) | Both dedup + AES-256 encrypt. restic = concurrent shared repos + faster restore; Borg = smaller repos but one exclusive lock per repo. |
| App config / secrets | Versioned + encrypted store | n/a | Back these up too, or your restored DB has nothing to connect to. Key must live somewhere the disaster doesn't. |

Concrete copy-paste config (pgBackRest stanza, RDS CLI, XtraBackup, restic/Borg) lives in `references/engine-recipes.md`.

## 4. PITR, generically

The model is the same for every engine that supports it: **a base/full backup + a continuous change log replayed forward to a target time.**

```text
base backup (T0) ──► change log: WAL / binlog / txn-log ──► replay to "2026-06-02 13:59:00"
```

You restore the base, then replay the log up to one second before the bad event. That second is why PITR beats snapshots for logical corruption.

- **Amazon RDS**: a daily automated snapshot plus transaction logs shipped to S3 **every 5 minutes**, restorable to any second within a retention window of up to **35 days**. Snapshots after the first are incremental. Trap: **AWS Backup does not support a PITR restore *into another region*** — you can copy the backup cross-region, but the restore-to-a-point-in-time happens in the original region. Plan failover accordingly.
- **Self-hosted Postgres traps** (both kill PITR silently):
  - *WAL storm*: a single-threaded `archive_command` can't keep up under write load, `pg_wal/` fills the disk, and Postgres **stops accepting writes**. Use async/parallel archiving (`archive-async=y`, `--process-max` tuned to disk count — it's I/O-bound, not CPU-bound).
  - *Retention trap*: expiring WAL too aggressively means the chain to your target time is gone and PITR fails. Retain WAL at least as long as your oldest restorable full backup.

Engine commands are in `references/engine-recipes.md`. For the Postgres-internals side of this (writing the `archive_command`, tuning), use `../postgresdb/SKILL.md`.

## 5. Offsite + immutability

- **Immutable = Object Lock / WORM** on the backup bucket: copies cannot be edited or deleted until the retention window expires, even by a root key. Enable it on a dedicated backup bucket.
- **Retention ≥ 90 days.** A 30-day default is often too short: malware commonly *dwells* for weeks before triggering, so a 30-day lock can expire on the very copies that predate the infection. 90+ days outlives typical dwell time.
- **Offsite means a different blast radius**, not a different folder. Different region, and ideally a different account/project with **separate credentials** — so a compromised application key cannot reach in and delete the backups. The app that writes backups should not hold the key that can delete them.

## 6. The tested restore — this is the part everyone skips

The number-one reason PITR fails in a real disaster is that it was **never tested**. Schedule restores like you schedule backups.

| Test | Cadence | Scope |
|---|---|---|
| File / single-object restore | Monthly | Pull one file/table back, in an isolated env, confirm integrity |
| Application recovery | Quarterly | Stand up the app against the restored data, run smoke queries |
| Full-environment failover | Annually | Rebuild the whole stack from backups in an isolated account/region |

Rules:
- **Always restore into an isolated environment** — never over production, never sharing its credentials.
- **Record the *actual* recovery time every run** and update your RTO to that reality. An RTO of "4 hours" that you've never measured is fiction.
- A restore test that "looks fine" isn't done until you've run a validation query / row-count / checksum that proves the data is *correct*, not just present.

The fill-in-the-blank restore runbook, the scheduled-test checklist, and the actual-RTO log format are in `references/restore-runbook.md`.

## 7. Verify & monitor

- **Integrity-verify the backups themselves**: `restic check` / `borg check` / `pgbackrest verify` re-read and checksum chunks. A backup that won't pass `check` won't restore.
- **Alert on three conditions**: a backup job *failed*, the newest good backup is *older than your RPO* (backup-age check — silence is the dangerous failure mode), and a *restore test is overdue*.
- Wiring those alerts into a metrics/paging stack is a monitoring concern — own the *what to alert on* here, hand the *how* to `../monitoring/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Backups on the same host/disk as the source | One disk/host failure takes the source and the backup together | Offsite copy, different blast radius (§2) |
| Never test-restored | The restore fails for the first time *during* the disaster | Monthly/quarterly/annual scheduled restores (§6) |
| "The replica is our backup" | It replicates your `DROP TABLE` faithfully | Replica for RTO, PITR for the bad write (§1) |
| Mutable bucket the app key can delete | Ransomware/compromised key wipes backups too | Object Lock + separate credentials (§5) |
| 30-day retention only | Malware dwell time outlasts the lock | Retention ≥ 90 days (§5) |
| `pg_dump`/dump to `/tmp` | Reboot or full disk silently loses it; no PITR | Dedicated repo + WAL/binlog shipping (§3–4) |
| RPO promised, cadence can't meet it | "RPO 5 min" with a nightly job = up to 24 h loss | Derive cadence from RPO *first* (§1) |
| Single-threaded `archive_command` under load | WAL storm fills `pg_wal`, writes stop | Async/parallel archiving (§4) |
| Encrypted backup, key only in the vault that's gone | Backup is recoverable but unreadable | Store the key in a separate blast radius (§3) |
| Trusting managed snapshots without knowing the ceiling | RDS caps at 35 days; longer needs an exported copy | Know the retention ceiling, export beyond it (§3) |
| Counting "job succeeded" as success | The job wrote a corrupt/empty archive | `check`/`verify` + a real test restore (§6–7) |

`scripts/verify.sh <path-to-policy-or-runbook>` lints a produced backup-policy/runbook artifact for the five pillars (RPO, RTO, offsite, immutability, scheduled-restore + verification). It is a completeness lint, not a backup executor.
