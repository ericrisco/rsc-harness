# Pacing & encounters — rhythm, arenas, and teaching through space

A level is a piece of music, not a list of rooms. This reference covers the
intensity graph, the breather, the difficulty curve, the encounter template, the
introduce→develop→twist→combine teaching pattern, and arena-shape design.

## The intensity graph

Plot intended intensity (danger + cognitive load + stimulus) against time for
the whole level. The target shape is a **sawtooth trending upward**: a peak
(combat, chase, platforming gauntlet, tense stealth), a sharp drop to a valley
(a breather), then a higher peak. Overall the line climbs, ending on the level's
hardest, most spectacular moment.

```text
intensity
  ^                                        ___/\   <- climax (hardest, last)
  |            ___/\           ___/\      /
  |     __/\  /     \    __/\  /     \___/
  |  __/    \/       \__/    \/            <- breathers (valleys)
  +---------------------------------------------> time
     intro  peak  rest  peak  rest  build  climax
```

Two failure shapes to avoid:

- **Flat-high** — sustained maximum intensity. The player fatigues and the peaks
  stop reading as peaks; it flattens into undifferentiated noise. This is the
  most common "my level is exhausting / boring despite lots of action" cause.
- **Flat-low** — long stretches with no tension or stimulus. Reads as padding
  and boredom even if each individual moment is competent.

Draw this graph *before* building encounters; it tells you where fights go and
how long the gaps between them should be.

## The breather (safe room)

After each peak, a valley: a **safe room** with no threat, low stimulus, and
usually a save point and/or restock. The breather does three jobs:

1. **Lets adrenaline drop** so the next peak spikes instead of blending in.
   (Halo's cadence is often described as "thirty seconds of fun" on repeat — the
   calm between is what makes the fun read.)
2. **Rewards observation** — a quiet room is where lore, a secret, or a vista
   lands, because the player has attention to spare.
3. **Sets up the next escalation** — telegraph what's coming (a locked blast
   door, distant sound, a corpse) so the next peak feels earned, not random.

Vary breather length with the peak that preceded it: a brutal fight earns a
longer rest; a light skirmish gets a short beat.

## Difficulty curve within a level

The macro trend is up, but it **resets at checkpoints** — the sawtooth again.
Let the player re-enter a checkpoint competent and confident, then ramp. A curve
that only climbs with no resets feels punishing; one that never climbs feels
trivial. Signposting difficulty (a visibly tougher enemy, a bigger arena) lets
the player brace, which is fairer than a surprise spike.

## Encounter design

An **encounter = enemy composition × space × objective × available resources.**
Change any single factor to create a fresh encounter without new assets:

- **Composition** — which enemy types, how many, in what waves.
- **Space** — the arena shape (below); the same enemies feel new in a new arena.
- **Objective** — kill all / survive N seconds / reach the exit / protect / hold
  ground / retreat. The objective reshapes how the space is used.
- **Resources** — ammo, health, cover, high ground the player can seize.

### The encounter template

```text
ENCOUNTER — <name>
  Teaches / tests ..... which mechanic or threat (and which of I/D/T/C beat)
  Space ............... arena shape, sightline length, cover, flanks, verticality
  Composition ......... enemy types + counts + wave timing
  Objective ........... win condition (kill / survive / reach / hold / escort)
  Resources ........... ammo/health/cover/high-ground and where they sit
  Entry / exit ........ how the player arrives (telegraph) and leaves (release valve)
  Intensity ........... where this sits on the level's graph (peak height)
```

## Introduce -> develop -> twist -> combine

The four-beat progression that teaches a new element through space, without
text. (The pattern behind Portal's test chambers, Half-Life 2's set-pieces, and
much Nintendo level craft.)

1. **Introduce** — meet it where it cannot hurt you. A turret across a safe gap;
   one tile of the new hazard with a wall to watch from. Zero-risk learning.
2. **Develop** — use it for real, low stakes. The turret now guards a corridor
   you must cross; the hazard is a gap you must jump.
3. **Twist** — recontextualize it. Two turrets flanking; the turret behind glass
   you must lure enemies past; the hazard now moves. The rule you learned bends.
4. **Combine** — the mastery test: the new element + everything learned earlier,
   at full intensity, as the section's climax.

### Worked example — a "gravity plate" that flings the player upward

- **Introduce**: one plate in a safe room; step on it, get flung to a ledge with
  a reward. No threat. Player learns "plate = launch."
- **Develop**: cross a pit by chaining two plates — miss and you just fall back,
  retry. Low stakes, real use.
- **Twist**: a plate launches you *into* a turret's line of fire — now you must
  time the launch, or use the plate to reach the turret's flank.
- **Combine**: an arena where plates are the only way to reach high cover, under
  fire, while enemies also use them. Everything at once.

## Arena shape — the geometry is the difficulty knob

The shape a fight happens in matters as much as the enemies:

- **Sightline length ↔ threat range.** Long lanes favor ranged play and
  sniping; tight rooms favor shotguns/melee and force close engagements. Set the
  lane length to the range you want to be dominant.
- **Cover rhythm.** Space cover so the player *advances in beats* — peek, move,
  peek — rather than turtling in one spot. Low cover (peek over) vs full cover
  (peek around) change the fight's tempo.
- **Flanks.** Give at least one flank route so a fight isn't a static peek-war;
  a flank forces the player to move and makes the space three-dimensional in
  play, not just in geometry.
- **Verticality.** High ground is pressure and reward. The Doom (2016) arena
  is the reference: multi-tier, with resources and enemies placed to pull the
  player *through* and *up* the space rather than hunker in a corner.
- **Chokepoints + release valves.** A choke concentrates danger (good for a
  last stand); always pair it with an exit or a way to break the standoff, or
  the fight stalls into a stalemate.
- **Entry and exit.** Telegraph the fight before the player commits (see the
  arena from a safe threshold), and give a clear release when it's won.

### Arena patterns

| Pattern | Shape | Good for |
|---|---|---|
| **Corridor / lane** | Long, narrow, few flanks | Tension, forced pace, ranged duels |
| **Open arena** | Wide, multi-cover, multi-flank | Skill expression, mobile fights |
| **Vertical arena** | Stacked tiers, ramps/lifts | High-ground contests, push-forward combat |
| **Hub** | Central space, spokes off it | Wave defense, "hold ground" objectives |
| **Pinch** | Wide → choke → wide | Escalation, last-stand beats |

Match the pattern to the encounter's job on the intensity graph, not to habit.
