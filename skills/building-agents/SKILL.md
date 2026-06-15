---
name: building-agents
description: "Use when designing or building an LLM agent, tool-using system, RAG pipeline, eval harness, or MCP server in this repo — across any provider (OpenAI, Anthropic, Google Gemini, or OSS via OpenAI-compatible endpoints / litellm). Triggers: 'build an agent', 'add tool calling / function calling', 'structured JSON output', 'RAG / retrieval / embeddings / rerank', 'agent loop / ReAct / orchestrator-worker / multi-agent', 'LLM eval / golden set / LLM-as-judge / regression gate', 'prompt caching / model routing / token budget / cost control', 'trace / observability for LLM calls', 'build an MCP server', or 'make our LLM code provider-agnostic / swap models'. FastAPI/Python, Next.js, Go, Flutter, Postgres stacks."
tags: [agents, llm, mcp, rag, evals, ai]
recommends: [secure-coding, deployment]
origin: risco
---

# Building production LLM agents (model-agnostic)

Build production LLM agents that are model-agnostic by construction — a thin provider adapter, a disciplined agent loop, schema-validated tools, provider-neutral RAG, eval gates, OTel tracing, and optionally an MCP server — so swapping OpenAI ↔ Anthropic ↔ Gemini ↔ OSS is a config change, not a rewrite.

## The one rule

> Program against a **capability interface**, never a vendor SDK. Vendor specifics (model id, tool-schema shape, JSON mode, caching, token limits) live behind one adapter resolved from config. If a model name or price appears in business logic, it's a bug.

> Model names and prices rot. Never hardcode them in app logic — resolve from config/registry, and re-verify the dated tables before quoting a number.

## When to use / When NOT to use

> **⚠️ SDD new-feature gate — read this first.** If this skill fired on a **new, non-trivial feature or behaviour change** and there is **no approved spec + plan** under `02-DOCS/wiki/sdd/`, STOP — do **not** write feature code yet. Hand off to `../specify/SKILL.md` first: it runs brainstorm → spec → plan → tasks before any code, then routes back here once the plan is approved. Build here directly only for a genuinely one-line / low-risk change. Method: `../sdd/SKILL.md`.

**Use when:** starting any production-bound LLM feature; code is hardwired to one SDK and you want to swap/route/fallback models; adding tools/function calling, structured output, or streaming; standing up RAG over Postgres/`pgvector` or an external store; building an eval harness / CI quality gate; adding tracing, cost tracking, caching, or routing/cascades; building or hardening an MCP server.

**Do NOT use when:**

- One-shot throwaway prompt, no tools, no eval, no production path → just call the SDK directly.
- Pure prompt-wording improvement with no architecture → that's prompt engineering, not this.
- Anthropic-SDK-specific tuning (caching internals, thinking, batch) in a file that *only* imports `anthropic` → defer to a dedicated Anthropic-SDK skill if your environment provides one (e.g. `claude-api`); this skill stays multi-provider.
- Workspace scaffolding (`01-TOOLS`/`02-DOCS` layout) → **`harness`**.
- Picking *which* coding agent (Claude Code vs Aider) → agent-eval territory, not this.
- No retrieval, no tools, no loop, no evals at all → you don't need an agent; say so.

## Decision rules (read before writing code)

1. **Adapter first** — define the `LLMProvider` Protocol before any provider call.
2. **Smallest loop that works** — single-agent before multi-agent; ReAct only when the path is uncertain; plan-execute when steps are knowable.
3. **Tools are typed contracts** — schema + validation + idempotency key on every side-effecting tool; no catch-all tools.
4. **Retrieve, don't stuff** — RAG when ground truth lives in data; cite or refuse.
5. **Eval before ship** — a golden set + regression gate in CI, or it's not production.
6. **Cheapest model that passes the eval** — route/cascade up, never default to flagship.

## Architecture at a glance

```text
            ┌───────────────────────────────────────────────────────────┐
  Caller ──▶│  Agent loop  (perceive → decide → act → observe, bounded) │
            └───────────────────────────────────────────────────────────┘
               │              │                │              │
               ▼              ▼                ▼              ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
        │  Provider  │  │   Tool     │  │ Retriever  │  │  Tracer    │
        │  adapter   │  │  registry  │  │ (pgvector) │  │  (OTel)    │
        │ ↔ OpenAI / │  │ → sandboxed│  │ → cite/    │  │ gen_ai.*   │
        │ Anthropic /│  │   tools    │  │   refuse   │  │            │
        │ Gemini /OSS│  └────────────┘  └────────────┘  └────────────┘
        └────────────┘
               ▲                                          │
               └──────────── Eval gate (CI) ◀─────────────┘
   provider-abstraction.md  agent-loops…/tools-and-rag.md  evals-and-observability.md
```

## The provider adapter (the heart of the skill)

The one payload to internalize. Python 3.12+, Pydantic v2, **async** so it composes
directly with the agent loop in `references/agent-loops-and-harness.md`. Streaming,
the Gemini and OSS/litellm adapters, tool-result plumbing, and a `route()` registry live
in `references/provider-abstraction.md` — this excerpt is the load-bearing core, not the
whole interface.

```python
from __future__ import annotations

import os
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ToolSpec(BaseModel):
    name: str
    description: str
    parameters: dict  # JSON Schema for the tool's arguments


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0


class CompletionRequest(BaseModel):
    model: str  # resolved from config, e.g. "claude-sonnet-4-6" — never literal in logic
    messages: list[Message]
    tools: list[ToolSpec] = Field(default_factory=list)
    response_schema: dict | None = None  # JSON Schema -> structured output
    temperature: float = 0.0
    max_tokens: int = 1024


class CompletionResponse(BaseModel):
    text: str = ""
    tool_calls: list[dict] = Field(default_factory=list)  # [{id, name, arguments}]
    usage: Usage = Field(default_factory=Usage)
    raw: dict | None = None


@runtime_checkable
class LLMProvider(Protocol):
    # Async so it drives the async agent loop directly. The full interface in
    # references/provider-abstraction.md adds stream() and embed().
    async def complete(self, req: CompletionRequest) -> CompletionResponse: ...


class OpenAIAdapter:
    def __init__(self, model: str) -> None:
        from openai import AsyncOpenAI

        self.model, self.client = model, AsyncOpenAI()

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        # Chat Completions shape (universal, still current); references/provider-abstraction.md
        # gives the preferred Responses-API adapter. system stays a `system` role message here.
        kwargs: dict = {"model": self.model, "messages": [m.model_dump() for m in req.messages],
                        "temperature": req.temperature, "max_tokens": req.max_tokens}
        if req.tools:
            kwargs["tools"] = [{"type": "function", "function": {"name": t.name, "description": t.description, "parameters": t.parameters}} for t in req.tools]
        if req.response_schema:
            kwargs["response_format"] = {"type": "json_schema", "json_schema": {"name": "out", "schema": req.response_schema, "strict": True}}
        r = await self.client.chat.completions.create(**kwargs)
        msg = r.choices[0].message
        calls = [{"id": c.id, "name": c.function.name, "arguments": c.function.arguments} for c in (msg.tool_calls or [])]
        return CompletionResponse(text=msg.content or "", tool_calls=calls, raw=r.model_dump(),
            usage=Usage(input_tokens=r.usage.prompt_tokens, output_tokens=r.usage.completion_tokens))


class AnthropicAdapter:
    def __init__(self, model: str) -> None:
        from anthropic import AsyncAnthropic

        self.model, self.client = model, AsyncAnthropic()

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        # QUIRKS: system is a top-level param (not a message); tools use input_schema (not function).
        system = "\n".join(m.content for m in req.messages if m.role == "system") or None
        turns = [{"role": m.role, "content": m.content} for m in req.messages if m.role != "system"]
        kwargs: dict = {"model": self.model, "system": system, "messages": turns, "max_tokens": req.max_tokens, "temperature": req.temperature}
        if req.tools:
            kwargs["tools"] = [{"name": t.name, "description": t.description, "input_schema": t.parameters} for t in req.tools]
        if req.response_schema:  # structured output via tool-forcing
            kwargs["tools"] = [{"name": "out", "description": "Emit the result", "input_schema": req.response_schema}]
            kwargs["tool_choice"] = {"type": "tool", "name": "out"}
        r = await self.client.messages.create(**kwargs)
        text = "".join(b.text for b in r.content if b.type == "text")
        calls = [{"id": b.id, "name": b.name, "arguments": b.input} for b in r.content if b.type == "tool_use"]
        return CompletionResponse(text=text, tool_calls=calls, raw=r.model_dump(),
            usage=Usage(input_tokens=r.usage.input_tokens, output_tokens=r.usage.output_tokens))


def get_provider(spec: str | None = None) -> LLMProvider:
    """Parse 'provider:model' (default from env LLM) into a concrete adapter."""
    provider, _, model = (spec or os.environ["LLM"]).partition(":")
    if provider == "openai":
        return OpenAIAdapter(model)
    if provider == "anthropic":
        return AnthropicAdapter(model)
    raise ValueError(f"unknown provider: {provider!r}")
# Gemini + OSS/litellm adapters, streaming, tool-result plumbing, and route() registry
# -> references/provider-abstraction.md
```

## Good vs Bad

```python
# BAD — vendor SDK + model id hardwired into a handler; swapping = rewrite every call-site.
client = OpenAI()
def summarize(text: str) -> str:
    r = client.chat.completions.create(model="gpt-5.5", messages=[{"role": "user", "content": text}])
    return r.choices[0].message.content
```

```python
# GOOD — one adapter resolved from config; logic never names a model.
provider = get_provider(settings.llm)  # e.g. "anthropic:claude-sonnet-4-6"
async def summarize(text: str) -> str:
    req = CompletionRequest(model=settings.model_id, messages=[Message(role="user", content=text)])
    return (await provider.complete(req)).text
```

```python
# BAD — parse-and-pray; wrong shape fails silently at 3am.
raw = (await provider.complete(req)).text
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    data = {}  # the bug is now invisible
```

```python
# GOOD — strict structured output + schema validation that fails loudly on drift.
class Answer(BaseModel):
    sentiment: Literal["pos", "neg", "neu"]
    score: float

req.response_schema = Answer.model_json_schema()
ans = Answer.model_validate_json((await provider.complete(req)).text)
```

```python
# BAD — unbounded loop; no cap/timeout/idempotency. Burns budget, repeats side effects, wedges.
while True:
    resp = await provider.complete(req)
    if not resp.tool_calls:
        break
    for call in resp.tool_calls:
        await run_tool(call)
```

```python
# GOOD — bounded loop: step cap + per-tool timeout + idempotency key (safe to retry).
for step in range(max_steps):
    resp = await provider.complete(req)
    if not resp.tool_calls:
        break
    for call in resp.tool_calls:
        async with asyncio.timeout(tool_timeout_s):
            await run_tool(call, idempotency_key=call["id"])
# full loop, budgets, recovery -> references/agent-loops-and-harness.md
```

## Tools & structured output (minimum viable)

```python
from typing import Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class CreateInvoiceArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")  # reject unknown keys from the model
    customer_id: str = Field(min_length=1)
    amount_cents: int = Field(gt=0)
    currency: Literal["EUR", "USD"] = "EUR"


class ToolResult(BaseModel):
    status: Literal["success", "warning", "error"]
    summary: str
    data: dict | None = None
    next_actions: list[str] = Field(default_factory=list)


def _create_invoice(args: CreateInvoiceArgs) -> ToolResult:
    invoice_id = f"inv_{args.customer_id}_{args.amount_cents}"  # real impl: DB insert + idempotency
    return ToolResult(status="success", summary=f"Created {invoice_id}", data={"id": invoice_id})


TOOLS: dict[str, tuple[type[BaseModel], Callable]] = {
    "create_invoice": (CreateInvoiceArgs, _create_invoice),
}


def dispatch(name: str, raw_args: dict) -> ToolResult:
    spec = TOOLS.get(name)
    if spec is None:
        return ToolResult(status="error", summary=f"unknown tool {name!r}", next_actions=["pick a registered tool"])
    args_model, handler = spec
    try:
        args = args_model.model_validate(raw_args)  # validate BEFORE side effects
    except ValidationError as e:
        return ToolResult(status="error", summary="invalid args", data={"errors": e.errors()},
                          next_actions=["fix the arguments and retry"])
    return handler(args)
# schema design, sandboxing, idempotency, DI-scoped DB sessions -> references/tools-and-rag.md
```

## RAG in 30 lines (provider-agnostic embeddings)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS docs (
    id        bigserial PRIMARY KEY,
    content   text NOT NULL,
    embedding vector(1536) NOT NULL,
    meta      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS docs_embedding_hnsw
    ON docs USING hnsw (embedding vector_cosine_ops);
```

```python
async def embed(texts: list[str]) -> list[list[float]]:
    # Same provider interface as completions; impl in references/tools-and-rag.md.
    return await provider.embed(texts)  # returns one 1536-d vector per text


async def retrieve(query: str, k: int = 5, min_sim: float = 0.25) -> list[dict]:
    [q] = await embed([query])
    rows = await db.fetch(  # cosine distance <=>; similarity = 1 - distance
        "SELECT id, content, 1 - (embedding <=> $1) AS sim "
        "FROM docs ORDER BY embedding <=> $1 LIMIT $2",
        q, k,
    )
    return [dict(r) for r in rows if r["sim"] >= min_sim]


async def answer(query: str) -> str:
    chunks = await retrieve(query)
    if not chunks:                                   # refuse rather than hallucinate
        return "I don't have grounded information to answer that."
    context = "\n".join(f"[{c['id']}] {c['content']}" for c in chunks)
    req = CompletionRequest(
        model=settings.model_id,
        messages=[Message(role="system", content="Answer ONLY from context; cite chunk ids like [12]."),
                  Message(role="user", content=f"{context}\n\nQ: {query}")],
    )
    return (await provider.complete(req)).text
# chunking, hybrid RRF, rerank, citation grader, memory -> references/tools-and-rag.md
```

## Evals & cost gates (the production line)

```python
import json
import statistics
import sys
import time


async def run_eval(golden_path: str, graders: list, thresholds: dict[str, float]) -> None:
    cases = [json.loads(line) for line in open(golden_path)]  # {"input","expected","meta"}
    results = []
    for case in cases:
        t0 = time.perf_counter()
        out = await provider.complete(CompletionRequest(model=settings.model_id,
              messages=[Message(role="user", content=case["input"])]))
        scores = {g.name: g.grade(case, out) for g in graders}  # exact / schema / LLM-judge
        results.append({"scores": scores, "cost": out.usage.cost_usd,
                        "ms": (time.perf_counter() - t0) * 1000})
    n = len(results)
    metrics = {
        "accuracy": sum(r["scores"]["exact"] for r in results) / n,
        "faithfulness": sum(r["scores"]["judge"] for r in results) / n,
        "p95_latency_ms": statistics.quantiles([r["ms"] for r in results], n=20)[-1],
        "cost_per_task": sum(r["cost"] for r in results) / n,
    }
    failed = [k for k, lo in thresholds.items() if metrics[k] < lo]
    print(json.dumps(metrics, indent=2))
    sys.exit(1 if failed else 0)  # CI gate: non-zero blocks the merge
```

Routing cascade in one line: `route(task) → cheapest model whose eval passes; escalate only on a failed self-check`.

Pointer: full runner, judge, CI gate, caching, batching, budgets → `references/evals-and-observability.md`.

## Observability (OTel GenAI, vendor-neutral)

```python
from opentelemetry import trace

tracer = trace.get_tracer("agent")


async def traced_complete(provider: LLMProvider, req: CompletionRequest) -> CompletionResponse:
    with tracer.start_as_current_span("chat") as span:
        span.set_attribute("gen_ai.system", settings.llm.split(":")[0])
        span.set_attribute("gen_ai.request.model", req.model)
        resp = await provider.complete(req)
        span.set_attributes({"gen_ai.usage.input_tokens": resp.usage.input_tokens,
                             "gen_ai.usage.output_tokens": resp.usage.output_tokens,
                             "gen_ai.usage.cost_usd": resp.usage.cost_usd})
        return resp
# Langfuse / Phoenix / Braintrust are swappable OTLP backends: emit spans, swap the exporter.
# span-per-tool, trace-id propagation, exporters -> references/evals-and-observability.md
```

## MCP: when and the smallest server

**Native tools** when the agent and tools share a process/repo. **MCP** when tools must be reused across clients/teams or run out-of-process — accept the MCP cost (schema tokens, transport, ops) in exchange for reuse.

```python
from fastmcp import FastMCP  # standalone fastmcp 2.x; see references/mcp-servers.md

mcp = FastMCP("invoices")


@mcp.tool()
def create_invoice(customer_id: str, amount_cents: int, currency: str = "EUR") -> dict:
    """Create an invoice. amount_cents must be > 0."""
    if amount_cents <= 0:
        raise ValueError("amount_cents must be positive")
    return {"id": f"inv_{customer_id}_{amount_cents}", "currency": currency}


@mcp.resource("invoice://{invoice_id}")
def read_invoice(invoice_id: str) -> str:
    """Read-only invoice lookup by id."""
    return f"Invoice {invoice_id}: status=open"


if __name__ == "__main__":
    mcp.run()  # stdio transport
# (MCP spec 2025-11-25; stateless-core RC 2026-07-28; verify before quoting)
# TypeScript server, transports, HTTP+auth, testing -> references/mcp-servers.md
```

## Anti-patterns → STOP

| Rationalization | Reality |
|---|---|
| "I'll just call the OpenAI SDK directly, we'll never switch" | The adapter is ~40 lines; retrofitting it across 30 call-sites later is a rewrite. Adapter first. |
| "JSON output is usually valid, I'll parse it" | "Usually" = pages at 3am. Use strict structured output + schema validation. |
| "The agent loop works, I don't need a step cap" | Unbounded loops burn budget and wedge on errors. Cap steps, timeouts, and budget. |
| "One mega-tool that takes a freeform command is flexible" | It's unobservable and unsafe. Narrow typed tools with idempotency keys. |
| "We can eval by eyeballing outputs" | Vibes don't gate CI. Golden set + graders + threshold or it's not production. |
| "Default everything to the flagship model, it's smartest" | 5–20× cost for no measured gain. Route to the cheapest model that passes the eval. |
| "Stuff the whole doc in the prompt instead of RAG" | Blows context + cost and still hallucinates. Retrieve + cite + refuse. |
| "Retry on every exception" | Retrying a 400/401 wastes budget. Retry only transient (429/5xx/timeout) with backoff+jitter. |
| "Hardcode the model name, it's fine" | Names rot (Opus 4.7 → 4.8 in weeks). Resolve from config/registry. |
| "MCP for everything" | In-process native tools are simpler and faster when reuse isn't needed. MCP only for cross-client reuse. |
| "Tool results just return the raw API blob" | Give the model `status/summary/next_actions`; raw blobs waste context and stall recovery. |
| "Prompt caching is Anthropic-only so skip caching" | Each provider has its own caching/dedup; abstract it behind the adapter, don't skip it. |

## Quick reference

| Task | Do this | Reference |
|---|---|---|
| Define a provider | `LLMProvider` Protocol + normalized request/response | `references/provider-abstraction.md` |
| Add a tool | Pydantic args model + `ToolResult` + validating dispatcher | `references/tools-and-rag.md` |
| Structured output | Strict JSON Schema (OpenAI) / tool-forcing (Anthropic) / `response_json_schema` (Gemini) | `references/provider-abstraction.md` |
| Build the loop | Bounded perceive → decide → act → observe with budgets | `references/agent-loops-and-harness.md` |
| Multi-agent | Orchestrator-worker + parallel fan-out with a semaphore | `references/agent-loops-and-harness.md` |
| RAG | `pgvector` ANN + hybrid RRF + rerank + cite | `references/tools-and-rag.md` |
| Eval gate | Golden set + graders + CI threshold exit code | `references/evals-and-observability.md` |
| Trace | OTel GenAI `gen_ai.*` spans, swappable exporter | `references/evals-and-observability.md` |
| Cut cost | Cache + route/cascade + batch + budgets | `references/evals-and-observability.md` |
| MCP server | FastMCP stdio / Streamable HTTP server | `references/mcp-servers.md` |

## verify.sh

`scripts/verify.sh` lints example agent code and dry-runs the eval smoke test in **the user's project** — not in this skill repo. It detects each tool (`ruff`, `mypy`, `tsc`/`node`, `go`, the eval entrypoint, `markdownlint`) and skips any that are missing with a yellow WARN; a missing tool never fails the run. Invoke it with `bash scripts/verify.sh` from the project root. Exit 0 means clean (or only skips); a non-zero exit means a real lint/typecheck/vet/eval failure.

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this
project's agent decisions there and index them in `02-DOCS/wiki/index.md`, so the next
agent inherits the conventions instead of re-deriving them.

1. **Find the article** `02-DOCS/wiki/stack/agents.md`, indexed in `02-DOCS/wiki/index.md` (the Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — the provider(s) and model routing, where the provider adapter lives, tool/RAG conventions, the eval gates, and the observability backend —
   then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the
   article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Unlike the
brand study, technical conventions are *recorded, not gated* — never block the task on this.

## See Also

- `../harness/SKILL.md` — workspace `01-TOOLS`/`02-DOCS` scaffolding.
- Stack siblings the examples target: `../fastapi/SKILL.md`, `../nextjs/SKILL.md`, `../go/SKILL.md`, `../postgresdb/SKILL.md`, `../flutter/SKILL.md`; plus `../secure-coding/SKILL.md` and `../deployment/SKILL.md` for hardening and shipping the agent service.
- External skills (no sibling in this repo; use if your environment provides them): `claude-api` — Anthropic-SDK-specific tuning (caching internals, thinking, batch) when a file only imports `anthropic`; `deep-research` — the research-harness fan-out / verify pattern.
- ECC analogues (external, no links): `agent-harness-construction`, `eval-harness`, `cost-aware-llm-pipeline`, `mcp-server-patterns`, `context-budget`.
