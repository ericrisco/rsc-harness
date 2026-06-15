---
name: modal
description: "Use when running Python functions or GPU workloads serverlessly on Modal — defining a modal.App with inline container Images, scaling @app.function onto CPU/GPU, persisting weights or datasets in a Volume, scheduling jobs, serving an HTTP/ASGI endpoint, or choosing modal run vs serve vs deploy. Triggers: 'run my embedding job on an H100 without managing servers', 'cache HuggingFace weights across runs', 'my @app.function GPU string errors', 'gpu=modal.gpu.A100() fails', 'modal serve isn't hot-reloading my fastapi_endpoint', 'cold start too slow / keep a warm pool', 'ejecutar Python en GPU serverless', 'desplegar un model de difusió amb GPU sense servidor i exposar-lo per HTTP'. NOT managed prediction endpoints with no infra code (that is replicate) and NOT persistent SSH-able GPU pods rented by the hour (that is runpod)."
tags: [modal, serverless, gpu, python, ai-infra, deployment, cron, web-endpoint]
recommends: [replicate, runpod, fastapi, docker, python, llm-pipeline]
origin: risco
---

# Modal — serverless Python & GPU as decorators

Modal runs your Python on remote containers without you ever writing a Dockerfile or a YAML
file. The mental model: **infrastructure is declared inline as Python decorators.** A
`modal.App` is the deployable unit; each `@app.function` runs in its own container built from
a `modal.Image` you describe in code; you attach a GPU, a Volume, or a Secret as keyword
arguments and the platform provisions, scales to zero, and tears down for you. There is no
control plane to babysit — the source file *is* the infra.

Pinned stack: **modal 1.4.3** (released 2026-05-18), Python **3.10–3.14** (`>=3.10,<3.15`).
Install with `pip install modal` then `modal setup` to authenticate. Everything below uses
the Modal 1.0+ API; several pre-1.0 forms were removed and are called out as Bad→Good.

## When to use

- Running a Python function or batch job on remote CPU/GPU with no server to manage.
- GPU inference, fine-tuning, or model serving (vLLM, diffusion, embeddings) on T4…B200.
- Building a container image inline (`Image.debian_slim().uv_pip_install(...)`) for a remote job.
- Persisting model weights or datasets across runs with a Modal `Volume`.
- Scheduled jobs (nightly report, periodic scrape) via `modal.Cron` / `modal.Period`.
- Exposing a function over HTTP (`fastapi_endpoint`, `asgi_app`, `wsgi_app`, `web_server`).
- Fan-out parallelism with `.map()` / `.starmap()` / `.spawn()`.

## When NOT to use

- Calling a **managed prediction API** with no container of your own → **`replicate`** / `together-fireworks` / `fal`.
- Renting a **persistent, SSH-able GPU box** by the hour/week → **`runpod`**.
- Generic **FastAPI design** (routing, Pydantic, deps) independent of host → **`fastapi`**.
- Writing a **Dockerfile** for a registry / k8s / Compose → **`docker`**.
- General **Python language/runtime** questions → **`python`**.
- **RAG / LLM pipeline** orchestration logic itself → **`llm-pipeline`**.

Modal owns the serverless-container-as-decorators surface and its CLI lifecycle; the
*contents* of your function (FastAPI app, RAG chain) belong to the siblings above.

## Decision: which entrypoint?

| You want… | Use | Persists after exit? |
|---|---|---|
| Run a function once and exit (script, batch) | `modal run app.py` + `@app.local_entrypoint()` | No (ephemeral) |
| Hot-reload dev loop for a web endpoint | `modal serve app.py` | No (dies on Ctrl-C) |
| A persistent named deployment (prod, schedules, endpoints) | `modal deploy app.py` | Yes |
| Fan out work across many containers | `.map()` / `.starmap()` / `.spawn()` inside an entrypoint | n/a |

Rule: **schedules and live web endpoints require `modal deploy`.** `modal run` exits when the
entrypoint returns, so a Cron defined under `modal run` never fires. `modal serve` is for the
dev loop only — it watches your files and redeploys on save, but the app vanishes when you
stop it.

## The minimal app skeleton

```python
import modal

app = modal.App("hello-modal")

# The image is the container spec. Build it once, reuse across functions.
image = modal.Image.debian_slim(python_version="3.12").uv_pip_install("requests")


@app.function(image=image)
def fetch(url: str) -> int:
    import requests  # imported INSIDE the function: it lives in the remote image, not locally

    return len(requests.get(url).content)


@app.local_entrypoint()
def main() -> None:
    # Runs on your laptop; .remote() ships the call to a Modal container.
    print(fetch.remote("https://modal.com"))
```

Run it: `modal run app.py`. **Bad** = wiring infra with argparse + a bash launcher + a
hand-rolled Dockerfile. **Good** = the decorators above; the app, image, and scaling are all
declared in the one file. Note the in-function import: dependencies you `uv_pip_install` exist
in the *remote* image, so import them inside the function (or guard top-level imports), not at
module top where your laptop would need them too.

## Images — pin, layer, cache

Build images by chaining methods on `modal.Image`. Rules, each with its why:

1. **Prefer `.uv_pip_install(...)` over `.pip_install(...)`** — it resolves and installs with
   `uv`, materially faster image builds.
2. **Pin versions** — `.uv_pip_install("torch==2.5.1", "transformers==4.46.0")`. Unpinned
   deps make builds non-reproducible and silently drift on rebuild.
3. **Order layers stable→volatile** — system packages and big wheels first, your fast-changing
   code last. Modal caches each layer; a change busts that layer and everything after it.
4. **Add your own code with `.add_local_dir(...)` / `.add_local_python_source(...)`**, not by
   pip-installing your repo. These are applied last so editing your source doesn't rebuild torch.
5. **`.from_registry("...")`** when you need a specific base image; **`.apt_install("ffmpeg")`**
   for system binaries; **`.run_commands(...)`** for arbitrary build steps.

```python
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")                                   # stable: rarely changes
    .uv_pip_install("torch==2.5.1", "transformers==4.46.0")  # heavy wheels, pinned
    .add_local_python_source("my_pkg")                       # volatile: your code, applied last
)
```

`→ references/images-gpu-cookbook.md` for vLLM / torch+CUDA / diffusers recipes and the
download-once weight-cache pattern.

## GPU — it's a string now

In Modal 1.0+ the GPU is a **string** on the decorator. The old `modal.gpu.H100()` objects
were removed.

- Single GPU: `gpu="H100"`.
- Count via colon: `gpu="A100:2"` (two A100s in one container).
- Memory variant: `gpu="A100-80GB"` (also `A100-40GB`).
- Fallback list (first available wins): `gpu=["H100", "A100", "any"]`.
- Supported types: `T4, L4, A10, L40S, A100(-40GB/-80GB), RTX-PRO-6000, H100, H200, B200`.

```python
# Bad — removed API, raises at import.
# @app.function(gpu=modal.gpu.A100())

# Good — string form.
@app.function(image=image, gpu="A100-80GB", timeout=600)
def embed(texts: list[str]) -> list[list[float]]: ...
```

Pick the smallest GPU that fits: **T4/L4** for cheap inference and small models, **A10/L40S**
mid-range, **A100/H100** for training and large-model serving, **H200/B200** for frontier-scale.
GPU time is billed per second a container is alive — never attach a GPU to a CPU-only job, and
keep `scaledown_window` tight so idle GPU containers don't burn money.

## Scaling & lifecycle

Tune these keyword args on `@app.function`, each with its why:

| Param | Effect | Why |
|---|---|---|
| `min_containers=N` | Keep N warm instances always running | Kills cold starts for latency-sensitive endpoints (costs idle compute) |
| `buffer_containers=N` | Pre-warm N extra beyond current load | Smooths bursty traffic |
| `scaledown_window=300` | Seconds an idle container lingers before shutdown | Reuse hot containers across nearby calls; lower = cheaper, higher = warmer |
| `timeout=600` | Max seconds a single call may run | Caps runaway jobs |
| `retries=3` | Auto-retry failed inputs | Survives transient failures in `.map()` fan-outs |

Migration note: `keep_warm` → **`min_containers`** and `container_idle_timeout` →
**`scaledown_window`** in the 1.0 migration. The old names are gone.

Concurrency within a container is now its own decorator: **`@modal.concurrent(max_inputs=N)`**
stacked under `@app.function` (it replaces the old `allow_concurrent_inputs=` argument). Use it
so one container handles N simultaneous requests instead of one-per-container.

## Volumes & Secrets

A `Volume` is a distributed filesystem you mount into containers to persist data across runs —
the canonical use is caching downloaded model weights so cold starts skip the re-download.

```python
weights = modal.Volume.from_name("hf-cache", create_if_missing=True)


@app.function(image=image, gpu="H100", volumes={"/cache": weights})
def serve_model():
    # Reader: refresh the view so you see writes from other containers.
    weights.reload()
    # ... load model from /cache ...


@app.function(image=image, volumes={"/cache": weights})
def download_weights():
    # ... write files into /cache ...
    weights.commit()  # WITHOUT this, writes are NOT durable across containers
```

**Gotcha:** writers must call `vol.commit()` to persist; readers call `vol.reload()` to see
another container's committed writes. Forgetting `commit()` is the #1 "my cache is empty"
bug — the files existed in that container and vanished with it.

Secrets land as **environment variables** in the container:

```python
@app.function(image=image, secrets=[modal.Secret.from_name("hf-token")])
def pull():
    import os

    token = os.environ["HF_TOKEN"]  # value injected from the named Modal Secret
```

Never bake a token into the image (`.run_commands("export TOKEN=...")`) — it's recorded in
layer history. Use a Secret. `→ references/images-gpu-cookbook.md` for the weight-cache and
HF/OpenAI secret patterns.

## Web endpoints

Stack a web decorator **under** `@app.function`. Pick by surface:

| Decorator | Use for | Needs |
|---|---|---|
| `@modal.fastapi_endpoint()` | A single GET/POST function-as-URL | `fastapi[standard]` in image |
| `@modal.asgi_app()` | A full FastAPI/Starlette app you return | `fastapi[standard]` |
| `@modal.wsgi_app()` | A Flask/Django WSGI app | the framework |
| `@modal.web_server(port=8000)` | Your own server process (e.g. vLLM) on a port | the server |

**Decorator stack order matters:** `@app.function` is outermost (top), then optional
`@modal.concurrent`, then the web decorator innermost (bottom, closest to `def`).

```python
@app.function(image=image, gpu="H100", min_containers=1, scaledown_window=300)
@modal.concurrent(max_inputs=10)   # middle
@modal.asgi_app()                  # innermost
def web():
    from fastapi import FastAPI

    api = FastAPI()

    @api.get("/health")
    def health():
        return {"ok": True}

    return api
```

Develop with `modal serve app.py` (hot-reload); ship with `modal deploy app.py` (stable URL).
For custom domains, proxy-auth tokens, batching (`@modal.batched`), and concurrency tuning →
`references/web-and-scaling.md`. For the FastAPI app's *own* design (routes, Pydantic, deps),
that's the `fastapi` sibling — this skill only mounts it.

## Scheduled jobs

```python
# Fixed wall-clock time, with timezone — survives redeploys at the same clock time.
@app.function(schedule=modal.Cron("0 6 * * *", timezone="America/New_York"))
def nightly_report(): ...


# Interval relative to deploy time.
@app.function(schedule=modal.Period(hours=5))
def every_five_hours(): ...
```

**Gotcha:** `Period` is measured from deploy time and **resets on every redeploy** — redeploy
at 4:59 and your "every 5 hours" clock restarts. `Cron` is wall-clock stable; prefer it for
"run at 6am" semantics. Either way you must **`modal deploy`** (not `modal run`) for the
schedule to live on the platform.

## Parallelism

Fan a function out across containers without managing a pool:

```python
@app.local_entrypoint()
def main():
    urls = ["https://a.com", "https://b.com", "https://c.com"]
    # .map: one arg per call, results in input order.
    sizes = list(fetch.map(urls))
    # .starmap: each item is an argument tuple. .spawn: fire-and-forget -> handle.get() later.
    handle = fetch.spawn("https://slow.com")
    print(sizes, handle.get())
```

`.map(iterable)` returns results in order by default; pass `order_outputs=False` to yield as
they complete (faster when latencies vary). Combine with `retries=` on the function so a
single bad input doesn't sink the batch.

## Anti-patterns → STOP

| Rationalization | Reality → STOP |
|---|---|
| "I'll use `gpu=modal.gpu.A100()` like the old docs" | Removed in 1.0. Use the string `gpu="A100-80GB"`. |
| "Attach a GPU, it might speed up this CPU job" | GPU is billed per second alive. CPU-only job → no `gpu=`. |
| "My files are written, the Volume will keep them" | Not without `vol.commit()` (writer) / `vol.reload()` (reader). |
| "Pin later — `uv_pip_install('torch')` is fine for now" | Unpinned deps drift; builds aren't reproducible. Pin every version. |
| "`modal run` it, the endpoint/schedule will stay up" | `run` is ephemeral; it exits. Use `modal deploy` for anything persistent. |
| "Order the decorators however — Modal figures it out" | `@app.function` outermost, web decorator innermost. Wrong order errors. |
| "Bake the HF token into the image with `run_commands`" | Leaks into layer history. Use `modal.Secret.from_name(...)`. |
| "Just call the model via a managed API through Modal" | If you write no container, that's a managed-API job → `replicate`. |
| "I need a box to SSH into for a week" | That's a persistent rental → `runpod`, not Modal's scale-to-zero. |
| "Set `min_containers` high so it's always fast" | Idle warm containers cost money 24/7. Tune `scaledown_window` first. |

## verify.sh

`scripts/verify.sh [TARGET]` statically lints the nearest emitted Modal `*.py`: it requires a
`modal.App(`, **fails** if the removed `modal.gpu.` object form appears, checks that any web
decorator sits under an `@app.function`, and that any `Volume` uses
`from_name(..., create_if_missing=...)`. It runs `python -c "import modal"` only if modal is
installed (skip-pass otherwise) and needs **no Modal credentials**. On an empty/clean target it
exits 0.

## Project grounding (02-DOCS + CLAUDE.md)

In a project with a `02-DOCS/` layer (the [`harness`](../harness/SKILL.md) wiki), record this
app's real Modal choices — GPU types, image base, Volume names, schedule, endpoint shape — in
`02-DOCS/wiki/stack/modal.md` and index it in `02-DOCS/wiki/index.md` (the Knowledge map; root
`CLAUDE.md` keeps only a short pointer to it). Read it
first on every use; create/update it with the real decisions. No `02-DOCS/`? Skip silently.

## See Also

- [`fastapi`](../fastapi/SKILL.md) — the design of the FastAPI app you mount behind `@modal.asgi_app()`.
- References: [`references/images-gpu-cookbook.md`](references/images-gpu-cookbook.md), [`references/web-and-scaling.md`](references/web-and-scaling.md).
- Verify gate: [`scripts/verify.sh`](scripts/verify.sh).
- Siblings (catalog): `replicate` / `together-fireworks` / `fal` (managed prediction APIs), `runpod` (persistent GPU pods), `docker` (Dockerfiles), `python` (language), `llm-pipeline` (orchestration).
