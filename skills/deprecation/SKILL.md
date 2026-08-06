---
name: deprecation
description: "Use when retiring a public API, feature, integration, service or legacy path without abandoning consumers. Inventories usage, classifies advisory vs compulsory migration, ships compatibility/tooling, assigns owners and gates removal on evidence. NOT live schema expand-contract (`db-migrations`), NOT replacement API design (`api-design`)."
tags: [deprecation, migration, compatibility, consumer-migration, removal]
recommends: [api-design, db-migrations, deployment, git-workflow, monitoring]
profiles: [core, full]
origin: risco
---

# deprecation — removal is a consumer migration

Deprecation is not a date in a changelog. It is the controlled transfer of real consumers from an old contract to a supported replacement, followed by evidence that removal no longer breaks anyone important.

This skill owns the cross-consumer program. It delegates the replacement interface to `../api-design/SKILL.md`, live schema mechanics to `../db-migrations/SKILL.md`, release/version mechanics to `../git-workflow/SKILL.md`, and rollout/rollback execution to `../deployment/SKILL.md`.

## The retirement sequence

```text
INVENTORY → CLASSIFY → ENABLE → NOTIFY → MIGRATE → OBSERVE → REMOVE
```

### 1. INVENTORY the contract and consumers

Identify:

- exact endpoints, events, schemas, flags, SDK methods, jobs, services and docs being retired;
- internal and external consumers, owners and contractual notice periods;
- traffic/usage by consumer, version and operation;
- data written only by the old path and compatibility obligations;
- support, reseller or offline consumers invisible to runtime telemetry;
- current fallback and restoration options.

“No known users” is not an inventory. Query telemetry, code search, dependency graphs, access keys, support records and account owners. Record where visibility is incomplete.

### 2. CLASSIFY the migration

- **Advisory:** the old path remains supported; migration is encouraged for benefit or future-proofing.
- **Compulsory:** support will end or continued use creates unacceptable security, reliability, legal or operating risk.

Only compulsory migrations justify a removal deadline. State the forcing reason and who has authority to accept exceptions. A deadline should respect contracts, effort and evidence; do not import a universal 30/60/90-day calendar.

### 3. ENABLE migration before announcing removal

The replacement must be usable first:

- compatible contract or adapter where feasible;
- migration guide with old → new mappings and changed semantics;
- tooling, codemod, SDK or dual-write/read path for repetitive work;
- test/sandbox path and representative examples;
- rollback or temporary compatibility mode;
- ownership for data backfill and reconciliation.

For database changes, use expand → backfill → switch reads/writes → contract through `../db-migrations/SKILL.md`. Do not promise a generic `down` migration for irreversible data transformations; prove the actual restoration/reconciliation path instead.

### 4. NOTIFY through machine and human channels

Use the channels the consumer will actually see: response headers, compiler/runtime warnings, API dashboards, release notes, direct account contact, support and status communications. A warning must name the replacement, action, consequence, evidence link and earliest removal condition.

Versioned public APIs should follow their compatibility policy and SemVer where it applies. Machine warnings without a migration guide create noise; an email without runtime identification misses the real owner. Use both when the surface permits.

### 5. MIGRATE with explicit ownership

The team introducing the deprecation owns the common migration path: inventory, docs, automation, default internal consumers and escalation. Consumer teams own domain-specific acceptance and scheduling, not rediscovering the replacement.

Track each consumer as: uncontacted, acknowledged, testing, migrated, exempted with expiry, unreachable, or blocked. Give blockers an owner and next action. Reseller-managed or unknown consumers need a separate reachability plan; do not silently exclude them from the denominator.

### 6. OBSERVE real cutover

Instrument old-path usage by consumer and operation, plus errors on the replacement. Where risk warrants it, shadow or dual-run and compare results before switching authority. Dashboards must distinguish legitimate residual traffic, retries and synthetic probes from active dependency.

Define the removal gate up front, for example:

- no non-exempt production use for a representative window;
- every contractually covered consumer notified and migrated or explicitly exempted;
- replacement error/SLO health acceptable;
- rollback/compatibility response tested;
- support, docs and on-call ready for late discoveries.

The representative window depends on consumer cadence. A monthly batch needs more than a quiet week.

### 7. REMOVE in a reversible order

Disable entry first, observe, then delete implementation, flags, compatibility code, credentials, dashboards and documentation that exist only for the old path. Preserve audit/history records. Update dependency and ownership maps so the retired system does not remain a zombie operational obligation.

If unexpected material traffic appears, re-enable the bounded compatibility path and return to migration. Do not restore an undocumented permanent fork.

## Deprecation record

```markdown
# Deprecation — <old> → <replacement>

## Classification and reason
Advisory/compulsory · forcing reason · authority · notice constraints.

## Inventory
Contracts · consumers · owners · baseline usage · visibility gaps.

## Migration path
Compatibility · guide/tooling · data plan · rollback/reconciliation.

## Consumer ledger
Consumer · state · owner · last old-path use · blocker/exception expiry.

## Removal gate and evidence
Window · zero-use evidence · replacement health · support/rollback readiness.

## Removal log
Disabled · observed · deleted · residual artifacts.
```

## Anti-patterns

| Smell | Correction |
|---|---|
| The calendar arrives while material traffic remains | Hold removal; the gate is evidence, not date alone. |
| Every consumer writes the same adapter | The deprecating team owns common tooling and default migrations. |
| Internal code search proves external zero-use | Combine runtime identity, contracts, support and account ownership. |
| Temporary compatibility has no owner or expiry | Track an explicit exception with accountable owner and end condition. |
| Deprecation silently grants deploy authority | Keep live rollout/rollback explicit through `deployment`. |

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el “¿instalo la skill que falta?”.)
