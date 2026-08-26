---
name: bro
description: "Use whenever the user asks to make an answer or draft sound human, natural, plain-spoken or less AI-written — including a terse bro after the last response. Rewrites or drafts in the same language while preserving meaning, facts and channel. NOT a reusable brand voice (that is `brand-voice`), NOT translation (that is `translation-l10n`)."
tags: [bro, human-writing, humano, plain-language, natural-language, rewrite, no-jargon]
recommends: [unslop, brand-voice, technical-writing, translation-l10n]
profiles: [minimal, core, full]
origin: risco
---

# bro — say it like a person

Make the words sound like someone with something real to say. Keep the substance; remove the
performance around it.

## The contract

1. **Find the source without ceremony.** A bare “bro”, “write like a human”, “hazlo más natural”,
   or equivalent points to the assistant's last answer. If the user pasted text, rewrite that. If
   they requested new copy, draft it directly. Ask for text only when no source exists.
2. **Preserve the payload.** Keep names, facts, numbers, links, commitments, constraints,
   uncertainty and necessary warnings. Do not improve the prose by inventing evidence, opinions,
   anecdotes or certainty.
3. **Match the room.** Keep the user's language and fit the audience, relationship and channel. A
   natural legal notice is still precise; a natural Slack message can be loose. “Human” does not
   automatically mean casual.
4. **Cut the bot-shaped scaffolding.** Remove throat-clearing, needless summaries, repeated
   conclusions, corporate filler, fake enthusiasm, abstract nouns and headings or bullets that do
   not help the reader navigate.
5. **Restore a real cadence.** Prefer concrete verbs, direct sentences and natural contractions.
   Vary sentence length when it helps. Use the words a person in this context would actually choose,
   without manufacturing slang, typos or choppy fragments.
6. **Return the writing, not a review of the writing.** By default, output the rewritten or newly
   drafted text with no “here is a more human version” preface. Explain the changes only if asked.

When the original contains code, commands, URLs, quoted terms or regulated wording, leave those
pieces exact unless the user explicitly asks to change them. Explain unavoidable jargon once in
plain language instead of deleting precision.

## What “human” means here

| Aim | The result |
| --- | --- |
| Plain, not simplistic | Easy to follow without losing the idea |
| Concise, not incomplete | No padding; all load-bearing facts remain |
| Warm, not performative | Appropriate care without canned empathy |
| Conversational, not sloppy | Natural rhythm without fake mistakes |
| Specific, not decorated | Concrete nouns and verbs instead of hype |

## Anti-patterns

| Anti-pattern | Why it fails | Do this instead |
| --- | --- | --- |
| Add typos, slang or filler to seem human | It performs humanity and can sound less credible | Match the actual relationship and channel |
| Replace technical terms with vague words | Readability bought with lost meaning is a defect | Keep or define the necessary term |
| Invent a personal story or strong opinion | A smoother fabrication is still a fabrication | Preserve only what the source supports |
| Use the same “casual” voice for every audience | A client email, README and condolence need different registers | Infer the room before choosing the cadence |
| Promise the result is undetectable as AI | No rewrite can honestly guarantee that | Promise clarity and naturalness, not detector outcomes |
| Announce and justify every edit | The preamble becomes the same friction the user asked to remove | Lead with the finished words |

## Where this ends

`unslop` owns the other half of this job: the **named** audit of a text that already exists, tell by
catalogued tell (puffery, `not just X but Y`, em dashes, bold-label lists, hedging), run before the
text ships. This skill owns the **register**: which language, which relationship, which channel, and
the cadence that fits them. A bare "bro" is always this skill. "Check this for AI tells before I
publish it" is `unslop`. When a text needs both, audit first, register last.

## Output boundary

Treat the rewritten text as an artifact: keep harness commentary outside it. If the task also
requires a brújula block, place that block after a clear separation so it cannot be copied into an
email, document or message by accident.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
