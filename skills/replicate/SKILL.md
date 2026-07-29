---
name: replicate
description: "Use when running, packaging, deploying or scaling a model on the Replicate platform from code — blocking run versus async predictions, handling FileOutput, deployments with warm private endpoints and autoscaling, packaging with Cog, verifying webhook signatures, and cutting GPU spend. NOT crafting image prompts and parameters or picking image model families (that is `replicate-images`)."
tags: [replicate, cog, deployments, webhooks, model-serving, gpu, ai-infra]
recommends: [replicate-images, modal, runpod, huggingface, webhooks, cost-tracking, docker]
origin: risco
---

# Replicate platform operations

This skill is about **how a model runs in production on Replicate** — clients, async, deployments,
Cog packaging, webhooks, scaling, and spend. It is the platform-engineering counterpart to image
prompt craft. If the question is *what prompt, aspect ratio, or model family produces a good image*,
that is `replicate-images`, not this skill. Here the mental model is: **a prediction is a job. You
either wait for it, poll it, or get pinged about it — and where it runs (shared cold pool vs a private
warm deployment) is a cost-and-latency dial you set deliberately.**

Pinned facts (verified 2026-06-02): Python client `replicate` 1.x (latest 1.0.7), Python 3.8+;
JS client `replicate` on npm; auth via `REPLICATE_API_TOKEN`. A `2.0.0aN` alpha exists on PyPI but
is NOT the default — pin `replicate>=1,<2` so a fresh install never silently pulls it.

## Decision: how should this model run?

Pick the row by latency tolerance and whether your process can block. Do not default to `run()` for
everything — a 10-minute job inside a web request will time out and burn a worker.

| Pattern | Latency | Blocks your process? | Cost shape | Use when |
|---|---|---|---|---|
| `replicate.run(...)` | seconds | Yes — waits to completion | per-prediction, shared pool | interactive/quick calls, scripts, CLIs |
| `predictions.create()` + poll | minutes | Yes, but you control the loop | per-prediction, shared pool | long job, a worker can babysit it |
| `predictions.create(webhook=...)` | minutes+ | No — fire and forget | per-prediction, shared pool | long job, the request must return now |
| Deployment (private endpoint) | low + steady | depends on call style above | warm floor + per-prediction | sustained traffic, need warm/private/autoscale cap |

Rule: if a human or HTTP request is waiting longer than a few seconds, do not block on `run()` —
switch to predictions + webhook. Why: synchronous timeouts kill the request but the GPU job keeps
running and billing.

## Auth & install

```bash
export REPLICATE_API_TOKEN=r8_...           # clients read this env var automatically
pip install 'replicate>=1,<2'               # pin: 2.0.0aN is alpha; unpinned can pull it
npm install replicate                        # Node client
```

Python 3.8+ is required. Never `pip install replicate` unpinned in a Dockerfile or requirements
file — a rebuild months later can resolve to the 2.0 alpha and break your imports. Why: the alpha is
a full Stainless/httpx rewrite with a different surface.

## Run a model

```python
import replicate

output = replicate.run(
    "black-forest-labs/flux-schnell",
    input={"prompt": "a red bicycle", "num_outputs": 1},
)
```

Since client 1.0.0, file outputs come back as **`FileOutput`** objects, not URL strings. Treating one
as a string is the single most common bug.

```python
# Bad — output[0] is a FileOutput, not a str; this writes the repr, not the bytes
open("out.png", "w").write(output[0])

# Good — read the bytes, or take the URL explicitly
with open("out.png", "wb") as f:
    f.write(output[0].read())          # bytes
print(output[0].url)                    # hosted URL if you'd rather link
```

Rule: call `.read()` for bytes or `.url` for the link. Why: silently coercing a `FileOutput` to a
string corrupts the file and the error surfaces far from the cause.

## Long-running & async

For jobs over a few seconds, create a prediction instead of blocking:

```python
client = replicate.Client()
prediction = client.predictions.create(
    model="owner/model",
    input={"prompt": "..."},
)
prediction.reload()                      # refresh status from the API
while prediction.status not in ("succeeded", "failed", "canceled"):
    time.sleep(2)
    prediction.reload()
```

Set a **deadline** so a stuck job auto-cancels instead of billing forever, and `cancel()` on cleanup
paths. Why: a hung prediction with no deadline is silent, open-ended GPU spend. Poll with a small
backoff, not a tight loop — you are charged for the prediction, not the polling, but a tight loop
wastes your own process and rate budget. Full polling loop with backoff and 5xx handling is in
`references/webhooks-and-async.md`.

## Webhooks

For fire-and-forget, hand Replicate a URL and filter to the events you care about:

```python
client.predictions.create(
    model="owner/model",
    input={"prompt": "..."},
    webhook="https://your.app/hooks/replicate",
    webhook_events_filter=["completed"],   # not every intermediate "logs" event
)
```

Rule: ALWAYS verify the signature before trusting a webhook body. Why: the URL is public — anyone can
POST forged completions to it. Replicate signs each delivery; the secret has a **`whsec_`** prefix.
Reconstruct signed content as `{webhook-id}.{webhook-timestamp}.{body}`, HMAC-SHA256 with the
base64-decoded secret, base64-encode, and constant-time compare against the `webhook-signature`
header (a space-separated `v1,<sig>` list). The clients expose a verification helper; the full
Python and Node recipe (including idempotency via `webhook-id`) is in
`references/webhooks-and-async.md`.

## Deployments

A **deployment** is a private, dedicated API endpoint for one model version that autoscales from zero
to hundreds of instances. Reach for it when you need warm instances, a private endpoint, or a hard
spend cap — not for one-off runs.

- `min_instances` — the **warm floor**. Set >0 to kill cold starts for latency-sensitive traffic;
  every warm instance bills whether or not it serves a request.
- `max_instances` — the **spend cap**. The ceiling on concurrent instances; protects you from a
  traffic spike turning into a surprise bill.
- Hardware (NVIDIA T4, A100, H100, ...) is switchable **without touching code** — change the
  deployment config, not `predict.py`.
- Rolling updates ship a new version with no downtime; built-in monitoring covers latency,
  throughput, error rate, and GPU memory.

You still call a deployment with `run()` / `predictions.create()` — it just routes to your private
instances. Create/update via HTTP API, the clients, or CLI; fields and the rolling-update flow are in
`references/deployments-api.md`.

## Package a custom model with Cog

Cog packages a model into a production container. You need two files; Replicate builds the API server
for you on push.

```yaml
# cog.yaml
build:
  gpu: true
  python_version: "3.11"
  python_packages:
    - "torch==2.4.0"
predict: "predict.py:Predictor"
```

```python
# predict.py
from cog import BasePredictor, Input, Path

class Predictor(BasePredictor):
    def setup(self):
        # load weights ONCE here, not per request
        self.model = load_model("weights.pth")

    def predict(self, prompt: str = Input(description="text prompt")) -> Path:
        result = self.model(prompt)
        return Path(result)            # Cog uploads the file
```

```bash
cog predict -i prompt="hello"          # run locally (needs Docker)
cog push r8.im/owner/model             # build + push; Replicate hosts it
```

Rule: load weights in `setup()`, never in `predict()`. Why: `setup()` runs once per instance;
`predict()` runs every request — loading weights per request makes every call pay the model-load cost.
Full `cog.yaml` (system packages, run steps), typed `Input(...)`, GPU config, version pinning, and
common build failures are in `references/cog-packaging.md`. Building requires Docker.

## Cost & scaling levers

- **Scale to zero** is the default — idle deployments stop billing. Only raise `min_instances` above
  zero when cold-start latency actually hurts users, and treat the warm floor as a line item.
- **Deadlines** on predictions cap the worst case so a stuck job cannot bill open-ended.
- **Right-size the GPU**: do not run a 1B model on an H100. Hardware is a deployment-config change.
- **Cache weights in `setup()`** so per-request work is just inference.

This skill covers Replicate-specific levers only. Tracking total AI spend across many providers as a
discipline is `cost-tracking`.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Treating a `FileOutput` as a URL string | Corrupts files / writes a repr; error surfaces far away | `.read()` for bytes, `.url` for the link |
| Blocking `run()` for a 10-min job in a web request | Request times out; the GPU job keeps running and billing | `predictions.create(webhook=...)`, return now |
| Webhook handler with no signature check | The URL is public; anyone can forge completions | Verify HMAC-SHA256 against `whsec_` secret |
| High `min_instances` "just in case" | Every warm instance bills 24/7 idle | Scale to zero; raise floor only when cold starts hurt |
| Loading weights inside `predict()` | Every request pays the model-load cost | Load once in `setup()` |
| `pip install replicate` unpinned | A rebuild can pull the 2.0 alpha and break imports | Pin `replicate>=1,<2` |
| A deployment for a one-off run | Pays for a private endpoint you call once | Use the shared pool via `run()` |
| No deadline on a long prediction | A hung job bills open-ended, silently | Set a deadline; `cancel()` on cleanup |

## References

- `references/cog-packaging.md` — full `cog.yaml` + `predict.py`, GPU config, build/push, version pinning, build failures.
- `references/webhooks-and-async.md` — signature verification (Python + Node), event filters, idempotency, polling with backoff, 5xx retries.
- `references/deployments-api.md` — create/update/get deployment via HTTP + clients, autoscaling fields, rolling updates, monitoring metrics, CLI.

`scripts/verify.sh` statically checks an emitted artifact dir: a `cog.yaml` declaring `build:` and
`predict:`, a `predict.py` `Predictor` with `setup` + `predict`, and warns on an unpinned `replicate`
dependency or a `FileOutput` written as a string. Presence + key checks only — it does not run Docker.
