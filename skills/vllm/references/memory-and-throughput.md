# vLLM — memory, OOM, and throughput tuning

Grounded in [engine args](https://docs.vllm.ai/en/latest/configuration/engine_args.html),
[optimization/conserving memory](https://docs.vllm.ai/en/latest/configuration/optimization.html), and
the [V1 guide](https://docs.vllm.ai/en/latest/usage/v1_guide.html) (accessed 2026-07). Defaults drift
between weekly releases — verify.

## Where the VRAM goes

For each GPU:

```
usable          = gpu_memory_utilization × total_VRAM       # default utilization ≈ 0.92
KV_cache_pool   = usable − weights − activation/CUDA-graph overhead
max_concurrency ≈ KV_cache_pool ÷ (bytes_per_token × max_model_len)
```

- **Weights** are fixed once the model (and quant) is chosen; TP splits them across GPUs.
- **KV cache** is the elastic part — PagedAttention blocks allocated per active token. It grows with
  `max_model_len × concurrent sequences`. This is what runs you out of memory, not the weights.
- **Overhead** — activations, CUDA graphs, the profiling reservation vLLM makes at startup. `--enforce-eager`
  drops CUDA-graph memory (and some speed); it is a lever when you are just over the line.

`bytes_per_token` depends on layers × KV heads × head_dim × 2 (K and V) × dtype bytes. You do not
usually compute it — you observe `/metrics` (`vllm:gpu_cache_usage_perc`) and adjust.

## OOM playbook (in order)

1. **Cap `--max-model-len`** to the real max prompt+output. Going from 128K to, say, 8K multiplies how
   many sequences fit. This is the highest-leverage fix.
2. **Lower `--gpu-memory-utilization`** if OOM happens *at load* or on bursty spikes (e.g. 0.92 → 0.85).
   Counterintuitively, a lower number can stop crashes by leaving headroom for activation spikes.
3. **Lower `--max-num-seqs`** to bound concurrent sequences (and thus peak KV usage).
4. **Quantize the weights** (AWQ/GPTQ/FP8/compressed-tensors) to free VRAM for the KV pool — a memory
   win, not necessarily a speed win.
5. **Add GPUs via `--tensor-parallel-size`** so weights + KV split across devices.
6. **`--enforce-eager`** or **`--kv-cache-dtype fp8`** to trim graph/cache memory when marginally over.

If none fit, the box is too small — that is a `runpod`/`modal` sizing decision, not a vLLM flag.

## Quantization tradeoffs by regime

| Method | Weights | Typical use | Watch out |
| --- | --- | --- | --- |
| FP8 (W8A8) | 8-bit | near-lossless, good on Ada/Hopper+ | needs recent NVIDIA/AMD arch; older GPUs unsupported |
| INT8 / W8A8 | 8-bit | broad support, small quality hit | activation quant sensitive to calibration |
| AWQ / GPTQ (4-bit) | ~4-bit | max VRAM savings | quality cost real; dequant can add latency |
| compressed-tensors | varies | LLM Compressor output, mixed schemes | method-specific kernel/arch support |
| bitsandbytes | 4/8-bit | convenient, load-time quant | generally slower than dedicated kernels |

Regime that decides whether a quant *helps speed*:

- **Low batch / low concurrency** — memory-bandwidth-bound; a quant that shrinks weights can raise
  tokens/s. But dequant overhead can eat the win — measure.
- **High batch / high concurrency** — often compute-bound; a *weight-only* quant does little for
  throughput there (its win is the freed VRAM → bigger KV pool → more concurrency).

So: quantize primarily to **fit** and to **grow the KV pool**, and benchmark before claiming it is
faster. Choosing *which* quantized checkpoint to pull is `open-weights`.

## Throughput knobs (once it fits)

- **Prefix caching** (on by default in V1) reuses the KV of shared prompt prefixes — big win for repeated
  system prompts / few-shot / agent loops. Watch `vllm:prefix_cache_hit_rate` in `/metrics`.
- **Chunked prefill** (V1 default) interleaves prefill and decode so long prompts do not stall decoding.
  `--max-num-batched-tokens` sets the per-step budget.
- **`--max-num-seqs`** raises the concurrency ceiling if you have KV headroom; lowering it cuts latency.
- **Speculative decoding** (`--speculative-config …`) can raise tokens/s for a request when a draft model
  or n-gram method fits — verify current syntax in the docs; the flag shape changes.

## Measuring, not guessing

- Scrape `/metrics` for `gpu_cache_usage_perc`, `num_requests_running`/`_waiting`, `prompt`/`generation`
  throughput, and prefix-cache hit rate.
- Load-test with the bundled benchmark (`vllm bench serve` / `benchmarks/benchmark_serving.py` in the
  repo — name has moved across versions; check `vllm bench --help`) at your real concurrency and prompt
  mix. Tune `--max-model-len`, `--gpu-memory-utilization`, `--max-num-seqs` against those numbers, not a
  single-request feel.
