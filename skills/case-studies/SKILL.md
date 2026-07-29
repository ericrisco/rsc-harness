---
name: case-studies
description: "Use when turning one named customer's measured win into a case study, or the attributed testimonial quote that travels with it — consent-cleared, metrics-anchored proof for the next skeptical buyer. NOT the deck that sells the vision to a room (that is `pitch-deck`), NOT thought-leadership with no single named customer (that is `article-writing`)."
tags: [case-study, testimonial, social-proof, customer-story, conversion]
recommends: [pitch-deck, article-writing, retention, review-management, brand-voice, landing-copy]
origin: risco
---

# case-studies

You write the consent-cleared, metrics-anchored story of a customer who already won — and the short attributed quote that travels with it. Your reader is the *next* skeptical buyer, not your own marketing team. Every line either advances that buyer's decision or it is cut.

A case study is a proof artifact, not a brochure. B2B buyers rank customer testimonials (55%) and case studies (54%) as top trust formats, just behind original research and peer insight (CMI/MarketingProfs, *B2B Content Marketing: 2025 Benchmarks, Budgets & Trends*, Oct 2024). They are reading to de-risk a purchase. A page that praises the vendor and hides the numbers fails that job no matter how polished the prose.

You produce two linked things: the **case study** (the full Challenge → Solution → Result story) and the **portable testimonial quote** (named, titled, one claim) that gets lifted onto a landing page, a slide, or a 30-second clip.

## What this produces / route out first

If the request is not a single customer's measured outcome, hand it off before you write a word.

| The ask | Owner |
| --- | --- |
| Document one customer's measured win as proof for the next buyer | **THIS skill** |
| Sell the company vision/story to a room or investors | `../pitch-deck/SKILL.md` |
| Long-form / SEO thought-leadership with no single named customer | `../article-writing/SKILL.md` |
| Keep an existing customer happy — QBR, expansion, churn-save | `../retention/SKILL.md` |
| Solicit or reply to public reviews / ratings | `../review-management/SKILL.md` |
| The reusable cross-channel tone-of-voice rules | `../brand-voice/SKILL.md` |
| Drop the proven quote into a converting page | `../landing-copy/SKILL.md` |
| Price the offer this win justifies | `pricing` |

The one-sentence call: it is a case study if a real, named customer already got a measured result and consented to be quoted.

## The intake gate — STOP if any of these is missing

Do not start prose until you have all three. A missing piece is a gathering task or an anonymization decision, never an invention.

- **The metric set** — baseline, result, timeframe, and a money figure if the customer permits it. Why: a number with no baseline or timeframe is a claim, not a result. "Increased revenue" is unfalsifiable; "€420k → €1.6M in 11 months" is proof.
- **The named source** — a real person with title and company for the quote. Why: an anonymous "— a happy client" reads as fabricated and a same-industry, named quote lifts lead quality far more than a generic one.
- **The consent status** — written sign-off to publish the name, quote, logo, and numbers. Why: publishing an un-consented named customer is the legal failure mode, not a style miss (see below).

If you lack a metric → ask for it or do not claim it. If you lack consent → anonymize honestly ("a 200-seat logistics SaaS") or do not ship. Never round a vague number up to look better.

## The legal + consent floor

This is the hard floor, not a nicety. The FTC Consumer Reviews and Testimonials Rule has been in force since 21 October 2024, with penalties up to ~$53,088 per violation (the FTC's max is inflation-adjusted annually — this is the figure effective 17 Jan 2025; re-check FTC.gov before quoting it as current).

- **Real customer, honest statement.** No fabricated, scripted, or insider testimonial presented as an ordinary customer. If the speaker is an employee, investor, or affiliate, you must add a clear-and-conspicuous material-connection disclosure or drop the quote.
- **Substantiation.** You may not publish a metric you cannot back with a source. If you cannot point to the data, the number does not go in.
- **Written consent, kept.** Get sign-off before publishing the name, exact quote, logo, image, and figures. An email confirmation suffices, but it must be retained.
- **Edit the quote only with approval.** You may tighten a quote for clarity, but the customer must approve the edited wording — you cannot change what they meant.

Carry the consent state in the artifact's front-matter so it is impossible to ship a story whose status is unknown:

```yaml
---
customer: "Acme Logistics"
consent: signed          # signed | pending | anonymized
approved: 2026-05-28     # date the customer signed off on the exact quote
quote_source: "interview-2026-05-20.txt"
---
```

`consent: pending` means draft-only. `consent: anonymized` means no name/logo/identifying detail ships. Only `consent: signed` may publish a named, quoted, imaged customer. Full intake form, consent/release checklist, approval-email wording, substantiation and insider-disclosure notes, and the anonymization fallback rules live in `references/consent-and-substantiation.md`.

## Case-study anatomy

Write the sections in this order. Each earns its place; cut anything that does not advance the buyer's decision. Target **600–1,200 words** — long enough to prove the result, short enough that a busy buyer finishes it.

1. **Results headline** — one KPI, the single most important number. Why: it is the only line many readers see. "Fraud cut to 0.10% in 8 weeks," not the customer's company name.
2. **Snapshot box** — above the fold: industry, region, products used, and the headline KPIs. Why: a skeptical buyer self-qualifies in seconds ("same industry as us? same size?").
3. **Challenge** — the measurable pain before, in the customer's words. Why: the buyer must see their own problem to care about the fix.
4. **Solution** — what was implemented and how, concrete and specific. Why: vague "we partnered closely" proves nothing; "migrated 1,200 SKUs to the new pricing engine in two sprints" proves capability.
5. **Result** — the before/after numbers with timeframe, as Context-Achievement-Relevance lines (below). Why: this is the proof the whole piece exists to deliver.
6. **Attributed quote** — named + title + company, one specific claim. Why: the human voice is the conversion lever, and the quote is what travels onto other surfaces.
7. **Decision-stage CTA** — one next step matched to where the reader now is ("See pricing," "Book a 20-min fit call"). Why: proof with no next step wastes the intent it just built.

The ordered skeleton and a filled mini-example with real-shaped numbers are in `references/case-study-skeleton.md`.

## Metrics-first

Collect the numbers before you write any prose. The story is built around the data, not decorated with it.

Write each result as a **Context → Achievement → Relevance** line: what changed, the measured lift, and what it was worth.

```text
Bad:  "The new workflow improved efficiency significantly and the team is much happier."
Good: "Restructuring lead nurturing (context) drove a 43% conversion lift (achievement),
       generating €1.2M in additional annual revenue (relevance)."

Bad:  "We helped them process invoices faster."
Good: "Cut invoice-processing time from 6 days to 4 hours (−97%) within the first quarter."
```

A result that lacks a baseline or a timeframe is not a result — it is an unfalsifiable claim. Always pair before with after, and always state the window.

## Testimonial / quote craft

The quote is the conversion lever, so make it carry weight. Specific beats glowing. One claim per quote — a quote that says three things says nothing.

```text
Bad:  "Great product, the team is amazing, highly recommend! — a happy customer"
Good: "We cut new-hire onboarding from 3 weeks to 2 days — my team stopped dreading
       every new starter. — Ana Pérez, COO, Acme Logistics"
```

Rules:

- **Named + title + company.** Attribution is what makes it believable. Anonymous quotes read as invented.
- **Same industry wins.** A quote from the prospect's own sector lifts lead quality; match where you can.
- **One concrete claim.** Tie the quote to a number or a felt change, not to adjectives.
- **The customer's voice, not yours.** If it sounds like your marketing, the buyer discounts it. Approve any edit with the customer.

## Format leverage — write once, cut many

Default to a repurposable structure, because video is now the top-rated B2B content format (58% rate it most effective, with case studies/customer stories close behind at 53% — CMI/MarketingProfs *2025 Benchmarks*, Oct 2024) and testimonials are a measured conversion lever, not decoration: a three-line testimonial block lifted landing-page conversion 34% in VWO's WikiJob A/B test, and Unbounce reported swapping static reviews for video testimonials lifted conversion up to 80%. From one signed-off case study you should be able to cut, with no new approval needed:

- a **pull-stat card** (the headline KPI on its own),
- a **quote card** (the attributed testimonial),
- a **30–60s video script** (challenge in one line, result in one line, the quote read aloud).

Write the prose so these fall out cleanly; do not produce a separate brochure for each. (This is the cut, not a full video-production guide — that craft lives elsewhere.)

## Anti-patterns

| Bad | Good |
| --- | --- |
| Hero headline is the customer's company name | Hero is the result + a number ("Churn cut 40% in one quarter") |
| "Increased revenue" with no baseline or window | baseline → result → timeframe, every time |
| Publish the quote before the customer signs off | Exact-quote written approval first, retained |
| Anonymous "— a satisfied client" | Named + title + company, or anonymize the whole story honestly |
| Superlatives: "revolutionary", "seamless", "best-in-class" | Verifiable specifics with units |
| Insider/employee quote presented as a customer | Clear material-connection disclosure, or drop it |
| Vendor-praise narrative ("we are proud to...") | Buyer-serving proof ("here is what changed for them") |
| One 2,500-word wall of prose | 600–1,200 words, snapshot box up top, scannable |
| A metric you cannot source | Only published numbers you can substantiate on demand |

## Verify + handoffs

`scripts/verify.sh <case-study.md>` is a read-only structural and legal lint. It checks for a quantified hero metric, the required Challenge/Solution/Result sections and snapshot box, an attributed quote, a before→after signal, a CTA, and the `consent:` / `approved:` marker — and it warns on the superlative banlist. It **fails hard** when the hero has no metric, a core section is missing, or consent is unmarked, because shipping an un-consented named quote is the legal risk. It is structural lint only; persuasion quality is the capability eval's job and yours.

Hand off when the piece is done: the proven quote → `../landing-copy/SKILL.md`, the broader narrative → `../article-writing/SKILL.md`, the slide version → `../pitch-deck/SKILL.md`, the public-review angle → `../review-management/SKILL.md`.
