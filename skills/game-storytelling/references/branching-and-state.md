# Branching & state — topologies, choice, and containment

Deep dive for the SKILL's "Narrative structures" and "Branching & choice" sections. This is engine-agnostic: model the graph and the state here; the engine skill (`godot`/`unity`/`unreal`) serializes and runs it.

## The narrative topologies (ASCII)

**Linear** — one path; agency is over pace, not direction.

```
A -> B -> C -> D -> E
```

**Branching tree** — choices split and (in the pure case) never rejoin. Author cost doubles at each fork.

```
        /-- B --< D
A --<             \-- E
        \-- C --< F
                  \-- G
```

**Hub-and-spoke** — a central hub; the player picks self-contained spokes and returns. Agency is over *order* and *selection*.

```
        B
        |
  C --- HUB --- D      (return to HUB after each spoke)
        |
        E
```

**Foldback / string-of-pearls** — branches diverge, then **reconverge** at load-bearing beats ("pearls"). The between-pearl space stays small, so total scenes stay authorable while choices feel consequential. This is the workhorse for long branching stories.

```
        /-- b1 --\        /-- b3 --\
BEAT1 --           -- BEAT2         -- BEAT3 -> ...
        \-- b2 --/        \-- b4 --/
```

**Gauntlet / branch-and-bottleneck** — like foldback but branches can *drop out* (fail forward) into the main line rather than each reaching the bottleneck.

Most shipped games are a **mix**: a foldback main line, hub-and-spoke for side content, environmental/systemic layered on top.

## Meaningful choice vs. the illusion of choice

A choice is **meaningful** only when all three legs hold:

1. **Intent** — the player understands the options well enough to *want* one (not a blind coin-flip, unless blindness is the point).
2. **Foreseeable consequence** — a plausible mental model of what each option does (even if the outcome surprises).
3. **Consequence that lands** — the game later *reads the choice back*: a changed line, a locked door, a dead character, a different ending. If nothing ever reads the flag, the choice was noise.

**Illusion of choice** — options that reconverge to the same outcome — is a legitimate, even essential tool, but only for the right job:

| Illusion is fine for… | Illusion is a betrayal when… |
| --- | --- |
| **Expression / roleplay** — *how* your character says a thing (tone, personality) with the same result | it's dressed up as a **stakes** decision ("save her or let her die" → she dies either way, unacknowledged) |
| **Pacing / tone** — letting the player set register without forking the plot | the player is told/led to believe it's consequential and later discovers it wasn't |
| **Onboarding** — safe practice choices before real ones | you fake many in a row; players learn choices don't matter and disengage from *all* of them |

Rule of thumb: **you may fake the outcome, never the stakes.** The moment a player catches a stakes-choice that didn't matter, they retroactively distrust every prior choice. Budget your few real, global choices and make them unmistakably land; let the many small choices be honest expression.

### Kinds of consequence (make at least some visible)

- **Immediate** — the next line/scene changes now (satisfying, cheap, local).
- **Delayed** — pays off hours later (powerful, needs a flag and a reminder so the player *connects* it).
- **Ambient** — world/NPC reactions, reputation, barks (cheap breadth; makes the world feel to be watching).
- **Ending-level** — the choice(s) route the finale. Track with a small set of summary flags, not the full history.

Delayed consequences only feel meaningful if the player can **attribute** them to the choice. Plant a callback ("because you spared him at the bridge…") or the payoff reads as random.

## State: model it as named variables

Story state is the spine of everything above. Model it explicitly; never encode meaning in duplicated scene copies.

| State type | Example | Use for |
| --- | --- | --- |
| **Boolean flag** | `met_the_witch`, `betrayed_ally` | one-shot facts / gates |
| **Counter** | `civilians_saved`, `times_lied` | thresholds, tallies, tone tracking |
| **Enum / stage** | `witch_relationship = ally\|neutral\|enemy` | relationship / quest stages |
| **Scalar / reputation** | `town_rep = -3..+3` | gradient reactions, gated content |
| **Set / inventory** | `keys = {east, crypt}` | possession checks |

Guidelines:

- **Name for meaning, not mechanism** (`saved_the_child`, not `flag_37`). Future you and translators read these.
- **Write once, read many.** A single scene that reads flags and swaps lines beats N near-duplicate scenes.
- **Keep a state dictionary** — one table listing every variable, type, who sets it, who reads it. This is your single source of truth and your test plan.
- **Derive, don't duplicate.** Compute "is the player a villain" from counters at read time rather than maintaining a parallel flag that can desync.
- **Decide persistence with the engine skill.** *What* is saved (which variables survive a reload, a chapter, a new game+) is a design call you make; *how* it serializes is the engine skill's job.

### A portable state-gated scene (Ink-flavored, illustrative)

```ink
VAR spared_bandit = false
VAR town_rep = 0

=== gate_market ===
{ town_rep >= 2:
    The guard nods you through. -> market
- else:
    "Your kind isn't welcome." -> turned_away
}

=== bandit_reappears ===
{ spared_bandit:
    The bandit you spared steps from the shadows — and returns the favor.
- else:
    A stranger eyes you coldly and says nothing.
}
-> continue
```

One scene, two behaviors, driven by state — not two authored scenes.

## The combinatorial-explosion trap and how to contain it

**The math:** N *independent* binary choices imply 2^N reachable states; 10 such choices is 1024 futures — unauthorable, untestable. Left unchecked, branching narrative collapses under its own content cost. Contain it deliberately:

1. **Reconvergence (bottlenecks / foldback).** Funnel branches back to shared beats. Between two bottlenecks you only author the small local fan-out, not the global product. This is the single highest-leverage fix.
2. **Gates.** Require a flag/level/item/reputation to open content. Gating *prunes the live branch set* — most branches aren't reachable in a given playthrough, so you don't pay to author their full downstream.
3. **State over structure.** Replace divergent *scenes* with one scene that reads *variables*. You trade authored copies for conditional lines — linear content growth instead of exponential.
4. **Locality (weave).** Keep most choices' effects inside the current scene; let them evaporate at the next bottleneck. Reserve a *small, named budget* of choices for global, persistent state (the ones that reach the ending).
5. **Summary variables for endings.** Don't branch the finale on the full choice history; collapse it into a few axes (e.g. `mercy_score`, `faction`) and branch on those. Dozens of choices, a handful of endings.
6. **Orthogonal, not multiplied.** Prefer choices that affect *different* subsystems (one changes a relationship, one changes the map) over choices that all modify the same outcome and must be cross-authored.

### Testing a branching graph (design-side)

- **Reachability** — every node reachable from start under *some* valid state; flag orphans.
- **No dead ends / soft-locks** — every non-ending node has an exit; no state combination strands the player.
- **Gate satisfiability** — every gated node is reachable by *some* path that can satisfy its condition (a locked door with no obtainable key is a bug).
- **Flag hygiene** — every variable read is written somewhere first; no read-before-write.
- **Ending coverage** — enumerate the summary-variable combinations and confirm each maps to an intended ending.

Keep this list as the acceptance criteria you hand to the engine skill's implementation and QA.
