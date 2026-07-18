---
name: vllm
description: "Use when self-hosting an open-weight LLM for high-throughput, concurrent serving with vLLM — running `vllm serve` as an OpenAI-compatible endpoint, splitting a model across GPUs with tensor/pipeline parallelism, loading AWQ/GPTQ/FP8/compressed-tensors quants, serving one or many LoRA adapters, or debugging KV-cache OOM from --gpu-memory-utilization / --max-model-len. Triggers: 'serve a 70B to many users at once', 'point my OpenAI client at a self-hosted model', 'split a model across 4 GPUs with tensor parallel', 'why does vllm OOM at long context', 'serve my fine-tuned LoRA adapter', 'health check my vllm server', 'servir un modelo abierto con alta concurrencia en mis propias GPUs'. NOT renting/provisioning the GPU box itself (that is runpod / modal), NOT single-user laptop inference (that is ollama), NOT a hosted inference API you do not operate (that is together-fireworks / huggingface)."
tags: [vllm, llm-serving, inference-server, tensor-parallel, quantization]
recommends: [open-weights, finetuning, runpod, modal, ollama]
origin: risco
---

# vLLM — high-throughput serving of open-weight models

vLLM is the inference **engine** you put in front of an open-weight model when many requests hit it at
once. Its job — and this skill's — is throughput under concurrency: keep the GPU busy across dozens of
simultaneous requests, not squeeze one prompt out fast. You own the `vllm serve` flags; the box those
flags run on is a `runpod`/`modal` concern.

**Why not just loop a `transformers` `generate()`?** Naive serving runs one request at a time and pads
every batch to the longest sequence, so the GPU idles. vLLM fixes both:

- **PagedAttention** stores the KV cache in non-contiguous fixed-size blocks (like OS virtual-memory
  paging), so there is almost no padding/reservation waste and long contexts pack tightly.
- **Continuous batching** admits and retires requests token-by-token instead of per-batch, so a new
  request joins the running batch immediately rather than waiting for the slowest one to finish.

Net effect: an order-of-magnitude more concurrent throughput than single-request serving. If you only
ever have one user on a laptop, that machinery is wasted — that is `ollama`, not this.

## Version & setup reality (verify at author time — vLLM ships ~weekly)

- **Latest stable is ~0.25.x (July 2026)** — releases land roughly weekly. Check
  [PyPI](https://pypi.org/project/vllm/) / [releases](https://github.com/vllm-project/vllm/releases);
  do not pin to a number you read here.
- **The V1 engine is the default since v0.8.0** and recent releases have removed the legacy V0 path,
  so treat V1 as the only engine. It runs the scheduler + core loop in a separate process and turns on
  chunked prefill and prefix caching out of the box, so you rarely tune the scheduler by hand
  ([V1 guide](https://docs.vllm.ai/en/latest/usage/v1_guide.html), accessed 2026-07). `VLLM_USE_V1`
  historically toggled it — if you see it referenced, it is legacy.
- **Install:** `pip install vllm` (default build is CUDA/NVIDIA). ROCm, CPU, TPU and other backends
  have separate install paths — see the docs' installation matrix. Needs Python + a supported GPU.
- **Auth is OFF by default.** A bare `vllm serve` is an *open* endpoint on `0.0.0.0:8000`. To require a
  bearer token, pass `--api-key <KEY>` (or set `VLLM_API_KEY`); clients then send
  `Authorization: Bearer <KEY>`. Do not expose an unauthenticated server publicly.

## `vllm serve` → an OpenAI-compatible server

```bash
vllm serve Qwen/Qwen3-8B                 # download from HF (or a local path) and serve on :8000
vllm serve /models/qwen3-8b --api-key sk-local-xyz --port 8000 --host 0.0.0.0
```

The server speaks the OpenAI wire protocol, so **any OpenAI client works unchanged** — just repoint
`base_url` and use a dummy (or your `--api-key`) key. Endpoints
([online serving docs](https://docs.vllm.ai/en/latest/serving/openai_compatible_server/), accessed 2026-07):

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/chat/completions` | chat protocol (messages array) — the usual path |
| `POST /v1/completions` | raw text completion (single prompt string) |
| `GET  /v1/models` | list the served model + any loaded LoRA adapters |
| `POST /v1/embeddings` | only for an embedding model (`--task embed`) |
| `GET  /health` | liveness — 200 when ready, **no auth, no body** |
| `GET  /metrics` | Prometheus metrics (queue depth, throughput, cache usage) |

```python
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1", api_key="sk-local-xyz")  # key = your --api-key
r = client.chat.completions.create(
    model="Qwen/Qwen3-8B",               # the id `/v1/models` reports (or a LoRA adapter name)
    messages=[{"role": "user", "content": "Name three primes."}],
)
print(r.choices[0].message.content)
```

The `model` field must match what `/v1/models` returns — the served model id or a LoRA adapter name
(below), not an arbitrary string.

## Parallelism: fit the model, then scale out

Two orthogonal knobs. Reach for parallelism only when the model does **not** fit one GPU — a model that
fits should stay on a single GPU (no split), because every split adds communication overhead.

- **`--tensor-parallel-size N`** — shard each layer's weights *across N GPUs on one node*. Use this
  first: it needs fast intra-node links (NVLink / PCIe) because GPUs sync every layer. `N` must divide
  the model's attention-head count. This is how you serve a model too big for one GPU but fitting the
  node.
- **`--pipeline-parallel-size M`** — split the model *by layer stages across M nodes*. Tolerates slower
  inter-node network. Use it when the model does not fit even a full node.

Rule of thumb from the docs
([parallelism & scaling](https://docs.vllm.ai/en/latest/serving/distributed_serving.html), accessed 2026-07):
set **tensor-parallel = GPUs per node**, **pipeline-parallel = number of nodes**.

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct --tensor-parallel-size 4          # 1 node, 4 GPUs
vllm serve <huge-model> --tensor-parallel-size 8 --pipeline-parallel-size 2    # 2 nodes × 8 GPUs
```

Multi-node needs a Ray cluster wired up first — that orchestration is a `runpod`/`modal` concern, not a
vLLM flag.

## Quantization: smaller weights ≠ automatic speedup

Quantization shrinks the weights so a model fits fewer/smaller GPUs and frees VRAM for KV cache. Select
a method with `--quantization` (often auto-detected from the checkpoint's config). vLLM supports
**AWQ, GPTQ/GPTQModel, FP8 (W8A8), compressed-tensors (LLM Compressor), INT4/INT8, bitsandbytes** and
more ([quantization docs](https://docs.vllm.ai/en/latest/features/quantization/), accessed 2026-07).

```bash
vllm serve TheModel/Qwen3-8B-AWQ --quantization awq
vllm serve neuralmagic/Model-FP8   --quantization compressed-tensors   # FP8 needs Ada/Hopper+
```

The honest tradeoffs:

- **Support is GPU-arch-specific** — FP8 W8A8 wants Ada/Hopper-class (or AMD) hardware; a method that
  is fast on one GPU may be unsupported or emulated on another. Check the compatibility table.
- **Quant is a memory win, not a guaranteed throughput win.** At **low batch / low concurrency** the
  workload is memory-bandwidth-bound and a quant can help; but dequant overhead can *cost* latency, and
  at high batch you may be compute-bound where a weight-only quant does little. Benchmark your quant on
  your hardware at your real concurrency before assuming it is faster.
- **Quality drops** — usually small for 8-bit/well-calibrated 4-bit, larger for aggressive 4-bit. Serve
  a quant to save VRAM, not as a free lunch. Picking *which* quantized checkpoint to pull is an
  `open-weights` decision.

## LoRA adapters: serve the fine-tuning output

vLLM serves LoRA adapters on top of one loaded base model, so your `finetuning`/`unsloth` output goes
live without merging or a second server
([LoRA docs](https://docs.vllm.ai/en/latest/features/lora.html), accessed 2026-07).

```bash
vllm serve meta-llama/Llama-3.2-3B-Instruct \
  --enable-lora \
  --lora-modules sql=/adapters/sql-lora legal=/adapters/legal-lora \
  --max-loras 2 \        # how many adapters resident at once
  --max-lora-rank 16     # must be >= the rank the adapter was trained at
```

Route to an adapter by naming it in the request `model` field: `"model": "sql"` hits the SQL adapter,
`"model": "meta-llama/Llama-3.2-3B-Instruct"` hits the untuned base — same server, no reload.

Load/unload at runtime with `VLLM_ALLOW_RUNTIME_LORA_UPDATING=True`, then
`POST /v1/load_lora_adapter` / `POST /v1/unload_lora_adapter`. Base + adapter must match (same family
and dims), and `--max-lora-rank` must be ≥ the trained rank or load fails.

## Memory & throughput: where OOM comes from

The two knobs that cause (and cure) most OOM
([engine args](https://docs.vllm.ai/en/latest/configuration/engine_args.html), accessed 2026-07):

- **`--gpu-memory-utilization`** (default ~**0.92**) — fraction of each GPU vLLM may claim. Weights are
  loaded, then the **rest of this budget becomes the KV-cache pool**. Raising it toward 1.0 buys more
  concurrent sequences but risks OOM from activation/CUDA-graph spikes; lower it if you get OOM at load
  or under burst.
- **`--max-model-len`** — max context (prompt + output) per request; auto-derived from the model config
  if unset. This is the single biggest OOM lever: KV cache scales with `max-model-len × concurrent
  sequences`. A model whose weights fit will still OOM if you leave the full 128K context on and let
  many long requests batch. **Cap `--max-model-len` to what you actually need.**

The mental model: `KV_pool = gpu_memory_utilization × VRAM − weights`, and
`concurrent_sequences ≈ KV_pool ÷ (bytes_per_token × context_len)`. Too-long context or too-high
utilization eats the pool. `--max-num-seqs` and `--max-num-batched-tokens` cap the batch to trade
latency vs throughput. Full KV math + an OOM playbook: [references/memory-and-throughput.md](references/memory-and-throughput.md).

## Self-host health check (no credential needed)

`/health` requires no API key, so it is the safe first probe on any endpoint you did not just start:

```bash
export VLLM_BASE_URL=http://localhost:8000
curl -fsS "$VLLM_BASE_URL/health" && echo "  up"     # 200, empty body when ready
curl -fsS "$VLLM_BASE_URL/v1/models" \
  -H "Authorization: Bearer ${VLLM_API_KEY:-sk-local}"  # confirms WHICH model/adapters are served
```

`/health` says "the server is alive"; `/v1/models` says "and it is serving the model you expect" (plus
any LoRA adapters). If `--api-key` is set, `/v1/models` needs the bearer header but `/health` never
does. During load a slow first `/health` is normal — big models take a while to page in.

## Honest alternatives — when to prefer another engine

- **Text Generation Inference (TGI)** — Hugging Face's server; reach for it if you are all-in on the HF
  ecosystem/tooling and want their supported stack.
- **SGLang** — competitive throughput with strong RadixAttention prefix-cache reuse; prefer it for
  heavy shared-prefix workloads (agents, long system prompts, structured generation).
- **TensorRT-LLM** — squeezes maximum latency/throughput on NVIDIA GPUs via compiled engines, at the
  cost of a heavier build/ahead-of-time compile step; prefer it when you must wring out every last ms
  on NVIDIA hardware and can pay the ops complexity.
- **Ollama / llama.cpp** — single-box / laptop / CPU-or-Metal, one or few users, GGUF quants,
  zero-ceremony. Prefer it when there is no concurrency to exploit — that is the `ollama` skill.

## Guardrails

- **Cap `--max-model-len`.** Leaving the full context window on is the top OOM cause; KV cache scales
  with context × concurrency ([engine args](https://docs.vllm.ai/en/latest/configuration/engine_args.html)).
- **Tune `--gpu-memory-utilization` for OOM, not throughput first.** Lower it if OOM at load/burst;
  raise it (carefully) for more concurrency. It is a fraction of *one* GPU's memory.
- **A model that fits one GPU should stay on one GPU.** Tensor parallelism adds sync overhead — use it
  to *fit*, not to speed up an already-fitting model.
- **Quant is a VRAM win, not free speed**, and its quality cost is real — verify throughput at your
  concurrency and quality on your task ([quantization](https://docs.vllm.ai/en/latest/features/quantization/)).
- **Never expose an unauthenticated server.** No `--api-key` = open endpoint on `0.0.0.0:8000`.
- **`--max-lora-rank` must be ≥ the adapter's trained rank**, and base + adapter must match, or the LoRA
  fails to load.
- **This is not a laptop tool.** No GPU / one user → `ollama`. The GPU box + autoscaling → `runpod` /
  `modal`.

## Related skills

- **`open-weights`** — choose the model/size/license/quant to serve. vLLM runs it; it does not pick it.
- **`finetuning`** (and single-GPU **`unsloth`**) — produce the LoRA adapter or merged weights that
  `--enable-lora`/`vllm serve` then hosts. They train; vLLM serves.
- **`runpod`** — rent/provision the GPU box vLLM runs on (bring-your-own-container GPU rental).
- **`modal`** — serverless GPU containers + autoscaling around a vLLM process. The *box and scaling*,
  vs vLLM the *engine*.
- **`ollama`** — the single-user / laptop counterpart. No concurrency to exploit → use it, not vLLM.
- Hosted inference you do not operate → `together-fireworks` / `huggingface` (you call an API; here you
  run the server).

## Checklist

- [ ] Chose vLLM because there is **concurrency** to exploit (else `ollama` / a hosted API).
- [ ] `vllm serve <model>` up; `/health` returns 200 and `/v1/models` shows the expected model.
- [ ] `--api-key` (or `VLLM_API_KEY`) set if the endpoint is reachable beyond localhost.
- [ ] Parallelism only if the model does not fit one GPU: TP = GPUs/node, PP = nodes.
- [ ] `--max-model-len` capped to real need; `--gpu-memory-utilization` set with OOM headroom.
- [ ] Quant chosen for VRAM fit and benchmarked at real concurrency (not assumed faster).
- [ ] LoRA: `--max-lora-rank` ≥ trained rank; adapter reachable by name via the `model` field.
- [ ] Client points at `base_url=<server>/v1`; `model` matches a `/v1/models` id.

## References

- [references/flags-and-endpoints.md](references/flags-and-endpoints.md) — the load-bearing `vllm serve`
  flags, the full endpoint catalog with example requests, parallelism sizing, and the LoRA runtime API.
- [references/memory-and-throughput.md](references/memory-and-throughput.md) — KV-cache math, the OOM
  playbook, quantization tradeoffs at different batch sizes, and throughput-tuning knobs.
