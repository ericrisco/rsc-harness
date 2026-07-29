---
name: meeting-notes
description: "Use when a meeting just ended and a transcript or rough notes must become a record the absent can act on — decisions with their why, actions with an owner and a real date, open questions, a recap inside 24–48h — or to clean an AI-notetaker draft that invented tasks or swapped speakers. NOT the durable ADR with alternatives weighed (that is decision-records)."
tags: [meeting-notes, action-items, decisions, recap, transcript-cleanup, minutes, standup, business-ops]
recommends: [decision-records, sop-builder, project-ops, calendar-scheduling, notion-connector, automation-flows, document-processing]
origin: risco
---

# Meeting Notes — Make the Meeting Count

*The meeting just ended. Pull the decisions and the why, assign the actions with owners and real dates, flag what's still open, and ship a record someone who missed it can act on.*

You own the **point-in-time meeting record**: take a transcript or raw notes, separate signal from noise, and emit a curated artifact — decisions (with rationale), action items (owner + due date), open questions, and a one-screen TL;DR. The output is human-readable judgment, not a code file.

## Not this skill

| If the ask is… | Route to |
|---|---|
| The **durable decision record** — full rationale, alternatives weighed, reversibility argued, review cadence | [`decision-records`](../decision-records/SKILL.md). This skill *captures* a decision in its meeting context and hands the heavy ADR off; it does not maintain the long-lived artifact |
| A **reusable step-by-step procedure / runbook** | [`sop-builder`](../sop-builder/SKILL.md). A SOP is a repeatable how-to; meeting notes are a point-in-time record |
| **Tracking the emitted tasks across a board / sprint** | [`project-ops`](../project-ops/SKILL.md). This skill *emits* action items; their lifecycle is not its job |
| **Scheduling the meeting, finding a slot, sending the invite** | [`calendar-scheduling`](../calendar-scheduling/SKILL.md) |
| **Building the integration that pushes notes into Notion/Slack/a tracker** | [`notion-connector`](../notion-connector/SKILL.md) / [`automation-flows`](../automation-flows/SKILL.md) |
| **Summarizing an arbitrary document that is not a meeting** | [`document-processing`](../document-processing/SKILL.md) |

## The capture loop

This is the spine. Six steps, in order:

1. **Consent & setup** — if it's being recorded, announce it and get consent *before* capture (see Consent below). Note attendees, date, purpose.
2. **Capture in real time** — record context → decision → action *as the discussion happens*. Don't reconstruct from memory hours later; you'll lose the why and invent the rest. (Umbrex, accessed 2026-06-02.)
3. **Sort signal from noise** — a useful record filters to decisions, commitments, and open questions. It is *not* a transcript. (Fellow.app / VoiceType, accessed 2026-06-02.)
4. **Extract decisions + actions + open questions** — into the skeleton below.
5. **Verify** — confirm each owner accepts their task while everyone is still present. For AI drafts this step is mandatory and heavier (see Working with AI transcripts).
6. **Ship the recap within 24–48h** — as a draft, invite corrections, then finalize. (VoiceType / Wrike, accessed 2026-06-02.)

Your first move depends on the source. Branch here:

| You have… | First move | Why |
|---|---|---|
| A live meeting / you're the note-taker | Capture in real time, then verbal-confirm each owner before close | Memory decays fast; the room is the cheapest place to fix attribution |
| An AI-notetaker transcript (Otter, Fireflies, Granola…) | Verify *first* — speakers, hallucinated tasks, quotes vs. source — before you trust any line | AI drafts misattribute speakers and invent tasks; a clean-looking draft is the trap |
| Raw bullet notes someone typed | Sort signal from noise, then chase the gaps (missing owners/dates) | The notes already filtered; your job is structure + completeness |

## The record skeleton

Curated record, not a transcript (don't dump the conversation flow). Canonical sections, in this order:

```markdown
# <Meeting> — <Date>
**Attendees:** Ana, Marc, Júlia (note-taker: Ana) · **Purpose:** decide Q3 launch scope

## TL;DR
One screen the absent can act on: we cut feature X from the launch, Marc owns the
go/no-go by Jun 12, payments integration is still open.

## Decisions
- Cut feature X from the Q3 launch. *Why:* QA can't cover it in time; ships in Q4.
  *Reversibility:* partially-reversible (re-add in Q4). Dissent: Júlia wanted a flag.

## Action items
- [ ] Spike the Stripe webhook retry — Marc — by Tue Jun 9
- [ ] Send revised launch scope to stakeholders — Ana — by Thu Jun 11

## Open questions
- Who signs off on the payments contract? (raised by Marc, unresolved)

## Parking lot
- Revisit pricing tiers next sync (not in scope today)
```

Four filled versions of this skeleton — decision meeting, standup/sync, retro, 1:1 — plus copy-paste action-item and decision rows are in [`references/templates.md`](references/templates.md).

## Action items done right

A complete action item is **`verb, owner, by <real date>`**: verb-first ("Draft…", "Spike…", "Send…", "Confirm…"), **one named person** — not "the team", not "we", since shared ownership means nobody owns it — and **a real date** ("by Tue Jun 9", never "next week", "soon", or "ASAP"). Explicit dates and named owners raise completion and ownership. (Umbrex, accessed 2026-06-02.)

Bad → Good:

| Bad | Good |
|---|---|
| "Look into the API stuff — team — soon" | "Spike the Stripe webhook retry path — María — by Tue Jun 9" |
| "Follow up on the contract" | "Send the signed vendor contract to legal — Marc — by Thu Jun 11" |
| "Everyone review the doc" | "Leave inline comments on the launch doc — Ana, Júlia — by Mon Jun 8" |

**Verbal-confirm before the meeting ends.** Ask each owner to confirm they accept the task while everyone is still present. (Umbrex, accessed 2026-06-02.) An unaccepted task is a wish.

Add a **status field** (`[ ]` open / `[~]` in progress / `[x]` done) so the same record can be re-read as a tracker until the tasks migrate to [`project-ops`](../project-ops/SKILL.md).

Add **RACI only when ownership is genuinely contested** — a cross-team decision with unclear accountability. Don't bolt a Responsible/Accountable/Consulted/Informed grid onto a five-person standup; it's overhead nobody reads.

## Decisions + the one-line why

For each real decision capture three things:

1. **The decision** — what was decided, stated as a fact.
2. **One sentence of why** — the trade-off or context. Every major decision gets one; a decision with no why rots, and six weeks later nobody remembers what trade-off it solved. (Umbrex / Fellow.app, accessed 2026-06-02.)
3. **Dissent or unresolved issue** — if someone disagreed or it's conditional, note it. A record that hides dissent will be re-litigated.

Tag each decision by **reversibility** — `reversible` / `partially-reversible` / `irreversible` — as a single field. Reversible calls can be made fast on imperfect info; irreversible ones warrant slowing down and recording more context, and the tag helps later review. (fs.blog / Reflect OS, accessed 2026-06-02.)

Bad → Good:

| Bad | Good |
|---|---|
| "Decided to use Postgres." | "Adopt Postgres over DynamoDB for the events store. *Why:* relational queries we need; team already knows it. *Reversibility:* partially-reversible. Dissent: none." |

When a decision needs the full ADR — alternatives weighed, reversibility argued, a review date — that is [`decision-records`](../decision-records/SKILL.md)' job. Capture it here in context, then hand it off. Don't grow an ADR inside the meeting notes.

## Working with AI transcripts

AI transcripts hallucinate and misattribute speakers, and even strong ASR is not error-free — Whisper reports ~2.5–3% word error on clean read speech (LibriSpeech test-clean) and ~4.7% on TED talks (TED-LIUM), and real meeting audio with crosstalk and accents is worse. A human verification pass is **mandatory** before any task or quote ships. (OpenAI Whisper, *Robust Speech Recognition via Large-Scale Weak Supervision*, arXiv 2212.04356, https://cdn.openai.com/papers/whisper.pdf, accessed 2026-06-02.) Never let an AI-extracted action item or quote go out unverified against the source.

Run three checks before you trust a draft:

1. **Speaker attribution** — does each commitment trace to the right person? AI notetakers swap speakers, especially on overlapping talk or after a silence.
2. **Hallucinated task** — does each action item correspond to something actually said? If you can't find it in the audio/transcript, drop it or flag it — don't ship it.
3. **Quote vs. source** — any verbatim quote you keep must match the source. Paraphrase if unsure; never present an unverified quote as exact.

When a line is suspect, **flag it for verification rather than asserting it** — and never invent a missing owner or date. The full checklist is in [`references/templates.md`](references/templates.md).

## Consent & confidentiality

Recording a conversation carries real legal and confidentiality exposure. (Justia, *Recording Phone Calls and Conversations — 50-State Survey*, https://www.justia.com/50-state-surveys/recording-phone-calls-and-conversations/, accessed 2026-06-02; ABA GPSolo eReport "AI and You", Sept 2025.)

- **Announce + get consent before recording.** Roughly a dozen US states require all-party (two-party) consent — per Justia's 50-state survey, CA, CT, DE, FL, IL, MD, MA, MT, NV, NH, PA, WA — but the canonical list is contested (some sources classify MI, OR, or NV differently). Verify the current rule for your jurisdiction; don't assert a fixed count. Under GDPR, recording is data processing — you need a basis and to inform attendees.
- **A cloud AI notetaker grants a third party access** to the conversation, which can waive privilege. Don't auto-record sensitive or privileged meetings (legal, HR, M&A, incident reviews).
- **Redact** names, secrets, and confidential details before distribution if the audience is wider than the room — and tighten distribution on anything sensitive.

## Distribution

Ship within **24–48h while memory is fresh**. (VoiceType / Wrike, accessed 2026-06-02.)

1. **Draft** — send the record as a draft, not a finalized minute.
2. **Invite corrections** — let attendees fix attribution and dates; this is your accuracy pass.
3. **Finalize** — lock it once corrections land, still inside 48h.

Then route, don't fork. Action items → a tracker via [`project-ops`](../project-ops/SKILL.md) (or pushed by [`automation-flows`](../automation-flows/SKILL.md) / [`notion-connector`](../notion-connector/SKILL.md)). Durable decisions → [`decision-records`](../decision-records/SKILL.md). Keep **one canonical home** for the record and link to it — don't paste three diverging copies into Slack, Notion, and email.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Paste the whole transcript as "the notes" | Nobody re-reads a wall of dialogue; the decisions drown | Curate to decisions, actions, open questions + a TL;DR |
| Action item with no owner ("the team will…") | Shared ownership = nobody owns it; it dies | One named person per task |
| Owner but no real date ("soon", "next week") | Not a deadline; can't be tracked or chased | `verb, owner, by <real date>` |
| Ship the AI draft unverified | Hallucinated tasks and swapped speakers go out as fact | Run the 3 verification checks first |
| Auto-record a sensitive/privileged meeting | Consent and privilege exposure; can waive privilege | Announce + consent; hand-note sensitive meetings |
| Decision with no why | Rots — re-litigated when nobody recalls the trade-off | One sentence of rationale per decision |
| Send the recap a week later | Memory's gone; corrections are guesses; team already drifted | Draft within 24–48h, invite corrections, finalize |
| Fork the notes into three places | Versions diverge; people act on the stale one | One canonical home, link don't copy |
| Invent a missing owner or date | A fabricated commitment is worse than a flagged gap | Flag it as "needs confirmation" — never guess |
| Bolt RACI onto a standup | Overhead nobody reads; slows a simple sync | RACI only when ownership is genuinely contested |
