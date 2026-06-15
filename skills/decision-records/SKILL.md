---
name: decision-records
description: "Use when a consequential, hard-to-reverse choice was just made or is about to be — database, framework, auth model, vendor, API style, deployment target — and future-you will ask why, with the answer buried in chat; capture it as a numbered, immutable ADR with the context that forced the choice, the real options weighed with their trade-offs, the decision, and consequences both ways. Also when a prior decision is being reversed and must be superseded without erasing history, or when onboarding keeps re-litigating a settled choice. Triggers: 'write up why we picked Postgres over DynamoDB so we stop arguing', 'record the switch to tRPC but keep the old REST decision in history', 'documenta por qué elegimos Hetzner y qué alternativas descartamos con pros y contras', 'registra la decisió i les alternatives que vam descartar'. NOT the meeting recap with action items and owners (that is meeting-notes), NOT the project-wide standing principles and stack canon (that is constitution)."
tags: [decision-records, adr, architecture-decisions, rationale, decision-log, madr, knowledge-ops]
recommends: [meeting-notes, constitution, sop-builder, knowledge-ops, codebase-onboarding, plan, specify]
origin: risco
---

# Decision Records — Freeze the Why Before It Evaporates

*A consequential choice got made. Capture it as one short, immutable, numbered ADR: the context that forced it, the real options weighed, the decision, and what it costs you both ways. Six months from now this file is the only thing standing between you and re-litigating the whole thing.*

You own the **durable single-decision artifact** — an Architecture/Any Decision Record (ADR). Not a meeting recap, not a runbook, not a spec. One bounded choice, recorded so the reasoning survives the people who made it.

## The one test: is this even ADR-worthy?

Write an ADR **iff** the choice is *costly to reverse* **OR** *future-you will ask "why did we do it this way"*. Everything else is noise — an ADR for a trivial reversible tweak is just paperwork, and ADRs lose all their value the moment they become forced ceremony (this is the consistent message from Fowler and the AWS Architecture Blog).

| Worth an ADR | Skip it |
|---|---|
| Postgres vs DynamoDB for the primary store | Which lint rule to enable |
| Monolith vs microservices for v1 | Renaming a local variable |
| Build vs buy auth (Clerk vs roll-your-own) | Bumping a patch dependency |
| Dropping REST for tRPC across the API | Choosing a CSS color token |
| Picking Hetzner over AWS for hosting | A reversible feature flag default |

If you can rip it out in an afternoon and nobody will ever ask why, don't write an ADR. Decide, move on.

## Decide home + naming once

Pick a storage convention *before* the first record, and never spawn a competing second log. Default to the project's existing convention if one exists.

| Naming school | Looks like | Use when |
|---|---|---|
| Numeric-prefix (adr-tools / MADR) | `0007-choose-postgres.md` | You need stable IDs to cross-reference for supersession — **the default** |
| Imperative verb-noun | `choose-database.md` | Tiny log, no supersession expected, humans browse by topic |

Prefer **numeric-prefix**: `NNNN-title-with-dashes.md`. Stable IDs are what make "Superseded by ADR-0012" mean something.

**Where to store** (first match wins):
1. The project's existing convention — never invent a parallel log.
2. A code repo with no convention: `docs/adr/` (also seen as `doc/adr/`).
3. A harness workspace: `02-DOCS/wiki/decisions/`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer).

```text
Bad:  decision-final-v2-REAL.md          # no ID, no order, will rot
Bad:  notes/adr/db.md                     # buried, not in the log
Good: docs/adr/0007-choose-postgres.md    # stable ID, sorts, cross-referencable
```

Seed the **index** the moment you create the first ADR — a README row or `0000-index.md` listing id, title, status, date. An ADR that isn't in the index is an orphan nobody will find.

## The record spine

Map every ADR to the **MADR 4.0.0 template** (released 2024-09-17 — the current version). MADR ships full and minimal variants; use minimal until a section earns its place.

Required spine, in order: **Title → Status → Date → Context and Problem Statement → Decision Drivers → Considered Options → Decision Outcome → Consequences**. The MADR-optional sections (Confirmation, Pros and Cons of the Options, More Information) you add only when they pull weight.

Minimal skeleton — this is enough for most decisions:

```markdown
# 7. Choose Postgres over DynamoDB for the primary store

- Status: accepted
- Date: 2026-06-02
- Deciders: @alice, @bob

## Context and Problem Statement

We need a primary datastore for the billing service. Relational
invoicing data, ~2k writes/min, team of 3 with deep SQL experience,
EU data-residency required. Which store do we adopt?

## Decision Drivers

- Strong relational integrity for invoices (foreign keys, transactions)
- Team SQL fluency; near-zero NoSQL operational experience
- EU residency + self-host option (constitution §data-residency)

## Considered Options

- Postgres (managed, EU region)
- DynamoDB
- MongoDB Atlas

## Decision Outcome

Chosen: **Postgres**, because it matches the relational shape of the
data and the team's existing fluency, with the lowest operational risk.

## Consequences

- Good: ACID transactions, mature tooling, team productive day one.
- Bad: we own connection-pool and vertical-scaling concerns earlier.
- Follow-up: provision read replica before launch (ADR-0009 tracks scaling).
```

Keep it to **1–2 pages, readable in 5–10 minutes**. If a record sprawls, you're probably bundling two decisions — split them. The full annotated MADR full+minimal templates and a worked example live in [`references/templates.md`](references/templates.md).

## Write context that forces the decision

The context section must make the decision feel *inevitable*. State the problem and the constraints — **not the solution**.

- **State the problem, not the answer.** "We need to pick a store" not "We should use Postgres." The verdict belongs in Decision Outcome.
- **Quantify.** "~2k writes/min", "team of 3", "EU residency", "p99 < 100ms". Numbers are what let future readers judge if your constraints still hold.
- **Cite the driver.** If a constitution principle or a spec/plan fork forced this, link it. An ADR is often downstream of [`constitution`](../constitution/SKILL.md) and cites it as a driver.

```markdown
Bad context:  "We decided to use Postgres because it's reliable."
              (conclusion smuggled in, no constraints, unfalsifiable)

Good context: "Billing needs relational integrity for invoices,
              ~2k writes/min, a 3-person team with SQL but no NoSQL
              ops experience, and EU data residency (constitution
              §data-residency). Which primary store do we adopt?"
```

## Options must be real and comparable

The rejected options are the *asset* — they're the proof you thought, and they stop the next person re-proposing them.

- **List ≥2 genuine options.** A single foregone "option" is theatre. If there was really only one path, you don't need an ADR.
- **Score each against the *same* drivers.** Apples to apples, or the comparison is meaningless.
- **Record why each loser lost.** That sentence is worth more than the winner's praise.

```markdown
| Option    | Relational integrity | Team fluency | EU self-host | Op. risk |
|-----------|----------------------|--------------|--------------|----------|
| Postgres  | native               | high         | yes          | low      |
| DynamoDB  | app-enforced         | none         | no (AWS)     | high     |
| Mongo     | partial              | medium       | yes          | medium   |
```

## Consequences, both directions

A one-sided ADR is marketing, and marketing erodes the trust that makes the log worth reading. Record:

- **What improves** — the upside you bought.
- **What degrades** — the price you paid, honestly.
- **New work / risk it creates** — what you now own that you didn't before.
- **Follow-ups** — concrete tasks, ideally linked to a tracker or a future ADR.

If you can't name a single downside, you haven't finished thinking. Every real choice has a cost.

## Status lifecycle + immutability

An accepted or rejected ADR is **immutable**. You never edit the decision — you write a *new* ADR that supersedes it and flip the old one's status. This is the whole point: history stays intact.

| Status | Meaning | Next |
|---|---|---|
| `proposed` | drafted, under review | → accepted or rejected |
| `accepted` | adopted, in force | → deprecated or superseded |
| `rejected` | considered and declined | terminal (kept for the record) |
| `deprecated` | no longer relevant, not replaced | terminal |
| `superseded by ADR-NNNN` | replaced by a newer decision | terminal, back-linked |

The supersession ritual (never skip a step):

1. Write the new ADR (e.g. `0012-adopt-trpc.md`), status `accepted`, with a "Supersedes ADR-0004" note in its context.
2. Edit **only the status line** of the old ADR (`0004`) to `superseded by ADR-0012`. Leave its decision and rationale untouched.
3. Back-link both ways so a reader landing on either finds the other.

Never delete an ADR and never rewrite its decision — a wrong-in-hindsight ADR is still true history. A worked supersession pair is in [`references/templates.md`](references/templates.md).

## Maintain the log

A decision log is only useful if it stays navigable.

- **Index every ADR at creation.** One row: `| 0007 | Choose Postgres | accepted | 2026-06-02 |`. No orphans.
- **Keep supersession links live** in both directions.
- **Review cadence.** Periodically sweep `accepted` ADRs — anything reality has overtaken gets a superseding record, not a silent edit.
- **Index the log from the entry point** — `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer) — so onboarding finds it. The broader wiki and onboarding doc are owned by `knowledge-ops` and `codebase-onboarding`; this skill owns only the ADRs the wiki links to. The meeting that spawned a decision routes to [`meeting-notes`](../meeting-notes/SKILL.md); the repeatable how-to it implies routes to [`sop-builder`](../sop-builder/SKILL.md).

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Editing an accepted ADR's decision in place | Destroys history; future readers can't see the path | Supersede with a new ADR, flip old status |
| Single foregone "option" | No real comparison; theatre, not a record | List ≥2 genuine options or skip the ADR |
| No consequences (or only upside) | One-sided ADR is marketing; erodes trust | Record gains, costs, new work, follow-ups |
| Novella-length ADR | Nobody reads 8 pages; signal drowns | 1–2 pages; split bundled decisions |
| ADR for a trivial reversible choice | Forced paperwork; kills the practice | Apply the one test first |
| Re-deciding what the constitution settled | Duplicates the standing ruleset, causes drift | Cite the constitution as a driver instead |
| Orphan ADR not in the index | Invisible; nobody finds it | Add the index row at creation |
| Context that states the answer | Decision smuggled in, unfalsifiable | Problem + constraints only; verdict in Outcome |

## Verify

Lint a produced ADR (or a whole decisions dir) with `scripts/verify.sh <path>`: it checks for a recognized status, a date, the required sections, ≥2 options, and a valid filename — read-only, no network. See [`references/templates.md`](references/templates.md) for the skeletons it expects.
