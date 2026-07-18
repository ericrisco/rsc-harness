# Training recipes — a full loop, reproducibility harness, and debug ladder

Concrete, runnable single-GPU scaffolding to lift into a project. APIs verified against
`pytorch.org/docs/stable/` (amp_examples, optim, notes/randomness). Hedge versions to "PyTorch 2.x".

## A complete single-GPU training loop (AMP + AdamW + warmup→cosine + checkpoint)

```python
import torch, torch.nn as nn
from torch.optim.lr_scheduler import LinearLR, CosineAnnealingLR, SequentialLR

device = "cuda" if torch.cuda.is_available() else "cpu"
model = MyModel().to(device)
model = torch.compile(model)                 # optional speedup; first steps compile (slow)

# No weight decay on bias/Norm params — two groups.
decay, no_decay = [], []
for n, p in model.named_parameters():
    if not p.requires_grad:
        continue
    (no_decay if p.ndim <= 1 or n.endswith(".bias") else decay).append(p)
opt = torch.optim.AdamW(
    [{"params": decay, "weight_decay": 0.01},
     {"params": no_decay, "weight_decay": 0.0}],
    lr=3e-4, betas=(0.9, 0.999),
)

total_steps = len(train_loader) * epochs
warmup = LinearLR(opt, start_factor=0.1, total_iters=min(500, total_steps // 20))
cosine = CosineAnnealingLR(opt, T_max=total_steps - warmup.total_iters, eta_min=3e-5)
sched  = SequentialLR(opt, [warmup, cosine], milestones=[warmup.total_iters])

loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)     # takes RAW logits
scaler  = torch.amp.GradScaler("cuda", enabled=(device == "cuda"))
USE_BF16 = torch.cuda.is_bf16_supported() if device == "cuda" else False
amp_dtype = torch.bfloat16 if USE_BF16 else torch.float16
# NOTE: with bf16 the scaler is a no-op; keep enabled only for fp16.

best_val = float("inf")
for epoch in range(epochs):
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        opt.zero_grad(set_to_none=True)
        with torch.autocast(device_type=device, dtype=amp_dtype, enabled=(device == "cuda")):
            loss = loss_fn(model(x), y)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)                                    # unscale before clipping
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        sched.step()                                            # per-step: units are steps

    # ---- validation ----
    model.eval()
    val_loss, n = 0.0, 0
    with torch.no_grad():                                       # no graph, no Dropout/BN train stats
        for x, y in val_loader:
            x, y = x.to(device), y.to(device)
            val_loss += loss_fn(model(x), y).item() * x.size(0) # .item() -> no graph leak
            n += x.size(0)
    val_loss /= n

    if val_loss < best_val:                                     # early-stopping signal + best ckpt
        best_val = val_loss
        torch.save({"epoch": epoch,
                    "model": model.state_dict(),
                    "optimizer": opt.state_dict(),
                    "scheduler": sched.state_dict(),
                    "scaler": scaler.state_dict(),
                    "best_val": best_val}, "best.pt")
```

Resume:

```python
ckpt = torch.load("best.pt", map_location=device)
model.load_state_dict(ckpt["model"])          # model FIRST
opt.load_state_dict(ckpt["optimizer"])
sched.load_state_dict(ckpt["scheduler"])
scaler.load_state_dict(ckpt["scaler"])
start_epoch = ckpt["epoch"] + 1
```

## Reproducibility harness (with the honest caveat)

`pytorch.org/docs/stable/notes/randomness.html`: *"Completely reproducible results are not
guaranteed across PyTorch releases, individual commits, or different platforms … results may not be
reproducible between CPU and GPU executions, even when using identical seeds."* Seed for
debugging/regression, never promise bit-exactness across machines.

```python
import os, random, numpy as np, torch

def make_reproducible(seed=42, strict=False):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)  # CPU + all CUDA devices
    if strict:
        torch.use_deterministic_algorithms(True)   # raises on ops lacking a deterministic path
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False      # benchmark=True autotunes -> nondeterministic
        os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")  # CUDA>=10.2; set before launch

# DataLoader workers fork their own RNG — seed each one, plus a seeded generator.
def seed_worker(worker_id):
    ws = torch.initial_seed() % 2**32
    np.random.seed(ws); random.seed(ws)

g = torch.Generator(); g.manual_seed(42)
loader = torch.utils.data.DataLoader(ds, batch_size=64, num_workers=4,
                                     worker_init_fn=seed_worker, generator=g)
```

`strict=True` (deterministic algorithms + `benchmark=False`) trades speed for reproducibility —
use while debugging, drop for throughput runs.

## Debug ladder — "loss won't go down" / "loss is NaN"

Work top-down; each rules out a class of bug.

1. **Overfit one batch.** Loop on a single mini-batch; loss must reach ~0. If it can't, the bug is
   in the model/loss/data wiring, not optimization.
2. **Check the loss input.** `CrossEntropyLoss`/`BCEWithLogitsLoss` want **raw logits** — a Softmax
   before them silently stalls learning. Confirm target shape/dtype (class indices, not one-hot,
   for `CrossEntropyLoss`).
3. **Confirm grads flow.** After `backward()`, inspect a param's `.grad`: all `None`/zero means the
   graph is detached (a stray `.detach()`, `.item()`, `.numpy()`, or `no_grad` in the path) or you
   forgot `zero_grad` and are reading stale state.
4. **LR sweep.** NaN early → LR too high (drop 10×) or missing fp16 scaler. No movement → LR too low
   or a dead activation (all-zero ReLU). Add `clip_grad_norm_(…, 1.0)`.
5. **Precision.** fp16 NaN/Inf → ensure `GradScaler` is active, or switch to **bf16** (wider range,
   no scaler). Check for `log(0)`/`sqrt(neg)`/`0/0` in any custom loss.
6. **Data.** NaNs/Infs in inputs, unnormalized features, or shuffled labels. Verify a few batches by
   eye.
7. **eval vs train mismatch.** Great train loss, bad val → you likely forgot `model.eval()` (Dropout
   still on, BatchNorm using batch stats) or you're leaking train data into val.
