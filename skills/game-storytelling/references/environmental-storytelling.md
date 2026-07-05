# Environmental & systemic storytelling — show, don't tell

Deep dive for the SKILL's "Environmental & systemic storytelling" section. The goal: deliver story *through the world and its rules* so the player assembles meaning and owns it, instead of being narrated at. Engine-agnostic; coordinate the *space* with `level-design` and the *rules* with `game-design`.

## Why show over tell

Told information is received; discovered information is *earned*. A player who infers "someone died here defending this door" from a skeleton, a spent revolver, and claw marks believes it more, and remembers it longer, than the same fact in a text box. Reserve telling (codex, narrator, log dumps) for what the world genuinely cannot carry — precise numbers, distant history, abstract rules.

**Show-don't-tell ladder** (prefer the top; fall back only when needed):

1. **Enacted** — it happens in front of the player through play (an ally sacrifices themselves in a scripted-but-interactive beat).
2. **Environmental** — the world's state implies the event (aftermath, traces, arrangement).
3. **Overheard / ambient** — barks, one-sided radio, NPCs talking to each other.
4. **Readable in-world** — item descriptions, signage, graffiti, terminals that *belong* to the world.
5. **Collectible logs** — audio logs, diaries, notes. Useful but the most "tell"-like; easy to overuse.
6. **Non-diegetic** — narrator, codex, cutscene exposition, HUD text. Last resort.

## Environmental storytelling — the technique catalog

- **Set dressing with intent.** Every prop can carry meaning: a single toy in a barracks, wedding photos in a looted home. Composition points the eye (leading lines, light, framing a key object) — coordinate with `level-design` and lighting.
- **Aftermath / the frozen moment.** Show the scene *after* the event and let the player reconstruct it: overturned table, blood trail, a meal half-eaten. The gap between "what I see" and "what happened" is the story.
- **Traces & evidence.** Bullet holes, scorch marks, footprints in dust, a barricade built from the wrong side. Physical cause-and-effect the player reads like a detective.
- **Spatial sequencing.** The *order* the player encounters space tells a story: descend from opulence into rot; a triumphant mural, then the mass grave behind it. The space is a sentence; its layout is the grammar (a `level-design` collaboration).
- **Object placement & juxtaposition.** Meaning from adjacency — a child's drawing pinned above a weapons cache; a prayer shrine facing a bricked-up window.
- **Readable descriptions.** Item and examine text that implies a life ("Dented canteen. Someone scratched three tally marks and stopped."). Small, optional, high-flavor; rewards curiosity without gating.
- **World-state change.** The strongest environmental beat: the space *changes* in response to the player or the plot (a hub burns, a garden regrows, a faction's banners replace another's). The player sees consequence written on the world.
- **Absence.** What's missing tells a story too — an empty crib, a cleared-out desk, a name scratched off a roster.

Guardrails:

- **Legibility vs. mystery.** Give enough signal that most players read the intended gist, with deeper layers for the attentive. If *no one* gets it, it's decoration, not storytelling; if it's spelled out, it's a text box.
- **Consistency = trust.** Once the world's props reliably mean things, players *read* every scene. One arbitrary/contradictory arrangement teaches them to stop looking.
- **Optional, not load-bearing.** Environmental story enriches; don't hide *required* plot solely in a missable detail. Critical beats need a guaranteed channel.

## Diegetic vs. non-diegetic delivery

| | Diegetic (in-world) | Non-diegetic (outside the fiction) |
| --- | --- | --- |
| **Examples** | signage, barks, radio, environmental change, in-world terminals | narrator VO, codex/lore menu, HUD text, tutorial popups, cutscene title cards |
| **Feel** | immersive, earned, "the world tells me" | efficient, precise, "the game tells me" |
| **Use for** | mood, place, character, consequence, most story | exact numbers, dense history, rules the world can't show, accessibility |
| **Cost of overuse** | can be missed/ambiguous | breaks immersion; reads as a lecture |

**Diegetic first.** Push information into the world; drop to non-diegetic only for what the world can't carry. Note the honest exceptions: **accessibility** (subtitles, clear objective text, difficulty-scaled hints) and **usability** (a control prompt) are worth a non-diegetic cost — never sacrifice comprehension for purity.

## Systemic & emergent storytelling — the anecdote factory

Scripted story is *authored*; systemic story is *generated* by rules + player + world state producing events no writer placed. The famous colonist who starved defending the fridge, the rival who keeps hunting you across a sandbox — nobody wrote those; the systems did.

You don't write these stories. You design the **conditions and vocabulary** that let them happen and be legible — an "anecdote factory." This is primarily a `game-design` collaboration; your narrative-design job is to make the output *readable as story*.

Design levers:

- **Legible actors** — entities with names, traits, memory, and relationships (a guard who remembers you spared him). Persistent identity turns a system event into a *character* moment.
- **Consequence that persists** — the world remembers and reflects actions (reputation, scars, changed factions), so events chain into arcs instead of resetting.
- **Readable causality** — the player can *see why* something happened (a needs/mood readout, a reaction bark, a kill-cam). An unexplained emergent event is just noise; a readable one is an anecdote.
- **Framing & capture** — surfacing tools (event log, photo mode, relationship screen, killfeed, end-of-run summary) that let the player *notice and retell* the story the systems produced. The retelling is the payoff.
- **Meaningful randomness** — variety within authored bounds (curated event pools, weighted tables) so runs differ without becoming incoherent.
- **Interacting systems** — emergence needs ≥2 systems that touch (fire + wind + wood; hunger + weather + AI). One system alone produces events, not stories.

Guardrails:

- **Coherence budget.** Pure emergence drifts into nonsense; pure authorship can't surprise. Set authored guardrails (tone, bounds, curated pools) inside which systems play.
- **Framing is half the work.** An emergent event the player never notices or can't interpret isn't a story. Invest in the surfacing/retelling tools as much as the simulation.
- **Name things.** Named actors, places, and factions convert anonymous system state into story the player cares about and repeats.

## Where this hands off

- **`level-design`** — owns the physical space, blockout, sightlines, and encounter flow that environmental beats live inside. Co-own set-dressing that carries narrative.
- **`game-design`** — owns the systems whose interaction produces emergent story; you specify what must be *legible* and *persistent* for those events to read as narrative.
- **the engine skill** (`godot`/`unity`/`unreal`) — implements world-state changes, triggers, bark systems, event logs, and the persistence that makes consequence stick.
