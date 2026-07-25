---
name: community
description: "Use when building or running a persistent two-way community space — Discord, Telegram, Circle: platform choice, structure, onboarding, native→bot→human moderation, rituals, growth loops, health metrics. NOT churn of paying product customers (that is `retention`), NOT broadcast email (that is `newsletter`), NOT one live event (that is `webinar`)."
tags: [community, discord, telegram, moderation, growth, rituals]
recommends: [retention, newsletter, social-publisher, brand-voice, whatsapp-telegram, webinar]
profiles: []
origin: risco
---

# community

Run the community like a **product with a job**, not a vanity chat room. The space — a Discord server, a Telegram group+channel, a Circle — is the product. **Onboarding is activation, rituals are the feature, moderation is reliability, and one north-star metric tied to your purpose is the only number that matters.** A room with 5,000 silent members is a failed product, not a big one. Design the system around the conversation, not the conversation itself.

## When NOT to use — route instead

| The ask | Route to |
|---|---|
| Stop *paying customers of a product/SaaS* from churning (win-back, lifecycle, NPS) | `retention` |
| Write the one-to-many broadcast email that nurtures the list | `../newsletter/SKILL.md` |
| Schedule / cross-post public posts across X, LinkedIn, Instagram | `../social-publisher/SKILL.md` |
| Run a single timed live event end-to-end (registration, speakers, replay) | `webinar` |
| Build an automated support desk / ticket triage | `customer-support` |
| Actually code or host the Discord/Telegram bot (gateway, slash handlers) | `whatsapp-telegram`, `automation-flows` |
| Define the voice/name/tone the community speaks in | `../brand-voice/SKILL.md` |

You own the **persistent, two-way space and its ongoing operating rhythm.** The boundary that bites most: `retention` keeps *buyers of a product* from churning; you keep *members of a shared space* active and contributing. They rhyme (cohorts, re-activation) but the subject differs — a SaaS seat vs a Discord membership.

## Step 0 — Purpose & north-star gate

**Do not design a single channel until you have (a) a one-line purpose and (b) one business metric tied to it.** Why: a community without a job becomes a dead chat — there is no signal to design toward, so you sprawl channels and beg for activity. This is the most common cause of graveyards.

If either is missing, **STOP and ask one focused batch**, then proceed:

> 1. In one sentence, what is this community *for* — and for whom?
> 2. What single business outcome does it move? (support deflection, retention uplift, expansion revenue, qualified referrals — pick ONE)

Bad → Good:

```text
Bad:  "Set up a Discord for our users." → 14 channels, no purpose, silent in 3 weeks.
Good: Purpose = "where indie game-devs trade WIP feedback so free players become paying supporters."
      North-star = monthly free→supporter conversions sourced from the server.
```

Everything below is derived from those two lines. If a channel, ritual, or metric does not serve the purpose or move the north-star, cut it.

## Pick the platform — decision table

| Platform | Best for | Real-time chat | Broadcast | Monetization | Moderation maturity | Cost |
|---|---|---|---|---|---|---|
| **Discord** | Active, real-time builder/gamer/dev communities | Strong | Weak (announcement channels only) | Indirect (roles/Patreon links) | High — native AutoMod + bot ecosystem | Free |
| **Telegram** (group **+** channel hybrid) | Mobile-first, fast-growing, announce-heavy audiences | Good | Strong (channel = one-way broadcast) | Weak native | Medium — native ML anti-spam >200 members + bots | Free |
| **Circle** | Paid memberships bundling courses/events | Weak | Good | Strong (built-in payments + tiered Spaces) | Medium | Professional ~$89–129/mo → Business ~$199–219 → Circle Plus ~$419+ + 0.5–2% Circle fee on top of Stripe's 2.9%+$0.30 |

Decision rules (pick the *purpose*, not the logo):
- **Need persistent real-time conversation and free?** → Discord. It is the deepest moderation toolset and the strongest two-way default.
- **Audience lives on mobile and you broadcast a lot?** → Telegram, run the hybrid: a **channel** for announcements + a **linked group** for discussion. This is the 2026 standard; a bare group has no broadcast lane and a bare channel has no conversation.
- **You are charging for membership and bundling courses/events?** → Circle. But see the anti-pattern: do not monetize before activation works.

Per-platform setup depth (AutoMod filters, verification levels, anti-spam tiers, plan ladder) is in `references/platform-playbooks.md`.

## Structure & onboarding = activation

Keep the structure **minimal**. Why: empty channels signal a dead room; people pattern-match "nobody's here" and leave. Start with the fewest channels the purpose needs (often 4–6: welcome/rules, intros, one core topic, help, off-topic, announcements) and split a channel only when an existing one is *demonstrably overflowing*.

The onboarding path is an activation funnel. Drive every new member to a **first meaningful action** through a short, gated path:

1. **Role-on-join** — pick a role/interest, which personalizes which channels they see. Why: a tailored, smaller room feels alive; the firehose feels dead.
2. **Rules/membership gate** — on Discord, Rules Screening / Membership Screening blocks talking and DMs until rules are acknowledged. Why: it stops drive-by spam *and* forces a first deliberate click.
3. **Intro with a prompt** — not "introduce yourself" (blank-page freeze) but a 3-field prompt. Why: prompted intros get answered; open ones get skipped.
4. **Point to where-to-ask** — one obvious channel for "I need help." Why: time-to-first-response is a core health metric and it starts here.

Bad → Good intro channel:

```text
Bad:  #introductions — "Say hi and introduce yourself!"  → blank-page paralysis, 4% post.
Good: #introductions — pinned prompt: "(1) what you're building, (2) what you're stuck on,
       (3) one thing you can help others with." → reply with the right role-ping. Activation jumps.
```

## Moderation — the 3-layer stack

Moderation is reliability. The canonical stack is **native → bot → human**, and you scale layers by size, never skip the native layer.

1. **Native** — Discord AutoMod (one Commonly-Flagged-Words preset rule + up to 6 custom keyword rules, each filter holding up to 1,000 terms, plus a mention-spam cap configurable up to 50 unique mentions/message) and an explicit **verification level** (Medium = verified email + 5-min-on-server before talking). Telegram: native ML anti-spam kicks in for groups **>200 members** (with an "Aggressive" auto-delete mode); for **≤30 messages/hour, slow-mode alone** is the right zero-setup control; add a CAPTCHA-on-join gate (button/math/question, e.g. Shieldy) as the raid wall.
2. **Bot** — a specialized moderation bot for raid detection, scam-link filtering, and audit logs.
3. **Human** — named mods, an escalation path, and a written ban policy.

Size-tiered config (Discord, per Discord's own size guidance):

| Server size | Native | Bot layer | Human |
|---|---|---|---|
| < 1,000 | AutoMod + Medium verification | optional | 1–2 mods |
| > 1,000 | AutoMod + custom keyword rules | add one specialized bot | rota of mods |
| > 10,000 | + Commonly-Flagged filter on | robust multi-tool bots | mod team + on-call |
| > 100,000 | full filters + raid mode | multiple specialized bots | tiered mod org |

Incident + ban policy (write these down before you need them):
- **Ban policy is a rubric, not a mood** — define warn → mute → kick → ban thresholds and what triggers each. Why: inconsistent bans destroy trust faster than the spam did.
- **Raid runbook** — who flips lockdown (slow-mode + raise verification + pause invites), who triages, where it is logged.
- **Scam-DM stance** — pin a "we will never DM you first" notice; AutoMod-flag known scam phrases.

Filter specifics, verification levels, and bot picks by tier live in `references/platform-playbooks.md`.

## Rituals — the operating rhythm

**Predictable cadence beats sporadic heroics.** Why: members learn when to show up only if there is something to show up *for*; rhythm is the feature that pulls lurkers back. Install a small set of recurring beats and run them on time, every time.

Sample weekly cadence:

| Day | Ritual | Friction |
|---|---|---|
| Mon | "What are you working on this week?" thread | Low — one reply |
| Wed | Office hours / AMA in a voice or thread slot | Medium — opt-in |
| Fri | "Wins of the week" — share + react | Low — a reaction counts |

Design for **low-friction participation**: polls, emoji reactions, and *opt-in* role pings. The over-pinging trap: blasting `@everyone` for non-urgent posts. Why it backfires — over-pinging trains members to mute the server, and a muted member is functionally gone. Use a dedicated opt-in "announcements" role and reserve `@everyone` for genuine all-hands moments.

A ritual template library and the full cadence rationale are in `references/metrics-and-rituals.md`.

## Growth — loops, not buys

Build loops that compound, not headcount that decays:
- **Referral loop** — make inviting a friend a one-tap, rewarded action tied to a role/perk.
- **Intro loop** — every prompted intro is a hook other members reply to, pulling the newcomer into a thread on day one.
- **Partner cross-post** — trade shout-outs with an adjacent community whose audience overlaps but does not compete.

**90-9-1 is a range, not a ceiling.** The old "1% rule" (90% lurk, 9% occasional, 1% drive activity) is a *starting observation*, not a law — healthier communities skew far more active (real profiles like 55-30-15 and 17-57-26). Design to **move lurkers up a tier** (prompts, easy reactions, direct asks), do not accept 90% lurkers as fixed.

```text
Bad:  Buy 2,000 members from a growth service to "look big."  → DAU/MAU craters,
       signal drowns in silence, real members read the room as dead and leave.
Good: Run a referral ritual + prompted intros. 200 members who each reply
       in week one beats 2,000 who never speak.
```

Bought or inactive members are **negative-value**: they dilute every signal, wreck DAU/MAU, and make the room *look* dead to the people you actually want.

## Metrics & health

Three clusters plus exactly one business metric. Steer on these, not on raw member count.

| Metric | What it tells you | Target |
|---|---|---|
| DAU/MAU stickiness | How often members come back | Floor ≥ 20%; social/messaging band ~50–80% |
| 30/60/90-day cohort retention | Whether onboarding actually activates | Track each cohort vs the last |
| Returning-member ratio | Rhythm is working | Trending up |
| Time-to-first-response (TTFR) | A newcomer's first experience | Minutes-to-low-hours, the lower the better |
| Answered rate | Questions don't die unanswered | → 100% |
| **One business metric** (purpose-tied) | The only number that justifies the work | Set in Step 0 |

The one business metric is a menu — **pick exactly one** that matches your purpose: support deflection, retention uplift, expansion revenue, or qualified referrals. Review the scorecard on a fixed cadence (weekly glance, monthly cohort read). Benchmark depth and metric definitions are in `references/metrics-and-rituals.md`.

## The artifact you emit

Produce two files the user can apply directly: a `community-plan.md` (prose: purpose, platform rationale, structure, growth, metrics) and a machine-checkable `moderation-config.yaml`:

```yaml
platform: discord            # discord | telegram | circle
purpose: "where indie game-devs trade WIP feedback so free players become paying supporters"
north_star_metric: "monthly free→supporter conversions sourced from the server"
onboarding_path:
  - role-on-join
  - rules-gate
  - prompted-intro
  - where-to-ask
moderation:
  layers:
    native: "AutoMod preset + custom keyword rules, Medium verification"
    bot: "specialized raid + scam-link bot"
    human: "2 named mods, written ban rubric"
rituals:
  - name: "WIP Mondays"
    cadence: "weekly"
  - name: "Wins Fridays"
    cadence: "weekly"
```

Then validate it:

```bash
scripts/verify.sh path/to/moderation-config.yaml
```

`verify.sh` checks the required keys exist, that `north_star_metric` is non-empty, that all three moderation layers are declared, and that at least one ritual has a cadence — it catches the most common defect (a "plan" with no purpose, no mod layers, or no rhythm). **Do not go live until it passes and the north-star plus at least one health metric (TTFR or DAU/MAU) are instrumented.**

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Channel sprawl on day one | Empty channels read as "dead"; people leave | Start 4–6; split only on demonstrated overflow |
| No purpose / no north-star | Nothing to design toward → graveyard | Run Step 0 gate before any structure |
| `@everyone` for non-urgent posts | Trains members to mute → functionally gone | Opt-in announce role; reserve `@everyone` |
| Buying members to "look big" | Negative-value: dilutes signal, wrecks DAU/MAU | Referral + intro loops; activate the real ones |
| Ban-by-mood | Inconsistency destroys trust | Written warn→mute→kick→ban rubric |
| Treating 90% lurkers as permanent | Leaves activation on the table | 90-9-1 is a range; move lurkers up a tier |
| Monetizing on Circle before activation works | Charging for a dead room churns instantly | Prove rhythm + retention, then gate/monetize |
| Broadcasting in a two-way space | Wrong tool; kills conversation | One-to-many → `../newsletter/SKILL.md` / `../social-publisher/SKILL.md` |
