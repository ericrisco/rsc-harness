---
name: customer-support
description: "Use when a live support ticket needs triage (intent, P1–P4 priority, SLA clock), an on-voice reply, not a raw template, de-escalation of an angry or churn-risk customer, or escalation with a handoff packet. NOT the help-center article it links to (that is `technical-writing`), a win-back program (`retention`), or the auto-answer bot (`chatbot`)."
tags: [customer-support, helpdesk, ticket-triage, sla, escalation, macros, de-escalation, csat]
recommends: [technical-writing, client-onboarding, retention, chatbot, rag, brand-voice]
origin: risco
---

# Customer Support — Run the Desk on a Live Ticket

You own the **support desk as an operation**: take an incoming ticket, assign priority and intent, start the SLA clock, draft the reply (macro or bespoke), enforce tone, and decide escalation with a clean handoff. The output is a triaged, answered ticket — human judgment, not a code artifact.

## The triage-to-reply loop (the spine)

Run every ticket through these six steps in order. Skipping triage to "just reply fast" is how you send the wrong tone to a P1.

```text
1 Classify intent   →  what does the customer actually want? (bug, how-to, refund, outage, rage)
2 Set priority      →  P1–P4 (impact × urgency × account tier)
3 Start SLA clock   →  pick the FRT target NOW, before drafting
4 Draft reply       →  macro skeleton or bespoke; one personalized line minimum
5 Tone / voice check →  on-brand, de-escalated, no banned phrases
6 Escalate or send  →  trigger met? hand off with the packet. else send + log.
```

## Priority, SLA, and the escalation call

The branch is at step 6. This table sets priority, both SLA clocks, and whether the ticket leaves your hands:

| Signal in the ticket | Priority | First response (FRT) | Resolution target | Escalate? |
|---|---|---|---|---|
| Production down / data loss / payments broken / many users blocked | P1 critical | 15–30 min | ASAP, status updates every 30–60 min | Yes → tier-2/eng + the packet |
| Enterprise/VIP account, or "cancel / refund / lawyer / unacceptable" | P1–P2 | 30 min – 1 h | Same business day | Yes → owner + tier-2 |
| One user blocked, no workaround | P2 high | 1–2 h | Same business day | Only if unresolved past target |
| Question with a workaround, billing query | P3 medium | 4–8 h | 1–2 business days | No, unless policy claim is unverifiable |
| FAQ, cosmetic, feature request | P4 low | ~1 business day | Best effort | No |

**Why pick the FRT target before drafting:** the SLA decides your tone and length. A P1 gets a two-line acknowledgment in 20 minutes, not a polished essay in two hours.

Use **3–4 priority tiers, never a flat SLA.** Too many tiers confuse the desk; too few don't differentiate the outage from the typo (Emailmeter / Hiver, 2026-06-02).

**Acknowledge fast even when you cannot resolve fast.** First-response and resolution are *separate, linked* SLAs: FRT sets the expectation, resolution is the outcome. 89% of customers feel valued by a fast first response even when the full fix takes longer (getMonetizely / Hiver, 2026-06-02). So: acknowledge inside the FRT window with an honest "here's what I know and when I'll update you," then resolve honestly. Never go silent to wait for a perfect answer.

Full P1–P4 matrix by channel (email/chat/phone) lives in [`references/macros-and-sla.md`](references/macros-and-sla.md).

## Macros done right

A macro with **one genuinely personalized sentence raises CSAT; a verbatim template lowers it.** Macros cut first-response time 30–50%, but sent raw they read as scripted (TextExpander / Gorgias, 2026-06-02). So every macro is a skeleton you finish, not a message you forward.

The 4-beat skeleton — every reply hits these in order:

```text
1 Empathy / ack   →  name the problem in their words (1 line)
2 Answer          →  the fix, the status, or the next concrete step
3 Next step       →  what happens now + when they'll hear back
4 Close           →  human sign-off, door left open
```

Rules:

- **Fill dynamic fields, then add one bespoke line.** Placeholders like `{{first_name}}`, `{{order_id}}`, `{{ticket_id}}`, `{{date}}` are table stakes — they are not personalization. The personalized line references *this* ticket's specifics.
- **Never send a macro with a visible `{{placeholder}}`.** A leaked `{{first_name}}` is worse than no name.
- **One reply, one ask.** If you need three things from the customer, you'll get one. Batch the request or sequence it.

Bad → Good (info-request macro):

```text
Bad (verbatim template, robotic):
  Dear Customer, Thank you for contacting support. We have received your
  request. In order to assist you, please provide additional information.
  Your satisfaction is important to us. Regards, The Support Team.

Good (skeleton + one personalized line):
  Hi Marta — sorry the export keeps failing on you. To dig in I need one
  thing: the rough time you last hit "Export CSV" today (so I can pull the
  matching server log). I noticed your account is on the new billing plan,
  so this might be the same migration glitch we patched yesterday — I'll
  confirm and get back to you within 2 hours. — Eric
```

The Good version names the feature, gives a real next step + a time, and the "new billing plan / migration glitch" line proves a human read the ticket.

Full skeleton library (ack, info-request, resolved, refund, known-bug, outage, churn-save, escalation-handoff, feature-request decline, gentle-close) is in [`references/macros-and-sla.md`](references/macros-and-sla.md).

## Tone and de-escalation

Apply the brand voice; do not invent it here. The voice guide is authored by [`../brand-voice/SKILL.md`](../brand-voice/SKILL.md) — this skill reads it and writes the reply against it.

For an angry or churn-risk ticket, de-escalation moves in order:

1. **Acknowledge the feeling before the facts.** "Three days without a reply is not okay, and I get why you're frustrated" lands before any fix.
2. **Take ownership in the first person.** "I dropped this" beats "the team was unable to." No passive voice to hide behind.
3. **One concrete next step with a time.** Vague reassurance reads as a brush-off; "I'll have an answer by 3pm" is trust.
4. **Match their stakes, not their volume.** Stay calm and specific. Do not argue, and never match anger with anger.

Banned phrases — they escalate, not de-escalate:

| Never write | Why it backfires | Write instead |
|---|---|---|
| "Please calm down." | Tells them their feeling is the problem. | "You're right to be frustrated — let's fix it." |
| "As I said / as previously mentioned" | Scolds them for not reading. | Just restate it plainly. |
| "Per our policy." (naked) | Hides behind rules, no human. | Explain the *why*, then the policy. |
| "Unfortunately, there's nothing we can do." | Dead end, zero path. | Offer the nearest thing you *can* do. |
| "This is a known issue." (alone) | Sounds like "we knew and didn't care." | Add the status + the ETA or the workaround. |

Checklist before send: feeling acknowledged · first-person ownership · one timed next step · no banned phrase · no `{{placeholder}}` left.

De-escalating *this* ticket is the job here; running a win-back or renewal **program** is `retention`.

## Escalation

Escalate on **explicit conditions, not vibes.** Standard tiers: T1 frontline/common, T2 specialist/complex, T3 engineering or exec/critical (Kapture / Hiver, 2026-06-02). Hand off when any trigger fires:

- **Negative-language signals:** "unacceptable", "cancel", "refund", "lawyer", "chargeback".
- **SLA at risk:** the FRT or resolution target is about to blow.
- **Account tier:** enterprise / VIP.
- **Confidence below threshold:** if an assisted/AI draft is below ~85% confidence on a policy or price claim, hand to a human — don't guess (swiftflutter / Kapture, 2026-06-02).

**Context must travel with the escalation.** 70% of customers expect the next agent to know their history; making them repeat themselves adds 90–180 seconds per ticket (Forrester via Fini Labs, 2026-06-02). Never escalate a bare ticket link. Attach the handoff packet:

```text
HANDOFF PACKET
- Customer + account tier:  Marta R. — Enterprise (VIP)
- Ticket / priority:        #4821 — P1
- One-line summary:         CSV export 500s since ~09:00; blocking month-end close.
- Steps already tried:      Confirmed not browser/cache; reproduced on staging.
- Customer sentiment:       Angry, has mentioned "cancel" once.
- Collected variables:      plan=new-billing, last_export=09:14, region=eu-west
- What I need from you:      Confirm if the billing-migration patch covers this.
```

The full escalation matrix (trigger → tier → owner) is in [`references/macros-and-sla.md`](references/macros-and-sla.md).

## FAQ and KB answering

**Quote the KB or escalate — never invent policy, price, or an ETA.** Hallucinated support answers produced 150+ documented legal cases by mid-2025 (cmswire / swiftflutter, 2026-06-02). The guardrail:

- If the answer is in the KB, **quote it and link the article.** Don't paraphrase a refund window or a price from memory.
- If it is not in the KB, say "let me confirm" and escalate — do not fill the gap with a plausible guess.
- Deflection is **bounded by KB quality.** Triage-only without a strong KB deflects ~20–30%; well-organized KBs push assisted/auto resolution to 50–80% (Zendesk / Intercom / Fini Labs, 2026-06-02). A bad answer fast is worse than a correct answer slightly slower.

This skill *consumes* the KB; it never writes it. If the article the customer needs does not exist, flag the gap — authoring it is a `technical-writing` job, and building the autonomous auto-answer bot on top of the KB is `chatbot` + `rag`.

## Metrics — what to watch and when

No single metric is sufficient; track the trio plus resolution rate (Armatis / Giva, 2026-06-02):

| Metric | What it measures | When to optimize for it |
|---|---|---|
| **CSAT** | Transactional satisfaction; `positive ÷ total × 100` | After any single ticket; the default health signal |
| **CES** | Customer effort, 1–7 scale | When tickets resolve but customers still churn — friction is the problem |
| **NPS** | Relationship; promoters − detractors | Quarterly / relationship level, not per-ticket |
| **FCR / one-touch** | Resolved in one interaction | When repeat contacts are climbing — optimize the first reply |

Rule of thumb: optimize **FRT** for reassurance (the customer feeling handled), **FCR** for effort (fewer round-trips). They pull in different directions — don't chase both blindly.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Send the macro verbatim | Reads as scripted, drops CSAT | Skeleton + one bespoke line + filled fields |
| Polish for an hour, send nothing | Misses the FRT window | Acknowledge fast, resolve honestly later |
| One flat SLA for every ticket | Outage waits behind a typo | 3–4 priority tiers with distinct FRT targets |
| Argue with an angry customer | Volume escalates, churn rises | Acknowledge feeling, own it, give a timed step |
| Invent a policy / price / ETA | Hallucinated answers create real liability | Quote the KB or say "let me confirm" + escalate |
| Escalate a bare ticket link | Next agent restarts, +90–180s, anger | Attach the handoff packet every time |
| Leave a `{{placeholder}}` in the reply | Worse than no name; signals automation | Verify all fields filled before send |
| "Please calm down" / "as I said" | Tells them their feeling is the fault | De-escalation moves; banned-phrase swaps |
| Promise a fix you can't verify | Breaks trust when it slips | Promise the *next update time*, not the fix |
| Chase NPS off a single ticket | Wrong altitude metric | CSAT/FCR per ticket; NPS at relationship level |
