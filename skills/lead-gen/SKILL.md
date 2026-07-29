---
name: lead-gen
description: "Use when building and qualifying a prospect list before anyone reaches out — a falsifiable ICP, named accounts/contacts from Apollo/ZoomInfo/Clay, deduped against the CRM, tiered by fit+intent+engagement. NOT writing or sending the outreach (that is cold-outreach), NOT tracking the deal after first contact (that is sales-pipeline)."
tags: [lead-generation, prospecting, icp, lead-scoring, sales]
recommends: [cold-outreach, sales-pipeline, market-research, data-scraper, spreadsheet-ops, email-deliverability, gdpr-privacy]
origin: risco
---

# Lead Gen — The List and the Model That Ranks It

*You turn "we sell X to Y" into a deduplicated, scored, compliance-cleared roster of named accounts and people. You define the target, you build the list, you rank it — then you stop. What you produce is a prioritized roster plus the rationale that ranked it; the hand-off is the finish line, not the campaign.*

## The pipeline — three phases, two gates

Run these in order. Each gate is a hard stop: do not advance until the prior phase produced its artifact.

1. **Define the target** → a falsifiable ICP + persona. *Why: you cannot dedupe or score against a vibe; a vague ICP guarantees reps chase the wrong companies.*
2. **Build the list** → sourced, deduped, verified rows with provenance. *Why: an unverified or undocumented list is a deliverability and legal liability before a single email goes out.*
3. **Score & prioritize** → tiered list (A/B/C) with subscores + handoff packet. *Why: an unsorted list means reps work the easy-to-reach names, not the right ones.*

Between phase 2 and the handoff sits the **compliance gate** (GDPR LIA + CAN-SPAM). Run it *before* you hand anything off, never after the first send.

## Phase 1 — Define a falsifiable ICP

An ICP is falsifiable when you can look at any company and answer "in or out?" with no judgement call. Write three blocks:

- **Firmographic** — headcount band, revenue band, region/country, industry/NAICS, funding stage. Numbers, not adjectives.
- **Technographic / intent** — required stack (e.g. "runs Salesforce"), or an active trigger (hiring for role X, recently raised, surging on a topic). Apollo filters on 1,500+ technologies and active job postings, so make these checkable. *(docs.apollo.io People API Search, accessed 2026-06-02.)*
- **Negative criteria** — the `disqualify if…` list. This is the half everyone skips and the half that saves the most rep time.

Then write the **buyer persona(s)** inside the account: title, seniority, the pain they own, the trigger that makes now the moment.

```text
BAD ICP (un-falsifiable — every company "kind of" fits):
  "Mid-market SaaS companies that could use better analytics."

GOOD ICP (any company resolves to in/out):
  Firmographic:   50–500 employees · $5M–$50M ARR · US + EU · B2B SaaS
  Technographic:  runs Snowflake OR BigQuery · hiring a "Data Analyst" now
  Negative:       DISQUALIFY IF <50 employees · agency/reseller · no data team
  Persona:        Head of Data / VP Eng · owns dashboard sprawl · triggered by
                  a recent funding round (new headcount to equip)
```

## Decision — pick the qualification framework by deal size

Do not default to BANT. The framework must match the deal's size and cycle, or you qualify on the wrong signals. *(leadsatscale.com / callingagency.com qualification guides, accessed 2026-06-02.)*

| Framework | Stands for | Use when |
|---|---|---|
| **BANT** | Budget · Authority · Need · Timeline | High-velocity SMB, deals under ~$50K ARR, short cycle, 1–2 stakeholders |
| **CHAMP** | Challenges · Authority · Money · Prioritization | Consultative selling — lead with the prospect's problem, not your budget question |
| **MEDDIC** | Metrics · Economic-buyer · Decision-criteria · Decision-process · Identify-pain · Champion | Enterprise, deals over ~$100K, 5+ stakeholders, long cycle |

The framework you pick becomes the qualification fields on every row — so choose it before you score, not after.

## Phase 2 — Build the list

**Source selection.** No single database wins, so the 2025 norm is a *waterfall*: layer providers and stop at the first verified hit. *(starnus.com / cleanlist.ai provider comparisons, accessed 2026-06-02.)*

| Provider | Rough coverage | Note |
|---|---|---|
| Apollo | ~200M contacts | Search is free + credit-free; enrichment costs credits; ~78% email accuracy |
| ZoomInfo | 321M+ contacts / 104M+ companies | ~84% email accuracy; strongest firmographics |
| People Data Labs | Broad person/company graph | Good as a waterfall fill layer |
| Clay | Orchestrates 100+ sources | The waterfall *engine* — runs the layering for you |

**The waterfall rule:** order providers by accuracy-per-dollar, query the next layer only for rows the previous one missed or could not verify, and **stop at the first verified hit**. You pay once per contact, not once per provider.

**Apollo People Search → Enrichment flow.** Search and enrichment are two different endpoints — search finds people but returns *no* emails/phones; enrichment (credit-consuming) returns the contact data. *(docs.apollo.io, accessed 2026-06-02.)*

```text
1. POST /api/v1/mixed_people/api_search   (free, no credits)
   filters: person_titles, person_seniorities, organization_locations,
            organization_num_employees_ranges, q_organization_keyword_tags,
            currently_using_any_of_technology_uids, q_organization_job_titles
   → returns up to 50,000 records (100/page × 500 pages) — IDs + firmographics,
     NO email/phone.

2. POST /api/v1/people/bulk_match     (consumes credits)
   → enriches the IDs you actually want with email + phone.
```

Search broad and free first, then spend credits enriching only the rows that survive your ICP filter and dedupe.

**Dedupe against the CRM.** Before enriching, strip rows that already exist in the CRM (match on company domain + person email/LinkedIn). You do not pay to re-source a known account, and you do not want a rep cold-touching an active opportunity.

**Verify — mandatory, not optional.** Apollo (~78%) and ZoomInfo (~84%) email accuracy both sit at the edge of the high-volume-sender red-flag line. *(cleanlist.ai / fundraiseinsider.com, accessed 2026-06-02.)* Run a verification pass (bounce-check the address) before any row is handed off — a stale list is a `lead-gen` defect, not a copy or deliverability problem.

Full provider comparison, the waterfall ordering heuristic, and the provenance/compliance field spec each row must carry → `references/data-sources.md`.

## Phase 3 — Score & prioritize

Use a composite **100-point** model. Single-signal scoring fails; the proven split is **~30 fit + ~50 engagement + ~20 intent**. *(houseofmartech.com / theinsightcollective.com intent-scoring guides, accessed 2026-06-02.)*

- **Fit (≈30)** — how well the account matches the ICP firmographics/technographics.
- **Engagement (≈50)** — behavioral signals: site visits, content downloads, replies, demo views.
- **Intent (≈20)** — third-party intent surge on your category/keywords.

**The load-bearing rule: intent without fit is noise.** A 10-person company surging on "enterprise CRM" is not your buyer — fit gates the score. Never let an intent spike alone tier a row up.

Tier on the total:

| Tier | Score | SLA |
|---|---|---|
| A | 90–100 | Route now, first contact within 24h |
| B | 75–89 | 48h SLA |
| C | 60–74 | Nurture, no rep time yet |

The full 100-pt rubric, negative scoring, score decay, the tier→SLA map, and the scored-list **CSV schema** → `references/scoring-model.md`.

**Handoff packet** (what leaves this skill): the tiered CSV, the ICP + persona it was built against, per-row provenance, and the scoring rationale for the A tier. Nothing more — no message, no pipeline stage.

## Compliance gate — run BEFORE handoff

A list that ships without these fields is not done. Run both checklists; the strictest applicable jurisdiction wins.

**GDPR (EU B2B).** Cold B2B email runs on **legitimate interest, Art. 6(1)(f) — not consent** — but only if you have done the paperwork. *(derrick-app.com / instantly.ai GDPR-B2B guides, accessed 2026-06-02.)*

- [ ] A documented **Legitimate Interest Assessment (LIA)** exists.
- [ ] Every email will carry the data-source disclosure + a privacy-policy link + a one-click opt-out.
- [ ] Objections will be honored.
- [ ] **No purchased or scraped data** — those confer no lawful basis, full stop.

**CAN-SPAM (US).** *(ftc.gov CAN-SPAM compliance guide, accessed 2026-06-02.)*

- [ ] A valid physical postal address is available for the footer.
- [ ] A clear opt-out mechanism, honored within **10 business days**, live ≥30 days.
- [ ] Penalty awareness: up to **$53,088 per violating email**, FTC-enforced.

To lint a produced list file for the required columns, score-range sanity, provenance presence, and a compliance flag, run `scripts/verify.sh path/to/list.csv` (read-only).

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Buying/scraping a list and emailing it | No GDPR lawful basis; CAN-SPAM exposure up to $53,088/email | Source + verify + document the LIA + provenance per row |
| Scoring on intent alone | Intent without fit is noise — surge ≠ buyer | Composite fit+intent+engagement; fit gates the tier |
| One ICP/framework for every deal size | BANT on a MEDDIC deal qualifies on the wrong signals | Pick the framework by deal size/cycle first |
| Skipping email verification | 78–84% accuracy = bounces + domain reputation damage | Waterfall + a verify pass before handoff |
| Enriching before deduping against the CRM | You pay to re-source known accounts and risk touching live deals | Dedupe on domain/email first, enrich the survivors |
| Handing reps a raw, unsorted list | Reps work easy-to-reach names, not the right ones | Tier A/B/C with SLAs and an A-tier rationale |
| Treating the list as the goal | A list is not a pipeline and not a campaign | Hand A/B to cold-outreach, accepted leads to sales-pipeline |

## Handoff — where the list goes next

This skill stops at a scored, compliance-cleared list. From there:

- The **A/B tiers + persona context** go to `../cold-outreach/SKILL.md` — that skill writes the message and the cadence; you do not.
- **Accepted leads** (worked and responsive) go to `../sales-pipeline/SKILL.md` — that skill tracks stages, forecasts, and manages the deal; you do not.
- If the request is really "how big is this market / which segment?" with no named list, that is `../market-research/SKILL.md`, not this skill.
