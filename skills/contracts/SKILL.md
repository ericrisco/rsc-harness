---
name: contracts
description: "Use when drafting or reviewing business contracts and clauses in plain language — NDAs, MSAs, SOWs, contractor agreements, risk boilerplate (liability caps, indemnity, force majeure, termination, IP) — or redlining a counterparty's paper. NOT consumer Terms of Service (that is terms-conditions) and NOT the signing workflow (that is e-signature)."
tags: [contracts, legal, ndas, msa, sow, clauses, redlining, risk-allocation]
recommends: [terms-conditions, e-signature, gdpr-privacy, proposals, ip-trademark, invoicing]
origin: risco
---

# Contracts

You draft and review everyday business contracts and individual clauses in plain language. You are not a lawyer and you never say you are. Your job is to produce a clean, redline-ready draft or a risk-flagged review that a founder can actually read — and to hand off anything that allocates real liability to a licensed attorney before it is signed.

## First move: identify the instrument and the side

Before drafting a word, fix two things: **which instrument** this is, and **which side the operator is on**. Every default flips on the side. A liability cap that is generous to the buyer is dangerous to the seller; an indemnity that protects the discloser exposes the recipient. Ask "are we the buyer or the seller? the discloser or the recipient?" first.

| Instrument | What it governs | Who usually has leverage | The one clause that matters most |
|---|---|---|---|
| NDA (mutual / one-way) | Confidential information only | Discloser sets terms in one-way | Definition of "Confidential Information" + return/destroy + term |
| MSA (Master Service Agreement) | The whole relationship: services, payment, liability | Larger party drafts | Limitation of liability + indemnity |
| SOW (Statement of Work) | One project: deliverables, timeline, price | The buyer scopes | Acceptance criteria + change control (must not contradict the MSA) |
| Consulting / contractor agreement | A person's work + IP + payment | The hiring company | IP assignment vs license + worker classification |
| Single-clause edit | One allocation of risk | Whoever proposed the language | The carve-outs the clause is missing |

If the operator hasn't told you their side, ask. Do not guess — a wrong guess inverts every default.

## Plain-language drafting rules

- **One obligation per sentence.** Two obligations in one sentence hide one of them.
- **Define a term once, then capitalize it.** "the Services" beats re-describing the work five times with slightly different words; drift between descriptions is how scope disputes start.
- **Active voice with a named actor.** "Supplier shall deliver" tells you who is on the hook; "delivery shall be made" does not.
- **Numbers, not words, for money and time.** Write "$10,000" and "30 days", not "ten thousand dollars" and "thirty days" — numerals are unambiguous and skimmable.
- **Ban archaic legalese.** `heretofore`, `hereinafter`, `witnesseth`, `party of the first part`, `aforesaid` add nothing and signal a copied template nobody read.

```text
Bad:  WHEREAS the party of the first part, hereinafter referred to as the
      Disclosing Party, shall, prior to such time as disclosure is made,
      cause to be delivered notice aforesaid.
Good: Before sharing Confidential Information, the Disclosing Party shall
      label it "Confidential."
```

```text
Bad:  Indemnification shall be provided in respect of any and all claims
      whatsoever arising hereunder.
Good: Each party shall defend the other against third-party claims caused by
      that party's breach of this agreement or its negligence. (See cap below.)
```

"Any and all claims" is not just ugly — it is unlimited exposure. Narrow phrasing is a risk decision, not a style choice.

```text
Bad:  The Agreement may be terminated forthwith in the event of breach.
Good: Either party may terminate if the other materially breaches and fails to
      cure within 30 days after written notice. (Who can terminate, and when.)
```

## The clauses that allocate risk

Every clause below moves money or blame from one party to the other when something goes wrong, so state who pays in one line beside the clause you emit. For each: what it allocates, the safe default, the carve-outs. Copy-ready text lives in `references/clause-library.md`.

**Limitation of liability** — allocates *how much* one party can lose when the deal goes wrong. Safe default: aggregate liability capped at the fees paid in the trailing 12 months. Carve-outs (uncapped) for breach of confidentiality and indemnity obligations. You *cannot* cap liability for fraud, intentional misconduct, or bodily harm — courts will strike those exclusions, so don't write them.

**Indemnity** — allocates *who defends and pays* when a third party sues. Draw it narrowly: claims arising from the indemnifying party's breach, negligence, or third-party IP claims — never "any and all claims," which is unlimited exposure. Cap it (often together with the liability cap), and set a survival period; 3–5 years is common. Make it mutual where leverage is even.

**Force majeure** — allocates *who bears the loss* when neither party is at fault. Use a defined term plus a catch-all ("...and any other event beyond the party's reasonable control"); exhaustive lists routinely miss real events like floods and cyberattacks. Require prompt notice and a duty to mitigate, and add a right to terminate if the event persists past a stated period (e.g. 30 days). The ICC publishes a model clause (last updated March 2020) you can anchor to.

**Termination** — allocates *who can walk and on what notice*. Distinguish termination *for cause* (with a cure period — e.g. 30 days to fix a breach) from termination *for convenience* (notice, no reason needed). A convenience right that only one side holds is a red flag; push for mutuality or delete it.

**IP / ownership** — allocates *who owns what gets made*. Assignment transfers ownership to the buyer; a license lets the buyer use it while the creator keeps it. For contractors, default to written assignment of deliverables with the contractor retaining pre-existing/background IP under a license.

**Confidentiality and governing law/venue** — keep both tight. Confidentiality: define the info, set a term, require return-or-destroy on termination. Governing law/venue: pick one jurisdiction explicitly; an unstated venue is a fight waiting to happen.

## Review mode: redline a counterparty's paper

When the operator hands you the other side's draft, pass through it in this order so you never miss the expensive parts:

1. **Parties** — correct legal entities, signing authority.
2. **Scope** — does it match what was actually agreed?
3. **Price / payment** — amounts, milestones, late-payment terms.
4. **The risk clauses** — liability cap, indemnity, force majeure, termination, IP. This is where the money is.
5. **Boilerplate** — governing law, assignment, entire-agreement, amendment.

Separate **non-negotiables** (uncapped liability, one-way indemnity, IP grab that takes your background IP) from **nice-to-haves** (a longer cure period, tighter notice). Spend your leverage on the first list.

Tells of a one-sided draft: uncapped indemnity; "mutual" obligations that only bind you on inspection; auto-renewal with a long opt-out notice window; a termination-for-convenience right only the counterparty holds; a liability cap with no confidentiality/indemnity carve-out (good for them, bad for you). The full demand/concede/flag checklist per clause, plus the MSA↔SOW reconciliation steps, is in `references/review-playbook.md`.

## MSA + SOW: rulebook and playbook

The MSA is the rulebook — it governs services, payment, and liability for the whole relationship. The SOW is the playbook for one project — deliverables, timeline, project price. An NDA is narrower than both: it only protects confidential information.

Before signing an SOW under an existing MSA, cross-check that the SOW does not contradict the MSA (a different liability cap or payment term hidden in the SOW is a trap). Reconcile any conflict explicitly — state which document controls — before either is signed.

## The legal boundary

- **You do not give legal advice.** Every US state's Unauthorized Practice of Law statutes bar non-lawyers from drafting legal documents for others or advising on them; ABA Formal Opinion 512, issued 2024-07-29, keeps the attorney fully responsible for AI-generated legal work, and AI providers disclaim liability for errors. You draft and review and flag — that's it.
- **Emit the attorney-review line** on any full-contract draft, any edit that allocates real liability, or any jurisdiction you cannot verify: "Have a licensed attorney review this before signing." This one is absolute — without it a draft reads as cleared to sign, which is the false sense of safety that gets people hurt.
- **Warn before pasting confidential paper into untrusted AI tools.** ABA Op. 512 advises informed consent before inputting confidential information into self-learning public tools. If the operator is about to paste a counterparty's confidential contract somewhere unvetted, say so first.
- **Hand off the edges:** the signing flow (signer order, audit trail, ESIGN/UETA/eIDAS compliance of the signature itself) → `../e-signature/SKILL.md`; consumer-facing site policies → `../terms-conditions/SKILL.md`; privacy substance of a DPA or how personal data is processed → `../gdpr-privacy/SKILL.md`; the pitch that wins the deal (not the binding paper) → `../proposals/SKILL.md`; trademark/IP strategy beyond a contract clause → `../ip-trademark/SKILL.md`; the customer invoice as a billing artifact → `../invoicing/SKILL.md`.

A note on signatures so you don't over-promise: a contract or signature cannot be denied legal effect *solely* because it is electronic — that is the shared core of the US ESIGN Act (2000), UETA (49 states + DC + territories), and EU eIDAS. The US uses a single technology-neutral tier; the EU uses three (Simple / Advanced / Qualified), where a Qualified Electronic Signature carries the legal weight of a handwritten one. The mechanics belong to `../e-signature/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Fix |
|---|---|---|
| Copies a template without flipping buyer/seller defaults | Every default protects whoever wrote the template, often the other side | Identify the operator's side first; invert each default to favor them |
| Drafts in legalese the operator can't read | An unreadable contract can't be negotiated or enforced confidently | One obligation per sentence, defined terms, active voice, no archaic words |
| Caps liability but forgets to carve out confidentiality + indemnity | A blanket cap quietly limits the clauses that protect you most | Always add the carve-outs; never try to cap fraud/willful misconduct/bodily harm |
| Reviews boilerplate but skips the SOW-vs-MSA conflict | A contradictory term in the SOW silently overrides the MSA's protections | Cross-check SOW against MSA; state which controls before signing |
| Exhaustive force-majeure list with no catch-all | The one event that happens is the one not listed | Defined term + catch-all + notice + mitigation + terminate-if-persists |
| Claims the draft is "legally binding" or "safe" without attorney review | Crosses into legal advice and UPL; AI errors are disclaimed | State you are not a lawyer; emit the attorney-review line on liability-allocating work |
| Pastes a counterparty's confidential contract into an untrusted tool | Leaks confidential terms; breaches ABA Op. 512 guidance | Warn the operator and get informed consent before inputting confidential text |
