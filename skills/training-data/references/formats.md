# Dataset formats — full field matrix & conversions

Grounded in the TRL "Dataset formats and types" doc (tagged `v1.8.0` at author time). TRL and
`datasets` move monthly — verify field names against the current TRL docs before you rely on
them. Field names below are verbatim from that doc.

## The two axes

- **Format** — `standard` (plain-text string values) vs `conversational` (values are lists of
  `{"role", "content"}` messages). Conversational is the default for chat models.
- **Type** — the task, which sets the columns.

| Type | Standard | Conversational |
| --- | --- | --- |
| Language modeling | `{"text": "..."}` | `{"messages": [{"role","content"}, ...]}` |
| Prompt-only | `{"prompt": "..."}` | `{"prompt": [ ... ]}` |
| Prompt-completion | `{"prompt", "completion"}` | `{"prompt": [...], "completion": [...]}` |
| Preference (explicit) | `{"prompt", "chosen", "rejected"}` | same keys, each a message list |
| Preference (implicit) | `{"chosen", "rejected"}` (no `prompt`) | same, each a full conversation |
| Unpaired preference (KTO) | `{"prompt", "completion", "label"}` | same, `label` a bool |
| Stepwise supervision | `{"prompt", "completions": [...], "labels": [bool,...]}` | — |

`label` / `labels` are JSON booleans (`true`/`false`).

## Which trainer wants which type

| Trainer | Type |
| --- | --- |
| `SFTTrainer` | language modeling **or** prompt-completion |
| `DPOTrainer` | preference (explicit prompt recommended) |
| `KTOTrainer` | unpaired preference, or preference |
| `RewardTrainer` | preference (implicit prompt recommended) |
| `GRPOTrainer`, `RLOOTrainer`, `OnlineDPO/Nash/XPO` | prompt-only |
| `ORPOTrainer`, `CPOTrainer`, `BCOTrainer` | preference (explicit) / unpaired |
| `PRMTrainer` | stepwise supervision |
| `PPOTrainer` | tokenized language modeling |

Experimental trainers live under `trl.experimental.*` — confirm the import path in the current
release.

## Alpaca instruction format (classic, not native TRL)

```json
{"instruction": "Summarize the paragraph.", "input": "<long text>", "output": "<summary>"}
```

`input` is optional (empty string when the instruction is self-contained). TRL does not train on
these keys directly. Convert:

**To `messages` (preferred for chat models):**

```python
def alpaca_to_messages(ex):
    user = ex["instruction"] + (("\n\n" + ex["input"]) if ex.get("input") else "")
    return {"messages": [{"role": "user", "content": user},
                         {"role": "assistant", "content": ex["output"]}]}
```

**To a single `text` string via a prompt template (Unsloth-style) — append EOS:**

```python
TEMPLATE = ("### Instruction:\n{instruction}\n\n### Input:\n{input}\n\n### Response:\n{output}")
def alpaca_to_text(ex, eos):
    return {"text": TEMPLATE.format(**ex) + eos}   # eos = tokenizer.eos_token — REQUIRED
```

Without the EOS token the model never learns to stop generating. When formatting to `text` you
are also bypassing the chat template, so this path is for base/completion-style training; for
chat models prefer `messages` + `apply_chat_template`.

## Tool-calling data

Add a `tools` column (list of JSON-schema function specs); assistant turns carry `tool_calls`
instead of `content`, and tool results come back as a `{"role": "tool", ...}` message.

```python
from transformers.utils import get_json_schema   # build the schema from a Python signature
schema = get_json_schema(my_function)
row = {"messages": [...], "tools": [schema]}
```

On `datasets` ≥4.7 use the `Json()` feature type for arbitrary tool-arg objects
(`Dataset.from_list(data, on_mixed_types="use_json")`); on older `datasets` store `tools` as a
`json.dumps(...)` string.

## Vision (VLM) data

Add an `images` key (list of PIL images per row) or `image` (single), and make each message
`content` a list of typed parts:

```python
"content": [{"type": "image"}, {"type": "text", "text": "What is in the image?"}]
```

Mixing text-only and image rows in one dataset needs `transformers` ≥ 4.57.

## Type→type conversions (with `datasets`)

- **prompt-completion → language-modeling**: concatenate `prompt` + `completion` into `text`.
- **preference → prompt-completion**: drop `rejected`, rename `chosen` → `completion`.
- **preference → prompt-only**: drop `chosen` and `rejected`.
- **implicit → explicit preference**: `trl.extract_prompt` pulls the shared prefix into `prompt`.
- **preference → unpaired (KTO)**: `trl.unpair_preference_dataset` — **only valid if every
  `chosen` is genuinely good and every `rejected` genuinely bad** (KTO's label is absolute
  good/bad, not relative). If your pairs are "better vs worse" but both acceptable, unpairing
  mislabels them.
- **stepwise → unpaired**: join `completions`, merge `labels` (e.g. logical AND).

Do conversions **before** `apply_chat_template`, on the structured `messages`, so they behave
consistently across formats.

## Sanity checks worth automating

- Every SFT conversational row ends on an `assistant` turn.
- Roles alternate sensibly; no empty `content`.
- Preference `chosen != rejected`.
- KTO `label` present and boolean; class balance is not 100/0.
- The whole file round-trips through `apply_chat_template` for the *target* model with no raise.
