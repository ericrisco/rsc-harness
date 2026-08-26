# Evals — show-me

Two claims are under test: that "show me / I don't get it / draw me" routes here without stealing
design, deck or beginner-explainer work, and that the loaded skill answers with **one** well-chosen
visual instead of more prose.

## Triggering

Load only `show-me` and run every `should_trigger` and `should_not_trigger` prompt in 3–5 fresh
sessions. A positive passes when `show-me` loads in a majority of trials. A negative passes when it
stays quiet and the declared `route_to` skill is the genuine owner. Require at least 90% accuracy.

The negatives that matter most are `eli5` and `design-loop`: both are adjacent enough that a sloppy
description pulls them in. Re-run these two after any description edit.

## Capability

Run the scenario in two fresh conditions, without the skill and with it, same source discussion and
one grader. Score each `must_include` point over three trials. The with-skill condition must satisfy
at least 80% of the rubric and beat the baseline by at least 20 percentage points.

The discriminating point is **form choice**: a baseline answer typically produces prose plus a
generic box diagram. Count "picked one form, and the right one" strictly.
