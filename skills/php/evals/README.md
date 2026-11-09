# Evals — php

These cases are a behavioral spec, not an automated harness. Run them by hand: prompt a fresh
agent with each `should_trigger` line and confirm it loads the `php` skill; prompt it with
each `should_not_trigger` line and confirm it declines and routes to the named sibling
(`laravel`, `wordpress`, `security-audit`, `api-design`, `mysql`) instead of answering from
this skill. For the `capability` scenario, give the agent the scenario prompt and grade the
generated package against the `must_include` rubric — every item must be present (strict
types in each file, PSR-4 autoload, a backed enum, a readonly DTO with a property hook, a
typed exception, `phpstan.neon` at `level: max`, and zero framework coupling). `scripts/verify.sh`
is the separate code-artifact check you run inside a real PHP project root, not part of these
behavioral evals.
