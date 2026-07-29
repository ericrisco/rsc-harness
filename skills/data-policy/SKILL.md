---
name: data-policy
description: "Use when building internal data-governance machinery: a retention schedule (period, lawful basis, expiry action, system where deletion runs), an Art. 6 lawful-basis register, an Art. 30 ROPA, or a consent capture/withdrawal model. NOT the public privacy notice or DSAR handling (that is `gdpr-privacy`), NOT SOC 2 posture (that is `compliance`)."
tags: [data-governance, retention, gdpr, ropa, consent, lawful-basis, privacy, data-minimization]
recommends: [gdpr-privacy, compliance, contracts, secure-coding, db-migrations, postgresdb]
origin: risco
---

# Data policy

You produce the structured governance artifacts engineering and ops implement — a retention schedule, a lawful-basis register, a Record of Processing Activities (ROPA), a consent model — not the public-facing notice users read (that is `../gdpr-privacy/SKILL.md`). You are not a DPO and you never claim to be one.

**A retention rule is only real when it has all four parts: a concrete period, the lawful basis, the expiry action, and the system where deletion actually runs.** A policy that names a period but never deletes anything is a paper policy — and a paper policy is precisely what regulators fine. Cumulative GDPR fines hit ~EUR 5.65B across ~2,245 actions by March 2025, and the two failures that recur are *no systematic data classification* and *no automated deletion capability* (Secure Privacy / CMS Enforcement Tracker, 2025). Every schedule you emit ends with the DPO/counsel sign-off boundary below.

## First move: which artifact does the operator need?

Map the request to one artifact before writing anything. Each routes to a section.

| Operator says | Artifact | Go to |
|---|---|---|
| "How long do we keep X / write our retention policy" | Retention schedule | Build the retention schedule |
| "Is our basis consent or legitimate interest?" | Lawful-basis register | Pick the lawful basis |
| "Set up a ROPA / Article 30 record" | ROPA row | The ROPA |
| "Design consent capture / withdrawal" | Consent matrix | Consent model |
| "Auto-delete but keep legal holds / backups still have data" | Deletion workflow | Make it real in systems |

If they want the public privacy notice, DPA clauses, or SOC 2 readiness instead, stop and route them — see the boundary below.

## Build the retention schedule

This is the core artifact. For every category of personal data, walk five columns in order: **data category -> purpose -> lawful basis -> retention period -> expiry action -> system of record**. GDPR's storage-limitation principle (Art. 5(1)(e)) requires data be held in identifiable form *no longer than necessary for the purpose it was collected for*; GDPR sets no fixed periods — duration is driven by purpose plus sector law (gdpr-info.eu Art. 5; Usercentrics, 2026).

The expiry action is one of three, and you must pick one explicitly:

- **delete** — the row is gone.
- **anonymize** — identifiers stripped so the record is no longer personal data (then storage limitation no longer bites); valid only if re-identification is genuinely infeasible.
- **archive** — kept under Art. 89(1) safeguards for a lawful long-term purpose (statutory, archival, statistical).

Worked example. The Bad version is what gets fined; the Good version is enforceable.

```text
Bad:  Customer data — kept as long as necessary.
Good: | Category        | Purpose        | Lawful basis      | Period                  | Expiry   | System of record       |
      | Customer orders | fulfil + tax   | Art. 6(1)(b) +(c) | 36 mo after last order  | anonymize| Postgres `orders` + DWH|
```

Working default periods — **starting points, never asserted as universally lawful; validate against local + sector law** (Usercentrics; Secure Privacy, 2026):

| Category | Common default | Basis it usually rides on |
|---|---|---|
| Accounting / tax records | ~10 years (statutory in most EU states) | Art. 6(1)(c) legal obligation |
| HR records (post-employment) | ~3–6 years | Art. 6(1)(b)/(c) |
| Customer / CRM | ~3 years after last interaction | Art. 6(1)(b)/(f) |
| Marketing consent records | life of consent + proof | Art. 6(1)(a) consent |
| Support tickets | 1–3 years | Art. 6(1)(b)/(f) |
| Server / access logs | short (30–180 days typical) | Art. 6(1)(f) legitimate interest |

Every processing activity in the ROPA should appear as a row here. The full fillable template with the delete-vs-anonymize-vs-archive note and the validation checklist lives in `references/retention-schedule.md`.

## Pick the lawful basis

Art. 6 gives **six** lawful bases, and you must identify one *before* processing starts: consent, contract, legal obligation, vital interests, public task, legitimate interests (gdpr-info.eu Art. 6; IAPP). Consent is one of six and is often the *weakest* choice for operational data.

The trap: defaulting everything to consent. Consent is revocable at any time, so building contract-essential processing on it means a withdrawal can leave you unable to deliver the service. Use **contract** (Art. 6(1)(b)) for what the service requires, **legal obligation** (Art. 6(1)(c)) for statutory keep-periods, and **legitimate interest** (Art. 6(1)(f)) for fraud prevention, security logging, and most analytics. Reserve **consent** (Art. 6(1)(a)) for marketing and non-essential cookies/trackers.

When you lean on legitimate interest, run the three-part balancing test and write it down:

1. **Purpose** — is the interest legitimate and clearly stated?
2. **Necessity** — is the processing actually needed, or would less-intrusive data do?
3. **Balancing** — does it override the data subject's rights and reasonable expectations?

Anchor this to the EDPB Guidelines 1/2024 on legitimate interest (Oct 2024). The worksheet is in `references/consent-and-ropa.md`.

## The ROPA

A ROPA (Art. 30) is the central inventory: one row per processing activity. Minimum columns: **activity, purpose, data categories + data subjects, recipients, transfers, retention period, security measures.** Art. 30 does not strictly require logging the Art. 6 basis — but record it per row anyway; it speeds audits, DPIAs, and notice updates (TermsFeed; Legiscope, 2026).

```text
Activity:    Customer support ticketing
Purpose:     resolve and track support requests
Data cats:   name, email, account ID, message content | Subjects: customers
Recipients:  internal support team; Zendesk (processor)
Transfers:   US (SCCs in place) — point to gdpr-privacy for the mechanism
Retention:   2 years after ticket closed, then delete
Security:    RBAC, encryption at rest, access logging
Lawful basis: Art. 6(1)(b) contract  ← log it even though Art. 30 doesn't demand it
```

The full ROPA template with a second worked row — plus the consent-matrix template and the withdrawal/refresh workflow — is in `references/consent-and-ropa.md`.

## Consent model

Where consent *is* the basis, it must be valid under Art. 4(11) / Art. 7: **freely given, specific, informed, and unambiguous** — a positive opt-in act (EDPB).

- **Capture:** an affirmative action, never a pre-ticked box. Granular per purpose (marketing email != product analytics). Reject must be as easy as accept — no dark patterns.
- **Proof / logging:** store enough to prove consent later — timestamp, the consent-text *version*, the scope/purposes granted, and the capture method.
- **Withdrawal:** must be as easy as giving it. One click, no retention-by-friction.
- **Refresh:** EDPB recommends refreshing after ~12 months or on a material change.

```text
| Purpose          | Basis        | Capture point      | Proof fields stored              | Withdrawal      |
| Marketing email  | Art. 6(1)(a) | signup checkbox    | ts, text v2.1, scope, method     | one-click unsub |
| Product analytics| Art. 6(1)(a) | cookie banner      | ts, banner vN, categories, method| banner re-open  |
```

One note so you don't over-promise on cookies: the **ePrivacy Regulation was formally withdrawn by the European Commission in February 2025**, so the ePrivacy Directive (and its national implementations) still governs cookies and trackers (Hunton; Clym, 2026). Don't cite a Regulation that does not exist.

## Make it real in systems

The policy is worthless until deletion runs in the systems that actually hold the data — *including backups and archives*, which is exactly where regulators find data that should be gone.

Checklist:

- [ ] **Classify** the data first — you can't apply a period to a category you haven't mapped.
- [ ] **Automate deletion** — a scheduled job, not a human promising to remember.
- [ ] **Cover backups and archives**, not just live tables. Retention limits apply everywhere a copy lives.
- [ ] **Legal-hold exception path** — a row under litigation/regulatory hold is *skipped* by the deletion job, and the basis for the hold is documented.
- [ ] **Immutable audit log** — every deletion writes a record (what category, when, by which job) you can show a regulator.

```text
Bad:  A nightly cron deletes expired rows from the prod database.
Good: The deletion job covers prod + the data warehouse + backup snapshots;
      it skips any row flagged under legal hold; and it writes a deletion
      audit record (category, count, timestamp, job id) for every run.
```

The deletion *mechanics* — TTL columns, partition drops, soft-delete schema — belong to `../db-migrations/SKILL.md` and `../postgresdb/SKILL.md`. You write the *policy* that those mechanics must satisfy.

## AI reuse and cross-border transfers

State explicitly in the policy whether production data may be reused for **AI/model training**. GDPR purpose limitation (Art. 5(1)(b)) restricts reusing data collected for one purpose to train a model — that is a new purpose needing its own basis. The EU AI Act adds documentation and logging-retention duties, with high-risk obligations applying from **2 Aug 2026**; the Commission's Digital Omnibus proposal would let AI providers lean on legitimate interest for development with enhanced safeguards and an unconditional opt-out (TechGDPR; IAPP, 2026). Practical rule: the retention policy must say whether AI reuse is allowed, on what basis, and how a subject opts out.

For cross-border transfers, name the mechanism in the ROPA row (e.g. SCCs) and point to `../gdpr-privacy/SKILL.md` for the SCC/notice depth — that is its territory, not yours.

## The boundary

Retention periods are jurisdiction- and sector-specific, so a period you assert as final is legal advice you are not qualified to give — that is why this line has no exceptions. **You produce governance drafts, not legal sign-off.** Every policy you emit ends with a statement that a qualified DPO or privacy counsel must validate the schedule and lawful-basis register before adoption, and that this is not legal advice. You never assert a period is universally lawful.

Hand off the edges: public-facing privacy notice + data-subject access/erasure (DSAR) handling -> `../gdpr-privacy/SKILL.md`; audit posture, SOC 2 / ISO 27001, control mapping -> `../compliance/SKILL.md`; a negotiated DPA's contractual clauses or a two-party data contract -> `../contracts/SKILL.md`; encryption, access hardening, threat controls on the systems -> `../secure-coding/SKILL.md`; the actual deletion mechanics in the database -> `../db-migrations/SKILL.md` / `../postgresdb/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Consent as the default basis for everything | Consent is revocable; a withdrawal breaks contract-essential processing | Use contract / legal obligation / legitimate interest for operational data; reserve consent for marketing |
| "As long as necessary" / "indefinitely" as the only period | No concrete clock means nothing ever deletes — the classic paper policy | Give months/years or named criteria per category, validated against local law |
| Delete from prod but leave backups/archives untouched | The data regulators find is the copy you forgot | Deletion job must cover prod + warehouse + backups |
| No legal-hold exception in the auto-deletion job | The job destroys data under litigation hold — spoliation | Flag held rows; skip them; document the hold basis |
| Copy a generic retention template unchanged | Periods are jurisdiction/sector-specific; a copied period can be unlawful | Tag every period "validate vs local + sector law"; adjust |
| Emit the policy as final / "compliant" | Crosses into legal advice you can't give | End with DPO/counsel sign-off + not-legal-advice line |
