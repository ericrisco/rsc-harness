# Landing Copy by Section

The words for every landing section. `../../design/SKILL.md` owns the visual treatment, the layout and which sections exist (its argument step: one claim per section); this file owns the copy that goes inside each section. Each section has **one copy job**; cut any section whose job you can't name. Ground every line in the brand study (`brand-grounding.md`) and run the value prop through the canvas (`copy-frameworks.md`) first.

## Section map (copy job + framework)

| Section | Copy job | Framework | Conversion principle |
| --- | --- | --- | --- |
| Hero | State the value prop; pass the 5s test | Outcome + timeframe headline | Clarity beats cleverness |
| Social-proof strip | Borrow credibility instantly | Quantified, attributed | Authority / social proof |
| Problem / agitation | Name the pain in the reader's words | PAS | Loss aversion |
| Solution | Show the product doing the job | FAB | Concreteness over claims |
| Features → benefits | Translate each capability into an outcome | FAB / JTBD per item | Self-relevance |
| How-it-works | Reduce perceived effort | 3-step sequence | Effort reduction |
| Testimonials / case study | Prove it works for people like them | Quantified quote | Similarity + proof |
| Objection handling | Preempt the top "no" | "X without Y" | Risk reduction |
| Pricing | Make the choice easy; frame value | Value framing, anchored | Anchoring |
| FAQ | Answer the real blockers | Question → direct answer | Friction removal |
| Final CTA | One action, value on the button | CTA verb + reassurance | Single decision |

## Hero

The highest-leverage copy on the page. Headline + subhead + one proof signal must answer what/who/why-better in text alone.

```text
HERO (Driftway)
Eyebrow ... For platform teams        (optional — qualifies the audience fast)
Headline .. Preview every branch — no staging queue
Subhead ... One CLI command gives every pull request its own live URL. Reviewers click a
            link and test the real change, not a screenshot.
CTA ....... Start free   ·   reassurance: No credit card · 2-min setup
Secondary . See a 2-min demo
```

```text
Bad  — "The modern platform for seamless environment management."
Good — "Preview every branch — no staging queue."
```

Hero variants by traffic temperature:

- **Cold / broad:** lead with the problem or the outcome; secondary CTA is "See how it works".
- **Warm / category-aware:** lead with the differentiator ("without a staging queue"); primary CTA is "Start free".

## Social-proof strip

One line that borrows credibility. Quantified and attributed beats a logo wall of strangers.

```text
Bad  — "Trusted by thousands of teams worldwide."
Good — "Used by 240 platform teams — including Northwind, Acme, and Lumen."
```

If you have a hard aggregate metric, lead with it: "1.2M previews shipped this year." If you have neither, mark `[[NEEDS PROOF]]` and ask — do not invent logos or counts.

## Problem / agitation

Name the pain in the reader's exact words (pull from the audience article). PAS: state the problem, agitate the cost, hand off to the solution section. Agitate the *consequence*, don't manufacture fake fear.

```text
Bad  — "Managing environments can be challenging for growing teams."
Good — "Staging is a shared queue. Your fix is done, but it waits behind someone else's
        half-broken branch — and the reviewer pings you for the third time today."
```

## Solution

Show the product doing the job. FAB, led by the benefit. One screenshot's worth of words; `design` supplies the screenshot.

```text
Bad  — "Driftway is a powerful, flexible environment platform."
Good — "Run `driftway up` on any branch. In 30 seconds it spins an isolated environment
        and prints a live URL — the same one your reviewers open."
```

## Features → benefits

One item per real capability. Each climbs feature → benefit, lands on the benefit, and (where possible) carries a proof fragment. Never a bare feature list.

```text
Bad  (list)      — "Auto-teardown. RBAC. Audit logs. Parallel environments."
Good (benefit)   — "Auto-teardown on merge — never pay for idle infra or clean up by hand."
                   "Role-based access — give contractors a preview without prod keys."
                   "Parallel environments — every open PR is live at once, no contention."
```

Keep each to one sentence; the section earns its scannability from parallel structure.

## How-it-works

Reduce perceived effort to as few steps as honestly possible (3 is the sweet spot). Each step is a verb the reader performs, not a feature you have.

```text
1. Install once — `npm i -g driftway`, link your repo.
2. Push a branch — Driftway builds an isolated environment automatically.
3. Share the URL — reviewers test the real change; it tears down on merge.
```

## Testimonials / case study

A vague rave is worth less than one hard number. Quantify, attribute, make the speaker resemble the reader (same role, same scale).

```text
Bad  — "This tool is amazing, it changed everything for us!" — Happy Customer
Good — "Cut our review setup from 22 min to 90 sec across 40 engineers." — Priya R.,
        Staff Eng, Northwind
```

Case-study micro-structure (BAB): one line of Before (the pain + a number), one of After (the outcome + a number), attribution.

## Objection handling

Surface the real reason they won't buy — price, migration cost, lock-in, security — and answer it directly. "X without Y" is the workhorse.

```text
Objection: "Switching CI tools is a project I don't have time for."
Copy:      "Adopt it without touching your pipeline — Driftway runs as one CLI step inside
            the CI you already have."
```

```text
Objection: "What if I get locked in?"
Copy:      "No lock-in: environments are plain containers from your existing Dockerfile.
            Export or leave any time."
```

## Pricing

Lead each tier with the outcome the buyer gets, then list features. Copy supports the pricing psychology (anchoring, highlighted middle, annual default) that `design` lays out visually.

```text
Starter  — $0      "Ship solo. Unlimited previews on one repo."
Team     — $20/mo  "For squads. Parallel previews, RBAC, shared URLs."   ← Most popular
            (billed annually; "$24 month-to-month")
Enterprise — Custom "SSO, audit logs, on-prem runners, an SLA."
```

```text
Bad  (feature dump)  — "Team: 10 seats, 50 envs, RBAC, SSO add-on, priority support."
Good (value first)   — "Team — everything a squad needs to review in parallel. Then: 10
                        seats, RBAC, shared URLs."
```

Reassurance line near the table: "Cancel anytime · 30-day money-back · no card to start."

## FAQ

Answer the blockers that actually stop the sale, in the reader's words, with a direct first sentence. Skip filler questions. If you add `FAQPage` JSON-LD, the on-page copy must match the markup exactly (the schema itself is in `seo-geo.md` — write the honest answers here). FAQPage is also the single highest-leverage GEO schema for getting cited by AI engines.

```text
Q: Do I need to change my CI pipeline?
A: No. Driftway runs as a single CLI step inside your existing pipeline.

Q: Is there a free tier?
A: Yes. Solo projects are free; paid tiers start at $20/mo billed annually.

Q: What happens to environments after a PR merges?
A: They tear down automatically. You're never billed for idle infra.
```

## Final CTA

Restate the core value in one line, then one primary action with the value on the button and a reassurance microcopy line. No new information, no second decision.

```text
Headline ... Stop babysitting staging.
Sub ........ Give every pull request a live URL in 30 seconds.
CTA ........ Start free   ·   No credit card · 2-min setup
```

```text
Bad  — "Ready to get started? Learn more about our platform today!"
Good — "Stop babysitting staging. Start free — no credit card."
```

## Section QA (copy-only)

- [ ] Each section's copy job is nameable; sections with no job are cut.
- [ ] Hero passes the 5s test in text alone.
- [ ] Every feature climbs to a benefit; lands on the benefit.
- [ ] Proof is quantified and attributed; gaps marked `[[NEEDS PROOF]]`.
- [ ] One primary CTA per viewport, value on the button + reassurance.
- [ ] FAQ answers real blockers; first sentence is the direct answer.
- [ ] Voice matches the brand samples throughout.

## See Also

- `copy-frameworks.md` — the frameworks and headline formulas each section uses.
- `brand-grounding.md` — the value prop, proof, and voice every line is grounded in.
- `../../design/SKILL.md` — the page these words fill; write the copy deck before its markup.
- `campaigns-and-channels.md` — driving traffic to this page.
