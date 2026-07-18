# Size ↔ VRAM and quant formats — selection-time depth

This is the **"will it fit before I pick it"** estimate. The **operational** per-request KV-cache
sizing and runtime flags live in `ollama` (single box) and `vllm` (serving) — do not duplicate them
here. These numbers are rules of thumb for *choosing a size class*, not a per-model spec sheet;
confirm the real footprint with `ollama show` or the model card.

## The weights formula

```text
weights_GB ≈ params(B) × bytes_per_param
  fp16 / bf16 → 2.0     (2 GB per 1B params)
  int8 / 8-bit → ~1.0   (1 GB per 1B params)
  4-bit        → ~0.5–0.6 (≈ 0.6 GB per 1B params, conservative)

total_VRAM ≈ weights_GB + KV_cache + runtime_overhead
```

The 4-bit rate is a round number: measured k-quant rates land near ~4.9 bits/weight for Q4_K_M
(~0.6 byte/param). Round **up** when budgeting so you don't OOM. **KV cache and overhead are extra**
and grow with context length — always leave a margin above the weights figure.

### Worked examples (weights only, fp16 unless noted)

| Model | Params | fp16 | 8-bit | 4-bit |
|---|---|---|---|---|
| Small | 3B | ~6 GB | ~3 GB | ~2 GB |
| Mid | 8B | ~16 GB | ~8 GB | ~5 GB |
| Large-consumer | 32B | ~64 GB | ~32 GB | ~20 GB |
| Big | 70B | **~140 GB** | ~70 GB | ~40 GB |

**The 70B lesson:** fp16 ~140 GB does not fit any single GPU on the market for most teams. Options:
(a) **quantize** to 4-bit (~40 GB → fits one 80 GB card), accepting some quality/throughput cost; or
(b) **tensor-parallel** across multiple GPUs (e.g. 2×80 GB) to keep full precision — a `vllm` job.

## What fits which hardware class

| Hardware | fp16 ceiling (weights) | Practical pick |
|---|---|---|
| 8 GB consumer GPU | ~3B | 7–8B @ 4-bit (~5 GB) + small context |
| 12 GB | ~5B | up to ~14B @ 4-bit |
| 16 GB | ~7B | 13–14B @ 4-bit; 7–8B @ 8-bit |
| 24 GB (3090/4090) | ~10B | ~32B @ 4-bit (~20 GB) |
| 48 GB (or 2×24) | ~22B | 70B @ 4-bit is tight; better on 80 GB |
| 80 GB (A100/H100) | ~34B | 70B @ 4-bit (~40 GB), or a big MoE (gpt-oss-120b) |
| 2×80 GB+ | 70B fp16 (~140 GB) via TP | full-precision large models |
| Apple unified (e.g. 64 GB) | shares with the whole OS | budget vs **total** unified memory, not a GPU number |
| CPU / edge | — | small GGUF (≤3B) at 4-bit; slow but runs |

## MoE: total vs active params

Mixture-of-experts models (Mixtral, gpt-oss, Llama 4, big Qwen/DeepSeek) route each token through a
**subset** of experts. So a "120B" MoE might activate only ~5B params per token (fast inference) —
**but you still need VRAM to hold all experts.** Budget against **total** params for memory and
against **active** params for the speed intuition. Don't size a 120B MoE as if it were a 5B dense.

## Quant formats — pick by runtime

| Format | Runtime | Notes |
|---|---|---|
| **GGUF** | llama.cpp, Ollama, LM Studio | The local default. CPU + Apple Silicon + single GPU. Self-contained files with quant in the name. |
| **AWQ** | vLLM, TGI, transformers | Activation-aware weight quant; strong 4-bit quality for GPU serving. |
| **GPTQ** | vLLM, TGI, transformers | Older post-training quant; very widely available 4-bit. |
| **bitsandbytes (NF4/int8)** | transformers | Load-time quantization — quick for experiments and QLoRA fine-tuning. |
| **EXL2** | ExLlamaV2 | Variable bit-rate; good on consumer GPUs, flexible size/quality. |

Rule: **local/Mac/CPU → GGUF**; **GPU serving → AWQ or GPTQ**; **fine-tuning experiments → bnb NF4**.
Getting or converting to a format is a `huggingface` (convert) / `ollama` / `vllm` job.

## Decoding a GGUF quant tag

`Q4_K_M`:
- **`Q4`** — nominal ~4-bit weights.
- **`_K`** — a **k-quant**: mixed precision that keeps the more error-sensitive tensors (attention,
  some feed-forward) at higher bit-depth than the bulk. Better quality than the old flat `Q4_0`.
- **`_M`** — size/quality **tier**: `_S` (small, lower), `_M` (medium — the balanced default),
  `_L` (large, higher). There are also non-K legacy tags (`Q4_0`, `Q4_1`, `Q5_0`…).

Quality ladder (rough): `fp16` ≥ `Q8_0` (near-lossless, ~1 byte/param) > `Q6_K` > `Q5_K_M` >
**`Q4_K_M`** (standard default, ~half of fp16 for a few % loss) > `Q3_K` > `Q2_K` (noticeable
degradation). **Do not drop below Q4 to cram a too-big model onto a too-small GPU** — the quality
falls off fast and you'll often still OOM at real context. Pick a smaller model instead.

## Selection heuristic

1. Estimate weights_GB at 4-bit for the sizes you're considering.
2. Keep it **comfortably under** your VRAM (leave ~20–30% for KV cache + overhead + context).
3. If nothing that fits passes your eval, the honest options are: a better-tuned smaller model, a
   bigger box (route to `runpod`/`modal`), or `vllm` tensor-parallel — **not** sub-Q4 desperation.
