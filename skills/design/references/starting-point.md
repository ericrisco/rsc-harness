# Reference — proposing a starting point

Three places promise to propose one: `../../design-loop/SKILL.md` phase 1 when the user says *skip*,
the closing line of `brand-grounding.md` when a visual dimension has no direction, and
`../../design-dna/SKILL.md`'s REUSE mode. This file is what they propose *from*. Without it the
fallback is your own prior, which is the AI-template median — the thing the whole area exists to escape.

## 0. What the project already owns wins

**Look before you offer.** Run it; do not reason about it:

```bash
npx @ericrisco/rsc doctor --json   # read `designStartingPoint`
```

| State | What it means | What you do |
| --- | --- | --- |
| `owned` | An identity article or at least one legible style record exists | Propose **that**, by name, first. Offer nothing external until the user rejects it. More than one record → all of them are candidates, ordered as reported. Never pick one silently. |
| `none` | Looked in both scopes, found nothing | Go to §1. |
| `inconclusive` | Something could not be read | Say what, and ask for another route to it. **Do not propose past a blind spot** — a proposal made without looking is the defect this file exists to remove. |

If the owned identity **contradicts** what the user is now asking for, name the conflicting rule and let
them decide which wins. Same rule the loop's preflight already applies to a bar from outside.

A record that `doctor` reports with a pair below its contrast floor is not offered as a starting point.

## 1. What are you building → which bar

At most **three** candidates. Each one gets a name, one line on why it fits *this* product, and one line
on when it would be the wrong choice. Then **wait**. No answer → take the most demanding one and say so.

Sources are in `inspiration-sources.md`; the tier-1 set and the dated-looking list are in
`trends-2026.md`. **Only propose what you can actually open** — that registry marks several sources as
bot-blocked, and a bar that cannot be fetched dies in the loop's preflight.

| Building | Candidate bars | Wrong choice when |
| --- | --- | --- |
| SaaS marketing | Stripe · [SaaS Landing Page](https://saaslandingpage.com) browsed by section · Linear | The product is a daily tool, not a purchase decision — a marketing skin on a workhorse |
| Dev tool | Linear · Vercel · Resend · [Primer](https://primer.style) | The audience is not technical: dev-tool restraint reads as unfinished to them |
| Dashboard / internal tool | [Carbon](https://carbondesignsystem.com) · [Polaris](https://polaris.shopify.com) · [Mobbin](https://mobbin.com) flows | It is a landing page with a chart on it — density is not the job |
| Portfolio / editorial | [Awwwards](https://www.awwwards.com) · [Recent](https://recent.design) · [One Page Love](https://onepagelove.com) | Anything with a conversion target: award craft routinely costs LCP and the 5s test |
| E-commerce | [Minimal Gallery](https://minimal.gallery) for restraint · [Nicely Done](https://nicelydone.club) for real product surfaces | The catalogue is huge and the real problem is search and filtering, not the hero |
| Docs | [Stripe docs](https://docs.stripe.com) · [Material 3](https://m3.material.io) on states | Reading is not the job — it is a reference table, so density beats calm |

Nothing here fits what they are building? **Say so and interview.** Do not stretch the nearest row: a bar
chosen because it was closest is the vague bar that makes the loop approve everything on round one.

## 2. A proposal is not an answer

1. **Open the reference.** No value is proposed from a page you did not fetch. Blocked → say so, pick
   another. Never substitute a description from memory.
2. **Measure it** — the loop's teardown already does this and writes 5 to 7 mechanisms. Those measured
   values *are* the researched default this file was missing. They are not invented, and they come from
   a page that already ships.
3. **Check colour before writing it.** Any text pairing must measure **≥ 4.5:1** (≥ 3:1 for large text
   and UI). Below that, it is **not proposed** — not proposed-with-a-warning.
4. **Write it marked `propuesto`, naming the reference it came from.** Never as a confirmed value.
5. A dimension that is proposed and not yet confirmed **does not count as complete** against
   `brand-grounding.md`'s checklist. The hard STOP stays up for it. Otherwise the prefill becomes the
   way to cross the gate with nobody having confirmed anything.
6. Only what the user confirms becomes the project's identity.

## 3. The base is the floor, not the concept

A starting point gets you a defensible floor in one exchange. It does **not** satisfy the ONE signature
element (`signature-and-craft.md` §2), and it never will: every project that picked the same bar would
converge on the same page. If the only thing making this surface distinctive is the bar it started from,
there is no concept yet.

## See Also

- `inspiration-sources.md` — the source registry, dated, with the bot-blocked entries marked.
- `trends-2026.md` — the tier-1 set, and what currently reads as a template.
- `brand-grounding.md` — the checklist this fills in, and the STOP it does not lift.
- `signature-and-craft.md` — the part a starting point cannot give you.
