# Evaluation — runnable metrics and when each one lies

Depth overflow for SKILL.md section 3. All snippets use the HF `evaluate` library and
`sacrebleu`; verify current API/package versions at author time. The governing rule: **pick the
metric that matches the task, and never let an overlap metric be the final verdict on open-ended
text.**

## Classification — accuracy + macro-F1

```python
import evaluate
acc = evaluate.load("accuracy")
f1  = evaluate.load("f1")
acc.compute(predictions=preds, references=labels)
f1.compute(predictions=preds, references=labels, average="macro")   # macro on imbalance
```

- **accuracy** is honest only on balanced classes. With 95% negatives, "always predict negative"
  scores 0.95 while being useless — **macro-F1** exposes that by averaging per-class F1 equally.
- Report a confusion matrix too; a single scalar hides *which* class fails.

## NER / token classification — entity-level F1 (seqeval)

```python
import evaluate
seqeval = evaluate.load("seqeval")
# predictions/references are lists of B-/I-/O tag STRINGS per token, specials already dropped
seqeval.compute(predictions=[["B-PER","I-PER","O"]],
                references =[["B-PER","I-PER","O"]])
# -> precision / recall / f1 / accuracy at the ENTITY level, plus per-entity-type breakdown
```

- seqeval scores a **whole entity span** as correct only if every tag in it is right — the metric
  that matches what NER is for. Per-token accuracy is inflated by the flood of `O` tokens and can
  read ~0.97 on a model that misses half the entities.
- Align labels to subwords first: first subword of a word gets the label; continuation subwords
  and specials get `-100` (ignored by the loss); flip `B-XXX`→`I-XXX` on continuations.

## Translation — BLEU / chrF (use sacrebleu for comparable numbers)

```python
import evaluate
sacrebleu = evaluate.load("sacrebleu")
sacrebleu.compute(predictions=["the cat sat on the mat"],
                  references=[["the cat sat on the mat", "a cat was on the mat"]])
# {'score': .., ...}  chrF: evaluate.load("chrf") — character n-gram F-score
```

- Use **sacrebleu**, not a hand-rolled BLEU — tokenization/normalization differences make raw
  BLEU numbers non-comparable across papers; sacrebleu standardizes them.
- **chrF** (character n-gram F-score) is often better than BLEU for **morphologically rich** and
  agglutinative languages, because it credits partial-word overlap that word-BLEU misses.

## Summarization — ROUGE

```python
import evaluate
rouge = evaluate.load("rouge")
rouge.compute(predictions=[summary], references=[reference])
# rouge1 / rouge2 / rougeL — n-gram and longest-common-subsequence recall overlap
```

- ROUGE rewards overlap with the reference's n-grams, so it **favors extractive/copy-heavy**
  summaries and is **blind to faithfulness** — a fluent summary that invents a fact can outscore a
  faithful paraphrase. Pair it with a faithfulness/NLI check or an LLM judge.

## The shared caveat: overlap metrics ≠ quality on open-ended text

BLEU, ROUGE, and chrF correlate **weakly with human judgment** on open-ended and creative
generation (documented across the MT and summarization evaluation literature). They reward
matching the reference's *exact phrasing*: a correct paraphrase is punished, a wrong-but-fluent
copy is rewarded. Legitimate use: **tracking regressions against a fixed reference set**, where a
drop is a real signal. Illegitimate use: declaring model A "better" than B on open-ended output
from a BLEU delta.

## Perplexity (language modeling)

```python
import torch
def perplexity(model, input_ids):
    with torch.no_grad():
        loss = model(input_ids, labels=input_ids).loss   # mean token NLL
    return torch.exp(loss).item()
```

- Lower = the model predicts held-out text better. **Tokenizer-dependent**: PPL is defined over
  the model's own tokens, so two models with different tokenizers/vocab have **non-comparable**
  perplexities. Only compare within one tokenizer, on the same held-out set.

## LLM-as-judge (the right tool for open-ended quality)

```text
Judge prompt (pin the rubric; score on fixed axes):
  Rate the SUMMARY on 1–5 for: (a) faithfulness to SOURCE, (b) coverage, (c) fluency.
  Output JSON: {"faithfulness": n, "coverage": n, "fluency": n, "reason": "..."}
```

- Known judge biases: **position** (favors the first candidate — randomize order), **verbosity**
  (favors longer answers), **self-preference** (favors its own family's style). Mitigate: fixed
  rubric, randomized order, and a **human spot-check** on a sample to calibrate the judge.
- For agent/pipeline-level eval harnesses beyond single outputs, see `agent-eval`.

## The one-change loop (applies to every metric above)

Establish a baseline number on a **held-out set**, change exactly **one** variable (model OR
tokenizer OR data OR decoding params), re-measure on the **same** set. Two changes at once and
the delta is unattributable — and a regression can hide inside an improvement.
