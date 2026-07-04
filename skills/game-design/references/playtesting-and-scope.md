# Prototyping, playtesting, scope, and docs — deep dive

Engine-agnostic. Expands the SKILL.md sections on prototyping, playtesting, scope, and documenting design.

## The prototyping ladder

Climb only as far as each rung earns. Each rung is cheaper to change than the next.

1. **Riskiest-assumption first.** Name the single thing that, if it doesn't work, sinks the game (Is the core verb fun? Does the economy hold? Is the twist readable?). Prototype *that*, not the easy parts.
2. **Paper / cards.** Best for rules, turn order, economies, and card/board interactions. Simulate the loop by hand; you can rebalance in seconds with a pencil.
3. **Greybox / blockout.** Untextured, programmer-art mechanics running in the engine. Proves *feel* and moment-to-moment fun. If it isn't fun in greybox, art will not make it fun — this is the single most expensive lesson to learn late.
4. **Vertical slice.** One polished, representative sliver — one level or one loop at final quality — proving the game is worth finishing and showing what "done" looks like. Prefer this over a broad, shallow map of half-built features.

**Find the fun before you buy the art.** Art and audio are the most expensive assets and the hardest to change; commit them only after the mechanic underneath is proven.

## Playtesting

- **Watch, don't coach.** Say as little as possible. The instant you explain a control, you have destroyed the first-time-user signal you can never recapture from that tester.
- **Behavior over opinion.** Players are unreliable at diagnosing *what* is wrong and reliable at signaling *that* something is. When a tester says "the jump is fine" but dies to the same gap ten times, believe the deaths. Weight actions over words.
- **Protocols:**
  - *Think-aloud* — tester narrates their thoughts live; surfaces confusion and mental model mismatches.
  - *First-time-user (FTUE)* — a fresh tester with zero explanation; the harshest and most valuable test of onboarding.
  - *Post-play interview* — ask open questions ("what would you tell a friend about this?"), never leading ones.
- **What to measure:**
  - *Qualitative* — struggle points, boredom points, quit points, "aha" moments, emotional reactions.
  - *Quantitative* — completion rate per section, time-per-section, death heatmaps, failure counts, and retention: **D1 / D7 / D30** (fraction returning 1/7/30 days later). Retention is the honest verdict on whether the loops hook.
- **Cadence:** test early, test ugly, test often. A rough test this week beats a polished one next month. Rotate testers — a tester can only be first-time once.

## Killing your darlings

- Cut any mechanic that does not serve the core loop or a design pillar — regardless of how clever it is or how long it took. A pile of unrelated clever mechanics is not a game.
- Signs a darling must die: it needs its own tutorial, it only shines in one contrived spot, playtesters ignore it, or defending it starts with "but it was hard to build" (sunk cost is not a design argument).

## Scope: the #1 indie killer

More indie games die of scope than of bad ideas, weak talent, or poor tools. The failure mode is always the same: a feature list that outruns the finish line.

- **Cut features, not quality.** A finished small game beats an unfinished ambitious one, every time. Shrinking scope preserves polish; cutting polish to keep scope produces a large mediocre thing nobody finishes.
- **Define "the one thing."** State in one sentence what the game is *about* and protect it. Everything that doesn't serve it is a candidate for the cut list.
- **Vertical slice over horizontal sprawl.** Build one loop end-to-end at quality before widening. A deep narrow slice ships; a wide shallow map of stubs does not.
- **A public cut list.** Keep an explicit "not doing" list next to the feature list. Naming what's *out* is as important as naming what's in — it ends the "wouldn't it be cool if…" spiral.
- **Budget by the finish, not the ambition.** Estimate remaining work against real available time; when they don't fit, the variable you move is scope, not the ship date and not sleep.

## Documenting design: the living one-pager

A 100-page design bible is stale the day after it's written and read by no one. Replace it with a living one-pager that grows only where a real decision needs recording.

One-page design doc contents:

- **Hook / fantasy** — one sentence: what is the player's power fantasy or core experience?
- **Pillars** — 2–4 short phrases (e.g. "tense stealth", "readable chaos", "no dead ends"). These are decision filters: every feature must serve a pillar or it is cut.
- **Core loop** — the moment-to-moment → session → meta chain in a few lines.
- **Verbs** — the actions the player has.
- **Target aesthetic** — the named MDA emotion(s), weighted.
- **MVP / vertical-slice scope** — the smallest thing worth building and playing.
- **Out of scope** — the explicit cut list.

Keep it a communication tool, not an archive: a versioned wiki page beats a locked document. Prune it as decisions settle; link deeper notes only where they earn their space.
