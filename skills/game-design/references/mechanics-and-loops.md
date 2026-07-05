# Mechanics, verbs, loops, and feel — deep dive

Engine-agnostic. This expands the SKILL.md sections on loops, MDA, verbs, and feel. No engine APIs — when a pattern needs code, it belongs to `godot` / `unity` / `unreal`.

## MDA in practice

Mechanics → Dynamics → Aesthetics is a lens, not a pipeline you fill in once.

- **Mechanics** — the rules, entities, and numbers you literally author: gravity value, damage table, spawn rules, win condition.
- **Dynamics** — the runtime behavior that emerges when players push on the mechanics: kiting, rushing, turtling, economy hoarding. You do not write dynamics; you *provoke* them with mechanics.
- **Aesthetics** — the emotional response the player actually has. This is the only layer they experience directly.

You author left-to-right but must **reason right-to-left**: start from the feeling you want, hypothesize a dynamic that would produce it, then author the mechanic that produces that dynamic. Playtest to see whether the real dynamic matches the intended one — it usually doesn't the first time.

### The eight aesthetics (name the one you want)

| Aesthetic | The feeling | Example games |
| --- | --- | --- |
| Sensation | Sense-pleasure, "game as toy" | *Tetris*, rhythm games, *Katamari* |
| Fantasy | Make-believe, inhabiting a role | *Skyrim*, flight sims |
| Narrative | Drama unfolding | *Disco Elysium*, *The Last of Us* |
| Challenge | Obstacle course, mastery | *Celeste*, *Dark Souls*, *Trackmania* |
| Fellowship | Social framework, cooperation | *It Takes Two*, MMOs, *Among Us* |
| Discovery | Exploring the unknown | *Outer Wilds*, *Subnautica* |
| Expression | Self-discovery, creation | *Minecraft*, *The Sims*, *Animal Crossing* |
| Submission | Pastime, relaxation, "flow-off" | idle games, *Stardew Valley* farming |

Most games target **two or three**, weighted. Writing them down settles arguments: a feature that serves none of your chosen aesthetics is a cut candidate, however cool.

## Verbs are the game

The player's verb set — the actions available — is the truest description of a design. "A game about jumping and stomping" (Mario) says more than any feature list.

- **Depth over breadth.** A few verbs that interact combinatorially (chess: six piece-moves) yield more game than dozens of isolated ones. Interaction between verbs is where mastery and emergence live.
- **Verb economy test.** Before adding anything, ask: does this add a *new verb*, *deepen an existing verb's interactions*, or merely *add a number*? Numbers rarely add game.
- **Emergence vs progression** (Juul's distinction):
  - *Emergent* games — simple rules, vast possibility space (chess, poker, *Spelunky*, roguelikes). Cheap to build, huge replay, hard to control the experience.
  - *Progression* games — designer places a sequence of challenges (linear campaigns). Total authorial control, expensive per minute of play, low replay.
  - Most games blend: an emergent core loop inside a progression frame.

## Loop layering, in detail

```text
INPUT ─▶ [ moment-to-moment verb ] ─▶ immediate feedback ─▶ (repeat, seconds)
                                            │ accrues into
                          [ session goal / run ] ─▶ session payoff ─▶ (minutes–1h)
                                            │ funds
                          [ meta progression ] ─▶ lasting change ─▶ (across sessions)
```

- **Moment-to-moment must be intrinsically fun.** Test: strip every goal, reward, and score — is the raw act of doing the verb still satisfying? If not, fix this before anything else. This is Bungie's "30 seconds of fun" — perfect the small loop, and the game is that loop repeated in varied contexts.
- **Session loop needs a shape.** Setup → rising tension → climax → resolution → hook. A run that just stops has no payoff; a run that ends on "so close" pulls the next one.
- **Meta loop is the return reason.** It converts session output (currency, XP, mastery, unlocks) into durable change. If the meta gives only numeric inflation and no new *choices or verbs*, players feel the grind without the growth.
- **Reward funding is the health check.** Each layer's reward should create desire for the next layer. Diagnose a "not fun" game by asking which loop is starved:
  - Flat moment-to-moment → nothing above can save it.
  - Empty meta → "great for an hour, then I bounced."
  - Meta with no moment-to-moment joy → "I grind and don't know why."

## Feedback loops (system dynamics)

Distinct from "player feedback." These are the amplifying/damping loops in your systems.

- **Positive feedback loop** — success makes further success easier (rich-get-richer). Accelerates games to a conclusion and rewards early leads. Good for *ending* a game; dangerous if unchecked mid-game (snowball, runaway leader, blowouts).
- **Negative feedback loop** — success makes further success harder, or trailing players get help (catch-up, rubber-banding, escalating cost of dominance, *Mario Kart* items). Keeps games close and tense; overdone it punishes skill and feels unfair.
- **Design move:** use negative feedback to keep the mid-game close and positive feedback to force a decisive end — so games stay tense but still *end*.

## Game feel / juice as design intent

Feel is the moment-to-moment made tactile. Decide it here; the engine implements it.

- **Responsiveness first.** Immediate, legible reaction to every input beats visual fidelity. Perceived input latency destroys feel.
- **Juice vocabulary** — specify the *intent* and *trigger*, not the code:
  - *Hit-stop / hit-pause* — freeze a few frames on impact to sell weight.
  - *Screenshake* — amplitude scaled to significance; gratuitous shake reads as noise.
  - *Anticipation & follow-through*, *squash-and-stretch* — animation principles that telegraph intent and add weight.
  - *Particles, easing/tweening curves, layered SFX* — reinforce the action's magnitude.
- **Hidden generosity.** Coyote time (jump slightly after leaving a ledge), input buffering (queue an input landing a hair early), and forgiveness windows make a game feel *fair* and responsive without the player knowing why. These are design decisions with real numbers (frames/ms) — specify them; the engine skill wires them.
- **Boundary:** keyframes, curves, shader passes, and timing code are engine work. Here you produce a table of "action → intended feel → effect → trigger."
