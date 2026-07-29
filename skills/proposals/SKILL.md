---
name: proposals
description: "Use when writing the document a buyer reads to say yes — a commercial proposal or Statement of Work, turning discovery notes into a scoped and priced document, adding tiers so the middle one wins, or diagnosing a proposal that will not close. NOT the binding legal agreement with its liability and IP clauses (that is `contracts`), NOT deciding the number or the margin (that is `pricing`), NOT the deck that pitches the vision to a room (that is `pitch-deck`)."
tags: [proposals, sow, sales, scope]
recommends: [contracts, pricing, invoicing, sales-pipeline, pitch-deck, brand-voice]
origin: risco
---

# proposals

You write the artifact that converts a discovered need into a yes: the commercial **proposal** and the **Statement of Work (SOW)**. Your job is persuasion *plus* scope *plus* terms — anchored on the buyer's problem in their own words, with explicit inclusions and exclusions, tiered pricing, deliverables that pass or fail against acceptance criteria, milestones, payment terms, and one concrete next step.

You are a close-oriented commercial writer. You consume the price model and hand off binding terms. You do not draft enforceable legal clauses and you do not decide the numbers.

Median proposal-to-close is **25%**; top quartile is **35%+** (study of 939 companies, 23,000 opportunities, Optifai 2026-04-20). That is the bar. Most of the lift below is the gap between those two numbers — and it is structural, not prose polish.

## Two artifacts, one job

| Artifact | What it is | Write it when |
|---|---|---|
| **Proposal** | The persuasive, scoped, priced document the buyer reads to commit. Exec summary → problem → solution → scope → tiers → timeline → proof → terms → next step. | The buyer needs to be convinced and to choose. Default deliverable. |
| **SOW** | The scoped/termed annex: inclusions, **exclusions**, deliverables with acceptance criteria, milestones, change-order clause, payment schedule. Usually a child of an MSA. | Scope must be contractually precise — once they've said "yes, in principle," or the engagement runs under an existing MSA. |

A proposal persuades and frames; a SOW pins down. Often you write both: the proposal sells, the SOW (or its scope section) becomes the annex that legal attaches under the MSA.

## Route out — do not write the wrong document

| The ask | Goes to | Because |
|---|---|---|
| MSA, liability/indemnity, IP assignment, governing law, signature-for-enforceability | `../contracts/SKILL.md` | Binding legal terms — the moment language is enforceable, it is not yours. |
| "What should we charge? What's the margin / package?" | `../pricing/SKILL.md` | Deciding the number and the model, not presenting it. |
| Slide deck to pitch the vision to a room or board | `../pitch-deck/SKILL.md` | Visual narrative, not a scoped/termed document. |
| Send it, chase it, move the stage, follow-up cadence | `../sales-pipeline/SKILL.md` | Tracking and CRM, not authoring. |
| Deal won — bill it, collect payment | `invoicing` | Billing after the win. |
| Cold first-touch to get the meeting | `../cold-outreach/SKILL.md` | First contact, no scope to propose yet. |
| Tone, naming, voice rules for the copy | `../brand-voice/SKILL.md` | You pull voice from there; you don't define it. |

The one-sentence boundary: a proposal is the persuasive scoped priced document that gets a buyer to commit; the moment the language becomes binding legal terms it belongs to `contracts`, and the moment the question is "what number / what model" rather than "how do I present and scope it," it belongs to `pricing`.

## Intake gate — STOP if you can't fill these

You cannot write a proposal that closes from a feature list. Before drafting, you must have:

1. **The buyer's problem in their own words** — the literal phrasing from the call or brief.
2. **The success metric** — how they'll know it worked (a number, a date, a state).
3. **A budget signal** — band, anchor, or stated constraint. Needed to pitch tiers.
4. **The decision process** — who signs, who influences, what timeline.
5. **Why now** — the trigger that makes this urgent.

Rule: **if you cannot personalize the executive summary to this buyer, do not write it yet — interview first.** Customized exec summaries close at **34% vs 17%** generic; when ~30% of the summary is tailored per client, close rates rise ~50% (Optifai 2026-04-20; DocSend via Thornton & Lowe 2026-06-02). A generic summary literally halves your odds. If you only have a feature list, say so and ask the five questions.

Pull tone and naming from `../brand-voice/SKILL.md` before writing prose.

## Proposal anatomy

Write these sections in this order. Each earns its place.

1. **Cover / title** — client name, project name, date, validity window. Personalization starts on the cover.
2. **Executive summary** (200–400 words) — the one section most buyers actually read. Structure: *their challenge → your solution → the outcome → the investment.* At least ~30% must be specific to this buyer (their words, their metric, their constraint). No solution-features here — outcomes.
3. **Problem framing** — restate their problem and its cost in their terms. Earns the right to propose.
4. **Proposed solution** — your approach, mapped to the problem. What changes for them.
5. **Scope summary** — what's in, with a one-line nod to what's out (full exclusions live in the SOW).
6. **Pricing tiers** — Good/Better/Best (next section).
7. **Timeline / milestones** — phases with dates, so effort feels concrete.
8. **Proof / qualifications** — one or two relevant results, not a logo wall.
9. **Terms summary** — payment schedule, validity, what happens next. Binding clauses are referenced, not drafted here.
10. **Next step** — the close (see "The close").

Full template and a filled mini-example: `references/proposal-skeleton.md`.

## Tiered pricing — present three, recommend the middle

Single-price quotes leave money and close rate on the table. Three-tier pricing lifts close rate **~23%** vs a single price; the middle tier wins **~66%** of the time, and the high tier exists to anchor (Optifai 2026-04-20; Freshproposals/INSEAD 2026-06-02). Decide the actual numbers in `../pricing/SKILL.md` — here you present them.

Rules:
- **Name tiers by outcome, not by feature count.** "Launch / Scale / Dominate" beats "Tier 1 / Tier 2 / Tier 3."
- **Mark the middle as recommended.** Make it the obvious choice; it should map to what most buyers actually need.
- **The top tier anchors** — it should be visibly more, so the middle looks reasonable.
- **Each tier states its outcome**, not just its inclusions.

```text
Bad  (single price, feature-framed)
  Website redesign — $24,000. Includes 8 pages, CMS, SEO setup, 2 revisions.

Good (three tiers, outcome-framed, middle recommended)
  Launch   $18k  — Get the new site live: 8 pages, CMS, handoff.
  Scale    $28k  ★ recommended — Live + ranking + converting: + SEO, analytics, 90-day tuning.
  Dominate $46k  — Scale + a measurable pipeline: + landing-page system, A/B program, quarterly review.
```

## SOW anatomy

The SOW is where vague proposals go to fail. Over **78%** of project failures trace to unclear requirements (ITToolKit/Atlassian 2026-06-02). Every section below is load-bearing. Full template: `references/sow-skeleton.md`.

1. **Scope — inclusions.** Numbered, specific, quantified.
2. **Scope — explicit EXCLUSIONS.** The single most important section. The expensive failure mode is the client assuming a task is in scope while you assumed it was out. State what you are *not* doing. If it's not listed in inclusions, name it here.
3. **Deliverables with acceptance criteria** — a table. Each criterion must be specific enough that a **third party can judge pass/fail** without asking you. "Looks good" is not a criterion; "loads in <2s on 4G, passes the 6 checks in Appendix A" is.
4. **Milestones and dates** — phased, dated, each tied to a deliverable.
5. **Change-order clause** — mandatory. Every scope/timeline/budget change requires *written approval* via a formal change order with updated deliverables, cost, and dates. This is your primary scope-creep defense (Malbek/Icertis 2026-06-02).
6. **Payment schedule** — tied to milestones, not the calendar. Deposit → milestone payments → final on acceptance.
7. **MSA reference** — the SOW is the child; the MSA is the parent governing legal/payment/IP/dispute terms (Sirion/Ironclad 2026-06-02). Reference it; do not re-litigate its clauses. That referencing is exactly why binding terms route to `../contracts/SKILL.md`.

### Deliverable table shape

```markdown
| # | Deliverable        | Acceptance criteria (third-party testable)                  | Due     |
|---|--------------------|-------------------------------------------------------------|---------|
| 1 | Data migration     | 100% of 12,400 records migrated; row counts match source;   | Week 4  |
|   |                    | 0 records in error queue; client signs off on 20-row sample |         |
| 2 | Cutover runbook    | Reproduced by a client engineer with no author present      | Week 6  |
```

## Scope-creep defense — kill weasel words

Every vague noun is a future free-work argument. Replace each with a quantity, a number, or a bound.

| Bad (vague, unbounded) | Good (bounded, testable) |
|---|---|
| "...and ongoing support, etc." | "30 days post-launch support: up to 10 hrs, email, <1 business-day response." |
| "Revisions as needed." | "Two rounds of revisions per deliverable; further rounds via change order at $X/hr." |
| "SEO optimization and more." | "On-page SEO for the 8 listed pages: titles, meta, headings, schema. Off-page is out." |
| "Content to be provided." | "Client provides final copy for all pages by Week 2; delay shifts the timeline 1:1." |
| "Scope: TBD." | Never ship a TBD in scope. Resolve it or move it to exclusions. |

If a word doesn't survive the question "could two reasonable people read this differently?", rewrite it.

## The close — a next step, never "let me know"

Proposals that end with a timeline of specific next steps close **~28%** more; pre-handling objections lifts win rate **~19%**; no follow-up within 7 days closes **40%** less (Optifai 2026-04-20). So:

- **Mutual action plan**: 2–4 dated next steps for *both* sides (e.g. "Mon: you confirm tier; Tue: we send the SOW; Wed: kickoff"). Not "let me know your thoughts."
- **Pre-handle 1–2 objections** the buyer is likely to raise (price vs scope, timing, risk) before they have to ask.
- **Validity window** — "this pricing holds through [date]" — gives a reason to decide.
- **One CTA**, concrete and singular: sign the tier, book the kickoff, return the SOW. Not three soft options.

Sending and chasing the proposal afterward is `../sales-pipeline/SKILL.md`.

## Anti-patterns

| Anti-pattern | Why it loses | Do instead |
|---|---|---|
| Exec summary that lists your features | Buyer reads it first and sees you, not them; generic summaries close at half the rate | Their challenge → your solution → outcome → investment, ~30% tailored |
| Single price | Leaves ~23% close rate on the table; no anchor, no choice | Three outcome-named tiers, middle recommended |
| Scope with inclusions but no exclusions | The #1 scope-creep entry point; both sides assume differently | Explicit EXCLUSIONS section naming what you won't do |
| "Deliver a great website" (unmeasurable) | No way to judge done; final payment stalls | Acceptance criteria a third party can pass/fail |
| No change-order clause | Every "small extra" is a free-work fight | Written-approval change order with updated cost/date |
| Liability / IP / governing-law clauses written into the proposal | You're drafting unenforceable or risky legal terms | Reference the MSA; route binding terms to `../contracts/SKILL.md` |
| Closing with "let me know your thoughts" | No decision forcing function; the deal drifts | Dated mutual action plan + one concrete CTA + validity window |
| Price with no value framing | Buyer compares on cost alone | Tie every tier to its outcome before the number |

## Verify and hand off

- Run `scripts/verify.sh <path-to-proposal-or-sow.md>` on your draft. It greps for the required sections, flags weasel words (`etc.`, `as needed`, `and more`, `TBD`, unbounded `ongoing`), warns on smuggled binding-legal language, and sanity-checks exec-summary length. It is a structural lint, not a quality judge — passing it means the contract of sections is intact, not that the prose persuades.
- Hand binding terms to `../contracts/SKILL.md`, the numbers/model to `../pricing/SKILL.md`, post-win billing to `invoicing`, and send/track to `../sales-pipeline/SKILL.md`.

## References

- `references/proposal-skeleton.md` — full ordered proposal template + a filled one-page services example.
- `references/sow-skeleton.md` — full SOW template: scope/exclusions, deliverable+acceptance-criteria table, change-order clause text, milestone payment schedule, MSA-annex note.
