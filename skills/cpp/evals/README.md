# Eval harness — `cpp` skill

These cases are run by the rsc skill-eval harness (a Claude agent with the full skill catalog
loaded), or read manually. They measure two things: **triggering** — that the `cpp` skill's
description fires on each `should_trigger` prompt and stays quiet on the `should_not_trigger`
near-misses, routing each of those to the named real sibling (`rust`, `security-audit`,
`deployment`, `go`, `harness`) instead; and **capability** — that, with `SKILL.md` and its
references loaded, a graded model's generated C++ satisfies the `capability.must_include` rubric
(RAII over raw resources, smart-pointer ownership, no `new`/`delete`, target-based CMake with
warnings-as-errors, an ASan+UBSan build) and beats the no-skill baseline by a clear margin. Run
3–5 trials per prompt since LLM routing is non-deterministic; a prompt passes on a majority. No
network is needed — the capability rubric is judged by reading the output against the points, and
the verify.sh gate (compile under sanitizers + ctest) is exercised separately against a real
project, not as part of these cases.
