---
name: fal
description: "Use when calling a fal.ai endpoint by id to generate image, audio, or video from JS/Python/curl: subscribe vs submit, queue states, ED25519 webhook signature verification, per-call cost, or migrating off @fal-ai/serverless-client. NOT which model or art direction (that is ai-media); NOT the same models on another platform (that is replicate)."
tags: [fal, fal-ai, inference, image-generation, video-generation, queue, webhooks, serverless]
recommends: [ai-media, replicate, replicate-images, modal, webhooks]
origin: risco
---

# fal

The wire to fal.ai's fast, pre-warmed media endpoints: call a model by id, control the queue, get the file back. fal is the **fast-media path** — latency-optimized image (FLUX, Seedream, SD), audio (TTS, music), and video (Veo, Wan, Kling, Hailuo) endpoints you invoke by id with `FAL_KEY`.

You own the *mechanics*: auth, call mode, queue states, webhook signatures, file I/O, per-call cost.

## When NOT to use

| You want… | Go to |
| --- | --- |
| Which model / what to generate / art direction / multi-provider media pipeline | `ai-media` |
| The same kind of models on **Replicate** (`replicate.run` / predictions) | `replicate` — images-specifically `replicate-images` |
| Renting a **raw GPU pod** you SSH into to train or custom-serve | `runpod` |
| Deploying **your own** Python function as an autoscaling endpoint | `modal` |
| Cheap hosted **LLM text/chat** completions | `together-fireworks` |
| The generic provider-agnostic webhook receiver/verifier pattern | `webhooks` |

Rule: if you are not invoking a fal endpoint id with `FAL_KEY`, you are in the wrong skill.

## Setup & auth

```bash
# JS — current client. NOT @fal-ai/serverless-client (deprecated, migrate).
npm i @fal-ai/client          # latest 1.10.1

# Python
pip install fal-client
```

```bash
export FAL_KEY="key_id:key_secret"
```

```ts
import { fal } from "@fal-ai/client";
// Reads FAL_KEY from env automatically; or set it explicitly:
fal.config({ credentials: process.env.FAL_KEY });
```

Rule: **never ship `FAL_KEY` to a browser bundle.** Proxy every call through your own server. Why: a key in client-side JS lets anyone drain your account — fal endpoints bill per call with no per-request cap.

## Pick a call mode

All three modes hit the same queue. Choose by how long the job runs and where you call it from.

| Situation | Mode | Why |
| --- | --- | --- |
| Need the result now, can block, single short job (image, short TTS) | `subscribe` | Submits + auto-polls until done; feels synchronous, no polling code |
| Long job (video), batch, or running in a serverless/edge handler that can't hold a connection | `submit` + `webhook_url` (or poll) | Returns a `request_id` instantly; result arrives later, no held connection |
| Trivially short call, you accept no queue control | `run` | Direct synchronous call — no status, no logs; drops on long jobs |

```ts
// Bad: run() on a 60s video — connection can drop, no retry, no progress.
const res = await fal.run("fal-ai/veo3", { input });

// Good: submit + webhook for anything that takes more than a few seconds.
const { request_id } = await fal.queue.submit("fal-ai/veo3", {
  input,
  webhookUrl: "https://api.example.com/fal/webhook",
});
```

## subscribe — block and stream progress

```ts
const result = await fal.subscribe("fal-ai/flux/dev", {
  input: { prompt: "a red bicycle on a wet street, cinematic" },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs?.forEach((l) => console.log(l.message)); // stream to user
    }
  },
});
console.log(result.data.images[0].url); // hosted output URL
```

```python
import fal_client

def on_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
            print(log["message"])

result = fal_client.subscribe(
    "fal-ai/flux/dev",
    arguments={"prompt": "a red bicycle on a wet street, cinematic"},
    with_logs=True,
    on_queue_update=on_update,
)
print(result["images"][0]["url"])
```

Python has an async twin for every method — `subscribe_async`, `submit_async`, `run_async`. Use them inside an event loop.

## submit + queue polling

When you cannot or will not block, submit and poll the queue yourself.

```ts
const { request_id } = await fal.queue.submit("fal-ai/flux/dev", { input });

// Poll. Status moves IN_QUEUE -> IN_PROGRESS -> COMPLETED.
const status = await fal.queue.status("fal-ai/flux/dev", {
  requestId: request_id,
  logs: true,
});

// Once COMPLETED, fetch the result.
const result = await fal.queue.result("fal-ai/flux/dev", { requestId: request_id });
console.log(result.data.images[0].url);
```

Rule: **back off between polls** — start at ~1s, grow to a few seconds. Why: a tight `while` loop polling `queue.status` hammers the API and gains nothing; the job finishes when it finishes. For anything long-running, prefer a webhook over any polling at all.

## Webhooks

Pass `webhook_url` (camelCase `webhookUrl` in the JS client) on `submit`; fal POSTs the result when the job finishes.

```jsonc
// Success
{ "request_id": "...", "gateway_request_id": "...", "status": "OK", "payload": { /* result */ } }
// Failure
{ "request_id": "...", "status": "ERROR", "error": "..." }
// Result couldn't be serialized
{ "request_id": "...", "status": "OK", "payload": null, "payload_error": "..." }
```

Delivery facts you must design for:

- The initial POST has a **15-second timeout**. On timeout or non-2xx, fal **retries up to 10 times over ~2 hours**.
- Therefore your handler **must be idempotent** — the same `request_id` can arrive more than once. Dedupe on `request_id` (e.g. an upsert keyed on it) before acting.
- **Verify the ED25519 signature** before trusting the body — four `X-Fal-Webhook-*` headers + a JWKS fetched from `https://rest.fal.ai/.well-known/jwks.json`. Why: an unverified webhook endpoint is a public write to your DB / spend trigger.

The full verification (header parsing, JWKS caching, ±5-minute timestamp check, message construction, per-key verify) and a complete idempotent handler in Node and Python live in [`references/queue-and-webhooks.md`](references/queue-and-webhooks.md).

## File inputs and outputs

Upload a local file to get a URL, then pass that URL into `input` for image-to-X jobs. Outputs always come back as hosted URLs.

```ts
const url = await fal.storage.upload(file); // File/Blob -> hosted URL
const out = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
  input: { image_url: url, prompt: "make it snow" },
});
```

```python
url = fal_client.upload_file("input.png")
out = fal_client.subscribe(
    "fal-ai/flux/dev/image-to-image",
    arguments={"image_url": url, "prompt": "make it snow"},
)
```

## Cost control

Pricing is **pay-per-use, per-model unit** — never flat. The unit differs by model, so always read the model's pricing tab before you ship a loop.

| Unit | Used by | 2026 example |
| --- | --- | --- |
| Per image | image diffusion | Seedream V4 ~`$0.03`/image |
| Per second of output | video | Wan 2.5 ~`$0.05`/s; Veo 3 ~`$0.4`/s |
| Per megapixel | some image models | varies — read the tab |
| GPU-hour | fal-served compute | A100 40GB `$0.99`/h, H100 80GB `$1.89`/h (2026-05-13) |

Spend knobs, by modality:

- **Image:** lower `num_inference_steps`, drop resolution / megapixels, cut `num_images`.
- **Video:** shorten `duration`, lower fps/resolution — per-second pricing scales linearly.
- **Batch:** fal **batch inference is 50% of serverless price** — use it for offline bulk jobs where latency does not matter.

Worked estimate: 500 Seedream V4 images at ~$0.03 ≈ **$15** serverless, ≈ **$7.50** on the batch path.

The full model-family map and per-modality knob list live in [`references/models-and-cost.md`](references/models-and-cost.md).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| `FAL_KEY` in a browser bundle | Anyone reads it and bills your account | Proxy through your server |
| `run` for a 30–60s video | Connection drops, no retry, no progress | `submit` + `webhook_url` |
| Webhook handler with no signature check | Public write / spend trigger anyone can forge | Verify ED25519 against the JWKS |
| Non-idempotent webhook handler | 10 retries over 2h create duplicate side effects | Dedupe on `request_id` |
| Ignoring the model's pricing unit | "$0.05" is per-second, not per-video — surprise bill | Read the pricing tab; pick the right knob |
| Tight `while` loop on `queue.status` | Hammers the API, gains nothing | Back off, or use a webhook |
| `@fal-ai/serverless-client` | Deprecated; missing fixes and APIs | `@fal-ai/client` (v1.10.1) |
