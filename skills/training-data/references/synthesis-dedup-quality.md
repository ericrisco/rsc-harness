# Synthesis, dedup, decontamination, quality, licensing

Depth overflow for SKILL.md §3–§7. Library versions and, above all, model licenses change
monthly — verify at author time; nothing here is a standing legal fact.

## Synthetic data

**Self-Instruct**: hand-write a small seed set of diverse instructions+responses, prompt a
strong model to generate many more conditioned on the seeds, then filter for validity, dedup,
and difficulty. **Evol-Instruct**: iteratively rewrite each instruction to be harder
(add constraints, deepen, broaden) so the corpus spans a difficulty gradient. **AI feedback /
UltraFeedback-style**: have a model rate candidate responses on axes (helpfulness, honesty,
correctness) to build preference pairs.

### distilabel skeleton (Argilla / Hugging Face, v1.x — verify)

```python
from distilabel.pipeline import Pipeline
from distilabel.steps import LoadDataFromDicts
from distilabel.steps.tasks import TextGeneration
# LLM client import paths shift between releases — check current distilabel docs.

with Pipeline(name="self-instruct") as pipe:
    seeds = LoadDataFromDicts(data=[{"instruction": "Explain X."}, ...])
    gen   = TextGeneration(llm=...)      # plug an LLM client
    seeds >> gen

distiset = pipe.run(parameters={...})
distiset.push_to_hub("me/synthetic-sft")   # pushes data + the pipeline definition + a card
```

Distilabel serializes the whole pipeline to YAML/JSON and (on push) writes it into the dataset
card, so a run is reproducible. Output is a `Distiset` (a `datasets.DatasetDict` variant).

### Distillation licensing trap (do this before generating)

Training on *another model's outputs* is governed by that model/provider's terms:

- **Proprietary API outputs** may be contractually barred from training competing models — read
  the current provider ToS, not a blog.
- **Open-weight licenses** vary and are **not** all OSI-open: Llama ships under the Meta Llama
  Community License (with acceptable-use + naming/derivative terms), Gemma has custom Google
  terms, some models (e.g. Codestral-class) are non-production/research-only, and Qwen license
  terms vary by size. **Never state a license as bare fact** — open the specific model card,
  licenses change.
- Record per-example provenance (which model/source produced it) so an audit can trace it.

## Deduplication

Exact dedup: hash normalized text, drop collisions. Near-dup (the one that matters) —
**MinHash + LSH** over token/char shingles:

```python
from datasketch import MinHash, MinHashLSH

def minhash(text, num_perm=128, k=5):
    m = MinHash(num_perm=num_perm)
    toks = text.split()
    for i in range(len(toks) - k + 1):
        m.update(" ".join(toks[i:i+k]).encode())
    return m

lsh, keep = MinHashLSH(threshold=0.8, num_perm=128), []
for i, ex in enumerate(dataset):
    mh = minhash(ex["text"])
    if not lsh.query(mh):            # no near-duplicate already kept
        lsh.insert(str(i), mh); keep.append(i)
dedup = dataset.select(keep)
```

For very large corpora use a batched/distributed dedup (e.g. HF `datatrove`, `text-dedup`)
rather than an in-memory loop. Tune `threshold` on a sample — too high keeps paraphrase dupes,
too low deletes legitimately similar-but-distinct examples.

## Decontamination (against eval/benchmark test sets)

Leakage of test items into training inflates your eval — you measure memorization. Remove any
training row that overlaps a test item, by **n-gram overlap** (the common convention is a long
n-gram, e.g. 13-gram, exact match; also embed-and-threshold for paraphrased leakage):

```python
def ngrams(text, n=13):
    t = text.lower().split()
    return {" ".join(t[i:i+n]) for i in range(len(t) - n + 1)}

contam = set().union(*(ngrams(x["text"]) for x in eval_set))   # build from EVERY eval you report
clean  = dataset.filter(lambda ex: ngrams(ex["text"]).isdisjoint(contam))
```

Decontaminate against **every** benchmark you will quote *and* your own private held-out set —
including any public dataset you synthesized from, since its test split may be in your training
mix. `lm-eval-harness` and dataset-curation toolkits ship decontamination utilities; prefer a
maintained one over hand-rolled for scale.

## Quality filtering

**LIMA** (*Less Is More for Alignment*, arXiv 2305.11206): ~1,000 curated examples produced a
strong instruction-follower — for teaching **behavior/style/format**, curation and diversity
beat raw volume. Caveat: LIMA is about *alignment*, not injecting large new *knowledge* — a
broad domain-knowledge shift still wants scale. Practical filter ladder:

1. **Format/structural** — drop empty/truncated turns, malformed JSON, wrong role order, missing
   final assistant turn (SFT), identical `chosen`/`rejected` (preference).
2. **Length** — cut extreme-short and runaway-long outliers (often degenerate/repetitive).
3. **Dedup + decontam** (above).
4. **Diversity** — embed and cluster; downsample over-represented intents so one task is not 80%
   of the set. (Lilac was built for exactly this triage — but its OSS repo was archived
   ~July 2025 after the Databricks acquisition; **[verify]** before depending on it.)
5. **Scoring** — reward model or LLM-as-judge rates helpfulness/correctness; keep the top slice.
   Audit the judge: it has position/length/self-preference biases; spot-check by hand.

Always keep a discarded-rows sample so filtering decisions are reviewable, not a black hole.

## Licensing — two separate questions

1. **Your dataset's license** — what you release the JSONL under, and whether you *may* (you
   cannot relicense others' data by aggregating it).
2. **Source-usage restrictions** — the terms attached to where each row came from: scraped-site
   ToS, the license of any base dataset, and the model-output ToS above. These bind even if you
   never publish. A `source`/`license` provenance column per row makes an audit tractable.

Write a **data card** (HF dataset README front-matter): license, sources, generation method,
dedup/decontam done, known biases, intended use.

## Tooling summary

| Tool | Use | Note |
| --- | --- | --- |
| distilabel | synthetic data / AI-feedback pipelines | Argilla/HF, v1.x, → `Distiset` |
| Argilla | human annotation/review UI | vet and label examples |
| HF `datasets` | load/map/filter/push | the substrate |
| datatrove / text-dedup | large-scale dedup | when datasketch loop is too small |
| lm-eval-harness | eval + decontamination utils | report metrics on the clean split |
| Lilac | dataset exploration/clustering | **OSS archived ~2025-07 [verify]** |
