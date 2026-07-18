# vllm evals

- `should_trigger`: concurrent self-hosted serving jobs vLLM owns — `vllm serve` as an OpenAI-compatible
  endpoint, tensor parallelism, serving a LoRA adapter, and KV-cache OOM debugging (incl. a Spanish phrasing).
- `should_not_trigger`: routes the box/provisioning to `runpod`, autoscaling to `modal`, laptop/single-user
  to `ollama`, model/quant selection to `open-weights`, hosted APIs to `together-fireworks`, and training to `finetuning`.
- `capability`: asserts a full serve command surfaces the OpenAI-compat endpoints, tensor parallelism for a
  node-sized model, LoRA flags with the rank constraint, the max-model-len/gpu-memory-utilization OOM guardrail,
  auth + health check, and the boundary/version hedge.
