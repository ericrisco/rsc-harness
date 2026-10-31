# Eval harness — `landing-copy` skill

These cases are read and run by the catalog's agent harness (a Claude Code agent
with the full skill catalog loaded for routing) plus a human spot-check — there
is no bundled shell runner, because both triggering and copy quality are
judgement calls. `scripts/verify.sh` is a separate, narrower static linter for a
*generated copy file*, not a runner for these cases.

`should_trigger` asserts that the description + body would make a router load
`landing-copy` for that prompt (run each cold, 3–5 trials, score the fraction
that load the skill). `should_not_trigger` asserts a near-miss routes to the
named real sibling instead (`ads`, `design`, `nextjs`, `ab-testing`,
`brand-voice`) — these are the known traps: a "landing page" prompt that is
actually the ad, the pixels, the build, or the experiment. `capability` is a
rubric-scored generation: run the scenario with and without the skill loaded and
grade each output against `must_include` (one point per item); the skill passes
if WITH covers >= 80% and clearly beats WITHOUT. Report raw fractions, not a
rounded pass, and re-run after any edit to `SKILL.md` or the references.

## VSL integration validation — 2026-10-31

The added offer-revision scenario and source-grounding repairs were statically reviewed.
The proof-marker regression tests exercise demonstration-only evidence and paths with spaces.
The revised skill was applied to the product README. These checks are not a fresh A/B measurement
of landing-copy quality; the capability comparisons described above remain a separate evaluation.
