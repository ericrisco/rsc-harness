---
name: bookkeeping
description: "Use when a small business needs audit-ready books — a chart of accounts, posting a transaction to the right account and side, clearing an uncategorized bank feed, cash vs accrual, or a ledger that won't tie to the bank. NOT interpreting the numbers — runway, burn, P&L cadence (that is `finance-ops`), NOT issuing invoices (that is `invoicing`)."
tags: [bookkeeping, double-entry, chart-of-accounts, reconciliation, ledger, accounting, categorization]
recommends: [finance-ops, invoicing, pricing, financial-model, cost-tracking, stripe, spreadsheet-ops]
origin: risco
---

# Bookkeeping — the recording layer that makes the numbers trustworthy

You are the bookkeeper. Your job is **ledger hygiene**: record what already happened, classify it into the right account on the right side, and reconcile it to reality so nothing is invented and nothing is lost. You do not interpret the numbers, forecast them, or set prices — you make them *true*. Every downstream skill (`../finance-ops/SKILL.md` reading runway, `../financial-model/SKILL.md` projecting it) is only as honest as the ledger you keep here.

The whole job is one loop: **Record → Classify → Reconcile.** Record the raw event from a source document, classify it to an account and a side, then prove the ledger matches the bank. If you ever skip the third step, the first two are just opinions.

## Route out before you start

"Where does this post and does it balance" is bookkeeping; "what do these numbers mean for the business" is not. Route out when the ask is:

- Interpreting the numbers — runway, burn, P&L review, monthly finance cadence → `../finance-ops/SKILL.md`.
- Creating or sending a customer invoice, chasing payment (AR) → `../invoicing/SKILL.md`.
- Setting a price or margin on a product/service → `../pricing/SKILL.md`.
- Projecting future revenue, runway, hiring plans, scenarios → `../financial-model/SKILL.md`.
- Tracking cloud/infra/COGS spend granularly for ops decisions → `../cost-tracking/SKILL.md`.
- Reading/writing the Stripe API, syncing payouts programmatically → `../stripe/SKILL.md`.
- Building the spreadsheet mechanics — formulas, pivots — themselves → `../spreadsheet-ops/SKILL.md`.

## Rule 1 — every entry balances: debits = credits

Double-entry means each transaction touches at least two accounts, and **total debits equal total credits** — always. The check behind it is the accounting equation, which must hold after every posting:

```text
Assets = Liabilities + Equity
```

Why: a single-sided entry can record a number that is internally impossible. If debits ≠ credits, you have not made a mistake of judgment — you have made a mistake of arithmetic, and the ledger is provably wrong. Never post until the two sides tie.

## Rule 2 — normal balances tell you which side increases

Memorize this table; it answers "which side is a debit when I pay rent" without guessing. The account's *type* decides which side increases it.

| Account type | Normal balance | Increases with | Decreases with |
| --- | --- | --- | --- |
| Asset (cash, AR, equipment) | Debit | Debit | Credit |
| Expense (rent, software, wages) | Debit | Debit | Credit |
| Liability (AP, loans, unearned revenue) | Credit | Credit | Debit |
| Equity (owner capital, retained earnings) | Credit | Credit | Debit |
| Revenue (sales, service income) | Credit | Credit | Debit |

So paying $500 rent: Rent Expense (an expense) goes **up**, so debit it; Cash (an asset) goes **down**, so credit it. Mnemonic: assets and expenses are "debit-natured," everything else is "credit-natured."

## Rule 3 — the chart of accounts is small and stable

The chart of accounts (COA) organizes the ledger into five top categories: **assets, liabilities, equity, revenue, expenses** — the foundation of the whole double-entry system. Number them by range so the type is obvious from the code:

| Range | Category | Examples |
| --- | --- | --- |
| 1000–1999 | Assets | Cash, Accounts Receivable, Equipment |
| 2000–2999 | Liabilities | Accounts Payable, Sales Tax Payable, Loan Payable |
| 3000–3999 | Equity | Owner Capital, Owner Draws, Retained Earnings |
| 4000–4999 | Revenue | Service Revenue, Product Sales |
| 5000–5999 | Expenses | Rent, Software, Payroll, Bank Fees |

**Start with ~20–30 accounts, not 200.** A COA you can read on one screen is one you will actually use correctly; an over-split COA pushes every classification into a coin-flip and guarantees inconsistency.

Name accounts by what they are, not by a vendor or a feeling:

```text
Bad:  "Stuff", "Misc", "Amazon", "John's expenses"
Good: "Office Supplies", "Software Subscriptions", "Owner Draws"
```

Add an account only when a real reporting question needs the split (e.g., you must report "Software" separately from "Rent"). Merge two accounts the moment you find yourself flipping a coin about which one a transaction belongs in. Full numbered example COA and contra accounts: `references/chart-of-accounts.md`.

## Rule 4 — post from a worked entry, then check the balance

Write the journal entry, total each side, confirm they tie. Two worked examples:

**Paid $500 office rent from the bank:**

```text
DR  5100 Rent Expense        500
    CR  1000 Cash                    500
Debits 500 = Credits 500  ✓   (expense up, asset down)
```

**Customer pays $1,200 up front for work not yet delivered:**

```text
DR  1000 Cash               1200
    CR  2400 Unearned Revenue       1200
Debits 1200 = Credits 1200  ✓
```

Note the second one: the cash arrived but you have **not earned it yet**, so it is a *liability* (you owe the work), not revenue. Recording it as revenue is the single most common classification error — it inflates income and understates what you owe.

## Rule 4.5 — the classification decision procedure (run this on every confusing line)

The easy lines classify themselves. This procedure is for the ones that don't — and it is where a careless ledger goes wrong. Run it **in order** and stop at the first rule that fires; the order matters because later rules assume the earlier tests already failed.

1. **Is it cash moving between two accounts you own?** (operating → savings, owner topping up the business, paying down the company credit card from operating cash.) Then it is a **transfer, not income or expense** — both legs net to zero across the books. The single most common bank-feed error is booking the incoming side of a transfer as Revenue. A transfer never touches a P&L account. *Test:* would the company's net worth change? If no, it's a transfer.

2. **Did value flow in or out of the business, or just timing?** Cash moving does not mean expense/revenue happened. Paying down a loan, paying a supplier invoice you already booked to AP, collecting an invoice you already booked to AR — these only move a **balance-sheet** account (liability or asset) against Cash. Booking them again as expense/revenue **double-counts**. *Test:* "did I already record the expense/revenue when this was incurred/earned?" If yes, this cash event only clears the receivable/payable.

3. **Is this the principal or the cost?** Split blended payments. A loan payment is **interest (expense) + principal (liability reduction)** — never all expense. An asset purchased on finance is the asset (capitalized) + interest over time. A payroll run is **net wages + tax withheld (liability) + employer taxes (expense)**. Decompose before posting; one line on the bank, two-to-three lines in the journal.

4. **Capitalize or expense?** If the thing has useful life beyond this period and exceeds the business's capitalization threshold (set one, e.g. $2,500), it is an **asset** depreciated over time, not an expense booked now. Below the threshold or consumed this period → expense. *Refund/credit:* a refund of an expense **credits the original expense account** (it reverses the cost) — it is not Revenue.

5. **Earned/incurred, or just paid/received?** Under accrual: revenue posts when **earned** (delivery/performance), expense when **incurred** (obligation arises) — regardless of when cash moves. Cash received before earning → Unearned Revenue (liability). Expense incurred before paying → Accounts Payable / accrued liability. A 12-month prepaid (insurance, annual SaaS) is a **Prepaid asset** amortized monthly, not a lump expense in month one. (Cash basis collapses steps 5's timing distinctions — but steps 1–4 still apply.)

6. **Is it actually a business transaction at all?** Owner's personal spend run through the business is **Owner Draws** (equity), never an expense. A genuinely mixed charge (phone, car, home office) is split by business-use percentage; only the business portion is deductible.

If a line survives all six and you still can't place it: **post it to a holding/suspense account and flag it — never guess into "Misc."** A flagged suspense line gets resolved; a wrong guess in Misc never does. Full catalog of the transactions agents most often misclassify, each with the worked entry: `references/tricky-transactions.md`.

## Rule 5 — pick cash or accrual once, deliberately

| Method | Income recorded | Expense recorded | Use when |
| --- | --- | --- | --- |
| Cash | when received | when paid | simple, no inventory, under the gross-receipts ceiling |
| Accrual | when earned | when incurred | inventory, C-corp, or above the ceiling — and gives a truer P&L |

US trigger: the Section 448(c) gross-receipts test caps cash-method eligibility at **~$31M average for tax year 2025 (rising to $32M for 2026, Rev. Proc. 2025-32)**, averaged over the prior three years. Above it — or with inventory or C-corp status — accrual is generally **required**. Why pick once and commit: switching method later means a Form 3115 and a Section 481(a) adjustment, not a checkbox. Spain note (autónomo) and full retention rules: `references/reconciliation-playbook.md`.

## Rule 6 — Uncategorized must end at zero

A bank feed is raw input, not a record. Drive uncategorized to **0 every reconciliation period** — an "Uncategorized" balance is a pile of unrecorded business facts pretending to be done.

1. Set **auto-rules** for recurring payees (the same SaaS charge → Software Subscriptions every time). Rules cut the manual load on the 80% that repeats.
2. **Review each match** against type/date/amount before accepting — auto-match guesses on payee strings and gets transfers, refunds, and owner draws wrong.
3. **Batch-review** the long tail: sort by payee, classify in groups, leave nothing in Uncategorized.
4. Treat automation as an **assistant, never the authority** — verify against the invoice or statement. Reconcile at least monthly; weekly for high transaction volume.

## Rule 6.5 — month-end reconciliation, and what to do when it won't tie

Reconciliation proves the book balance equals the bank statement balance for the period. Checklist:

- [ ] Statement balance and book ending balance both pulled for the same cutoff date.
- [ ] Every bank line is matched to a book entry (and vice-versa).
- [ ] Uncategorized = 0.
- [ ] Difference = 0, or fully explained by listed timing items (uncleared checks/deposits).

**If book ≠ bank**, walk the diagnostic ladder — do not "plug" the difference:

1. **Timing** — a deposit or check not yet cleared the bank. Legitimate; list it as a reconciling item.
2. **Duplicate** — the same transaction entered twice (common after an import).
3. **Missing entry** — a bank line with no book counterpart (bank fee, auto-debit you never recorded).
4. **Transposition** — if the difference is evenly **divisible by 9** (e.g., $90, $540), suspect two digits swapped (54 entered as 45).

Posting a "plug" entry to force a match hides the error instead of finding it — and the error compounds next month. Full diagnostic ladder: `references/reconciliation-playbook.md`.

## Rule 7 — keep records as long as the law requires

US retention floor (IRS "How long should I keep records"):

| Keep | Records |
| --- | --- |
| 3 years | general default |
| 4 years | employment-tax records |
| 6 years | if income underreported by >25% |
| 7 years | bad-debt / worthless-security claims |
| Indefinitely | unfiled or fraudulent returns; asset basis records |

Spain (autónomo, estimación directa simplificada): the obligation is **libros registro** — libro de ingresos, libro de compras y gastos, libro de bienes de inversión — plus VAT registers (facturas expedidas / recibidas), each entry carrying fecha, nº factura, NIF, base imponible, tipo y cuota de IVA, total. Full PGC partida doble applies under estimación directa normal. Detail: `references/reconciliation-playbook.md`.

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
| --- | --- | --- |
| One giant "Misc" expense account | Reports become meaningless; tax prep guesses | Real named accounts; split only by reporting need |
| Categorizing from memory, not source docs | Invents numbers an audit can't trace | Classify from the invoice/receipt/statement |
| Recording a customer prepayment as revenue | Inflates income, hides the liability you owe | DR Cash / CR Unearned Revenue until earned |
| Treating an owner draw as an expense | Understates profit; distorts equity | Owner Draws is an **equity** account, not expense |
| Booking a loan principal repayment as expense | Double-counts cost; only interest is expense | DR Loan Payable (liability down) / CR Cash |
| Never reconciling, or plugging the difference | Errors compound silently month over month | Reconcile monthly; walk the diagnostic ladder |
| Mixing personal and business in one account | Untraceable books, tax and liability exposure | Separate business account; owner draws/capital for transfers |
| Trusting bank-feed auto-match blindly | Miscategorizes transfers, refunds, draws | Review every match against type/date/amount |
| Over-splitting the COA into 200 accounts | Every classification becomes a coin flip | Start at ~20–30; merge when you hesitate |
