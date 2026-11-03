# Eval harness — `tasks` skill

Two things to check: that the skill **triggers** on the right prompts (and stays
quiet on its SDD neighbours), and that it **measurably improves** the task
breakdown an agent produces. Cases live in `cases.yaml`. There is no shell
runner — triggering and breakdown quality are judgment calls, graded by an
**agent harness** (a Claude Code agent with the skill catalog loaded) plus a
human spot-check.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `tasks` (incl. Spanish and non-obvious phrasings).
- `should_not_trigger` — near-misses that must route elsewhere (`route_to`), all on the
  hard SDD-chain boundaries: `plan` (the step before), `analyze` (the gate after),
  `implement` (the doing), and the stack skills a single task merely delegates to.
- `capability` — one scenario with a `must_include` rubric to grade with vs without.

## Triggering eval

Goal: the skill fires when it should and never on a near-miss.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing — the other rsc-sdd phases (`asdd`, `constitution`, `specify`,
   `clarify`, `plan`, `analyze`, `implement`, `verify`, `review`, `ship`,
   `debug`, `worktrees`, `parallel`) plus the stack/process skills (`fastapi`,
   `nextjs`, `go`, `postgresdb`, `flutter`, `harness`, …) — so routing competes
   realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `tasks` is the
   skill the agent loads. Run **3–5 trials** per prompt (fresh context each).
3. For each `should_not_trigger` prompt: confirm `tasks` does NOT load and that
   the chosen skill matches `route_to`. Same 3–5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: ≥ 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the `plan`/`analyze`/`implement` near-misses.
Those three are the known traps: a prompt to *write* the plan, to *gate* the
artifacts, or to *execute* the work must not pull in `tasks`. If `tasks` keeps
stealing `plan` or `implement` prompts, the description's NOT-clauses need
sharpening.

## Capability eval

Goal: prove the skill changes the breakdown, not just the routing.

1. For the `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `tasks` loaded).
   - **WITH** the `tasks` skill loaded.
2. Grade each output against the `must_include` checklist — one point per
   checkable item covered. A human or grading agent marks each present / absent.
3. Compute coverage = `items_covered / total_items` per run.

**Pass bar: WITH the skill covers ≥ 80% of `must_include`; WITHOUT clearly
lower** (target a ≥ 30-point gap). The skill must demonstrably add: runnable
done-checks (not "it works"), dependency ordering, disciplined `[P]` marking,
spec traces with no orphan tasks, TDD-shaped pairs, appending into the plan
artifact (not a new file), and the handoff to `analyze`.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is the **done-check quality**: a correct
  answer never emits a self-graded "feature works" — it quotes the literal
  command. Treat a tidy-looking but unverifiable list as a **capability
  failure** even if it reads well.
- The second-highest signal is **refusing to slice from intent**: if no plan
  exists, the correct behaviour is to STOP and route to `plan`, not to invent a
  breakdown. A confident task list built from a fuzzy wish is a failure.
- Re-run after any edit to `SKILL.md` — wording changes shift both triggering
  and rubric coverage, especially the NOT-clauses that fence off `plan`/
  `analyze`/`implement`.
