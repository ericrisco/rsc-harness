---
name: ollama
description: "Use when running open-weight LLMs locally with Ollama — pulling and tagging models, calling the local API, picking a quantization or GGUF, writing Modelfiles, and sizing VRAM and RAM for the machine at hand. NOT remote or managed GPU serving and autoscaling (that is `runpod`), NOT downloading raw weights or datasets (that is `huggingface`), NOT retrieval pipeline design (that is `rag`)."
tags: [ollama, local-llm, gguf, quantization, self-hosted-inference]
recommends: [huggingface, runpod, modal, llm-pipeline, rag]
origin: risco
---

# Ollama — run open-weight LLMs on one box

Ollama serves GGUF models from a local daemon at `http://localhost:11434`, exposing both a native
HTTP API and an OpenAI-compatible layer. Your job: reach for the right command, the right endpoint,
and the right quant **for the hardware in front of you** — and recognize when the model does not fit
and the work belongs on a remote GPU instead.

This skill owns: install/serve, pull/tag, the local API (native + OpenAI-compat), Modelfiles,
quantization choice, and VRAM/RAM sizing on a single machine.

## When to use / when not

**Use when** the model runs on *this* machine: pulling/running a model, fixing an OOM, choosing
Q4 vs Q8, authoring a Modelfile, or wiring an app to `localhost:11434`.

**Go elsewhere when:**

- Hosting behind a managed/remote GPU, autoscaling, or serverless inference → `runpod`, `modal`,
  `replicate`, `together-fireworks`, `fal`. Ollama is local, single-box, no autoscale.
- Downloading raw weights, datasets, `hf`/`transformers`, repo management → `huggingface`.
- Designing chunking / retrieval / reranking around a model → `rag` or `embeddings-search`.
- Orchestrating multi-step calls, routing, pipeline evals → `llm-pipeline` / `agent-eval`.
- Writing the prompt/system-message *content* itself → `prompt-engineering`.

(Those siblings live in the catalog by id; link them only once their `SKILL.md` exists on disk.)

## Quickstart

```bash
ollama serve                 # start the daemon (a desktop install already runs it)
ollama pull qwen3:8b         # download a model + tag; :8b is explicit — avoid bare :latest
ollama run qwen3:8b          # interactive REPL, or: ollama run qwen3:8b "summarize this"
ollama ps                    # what is LOADED in VRAM right now + when it unloads (keep_alive)
ollama list                  # what is on disk (pulled), not what is loaded
ollama show qwen3:8b         # template, params, context length, quant of a model
ollama rm qwen3:8b           # free disk; ollama stop qwen3:8b unloads from memory
```

`ps` vs `list` is the OOM-debug split: `list` is disk, `ps` is memory. A model only eats VRAM once a
request loads it; it unloads after `keep_alive` (default 5m).

## Pick a model + quant

Quantization trades VRAM for quality. The everyday default is **Q4_K_M**: roughly half the memory of
fp16 for ~3–5% quality loss. **Q8_0** is near-lossless at ~1 byte/param. **fp16** is the unquantized
ceiling at 2 bytes/param.

Sizing formula (weights only) — a **rule of thumb**, not a per-model spec sheet:

```text
weights_GB ≈ params(B) × bytes_per_param × 1.2   # ×1.2 = runtime overhead
bytes_per_param:  Q4_K_M ≈ 0.5   Q8_0 ≈ 1.0   fp16 = 2.0
# then ADD the KV cache (see below) — it is NOT in this number.
```

These bytes/param are conservative round-downs of the measured k-quant rates: llama.cpp's quantize
benchmark reports Q4_K_M ≈ 4.89 bits/weight (~0.6 byte/param) and Q8_0 ≈ 8.5 bits/weight (~1.06
byte/param) on Llama-3.1-8B ([llama.cpp quantize README](https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md),
accessed 2026-06-02). Rounding to 0.5 / 1.0 keeps the estimate on the safe side; the per-row GB figures
in the table below are derived from this formula, not vendor-published numbers — verify with `ollama show`.

| VRAM / unified mem | Comfortable choice (Q4_K_M) | Notes |
| --- | --- | --- |
| 8 GB | 7–8B Q4_K_M (~5–6 GB) | leave headroom for KV cache + the OS |
| 12 GB | up to ~14B Q4_K_M (~9–10 GB) | 7–8B at Q8_0 also fits |
| 16 GB | 14B Q4_K_M comfortably; 32B is tight | 32B Q4_K_M ≈ 20 GB — won't fit |
| 24 GB | 32B Q4_K_M (~20 GB) | 70B does **not** fit at any usable quant |
| 48 GB+ / 2×24 GB | 70B Q4_K_M (~40–48 GB) | needs the full budget; long context pushes over |
| Mac unified (e.g. 64 GB) | weights share RAM with everything else | budget against total unified memory |

**KV cache is the trap.** It grows ~linearly with `num_ctx` and lives in VRAM *on top of* the weights.
At long context (e.g. 128K) a 70B can add tens of GB of cache — often more than people budget for. If
you are tight: cap `num_ctx`, or shrink the cache with `OLLAMA_KV_CACHE_TYPE=q8_0` (or `q4_0`). See
[references/hardware-sizing.md](references/hardware-sizing.md) for the KV math and a per-context table.

Ollama runs a llama.cpp-backed engine (GGUF) by default, with a scheduler that reduces OOM crashes and
improves multi-GPU placement. On Apple Silicon it can use an **MLX** backend (shipped in Ollama 0.19,
per [ollama.com/blog/mlx](https://ollama.com/blog/mlx), 2026-03-30), but **only on Macs with >32 GB of
unified memory** — below that gate it stays on the llama.cpp engine. None of this invents memory you
don't have: when the box can't hold the model, that's a `runpod`/`modal` job, not a quant downgrade.

## The API

Two surfaces, same daemon. Use **native `/api/chat`** when you want Ollama-specific fields
(`keep_alive`, `format` as a JSON schema, `think`); use the **OpenAI-compat `/v1`** layer to reuse an
existing OpenAI SDK unchanged.

Native chat (`/api/chat`), non-streaming:

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:8b",
  "messages": [{"role": "user", "content": "Name three primes."}],
  "stream": false,
  "options": {"temperature": 0.2, "num_ctx": 8192},
  "keep_alive": "10m"
}'
```

`stream` defaults to **true** (NDJSON, one object per line, final object has `done: true` + timing
stats). `options.num_ctx` sets the context window *for this request* — it does not persist; bake it
into a Modelfile if you want it permanent.

OpenAI-compatible — point any OpenAI SDK at `localhost:11434/v1` with a dummy key:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")  # key is ignored
resp = client.chat.completions.create(
    model="qwen3:8b",
    messages=[{"role": "user", "content": "Name three primes."}],
    temperature=0.2,
)
print(resp.choices[0].message.content)
```

Structured output — pass a JSON schema as `format` (native) so the model is constrained to valid JSON:

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "qwen3:8b",
  "messages": [{"role": "user", "content": "Extract name and age from: Ana is 30."}],
  "stream": false,
  "format": {
    "type": "object",
    "properties": {"name": {"type": "string"}, "age": {"type": "integer"}},
    "required": ["name", "age"]
  }
}'
```

Tool calling (`tools`), multimodal (`images` as base64), embeddings (`/api/embed`), and the full field
tables live in [references/api.md](references/api.md). Endpoint map at a glance: `/api/generate`,
`/api/chat`, `/api/embed`, `/api/create`, `/api/pull`, `/api/show`, `/api/ps`, `/api/tags`.

## Modelfiles

A Modelfile bakes a base model + system prompt + parameters into a new named model. Build with
`ollama create`.

```dockerfile
FROM qwen3:8b
SYSTEM "You are a terse senior code reviewer. Answer in bullet points."
PARAMETER num_ctx 16384
PARAMETER temperature 0.2
PARAMETER stop "<|im_end|>"
```

```bash
ollama create reviewer -f Modelfile     # now: ollama run reviewer
```

- `FROM` is required — a model tag or a local file (`FROM ./model.gguf` to import a raw GGUF).
- `PARAMETER num_ctx` makes the context window permanent (vs the per-request `options.num_ctx`).
- `SYSTEM`, `TEMPLATE`, `LICENSE`, `ADAPTER` (LoRA) round out the instruction set.

Quantize on create from an fp16/fp32 source:

```bash
ollama create reviewer --quantize q4_K_M -f Modelfile   # FROM must be an fp16/fp32 model
```

`--quantize` only works when the `FROM` source is full-precision; you cannot re-quantize an
already-Q4 model. To go from Hugging Face weights to a GGUF in the first place, that conversion is a
`huggingface` job — Ollama imports the result.

## When to leave the box

If the comfortable-choice row for your VRAM can't hold the model you actually need (e.g. you need 70B
quality on a 12 GB laptop), stop downgrading quant — quality collapses below Q4 and you'll still OOM at
real context. Move it to a remote GPU: `runpod` (rent a GPU), `modal` (serverless container + GPU
autoscale), or a hosted endpoint (`replicate`, `together-fireworks`, `fal`). Ollama is the right tool
*until the weights + KV cache exceed the single box*.

## Anti-patterns

| Bad | Good | Why |
| --- | --- | --- |
| Pull fp16 on a box that only fits Q4 | Pull Q4_K_M (or Q8_0 if it fits) | fp16 is 4× the VRAM of Q4 for ~3–5% quality; you'll OOM for nothing |
| `num_ctx: 128000` on a 12 GB GPU | Cap `num_ctx` to what fits; `OLLAMA_KV_CACHE_TYPE=q8_0` | KV cache scales with context and sits on top of weights — long context dwarfs the model |
| `/api/generate` for a chat with history | `/api/chat` with a `messages` array | `generate` is single-turn; you'd hand-concatenate history and break the chat template |
| `ollama pull mistral:latest`, assume it's small | Pin an explicit tag (`:7b`, a quant tag) and `ollama show` it | `:latest` size/quant drifts release to release; sizing breaks silently |
| Treat Ollama as a multi-tenant prod server | Use it local/single-box; scale → `runpod`/`modal` | one daemon, limited parallelism (`OLLAMA_NUM_PARALLEL`); not built for fleet serving |
| Hardcode `api.openai.com` when target is local | `base_url="http://localhost:11434/v1"`, dummy key | the OpenAI SDK works unchanged against the compat layer; no remote calls, no key leak |
| Downgrade to Q2 to force a 70B onto 12 GB | Pick a model that fits, or move to a remote GPU | sub-Q4 quality drops sharply *and* it still won't fit at real context |
| Assume `ollama list` means it's loaded | `ollama ps` for memory, `list` for disk | a pulled model uses 0 VRAM until a request loads it |

## Verify

Run `scripts/verify.sh [TARGET]` from your project root (or a dir holding a `Modelfile`). Static by
default — it needs neither Ollama installed nor a running daemon. It lints a `Modelfile` (FAIL if no
`FROM`; WARN on unknown instructions or a `num_ctx` so high it will OOM consumer GPUs), notes whether
app code points at the local `localhost:11434` / `/v1` endpoint vs only-remote hosts, and — only if
`ollama` is on PATH — best-effort confirms a model is present (WARN, not FAIL). It exits non-zero
**only** on a real FAIL; an empty/clean target passes.

## References

- [references/api.md](references/api.md) — full endpoint catalog, request/response field tables,
  OpenAI-compat path mapping, structured output, tool calling, streaming, embeddings (curl + Python).
- [references/hardware-sizing.md](references/hardware-sizing.md) — the full quant ladder, VRAM formula
  derivation, KV-cache math + per-context table, per-model chart, Apple Silicon unified-memory notes,
  and the env knobs (`OLLAMA_KV_CACHE_TYPE`, `OLLAMA_FLASH_ATTENTION`, `OLLAMA_NUM_PARALLEL`,
  `OLLAMA_MAX_LOADED_MODELS`) for fitting tight boxes.
