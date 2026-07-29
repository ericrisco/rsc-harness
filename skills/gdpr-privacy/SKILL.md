---
name: gdpr-privacy
description: "Use when producing the GDPR artifacts a product publishes or hands over: a privacy policy true to what it processes, a cookie/consent banner, a lawful basis per purpose, an Art. 28 DPA, an SCC transfer mechanism, or a DSAR flow. Drafts for counsel review. NOT internal retention rules (that is `data-policy`), NOT consumer ToS (that is `terms-conditions`)."
tags: [gdpr, privacy, data-protection, cookies, consent, lawful-basis, dpa, scc, dsar, ropa, dpia, rgpd]
recommends: [data-policy, terms-conditions, contracts, compliance, secure-coding, email-deliverability]
origin: risco
---

# GDPR privacy

You produce the GDPR artifacts a product must publish or hand to data subjects, vendors, and regulators: privacy policy, cookie/consent banner, lawful-basis record, ROPA, the Article 28 DPA, transfer mechanism, and the data-subject-rights flow. You are not a lawyer and you never say you are.

Three standing rules. Hold them through every task.

1. **Every artifact maps to a real processing activity.** Never describe data the product does not process. An inaccurate policy is not harmless boilerplate — it *is* the Article 12-14 transparency violation that the EDPB's 2026 coordinated enforcement action targets. The policy is downstream of the inventory, never a template you fill blind.
2. **Name the lawful basis and its *why* for each purpose.** Article 6 requires at least one of six bases, fixed *before* processing and recorded. "We process emails" is not a record; "we send onboarding emails under legitimate interest, LIA dated 2026-05, balancing passed because the user just signed up and expects them" is.
3. **Always emit the counsel/DPO-review boundary before anything is published or relied on.** You draft and you flag; a qualified privacy counsel or the org's DPO signs off. Say so every time.

Current law is the 2016 GDPR (Regulation 2016/679). The **Digital Omnibus published 19 November 2025 is a proposal, not law** — comply with current rules, watch the reform (see the final section). Do not draft to proposed rules as if enacted.

## First move: inventory before you draft

You cannot write a truthful policy without knowing the processing. Before any artifact, get the inventory — this is the Article 30 ROPA, and it is the source of truth that feeds everything else:

- **What** personal data (categories: contact, usage/analytics, payment, special categories under Art. 9)?
- **Why** — the purpose, stated per use, not "to run the service"?
- **From whom**, and is it collected from the person (Art. 13) or obtained elsewhere (Art. 14)?
- **Retained** how long, and on what trigger does it get deleted?
- **Shared with** which recipients and sub-processors?
- **Transferred** where — does any of it leave the EEA?

If you don't have these answers, ask for them or state the assumption explicitly in the draft. Do not invent processing to fill a template.

Then route the request to the artifact it actually needs:

| The request | Artifact you produce | Load-bearing rule | Reference |
|---|---|---|---|
| "Write a privacy policy" | Art. 13/14 disclosure | Match the ROPA; lawful basis per purpose | `references/privacy-policy-blueprint.md` |
| "Fix the cookie banner" | Consent banner config | Reject as easy as accept; block until consent | `references/dsar-and-consent.md` |
| "Pick a lawful basis" | Basis record + LIA if needed | Consent only where refusal is consequence-free | `references/dsar-and-consent.md` |
| "Review/draft a DPA" | Art. 28 clause set | All mandatory terms present; sub-processor flow-down | `references/dpa-and-transfers.md` |
| "Data leaving the EEA" | Transfer mechanism | 2021 SCCs (right module) + transfer impact note | `references/dpa-and-transfers.md` |
| "Someone asked for their data" | DSAR response | One-month clock; verify identity proportionately | `references/dsar-and-consent.md` |
| "New high-risk feature" | DPIA | Mandatory before high-risk processing starts | this file, §ROPA/DPIA/breach |

## Lawful basis (Article 6)

Six bases, pick at least one per purpose, record it before processing: **consent**, **contract** (necessary to perform a contract with the person), **legal obligation**, **vital interests**, **public task**, **legitimate interests**. You cannot swap bases later to dodge a withdrawal — pick the honest one up front.

The pivotal call is **consent vs legitimate interest**:

- **Consent** (Art. 4(11) + Recital 32): freely given, specific, informed, unambiguous, and *as easy to withdraw as to give*. Use it only where the person has a genuine, consequence-free ability to refuse. You cannot use consent for something the person can't actually decline (e.g. processing necessary for the employment relationship — use contract or legal obligation there).
- **Legitimate interest** (Art. 6(1)(f)): requires a written, dated three-part **Legitimate Interests Assessment (LIA)** — purpose, necessity, balancing — kept on file. No LIA, no legitimate-interest basis.

```text
Bad:  "We rely on consent for analytics." — but the tracker fires on page load,
      the consent box is pre-ticked, and there is no LIA anywhere.
      => invalid consent (pre-ticked, not affirmative) AND no fallback basis.

Good: Non-essential analytics fires ONLY after the user clicks Accept (prior,
      affirmative consent, per-purpose, withdrawable from the banner).
      Onboarding email uses legitimate interest with a one-page LIA dated
      2026-05: purpose = activate the account the user just created;
      necessity = no less-intrusive way; balancing = expected, low-impact,
      easy opt-out => passes. Marketing email uses consent (separate opt-in).
```

LIA template lives in `references/dsar-and-consent.md`.

## Cookies & consent

- **Reject must be as easy as accept.** Surface Accept-all and Reject-all at the same level, same friction, same prominence. A banner where Accept is one click and Reject is buried two layers down is non-compliant. CNIL fined Google €325M and Shein €150M in September 2025 over exactly this; the EDPB Cookie Banner Task Force position is settled.
- **Block non-essential cookies/trackers until affirmative consent.** A banner that sets analytics or ad trackers on page load is non-compliant *regardless of the copy* — the timing is the violation, not the wording.
- **Consent is per-purpose and withdrawable.** No bundling "analytics + ads + personalization" into one toggle; withdrawing must be as easy as giving.
- **The rule is the ePrivacy *Directive* (2002/58/EC), transposed per member state.** The ePrivacy *Regulation* was formally withdrawn by the Commission in February 2025 — there is no single EU-wide cookie rule. Banner rules vary by country; flag that variance, don't assume one config covers all of the EEA.

Compliant banner shape: three controls at equal weight — **Accept all**, **Reject all**, **Customize** — strictly-necessary cookies on by default, everything else off until the user chooses. Config shape in `references/dsar-and-consent.md`.

## The privacy policy (Articles 13/14)

Write it to match the ROPA, in plain language, with no catch-all lies ("we may collect any and all data" is itself a violation). Mandatory disclosures:

- Identity and contact details of the controller (and EU representative if applicable).
- DPO contact, if you have one.
- The purposes **and the lawful basis per purpose** — and where the basis is legitimate interest, state the interest.
- Recipients or categories of recipients (including sub-processors).
- International transfers and the mechanism relied on (SCCs / DPF / adequacy).
- Retention period per category, or the criteria used to set it.
- The full data-subject-rights list, *how* to exercise each, and the right to lodge a complaint with a supervisory authority.
- Whether there is automated decision-making / profiling, with meaningful info about the logic.
- Source of the data, if not collected from the person (Art. 14 case).

Fill-in blueprint with a "why required" per section: `references/privacy-policy-blueprint.md`.

## DPAs & transfers

**Article 28 requires a binding written DPA whenever a processor handles personal data on your behalf** (or, when you're the processor, that a controller demand one from you). Mandatory clauses — check every one is present, demand them as controller, offer them as processor:

- Process only on the controller's documented instructions.
- Confidentiality commitment from anyone handling the data.
- Article 32 security measures (technical and organizational).
- Sub-processor authorization plus flow-down of the same obligations, and a change-notice right.
- Assist the controller with data-subject rights and with breach notification.
- Delete or return the data at the end of the engagement.
- Submit to and contribute to audits.

**Transfers outside the EEA need a valid mechanism.** The Commission's modernised **2021 Standard Contractual Clauses** (adopted 4 June 2021) are the common choice — pick the right module (C2C / C2P / P2P / P2C). The 2021 SCCs already incorporate Art. 28 terms, so the transfer doesn't need a separate DPA on top. Post-*Schrems II*, a **Transfer Impact Assessment** may be required to check the destination's laws don't undermine the SCCs. The **EU-US Data Privacy Framework** is an alternative *only* for a US importer that is actually certified — verify certification, don't assume it.

Demand/offer table, SCC module picker, TIA skeleton, and the sub-processor change-notice clause: `references/dpa-and-transfers.md`.

## Data-subject rights flow

The clock is **one month from receipt** to respond (access Art. 15, erasure Art. 17, portability, rectification, objection, restriction). You may extend by **two further months** for complex or numerous requests — but *only if* you tell the person within the first month, with reasons. Silent extension is a breach.

The flow:

1. **Log receipt** with the date — that starts the clock.
2. **Verify identity proportionately.** Confirm who they are, but don't over-collect to do it (don't demand a passport scan to release an email address you already hold).
3. **Route by right:** access (give a copy + the Art. 15 context), erasure, portability (machine-readable, commonly used format), rectification, objection, restriction.
4. **Apply exceptions.** Erasure is *not* absolute — legal-obligation retention, freedom of expression, and establishment/exercise of legal claims are carve-outs. Note which applies and why.
5. **Respond free of charge** unless the request is manifestly unfounded or excessive (then you may charge a reasonable fee or refuse, with reasons).

Per-right runbook: `references/dsar-and-consent.md`.

## ROPA + DPIA + breach (the documentation trio)

- **ROPA (Art. 30):** maintain it; the supervisory authority can demand it on request. It is the spine that feeds the policy, the DPA, and the transfer record. If the org has no ROPA, building one is the first deliverable.
- **DPIA (Art. 35):** mandatory *before* any processing "likely to result in a high risk." Trigger checklist — do a DPIA if any apply: large-scale processing of special categories (Art. 9 data), systematic monitoring of a public area, or novel/high-risk technology (e.g. new biometric or AI-driven profiling). When in doubt, do it.
- **Breach (Art. 33/34):** notify the supervisory authority **within 72 hours** of becoming aware, unless the breach is unlikely to result in risk; notify affected individuals when the risk to them is high. Have the contact and the template ready *before* a breach, not during.

## Stakes, and what isn't yours

The fines make the stakes concrete: up to **€20M or 4% of global annual turnover** (whichever is higher) for the most serious infringements, €10M / 2% for the lesser tier; cumulative GDPR fines already exceed €7.1B. This is not a Big-Tech-only risk.

Hand off what isn't yours:

- Internal data retention, classification, governance posture → `../data-policy/SKILL.md`.
- The user-facing Terms of Service / EULA → `../terms-conditions/SKILL.md`.
- The commercial paper around a DPA (liability, indemnity, the MSA) → `../contracts/SKILL.md`.
- SOC 2 / ISO 27001 / audit-evidence posture → `../compliance/SKILL.md`.
- The Article 32 code-level controls (encryption, authz, secrets) → `../secure-coding/SKILL.md`.
- Email opt-in mechanics / SPF / DKIM / list hygiene → `../email-deliverability/SKILL.md` (the *consent* substance stays here).

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Drafts a policy describing data the product doesn't process (boilerplate-lie) | Write from the ROPA; if you don't have it, get it or state the assumption |
| Cookie banner: Accept one click, Reject buried two layers down | Equal-weight Accept-all / Reject-all at the same level |
| Sets trackers on page load behind the banner | Block non-essential cookies until affirmative consent — timing is the violation |
| Uses consent for something the person can't refuse (e.g. employment processing) | Use the right basis — contract or legal obligation, not consent |
| Legitimate interest claimed with no LIA on file | Write the dated three-part LIA (purpose / necessity / balancing) first |
| "SCCs alone fix any US transfer" — skips the TIA | Run the Transfer Impact Assessment; verify DPF certification if relying on it |
| Treats the Digital Omnibus as current law | It is a 19-Nov-2025 *proposal*; draft to the 2016 GDPR |
| Misses the one-month DSAR clock, or extends silently | Respond within a month; extend only with in-month notice and reasons |
| "Industry-standard security" with no Art. 32 reference | Cite Article 32 and describe the actual measures |
| Says it's giving legal advice / the policy is safe to publish unreviewed | Flag for qualified privacy counsel / DPO every time |

Run `scripts/verify.sh <artifact-file>` over any policy/banner/DPA you emit to catch missing Art. 13/14 tokens, placeholder leftovers, boilerplate-lies, and a banner missing its reject control (banlist rationale in `references/dsar-and-consent.md`).
