---
name: game-storytelling
description: "Use when designing a game's STORY as an interactive system: premise, theme and narrative pillars; branching narrative and meaningful choice; dialogue trees with state and flags; quests, objectives and fail states; worldbuilding; environmental and systemic storytelling; and keeping story in harmony with play (avoiding ludonarrative dissonance). Engine-agnostic — it designs the narrative graph, variables and beats, then hands the wiring to the engine skill. Triggers: 'write my game's story/premise', 'branching narrative', 'dialogue system/tree', 'quest structure', 'worldbuilding', 'meaningful choices', 'illusion of choice', 'Ink/Yarn Spinner/Twine/articy narrative', 'story keeps fighting the gameplay'. NOT core mechanics, systems or balance (that's game-design); NOT spatial/level layout or encounter placement (that's level-design); NOT the actual dialogue-node code, save format or plugin wiring inside an engine (that's godot/unity/unreal)."
tags: [game, narrative, story, dialogue, quest, branching, worldbuilding]
recommends: [game-design, level-design]
profiles: [full]
origin: risco
---

# Game Storytelling — Narrative Design (engine-agnostic)

*Design the story as a system the player operates, not a script they watch. This skill owns the narrative graph — premise, pillars, branches, choices, dialogue state, quests, and the storytelling embedded in the world — and hands the runtime wiring to the engine skill.*

You produce **design artifacts**: a premise/theme/pillars doc, a branch topology, a state/flag table, dialogue in a portable format (Ink/Yarn/Twee/articy), quest specs, and environmental beats. You do **not** write engine node code, save-serialization, or plugin glue — that is `godot`/`unity`/`unreal`. A mechanic question (what the player *does*, economy, balance) is `game-design`; where things sit in space is `level-design`.

## Fires on / When NOT

Use when the request is about: a game's story or premise; branching or non-linear narrative; a dialogue system, tree, or conversation logic; quests, objectives, or mission structure; worldbuilding/lore for a game; meaningful choice vs. the illusion of choice; environmental or systemic storytelling; or story that "fights" the gameplay (ludonarrative dissonance).

Do NOT use (delegate or decline):

- Core loop, verbs, systems, progression, economy, difficulty, or balance → **game-design**.
- Spatial layout, encounter placement, sightlines, blockout, pacing *of a space* → **level-design**.
- Implementing the dialogue runner, save/serialize of story state, or wiring Ink/Yarn/articy into a build → the engine skill (**godot/unity/unreal**).
- Prose fiction, a screenplay, or a novel with no interactive/branching structure → general writing.
- Marketing copy, store page, or trailer script → **marketing**.

Story is a **system in service of play**. When you catch yourself designing a great scene the mechanics can't honor, reconcile it (see Ludonarrative harmony) rather than ship the dissonance.

## Premise, theme, and pillars (do this first)

Nail these before a single branch or line of dialogue. They are the constraint that keeps a branching story from sprawling into incoherence.

1. **Premise** — one sentence: *who*, in *what world*, wants *what*, against *what*. If it doesn't fit in a sentence, the story isn't decided yet.
2. **Theme** — the question the game argues about (loyalty vs. survival, cost of power). Theme is the filter for every choice; a choice that doesn't press on it is decoration.
3. **Narrative pillars** — 3–5 non-negotiables the story must always deliver (e.g. "every companion can die," "the player is never the chosen one"). Pillars kill scope arguments later.
4. **Tone & POV** — register (grim, wry, mythic), narrative distance (silent, voiced, ensemble), tense/person for text.
5. **Story-in-service-of-play** — write pillars so they are *expressed through the verbs the player already has*. If the theme is "trust is earned," the game needs a trust mechanic, not a paragraph asserting it.

### Ludonarrative harmony (avoid dissonance)

Dissonance is when the story says one thing and the mechanics say the opposite (the "caring family man" who murders a thousand henchmen). Diagnose and fix, in order:

- **Verb audit.** List what the player *does* most. Does the dominant verb match the theme and the protagonist's values? If the loop is "kill," a pacifist narrative is dissonant.
- **Reward audit.** What does the game *reward*? Rewards are the loudest narrative voice — if you reward hoarding but preach generosity, players believe the reward.
- **Fix by moving the cheaper piece.** Usually re-frame the narrative to match the mechanic rather than re-engineering the mechanic — but flag to **game-design** when only a mechanic change resolves it.
- **Failure & death.** Reconcile the fiction of losing (respawn, checkpoint, permadeath) with the story; unexplained respawns are the most common silent dissonance.

## Narrative structures for interactivity

Pick a topology deliberately; most games mix them. Full trade-offs, diagrams, and containment math → `references/branching-and-state.md`.

| Structure | Shape | Player agency | Author cost | Use when |
| --- | --- | --- | --- | --- |
| **Linear** | one path, story beats gated by progress | low (pacing only) | low | story-driven, cinematic, tight authorship |
| **Branching (tree)** | choices split, rarely rejoin | high, expensive | explodes fast | short, choice-showcase, replay-driven |
| **Hub-and-spoke** | central hub, self-contained spokes, return | medium (order + selection) | moderate, scales | quests/missions, RPGs, episodic |
| **Foldback / string-of-pearls** | branches diverge then **reconverge** at beats | feels high, stays bounded | moderate | the workhorse for long branching stories |
| **Environmental** | story embedded in space & objects, player-assembled | interpretive | front-loaded | immersive sims, exploration, "show don't tell" |
| **Systemic / emergent** | story generated by rules + player, not scripted | very high, uncurated | design not writing | sims, roguelikes, sandbox; the "anecdote factory" |

The pragmatic default for a story-heavy game is **foldback**: let choices matter locally, then reconverge on load-bearing beats so you author a bounded number of scenes. Pure trees are a trap (see below).

## Branching & choice

A choice is **meaningful** only if the player can (a) form an intent, (b) foresee a plausible consequence, and (c) later *see the consequence land*. Missing any leg makes it noise. Meaningful choice vs. the deliberate, defensible **illusion of choice**, plus state modeling and the combinatorial-explosion fix → `references/branching-and-state.md`.

- **Meaningful choice** changes state that the game later reads back to the player (a door, a death, a line, an ending). Track it with a **flag/variable**, not a duplicated scene.
- **Illusion of choice** (options that reconverge to the same outcome) is a legitimate tool for *expression and tone* — but never sell a fake choice as consequential; players feel the betrayal and stop trusting every future choice.
- **State & flags** are the spine. Model story state as named variables (`met_the_witch`, `reputation >= 3`, `betrayed_ally`). Gate content on state; don't copy-paste branches.
- **The combinatorial-explosion trap.** N independent binary choices imply 2^N futures — unauthorable past a handful. Contain it with:
  - **Reconvergence (bottlenecks)** — funnel branches back to shared beats; the space between bottlenecks stays small.
  - **Gates** — require a flag/level/item to open content, pruning the live branch set.
  - **State over structure** — one scene that reads flags and swaps lines beats ten near-duplicate scenes.
  - **Locality** — most choices affect only the current scene ("weave"); reserve the few loud choices for global state.

## Dialogue systems

Every dialogue tool reduces to the same four primitives — design against these, then let the engine skill wire the chosen tool. Deep tool comparison, a "pick one" guide, and the same conversation shown in Ink / Yarn / Twee → `references/dialogue-tools.md`.

- **Node** — a unit of content (a line, a passage, a knot) with an id you can jump to.
- **Condition** — boolean over story state that gates a node, option, or line (`if hasKey`, `if trust > 2`).
- **Variable** — the story state read/written by nodes (flags, counters, enums, inventory).
- **Effect** — a side effect a node fires (set a flag, give an item, start a quest, emit an engine event).

Tools (pointers — do not author engine glue here):

- **Ink** (inkle) — writer-first scripting language: knots/stitches, diverts `->`, once-only `*` / sticky `+` choices, gathers, weave, `VAR`, `LIST`, tunnels, threads, tags. Great for prose-heavy branching; runs via `inkjs` or engine integrations.
- **Yarn Spinner** (v3.x, current) — node-based, Twine-friendly: `<<set $var to x>>`, `<<if>>`, `<<jump>>`, commands, functions, markup. First-class Unity; Godot (C# beta, GDScript alpha); Unreal in progress.
- **Twine** — visual node editor, publishes standalone HTML; scripting depends on the **story format** (Harlowe, SugarCube, Snowman, Chapbook). Twee is its text form — a good neutral interchange.
- **articy:draft X** — heavyweight visual narrative DB (flow/dialogue fragments, hubs, conditions, instructions, entities); free Unity/Unreal importers and a **Generic Engine Export** (JSON) for anything else.

Author in one of these formats and keep dialogue **portable**; engine binding is a separate step owned by the engine skill.

## Quests & objectives

A quest is a small state machine plus presentation. Spec each quest with:

- **Trigger** — what activates it (talk to X, enter zone, flag set).
- **Objective(s)** — ordered or parallel steps; each a condition over world/story state.
- **States** — `unavailable → available → active → (step states) → complete / failed`, modeled explicitly. Ambiguous quest state is the #1 quest bug.
- **Tracking & presentation** — what the player sees (journal, marker, count). Design the *reveal*: don't show a marker for a step the player shouldn't know yet.
- **Rewards & consequences** — the flags/items/state the quest writes on completion *and* on failure.
- **Fail states** — decide per quest: can it fail, and is failure a dead-end, a branch, or lost content? **Failing forward** (failure opens a different path) beats a hard fail; **soft-locking the game** is a defect — always leave an escape.
- **Nesting & dependencies** — main/side/hidden; prerequisite flags; mutual exclusivity (faction A locks B). Track dependencies as gates, per the branching rules above.

## Environmental & systemic storytelling (show, don't tell)

Deliver story *through the world* so the player assembles it and feels ownership. Technique catalog, diegetic-vs-non-diegetic delivery, and the "anecdote factory" → `references/environmental-storytelling.md`.

- **Show, don't tell.** Prefer a scene the player reads (a skeleton clutching a locked door) over a paragraph narrating it. Text-dumps are the fallback, not the default.
- **Environmental storytelling** — set dressing, aftermath/traces, spatial sequencing, object placement, and readable item descriptions that imply events without narrating them. Coordinate with **level-design** for the space itself.
- **Systemic / emergent storytelling** — let rules + player generate stories you didn't script ("that time my colonist starved defending the fridge"). You design the *conditions and vocabulary* for stories, not the stories — a **game-design** collaboration.
- **Diegetic first.** Prefer in-world delivery (signage, barks, world change) over HUD/narrator; reserve non-diegetic (menus, codex, narrator) for what the world genuinely can't carry.

## Delivery: pacing, VO, localization-readiness

- **Pace the text.** Match line length to the moment; long paragraphs in combat go unread. Chunk to the display (one box-screen), respect reading speed, never block play with unskippable text.
- **VO considerations** *(design-side, not recording — that's audio/engine)* — write for the ear (contractions, short clauses); budget line counts early (VO is expensive and near-frozen once recorded); keep a **stable line ID** on every spoken line; don't splice recorded fragments across variables (gender/number/name concatenation breaks in most languages).
- **Localization-readiness** *(so the loc pipeline can do its job)* — externalize all player-facing text to string tables keyed by stable id; **never concatenate** sentences or embed grammar in code (gender/plural/word-order differ per language — use full templated strings with ICU-style placeholders); allow +30–40% text expansion; keep variables as named tokens (`{playerName}`), not positional; leave translator notes per line.

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "I'll just branch it, players love choices" | Pure trees explode (2^N). Use foldback + gates; reconverge on beats. |
| "This choice feels huge" (but nothing reads it back) | If no later node reads the flag, the choice is noise. Show the consequence or cut it. |
| "Both options lead to the same scene, that's fine" | Only if it's expression, not stakes. Never sell a fake choice as consequential. |
| "The story explains why he's a mass murderer" | Words don't beat verbs. Fix the ludonarrative dissonance, don't narrate around it. |
| "Add an audio log to explain the backstory" | Text-dump is the fallback. Try to *show* it environmentally first. |
| "We'll localize later, just hardcode the strings" | Concatenation and hardcoded text break loc. Externalize to keyed string tables now. |
| "The quest can't be failed, simpler that way" | Sometimes; but soft-locking the game on a missed step is a defect — leave an escape. |
| "Let me wire this Ink file into Unity real quick" | Not this skill. Author portable narrative; hand wiring to the engine skill. |

## Related skills

- **game-design** — the verbs, systems, economy, and balance the story must serve; call it when resolving dissonance needs a *mechanic* change, or when designing systemic/emergent story conditions.
- **level-design** — the spatial layout and encounter flow environmental storytelling lives inside; co-own set-dressing narrative.
- **godot / unity / unreal** — the engine that wires the dialogue runner, quest state, save/serialize, and Ink/Yarn/articy plugins. Author portable; they implement.
- **marketing** — store page, premise pitch, trailer copy (external-facing, not in-game narrative).

## Checklist

- [ ] Premise (one sentence), theme, and 3–5 narrative pillars are written and agreed; every pillar is expressible through an existing player verb (no assert-only themes).
- [ ] Verb + reward audit done; any ludonarrative dissonance is fixed or escalated to game-design.
- [ ] A topology is chosen deliberately (default: foldback), not accidental tree sprawl; combinatorial explosion is contained (reconvergence + gates + locality) so the branch count is authorable.
- [ ] Story state is modeled as named variables/flags; content gates on state, not duplicated scenes.
- [ ] Every "meaningful" choice writes a flag some later node reads back to the player; no fake choice is sold as consequential.
- [ ] Dialogue authored in a portable format (Ink/Yarn/Twee/articy); engine wiring left to the engine skill.
- [ ] Each quest has explicit states, tracking, rewards/consequences, and a defined fail behavior (no silent soft-locks).
- [ ] Environmental/diegetic delivery preferred over text-dumps and non-diegetic narration where the world can carry it.
- [ ] All player-facing text externalized to keyed string tables; no concatenation; variables are named tokens; +30–40% expansion allowed.
- [ ] VO lines have stable IDs, are written for the ear, and the script is locked before recording is proposed.

## References

- `references/branching-and-state.md` — topologies + diagrams, meaningful vs. illusory choice, state modeling, and the combinatorial-explosion containment kit.
- `references/dialogue-tools.md` — Ink/Yarn/Twine/articy compared, the four primitives, a "pick one" guide, and the same conversation in three formats.
- `references/environmental-storytelling.md` — show-don't-tell catalog, diegetic vs. non-diegetic delivery, systemic/emergent storytelling and the anecdote factory.
