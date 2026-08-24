> Source: Notion, "Design DNA: One beautiful design into a permanent skill".
> Transcribed verbatim (em dashes normalised to hyphens). This is the rationale and the research trail behind `../SKILL.md`.

# Design DNA: One beautiful design into a permanent skill

> [!NOTE] 
**The idea in one line.** A design loop finds you one beautiful thing. Design DNA turns that one thing into a skill you keep forever, so you can make more of it, in any format, without the look drifting.
[image: attachment:44015a64-bb3b-48e3-854f-ea1df12d3132:design-dna-card-v3.png] 
> [!NOTE] 
**Important: this is not only about "designs".** It is about Claude codifying **anything it built**. The winner from your loop might be a website, a poster, a motion graphic, a carousel or a deck. Same system, same file, same tests. The format is an output, not the subject.
[table_of_contents] 

---


## The problem

You run a design loop. Lots of models make lots of options. One comes out beautiful.
Then it dies.
Nobody wrote down **why** it was beautiful. Next time you ask for "the same style" you get something close, then something a bit off, then something generic. By the fifth one it looks like every other AI design on the internet.
> [!NOTE] 
This is not the model being lazy. Every rule you do not write down, the model has to guess. And it does not guess randomly. It guesses **the average of everything it has ever seen**. That average is what people call AI slop. Slop is just the sound of an unwritten rule.
So the answer is: write the rules down. But *which* rules, and how many? That turns out to be the whole game.

---


## The 60-second version

1. Find a design you love.
1. Take it apart. Measure it, do not describe it.
1. Argue with yourself about which bits actually matter.
1. Write the rules down as a file.
1. Write **tests** that a bad copy would fail.
1. Rebuild the original from your rules alone. Whatever you get wrong is a rule you forgot. Add it. Go again.
1. Save the whole thing as a skill.
Step 6 is the one nobody does, and it is the one that works.

---


## The six things that actually make a design a design

Most people write down the wrong things. Here is what carries the look.
| Thing | What it means, plainly |
|---|---|
| **Ratios, not numbers** | "The headline is 96px" is nearly useless. "The headline is 8 times the body text, never under 6" is the actual style. The look lives in the **gap** between things, not in either thing. |
| **How much, not just what** | The same 3 colours at 60/30/10 and at 90/8/2 are two different designs. Always write down roughly what share of the page each colour covers. |
| **The one weird move** | Nearly every great design breaks its own rules exactly once. Type crossing a photo. A line poking past the margin. A giant number cut off by the edge. This is the most important single thing in the design, and it is the first thing you lose when you copy it, because you copy the system and this is a break from the system. |
| **The refusals** | If you list six colours, you have told the model it may use six. The real design used one accent on 3% of the page. The design's actual content was a **refusal**. Write refusals down. |
| **What is missing** | No shadows. No icons. No curves. Nothing centred. Absence is a design decision. Record it like you record anything else. |
| **Named layouts** | If you do not name the layouts, slide 8 will not match slide 1. You get the right colours in the wrong arrangement, which reads as sloppy. |

---


## The big decision: how much do you write down?

I ran two agents against each other on this. One argued for writing **everything** down. One argued that writing everything down is a trap. Both had real evidence. Here is how it resolved.
> [!NOTE] 
**Write everything**
Anything you leave out gets guessed. Guessing is where the look dies. Real design systems (Material, Figma, Tailwind, the W3C token standard) are all exhaustive, and they are exhaustive for a reason.
> [!NOTE] 
**Write almost nothing**
A copy can match every single value and still look generic. Models obey **fewer** rules as you add more of them. Anything in the middle of a long document gets ignored. The look lives in about nine moves.
**Both are right, about different documents.** That is the answer, and it is not a compromise.
> [!NOTE] 
**Compile, do not paste.**
You keep two files. A big one for your records and your build tools. A tiny one for the model. The big one **never** goes in a prompt.
| | dna.json - the record | PROMPT dot md - the payload |
|---|---|---|
| Who reads it | You, and build tools | The model |
| How big | As big as it needs to be | **Hard cap: 2KB** |
| What is in it | Every measured value | Reference image, the weird move, 3-9 moves, the bans, one example |
| Rule | Never goes in a prompt | Never leaves out the image |
**Why the cap is real, not a preference:**
- The more rules you give a model, the **fewer** it follows. This is measured, and it drops steadily. A 200-rule spec is not 200 rules obeyed, it is a lottery over which ones get dropped, and you do not pick the winners.
- Anything in the middle of a long document gets recovered much worse than anything at the start or the end. Over 30% worse. So your best rule, sitting at line 147 of 400, is in the dead zone. That is why **the weird move gets its own slot near the top**.
- Style largely cannot be put into words at all. The best style-transfer research sends *content* through the text channel and *style* through the **image** channel, because fine-grained style resists description.
- The reference image is almost free. Image conditioning runs on its own pathway, so it does not eat the attention your words are competing for.
> [!NOTE] 
**Always attach the reference image.** Highest-leverage move available, costs you almost nothing.

---


## The blueprint: what you need to know to rebuild any design

This is the answer to "if we wanted to reproduce this, what would we need?"
| Section | What it holds | Why it matters |
|---|---|---|
| `meta` | Name, source files, date, and anything you refuse to copy | Real logos and licensed photos get excluded. Copy the **system**, never the **marks**. |
| `soul` | One sentence, 3-5 adjectives, its family tree, how far away it is read from | The compression key. Read this alone and you are most of the way there. Read distance also sets your minimum type size. |
| `palette` | Colours with a **role** and a **coverage %** | Coverage is the most-skipped and most-decisive field in the whole document. |
| `type` | Families with fallbacks, and the display-to-body **ratio** | That ratio is a signature on its own. 8-to-1 and 2-to-1 are different designs with identical fonts. |
| `space` | Grid, margins, alignment, where the emptiness sits | Written as **percentages**, so one file drives a carousel and a slide with no rewrite. |
| `surface` | Grain, texture, edges, how photos are treated | What the thing is physically made of. |
| `signatures` | 3-9 named moves, written as **ratios** | The payload. Carry these and nothing else and it is still recognisable. |
| `weird_move` | The one break in the system | Its own slot so it can never get buried. |
| `archetypes` | The named layouts | Makes output #8 sit beside output #1 as a set. |
| `motion` | Curves, timings, and what **never** moves | Restraint is a signature too. |
| `voice` | Sentence length, headline shape, banned words | Copy is part of the design. Right layout, wrong sentence, broken look. |
| `bans` | 5 or more, written as absolutes | See below. These do the heavy lifting. |
| `tests` | 8 or more checks that can **fail** | The difference between a system and a mood board. |

---


## Why "never" beats "always"

> [!NOTE] 
When your output looks generic, do not add a rule about what to do. **Add a ban.**
Two reasons, and both are real mechanisms rather than folklore.
**For image models**, a negative prompt is not advice. The sampler works out one prediction with your prompt and one with the negative, then moves **away** from the negative. It is the origin of the vector, on its own channel. It does not compete with the rest of your prompt.
**For any model**, a positive instruction has to out-vote the training average. "Use an asymmetric layout" is one weak vote against a landslide. "Never centre the hero" **deletes** the landslide from the options. And one ban can rule out a whole space in a single line: "never more than one accent colour" kills every multi-accent palette at once.
Bans are also checkable. "Is the hero centred?" has a yes or no answer. "Does it feel editorial?" does not.

---


## The step nobody does

> [!NOTE] 
**Rebuild the original using only your spec. Then compare them.**
Every difference is a rule you forgot. Add it. Go again. Repeat until a stranger cannot tell the copy from the original.
This is the only honest test of whether your spec is finished. A spec that has never been used to rebuild its own source has never been tested at all.
Expect two or three rounds. Expect the gaps to be things you were completely sure were obvious.

---


## Tests that can fail

A spec with no failing test is a mood board with better formatting. Write 8 to 12. Binary and measurable.
**Good:**
- Accent colour covers under 8% of the canvas.
- No more than 3 type sizes in one frame.
- Largest-to-smallest type ratio is above 6 to 1.
- Smallest type is at least 28px at 1080px wide.
- The weird move is present, exactly once.
- Body copy stays under 65 characters per line.
- Squint from three metres. Does the weight sit in the same places as the reference?
**Not tests:** "feels premium", "looks clean". If two people could disagree on the answer, it is not a test.

---


## The JSON architecture

The shape of the file. Full schema with descriptions lives at `~/.claude/skills/design-dna/design-dna.schema.json`.
```json
{
 "meta": { "name", "slug", "source", "captured", "not_copied", "medium_of_origin" },
 "soul": { "one_line", "adjectives", "lineage", "read_distance",
 "energy": { "density", "variance", "contrast", "warmth" } },
 "palette": { "colors": [{ "role", "hex", "name" }], "coverage", "mode", "banned" },
 "type": { "families": [{ "role", "family", "fallback", "weights" }],
 "scale": { "display_to_body_ratio", "steps", "max_sizes_per_frame" },
 "treatment": { "display_tracking", "body_leading", "case", "measure" } },
 "space": { "grid", "margin_pct", "gutter_pct", "alignment",
 "rhythm", "negative_space", "safe_area" },
 "surface": { "texture", "edges", "elevation", "imagery", "iconography" },
 "signatures": [{ "move", "how", "when", "never" }],
 "weird_move": { "what", "how", "why" },
 "archetypes": [{ "id", "purpose", "anatomy", "content_shape" }],
 "motion": { "easing", "durations", "entrances", "never_moves", "reduced_motion" },
 "voice": { "register", "sentence_length", "headline_shape", "banned_words" },
 "bans": [ "written as absolutes, 5 minimum" ],
 "tests": [{ "id", "check", "fail_looks_like", "auto" }],
 "reconstruction": { "attempted", "gaps_found", "passes" }
}
```

---


## THE PROMPT

Paste this into any session. Attach the design. That is the whole setup.
```markdown
You are a design forensics analyst. I am going to give you one design I love.

Your job is not to praise it, describe it, or make something like it. Your job is
to CODIFY it: reduce it to the smallest set of rules that will reproduce its
identity on completely different content, forever, across any medium.

The output is a reusable skill. Treat the design in front of you as evidence,
not as a brief.

## THE STANDARD YOU ARE HELD TO

A specification that cannot fail is not a specification.

If every rule you write is one a bad output could still satisfy, you have written
a mood board. Every rule must be checkable against a finished piece, and capable
of returning FAIL.

## WHAT ACTUALLY CARRIES A DESIGN'S IDENTITY

Read this before you start. Getting it wrong is the standard failure.

1. RELATIONSHIPS, NOT VALUES. "The headline is 96px" is nearly worthless. "The
 headline is 8x the body, never under 6x" is the identity. Style lives in the
 ratios between elements. A list of measurements is exactly that information
 thrown away.
2. PROPORTIONS OF COLOUR, NOT JUST COLOUR. The same three hex codes at 60/30/10
 and at 90/8/2 are two unrelated designs. Always record coverage.
3. ONE BREAK IN THE SYSTEM. Almost every design worth copying has exactly one
 deliberate exception: type crossing an image, a rule overshooting its margin,
 a numeral clipped by the canvas edge. It is the highest-information element
 present and the first thing a mechanical extraction loses, because extraction
 looks for systems and this is a break from the system. Find it. Name it.
4. REFUSALS, NOT JUST PERMISSIONS. Listing six colours tells a model it may use
 six. If the reference uses one accent on 3% of the canvas, the design's real
 content is a refusal. Write the refusals down.
5. ABSENCE IS DESIGN. No shadows. No icons. No curves. Nothing centred. Record
 what is missing with the same care as what is present.
6. STRUCTURE, NOT ONLY STYLING. If a style has no named layouts, output #8 will
 not sit beside output #1 as a set. You get consistent styling and
 inconsistent structure, which reads as sloppiness.

## RUN THIS IN SEVEN STEPS. SHOW YOUR WORK AT EACH.

### STEP 1 - OBSERVE. Do not interpret.

Produce a flat inventory of literal observations. Measure, do not describe.

Sample real colours. Estimate what share of the canvas each covers. Count the
type sizes, the weights, the accent uses. Measure the ratio between largest and
smallest type. Note margins as a percentage of the canvas, not in pixels. Record
texture, grain, edges, image treatment. Write down what is absent.

No judgements yet. Interpretation here is how you end up specifying a design
that is not the one in front of you.

### STEP 2 - DEBATE IT WITH YOURSELF. Two loops, honestly opposed.

LOOP A, THE MAXIMALIST. Argue: anything not written down will be improvised, and
improvisation is where consistency dies. List every property exhaustively.
Miss nothing.

LOOP B, THE MINIMALIST. Argue: a copy can match every value and still look
generic. Identity lives in a handful of moves and a wall of refusals. Name the
3-9 moves that actually carry it, and the bans that keep output off the average.
Attack Loop A's list. Say which entries are load-bearing and which are trivia.

ADJUDICATE. For every property, ask:

 If I changed this value, would the output stop looking like the reference?

Yes, it is load-bearing. No, it is trivia, and trivia dilutes attention.

Then resolve the debate the right way, which is NOT a compromise. Both sides are
correct about different documents:

- The EXHAUSTIVE record is for me and for build tools. Any size, because a
 compiler does not sample.
- The PROMPT PAYLOAD is for a model with a finite attention budget. Hard cap:
 2KB of text. Compliance drops as rules pile up, and material in the middle of
 a long document gets recovered far worse than material at either end.

### STEP 3 - CODIFY. Write dna.json.

Fill these keys. Omit any that genuinely do not apply.

meta name, slug, source files, date, medium of origin,
 not_copied (any real logo, wordmark or licensed image -
 reproduce the SYSTEM, never the MARKS)
soul one_line (max 160 chars, concrete nouns, no marketing words),
 3-5 adjectives, lineage (Swiss editorial / 90s flyer / brutalist),
 read_distance (thumb | arms-length | desk | room | street),
 energy: density, variance, contrast, warmth - each 1-10
palette colors[]: role, hex, descriptive name ("dusty plum", never
 "accent-500" - image and video models cannot read token names)
 coverage: percentage of canvas per role, summing to ~100
 banned: colour behaviours forbidden
type families[]: role, family, REQUIRED fallback, weights, licence risk
 scale: display_to_body_ratio (the typographic signature),
 steps, max_sizes_per_frame
 treatment: tracking, leading, case, measure, numerals
space grid, margin_pct, gutter_pct, alignment, rhythm,
 negative_space (where the emptiness is and how big),
 safe_area per platform
 USE PERCENTAGES so one spec drives a 1080x1350 carousel and a
 1920x1080 slide without a rewrite
surface texture (kind, opacity, scale, stacking order), edges, elevation,
 imagery treatment, iconography
signatures[] 3-9. move (name it like a technique), how (AS A RATIO OR
 RELATIONSHIP), when it appears, never (how it gets used wrong)
weird_move the single break in the system. Its own key, deliberately.
archetypes[] named layouts: id, purpose in a sequence, anatomy, content budget
motion easing curves, durations, entrances, what NEVER moves,
 reduced-motion fallback. Omit for static work.
voice register, sentence length, headline shape, banned words.
 Copy is part of the design.
bans[] minimum 5, written as absolutes
tests[] minimum 8. See Step 4.

### STEP 4 - WRITE TESTS THAT CAN FAIL. Eight to twelve.

Binary and measurable:

- "Accent colour covers under 8% of the canvas."
- "No more than 3 type sizes in a single frame."
- "Largest-to-smallest type ratio is above 6:1."
- "Smallest type is at least 28px at 1080px canvas width."
- "The weird move is present, exactly once."
- "Body copy stays under 65 characters per line."
- "Squint from three metres. Does the mass distribution match the reference?"

Not tests: "feels premium", "looks clean". If two people could disagree about
the answer, it is not a test. Mark which ones a script could decide.

### STEP 5 - RECONSTRUCT AND DIFF. Do not skip this.

Rebuild the original reference using only dna.json. Close the reference. Work
from the spec alone.

Put your rebuild beside the original. List every single difference.

Every difference is a field the spec forgot. Fold each one back in. Record what
was missing. Go again. Repeat until a stranger could not pick the copy from the
original.

This is the only honest test of completeness that exists. A spec that has never
been used to rebuild its own source has never been tested. Expect two or three
passes. Expect the gaps to be things you were sure were obvious.

### STEP 6 - EMIT THE SKILL.

Write a folder named after meta.slug:

 <slug>/
 SKILL.md how to use this style
 PROMPT.md the 2KB payload. THIS is what goes in a context window.
 dna.json the full record. NEVER pasted into a prompt.
 reference/ the original, kept forever
 example/ one worked output, the canonical proof
 tools/check.py the automatable tests, exits non-zero on failure

PROMPT.md is the file that matters. Order it exactly like this, because
attention is strongest at the two ends and weakest in the middle:

 1. The reference image, attached and named first
 2. soul.one_line
 3. The weird move, alone, unmissable
 4. The 3-9 signature moves, as ratios
 5. The bans, as absolutes
 6. Palette and type - roles and coverage only, not a full ramp
 7. Archetype names and when to use each
 8. The self-check, last

Nothing else. If it does not change what the output looks like from three metres
away, it belongs in dna.json, not here. To add a tenth signature you must delete
one. The cap is the point: it forces you to decide, and an uncapped spec just
ships your indecision.

End PROMPT.md with this line:

 Before returning any output, run every test in the self-check. Name each test
 and its result. If any fails, repair the output and run them again. Never
 return output with a failing test and a note explaining it away.

### STEP 7 - TELL ME WHAT YOU ARE UNSURE ABOUT.

List every value you inferred rather than measured, and every rule you are under
70% confident in. These are where the style will drift first, and I would rather
know now.

## RULES FOR YOU, THE ANALYST

- Never invent a value you could measure. If you cannot measure it, say so and
 mark it inferred.
- Never copy a real logo, wordmark, licensed photograph or proprietary typeface.
 Put them in meta.not_copied and substitute. Reproduce the system, never the
 marks.
- Descriptive colour names, not systematic ones. "Dusty plum" travels to an
 image model. "accent-500" does not.
- Every font family needs a fallback. Silent Arial substitution is the most
 common way a reproduction dies quietly.
- When you are tempted to add a rule because output looks generic, add a ban
 instead. A prohibition steers harder than a permission, and one ban can rule
 out an entire space in a single line.
- One skill per style. Never merge two identities into one spec. The average of
 two good designs is a bad design.

Begin at Step 1. Show your work.
```

---


## When it goes wrong

| What you see | What caused it | Fix |
|---|---|---|
| Matches every value, still looks generic | Moves missing, or too many | Cut to 3-9, write them as ratios |
| Drifts back to the stock AI look | Not enough bans | Bans should outnumber positive style rules |
| Slide 1 and slide 8 do not match | No named layouts | Add archetypes |
| The accent reads as a theme, not an accent | No coverage percentages | Add them |
| Works on a slide, breaks on a carousel | Pixel values in the spacing | Convert to percentages |
| Obeys some rules, ignores others, differently each run | Prompt is over the cap | Cut to 2KB |
| Your best rule keeps getting ignored | It is buried in the middle | Move it to the top or the bottom |
| Fine, but forgettable | No weird move | Find the one break in the system |
| Spec feels complete, output is wrong | You skipped Step 5 | Rebuild the original from the spec. Compare. |

---


## Why any of this works

<details><summary>**The research behind it.** Click to open.</summary>
 This is not opinion. Each design decision above traces to a specific result.
 - [Lost in the Middle](https://arxiv.org/abs/2307.03172) - models recover information from the middle of a long context over 30% worse than from either end, across six model families. This is why the weird move gets its own slot near the top and the self-check goes last.
 - [FollowBench](https://arxiv.org/abs/2310.20410) and [RECAST](https://arxiv.org/html/2505.19030) - instruction compliance falls steadily as you add constraints. This is why the prompt payload is capped.
 - [InstantStyle](https://arxiv.org/abs/2404.02733) - style is underdetermined and much of it cannot be described in words at all. Their fix is to route content through the text encoder and style through the image encoder. This is why the reference image is mandatory.
 - [IP-Adapter](https://arxiv.org/abs/2308.06721) - image conditioning gets its own decoupled cross-attention pathway, so the reference image does not compete with your words for attention. 22M adapter parameters match a fully fine-tuned model. This is why the image is close to free.
 - [A Neural Algorithm of Artistic Style](https://ar5iv.labs.arxiv.org/html/1508.06576) - style is formally the **correlations between** features, not the features themselves. A flat token list is precisely the part with the correlations discarded. This is why signatures are written as ratios.
 - [Verbalized Sampling](https://arxiv.org/pdf/2510.01171) - human preference data carries a measurable bias toward typical output, and training bakes it in, so models default to a house style. That house style is slop. This is why bans matter.
 - [W3C Design Tokens Format Module](https://www.designtokens.org/TR/drafts/format/) and [Style Dictionary](https://styledictionary.com/info/architecture/) - the one-spec-many-outputs pattern this borrows, already proven across a decade of production use.
 - [Anthropic on context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - "the smallest possible set of high-signal tokens".
</details>

---


## Where the files are

| File | What it is |
|---|---|
| `~/.claude/skills/design-dna/SKILL.md` | The skill. Run it with `/design-dna`. |
| `~/.claude/skills/design-dna/PROMPT.md` | The standalone prompt, same as above. |
| `~/.claude/skills/design-dna/design-dna.schema.json` | The full schema, every field explained. |
| `~/.claude/skills/design-dna/design-dna-card.html` | Source for the card at the top. Re-render any time. |
> [!NOTE] 
**How to use it.** Run your design loop. Pick the winner. Type `/design-dna` and point it at the winner. You get a new skill named after the style. From then on, that look is a command, not a memory.