# Inference Providers — client recipes & routing

The router (`https://router.huggingface.co/v1`, or `InferenceClient`) is the unified, serverless
entry point — formerly "Inference API (serverless)". One token reaches 200+ models across partner
providers (Cerebras, Together, Fireworks, Replicate, DeepInfra, Public AI, …) plus `hf-inference`.
HF passes the provider's price through with **no markup**.

All snippets read the token from `os.environ["HF_TOKEN"]` — never hardcode `hf_...`.

## Chat / LLM

```python
import os
from huggingface_hub import InferenceClient

client = InferenceClient(api_key=os.environ["HF_TOKEN"])
resp = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "Explain MoE in one line."}],
    provider="together",      # omit to let HF auto-route to an available provider
    max_tokens=256,
)
print(resp.choices[0].message.content)
```

Streaming:

```python
for chunk in client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct",
    messages=[{"role": "user", "content": "Count to five."}],
    stream=True,
):
    delta = chunk.choices[0].delta.content
    if delta:
        print(delta, end="", flush=True)
```

## Embeddings (feature_extraction)

```python
vecs = client.feature_extraction(
    "Retrieval-augmented generation grounds answers in sources.",
    model="BAAI/bge-small-en-v1.5",
    provider="hf-inference",   # embeddings are a CPU task — hf-inference is correct here
)
# vecs is a numpy array of shape (dim,) or (n_tokens, dim) depending on the model
```

## Text-to-image

```python
image = client.text_to_image(
    "a minimalist line drawing of a fox",
    model="black-forest-labs/FLUX.1-dev",
    provider="replicate",
)
image.save("fox.png")   # returns a PIL.Image
```

## Speech-to-text (ASR)

```python
text = client.automatic_speech_recognition(
    "sample.flac",
    model="openai/whisper-large-v3",
)
print(text.text)
```

## OpenAI-compatible drop-in

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://router.huggingface.co/v1",   # exact host; anything else won't route
    api_key=os.environ["HF_TOKEN"],
)
resp = client.chat.completions.create(
    model="meta-llama/Llama-3.1-8B-Instruct:together",  # optional :provider suffix
    messages=[{"role": "user", "content": "hi"}],
)
```

## Provider selection & the hf-inference niche

- `provider="auto"` (default when omitted) routes to an available partner for the model.
- Name a partner explicitly (`together`, `fireworks-ai`, `cerebras`, `replicate`,
  `deepinfra`, …) when you need a specific backend's pricing or features.
- **`hf-inference`** (the old serverless API) as of July 2025 focuses on CPU tasks: embeddings,
  text-ranking, text-classification, and small historic LLMs (BERT, GPT-2). Do **not** route a
  big LLM there — it 404s or stalls. Send 8B/70B/405B chat to a partner provider.

## Billing & org headers

- Monthly Inference-Providers credits: **Free none** (buy credits first), **PRO $2.00**, **Team/Enterprise $2.00 per
  seat** (shared across the org). Past credits → pay-as-you-go (you must purchase credits).
- A **Custom Provider Key** (your own key for a partner) bypasses HF billing — the provider bills
  you directly and HF credits do not apply.
- Bill an organization instead of your personal account:

```python
client = InferenceClient(api_key=os.environ["HF_TOKEN"], bill_to="my-org")
# or, with the OpenAI client, set the header:  X-HF-Bill-To: my-org
```

## Errors & rate limits

- `402` / out-of-credits → buy credits or switch to a Custom Provider Key.
- `404` on a big LLM via `hf-inference` → wrong provider; pick a partner.
- `429` rate limit → back off and retry with jitter; the router does not retry for you.
- Always read the token from env and catch `huggingface_hub.errors.HfHubHTTPError` to surface the
  provider's message.
