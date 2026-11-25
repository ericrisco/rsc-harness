# Funnel math, intro paths, tiering & the pipeline schema

Everything here serves one job: build a target list **sized from the term sheets you need**, weighted toward warm paths, and tracked by stage conversion instead of activity. The arithmetic is deliberately conservative — round down, then add buffer.

## Work backward from term sheets

You don't pick a list size and hope. You start from the outcome and divide.

```text
Target outcomes        ~2–3 term sheets (you want a comparison, not a single offer)
First→second meeting   ~50%   (a strong first meeting half-converts to a partner/2nd)
Outreach→first meeting ~15%   (blended across warm + cold; cold drags this down hard)

Back-solve (illustrative, blended warmth):
  3 term sheets
   ÷ ~10–15% (meeting → term sheet, after diligence attrition)
   ⇒ ~20–30 real first meetings
   ÷ ~15% (outreach → first meeting)
   ⇒ ~130–200 outreaches at pure-blended rates
```

That blended number is why **warmth is the whole game**: shift the mix toward warm intros and the required top-of-funnel collapses. A list that is 60% warm needs far fewer names than a 100%-cold list for the same meeting count. Practical target for a seed: **~50–100+ qualified targets**, warmth-weighted, not 200 cold names.

## Warm-intro priority ladder (with conversion bands)

Rank every target by the **warmest path you actually have**, not by how much you like the fund.

```text
Path                                          Outreach → meeting
1. Existing investor / angel routes you in    ~30–50%   (best; they vouch)
2. Portfolio founder of the target VC         ~30–50%   (founders get read fast)
3. Mutual advisor / operator / accelerator    ~20–35%   (warm-ish)
4. Cold email / DM (no path)                  ~1–3%     (last resort)
```

The spread between row 1 and row 4 is ~10–20x. So the list-building work is **finding the path**, not collecting names: for every Tier-A fund, ask "who is the warmest human who can introduce me?" before the fund goes on the list.

**Weak-network playbook:** if you have few warm paths, manufacture them — accelerator demo days, scout programs, portfolio-founder intros (cold-email a portfolio founder, not the partner — founders answer founders), angel syndicates, and operator communities. Build the warm layer first; only then let `../cold-outreach/SKILL.md` write the cold messages for the genuine no-path targets.

## A/B/C tiering rubric (fit × intro warmth)

Score each target on two axes, then bucket. Spend your concentrated sprint on A and B.

| Tier | Stage fit | Thesis/sector fit | Intro warmth | Treatment |
| --- | --- | --- | --- | --- |
| **A** | exact stage (writes your check size) | core thesis (sector + model) | warm path (ladder 1–2) | first wave, week 1, partner-targeted |
| **B** | adjacent stage or check | adjacent thesis | warm-ish (ladder 3) | second wave, week 1–2 |
| **C** | possible | weak/unknown fit | cold (ladder 4) | only if A/B underfill the funnel |

Tag every row with: **stage fit · thesis fit · tier · warmest intro path · who makes the intro · status**. A target with perfect thesis fit but no path is still a B/C until you find the path — fit without access is not a real lead.

## Pipeline stage schema

Track **count-in-stage and stage-to-stage conversion**, not "emails sent." If a stage isn't converting at its benchmark, that's your diagnosis (see below).

```text
Sourced            → on the list, tier assigned, path identified
Intro requested    → asked the connector / sent the (warm or cold) outreach
First meeting      → met (call/in-person)
Partner / 2nd      → advanced to a second/partner meeting
Diligence          → data-room access, references, deep dive
Term sheet         → received an offer
Closed             → signed & wired
```

Conversion benchmarks to instrument it: **outreach → meeting ~15%**, **first → second ~50%**. Watch where you fall off market:

- High outreach, low **first-meeting** rate → list is too cold or off-thesis. Fix warmth/fit, not volume.
- Good first meetings, low **second-meeting** rate → the story/traction isn't landing (`../pitch-deck/SKILL.md`) or the numbers don't hold (`../financial-model/SKILL.md`).
- Meetings but **no term sheet** → momentum is serial, not parallel; you're not running a sprint (see `process-playbook.md`).

## Worked example — sizing the top-of-funnel for a $3M seed

```text
Goal:           $3M seed, want 2–3 term sheets to create a comparison
Network:        moderate — some warm paths, accelerator alum

Target meetings:   ~25 strong first meetings (to yield 2–3 term sheets after attrition)
Warmth mix:        aim 60% warm / 40% cold

Warm slice (15 meetings @ ~35% warm conversion):   ~43 warm outreaches
Cold slice  (10 meetings @ ~2%  cold conversion):  ~500 cold outreaches  ← brutal

Decision: that cold slice is uneconomical. Re-weight to 80% warm:
  20 warm meetings @ ~35% ⇒ ~57 warm outreaches
   5 cold meetings @ ~2%  ⇒ ~250 cold outreaches
Top-of-funnel:  ~60 Tier-A/B warm targets + a ~250-outreach cold tail for 5 meetings.
```

The lesson the math forces: **the cold tail is a rounding error of meetings for a mountain of work** — invest the time in manufacturing warm paths, not in scaling cold. Hand the resulting dilution and cap-table arithmetic to `../financial-model/SKILL.md`; hand the cold-message copy for the tail to `../cold-outreach/SKILL.md`.
