# Provider abstraction — one interface, every model

The full normalization layer. Once these adapters exist, swapping OpenAI ↔ Anthropic
↔ Gemini ↔ OSS is a config string. The agent loop, the RAG embedder, the LLM-as-judge,
and the cost router all consume the *same* `LLMProvider`. Async-first; Python 3.12+,
Pydantic v2.

## The interface

```python
from __future__ import annotations

from typing import AsyncIterator, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str
    tool_call_id: str | None = None  # set when role == "tool"
    name: str | None = None          # tool name for tool-result turns
    # Provider-native content of an assistant turn, replayed unchanged. On current Claude models
    # thinking is on and its blocks must go back exactly as received: set it from resp.raw["content"].
    blocks: list[dict] | None = None


class ToolSpec(BaseModel):
    name: str
    description: str
    parameters: dict  # JSON Schema (object) describing the arguments


class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict = Field(default_factory=dict)


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    cost_usd: float = 0.0


class CompletionRequest(BaseModel):
    model: str
    messages: list[Message]
    tools: list[ToolSpec] = Field(default_factory=list)
    response_schema: dict | None = None
    temperature: float | None = None  # None = provider default; current Claude models reject sampling params
    top_p: float | None = None
    max_tokens: int = 8192  # thinking is on by default on current Claude models and shares this budget
    stop: list[str] | None = None
    cache_system: bool = True  # opt-in prompt caching for the system block


class CompletionResponse(BaseModel):
    text: str = ""
    tool_calls: list[ToolCall] = Field(default_factory=list)
    finish_reason: Literal["stop", "tool_calls", "length", "content_filter"] = "stop"
    usage: Usage = Field(default_factory=Usage)
    raw: dict | None = None


class StreamEvent(BaseModel):
    type: Literal["text", "tool_call", "usage", "done"]
    text: str = ""
    tool_call: ToolCall | None = None
    usage: Usage | None = None


@runtime_checkable
class LLMProvider(Protocol):
    async def complete(self, req: CompletionRequest) -> CompletionResponse: ...
    async def stream(self, req: CompletionRequest) -> AsyncIterator[StreamEvent]: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
```

## Four adapters (full code)

### OpenAI — Responses API primary

Prefer the **Responses API** for agent/tool loops; the Chat Completions shape still
works (uncomment the fallback). Model ids resolve from config — never literals here.

```python
from openai import AsyncOpenAI


class OpenAIAdapter:
    def __init__(self, model: str, embed_model: str = "text-embedding-3-small") -> None:
        self.model, self.embed_model, self.client = model, embed_model, AsyncOpenAI()

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        kwargs: dict = {
            "model": self.model,
            "input": [{"role": m.role, "content": m.content} for m in req.messages],
            "max_output_tokens": req.max_tokens,
        }
        if req.temperature is not None:
            kwargs["temperature"] = req.temperature
        if req.tools:
            kwargs["tools"] = [
                {"type": "function", "name": t.name, "description": t.description, "parameters": t.parameters}
                for t in req.tools
            ]
        if req.response_schema:
            kwargs["text"] = {"format": {"type": "json_schema", "name": "out",
                                         "schema": req.response_schema, "strict": True}}
        r = await self.client.responses.create(**kwargs)
        # Fallback (Chat Completions): r = await self.client.chat.completions.create(
        #     model=self.model, messages=[m.model_dump(exclude_none=True) for m in req.messages], ...)
        calls = [
            ToolCall(id=item.call_id, name=item.name, arguments=_loads(item.arguments))
            for item in r.output if item.type == "function_call"
        ]
        return CompletionResponse(
            text=r.output_text or "",
            tool_calls=calls,
            finish_reason="tool_calls" if calls else "stop",
            usage=Usage(input_tokens=r.usage.input_tokens, output_tokens=r.usage.output_tokens,
                        cached_input_tokens=getattr(r.usage.input_tokens_details, "cached_tokens", 0)),
            raw=r.model_dump(),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        r = await self.client.embeddings.create(model=self.embed_model, input=texts)
        return [d.embedding for d in r.data]
```

### Anthropic — `input_schema`, top-level `system`, `cache_control`

```python
from anthropic import AsyncAnthropic


class AnthropicAdapter:
    def __init__(self, model: str) -> None:
        self.model, self.client = model, AsyncAnthropic()

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        sys_text = "\n".join(m.content for m in req.messages if m.role == "system")
        turns = [_anthropic_turn(m) for m in req.messages if m.role != "system"]
        # Current Claude models reject sampling params (temperature/top_p) and forced tool_choice:
        # req.temperature is not sent, and structured output uses output_config.format.
        kwargs: dict = {"model": self.model, "messages": turns, "max_tokens": req.max_tokens}
        if sys_text:  # cache the (large, stable) system block when asked
            block = {"type": "text", "text": sys_text}
            if req.cache_system:
                block["cache_control"] = {"type": "ephemeral"}
            kwargs["system"] = [block]
        if req.tools:
            kwargs["tools"] = [{"name": t.name, "description": t.description, "input_schema": t.parameters}
                               for t in req.tools]
        if req.response_schema:  # structured output: the first text block is valid JSON
            kwargs["output_config"] = {"format": {"type": "json_schema", "schema": req.response_schema}}
        r = await self.client.messages.create(**kwargs)
        text = "".join(b.text for b in r.content if b.type == "text")
        calls = [ToolCall(id=b.id, name=b.name, arguments=b.input) for b in r.content if b.type == "tool_use"]
        return CompletionResponse(
            text=text, tool_calls=calls,
            finish_reason="tool_calls" if calls else "stop",
            usage=Usage(input_tokens=r.usage.input_tokens, output_tokens=r.usage.output_tokens,
                        cached_input_tokens=getattr(r.usage, "cache_read_input_tokens", 0)),
            raw=r.model_dump(),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError("Anthropic has no embeddings API; use an embed-only provider")
```

### Gemini — `responseSchema` + `responseMimeType`

```python
from google import genai
from google.genai import types


class GeminiAdapter:
    def __init__(self, model: str, embed_model: str = "gemini-embedding-001") -> None:
        self.model, self.embed_model, self.client = model, embed_model, genai.Client()

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        sys_text = "\n".join(m.content for m in req.messages if m.role == "system") or None
        contents = [
            types.Content(role="model" if m.role == "assistant" else "user",
                          parts=[types.Part(text=m.content)])
            for m in req.messages if m.role in ("user", "assistant")
        ]
        cfg = types.GenerateContentConfig(
            system_instruction=sys_text, temperature=req.temperature, max_output_tokens=req.max_tokens,
        )
        if req.tools:
            # Raw JSON Schema dicts go in *_json_schema (current SDK). The legacy
            # `parameters=`/`response_schema=` fields expect a proto Schema / Pydantic
            # type and are mutually exclusive with these — don't mix them.
            cfg.tools = [types.Tool(function_declarations=[
                types.FunctionDeclaration(name=t.name, description=t.description,
                                          parameters_json_schema=t.parameters)
                for t in req.tools])]
        if req.response_schema:
            cfg.response_mime_type = "application/json"
            cfg.response_json_schema = req.response_schema
        r = await self.client.aio.models.generate_content(model=self.model, contents=contents, config=cfg)
        calls = [ToolCall(id=f"call_{i}", name=fc.name, arguments=dict(fc.args))
                 for i, fc in enumerate(r.function_calls or [])]
        um = r.usage_metadata
        return CompletionResponse(
            text=r.text or "", tool_calls=calls,
            finish_reason="tool_calls" if calls else "stop",
            usage=Usage(input_tokens=um.prompt_token_count, output_tokens=um.candidates_token_count or 0,
                        cached_input_tokens=um.cached_content_token_count or 0),
            raw=r.model_dump(),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        r = await self.client.aio.models.embed_content(model=self.embed_model, contents=texts)
        return [e.values for e in r.embeddings]
```

### OSS via litellm — one OpenAI-format call to any `base_url`/model

```python
import litellm  # pin v1.85.x (as of 2026-06; avoid quarantined 1.82.7/1.82.8)


class LiteLLMAdapter:
    """vLLM / Ollama / TGI / 100+ hosted models behind one OpenAI-format surface."""

    def __init__(self, model: str, base_url: str | None = None, embed_model: str | None = None) -> None:
        self.model, self.base_url, self.embed_model = model, base_url, embed_model

    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        kwargs: dict = {
            "model": self.model, "api_base": self.base_url,
            "messages": [m.model_dump(exclude_none=True) for m in req.messages],
            "temperature": req.temperature, "max_tokens": req.max_tokens,
        }
        if req.tools:
            kwargs["tools"] = to_openai_tools(req.tools)
        if req.response_schema:
            kwargs["response_format"] = {"type": "json_schema",
                "json_schema": {"name": "out", "schema": req.response_schema, "strict": True}}
        r = await litellm.acompletion(**kwargs)
        msg = r.choices[0].message
        calls = [ToolCall(id=c.id, name=c.function.name, arguments=_loads(c.function.arguments))
                 for c in (msg.tool_calls or [])]
        return CompletionResponse(
            text=msg.content or "", tool_calls=calls,
            finish_reason="tool_calls" if calls else "stop",
            usage=Usage(input_tokens=r.usage.prompt_tokens, output_tokens=r.usage.completion_tokens,
                        cost_usd=litellm.completion_cost(r) or 0.0),
            raw=r.model_dump(),
        )

    async def embed(self, texts: list[str]) -> list[list[float]]:
        r = await litellm.aembedding(model=self.embed_model or self.model, input=texts, api_base=self.base_url)
        return [d["embedding"] for d in r.data]
```

```python
import json


def _loads(s: str | dict) -> dict:
    return s if isinstance(s, dict) else json.loads(s or "{}")


def _anthropic_turn(m: Message) -> dict:
    if m.role == "tool":  # tool result -> a user turn carrying tool_result content
        return {"role": "user", "content": [{"type": "tool_result", "tool_use_id": m.tool_call_id, "content": m.content}]}
    if m.role == "assistant" and m.blocks:  # thinking + tool_use blocks, exactly as the API returned them
        return {"role": "assistant", "content": m.blocks}
    return {"role": m.role, "content": m.content}
```

## Quirk matrix (as of 2026-06; verify before quoting)

| Aspect | OpenAI | Anthropic | Gemini | OSS / litellm |
|---|---|---|---|---|
| Tool schema | `tools[].function.parameters` (JSON Schema) | `tools[].input_schema` | `FunctionDeclaration.parameters_json_schema` | OpenAI shape |
| Structured output | strict JSON Schema (`text.format`) | `output_config.format` (JSON Schema) | `response_json_schema` + `response_mime_type` | strict JSON Schema if backend supports |
| System prompt | `system` role message | top-level `system=` param | `system_instruction` in config | `system` role message |
| Streaming event | `response.output_text.delta` | `content_block_delta` | chunk stream (`.text` per chunk) | OpenAI delta |
| Prompt caching | automatic cached input (−90% cached) | explicit `cache_control` (−90% read) | implicit/explicit cached content | backend-dependent |
| Max context | model-dependent; >272K billed 2×/1.5× | 1M on current Opus/Sonnet/Haiku (Haiku 5.5 bills prompts >100K at a higher rate) | 1M on Flash | backend-dependent |
| JSON-mode strictness | strict (validated) | constrained to the schema | enforced by `responseSchema` | backend-dependent |

## Structured / JSON output

One entrypoint that picks the right mechanism per provider and validates, with a
bounded retry that feeds the validation error back to the model.

```python
from pydantic import BaseModel, ValidationError


async def complete_structured(provider: LLMProvider, req: CompletionRequest,
                              schema: type[BaseModel], max_retries: int = 2) -> BaseModel:
    req = req.model_copy(update={"response_schema": schema.model_json_schema()})
    last_err: str = ""
    for attempt in range(max_retries + 1):
        if attempt:  # feed the prior validation error back as a correction turn
            req.messages.append(Message(role="user",
                content=f"Your previous output failed validation: {last_err}. Re-emit valid JSON only."))
        resp = await provider.complete(req)
        try:
            return schema.model_validate_json(resp.text)
        except ValidationError as e:
            last_err = str(e)
    raise ValueError(f"structured output failed after {max_retries} retries: {last_err}")
```

## Tool / function-calling normalization

Convert one `list[ToolSpec]` into each wire format, parse tool calls back into the
normalized `ToolCall`, and build each provider's tool-result turn.

```python
def to_openai_tools(tools: list[ToolSpec]) -> list[dict]:
    return [{"type": "function", "function": {"name": t.name, "description": t.description,
            "parameters": t.parameters}} for t in tools]


def to_anthropic_tools(tools: list[ToolSpec]) -> list[dict]:
    return [{"name": t.name, "description": t.description, "input_schema": t.parameters} for t in tools]


def to_gemini_tools(tools: list[ToolSpec]) -> list[dict]:
    # parameters_json_schema (not parameters) for raw JSON Schema dicts.
    return [{"function_declarations": [{"name": t.name, "description": t.description,
            "parameters_json_schema": t.parameters} for t in tools]}]


def parse_tool_calls(provider: str, raw: dict) -> list[ToolCall]:
    if provider == "anthropic":
        return [ToolCall(id=b["id"], name=b["name"], arguments=b["input"])
                for b in raw.get("content", []) if b.get("type") == "tool_use"]
    if provider == "gemini":
        fcs = raw.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return [ToolCall(id=f"call_{i}", name=p["functionCall"]["name"], arguments=p["functionCall"].get("args", {}))
                for i, p in enumerate(fcs) if "functionCall" in p]
    # openai / litellm
    msg = raw["choices"][0]["message"]
    return [ToolCall(id=c["id"], name=c["function"]["name"], arguments=_loads(c["function"]["arguments"]))
            for c in (msg.get("tool_calls") or [])]


def tool_result_message(provider: str, call: ToolCall, result: str) -> Message:
    if provider == "openai":  # OpenAI/litellm: a "tool" role turn keyed by call id
        return Message(role="tool", tool_call_id=call.id, name=call.name, content=result)
    if provider == "anthropic":  # carried inside a user turn (see _anthropic_turn)
        return Message(role="tool", tool_call_id=call.id, name=call.name, content=result)
    return Message(role="user", name=call.name, content=result)  # gemini: functionResponse part
```

## Streaming

One normalized async generator. Each provider's native event maps onto `StreamEvent`.

```python
async def stream_openai(client, model: str, req: CompletionRequest) -> AsyncIterator[StreamEvent]:
    async with client.responses.stream(model=model,
            input=[{"role": m.role, "content": m.content} for m in req.messages]) as s:
        async for event in s:
            if event.type == "response.output_text.delta":      # OpenAI delta
                yield StreamEvent(type="text", text=event.delta)
            elif event.type == "response.function_call_arguments.done":
                yield StreamEvent(type="tool_call",
                    tool_call=ToolCall(id=event.item_id, name=event.name, arguments=_loads(event.arguments)))
        final = await s.get_final_response()
        yield StreamEvent(type="usage", usage=Usage(input_tokens=final.usage.input_tokens,
                                                     output_tokens=final.usage.output_tokens))
    yield StreamEvent(type="done")
# Anthropic maps `content_block_delta` -> text and `content_block_start(tool_use)` -> tool_call.
# Gemini yields chunks; emit StreamEvent(type="text", text=chunk.text) per chunk, usage at the end.
```

## Token & context-window management

```python
import tiktoken


def count_tokens(provider: str, model: str, messages: list[Message]) -> int:
    text = "\n".join(m.content for m in messages)
    if provider in ("openai", "litellm"):
        try:
            enc = tiktoken.encoding_for_model(model)
        except KeyError:
            enc = tiktoken.get_encoding("o200k_base")
        return len(enc.encode(text)) + 4 * len(messages)  # per-message overhead
    # Anthropic/Gemini expose count_tokens server-side; fall back to a heuristic offline.
    return len(text) // 4 + 4 * len(messages)  # chars/4 approximation


def trim_to_budget(messages: list[Message], provider: str, model: str, max_tokens: int) -> list[Message]:
    system = [m for m in messages if m.role == "system"]      # invariant: never dropped
    body = [m for m in messages if m.role != "system"]
    while body and count_tokens(provider, model, system + body) > max_tokens:
        body.pop(0)  # drop oldest turn first; replace with a summary turn if you have one
    return system + body


def preflight(messages: list[Message], provider: str, model: str, ctx_limit: int, reserve_out: int) -> None:
    used = count_tokens(provider, model, messages)
    if used + reserve_out > ctx_limit:
        raise ValueError(f"prompt {used} + reserve {reserve_out} exceeds context {ctx_limit}; trim first")
```

## Sampling params

```python
def normalize_sampling(req: CompletionRequest) -> dict:
    out: dict = {"max_tokens": req.max_tokens}
    if req.temperature is not None:
        out["temperature"] = req.temperature
    if req.top_p is not None:
        out["top_p"] = req.top_p
    if req.stop:
        out["stop"] = req.stop
    return out
```

| Param | OpenAI | Anthropic | Gemini |
|---|---|---|---|
| `max_tokens` | `max_output_tokens` (Responses) | `max_tokens` (required) | `max_output_tokens` |
| `stop` | `stop` | `stop_sequences` | `stop_sequences` |
| `temperature` | 0–2 | rejected by current models — omit | 0–2 |

Note (as of 2026-06; verify before quoting): current Claude models reject
`temperature`/`top_p`/`top_k` with a 400, and some reasoning models elsewhere ignore them. Leave
them unset unless the model documents support; treat sampling as advisory, not guaranteed.

## Config-driven selection

```python
import os
from functools import lru_cache

# Roles, not raw ids. App code says route("cheap"); ids live here and rot here only.
MODEL_REGISTRY: dict[str, str] = {
    "default": "anthropic:claude-sonnet-5-5",
    "cheap":   "anthropic:claude-haiku-5-5",
    "smart":   "anthropic:claude-opus-5-5",   # ids rot — re-verify against the provider's model list
}


@lru_cache(maxsize=None)
def get_provider(spec: str) -> LLMProvider:
    provider, _, model = spec.partition(":")
    return {"openai": OpenAIAdapter, "anthropic": AnthropicAdapter,
            "gemini": GeminiAdapter, "litellm": LiteLLMAdapter}[provider](model)


def route(role: str = "default") -> tuple[LLMProvider, str]:
    spec = os.environ.get(f"LLM_{role.upper()}") or MODEL_REGISTRY[role]  # env overrides registry
    return get_provider(spec), spec.split(":", 1)[1]
```

## litellm note (as of 2026-06)

Adopt **litellm** (or its proxy) as the adapter when you must reach many providers/OSS
endpoints, want Router-level fallbacks and per-key budgets, or run a central LLM gateway.
Hand-roll the four adapters above when you only target one or two providers and want zero
extra deps. Pin `v1.85.x`; avoid the quarantined `1.82.7`/`1.82.8` (2026-03 supply-chain
advisory). Router fallbacks/budgets:

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "default",
         "litellm_params": {"model": "anthropic/claude-sonnet-5-5"}},
        {"model_name": "default",  # same alias = automatic fallback target
         "litellm_params": {"model": "openai/gpt-5.4"}},
    ],
    fallbacks=[{"default": ["default"]}],
    routing_strategy="latency-based-routing",
)
resp = await router.acompletion(model="default", messages=[{"role": "user", "content": "hi"}])
```

## See also

- `agent-loops-and-harness.md` — the loop that drives `provider.complete`/`stream`.
- `evals-and-observability.md` — the cost router and LLM-as-judge use this same interface.
