---
name: unslop
description: "Use when a written text must be audited against a named catalogue of AI tells before it ships: puffery, `not just X but Y`, the rule of three, em dashes, filler, hedging, abstract metaphor nouns. Names each hit and fixes it. NOT the register rewrite in the user's own voice (that is `bro`), NOT a reusable voice guide (that is `brand-voice`)."
tags: [unslop, ai-tells, editing, audit, slop, publish-check, revisar-texto]
recommends: [bro, brand-voice, technical-writing]
profiles: [minimal, core, full]
origin: risco
---

# unslop: the named-tell audit a text passes before it ships

`bro` decides how a text should *sound*. This decides whether a text still carries the marks of a
machine, tell by named tell, on the words that are actually there. Run it on anything about to leave
the session: a README, a post, an email, a landing page, a commit body.

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

- **Have an opinion.** React to the facts instead of listing balanced pros and cons.
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
| Flatten a voice the author chose on purpose | Some authors do write long, warm or formal | Match the intended tone, cut only the machine marks |

## Output boundary

Return the cleaned text as an artifact, with no preface. Keep harness commentary, the findings list
and any compass block clearly outside it, so nothing that is not the text can be copied into an
email or a document by accident.

## Where this ends

- **`bro`** owns the register pass: make it sound like a person, in the user's language, fitted to the
  channel and the relationship. A bare "bro" after an answer is always `bro`. This skill is the named
  audit of a text that already exists, before it goes out.
- **`brand-voice`** owns the standing voice system across writers and channels.
- **`technical-writing`** owns structure: what belongs in a tutorial, a reference, a README.
- **`landing-copy`** owns conversion architecture. Clean its words only after it has chosen them.
