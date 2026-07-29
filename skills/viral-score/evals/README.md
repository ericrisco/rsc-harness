# Evals — viral-score

These are routing and capability checks, not an automated harness. Run them by hand:
read each `should_trigger` prompt and confirm the skill fires on it — including the two
non-obvious ones ("this clip feels flat but I can't say why" and the retrospective "why
did this short underperform"), which carry no scoring keyword, and the Spanish prompt;
read each `should_not_trigger` prompt and confirm the description's NOT-boundary sends it
to the named `route_to` sibling instead. The neighbours are close together, so the
packaging / ideation / editing / strategy split is the part most worth checking.

For the `capability` cases, score the described clip for real and check the answer hits
every `must_include` line. The first case exists because penalties are the step most often
skipped: an opener mid-sentence, a 4s pause and an unresolved ending must each subtract,
and the total must be clamped after they do. The second checks that batch mode produces
what a single-clip run does not — a ranking and an explicit cut-off. No network, no
fixtures.
