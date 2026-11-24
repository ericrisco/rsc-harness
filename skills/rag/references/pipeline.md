# references/pipeline.md — the reference RAG pipeline

This is the long-form companion to the SKILL body: the full contextual-retrieval prompt, the
hybrid + RRF fusion, the rerank funnel parameters, the complete grounding system prompt, and a
minimal runnable retrieve → rerank → answer skeleton. Provider-neutral with concrete Cohere /
Anthropic examples. Adapt names; keep the contracts.

## 1. Contextual retrieval (full)

Anthropic's technique: before embedding and before BM25 indexing, prepend a 1–2 sentence
LLM-written blurb that situates each chunk inside its document. Reductions in failed retrieval:
~35% (contextual embeddings), ~49% (+ contextual BM25), ~67% (+ rerank)
(anthropic.com/news/contextual-retrieval, 2024-09; accessed 2026-06-02).

Cache the whole-document portion of the prompt so you pay for it once per document, not once per
chunk — this is what makes the technique affordable at scale.

```text
<document>
{{WHOLE_DOCUMENT}}
</document>
Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK_TEXT}}
</chunk>
Give a short, standalone context (1–2 sentences) that situates this chunk within the overall
document, to improve search retrieval of the chunk. Answer ONLY with the succinct context and
nothing else.
```

```python
# Generate context per chunk, then index context + chunk for BOTH dense and BM25.
def contextualize(client, doc_text, chunk_text):
    msg = client.messages.create(
        model="claude-haiku-5-5",          # cheap tier: one call per chunk
        max_tokens=120,
        thinking={"type": "disabled"},     # a 1-2 sentence context needs no reasoning budget
        system=[{"type": "text",
                 "text": f"<document>\n{doc_text}\n</document>",
                 "cache_control": {"type": "ephemeral"}}],  # cache the doc
        messages=[{"role": "user", "content":
                   f"Here is the chunk:\n<chunk>{chunk_text}</chunk>\n"
                   "Give a 1-2 sentence standalone context for retrieval. Context only."}],
    )
    return "".join(b.text for b in msg.content if b.type == "text").strip()

def indexable(doc_text, chunk):
    ctx = contextualize(client, doc_text, chunk["text"])
    chunk["context"] = ctx
    chunk["embed_input"] = f"{ctx}\n{chunk['text']}"   # embed this
    chunk["bm25_input"]  = f"{ctx} {chunk['text']}"    # index this for keyword
    return chunk
```

## 2. Hybrid retrieval + Reciprocal Rank Fusion

Dense search catches paraphrase; BM25 catches exact tokens. Run both and fuse by rank, not by
raw score (scores from two systems are not comparable). RRF score for a document is the sum over
result lists of `1 / (k + rank)`, with `k ≈ 60` a standard constant.

```python
def rrf(*ranked_lists, k=60, top_n=150):
    scores = {}
    seen = {}
    for lst in ranked_lists:                 # each: list of chunks in rank order
        for rank, chunk in enumerate(lst):
            cid = chunk["chunk_id"]
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
            seen[cid] = chunk
    fused = sorted(seen.values(), key=lambda c: scores[c["chunk_id"]], reverse=True)
    return fused[:top_n]

dense = vector_store.search(query_vec, limit=150)   # ../vector-db owns this call
keyword = bm25.search(query, limit=150)
candidates = rrf(dense, keyword, top_n=150)
```

The actual store-side hybrid (named vectors, sparse-dense, server-side fusion in Qdrant/Weaviate/
Pinecone) belongs to `../vector-db/SKILL.md`. Use that if your store fuses natively; use the RRF
above when you fuse two independent indexes yourself.

## 3. Rerank funnel

Funnel parameters (Microsoft Cloud Blog 2025-02-04; StackAI, accessed 2026-06-02):

| Param | Value | Why |
|---|---|---|
| retrieve top_n | ~150 | wide enough that the right chunk is almost always present |
| rerank model | Cohere Rerank 3.5 (ctx 4096) or local cross-encoder | cross-encoder scores query+chunk jointly |
| keep top_k | ~20 | precise enough for the prompt without diluting it |

```python
import cohere
co = cohere.ClientV2()

def rerank(query, candidates, top_k=20):
    res = co.rerank(model="rerank-v3.5", query=query,
                    documents=[c["text"] for c in candidates], top_n=top_k)
    return [candidates[r.index] for r in res.results]   # ids preserved by index
```

Local alternative: load a `bge-reranker`-class cross-encoder and score each `(query, chunk)`
pair; sort descending; slice top_k. Use it when data cannot leave the network.

## 4. The grounding system prompt (complete)

Three non-negotiable clauses: answer only from context, cite chunk ids, explicit refusal.

```text
You are a retrieval-grounded assistant. You answer ONLY using information inside the <context>
block below. Do not use prior knowledge or make assumptions.

Rules:
1. Every factual claim MUST cite the chunk id it came from, written inline as [chunk_id].
   You may cite multiple ids for one claim.
2. If the <context> does not contain enough information to answer the question, reply EXACTLY:
   "I don't have enough information in the provided sources to answer that."
   (For Spanish corpora: "No tengo suficiente información en las fuentes para responder.")
3. Do not fabricate citations. If you cannot cite it, do not state it.

<context>
{{#each chunks}}[{{chunk_id}}] {{text}}
{{/each}}
</context>

Question: {{question}}
```

## 5. Minimal runnable skeleton

```python
# retrieve -> rerank -> ground -> answer. Provider-neutral glue; swap clients as needed.
def answer(query):
    qv = embed(query)                                  # same model as the corpus
    dense   = vector_store.search(qv, limit=150)       # ../vector-db
    keyword = bm25.search(query, limit=150)
    fused   = rrf(dense, keyword, top_n=150)
    top     = rerank(query, fused, top_k=20)           # section 3

    context = "\n".join(f"[{c['chunk_id']}] {c['text']}" for c in top)
    resp = llm.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=4096,                                # thinking is on by default and shares this budget
        system=GROUNDING_PROMPT,                        # section 4, refusal clause included
        messages=[{"role": "user",
                   "content": f"<context>\n{context}\n</context>\n\nQuestion: {query}"}],
    )
    # text blocks only: the response can also carry thinking blocks
    return "".join(b.text for b in resp.content if b.type == "text")  # [chunk_id] citations or the refusal line
```

Keep `chunk_id` + `source` on every object from chunking through this function so the cited ids
in the answer map back to real source pages.
