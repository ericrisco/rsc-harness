# Eval harness — `author-skill`

Evaluates the `author-skill` meta skill (the rsc-core tool that authors/edits other skills)
on two axes: **triggering** (does it fire on the right prompts and stay quiet on near-misses)
and **capability** (does loading it measurably improve the skill the agent produces). Cases
live in `cases.yaml`. These run via an **agent harness**, not a deterministic script — a human
or a driver agent feeds prompts to Claude Code and judges the result against the rubrics.

## What's in `cases.yaml`

- `should_trigger` (7) — prompts that MUST invoke `author-skill`, including a non-obvious
  symptom phrasing ("my skill never triggers") and a non-English one ("escribe una skill nueva").
- `should_not_trigger` (5) — near-misses that must route elsewhere; `route_to` names the real
  sibling that owns each (`plan`, `building-agents`, `init`, `harness`, `specify`).
- `capability` (2) — scenarios with `must_include` rubrics to grade WITH vs WITHOUT the skill:
  authoring a new skill end-to-end, and repairing a broken triggering description.

## A. Triggering eval

1. Load **only** `author-skill` into the agent (no other rsc skills available, so routing is honest).
2. For each `should_trigger` prompt: open a fresh session, paste the prompt verbatim, and record
   whether `author-skill` activates (the agent should lead with scope/description work, not jump
   into building a product feature). Run **3–5 trials** per prompt.
3. For each `should_not_trigger` prompt: same procedure, but a **pass** = `author-skill` does NOT
   fire. Where a `route_to` sibling exists, sanity-check that the prompt genuinely belongs there
   (e.g. "turn this spec into a plan" really is `plan`, not skill authoring).
4. Score: a prompt passes if the **majority of its trials** go the expected way.

**Pass bar:** ≥ 90% trigger accuracy across all `should_trigger` + `should_not_trigger` prompts
(at most 1 of the 12 prompts may misbehave).

## B. Capability eval

1. **Without the skill:** fresh session, skill NOT loaded, give the `scenario` prompt. Save output A.
2. **With the skill:** fresh session, `author-skill` loaded, same prompt. Save output B.
3. Grade each output against that scenario's `must_include` points — count points clearly covered.
4. Repeat across **3 trials** per scenario per condition and average the coverage.

**Pass bar:** WITH the skill covers **≥ 80%** of `must_include` points; WITHOUT the skill is
materially lower (target a ≥ 30-point gap). If the skill doesn't measurably beat the baseline,
the skill — or these rubrics — needs work.

## The headline differentiators

What a WITH-skill answer should show that a baseline misses:

- **Description first**, to the recipe: third-person `Use when…` lead, only the capabilities that
  discriminate it from its nearest sibling, a `NOT … (sibling)` boundary, valid single-line quoted
  YAML aiming ≤ 350 chars (1024 hard limit), `origin: risco`.
- **Progressive disclosure** — the smallest body that still routes (400 lines is a ceiling, not a
  target) pointing into `references/`, not an encyclopedia and not an orphaned references folder.
- **evals authored** to the minimums, with `route_to` siblings that actually exist.
- **No `verify.sh` on a process skill** — rigor comes from the capability eval.
- **rsc wiring** named: `tags` + `recommends` frontmatter, `npm run manifest` regenerated,
  `npm run validate` / `manifest:check` passing, `eval-lint.sh` passing.
- **Original rsc voice** — no copied artifacts/phrasing from other skill ecosystems.

## Judging notes (honest caveats)

- This is **LLM-as-judge / human-in-the-loop**, not deterministic. Use a consistent grader
  (same model + rubric) across A/B to keep the comparison fair.
- `scripts/eval-lint.sh` deterministically checks only the *case-count minimums* of any
  `cases.yaml` this skill produces; it does not judge prose quality — that is the human/LLM grade.
- Watch the key confusables: building a *product feature* (the SDD chain) and designing an
  *agent loop* (`building-agents`) are different artifacts than authoring a *skill*.
- Re-run after any edit to `SKILL.md` or its `description`, since both axes are wording-sensitive.
