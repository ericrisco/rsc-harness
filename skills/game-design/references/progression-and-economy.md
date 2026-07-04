# Progression, economy, and balance — deep dive

Engine-agnostic. Expands the SKILL.md sections on progression, economy, difficulty, and balancing. All math here fits in a spreadsheet; no engine APIs.

## Progression pacing

- **Two parallel curves: difficulty and novelty.** Boredom comes from either flatlining. When difficulty must plateau (a rest area), spike novelty (a new mechanic, a set-piece); when novelty must pause, nudge difficulty. Never let both go flat at once.
- **Teach → test → twist.** Introduce a mechanic safely, test it under mild pressure, then combine it with an earlier mechanic. This is how you build *layered* mastery instead of a pile of unrelated tutorials.
- **Gate to control cognitive load.** Unlocks pace how many systems the player juggles at once. Front-loading every verb overwhelms; drip-feeding lets each verb be learned before the next.
- **Unlock quality bar.** Each unlock should add a **verb** or a **meaningful choice**, not just +N%. A stat bump is progression felt as grind; a new option is progression felt as growth.

## Economy: currencies, faucets, sinks

- **Currency taxonomy:**
  - *Soft currency* — earned through play, spent freely (gold, scrap). Drives the core economy loop.
  - *Hard / premium currency* — scarce or bought, gates high-value or aspirational items.
  - *Time / energy* — a pacing gate (stamina systems); a sink on session length.
  - *Prestige* — meta-currency earned by resetting progress; funds the long meta.
- **One currency, one job.** Every currency must have a distinct **sink** it exists to feed. If two currencies buy the same things, merge them. Currency without a sink is clutter and inflates.

### Faucets and sinks

- **Faucet** = anything that *creates* currency (quest rewards, drops, passive income).
- **Sink** = anything that *destroys* it (shop costs, upgrades, repairs, consumables, taxes/fees).
- The economy is healthy when total faucet output and total sink demand track each other over the play arc.

Core identity to model in a sheet:

```text
net_income_rate = faucet_rate − sink_rate
time_to_afford  = cost / net_income_rate

# escalating sink — the standard way to keep pace with rising income:
cost(n) = base × growth^n
#   growth ≈ 1.07–1.15 for idle/incremental; higher = steeper wall
#   solve for growth by pinning two target prices, or for base by pinning the first cost
```

Tune `time_to_afford` against desired pacing (e.g. "a new tier every ~2 sessions"). Sweep the parameters in a spreadsheet before touching the engine.

### Runaway and inflation

- **Symptom:** `net_income_rate` grows faster than `cost(n)` → currency piles up, prices feel free, the late game trivializes. Or the reverse: sinks outpace faucets → progress stalls, players feel taxed.
- **Fixes for over-supply:** escalating/exponential sinks (`growth` above), consumable sinks (currency spent every session, not banked), soft/hard caps, and **prestige resets** that trade accumulated progress for a permanent multiplier and re-open the curve.
- **Multiplayer economies** add faucet leaks (duping, botting, gold farming) and player-to-player trade that can concentrate wealth — audit total money supply over time, not just per-player rates.

## Difficulty and balancing

### The curve

- **Sawtooth, not a straight ramp.** A rising baseline with peaks (bosses, gauntlets) and valleys (recovery, reward rooms). The valleys make the peaks legible and let the player breathe.
- **Flow channel** (Csikszentmihalyi via game design): keep perceived challenge tracking the player's rising skill, in the band between boredom (too easy for current skill) and anxiety (too hard). As skill grows, challenge must grow with it.
- **Perceived ≠ actual.** Telegraphing, readability, and generosity (see feel) change *perceived* difficulty without changing the numbers. A fair-feeling hard game keeps players; an unfair-feeling easy one loses them.

### Tuning knobs

- **Find the few high-leverage variables** — usually damage, health, spawn rate/density, resource cost, cooldown/duration. Most balance lives in a handful of them.
- **Change one at a time.** Chasing a symptom by moving five knobs makes cause un-attributable. Move one, retest, record.
- **Data-driven.** Put tunables in data (tables/config/spreadsheets), never hard-coded constants, so designers iterate without a rebuild and numbers are diffable and A/B-able. This skill decides *which* values are tunable and their ranges; the engine skill (`godot`/`unity`/`unreal`) builds the loader.

### Dominant strategies and intransitive balance

- **Dominant strategy** = an option that strictly beats the alternatives in most situations. It collapses the meta: every rational player converges on it and all other choices die.
- **Detect it:** watch playtests and telemetry for pick-rate/win-rate outliers, and for "solved" openings. High pick + high win = nerf target.
- **Fix toward intransitivity:** aim for rock-paper-scissors — every option is beaten by *some* other option, none beats all. Nerf the outlier or buff its counters; prefer many small changes over one sweeping one.
- **Symmetry vs asymmetry:** symmetric balance (mirror factions) is easy to make fair but flat; asymmetric balance (distinct factions/classes) is rich but must be balanced by *outcome parity* (equal win-rates), not by identical stats.

### Difficulty options & accessibility

- Decouple **challenge** from **exclusion**. Difficulty modes, assist toggles (aim assist, slow-mo, invulnerability), and separate sliders for enemy damage vs enemy health widen the audience without diluting the intended experience for those who want it. Accessibility is design, not charity — it grows the reachable player base.
