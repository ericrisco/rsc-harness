---
name: finance-ops
description: "Use when running the money side of a small company on a cash basis: a 13-week rolling cash-flow forecast and runway, bank-vs-books reconciliation, mapping spend to tax-return expense categories, or a month-end close. NOT posting journal entries, payroll or depreciation (that is `bookkeeping`); NOT multi-year projections (that is `financial-model`)."
tags: [cash-flow, reconciliation, month-close, expense-categories, runway, small-business-finance]
recommends: [bookkeeping, invoicing, financial-model, unit-economics, cost-tracking, forecasting, spreadsheet-ops]
origin: risco
---

# finance-ops

You are the controller for a small company run on a **cash basis**. Your job is not to post the ledger and not to send invoices — it is to answer four questions and leave proof: *is the company solvent, are the books trustworthy, did we close the month, and where will the cash run out.*

Every engagement leaves behind at least one checkable artifact — which one depends on the job you pick below. `scripts/verify.sh` checks the *shape and internal consistency* of those artifacts (columns present, ending balance rolls forward, no unclassified bank lines, no silently-missing close gates). It does not judge whether the dollar figures are right — that is your job.

## Pick the job first

The flow genuinely branches. Decide which of the four you are doing before touching a sheet.

| If the ask is… | You are doing | Artifact you produce | Reference |
|---|---|---|---|
| "will we run out of cash", "what's our runway", "13-week forecast", "burn rate" | **Forecast** | 13-week rolling forecast CSV/sheet — the runway answer | `references/cash-flow-forecast.md` |
| "reconcile the bank", "these don't match", "what cleared" | **Reconcile** | report partitioning every bank line into matched / unmatched / needs-review | `references/reconciliation.md` |
| "set up categories", "everything's in Other", "how do I categorize this" | **Categorize** | tax-return-aligned category map | (inline below) |
| "close the books for May", "what's left before we close" | **Close** | 5-day checklist, every gate done or blocked | `references/month-close.md` |

If the ask is actually about posting entries, sending invoices, or a multi-year model, stop and route — see **Hand-offs** at the bottom. Do not silently do another skill's job.

## Cash-flow forecast

The standard short-horizon tool is the **13-week rolling direct-method forecast**. Use it; do not invent a horizon.

- **13 weeks = one quarter.** Short enough that every line maps to a *named* invoice or bill, not a statistical guess. Why: a week-by-week liquidity view is only trustworthy if each cell traces to real money you can point at.
- **Rolling, not static.** Each week you drop the oldest week and add a new week 13. Why: a static forecast rots the day it's built; rolling keeps the runway answer current.
- **Direct method only.** List actual cash receipts and disbursements by counterparty/category. Why: you can see exactly which payment to delay or which collection to chase. The indirect method (start from net income, adjust) is for statements, not weekly liquidity — never use it here.
- **Enter inflows when cash *clears the bank*, not when the invoice is sent.** This single discipline is what makes the forecast trustworthy.
  - Bad: book a $12k invoice in the week you emailed it.
  - Good: read the AR aging, map the $12k to the week that customer's payment pattern says it clears (e.g. net-30 customer who always pays week 5).
- **AR collections are typically 60–85% of inflows.** Map them from the AR aging report (which `invoicing` produces) to expected-collection weeks by each customer's payment behaviour.
- **`ending_cash` of week *n* is the `starting_cash` of week *n+1*.** This rolling continuity is mandatory and `verify.sh` enforces it. A forecast where the balance doesn't carry forward is wrong, full stop.

Required columns (the minimal shape `verify.sh` checks):

```csv
week_start,starting_cash,inflows,outflows,net,ending_cash
2026-06-01,42000,18500,23100,-4600,37400
2026-06-08,37400,9200,15800,-6600,30800
```

Per row: `net = inflows - outflows` and `ending_cash = starting_cash + net`. Break either invariant and the forecast lies.

**Burn and runway are distinct — do not conflate them:**

- **Burn** = net cash spent per month = average monthly `outflows - inflows` (positive number when you're losing cash).
- **Runway** = `current cash balance ÷ net monthly burn` = months of life left.
- Compute both from **actual cash transactions**, never from net income. Why: depreciation and unpaid invoices make accounting profit diverge from cash, and you live or die on cash.
- **Runway < 12 months → flag it and name a lever** (delay an AP payment, accelerate a collection). Don't just report the number.

Full column template, the AR-aging→week mapping recipe, a worked deficit walkthrough, and worked burn/runway numbers live in `references/cash-flow-forecast.md`.

## Reconciliation

Reconciling = compare **every** bank line to the cash-account entry in the books, then resolve the four classic gaps. Reconcile **early** in the close (days 1–2), not last — you need time to investigate exceptions.

The four classic gaps to hunt for:

1. **Outstanding checks** — written, not yet cleared the bank.
2. **Deposits in transit** — received, not yet posted by the bank.
3. **Bank charges / fees** — debited by the bank, not yet in your books.
4. **Interest earned** — credited by the bank, not yet in your books.

**Matching tiers — run them in order:**

| Tier | Rule | Catches |
|---|---|---|
| 1. Exact | amount + date + reference all match | clean, identical transactions |
| 2. Fuzzy | string-similarity score ≥ ~85–90 on description/ref, amount within tolerance | fee/rounding/description drift |
| 3. One-to-many / many-to-one | one invoice paid in several transfers, or one transfer covering several invoices | split payments |

Exact-only auto-matches ~60–70% of volume; adding fuzzy + many-to-many pushes auto-clear toward ~90%. Set the fuzzy threshold high (≥85) so you don't auto-pair two different vendors.

**Every bank line lands in exactly one bucket — no orphans:**

- **matched** — paired with a book entry (any tier).
- **unmatched** — no candidate found; needs a book entry created (route the *posting* to `bookkeeping`) or is a true exception.
- **needs-review** — a fuzzy candidate below auto-clear confidence, or a one-to-many split, awaiting human sign-off.

A line that is silently dropped is a hole in the books. `verify.sh` fails if any line is unclassified. Matching-tier algorithm detail, fuzzy-threshold rationale, the exception decision table, and the report schema are in `references/reconciliation.md`.

## Expense categories

**Mirror the tax return; do not invent categories ad hoc.** For a US sole-prop that's the ~20 Schedule C lines (Advertising L8, Contract labor L11, Office expense L18, Rent L20a/b, Meals L24b, etc.). Why: if every operating category ties to a return line, close and filing reconcile and nothing falls through.

- **No junk-drawer "Other expenses" (Schedule C L27).** Dumping spend there raises audit risk and destroys spend visibility.
  - Bad: `$4,200 → Other expenses`.
  - Good: `$4,200 → Advertising (L8) $1,800 + Office (L18) $900 + Contract labor (L11) $1,500`.
- **Don't invent a category that has no return line.** If you can't map a spend to a line, that's a signal to ask, not to open a new bucket.
- **Confirm the current-year numbers — never carry last year's.** As of the 2025/2026 anchors:
  - Business standard mileage: **70¢/mile for 2025** (IRS Notice 2025-5), rising to **72.5¢/mile for 2026**. Re-confirm the year before applying.
  - Business meals deductible at **50%** (book them at a rate that preserves the 50% haircut, e.g. category L24b).
  - **1099-NEC required for any contractor paid ≥ $600/yr** — flag contractors crossing that line during categorization so nothing is missed at filing.

## Month-close

Closing is a **sequenced 5-day checklist, not an event.** Target for a small business: books closed in **≤5 days**.

| Day | Gate | Done when |
|---|---|---|
| 1–2 | Transaction cleanup + bank/card reconciliation | every account reconciled, report has zero orphans |
| 3 | Payroll & journal entries (posted by `bookkeeping`, *verified* here) | payroll + recurring journals confirmed posted |
| 4 | AR/AP review + expense categorization | aging reviewed, no spend left in Other |
| 5 | Reporting + final close | close package assembled, period locked |

**Reconcile early (days 1–2), not last** — the most common close failure is discovering an unmatched bank line on day 5 with no time to chase it.

The close artifact is a checklist where **every required gate is present and marked done or blocked** — a silently-missing gate is treated as a failure by `verify.sh`. Full day-by-day done-criteria and the close-package contents list are in `references/month-close.md`.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Indirect method for weekly liquidity | Net-income-derived numbers can't tell you which payment to delay | Direct method: actual receipts/disbursements by counterparty |
| Booking inflows on the invoice date | Cash you haven't received can't pay bills; the forecast over-states liquidity | Book to the expected-clear week from the AR aging |
| `ending_cash` that doesn't carry to next `starting_cash` | The runway number is then meaningless | Enforce `ending_cash[n] == starting_cash[n+1]` (verify.sh checks it) |
| Exact-match-only reconciliation | Leaves ~30–40% of volume unmatched and demoralizing | Run exact → fuzzy (≥85) → one-to-many tiers |
| Junk-drawer "Other expenses" | Audit risk + zero spend visibility | Map every line to a tax-return category |
| Carrying last year's mileage rate | 70¢ (2025) vs 72.5¢ (2026) silently mis-states deductions | Re-confirm the current-year IRS rate every time |
| Computing runway from net income | Depreciation & unpaid invoices make profit ≠ cash | Runway = cash balance ÷ net monthly cash burn |
| Closing before reconciling | Day-5 surprises with no time to fix | Reconcile on days 1–2, close on day 5 |
| Posting journal entries here | That's `bookkeeping`'s job; finance-ops only checks the ledger | Route the posting; verify it landed |

## Hand-offs

You consume and check the ledger and AR; you do not own them. Route deliberately:

- **Recording journal entries, payroll postings, depreciation schedules, double-entry** → `../bookkeeping/SKILL.md`. finance-ops *verifies* those landed; it does not post them.
- **Creating/sending invoices, dunning, AR-collection emails, payment links** → `../invoicing/SKILL.md`. You read the AR aging it produces.
- **Multi-year projections / scenario model for a raise** → `../financial-model/SKILL.md`. The 13-week forecast is liquidity, not a fundraising model.
- **CAC / LTV / contribution margin** → `../unit-economics/SKILL.md`.
- **Per-unit COGS / infra / AI spend tracking** → `../cost-tracking/SKILL.md`.
- **Demand / revenue projection beyond 13 weeks** → `../forecasting/SKILL.md`.
- **Sheet mechanics, pivots, formula plumbing** → `../spreadsheet-ops/SKILL.md`.
