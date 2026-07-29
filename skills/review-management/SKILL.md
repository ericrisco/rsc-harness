---
name: review-management
description: "Use when a public review needs an on-voice reply, when you need to earn more reviews legally, or when an aggregate rating is slipping across Google Business Profile, Trustpilot, the App Store or Google Play — including deciding reply versus flag, getting an unfair one-star removed rather than merely answered, and wiring programmatic replies. NOT a private support ticket against an SLA (that is `customer-support`), NOT churn, NPS or save plays (that is `retention`)."
tags: [reviews, reputation, google-business-profile, trustpilot, ftc, responses, app-store]
recommends: [customer-support, retention, seo-geo, brand-voice, social-publisher]
origin: risco
---

# review-management

You run public reputation as a program. A review is the one customer message every
future prospect also reads, so it rolls up into an aggregate that moves local rank and
the buy decision. Your job is three artifacts: a **review-request flow** (earn more,
the legal way), a **response playbook** (reply on-voice, within the SLA, to every
rating), and a **reputation scorecard** (the aggregate signal across surfaces).

You do not write the brand's voice — you consume it. You do not run the private inbox.
You do not make the page rank. You own what is public and what it averages to.

## What this owns vs route elsewhere

The dividing line is one question: **can a stranger read it?** If your reply is visible
to every future prospect, it's a review — yours. If it's a private channel, it's not.

| The ask | Route to | Why |
|---|---|---|
| Private email/chat/ticket against an SLA | `../customer-support/SKILL.md` | 1:1, non-public, macro library + queue — not a public reply |
| Churn risk, NPS, save plays, win-back | `../retention/SKILL.md` | A bad review may *signal* churn; the save play lives there |
| Make the profile rank (schema, GEO, local pack beyond reviews) | `../seo-geo/SKILL.md` | Reviews feed rank, but on-page/schema is a different lever |
| Repurpose a 5-star into a social post | `../social-publisher/SKILL.md` | Scheduling/cadence of the post, not the review reply |

The reply voice — traits, word bank, tone matrix — comes from `../brand-voice/SKILL.md`.
This skill applies that guide; it never authors it.

## The legal floor — read before you ask

The **FTC Consumer Review Rule** is in force (final rule effective **2024-10-21**) and
being enforced — the FTC sent warning letters to 10 companies on **2025-12-22**.
Penalties run up to **$53,088 per violation** (per the FTC 2025-12 warning letters /
press release, the inflation-adjusted figure in force from Jan 2025). Four moves are
banned. Internalize them before you draft a single request:

1. **No fake or insider reviews.** Don't write, buy, or solicit reviews from people who
   didn't transact. *Why: they're deceptive on their face and the per-violation fine is
   ruinous.*
2. **No review gating (suppression).** You may **not** screen for sentiment before the
   ask — no "rate us 1–5, and only the happy ones get routed to Google." Routing unhappy
   customers to a private form while sending happy ones to the public link is illegal
   suppression. *Why: it manufactures a rating that doesn't reflect reality — the exact
   harm the rule targets.*
3. **No incentivizing a particular sentiment.** You may offer an incentive to review
   (if disclosed) — you may **not** condition it on the review being positive. *Why:
   "$10 for a 5-star" buys sentiment, not feedback.*
4. **No misrepresenting that reviews are independent** when they're insider/company-controlled.

The one rule that resolves 90% of cases: **you may ask everyone; you may not condition
the ask, the routing, or the reward on how they feel.**

```text
Bad  (gating — illegal):  "Loved us? Leave a 5-star here →. Had a problem? Email us instead."
Good (neutral — clean):   "Thanks for choosing us. Share your honest experience here → [link]."
```

## Earn reviews cleanly

Ask within **24–48h** of the transaction — peak emotional recency. Pick the channel by
context; a hybrid SMS-then-email (48–72h gap) lifts total collection **40–60%**.

| Channel | Use when | Open / reply | Note |
|---|---|---|---|
| SMS | You have a verified mobile + recent transaction | ~98% open, 15–25% reply | Highest yield; keep it one line + link |
| Email | No phone, or B2B with work addresses | ~20% open, 2–5% reply | Personalization merge tags lift response 20–30% |
| QR on receipt | On-site retail / hospitality | walk-up | Print it; ask at the moment of satisfaction |
| In-app prompt | Mobile app, after a success moment | varies | Triggers the OS review sheet (App Store / Play) |

**Message anatomy** (two sentences): name → one specific reference to what they bought →
direct link to the review surface. No sentiment screen, no "if you're happy."

```text
Hi Marta — thanks for the kitchen install last Tuesday. If you have 30 seconds,
your honest review helps other homeowners decide → [direct Google review link].
```

The link points **straight to the review form** (GBP "write a review" deep link,
Trustpilot service-review invite, the app's store page). Never to an internal star-picker
that branches on the rating — that's gating.

## Respond — the playbook

Reply to **every** review within **48h** (within 24h correlates with better local
ranking; 52% of customers expect a reply within 7 days). On Google Play a developer
response raises that review's rating by **~0.7 stars on average** — replies are not
optional hygiene, they move the number.

| Review type | The move | Reply shape | SLA |
|---|---|---|---|
| 5-star praise | Thank + reinforce one specific they mentioned | 1–2 sentences, named, warm, on-voice | 48h |
| Positive + a question/ask | Thank, then answer the question publicly | Answer first, gratitude second | 48h |
| Vague 1–2 star (no detail) | Acknowledge, invite the detail offline | "Sorry to hear this — we'd like to understand, reach us at…" | 48h |
| Specific complaint (fair) | Own it, move offline, state the fix | The sequence below | 24–48h |
| Suspected fake / off-topic | Flag for removal **and** post a calm holding reply | See "Flag vs reply" | 48h |

**The negative-review sequence** (write it fresh every time; never paste a template):

1. **Acknowledge** the person and the feeling, by name. No "we're sorry you feel that way."
2. **Own the specific** thing that went wrong — name it, don't deflect.
3. **Move it offline** — give a direct contact (name + email/phone), once.
4. **State the concrete fix** or what you've changed, briefly.
5. **Invite an update** — leave the door open for them to revise the review.

```text
Bad  (defensive, public argument):
  "That's not what happened. Our records show you were 40 minutes late, which is
   why the install ran over. We followed our standard process."

Good (own → offline → fix → invite):
  "Hi James — you're right that the install ran past the window we promised, and
   that's on us. I'd like to make it right; please email me directly at
   ops@acme.co. We've since added a buffer to every booking so this doesn't
   repeat. — Lena, Ops Lead"
```

## Flag vs reply

Replying is the default. Flagging is the exception — and mass-flagging legitimate
negatives is itself a reputation and policy risk. **Flag for removal only when the
review is:**

- **Fake** — from someone who never transacted.
- **Off-topic** — not about your business / a different location.
- **Conflict of interest** — competitor, ex-employee, personal feud.
- **Policy violation** — profanity, hate, doxxing, illegal content.

A review that is negative, harsh, or even partly inaccurate but reflects a real
experience is **not** flag-eligible. Answer it. Per-platform flag paths and dispute forms
are in `references/platform-apis.md`.

## The platforms (programmatic)

Most of this is offloaded to `references/platform-apis.md` (endpoints, scopes, roles,
limits, gotchas). The three facts you must not get wrong, inline:

- **GBP reply is live and still on v4** — not migrated to v1, no announced deprecation:
  ```text
  PUT https://mybusiness.googleapis.com/v4/{name=accounts/*/locations/*/reviews/*}/reply
  scope: https://www.googleapis.com/auth/business.manage   # verified locations only
  ```
  This single `PUT` both creates and updates the reply.
- **The Google Q&A API is dead** (shut down November 2025). Do **not** build against
  Questions-and-Answers endpoints — review listing + reply survive, Q&A does not.
- **Apple allows exactly one editable response per review** via App Store Connect
  (get/create/update/delete; requires Account Holder, Admin, or Customer Support role).
  Apple also surfaces AI review summaries on iOS 18.4+, so themes in your reviews now
  feed an auto-generated digest — fix recurring complaints, don't just reply to them.

## Reputation scorecard

Track six metrics per surface, reviewed **weekly**:

| Metric | What it is | Target signal |
|---|---|---|
| Rating | Aggregate stars | Trend, not snapshot |
| Volume | Total reviews | More = more trust + rank weight |
| Velocity | Reviews/month | Steady inflow beats a stale 5.0 |
| Recency | Days since last review | Fresh reviews are weighted heavier |
| Response rate % | Replies ÷ reviews | Aim ~100% — the +0.7-star Play effect compounds |
| Sentiment by theme | Complaints/praise clustered | Drives fixes, feeds Apple's AI summary |

Cluster the negatives by theme weekly. Three reviews about "slow checkout" is a product
ticket, not three replies — route the fix, then close the loop in your replies.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Gating (route unhappy away from the public link) | Illegal FTC suppression, up to $53,088/violation | Ask everyone the same neutral way |
| Buying / incentivizing-by-sentiment | Banned; deceptive; fines | Disclose any incentive, never tie it to positivity |
| Copy-paste reply on every review | Reads robotic; kills the +0.7-star effect | Write fresh, name one specific each time |
| Arguing in public / "that's not what happened" | Every prospect reads you losing | Own it, move offline, state the fix |
| Ignoring positive reviews | Leaves trust + ranking weight on the table | Reply to 5-stars too, within SLA |
| Replying off the brand-voice guide | Inconsistent, off-brand surface | Pull traits from `../brand-voice/SKILL.md` |
| Building on the Google Q&A API | Shut down Nov 2025 — it's gone | Use v4 reviews + `updateReply` only |
| Mass-flagging legitimate negatives | Policy risk; doesn't remove real feedback | Flag only fake/off-topic/conflict/policy |

## Verify the copy

Before you ship any request template or reply, run the copy-banlist linter — it fails on
gating, sentiment-incentive, and dead-Q&A-API phrasing:

```bash
./scripts/verify.sh path/to/review-copy.md
```

It's read-only and exits 0 on clean or empty input. See `evals/README.md` for how the
capability eval is graded.

## Cross-references

- `../customer-support/SKILL.md` — the private 1:1 ticket against an SLA
- `../retention/SKILL.md` — churn, NPS, save plays a bad review may signal
- `../seo-geo/SKILL.md` — making the profile rank beyond review signals
- `../brand-voice/SKILL.md` — the voice your replies are written in
- `../social-publisher/SKILL.md` — repurposing a glowing review into a post
- `references/platform-apis.md` — per-surface endpoints, scopes, roles, limits, gotchas
