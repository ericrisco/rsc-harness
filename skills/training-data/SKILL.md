---
name: training-data
description: "Use when assembling or curating the corpus a fine-tune trains on — turning raw examples into the JSONL shape a trainer expects (instruction, conversational, preference-pair or binary-label), matching the data to the model's chat template, generating synthetic or distilled examples, deduplicating and decontaminating against eval sets, and quality-filtering. NOT cleaning tabular rows, nulls and dtypes (that is `data-cleaning`), NOT building a retrieval corpus of chunks and embeddings (that is `embeddings-search`), NOT running the trainer or picking hyperparameters (that is `finetuning`)."
tags: [training-data, fine-tuning-dataset, jsonl, chat-template, preference-data, dpo, kto, synthetic-data, decontamination, dataset-curation]
recommends: [finetuning, unsloth, huggingface, data-cleaning]
origin: risco
---

# training-data — the corpus a fine-tune actually eats

You own the **training corpus**: the JSONL of chat turns, instruction triples, or preference
pairs that a trainer reads. The deliverable is a validated, deduplicated, decontaminated,
license-clean file in the **exact shape the trainer expects**, rendered through the **target
model's chat template**. You stop the moment that file loads cleanly and round-trips through
`apply_chat_template`. You do not choose LoRA rank or launch the run — that is
[`finetuning`](../finetuning/SKILL.md) / [`unsloth`](../unsloth/SKILL.md).

**Loud boundary.** This is *LLM training corpora* — messages, instruction triples, preference
pairs. It is **not**:

- Tabular row cleaning — nulls, dtypes, dedupe of CSV rows, category normalization → [`data-cleaning`](../data-cleaning/SKILL.md).
- A *retrieval* corpus — chunking documents and embedding them for search → [`embeddings-search`](../embeddings-search/SKILL.md).
- Actually training or serving — hyperparameters, the run, export → [`finetuning`](../finetuning/SKILL.md), [`unsloth`](../unsloth/SKILL.md), [`huggingface`](../huggingface/SKILL.md).

**Version reality (verified July 2026 — re-verify, these move monthly).** TRL is on the **v1.x**
line (its dataset-formats doc was tagged `v1.8.0` at author time); `transformers` is in the
**4.57+** era (mixed text+vision data needs ≥4.57); `datasets` is **4.x** (the `Json()` feature
type needs ≥4.7). Pin whatever you install — do not trust these numbers as current.

## 1. The format the trainer expects (pick by trainer, not by taste)

The trainer dictates the columns. Get this wrong and TRL either errors or, worse, trains on a
mangled string. Two axes: **format** (`standard` = plain strings vs `conversational` =
`messages` lists) and **type** (the task). One JSON object per line = JSONL.

| Trainer | Dataset type | Required keys |
| --- | --- | --- |
| `SFTTrainer` | language-modeling **or** prompt-completion | `messages` / `text`, or `prompt`+`completion` |
| `DPOTrainer`, `ORPOTrainer`, `CPOTrainer` | preference (explicit prompt recommended) | `prompt`, `chosen`, `rejected` |
| `KTOTrainer`, `BCOTrainer` | unpaired preference (binary label) | `prompt`, `completion`, `label` |
| `RewardTrainer` | preference (implicit prompt) | `chosen`, `rejected` |
| `GRPOTrainer`, `RLOOTrainer`, `PPOTrainer` | prompt-only | `prompt` |

Tiny JSONL of each (conversational values are **lists of `{role, content}`**; `label` is a JSON
boolean):

```jsonl
# Alpaca instruction (standard) — classic; NOT a native TRL type, see below
{"instruction": "Classify the sentiment.", "input": "The battery dies in an hour.", "output": "negative"}

# Conversational messages (SFT) — the default for chat fine-tunes
{"messages": [{"role": "system", "content": "You are a terse support agent."}, {"role": "user", "content": "My order never arrived."}, {"role": "assistant", "content": "Sorry about that — what is your order number?"}]}

# Preference pair (DPO) — chosen beats rejected for the same prompt
{"prompt": [{"role": "user", "content": "Define a hash map in one sentence."}], "chosen": [{"role": "assistant", "content": "A hash map stores key-value pairs and finds a value by hashing its key to a bucket, giving average O(1) lookup."}], "rejected": [{"role": "assistant", "content": "It's a fast dictionary thing."}]}

# KTO / unpaired preference — one completion + a good/bad boolean label
{"prompt": [{"role": "user", "content": "Define a hash map in one sentence."}], "completion": [{"role": "assistant", "content": "It's a fast dictionary thing."}], "label": false}
```

**Alpaca is not a native TRL type.** `{instruction, input, output}` is the Stanford-Alpaca
convention, still common in Unsloth notebooks, but TRL trains on `text`/`messages`/`prompt`+
`completion`. You must either (a) map it into `messages` (instruction+input → user, output →
assistant), or (b) render it into a single `text` string via a prompt template — **and append
the EOS token yourself**, or the model never learns to stop (the #1 Unsloth-Alpaca bug). Prefer
(a) `messages` for chat models. Full field matrix, tool-calling (`tools` column) and vision
(`images`) extras, and every type→type conversion live in `references/formats.md`.

## 2. Chat templates — the silent run-wrecker

A chat template is a **Jinja** string stored in the tokenizer (in `tokenizer_config.json` under
`chat_template`, or a standalone `chat_template.jinja` in newer tokenizers). It maps a `messages`
list to the exact token string the model was trained on — special tokens (`<|im_start|>`,
`[INST]`, `<|start_header_id|>`, …) and all. You render it, you never hand-type it:

```python
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("<target-model>")   # the model you will fine-tune

# TRAINING: no trailing generation prompt — the assistant turn is already in the data
text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)

# INFERENCE: add_generation_prompt=True appends the assistant turn-start so the model continues
prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
```

Three ways this silently destroys a run — **no error, just a worse model**:

- **Hand-formatting the tokens.** Writing `<|im_start|>user\n…` strings yourself and getting one
  token, one newline, or the BOS wrong. Train-time string ≠ inference-time string → the model
  learns a distribution it is never served. Always render via `apply_chat_template`.
- **Using the wrong model's template.** The template must be the one of the model you are
  fine-tuning. Copy Llama's template onto a Qwen fine-tune and every example is subtly malformed.
- **A base model with no template at all.** Base (non-instruct) checkpoints often ship
  `chat_template = None`. `apply_chat_template` then raises — you must **choose and attach** a
  template (e.g. ChatML) and use that same one at inference forever after.

Also decide **loss masking**: for chat SFT you usually train only on the assistant tokens
(`completion_only_loss` / assistant-only masking in SFTTrainer, or a completion-only collator),
so the model is not penalized for "predicting" the user's words. TRL applies the template for
you when the dataset is conversational — let it, rather than pre-flattening to `text`.

## 3. Synthetic data & distillation

Not enough real examples? Generate them. Two workhorses: **Self-Instruct** (seed a few
hand-written examples, prompt a strong model to produce more, filter) and **Evol-Instruct**
(iteratively mutate prompts to be harder/deeper). Wrap them in a pipeline framework rather than
ad-hoc loops (see §7).

**Licensing trap — read before you distill.** Generating your training data from *another
model's outputs* ("distillation") is a **terms-of-service question, not just a quality one**.
Some providers' terms restrict using their outputs to train competing models; some open-weight
licenses carry naming/derivative obligations (e.g. Llama-derived data/models may inherit naming
requirements). Never assert a model's license from memory — check the specific model card and
provider ToS at author time (licenses change). If in doubt, distill from an
openly-licensed-for-this-use model, and record the provenance per example.

## 4. Dedup + decontamination (skip these and your numbers lie)

- **Dedup.** Exact dedup is trivial (hash the text). Real corpora need **near-dup** removal:
  **MinHash + LSH** (Jaccard similarity over shingles) catches templated/boilerplate repeats
  that inflate a few patterns. Dupes waste compute and bias the model toward whatever is
  over-represented.
- **Decontamination — the one people forget.** Remove any training example that overlaps your
  **eval / benchmark test sets** (n-gram overlap, e.g. long-n-gram match against MMLU, GSM8K,
  your own held-out set). If test items leak into training, your eval score is **inflated** and
  meaningless — you measured memorization, not capability. Decontaminate *against every metric
  you will report*, including your private eval. Code for both in `references/synthesis-dedup-quality.md`.

## 5. Quality filtering — a few thousand clean beats a noisy dump

**LIMA** (*Less Is More for Alignment*, arXiv **2305.11206**) is the anchor: ~1,000 carefully
curated examples produced a strong instruction-follower — for **alignment/style** SFT, quality
and diversity dominate raw volume. (This is about teaching *behavior/format*, not injecting a
lot of new *knowledge* — a broad knowledge shift still wants scale.) Cheap, high-leverage
filters, applied before you spend GPU hours:

- **Length/format**: drop empty or truncated turns, runaway-length outliers, malformed JSON,
  wrong-role sequences (two `assistant` turns in a row, missing final assistant turn for SFT).
- **Dedup + decontam** from §4.
- **Diversity**: cluster/embed and prune near-identical intents so the set is not 80% one task.
- **Model/heuristic scoring**: rate helpfulness/correctness (a reward model or an LLM judge) and
  keep the top slice — but audit the judge, LLM-as-judge has its own biases.

## 6. Licensing — two separate questions

1. **The dataset's own license** — what *you* release the JSONL under, and whether you *can*
   release it (aggregating others' data does not launder their licenses).
2. **Source-usage restrictions** — the terms on where each example *came from*: scraped-site
   ToS, the license of any base dataset you built on, and the model-output ToS from §3. These
   bind even if you never publish. Keep a provenance column so an audit can trace every row.

State the license *class* and point at the source; never freeze a license as bare fact.

## 7. Tooling

- **distilabel** (Argilla, now under Hugging Face) — the go-to synthetic-data / AI-feedback
  pipeline framework: composable `Step`/`Task` graphs (`TextGeneration`, `UltraFeedback`,
  `EvolInstruct`), serializable to YAML/JSON, outputs a `Distiset` you push to the Hub. v1.x.
- **Argilla** — human-in-the-loop annotation/review UI to label and vet examples.
- **HF `datasets`** — load/`map`/`filter`/`push_to_hub`; the substrate everything else speaks.
- **Lilac** — dataset exploration/clustering for quality triage. **[verify — the open-source
  repo was archived (read-only) around July 2025 after the Databricks acquisition]**; treat as
  unmaintained OSS and confirm before depending on it.

## Worked lifecycle (build → validate → dedup → decontaminate → format → push)

```python
from datasets import load_dataset
from transformers import AutoTokenizer

ds  = load_dataset("json", data_files="raw.jsonl", split="train")
tok = AutoTokenizer.from_pretrained("<target-model>")

# 1. VALIDATE shape + render every row through the template (catches template errors NOW,
#    not after 3 GPU-hours). A base model with chat_template=None raises here — attach one.
def render(ex):
    return {"text": tok.apply_chat_template(ex["messages"], tokenize=False,
                                            add_generation_prompt=False)}
ds = ds.filter(lambda ex: isinstance(ex.get("messages"), list) and ex["messages"]
               and ex["messages"][-1]["role"] == "assistant")   # SFT: must end on assistant
ds = ds.map(render)

# 2. DEDUP (near-dup) and 3. DECONTAMINATE against your eval set — see references for MinHash
#    + n-gram code; both are one filter pass each.

# 4. PUSH with a data card recording license + provenance.
ds.push_to_hub("me/support-sft", private=True)
```

Deep code — MinHash/LSH dedup, n-gram decontamination, a distilabel Self-Instruct pipeline, and
the full conversion matrix — is in `references/`.

## Guardrails / gotchas

- **Wrong format for the trainer** = hard error or silent garbage. Match the table in §1 to your
  trainer before generating a single row.
- **Hand-typed chat tokens** train a distribution you never serve. Render via `apply_chat_template`.
- **No EOS in Alpaca-`text` formatting** → the model never stops. Append it.
- **Skipped decontamination** → inflated eval; you measured leakage. Non-negotiable.
- **Distilling model outputs** can violate ToS. Provenance + license check first.
- **Quantity worship** — a noisy 500k dump loses to a curated few-thousand for alignment (LIMA).
- `label` in KTO/unpaired data is a JSON boolean (`true`/`false`), not the strings `"true"`/`"1"`.

## Related skills

- [`finetuning`](../finetuning/SKILL.md) — consumes this corpus: chooses SFT vs DPO vs KTO,
  LoRA/QLoRA, hyperparameters, runs trl/peft. You hand it the file; it trains.
- [`unsloth`](../unsloth/SKILL.md) — one fast single-GPU training backend + GGUF export;
  its notebooks expect exactly the Alpaca/`messages` shapes you produce here.
- [`huggingface`](../huggingface/SKILL.md) — the Hub you `push_to_hub` the dataset to, model
  cards, and hosted/routed inference of the *result*.
- [`data-cleaning`](../data-cleaning/SKILL.md) — upstream when your raw source is dirty *tabular*
  rows; it hands you clean rows, you turn rows into training examples.

## Checklist

- [ ] Format matches the target **trainer** (§1 table); one JSON object per line.
- [ ] Every row renders through the **target model's** `apply_chat_template` without error.
- [ ] SFT rows end on an `assistant` turn; preference rows have distinct `chosen`/`rejected`; KTO `label` is a boolean.
- [ ] Loss masking / EOS handling decided (assistant-only loss; EOS appended if flattening to `text`).
- [ ] Near-duplicates removed (MinHash/LSH); exact dupes gone.
- [ ] **Decontaminated** against every eval/benchmark you will report.
- [ ] Quality-filtered (length/format/diversity/score) — curated over bulk.
- [ ] Dataset license set **and** source-usage/model-output ToS checked; provenance recorded.
- [ ] Data card written; pushed (private first).
