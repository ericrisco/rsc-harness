---
name: invoicing
description: "Use when issuing an invoice, quote, or credit note and moving it draft-to-paid — the legally required VAT fields, gap-free numbering, per-country e-invoicing mandates, dunning overdue ones. NOT recording a paid invoice in the books (that is `bookkeeping`), NOT Stripe SDK plumbing (that is `stripe`), NOT setting the price (that is `pricing`)."
tags: [invoicing, billing, vat-invoice, dunning, accounts-receivable, e-invoicing, quotes, credit-note]
recommends: [bookkeeping, stripe, pricing, contracts, proposals, e-signature, webhooks, finance-ops]
origin: risco
---

# Invoicing — cut the document, run the lifecycle, get paid

You own the billing document and its collection lifecycle: what must be on the page for a tax authority to accept it, how it moves from draft to paid, and how to chase money politely-then-firmly without breaking the law.

The whole job is three moves: **cut a valid document → run its lifecycle → get it paid.** Skip the validity step and the customer can't deduct the VAT. Skip the lifecycle and you lose track of who owes what. Skip the chase and you work for free.

## Route out before you start

This skill answers "make a valid bill and collect it." When the ask is something else, stop and route:

| The ask | Goes to |
| --- | --- |
| Record a paid invoice in the books, reconcile it to the bank line | `../bookkeeping/SKILL.md` |
| Wire up the Stripe SDK, keys, or `invoice.paid` webhook as code | `../stripe/SKILL.md` / `../webhooks/SKILL.md` |
| Decide what to charge — rate card, margin, price list | `../pricing/SKILL.md` |
| Draft the MSA / SOW / engagement terms the invoice bills against | `../contracts/SKILL.md` |
| Write the pre-sale pitch that persuades before money is owed | `../proposals/SKILL.md` |
| Get a signature on a document | `../e-signature/SKILL.md` |
| Runway / P&L / cash-flow cadence | `../finance-ops/SKILL.md` |

Sharpest near-miss: "reconcile this paid invoice / record it in the accounts" reads invoicing-shaped but is **bookkeeping**. The moment money is *recorded against the books*, it leaves your hands.

## Pick the right document first

Before anything, decide which document you are issuing — they use different number sequences and carry different obligations.

| Document | Use when | Number sequence | Creates a payment obligation? |
| --- | --- | --- | --- |
| Quote / estimate (presupuesto, pressupost) | Before work starts, to propose a price | Its own quote series (not the invoice series) | No — it is an offer, not a debt |
| Invoice (factura) | Work delivered or goods supplied, money is owed | The continuous invoice series | Yes |
| Proforma | A "please-pay-this" preview that is not yet a tax document | Not the invoice series | No — not a fiscal invoice |
| Credit note / corrective (factura rectificativa) | To cancel or reduce an invoice already sent | Its own corrective series, **referencing the original number** | Reduces an existing obligation |

Never delete or renumber a finalized invoice to fix it — issue a corrective that points back at the original (see the lifecycle rule below).

## The legally-valid invoice checklist

An EU VAT invoice that won't let the customer deduct VAT is a broken invoice. Every one of these must be present (source: European Commission VAT Invoicing rules, accessed 2026-06-02):

- [ ] **Issue date** (and supply date if different from issue date).
- [ ] **Unique sequential invoice number** — continuous, gap-free, chronological.
- [ ] **Supplier** name + address + **VAT number**.
- [ ] **Customer** name + address (+ VAT number for B2B / reverse-charge).
- [ ] **Description** of goods or services supplied.
- [ ] **Net amount per VAT rate** (the taxable base).
- [ ] **The VAT rate(s)** applied and **the VAT amount** per rate.
- [ ] **Total** payable.
- [ ] **Any required legend** — "reverse charge", "VAT exempt", "self-billing" — where it applies.
- [ ] **Due date + payment terms** (see lifecycle below — no due date means no basis to chase).

Sequential numbering is **law, not style**. The number must be unique and the series continuous across all invoice types (B2B, B2C, OSS/IOSS, reverse charge). The why: a gap-free chronological sequence is the audit trail that proves no invoice was hidden or invented. Corrective invoices reference the original's number inside their own corrective series.

```text
Bad   2024-001, 2024-002, 2024-004      ← 003 is missing → auditor asks "what did you delete?"
Bad   INV-5, EST-6, INV-7               ← quote EST-6 must not consume an invoice slot
Good  2024-001, 2024-002, 2024-003      ← continuous invoice series
Good  REC-2024-001 → refs invoice 2024-002   ← corrective points back, own series
```

## Jurisdiction gate — a PDF is not always legal anymore

The EU is moving from "any readable invoice" to **structured e-invoices** (machine-readable XML, EN 16931 semantic model, Peppol BIS transport). A PDF — even a perfect one — is *not* a structured e-invoice. Gate every new invoice: **which country + B2B/B2G/B2C + by what date** (source: Fiskaly/Fonoa e-invoicing roadmaps; EC eInvoicing country pages; accessed 2026-06-02):

- **Belgium** — structured B2B mandatory **1 Jan 2026** (now in force).
- **France** — phased from **Sep 2026**; DGFiP is the national Peppol Authority.
- **Germany** — businesses > EUR 800k turnover by **1 Jan 2027**, all businesses 2028.
- **Spain** — two *separate* mandates: **Verifactu** (tamper-evident software, chained-hash records, mandatory QR on every invoice) in force **1 Jan 2027** for corporate-tax payers; **Crea y Crece** (structured B2B e-invoice in UBL/Facturae/CII/EDIFACT with acceptance + payment-date reporting) phased from ~Oct 2026, large firms ~Oct 2027.
- **Italy / Poland** — SdI and KSeF clearance models already live.
- **EU-wide hard deadline** for intra-EU B2B/B2G structured e-invoices under ViDA: **1 Jul 2030**.

If the customer is in a country past its mandate date, do **not** email a PDF — generate the structured format. Full per-country table with formats and endpoints: `references/e-invoicing-mandates.md`.

## The lifecycle and its states

Every invoice moves through a fixed set of states. Track which state each one is in — that is your accounts-receivable.

| State | Meaning | Action to move it forward |
| --- | --- | --- |
| `draft` | Not yet issued; editable | Finalize → assigns the sequential number |
| `open` / sent | Finalized and delivered; awaiting payment | Send, then watch the due date |
| overdue | Past due date, still open | Start the dunning ladder |
| `paid` | Settled in full | Hand off to `../bookkeeping/SKILL.md` to record |
| `void` | Cancelled **before** any payment | Void (keeps the number; never delete) |
| `uncollectible` | Written off after collection failed | Mark; consider a credit note |

The rule that catches people: **you never delete a finalized invoice.** To fix a sent invoice you `void` it (if unpaid) or issue a **credit note / corrective** (if it was wrong or partially paid). Deleting it leaves a gap in the number series — the same audit flag as fraud.

## The dunning ladder — chase politely, then firmly

Overdue invoices get a **day-based cadence with escalating tone**, not random nagging. The skeleton (full bilingual templates in `references/dunning-ladder.md`):

- **D-0** — at issue, a friendly confirmation: amount, due date, how to pay.
- **D+1** (after due date) — short, neutral reminder: "this may have slipped past."
- **D+7** — firmer, restate the amount and the original due date.
- **D+15** — invoke the statutory lever explicitly (see below).
- **D+30** — final notice before escalation to collections / legal.

Your legal lever (source: EU Directive 2011/7/EU on late payment; EC Late Payment page; accessed 2026-06-02): for B2B/B2G commercial invoices, default payment term is **30 days** (extendable to 60 for B2B). On default, **statutory interest accrues automatically at the ECB reference rate + at least 8 percentage points**, plus a **fixed EUR 40 recovery-cost compensation per invoice**, owed *without proof of cost*. From D+15 you may state this in writing — it is the difference between begging and invoking a right.

## Programmatic path via Stripe (only when automation is wanted)

When the user wants invoices sent by software rather than by hand, use Stripe. SDK is **stripe-node v19.1.0**; invoice status enum is `draft → open → paid | uncollectible | void` (source: Stripe API Reference; context7 /stripe/stripe-node v19.1.0; accessed 2026-06-02).

```javascript
// 1. add line items to the customer, then 2. create the invoice
await stripe.invoiceItems.create({
  customer: customerId,
  amount: 120000,          // cents — 12h consulting @ EUR 100/h
  currency: 'eur',
  description: '12h consulting',
});

const invoice = await stripe.invoices.create({
  customer: customerId,
  collection_method: 'send_invoice', // email the customer (vs charge_automatically)
  days_until_due: 30,                // due-date / payment terms
});

// 3. finalize assigns the sequential number, 4. send emails it
await stripe.invoices.finalizeInvoice(invoice.id);
await stripe.invoices.sendInvoice(invoice.id);
```

Quotes follow `draft → finalize (assigns number) → accept`, which auto-generates the invoice. Dunning/retry on `charge_automatically` invoices is handled by Stripe **Smart Retries** (ML-timed, retry window ~1 week to 2 months) — you do not hand-build the retry loop. For the integration plumbing itself — keys, idempotency, the `invoice.paid` webhook — hand to `../stripe/SKILL.md` and `../webhooks/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
| --- | --- | --- |
| Reusing or skipping an invoice number | Gap/duplicate in the series is an audit flag | One continuous gap-free series; void, don't delete |
| Letting a quote consume an invoice number | Pollutes the fiscal series with non-debts | Separate quote series; only finalized invoices take invoice numbers |
| Deleting a finalized invoice to "fix" it | Creates a number gap = looks like concealment | Void if unpaid, else issue a credit note referencing it |
| Emailing a PDF where structured e-invoice is mandated | A PDF is not EN 16931 / Peppol — legally non-compliant | Check the jurisdiction gate; emit the structured format |
| No due date / no payment terms | No basis to claim overdue or interest | Always set due date + terms (default 30 days B2B/B2G) |
| Chasing payment with no statutory basis | Weak, easily ignored | From D+15 cite ECB+8pp interest + EUR 40 fixed cost |
| Omitting the per-rate VAT breakdown | Customer can't deduct VAT; invalid invoice | Net + rate + VAT amount per rate, plus total |
| Recording the payment in the books yourself | Wrong skill, double-entry not your job | Hand the paid invoice to `../bookkeeping/SKILL.md` |
