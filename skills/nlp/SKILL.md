---
name: nlp
description: "Use when choosing how to tokenize text or which transformer type fits an NLP task, when a tokenizer over-fragments non-English text or inflates token cost, when picking a language metric, or when classification, NER or summarization output looks wrong and it is unclear whether the tokenizer, the architecture or the metric is at fault. Covers subword tokenizers, encoder versus decoder versus encoder-decoder choice, sentence embeddings, and the metric families. NOT retrieval or vector search (that is `embeddings-search`), NOT the RAG loop (that is `rag`), NOT prompt wording (that is `prompt-engineering`), NOT training the network (that is `finetuning`)."
tags: [nlp, tokenization, bpe, wordpiece, ner, text-classification, bleu, rouge, perplexity, transformers]
recommends: [deep-learning, embeddings-search, rag, training-data]
origin: risco
---

# nlp — tokenize the text, pick the model type, pick the metric

You own the **language-modeling discipline**: how raw text becomes tokens, which transformer
architecture fits a task, and which metric actually tells you whether it worked. When the
question is "which tokenizer," "BERT or GPT or T5 for this," "why does my Catalan text cost 3×
the tokens," or "is this BLEU score meaningful," this is the skill. You stop at retrieval, the
RAG loop, prompt wording, and the training step itself — those route out (below).

## Route out first (loud — do not duplicate these)

- **Retrieval embeddings + vector search** (which embedding model, chunking, recall@k, rerank)
  → [`../embeddings-search/SKILL.md`](../embeddings-search/SKILL.md). Sentence embeddings *live
  here* as a task; using them to *retrieve* is theirs.
- **The retrieve → prompt → generate → answer loop** and groundedness → [`../rag/SKILL.md`](../rag/SKILL.md).
- **Prompt wording / few-shot / system prompts** → [`../prompt-engineering/SKILL.md`](../prompt-engineering/SKILL.md).
- **Training the network** (LoRA/SFT, trainer loop, PyTorch) → [`../finetuning/SKILL.md`](../finetuning/SKILL.md)
  + [`../deep-learning/SKILL.md`](../deep-learning/SKILL.md).
- **The training corpus itself** (JSONL messages, label sets) → [`../training-data/SKILL.md`](../training-data/SKILL.md).

## Decision: model type per task (get this right before anything else)

Pick the architecture from the task's *shape*, not from what is trendy. A decoder LLM can
technically classify, but a fine-tuned encoder is smaller, faster, cheaper, and usually more
accurate on a fixed-label task.

| Task shape | Architecture | Why | Example families* |
|---|---|---|---|
| Understand / label a whole input (classification, NER, extractive QA, similarity) | **Encoder** (bidirectional) | Attends to the full sentence both directions; cheap to fine-tune and to serve | BERT, RoBERTa, DistilBERT, ModernBERT |
| Free-form generation, chat, few-shot | **Decoder** (autoregressive) | Attends only to prior tokens; predicts the next token | GPT-style, Llama, Gemma, Qwen |
| Transform input → new text (summarize, translate, generative QA) | **Encoder-decoder / seq2seq** | Encoder reads all of the source, decoder writes conditioned on it | T5 / FLAN-T5, BART, mT5 |

\* Architecture families are stable; specific checkpoints and their licenses are not — check the
HF model card before you commit (licenses change; see `open-weights`). ModernBERT (2024) is a
current long-context encoder; verify the latest at author time.

The two most common own-goals: reaching for a 7B decoder to do sentiment on 5 classes (an
encoder does it for a fraction of the cost), and forcing an encoder to *generate* (it cannot —
it has no decoder).

## 1. Tokenization

Every downstream number depends on this step, and its failures are **silent**. The single
load-bearing rule:

> **Load the tokenizer that shipped with the checkpoint, and use the same one at train and
> inference.** `AutoTokenizer.from_pretrained(same_checkpoint)`. A train/inference tokenizer
> mismatch — different vocab, different special tokens, different casing/normalization — maps
> text to token ids the model never saw and corrupts everything downstream with no error.

```python
from transformers import AutoTokenizer   # transformers current major ~v5 (verify at author time)

tok = AutoTokenizer.from_pretrained("bert-base-cased")
enc = tok("Tokenizers matter.", return_offsets_mapping=True)
tok.convert_ids_to_tokens(enc["input_ids"])
# ['[CLS]', 'Token', '##izers', 'matter', '.', '[SEP]']  — note WordPiece '##' continuation + added specials
```

**The four algorithms** (full mechanics in `references/tokenization.md`):

| Algorithm | Builds vocab by… | Applies by… | Used by |
|---|---|---|---|
| **BPE** | merging the most frequent adjacent pair, repeatedly | split to chars, replay learned merges | GPT-2 (byte-level), many |
| **WordPiece** | merging pairs that maximize a likelihood score | longest-match subword from the front (`##` continuations) | BERT family |
| **Unigram** (SentencePiece) | start large, *remove* tokens that least hurt corpus likelihood | most-probable segmentation | T5, ALBERT, mT5 |
| **Byte-level BPE** | BPE over the 256 raw **bytes**, not Unicode chars | same as BPE on bytes | GPT-2, RoBERTa |

- **Byte-level BPE has no `[UNK]`.** Base vocab is exactly 256 (all byte values), so every
  emoji, accent, and script maps to *some* byte sequence — nothing falls out as unknown
  (verified: HF NLP course ch.6). WordPiece/word-level tokenizers *do* have `[UNK]` and lose OOV
  content.
- **SentencePiece is reversible** — it treats space as a normal symbol (the `▁` meta-symbol), so
  `decode(encode(x)) == x` without language-specific detokenization rules. That is why it
  dominates multilingual models.

**Special tokens are not decoration.** `[CLS]`/`<s>` carries the pooled sentence
representation for classification; `[SEP]`/`</s>` marks segment/end; `[PAD]` fills a batch (and
must be masked out via `attention_mask`); `[MASK]` is the MLM target; `[UNK]` is the fallback.
Names differ by model (`[CLS]` in BERT vs `<s>` in RoBERTa) — another reason to never hand-roll
the tokenizer.

**Why it matters — three concrete costs:**

- **$ cost & context.** Token count *is* the bill and the context budget. Fewer tokens per
  sentence = cheaper calls and more room in the window.
- **OOV / information loss.** A tokenizer that emits `[UNK]` throws away content it can't
  represent; byte-level/SentencePiece degrade gracefully instead.
- **Fairness.** Vocab trained mostly on English fragments other scripts far harder — the same
  meaning costs more tokens, more money, and more latency (section 5).

## 2. Tasks

### Text classification (encoder + classification head)
```python
from transformers import pipeline
clf = pipeline("text-classification", model="distilbert-base-uncased-finetuned-sst-2-english")
clf("The service was slow but the food was incredible.")
# [{'label': 'POSITIVE', 'score': 0.99...}]
```
Metric: accuracy on balanced data; **macro-F1** the moment classes are imbalanced (accuracy
lies when 95% of rows are one class).

### Token classification / NER (encoder, per-token labels)
Labels are **B-/I-/O** spans aligned to subword tokens: the first subword of a word gets the
label, continuation subwords and special tokens get `-100` (ignored by the loss). Evaluate with
**seqeval** at the **entity** level, never per-token accuracy (per-token accuracy is inflated by
the flood of `O` tokens).
```python
from transformers import pipeline
ner = pipeline("token-classification", aggregation_strategy="simple")
ner("Ada Lovelace worked in London.")
# groups subwords back into entities: PER 'Ada Lovelace', LOC 'London'
```

### Seq2seq — summarization / translation (encoder-decoder)
```python
summ = pipeline("summarization", model="facebook/bart-large-cnn")
summ(long_article, max_length=130, min_length=30)
```
Metric: **ROUGE** for summarization, **BLEU/chrF** for translation — with the heavy caveat in
section 4.

### Sentence embeddings (SBERT — the *task*, not retrieval)
```python
from sentence_transformers import SentenceTransformer   # sentence-transformers ~v5 (verify)
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
emb = model.encode(["The weather is lovely today.", "It's so sunny outside!"])
model.similarity(emb, emb)   # semantic textual similarity / clustering / paraphrase mining
```
Producing/judging embeddings **for retrieval** (model choice, chunking, recall@k, rerankers) is
[`embeddings-search`](../embeddings-search/SKILL.md), not here.

## 3. Evaluation — pick the metric that matches the task

| Task | Primary metric | Catches | Trap |
|---|---|---|---|
| Classification | accuracy + **macro-F1** | wrong labels | accuracy hides minority-class failure |
| NER / token | **entity-level F1** (seqeval) | missed/partial spans | per-token accuracy is inflated by `O` |
| Translation | **BLEU / chrF** | n-gram overlap w/ reference | weak on meaning; chrF better for morphology |
| Summarization | **ROUGE** (1/2/L) | recall of reference n-grams | rewards copying; blind to faithfulness |
| Generation (LM) | **perplexity** | how well the model predicts held-out text | tokenizer-dependent — not comparable across tokenizers |
| Open-ended / chat | **LLM-as-judge** + human | quality overlap metrics miss | judge bias (position, verbosity, self-preference) |

**The caveat that governs this whole section:** BLEU, ROUGE, and chrF are n-gram/character
overlap metrics and **correlate weakly with human judgment on open-ended and creative
generation** — they reward matching the reference's exact phrasing, so a correct paraphrase
scores low and a fluent-but-wrong copy scores high (well documented; e.g. the summarization and
MT-evaluation literature). Use them for **regression tracking on a fixed reference set**, never
as the final verdict on quality. For open-ended output, use an **LLM-as-judge rubric plus a
human spot-check** — and know the judge has its own biases (position, verbosity, self-preference),
so pin the rubric and randomize order.

**Perplexity** = exp(mean token NLL): lower means the model predicts held-out text better. It is
**tokenizer-dependent**, so two models with different tokenizers have non-comparable perplexities
— only compare within the same tokenizer/vocab. Runnable snippets for seqeval, sacrebleu, ROUGE,
perplexity, and an LLM-judge harness are in `references/evaluation.md`.

## 4. Multilingual pitfalls

The English-centric trap: a tokenizer whose vocab was learned mostly on English **over-fragments
other scripts**. The same sentence in Ukrainian, Arabic, Hindi, or even accented Catalan can take
**2–15× more tokens** than its English equivalent (Petrov et al., *Language Model Tokenizers
Introduce Unfairness Between Languages*, NeurIPS 2023). That "fertility" (tokens per word)
inflation is a triple tax:

- **Money** — more tokens per identical meaning = a proportionally larger bill for the same work.
- **Context** — over-fragmented text eats the window faster, so fewer few-shot examples fit and
  long documents truncate sooner.
- **Quality** — sequences fragmented into byte-shards are harder to model, degrading accuracy for
  exactly the users the tool already serves worst.

Mitigations: prefer a **multilingual tokenizer/model** (mT5, XLM-R, a SentencePiece-based model)
whose vocab actually covers your languages; **measure fertility** on your own corpus (tokens per
word, per language) before you commit; and don't benchmark cost or latency only on English.

## Guardrails / gotchas

- **Tokenizer must match the checkpoint, at train and inference.** Mismatch corrupts silently,
  no error. The most expensive bug in this skill.
- **Encoders can't generate; don't classify with a giant decoder by default.** Match architecture
  to task shape.
- **BLEU/ROUGE/chrF ≠ quality on open-ended text.** Overlap metrics; weak human correlation. Track
  regressions with them; judge quality with an LLM-judge + human.
- **Entity-F1 (seqeval), not token accuracy, for NER.** `O` tokens inflate accuracy toward 1.0.
- **macro-F1, not accuracy, on imbalanced classes.**
- **Perplexity is tokenizer-relative** — never compare it across different tokenizers.
- **Don't benchmark tokenization/cost only in English** — fertility varies 2–15× across scripts.
- **Never assert a model's license from memory** — check the current model card; license classes
  shift (Llama = Meta Community license, not OSI-open; Gemma = custom terms; etc.).

## Related skills

- [`embeddings-search`](../embeddings-search/SKILL.md) — retrieval embeddings, chunking, recall@k,
  reranking. NLP owns *making/judging* sentence embeddings as a task; using them to search is theirs.
- [`rag`](../rag/SKILL.md) — the full retrieve→generate answer loop and groundedness.
- [`prompt-engineering`](../prompt-engineering/SKILL.md) — the wording of the prompt.
- [`finetuning`](../finetuning/SKILL.md) + [`deep-learning`](../deep-learning/SKILL.md) — actually
  training/adapting the network (this skill picks the type and metric; those move the weights).
- [`training-data`](../training-data/SKILL.md) — building the labeled corpus you train on.

## Checklist

- [ ] Architecture picked from task shape (encoder / decoder / enc-dec), not habit.
- [ ] Tokenizer loaded from the *same* checkpoint, used identically at train and inference.
- [ ] Tokenizer choice justified vs OOV, cost, and — if multilingual — measured fertility.
- [ ] Special tokens and `attention_mask` handled (padding masked, `-100` on ignored labels).
- [ ] Metric matches the task: macro-F1 (imbalanced), entity-F1/seqeval (NER), ROUGE/BLEU/chrF
      only as a regression signal, LLM-judge + human for open-ended.
- [ ] Perplexity compared only within one tokenizer.
- [ ] Retrieval / RAG / prompt / training concerns routed to the sibling skill, not re-solved here.

## References

- `references/tokenization.md` — BPE/WordPiece/Unigram/byte-level training mechanics, special
  tokens per family, offset mapping, and a fertility-measuring snippet.
- `references/evaluation.md` — runnable seqeval, sacrebleu (BLEU/chrF), ROUGE, perplexity, and an
  LLM-as-judge rubric, with when each lies.
