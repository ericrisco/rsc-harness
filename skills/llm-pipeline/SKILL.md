---
name: llm-pipeline
description: "Use when wiring several LLM calls into a production flow: typed contracts between steps, a router/gateway so 429s, timeouts and outages fail over instead of taking you down, and cost control via caching, model tiers and abort caps. NOT single-prompt wording (that is `prompt-engineering`), NOT a model-driven tool loop (that is `building-agents`)."
tags: [llm-orchestration, llm-gateway, fallbacks, prompt-caching, cost-control, litellm, reliability]
recommends: [prompt-engineering, structured-extraction, building-agents, cost-tracking, agent-eval, rag, observability, parallel]
origin: risco
---

# llm-pipeline

Wire multiple LLM calls into a reliable, controllable production pipeline. You chain steps where one call's validated output feeds the next, put a router in front of providers so an outage fails over instead of taking you down, and engineer the cross-cutting concerns: timeouts, bounded retries, fallbacks, caching, and cost caps.

Treat the LLM as an unreliable network dependency, not a local function call. Every rule below follows from that: providers have outages, rate limits, and latency tails, so no single provider is a single point of failure and no call is allowed to run unbounded.

## Do you even need a pipeline?

This skill is the orchestration *around* calls. If you only have one call, you are in the wrong place.

| Situation | Go to |
| --- | --- |
| Make one prompt better, few-shot, system-prompt design | [../prompt-engineering/SKILL.md](../prompt-engineering/SKILL.md) |
| One call must return a typed object validated against a schema | [../structured-extraction/SKILL.md](../structured-extraction/SKILL.md) |
| The model decides its own next step / tool to call | [../building-agents/SKILL.md](../building-agents/SKILL.md) |
| Chunk/embed/retrieve context to stuff into a prompt | [../rag/SKILL.md](../rag/SKILL.md) |
| Pure spend ledger / attribution / dashboard | [../cost-tracking/SKILL.md](../cost-tracking/SKILL.md) |
| **Fixed multi-step flow + reliability layer** | **here** |

A pipeline is a *DAG you designed*. The moment the model picks its own next step, it is an agent — go build that instead.

## Design the chain as a typed DAG

Each step is a pure-ish function: `(typed input) -> (typed output via structured output)`. Chaining small single-purpose steps beats one mega-prompt — reported ~20% output-quality gain — because each step is debuggable, cacheable, and retryable in isolation.

Rules:

- **The structured output of step N is the input contract of step N+1.** Validate it (Pydantic / JSON Schema) at the seam. A schema-valid object that fails validation here never poisons the next call.
- **Keep steps small and single-purpose.** "Extract entities" and "classify sentiment" are two steps, not one prompt doing both. Smaller steps route to cheaper models and cache better.
- **Mark independent steps for parallel fan-out.** If step B and step C both only need step A's output, run them concurrently — see [../parallel/SKILL.md](../parallel/SKILL.md). Sequential only where there is a real data dependency.
- **Tag each step idempotent or side-effecting.** Retries and replays must be safe; a step that writes to a DB or sends an email is not safe to blindly retry.

```python
# Bad: free text flows between steps; step 2 silently mis-parses step 1
entities = client.responses.create(model="gpt-4o", input=f"Extract entities: {doc}").output_text
summary  = client.responses.create(model="gpt-4o", input=f"Summarize for {entities}").output_text

# Good: each step emits a validated object; the seam is a contract you assert on
from pydantic import BaseModel

class Entities(BaseModel):
    people: list[str]
    orgs: list[str]

step1 = client.responses.parse(model="gpt-4o", input=f"Extract: {doc}",
                               text_format=Entities, timeout=30)
ents: Entities = step1.output_parsed          # parse fails HERE, not downstream
summary = summarize(ents)                      # typed input, not a string blob
```

## Put a gateway/router in front

Use a router so a failure on one deployment fails over to another, and so you can swap or load-balance models from config without touching call sites.

**LiteLLM** is the de-facto open-source LLM gateway (current stable line **v1.83.3-stable**). It exposes a unified OpenAI-format `completion()` across 100+ providers, with built-in retry/fallback, cost tracking, and budget management — usable as a Python SDK or as a Proxy Server.

Fallback semantics worth knowing: a request to an `order=1` deployment that fails (connection error, 404, 429, ...) auto-tries `order=2`, then `order=3`; each order level gets its own `num_retries` before escalating; exhausting orders falls through to configured fallbacks. There are specialized buckets — `content_policy_fallbacks` (ContentPolicyViolationError), `context_window_fallbacks` (ContextWindowExceededError), and `default_fallbacks`.

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "smart",
         "litellm_params": {"model": "anthropic/claude-sonnet-4-6", "timeout": 30}},
        {"model_name": "smart-backup",
         "litellm_params": {"model": "openai/gpt-4o", "timeout": 30}},
    ],
    fallbacks=[{"smart": ["smart-backup"]}],
    context_window_fallbacks=[{"smart": ["smart-backup"]}],
    num_retries=2,            # per order level, bounded
    timeout=30,               # hard cap, never unbounded
)
resp = router.completion(model="smart",
                         messages=[{"role": "user", "content": prompt}])
```

**Build vs buy:** raw SDK + a thin retry/timeout wrapper (fewest deps, fine for one provider) → LiteLLM SDK/proxy (widest provider coverage, fallbacks for free) → hosted gateway (Bifrost/Portkey, when you want it operated for you). Full config — all fallback buckets, redis cache params, budget/rate-limit settings, cost callbacks — is in [references/litellm-router.md](references/litellm-router.md).

## Reliability mechanics

- **Always set a timeout.** A 30–60s hard cap per call. Without it, one slow upstream hangs the request indefinitely.
- **Bounded retries with exponential backoff + jitter.** LiteLLM defaults: backoff from `INITIAL_RETRY_DELAY` 0.2s up to `MAX_RETRY_DELAY` 10s, with jitter to avoid thundering herds. Never `while True`.
- **Only retry idempotent steps.** Retrying a step that sent an email or charged a card double-fires. Gate retries behind the idempotency tag from the DAG design.
- **Circuit-break and degrade gracefully.** When a provider is down and fallbacks are exhausted, return a partial result, a cached result, or a cheaper-model result — never hang and never 500 the user if a degraded answer exists.

```python
# Bad: naked call in a for-loop; no timeout, unbounded effect, no fallback
for _ in range(10000):
    try:
        return client.chat.completions.create(model="gpt-4o", messages=msgs)
    except Exception:
        continue          # hammers a down provider, blows the budget, may never exit

# Good: router does bounded retries + backoff + fallback; you degrade on exhaustion
try:
    return router.completion(model="smart", messages=msgs)   # timeout + num_retries set
except Exception:
    return cached_or_cheaper_answer(msgs)                     # graceful degradation
```

## Caching: two distinct layers

The cheapest, fastest, most reliable call is the one you never made — so cache and tier before you tune prompts. Wording is the last lever, not the first.

| Layer | What it matches | Safety | Enable when |
| --- | --- | --- | --- |
| Prefix / prompt cache (provider-native) | Exact prefix of the prompt | Always safe (same input → same cached compute) | Always; put the stable prefix first |
| Semantic cache (your gateway) | Embedding-similar prior query | Risky: weak embedder → false hits | Paraphrased FAQ-style queries, approximate answers OK |

**Prefix cache** is transparent and free to enable. OpenAI caches automatically at ~50% off cached input tokens, no write penalty, no storage fee — first request full price, prefix hits half price. Anthropic is explicit (you mark cache breakpoints) and deeper: cache *read* = 0.1× base input (~90% off), 5-minute *write* = 1.25× base, 1-hour *write* = 2× base, delivering ~90% cost and ~85% latency reduction on long stable prefixes. For both, **put the stable content first** (system prompt, instructions, fixed context) and the variable content last so the prefix matches.

**Semantic cache** matches an embedding-similar prior query and returns that prior response. The quality is dominated by the embedding model — a weak embedder produces **false cache hits: a confidently wrong answer for a similar-but-different question** (GPTCache is documented returning incorrect saved responses for similar prompts). So: strong embedder, tuned similarity threshold, and **never on correctness-critical paths**. Threshold tuning, embedding choice, TTL, and the multi-tier `semantic → prefix → inference` order are in [references/caching-layers.md](references/caching-layers.md).

## Cost & latency control

- **Model-tier routing, cheap-first.** Run the cheap tier, escalate only on low confidence or detected complexity. Anchor prices (Anthropic, 2026): Haiku 4.5 $1/$5 per M in/out, Sonnet 4.6 $3/$15, Opus 4.7 $5/$25 — flagship-for-everything is 5× the cost for zero quality gain on easy calls.
- **Budget caps that ABORT, not just log.** Per-request and per-tenant caps that kill a runaway loop. A logged-but-uncapped budget still lets a bug spend $10k overnight.
- **Token and latency budgets per step**, and stream output for perceived latency on user-facing calls.

The *ledger* — attribution, per-team dashboards, monthly reporting — is not this skill; that is [../cost-tracking/SKILL.md](../cost-tracking/SKILL.md). This skill owns the *controls* (tiers, caching, caps that abort).

## Observability hooks

Log per step, every call: `model`, `tokens_in/out`, `cost`, `latency_ms`, `cache_hit`, `fallback_used`, `retry_count`. These are exactly the fields you debug a production incident from ("why did p99 spike?" → fallback_used + retry_count). Wire them into the tracing backbone in [../observability/SKILL.md](../observability/SKILL.md), and measure output *quality* with [../agent-eval/SKILL.md](../agent-eval/SKILL.md) — logging is not evaluation.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Naked call, no timeout | One hung provider stalls the whole request | Hard timeout on every call (30–60s) |
| Unbounded `while True` retry | Thundering herd, blown budget, infinite hang | Bounded retries + exp backoff (0.2s→10s) + jitter |
| Retrying a side-effecting step | Double-writes, double-charges | Idempotency tag; only retry pure steps |
| Free text between steps | Step N+1 silently mis-parses | Validated structured output as the contract |
| Semantic cache with a weak embedder | Confident WRONG answers from false hits | Strong embedder + tuned threshold, or prefix cache only |
| Flagship model for everything | 5–25× the cost, no quality gain on easy calls | Tier routing, cheap-first, escalate |
| No fallback configured | Provider outage = your outage | Router model group + fallbacks |
| Treating schema-valid as correct | Perfectly-shaped wrong answers ship | Validate semantics + eval (agent-eval) |

## Verify

Run [scripts/verify.sh](scripts/verify.sh) `<file-or-dir>` against your pipeline/gateway code. It is offline and read-only, and checks statically: every completion/chat call site has an explicit timeout, retries are bounded (no `while True` retry loops), at least one fallback is configured when a router/model_list is present, no hardcoded `sk-`/provider key literals (must be env-sourced), and any YAML/JSON config parses and lists ≥2 model entries so a fallback target exists. It prints PASS/FAIL per check and exits non-zero on any FAIL; an empty or clean target exits 0.
