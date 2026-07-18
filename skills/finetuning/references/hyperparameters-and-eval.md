# hyperparameters, forgetting & evaluation — the tuning playbook

Depth overflow for `SKILL.md`. Defaults are starting points, not laws; the eval set is the judge.

## LoRA capacity: r, alpha, target_modules

The adapter adds two low-rank matrices per targeted layer; its output is scaled by
**`lora_alpha / r`**. So `r` sets *capacity* and `alpha` sets *how strongly* the adapter speaks.

- **`r`** — rank / capacity. `8–16` for style, tone, format nudges; `32–64+` for harder new
  behavior or larger models. Bigger `r` = more trainable params = more VRAM and more overfit risk.
- **`alpha`** — common heuristic **`alpha ≈ 2·r`** (scaling ≈ 2). Fix that ratio and tune the LR
  rather than juggling both knobs at once.
- **`target_modules`** — `"all-linear"` is the safe default and is the recommended setting for
  QLoRA (LoRA on every linear layer). Naming only a couple of projections, or misspelling them, is
  a top silent failure: the run completes, loss barely moves, the adapter learned ~nothing. Newer
  "LoRA-without-regret" guidance favors all-linear + higher rank + a tuned LR — verify current advice.
- **`lora_dropout`** ~`0.05`, **`bias="none"`**, **`task_type="CAUSAL_LM"`** are the usual defaults.

## Learning rate, epochs, batch, warmup

| Knob | SFT (LoRA/QLoRA) | Full FT | Preference (DPO/KTO/GRPO) |
|---|---|---|---|
| Learning rate | ~1e-4 – 2e-4 | ~2e-5 (SFTConfig default) | DPO/KTO ~5e-7 · GRPO ~1e-6 |
| Epochs | 1–3 | 1–3 | usually 1 |
| Warmup ratio | 0.03 – 0.1 | 0.03 – 0.1 | 0.03 – 0.1 |

- **Effective batch = `per_device_train_batch_size × gradient_accumulation_steps × world_size`.**
  When VRAM caps the per-device batch, raise `gradient_accumulation_steps` to reach a stable
  effective batch (commonly 16–64) without more memory.
- **Fit-more levers**: `packing=True` (fills sequences to `max_length`, less padding waste),
  `gradient_checkpointing=True` (trade compute for memory), QLoRA 4-bit base, `activation_offloading`.
- **Epochs is the overfitting dial.** Adapters memorize a small corpus fast; 1–3 passes is normal.
  Prefer more/cleaner data over more epochs.

## Catastrophic forgetting

Narrow fine-tuning can erode general ability. Mitigations, cheapest first:

1. **LoRA/QLoRA over full FT** — base weights stay frozen, so the model can't overwrite what it
   knew; the adapter is a small, removable delta.
2. **Low LR, few epochs** — big updates on a narrow task are what erase general skills.
3. **Replay / data mixing** — blend a slice of general instruction data into the task data so the
   model keeps its assistant behavior. A common mix is a minority fraction of general data.

Symptom: the tuned model nails the target task but "got dumber" everywhere else. That is forgetting,
not a data bug — pull LR/epochs down and add replay.

## Evaluation — the part people skip and regret

1. **Split a held-out set before training** the model never sees. Keep it quarantined.
2. **Define a concrete task metric** up front: exact-match, JSON-valid rate, a rubric/LLM-judge
   score, or a domain metric. "Looks good" is not a metric.
3. **Watch eval loss, not train loss.** Train loss always falls. When **eval loss turns upward**
   while train loss keeps dropping, you are overfitting — stop, lower LR, add data, or take an
   earlier checkpoint. Set `eval_strategy="steps"` + `eval_steps` and log both curves.
4. **Contamination kills the signal.** If eval examples leaked into training, the metric is a lie.
   De-dup train against eval; corpus-side hygiene is `training-data`.
5. **Compare against the untuned baseline** on the same held-out set — a fine-tune that doesn't
   beat "base model + a good prompt" was not worth the GPU (loop back to the decision gate).

The general LLM/agent eval harness (judges, scoring pipelines, regression gates) is `agent-eval`;
bring your task-specific metric here and gate the run on it.

## A pre-flight sanity pass (catch the silent failures early)

- Print one fully-rendered training example (post chat-template) and read it — is the template
  right, are special tokens present, is the assistant span the only thing in the loss?
- Confirm trainable-param count is non-trivial (`model.print_trainable_parameters()` on the PEFT
  model). Near-zero or "no trainable params" means `target_modules` missed.
- Overfit a tiny batch (a few dozen rows) on purpose — train loss should crash toward zero. If it
  won't, the wiring (template / targets / labels) is broken before you spend on the full run.
- Generate from the checkpoint with the **serving** template and eyeball a handful of outputs for
  the failure mode you're fixing.
