---
name: design-dna
description: "Use when a design has won and its look must survive: codify it into a permanent style skill with measured ratios, bans and tests that can fail, then build new pieces in that exact look. Fires on 'turn this into a skill', 'keep the same style', 'my output drifted'. NOT finding the winner (that is `design-loop`), NOT the words (that is `marketing`)."
tags: [design, style, dna, codify, skill-factory, consistency]
recommends: [design-loop, design, nextjs, marketing]
origin: external (Notion "Design DNA" doc, adapted; source names no author or licence)
---

# Design DNA - one beautiful design into a permanent skill

*A design loop finds you one beautiful thing. This turns that one thing into a skill you keep forever, so you can make more of it, in any format, without the look drifting.*

**Not only about "designs".** The subject is anything that got built: a website, a landing page, a poster, a motion graphic, a carousel, a deck. Same system, same file, same tests. The format is an output, not the subject.

## The problem this solves

Nobody wrote down **why** the winner was beautiful. Next time you ask for "the same style" you get something close, then something a bit off, then something generic. Every rule you do not write down, the model has to guess, and it does not guess randomly: it guesses the average of everything it has ever seen. That average is what people call slop. Slop is the sound of an unwritten rule.

## Two modes

| You say | Mode | What happens |
|---|---|---|
| "codify this", "turn this into a skill", here is the winner | **CAPTURE** | Run the seven steps below. Output: a new style skill folder. |
| "build X in <style>", "another one like the last", `/<slug>` | **REUSE** | Load that style's `PROMPT.md` only, build, then run its self-check before returning. |

If a `dna.json` already exists for the style named, you are in REUSE. Never re-derive a style that has a record.

## Hard rules (these are the skill)

1. **A specification that cannot fail is not a specification.** If every rule you wrote is one a bad output could still satisfy, you wrote a mood board.
2. **Compile, do not paste.** Two files, always. `dna.json` is the record, any size, and it **never** enters a prompt. `PROMPT.md` is the payload, **hard cap 2KB**, and it is the only thing that does.
3. **Always attach the reference image.** Highest-leverage move available and close to free: image conditioning runs on its own pathway, so it does not eat the attention your words are competing for.
4. **Ratios, not values.** "The headline is 96px" is nearly worthless. "The headline is 8x the body, never under 6x" is the identity.
5. **Coverage, not just colour.** The same three hex codes at 60/30/10 and at 90/8/2 are two unrelated designs.
6. **Percentages, not pixels,** in everything spatial. One spec has to drive a 1080x1350 carousel and a 1920x1080 slide with no rewrite.
7. **When output looks generic, add a ban, not a rule.** A positive instruction is one weak vote against a landslide; "never centre the hero" deletes the landslide from the options. Bans should outnumber positive style rules.
8. **One skill per style.** Never merge two identities into one spec. The average of two good designs is a bad design.
9. **Reproduce the system, never the marks.** Real logos, wordmarks, licensed photographs and proprietary typefaces go in `meta.not_copied` with a named substitute.
10. **Step 5 is not optional.** A spec that has never been used to rebuild its own source has never been tested.

## CAPTURE - the seven steps

Run `PROMPT.md` as written. It is the operative artefact and it is self-contained; this section is the map, not a second copy of it.

| Step | Name | Non-negotiable output |
|---|---|---|
| 1 | **Observe** | Flat inventory of literal measurements. Sampled hexes, coverage estimates, type counts, largest-to-smallest ratio, margins as percentages, texture, and **what is absent**. No judgements: interpreting here is how you end up specifying a design that is not the one in front of you. |
| 2 | **Debate** | Loop A argues exhaustive, Loop B argues nine moves and a wall of refusals, then adjudicate each property with one question: *if I changed this value, would it stop looking like the reference?* Yes is load-bearing, no is trivia, and trivia dilutes attention. Resolve it by splitting documents, not by compromising. |
| 3 | **Codify** | `dna.json` against `design-dna.schema.json`. Descriptive colour names ("dusty plum", never "accent-500": image and video models cannot read token names). Every family gets a fallback. |
| 4 | **Tests that can fail** | 8 to 12, binary and measurable, each marked auto or human. |
| 5 | **Reconstruct and diff** | Close the reference. Rebuild it from `dna.json` alone. Put them side by side and list **every** difference: each one is a field the spec forgot. Fold them in, record them in `reconstruction.gaps_found`, go again. Expect two or three passes, and expect the gaps to be things you were sure were obvious. |
| 6 | **Emit the skill** | The folder below. |
| 7 | **Declare uncertainty** | Every value inferred rather than measured, and every rule under 70% confidence, into `meta.confidence_notes`. That is where the style drifts first. |

### What gets emitted

    ~/.claude/skills/<slug>/
      SKILL.md          how to use this style, and when not to
      PROMPT.md         the 2KB payload. THIS is what enters a context window
      dna.json          the full record. NEVER pasted into a prompt
      design-dna.schema.json -> validated against the parent copy
      reference/        the original, kept forever
      example/          one worked output, the canonical proof
      scripts/check.py  the auto tests, exits non-zero on failure

Scaffold from `templates/` and validate before you claim it works:

    python3 ~/.claude/skills/design-dna/scripts/emit.py <slug>            # scaffold + validate
    python3 ~/.claude/skills/<slug>/scripts/check.py <output-file>        # run the auto tests

### PROMPT.md ordering is fixed

Attention is strongest at the two ends and weakest in the middle, so the order is a mechanism, not a style choice:

1. The reference image, attached and named first
2. `soul.one_line`
3. The weird move, alone, unmissable
4. The 3-9 signature moves, as ratios
5. The bans, as absolutes
6. Palette and type: roles and coverage only, never a full ramp
7. Archetype names and when to use each
8. The self-check, last

Nothing else. If it does not change what the output looks like from three metres away, it belongs in `dna.json`. To add a tenth signature you must delete one.

Last line of every `PROMPT.md`, verbatim:

> Before returning any output, run every test in the self-check. Name each test and its result. If any fails, repair the output and run them again. Never return output with a failing test and a note explaining it away.

## REUSE - building with a captured style

1. Load **only** that style's `PROMPT.md`. Attach `reference/`. Do not read `dna.json` into context; read it only to answer a specific measured question or to regenerate the payload.
2. Pick an archetype by name before writing anything. Structure first: unnamed layouts are why piece 8 does not sit beside piece 1 as a set.
3. Build. For web, hand the build to `../nextjs/SKILL.md` and the words to `../marketing/SKILL.md`; the identity stays here.
4. Run the self-check, name each test and its result, repair and re-run on any failure.
5. If output drifts, do not add a rule. Consult the table below.

## When it goes wrong

| What you see | Cause | Fix |
|---|---|---|
| Matches every value, still looks generic | Signature moves missing, or too many | Cut to 3-9, rewrite each as a ratio |
| Drifts back to the stock AI look | Not enough bans | Bans should outnumber positive style rules |
| Piece 1 and piece 8 do not match | No named layouts | Add archetypes |
| The accent reads as a theme, not an accent | No coverage percentages | Add them |
| Works on a slide, breaks on a carousel | Pixel values in the spacing | Convert to percentages |
| Obeys some rules, ignores others, differently each run | Payload over the cap | Cut to 2KB |
| Your best rule keeps getting ignored | It is buried in the middle | Move it to the top or the bottom |
| Fine, but forgettable | No weird move | Find the one break in the system |
| Spec feels complete, output is wrong | You skipped Step 5 | Rebuild the original from the spec. Compare. |

## Styles captured so far

| Style | Reads as | Weird move |
|---|---|---|
| `../cold-press/SKILL.md` | newsprint editorial, serif at 8x, one vermilion | section numeral clipped by the right edge |
| `../night-shift/SKILL.md` | near-black instrument panel, one phosphor green | status ribbon severed mid-word by the right edge |
| `../soft-optics/SKILL.md` | warm paper, lowercase display at 6x, one olive | display line crossing a tinted plate's bottom edge |

Each is a finished skill: reference, `dna.json`, a capped payload, a worked proof, and tests that exit non-zero. Never merge two of them: the average of two good designs is a bad design.

## Hand-offs

- **No winner yet, no reference to measure** -> `../design-loop/SKILL.md` first: it takes a real reference and converges on a piece that beats it. Come back with the winner. Capturing an average of several candidates produces the average, which is the thing you are trying to escape.
- **The words on the page** -> `../marketing/SKILL.md`. `voice` in `dna.json` constrains them; it does not write them.
- **The build** -> `../nextjs/SKILL.md` (App Router, React 19) or `../react/SKILL.md` (Vite SPA).
- **SDD gate.** Capturing a style writes a skill, not product code, so it needs no spec. The moment its output becomes a new feature or a non-trivial behaviour change in a real app, `../specify/SKILL.md` runs first.

## Files

| File | What it is |
|---|---|
| `PROMPT.md` | The standalone prompt. Paste anywhere, attach the design, done. |
| `design-dna.schema.json` | Every field of `dna.json`, explained. |
| `scripts/emit.py` | Scaffolds and validates an emitted style skill. |
| `templates/` | `SKILL.md`, `PROMPT.md` and `check.py` skeletons for the emitted skill. |
| `references/method.md` | The full method and the research each decision traces to. Read once, not per run. |

**Why any of this works** is not opinion: lost-in-the-middle recovery, instruction-compliance decay under constraint count, style being formally the correlation between features rather than the features, and decoupled image cross-attention. The citations are in `references/method.md`.
