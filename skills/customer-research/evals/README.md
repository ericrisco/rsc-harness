# customer-research evaluation

`cases.yaml` separates routing from capability. These are judgment evaluations, not deterministic proof of commercial performance.

## Routing

Present only the skill description plus the competing catalog descriptions to a fresh agent. Run each positive and negative prompt in three fresh trials. A case passes when the majority selects the intended owner; target at least 90% accuracy across cases. Inspect ambiguous cases rather than broadening the description to catch everything.

## Capability

Run each complete scenario in fresh isolated sessions: baseline without this skill or its rubric, treatment with this skill. Both receive identical source facts and permitted tools. Keep the repository read-only and save outputs outside tracked files. Use three trials for a release evaluation; retain the actual outputs and session/tool records.

Blind the arm labels before an independent grader reads the outputs. Grade each `must_include` item with an exact supporting excerpt, then completeness, actionability, correctness and grounding on 0–10. Use the repository's `scripts/skill-behavior-eval.js` scorer: treatment absolute score must be at least 8.5 and lift over baseline at least +1.0. Run transcript integrity checks where available; absence of such checks is a reported limitation, never an integrity pass.

The structural linter checks YAML shape and routes. It cannot determine whether an inference is warranted, a promise feasible or a permission sufficient. No `verify.sh` claims to do that. Neither a judge score nor a well-formed brief proves sales lift. Test changed descriptions and bodies again; record actual results separately from these instructions.

## Initial evaluation — 2026-10-31

One capability scenario, one fresh execution per arm, independently blind-graded:
with skill **9.8/10**, without **9.6/10**, difference **+0.2**.
The catalog scorer requires absolute >=8.5 and improvement >=1.0. This run
passed absolute quality but did not meet the improvement threshold.
This is a single-trial result, not the repeated-trial protocol above or evidence of conversion gains.
Arms used separate contexts and files; the scorer reported transcript integrity **not checked**.
The owner authorized release 3.7.0 with the pack’s incomplete behavioral evidence documented.
The thresholds remain unchanged; release authorization is not an evaluation pass.
