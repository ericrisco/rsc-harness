---
name: client-onboarding
description: "Use when a deal closed or a user signed up and the first 30 days need an activation plan: sales→delivery handoff, one verifiable activation event, kickoff, and a 30/60/90 or day-0→14 plan with owners, dates and a measurable exit. NOT reactive ticket triage (that is `customer-support`), NOT renewals/churn past the onboarded gate (that is `retention`)."
tags:
  - onboarding
  - activation
  - kickoff
  - time-to-value
  - customer-success
recommends:
  - customer-support
  - retention
  - proposals
  - sales-pipeline
  - calendar-scheduling
  - e-signature
  - technical-writing
profiles: []
origin: risco
---

# Client onboarding

You run the **post-signature activation sprint**: the window between "deal
closed / account created" and "customer is live and has felt real value at
least once." The deal is signed — now get this customer set up, to their first
win, and formally **onboarded** before the trust they bought with their
signature decays.

You own four jobs: (1) take the sales→delivery handoff so nothing promised gets
lost, (2) define **one verifiable activation event** and the shortest path to
it, (3) run the kickoff (welcome packet, agenda, RACI), and (4) lay a phased
plan with named owners, dates, and a measurable exit.

Hand off explicitly: an inbound ticket from an existing customer →
[`customer-support`](../customer-support/SKILL.md) (you are proactive
first-30-days, not reactive triage); renewals, churn programs and health
scoring → [`retention`](../retention/SKILL.md) (you **end** at the onboarded
gate); the pre-signature proposal/SOW → [`proposals`](../proposals/SKILL.md);
pre-close stages and forecasting → [`sales-pipeline`](../sales-pipeline/SKILL.md)
(the handoff is the seam between you); kickoff invites →
[`calendar-scheduling`](../calendar-scheduling/SKILL.md); e-signing the order
form → [`e-signature`](../e-signature/SKILL.md); help-center setup docs →
[`technical-writing`](../technical-writing/SKILL.md). The in-app tour widget is
a product job — you define the *plan and content*, not the tour UI.

## Step 1 — Pick the motion first

The whole plan branches here. Decide before you write a single email.

| Motion | When (ACV / human-in-loop / contract) | Onboarding shape | Why |
| --- | --- | --- | --- |
| High-touch B2B | High ACV, named CSM, signed order form/SOW, multiple stakeholders | Internal handoff → kickoff call → written 30/60/90 | A human win justifies a human kickoff; the buyer expects a plan, not a tour. |
| Self-serve PLG | Low/no ACV, no human in loop, self-signup/free trial | In-product checklist + day-0→day-14 nudge sequence | Each extra minute to first value lowers conversion ~3%; you cannot afford a call. |
| Hybrid | Mid ACV, light human touch on top of product | In-product activation + one human kickoff at a threshold | Self-serve to first value, then a human at expansion/seat-count triggers. |

Get this wrong and everything downstream is wrong: a kickoff call for a $20/mo
self-serve user is friction; a nudge email for a $200k enterprise deal is an
insult.

## Step 2 — The sales→delivery handoff

Run this **before** first customer contact. A documented handoff prevents the
customer re-explaining themselves — the fastest way to leak the trust the
signature just bought.

The AE briefs the CSM/delivery owner on a handoff packet:

- **Stakeholders & roles** — economic buyer, champion, end users, the skeptic.
- **Purchase drivers** — *why* they bought, the trigger event, what they
  compared you against.
- **Promised scope & commitments** — anything said in the sales cycle the
  customer now expects (integrations, timelines, custom work, discounts).
- **Success criteria the buyer bought** — the outcome they're measuring you on.
- **Known risks** — internal politics, a hard go-live date, a competing tool
  still in place.
- **Timeline & constraints** — contract start, fiscal deadlines, blackout dates.

Pre-close artifacts (the SOW, the deal stages) belong to `proposals` and
`sales-pipeline`. Pull from them; don't re-create them.

## Step 3 — Define "first value" before anything else

You cannot onboard toward a target you haven't named. **Activation ≠ adoption.**
Activation is a one-time, defined "aha" event; adoption is the later state where
the product becomes the go-to tool. Define the activation event first.

Pick the **one** event by four tests:

1. **Tied to core value** — it's the thing they're actually paying you for.
2. **Predictive of retention** — users who hit it stick; users who don't, churn.
3. **Verifiable** — you can measure it fired, unambiguously.
4. **Influenceable** — onboarding can directly drive it.

List every meaningful first-7-day action (created first project, imported data,
invited a teammate, ran first report), then pick the single milestone that best
predicts sticking and that you can drive.

Write it as **one measurable sentence**:

```text
Bad:  "The customer is activated when they're using the product."
Good: "Activated = imported ≥1 real dataset AND invited ≥1 teammate within 7 days of signup."
```

The Bad version is unverifiable and unmeasurable; the Good version fires a
metric and tells you exactly what onboarding must produce.

Set a **realistic target** off the benchmark band, not a vanity number:

| Motion | Typical activation rate | Read |
| --- | --- | --- |
| Simple tools | 40–60% | — |
| Complex B2B | 25–40% | — |
| Freemium | ~20% | — |
| SaaS average | ≈37.5% | >40% healthy · 30–40% room · <30% concerning · <20% urgent |

## Step 4 — The kickoff (high-touch)

A kickoff is a **working session**, not a welcome call and not a demo. Cover six
areas, in order:

1. **Introductions** — who's who on both sides.
2. **Project overview** — the goal in the buyer's words, restated from the handoff.
3. **Roles & responsibilities (RACI)** — who does what.
4. **Communication plan** — cadence, channel, escalation path.
5. **Action items / next steps** — owner + date on each.
6. **Q&A.**

Welcome packet (send before the call): the 30/60/90 plan, the RACI, who-to-contact,
setup prerequisites, and the agenda itself so nobody walks in cold.

Compact RACI (R=does it, A=accountable, C=consulted, I=informed):

| Task | Customer champion | CSM | Customer admin |
| --- | --- | --- | --- |
| Provision accounts | C | A | R |
| Import first dataset | A | C | R |
| Define success metric | A | R | I |
| Sign-off on go-live | R | A | I |

```text
Bad:  Subject: We're so excited to have you! 🎉
      "Welcome aboard! Can't wait to get started. Let us know if you need anything!"

Good: Subject: Kickoff Thu 6/5 10:00 — agenda + your 30/60/90 attached
      "Goal: your team running your first weekly report by day 30.
       Agenda (45m): intros · overview · RACI · comms plan · action items · Q&A.
       Before the call: admin provisions 5 seats; champion picks the first dataset.
       Owners and dates are in the attached plan."
```

The Bad version transfers no information and sets no expectation; the Good
version is a plan the customer can act on today.

## Step 5 — The plan: 30/60/90 and day-0→14

Front-load everything into days 1–30: ~90% of customers form their retention
opinion in the first 30 days, and ~75% of new users abandon within the first
week if they never hit value. Each phase row carries an **owner + date + exit
milestone**.

High-touch 30/60/90 skeleton below. Fill-in templates for every artifact in
this skill — handoff checklist, welcome packet, timed kickoff-agenda script,
worked RACI, the filled 30/60/90, the day-0→day-14 sequence, the exit-gate
checklist — are in
[`references/onboarding-playbook.md`](references/onboarding-playbook.md).

| Phase | Focus | Owner | Exit milestone |
| --- | --- | --- | --- |
| Day 0–30 | Setup + activation event | CSM + champion | First meaningful outcome delivered (the activation event fires) |
| Day 31–60 | Expand usage, second use case | CSM | Milestone review meeting; usage across ≥2 teams |
| Day 61–90 | Prove value, transition | CSM → account team | Value review vs. success criteria; formal transition to steady-state |

Self-serve day-0→day-14 nudge sequence to the activation event:

| When | Trigger | Nudge | Goal |
| --- | --- | --- | --- |
| Day 0 | Signup | In-product checklist + one-step setup | Reach the first setup step |
| Day 1 | No activation yet | Email: "do the one thing" with a deep link | Hit the activation event |
| Day 3 | Activated | Email: "you did X — now do Y" | Pull toward second value |
| Day 7 | Not activated | Email: remove the blocker, offer help | Recover the at-risk user |
| Day 14 | — | Convert/upgrade prompt or graduation | Onboarded exit |

Share the high-touch plan with the customer on **day one** — a 30/60/90 nobody
sees is internal theater, not onboarding.

## Step 6 — Cut friction to value

The path to the activation event must be the shortest possible.

- **Segment the route by role/use-case**, not the welcome copy. Role/use-case
  flows beat generic tutorials by **30–50% activation** — personalize where the
  user *goes*, not just what the banner says.
- **Minimize setup fields.** Every extra signup/setup field costs ~7%
  conversion. Defer everything you don't need to reach first value.
- **Shortest path to the one value moment**, then nurture for the rest.

```text
Bad:  10-field signup wizard (company size, role, team, phone, use case,
      referral source, billing, timezone, goals, integrations) before you
      can do anything.

Good: 2 fields (email, password) → land directly in "import your first
      dataset" → ask the rest later via progressive disclosure once the
      user has felt value.
```

## Step 7 — Instrument it

Measure value, never proxy activity (logins are vanity).

| Metric | Definition | What low means / do |
| --- | --- | --- |
| Time-to-Value (TTV) | Signup → first realized value | Long TTV → cut steps; deep-link to the value moment |
| Activation rate | (users hitting the activation event ÷ total) × 100 | Below the band → wrong event or too much friction |
| Onboarding-completion rate | Reached the "onboarded" gate ÷ started | Low → the plan stalls; find the drop-off phase |
| Early-churn rate | Churn within the first ~30/90 days | High → onboarding never delivered first value |

Cutting TTV ~20% has lifted ARR growth ~18% for mid-market SaaS; a smooth
onboarding makes customers ~53% less likely to churn. This is the lever.

## Step 8 — The "onboarded" exit gate

Onboarding is **done** only when all of these are true. This checklist is the
boundary with `retention`.

- [ ] Activation event has fired (verifiable, not assumed).
- [ ] Success plan agreed and shared with the customer.
- [ ] Communication cadence and escalation path set.
- [ ] Health baseline captured (usage, key metric, sentiment).
- [ ] Owner for steady-state named.

When the gate closes, hand off to [`retention`](../retention/SKILL.md):
onboarding gets them to first value, retention keeps them past it.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
| --- | --- | --- |
| A "welcome!" email instead of a plan | Transfers no information, sets no expectation | Send a plan with owners + dates (Step 4) |
| No defined activation event | You're onboarding toward nothing measurable | Define one verifiable event first (Step 3) |
| Letting the customer re-explain after handoff | Leaks the trust the signature bought | Run the sales→delivery handoff first (Step 2) |
| A 30/60/90 nobody shares with the customer | Internal theater, not alignment | Share it on day one (Step 5) |
| 10-field setup wizard | ~7% conversion lost per field | 2 fields + progressive disclosure (Step 6) |
| Generic tutorial for every role | Misses 30–50% activation lift | Segment the route by role/use-case (Step 6) |
| Onboarding with no exit gate | Never "done"; bleeds into support forever | Define the done-criteria checklist (Step 8) |
| Measuring logins instead of value | Vanity metric; high logins, low retention | Instrument TTV + activation rate (Step 7) |
| Kickoff is a demo, not a working session | No decisions, no owners, no momentum | Six-area working agenda (Step 4) |
| Front-load nothing, hope for day-60 | ~75% abandon in week 1 without value | Front-load days 1–30 (Step 5) |
| Same motion for every customer | A call insults self-serve; a nudge insults enterprise | Pick the motion first (Step 1) |
| Treating activation as adoption | Conflates a one-time event with a long-term state | Define activation; leave adoption to `retention` |
