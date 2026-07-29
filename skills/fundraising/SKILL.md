---
name: fundraising
description: "Use when planning or running an equity round as a process: sizing the raise to a milestone, choosing post-money SAFE vs priced round, tiering investors by intro path, sequencing outreach for momentum, or reading a term sheet before signing. NOT the slide narrative (that is `pitch-deck`), NOT the cap-table or valuation math (that is `financial-model`)."
tags: [fundraising, seed, safe, term-sheet, investor-pipeline, venture-capital, round-strategy]
recommends: [pitch-deck, financial-model, investor-materials, cold-outreach, contracts, grants, unit-economics]
origin: risco
---

# Fundraising — The Operating System for an Equity Round

*Own the round as a PROCESS: size it, pick the instrument, build a tiered list around intro paths, run a concentrated sprint, read the term sheet.*

This skill thinks in **funnels** (how many investors at the top to land N term sheets), in **instruments** (post-money SAFE vs priced Series Seed), and in **leverage** (warm intros, parallel meetings, a first term sheet that creates real urgency). It consumes the deck, the model, and the collateral that siblings produce, and orchestrates them into a closed round. Scope: pre-seed through Series A priced rounds and SAFE rounds, founder-side.

## What this owns vs what routes out

Fundraising owns the **decisions and the sequence**. The moment the real ask is a *document* or the *numbers behind it*, route out — do not half-build the sibling's artifact here.

| The ask is… | Route to | Why |
| --- | --- | --- |
| The persuasive STORY / slide narrative | `../pitch-deck/SKILL.md` | The deck is the story; fundraising decides when and to whom it goes. |
| Revenue projection, burn/runway, valuation math, cap-table dilution | `../financial-model/SKILL.md` | The numbers and the spreadsheet; fundraising sets the *target* (amount, dilution band), the model computes it. |
| Investor one-pager, data room, recurring investor update | `../investor-materials/SKILL.md` | Packaged collateral; fundraising decides the sequence it ships in. |
| The actual cold-email/DM copy + follow-up cadence to a named target | `../cold-outreach/SKILL.md` | Fundraising decides WHO and the order; cold-outreach writes the message when there is no warm intro. |
| Drafting/redlining the binding SAFE, SPA, or side letter | `../contracts/SKILL.md` | The legal instrument; fundraising covers the term-sheet *basics* a founder negotiates, not the binding doc. |
| Non-dilutive funding (grants, R&D credits, public funding) | `../grants/SKILL.md` | Out of equity-round scope entirely. |
| The standalone LTV/CAC/payback analysis investors will probe | `../unit-economics/SKILL.md` | A separate diligence artifact; fundraising just knows they'll ask. |

A general sales pipeline for CUSTOMERS (not investors) is `../sales-pipeline/SKILL.md`, not this skill.

## Intake gate — answer these before planning anything

This is a real branch: if the answer to the last row is "the deck" or "the model," STOP and route. Do not produce a round plan on top of unknowns.

- [ ] **Stage & traction** — pre-seed/seed/A? Pre-revenue, or MRR + growth rate (e.g. "$12K MRR, +18% MoM")?
- [ ] **Milestone the money buys** — what does this round let you prove (e.g. "$100K MRR," "10 design partners → repeatable sales")? If you can't name it, you can't size the round.
- [ ] **Runway you need to buy** — months to that milestone × monthly burn = the floor of the raise.
- [ ] **Lead in hand?** — is a lead investor already circling, or is this a cold start? This flips the instrument and the sprint plan.
- [ ] **Network reality** — strong warm-intro paths, or a weak network? This decides whether you lean on accelerators / portfolio founders.
- [ ] **Collateral ready?** — deck, model, and data room exist? If the real request is "build the deck" → `../pitch-deck/SKILL.md`. If it's "build the model" → `../financial-model/SKILL.md`. Come back with strategy once they exist.

## Step 1 — Size the round to a milestone

The amount is **burn to the next fundable milestone + buffer**, never "the maximum we can get." Raising too much sells too much of the company for proof you haven't generated yet; raising too little strands you between milestones.

```text
Amount  = months_to_milestone × monthly_burn × (1 + buffer)   # buffer ~25–35%
Dilution target:  pre-seed 10–15%   ·   seed 15–25%
Cap / pre-money ≈ amount ÷ dilution_target
```

```text
Bad  — "Let's raise as much as we can — $4M sounds good."
Good — "$1.5M buys 18 months to $100K MRR at our $80K/mo burn.
        Aim for ~15% dilution → ~$10M post-money SAFE cap."
```

2026 reference bands (ground your ask, don't quote them as gospel): median **seed ~$3.1M at ~$16M pre-money**; pre-seed SAFE caps commonly **$10–15M** for $250K–$2M raised. Seed deal *volume* fell ~28% YoY — fewer rounds close but larger, so targeting quality beats spray. Hand the actual cap-table dilution arithmetic to `../financial-model/SKILL.md`; you set the target band, it computes the table.

## Step 2 — Pick the instrument (don't default)

Make the SAFE-vs-priced call explicit. Below ~$4M with no lead, a **post-money SAFE with a valuation cap** is the standard; above that, or with a complex cap table or a lead who wants control terms, expect a **priced equity round** with preferred stock. ~90% of pre-seed rounds on Carta in Q1 2025 used a SAFE; ~92% of all pre-priced rounds as of Q3 2025.

| Signal | Lean SAFE | Lean priced round |
| --- | --- | --- |
| Round size | < ~$4M | ≥ ~$4M |
| Lead investor | none yet / party round | a lead setting terms |
| Cap table | simple, few holders | complex, many holders / cleanup needed |
| Legal cost & speed | ~$0–2k, days (YC template) | ~$15–25k, weeks |
| Governance | founder keeps full control | board seat / protective provisions expected |

Two traps to flag every time:

1. **Post-money SAFE pile-up.** A post-money SAFE fixes the holder's ownership *after all SAFE money but before the priced round*, so **stacking multiple post-money SAFEs dilutes founders more than they expect**. Compute combined dilution across the whole stack *before* signing the next one — hand the real math to `../financial-model/SKILL.md`. Most post-money SAFEs are cap-only (no discount); add a discount only if there's a reason.
2. **Over-engineering a priced round too early.** A $15–25k priced round before you have traction or a lead burns cash and weeks for governance you don't need yet. Default small/early rounds to SAFE.

SAFE-vs-priced decision table with cost/speed/dilution columns and a worked pile-up example → `references/process-playbook.md`.

## Step 3 — Build the target list, tiered by intro path

The funnel is brutal and quantifiable, so build the list **backward from term sheets**, keyed to *how you'll get in the door* — not a flat list of names.

```text
Work backward:
  want ~2–3 term sheets
  first→second meeting ~50%, outreach→meeting ~15%
  ⇒ ~50–100+ qualified, warmth-weighted targets at the top of the funnel
```

The intro path is the single biggest lever: **a warm intro converts to a meeting ~30–50%; cold outreach replies ~1–3% and yields <2% meetings (≈10–20x cold).** So rank every target by the warmest path you have to it:

```text
Warm-intro priority ladder (best → last resort)
  1. Existing investors / angels who can route you in
  2. Portfolio founders of the target VC (they get read)
  3. Mutual advisors / operators / accelerator network
  4. Cold outreach — last resort, only where no path exists
```

Tier A/B/C by **fit × intro warmth** (A = perfect-stage, perfect-thesis, warm path). If your network is weak, manufacture paths: accelerator demo days, portfolio-founder intros, scout programs.

```text
Bad  — One flat list of 200 VC names, same blast to all.
Good — 60 targets, each row tagged: stage fit · thesis fit · tier · warmest
        intro path · who makes the intro. Cold is a labeled minority.
```

The full back-solve arithmetic, per-path conversion bands, the A/B/C rubric, the pipeline stage schema, and a worked $3M-seed example → `references/funnel-math.md`. When there's genuinely no warm path to a Tier-A target, the message copy itself is `../cold-outreach/SKILL.md`.

## Step 4 — Run it as a concentrated sprint, not a trickle

Momentum is manufactured by **simultaneity**, not by sending one email and waiting. Concentrate **30–50 first meetings in the first ~2 weeks** of launch, run them in parallel, and aim for a first term sheet inside ~2 weeks. Total process targets **~6–8 weeks** — though the tighter 2025 market stretched full cycles to 12–18 months when momentum was absent.

```text
Sprint shape
  Pre-launch    line up intros, finalize deck/model/data-room, batch meetings
  Weeks 1–2     30–50 first meetings IN PARALLEL — this is what creates competition
  Weeks 3–4     partner meetings, diligence, drive toward the first term sheet
  Close         first term sheet → use it to compress the rest → sign
```

**The first term sheet changes everything** — it converts soft interest into urgency across the whole pipeline. Use it. But the honesty rule is absolute, because it is the one mistake with no recovery: **manufacture FOMO from a visibly busy calendar and a real first term sheet — never from fabricated competing offers or invented deadlines.** Lying about a term sheet you don't have is how a raise dies when one investor calls another; the cost of getting caught is the round.

Track **count-in-pipeline and stage conversion, not activity**. Benchmarks to instrument the funnel: outreach→meeting ~15%, first→second ~50%. Pipeline stages: `Sourced → Intro requested → First meeting → Partner/2nd → Diligence → Term sheet → Closed`. Week-by-week playbook and the honest-momentum mechanics → `references/process-playbook.md`.

## Step 5 — Read the term sheet (the basics, then hand off)

A founder negotiates the few terms that **compound** — not the headline valuation alone. Know the 2025 market-standard bands so you know what to accept and what to push on.

| Term | Q2 2025 market standard at seed | Push on it when… |
| --- | --- | --- |
| Liquidation preference | ~98% 1x; ~95% non-participating (founder-friendly) | Anything above **1x** or **participating** — push hard; it's off-market. |
| Valuation cap / pre-money | derives your dilution | The cap implies dilution outside your band (Step 1). |
| ESOP / option pool | carved pre-money dilutes founders | A large pool demanded "for hiring" inflates dilution silently. |
| Board composition | common post-seed: 2 founder / 1 investor | Anything that loses you founder majority at seed. |
| Pro-rata rights | common | Fine to grant; know who's reserving follow-on. |
| Protective provisions / vetoes | appeared in >90% of rounds | Scope creep beyond standard major-decision vetoes. |

Median seed lead ownership runs ~12.6%. **Don't sign the first term sheet without a comparison** — a single offer with no comp gives away your only leverage. And the hard handoff: the term sheet is mostly non-binding, but **the binding SAFE / SPA / side letter is a legal document → `../contracts/SKILL.md` and a real lawyer.** You read the term sheet to negotiate; you do not draft the binding instrument here. Full term-by-term cheat sheet with bands and push-on guidance → `references/process-playbook.md`.

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| "Raise the max — more runway is always better." | More dilution for proof you don't have. Size to the next milestone (Step 1). |
| "I'll send a few emails and see who bites." | A serial trickle kills momentum. Concentrate 30–50 meetings in 2 weeks, parallel. |
| "Bigger list = better — blast 200 VCs." | Flat spray wastes your warm paths. Tier by fit × intro warmth; cold is a labeled minority. |
| "Let's do a priced round to look serious." | $15–25k and weeks for governance you don't need pre-traction/pre-lead. Default to SAFE. |
| "First term sheet looks fine, let's sign." | One offer with no comp = zero leverage. Get a comparison before you sign. |
| "Stack another post-money SAFE, easy money." | Pile-up dilutes you more than you think. Model the whole stack first (`../financial-model/SKILL.md`). |
| "Cold outreach is the main channel." | Cold replies ~1–3%; warm converts ~30–50%. Build around intro paths, cold last. |
| "Tell investors we have a competing term sheet." | If untrue, the raise dies when they call each other. FOMO from real signals only. |
| "Push the valuation up, that's the win." | The terms that compound are pref, pool, board, dilution — not headline price alone. |
