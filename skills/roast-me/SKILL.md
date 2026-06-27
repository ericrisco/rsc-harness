---
name: roast-me
description: "Use when you want honest, comedic feedback on how you prompt — analyzing your own past sessions to score prompt quality and compute efficiency, surface your worst habits, and generate a model-selection cheat sheet. Triggers: 'roast me', 'roast my prompting', 'audit my prompting habits', 'how good are my prompts', 'am I prompting well', 'what are my bad prompt habits', 'analiza mis prompts', 'puntua els meus prompts', 'how much am I wasting on model costs'. NOT reviewing your code or output quality (use code-review for that) and NOT a general prompt-engineering tutorial (use prompt-engineering for that)."
tags: [prompting, self-audit, compute-efficiency, ai-hygiene, learning]
recommends: [prompt-engineering, code-review, context-budget]
profiles: [full]
origin: risco
---

# roast-me — audit your prompting, score yourself, stop burning money

You are the **prompt auditor**. Your target is not the user's code — it is their *prompting behaviour*. You read their recent agent transcripts, run structured analysis passes, produce dual scores (Prompt Quality + Compute Efficiency), name the worst habits with named techniques to fix them, and track the trend over time.

Every run follows five phases. Execute them in order.

## Phase 1 — Extract

Parse `$ARGUMENTS` for a day count. Accept `--days N`, `days=N`, or a bare number (e.g. `3` means three days). Default: 7. Also accept `--runtime auto|claude|codex|gemini` (default `auto`).

Run the extractor:

```
python3 <skill_dir>/tools/extract_prompts.py --days <N> --runtime <runtime>
```

Where `<skill_dir>` is the directory containing this SKILL.md. Use your runtime's mechanism to resolve it (environment variable, `__file__` equivalent, or the skill's known install path).

Wait for completion. Read the output JSON path that the script prints. Report to the user:

```
Scanned <sessions> sessions across <projects> projects
Extracted <N> prompts (<errors> with errors, <recovered> auto-recovered, <unrecovered> impactful)
```

If `total_prompts` is 0: tell the user "No transcript data found for that window. Try a longer window (`--days 30`) or check that your assistant's transcript directory exists." Then stop.

**Key distinction**: always report `effective_error_rate` (errors NOT auto-recovered), never the raw error rate. Auto-recovered errors are the agent doing its job — not your fault.

## Phase 2 — Analyze Prompt Quality

Read the extracted JSON. Batch the prompts into groups of ~30. For each batch, use your runtime's subagent/Task mechanism to run a parallel analysis pass with the prompt in `prompts/analyze.md`, passing the batch as JSON.

Collect results. Group flagged issues by category and severity.

**Filter rule**: keep only issues where the impact was real — agent went in the wrong direction, user had to correct, dangerous action attempted, or significant wasted work (>10 tool calls). Discard issues where `error_was_recovered` is true.

Report category counts as a progress update.

If zero issues are flagged, proceed to Phase 3 anyway — the roast should honour good prompting.

## Phase 3 — Analyze Compute Efficiency

Read the same JSON. Batch into ~30-prompt groups. Spawn parallel subagent passes with `prompts/compute.md`.

Aggregate across batches:
- All `overuse_cases` (deduplicate by index)
- All `thinking_overuse_cases`
- All `correctly_used_heavy_model` examples
- Summed totals: `total_overuse_count`, `total_savings_usd`, `thinking_overuse_count`
- `worst_category` = most frequent `task_type` in overuse_cases

Keep only `high` and `medium` confidence overuse cases.

Report:

```
Compute analysis: <X> confirmed overuse cases | $Y.YY potential savings | Z reasoning overuse
```

## Phase 4 — Generate Roast

Spawn a single subagent with `prompts/roast.md`. Pass it:
- Aggregated issue counts by category and severity
- Top ~15 worst prompt examples (highest severity + real impact)
- Stats metadata (especially `effective_error_rate`)
- A sample of ~10 issue-free prompts for the "What You Do Well" section
- `compute_stats` from the extraction metadata
- Aggregated compute analysis (overuse cases, thinking overuse, correctly-used examples, totals)

Collect the roast report. Extract the dual score (Prompt Quality 0–100, Compute Efficiency 0–100) and the grade letters.

## Phase 5 — Score, Track, Present

Save results to `~/.roast-me-history.json`. Read existing history (if any), append a new entry:

```json
{
  "date": "YYYY-MM-DD",
  "runtime": "auto",
  "days_analyzed": 7,
  "prompt_quality_score": 73,
  "prompt_quality_grade": "C",
  "compute_efficiency_score": 35,
  "compute_efficiency_grade": "F",
  "total_prompts": 200,
  "issues_flagged": 30,
  "effective_error_rate": 0.08,
  "correction_rate": 0.06,
  "focus_of_week": "The 3W Rule",
  "compute_total_cost_usd": 22.50,
  "compute_wasted_cost_usd": 8.10,
  "compute_overuse_count": 30,
  "model_distribution": {"heavy": 0.4, "balanced": 0.4, "light": 0.2}
}
```

Write the updated history back to `~/.roast-me-history.json`.

If previous entries exist, append a trend line after the main report:

```
Score History:
  Date        Prompt Quality    Compute Efficiency    Focus
  2026-06-01  68/100 (D+)       --/-- (new)           Context anchoring
  2026-06-08  73/100 (C) +5↑   35/100 (F)            The 3W Rule
```

Output the roast report as formatted markdown. If history exists, append the trend line.

Done.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
