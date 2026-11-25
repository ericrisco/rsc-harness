# Register & Profile — the first-contact question and how it persists

This file holds the runtime detail behind the SKILL.md section "First contact". It defines: the first-contact question, the register it sets, the exact `02-DOCS` file formats, and the rule every downstream skill follows.

## Why this matters

The single biggest failure mode of a developer-built harness is talking like a developer to someone who is not one. This system inverts the default: it assumes analogies, asks once before assuming otherwise, and keeps one voice for everyone. The profile is the contract; every skill honors it.

## The first-contact question

Ask exactly one thing before anything else. Do not bundle it with discovery questions.

Spanish:

> "¿Te hablo en lenguaje técnico o con analogías?"

English:

> "Should I talk to you in technical terms or with analogies?"

Map the answer to one of:

- `technical` — technical terms used directly; can read code and configs.
- `non-technical` — plain words and everyday analogies; no undefined jargon; no code shown unless asked.
- `mixed` — still valid in older profiles; treat it like `non-technical`.

`non-technical` and `mixed` (and no profile at all) also arm the danger guard, which blocks irreversible commands; `technical` never does. Say so when you record the answer.

If the user does not answer clearly, record `non-technical`. Never guess "technical" from the fact that they opened a terminal — many non-technical people are handed one. The user can change it any time ("háblame técnico", "con analogías"); update `user-profile.md` when they do.

## How every skill adapts

There is no per-user depth setting. Every skill speaks in the one voice the `orient` skill owns (`skills/orient/references/orientation-contract.md`): short sentences, one idea per sentence, simple words, active voice, the instruction before the reason, and every answer understandable on its own. `technical_level` only picks the register:

- `technical` — use the term directly; skip the 101 explanations.
- `non-technical` / `mixed` — translate every term ("a database is where the app remembers things"), prefer analogies, never paste raw config without explaining it.

If the person still does not understand, `orient` climbs its explanation ladder (text → diagram → one HTML page → a video, only offered).

**Legacy keys.** A profile written by an older `init` or `onboard` may carry `accompaniment_level:` or the even older `accompaniment:`. Both are retired: ignore their value, and drop the line the next time you touch the profile.

**Rule:** read `user-profile.md` at the start of every session. If it is missing, you are likely being run before `init` — ask the first-contact question before doing the requested work, or at minimum speak with analogies and note that the profile is unset.

## Persistence format

Both files live under `02-DOCS/wiki/harness/`. `init` creates this directory even on greenfield; the rest of `02-DOCS` is built by the `harness` skill.

### `02-DOCS/wiki/harness/user-profile.md`

A living document — updated whenever the user reveals new goals, context, constraints, or changes the register. It is the single source of truth other skills read.

```markdown
# User Profile

> Source of truth for how every rsc skill talks to this user. Updated continuously.

## Register
- technical_level: non-technical            <!-- technical | non-technical (mixed: legacy, reads as non-technical) -->
- language: es                               <!-- the user's working language -->
- last_updated: 2026-06-01

## Who they are
- One or two lines: role, relationship to the project, what they already know.

## What they want to build or govern
- domain: non-code-harness                   <!-- software | non-code-harness -->
- one-line description of the thing.
- software surfaces (if any): backend | frontend | mobile | agents
- non-code surfaces (if any): company/ops | research | personal-knowledge | content

## Goals
- The outcome that means "this worked".
- Secondary goals.

## Context
- Greenfield or brownfield, detected stack/state.
- Tools/providers already in play (email, CRM, payments, hosting…).
- Team size and ops comfort.

## Constraints
- Budget, timeline, data region/residency, compliance, non-negotiables.

## Open questions
- Anything not yet answered, to revisit.
```

### `02-DOCS/wiki/harness/decisions.md`

**Append-only.** Never edit or delete an entry — if a decision is reversed, append a new entry that supersedes the old one and references it. This is the audit trail of why the project is the way it is.

```markdown
# Decisions Log (append-only)

> One entry per significant decision. Never edit or delete; supersede by appending.

---
## D-0001 — Deploy target
- date: 2026-06-01
- context: ~500 users expected, 20 concurrent, EU data residency required, small team, low budget.
- options considered:
  1. Hetzner VPS + Coolify — cheap, full control, self-managed.
  2. Vercel — zero-ops, managed, scales; pricey at scale.
  3. Fly.io — managed containers, EU region, middle ground.
- decision: Hetzner VPS + Coolify (Falkenstein, EU).
- why: budget + EU residency + team OK self-managing one box.
- supersedes: none
---
## D-0002 — …
```

### Linking from the root `CLAUDE.md`

Add (or update) a `## Knowledge map` section that links BOTH files. Create `CLAUDE.md` if absent; if it exists, only add/update this section — never delete user content.

```markdown
## Knowledge map

- [User profile](02-DOCS/wiki/harness/user-profile.md) — register (technical or analogies), goals, context, constraints. **Every skill reads this first and speaks in that register.**
- [Decisions log](02-DOCS/wiki/harness/decisions.md) — append-only record of every significant decision and why.
```

When the `harness` skill later builds the full wiki, it extends this same `## Knowledge map` with links to the rest of `02-DOCS/` — it does not replace the harness entries written here.
