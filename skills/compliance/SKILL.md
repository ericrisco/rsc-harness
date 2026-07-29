---
name: compliance
description: "Use when scoping which regulatory frameworks bind a business — SOC 2, ISO 27001, HIPAA, PCI DSS, EU AI Act, DORA, NIS2 — building a control register with owners and evidence, or standing up the cadence that keeps it audit-ready. NOT drafting privacy-policy/ROPA/DPA or ToS text (that is gdpr-privacy, terms-conditions), NOT hardening code (that is secure-coding)."
tags: [compliance, soc2, iso27001, audit-readiness, controls, governance]
recommends: [gdpr-privacy, terms-conditions, data-policy, contracts, secure-coding]
origin: risco
---

# Compliance — scope the frameworks, build the register, run the rhythm

You turn a vague "we need to be compliant" into artifacts that survive an audit:
a scoped framework list with current deadlines, a **control register** (one row
per control, tagged to every framework it satisfies, each with an owner and an
evidence source), a **cadence calendar** of the recurring work that keeps the
program true between audits instead of scrambling once a year, and an
evidence-source catalog.

Your job is **scoping and orchestration, not legal opinion**. You map the
business to the frameworks, build the register, assign owners and cadences, and
stand up the rhythm. You do not give legal advice; flag where a licensed
specialist or auditor must sign off.

**Route out** — these are owned by siblings, not by you. You *reference* the
resulting documents as evidence sources in the register; you do not write them
here.

- Privacy notice, ROPA, DSAR flow, consent banner → `../gdpr-privacy/SKILL.md`.
- Terms of Service, EULA, acceptable-use → `../terms-conditions/SKILL.md`.
- Internal retention/classification policy *text* → `../data-policy/SKILL.md`.
- Commercial contract / MSA / DPA clause drafting → `../contracts/SKILL.md`.
- Hardening the code (authn, secrets, injection, headers) →
  `../secure-coding/SKILL.md`.

## Step 1 — Scope to the frameworks that actually bind

Do not copy a framework because a competitor has it. Map business attributes to
obligations. Ask the operator the attribute questions, then apply this table.

| Business attribute | Framework that binds | Current deadline / status (as of 2026-06-02) |
| --- | --- | --- |
| Sells SaaS to enterprise / asked for a security report | SOC 2 (Security TSC mandatory) | Type II window 3–12 months; pick scope before you start |
| Wants an internationally recognized ISMS certificate | ISO/IEC 27001:2022 | 93 Annex A controls, 4 themes; 2013→2022 transition deadline **passed 31 Oct 2025**, all live certs are 2022 |
| Stores / processes / transmits cardholder data | PCI DSS v4.0.1 | **Fully mandatory since 31 Mar 2025** — ~50 former "best practice" items (MFA on all CDE accounts, automated log review, internal vuln scans, periodic account reviews, asset inventory) are now hard requirements |
| Touches US protected health information (PHI/ePHI) | HIPAA Security Rule | In force today. A **2024 NPRM is NOT yet finalized** (mid-2026) — flag forthcoming, but note OCR is already citing the proposed standard in enforcement |
| Handles personal data of EU/EEA users | GDPR (as a control source) | In force; feeds controls (access, breach notice, vendor DPAs). Document *text* → `../gdpr-privacy/SKILL.md` |
| Builds or deploys an AI system, esp. high-risk use | EU AI Act | Phased — see below; **2 Aug 2026 is the active legal date** for Annex III high-risk |
| Is an EU financial entity (or critical ICT vendor to one) | DORA | **In force since Jan 2025** — ICT risk mgmt, incident reporting, resilience testing, third-party risk |
| Operates essential/important services in the EU | NIS2 | Transposed in 21/27 member states by Mar 2026; many set a first audit deadline of **30 Jun 2026** |

**EU AI Act — get the dates exactly right (high audit risk):**

- Prohibited practices + AI-literacy: **2 Feb 2025**.
- GPAI-model obligations + governance + penalties: **2 Aug 2025**.
- Annex III (use-based) high-risk obligations: **2 Aug 2026**.
- Annex I (product-regulated, incl. medical devices): **2 Aug 2027**.
- The **Digital Omnibus on AI** (provisional trilogue agreement **7 May 2026**)
  proposes deferring Annex III to **2 Dec 2027** and Annex I to **2 Aug 2028** —
  but this is **NOT yet adopted**. Until the amendment is published in the
  Official Journal, **2 Aug 2026 remains binding.** Plan to the original date;
  flag the deferral as forthcoming-not-final.
- Fines: up to **EUR 35M or 7%** of global turnover (prohibited use), up to
  **EUR 15M or 3%** (high-risk non-compliance).

**Rule: treat a not-yet-adopted amendment or an NPRM as forthcoming, never as
law.** Why: scoping to a draft that slips leaves you out of compliance on the
date that is actually still in force. See `references/frameworks.md` for the
per-framework control summaries.

## Step 2 — Build the control register

One row per control. The register is the source of truth; everything else
(checklists, audit responses, the cadence calendar) is generated from it.

| Column | What goes in it |
| --- | --- |
| `control-id` | Stable internal id, e.g. `AC-02` |
| `framework` | Every framework this control satisfies (multi-tag) |
| `owner` | A named person/role accountable — never "the team" |
| `evidence` | The exact artifact that proves it, and where it lives |
| `cadence` | How often it is reviewed, sized by risk |
| `last-verified` | Timestamp of the last attestation |
| `status` | `met` / `gap` / `in-progress` |

**Bad → Good control:**

```text
Bad:  "We do access control."        (no owner, no proof, not testable)
Good: AC-02 | ISO A.5.18 + SOC2 CC6.2 + PCI 7.2 | owner: Head of IT |
      evidence: quarterly IdP access-export reviewed & signed |
      cadence: quarterly | last-verified: 2026-05-30 | status: met
```

The Good row is auditable: an auditor can ask the owner for the dated export and
verify the claim in minutes.

**Exploit the overlap — one control, many frameworks.** SOC 2 and ISO 27001
overlap **~60–70%** (risk assessment, access management, incident response,
logging, change management, vendor management all count toward both). So:

- **Bad:** maintain a separate register per framework → the same control gets
  re-documented 3 times and drifts out of sync.
- **Good:** one register, each control tagged to *all* frameworks it satisfies.
  Generate the per-framework checklist as a filtered view.

## Step 3 — Stand up the operating rhythm

Audit-readiness is a continuous state, not an annual project. Emit a cadence
calendar and put the recurring work on real dates with owners.

| Cadence | Recurring compliance work |
| --- | --- |
| Daily | Automated control monitoring / alerting (failed logins, drift) |
| Weekly | **Control-health review** — the heartbeat: walk open gaps, stale evidence, overdue owners |
| Monthly | Evidence refresh for high-risk controls; vulnerability-scan review |
| Quarterly | Access recertification; vendor/third-party risk reassessment |
| Annual | Full risk assessment; policy review; penetration test; audit prep |

The **weekly control-health review** is the single habit that kills the annual
scramble. Why: a gap caught weekly is a five-minute fix; a gap discovered during
the audit window is a finding. The full calendar, register schema, and
audit-prep runbook live in `references/operating-rhythm.md`.

## Step 4 — Evidence discipline

Evidence is what an auditor tests. Every piece must be:

- **Timestamped** — undated evidence proves nothing about *when* the control ran.
- **Mapped to the requirement** — link the artifact back to the framework clause
  (e.g. this export proves `ISO A.5.18` *and* `SOC2 CC6.2`).
- **Owner-attested** — the named owner signs/confirms it, so accountability is
  traceable.
- **Refreshed on cadence** — point-in-time evidence rots; a screenshot from last
  year does not prove a control operated *over* the audit window (Type II tests
  operating effectiveness across 3–12 months, not a single moment).

Store evidence where it is findable on demand, not assembled in a panic the week
before the auditor arrives.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| Checklist with no owners | "Everyone's job" means no one's job; the auditor asks who, and the room goes silent | Every control names one accountable owner |
| Copying a framework you don't fall under | Wastes months certifying SOC 2 when the binding obligation was PCI DSS | Scope from business attributes (Step 1) first |
| Treating an NPRM / not-yet-adopted amendment as law | The draft slips; you're non-compliant on the date still legally in force | Plan to the active date; flag drafts as forthcoming |
| Point-in-time evidence | A single screenshot can't prove a control operated over the Type II window | Timestamped, periodic, owner-attested evidence |
| One register per framework | Same control re-documented 3× and drifts; the 60–70% overlap is wasted | One register, each control multi-tagged |
| Annual evidence scramble | Gaps surface as audit findings instead of weekly fixes | Weekly control-health review + cadence calendar |
| Drafting the privacy policy / DPA here | That's legal-document substance, a different skill's lane | Route to `../gdpr-privacy/SKILL.md` / `../contracts/SKILL.md` |
| Giving a legal opinion | You scope and orchestrate; you are not counsel | Flag where a licensed specialist or auditor must sign off |

## Verify

`scripts/verify.sh <register>` lints a control register (Markdown table or CSV):
it checks the required columns exist and that no row is missing an owner,
evidence, or cadence — the cardinal sin of checklist theater. Read-only, exits 0
on a clean or empty register.
