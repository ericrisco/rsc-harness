---
name: together-fireworks
description: "Use when calling open-weight LLMs on Together AI or Fireworks AI's OpenAI-compatible endpoints — `base_url` plus namespaced model id, the cheapest model that clears the bar, per-1M-token cost math, serverless vs batch vs dedicated. NOT renting GPUs to self-host weights (that is `runpod`), NOT running a model locally for free (that is `ollama`)."
tags: [llm, inference, together-ai, fireworks-ai, openai-compatible, open-models, batch, cost]
recommends: [runpod, modal, ollama, huggingface, fal, cost-tracking, llm-pipeline, prompt-engineering, embeddings-search]
origin: risco
---

# together-fireworks

You run open-weight LLMs on two neutral, OpenAI-compatible hosts: **Together AI** and **Fireworks AI**. Neither trains the flagship models — they host open weights (Llama, DeepSeek, Qwen, GPT-OSS, Kimi, Mistral) behind a billed-per-token endpoint. No GPU to provision, no server to babysit. You pay for tokens.

Both speak the OpenAI wire protocol. So the entire mental model is: **same SDK, change three things — `base_url`, `api_key`, and the model id.** That is why these two providers live in one skill: the working knowledge (connect, pick a model, batch for 50% off, do the cost math) is ~90% shared. The only real differences are the base URL string and the model-id naming scheme. Learn both at once.

This skill is *where the tokens come from*. Designing the prompt is `../prompt-engineering/SKILL.md`; chaining calls into a workflow is `../llm-pipeline/SKILL.md`; tracking spend across many providers as a discipline is `../cost-tracking/SKILL.md`. Here you only do the per-model math and the endpoint plumbing.

## The two endpoints (memorize these)

| Provider | `base_url` | Model id shape | Examples (illustrative — confirm on the serverless catalog) |
|---|---|---|---|
| Together | `https://api.together.ai/v1` | `<vendor>/<model>` | `openai/gpt-oss-20b`, `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `deepseek-ai/DeepSeek-V4-Pro` |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/<name>` | `accounts/fireworks/models/gpt-oss-20b`, `accounts/fireworks/models/llama-v3p1-8b-instruct` |

The example ids show the *shape* of a valid id, not a guaranteed-live id — the catalog churns and casing matters. Before you ship any id, confirm the exact string on the provider's own catalog (docs.together.ai/docs/serverless-models, docs.fireworks.ai/serverless/pricing). A plausible-looking id that is not in the catalog 404s exactly like a typo, so an unconfirmed id is a bug, not a default.

The #1 failure is a bare model name. `model="llama-3.3-70b"` returns **404 model not found** on both — the id MUST carry its namespace prefix.

## Connect in 30 seconds

Use the official `openai` SDK. Do not install a provider-specific client unless you need a provider-only feature (Together's native Batch API, below).

```python
import os
from openai import OpenAI

# Together
together = OpenAI(
    base_url="https://api.together.ai/v1",
    api_key=os.environ["TOGETHER_API_KEY"],   # never a string literal
)
r = together.chat.completions.create(
    model="openai/gpt-oss-20b",               # namespaced — vendor/model
    messages=[{"role": "user", "content": "Classify: spam or ham?"}],
)

# Fireworks — same SDK, three things change
fireworks = OpenAI(
    base_url="https://api.fireworks.ai/inference/v1",
    api_key=os.environ["FIREWORKS_API_KEY"],
)
r = fireworks.chat.completions.create(
    model="accounts/fireworks/models/gpt-oss-120b",  # accounts/fireworks/models/<name>
    messages=[{"role": "user", "content": "Explain this stack trace."}],
)
```

```javascript
import OpenAI from "openai";

const fireworks = new OpenAI({
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY,
});

const r = await fireworks.chat.completions.create({
  model: "accounts/fireworks/models/llama-v3p1-8b-instruct", // namespaced
  messages: [{ role: "user", content: "Summarize in one line." }],
});
```

- **Bad → Good (model id):** `model="gpt-oss-120b"` → `model="openai/gpt-oss-120b"` (Together) or `model="accounts/fireworks/models/gpt-oss-120b"` (Fireworks). Why: the compat layer routes by the full namespaced id; a bare name has no route → 404.
- **Bad → Good (base_url):** `base_url="https://api.openai.com/v1"` with a Together key → auth error / wrong models. Why: a Together/Fireworks key only authenticates against its own host.
- **Bad → Good (key):** `api_key="sk-..."` literal → `api_key=os.environ["TOGETHER_API_KEY"]`. Why: a committed key is a leaked key.

`client.embeddings.create()` works identically on both for embedding models — same surface, just swap the model id.

## Pick the model

Match the task to the smallest model that clears the quality bar. Every $/1M figure below is **per 1M tokens, input/output, USD**, read directly off each **provider's own pricing page** on 2026-06-02 (Together: together.ai/pricing; Fireworks: docs.fireworks.ai/serverless/pricing) — never a tracker. Confirm the exact id string and rate at that page before you ship; casing and suffixes (`-Turbo`, `-Lite`) are load-bearing, and a plausible id absent from the catalog 404s like a typo.

Rows tagged **(projected)** are current-generation flagships whose id and price move fast and that you may not recognize from older training data — the number is the page's figure on 2026-06-02, but re-read the page before you quote one. Untagged rows are long-lived ids with stable pricing; the worked examples and defaults below lean on these on purpose.

| Task | Together id + $/1M (in/out) | Fireworks id + $/1M (in/out) |
|---|---|---|
| Cheap classify / extract / tag | `openai/gpt-oss-20b` — $0.05 / $0.20 | `accounts/fireworks/models/gpt-oss-20b` — $0.07 / $0.30 |
| Small instruct | `meta-llama/Meta-Llama-3-8B-Instruct-Lite` — $0.14 / $0.14 | `accounts/fireworks/models/llama-v3p1-8b-instruct` — 4B–16B tier, $0.20 |
| General chat | `meta-llama/Llama-3.3-70B-Instruct-Turbo` — $1.04 / $1.04 | `accounts/fireworks/models/gpt-oss-120b` — $0.15 / $0.60 |
| Reasoning / hard tasks | `deepseek-ai/DeepSeek-V4-Pro` — $2.10 / $4.40 *(projected)* | `accounts/fireworks/models/deepseek-v4-pro` — $1.74 / $3.48 *(projected)* |
| Cheaper reasoning | `Qwen/Qwen3.6-Plus` — $0.50 / $3.00 (watch output) *(projected)* | `accounts/fireworks/models/deepseek-v4-flash` — $0.14 / $0.28 *(projected)*; `kimi-k2p6` — $0.95 / $4.00 *(projected)* |
| Long context (≥512K) | `Qwen/Qwen3.6-Plus` (1M ctx) *(projected)*; `deepseek-ai/DeepSeek-V4-Pro` (512K serverless) *(projected)* | size/MoE tier — see fallback below |
| Embeddings | `intfloat/multilingual-e5-large-instruct` — $0.02 / 1M input | embeddings — $0.008–$0.10 / 1M input (by param count) |

Rules:
- **Output tokens cost 3–7× input.** A reasoning model that thinks for 2k tokens before answering is the expensive part — budget on output, not input. Qwen3.6-Plus is the trap: $0.50 in but $3.00 out.
- **Fireworks size-tiered fallback** (published on docs.fireworks.ai/serverless/pricing, applies to any model with no named price): <4B $0.10, 4B–16B $0.20, >16B (dense) $0.90, MoE ≤56B $0.50, MoE 56.1B–176B $1.20 per 1M. Use the matching tier to estimate a model not in the named list — these are the provider's own published numbers, so they hold up in a quote (still confirm the specific model's tier).
- **Default to the cheap small model and only escalate when an eval shows it fails.** Most "we need DeepSeek V4-Pro" is a gpt-oss-20b job in disguise.

Fuller catalog and embedding/fine-tuning numbers: `references/models-and-pricing.md`.

## Serverless vs Batch vs Dedicated

| Serving mode | Use when | The economics |
|---|---|---|
| **Serverless** (default) | Real-time, user-facing, bursty, low/spiky volume | Pay per token, no commitment, cold-tolerant |
| **Batch** | Offline job, no latency need, > ~1k requests | **~50% off** serverless on both providers |
| **Dedicated** GPU | Sustained high QPS, fixed latency SLA, huge volume | Pay for the GPU-hour; pays off only above a high, steady load |

Decision: **real-time → serverless. Big offline job (eval, synthetic data, bulk classify) → batch. Sustained heavy traffic with an SLA → dedicated.**

> **Gotcha — Together batch is NOT the OpenAI Batch endpoint.** Together's OpenAI-compat layer does **not** expose `/v1/batches`. Use Together's **native Batch API**: upload a JSONL file, default **24h** window, up to **50,000 requests/file**, up to **50% off**, separate rate-limit pool. Pointing the OpenAI Batch client at Together fails. Fireworks instead exposes Batch as a serving *path* through the one API (Serverless 2.0: Standard / Priority / Batch), batch = 50% of serverless. JSONL shape, the upload/poll/download flow, limits, and dedicated-deployment notes: `references/batch-and-tuning.md`.

Two more Fireworks multipliers worth knowing:
- **Cached input tokens default to 50%** of input price (text/vision models) — repeated prefixes get cheaper automatically.
- **Priority serving ≈ 1.5× Standard.** Priority is opt-in, not the default; do not budget at Priority rates unless you set it.

## Cost & latency math

Per request:

```text
cost = (in_tokens * in_price_per_1M + out_tokens * out_price_per_1M) / 1_000_000
```

Apply the multipliers: cached input → `in_price * 0.5` on the cached portion; Priority → `* 1.5`; Batch → `total * 0.5`.

Worked example — 1,000,000 input + 500,000 output tokens, one shot. Both anchors are **stable** ids (gpt-oss, Llama 3.3 70B), so the arithmetic stays checkable even after the flagship rows churn:

- **GPT-OSS 20B on Together**, serverless: `(1M*0.05 + 0.5M*0.20)/1e6 = $0.05 + $0.10 = $0.15`.
- **GPT-OSS 120B on Together**, serverless: `(1M*0.15 + 0.5M*0.60)/1e6 = $0.15 + $0.30 = $0.45` — 3× the 20B for the bigger open GPT-OSS.
- **Llama 3.3 70B on Together**, serverless: `(1M*1.04 + 0.5M*1.04)/1e6 = $1.04 + $0.52 = $1.56` — ~10× the 20B for general chat.
- Same Llama 3.3 70B job **as batch**: `$1.56 * 0.5 = $0.78`.
- Escalating to a *(projected)* reasoning flagship (e.g. DeepSeek V4-Pro at $2.10/$4.40 on the 2026-06-02 page) lands near `$4.30` serverless / `$2.15` batch — ~29× the 20B — but re-read the page before you commit to that number.

So for a large offline run the lever is *model choice first* (up to ~29×), *batch second* (2×). Pick the smallest model that passes the eval AND batch it. Realtime is only worth its premium when a human is waiting.

## Write provider-agnostic code

Drive `base_url` and `model` from env so you can switch providers (or arbitrage price) without touching code. Why: these are commodity endpoints — portability is leverage.

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url=os.environ["LLM_BASE_URL"],   # together or fireworks URL
    api_key=os.environ["LLM_API_KEY"],
)
model = os.environ["LLM_MODEL"]            # the namespaced id for that provider
```

Equivalent ids for the same underlying model:

| Model | Together id | Fireworks id |
|---|---|---|
| Llama 3.1 8B Instruct | `meta-llama/Llama-3.1-8B-Instruct-Turbo` | `accounts/fireworks/models/llama-v3p1-8b-instruct` |
| DeepSeek V4-Pro | `deepseek-ai/DeepSeek-V4-Pro` | `accounts/fireworks/models/deepseek-v4-pro` |
| GPT-OSS 20B | `openai/gpt-oss-20b` | `accounts/fireworks/models/gpt-oss-20b` |

Keep the id mapping in config, not in `if provider == ...` branches scattered through the code.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Bare model name (`llama-3.3-70b`) | 404 model not found — the route needs the namespace | Use the full `<vendor>/...` or `accounts/fireworks/models/...` id |
| Together/Fireworks key against `api.openai.com` | Auth fails / wrong model set; key only works on its own host | Set the matching `base_url` for the key you hold |
| Hardcoded API key string literal | Committed key = leaked key | `os.environ[...]` / `process.env.*` only |
| Pointing the OpenAI Batch client at Together | Compat layer has no `/v1/batches` | Together native Batch API (JSONL upload, 24h, 50k/file) |
| Serverless for a 200k-row offline eval | Pays full price for work with no latency need | Batch it — ~50% off on both |
| Budgeting at Priority rates | Priority ≈ 1.5× and is opt-in, not default | Price at Standard unless you explicitly enable Priority |
| Reaching for DeepSeek V4-Pro by reflex | ~20–30× the cost of a 20B model that may pass the eval | Start at the cheap small model; escalate only on eval failure |
| Quoting a price/id from an aggregator | Trackers lag and mis-list — e.g. DeepSeek-V3.1 shown as live on Together when it is not on the serverless catalog | Cite together.ai/pricing or docs.fireworks.ai; confirm the id on the serverless catalog before quoting |
| Treating these like free/local | They bill per token; ollama is the zero-marginal-cost path | If cost must be zero and weights run on your box → `../ollama/SKILL.md` |
| Renting GPUs to "save money" then idling them | A serverless token endpoint has no idle cost | Self-host only at sustained scale → `../runpod/SKILL.md` |

Validate any inference snippet/config with `scripts/verify.sh <file-or-dir>` — a static, no-network lint for the right base URLs, namespaced model ids, and env-var keys.
