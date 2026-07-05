# Guidance & readability — direct the player without hand-holding

How to make a player always know where to go, understand what they can do, and
feel clever for exploring — using the environment instead of arrows. Also
covers the playtest protocol, traversal telemetry, and reward/secret placement,
because those are how you *diagnose and fix* readability.

## The layers of guidance (strongest to weakest)

The eye is drawn, roughly in this priority, to: **motion → light/brightness →
high contrast → saturated color → the different/odd → framed shapes.** Stack
these on the path you want taken; strip them from paths you don't.

### Light leads

Players move toward light — the moth effect — and toward higher value contrast.

- Light the **critical path, the objective, and the exit**; keep dead-ends,
  non-paths, and cut branches dim.
- A bright opening at the end of a dark corridor is an irresistible pull.
- Use light *in greybox* as a design tool, not a final-art afterthought — the
  guidance is authored in placeholder lighting and art merely honors it.
- Contrast beats absolute brightness: a shaft of light in gloom guides harder
  than a uniformly bright room.

### Color as language

Reserve **one saturated accent color** to mean "you can interact / go here" and
use it *nowhere else*.

- Precedents: Mirror's Edge's "runner red" for the traversal path; Dishonored's
  faint glint on usable objects; the near-ubiquitous "yellow = climbable/grab"
  convention.
- The value of the convention *is its consistency*. The moment the interact
  color appears on decoration, you've lied — the player learns to distrust it
  and starts checking everything, which is the opposite of guidance.
- Keep the rest of the palette desaturated relative to the accent so it pops.

### Composition

Compose the space like a photographer composes a shot.

- **Leading lines** — rails, beams, roads, pipes, tiling that point toward the
  objective.
- **Framing** — arches, doorways, foreground silhouettes that box the eye onto
  the target.
- **Negative space** and **contrast** to isolate what matters.
- From every decision point, the critical path should be the most-framed,
  highest-contrast, best-lit option.

### Affordances & signifiers

(Norman/Gibson.) An affordance is what the environment *lets* you do; a signifier
is the visual cue that advertises it.

- A ledge that looks grabbable **must** be grabbable; a wall that looks solid
  **must** be solid. A door-shaped thing that never opens teaches the player to
  ignore doors.
- Establish the visual language **early** and hold it: if a specific trim, decal,
  or material means "climb here," that cue appears **only** where you can climb.
- Inconsistent affordances are the #1 source of "I didn't know I could do that"
  and "I thought I could do that and died." Consistency > cleverness.
- Prefer **diegetic signifiers** (a rope, scuff marks, a worn path, a ladder)
  over UI prompts; save prompts for genuinely non-obvious systemic actions.

### Landmarks & self-location

- One **dominant landmark** per area — a large, distinct, distant silhouette
  (Disney's "weenie": the visual magnet that pulls you forward). It answers
  "where am I / where's the goal" without a minimap.
- Keep landmarks visible from key decision points; if the player can't see the
  landmark when they need to choose, it isn't doing its job.
- **Deny wrong turns visually** — subtle dead-ends, unlit gaps, a distinct
  "not-a-path" material — rather than relying on invisible collision, which
  feels arbitrary and cheap.

### The critical-path readability self-test

Stand at each decision point in the greybox and ask: *with no HUD and no prior
knowledge, is the intended next step the most obvious thing here?* If you have
to argue for it, a fresh player will get lost. Fix with light/framing/landmark
before reaching for a waypoint.

## Playtesting — observe, don't coach

You cannot see your own level fresh; your knowledge of it is the one thing a
player won't have.

1. **Fresh, uncoached tester.** Say "play." Then stay silent.
2. **Log four signals:**
   - **Hesitation / stopping** → readability gap (they can't tell where to go).
   - **Wrong turn / backtrack** → navigation gap (guidance points wrong or is
     absent).
   - **Repeated death** → telegraph or difficulty gap (threat unfair or
     unreadable).
   - **Skipped content** → reward-placement or guidance gap.
3. **Never answer "where do I go?"** — that question *is* the finding. Answering
   it destroys the data and hides the bug.
4. **Ask after, not during**: "Where did you think you were supposed to go? What
   did you expect that button to do? Where did you feel stuck?" Open questions,
   no leading.
5. Test on the **greybox**, early and often — fixes are cheap while it's grey.

## Traversal telemetry & heatmaps

Turn anecdote into pattern by logging player data across many sessions:

| Metric | What it shows | The fix when it's bad |
|---|---|---|
| **Position heatmap** | Where players spend time; **cold zones** they never enter | Cold zone = dead space: re-light it, add a landmark/reward, or cut it |
| **Death heatmap** | Where players die; **clusters** = unfair/unreadable threats | Fix the telegraph, the arena, or the difficulty — not the player |
| **Path traces** | Are they on the golden path or lost? | Divergence from intended path = guidance failure at that fork |
| **Dwell time** at forks | Long dwell = unclear guidance | Add light/framing/landmark to make the choice obvious |
| **Look / aim heatmap** | Did they even *see* the landmark or reward? | If not looked-at, it's mis-placed or out-competed — reposition |
| **Time-to-objective** | Pacing vs intent (too fast/slow) | Adjust distance, breather length, or beat spacing |

Read the map as instructions: a branch nobody takes needs a visible reward at
its mouth; a region everyone avoids isn't pulling them — fix the pull or remove
the region.

## Reward & secret placement

- **Reward the wandering eye.** Put secrets where a *curious* player naturally
  looks — behind the waterfall, up the ledge you already lit and framed, down
  the branch you breadcrumbed. Reward **observation**, not pixel-hunting.
- **Breadcrumb every secret.** A glint, an out-of-place object, a suspicious
  seam, an odd bit of geometry visible from the path. The player should feel
  clever — which means the game showed them the thread first. A secret with no
  breadcrumb is just frustration.
- **Never hide mandatory progression like a secret.** A required key or door
  disguised as optional is a stuck-player generator. Secrets are optional by
  definition; the critical path stays legible.

## Risk vs reward

- Gate the **best** optional reward behind the **biggest** optional risk or
  detour — a hard side-arena, a long climb, a resource gamble, a no-checkpoint
  stretch.
- Keep the **critical path rewarding on its own** so risk-averse players aren't
  punished for playing it safe; put the *extra* behind the *extra* effort.
- Make the risk and the reward both *visible before committing* so the choice is
  informed: the player should see the treasure across the deadly gap and decide.

### Reward taxonomy (vary these so exploration stays fresh)

| Type | Example | Notes |
|---|---|---|
| **Power / upgrade** | new ability, weapon, permanent buff | Strongest pull; use sparingly |
| **Resources** | ammo, health, currency | Steady exploration incentive |
| **Lore / collectible** | note, audio log, vista, cosmetic | For the curious; light them in breathers |
| **Shortcut unlock** | a door back to the hub, a lowered ladder | Best long-term reward — reshapes the level, cuts backtracking |
| **Spectacle** | a view, a scripted moment, an Easter egg | Pure delight; costs no systemic balance |
