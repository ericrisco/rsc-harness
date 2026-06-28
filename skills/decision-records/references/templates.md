# ADR templates, conventions & worked examples

Templates track **MADR 4.0.0** (released 2024-09-17, the current version — see https://adr.github.io/madr/). Use the **minimal** template until a section earns its place; reach for the **full** template only when the decision is genuinely contested or far-reaching.

## Naming & index convention

Filenames: `NNNN-title-with-dashes.md` where `NNNN` is a zero-padded sequential id (`0001`, `0002`, …). Stable ids are what make supersession back-links durable.

Store under one log only — `docs/adr/` (code repo) or `02-DOCS/wiki/decisions/` (harness workspace). Maintain an index as `docs/adr/README.md` or `0000-index.md`:

When the log lives in `02-DOCS/wiki/decisions/`, each ADR is a document in an OKF v0.1 bundle, so it opens with YAML frontmatter carrying a non-empty `type: decision` (plus the OKF-recommended `title`/`tags`/`timestamp`). The MADR body — `- Status:`, `- Date:`, the sections — is kept exactly as below; the frontmatter is additive and `verify.sh` keeps reading the body lines. The index file (`0000-index.md` / `README.md`) is the OKF reserved directory listing and carries **no frontmatter**. All cross-references are standard markdown links, never wikilinks. In a plain `docs/adr/` code repo the frontmatter is optional — OKF conformance governs only the wiki bundle. The OKF frontmatter block to prepend (shown once; the templates below omit it for brevity):

```yaml
---
type: decision
title: "<short decision title>"
tags: [adr]
timestamp: YYYY-MM-DDTHH:MM:SSZ
---
```

```markdown
# Decision Log

| ID   | Title                                  | Status                 | Date       |
|------|----------------------------------------|------------------------|------------|
| 0004 | Adopt REST for the public API          | superseded by ADR-0012 | 2025-11-03 |
| 0007 | Choose Postgres over DynamoDB          | accepted               | 2026-06-02 |
| 0012 | Adopt tRPC for internal API            | accepted               | 2026-06-30 |
```

Every new ADR gets a row here at creation time. No orphans.

## Minimal template (MADR 4.0.0)

```markdown
# NNNN. <short decision title, imperative>

- Status: proposed | accepted | rejected | deprecated | superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Deciders: <names / handles>

## Context and Problem Statement

<2–4 sentences. The problem and the constraints that force a choice.
State the problem, not the answer. Quantify. Cite any driver (constitution
section, spec/plan fork) that imposed this.>

## Considered Options

- <option 1>
- <option 2>
- <option 3>

## Decision Outcome

Chosen: **<option>**, because <the one-line justification tying back to
the dominant driver>.

## Consequences

- Good: <what improves>
- Bad: <what degrades / what you now own>
- Follow-up: <concrete next work, linked to a tracker or future ADR>
```

## Full template (MADR 4.0.0, annotated)

Add the optional sections — Decision Drivers, per-option Pros and Cons, Confirmation, More Information — when the decision is contested enough to need them.

```markdown
# NNNN. <short decision title>

- Status: proposed
- Date: YYYY-MM-DD
- Deciders: <names>

## Context and Problem Statement

<The forces at play. Problem + constraints, quantified. End with the
question being decided.>

## Decision Drivers <!-- optional, but usually worth it -->

- <driver 1, e.g. "EU data residency (constitution §data-residency)">
- <driver 2, e.g. "team SQL fluency, no NoSQL ops experience">
- <driver 3, e.g. "p99 < 100ms at 2k writes/min">

## Considered Options

- <option 1>
- <option 2>
- <option 3>

## Decision Outcome

Chosen: **<option>**, because <justification scored against the drivers>.

### Confirmation <!-- optional -->

<How we'll confirm the decision is implemented as intended — a review,
a test, an architecture-fitness check.>

## Pros and Cons of the Options <!-- optional -->

### <option 1>

- Good, because <…>
- Bad, because <…>

### <option 2>

- Good, because <…>
- Bad, because <…>

## Consequences

- Good: <upside bought>
- Bad: <price paid / new ownership>
- Risk: <what could go wrong>
- Follow-up: <linked tasks>

## More Information <!-- optional -->

<Links, benchmarks, the meeting that spawned this, related ADRs.>
```

## Worked example — `0007-choose-postgres.md`

Shown with the OKF frontmatter it carries when stored in `02-DOCS/wiki/decisions/`:

```markdown
---
type: decision
title: "Choose Postgres over DynamoDB for the primary store"
tags: [adr, database, billing]
timestamp: 2026-06-02T00:00:00Z
---

# 7. Choose Postgres over DynamoDB for the primary store

- Status: accepted
- Date: 2026-06-02
- Deciders: @alice, @bob

## Context and Problem Statement

The billing service needs a primary datastore. Data is strongly
relational (invoices, line items, customers with foreign keys),
write volume ~2k/min, the team is 3 engineers with deep SQL and no
NoSQL operational experience, and EU data residency is mandatory
(constitution §data-residency). Which store do we adopt?

## Decision Drivers

- Relational integrity: transactional, foreign-key-enforced invoicing
- Team fluency: SQL high, NoSQL ops ~zero
- EU residency + self-host option
- Operational risk for a 3-person team

## Considered Options

- Postgres (managed, EU region)
- DynamoDB
- MongoDB Atlas

## Decision Outcome

Chosen: **Postgres (managed, EU region)**, because it natively matches
the relational shape of the data and the team's existing fluency, at the
lowest operational risk for a small team.

## Pros and Cons of the Options

### Postgres
- Good, because native ACID transactions and foreign keys fit invoicing.
- Good, because the whole team is productive day one.
- Bad, because we own connection-pooling and vertical-scaling sooner.

### DynamoDB
- Good, because effectively infinite write scaling, hands-off ops.
- Bad, because relational integrity is app-enforced — error-prone for billing.
- Bad, because no team experience and no EU self-host path (AWS-coupled).

### MongoDB Atlas
- Good, because flexible schema and EU regions available.
- Bad, because multi-document transactions are awkward for invoicing.
- Bad, because partial team fluency, medium operational risk.

## Consequences

- Good: ACID guarantees for invoices; mature tooling; team productive immediately.
- Bad: we own connection-pool tuning and will hit vertical-scaling limits earlier.
- Risk: a single-writer bottleneck at much higher volume.
- Follow-up: provision a read replica before launch — tracked in ADR-0009.
```

## Worked example — supersession pair

A prior decision is reversed. **Never edit the old decision** — write a new ADR and flip the old status.

Old ADR, status line changed (and *only* the status line):

```markdown
# 4. Adopt REST for the public API

- Status: superseded by ADR-0012
- Date: 2025-11-03
- Deciders: @alice

## Context and Problem Statement

We needed a wire format for the public API in v1. (…original context,
options, decision and consequences left fully intact…)
```

New ADR that supersedes it:

```markdown
# 12. Adopt tRPC for the internal API

- Status: accepted
- Date: 2026-06-30
- Deciders: @alice, @carol
- Supersedes: ADR-0004

## Context and Problem Statement

ADR-0004 chose REST when clients were external and untyped. Clients are
now exclusively our own TypeScript apps; the manual request/response typing
that REST forced is a recurring source of drift and bugs. Reconsider the
internal API transport.

## Considered Options

- Keep REST (status quo, ADR-0004)
- tRPC (end-to-end TypeScript types)
- GraphQL

## Decision Outcome

Chosen: **tRPC**, because every client is TypeScript and end-to-end type
inference removes the drift class entirely, with no schema-layer overhead.

## Consequences

- Good: compile-time-safe client/server contract; no codegen step.
- Bad: couples clients to a TypeScript server; no longer language-agnostic.
- Follow-up: deprecate REST routes over two releases; update ADR-0004 status.
```

Then back-link: ADR-0004 → `superseded by ADR-0012`, ADR-0012 → `Supersedes: ADR-0004`. Both are reachable from the index.
