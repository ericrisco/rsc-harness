---
name: finetuning
description: "Use when adapting an open-weight model to a target form or behavior — tone, output format, reasoning pattern — via LoRA/QLoRA or full fine-tuning with TRL SFTTrainer, then preference optimization (DPO/ORPO/KTO/GRPO), and for fine-tune vs prompt vs RAG. NOT adding facts to a model (that is rag); NOT the single-GPU Unsloth backend or GGUF export (that is unsloth)."
tags: [finetuning, lora, qlora, sft, dpo, grpo, peft, trl, preference-optimization]
recommends: [training-data, unsloth, open-weights, huggingface, vllm, rag]
origin: risco
---

# finetuning — teach an open model a form or behavior, not a fact

You own the discipline of **adapting an open-weight model**: deciding whether to fine-tune at all,
then running SFT and (optionally) preference optimization with `trl` + `peft`, backend-agnostic.
You are judged by whether the tuned model reliably produces the target **form/behavior** on a
held-out set — not by train loss, and not by vibes.

The one sentence that routes half of all "should I fine-tune?" questions correctly:
**fine-tuning teaches *form and behavior*; RAG supplies *facts*.** If the ask is "know our latest
prices / docs / tickets," that is retrieval (`../rag/SKILL.md`), not training. If the ask is "sound
like us, always emit this JSON, follow this reasoning pattern," that is here.

## Decision gate — try this BEFORE reaching for a GPU

Fine-tuning is the last lever, not the first. Exhaust the cheaper, reversible options first; each
row below is a real off-ramp.

| If the goal is… | Do this first | Fine-tune only when… |
|---|---|---|
| The model should *know* current/company facts | **RAG** (`../rag/SKILL.md`) — retrieve + ground | never for facts; facts go stale, weights don't update |
| One-off format/tone, small volume | **Prompt + few-shot** (`prompt-engineering`) | the prompt is huge, brittle, or you pay for it every call |
| Behavior depends on a long document | **Longer context** / put it in the prompt | context won't fit, or per-call token cost is the bottleneck |
| Consistent *form/behavior* at scale, latency/cost sensitive | — | prompting plateaus AND you have (or can build) good examples |
| A capability the base model just can't do | — | you have a reward signal or demonstration data for it |

Route out explicitly. Facts / freshness / citations → `../rag/SKILL.md`. Squeezing a prompt before
spending money → `prompt-engineering`. Picking *which* base model (size/license/task) → `open-weights`.
Building the JSONL/preference corpus → `training-data` (LLM corpora, NOT tabular cleaning — that is
`data-cleaning`). A fast single-GPU run + GGUF export → `../unsloth/SKILL.md` (same LoRA/QLoRA
concepts, one optimized implementation; this skill stays backend-agnostic). Downloading the base or
pushing the adapter/merged model → `huggingface`. Serving the result → `../vllm/SKILL.md`.

> The cheapest fine-tune is the one you didn't need. Prompt + RAG solves most "make it behave"
> asks at zero training cost and updates instantly. Fine-tune when that ceiling is real, measured,
> and you can afford to re-run it every time the base model or data changes.

## Version reality (verify at author time — this stack moves monthly)

- **`trl`** consolidated into a **v1.x** line (v1.0 landed ~2026; docs at author time referenced
  ~v1.8). Every method has a `Trainer` + a `Config` dataclass that inherits
  `transformers.TrainingArguments` (`SFTTrainer`/`SFTConfig`, `DPOTrainer`/`DPOConfig`, …). Confirm
  the current major before pinning: `pip show trl` / the [TRL docs](https://huggingface.co/docs/trl).
- **`transformers`** is on a **v5.x** line; `peft`, `bitsandbytes`, `accelerate`, `datasets`
  round out the stack. Do not freeze a pin as "the version" — say "current major is ~X, verify."
- Some methods migrated to `trl.experimental.*` (e.g. `from trl.experimental.orpo import ORPOTrainer`
  at author time). Import paths churn — check the method's doc page before copying an import.
- **Model licenses are not facts to memorize.** Llama ships under the Meta *Community* license
  (usage caps, not OSI-open); Gemma under custom Google terms; Qwen/Mistral vary per size and often
  Apache-2.0 — but **read the specific model card, licenses change.** License/size selection is
  `open-weights`.

## LoRA / QLoRA vs full fine-tuning

Three options on one memory↔quality axis. Default to **QLoRA** unless you have a proven reason not to.

| Method | What trains | Rough VRAM (7–8B) | Use when |
|---|---|---|---|
| **Full FT** | every weight, fp16/bf16 | very high (needs multi-GPU / offload) | you have the hardware and a large, high-quality corpus and adapters underfit |
| **LoRA** | small low-rank adapter matrices; base frozen (fp16) | high | base fits in fp16 and you want adapter portability + speed |
| **QLoRA** | LoRA adapters over a **4-bit NF4** frozen base | lowest — single consumer GPU for 7–13B | the default; fine-tune big models on one GPU with ~no quality loss |

**QLoRA** (Dettmers et al., [arXiv:2305.14314](https://arxiv.org/abs/2305.14314)): load the base
in 4-bit **NF4** with double quantization, keep it frozen, and train LoRA adapters in bf16 on top.
It made single-GPU fine-tuning of large models practical at near-full-FT quality.

```python
import torch
from transformers import BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

# 4-bit NF4 base (QLoRA). Verify arg names against current bitsandbytes/transformers.
bnb = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)

# LoRA over ALL linear layers — the safe target for QLoRA (PEFT quantization guide).
peft_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    bias="none", task_type="CAUSAL_LM",
    target_modules="all-linear",   # or explicit ["q_proj","k_proj","v_proj","o_proj",...]
)

trainer = SFTTrainer(
    model="Qwen/Qwen2.5-7B-Instruct",       # instruct base → chat template already present
    args=SFTConfig(output_dir="out", max_length=2048, packing=True,
                   learning_rate=2e-4, num_train_epochs=2, bf16=True),
    train_dataset=dataset,                    # conversational: TRL applies the chat template
    peft_config=peft_config,
    quantization_config=bnb,                  # SFTTrainer + peft_config + this == QLoRA
)
trainer.train()
trainer.save_model("out")                     # saves the ADAPTER, not a merged model
```

`peft_config` + `quantization_config` on `SFTTrainer` is the current one-liner for QLoRA — no manual
`get_peft_model` / `prepare_model_for_kbit_training` wiring needed. `save_model` writes the small
adapter; merge to a standalone model only when serving requires it (see references).

## Pipeline: SFT first, then (maybe) preference optimization

`SFT → preference optimization` is the standard post-training arc. **SFT** teaches the model the
format and gives it the behavior by imitation. **Preference optimization** then sharpens *which* of
several plausible outputs is better. Most projects need only SFT; add a preference stage when "the
outputs are fine but I want the *good* one preferred" is the remaining gap.

| Method | Data it needs | Stage | Pick it when |
|---|---|---|---|
| **SFT** | demonstrations (chat/`messages` or prompt→completion) | base of everything | always first (except ORPO) |
| **DPO** ([2305.18290](https://arxiv.org/abs/2305.18290)) | paired `chosen`/`rejected` | after SFT | you have pairwise preferences; the workhorse aligner |
| **ORPO** ([2403.07691](https://arxiv.org/abs/2403.07691)) | paired preferences | **replaces** SFT+DPO (single stage, ref-free) | you want one pass from a base model and have pairs |
| **KTO** ([2402.01306](https://arxiv.org/abs/2402.01306)) | *unpaired* binary good/bad labels | after SFT | you have thumbs-up/down, not matched pairs |
| **GRPO** ([2402.03300](https://arxiv.org/abs/2402.03300); DeepSeek-R1 [2501.12948](https://arxiv.org/abs/2501.12948)) | a **reward function** (verifier), no pairs | after SFT | correctness is checkable (math/code/format) → RL for reasoning |

Rule of thumb: **have pairs → DPO** (or ORPO to fuse the two stages); **have only up/down votes → KTO**;
**can score an answer programmatically → GRPO**. Preference optimization uses a *tiny* learning rate.

```python
# DPO after SFT — dataset has prompt / chosen / rejected columns.
from trl import DPOTrainer, DPOConfig
trainer = DPOTrainer(
    model="out",                              # your SFT checkpoint (or SFT+adapter)
    args=DPOConfig(output_dir="dpo-out", beta=0.1,   # beta = KL strength to the ref model
                   learning_rate=5e-7, max_length=1024,
                   precompute_ref_log_probs=True),   # saves memory; ref model auto-created
    train_dataset=pref_dataset,
    peft_config=peft_config,                  # LoRA works for preference stages too
)
trainer.train()
```

```python
# GRPO — no preference pairs, a reward FUNCTION that returns a score per completion.
from trl import GRPOTrainer, GRPOConfig
def format_reward(completions, **kwargs):     # signature: gets completions (+ dataset cols via kwargs)
    return [1.0 if "\\boxed{" in c[0]["content"] else 0.0 for c in completions]

trainer = GRPOTrainer(
    model="out",
    reward_funcs=[format_reward],             # one or many; GRPOConfig.reward_weights to combine
    args=GRPOConfig(output_dir="grpo-out", num_generations=8,  # group size per prompt
                    beta=0.04, learning_rate=1e-6, use_vllm=True),  # vLLM speeds rollouts
    train_dataset=prompts_dataset,
)
trainer.train()
```

Full runnable SFT→DPO and GRPO scripts, ORPO/KTO variants, dataset schemas, and adapter-merge steps
are in `references/methods.md`.

## Data — quality over quantity (LIMA)

More rows is not the win. **LIMA** ([arXiv:2305.11206](https://arxiv.org/abs/2305.11206)) got strong
instruction-following from **~1,000** carefully curated examples — "less is more for alignment."
A thousand clean, on-distribution, correctly-templated examples beat 100k scraped noisy ones, which
actively teach the model bad form. Building and validating that corpus (JSONL `messages`, preference
pairs, dedup, contamination checks) is `training-data` — bring it here already clean.

## Hyperparameters — the few that move the needle

- **LoRA `r` and `lora_alpha`**: `r` = adapter rank (capacity); effective scaling = `lora_alpha / r`.
  Common heuristic **`alpha ≈ 2·r`** (e.g. r=16→alpha=32) so scaling ≈ 2; then adjust LR, not both.
  Start `r=8–16` for style/format, higher (32–64+) for harder behavior. (Newer "LoRA-without-regret"
  guidance favors `target_modules="all-linear"` + higher rank + tuned LR — verify current advice.)
- **`target_modules`**: `"all-linear"` is the safe default. Targeting too few / wrong-named modules
  is a top silent failure — the run "succeeds," loss barely moves, the adapter learned ~nothing.
- **Learning rate**: LoRA/QLoRA SFT ~**1e-4–2e-4** (adapters tolerate higher LR than full FT, whose
  ~2e-5 is the `SFTConfig` default). Preference optimization is far lower — **DPO ~5e-7, GRPO ~1e-6**.
- **Epochs**: usually **1–3**. This is the overfitting knob — see below. Watch **eval** loss.
- **Batch × grad-accum**: raise the *effective* batch with `gradient_accumulation_steps` when VRAM
  caps `per_device_train_batch_size`. Enable `packing=True` + `gradient_checkpointing` to fit more.
- **Warmup**: a short `warmup_ratio` (~0.03–0.1) stabilizes the early, high-gradient steps.

## Catastrophic forgetting

Fine-tuning on a narrow task can degrade general ability the base model had. Three mitigations,
cheapest first: **use LoRA/QLoRA** (base weights frozen — inherently gentler than full FT); **keep
the LR low and epochs few**; and **replay** — mix a slice of general instruction data into your
task data so the model doesn't forget how to be a general assistant. If a tuned model suddenly
"got dumber" at everything else, this is the usual cause.

## Evaluation — a held-out set and a task metric, not a vibe-check

A vibe-check is **not** an eval. Before training, split off a **held-out** set the model never sees,
and define a concrete task metric (exact-match / JSON-valid rate / rubric score / a task-specific
score). Judge the run on that, plus **eval loss**.

- **Watch eval loss, not train loss.** Train loss falling while **eval loss rises** = overfitting →
  fewer epochs, lower LR, more/cleaner data, or earlier checkpoint. Train loss always keeps falling;
  it tells you nothing about generalization.
- **Contamination**: if eval examples leaked into training, your metric is a lie. De-dup train vs
  eval; keep the held-out set quarantined. (Corpus-side hygiene is `training-data`.)
- General LLM/agent eval harness and judging → `agent-eval`. Bring your task metric here.

The full tuning + forgetting + evaluation playbook is in `references/hyperparameters-and-eval.md`.

## When NOT to fine-tune (anti-patterns)

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| Fine-tune to add facts / fresh knowledge | Weights memorize poorly and go stale; hallucinations | `../rag/SKILL.md` — retrieve + ground |
| Fine-tune before trying prompt + few-shot | Slow, costly, irreversible for a prompt-solvable ask | `prompt-engineering` first |
| Wrong / too-few `target_modules` | Adapter has no capacity where it matters → learns ~nothing | `"all-linear"` (or correct proj names) |
| Judge success by train loss | Falls even while the model overfits | Held-out eval set + task metric + **eval** loss |
| Crank epochs "to learn it better" | Overfits, forgets, memorizes noise | 1–3 epochs; stop when eval loss turns up |
| Train with a wrong/absent chat template | Inference emits garbage / never stops | Match train template to serve; align `eos_token` |
| A few dozen examples for full FT | Not enough signal; unstable | Curate ~hundreds–thousands (LIMA) or use LoRA |
| Fine-tune a model you can't legally deploy | License blocks your use case | Check the model card first → `open-weights` |

## Checklist

- [ ] Ran the decision gate: confirmed this is a form/behavior need, not a facts need (else → rag).
- [ ] Chose base model by license + size (→ `open-weights`); read the actual model card.
- [ ] Picked method: QLoRA by default; full FT only with the hardware + a reason.
- [ ] Data is clean, on-distribution, correctly templated (→ `training-data`); dedup vs eval.
- [ ] Chat template applied at train time and it **matches** the serving template; `eos_token` aligned.
- [ ] `target_modules="all-linear"` (or verified names); `alpha ≈ 2·r`; LoRA LR ~1e-4–2e-4.
- [ ] Held-out eval set + a concrete task metric defined **before** training.
- [ ] Trained 1–3 epochs; watched **eval** loss (not train) for the overfitting turn.
- [ ] Preference stage only if needed; correct method for the data (pairs→DPO/ORPO, votes→KTO, verifier→GRPO); tiny LR.
- [ ] Verified `trl`/`peft`/`transformers` current majors and import paths at author time.
