---
name: rag
description: "Use when building grounded Q&A over your own corpus — chunk, retrieve hybrid, rerank, ground, cite chunk ids, refuse when the sources fall short — or when the right document is retrieved but the answer is still wrong, invented, or unmeasured. NOT operating the store itself — collection schema, HNSW ef_search, quantization (that is `vector-db`)."
tags: [rag, retrieval-augmented-generation, chunking, hybrid-search, reranking, grounding, citations, faithfulness, contextual-retrieval]
recommends: [vector-db, embeddings-search, document-processing, chatbot, agent-eval]
origin: risco
---

# rag — own the retrieve → rerank → ground → cite → refuse pipeline

You own the **pipeline** that turns a corpus plus a question into a grounded, cited answer: chunk,
optionally contextualize, index, retrieve hybrid, rerank, assemble a grounded prompt, cite the
sources, and **refuse** when the context does not contain the answer.

You are judged by **retrieval quality and answer faithfulness**, not by raw vector math. If you
find yourself tuning HNSW parameters, you wandered into the store underneath you
(`../vector-db/SKILL.md`). If you are comparing embedding models or chunk sizes, that is the
science beside you (`embeddings-search`).

## The pipeline, and where each stage hands off

Each stage is a real branch — most failures live in one specific stage, and several stages
delegate to a sibling skill rather than living here.

| Stage | What you do | Hands off to |
|---|---|---|
| Ingest | Get clean text out of PDFs/DOCX/HTML/OCR | you assume text exists → `../document-processing/SKILL.md` |
| Chunk | Heading/semantic-aware splits with overlap, stable ids | model, dims + chunk-size science → `embeddings-search` |
| Contextualize | Prepend an LLM-written context blurb per chunk (optional) | stays here |
| Index | Embed + write dense vectors and a BM25/keyword index | you upsert, it owns the knobs → `../vector-db/SKILL.md` |
| Retrieve | Hybrid dense + BM25, fuse with RRF, top ~150 | hybrid query mechanics → `../vector-db/SKILL.md` |
| Rerank | Cross-encoder over the 150, keep top ~20 | stays here |
| Ground + cite | System prompt: answer only from context, cite chunk ids | stays here |
| Refuse | Output "I don't have enough information" on weak context | stays here |
| Evaluate | Faithfulness, answer relevancy, context precision/recall | general harness → `agent-eval` |

Three neighbors are not stages at all. Surfacing this answer inside a chat product (sessions,
channels, UI) is `../chatbot/SKILL.md` — it calls you, not the reverse. A multi-step tool loop with
state, where retrieval is one tool among many, is `../building-agents/SKILL.md`. Pulling
schema-constrained fields out of text instead of a grounded prose answer is
`structured-extraction`. `rag` is the retrieval brain those products call.

## Retrieval is the bottleneck — measure recall before touching the prompt

Naive RAG pipelines fail at the **retrieval** step in up to ~40% of cases *even when the correct
document is in the corpus* (StackAI / Lushbinary, 2026-06-02). Why this matters: if the right
passage never reaches the model, no prompt wording can save the answer. So your first move on a
broken pipeline is never the prompt — it is measuring whether retrieval delivered the goods.

```text
Bad   → "answers are wrong, let me lower temperature and reword the system prompt."
Good  → measure context recall on a golden set; if the right chunk isn't in the top-K,
         fix chunking + hybrid + rerank first. Only then touch grounding.
```

Order of attack when answers are wrong: **context recall → context precision → grounding prompt
→ generation params**. The last item almost never moves the needle.

## Chunking — the highest-leverage single fix

Chunk on structure, not on a blind character count. Why: too-small loses the context a passage
needs to be interpretable; too-large dilutes the embedding so the relevant sentence gets averaged
away (StackAI; EdenAI 2025, accessed 2026-06-02).

- Split on headings/sections first, then sub-split long sections to a target window.
- Keep **overlap** (~10–20% of the window) so a fact spanning a boundary survives in one chunk.
- Attach a **stable `chunk_id` and `source`** at creation — you will need them end to end for
  citations (see below). Never embed text and discard where it came from.

```python
# Heading-aware split sketch; real size tuning belongs in embeddings-search.
def chunk_markdown(doc_id, text, target=800, overlap=120):
    sections, buf, head = [], [], None
    for line in text.splitlines():
        if line.startswith("#"):
            if buf: sections.append((head, "\n".join(buf))); buf = []
            head = line.lstrip("# ").strip()
        else:
            buf.append(line)
    if buf: sections.append((head, "\n".join(buf)))
    out, i = [], 0
    for head, body in sections:
        for start in range(0, max(1, len(body)), target - overlap):
            piece = body[start:start + target]
            out.append({"chunk_id": f"{doc_id}#{i}", "source": doc_id,
                        "heading": head, "text": piece})
            i += 1
    return out
```

The "what window/overlap maximizes recall for *this* corpus" study is `embeddings-search`; here you
just need structurally sane chunks that keep their ids.

## Contextual retrieval — prepend context before you embed

Anthropic's Contextual Retrieval (Sept 2024) prepends a short LLM-generated blurb to each chunk
*before* embedding **and** before BM25 indexing, so an isolated chunk knows what document and
section it belongs to. Why it matters: it cuts failed retrievals by ~35% (contextual embeddings
alone), ~49% (contextual embeddings + contextual BM25), and ~67% once reranking is added
(anthropic.com/news/contextual-retrieval, 2024-09; accessed 2026-06-02).

```text
<document>{{WHOLE_DOC}}</document>
Here is the chunk we want to situate within the whole document:
<chunk>{{CHUNK}}</chunk>
Give a short, standalone context (1–2 sentences) that situates this chunk within the
document for search retrieval. Answer only with the context, nothing else.
```

Embed `context + "\n" + chunk_text` (not the bare chunk). The full implementation — caching the
document prompt, batching, the BM25 side, and a runnable retrieve → rerank → answer skeleton —
lives in `references/pipeline.md`.

## Hybrid retrieval + RRF + rerank

Dense vectors miss exact terms (codes, names, error strings); BM25 keyword search catches them
but misses paraphrase. Combine both, fuse with **Reciprocal Rank Fusion (RRF)**, then rerank
with a cross-encoder. The default-best quality/cost funnel (Microsoft Cloud Blog 2025-02-04;
StackAI, accessed 2026-06-02):

```text
retrieve ~150 candidates (dense + BM25, fused with RRF)
   → rerank all 150 with a cross-encoder
   → keep top ~20 for the prompt
```

The actual hybrid query (named vectors, sparse-dense, server-side fusion) is `vector-db`. Here
you own the funnel and the reranker choice:

- **Cohere Rerank 3.5** — managed cross-encoder, context length 4096, SOTA on BEIR and
  multilingual, available via Cohere API, Bedrock, Pinecone, Azure (docs.cohere.com/changelog/
  rerank-v3.5, accessed 2026-06-02). Use when you want quality without hosting a model.
- A **local cross-encoder** (e.g. a `bge-reranker`) — use when data cannot leave your network or
  you need zero per-call cost; you pay in GPU/latency instead.

```python
# Rerank the fused candidates down to the prompt set; keep ids intact.
import cohere
co = cohere.ClientV2()
ranked = co.rerank(model="rerank-v3.5", query=q,
                   documents=[c["text"] for c in candidates], top_n=20)
top = [candidates[r.index] for r in ranked.results]  # each still carries chunk_id + source
```

## Ground the prompt — answer only from context, cite, refuse

Properly grounded RAG reduces hallucination rates by up to ~71%; poorly grounded pipelines still
hallucinate in up to ~40% of responses *even with the right doc retrieved* (Confident AI / Maxim
2025, accessed 2026-06-02). The prompt must do three things: bind the answer to the context, force
inline citations, and provide an explicit refusal path.

```text
You answer ONLY using the information inside <context>. Do not use prior knowledge.
Cite every claim with the chunk id it came from, like [chunk_id]. Multiple ids are fine.
If the context does not contain enough information to answer, reply exactly:
"I don't have enough information in the provided sources to answer that."
(Spanish corpora: "No tengo suficiente información en las fuentes para responder.")

<context>
[doc12#3] {chunk text...}
[doc12#4] {chunk text...}
</context>

Question: {{question}}
```

A grounding prompt **without a refusal path is a bug** — it converts "missing context" into a
confident fabrication. The refusal clause is what turns retrieval failures into honest non-answers.

## Citations — carry ids the whole way

The answer can only link back if a stable id survives every stage: chunk → retrieve → rerank →
prompt → answer. Why: if you embed text and drop the id at index time, there is nothing for a
citation to point at, and you cannot debug which passage produced a wrong claim.

- Put `chunk_id` and `source` on the chunk at creation; keep them on the object through rerank.
- Render them into the `<context>` block (`[chunk_id] text`) so the model can quote them.
- Map cited ids back to source URLs/pages when you render the answer to the user.

## Evaluating it — metrics, not vibes

Faithfulness is **not** correctness: an answer can be faithful to a wrong chunk. Measure four
RAGAS metrics on a small golden Q/A set (RAGAS docs; Cohorte 2025; Confident AI, accessed
2026-06-02):

| Failure symptom | Metric that catches it | First fix |
|---|---|---|
| Answer states things not in the sources | **faithfulness** (claims supported by context) | grounding prompt + refusal |
| Answer is on-topic but doesn't address the question | **answer relevancy** | prompt / query rewriting |
| Relevant chunks exist but rank below junk | **context precision** | reranker, RRF weights |
| The needed chunk never gets retrieved | **context recall** | chunking, contextual retrieval, hybrid |

Build a 30–50 question golden set with known-good answers, score with RAGAS, and gate CI below a
threshold (e.g. faithfulness ≥ 0.90, context recall ≥ 0.85). Full formulas, thresholds, and the
CI snippet are in `references/evaluation.md`. The general-purpose eval harness is `agent-eval`;
the RAG-specific metrics live here.

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| Fixed char-count chunking, blind to structure | Splits mid-sentence; dilutes embeddings | Heading/semantic chunks with overlap |
| Rerank disabled — stuff top-50 raw into prompt | Noise drowns the right passage; cost balloons | Retrieve ~150 → rerank → keep ~20 |
| No refusal path in the grounding prompt | Missing context becomes confident fabrication | Explicit "I don't have enough information" |
| Embed text, drop the chunk id | Nothing to cite or debug | Carry `chunk_id`+`source` end to end |
| "It looks good" eval on vibes | Regressions ship silently | Golden set + RAGAS + CI threshold gate |
| Embedding the query differently from the corpus | Query and chunks land in different spaces | Same model + same preprocessing both sides |
| Dense-only, ignoring BM25/keyword | Misses exact codes/names/error strings | Hybrid dense + BM25 fused with RRF |
| Tuning temperature to fix wrong answers | Generation is rarely the bottleneck | Measure context recall first |
