---
name: deep-learning
description: "Use when training or debugging a neural net in PyTorch — the forward/loss/backward/step loop and its silent bugs, mixed precision (AMP), AdamW/LR schedules, DDP/FSDP/ZeRO, checkpoints and seeds. NOT LoRA/QLoRA on a pretrained LLM (that is `finetuning`), NOT tabular sklearn/XGBoost (that is `machine-learning`), NOT tokenization or NLP metrics (that is `nlp`)."
tags: [pytorch, deep-learning, neural-networks, training-loop, autograd, mixed-precision, amp, ddp, fsdp, optimizer, lr-scheduler, reproducibility, torch-compile]
recommends: [machine-learning, finetuning, nlp, python]
origin: risco
---

# deep-learning — train a neural net in PyTorch without the silent bugs

You own **training and understanding neural networks in PyTorch**: the loop, autograd, mixed
precision, optimizers/schedulers, multi-GPU, and the reproducibility/checkpoint hygiene that
separates a real result from a lucky one. Nets from scratch, vision, custom architectures — all
here. This is PyTorch-first by design: JAX and TensorFlow are real and fine, but the patterns,
APIs, and gotchas below are Torch's.

**Version reality (verify at author time).** Current stable is PyTorch **2.x** — ~**2.13** as of
mid-2026 (`pytorch.org/get-started`, releases move fast; don't hard-pin a minor). Everything below
is stable 2.x API. The one namespace shift to know: AMP now lives under `torch.amp`
(`torch.amp.GradScaler("cuda")`), not the old `torch.cuda.amp.*`.

## Am I in the right skill?

| You are doing… | Skill |
|---|---|
| Training/debugging a net in PyTorch (from scratch, vision, custom loop, AMP, multi-GPU) | **deep-learning (here)** |
| Adapting a *pretrained LLM* — LoRA/QLoRA, SFT, trl/peft | [`finetuning`](../finetuning/SKILL.md) |
| Classic/tabular — sklearn, XGBoost/LightGBM, feature engineering | [`machine-learning`](../machine-learning/SKILL.md) |
| Tokenization, NLP task modeling, task metrics (F1/BLEU/ROUGE) | [`nlp`](../nlp/SKILL.md) |
| Envs, packaging, tests and hygiene around the model code | [`python`](../python/SKILL.md) |

## 1. PyTorch essentials

Three objects carry everything.

- **Tensor** — an n-d array on a `device` (`cpu`/`cuda`/`mps`) with a `dtype`. `requires_grad=True`
  makes autograd track ops on it. `.to(device)` / `.detach()` / `.item()` are the moves you use
  constantly; `.item()` pulls a Python scalar and **drops the graph** (see the loop bugs below).
- **autograd** — a tape. Every op on a `requires_grad` tensor records a node; `loss.backward()`
  walks it and *accumulates* into each leaf's `.grad`. "Accumulates" is the word that bites people
  (§2). Wrap read-only regions in `torch.no_grad()` to skip taping.
- **`nn.Module`** — the model container. `__init__` registers submodules/params; `forward` defines
  compute. `model.parameters()` feeds the optimizer; `model.train()` / `model.eval()` flip
  train-vs-eval behavior for Dropout and BatchNorm.

```python
import torch, torch.nn as nn
device = "cuda" if torch.cuda.is_available() else "cpu"

class MLP(nn.Module):
    def __init__(self, d_in, d_h, d_out, p=0.1):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d_in, d_h), nn.ReLU(),
                                 nn.Dropout(p), nn.Linear(d_h, d_out))
    def forward(self, x):
        return self.net(x)

model = MLP(784, 256, 10).to(device)
```

**`torch.compile`** — wrap the model once and get a JIT-optimized (Dynamo→Inductor) graph, often a
real speedup with no code change: `model = torch.compile(model)`. Modes: `"default"` (balanced),
`"reduce-overhead"` (CUDA graphs, best for small batches), `"max-autotune"` (Triton autotuning,
slowest to warm up). First step(s) are slow — that's compilation, not your model. Keep it *after*
`.to(device)` and before the loop. (`pytorch.org/docs/stable/generated/torch.compile.html`)

## 2. The training loop — and its classic bugs

The whole game is five ordered steps. Get the order or the resets wrong and it fails *silently* —
no exception, just a model that won't learn.

```python
model.train()                                    # Dropout/BN in TRAIN mode
for epoch in range(epochs):
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad(set_to_none=True)    # clear LAST step's grads
        out  = model(x)                          # forward
        loss = loss_fn(out, y)                    # loss  (raw logits in, e.g. CrossEntropyLoss)
        loss.backward()                          # autograd fills .grad (ACCUMULATES)
        optimizer.step()                         # update weights from .grad
        scheduler.step()                         # if a per-step scheduler
```

The load-bearing traps, stated next to the lines they govern:

- **Missing `optimizer.zero_grad()` → gradients silently add up across batches.** PyTorch
  *accumulates* `.grad` by design (so you can split a batch); if you never zero it, every step
  updates on the sum of all prior batches' grads and training destabilizes. Zero every step.
  (`pytorch.org/tutorials` optimization tutorial; `torch.optim` docs.) `set_to_none=True` is the
  default in modern Torch and is slightly faster.
- **`CrossEntropyLoss` eats raw logits.** It applies `log_softmax` internally — do **not** put a
  `Softmax`/`Sigmoid` before it or you double-activate and learning stalls. Same for
  `BCEWithLogitsLoss`.
- **Accumulating `loss` without `.item()` leaks memory.** `total += loss` keeps the whole autograd
  graph alive across the epoch. Use `total += loss.item()` (or `.detach()`).
- **`backward()` twice on one graph** raises unless you meant it (`retain_graph=True`) — usually a
  sign you forgot to zero or re-ran forward.

## 3. Mixed precision (AMP)

Run forward/loss in low precision for speed and memory, keep a master copy for the update. Two
pieces: `torch.autocast` (picks per-op precision) + `torch.amp.GradScaler` (rescues fp16 gradients
from underflow). Verified against `pytorch.org/docs/stable/notes/amp_examples.html`.

```python
scaler = torch.amp.GradScaler("cuda")            # current namespace (not torch.cuda.amp)
for x, y in train_loader:
    x, y = x.to(device), y.to(device)
    optimizer.zero_grad(set_to_none=True)
    with torch.autocast(device_type="cuda", dtype=torch.bfloat16):
        out  = model(x)                          # forward + loss ONLY under autocast
        loss = loss_fn(out, y)
    scaler.scale(loss).backward()                # backward OUTSIDE autocast, on scaled loss
    scaler.step(optimizer)                        # unscales, skips step if inf/NaN grads
    scaler.update()                               # adjusts the scale for next step
```

**bf16 vs fp16 — the choice that matters:**

| dtype | Exponent range | Needs GradScaler? | Use when |
|---|---|---|---|
| **bf16** (`bfloat16`) | same as fp32 | **No** (range can't underflow) | Ampere+ (A100/H100/…) or CPU — **prefer this**, it's the robust default |
| **fp16** (`float16`) | narrow → underflows | **Yes** — scaler is mandatory | older GPUs without bf16; squeeze extra range with the scaler |

- With **bf16 you can skip `GradScaler`** entirely (`GradScaler(enabled=False)` or just don't use
  it) — its whole job is fp16 underflow. With **fp16 the scaler is not optional.**
- **Gradient clipping under AMP:** `scaler.unscale_(optimizer)` first, *then*
  `torch.nn.utils.clip_grad_norm_(...)`, then `scaler.step`. Clipping scaled grads clips the wrong
  magnitude.
- Autocast wraps **forward + loss only**. Never wrap `backward()`.

## 4. Optimizers and LR schedules

- **`torch.optim.AdamW`** is the default for most modern nets (transformers, and increasingly
  vision): Adam with *decoupled* weight decay (correct L2, unlike plain `Adam(weight_decay=)`).
  **SGD + momentum + Nesterov** still wins on many CNNs and generalizes well — worth trying.
- **Don't weight-decay everything.** Biases and Norm (LayerNorm/BatchNorm) weights should get
  `weight_decay=0`; use two param groups. Decaying them hurts with no upside.
- **The LR is the hyperparameter.** Too high → loss NaNs or oscillates; too low → crawls. A warmup
  then cosine decay is the reliable modern recipe.

```python
opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01, betas=(0.9, 0.999))

# Warmup (linear ramp) THEN cosine decay, composed with SequentialLR — verified 2.x API.
from torch.optim.lr_scheduler import LinearLR, CosineAnnealingLR, SequentialLR
warmup = LinearLR(opt, start_factor=0.1, total_iters=500)          # 500 steps ramp-in
cosine = CosineAnnealingLR(opt, T_max=total_steps - 500, eta_min=3e-5)
scheduler = SequentialLR(opt, [warmup, cosine], milestones=[500])  # switch at step 500
# call scheduler.step() every STEP here (T_max/total_iters are in steps).
```

Alternatively `OneCycleLR(opt, max_lr=..., total_steps=...)` bakes warmup+anneal into one
scheduler. **Match `step()` cadence to the scheduler's units** — per-step schedulers stepped once
per epoch (or vice-versa) silently give the wrong curve. (`pytorch.org/docs/stable/optim.html`)

## 5. Distributed training — pick by what doesn't fit

One line each on *when*; mechanics and launch commands in `references/distributed.md`.

- **DDP** (`torch.nn.parallel.DistributedDataParallel`) — replicate the **whole model** on each GPU,
  all-reduce grads every step. Use when **the model fits on one GPU** and you just want more
  throughput / a larger effective batch. Default choice; one process per GPU via `torchrun`.
- **FSDP2** (`torch.distributed.fsdp.fully_shard`) — **shard** parameters, gradients, and optimizer
  states across GPUs (gather just-in-time). Use when **the model does NOT fit on one GPU.** FSDP2 is
  the current DTensor-based, per-parameter API; apply it bottom-up (wrap layers, then the root).
- **DeepSpeed ZeRO** (external Microsoft library, not in core Torch) — config-driven sharding:
  **ZeRO-1** shards optimizer states, **ZeRO-2** adds gradients, **ZeRO-3** adds parameters
  (≈ FSDP), plus CPU/NVMe **offload**. Use when you want offload or config-first scaling, or already
  live in the DeepSpeed/Accelerate ecosystem. Verify the current version — it moves independently.

Rule of thumb: fits on one GPU → **DDP**; too big → **FSDP2** (or ZeRO-3); need to offload to
CPU/NVMe → **ZeRO**.

## 6. Regularization, checkpointing, reproducibility

**Regularization** (reach for these when val loss diverges from train — i.e. overfitting):
weight decay (AdamW), `nn.Dropout`, data augmentation, early stopping on a val metric, label
smoothing (`CrossEntropyLoss(label_smoothing=0.1)`), and gradient clipping for stability (not
generalization).

**Checkpointing — save `state_dict`s, not the model object.** Pickling the module ties the file to
your code layout and breaks on refactor.

```python
torch.save({"epoch": epoch,
            "model": model.state_dict(),          # DDP/FSDP: model.module.state_dict(), rank 0 only
            "optimizer": opt.state_dict(),
            "scheduler": scheduler.state_dict(),
            "scaler": scaler.state_dict()},        # AMP scale must survive a resume
           "ckpt.pt")
# Resume: load model FIRST, then optimizer/scheduler; move optimizer state to device if needed.
```

Save optimizer + scheduler + scaler too, or a resumed run restarts its LR schedule and loss scale.

**Reproducibility — seed everything, and know the ceiling.** From
`pytorch.org/docs/stable/notes/randomness.html`, quoted: *"Completely reproducible results are not
guaranteed across PyTorch releases, individual commits, or different platforms. Furthermore,
results may not be reproducible between CPU and GPU executions, even when using identical seeds."*

```python
import random, numpy as np, torch
seed = 42
random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)   # covers CPU + all CUDA devices
torch.use_deterministic_algorithms(True)          # errors on ops with no deterministic impl
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False            # benchmark=True picks fastest algo → nondeterministic
# For CUDA >= 10.2, deterministic matmul also needs, set BEFORE launch:
#   export CUBLAS_WORKSPACE_CONFIG=:4096:8
```

DataLoader workers need their own seeding (each worker forks its RNG), via `worker_init_fn` +
a seeded `generator` — full snippet in `references/training-recipes.md`. Determinism costs speed
(`benchmark=False` disables autotuned convs).

## Anti-patterns (the silent killers)

| Anti-pattern | What actually happens | Instead |
|---|---|---|
| Validating with the model left in `train()` mode, or without `torch.no_grad()` | Dropout keeps dropping and BatchNorm uses *batch* stats instead of running stats, so val numbers are wrong; the graph is still built and can OOM | `model.eval()` + `torch.no_grad()` around val/inference, `model.train()` after (`nn.Module.eval` / autograd docs, pytorch.org) |
| Reading a NaN loss as a modeling problem | It is almost always LR too high, fp16 with no `GradScaler`, unclipped exploding grads, or a `log(0)`/`0/0` in a custom loss | Bisect: drop LR 10×, clip grads, switch fp16→bf16 |
| fp16 with the scaler left off | Gradients underflow to zero → no learning, and no error to tell you | Keep `GradScaler` on fp16, or move to bf16 where underflow can't happen |
| A stray CPU tensor in a CUDA graph | Hard device-mismatch error mid-step, usually on the targets or a hand-built mask rather than the inputs | `.to(device)` inputs, targets **and** model |
| Promising bit-exact reproducibility from seeds | Not guaranteed across releases, commits, platforms, or CPU-vs-GPU even with identical seeds | Seed for debugging/regression and say so; state the caveat with the result (randomness note, pytorch.org) |
