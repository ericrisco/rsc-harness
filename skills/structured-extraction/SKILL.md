---
name: structured-extraction
description: "Use when text must become a typed, schema-conformant object you can trust — pulling fields into a fixed JSON shape, extracting line items as typed records, classifying into enums, and building the Pydantic or Zod model plus the validate-and-retry loop. Covers extractors that throw parse errors, leak markdown fences, or fabricate a value where the field is absent instead of returning null. NOT getting the text out of a PDF, scan or DOCX first (that is `document-processing`), NOT general prompt craft untied to a schema (that is `prompt-engineering`)."
tags: [structured-outputs, json-schema, pydantic, extraction, validation, llm]
recommends: [document-processing, prompt-engineering, llm-pipeline, agent-eval, rag, data-cleaning]
profiles: []
origin: risco
---

# Structured extraction — text in, a typed object you can trust out

The deliverable is **a typed object that conforms to a schema you defined** — not prose, not "roughly JSON."
The whole skill rests on one distinction the rest of the file keeps returning to:

> Native structured outputs make the JSON **valid and typed**. They never make the values **correct**.

Constrained decoding guarantees the model cannot emit a token that breaks your schema, so `JSON.parse`
errors, missing keys, wrong types, and stray markdown fences disappear at the source. It does **nothing**
to stop the model from putting a plausible-but-wrong email in a `string` field, snapping a fuzzy category to
the wrong enum, or coercing `"$1,200"` into `1200.0` when the currency mattered. Owning both halves — the
shape (decoding) and the values (validation) — is this skill. If you only do the first half you ship a
database full of well-typed lies.

**Boundary test (bytes vs. schema).** If the input is a PDF, scan, DOCX, or HTML and the deliverable is the
*raw text/Markdown/cells* of that document, that is upstream: [`document-processing`](../document-processing/SKILL.md)
produces the text, this skill turns that text into typed fields. If you're holding text and want it shaped,
you're in the right place.

Current as of 2026-06-02: OpenAI Structured Outputs (`strict: true` json_schema), Anthropic Structured
Outputs (GA since the 2025-11-14 public beta; `output_config.format`), and Instructor (built on Pydantic,
~3M downloads/month). Exact request/response shapes and the per-provider limit tables live in
[`references/providers.md`](references/providers.md) so this file stays lean.

## Default: native constrained decoding when the provider has it

If the model and provider support native structured outputs, use them. This is not a tuning knob — it is the
difference between ~100% schema conformance and hoping a regex catches the fence.

**Bad — prompt-and-pray, then parse raw text:**

```python
resp = client.chat.completions.create(
    model="gpt-5.1",
    messages=[{"role": "user", "content": f"Return JSON with name and email:\n{text}"}],
)
data = json.loads(resp.choices[0].message.content)  # markdown fence / preamble / missing key -> crash
```

**Good — OpenAI strict json_schema (Chat Completions):**

```python
resp = client.chat.completions.create(
    model="gpt-5.1",
    messages=[{"role": "user", "content": text}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "contact",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "email"],
                "properties": {
                    "name": {"type": "string", "description": "Full name as written."},
                    "email": {"type": ["string", "null"],
                              "description": "Email exactly as written, or null if none is stated."},
                },
            },
        },
    },
)
data = json.loads(resp.choices[0].message.content)  # now guaranteed valid + typed
```

On the OpenAI Responses API the same block moves under `text.format` instead of `response_format`. On
Anthropic, the equivalent is `output_config={"format": {"type": "json_schema", "schema": {...}}}` on Claude
Opus 4.5–4.8 / Sonnet 4.5+ / Haiku 4.5; Anthropic compiles your schema into a grammar and **caches it for
24h**, and the SDKs ship helpers (`client.messages.parse(...)` in Python, `zodOutputFormat(schema)` in TS).
The older deprecated `output_format` param and the deprecated `structured-outputs-2025-11-13` beta header
still work in a transition window — do not write new code against them. Full shapes in
[`references/providers.md`](references/providers.md).

**The non-negotiable strict-schema rule (OpenAI and Anthropic both):**

- every object sets `"additionalProperties": false`;
- **every** property is listed in `required`;
- "optional" is expressed as a **union with `null`** (`"type": ["string", "null"]`), never by leaving the
  field out of `required`. Omitting it is the single most common strict-mode error.

## Schema design rules (each prevents a specific failure)

| You want | Express it as | Because |
| --- | --- | --- |
| A field that may be absent | nullable union `["string","null"]` + `description: "...or null if not stated"` | A non-null type *forces* a value, so the model fabricates one. Nullable + instruction yields `null` instead. |
| A closed set of categories | `enum: ["open","pending","closed"]` | Free-text `string` drifts ("Open", "in progress", "closd"); an enum makes drift impossible to emit. |
| Many items of one kind | one object schema + a top-level `{"items": {"type":"array","items": <object>}}` wrapper | One object per extraction unit keeps each record independently validatable; arrays of scalars lose field structure. |
| The model to read your intent | a `description` on every property | The model reads field descriptions at decode time; "amount in cents, no currency symbol" beats a bare `integer`. |
| A number in a range / a regex / a length cap | leave it **out** of the schema; enforce in a post-decode validator | Strict modes reject or silently ignore `minimum`/`maximum`/`minLength`/`maxLength`/complex regex — see the unsupported-features table in references. |
| A deeply nested or recursive shape | flatten it, or split into two extractions | Native modes reject recursion and cap nesting/complexity; flat schemas decode reliably. |

Keep schemas **flat and shallow**. If you find yourself nesting four levels deep or describing a tree, that
is two extractions, not one heroic schema.

## The reliability ladder — escalate only on failure, and cap it

Climb from the cheapest mechanism upward. Each rung catches what the rung below cannot; you stop at the
first rung that holds for your data.

| Rung | Mechanism | Catches | Does NOT catch | When you stop here |
| --- | --- | --- | --- | --- |
| 1 | Native constrained decoding | parse errors, wrong types, missing keys, fences | wrong values, bad units, wrong enum | shape+types only, latest single provider |
| 2 | Pydantic / Zod validation after decode | out-of-range, bad format, cross-field contradictions, null-vs-absent | nothing the model genuinely got wrong | value rules you can express as code |
| 3 | Bounded reask (Instructor or hand-rolled) | semantic errors the model can fix when shown the validation message | systematic model blind spots | residual errors; **cap retries (e.g. 2) and log every reask** |
| 4 | Human / log review | everything still wrong after 3 | — | high-stakes fields or low-confidence rows |

Rung 1 is mandatory when available. Rung 2 is mandatory the moment any field has a *value* rule (a range, a
format, a "must match the order date") — because rung 1 structurally cannot enforce values. Rungs 3 and 4
are opt-in. **Never** make rung 3 unbounded: a retry loop with no cap turns one bad document into an
unbounded bill.

## Value validation the schema can't enforce

This is the half native decoding leaves on the table. Validate values *after* you have a typed object.

**Pydantic — value rules + normalization the schema can't carry:**

```python
from pydantic import BaseModel, field_validator

class Order(BaseModel):
    amount_cents: int
    discount_pct: float | None  # nullable: may be absent
    order_date: str             # we'll normalize to ISO

    @field_validator("discount_pct")
    @classmethod
    def pct_in_range(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("discount_pct must be between 0 and 100")
        return v

    @field_validator("amount_cents", mode="before")
    @classmethod
    def strip_currency(cls, v):
        if isinstance(v, str):  # "$1,200.00" -> 120000
            return int(round(float(v.replace("$", "").replace(",", "")) * 100))
        return v
```

The Zod equivalent uses `.refine()` for cross-field and range checks and `.transform()` for normalization.
Three normalizations bite constantly: **currency** (`"$1,200"` vs `1200` vs `120000` cents — pick one and
enforce it), **dates** (free text → ISO 8601, and decide what a missing year means), and **enum snapping**
(the model rounds "kinda urgent" to `urgent`; validate that the snap was legitimate, or widen the enum).

**Null vs. absent.** A nullable field with a clear instruction is the entire fix for "the model invents an
email." `"email": {"type": ["string","null"], "description": "...or null if the text states no email"}` plus
a one-line system instruction ("use null for any field not present in the source; never guess"). If you make
the field non-nullable, you have *told the model to produce a value* — it will.

**Bounded reask with Instructor** — failed validation is fed back to the model as an error message:

```python
import instructor

client = instructor.from_provider("openai/gpt-5.1")
order = client.chat.completions.create(
    response_model=Order,            # your Pydantic model, validators and all
    max_retries=2,                   # BOUND it; each retry is another paid call
    messages=[{"role": "user", "content": text}],
)
```

On a validation failure Instructor reasks with the `ValueError` text, so `@field_validator` rules the model
never saw in the schema still get enforced through the loop. Log every reask (count + reason): a quietly
climbing reask rate is your early signal that a field's instruction or schema is wrong.

## Multi-provider: Instructor `from_provider`

When you want one Pydantic model to run across OpenAI, Anthropic, and local backends without rewriting per
SDK, use Instructor's unified entrypoint:

```python
client = instructor.from_provider("anthropic/claude-opus-4-8")  # or "openai/gpt-5.1", "ollama/llama3.3"
```

Reach for Instructor when you need **provider portability** or **value-level validation with reask**. Reach
for the **native SDK helper** (`client.messages.parse`, `zodOutputFormat`) when you're on one provider and
want the simplest path with the fewest dependencies. Both sit on the same native decoding underneath.

## Scale and accuracy live next door

This skill is the single extraction node and its per-call validation loop. Two concerns are explicitly *not*
here:

- Running 10k documents — batching, idempotency, retries-across-calls, cost/latency budgeting, multi-step
  chains → [`llm-pipeline`](../llm-pipeline/SKILL.md).
- Measuring extraction quality offline — a golden set, precision/recall, a regression gate that fails CI when
  accuracy drops → [`agent-eval`](../agent-eval/SKILL.md). This skill *builds* the extractor; that one *scores* it.
- Answering questions over a corpus by retrieving chunks → [`rag`](../rag/SKILL.md).
- Post-extraction tabular cleanup (dedupe rows, coerce columns, normalize categories across a whole dataset)
  → [`data-cleaning`](../data-cleaning/SKILL.md).
- Improving a prompt that isn't bound to a schema → [`prompt-engineering`](../prompt-engineering/SKILL.md).

(Some routed siblings may not be built in this collection yet; the routing decision still holds.)

## Anti-patterns

| Bad | Why it bites | Good |
| --- | --- | --- |
| `json.loads(resp.text)` on raw model output | markdown fence, chatty preamble, or a missing key crashes at runtime | native structured outputs; parse only a decoder-guaranteed string |
| Stripping ` ```json ` fences with a regex | treats the symptom; the model can still drop a key or change a type | turn on native decoding — the fence never appears |
| `"type": "string"` on a field that's often absent | forces a value, so the model fabricates a plausible wrong one | nullable union `["string","null"]` + "null if not stated" |
| Omitting an optional field from `required` (strict mode) | OpenAI/Anthropic strict reject it — *every* property must be in `required` | keep it in `required`, make its type a union with `null` |
| `minimum`/`maxLength`/lookahead-regex inside a strict schema | rejected or silently ignored — the constraint does nothing | leave value rules out of the schema; enforce in a Pydantic/Zod validator |
| `max_retries` unbounded (or a `while` reask loop) | one bad doc becomes an unbounded bill and a hung job | cap at 2–3, log each reask, route the rest to review |
| Deep/recursive schema in one call | native modes reject recursion and cap complexity → compile failure | flatten, or split into multiple extractions |
| Trusting decoding to make values *correct* | valid+typed ≠ true; you ship well-formed wrong data | add the rung-2 validation step for every value rule |
| Building on Anthropic `output_format` / `structured-outputs-2025-11-13` header | deprecated transition-window API | use `output_config={"format": {...}}` |
| One giant array of scalars for "many things" | loses per-item field structure and per-item validation | one object schema per unit, wrapped in a top-level `items` array |

## Checklist before you ship an extractor

1. Native structured outputs ON (or a documented reason the provider has no native mode).
2. Every object has `additionalProperties: false`; every property is in `required`.
3. Every maybe-absent field is nullable with a "use null if not stated" instruction.
4. Closed sets are enums; value rules (ranges/format/cross-field) live in validators, not the schema.
5. A reask loop, if any, is **bounded and logged**.
6. You can state, for each field, whether a wrong output would be caught by decoding (shape) or only by
   validation (value) — and you have the validation for the value cases.
