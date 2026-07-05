# Blockout to art — the pipeline in detail

The single most expensive mistake in level design is committing art before the
space is proven. This reference details each stage, the metrics block that
everything is built from, how to playtest a grey box, and the handoff to the
engine skill and art team.

## Why art goes last

A blockout is minutes to change; a finished, textured, lit set-piece is days.
Layouts *always* change under playtest — a corridor is too long, a fight needs a
flank, a landmark isn't visible from the entrance. If that geometry is already
art, every fix throws away work and creates pressure to *not* fix it. Art-first
levels ship with known layout problems because nobody wants to redo the art.
So: prove the space grey, then dress it.

## Stage 1 — Blockout (whitebox)

Build the level from **primitive geometry at true scale** — boxes, planes,
cylinders, ramps. No materials beyond a flat neutral, no props, no final
lighting. A single neutral mid-grey with a subtle grid texture is ideal: it
shows scale and stops you from judging the level on looks it doesn't have yet.

You are answering three questions:

1. **Flow** — can the player move through the intended route without snagging?
   Are the loops, gates, and shortcuts where you planned?
2. **Timing & distance** — how long is the walk between beats? Are jumps and
   gaps possible and fair? Is a corridor a slog or a snappy connector?
3. **Legibility** — from each decision point, is the next objective findable by
   shape and layout alone (before any lighting/color tricks)?

Block out the **critical path first**, walk it end to end many times, then add
exploration branches and encounters. Keep everything modular and snapped to a
grid so pieces move cheaply.

## The metrics block (lock this before any geometry)

Every dimension in the level is a multiple of the player's capabilities. Define
these **first**, in engine units, and build to them. Guessing metrics is how you
get gaps that feel wrong and cover that doesn't protect.

| Metric | What it governs | Typical relationship |
|---|---|---|
| **Player height (standing)** | Ceiling clearance, door height, sightline height | The base unit; doors ~1.3–1.5× |
| **Crouch height** | Vents, low cover, crawl spaces | ~0.5–0.6× standing |
| **Eye height** | What sightlines actually reveal (camera, not feet) | Slightly below standing top |
| **Shoulder / capsule width** | Corridor and doorway minimum width | Corridors ≥ 2× so two can pass / strafe |
| **Jump height** | Max step-up, ledge height, low-cover top | Cover just below eye so you can peek |
| **Jump distance (gap)** | Platform spacing, chasm width | Design gaps at ~70–85% of max so they read as fair |
| **Reach / grab height** | Climbable ledge height, mantling | Set the climb-ledge trim to this exact height |
| **Run speed** | Travel time between beats, breather length | Distance = speed × intended seconds |
| **Weapon/threat effective range** | Arena sightline length, cover spacing | Long lanes for ranged, short for melee |

Write these into `02-DOCS/wiki/stack/level-design.md` (see the SKILL.md grounding
section) so every level in the project shares one metrics block. When a metric
is a *rule* of the game (how high the player jumps at all), that number is owned
by `game-design`; level design *consumes* it here and builds space to fit.

## Stage 2 — Greybox

Refine the blockout just enough to test *reading* and *feel*:

- **Temp neutral materials** to distinguish floor/wall/hazard/interactable by
  value, not decoration.
- **Placeholder lighting** used as a *design* tool — light the path, the
  objective, and the exit; keep non-paths dim. This is where guidance is
  authored, long before final art lighting.
- **Stand-in enemies, cover, pickups, and interactables** at real metrics so
  encounters and the reserved interact-color language can be tested.

Now the questions are: does the space *read*? Does the encounter work? Is the
pacing right? Greybox is still cheap — you are still iterating layout, not
protecting art.

## Stage 3 — Playtest the grey box

Do this early and often, on the blockout/greybox, because fixes are cheap. Full
observation protocol and telemetry live in `guidance-and-readability.md`; the
blockout-specific loop is:

1. Sit a **fresh, uncoached** player down. Say only "play". Stay silent.
2. Log every **hesitation** (readability gap), **wrong turn** (navigation gap),
   **repeated death** (telegraph/difficulty gap), and **skipped area** (reward
   or guidance gap).
3. Never answer "where do I go?" — that question is your top finding.
4. Change the grey geometry/lighting, re-test. Repeat until it plays.

Only when the greybox plays well for players you didn't coach do you unlock art.

## Stage 4 — Art pass (and the handoff)

Art *serves the proven layout*. The reserved interact-color, the light-led path,
the framed landmark, the readable silhouettes — art must **reinforce** the
guidance the greybox already established, never fight it. If the art pass makes
the level prettier but harder to read, it failed.

Hand off to the engine skill (`godot` / `unity` / `unreal`) for the tooling that
turns the layout into a shippable level:

- Nav-mesh generation and agent radius (must match the capsule width above).
- Occlusion culling / visibility and streaming volumes.
- Final lighting: lightmap/GI bakes, reflection probes, light-leak fixes.
- Collision meshes distinct from render meshes; blocking volumes replacing the
  greybox's implicit walls.
- LODs, mesh instancing, and performance budgets.

### Art-pass handoff checklist

- [ ] Layout is locked — no pending "this fight might move" notes.
- [ ] Metrics block is final; art meshes respect door/corridor/cover heights.
- [ ] Critical path, landmark, and interact-color language are decided and
      documented so art reinforces (never contradicts) them.
- [ ] Greybox lighting intent (path lit, dead-ends dim) is captured for the
      final lighting pass to honor.
- [ ] Collision/nav requirements handed to the engine skill with the capsule
      dimensions.
- [ ] A greybox reference build is kept for A/B readability comparison after art.
