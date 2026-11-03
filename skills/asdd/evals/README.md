# Eval harness — `asdd`

Evaluates the `asdd` dispatcher (the rsc-sdd front door) on two axes: **triggering**
(does it fire when a feature should run the spec-driven flow, and stay quiet when a
single phase or a different skill owns the request) and **capability** (does loading it
measurably improve how the agent opens and routes the work). Cases live in `cases.yaml`.
These run via an **agent harness**, not a pure shell script — a human or driver agent
feeds prompts to Claude Code and judges the result against the rubrics.

## What's in `cases.yaml`

- `should_trigger` (7) — prompts that MUST invoke `asdd`, including non-obvious phrasings
  ("which step am I on", "decide what and why, write it down, then build") with no SDD
  jargon.
- `should_not_trigger` (6) — near-misses that must route elsewhere. Each carries a
  `route_to` naming the correct sibling (`specify`, `constitution`, `ship`, `harness`,
  `debug`, `nextjs`).
- `capability` (2) — scenarios with `must_include` rubrics graded WITH vs WITHOUT the skill.

## A. Triggering eval

1. Load **only** `asdd` into the agent (no other rsc skills available, so routing is honest).
2. For each `should_trigger` prompt: open a fresh session, paste the prompt verbatim, and
   record whether `asdd` activates — a pass means it names the method, places the request on
   the phase map, and routes to a phase (it should NOT start writing the spec or coding
   itself). Run **3–5 trials** per prompt.
3. For each `should_not_trigger` prompt: same procedure, but a **pass** = `asdd` does NOT
   fire. Where a `route_to` sibling is named, sanity-check the prompt genuinely belongs there
   (e.g. "write the spec" → `specify`, "open the PR and merge" → `ship`).
4. Score: a prompt passes if the **majority of its trials** go the expected way.

**Pass bar:** ≥ 90% trigger accuracy across all `should_trigger` + `should_not_trigger`
prompts (at most 1 of the 13 may misbehave).

## B. Capability eval

1. **Without the skill:** fresh session, skill NOT loaded, give the `scenario` prompt. Save output A.
2. **With the skill:** fresh session, `asdd` loaded, same prompt. Save output B.
3. Grade each output against that scenario's `must_include` points — count points clearly covered.
4. Repeat across **3 trials** per scenario per condition and average the coverage.

**Pass bar:** WITH the skill covers **≥ 80%** of `must_include` points; WITHOUT the skill is
materially lower (target a ≥ 30-point gap). If the skill doesn't measurably beat the baseline,
the skill — or these rubrics — needs work.

## Judging notes (honest caveats)

- This is **LLM-as-judge / human-in-the-loop**, not deterministic. Use a consistent grader
  (same model + rubric) across A/B to keep the comparison fair.
- The headline differentiators for `asdd`: it **dispatches, it does not perform a phase**; it
  states the method ("the artifact is the contract"), reads the **register** (`technical_level`)
  and speaks in the orient voice (never skipping gates), presents the **chained phase map**, applies the **invoke
  rule** and the **skip rules** honestly, and writes artifacts under `02-DOCS/wiki/sdd/`.
- Key confusables to watch: "write the spec" is `specify`, not `asdd`; "set the principles" is
  `constitution`; "open the PR" is `ship`; "build 01-TOOLS/02-DOCS" is `harness`. If the agent
  does the phase work itself instead of routing, that's a fail even if the output looks good.
- Because `asdd` is the front door, some phase siblings may not yet be installed. A correct
  response still routes by name and does the phase inline if the sibling is absent — it must
  never invent a phase that isn't in the chain.
- Run after any edit to `SKILL.md` or its `description`, since both axes are sensitive to wording.
