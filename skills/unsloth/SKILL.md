---
name: unsloth
description: "Use when fine-tuning an open-weight LLM fast on ONE GPU with low VRAM — Unsloth's FastLanguageModel/FastModel + 4-bit QLoRA + trl SFTTrainer, response-only loss masking via get_chat_template/train_on_responses_only, GRPO reasoning FT, and export to merged-16bit / GGUF / push_to_hub for Ollama or vLLM. Triggers: 'fine-tune Llama/Qwen/Gemma/gpt-oss on a single 16GB/24GB GPU', 'QLoRA OOMs on my GPU, make it fit', 'train ~2x faster with less VRAM', 'why is my loss covering the prompt / how do I mask the user turn', 'save my LoRA as GGUF Q4_K_M for Ollama', 'ajustar un modelo en una sola GPU sense quedar-me sense VRAM'. NOT whether/why/which method to fine-tune or trl/peft theory (that is finetuning), NOT running the exported GGUF locally (that is ollama), NOT serving-engine flags/throughput (that is vllm), NOT building the JSONL dataset (that is training-data)."
tags: [unsloth, qlora, lora, single-gpu, gguf, fine-tuning]
recommends: [finetuning, training-data, open-weights, ollama, huggingface]
origin: risco
---

# Unsloth — fast, low-VRAM fine-tuning on one GPU

Unsloth is a fine-tuning *backend*: hand-written Triton kernels + a patched LoRA/QLoRA path that make
`transformers` + `trl` training run faster and fit a much bigger model on a single consumer GPU. You
reach for it when the *decision to fine-tune is already made* and the problem is now "make this run on
the one GPU I have." This skill owns the backend + the export mechanics. It does **not** decide
whether fine-tuning is even the right move (`finetuning`), and it does **not** run the model you
export (`ollama` / `vllm`).

## Read this first (the two things that bite everyone)

1. **Single-GPU is the free-tier assumption.** The open (Apache-2.0) core is built for one GPU.
   Multi-GPU / multi-node "works but a better version is coming" per the docs, and the polished
   multi-GPU + full-finetuning path is gated behind the paid Pro/Enterprise tiers — **verify the
   current split at docs.unsloth.ai before you promise anyone `torchrun --nproc 8`.** If the plan is
   truly multi-node from day one, that is an `axolotl`/native-`trl`/`accelerate` job, not this.
2. **You must mask the prompt or your loss is wrong.** Fine-tuning a chat model means computing loss
   on the *assistant* turn only. Use Unsloth's `get_chat_template` for the format and
   `train_on_responses_only` for the mask. Skip it and the model trains on predicting the user's
   words too — loss looks fine, behaviour is subtly broken (and on some templates you hit a
   zero-loss trap). This is the single most common mistake; it is section 4 for a reason.

### Version / performance reality (fast-moving — verify at author time)

The headline, straight off docs.unsloth.ai (accessed 2026-07): **~2x faster training with ~70% less
VRAM, no accuracy loss**, on a single GPU with the free core. Treat that as a *class* of improvement,
not a contract:

- The baseline is a **standard Hugging Face + FlashAttention-2 QLoRA** pipeline, not "raw PyTorch."
- Numbers are **model-, GPU-, and config-specific.** Some pages/reviews cite ~60% VRAM; GRPO/RL
  claims ~80% less VRAM; MoE (e.g. gpt-oss, Qwen3-family MoE) shows much larger multipliers on
  specific hardware (up to ~7–12x on a B200 in Unsloth's own MoE post). **Do not quote a single
  number as gospel — cite the docs page you read and hedge.**
- Licensing/pricing also moves: core is Apache-2.0 and free; a paid Pro tier and an Enterprise
  (contact-sales) tier add multi-GPU/multi-node, full-parameter training, and faster kernels. **Check
  unsloth.ai/pricing for the live tiers and figures.**

### Setup

Notebook-centric by design — the fastest path is one of the maintained Colab/Kaggle notebooks
(`unslothai/notebooks`). Locally:

```bash
pip install unsloth            # pulls unsloth + unsloth_zoo; expects a recent PyTorch + CUDA
python -c "import unsloth; print(unsloth.__version__)"
```

NVIDIA is the first-class target (min ~CUDA-capable GPU, works down to ~a free-Colab T4 for small
models). AMD (ROCm) and Intel GPU support have landed as install targets — **verify your hardware on
the docs' requirements page before assuming it works.** Don't pin a brittle version in your head;
`unsloth` ships frequently — install fresh and read its startup banner (it prints the versions it
patched).

## Supported models (verify the live list)

Unsloth advertises **500+ models** across text, vision, and TTS/embeddings. Families you can expect
(confirm the specific checkpoint at docs.unsloth.ai/models — new releases land within days):

- **Text:** Llama, Qwen, Gemma, Mistral/Mixtral, Phi, DeepSeek, GLM, and **gpt-oss** (OpenAI's
  open-weight MoE).
- **Vision (VLM):** e.g. Qwen-VL, Gemma vision, Llama-vision — via `FastVisionModel`.
- Plus TTS and embedding fine-tunes in the notebook zoo.

Prefer Unsloth's **pre-quantized 4-bit repos** (`unsloth/<model>-unsloth-bnb-4bit`) — faster download,
fewer OOMs. Which base model + **which license** is right for you is an `open-weights` question, not
this one: **never assert a model's license from memory** (Llama = Meta Community license, Gemma =
custom terms, gpt-oss/Qwen vary by size) — read the model card.

## Canonical flow

Three steps: **load 4-bit → attach LoRA → SFTTrainer**. `FastModel` is the newer unified loader (text
+ vision); `FastLanguageModel` is the text path and still owns `.get_peft_model`.

```python
from unsloth import FastLanguageModel
import torch
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset

max_seq_length = 2048  # Unsloth does RoPE scaling internally — pick what you need

# 1) Load a (pre-quantized) base in 4-bit. This is the QLoRA memory win.
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name    = "unsloth/Meta-Llama-3.1-8B-Instruct-bnb-4bit",  # verify current id
    max_seq_length= max_seq_length,
    load_in_4bit  = True,   # QLoRA. False + load_in_16bit=True => 16-bit LoRA
    # load_in_8bit / load_in_16bit / full_finetuning are the other switches
    # token = "hf_...",     # only for gated repos
)

# 2) Attach LoRA adapters — you train ~1% of weights.
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,                 # rank: 8/16/32; higher = more capacity, more VRAM
    lora_alpha = 16,        # a common default is alpha == r (some recipes use 2*r)
    target_modules = ["q_proj","k_proj","v_proj","o_proj",
                      "gate_proj","up_proj","down_proj"],
    lora_dropout = 0,       # 0 is the optimized path
    bias = "none",          # "none" is the optimized path
    use_gradient_checkpointing = "unsloth",  # "unsloth" = ~30% less VRAM, fits longer context
    random_state = 3407,
)

# 3) Train with trl's SFTTrainer (see section 4 before you call .train()).
dataset = load_dataset("json", data_files="train.jsonl", split="train")  # your data
trainer = SFTTrainer(
    model = model, tokenizer = tokenizer, train_dataset = dataset,
    args = SFTConfig(
        max_seq_length = max_seq_length,
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,     # effective batch = 2*4
        warmup_steps = 10,
        max_steps = 60,                       # or num_train_epochs = 1
        learning_rate = 2e-4,
        logging_steps = 1,
        optim = "adamw_8bit",                 # 8-bit optimizer = more VRAM saved
        output_dir = "outputs",
        seed = 3407,
    ),
)
trainer.train()
```

MoE caveat: 4-bit QLoRA is **not** supported for MoE models yet — load MoE in 16-bit and LoRA the
`gate_up_proj` / `down_proj` layers. (`load_in_4bit=False` for gpt-oss/Qwen3-MoE.) Verify on
docs.unsloth.ai/basics/faster-moe.

## Chat templates + response-only loss (do not skip)

Format with Unsloth's template helper — **not** a hand-written string — so the special tokens match
what the base model was trained on:

```python
from unsloth.chat_templates import get_chat_template

tokenizer = get_chat_template(tokenizer, chat_template = "llama-3.1")  # match your base model
# then map your messages -> a "text" column via tokenizer.apply_chat_template(...)
```

Then wrap the trainer so **loss is computed on the assistant turn only**:

```python
from unsloth.chat_templates import train_on_responses_only

trainer = train_on_responses_only(
    trainer,
    instruction_part = "<|start_header_id|>user<|end_header_id|>\n\n",       # Llama-3
    response_part    = "<|start_header_id|>assistant<|end_header_id|>\n\n",
)
# Gemma-3 would use: instruction_part="<start_of_turn>user\n", response_part="<start_of_turn>model\n"
```

The `instruction_part` / `response_part` strings are the **template's own turn markers** — they must
match the chat template you applied, per model. Verify the mask worked before spending GPU-hours:

```python
# labels are -100 where masked. Decoding the non-masked tokens should show ONLY the answer.
print(tokenizer.decode(trainer.train_dataset[0]["input_ids"]))
print(tokenizer.decode([tokenizer.pad_token_id if x == -100 else x
                        for x in trainer.train_dataset[0]["labels"]]))
```

More templates, thinking-mode (`enable_thinking`), and the vision path are in
[references/masking-and-templates.md](references/masking-and-templates.md).

## GRPO / reasoning fine-tuning (brief)

Unsloth supports RL (GRPO and variants) with the same low-VRAM story — it plugs into `trl`'s
`GRPOTrainer` / `GRPOConfig` and can use a built-in vLLM engine (`fast_inference=True`) for the
rollout generation. Instead of imitating a target string, GRPO optimizes **reward functions** you
write (e.g. "answer matches ground truth", "output obeys the `<reasoning>/<answer>` format"). The docs
cite ~80% less VRAM for GRPO vs a standard setup — verify. This is how you turn a base model into a
reasoning model on one GPU. The *choice* of SFT vs DPO vs GRPO is a `finetuning` decision; the
mechanics + a runnable GSM8K reward example live in [references/grpo.md](references/grpo.md).

## Export (the other half of this skill)

After `trainer.train()` you have LoRA adapters. Pick an export by where it's going:

```python
# A) Merge LoRA into the base at 16-bit — the portable, high-quality artifact (vLLM, re-hosting).
model.save_pretrained_merged("model_16bit", tokenizer, save_method = "merged_16bit")
model.push_to_hub_merged("user/model", tokenizer, save_method = "merged_16bit", token = "hf_...")

# B) Keep just the adapters (small, hot-swappable).
model.save_pretrained_merged("model_lora", tokenizer, save_method = "lora")

# C) GGUF for llama.cpp / Ollama — choose the quant that trades size vs quality.
model.save_pretrained_gguf("model_gguf", tokenizer, quantization_method = "q4_k_m")
model.push_to_hub_gguf("user/model-gguf", tokenizer,
                       quantization_method = ["q4_k_m", "q8_0", "f16"], token = "hf_...")
```

Then **running** the GGUF is an `ollama` job (`ollama create` from the file, `ollama run`), and
serving the merged-16bit at scale is a `vllm` job. Quant guidance: **Q4_K_M** is the everyday
size/quality sweet spot, **Q8_0** near-lossless, **f16** the unquantized ceiling — lower quant = smaller
+ faster but real quality loss. Do **not** merge to 4-bit as your keeper artifact (quality drops;
it's a niche path). Full export matrix + the Ollama/llama.cpp handoff:
[references/export.md](references/export.md).

## Guardrails / gotchas

- **Single-GPU assumption (OSS).** Don't design a multi-node run on the free core; verify the paid
  multi-GPU/multi-node status at docs.unsloth.ai first. `CUDA_VISIBLE_DEVICES` to one GPU if unsure.
- **No mask = wrong training.** Without `train_on_responses_only`, loss covers the prompt; some
  templates then show ~0 loss. Always decode-check the labels once.
- **Wrong chat template = garbage.** The `chat_template` and the mask's `instruction_part`/
  `response_part` must match the *base model's* markers. Use `get_chat_template`; never hand-roll.
- **MoE ≠ 4-bit yet.** Load MoE models in 16-bit; QLoRA-4bit is unsupported for them (verify).
- **GGUF quant is lossy.** Q4_K_M for size, Q8_0/f16 when quality matters. Merged-4bit is discouraged.
- **`import unsloth` first.** Import it before `transformers`/`trl` so its patches apply; heed the
  startup banner that prints patched versions.
- **Numbers drift.** The 2x/70% headline is a *class*, not a guarantee — cite the docs page and hedge.

## Related skills

- **`finetuning`** — the method layer: FT-vs-RAG-vs-prompt, SFT/DPO/GRPO choice, hyperparameters, the
  backend-agnostic `trl`/`peft` theory. Unsloth is *one fast backend* under it; go there for "should
  I / how much / which method." This skill is "make it run on my GPU."
- **`training-data`** — build the JSONL messages / preference pairs you feed the trainer. Data shape
  and quality live there; this skill assumes you already have a dataset.
- **`open-weights`** — choose the base model + read its license/size tradeoffs before you fine-tune.
- **`ollama`** — run the GGUF you export, on one box. Export here, run there.
- **`huggingface`** — get the base weights and host/push the result; `vllm` serves the merged-16bit at
  throughput. This skill produces the artifact; those consume it.

## Checklist

- [ ] Fine-tuning is actually the right move and method is chosen (confirmed via `finetuning`).
- [ ] Base model + license verified on its card (`open-weights`); using a current `unsloth/*-4bit` id.
- [ ] `from_pretrained(load_in_4bit=True, max_seq_length=…)` → `get_peft_model(r, target_modules, …)`.
- [ ] `get_chat_template` applied with the model's correct template.
- [ ] `train_on_responses_only` applied AND the label mask decode-checked (answer-only).
- [ ] Fits the one GPU (batch × grad-accum, `use_gradient_checkpointing="unsloth"`, `adamw_8bit`).
- [ ] Exported for the target: merged_16bit (vLLM/re-host) or GGUF Q4_K_M/Q8_0 (Ollama/llama.cpp).
- [ ] Any speed/VRAM/tier/model claim I stated is hedged + cited to docs.unsloth.ai (not memory).

## References

- [references/masking-and-templates.md](references/masking-and-templates.md) — `get_chat_template`
  options, per-model `instruction_part`/`response_part` pairs, thinking-mode, the vision path, and the
  label-mask sanity check.
- [references/grpo.md](references/grpo.md) — GRPO end-to-end: `GRPOConfig`/`GRPOTrainer`, `vLLM`
  `fast_inference`, a GSM8K reward-function set, and loss-type/DAPO knobs.
- [references/export.md](references/export.md) — full export matrix (merged_16bit / lora / merged_4bit
  / GGUF), quant-method table, `push_to_hub_*`, manual `convert_hf_to_gguf.py`, and the Ollama handoff.
