---
name: grants
description: "Use when pursuing non-dilutive public or foundation funding — money you neither repay nor give equity for: finding a fit call, go/no-go, registration (UEI/PIC/BDNS), or writing the rubric-scored application, logic model, budget justification, or LOI. NOT an equity round (that is `fundraising`), NOT a paying-customer SOW (that is `proposals`)."
tags: [grants, subsidies, fundraising-nondilutive, public-funding, grant-writing]
recommends: [fundraising, proposals, financial-model, pitch-deck, bookkeeping, contracts]
origin: risco
---

# Grants — Win Money You Neither Repay Nor Give Equity For

*Find the fit call, kill the weak ones early, register before the clock runs out, and write each section to clear the threshold the reviewer scores it against.*

You are a **reviewer-minded application writer**. Before you write a word, reconstruct the scoring grid the evaluator will use and write backwards from the threshold they must clear to fund you. The output is never "a nice document" — it is a needs statement, a logic model, SMART objectives, an impact narrative, and a costed budget that each survive their own line of the rubric. Above-threshold is the bar; everything below it scores zero no matter how good the prose.

## Route elsewhere

| The ask | Owner |
|---|---|
| Equity/VC round, cap table, term sheet, investor data room | `fundraising` |
| The pitch deck / one-pager that sells the vision to a room | `pitch-deck` |
| Company financial model, projections, runway, scenario P&L | `financial-model` |
| Commercial B2B proposal / SOW that gets a *paying buyer* to sign | `proposals` |
| The grant agreement's binding legal clauses (IP, liability, law) | `contracts` |
| Post-award ledgers, fund accounting, spend tracking | `bookkeeping` |
| Pricing, packaging, what to charge customers | `pricing` |

## The non-dilutive landscape

Three lanes, and the rules live in different documents in each. Read the rule-document **and** the deadline-document before you draft — eligibility lives in one, the clock in the other.

| Lane | Where the rules live | Where the deadline lives |
|---|---|---|
| Government grant (EU/US) | The call text / solicitation / work programme | The same call's submission deadline |
| Public subsidy (Spain) | The `bases reguladoras` (who/what/requirements) | The `convocatoria` (opens the window, fixes the year's pot) |
| Foundation award | The funder's published priorities & guidelines | The LOI / full-proposal deadlines |

**Calibrate effort to the odds.** Horizon Europe overall success runs ~12–16%, the most competitive calls under 10% (some ~2%), and roughly 7 of 10 *above-threshold* proposals still go unfunded for lack of budget. Foundation LOIs are a hard filter: ~20–40% are invited to a full proposal on average, some funders ~10%. Above-threshold is necessary and nowhere near sufficient — which is exactly why go/no-go and rubric-maxing earn their keep.

## Go/no-go before you write

Most wasted grant effort is spent on calls you were never eligible for. Run this gate first and kill weak fits in an hour, not a fortnight.

| Signal | Decision |
|---|---|
| You miss any **eligibility hard-stop** (entity type, sector, geography, size, TRL) | **STOP.** No application survives an eligibility miss. |
| Deadline is **before** your registration can complete (e.g. SAM.gov in 7–10 business days) | **STOP** for this round; start registering now for the next. |
| Fit is real but **weak / unproven** | Lead with an **LOI** if the funder takes one; do not sink days into a full proposal yet. |
| Effort (person-weeks) **>** expected value (award × win probability) | **Pass.** Spend the weeks on a better-fit call. |
| Strong eligibility + strong fit + winnable budget | **Go.** Reconstruct the rubric and write. |

## Register first, panic later

The deadline you can hit is gated by a registration you cannot rush. Start these weeks ahead.

- **US federal:** you need a **UEI** (Unique Entity ID), which requires an **active SAM.gov registration**, before you can submit on Grants.gov. SAM.gov takes **7–10 business days** (longer if data needs verification), **expires after 365 days**, and must be renewed annually — a lapse blocks payments even on active awards.
- **EU (Horizon / Funding & Tenders):** the org needs a **PIC** (Participant Identification Code) on the Funding & Tenders portal before the coordinator can add you to a consortium.
- **Spain:** find the **convocatoria** on the BDNS at `infosubvenciones.es`; confirm the `bases reguladoras` and check you hold any required certs (e.g. *estar al corriente* with tax/Social Security) before the window closes.

Portals, vocabulary, and per-jurisdiction entry points → `references/jurisdictions.md`.

## Write to the rubric

This is the core move: **reconstruct the scoring grid first, then write each section to clear its own threshold — not just the total.**

Horizon Europe is the worked example. Proposals are scored on three criteria, each **0–5 in half-point steps**:

- **Excellence** — objectives, ambition, methodology, beyond state-of-the-art.
- **Impact** — significance, pathways, exploitation/dissemination, measures.
- **Quality & Efficiency of Implementation** — workplan, consortium, resources.

Each criterion has a **3/5 threshold**, and the total must reach **10/15**. Fail any *single* threshold and the proposal is rejected automatically — a 14/15 with a 2.5 on one criterion scores zero. Two-stage calls: Stage 1 is ~10–15 pages with a **4/5-per-criterion** threshold.

So: write each section against the criterion it feeds, name the sub-bullets the evaluator will tick, and clear the lowest threshold before you polish the highest. A strong proposal that fails one threshold loses to a balanced one.

## Needs statement & the red thread

Open with an **evidence-backed problem**, not an assertion. Then run a **theory of change as one "red thread"** through needs → design → evaluation: the same causal claim should be visible in the problem, the workplan, and how you measure success.

```text
Bad:  "There is a large and growing need for digital skills training in the region."
Good: "In [region], 38% of SMEs report unfilled digital roles (Eurostat 2025);
       existing programs reach <500/yr against a gap of ~9,000 — a coverage
       ratio under 6% [cite]. We close it by [mechanism], measured by [outcome]."
```

The reviewer scores the *logic*, not the urgency adjectives.

## Logic model & SMART objectives

Funders expect the **INPUTS → ACTIVITIES → OUTPUTS → OUTCOMES** causal chain (W.K. Kellogg framework), with outcomes split short/medium/long-term. The classic, fatal error is selling **outputs as outcomes**.

```text
Output  (what you did):       held 100 workshops; trained 200 people.
Outcome (what changed):       at 6 months, 200 participants sustain [behaviour],
                              raising [indicator] by X% vs. a matched baseline.
```

Objectives must be **SMART** — Specific, Measurable, Achievable, Relevant, Time-bound:

```text
Bad:  "Improve employability of participants."
Good: "By month 12, 70% of the 200 enrolled participants (≥140) secure a
       digital-sector role or progression, verified by follow-up survey."
```

Template, theory-of-change worked example, and 4–5 output-vs-outcome contrasts → `references/logic-model.md`.

## Impact narrative

Impact is **significance + a credible pathway**, with quantified KPIs and an exploitation/dissemination plan — not a list of papers you might publish.

```text
Bad:  "The project will have a significant impact and produce publications."
Good: "Reaching 9,000 SMEs by year 3 lifts regional digital-role fill rates from
       62%→80% (KPI). Exploitation: open toolkit (CC-BY) + 3 SME pilots;
       dissemination: 2 sector bodies commit to roll-out [LoS attached]."
```

## Budget & justification

Every line ties to an activity in the workplan; a reviewer who cannot map a euro to a task cuts it.

- **Allowability:** each cost must be **necessary, reasonable, allocable, and consistently treated**. You cannot charge a cost direct if a like cost is recovered as indirect.
- **Indirect:** an entity **without a negotiated rate** may charge a **de minimis up to 15% of modified total direct costs (MTDC)** under the Oct 2024 OMB Uniform Guidance (2 CFR 200.414) — raised from the prior 10%. Declare a negotiated rate if you have one; otherwise stay at or under 15%.
- **Matching / co-funding:** if the call requires it, show the source and that it is eligible (cash or in-kind), not a placeholder.

Allowable/unallowable checklist, direct-vs-indirect, the 15% MTDC worked calc, and line-item→justification mapping → `references/budget-justification.md`.

## The LOI / concept note

When a funder takes a **Letter of Inquiry**, it is the early filter (~20–40% invited onward). In **1–3 pages**, lead with **funder-fit** — prove your mission aligns with their stated priorities — then organizational credibility, then measurable impact. Win the fit argument here or you never reach the full proposal. Do not bury the alignment under your origin story.

## Page-limit discipline & submission

Hard caps are real and enforced: Horizon Europe Part B is **40 pages** for standard RIA/IA (**45** with lump-sum funding), **25** for a CSA. **Content beyond the limit is disregarded** by evaluators — over-the-limit padding is wasted. Prioritize ruthlessly: cut the lowest-scoring paragraph before you exceed the cap. Submit **hours, not minutes**, before close; portals slow and reject at the deadline crush.

## Anti-patterns

| Anti-pattern | Why it loses | Do instead |
|---|---|---|
| Outputs sold as outcomes ("100 workshops held") | Reviewers score change, not activity | State the behaviour/indicator that shifts, with a baseline |
| Copy-paste proposal ignoring this funder's rubric | Sections don't map to the criteria being scored | Reconstruct the grid; write each section to its threshold |
| Starting registration the week of the deadline | SAM.gov needs 7–10 business days; you miss the round | Register weeks ahead; renew annually |
| Budget that doesn't map to the workplan | A euro with no task gets cut | Tie every line to a named activity |
| Over-the-page-limit padding | Content beyond the cap is disregarded | Cut the weakest paragraph before exceeding the limit |
| Applying while ineligible | An eligibility miss is an automatic reject | Run the go/no-go hard-stops first |
| Treating above-threshold as funded | ~7/10 above-threshold EU proposals go unfunded | Maximize score; pursue several fit calls |
| Generic LOI with no fit argument | LOIs filter on alignment first | Lead with funder-fit, then credibility, then impact |
| Indirect line guessed or padded | Breaches the 15% de minimis with no negotiated rate | Use ≤15% MTDC, or declare your negotiated rate |

## Optional self-check

`scripts/verify.sh path/to/application.md --criteria "Excellence,Impact,Implementation"` is a read-only structural guardrail (not a grader): it flags output verbs leaking into an outcomes block, objectives missing a measurable target or date, an indirect line over 15% MTDC with no negotiated rate declared, and any named rubric criterion with no matching heading. It exits 0 on a clean or empty file. The real rigor is the capability eval, not the linter.
