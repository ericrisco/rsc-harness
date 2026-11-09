# Eval harness — `python` skill

These cases are read by an **agent harness** (a Claude agent with the skill catalog loaded),
not a plain shell script. `cases.yaml` is the fixture; this file is the procedure. Two things
are measured: **triggering** (does `python` fire on language-level prompts and stay silent on
near-misses that belong to `fastapi`, `testing-py`, `django`, `security-audit`, `deployment`?)
and **capability** (does loading the skill make a scaffold answer measurably better?).

**Triggering:** load the full sibling descriptions, start a fresh session per prompt, feed each
`should_trigger.prompt` and confirm `python` fires; feed each `should_not_trigger.prompt` and
confirm it routes to the stated `route_to` and does *not* fire `python`. LLM routing is
non-deterministic — run 3–5 trials each and pass on the majority; target ≥90% accuracy.

**Capability:** run the `capability.scenario` twice — once with the skill body unavailable, once
with `python/SKILL.md` (and references) loaded — and grade each output against the `must_include`
rubric (fraction of points present and correct, averaged over 3 trials). Pass bar: ≥80% with the
skill, and a clear margin over the without-skill baseline. No network is required; grading is
rubric-based and partly judgment (e.g. "no mutable default argument"). Keep `cases.yaml` faithful
to SKILL.md's "When to use / When NOT to use" — change them together.
