# finetuning evals — how to run

Routing and capability checks, not unit tests. Run the `should_trigger` prompts against your skill
router and confirm `finetuning` fires (form/behavior adaptation, method choice, pipeline, and the
overfit/forgetting/target_modules diagnostics). Run `should_not_trigger` and confirm the router
defers to the named sibling instead (`rag` for facts, `prompt-engineering` for the cheaper lever,
`open-weights` for base-model choice, `training-data` for corpus building, `vllm` for serving,
`unsloth` for the fast single-GPU backend) — a miss there means the boundary in the description
needs sharpening. For the `capability` case, hand the scenario to an agent with this skill loaded
and grade the answer against each `must_include` bullet pass/fail: the decision gate (form vs
facts), QLoRA + TRL/PEFT current API, the alpha≈2r and LR/epoch hyperparameters, the chat-template
guardrail, LIMA quality-over-quantity, held-out eval watching eval loss, KTO for unpaired feedback,
and the version/license hedge.
