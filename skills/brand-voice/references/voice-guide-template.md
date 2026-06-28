# Voice Guide Template

Fill every slot. Delete the instruction lines in italics before you ship. The finished file lives at `02-DOCS/wiki/brand/voice-guide.md`. A fully worked mini-example follows the blank template — copy its shape, not its content.

The persisted guide is an OKF v0.1 wiki article: it MUST open with YAML frontmatter carrying a non-empty `type`. Copy the block below verbatim to the top of `02-DOCS/wiki/brand/voice-guide.md`, fill the values, and set `timestamp` to the ISO 8601 datetime of the edit:

```yaml
---
type: brand-voice
title: <brand> — Voice & Tone Guide
description: How the <brand> brand sounds — traits, rules, dimensions, word bank, and AI voice-DNA.
tags: [brand-voice, tone-of-voice, voice-guide]
timestamp: YYYY-MM-DDTHH:MM:SSZ
topic: brand
status: stable
---
```

---

## Blank template

### 1. Traits (3–5)

*One adjective per trait. Reject any a competitor would never deny ("innovative", "passionate"). Each gets this-means / this-does-not-mean so it is testable.*

```text
<Trait 1>
  this means:         <concrete behavior, e.g. "active voice, short words">
  this does NOT mean: <the failure mode, e.g. "curt or dumbed-down">
<Trait 2>
  this means:         ...
  this does NOT mean: ...
<Trait 3>
  this means:         ...
  this does NOT mean: ...
```

### 2. Rules (per trait, 2–3, with a Bad→Good)

*Levers: person · sentence-length ceiling · active/passive · contractions · jargon policy.*

```text
Trait: <Trait 1>
  R1  <rule>
  R2  <rule>
  Bad : "<off-brand line>"
  Good: "<on-brand rewrite>"
```

### 3. Four dimensions (ratios)

| Dimension | Position (ratio) | Why |
|---|---|---|
| Formal ↔ Casual | __ / __ | |
| Serious ↔ Funny | __ / __ | |
| Respectful ↔ Irreverent | __ / __ | |
| Matter-of-fact ↔ Enthusiastic | __ / __ | |

### 4. Word bank

- **Power words (15–20):** `...`
- **Ban list:** `...` *(start from `references/word-bank.md`, then add brand-specific bans)*

### 5. Tone-by-context matrix

| Context | Voice (constant) | Tone shift | Example line |
|---|---|---|---|
| Onboarding | | | |
| Error / failure | | | |
| Success | | | |
| Billing / account | | | |
| Legal / security | | | |

### 6. AI voice-DNA block

```text
VOICE DNA — <brand>
Traits: ...
Rules: ...
Dimensions: ...
Use: ...
Never use: ...
Tone by context: ...
```

---

## Worked mini-example — "Larch" (a B2B fintech that wants to feel trustworthy but human)

### 1. Traits

```text
Trustworthy
  this means:         we cite the source and the date; we name what we don't know
  this does NOT mean: stiff, legalistic, or hiding behind disclaimers
Plain-spoken
  this means:         short Anglo-Saxon words; one idea per sentence
  this does NOT mean: oversimplifying the math behind a number
Human
  this means:         we write to one person, with contractions, no corporate "we value"
  this does NOT mean: jokey or casual about someone's money
```

### 2. Rules

```text
Trait: Trustworthy
  R1  Every number carries a source and a date inline.
  R2  Never hedge with "may", "could", "potentially" to dodge a claim — state it or cut it.
  Bad : "Returns could potentially be optimized via our solution."
  Good: "Customers cut reconciliation time 40% in 2025 (internal, n=120)."

Trait: Plain-spoken
  R1  Sentence ceiling ~20 words.
  R2  Active voice; the subject acts.
  Bad : "It is recommended that reconciliation be performed monthly."
  Good: "Reconcile your accounts every month."

Trait: Human
  R1  Second person ("you"), contractions ("you'll", "we've").
  R2  No exclamation marks; warmth comes from clarity, not punctuation.
  Bad : "We're thrilled to help you on your financial journey!!"
  Good: "Here's how to close your books faster this month."
```

### 3. Four dimensions

| Dimension | Position (ratio) | Why |
|---|---|---|
| Formal ↔ Casual | 60 / 40 casual | Money topic needs credibility; contractions keep it human. |
| Serious ↔ Funny | 90 / 10 serious | We handle people's finances; jokes only in onboarding microcopy. |
| Respectful ↔ Irreverent | 75 / 25 respectful | We challenge legacy-bank jargon, never the reader. |
| Matter-of-fact ↔ Enthusiastic | 70 / 30 matter-of-fact | Proof over hype; a sourced number beats an adjective. |

### 4. Word bank

- **Power words:** reconcile, close, ledger, clear, accurate, sourced, on time, secure, audit-ready, simple, fast, real, fix, done, plain, trusted.
- **Ban list:** leverage, seamless, elevate, delve, robust, unlock, game-changer, revolutionize, synergy, best-in-class, "in today's fast-paced world", "financial journey", "thrilled".

### 5. Tone-by-context matrix

| Context | Voice (constant) | Tone shift | Example line |
|---|---|---|---|
| Onboarding | trustworthy, plain, human | warm, light | "You're set up. Let's import your first month." |
| Error / failure | trustworthy, plain, human | plain, reassuring, no humor | "That sync failed. No data was lost — retry below." |
| Success | trustworthy, plain, human | quiet warmth | "Books closed. Everything reconciled." |
| Billing / account | trustworthy, plain, human | precise, calm | "Your plan renews June 30. Cancel anytime, no fee." |
| Legal / security | trustworthy, plain, human | formal, exact | "Funds are held in segregated accounts. See our terms." |

### 6. AI voice-DNA block

```text
VOICE DNA — Larch
Traits: trustworthy, plain-spoken, human.
Rules: active voice; sentences <=20 words; contractions; second person "you";
  no exclamation marks; every number gets a source + date; no hedging to dodge.
Dimensions: 60/40 casual, 90/10 serious, 75/25 respectful, 70/30 matter-of-fact.
Use: reconcile, close, ledger, clear, accurate, sourced, secure, simple, fast, done.
Never use: leverage, seamless, elevate, delve, robust, unlock, game-changer,
  revolutionize, synergy, best-in-class, "financial journey", "thrilled".
Tone by context: onboarding=warm+light; error=plain+reassuring,no humor;
  success=quiet warmth; billing=precise+calm; legal=formal+exact.
```
