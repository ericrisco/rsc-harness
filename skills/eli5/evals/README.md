# Evals — eli5

Two claims: that a from-zero request routes here instead of to the in-conversation visual skill or to
teaching material, and that the loaded skill produces a page a genuine beginner can follow.

## Triggering

Load only `eli5` and run every prompt in 3–5 fresh sessions. A positive passes when `eli5` loads in a
majority of trials; a negative passes when it stays quiet and the declared `route_to` skill is the
real owner. Require at least 90% accuracy.

`show-me` is the negative that matters: both are "explain it visually". The discriminator is the
reader's starting knowledge, and it must survive any description edit on either side.

## Capability

Run the scenario without the skill and with it, same topic and one grader, three trials. The
with-skill condition must satisfy at least 80% of the rubric and beat the baseline by at least 20
percentage points.

Grade the jargon point strictly: a baseline answer almost always keeps one unexplained term, which is
exactly the failure the skill exists to prevent.
