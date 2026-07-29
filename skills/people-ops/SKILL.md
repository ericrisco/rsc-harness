---
name: people-ops
description: "Use when the offer is signed and you now have to run the person — an onboarding plan from preboarding through the 30/60/90 ramp, drafting or auditing an internal policy or handbook section, standing up the recurring people rhythm (1:1s, review and goal cycles, headcount), or offboarding a leaver. NOT sourcing, interviewing or the offer itself (that is `hiring`)."
tags: [people-ops, hr, onboarding, employee-handbook, policy, offboarding, one-on-ones, retention]
recommends: [hiring, contracts, gdpr-privacy, sop-builder, project-ops, e-signature]
origin: risco
---

# People-ops

You run the people function as a steady operation, starting the moment a candidate says yes. Three jobs, no more: **onboard** the new hire, **write the policies** that govern them, and **run the people rhythm** so it does not live in one founder's head. The identity line: the offer is signed — now get this person productive, write the policies that bind them, and keep the team's people-rhythm running.

One hard line sits above everything: **you begin at offer-signed.** Sourcing, screening, interviewing, scoring, and the offer itself are not yours — they belong to `../hiring/SKILL.md`. You also do not write the binding instruments. The employment contract, NDA, and IP-assignment are `../contracts/SKILL.md`; the handbook you write explicitly *is not* a contract. Employee-data privacy and GDPR record-handling are `../gdpr-privacy/SKILL.md`. A generic non-people process doc (how we deploy, how we close the books) is `../sop-builder/SKILL.md`; a cross-function team ritual is `../project-ops/SKILL.md`. When the work crosses one of those lines, hand off — do not improvise legal text or a deploy runbook under the banner of "HR."

## The four moments (the spine)

Every request lands in one of four moments. Find the moment first; it tells you the artifact to produce.

| The moment | Trigger | Artifact you produce |
|---|---|---|
| **Preboarding** | Offer just signed, start date set | Preboarding checklist — paperwork + access requests pulled *forward* (fact 3) |
| **Day 1** | Person starts today | Day-1 checklist — access live, equipment ready, intros; **no form marathon** |
| **Ramp (30/60/90)** | First quarter | A 30/60/90 plan framed learn → contribute → own, with named **manager** moves |
| **Ongoing rhythm** | Recurring | Weekly 1:1 + review/goal cadence; headcount + who-owns-what |
| **Exit** | Someone is leaving | Offboarding checklist — same-day access revocation, knowledge handoff, exit conversation |

Do not skip backward. If a founder asks for a 30/60/90 but preboarding never happened, say so — the plan assumes Day 1 already went right.

## Onboarding

The first 90 days decide retention, and almost nobody plans them. ~20% of organizations report half their new hires leave within the first 90 days; only ~29% run a structured 90-day program (Enboarder 2025 HR Leader survey, accessed 2026-06-02). A structured plan is the cheapest retention you will ever buy.

**Pull paperwork into preboarding — protect Day 1.** ~40% of onboarding time is eaten by compliance tasks; e-signature, pre-filled forms, and self-service enrollment cut that from a day to under an hour (Pin / Kayako onboarding guides, accessed 2026-06-02). Send forms, equipment order, and account-provisioning requests in the days *before* the start date. Day 1 is then about people — the team, the manager, the first real task — not a desk of forms. Route the e-signature mechanics to `../e-signature/SKILL.md`.

**The 30/60/90, framed learn → contribute → own:**

- **Days 1–30 — learn.** Tools, codebase/product, who's who, the team's norms. One small shipped thing by day 30 so the win is real, not theoretical.
- **Days 31–60 — contribute.** Owns a small recurring responsibility; pairs less; gives feedback on a process.
- **Days 61–90 — own.** Carries a deliverable end-to-end; the ramp is a fact, not a hope.

**Name the manager's moves — this is the biggest lever.** Active manager engagement makes a new hire ~3.4x more likely to report an exceptional onboarding experience, yet only ~18% discuss performance goals with their manager in the first 90 days (Gartner, 3,400 hires, via Asana, accessed 2026-06-02). So the plan must say what the *manager* does, not just HR:

- Day 1: a real welcome and the first concrete task (not "settle in").
- Week 1: the **goals conversation** — what good looks like at 30/60/90.
- Assign a **buddy** (peer, not the manager) for the "dumb question" channel.
- **Weekly 1:1 from week one** — the habit that holds the rest together (see rhythm).

A plan with no named manager and no goals conversation is HR talking to itself. The full preboarding / Day-1 checklists and a 30/60/90 with separate manager and new-hire columns live in `references/templates.md`.

## Day-1 legal clock (US — confirm your jurisdiction)

> **Confirm the jurisdiction before you write a date.** The table below is **US**. The EU, UK, and most countries differ, and many are **not at-will** — do not copy this clock into a non-US plan. Defer the actual employment contract to `../contracts/SKILL.md` and employee-record privacy to `../gdpr-privacy/SKILL.md`.

In the US the Day-1 clock is hard-dated, and the fines are per-form (SHRM / USCIS / E-Verify, accessed 2026-06-02):

| Step | Deadline | Who |
|---|---|---|
| I-9 **Section 1** | On or before the first day of work (may be done after acceptance) | Employee |
| I-9 **Section 2** | Within **3 business days** of hire | Employer |
| **E-Verify** case (where used) | By the **3rd business day** | Employer |

Paperwork errors run **$288–$2,861 per form** — which is exactly why the I-9 belongs in preboarding for Section 1 and on the calendar for Section 2, not improvised on a busy first morning.

## Writing policy / the employee handbook

A handbook is **"not a contract" only if it says so and avoids contractual language.** Courts treat handbooks as implied contracts when they promise guaranteed employment or rigid progressive discipline (MRA / HRMorning / Mosey, accessed 2026-06-02). Required guardrails on every handbook you draft (US at-will — many countries are not at-will; flag it):

1. An explicit **at-will + "this is not a contract"** disclaimer.
2. A **signed acknowledgment** the employee returns.
3. **No mandatory terms** — avoid "will / must / shall guarantee," rigid step-by-step discipline you must follow.
4. **Re-acknowledge with a version + date** on every material change.

**The minimum-viable handbook is a known short list** (SCORE / Gusto / TalentHR guides, accessed 2026-06-02): equal-opportunity / anti-harassment, attendance + work hours, PTO + sick leave, confidentiality, technology / acceptable use, a disciplinary process, and the signed acknowledgment. Add **remote/hybrid even if you have no remote staff today** — you will.

Every policy uses the same skeleton so they read consistently and have an owner: **purpose → scope → rule → exceptions → owner → effective date.** A policy with no owner and no date is already stale.

**Remote-work framing — privilege, not right, with concrete conditions** (Workable / SHRM, accessed 2026-06-02). State it as a privilege the company can revoke; then make it concrete: a dedicated workspace + confidentiality, company-approved and secured devices, availability during core hours. Conduct rules must address hybrid-specific issues — e.g. personal messaging apps vs corporate tools.

The Bad→Good that decides whether your handbook becomes an accidental contract:

```text
Bad:  The Company shall guarantee continued employment and shall follow the
      three-step disciplinary process below before any termination.
Good: Employment is at-will: either you or the Company may end it at any time,
      with or without cause or notice. This handbook is a guide, not a
      contract, and does not promise employment for any period. Where used,
      progressive discipline is at the Company's discretion and may be
      skipped. (See your signed acknowledgment.)
```

"Shall guarantee" and a *mandatory* discipline ladder are the two phrases that hand a plaintiff an implied-contract argument. Full minimum-viable section list with a one-line drafting note each, plus the at-will/acknowledgment boilerplate (carrying its jurisdiction caveat), are in `references/templates.md`.

## The operating rhythm

The people rhythm is layered, and the **weekly 1:1 is the non-negotiable**. Skip the weekly check-in and the quarterly goals quietly collapse back into once-a-year behavior (Peoplebox / WorkBoard / OKR Institute, accessed 2026-06-02).

| Cadence | Frequency | Length | What it is |
|---|---|---|---|
| **1:1** | Weekly | 15–30 min | Coaching, not evaluation — blockers, growth, feedback both ways |
| **Check-in / review** | Monthly or quarterly | 30–45 min | Progress against goals; lightweight written |
| **Goal cycle** | ~90 days | — | 2 objectives × 3–4 key results per sub-function |

A 1:1 agenda skeleton that keeps it coaching, not status: **wins → blockers → growth → feedback both ways** (you ask for feedback on yourself too — that is what makes the channel real). Let the report own the agenda; you own showing up.

**Offboarding** is the moment most teams botch. Revoke access **same-day** — accounts left live for days are the security hole and the awkward-Slack-message problem. Then: knowledge handoff (what only this person knew, written down before they go), return of equipment, and an honest exit conversation (why they're leaving — the one piece of retention data you can't buy). Full checklist in `references/templates.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Fix |
|---|---|---|
| Day 1 is a paperwork marathon | Burns the one day that should build belonging; ~40% of onboarding time is compliance | Pull forms + access into preboarding; Day 1 is people + first task |
| Handbook says "shall guarantee" / mandates a fixed discipline ladder | Hands a plaintiff an implied-contract argument; the handbook stops being "not a contract" | At-will + not-a-contract disclaimer, signed acknowledgment, discretionary discipline |
| No manager named in the onboarding plan | The 3.4x retention lever goes unused; HR talks to itself | Name the manager's moves: Day-1 task, week-1 goals talk, buddy, weekly 1:1 |
| Assumes US law everywhere | I-9/E-Verify and at-will are US-specific; most countries are not at-will | Confirm jurisdiction first; flag the clock as US-only; hand the contract to `../contracts/SKILL.md` |
| Ships a generic SOP and calls it a people policy | A deploy runbook is not a people policy; wrong skeleton, wrong owner | Use purpose→scope→rule→exceptions→owner→date; SOPs go to `../sop-builder/SKILL.md` |
| Skips weekly 1:1s, relies on the annual review | Quarterly goals collapse into once-a-year behavior | Protect the weekly 1:1; it is the non-negotiable that holds the rhythm |
| Offboarding leaves access live for days | Security hole + awkward access nobody owns | Revoke access same-day; then handoff, equipment, exit conversation |
| Writes the employment contract or privacy notice as "HR work" | Crosses into binding legal text / a statutory data regime | Contract → `../contracts/SKILL.md`; employee-data privacy → `../gdpr-privacy/SKILL.md` |

## References

- `references/templates.md` — copy-ready, fill-in material offloaded from the spine: full preboarding / Day-1 / offboarding checklists; a 30/60/90 table with separate manager and new-hire columns; the minimum-viable handbook section list with a one-line drafting note each; the at-will + not-a-contract + acknowledgment boilerplate (with jurisdiction caveat); a 1:1 agenda template; a quarterly review template.
