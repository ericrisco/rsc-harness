# Distributed training — DDP, FSDP2, DeepSpeed ZeRO (mechanics)

Grounded in `pytorch.org/docs/stable/` (DDP: `notes/ddp.html`, `generated/torch.nn.parallel.DistributedDataParallel.html`;
FSDP2: `distributed.fsdp.fully_shard.html`). Verify API against the installed version — distributed
APIs move faster than the core loop.

## The decision, restated

| Situation | Use | Why |
|---|---|---|
| Model fits on one GPU, want more throughput / bigger effective batch | **DDP** | Simplest; replicate + all-reduce grads |
| Model (params+grads+optimizer state) does NOT fit on one GPU | **FSDP2** | Shards the three memory hogs across ranks |
| Need CPU/NVMe offload, or config-first scaling, or already using Accelerate/DeepSpeed | **DeepSpeed ZeRO** | Stage 1/2/3 + offload, external library |

Data parallel of any kind assumes each rank sees a **different shard of the batch** — use
`DistributedSampler` so ranks don't all train on the same rows.

## DDP — one process per GPU

```python
import os, torch, torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

dist.init_process_group("nccl")                        # NCCL for CUDA; "gloo" for CPU
local_rank = int(os.environ["LOCAL_RANK"])             # set by torchrun
torch.cuda.set_device(local_rank)

model = MyModel().to(local_rank)
model = DDP(model, device_ids=[local_rank])            # grads all-reduced automatically in backward

from torch.utils.data import DataLoader
from torch.utils.data.distributed import DistributedSampler
sampler = DistributedSampler(train_ds)                 # disjoint shard per rank
loader  = DataLoader(train_ds, sampler=sampler, batch_size=bs)

for epoch in range(epochs):
    sampler.set_epoch(epoch)                           # REQUIRED: reshuffles per epoch across ranks
    for x, y in loader:
        ...                                            # normal 5-step loop; DDP syncs grads for you

if local_rank == 0:
    torch.save(model.module.state_dict(), "ckpt.pt")   # .module unwraps DDP; save on rank 0 only
dist.destroy_process_group()
```

Launch: `torchrun --standalone --nproc_per_node=4 train.py` (4 GPUs, one node). Multi-node adds
`--nnodes`, `--node_rank`, `--rdzv_endpoint`.

DDP gotchas:
- **`sampler.set_epoch(epoch)`** or every epoch sees the same order — a silent correctness bug.
- **`find_unused_parameters=True`** only if some params get no grad each step (costs a graph
  traversal); leaving it True unnecessarily slows training.
- Save/load on **rank 0** and unwrap with `.module`; barrier before others load.
- Effective batch = `per_gpu_batch * world_size` — scale LR accordingly (linear-scaling rule).

## FSDP2 — shard when it doesn't fit

FSDP2 (`fully_shard`) is the current API: DTensor-based, per-parameter dim-0 sharding. Apply it
**bottom-up** — wrap the repeated blocks first, then the root module — so each `fully_shard` call
forms a communication group and gathers params just-in-time.

```python
from torch.distributed.fsdp import fully_shard

for block in model.transformer_blocks:       # wrap leaves/blocks first
    fully_shard(block)
fully_shard(model)                            # then the root

# Mixed precision is a policy here, not GradScaler:
from torch.distributed.fsdp import MixedPrecisionPolicy
for block in model.transformer_blocks:
    fully_shard(block, mp_policy=MixedPrecisionPolicy(param_dtype=torch.bfloat16))
```

- `reshard_after_forward=True` (default for non-root) frees gathered params after forward and
  re-gathers in backward — saves memory, costs an all-gather. `False` (default for root) keeps them.
- Wrapping **only** the root makes one giant communication group with no compute/comm overlap —
  wrap blocks to overlap.
- FSDP2 uses AMP via `MixedPrecisionPolicy`, not `torch.amp.GradScaler`.
- Full-state-dict save needs `DTensor.full_tensor()` or Distributed Checkpoint (DCP) APIs; prefer
  sharded checkpoints for large models.

## DeepSpeed ZeRO — external, config-driven

DeepSpeed is a **separate library** (Microsoft), commonly driven through a JSON config and/or HF
Accelerate. Verify the current version and config schema — it evolves independently of Torch.

| Stage | Shards | Rough memory win vs DDP | Comm cost |
|---|---|---|---|
| ZeRO-1 | optimizer states | ~4× on optimizer state | ~DDP |
| ZeRO-2 | + gradients | more | ~DDP |
| ZeRO-3 | + parameters (≈ FSDP) | largest | higher (gather params) |
| + offload | move state to CPU/NVMe | fit far bigger models | slowest (PCIe/disk bound) |

Choose ZeRO over FSDP2 when you specifically want **offload** or a config-first workflow, or you're
already in the DeepSpeed/Accelerate stack. For pure Torch, FSDP2 covers the same ZeRO-3 territory
natively.

## Cross-cutting

- **Gradient accumulation** (micro-batching) simulates a bigger batch on limited memory: run N
  forward/backward passes, then one `optimizer.step()` + `zero_grad()`. Under DDP, wrap the
  non-final micro-steps in `model.no_sync()` to skip redundant all-reduces.
- **`torch.compile` composes** with DDP and FSDP2, but compile after wrapping and expect a longer
  warmup.
