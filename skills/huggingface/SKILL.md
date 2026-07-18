---
name: huggingface
description: "Use when running open models or working on the Hugging Face platform: calling a model via the Inference Providers router or InferenceClient, downloading/uploading/versioning repos on the Hub with the hf CLI, deploying a dedicated Inference Endpoint with scale-to-zero, hosting a Gradio Space with ZeroGPU, picking an open model by task/license/size, or loading a model locally with transformers. Triggers: 'call an open model through Hugging Face', 'InferenceClient embeddings', 'hf download/upload', 'write a model card', 'router.huggingface.co', 'my hf-inference serverless call 404s on a 70B model', 'scale-to-zero endpoint', 'ZeroGPU Space', 'desplegar un modelo de Hugging Face con escalado a cero'. NOT serving a model locally on your own machine (that is ollama), NOT renting and operating your own GPU box (that is runpod), NOT generating creative images via a hosted API (that is replicate-images), NOT fine-tuning with trl/peft (that is finetuning), NOT building training datasets (that is training-data)."
tags: [huggingface, inference-providers, transformers, model-hub, inference-endpoints, spaces, ai-infra]
recommends: [ollama, runpod, modal, replicate, together-fireworks, fal, rag, embeddings-search, prompt-engineering, llm-pipeline, ai-media]
origin: risco
---

# Hugging Face: Hub, routed/hosted inference, and transformers

Hugging Face is three surfaces, and you should always know which one you are on:

1. **The Hub** — versioned git repos for models, datasets, and Spaces. You search it, you
   `hf download` / `hf upload`, you read and write model cards.
2. **Inference** — three ways to actually run a model: the **Inference Providers** router
   (serverless, you own nothing), a **dedicated Inference Endpoint** (you own a deployment
   that autoscales), or **local `transformers`** (you own the machine).
3. **The catalog** — 1M+ open models you choose from by task, license, and size.

The whole skill is choosing the right surface for the job and proving it works: a 200 router
response, a live endpoint URL, a pushed repo commit. If the model is open and the workflow
lives on huggingface.co, you are in the right place. If you operate the GPU yourself, or the
vendor is not HF, stop — see the boundaries at the bottom.

## Decision: how should I run this model?

Pick the row before you write a line of code. The cheapest mistake is standing up infra you
did not need.

| Situation | Use | Why |
|---|---|---|
| Try a model now, low/dev volume, own no infra | **Inference Providers router** (`InferenceClient`) | Fastest path; monthly credits cover dev. |
| CPU task: embeddings, text-ranking, text-classification, small BERT/GPT-2 | `provider="hf-inference"` | That is exactly its remaining niche as of July 2025. |
| Big LLM (8B, 70B, 405B) through HF | router with a **partner provider** (Together/Fireworks/Cerebras/DeepInfra…) | `hf-inference` does not serve big LLMs — it will 404 or stall. |
| Steady prod traffic, need fixed latency/SLA | **dedicated Inference Endpoint** + scale-to-zero | Predictable, autoscaling, billed per minute. |
| Interactive demo or shareable GPU app | **Space** (Gradio + ZeroGPU) | Free-ish, public URL, GPU only while a call runs. |
| One-off GPU job (eval, batch convert) | `hf jobs run` | No standing infra; PRO feature. |
| Offline, data-private, or already on a GPU box | local `transformers` `pipeline()` | No network, no per-call cost. |

## Auth & install

```bash
pip install "huggingface_hub[inference]"   # 1.17.0; needs Python >=3.10
pip install transformers                    # 5.x line, PyTorch-first, optional/local
hf auth login                               # stores a token; or export HF_TOKEN=...
```

- **The CLI is `hf` now**, shaped `hf <resource> <action>` (`hf auth login`, `hf download`,
  `hf upload`, `hf repo create`, `hf jobs run`). `huggingface-cli` still runs but prints a
  deprecation warning — do not write it into new scripts.
- **Never hardcode a `hf_...` token in code** — tokens leak the moment the file hits git. Read
  from the environment instead:

```python
import os
from huggingface_hub import InferenceClient
client = InferenceClient(api_key=os.environ["HF_TOKEN"])   # never api_key="hf_xxx"
```

- Token scopes: **read** to pull public/gated repos and run inference, **write** to push,
  **fine-grained** to scope to specific repos/orgs — why: a leaked read token cannot overwrite
  your models.

## Inference Providers — the default path

One router reaches 200+ models across partner providers plus `hf-inference`; HF passes provider
cost through with **no markup**. Two equivalent entry points:

```python
# Native client — task methods, NOT the removed .post()
from huggingface_hub import InferenceClient
client = InferenceClient(api_key=os.environ["HF_TOKEN"])
out = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "One sentence on diffusion models."}],
    provider="together",          # name a partner; or omit for auto-routing
)
print(out.choices[0].message.content)
```

```python
# OpenAI-compatible — same router, drop-in for existing OpenAI code
from openai import OpenAI
client = OpenAI(
    base_url="https://router.huggingface.co/v1",   # this exact host, nothing else
    api_key=os.environ["HF_TOKEN"],
)
```

- **`InferenceClient.post()` was removed** (dropped in hub v0.31.0). Use the task methods:
  `chat.completions.create()`, `text_generation()`, `feature_extraction()` (embeddings),
  `text_to_image()`, `automatic_speech_recognition()`.
- **Credits are real and small**: Free $0.10/mo, PRO $2.00/mo, Team/Enterprise $2.00 per seat
  (shared). Past that you are pay-as-you-go and must buy credits. Budget accordingly — why: a
  chat loop on a 70B model burns the free tier in minutes.
- A **Custom Provider Key** bypasses HF billing entirely (the provider bills you; HF credits do
  not apply). For org billing, pass `bill_to="org-name"` (header `X-HF-Bill-To`).
- Full recipes (embeddings, image, ASR, streaming, rate-limit handling, the provider list) live
  in `references/inference-providers.md`.

## Hub ops

```bash
hf download meta-llama/Llama-3.1-8B-Instruct --include "*.safetensors"
hf repo create my-org/my-model --repo-type model
hf upload my-org/my-model ./out --commit-message "v1 weights"
```

```python
from huggingface_hub import snapshot_download
path = snapshot_download("BAAI/bge-small-en-v1.5")   # full repo, cached, resumable
```

- **Gated models** (Llama, Gemma, many others) need you to accept terms on the model page first,
  then a token with read access — otherwise the download 403s.
- A model card is a `README.md` with YAML front-matter (`license`, `pipeline_tag`, `tags`,
  `base_model`). Ship one on every upload — why: an uncarded repo is unsearchable and unusable by
  anyone but you. Command map and `hf jobs run` details in `references/hub-and-cli.md`.

## Choosing a model

Filter the Hub by **task + license + size + recent downloads**, then read the card before you
commit. Match the model to your constraint; do not grab whatever is trending.

- Check the **license**: Apache-2.0/MIT are permissive; Llama/Gemma carry commercial terms and
  are gated; "non-commercial"/"research-only" cards mean you cannot ship them.
- Check **size vs target**: a 70B will not fit a single A10G; an embedding model belongs on CPU.
- Check **context length** and **intended use** in the card — the headline number is not always
  the usable one.

## Dedicated Inference Endpoints — when to graduate

Move off the router when you need fixed latency/SLA, or the router's PAYG cost stops being
predictable. An Endpoint is your own autoscaling deployment.

- Pricing: CPU from ~$0.032/core/hr, GPU from ~$0.50/hr (A10G ~$1.00/hr, H100 ~$6.40–8.00/hr),
  **billed per minute** even though shown hourly.
- Enable **scale-to-zero** for bursty traffic — it parks at $0 when idle and cold-starts on the
  next request. A bursty 100–1000 req/day workload typically lands at **$20–60/mo**.
- Deploy from the UI or with `huggingface_hub` (`create_inference_endpoint(...)`). Config and a
  cost worksheet are in `references/endpoints-and-spaces.md`.

## Spaces + ZeroGPU

A Space hosts a demo app with a public URL. **ZeroGPU** grabs an H200 MIG slice (~70GB) only
while a decorated function runs, then releases it.

```python
import spaces
@spaces.GPU                       # GPU acquired for this call only
def generate(prompt: str) -> str:
    ...
```

- **ZeroGPU is Gradio-SDK only** — Streamlit/Docker/static Spaces cannot use it. PRO ($9/mo)
  gives 8x daily quota, queue priority, and up to 10 owned ZeroGPU Spaces. Details in
  `references/endpoints-and-spaces.md`.

## Local transformers

```python
from transformers import pipeline
pipe = pipeline("text-generation", model="meta-llama/Llama-3.1-8B-Instruct",
                device_map="auto", torch_dtype="auto")
print(pipe("Hello", max_new_tokens=64)[0]["generated_text"])
```

- `pipeline("task", model=...)` for quick use; `AutoModelForCausalLM.from_pretrained(...)` when
  you need control over generation/quantization. Set `device_map`/`torch_dtype` explicitly.
- Use local only when you are **offline, data-private, or already on a GPU**. Otherwise the
  router is far less ops than babysitting CUDA and weights.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `InferenceClient.post(...)` | Removed in hub v0.31.0; raises | Task methods: `chat.completions.create()`, `feature_extraction()` |
| `provider="hf-inference"` for a 70B/405B LLM | CPU niche; 404s or stalls | Route to a partner provider (Together/Fireworks/Cerebras) |
| `api_key="hf_abc123..."` in code | Token leaks in git history | Read `os.environ["HF_TOKEN"]` |
| Spin up a dedicated Endpoint just to try a model | Burns money idle | Use the router first; graduate only on real traffic |
| Assuming router calls are free/unlimited | Free tier is $0.10/mo | Budget credits; expect PAYG |
| ZeroGPU under Streamlit/Docker SDK | Unsupported, silently no GPU | Use the Gradio SDK |
| `huggingface-cli ...` in new scripts | Deprecated, warns | Use `hf ...` |
| OpenAI base URL other than `https://router.huggingface.co/v1` | Won't reach the HF router | Use that exact host |

## verify.sh

`scripts/verify.sh [TARGET]` is a static, read-only linter (no network, no token). It flags the
hard violations above — `.post(`, hardcoded `hf_` tokens, big-LLM-to-`hf-inference`, wrong router
host — and warns on legacy `huggingface-cli`. It exits 0 on a clean or empty target.
