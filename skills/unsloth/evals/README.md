# Evals for the `unsloth` skill

`cases.yaml` is a routing + capability fixture, not an automated harness. For each `should_trigger`
prompt, confirm the router picks `unsloth` (fast low-VRAM single-GPU fine-tuning + GGUF export). For
each `should_not_trigger`, confirm it routes to the named sibling — method choice to `finetuning`,
dataset to `training-data`, running the GGUF to `ollama`, throughput serving to `vllm`, base-model
choice to `open-weights` — and not here. For the `capability` case, check the answer covers every
`must_include` bullet: the from_pretrained→get_peft_model→SFTTrainer flow, response-only masking, GGUF
export + the ollama handoff, the hedged speed/VRAM claim, and the single-GPU guardrail. No GPUs or
network needed.
