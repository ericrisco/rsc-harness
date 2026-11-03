# Eval harness — `constitution` skill

Two things are checked: that the skill **triggers** on the right prompts (and
stays quiet on near-misses that belong to a sibling), and that it **measurably
improves** the constitution it produces. Cases live in `cases.yaml`. There is no
shell runner — `constitution` is a process skill judged on safety rails and
judgment, so grading is done by an **agent harness** (a Claude Code agent with
skills loaded) plus a human spot-check.

## What's in `cases.yaml`

- `should_trigger` — prompts that MUST load `constitution`.
- `should_not_trigger` — near-misses that must route elsewhere (`route_to` names
  a real sibling in this repo: `harness`, `init`, `fastapi`, `secure-coding`,
  `design`).
- `capability` — a scenario with a `must_include` rubric to grade with vs without.

## Triggering eval

Goal: the skill fires when it should and never on a near-miss.

1. Configure an agent with the **full catalog of skill descriptions** available
   for routing (constitution + its rsc-sdd phase siblings once they exist, plus
   harness, init, fastapi, nextjs, go, postgresdb, flutter, design, secure-coding,
   deployment, marketing, presentations, course-storytelling, building-agents) so
   routing competes realistically.
2. For each `should_trigger` prompt: feed it cold, record whether `constitution`
   is the skill the agent loads. Run **3-5 trials** per prompt (fresh context).
3. For each `should_not_trigger` prompt: confirm `constitution` does NOT load and
   that the chosen skill matches `route_to`. Same 3-5 trials.
4. Score: `triggered_correctly / total_trials` across both lists.

**Pass bar: >= 90% trigger accuracy** over all prompts and trials, with **zero
systematic false-positives** on the `harness`/`init` near-misses — those are the
known traps, since "set up the project" reads close to "set the project's
principles". A scaffolding-or-bootstrap prompt must not pull in `constitution`.

## Capability eval

Goal: prove the skill changes the answer, not just the routing.

1. For the `capability` scenario, run it **twice**:
   - **WITHOUT** the skill (base agent, no `constitution` loaded).
   - **WITH** the `constitution` skill loaded.
2. Grade each output against the `must_include` checklist — one point per
   checkable item covered. A human or grading agent marks each present / absent.
3. Compute coverage = `items_covered / total_items` for each run.

**Pass bar: WITH the skill covers >= 80% of `must_include`; WITHOUT clearly
lower** (target a >= 30-point gap). The discriminating behaviors are: the
reconciliation pass against `02-DOCS/wiki/stack/*` (link, don't paste), testable
numbered principles, the fixed authorship + decisions-logged principles,
versioning + amendment log, the Definition-of-Done checklist, and explicit user
ratification. A base agent typically writes a vague, unversioned wall of
aspirations that duplicates the stack wiki — score that as a capability failure
even if it reads tidy.

## Notes on honesty

- Trials are stochastic; report the raw fraction, not a rounded "pass".
- The highest-signal capability check is reconciliation: a correct answer reads
  the existing stack articles and LINKS them; it never pastes their config into
  the constitution or silently resolves a contradiction between them.
- Re-run after any edit to `SKILL.md` or `references/constitution-template.md` —
  wording changes shift both triggering and rubric coverage.
- Several `route_to` targets are rsc-sdd phase siblings (`specify`, `plan`,
  `analyze`, `asdd`) that ship alongside this skill; the near-misses here route
  only to skills already present in the repo so the eval is runnable today.
