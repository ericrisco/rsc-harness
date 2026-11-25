# Framework cheat sheets

Current as of 2026-06-02. Numbers and dates are load-bearing — verify against
the primary source before quoting them in an audit response.

## SOC 2

- Built on **five Trust Services Criteria**: **Security** (the only mandatory
  one, the "Common Criteria"), **Availability**, **Processing Integrity**,
  **Confidentiality**, **Privacy**. Most start with Security alone and add
  criteria as customers demand.
- **Type I** = controls suitably designed at a **point in time**.
- **Type II** = controls **operating effectively over a window**, typically
  **3–12 months**. This is what enterprise buyers want, and it is why
  point-in-time evidence is insufficient.
- Not a certification — an auditor's attestation report. Renewed annually.

## ISO/IEC 27001:2022

- **93 Annex A controls** in **four themes**: Organizational (37), People (8),
  Physical (14), Technological (34).
- The **2013 → 2022 transition deadline passed 31 Oct 2025** — all live
  certificates are now on the 2022 standard. Do not reference the old 114-control
  / 14-domain structure.
- Requires a documented ISMS, risk assessment, Statement of Applicability, and
  internal audit. A real certification (vs SOC 2's attestation).

## SOC 2 ↔ ISO 27001 overlap

- **~60–70% of controls overlap**: risk assessment, access management, incident
  response, logging, change management, vendor management all count toward both.
- Practical consequence: maintain **one control register**, tag each control to
  every framework it satisfies, and generate per-framework views. Do not keep
  parallel registers.

## EU AI Act

Phased application:

| Obligation | Date |
| --- | --- |
| Prohibited practices + AI-literacy | 2 Feb 2025 |
| GPAI-model obligations + governance + penalties | 2 Aug 2025 |
| Annex III (use-based) high-risk obligations | **2 Dec 2027** |
| Annex I (product-regulated, incl. medical devices) | 2 Aug 2028 |

High-risk obligations include conformity assessment, registration, risk
management, data governance, logging, and human oversight.

**Digital Omnibus on AI** — Regulation (EU) 2026/1744 (Official Journal
**24 Jul 2026**, in force **27 Jul 2026**) set the high-risk dates above, moving
Annex III from 2 Aug 2026 and Annex I from 2 Aug 2027. The deferral covers the
Chapter III high-risk obligations only; other obligations (e.g. transparency)
keep their own dates — check the consolidated text before scoping.

Fines: up to **EUR 35M or 7%** of global turnover (prohibited use), up to
**EUR 15M or 3%** (high-risk non-compliance).

## PCI DSS v4.0.1

- **Fully mandatory since 31 Mar 2025.** ~50 previously "best practice"
  future-dated requirements are now hard requirements, layered on the 12
  foundational requirements. Newly mandatory items include:
  - MFA for **all** accounts with access to the cardholder data environment.
  - Automated log review.
  - Internal vulnerability scanning.
  - Periodic account reviews.
  - A maintained hardware/software inventory.
- Scope is defined by where cardholder data is stored, processed, or transmitted
  — minimizing scope (e.g. tokenization, hosted payment pages) minimizes burden.

## HIPAA Security Rule (+ 2024 NPRM — forthcoming, not law)

- The current Security Rule is in force today.
- An **NPRM** (issued 27 Dec 2024, published in the Federal Register 6 Jan 2025,
  comment close 7 Mar 2025) proposes to:
  - Remove the **"required vs addressable"** distinction — nearly everything
    becomes required, with narrow exceptions.
  - Mandate **MFA** for ePHI access.
  - Require a written technology **asset inventory + network map**.
  - Patch **critical** risks in **15 days**, **high** in **30 days**.
  - Terminate workforce ePHI access within **1 hour** of departure.
  - If finalized, **240 days** to comply (covered entities 180 + business
    associates +60 for agreement updates).
- **As of mid-2026 the rule is still NOT finalized** — OCR received 4,700+
  comments and is still parsing them. But OCR has **begun citing the proposed
  standard in resolution agreements and enforcement**, so enforcement is already
  gravitating toward it. Scope to the current rule; prepare for the proposed one.

## DORA (Digital Operational Resilience Act)

- **In force since Jan 2025** for EU financial entities (and their critical ICT
  third-party providers). Four pillars: ICT risk management, incident reporting,
  digital operational resilience testing, and third-party (ICT) risk management.

## NIS2

- As of Mar 2026, **21 of 27 member states had transposed** it. Many set a first
  audit deadline of **30 Jun 2026**. Check the specific transposition for each
  member state you operate in — obligations vary in the national implementation.

## GDPR as a control source

GDPR is not "a checklist you certify against" — it feeds controls into your
register: lawful-basis records, access controls, breach-notification timelines,
vendor DPAs, and data-subject-rights handling. The *documents* (privacy notice,
ROPA, DSAR procedure) are drafted by `../gdpr-privacy/SKILL.md` and `../contracts/SKILL.md`;
here you only map them as evidence sources.
