# methods — full SFT → preference scripts, dataset schemas, adapter merge

Depth overflow for `SKILL.md`. All snippets target the `trl` **v1.x** API (verify the current
major and any `trl.experimental.*` import paths at author time — this stack changes monthly).

## Dataset schemas the trainers expect

TRL auto-applies the model's **chat template** when a dataset is *conversational* (`messages` or
role dicts). This is the single most important correctness point: train with the same template you
serve with, or inference is garbage.

```python
# SFT — conversational language modeling (chat template applied automatically)
{"messages": [{"role": "user", "content": "What color is the sky?"},
              {"role": "assistant", "content": "It is blue."}]}

# SFT — prompt/completion (loss on completion only by default)
{"prompt": "The sky is", "completion": " blue."}

# DPO / ORPO — paired preference (explicit prompt recommended)
{"prompt":  [{"role": "user", "content": "What color is the sky?"}],
 "chosen":  [{"role": "assistant", "content": "It is blue."}],
 "rejected":[{"role": "assistant", "content": "It is green."}]}

# KTO — UNPAIRED binary preference (a completion + a boolean label)
{"prompt": [{"role":"user","content":"What color is the sky?"}],
 "completion": [{"role":"assistant","content":"It is blue."}], "label": True}

# GRPO — prompts only; the reward function scores generated completions
{"prompt": [{"role": "user", "content": "Solve: 2+2. Put the answer in \\boxed{}."}],
 "solution": "4"}   # extra columns arrive in the reward fn via **kwargs
```

Building and validating these corpora (dedup, contamination, format checks) is `training-data`.

## Full QLoRA SFT run

```python
import torch
from datasets import load_dataset
from transformers import BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

dataset = load_dataset("trl-lib/Capybara", split="train")   # conversational messages

bnb = BitsAndBytesConfig(
    load_in_4bit=True, bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16,
)
peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
    task_type="CAUSAL_LM", target_modules="all-linear",
)
args = SFTConfig(
    output_dir="qlora-sft",
    per_device_train_batch_size=2, gradient_accumulation_steps=8,  # eff. batch 16
    learning_rate=2e-4, num_train_epochs=2, warmup_ratio=0.05,
    max_length=2048, packing=True,          # packing uses max_length as block size
    bf16=True,                              # SFTConfig defaults: bf16=True, grad-ckpt=True
    logging_steps=10, eval_strategy="steps", eval_steps=100, save_steps=100,
    assistant_only_loss=True,               # loss on assistant turns only (conversational)
)
trainer = SFTTrainer(
    model="Qwen/Qwen2.5-7B-Instruct",
    args=args, train_dataset=dataset, eval_dataset=eval_dataset,
    peft_config=peft_config, quantization_config=bnb,
)
trainer.train()
trainer.save_model("qlora-sft")   # writes the adapter (adapter_config.json + weights)
```

Notes:
- `SFTConfig` inherits `TrainingArguments`; its non-default defaults include `bf16=True`,
  `gradient_checkpointing=True`, `learning_rate=2e-5`, `logging_steps=10`, `max_length=1024`.
- `loss_type` defaults to `"chunked_nll"` (same math as `"nll"`, lower peak activation memory;
  auto-falls back to `"nll"` when `use_liger_kernel=True`). Verify on your `trl` version.
- **Base (non-instruct) models have no chat template.** Set one via `SFTConfig(chat_template_path=...)`
  and align the EOS token (e.g. `eos_token="<|im_end|>"` for some Qwen bases) or the model never
  learns to stop.

## SFT → DPO

```python
from datasets import load_dataset
from peft import LoraConfig
from trl import DPOTrainer, DPOConfig

pref = load_dataset("trl-lib/ultrafeedback_binarized", split="train")  # prompt/chosen/rejected
peft_config = LoraConfig(r=16, lora_alpha=32, task_type="CAUSAL_LM", target_modules="all-linear")

trainer = DPOTrainer(
    model="qlora-sft",                    # the SFT checkpoint from above
    args=DPOConfig(
        output_dir="dpo", beta=0.1,       # beta ↑ = stay closer to the reference model
        learning_rate=5e-7,               # preference LR is tiny vs SFT
        per_device_train_batch_size=2, gradient_accumulation_steps=8,
        max_length=1024, max_prompt_length=512,
        precompute_ref_log_probs=True,    # cache ref logprobs → less VRAM; ref model auto-built
        num_train_epochs=1,
    ),
    train_dataset=pref,
    peft_config=peft_config,
)
trainer.train()
```

DPO tips: `loss_type` can be a list to blend variants (e.g. `["sigmoid","sft"]`); lower `beta` lets
the policy drift further from the reference (more change, more risk). With LoRA you skip a separate
frozen reference copy — the base with adapters disabled *is* the reference.

## GRPO (reward-driven RL, DeepSeek-R1 style)

Use when correctness is **checkable** (math, code, exact format). GRPO samples a *group* of
`num_generations` completions per prompt and uses the group-mean reward as the baseline.

```python
from datasets import load_dataset
from trl import GRPOTrainer, GRPOConfig

dataset = load_dataset("trl-lib/DeepMath-103K", split="train")  # prompt + solution

def correctness_reward(completions, solution, **kwargs):
    # completions: list[list[{"role","content"}]]; extra dataset cols arrive as kwargs.
    out = []
    for comp, sol in zip(completions, solution):
        text = comp[0]["content"]
        got = text.split("\\boxed{")[-1].split("}")[0] if "\\boxed{" in text else ""
        out.append(1.0 if got.strip() == str(sol).strip() else 0.0)
    return out                              # list[float] (None allowed to skip a sample)

trainer = GRPOTrainer(
    model="qlora-sft",
    reward_funcs=[correctness_reward],      # 1..N callables (or a reward-model id string)
    args=GRPOConfig(
        output_dir="grpo", num_generations=8, max_completion_length=1024,
        beta=0.04, learning_rate=1e-6,
        reward_weights=[1.0],               # weights when combining multiple reward fns
        use_vllm=True, vllm_gpu_memory_utilization=0.7,   # vLLM makes rollouts affordable
    ),
    train_dataset=dataset,
)
trainer.train()
```

Reward-function contract: a Python callable (sync or async) receiving `completions` plus any extra
dataset columns as kwargs, returning a `list[float]` (or `None` per sample to skip). `trl.rewards`
ships built-ins (e.g. accuracy). Composed rewards are combined by `reward_weights`.

## ORPO and KTO

- **ORPO** — a **single stage** that fuses SFT + preference alignment (reference-free), so you can
  align a *base* model without a separate SFT run. Import path migrated to experimental at author
  time: `from trl.experimental.orpo import ORPOTrainer, ORPOConfig` (verify).
- **KTO** — takes **unpaired** binary good/bad labels (thumbs up/down), not matched pairs; it will
  also accept paired data and convert it internally. Use `KTOTrainer` / `KTOConfig` (stable API).

```python
from trl.experimental.orpo import ORPOTrainer, ORPOConfig   # verify import path
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset

model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
tok = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B-Instruct")
if tok.pad_token is None: tok.pad_token = tok.eos_token
ds = load_dataset("trl-lib/ultrafeedback_binarized", split="train")

trainer = ORPOTrainer(model, args=ORPOConfig(output_dir="orpo"),
                      processing_class=tok, train_dataset=ds)
trainer.train()
```

## Merging the adapter for serving

`save_model` writes the small LoRA adapter, not a full model. To serve, either load base + adapter
at runtime (many servers hot-load adapters — see `../../vllm/SKILL.md`) or merge into standalone
weights:

```python
from peft import AutoPeftModelForCausalLM
merged = AutoPeftModelForCausalLM.from_pretrained("qlora-sft").merge_and_unload()
merged.save_pretrained("merged-model")     # standalone fp16/bf16 weights
```

Caveat: merging LoRA into a **4-bit** base can shift numerics — merge into the fp16/bf16 base for a
clean standalone model, or keep the adapter separate and serve it on top of the full-precision base.
Pushing the adapter/merged model to the Hub and hosting inference is `huggingface`; high-throughput
serving (adapter hot-swap, batching) is `../../vllm/SKILL.md`; a fast single-GPU train + GGUF export
path is `../../unsloth/SKILL.md`.
