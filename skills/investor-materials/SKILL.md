---
name: investor-materials
description: "Use when packaging or circulating the documents an investor reads outside the meeting — setting up or cleaning a data room, writing the one-pager or teaser that earns the first meeting, or drafting the recurring monthly investor update. NOT the slide narrative (that is `pitch-deck`), NOT the projection spreadsheet (that is `financial-model`), NOT round strategy and the investor pipeline (that is `fundraising`)."
tags: [fundraising, data-room, investor-update, one-pager, investor-relations, due-diligence]
recommends: [pitch-deck, financial-model, fundraising, cold-outreach, unit-economics, grants]
origin: risco
---

# Investor Materials — Data Room, One-Pager, Investor Update

*The packaging layer of fundraising. You consume the deck, the model, and the metrics — then you organize, name, and circulate the documents an investor reads on their own time. You do not build the story, the spreadsheet, or the round strategy.*

This skill produces exactly **three artifacts**:

1. **The data room** — the organized, numbered, access-tracked folder of diligence files an investor opens after the meeting.
2. **The one-pager / teaser** — the single page that earns the first meeting and rides along on a cold email.
3. **The investor update** — the recurring email that keeps existing backers warm and primed for the follow-on.

One-line route-out: the persuasive **story in slides** is `../pitch-deck/SKILL.md`; the **numbers in a spreadsheet** are `../financial-model/SKILL.md`; the **round strategy and investor pipeline** are `../fundraising/SKILL.md`. You package what they produce.

## Decision table — is it yours?

| The ask | Owned here? | Route to |
| --- | --- | --- |
| Set up / clean / rename the data room | **Yes** | — |
| Write the one-pager / teaser | **Yes** | — |
| Draft the recurring investor update | **Yes** | — |
| Build the slide deck / narrative arc | No | `pitch-deck` |
| Build projections / burn / runway / cap-table math | No | `financial-model` |
| Investor list, outreach strategy, SAFE vs priced, term sheet | No | `fundraising` |
| Cold first-touch email to a named VC | No | `cold-outreach` (you supply the one-pager it attaches) |
| LTV / CAC / payback / contribution-margin deep dive | No | `unit-economics` |
| Grant / non-dilutive funding narrative | No | `grants` |
| How the one-pager LOOKS (layout, brand) | No | `brand-identity` / `presentations` |

## Intake gate (run before producing anything)

Two questions decide everything. Ask them, do not assume.

1. **Stage?** pre-seed / seed / Series A — sets data-room size (seed skews 30–40 docs, Series A 55–70) and whether the one-pager leads with team or traction.
2. **What already exists?** Is there a deck, a model, current metrics? You *consume* these. If they are missing and the real ask is to create them, **STOP and route** — building the deck is `pitch-deck`, building the model is `financial-model`. Producing a one-pager with invented traction or a data room that points at a nonexistent model is the failure this gate prevents.

Rule with a why: **if the request is really the narrative or the numbers, you are the wrong skill — route, do not fake.** A polished package around hollow content wastes the founder's one shot with each investor.

## Data room

A complete startup data room is **~50–70 documents across 8 numbered categories**. Number the folders so an investor (who spends only ~2–3 hours total, and 8–12 minutes on cap table + SAFEs alone) navigates without asking. **68% of failed deals cite disorganized documentation as a primary factor, and organized rooms close ~35% faster** — investors assume you run the company the way you run the deal room. That is the entire reason for the numbering and naming rules below.

The 8 categories (full per-doc checklist with seed vs Series-A inclusion flags → `references/dataroom-checklist.md`):

```text
01_Corporate        incorporation, bylaws, board minutes, shareholder agreements
02_Financial        financial model, historical P&L, balance sheet, bank statements
03_Legal_Contracts  customer/supplier contracts, NDAs, leases, litigation log
04_IP               trademarks, patents, domains, IP-assignment agreements
05_Team_HR          org chart, key employment + founder vesting, option plan
06_Product_Metrics  product overview, roadmap, KPI dashboard, cohort/retention data
07_CapTable_Equity  cap table, SAFEs/convertibles, prior round docs, 409A
08_Tax_Compliance   tax filings, registrations, licenses, compliance certificates
```

**Naming convention — non-negotiable:** `YYYY-MM_Doc-Name_vN.ext`. Date for recency, version so nobody diligences a stale file.

```text
Bad   final_model(2)(FINAL).xlsx
Bad   captable_new_updated.xlsx
Good  2026-03_Financial-Model_v4.xlsx
Good  2026-03_Cap-Table_v2.xlsx
Good  07_CapTable_Equity/2026-02_SAFE-AngelRound_v1.pdf
```

- **Surface the most-scrutinized first.** Cap table, SAFEs/convertibles, and the financial model get the most eyes — put them where they cannot be missed and make sure they are the *current* version. Too many files dilutes focus and signals poor prioritization.
- **Leave half-baked docs OUT.** A folder with 70 files where 15 are drafts reads worse than 45 clean ones. Omit until ready; an empty-looking "08_Tax" with a placeholder is worse than a note "tax filings available on request."
- **Share a link per investor and read the analytics.** DocSend-style tooling tracks who opened what, time-per-page, and forwards. Use drop-off to fix the materials and warmth signals to prioritize follow-up. You advise the link-per-investor practice and read the analytics — you do not build the VDR software.

## One-pager / teaser

The one-pager's job is to **GET the meeting**; the deck's job is to **close** it. They are different artifacts — one-pagers get ~2.5x higher response rates than full decks for cold outreach. The one-pager is **7 blocks**:

```text
1. Headline / one-liner   what you do, for whom, in one sentence
2. Problem                the pain, sized and concrete
3. Solution               your product, one line of how it works
4. Traction               the 3–5 metrics that prove pull (MRR, growth %, logos)
5. Market                 TAM / SAM / SOM with the SOM you can actually win
6. Team                   why THIS team wins this market
7. The ask                specific amount + use of funds
```

- **Lead order by stage.** Pre-revenue leads with **team** (there is no traction to lead with). Post-traction leads with **traction** (the metrics are the strongest card). Re-order blocks accordingly; do not bury the strongest one at the bottom.
- **A teaser carries NO confidential financials.** A teaser is 1–5 pages with no detailed P&L, no full cap table, no confidential customer data — those live in the deck and the data room behind an access link. Leaking them into the first-touch attachment is a defect.
- **The ask is specific.** "Raising $1.5M to extend runway 18 months and hire 4 engineers" — not "raising a round." A vague ask reads as an unprepared founder.

```text
Bad  (ask)       "We're raising a round to grow the business."
Good (ask)       "Raising $1.5M seed — 18mo runway: 4 eng hires, 2 GTM, to reach $1M ARR."
Bad  (headline)  "An AI-powered platform revolutionizing the future of work."
Good (headline)  "Payroll for restaurant groups — cut weekly close from 6 hours to 20 min."
```

Fill-in 7-block template + a filled mini-example → `references/update-and-onepager-templates.md`.

## Investor update

The monthly update is **~6 fixed sections in ~250 words**. Top VCs prefer short and consistent over long and sporadic — the format itself signals operational discipline.

```text
1. Headline       one line: the month in a sentence
2. Highlights     3–5 bullets, the wins that matter
3. Metrics table  4–6 KPIs: actual vs target vs prior period
4. Challenges     2–3, each PAIRED with a solution or learning (never a naked problem)
5. Asks           specific, named — "intro to the VP Sales at X", not "let me know"
6. Cash / runway  current cash, monthly burn, months of runway
```

The metrics table is the spine — same KPIs every month so trend is legible at a glance:

```text
| Metric        | This month | Target | Last month |
| ------------- | ---------- | ------ | ---------- |
| MRR           | $42k       | $45k   | $38k       |
| New logos     | 7          | 8      | 5          |
| Net churn     | 1.2%       | <2%    | 1.8%       |
| Cash runway   | 14 mo      | —      | 15 mo      |
```

- **Fixed cadence, never broken.** Monthly for early-stage, quarterly for growth-stage. Pick a day (e.g. the 5th) and hold it — consistency is the signal. Only emailing investors when you need money trains them to brace, not to help.
- **Every challenge is PAIRED with a solution or learning.** A naked problem reads as a founder who is stuck; a problem-with-a-plan reads as a founder who is in control.
- **Asks are named, not vague.** Vague asks ("let me know if you can help") get ignored; named asks ("intro to the VP Sales at Acme") convert passive backers into active allies.

```text
Bad  (ask)         "Let me know if you can help with anything."
Good (ask)         "Need a warm intro to a Head of RevOps at a 200+ Series-B SaaS — who do you know?"
Bad  (challenge)   "Sales cycle is too long."
Good (challenge)   "Sales cycle stretched to 70 days — fix: added a security-review pack to the deck, two deals already re-accelerated."
```

Fill-in 6-section template + a filled mini-example + the vague-ask banlist → `references/update-and-onepager-templates.md`.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I'll dump every file in one folder, they'll find it" | Investors spend ~2–3h total; disorganization kills 68% of failed deals. Number the 8 categories, name `YYYY-MM_Doc_vN`. |
| "`final_v2_FINAL(2)` is fine, I know which is current" | They don't. A stale un-versioned file gets diligenced as truth. Date + version every file. |
| "Send the full deck for cold outreach" | The deck closes; it doesn't open. Send the one-pager — ~2.5x the response rate — deck stays behind the link. |
| "Put the P&L and cap table in the teaser so they have everything" | A teaser carries no confidential financials. Those live in the data room behind a per-investor link. |
| "'Let me know if you can help' covers it" | Vague asks get ignored. Name the intro, the role, the company. |
| "I'll email investors when I have news / need money" | Sporadic updates train backers to brace. Fixed cadence (monthly/quarterly), never broken. |
| "List the challenge, they'll appreciate the honesty" | A naked problem reads as stuck. Pair every challenge with a solution or learning. |
| "I'll write the deck / model in here too" | Out of scope. Route to `pitch-deck` / `financial-model`; package what they produce. |
| "Pad the room to 70 files so it looks thorough" | Drafts dilute focus and signal poor prioritization. Omit until ready; clean beats padded. |

## Verify + handoffs

After generating `dataroom-index.md`, `one-pager.md`, or `investor-update.md`, run the structural lint:

```bash
./scripts/verify.sh path/to/one-pager.md     # or dataroom-index.md / investor-update.md
```

It asserts the 8 numbered categories (data room), the 7 blocks + a numeric ask (one-pager), and the 6 sections incl. a metrics table + runway line (update); and it flags placeholders (`TBD`, `XX`, `[amount]`), vague asks, and confidential financials leaking into a teaser. **Structural lint only** — persuasion, metric selection, and framing are judgement the capability eval scores, not the script.

Handoffs:

- `../pitch-deck/SKILL.md` — the slide narrative and story arc you consume.
- `../financial-model/SKILL.md` — the projections, burn/runway, cap-table math you reference.
- `../fundraising/SKILL.md` — the round strategy, investor pipeline, SAFE vs priced.
- `../cold-outreach/SKILL.md` — the first-touch email your one-pager attaches to.
- `../unit-economics/SKILL.md` — the LTV/CAC/payback figures you surface in the update and one-pager.

## References

- `references/dataroom-checklist.md` — the full 8-category, ~60-document checklist with per-stage (seed vs Series-A) inclusion flags, the file-naming/versioning convention, and the "surface first" vs "omit until ready" lists.
- `references/update-and-onepager-templates.md` — fill-in monthly-update template (6 sections + metrics table) and one-pager template (7 blocks), each with a filled mini-example, plus the vague-ask banlist with Bad→Good rewrites.
