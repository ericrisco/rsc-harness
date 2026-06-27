# Compute Efficiency Analysis

You are analysing a batch of user prompts to identify cases where a heavier (more expensive) AI model tier was used for work that a lighter tier handles equally well. Your output feeds the "Compute Efficiency" score and the model-selection cheat sheet in the roast report.

## Tier Ladder (provider-neutral)

This skill uses three tier labels. The mapping to specific model names shifts over releases — the tiers are stable even when the names change.

| Tier | Description | Example models (2026) | Relative cost |
|------|-------------|----------------------|---------------|
| `light` | Fast, cheap, low reasoning | Haiku, GPT-3.5, Gemini Flash | 1× |
| `balanced` | General purpose, solid reasoning | Sonnet, GPT-4 mini, Gemini Pro | 3–5× |
| `heavy` | Frontier reasoning, long-horizon work | Opus, Fable/Mythos, GPT-4 full | 10–50× |

Overuse = using `heavy` where `balanced` would suffice, or using `balanced`/`heavy` where `light` would suffice.

## Input

You will receive a JSON array of prompt records. Each record includes:

- `prompt_text` — the user's message
- `prompt_length` — character count
- `task_complexity` — heuristic classification: `simple`, `moderate`, `complex`
- `recommended_tier` — what the extractor heuristic suggests: `light`, `balanced`, `heavy`
- `model_tier` — the tier that was actually used (or `unknown`)
- `compute_was_overkill` — boolean from the extractor heuristic (sanity-check, not gospel)
- Standard prompting context fields (`has_xml_tags`, `followed_by_error`, `error_was_recovered`, etc.)

## What counts as overuse

### Definite overuse (flag with `high` confidence):
- `heavy` model for: a one-word confirmation ("yes", "ok", "commit"), a read-only lookup, a formatting/linting fix, a simple file rename
- `heavy` + extended reasoning for: anything classified `simple`
- `balanced` or `heavy` for: a bare file existence check, grepping a single pattern, listing directory contents

### Probable overuse (flag with `medium` confidence):
- `heavy` model for: a single-file edit with clear, contained scope
- `heavy` + extended reasoning for: a short explanatory question with an obvious answer
- `balanced` for: a simple file read or "what does X mean?" question

### Not overuse (do NOT flag):
- `heavy` for: multi-file refactors, architectural decisions, debugging complex concurrency or performance issues, long autonomous runs (the model needs to hold a lot in context)
- `heavy` + extended reasoning for: genuinely ambiguous debugging, performance root-cause analysis, security audit, or migration planning
- `unknown` tier — if the model cannot be identified, skip it; do not guess

## Extended Reasoning Overuse

If a prompt shows signs that extended/chain-of-thought reasoning was used (the model took much longer than expected, or reasoning tokens appear in context), flag it as `thinking_overuse` if the task is clearly simple or moderate.

## Output Format

Return a single JSON object:

```json
{
  "overuse_cases": [
    {
      "index": 2,
      "task_type": "simple_confirmation",
      "model_tier_used": "heavy",
      "recommended_tier": "light",
      "confidence": "high",
      "reasoning": "Single-word confirmation 'yes' — model has no work to do; light tier is identical in outcome",
      "example_prompt": "yes",
      "estimated_tier_ratio": 10
    }
  ],
  "thinking_overuse_cases": [
    {
      "index": 7,
      "confidence": "medium",
      "reasoning": "Simple file rename using heavy model with extended reasoning — no branching logic required"
    }
  ],
  "correctly_used_heavy_model": [
    {
      "index": 14,
      "reasoning": "Multi-file authentication refactor across 8 files with security implications — heavy tier justified"
    }
  ],
  "total_overuse_count": 3,
  "total_savings_estimate": "high",
  "thinking_overuse_count": 1,
  "worst_category": "simple_confirmation"
}
```

`task_type` values (pick the closest):
- `simple_confirmation` — yes/no/ok/lgtm/commit/ship-it
- `read_only_lookup` — read/show/list/cat/find
- `style_fix` — format/lint/prettier/semicolons
- `single_file_edit` — one file, clear contained scope
- `simple_question` — what is X / explain Y (short answer expected)
- `multi_file_work` — spans multiple files (usually NOT overuse at heavy tier)
- `architectural_decision` — design/plan/migrate/strategy (usually NOT overuse)
- `debug_complex` — race conditions, memory leaks, performance (usually NOT overuse)

`estimated_tier_ratio`: approximate cost ratio (e.g. 10 means the heavy tier cost ~10× the recommended tier). Use rough multiples: light→balanced ≈ 3–5×; light→heavy ≈ 10–50×; balanced→heavy ≈ 3–10×.

Only return `high` and `medium` confidence cases. If you are uncertain, omit the record — false positives harm the user's trust in the report.
