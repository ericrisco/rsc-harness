# GRPO / reasoning fine-tuning with Unsloth

Mechanics only. **Whether** to do RL vs SFT vs DPO is a `finetuning` decision. Tracks
docs.unsloth.ai's RL guide (accessed 2026-07); reward APIs and loss-type flags move — verify.

## The idea

GRPO (Group Relative Policy Optimization) doesn't imitate a target string. It samples several
completions per prompt, scores each with **reward functions you write**, and pushes weights toward the
higher-reward samples. That's how you train a model to *reason* (produce correct answers in a required
format) rather than memorize outputs. Unsloth's win here is memory — the docs cite ~80% less VRAM for
GRPO vs a standard setup (verify), and it can drive generation through a built-in vLLM engine.

## Load with fast inference

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/Llama-3.1-8B-Instruct",  # verify current id
    max_seq_length = 1024,          # room for the reasoning trace
    load_in_4bit = True,
    fast_inference = True,          # use the built-in vLLM engine for rollouts
    gpu_memory_utilization = 0.8,   # lower if you OOM
)
model = FastLanguageModel.get_peft_model(model, r = 32, lora_alpha = 64,
    target_modules = ["q_proj","k_proj","v_proj","o_proj",
                      "gate_proj","up_proj","down_proj"],
    use_gradient_checkpointing = "unsloth", random_state = 3407)
# For memory-efficient GRPO with vLLM you may also set:
#   os.environ["UNSLOTH_VLLM_STANDBY"] = "1"
```

## Reward functions (GSM8K-style)

Each reward fn takes `completions` (+ `prompts`, `answer`, `**kwargs`) and returns a list of floats,
one per completion. Combine several — correctness plus format shaping:

```python
import re

def correctness_reward(prompts, completions, answer, **kw):
    responses = [c[0]["content"] for c in completions]
    got = [extract_xml_answer(r) for r in responses]
    return [2.0 if g == a else 0.0 for g, a in zip(got, answer)]

def strict_format_reward(completions, **kw):
    pattern = r"^<reasoning>\n.*?\n</reasoning>\n<answer>\n.*?\n</answer>\n$"
    responses = [c[0]["content"] for c in completions]
    return [0.5 if re.match(pattern, r, re.S) else 0.0 for r in responses]

def extract_xml_answer(text):
    return text.split("<answer>")[-1].split("</answer>")[0].strip()
```

Keep rewards simple and hard to game — a sloppy reward degrades the model (reward hacking).

## Train

```python
from trl import GRPOConfig, GRPOTrainer

trainer = GRPOTrainer(
    model = model, processing_class = tokenizer,
    reward_funcs = [correctness_reward, strict_format_reward],
    train_dataset = dataset,   # prompts + ground-truth "answer"
    args = GRPOConfig(
        learning_rate = 5e-6,
        per_device_train_batch_size = 1,
        gradient_accumulation_steps = 4,
        num_generations = 8,       # completions sampled per prompt (the "group")
        max_prompt_length = 256,
        max_completion_length = 512,
        max_steps = 250,
        output_dir = "outputs_grpo",
        # loss_type = "grpo" | "dr_grpo" | "bnpo" | "dapo"
        # epsilon = 0.2, epsilon_high = 0.28, delta = 1.5   # DAPO / two-sided knobs
        # mask_truncated_completions = True
    ),
)
trainer.train()
```

Notes:
- `num_generations` is the group size — bigger gives a better reward signal but costs generation time
  and VRAM.
- Advanced objectives (DAPO, Dr. GRPO) are `loss_type` + `epsilon`/`delta` flags on `GRPOConfig` —
  verify the current names on the RL guide.
- Reasoning traces need context headroom: budget `max_prompt_length + max_completion_length` under
  `max_seq_length`.
- Export the result exactly like an SFT run — see [export.md](export.md).
