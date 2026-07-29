---
name: vector-db
description: "Use when operating a vector store as a data layer — choosing or migrating between Pinecone, Qdrant, Weaviate and pgvector; designing a collection or index (distance metric, dimensions, HNSW parameters, named vectors); filtering on metadata; hybrid dense-plus-sparse search; and quantization to cut RAM and cost. Covers garbage results, silently ignored filters, low recall, slow queries, and filtered queries returning fewer than k rows. NOT producing, chunking or judging embeddings (that is `embeddings-search`)."
tags: [vector-database, pinecone, qdrant, weaviate, pgvector, hnsw, hybrid-search, metadata-filter, quantization]
recommends: [embeddings-search, rag, postgresdb, redis, supabase]
origin: risco
---

# vector-db — operate the store, not the embeddings

You own the **store**: the collection schema, the index, the filter path, recall-vs-latency
tuning, hybrid fusion, quantization, and the production knobs (upserts, namespaces, deletes,
backups). You operate it across the four engines a Claude agent actually meets: **pgvector**
(Postgres extension), **Qdrant**, **Weaviate**, **Pinecone** (serverless).

Three things are **not** yours, and pretending they are produces wrong advice:

- Producing, chunking, rewriting, or scoring embeddings → `../embeddings-search/SKILL.md`. You
  store vectors; you do not make or judge them.
- Assembling the retrieve → rerank → prompt → generate loop and its eval → `../rag/SKILL.md`.
- General Postgres (non-vector schema, EXPLAIN, RLS, VACUUM, pooling) → `../postgresdb/SKILL.md`.
  You own **only** the pgvector surface: the `vector`/`halfvec` column, its index, its operators,
  its recall. "My Postgres is slow in general" is theirs; "my `<=>` query has low recall" is yours.

## Pick the engine

Match the engine to where the data already lives and how much ops you want to run. All four
implement HNSW with comparable recall at a matched `ef`, so the differentiator is operations and
hybrid, not raw quality.

| Engine | Best when | Hybrid built-in | Ops cost | Scale sweet spot |
|---|---|---|---|---|
| **pgvector** | Data already in Postgres; one less system to run | No — DIY (`vector` + `tsvector`, combine yourself) | You already run Postgres | ≤ a few M vectors |
| **Qdrant** | You want best filtered-search latency and self-host control | Yes — `query` API, `prefetch` + RRF/DBSF, server-side IDF | Self-host or cloud | 10M+ |
| **Weaviate** | You want hybrid + modules out of the box | Yes — `alpha` + `fusionType`, BlockMax WAND BM25 | Self-host or cloud | 10M+ |
| **Pinecone** | You refuse to operate anything | Yes — sparse-dense, integrated inference | Zero (serverless) | Any (pay per use) |

Rule: **don't add a new system to host vectors if the rows already live in Postgres and you are
under a few million.** pgvector is one extension, not a second database to back up and monitor.

## Design the collection & index

1. **Distance metric MUST match the embedding model.** A model trained for cosine, indexed with
   L2, ranks *silently wrong* — no error, just bad results. OpenAI `text-embedding-3-*`, Cohere,
   most sentence-transformers → cosine. pgvector operator cheatsheet:

   ```text
   <-> L2 / Euclidean   (vector_l2_ops)
   <=> cosine distance  (vector_cosine_ops)   <- the common one
   <#> negative inner product (vector_ip_ops) <- for normalized vectors
   ```

2. **Dimensions are fixed by the model**, not a choice. `text-embedding-3-small` = 1536,
   `-3-large` = 3072. pgvector's `vector` caps at 2000 dims for an index; for more, use `halfvec`.

3. **HNSW defaults and the one invariant.** Build-time `m` (default 16) and `ef_construction`
   (default 64); query-time `ef_search` (pgvector default 40). Keep `ef_construction >= 2*m`
   (so ≥32 at the default `m`) — too low starves graph quality and recall never recovers without
   a rebuild. Raise `m` to 32–48 only for high-dim or high-recall needs (more RAM, slower build).

4. **IVFFlat only when build speed beats recall.** It is cheaper to build but lower recall and
   needs `lists`/`probes` tuning; on a selective filter it is the wrong default (see next section).
   Prefer HNSW unless you have a measured reason.

5. **Named vectors when one object has multiple spaces** (e.g. a dense semantic vector + a sparse
   BM25 vector, or title-vector + body-vector). Qdrant and Weaviate support this natively; it is
   how you do hybrid in one collection instead of two.

## Metadata / payload filtering

The #1 "search is broken" bug: the filter is applied **after** top-k, so a selective filter
returns fewer than `k` rows (or zero). Fix it by filtering *inside* the search and indexing the
filter field.

```text
Bad:  ANN top-k=10, THEN drop rows where tenant_id != 'acme'  -> often < 10, sometimes 0
Good: search the index WITH the filter as a constraint        -> k rows that already match
```

- **Index every field you filter on.** Unindexed filters force a scan and kill latency. Qdrant:
  create a payload index. Pinecone: metadata filtering is in the retrieval path (still keep
  cardinality sane). pgvector: a B-tree (or partition) on `tenant_id` so the planner can use it.
- **Prefer in-graph / in-path filtering.** Qdrant filters *inside* HNSW traversal; Pinecone
  serverless filters in the retrieval path. Both beat naive post-filter.
- **pgvector 0.8 iterative scan** is the fix when a selective `WHERE` returns too few rows:

  ```sql
  SET hnsw.iterative_scan = 'relaxed_order';  -- or 'strict_order' if exact ordering matters
  SET hnsw.ef_search = 100;
  SELECT id FROM docs
   WHERE tenant_id = 'acme'                    -- selective filter
   ORDER BY embedding <=> $1                    -- cosine, matches the model
   LIMIT 10;
  ```

  Without iterative scan (pgvector < 0.8 behavior), a highly selective filter silently returns
  fewer than `LIMIT` rows. Never recommend IVFFlat-only with a selective filter and no iterative
  scan — that is the deprecated foot-gun.

## Tune recall vs latency

You cannot tune what you do not measure. Establish recall **before** shipping.

1. Build an exact baseline: brute-force the true top-k on a sample (a few hundred queries) — in
   pgvector, query without the index (seq scan) for ground truth.
2. Query the index and compute recall@k = overlap with the baseline.
3. Raise the query-time knob until recall hits target (commonly ≥0.95), then stop — higher `ef`
   costs latency for nothing:

   | Engine | Knob | Default |
   |---|---|---|
   | pgvector | `hnsw.ef_search` | 40 |
   | Qdrant | `hnsw_ef` (search) | per-collection |
   | Weaviate | `ef` (vectorIndexConfig) | dynamic |
   | Pinecone | (managed) | — |

Full parameter table and the recall recipe live in [references/tuning.md](references/tuning.md).

## Hybrid search

Dense (semantic) + sparse (BM25/keyword) catches exact terms, IDs, and rare tokens that dense
alone misses. The two normalize differently, so you **fuse**, you don't add raw scores.

- **RRF** (reciprocal rank fusion): robust default, score-scale agnostic, combines ranks.
- **Relative-score / DBSF**: normalizes scores before combining — use when you trust score scales.

Per engine:

- **Weaviate**: one call — `hybrid(query, alpha=0.5, fusionType=relativeScoreFusion)`. `alpha`
  slides 0.0 (pure keyword) → 1.0 (pure vector). BM25 is BlockMax WAND (default from v1.30, ~10x faster).
- **Qdrant**: `prefetch` a dense and a sparse query, then a fusion step (`Fusion.RRF` or DBSF);
  IDF is computed server-side (v1.15+).
- **Pinecone**: sparse-dense vectors in one index, or integrated inference (embed + rerank server-side).
- **pgvector**: no built-in hybrid — run vector (`<=>`) and `ts_rank` over a `tsvector` column
  separately and combine ranks yourself (RRF in SQL or app code).

Concrete current-API code for all four is in [references/engines.md](references/engines.md).

## Quantization & cost

Quantization trades recall for RAM/cost. Decide by **dimension count and a recall test**, never blind.

| Method | Compression | When safe |
|---|---|---|
| Scalar (int8) | ~4x | Almost always; tiny recall loss. Good default RAM cut. |
| Product (PQ) | 8–64x | Large corpora where RAM dominates; needs tuning + recall check. |
| Binary | ~32x (~40x faster via SIMD popcount) | **High-dim only** (≥1024). On 384-dim it shreds recall — measure or don't. |
| pgvector `halfvec` | ~2x | Near-free: 16-bit float, near-identical recall, and required for >2000 dims. |

Reach for `halfvec` first in Postgres — it is the cheapest win. Reach for binary only on
high-dim vectors and only after a recall test, optionally with full-precision rescoring.

## Operate it

- **Batch upserts.** One-by-one upserts are 10–100x slower and hammer the index. Send batches of
  hundreds; size to the engine's payload limit.
- **Namespaces / multitenancy.** Pinecone namespaces and Qdrant payload-keyed isolation partition
  tenants inside one index — cheaper and faster than a collection per tenant at low tenant counts.
- **Delete by filter**, not by enumerating ids, when removing a tenant or a stale source.
- **Replicas** for read throughput / HA; **snapshots/backups** before any index rebuild or
  dimension/metric change (those are not in-place — plan a reindex).
- **To "update" a vector, re-upsert by id.** Do not store only raw text and re-embed on read.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Cosine-trained model indexed with L2 (`<->`) | Silently wrong ranking, no error | Match metric to model — cosine → `<=>` / `vector_cosine_ops` |
| Post-filtering top-k results | Returns < k rows, sometimes 0, on selective filters | Filter inside the search; index the filter field |
| IVFFlat + selective filter, no iterative scan | Drops rows; deprecated path in pgvector 0.8 | HNSW + `hnsw.iterative_scan='relaxed_order'` |
| Never measuring recall | "Search is bad" with no number to move | Recall@k vs an exact baseline before shipping |
| Binary quantization on 384-dim | Recall collapses, then blamed on the engine | Binary only ≥1024 dims, after a recall test; else scalar/halfvec |
| One-by-one upserts | 10–100x slower, index thrash | Batch hundreds per request |
| `ef_construction < 2*m` | Permanently weak graph; recall needs a full rebuild | Keep `ef_construction >= 2*m` (≥32 at default `m=16`) |
| Store only raw text, re-embed to "update" | Drift, cost, no point-update path | Re-upsert the vector by id |
| Unindexed filter field | Full scan, latency spikes | Payload index (Qdrant) / B-tree (pgvector) / sane metadata cardinality (Pinecone) |

## References & siblings

- [references/engines.md](references/engines.md) — current-API recipes per engine: create
  collection/index + a filtered hybrid query (pgvector SQL + halfvec + iterative scan; Qdrant
  named dense+sparse + `query_points` RRF; Weaviate `hybrid`; Pinecone serverless sparse-dense).
- [references/tuning.md](references/tuning.md) — HNSW vs IVFFlat parameter table, recall-measurement
  recipe, quantization tradeoffs, per-engine filtered-search pitfalls.

Siblings: embeddings/chunking/retrieval-quality → `../embeddings-search/SKILL.md`; the full RAG
loop → `../rag/SKILL.md`; general Postgres → `../postgresdb/SKILL.md`.

Validate a produced index DDL / collection schema with `scripts/verify.sh <artifact-file>`.
