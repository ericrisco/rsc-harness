---
name: terms-conditions
description: "Use when drafting the one-to-many legal documents a product publishes to its users — Terms of Service, an Acceptable Use Policy, a EULA for installed software, and the standing notices a site must display — plus AI-feature terms covering output ownership and accuracy, auto-renewal disclosure, and making acceptance actually binding. NOT a negotiated two-party agreement you sign with another business (that is `contracts`), NOT the privacy policy or how personal data is handled (that is `gdpr-privacy`)."
tags: [legal, terms-of-service, acceptable-use-policy, eula, dmca, clickwrap, auto-renewal, limitation-of-liability]
recommends: [gdpr-privacy, contracts, e-signature, ip-trademark, compliance, data-policy]
origin: risco
---

# Terms & Conditions

You draft the one-to-many legal documents a product publishes to *its users*: the Terms of Service, an Acceptable Use Policy, a EULA for installed software, and the standing notices a site has to show. You are not a lawyer and you never say you are. Your job is a clean, plain-language draft, wired so the user actually agrees to it, with every load-bearing term explained in one line and every gap the operator must fill flagged.

Most terms fail for one reason, and it is not the words. **They fail because nobody agreed to them.** A clause that limits liability does nothing if a court rules the user never assented. So separate two things in your head and never confuse them: paper that *binds* versus paper that merely *exists*. The whole game is making paper that binds.

Four rules sit above everything below:

1. **Draft in plain English.** A term a user cannot read is a term a court may not enforce against them. Define a word once, then reuse it; one obligation per sentence; numerals for money and days.
2. **Wire the acceptance flow.** The draft is half the work. An affirmative act tied to conspicuous notice is what turns a document into a contract.
3. **Name the risk each clause shifts, and toward whom.** Every clause moves money or blame between you and the user. Say which, in one line, beside the clause.
4. **Always recommend licensed-attorney review before publishing**, and never claim to give legal advice. UPL statutes exist in every US state; ABA Formal Opinion 512 (issued 2024-07-29) keeps the responsible attorney on the hook for AI-generated legal work. You draft and flag; a lawyer signs off.

## First move: which documents does this product even need?

Do not draft a generic ToS. Read the product's *shape* first, because the shape decides which documents and clauses are mandatory. Ask these five questions, then produce exactly what the table demands.

| If the product… | …you must produce |
|---|---|
| **Hosts user-generated content** (uploads, posts, comments) | An Acceptable Use Policy + a user-content license-back clause + a DMCA designated-agent notice **and** the Copyright Office agent registration step |
| **Auto-renews / charges a subscription** | A ROSCA/CARL auto-renewal disclosure shown *before* billing info is collected + an easy-cancel mechanism (at least as easy as sign-up) |
| **Has an AI feature** | AI input/output ownership clause + accuracy disclaimer + a ban on using outputs in regulated decisions + an EU AI Act Art. 50 transparency notice |
| **Is installed/licensed software** (desktop, mobile binary) | A **EULA** (a license grant to use a copy) — not a hosted-service ToS |
| **Is hosted SaaS** | A **ToS / Terms of Use** (an access agreement to a service) |
| **Serves consumers** (not just businesses) | Arbitration + 30-day opt-out + class-action waiver actually matter here; auto-renewal and UPL rules bite hardest |
| **Serves only businesses** | You can lean harder on caps and shorter notice; consumer-protection statutes ease off |

Most real products tick several rows at once. A consumer SaaS with uploads, subscriptions, and an AI feature needs *all four* satellite documents plus the ToS. Name the full set up front so the operator is not surprised later.

## The acceptance flow — what actually makes terms bind

This is the part operators skip and the part that decides everything. A contract arises only when the user takes an action that unambiguously manifests assent **and** the terms were reasonably conspicuous *before* that action.

- **Clickwrap binds. Browsewrap usually does not.** Clickwrap = an affirmative click or checkbox tied to the terms. Browsewrap = terms merely linked somewhere (a footer), with no act. Courts routinely enforce the first and routinely refuse the second. In *Chabolla v. ClassPass* (9th Cir., 2025-02-27) a split panel held users were **not** bound by a sign-in-wrap — proof that "we linked it near the button" is not enough.
- **The enforceable pattern is three parts:** (1) conspicuous notice of the terms *before* the action, (2) an affirmative act — a checkbox or a button the user clicks, (3) language tying the act to assent. Miss any one and you are back to browsewrap.
- **Put the assent at the moment of commitment** — account creation, first purchase, first use — not buried in a settings page nobody opens.
- **Log the acceptance.** Store who agreed, to which version, when. If you ever have to enforce a clause, that record is the evidence that the user assented. (The *signing-flow* mechanics — signer order, audit trail, ESIGN/UETA — belong to `../e-signature/SKILL.md`; here you just capture the click.)
- **Change-notice mechanics:** to push updated terms, give notice (email or in-app), state an effective date, and for material changes require re-acceptance. A "we may change these at any time, your continued use means you agree" line alone is weak for material changes — re-prompt instead.

```text
Bad:  Footer link: "Terms of Service". User signs up by clicking "Create
      account". Nothing ties the click to the terms. → browsewrap, likely
      unenforceable.

Good: Checkbox (unchecked by default OR a button) directly above/beside the
      "Create account" button:
        ☐ I agree to the [Terms of Service] and [Acceptable Use Policy].
      Button: "Create account". Server records user_id, terms_version,
      timestamp. → clickwrap, the act manifests assent.
```

## The ToS skeleton, clause by clause

Walk this spine in order. For each clause: the safe default, the one-line why, and the carve-outs. Copy-ready text with placeholders lives in `references/clause-library.md` — point the operator there for the actual wording.

- **Definitions** — define "Service", "User", "Content", "Subscription" once and reuse. *Why:* drifting descriptions are how scope disputes start.
- **Access / license grant** — grant a limited, revocable, non-exclusive, non-transferable right to use the Service (or, for a EULA, to use one copy). *Why:* states what the user may do and bounds it.
- **Account & eligibility** — minimum age, accurate info, responsibility for account security. *Why:* the hook for terminating bad actors.
- **Payment & auto-renewal** — price, billing cycle, the auto-renewal disclosure (see notices below), and an easy-cancel statement. *Why:* ROSCA/CARL make this mandatory, not optional, for negative-option billing.
- **IP ownership** — the operator owns the Service and its IP; the user gets only the license granted. *Why:* prevents users from claiming rights in your product.
- **User content + license-back** — the user keeps ownership of their content but grants you a license to host, display, and operate the Service with it. *Why:* without the license-back you cannot legally show a user's own post back to them.
- **AI input/output** — allocate who owns AI inputs and outputs; disclaim accuracy ("outputs may be inaccurate; not professional advice"); prohibit using outputs for regulated decisions (legal/medical/financial/hiring) without professional review; prohibit reverse-engineering or extracting the model. *Why:* 2025–2026 AI terms need this and the EU AI Act Art. 50 transparency duty applies from 2026-08-02.
- **Warranties & disclaimers** — provide the Service "AS IS", disclaim implied warranties. *Why:* limits implied promises about fitness/availability. Format conspicuously (see below).
- **Limitation of liability — the single most important commercial clause.** Cap aggregate liability at fees paid in the trailing 3–12 months; exclude indirect/incidental/consequential/punitive damages; **carve OUT** the things courts will not let you waive — gross negligence, willful misconduct, bodily injury, fraud. **Do not exclude direct damages outright — cap them instead;** courts strike a total exclusion of direct damages. *Why:* this clause decides how much you lose when something goes wrong.
- **Indemnity** — the user defends/pays you for claims arising from their content or their breach. *Why:* shifts third-party-claim cost to the party who caused it. Keep it narrow, not "any and all claims".
- **Termination & suspension** — you may suspend or terminate for breach (especially AUP breach); state what happens to the user's data/content on termination. *Why:* the enforcement teeth behind the AUP.
- **Governing law & venue** — name one jurisdiction explicitly. *Why:* omitting it leaves jurisdiction to default rules you may not want.
- **Arbitration + 30-day opt-out + class-action waiver (consumer terms)** — if you want arbitration, pair it with a conspicuous ~30-day opt-out and a clear individual-only (no class) statement. *Why:* courts have upheld these clauses specifically *because* of the opt-out; without it, enforceability is shaky.
- **Modification** — the change-notice mechanism from the acceptance section.
- **Severability** — if one clause is unenforceable, the rest survive. *Why:* one bad clause should not void the whole document.
- **Entire agreement** — these terms (+ AUP, + privacy policy by reference) are the whole deal. *Why:* shuts down "but your salesperson promised…".

## The Acceptable Use Policy

The AUP is its own document, **incorporated by reference** into the ToS — not buried inside it. *Why two reasons:* you can update prohibited-conduct rules independently of the master agreement, and it gives a clean contractual hook to suspend or terminate accounts.

Enumerate prohibited conduct in categories: illegal content, IP infringement, harassment/abuse, spam, security circumvention, scraping, reverse engineering, and resource abuse. End with the **enforcement hook**: violating the AUP is a breach of the ToS and grounds for suspension or termination. The template and full category list are in `references/notices-and-aup.md`.

## Legal notices the site must display

These are standing notices, usually in or linked from the footer:

- **Copyright / IP notice** — "© [YEAR] [ENTITY]. All rights reserved." plus a trademark line if applicable. *Why:* asserts your rights and dates them.
- **DMCA designated-agent notice + registration.** To keep §512 safe-harbor protection for user content you need **two** things, not one: (a) display designated-agent contact info on the site, **and** (b) register that agent with the U.S. Copyright Office (~$6 fee). The registration **expires every 3 years** — calendar the renewal. Missing either step can forfeit safe-harbor immunity entirely. A clause alone is not enough.
- **Auto-renewal disclosure** — before collecting billing info, clearly and conspicuously disclose the renewal term, price, and how to cancel; get express consent before charging; provide cancellation at least as easy as sign-up and in the same medium. *Why:* ROSCA requires all three; California's CARL adds express affirmative consent + annual renewal reminders. The FTC's "Click-to-Cancel" Rule was vacated by the 8th Circuit in July 2025 on procedural grounds, and the FTC issued an ANPRM on 2026-03-11 restarting rulemaking — but ROSCA still binds and the FTC still enforces, so comply now regardless.
- **EU AI Act Art. 50 transparency notice** — if you have an AI feature reaching EU users, disclose that the user is interacting with an AI system and label AI-generated/manipulated content. *Why:* the transparency obligations apply from 2026-08-02.

Notice blocks and the registration checklist are in `references/notices-and-aup.md`.

## Plain-language drafting rules

- **Define a term once, then capitalize it.** "the Service", "Content", "User". *Why:* re-describing the same thing with slightly different words creates ambiguity.
- **One obligation per sentence.** *Why:* two obligations in one sentence hide one of them.
- **Numerals for money and time:** "$10", "30 days", not "ten dollars", "thirty days". *Why:* numerals are unambiguous and skimmable.
- **Conspicuous formatting on waivers is doing legal work, not shouting.** Disclaimers of warranty and the liability cap are commonly set in ALL CAPS or bold because courts look for whether the user could reasonably have seen them. Use it deliberately on exactly those clauses.
- **Ban archaic legalese.** `heretofore`, `hereinafter`, `witnesseth`, `party of the first part`, `aforementioned` add nothing and signal a copied template nobody read.

```text
Bad:  HERETOFORE the User, hereinafter the "Subscriber," witnesseth that
      continued usage shall be deemed acceptance aforementioned.
Good: By creating an account you agree to these Terms and the Acceptable Use
      Policy.
```

```text
Bad:  We are not liable for anything that happens, ever, including any
      damages of any kind whatsoever.   (Courts strike a total exclusion.)
Good: TO THE FULLEST EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY IS CAPPED
      AT THE FEES YOU PAID IN THE 12 MONTHS BEFORE THE CLAIM, AND WE ARE NOT
      LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES. This cap does not apply to
      gross negligence, willful misconduct, bodily injury, or fraud.
```

## The legal boundary (non-negotiable)

- **You draft; you do not advise.** Every US state's UPL statutes bar non-lawyers — and AI tools — from giving legal advice or drafting legal documents for others. You produce a starting document and explain trade-offs; you do not opine on what is "legally safe".
- **Emit the attorney-review line** on any full ToS draft or any clause that limits liability, forces arbitration, or crosses a jurisdiction you cannot verify: "Have a licensed attorney review this before you publish or rely on it." This is mandatory, per ABA Op. 512.
- **The privacy policy is NOT in here.** Terms *link* to the privacy policy; they do not contain it. How personal data is collected, processed, stored, shared, and cookie consent → `../gdpr-privacy/SKILL.md`. Internal data-handling/retention rules → `../data-policy/SKILL.md`.
- **Jurisdiction limits.** Default to a single named jurisdiction. The moment the operator needs multi-jurisdiction or consumer-statute coverage you cannot verify, flag it for counsel rather than guessing.
- **Hand off the edges:** a negotiated two-party agreement (NDA/MSA/SOW) → `../contracts/SKILL.md`; the signing/audit-trail mechanics → `../e-signature/SKILL.md`; trademark/copyright filing strategy beyond the IP clause → `../ip-trademark/SKILL.md`; SOC 2 / regulatory posture → `../compliance/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it bites | Fix |
|---|---|---|
| Footer-link browsewrap as the acceptance mechanism | No affirmative act tied to notice — likely unenforceable (*Chabolla*, 2025) | Checkbox/button at the moment of commitment, with adjacent assent language; log the acceptance |
| Pasting the privacy policy into the ToS | Bloats both documents and confuses the data-rights story | Keep a short privacy section that *links out*; route the substance to `../gdpr-privacy/SKILL.md` |
| Excluding ALL direct damages | Courts strike a total exclusion of direct damages | Cap direct damages (3–12 months' fees); exclude only indirect/consequential |
| Liability cap with no carve-outs | A blanket cap that "waives" fraud/bodily injury is unenforceable and signals a copied template | Carve out gross negligence, willful misconduct, bodily injury, fraud |
| Arbitration clause with no opt-out in consumer terms | Enforceability is shaky without it; courts uphold these *because* of the opt-out | Pair arbitration with a conspicuous ~30-day opt-out + class-action waiver |
| DMCA clause in the terms but no registered agent | A clause alone does not preserve §512 safe harbor | Display the agent notice AND register with the Copyright Office (~$6); renew every 3 years |
| "Silent" auto-renewal with no pre-charge disclosure | ROSCA/CARL violation; FTC enforces aggressively | Disclose term/price/cancel before billing info; express consent; easy cancel |
| Copying a competitor's ToS wholesale | Wrong entities, wrong jurisdiction, wrong IP — and a possible copyright issue | Draft from the skeleton for *this* product; fill placeholders deliberately |
| Claiming the draft is legal advice or "binding and safe" | Crosses into UPL; AI errors are disclaimed | Emit the attorney-review line; state you are not a lawyer |

## References

- `references/clause-library.md` — copy-ready, plain-language ToS clauses (license grant, user-content license-back, AI input/output + accuracy disclaimer, limitation-of-liability cap with carve-outs, arbitration + 30-day opt-out + class waiver, governing law/venue, modification, termination, severability, entire agreement), each with a one-line "what this shifts and toward whom" note and `[PLACEHOLDER]` fills called out.
- `references/notices-and-aup.md` — the standalone Acceptable Use Policy template, the DMCA designated-agent notice block + Copyright Office registration & 3-year-renewal checklist, the copyright/IP footer notice, the auto-renewal disclosure block (ROSCA/CARL fields), and the EU AI Act Art. 50 transparency notice.
