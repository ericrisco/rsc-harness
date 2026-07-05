---
name: level-design
description: "Use when designing a game level, map, arena, or encounter — laying out a blockout/greybox, fixing pacing that drags or spikes, guiding players without hand-holding, placing secrets and rewards, or diagnosing a level that plays as boring, confusing, or where players get lost or stuck. Engine-agnostic craft: the blockout->greybox->playtest->art pipeline, sightlines and landmarks, tension/release rhythm, the introduce->develop->twist->combine encounter progression, readability via light/color/composition, and traversal heatmaps. Triggers: 'design this level', 'my level is boring/confusing', 'players keep getting lost', 'how do I pace this', 'blockout', 'greybox', 'encounter design', 'where do I put the secret'. NOT systemic mechanics or economy tuning (that's game-design), NOT narrative or story beats (that's game-storytelling), and NOT engine-specific level tooling — nav meshes, occlusion, tilemap editors, lightmap baking (that's the godot/unity/unreal skill)."
tags: [level-design, blockout, pacing, encounter, playtest]
recommends: [game-design, godot, unity, unreal]
profiles: [full]
origin: risco
---

# Level design — space that plays before it's pretty

*Shape the space, the rhythm, and the encounters so the player always knows where to go, never gets bored, and feels smart for exploring. Prove it in grey boxes; add art last.*

This skill owns the **craft of physical space and its play**: how a level is laid out, how it reads, how its intensity rises and falls, how encounters teach, and where reward hides. It is **engine-agnostic** — every technique here is validated in a blockout, then handed to an engine skill for the actual tooling (nav meshes, occlusion, lightmaps, tilemaps). It does not design the mechanics the level exercises (that's the systemic layer) or write the story it tells.

## When to use / When NOT to use

**Use when:** blocking out a new level/map/arena; a level playtests as boring, confusing, or too hard/easy; players get lost or stuck; you need to pace a level, space encounters, or add breathers; you're guiding players without arrows/waypoints; placing secrets, rewards, or shortcuts; teaching a mechanic through the space itself.

**Do NOT use for:**

- **Systemic / mechanic design** — the verbs, rules, economy, and numbers the player brings *into* the level (jump height as a rule, weapon balance, loot tables, progression systems). That's `game-design`. This skill *exercises* those verbs in space; it doesn't invent or tune them.
- **Narrative, quests, dialogue, environmental story beats** — what the space *says*. That's `game-storytelling`. Level design places the beat; storytelling writes it.
- **Engine-specific level tooling** — nav-mesh baking, occlusion culling, terrain/tilemap/ProBuilder editors, lightmap/GI bakes, streaming volumes, collision setup. Defer to `godot` / `unity` / `unreal`. This skill decides *what* the space must do; the engine skill implements *how*.

## The craft laws (non-negotiable)

1. **Art last.** Never model or texture a space you haven't proven fun in blockout. Art-first means reworking expensive assets when the layout inevitably changes.
2. **Metrics before geometry.** Lock the player's dimensions (height, jump, reach, cover) first; build everything as multiples of them. → `references/blockout-to-art.md`
3. **The player always knows where to go, never how it ends.** Guide the critical path; leave exploration to earn its own reward. Lostness is a readability bug, not player error.
4. **Watch, don't tell.** A level is only as good as it plays for someone you didn't coach. Every claim ("this is obvious", "the fight is fun") is a hypothesis until a fresh player validates it.
5. **Rhythm, not a flat line.** Intensity must rise and fall. Sustained peak = fatigue; sustained calm = boredom. Design the graph, not just the rooms.
6. **Teach through space, not text.** Introduce a threat where it's safe to learn it, before it can kill.

## The pipeline: blockout -> greybox -> playtest -> art (never art-first)

| Stage | You build | You answer | Gate to next |
|---|---|---|---|
| **Blockout** | Primitive geometry only (boxes/planes at true metrics). No materials, no props. | Does the space flow? Are timings/distances right? Can I find my way? | Layout & traversal feel right. |
| **Greybox** | Blockout + temp neutral materials, placeholder lighting, stand-in enemies/interactables. | Does it *read*? Does the fight/encounter work? Is pacing right? | Encounters and readability hold up in playtest. |
| **Playtest** | Nothing — you watch fresh players. | Where do they hesitate, get lost, die, skip? | Fixes are cheap because it's still grey. |
| **Art pass** | Meshes, materials, VFX, final lighting, audio — *serving* the proven layout. | Does art reinforce the guidance the greybox already established? | Ship. |

Iterate blockout↔playtest many times before art. Changing a grey box is minutes; changing a finished art set-piece is days. Full stage detail, the metrics block, and the art-pass handoff checklist → `references/blockout-to-art.md`.

## Spatial composition — leading the eye

- **Sightlines are your steering wheel.** Control what's visible from each point: frame the objective in a doorway/arch, block distracting views, open a reveal at the moment of a decision.
- **Landmarks (the "weenie").** One large, distinct, distant silhouette per area that the player orients toward (tower, spire, mountain) — Disney's term for the visual magnet that pulls you forward. Self-locating beats a minimap.
- **Lead the eye** with converging lines (rails, beams), framing (foreground arches), contrast (a bright end to a dark corridor), and motion. The eye goes to the brightest, highest-contrast, most-different thing — put that on the path you want taken.
- **Silhouette readability.** Enemies, interactables, and hazards must read by shape alone at a glance. Two things sharing a silhouette is an unintended trap.
- **Golden path vs exploration.** The **critical path** is the always-legible guaranteed route to the objective; **exploration** is optional branches and loops off it. Prefer loops that return the player forward (avoid dead-end backtracking); breadcrumb side routes with a visible reward.

Framing, contrast, and layout topologies (loops, hubs, gates) → `references/guidance-and-readability.md`.

## Pacing & rhythm — tension and release

Design the **intensity graph** for the whole level, not room by room. A good level is a sawtooth trending upward: each peak (combat, platforming gauntlet, chase) followed by a valley — a **safe room / breather** with no threat, low stimulus, often a save/restock.

- **Space encounters in time and distance, and *vary* both** — three identical-length fights back to back feel like one long slog.
- **Breathers earn the next peak.** The calm between (Halo's cadence is often described as "thirty seconds of fun" on repeat) is what makes the fun read as fun. Use it to let adrenaline drop, reward observation, and telegraph the next escalation.
- **Difficulty within the level** trends up but resets at checkpoints — re-enter competent, then ramp. End on the hardest, most spectacular test, not a whimper.
- **Contrast the modes** (fast↔slow, loud↔quiet, open↔tight, combat↔traversal↔puzzle). Monotony of *any* mode reads as boredom even if each moment is individually good.

Intensity-graph template, breather patterns, and difficulty-curve worked example → `references/pacing-and-encounters.md`.

## Encounter design — introduce, develop, twist, combine

The four-beat progression teaches a mechanic/threat through space (the pattern behind Portal, Half-Life 2, and Mario level craft):

1. **Introduce** — meet the new element somewhere it *can't* hurt you. A single turret across a safe gap; one platform of the new hazard. Learn it risk-free.
2. **Develop** — use it for real, low stakes. The turret now guards a corridor you must cross.
3. **Twist** — recontextualize it. Two turrets flanking; the turret is *behind* glass; you must use the turret against enemies. The rule bends.
4. **Combine** — the mastery test: the new element plus everything learned earlier, at full intensity.

Design rules for the **arena** (the shape a fight happens in):

- **Match sightline length to weapon/threat range** — long lanes favor ranged, tight rooms favor melee/shotgun. The geometry *is* the difficulty knob.
- **Cover rhythm, flanks, verticality.** Space cover so the player advances in beats; give at least one flank so a fight isn't a static peek-war; use height for pressure and reward (the Doom-2016 arena: multi-tier, resources placed to pull the player *through* the space, not hunker).
- **Chokepoints need release valves** — pair a choke with an exit or a way to break the standoff, or the fight stalls.
- **An encounter = enemy composition × space × objective × resources.** Change any one for a "new" encounter without new assets.

Encounter template, arena patterns, and a full introduce→develop→twist→combine example → `references/pacing-and-encounters.md`.

## Guidance & readability — direct without hand-holding

Guide with the environment so you never need a floating arrow:

- **Light leads.** Players move toward light (the moth effect) and higher value-contrast. Light the path, objective, and exit; keep dead-ends dim. Placeholder lighting is a greybox *design* tool, not a final-art afterthought.
- **Reserve one accent color for "you can interact / go here"** (Mirror's Edge runner red, Dishonored's usable glint) and **never** use it decoratively. Consistency is the whole point; break it once and you've lied to the player.
- **Composition** — framing, leading lines, and negative space point the eye like a photographer's shot. The critical path should be the most-framed, highest-contrast route from any decision point.
- **Affordances & signifiers** (Norman/Gibson): a ledge that looks grabbable must be grabbable. Establish the visual language early and hold it — if a trim means "climb here", it appears *only* where you can climb. Inconsistent affordances are the #1 cause of "I didn't know I could do that."
- **Deny wrong turns visually** (subtle dead-ends, unlit gaps, a "not-a-path" material) rather than with invisible collision.

Full catalog — lighting/color/composition, the affordance language, the "critical-path readability" self-test → `references/guidance-and-readability.md`.

## Metrics & playtesting — where players get lost and stuck

You cannot see your own level fresh. **Observe, don't coach:**

- **Watch a first-timer play, silent.** Note every hesitation (readability gap), wrong turn (navigation gap), repeated death (telegraph/difficulty gap), and skipped content (reward-placement gap). Do **not** answer "where do I go?" — that question *is* the finding.
- **Traversal telemetry** turns anecdote into pattern: **position heatmaps** (cold zones players never enter = wasted level), **death heatmaps** (clusters = unfair/unreadable threats), **path traces** (golden path or lost?), **dwell time** at forks (long dwell = unclear guidance), and **look/aim heatmaps** (did they even see the landmark?).
- **Read the map:** a cold region means the space doesn't pull the player there — re-light, add a landmark/reward, or cut it. A death cluster means fix the telegraph or arena, not the player. A branch nobody takes needs a visible reward at its mouth.

Playtest protocol, question scripts, and turning heatmaps into fixes → `references/guidance-and-readability.md`.

## Reward & secret placement, risk vs reward

- **Reward the wandering eye.** Put secrets where a *curious* player naturally looks — behind the waterfall, up the ledge you already lit and framed, down the branch you breadcrumbed. Reward observation, not pixel-hunting; a secret nobody can reasonably find just frustrates.
- **Breadcrumb the secret** with a glint, an out-of-place object, a suspicious seam, an "impossible" bit of geometry visible from the path. The player should feel *clever* — which means the game showed them the thread first.
- **Risk vs reward.** Gate the best optional reward behind the biggest optional risk or detour. Keep the *critical path* rewarding on its own so risk-averse players aren't punished; put the *extra* behind the extra effort, both visible before committing.
- **Never hide mandatory progression like a secret** — a required key/door disguised as optional is a stuck-player generator. Secrets are optional by definition.
- **Vary reward types**: power/upgrade, resources, lore/collectible, a **shortcut unlock** (best long-term — reshapes the level), and pure spectacle.

Reward taxonomy, secret-signposting, and risk/reward tuning → `references/guidance-and-readability.md`.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality / Fix |
|---|---|
| "Let's make it look good first, then tune the layout." | Art-first burns days reworking assets when the layout changes. Blockout, playtest, *then* art. |
| "It's obvious where to go." | Obvious to *you*, the author. Fresh players get lost. Watch one before you believe it. |
| "I'll just add a waypoint arrow / big text prompt." | That's a patch over a readability failure. Fix it with light, framing, and a landmark first. |
| "The whole level is intense — it's exciting!" | Sustained peak = fatigue and it all flattens into noise. Add breathers so the peaks read. |
| "Backtracking reuses the space for free." | Repeated dead-end backtracking reads as padding. Use loops that return the player forward. |
| "Players will figure the new mechanic out." | Not while it's killing them. Introduce it where it's safe, then develop/twist/combine. |
| "Yellow paint everywhere so they see the ledges." | Only if yellow means *exactly* climbable and appears nowhere else. Inconsistent affordances lie. |
| "The secret's hidden well — no one will find it." | A secret with no breadcrumb is just frustration. Show the thread; reward the curious eye. |
| "The gap/cover/door width feels about right." | Guessing metrics breaks traversal later. Set the metrics block first; build to multiples. |

## Quick reference

| Lever | Default | Where |
|---|---|---|
| Build order | blockout → greybox → playtest → art (art last) | `references/blockout-to-art.md` |
| Metrics block | lock player height/jump/reach/cover first; build to multiples | `references/blockout-to-art.md` |
| Navigation | one dominant landmark per area; legible critical path + breadcrumbed loops | `references/guidance-and-readability.md` |
| Pacing | sawtooth: peak → breather (safe room) → higher peak | `references/pacing-and-encounters.md` |
| Encounter teaching | introduce → develop → twist → combine | `references/pacing-and-encounters.md` |
| Arena shape | sightline length matched to threat range; flanks + verticality | `references/pacing-and-encounters.md` |
| Guidance | light leads; one reserved interact color; consistent affordances | `references/guidance-and-readability.md` |
| Playtest | watch silent; log hesitation/lost/death/skip; read heatmaps | `references/guidance-and-readability.md` |
| Secrets / risk | breadcrumb them; best optional reward behind biggest optional risk | `references/guidance-and-readability.md` |

## Related skills

- **`game-design`** — the systemic layer: mechanics, verbs, economy, progression, difficulty *systems*. Level design exercises those verbs in space; if the request is about the rules themselves, route there.
- **`game-storytelling`** — narrative, quests, dialogue, and the meaning of environmental beats. Level design places the beat; storytelling authors it.
- **`godot` / `unity` / `unreal`** — the engine tooling that *implements* a proven layout: nav meshes, occlusion, terrain/tilemap editors, lightmap/GI bakes, streaming, collision. Hand off here after the blockout plays well.
- **`harness`** — the `02-DOCS` Karpathy-wiki this skill records level conventions into.
- **References:** `references/blockout-to-art.md` (pipeline, metrics block, art handoff, playtesting the blockout); `references/pacing-and-encounters.md` (intensity graph, encounter template, arena patterns, difficulty curve); `references/guidance-and-readability.md` (light/color/composition, affordances, playtest protocol, telemetry, reward & secrets).

## Checklist

- [ ] Player metrics block locked (height, jump, reach, cover, door/corridor widths) before geometry.
- [ ] Layout proven in blockout/greybox — never modeled or textured before it plays well.
- [ ] Critical path is legible from every decision point; a fresh player can find the objective without being told.
- [ ] One dominant landmark orients each area; light and framing lead the eye along the intended path.
- [ ] Intensity graph is a sawtooth (peaks + breathers), not a flat line; encounters vary in length and spacing.
- [ ] At least one safe room / breather follows each major peak.
- [ ] Every new mechanic/threat is introduced safely, then developed, twisted, and combined.
- [ ] Arenas match sightline length to threat range and offer a flank/verticality option, not a static peek-war.
- [ ] One reserved accent color for interactables/path, used consistently and never decoratively; affordances hold everywhere.
- [ ] Played by a fresh, uncoached tester (and/or telemetry): hesitations/lost/deaths/skips logged, no dead cold-zones, no unfair death clusters, no ignored branches.
- [ ] Secrets are breadcrumbed and reward observation; no mandatory progression hidden as a secret; best optional reward sits behind the biggest optional risk.

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) Karpathy wiki), record the level-design conventions there and index them from the root `CLAUDE.md`, so the next agent inherits them instead of re-deriving:

1. **Find the article** `02-DOCS/wiki/stack/level-design.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map).
2. **If missing or stale**, create/update it with the project's real conventions — the metrics block, the reserved interact-color, the pacing/breather cadence, the encounter-teaching pattern, and any per-level intensity graphs — then index it.
3. **Read it first on every use** and stay consistent; when a convention changes, update the article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Conventions are *recorded, not gated* — never block the design work on this.
