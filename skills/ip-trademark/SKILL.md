---
name: ip-trademark
description: "Use when a non-lawyer operator needs to protect a brand or creative work — clearing and choosing a name or logo, deciding whether and where to register a trademark, using the trademark and registered symbols correctly, knowing what copyright is automatic, or checking whether they own work a freelancer was paid for. NOT drafting the IP-assignment clause itself (that is `contracts`)."
tags: [intellectual-property, trademark, copyright, licensing, legal-compliance]
recommends: [contracts, brand-identity, compliance, terms-conditions]
origin: risco
---

# IP & trademark triage

You are a practical IP triage partner for a founder or operator, not their
lawyer. Your job is to figure out **which right is in play**, tell them what
they get for free versus what registration buys, and produce concrete
artifacts: a clearance checklist, a "do we own this?" audit, a correct
symbol-usage table. You do not draft the binding clause and you do not pretend
to be counsel.

**Prime directive: triage the right first, then protect it.** Most operator
confusion is naming the wrong right. Fix that in one sentence before anything
else. Anything that creates a registrable right, allocates ownership in a
signed contract, or assesses infringement exposure ends with: *get a licensed
IP attorney before you rely on this.*

## Step 1 — name the right

Every request maps to one of three buckets. Route on the operator's own words.

| The thing they care about | The right | Routing question that lands here |
|---|---|---|
| A name, logo, slogan — how customers identify the source | **Trademark** | "Can we use / register this name or logo?" |
| The creative expression itself — logo *artwork*, code, copy, photos, video | **Copyright** | "Do we own this asset? Can we stop a copy?" |
| An idea, a method, "how it works", a feature | **Patent / none** — out of scope | "Can we protect the *idea* / the way it works?" |

Trademark protects the *identifier*; copyright protects the *expression*; ideas
and functionality are patents (and most operator ideas are not patentable).
When it lands in the third bucket, say so plainly and stop — do not improvise
patent strategy.

## Step 2 — free vs. registered

What you get the moment you create or use something, vs. what costs money and
buys real remedies.

- **Copyright exists automatically on creation/fixation.** The moment an
  original work is written down or saved, the author holds copyright. No filing
  needed to *own* it.
- **Trademark rights can arise from use**, but an unregistered mark is weak and
  local. Registration is what gives teeth: nationwide notice, presumption of
  validity, the ® symbol, customs help.
- **The §412 timely-registration gate is the one operators miss.** In the US,
  statutory damages ($750–$30,000 per work, up to $150,000 if willful) *and*
  attorney's fees are available **only if the work was registered before the
  infringement began, or within 3 months of first publication** (17 U.S.C.
  §412). Miss the window and you are limited to hard-to-prove actual damages.

Bad → Good:
- Bad: "We'll register the copyright if someone actually copies us."
- Good: "Register the asset that matters within 3 months of first publishing
  it, so statutory damages and fees stay on the table."

## Step 3 — trademark: clear, then file

The order is non-negotiable: **clear before you adopt, register before you
flaunt the ®.**

1. **Clearance search.** Look for confusingly similar marks in *each* target
   jurisdiction — USPTO search (formerly TESS) for the US, EUIPO eSearch for the
   EU. Search within the relevant class of goods/services, not just exact
   spelling. A clean search is not a legal opinion; flag that a knockout search
   misses common-law and phonetic conflicts.
2. **Pick the class(es).** Registration is by Nice classification class of
   goods/services. The same word in two unrelated classes can coexist. Each
   extra class costs another fee.
3. **Pick the jurisdiction(s).** Trademark is territorial — a US registration
   gives **zero** EU rights and vice versa. File where you actually sell or will
   sell.
   - **US (USPTO):** one base fee of **$350 per class** (Section 1/44
     applications) since the fee structure changed **18 January 2025**. Watch
     surcharges: +$100/class for insufficient base info, +$200/class for a
     free-form (non-ID-Manual) identification, +$200 per extra 1,000 characters.
   - **EU (EUIPO):** basic online EUTM application is **€850 for one class**,
     +€50 for the second class, +€150 per class from the third onward. Renewal
     mirrors the application fee.
   - Filing in many countries → Madrid Protocol; Spain → OEPM. See
     `references/jurisdictions.md`.
4. **Symbols.** Use ™ immediately; use ® only after the mark is federally
   registered (see the table below).

### Symbol & notice usage

| Symbol | Means | When you may use it |
|---|---|---|
| ™ | Claiming rights in a **product** mark | Anyone, any time, registered or not |
| ℠ | Claiming rights in a **service** mark | Anyone, any time, registered or not |
| ® | **Federally registered** mark | ONLY after the registration issues |
| © year, holder | Copyright notice (e.g. `© 2026 Acme S.L.`) | Any time on your own work; optional but useful |

**Using ® before registration is a false claim of registration** — it can be
deemed deceptive, treated as fraud on the public, and *jeopardize your own
enforcement*. Until the certificate issues, it is ™ (or ℠ for services), full
stop.

## Step 4 — ownership: the contractor trap

This is the one that bites hardest, so audit it explicitly.

**Default rule: the creator owns the copyright. Paying for the work does not
transfer it.** An independent contractor who designs your logo, writes your
code, or shoots your photos owns the copyright by default. The hiring party
gets ownership **only** via:

- a **signed written copyright assignment**, or
- a **work-made-for-hire** agreement that *also* falls within the 9 statutory
  categories (17 U.S.C. §101) — and most logo/code/website work does **not**
  fit those categories, so an explicit assignment is the reliable path.

(Employees differ: an employer owns work created within the scope of
employment. Contractors do not get that treatment.)

**AI-generated output:** US copyright requires **human authorship**. Fully
AI-generated output is not copyrightable, and prompts alone — however detailed —
do not confer authorship (U.S. Copyright Office, *Copyright and Artificial
Intelligence, Part 2: Copyrightability*, early 2025). Human selection,
arrangement, or substantial modification of AI output *can* be protected,
case by case. So an AI-only mascot or hero image may not be yours to enforce.

### "Do we own this?" checklist

- [ ] Was the asset (logo, code, copy, design) made by an employee or a
      contractor? Contractor → ownership did **not** transfer by default.
- [ ] Is there a **signed** written assignment of copyright (or a valid WMFH for
      a qualifying category)? An invoice or "paid in full" note is not an
      assignment.
- [ ] Does the assignment cover *all* deliverables and revisions, not just the
      final file?
- [ ] Were any portions AI-generated? Flag that those portions may not be
      protectable, and that the contractor cannot assign rights they never had.
- [ ] If ownership is unclear → get the signed assignment now; route the *clause
      wording* to contracts.

Bad → Good:
- Bad: "We paid the agency, so the logo is ours."
- Good: "We have a signed assignment from the agency covering the logo and all
  source files; without it, default is that they still own it."

## Step 5 — licensing basics

- **Notice format:** `© <year> <legal name>` (e.g. `© 2026 Acme S.L.`). Optional
  but it dates your claim and signals ownership.
- **License vs. assignment:** a **license** keeps ownership and grants someone
  permission to use (scope, term, territory, exclusivity matter); an
  **assignment** transfers ownership outright. Decide which you mean before you
  paper it.
- For the contractor audit walkthrough, assignment-vs-WMFH detail, AI-authorship
  nuance, notice formats, and a license-at-a-glance table (all-rights-reserved,
  Creative Commons variants, common code licenses), see
  `references/ownership-and-licensing.md`.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|---|---|---|
| Putting ® on a mark that isn't registered | False claim of registration; can be deceptive and undermine enforcement | Use ™ (or ℠) until the registration certificate issues |
| "We paid for it, so we own it" | Contractor owns copyright by default; payment ≠ transfer | Get a signed written assignment covering all deliverables |
| Treating one registration as worldwide | Trademark is territorial — US ≠ EU | File in each jurisdiction where you sell; consider Madrid Protocol |
| Registering before clearing | You can spend the fee and still infringe an earlier mark | Run a clearance search per jurisdiction and class *first* |
| Shipping AI-only output and assuming you own the copyright | No human authorship = not copyrightable | Add human authorship/modification, or accept it may be unprotectable |
| "We'll register the copyright later if needed" | Misses the §412 window for statutory damages + fees | Register within 3 months of first publication of the asset that matters |

## Boundaries — route these out

- **Drafting or redlining the IP-assignment clause, NDA, or contractor
  agreement** → `../contracts/SKILL.md`. That skill owns the *words* that
  transfer or license IP; this skill owns the *strategy around* them.
- **Building the brand asset itself** — logo brief, color/type tokens, brand
  book → `../brand-identity/SKILL.md` (creating the asset, not protecting it).
- **A general regulatory/legal-obligations program** not specific to IP →
  `compliance`.
- **Website Terms of Service / EULA / acceptable-use** → `terms-conditions`;
  **privacy policy / personal-data handling** → `gdpr-privacy`.
- **Getting the finished assignment signed** (signer flow, audit trail) →
  `e-signature`.

**Always:** before anyone relies on a registration, an ownership conclusion, or
an infringement call, get a licensed IP attorney. You triage and prepare; a
lawyer makes it binding.
