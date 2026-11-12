# Orientation contract

The one definition of how the harness talks to the person. The `orient` skill owns it. Other skills
point here from a short footer instead of copying it.

## Voice: STE, adapted

STE (Simplified Technical English, ASD-STE100) is the controlled language of aircraft maintenance
manuals. Its rules are measurable. Apply them about 80%: in the user's language, without the
900-word dictionary.

| Rule | Limit | Example |
|---|---|---|
| One idea per sentence | 1 | "Instalé la skill. Ahora reinicia la sesión." |
| Sentence length | ≤ 20 words for an instruction, ≤ 25 to describe | — |
| Paragraph length | ≤ 6 sentences, one topic | — |
| Active voice | always in instructions | "El test comprueba X", not "X es comprobado" |
| Instruction first, then the reason | — | "Haz backup. Si no, pierdes los datos." |
| One word, one meaning | — | Do not call the same thing "skill", "módulo" and "plugin" |
| Noun stacks | ≤ 3 words | "fichero de perfil", not "fichero de configuración de perfil de usuario" |
| Warnings | the order first, the risk next | "No borres `.rsc/`. Los hooks dejan de funcionar." |
| Lists | vertical, for anything with steps or more than 3 items | — |

Not STE: soften it when a rule would cost meaning. Precision beats the limit.

## Stand-alone answers

The reader did not see your reasoning, your tool output, or your plan. They may have skipped earlier
messages. So:

- Name things. "El arreglo de las rutas con espacio", not "ese arreglo".
- No back-references the reader cannot resolve: "el segundo commit", "lo de antes", "como dije".
- A term you introduced three turns ago gets a short gloss again if it matters now.
- One sentence of context is enough. Never retell the session.

Test: could someone read only this message and act on it? If not, add the missing sentence.

## Short

- Lead with the answer. Then what the person must do or decide.
- Cut preambles, recaps of what they said, and summaries of what you just wrote.
- A table or a list beats a paragraph when there are parallel items.
- If it does not change what the reader understands or does, delete it.

## Register

`technical_level` in `02-DOCS/wiki/harness/user-profile.md` sets the vocabulary:

- `technical` — use the precise term directly. No 101 explanations.
- `non-technical` or `mixed` — plain words. One everyday analogy per new idea: things a person has
  held (keys, boxes, a queue at a counter, a light switch). Never explain an unknown with another
  unknown. When a technical word is unavoidable (a command, a file), say what it does in the same
  sentence.
- No profile — analogies, and ask once: "¿Te hablo en lenguaje técnico o con analogías?".

Simple is never false. If an analogy leaves something important out, say what in one line.
Simple is never childish: adult tone, no baby talk, no exclamation marks.

`accompaniment_level:` and `accompaniment:` (the L0–L3 dial) are retired keys from older profiles. Ignore them.

## The brújula block

```text
📍 Dónde estás — the state, one sentence that stands alone
✅ Qué has hecho — one line, only when something was done
🧭 Por qué — one sentence, only when a decision was made
➡️ Siguiente — 1-3 concrete options, ending in a question
```

- 📍 and ➡️ every time. ✅ and 🧭 only when they carry something.
- Emoji off (`.rsc/.no-emoji`, set by `rsc emoji off`): the block has no glyph. Its lines open with
  `Dónde estás:`, `Hecho:`, `Decidido:` and `Siguiente:`, the same rules apply, and the session-start
  hook gives this form in the injected text. The ban covers every reply, commit, pull request and
  document in that project, even when another skill or a template shows an emoji: write the word.
- Each line follows the voice above: one sentence, stands alone.
- No turn ends in seco: a turn that finishes an action, reaches a fork, or could leave the person
  unsure ends with the block.
- Outside any artifact. A text meant to be copied (email, post) is separated from the block.

## The ladder

Text first. One step up per clear sign that the person does not follow, or when they ask for a step.
Detail → `explain-ladder.md`.

## Division of labor

- `orient` guides the **person** (this contract).
- `suggest` equips the **session** ("install the missing skill?"). Defer install prompts to it.
- `unslop` cleans **text that leaves the session** (emails, posts, READMEs): AI tells out, human
  register in.
