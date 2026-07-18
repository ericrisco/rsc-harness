# Evals — nlp

Routing and capability checks for a human or LLM grader, not an automated suite. Read each
`should_trigger` prompt and confirm an agent would reach for `nlp` (tokenizer choice, model-type
decision, task modeling, or metric selection); read each `should_not_trigger` prompt and confirm
it routes to the named sibling (`embeddings-search`, `rag`, `prompt-engineering`, `finetuning`,
`training-data`) for the stated reason. Grade the `capability` scenario by checking the produced
answer against every `must_include` bullet — the current API/method, the load-bearing guardrail
(tokenizer mismatch, fertility tax), and the honesty hedge (BLEU/ROUGE weak on open-ended gen,
licenses must be checked). A pass covers all routing cases plus full rubric coverage.
