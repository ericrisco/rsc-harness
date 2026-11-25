# Provider reference — exact shapes, limits, and feature support

Current as of 2026-06-02. Pins and shapes verified against the OpenAI Structured Outputs guide, the
Anthropic Structured Outputs docs (GA after the 2025-11-14 public beta), and Instructor
(python.useinstructor.com / github.com/567-labs/instructor). The SKILL body carries the rules; this file
carries the literal request blocks and the limit tables so the body stays lean.

## OpenAI

### Chat Completions — `response_format`

```python
resp = client.chat.completions.create(
    model="gpt-5.1",
    messages=[{"role": "user", "content": text}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "invoice",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["vendor", "total_cents", "due_date"],
                "properties": {
                    "vendor":     {"type": "string"},
                    "total_cents":{"type": "integer", "description": "Total in cents, no symbol."},
                    "due_date":   {"type": ["string", "null"], "description": "ISO date or null."},
                },
            },
        },
    },
)
data = json.loads(resp.choices[0].message.content)
```

### Responses API — `text.format`

Same json_schema block, relocated:

```python
resp = client.responses.create(
    model="gpt-5.1",
    input=text,
    text={"format": {"type": "json_schema", "name": "invoice", "strict": True, "schema": {...}}},
)
```

### OpenAI strict rules

- `strict: true` gives constrained decoding: the model **cannot** emit tokens that violate the schema
  (~100% schema conformance in OpenAI's evals).
- Every object **must** set `"additionalProperties": false`.
- **Every** property must appear in `required`. Optional = a union with `null`
  (`"type": ["string","null"]`), never omission from `required`.
- `response_format` (shape the final answer) and `tools`/function calling (the model calls your code) are
  different jobs — pick function calling when you want a tool invoked, structured outputs when you want a
  shaped answer. Don't use both to shape the same final answer.

## Anthropic (Claude Developer Platform)

### `output_config.format` (current, GA)

```python
resp = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=16000,          # thinking is on by default on current models and shares this budget
    messages=[{"role": "user", "content": text}],
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["vendor", "total_cents", "due_date"],
        "properties": {
            "vendor":      {"type": "string"},
            "total_cents": {"type": "integer"},
            "due_date":    {"type": ["string", "null"]},
        },
    }}},
)
```

- Anthropic compiles the schema into a grammar and **caches it for 24h**, then constrains decoding
  token-by-token.
- Supported on the current Claude models (Opus 5.5, Sonnet 5.5, Haiku 5.5) and earlier generations
  back to 4.5; confirm a given model with the Models API (`capabilities["structured_outputs"]`).
  Also on Bedrock, Vertex, and Foundry (beta).
- SDK helpers: Python `client.messages.parse(...)` returns a parsed object; TS `zodOutputFormat(schema)` /
  `jsonSchemaOutputFormat(schema)`.
- **Deprecated** (transition window only — do not write new code against these): the `output_format` param
  and the `structured-outputs-2025-11-13` beta header.

### Strict tool use (separate feature)

To constrain a *tool call's* input, set `"strict": true` on the tool's `input_schema`. This is independent
of `output_config.format`, which shapes the assistant's final answer.

```python
tools=[{"name": "save_order", "input_schema": {"type": "object", "strict": True, ...}}]
```

### Anthropic schema constraints (the runtime gotchas)

- `additionalProperties` must be `false` for all objects.
- **Not supported**: recursive schemas; numeric bounds (`minimum`, `maximum`, `multipleOf`); string length
  (`minLength`, `maxLength`); array constraints beyond `minItems` of 0 or 1; complex regex (lookahead,
  lookbehind, backreferences).
- Complexity limits per request (combined across all strict schemas): **≤20 strict tools**, **≤24 optional
  parameters** total, **≤16 union-typed (`anyOf`) parameters**, **180s** schema-compile timeout.
- Implication: the schema enforces **shape and types only, never values or ranges**. Push every value rule
  into a post-decode validator.

## Instructor (cross-provider, Pydantic-based)

```python
import instructor
from pydantic import BaseModel

class Order(BaseModel):
    vendor: str
    total_cents: int
    due_date: str | None

# Instructor's default Anthropic mode (Mode.TOOLS) forces a tool call, and current Claude models
# reject a forced tool_choice with a 400. MD_JSON does not force one.
client = instructor.from_provider("anthropic/claude-opus-5-5", mode=instructor.Mode.MD_JSON)  # or "openai/gpt-5.1", "ollama/llama3.3"
order = client.chat.completions.create(
    response_model=Order,
    max_retries=2,            # bound the reask loop
    messages=[{"role": "user", "content": text}],
)
```

- Built on **Pydantic**; unified `from_provider("<provider>/<model>", ...)` across 15+ backends (OpenAI,
  Anthropic, Gemini, Ollama, DeepSeek, …). TS / Go / Ruby ports exist.
- Core value beyond native decoding: the **validate→retry** loop. A failed Pydantic validation — including
  custom `@field_validator` rules the model never saw in the schema — is fed back to the model as the error
  message; `max_retries` caps the reasks.
- Use it for **provider portability** or **value-level validation with reask**. For a single provider and
  the simplest dependency footprint, the native SDK helper (`messages.parse` / `zodOutputFormat`) is enough.
- Add a hook to log reasks (count + reason) so a rising reask rate surfaces a bad field instruction early.

## Consolidated: unsupported JSON Schema features (push these to validators)

| Feature | OpenAI strict | Anthropic | Where it must go instead |
| --- | --- | --- | --- |
| `additionalProperties: false` | required | required | n/a (must set it) |
| Optional via omission from `required` | rejected | rejected | union with `null`, keep in `required` |
| `minimum` / `maximum` / `multipleOf` | not enforced | not supported | Pydantic `@field_validator` / Zod `.refine` |
| `minLength` / `maxLength` | not enforced | not supported | validator after decode |
| Array `minItems`/`maxItems` (beyond 0/1) | limited | beyond `minItems` 0/1 unsupported | validator after decode |
| Complex regex (lookahead/backref) | unsupported | unsupported | validator with a real regex engine |
| Recursive schemas | limited | not supported | flatten / split into multiple extractions |

The single safe assumption: **strict/native modes enforce shape and type only.** Every range, length,
format, cross-field, or enum-legitimacy rule is your validator's job.
