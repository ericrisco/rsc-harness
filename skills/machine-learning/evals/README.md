# Eval harness — `machine-learning`

`cases.yaml` is a human/LLM-graded rubric, not an automated runner. It grades two things: **triggering**
(does the skill fire on real tabular-ML asks and stay quiet on near-misses that belong to a sibling —
`deep-learning`, `data-cleaning`, `nlp`, `forecasting`, `business-intelligence`, `training-data`?) and
**capability** (does loading the skill produce a measurably more rigorous, leak-free modeling workflow?).

To run triggering: start a fresh agent with only `machine-learning` discoverable, paste each
`should_trigger` prompt (3–5 trials each, since the decision is stochastic; pass if it fires in the
majority), and confirm each `should_not_trigger` prompt does NOT fire and would plausibly route to its
`route_to` sibling. To run capability: give the scenario to a clean agent WITHOUT the skill and again WITH
it, then grade each transcript against the `must_include` bullets — one point per bullet that is
specifically and correctly covered (the held-out test set, leakage as #1 risk, PR-AUC over accuracy on
imbalance, GBDT default + Grinsztajn, the version hedge), not merely name-dropped. WITH should clearly beat
WITHOUT. Record trial counts and per-bullet verdicts; don't report a bare pass/fail.
