# Evals for the `training-data` skill

Routing + capability checks read from `cases.yaml` by the skill eval harness — no network, no
model calls, nothing to install. The `should_trigger` prompts must select this skill: they cover
format-by-trainer (DPO), converting raw pairs to `messages`, the non-obvious "model never stops /
I hand-formatted the chat tokens" template-mismatch case, synthetic-data + dedup, decontamination
against benchmarks, and a Catalan quality-filtering prompt. The `should_not_trigger` prompts must
route to the named real sibling instead — `data-cleaning` (tabular rows), `embeddings-search`
(retrieval corpus), `finetuning` / `unsloth` (running the trainer + export), `prompt-engineering`
(inference prompt craft). The single `capability` case is a rubric: a good answer to the
support-transcript scenario must hit every `must_include` bullet — the messages/JSONL shape, chat-
template rendering via `apply_chat_template`, dedup + decontamination, LIMA quality-over-quantity,
and the license/provenance + distillation-ToS guardrail.
