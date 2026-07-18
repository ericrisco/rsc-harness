# Tokenization — mechanics, special tokens, fertility

Depth overflow for SKILL.md section 1. Grounded in the HF NLP course (chapters 6.4–6.8) and the
`tokenizers` library; verify current API at author time (transformers current major ~v5).

## The four subword algorithms

All three "learned" algorithms share a preprocessing step (normalization + pre-tokenization);
they differ in how they build and apply the vocabulary.

### BPE (Byte-Pair Encoding) — GPT-2, RoBERTa, and many others

1. Start from a base vocabulary (characters, or the 256 bytes for byte-level).
2. Count all adjacent token pairs in the corpus; **merge the single most frequent pair** into a
   new token; record the merge rule.
3. Repeat until the vocab reaches the target size. The output is an ordered list of merge rules.

To tokenize new text: split into base units, then **replay the merge rules in learned order**.

**Byte-level BPE** (GPT-2, RoBERTa) runs BPE over raw **bytes** instead of Unicode characters:

- Base vocabulary is exactly **256** (every byte value), so it stays tiny.
- **No `[UNK]` token is ever needed** — every possible character maps to some byte sequence, so
  emoji and unseen scripts are always representable (HF NLP course ch.6.5). This is the key
  robustness win over character/word tokenizers.

### WordPiece — BERT, DistilBERT, ELECTRA

Similar merge-based training, but instead of picking the most *frequent* pair it picks the pair
that maximizes a **likelihood score**: `score = freq(pair) / (freq(first) × freq(second))`. This
favors merging pieces whose parts are individually rare — it prefers to build up rare tokens.

To tokenize: **greedy longest-match from the front** of each word. Continuation subwords are
prefixed with `##` (e.g. `token`, `##izers`). If no subword matches, the whole word becomes
`[UNK]` — so WordPiece *can* lose OOV content, unlike byte-level BPE.

### Unigram — T5, ALBERT, mT5, XLNet (usually via SentencePiece)

Works **top-down**: start from a large candidate vocabulary and iteratively **remove** the tokens
whose removal least increases the total corpus negative-log-likelihood, until the target size is
reached. Each remaining token keeps a probability/score.

To tokenize: choose the **segmentation with the highest product of token probabilities**
(Viterbi over candidate splits), not a left-to-right greedy pass.

### SentencePiece — the wrapper, not a fourth algorithm

SentencePiece is a *framework* (usually running Unigram, sometimes BPE) that treats the input as
a raw stream and encodes spaces as a normal meta-symbol `▁`. Consequences:

- **Language-agnostic** — no whitespace pre-tokenizer, so it works on languages that don't
  space-separate words (Chinese, Japanese, Thai).
- **Reversible** — `decode` is literally "concatenate tokens and swap `▁`→space," so
  `decode(encode(x)) == x` with no detokenization rules. This is why multilingual models favor it.

## Special tokens (names differ by family — never hand-roll)

| Purpose | BERT/WordPiece | RoBERTa/GPT byte-level | T5/SentencePiece |
|---|---|---|---|
| Start / pooled repr | `[CLS]` | `<s>` | (uses `pad` as decoder start) |
| Separator / end | `[SEP]` | `</s>` | `</s>` |
| Padding | `[PAD]` | `<pad>` | `<pad>` |
| Unknown fallback | `[UNK]` | `<unk>` (rare, byte-level) | `<unk>` |
| Mask (MLM only) | `[MASK]` | `<mask>` | — |

- `[CLS]`/`<s>` position holds the sentence-level vector used by a classification head.
- `[PAD]` tokens must be excluded from attention via the `attention_mask` the tokenizer returns;
  forgetting this lets padding leak into the representation.
- Add task-specific special tokens with `tokenizer.add_special_tokens(...)` **and** call
  `model.resize_token_embeddings(len(tokenizer))`, or the new ids index past the embedding table.

## Offset mapping (needed for NER / span tasks)

`return_offsets_mapping=True` returns `(char_start, char_end)` per token so you can map predicted
token spans back to characters in the original string — essential for entity extraction and for
aligning B-/I- labels to subwords.

```python
enc = tok("Ada Lovelace", return_offsets_mapping=True)
# offsets like [(0,0),(0,3),(4,12),(0,0)] — (0,0) marks added special tokens
```

## Measure fertility before committing (multilingual)

Fertility = mean tokens per word. Compare it across your languages on a parallel sample; a large
gap is the unfairness/cost tax from SKILL.md section 4.

```python
def fertility(texts, tokenizer):
    toks = sum(len(tokenizer.tokenize(t)) for t in texts)
    words = sum(len(t.split()) for t in texts)
    return toks / words          # ~1.1–1.4 English on a good tokenizer; much higher off-target

# Compare the SAME sentences across languages; a 2–15× gap = over-fragmentation of that script.
```
