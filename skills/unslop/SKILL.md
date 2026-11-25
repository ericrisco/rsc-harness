---
name: unslop
description: "Use when a text that leaves the session (email, post, README, message, landing copy) must sound like a person and carry no AI tells: rewrites it in the user's language fitted to the channel and relationship, and audits it against a named catalogue of tells (puffery, `not just X but Y`, rule of three, em dashes, filler, hedging). Fires on 'bro', 'hazlo más humano', 'que no suene a IA', 'más natural', 'unslop this'. NOT how the harness talks to the user (that is `orient`), NOT a reusable voice guide (that is `brand-voice`)."
tags: [unslop, human-writing, humano, natural-language, plain-language, ai-tells, editing, rewrite, bro, revisar-texto]
recommends: [brand-voice, technical-writing]
profiles: [minimal, core, full]
origin: risco
---

# unslop: text that leaves the session sounds like a person

Two passes over a text someone else will read: the **register** (sound like a person, in this
language, for this relationship and channel) and the **named-tell audit** (no marks of a machine,
tell by tell). Run it on anything about to leave the session: a README, a post, an email, a landing
page, a commit body. How the harness talks to the user is `orient`, not this.

## Find the source without ceremony

A bare "bro", "unslop", "write like a human", "hazlo más natural" points to the assistant's last
answer. If the user pasted text, work on that. If they asked for new copy, draft it directly. Ask for
text only when no source exists.

## The register pass

1. **Preserve the payload.** Names, facts, numbers, links, commitments, constraints, uncertainty and
   necessary warnings stay. Never invent evidence, opinions, anecdotes or certainty to make it flow.
2. **Match the room.** The user's language, fitted to audience, relationship and channel. A natural
   legal notice is still precise; a natural Slack message can be loose. Human is not always casual.
3. **Cut the bot-shaped scaffolding.** Throat-clearing, needless summaries, repeated conclusions,
   corporate filler, fake enthusiasm, headings or bullets that do not help the reader navigate.
4. **Restore a real cadence.** Concrete verbs, direct sentences, natural contractions. The words a
   person in this context would choose, without manufactured slang, typos or choppy fragments.

| Aim | The result |
| --- | --- |
| Plain, not simplistic | Easy to follow without losing the idea |
| Concise, not incomplete | No padding; every load-bearing fact remains |
| Warm, not performative | Appropriate care without canned empathy |
| Specific, not decorated | Concrete nouns and verbs instead of hype |

When a text needs both passes: audit first, register last.

## The pass

1. **Scan against the tables below.** Every hit gets located, not sensed. If you cannot name the
   tell, it is not a finding.
2. **Rewrite in place.** Preserve meaning, facts, numbers, links, commitments and the intended tone.
3. **Restore the voice** (next section). A text stripped of tells and nothing else reads as sterile,
   which is its own tell.
4. **Self-audit once more.** Ask: what still makes this obviously machine written? Fix that too.
5. **Return the text.** On request, return the list of named hits alongside it.

## Removing tells is half the job

Voiceless writing is as obvious as slopped writing. After the cuts, put something back:

- **Keep the author's opinion.** Where the source takes a stand, state it plainly instead of flattening it into balanced pros and cons. Never add a stance the author did not take.
- **Vary the rhythm.** Short sentence. Then a longer one that takes its time and earns the length.
- **Admit complexity.** "Impressive and slightly unsettling" beats "impressive".
- **Use "I" when it fits.** First person is not unprofessional.
- **Allow some mess.** Perfect symmetry looks manufactured.
- **Be specific.** Not "this is concerning" but "it churns for six hours at 3am and nobody is watching".

## Content tells

| Tell | Fix |
| --- | --- |
| Puffery: "pivotal moment", "testament to", "evolving landscape", "indelible mark" | State what happened |
| Name dropping outlets with no context | Pick one, quote what it said |
| Decorative `-ing` clauses: "highlighting...", "ensuring...", "showcasing..." | Delete, or expand into a real claim with a source |
| Promotional adjectives: "nestled", "vibrant", "breathtaking", "renowned", "must-visit" | Neutral description |
| Vague attribution: "experts believe", "reports suggest", "critics argue" | Name the source or cut the claim |
| The formulaic challenge arc: "despite challenges, X continues to thrive" | Specific facts instead of the arc |

## Language tells

| Tell | Fix |
| --- | --- |
| AI vocabulary: additionally, crucial, delve, enhance, foster, garner, interplay, intricate, landscape, pivotal, showcase, tapestry, testament, underscore, vibrant | The plain word |
| Fancy ways to say "is": "serves as", "stands as", "boasts", "features" | "is", "has" |
| "Not just X, but Y" | State the point directly |
| Rule of three: forcing every list into three items | The number the facts have |
| Synonym cycling: protagonist, main character, central figure, hero in one paragraph | Pick one and repeat it |
| False ranges: "from X to Y" where X and Y share no scale | List the items |
| Abstract metaphor nouns: substrate, wedge, vector, locus, nexus, primitive, surface, bedrock, scaffolding, paradigm, flywheel, north star, gold-plating, ratchet, evacuate | The concrete word: base, add, way, more than the job needs, move out |

## Style and punctuation tells

| Tell | Fix |
| --- | --- |
| Em dashes, anywhere | End the sentence, or use a comma. Swapping in parentheses trades one tell for another |
| Colons as mid-sentence connectors | Let the point stand as its own sentence. Colons are for lists and examples |
| Bold on every proper noun and acronym | Bold what the reader must not miss, nothing else |
| Inline-header lists whose bold label restates the line: "**Performance:** performance improved" | Prose. A bold lead-in that ends in a period and is followed by genuinely new detail is fine |
| Title Case Headings | Sentence case |
| Decorative emoji in headings and bullets | Remove |
| Curly quotes | Straight quotes |

## Filler, hedging and plain speech

| Tell | Fix |
| --- | --- |
| "In order to", "due to the fact that", "it is important to note that" | "To", "because", delete |
| Stacked hedges: "could potentially possibly be argued that it might" | "may", or the claim itself |
| Generic conclusion: "the future looks bright" | A specific plan, date or number |
| Chatbot phrases: "I hope this helps", "let me know if", "certainly", "great question" | Remove |
| Cutoff disclaimers: "while specific details are limited" | Find the detail or drop the sentence |
| Sycophancy: "you're absolutely right" | Answer directly |
| Feeling instead of mechanism: "the database stays close at hand" | The mechanism or the number: "`.toSQL()` returns the exact string sent to the database" |
| A sentence that would fit unchanged in another project's docs | Cut it. It says nothing about this one |
| Dense sentences the reader has to reparse | One idea per sentence |
| Passive with a hidden actor: "queries are validated" | Name the actor: "the compiler validates queries" |
| Adverbs propping up weak verbs: "runs quickly", "significantly improves" | A stronger verb or the measured number |
| Fancy synonyms: utilize, leverage, facilitate, numerous, in the event that | use, use, help, many, if |

## Anti-patterns

| Anti-pattern | Why it fails | Do this instead |
| --- | --- | --- |
| Report the tells and leave the text unfixed | The user asked for a clean text, not a diagnosis | Fix in place, list on request |
| Cut every tell and stop | Sterile prose is the other AI tell | Restore opinion, rhythm and specifics |
| Rewrite the meaning while cleaning the style | The edit silently changes the claim | Facts, numbers, links and commitments stay exact |
| Strip a term because it sounds technical | Precision lost to style is a defect | Keep the term, explain it once |
| Touch code, commands, URLs, quotes or regulated wording | Those are not prose | Leave them byte for byte |
| Claim the result will pass an AI detector | Nobody can promise that | Promise named tells removed, nothing more |
| Add typos, slang or filler to seem human | It performs humanity and sounds less credible | Match the actual relationship and channel |
| Use the same casual voice for every audience | A client email, a README and a condolence need different registers | Infer the room before choosing the cadence |
| Announce and justify every edit | The preamble is the friction the user asked to remove | Lead with the finished words |
| Flatten a voice the author chose on purpose | Some authors do write long, warm or formal | Match the intended tone, cut only the machine marks |

## Output boundary

Return the cleaned text as an artifact, with no preface. Keep harness commentary, the findings list
and any compass block clearly outside it, so nothing that is not the text can be copied into an
email or a document by accident.

## Where this ends

- **`orient`** owns how the harness talks to the user: STE-style, short, every answer stands alone.
  This skill is for text the user sends to someone else.
- **`brand-voice`** owns the standing voice system across writers and channels.
- **`technical-writing`** owns structure: what belongs in a tutorial, a reference, a README.
- **`landing-copy`** owns conversion architecture. Clean its words only after it has chosen them.
