---
name: embeddings-search
description: "Use when choosing an embedding model, chunk size, or query form, when semantic search returns irrelevant results, when adding hybrid BM25+vector or a reranker, or when a retrieval change needs a number (recall@k, nDCG, MRR). NOT operating the store — index tuning, quantization (that is `vector-db`) — nor the retrieve-to-answer loop (that is `rag`)."
tags: [embeddings, semantic-search, chunking, hybrid-search, reranking, rrf, retrieval-eval, mteb, matryoshka]
recommends: [vector-db, rag, structured-extraction, prompt-engineering, postgresdb]
origin: risco
---

# embeddings-search — make and judge the vectors

You own the **embedding technique layer**: turn a corpus into searchable vectors, turn a
question into a good retrieval, and **measure whether that retrieval is any good**. You stop the
moment the right chunks come back, measured by a number. You do not assemble a prompt or
generate an answer.

Route the adjacent surfaces away:

- **Operating the store** — collection schema, HNSW/IVFFlat tuning, metadata-filter path,
  quantization, `ef_search` recall knobs → [`../vector-db/SKILL.md`](../vector-db/SKILL.md).
  You decide *what vectors go in and how to query*; vector-db decides *how the store holds and
  serves them*.
- **The full retrieve → rerank → prompt → generate → answer loop** and its groundedness /
  faithfulness eval → [`../rag/SKILL.md`](../rag/SKILL.md).
- **Pulling typed fields out of documents** (invoice number, date, total) → [`../structured-extraction/SKILL.md`](../structured-extraction/SKILL.md).
- **Writing the prompt the model reasons with** → [`../prompt-engineering/SKILL.md`](../prompt-engineering/SKILL.md).

## 1. Pick the embedding model

Decide on three axes: language coverage, quality tier (read MTEB but don't worship it), and
cost — where cost is set by **dimensions**, because dims set storage and memory.

| Model | Best when | Dims (Matryoshka) | Max input | ~Price /1M tok | Query/doc asymmetry |
|---|---|---|---|---|---|
| OpenAI `text-embedding-3-small` | Cheap English/multi baseline | 1536 (truncatable) | 8191 tok | ~$0.02 | none required |
| OpenAI `text-embedding-3-large` | Higher quality, still API-simple | 3072 (truncatable) | 8191 tok | ~$0.13 | none required |
| Cohere `embed-v4` | Strong multilingual, API | up to 1536 | long | API-priced | `search_query` vs `search_document` |
| Voyage `voyage-3-large` | Retrieval-specialised, top tasks | model-set | long | API-priced | yes (`input_type`) |
| Gemini Embedding | Tops MTEB English retrieval (~68.3) | truncatable | long | API-priced | yes (task type) |
| `BGE-M3` / `e5` (open) | Self-host, no per-token bill | 1024 (BGE-M3) | long | self-host | yes (`query:` / `passage:`) |

Quality anchor (mid-2026 MTEB English retrieval): Gemini ~68.3, Cohere `embed-v4` ~65.2,
OpenAI `3-large` ~64.6, `BGE-M3` ~63.0. MTEB is the standard comparison, not a verdict on
*your* domain — [`references/models.md`](references/models.md) carries the full model matrix
(dims, max tokens, price, `input_type` convention, Matryoshka support) and how to read MTEB
without over-trusting it.

Two hard rules — each is a **silent** failure, no error, just worse results:

- **Match the distance metric to the model.** A cosine-trained model indexed or queried with
  L2 ranks silently wrong. Cosine → `<=>` in pgvector / `Distance.COSINE` in Qdrant. The index
  operator itself is vector-db's job; the *requirement* originates from the model, so state it
  in your config.
- **Respect query/document asymmetry.** Cohere, Voyage, Gemini, e5, BGE expect a different
  prompt or `input_type` for the query vs the stored passage. Embed both sides identically and
  recall silently drops.

**Dimensions = cost.** A 1024-dim float32 vector is 4 KB; at 10M docs that is 40 GB, and
doubling dims doubles storage and memory. Matryoshka-trained models (OpenAI 3-*, Cohere,
Gemini) let you **truncate** dims for graceful degradation — never re-embed the whole corpus
just to shrink vectors.

## 2. Chunk the corpus

Start boring. Upgrade only when a number tells you to.

```python
# Default recipe: recursive split, TOKEN-accurate count, 10–20% overlap.
import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter

enc = tiktoken.get_encoding("cl100k_base")
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",
    chunk_size=512,      # tokens, not characters
    chunk_overlap=64,    # ~12% — keeps sentences from being cut mid-thought
)
chunks = splitter.split_text(document_text)
```

Counting by characters instead of tokens is the most common own-goal: 512 characters is
~100–130 tokens of English and far fewer of CJK, so "512" silently means different things per
language and per model limit.

Upgrade ladder — graduate only when retrieval metrics (section 6) justify the added compute:

| Strategy | When it pays | Cost |
|---|---|---|
| Recursive (default) | Always start here | lowest |
| Semantic (group by meaning) | Topic-mixed pages where fixed splits cut mid-idea; ~70% lift over naive in some benchmarks | one extra embed pass |
| Late chunking | Docs heavy with pronouns/anaphora ("it", "the company"); +10–12% on those | needs a long-context model |
| Contextual retrieval (prepend a heading/summary per chunk) | Chunks that aren't self-contained without their section | higher compute, more tokens stored |

**Embed the searchable text; store the rest as metadata.** What you embed is what gets matched
— don't bury the answer text under boilerplate, and don't embed raw HTML.

## 3. Construct the query

The query is half the retrieval. Embed it the way the model expects, then improve it only when
recall data says you should.

```python
# Asymmetric model: query and document use DIFFERENT input_type. Getting this wrong is silent.
q_vec   = embed(text=user_question, input_type="search_query")     # Cohere / Voyage
d_vec   = embed(text=passage,       input_type="search_document")
# e5 / BGE convention is a textual prefix instead:
#   query    -> "query: how do refunds work"
#   passage  -> "passage: Refunds are processed within 14 days…"
```

Query-side techniques, when each pays:

- **Query rewriting** — when user queries are terse or full of pronouns; normalise before
  embedding.
- **HyDE** (embed a hypothetical answer, not the question) — when questions are short and
  answers are long/technical, so the answer-shaped vector lands nearer the passage.
- **Multi-query** (fan out 3–4 paraphrases, union the hits) — when one phrasing under-recalls;
  costs N embeds and a dedup.

## 4. Hybrid + rerank

Dense and sparse fail in complementary ways: **BM25 nails exact terms, IDs, SKUs, rare
tokens**; **dense nails paraphrase**. That is why exact-match queries return nothing while
paraphrases work — the fix is adding sparse, not a bigger embedding model.

Fuse by **rank, not score**, with Reciprocal Rank Fusion so you never have to calibrate BM25
tf-idf magnitudes against cosine magnitudes per corpus:

```python
# RRF: each doc scores 1/(k + rank) summed across the dense and sparse lists. k≈60.
def rrf(*ranked_lists, k=60):
    scores = {}
    for lst in ranked_lists:                 # fan-in 20–100 per list
        for rank, doc_id in enumerate(lst):  # rank is 0-based
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=scores.get, reverse=True)
```

Then a **cross-encoder reranker** sits AFTER fusion: take top-50, score each against the
original query, keep top-5 for downstream use.

- Current models: Cohere `rerank-v4.0-pro` / `rerank-v4.0-fast` (note `rerank-3.5` is
  deprecated). Voyage `rerank-2.5` (2025-08-11) is the first widely available
  **instruction-following** reranker — 32K-token context (8× Cohere v3.5), reports +7.94%
  accuracy vs Cohere v3.5 on a 93-dataset suite.
- **A reranker raises precision but cannot recover a doc the retriever never returned.** Recall
  is upstream. If the right chunk isn't in the top-50, no reranker saves you — fix recall first.

The fusion and index *mechanics per engine* (how Qdrant/Weaviate/pgvector run hybrid) are
vector-db's: [`../vector-db/SKILL.md`](../vector-db/SKILL.md).

## 5. Measure retrieval quality

This is the rigor of the skill. "Search is bad" is not actionable; "recall@10 is 0.62" is.

1. **Build a golden query set** — 30–50+ labeled `query → relevant doc ids` pairs drawn from
   real questions. This is the asset; everything else is reproducible from it.
2. **Pick metrics** — definitions, a runnable Python eval skeleton, golden-set construction and
   the A/B-one-change methodology are in
   [`references/evaluation.md`](references/evaluation.md):
   - **recall@k** — of the truly relevant docs, how many landed in the top-k. Catches "the
     right chunk never came back."
   - **nDCG@k** — rewards relevant docs ranked higher. Catches "right docs, wrong order."
   - **MRR** — how high the *first* relevant doc sits. Catches "the one answer is buried."
3. **Move-the-number loop.** Establish a baseline, **change exactly one thing** (model OR chunk
   size OR fusion OR reranker), re-measure on the **same** query set. Two changes at once and
   you learn nothing.

A retrieval change shipped without a before/after number on a golden set is a guess. `verify.sh`
flags hybrid/rerank artifacts that mention no recall/nDCG/MRR for exactly this reason.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Chunk size in characters | "512" means a different token count per language/model | Token-accurate count (`tiktoken`/model tokenizer) |
| Same `input_type` for query and document | Asymmetric models silently lose recall, no error | `search_query` vs `search_document` (or `query:`/`passage:`) |
| Cosine model indexed/queried with L2 | Ranking is silently wrong | Match metric to model (cosine → `<=>`) |
| Add a reranker to fix bad recall | Reranker only reorders what retrieval returned | Fix recall (hybrid, chunking, model) first |
| No overlap on prose | Sentences cut mid-thought lose the answer | 10–20% overlap |
| Tuning by eyeballing one query | One query isn't a measurement | Golden set + recall@k/nDCG before vs after |
| Trusting MTEB rank for your domain | Leaderboard ≠ your corpus/language | Eval the top 2–3 on your own golden set |
| Over-large dims "for safety" | Doubles storage/RAM, little recall gain | Right-size; truncate via Matryoshka |
| Re-embedding the corpus to change dims | Wasteful when the model is Matryoshka-trained | Truncate dims, don't re-embed |
| Embedding raw HTML/boilerplate | Match signal drowns in markup | Embed clean text; keep the rest as metadata |
