---
name: unit-economics
description: "Use when computing or improving the per-customer economics of a business — CAC, LTV, CAC payback period and contribution margin — judging whether the ratios are healthy against current norms, and naming the one lever that fixes the worst number. Covers a blended CAC that hides a bleeding channel, and a model that shows profit while each customer loses money. NOT the multi-year P&L or scenario projection (that is `financial-model`)."
tags: ["cac", "ltv", "payback-period", "contribution-margin", "unit-economics", "ltv-cac-ratio", "nrr", "saas-metrics"]
recommends: ["financial-model", "pricing", "retention", "cost-tracking", "forecasting", "investor-materials", "dashboard"]
origin: risco
---

# Unit economics

Answer one question honestly: **does one customer pay back more than it cost to win and serve them, and how fast?** You compute four load-bearing numbers — CAC, contribution margin, LTV, CAC payback period — plus the two ratios operators and investors actually argue about (LTV:CAC, NRR). Then you diagnose *why* a number is where it is and name the single lever that moves it.

This is a measurement-and-diagnosis skill, not a projection skill. You do not build the multi-year model here (that is the `financial-model` sibling); you build the per-customer truth that the model's growth assumptions have to rest on.

## What this skill produces

A **unit-economics worksheet** (`unit-economics.{yaml,csv,md}`) where:
- a block of **named inputs** — period S&M spend, new customers, monthly ARPA, gross margin %, monthly churn, optional segment rows — is stated explicitly;
- every **derived figure** (CAC, contribution margin, LTV, payback, LTV:CAC) is recomputed *from those inputs* so the relationships are self-consistent;
- the worst number is diagnosed and one concrete lever is prescribed.

`scripts/verify.sh` re-derives the figures and fails if the arithmetic lies (see the last section). If you only hand back prose, you have not finished — emit the worksheet.

## The four numbers and the input people get wrong

Each formula has one input that, done sloppily, silently invalidates everything downstream. Tag the input, not just the result.

| Number | Formula | The input people get wrong |
|---|---|---|
| **CAC** | fully-loaded S&M spend ÷ new customers (same period) | the *numerator* — ad-spend-only CAC understates true CAC ~3.5× |
| **Contribution margin / customer** | ARPA − variable cost to serve (COGS + variable support + payment fees) | confusing it with company-wide gross margin % |
| **LTV** | (ARPA × Gross Margin %) ÷ churn rate | using *revenue* instead of *gross-margin* dollars |
| **CAC payback (months)** | CAC ÷ (monthly ARPA × Gross Margin %) | leaving gross margin out of the denominator |

**Worked Bad → Good — the revenue-LTV inflation.** Same inputs: ARPA $400/mo, gross margin 75%, monthly churn 3%.

```text
Bad  (revenue LTV):       400 / 0.03          = $13,333   <- overstates by 33%
Good (gross-margin LTV): (400 * 0.75) / 0.03  = $10,000   <- what a customer is actually worth
```

LTV must use gross-margin dollars because not all revenue is profit — hosting, support, and payment fees come out first. The revenue version flatters the LTV:CAC ratio and is the single most common dishonesty in a deck. (Beancount.io "2026 SaaS Metrics Stack" 2026-05-10; ChartMogul LTV guide; both accessed 2026-06-02.)

Full derivations, cohort-LTV vs formula-LTV, the Skok discounted model, and segment roll-up math live in `references/formulas.md`. Read it before you defend a number to an investor.

## Order of operations (the spine)

Run these in order — each step is an input to the next, so skipping one makes everything after it fiction.

1. **Gross margin first.** Every downstream metric multiplies by it. If gross margin is unknown, the COGS per unit must be tracked first (route to `cost-tracking`) — you cannot compute LTV or payback on a guessed margin.
2. **CAC, fully loaded.** Include all sales + marketing cost; exclude customer-success/retention spend and returning customers.
3. **Contribution margin per customer.** ARPA minus variable cost to serve — the dollars that actually pay back CAC.
4. **LTV, capped.** Gross-margin LTV with a lifetime cap (see conservatism), not 1/churn run to infinity.
5. **Payback period.** CAC ÷ monthly contribution margin.
6. **Ratios.** LTV:CAC and NRR/GRR for context.
7. **Diagnose & prescribe.** Find the worst number, name its cause, name the lever.

## Get the inputs honest

CAC is fully loaded or it is a lie. Decide what goes in the numerator before you divide.

| In the CAC numerator | Out of the CAC numerator |
|---|---|
| Sales + marketing salaries & benefits | Customer-success / retention spend (that protects LTV, it doesn't acquire) |
| Sales commissions & SDR/AE comp | R&D / product engineering |
| Ad spend, content, events, agencies | Overhead/G&A not tied to acquisition |
| Marketing & sales tooling | (Denominator) returning / reactivated customers — only count *new* logos |
| Founder selling time (impute a salary) | |

Three rules that catch most errors:

- **Gross margin, not opex margin.** Gross margin reflects COGS (hosting, support, payment fees), not salaries/rent. Mixing in opex understates margin and quietly tanks LTV. (Beancount.io 2026-05-10, accessed 2026-06-02.)
- **Match time units.** Monthly ARPA pairs with monthly churn; annual with annual. Mixing them silently 12×'s or ÷12's the LTV — the most common arithmetic error in the whole exercise. (ChartMogul; metrickit LTV guide; accessed 2026-06-02.)
- **Right period, right denominator.** Spend in period P ÷ customers acquired in period P. Don't divide this quarter's spend by all-time customers.

## Segment before you optimize

A single blended number hides the only insight that matters. Reporting one blended CAC of $1,200 when self-serve is $80 and field sales is $40,000 tells you nothing actionable — the channels have wildly different CAC, ARPA, and churn. (lucid.now LTV/CAC errors; andrewchen; accessed 2026-06-02.)

```text
Blended CAC $1,200  =  self-serve $80  +  inside sales $900  +  field $40,000
                       (lever: scale)   (lever: AE ramp)      (lever: ACV / cycle)
```

Two more separations to keep clean:
- **Paid CAC vs blended CAC.** Blended includes free/organic; paid isolates the channels you can actually scale with money. Optimize paid; report both.
- **Self-serve / inside sales / field sales.** Split on go-to-motion, because the lever for each is different. If one segment is bleeding while blended "looks fine," that's exactly the non-obvious failure this skill exists to surface.

## Benchmarks (2025-2026)

A ratio is a conversation-starter, not a pass/fail grade. Read the whole row before you celebrate or panic.

| Metric | Elite / top quartile | Healthy / median | Concern |
|---|---|---|---|
| CAC payback | < 12 months | B2B SaaS median 12-18 mo | 24+ months = sustainability concern |
| Payback by ACV | ~9 mo at ACV ≤ $5K | — | ~24 mo at ACV > $100K (expected, not bad) |
| LTV:CAC | 3:1 to 5:1 | median B2B ≈ 3.2:1 | < 3:1 overspending; **> 5:1 under-investing in growth** |
| NRR | top quartile 115-125% | healthy 105-115% | < 100% net contraction |
| GRR | — | — | high NRR + low GRR = expansion masking churn |

(Beancount.io 2026-05-10; First Page Sage CAC Payback Benchmarks 2025; Optifai B2B LTV benchmark, 939 companies; cast.app NRR; all accessed 2026-06-02.)

The honest framing: a **2.5:1 with 9-month payback and 120% NRR beats a 4:1 with 36-month payback and 95% NRR.** Payback and NRR decide whether you can survive the gap between spend and return; the ratio alone can't. **Rule of 40** (ARR growth % + profit margin % ≥ 40%) is the company-level destination these feed — cite it, but compute it in `financial-model`, not here.

## Diagnose & prescribe (this is where the flow branches)

Find the worst number, then route to the lever — and to the sibling skill that owns that lever.

| Bad number | Likely cause | Lever (and owner) |
|---|---|---|
| CAC too high | wrong channel mix / paid-heavy | shift to founder-led & organic; cut the bleeding channel — diagnose by segment here, then `pricing` if the fix is monetization |
| Payback too long | low margin-dollar capture per month | move to annual prepay; shorten free trial; lift gross margin (`cost-tracking` for COGS) |
| LTV too low | dominant churn term | attack the biggest churn driver → `retention`; lift expansion to push NRR > 100% |
| Margin too low | COGS per unit too high | instrument per-unit COGS / inference cost → `cost-tracking` |
| LTV:CAC > 5:1 | under-investing in growth | spend *more* on acquisition — you're leaving money on the table, not winning |
| NRR ≫ GRR | expansion masking a churn problem | fix gross retention first → `retention`; don't let expansion hide the leak |

The skill stops at "here is the worst number and the lever." Executing the lever (set the price, design the save-play, project the new curve) belongs to the sibling, not here.

## Conservatism rules (so LTV isn't fantasy)

Small churn errors explode LTV because of the 1/churn term — at 1% monthly churn the formula implies a ~100-month (8+ year) lifetime, which no early-stage company has data to claim.

- **Cap assumed lifetime at 3-4 years** for early-stage (≤ 48 months), or apply a **×0.7 conservatism multiplier** to formula LTV.
- **Cohort beats formula.** Once you have multi-year retention data, compute cohort LTV from observed retention — the formula is a placeholder until then.
- **Discount future value** in the advanced (Skok) model: ~20-25% discount rate pre-scale, ~10% at scale, because a dollar of contribution margin three years out is worth less than one today.
- **NRR > 100% means the simple churn-only LTV understates** the cohort — note it rather than silently leaving value on the table.

(Beancount.io 2026-05-10; metrickit LTV guide; forEntrepreneurs SaaS Metrics 2.0; all accessed 2026-06-02.) Worked discounted and cohort examples are in `references/formulas.md`.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Revenue LTV (ARPA ÷ churn) | overstates value; not all revenue is profit | gross-margin LTV: (ARPA × GM%) ÷ churn |
| Ad-spend-only CAC | understates true CAC ~3.5× | fully-loaded S&M ÷ new customers |
| Monthly ARPA with annual churn | silently 12×'s or ÷12's the LTV | match time units before dividing |
| Near-zero churn → 30-year lifetime | fantasy LTV no one can back with data | cap lifetime ≤ 48 mo or ×0.7 multiplier |
| One blended CAC/LTV | hides self-serve vs field; nothing actionable | segment by go-to-motion first |
| Counting CS/retention spend in CAC | inflates CAC; that spend protects LTV, doesn't acquire | keep CS out of the numerator |
| Reading only the LTV:CAC ratio | ignores payback & NRR that decide survivability | read payback + NRR alongside the ratio |
| Quoting NRR while GRR is weak | expansion masks a churn leak | report GRR floor too; fix retention first |

## The worksheet format

Emit this so the numbers are checkable, not just asserted:

```yaml
# unit-economics.yaml
inputs:
  period_sm_spend: 120000      # fully-loaded S&M, this period
  new_customers: 80            # new logos only, same period
  monthly_arpa: 400
  gross_margin_pct: 0.75
  monthly_churn: 0.03          # monthly, to match monthly_arpa
  # lifetime_cap_override: 60  # only if you justify > 48 months
outputs:
  cac: 1500                    # 120000 / 80
  contribution_margin: 300     # 400 * 0.75
  ltv: 10000                   # (400 * 0.75) / 0.03   (NOT 13333)
  payback_months: 5            # 1500 / (400 * 0.75)
  ltv_cac: 6.67                # 10000 / 1500  -> >5: under-investing
segments:                      # split when blended hides the truth
  - name: self-serve
    cac: 80
  - name: field-sales
    cac: 40000
```

`scripts/verify.sh` parses this file and **fails if**: CAC ≠ spend ÷ new_customers; contribution_margin ≠ ARPA × GM%; payback ≠ CAC ÷ (ARPA × GM%); the stated LTV matches the *revenue* form instead of the gross-margin form; ltv_cac ≠ LTV ÷ CAC within 0.05; or implied lifetime (1/churn) > 48 months with no `lifetime_cap_override`. It is read-only and exits 0 on a clean worksheet (and on no worksheet at all).

## Where this hands off

- Multi-year P&L / scenario / cap-table model → `financial-model`.
- Setting the actual price, tiers, discount floor → `pricing`.
- Churn-prevention program (health scores, save-plays, win-back) → `retention`.
- Per-unit COGS / infra / AI inference cost so gross margin is even knowable → `cost-tracking`.
- Forecasting future MRR / cohort projection → `forecasting`.
- Writing the investor unit-economics narrative / data-room exhibit → `investor-materials`.
- Generic KPI chart / dashboard surface → `dashboard`.
