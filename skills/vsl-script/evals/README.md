# VSL script evaluation

Run routing in fresh sessions using only the skill description. Repeat each positive and negative
prompt three times; require at least 90% correct majority decisions across the cases. Check actual
near-miss ownership. Structural eval-lint proves only case shape and route existence.

Run the self-contained capability task with and without the skill in independent sessions and
separate temporary output directories. The baseline must not read skills or rubrics. Blind-grade
randomized outputs against every must_include item, quoting evidence, plus completeness,
actionability, correctness and grounding. Score with the catalog behavioral scorer and require
absolute >= 8.5 and lift >= 1.0. Repeat three times, retain failures and report run count.

Independently count spoken words in the final script. Timing feasibility is arithmetic; performance,
natural delivery and persuasion remain judgments. Do not report a predicted conversion lift as
evidence. These definitions claim no executed behavioral result. Re-run after method edits.
There is no grep-based publication gate: source permissions and claim support need semantic review.

## Initial evaluation — 2026-10-31

One capability scenario, one fresh execution per arm, independently blind-graded:
with skill **9.9/10**, without **9.9/10**, difference **+0.0**.
The catalog scorer requires absolute >=8.5 and improvement >=1.0. This run
passed absolute quality but did not meet the improvement threshold.
This is a single-trial result, not the repeated-trial protocol above or evidence of conversion gains.
Arms used separate contexts and files; the scorer reported transcript integrity **not checked**.
The owner authorized release 3.7.0 with the pack’s incomplete behavioral evidence documented.
The thresholds remain unchanged; release authorization is not an evaluation pass.
