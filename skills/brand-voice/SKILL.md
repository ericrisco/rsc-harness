---
name: brand-voice
description: "Use when defining how a brand SOUNDS as a reusable system: adjectives turned into linguistic rules, four tone dimensions as ratios, a use/avoid word bank, an AI voice-DNA block — so content stops sounding like five different writers. NOT the finished copy written against it (that is `landing-copy` / `marketing`), NOT the brand's look (`brand-identity`)."
tags: [brand-voice, tone-of-voice, messaging, brand, voice-guide]
recommends: [landing-copy, brand-identity, marketing, content-engine, customer-support]
origin: risco
---

# Brand Voice — How the Brand Sounds

You own the **reusable voice-and-tone system**: 3–5 personality traits → concrete linguistic rules → a position on the four tone dimensions → a use/avoid word bank → a tone-by-context matrix → a paste-into-the-prompt voice-DNA block. The output is a persisted document, never a finished piece of copy.

The line: **brand-voice owns the reusable definition of how the brand sounds.** The moment you write one finished piece against it, that is a copywriting skill — page hero/value prop/CTA is `landing-copy`; launch emails and channel posts are [`../marketing/SKILL.md`](../marketing/SKILL.md); blog and article systems are `content-engine`, `article-writing`, `newsletter`, `social-publisher`; an investor narrative is [`../pitch-deck/SKILL.md`](../pitch-deck/SKILL.md); a live customer ticket is `customer-support` (it consumes this guide, it does not author it). The way the brand *looks* — logo, color, type, design tokens — is `brand-identity`, and layout/motion is [`../design/SKILL.md`](../design/SKILL.md).

## Voice vs. tone (the load-bearing distinction)

**Voice is constant; tone flexes by context.** Voice is the brand's fixed personality across everything it writes. Tone is the local adjustment for the reader's emotional state and the topic's sensitivity. A frustrated user does not want a joke; a celebration screen does not read like a financial disclosure — yet both are the same voice. (Nielsen Norman Group, "The Four Dimensions of Tone of Voice," pub. 2016-07-17, updated 2023-08-16.)

Why it matters: you author **one** voice and apply **many** tones. Conflate them and you get a guide that says "be playful" on a fraud-alert page — unusable. The guide locks voice once and tabulates tone per context (Step 5).

Why bother at all: consistent brand presentation correlates with revenue uplift — ~23% average, up to ~33% at the upper range across 1,800 brands in 14 industries (Lucidpress/Marq, "State of Brand Consistency"). Treat it as calibration for the effort, not a causal promise — it is a correlational study.

## The flow (six steps)

```text
1 Traits (3–5)  →  2 Rules (Bad→Good)  →  3 Four dimensions (ratios)
       →  4 Word bank (use/ban)  →  5 Tone-by-context matrix
              →  6 AI voice-DNA block  →  persist + audit
```

### Step 1 — Traits (pick 3–5)

Distill the brand to **3–5 adjectives**. Fewer than 3 is not a personality; more than 5 is unmemorable and nobody applies them. (Sprout Social brand-voice guide; Inkbot Design brand-voice chart.)

Reject brand-neutral adjectives. If a competitor would never claim the *opposite*, the word is filler and says nothing. "Innovative," "passionate," "customer-focused," "cutting-edge" — no brand claims "stagnant" or "indifferent," so these traits exclude nothing.

Each trait gets a one-line **this means / this does not mean**, so it is testable:

```text
Plain-spoken
  this means:        we say "we fixed it" — short Anglo-Saxon words, no hedging
  this does NOT mean: dumbed-down or curt; we still explain the why
Quietly confident
  this means:        we state the benefit and stop; no exclamation marks
  this does NOT mean: arrogant, or making claims we can't back with proof
```

### Step 2 — Rules (each trait → 2–3 linguistic rules)

Vague directives fail, especially for an LLM: "be professional" produces nothing reproducible. Voice only transfers when quantified into linguistic rules. (Search Engine Land, "How to train in-house LLMs on brand voice," 2025; Fishtank, "Train Generative AI to Speak in Your Brand Voice," 2025.)

Per trait, write 2–3 rules across these levers — **person, sentence-length ceiling, active vs. passive, contractions, jargon policy** — and show one Bad→Good rewrite per cluster:

```text
Trait: Plain-spoken
  R1  Active voice. Subject does the verb.
  R2  Sentence ceiling ~20 words; break anything longer.
  R3  Jargon only when defined in-line on first use.

  Bad : "Optimal outcomes are facilitated through the leveraging of our
         platform's robust capabilities."  (passive, 12-word abstraction, banned words)
  Good: "Our platform does the heavy lifting so your team ships faster."
```

```text
Trait: Quietly confident
  R1  First person plural ("we"), second person for the reader ("you").
  R2  Use contractions ("we're", "you'll") — formal-but-human, not stiff.
  R3  Zero exclamation marks; the claim carries the energy.

  Bad : "We are SO excited to announce our amazing new feature!!!"
  Good: "New: branch previews ship with every PR. No config."
```

### Step 3 — Plot the four dimensions (decision table)

Tone of voice is measurable on four sliding scales, not switches. (Nielsen Norman Group, same article.) Pick a position on each as a **ratio**, not "somewhere in the middle" — a ratio forces a defensible choice. (Sprinklr / Bigeye brand-voice frameworks, 2025.) A financial brand might run 80/20 formal; a fitness app 30/70 serious-vs-playful.

This branches per brand, so the table earns its place:

| Dimension | Position (ratio) | Why this brand sits here |
|---|---|---|
| Formal ↔ Casual | 65 / 35 casual | Buyers are technical and busy; warmth without slang. |
| Serious ↔ Funny | 80 / 20 serious | We handle money/data; humor only in low-stakes moments. |
| Respectful ↔ Irreverent | 70 / 30 respectful | We challenge category clichés, never the reader. |
| Matter-of-fact ↔ Enthusiastic | 60 / 40 matter-of-fact | Proof over hype; energy lives in verbs, not adjectives. |

Fill the ratios from the traits, not from taste. If a ratio contradicts a trait, one of them is wrong — reconcile before moving on.

### Step 4 — Word bank

Two lists. Power words and a ban list. (Oxford College of Marketing, "AI Brand Voice Guidelines," 2025-08-04.)

- **Power words (15–20):** the vocabulary the brand leans on, derived from the traits. "Plain-spoken + confident" → ship, fix, build, fast, clear, done, plain, real, works. Not a thesaurus dump — words a human would recognize as *this* brand.
- **Ban list (the drift killer):** corporate filler and AI tells. This list is what stops off-brand drift and the generated-by-a-bot smell. Starter set: `leverage`, `seamless`, `elevate`, `delve`, `robust`, `unlock`, `game-changer`, `in today's fast-paced world`, `revolutionize`, `synergy`, `cutting-edge`, `best-in-class`. Add brand-specific bans (e.g. never say "users," say "teams").

The full starter ban list and the method for deriving power words from traits live in [`references/word-bank.md`](references/word-bank.md).

### Step 5 — Tone-by-context matrix

Voice stays fixed (the row content proves it); tone shifts per context. Build the matrix so writers and the LLM know which dial to turn where:

| Context | Voice (constant) | Tone shift | Example line |
|---|---|---|---|
| Onboarding | plain-spoken, confident | warm, encouraging | "You're in. Let's connect your first repo." |
| Error / failure | plain-spoken, confident | plain, reassuring, zero humor | "That upload failed. Your data is safe — try again." |
| Success / celebration | plain-spoken, confident | a little warmth, still no hype | "Done. Your preview is live." |
| Billing / account | plain-spoken, confident | precise, calm, no jokes | "Your plan renews June 30. Cancel anytime, no fees." |
| Legal / security notice | plain-spoken, confident | formal, exact, literal | "We encrypt data in transit and at rest. See our DPA." |

The voice column never changes line to line — that is the whole point. Only the tone column moves.

### Step 6 — The AI voice-DNA block

Assemble the guide into one paste-into-a-system-prompt block so an LLM (or any writer) reproduces the brand. Concrete rules + lexicon, never adjectives alone:

```text
VOICE DNA — <brand>
Traits: plain-spoken, quietly confident, technical-but-human.
Rules: active voice; sentences <=20 words; use contractions; first person
  plural "we", reader as "you"; no exclamation marks; jargon only if defined.
Dimensions: 65/35 casual, 80/20 serious, 70/30 respectful, 60/40 matter-of-fact.
Use: ship, fix, build, fast, clear, real, works, plain.
Never use: leverage, seamless, elevate, delve, robust, unlock, game-changer,
  "in today's fast-paced world", revolutionize, synergy, best-in-class.
Tone by context: onboarding=warm; error=plain+reassuring, no humor;
  success=light warmth, no hype; billing=precise+calm; legal=formal+exact.
```

**Persist it.** Write the compiled guide under `02-DOCS/wiki/brand/voice-guide.md` and the voice-DNA block beside it, per the `harness` Karpathy-wiki convention (compiled brand articles under `02-DOCS/wiki/brand/`, raw user inputs under `02-DOCS/raw/brand/`). The persisted file is an OKF v0.1 wiki article: open it with YAML frontmatter carrying a non-empty `type:` (use `type: brand-voice`) — see the frontmatter block in [`references/voice-guide-template.md`](references/voice-guide-template.md), which is also the fill-in-the-blanks skeleton for the whole guide (traits → rules → 4-D ratios → word bank → context matrix → voice-DNA block) with one fully worked mini-example brand. This is the exact study `marketing`, `landing-copy`, and `content-engine` read to ground their copy. A guide in a slide deck is invisible to them.

## Auditing for drift

To score a sample against the guide, run three passes:

1. **Ban scan** — does the sample use any banned word? Each hit is a drift point.
2. **Rule check** — passive voice, sentences over the ceiling, exclamation marks, undefined jargon. Count violations.
3. **Trait test** — read it cold: which traits surface? If "plain-spoken + confident" reads as "hypey + vague," it is off-brand regardless of word count.

Off-brand reads like everyone else: abstract nouns, hedged claims, AI tells, energy faked with punctuation instead of verbs. The fix is always a rewrite toward a rule, never "make it pop."

## Anti-patterns

| Anti-pattern | Why it fails | Do this instead |
|---|---|---|
| Traits = "innovative, passionate, customer-focused" | No competitor claims the opposite; excludes nothing | Pick traits a rival would reject; add this-means/this-does-not-mean |
| "Be professional" as the only guidance | An LLM and a junior writer can't reproduce an adjective | Quantify into rules (person, length, voice, jargon) + a Bad→Good |
| Tone "somewhere in the middle" on every axis | Vague middle = no decision = generic output | Commit to a ratio (80/20) and justify it from a trait |
| Voice changes per channel | Channel-by-channel voices = no recognizable brand | Voice fixed; tone flexes per context (Step 5) |
| No ban list | Drift and AI tells creep in unchecked | The ban list is the drift killer — ship it first |
| Guide lives in a deck or someone's head | Downstream skills and LLMs can't read it | Persist machine-readable under `02-DOCS/wiki/brand/` |
| Writing the actual landing/email/article | That is a finished piece, not the definition | Stop; hand to `landing-copy` / `marketing` / `content-engine` |

## Verify

`scripts/verify.sh <guide.md>` is a read-only structural linter for a produced voice guide: it checks the required sections are present (traits, rules with Bad→Good, four-dimension ratios, a non-empty ban list, context matrix, voice-DNA block), flags a trait count outside 3–5, warns on brand-neutral filler used as a trait, and greps the guide's own prose for words it lists in its own ban list (self-consistency). Empty or clean input exits 0 — no false failure.
