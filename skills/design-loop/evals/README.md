# Eval harness — `design-loop` skill

Agent-run eval, not a shell script. The cases in `cases.yaml` are fed to a Claude Code agent and
graded by inspection. The "harness" is the procedure below plus a human (or a judge agent) checking
outputs against the rubrics.

## What's under test

1. **Triggering** — does the loop fire when a goal comes with a real reference to beat, and stay
   quiet on the near-misses that belong to a sibling? The expensive confusions are `design` (visual
   system, no bar), `prototype` (variants picked by preference, no bar) and `design-dna` (the winner
   already exists).
2. **Capability** — when it fires, does it hold the three phases it is easiest to skip, and does its
   loop actually terminate?

## A. Triggering accuracy

Run each `should_trigger` prompt in a session with the skill installed. It must activate. Run each
`should_not_trigger` prompt: it must stay quiet and the named `route_to` sibling must be the one that
answers.

The two cases worth watching, because they are where the boundary really is:

- *"Show me three versions and I'll pick"* → `prototype`. Selection is not convergence. The user is
  the judge and no bar exists.
- *"Codify this into a reusable style"* → `design-dna`. Nothing left to converge; this is the
  downstream half.

## B. Capability

The three scenarios are the three things this skill exists to do and the three it is cheapest to
fake:

1. **The vague bar and the blind critic.** A bar of "Apple's website" must be pushed back on once,
   and a missing render capability must be declared as *which critic goes blind* — not absorbed
   silently. A critic that cannot see, still voting, is the failure this phase prevents.
2. **Termination.** The scenario hands it an oscillation: air, then density, then air again. The
   skill must halt the piece and surface the two competing demands. **This is the case that matters
   most**: everything else in the skill is judgement, but a loop that cannot detect it will never
   converge is a gate that cannot close, and the constitution's P2 forbids exactly that.
3. **Hand-off on winning.** Four more pages after a win must go through `design-dna`, not four more
   loops. Re-deriving a style you already won is how the set stops looking like a set.

## Grading

A case passes when every `must_include` line is observably present in the agent's output or actions.
Partial credit is not useful here: the mechanisms are the skill, and a run that keeps the prose but
drops the halt has kept the part that costs nothing.

## Known limits of this eval

- **Scores vs binaries** and **critics judging rendered output only** are properties of a real
  multi-round run. A single-turn eval can check that the skill *states* them; it cannot prove a
  four-round run honoured them. Verifying that needs a live run against a real reference.
- The halt is checked from a described history, not a real one. It tests the rule, not the
  bookkeeping that feeds it.
