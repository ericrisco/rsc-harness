# Sales funnel evaluation

Run routing in fresh sessions using only the skill description. Repeat each positive and negative
prompt three times; require at least 90% correct majority decisions across the cases. Check that
each negative case's owner exists in the catalog. Structural eval-lint does not measure routing.

For capability, give the complete scenario to independent agents with and without the skill.
Both arms receive the same source facts and have separate temporary output directories. The
baseline must not read any skill or this rubric. Randomize output labels and have an independent
grader score every rubric item with quoted evidence and quality on completeness, actionability,
correctness and grounding. Use the catalog behavioral scorer; require absolute >= 8.5 and lift >= 1.0.
Repeat three times for a stable estimate and retain all outputs, scores and failed runs.

These are model/human judgments, not deterministic CI. Record run count and uncertainty. No
behavioral result is claimed by these case definitions. Re-run after description or method changes.
No shell checker is provided: planning truth and payment-path adequacy need the supplied scenario
and semantic review, not a grep for headings.

## Initial evaluation — 2026-10-31

One capability scenario, one fresh execution per arm, independently blind-graded:
with skill **9.8/10**, without **9.8/10**, difference **+0.0**.
The catalog scorer requires absolute >=8.5 and improvement >=1.0. This run
passed absolute quality but did not meet the improvement threshold.
This is a single-trial result, not the repeated-trial protocol above or evidence of conversion gains.
Arms used separate contexts and files; the scorer reported transcript integrity **not checked**.
The owner authorized release 3.7.0 with the pack’s incomplete behavioral evidence documented.
The thresholds remain unchanged; release authorization is not an evaluation pass.
