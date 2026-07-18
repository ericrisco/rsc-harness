# Evals — deep-learning

Routing and capability checks for a human or LLM grader, not an automated test suite. To run them:
read each `should_trigger` prompt and confirm an agent would reach for `deep-learning` (PyTorch
training/loop/AMP/distributed/reproducibility); read each `should_not_trigger` prompt and confirm it
routes to the named sibling (`finetuning`, `machine-learning`, `nlp`, `vllm`, `python`) for the
stated reason. Then grade the `capability` scenario against every `must_include` bullet — the
correct five-step loop with per-step `zero_grad`, AMP with the bf16/fp16 + scaler rule, `model.eval()`
+ `no_grad()` at validation, AdamW + warmup→cosine, checkpoint hygiene, and the "determinism is not
guaranteed across releases/platforms/devices" caveat. A pass covers all routing cases plus full
rubric coverage on the capability scenario.
