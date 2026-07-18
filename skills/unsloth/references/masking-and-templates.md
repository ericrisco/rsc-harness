# Chat templates + response-only masking

Facts here track docs.unsloth.ai/basics/chat-templates (accessed 2026-07). Template names and turn
markers change with new model releases — **verify the pair for your exact base model.**

## Why a helper and not a string

A chat model was pretrained with a specific set of turn markers (`<|start_header_id|>…`,
`<start_of_turn>…`, `<|im_start|>…`). If you concatenate messages with the wrong markers, the model
never sees its own format and the fine-tune underperforms or degenerates. `get_chat_template` writes
the *correct* template onto your tokenizer; `apply_chat_template` then renders your message list into
the single `text` string the trainer consumes.

```python
from unsloth.chat_templates import get_chat_template

tokenizer = get_chat_template(
    tokenizer,
    chat_template = "llama-3.1",   # match the base model
    # mapping = {"role":"from","content":"value","user":"human","assistant":"gpt"},  # if your
    #   dataset uses ShareGPT-style keys instead of role/content
    # map_eos_token = True,        # map e.g. <|im_end|> -> the model's EOS
)

def to_text(example):
    example["text"] = tokenizer.apply_chat_template(
        example["messages"], tokenize = False, add_generation_prompt = False,
    )
    return example

dataset = dataset.map(to_text)
```

Supported template names include (non-exhaustive; verify live): `llama-3`, `llama-3.1`, `chatml`,
`mistral`, `phi-4`, `gemma-3`, `qwen`, `zephyr`, `vicuna`, `alpaca`, `unsloth`. Use the one that
matches your checkpoint.

Thinking / reasoning models expose a toggle at render time:

```python
tokenizer.apply_chat_template(msgs, tokenize=False,
                              add_generation_prompt=True, enable_thinking=True)  # or False
```

## `train_on_responses_only` — the mask

Supervised fine-tuning of a chat model should compute loss on the **assistant** tokens only. Without
this, the model is also trained to predict the user's words; loss can even collapse to ~0 on some
templates (the "zero-loss trap"). Wrap the trainer AFTER constructing it:

```python
from unsloth.chat_templates import train_on_responses_only

trainer = train_on_responses_only(
    trainer,
    instruction_part = "<|start_header_id|>user<|end_header_id|>\n\n",
    response_part    = "<|start_header_id|>assistant<|end_header_id|>\n\n",
)
```

`instruction_part` / `response_part` are the template's own turn-opening markers. Everything from an
`instruction_part` up to the next `response_part` is masked (label = `-100`); the assistant span keeps
its labels. **The strings must match the template you applied.** Common pairs (verify per model):

| Base family      | `instruction_part`                              | `response_part`                                    |
| ---------------- | ----------------------------------------------- | -------------------------------------------------- |
| Llama-3 / 3.1    | `<\|start_header_id\|>user<\|end_header_id\|>\n\n`  | `<\|start_header_id\|>assistant<\|end_header_id\|>\n\n` |
| Gemma-3 / vision | `<start_of_turn>user\n`                         | `<start_of_turn>model\n`                           |
| ChatML (Qwen…)   | `<\|im_start\|>user\n`                            | `<\|im_start\|>assistant\n`                          |

## Sanity-check the mask (always do this once)

```python
row = trainer.train_dataset[0]
# 1) full sequence — should include both user + assistant turns
print(tokenizer.decode(row["input_ids"]))
# 2) UNMASKED labels only — should be the ASSISTANT answer and nothing else
print(tokenizer.decode(
    [tokenizer.pad_token_id if x == -100 else x for x in row["labels"]]
).replace(tokenizer.pad_token, " "))
```

If step 2 prints the user's question, your `instruction_part`/`response_part` don't match the
template — fix them before training. Spending GPU-hours on an unmasked run is the classic waste.

## Vision (VLM)

Vision fine-tunes use `FastVisionModel.from_pretrained(...)` and a processor/tokenizer pair; the
template and mask concepts carry over but the collator handles image tokens. See
docs.unsloth.ai for the current VLM notebook — the exact API for multimodal collation moves faster
than the text path, so pull it live rather than trusting a frozen snippet.
