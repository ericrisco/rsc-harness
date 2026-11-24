# Output contracts: per-provider strict recipes

Pick the strongest mechanism the provider gives you. Provider APIs and version notes
below verified 2026-06-02 (access date); each external figure carries its own source
date inline — do not read the access banner as the date a cited number was published.

## OpenAI — strict `json_schema` via `response_format`

Highest reliability: the provider compiles the schema into a token-masking FSM, so the
output is guaranteed to parse against the schema (**<0.1% schema-failure rate** — figure
published by OpenAI at the Aug 2024 Structured Outputs launch, not a 2026 number). Set
`strict: true` and mark every field required (use unions/nullable for optional).

```python
from openai import OpenAI
from pydantic import BaseModel

class Triage(BaseModel):
    category: str  # "bug" | "billing" | "other"

client = OpenAI()
resp = client.chat.completions.parse(
    model="gpt-…",                       # resolve the model id from config, not here
    messages=[{"role": "user", "content": prompt}],
    response_format=Triage,              # SDK emits strict json_schema under the hood
)
result = resp.choices[0].message.parsed  # already a Triage, or None on refusal
```

Raw form (no SDK helper):

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "triage",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": { "category": { "type": "string", "enum": ["bug", "billing", "other"] } },
      "required": ["category"],
      "additionalProperties": false
    }
  }
}
```

## Anthropic — `output_config.format`

Constrained decoding against a JSON Schema: the first text block of the answer is valid JSON in
your shape. Two older routes now fail on current Claude models: **assistant prefill** and **forced
tool use** (`tool_choice` of `tool` or `any`) both return a `400`. Do not use either to coerce
a shape. Strict tool use (`"strict": true` on a tool) remains the right tool when you want the
model to *call your code*, not to shape its final answer.

```python
import json
import anthropic
client = anthropic.Anthropic()
msg = client.messages.create(
    model="claude-…",                    # from config
    max_tokens=4096,                     # thinking is on by default on current models and shares this budget
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {"category": {"type": "string", "enum": ["bug", "billing", "other"]}},
        "required": ["category"],
        "additionalProperties": False,
    }}},
    messages=[{"role": "user", "content": prompt}],
)
text = next(b.text for b in msg.content if b.type == "text")
result = json.loads(text)  # {"category": "..."}
```

**Streaming caveat:** a structured answer streams as ordinary text deltas, and tool inputs stream
as partial JSON deltas. Either way, validate only the complete object, never a prefix.

## Google Gemini — `responseSchema`

Set `response_mime_type: "application/json"` and a `response_schema`. Validate after,
same as any JSON path.

```json
{ "generationConfig": { "response_mime_type": "application/json", "response_schema": { "type": "OBJECT", "properties": { "category": { "type": "STRING", "enum": ["bug","billing","other"] } } } } }
```

## TypeScript schema surface (zod)

```typescript
import { z } from "zod";
const Triage = z.object({ category: z.enum(["bug", "billing", "other"]) });
// OpenAI: zodResponseFormat(Triage, "triage"); Anthropic: zodToJsonSchema(Triage) as input_schema.
const parsed = Triage.parse(JSON.parse(raw));   // throws -> trigger retry
```

## Retry-on-parse-fail (for JSON mode / freeform only)

Strict mechanisms above rarely need this. When you only have JSON mode or freeform,
bound the retries and feed the parser error back:

```python
def call_with_retry(prompt, schema, parse, max_tries=2):
    last_err = None
    for _ in range(max_tries + 1):
        raw = call_model(prompt if last_err is None
                         else f"{prompt}\n\nYour previous output failed: {last_err}. Return only valid output.")
        try:
            return parse(raw, schema)          # raises on invalid
        except Exception as e:
            last_err = str(e)
    raise ValueError(f"contract not met after retries: {last_err}")
```

Keep `max_tries` small (1-2). If a strict mechanism is available, use it instead of
spending tokens on retries.
