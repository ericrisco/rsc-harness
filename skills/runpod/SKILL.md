---
name: runpod
description: "Use when running GPU compute on RunPod and deciding between Pods (hourly, always-on) and Serverless (per-second, autoscaling) for training, fine-tuning or inference — serverless endpoints, handler workers, worker Docker templates, network volumes, timeout and worker-count tuning, cold starts, and runaway bills. NOT Python-native serverless GPU with snapshot autoscaling (that is `modal`), NOT calling hosted prebuilt model APIs (that is `replicate`), NOT pulling weights from the Hub (that is `huggingface`)."
tags: [runpod, gpu, serverless, inference, training, cost-control, vllm, ai-infra]
recommends: [modal, replicate, huggingface, docker, llm-pipeline, cost-tracking, ollama]
origin: risco
---

# RunPod: GPU compute, two products, one bill

RunPod sells GPU time two ways and they bill on opposite philosophies. Get the choice
wrong and you either pay a steep premium for idle work or you pay 24/7 for a box that
sits warm doing nothing. Everything below is the RunPod-specific operational playbook:
which product a workload belongs on, how to write a worker that does not waste cold-start
seconds, and which knobs actually move the number on the invoice.

The two products:

- **Pods** — rent a GPU container by the hour. It runs continuously while it is up,
  billed every hour whether busy or idle. Your dev box, your training job, your Jupyter.
- **Serverless** — per-second autoscaling workers. Billed only while a worker is actually
  running a job, from worker start to full stop, rounded up to the second. Costs roughly
  **2-3x the equivalent hourly pod rate**, but idle gaps cost nothing on flex workers.

RunPod charges **zero egress/ingress fees** — bandwidth in and out is free, unlike the
hyperscalers. That removes one variable from cost math: you only reason about GPU-seconds
and storage.

## When to use

- Deploying inference as a Serverless endpoint (vLLM LLM serving, image gen, custom model).
- Running a training / fine-tuning job or a Jupyter / dev box on a GPU Pod.
- Writing or debugging a serverless worker handler (`handler(job)`, async, streaming).
- Building a custom worker Docker template / image, or wiring a network volume.
- Cost control on RunPod: cold starts, idle bleed, runaway max workers, idle volume charges.
- Picking a GPU SKU and the pod-vs-serverless tradeoff for a given workload.

## When NOT to use

- Python-native serverless GPU with snapshot autoscaling and no Dockerfile → that is `modal`.
- Calling hosted, prebuilt model endpoints you do not host → that is `replicate`.
- Pulling/pushing weights, datasets, model cards on the Hub → that is `huggingface`.
- Running models locally on your own machine → that is `ollama`.
- Provider-agnostic cross-cloud spend dashboards → that is `cost-tracking`.
- Generic container packaging → that is `docker` (here we cover only the RunPod image shape).

## Decision: Pod vs Serverless

| Workload shape | Pick | Why |
| --- | --- | --- |
| Training / fine-tuning, multi-hour runs | **Pod** | Serverless premium + the 600s default execution timeout kill long jobs. You want the box continuously. |
| Interactive dev / Jupyter / notebooks | **Pod** | You need it now and responsive; per-second autoscaling adds cold-start latency for nothing. |
| Bursty inference with real idle gaps | **Serverless (flex)** | Idle costs nothing on flex; you pay only for the seconds a request runs. |
| 24/7 steady high-QPS inference | **Compare** | Active serverless (40% off flex) vs a dedicated Pod. Past roughly 60% utilization a Pod usually wins. |

Rule: if the GPU would sit busy more than ~60% of the time, a Pod is cheaper than
serverless even with active-worker discount — model the two before committing.

### GPU SKU quick-pick (2026 pod $/hr, lower on Community Cloud)

| GPU | VRAM | Pod ~$/hr | Use for |
| --- | --- | --- | --- |
| L4 | 24GB | $0.39 | small models, light inference |
| A40 | 48GB | $0.44 | mid-size inference, budget training |
| RTX 4090 | 24GB | $0.69 | 7B-class inference, fast/cheap |
| L40S | 48GB | $0.86 | 13B inference, image gen |
| A100 80GB | 80GB | $1.39 | training, large-batch inference |
| H100 PCIe | 80GB | $2.89 | the biggest models / fastest training |

Rule: **pick the smallest GPU the model fits in VRAM.** Defaulting to H100 is up to ~7x
the cost for zero speedup when the workload is memory-bound and fits on an L40S or 4090.

## Serverless worker handler

A worker is a Python file using the `runpod` SDK. The minimum: a function that reads
`job["input"]`, returns a dict, and is registered with `runpod.serverless.start`.

```python
import runpod

def handler(job):
    job_input = job["input"]
    prompt = job_input["prompt"]
    # ... run the model ...
    return {"output": f"echo: {prompt}"}

runpod.serverless.start({"handler": handler})
```

Async handler (for awaiting model calls) and a streaming generator both work:

```python
import runpod

async def handler(job):
    job_input = job["input"]
    return {"output": await run_model(job_input)}

# Streaming: yield chunks from an async generator instead of returning once.
async def stream_handler(job):
    async for token in generate(job["input"]["prompt"]):
        yield {"token": token}

runpod.serverless.start({"handler": stream_handler, "return_aggregate_stream": True})
```

**Test locally before you push an image.** A broken handler still burns build minutes and
cold-start seconds when discovered on the platform.

```bash
# One-shot: reads ./test_input.json, runs the handler once, prints output.
python worker.py

# HTTP server emulating the real endpoint at http://localhost:8000.
python worker.py --rp_serve_api
```

Concurrency (`concurrency_modifier`), job cancel, refresh-worker, and the run / runsync /
stream / status / cancel / health HTTP endpoints live in
[references/serverless-workers.md](references/serverless-workers.md).

## Templates & images

A custom template is a Docker image plus environment variables. Pin the base; an unpinned
or `:latest` base re-pulls on cold start and lengthens it.

```dockerfile
# Pin the CUDA base — never bare :latest.
FROM runpod/base:0.6.2-cuda12.4.1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY handler.py .

# The worker entrypoint runs the handler.
CMD ["python", "-u", "handler.py"]
```

**vLLM shortcut.** For OpenAI-compatible LLM serving, use the prebuilt `worker-vllm` image
instead of writing a handler. Its `AsyncEngineArgs` are set via UPPERCASE env vars:

```bash
# Template env vars on the endpoint — these map to vLLM AsyncEngineArgs.
MODEL_NAME=mistralai/Mistral-7B-Instruct-v0.3
MAX_MODEL_LEN=8192
```

## Network volumes

Attach a network volume when data outgrows what you want in the image:

- Datasets larger than container disk.
- Weights shared across many workers (download once, mount everywhere).
- Checkpoints that must survive a worker / pod restart.

Two traps to state up front:

1. **A volume locks the endpoint/pod to one data center** and adds network latency. That
   shrinks the pool of available GPUs in that DC — you can get stuck waiting for capacity.
2. **Idle volume cost is double.** Pod volume disk bills ~$0.10/GB/mo while running but
   ~$0.20/GB/mo while the pod is stopped. A forgotten volume on a stopped pod bleeds money.

Rule: **bake small, static weights into the image**; reserve volumes for large mutable
data (datasets, checkpoints). Full storage tables are in
[references/cost-and-scaling.md](references/cost-and-scaling.md).

## Cost control — the four knobs that move the bill

| Knob | Default | What it does |
| --- | --- | --- |
| **Idle Timeout** | 5s | How long a worker stays warm (and billed) after a job. Lower for spiky traffic; raise to dodge repeated cold starts. |
| **Execution Timeout** | 600s | Max single-job duration (range 5s–7 days). Set it so a hung job cannot run for days. |
| **Max Workers** | — | Your concurrency cap *and* cost ceiling. Never leave it sky-high; set ~20% over expected peak. |
| **Active Workers** | 0 | Always-warm minimum: zero cold start but billed 24/7 (at ~40% off the flex rate). Use only when a latency SLA demands it. |

Plus **FlashBoot**: enable it on flex workers to cut cold start (model load into GPU
memory) toward sub-200ms by caching, so flex stops feeling slow.

Worked example — 100k requests/day, ~2s each on RTX 4090 serverless (~$1.10/hr equiv):

- Compute is ~55.5 GPU-hours/day regardless of mode → roughly **$61/day** of actual work.
- **Flex** adds idle-timeout tails per cold worker but nothing during true idle — best for
  bursty business-hours traffic.
- **Active workers** remove cold starts but bill 24/7; only worth it if traffic is steady
  enough that the 40% discount beats paying for idle.
- A **dedicated Pod** at ~$0.69/hr = ~$497/mo flat — wins only if utilization stays high.

Full active-vs-flex math and monthly scenarios: [references/cost-and-scaling.md](references/cost-and-scaling.md).

## Driving resources

`runpodctl` is the open-source CLI. It outputs **JSON by default** (agent-friendly); add
`--output table` or `--output yaml` for humans. Pods ship with it pre-installed using a
pod-scoped key.

```bash
runpodctl serverless list                 # JSON by default
runpodctl serverless get <endpoint-id>
runpodctl serverless update <endpoint-id> --output table
runpodctl get pod --output table
```

Python SDK for programmatic control — key from env, never in source:

```python
import os, runpod

runpod.api_key = os.environ["RUNPOD_API_KEY"]  # never a literal

pod = runpod.create_pod(name="train", image_name="my/img:1.0", gpu_type_id="NVIDIA A100 80GB PCIe")
runpod.stop_pod(pod["id"])      # also resume_pod / terminate_pod

ep = runpod.Endpoint("<endpoint-id>")
job = ep.run({"prompt": "hi"})  # async: job.status(), job.output()
out = ep.run_sync({"prompt": "hi"})  # blocks, ~90s max
```

Rule: read the API key from `RUNPOD_API_KEY`. A leaked key is a stranger spending on your GPUs.

## Anti-patterns

| Bad | Good | Why |
| --- | --- | --- |
| Max Workers left unbounded / sky-high | Bound it ~20% over peak | One traffic spike scales to an unbounded bill. |
| H100 by default | Smallest GPU that fits VRAM | ~7x cost for zero speedup when the model fits an L40S/4090. |
| 6-hour training run on Serverless | Run it on a Pod | Serverless premium + 600s execution timeout kills long jobs. |
| Hardcoded API key in source | `os.environ["RUNPOD_API_KEY"]` | A leaked key = a stranger's GPU bill on your card. |
| Weights downloaded at cold start | Bake into image or mount a volume | Every cold start re-downloads and pays for the wait. |
| Active workers "just in case" | Flex + FlashBoot | Active bills 24/7; FlashBoot makes flex cold starts cheap. |
| Volume left on a stopped pod | Detach / delete when idle | Idle volume bills ~$0.20/GB/mo silently. |
| Push image, debug on the platform | `python worker.py --rp_serve_api` first | Debugging on cold-start seconds is slow and costs money. |

## Verify

Run `bash scripts/verify.sh <worker-dir>` to statically lint a worker directory: it checks
for `runpod.serverless.start`, a handler with a return/yield, no hardcoded API key, a
bounded `max_workers` plus timeout keys in any config, and a pinned `FROM` + `CMD` in a
Dockerfile. Pure grep/parse — no network, no RunPod account. It exits 0 on an empty dir.
