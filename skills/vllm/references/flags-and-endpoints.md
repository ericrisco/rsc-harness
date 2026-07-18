# vLLM — flags, endpoints, and the LoRA runtime API

Verify flag names/defaults at author time — vLLM ships ~weekly and engine args drift. Authoritative:
[engine args](https://docs.vllm.ai/en/latest/configuration/engine_args.html),
[online serving](https://docs.vllm.ai/en/latest/serving/openai_compatible_server/),
[CLI reference](https://docs.vllm.ai/en/latest/cli/) (all accessed 2026-07).

## The `vllm serve` flags you actually reach for

| Flag | What it does | Note |
| --- | --- | --- |
| `<model>` (positional) | HF repo id **or** a local path | first download can be large; pre-stage weights on the box |
| `--host` / `--port` | bind address / port | default `0.0.0.0:8000` |
| `--api-key` | require `Authorization: Bearer <key>` | or env `VLLM_API_KEY`; **unset = open endpoint** |
| `--served-model-name` | override the id clients pass in `model` | otherwise the repo id / path is the id |
| `--tensor-parallel-size` | shard layers across GPUs on one node | must divide attention-head count |
| `--pipeline-parallel-size` | split layer stages across nodes | needs a Ray cluster for multi-node |
| `--quantization` | select quant method (`awq`, `gptq`, `fp8`, `compressed-tensors`, `bitsandbytes`, …) | often auto-detected from the checkpoint |
| `--dtype` | compute dtype (`auto`, `bfloat16`, `float16`) | `auto` follows the model config |
| `--max-model-len` | max context (prompt+output) per request | auto-derived from config if unset; **top OOM lever** |
| `--gpu-memory-utilization` | fraction of each GPU vLLM may use | default ~`0.92`; the rest-of-budget becomes KV pool |
| `--max-num-seqs` | max concurrent sequences in a batch | throughput vs latency cap |
| `--max-num-batched-tokens` | token budget per engine step | works with chunked prefill (V1) |
| `--enable-lora` | turn on LoRA serving | pair with `--lora-modules` |
| `--lora-modules` | `name=path [name=path …]` adapters to preload | route by `name` in the request `model` |
| `--max-loras` | adapters resident at once | |
| `--max-lora-rank` | max adapter rank the server accepts | **must be ≥ the trained rank** |
| `--task` | `generate` (default) / `embed` / `reward` / … | `embed` enables `/v1/embeddings` |
| `--chat-template` | override the model's chat template | needed if the checkpoint ships none |
| `--tensor-parallel-size` + `--enforce-eager` | disable CUDA-graph capture | lower memory / easier debug, slower |

`vllm serve --help` prints the full, version-correct list. Do not treat this table as exhaustive.

## Endpoint catalog

OpenAI-compatible surface (default `http://localhost:8000`):

- `POST /v1/chat/completions` — messages array; supports streaming (`"stream": true`), `tools`,
  `response_format` (JSON / guided decoding), `logprobs`.
- `POST /v1/completions` — single prompt string; legacy completion protocol.
- `GET  /v1/models` — the served model id + any loaded LoRA adapter names.
- `POST /v1/embeddings` — embedding vectors (server must be started with an embedding `--task`).

vLLM-native / operational:

- `GET  /health` — 200 + empty body when ready. **No auth.** First probe on any endpoint.
- `GET  /metrics` — Prometheus text: queue depth, running/waiting seqs, tokens/s, KV-cache usage,
  prefix-cache hit rate. Scrape this for capacity/throughput monitoring.
- `GET  /version` — server version.
- `POST /tokenize` · `POST /detokenize` — tokenizer round-trips.
- `POST /v1/load_lora_adapter` · `POST /v1/unload_lora_adapter` — runtime LoRA (see below).

### Example requests

```bash
# Chat, streaming, with an API key
curl -N http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $VLLM_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"Qwen/Qwen3-8B",
       "messages":[{"role":"user","content":"Two facts about paging."}],
       "stream":true, "max_tokens":200, "temperature":0.2}'

# Guided JSON (structured output) via response_format
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $VLLM_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"Qwen/Qwen3-8B",
       "messages":[{"role":"user","content":"Extract name and age from: Ana is 30."}],
       "response_format":{"type":"json_object"}}'
```

Field names track the OpenAI spec; vLLM adds `extra_body` params (e.g. `guided_json`, `guided_regex`,
`top_k`) documented under [sampling params](https://docs.vllm.ai/en/latest/api/inference_params.html).

## Parallelism sizing

- **Fits one GPU** → no parallelism flag. Every split costs sync overhead.
- **Too big for one GPU, fits a node** → `--tensor-parallel-size = GPUs on the node`. Wants fast
  intra-node interconnect (NVLink ≫ PCIe). Head count must be divisible by TP size.
- **Too big for a node** → add `--pipeline-parallel-size = number of nodes`; keep TP = GPUs/node.
  Example: 2 nodes × 8 GPUs → `--tensor-parallel-size 8 --pipeline-parallel-size 2`. Multi-node needs
  Ray started across the nodes first — that provisioning belongs to `runpod`/`modal`.
- Rough VRAM: `weights_bytes ≈ params × bytes_per_param` (bf16 = 2, FP8/INT8 ≈ 1, 4-bit ≈ 0.5), split
  across TP GPUs, **plus** the KV pool per GPU. Sizing which model fits which box = `open-weights`.

## LoRA runtime API

Preload at start with `--lora-modules name=path`, or manage live:

```bash
# start with runtime updates allowed
VLLM_ALLOW_RUNTIME_LORA_UPDATING=True vllm serve <base-model> --enable-lora --max-lora-rank 32

# load an adapter without restarting
curl -X POST http://localhost:8000/v1/load_lora_adapter \
  -H 'Content-Type: application/json' \
  -d '{"lora_name":"sql","lora_path":"/adapters/sql-lora"}'

# it now shows in /v1/models and is routable as "model":"sql"; unload to free it
curl -X POST http://localhost:8000/v1/unload_lora_adapter \
  -H 'Content-Type: application/json' -d '{"lora_name":"sql"}'
```

Constraints: the adapter must be for the loaded base model (same family/dims); `--max-lora-rank` must
be ≥ the rank the adapter was trained at; `--max-loras` bounds how many are resident simultaneously.
A `LoRAResolver` plugin can auto-resolve adapters from a local dir or the HF Hub — see the LoRA docs.
