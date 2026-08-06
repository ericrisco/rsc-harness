# Evals — bro

These cases test two different claims: that human-language requests route to `bro` without
stealing adjacent writing jobs, and that the loaded skill produces a more natural result without
changing the payload.

## Triggering

Load only `bro` and run every `should_trigger` and `should_not_trigger` prompt in 3–5 fresh
sessions. A positive passes when `bro` loads in a majority of trials. A negative passes when it
stays quiet; also check that the declared `route_to` skill is the genuine owner. Require at least
90% accuracy across all cases.

## Capability

Run the capability scenario in two fresh conditions: without `bro`, then with it. Use the same
source answer and one consistent grader. Score each `must_include` point over three trials. The
with-skill condition must satisfy at least 80% of the rubric and beat the baseline by at least 20
percentage points.

This is an LLM/human-judged A/B eval, not deterministic CI. Re-run it after changing either the
description or the body; routing and prose quality are both wording-sensitive.
