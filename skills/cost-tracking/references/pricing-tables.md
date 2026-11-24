# Pricing tables — PERISHABLE snapshot (each section carries its check date)

These rates move month to month. **Treat this file as data with an expiry, not a constant.** Every number below carries a source; re-fetch before trusting. The whole point of the skill is that prices live in a dated table, never as literals in logic.

## Anthropic (Claude) — per 1M tokens

| Model | Input | Output | Cache read | Source |
|---|---|---|---|---|
| Haiku 5.5 (prompt ≤100K tokens) | $0.10 | $0.50 | $0.01 | platform.claude.com/docs/en/about-claude/pricing |
| Haiku 5.5 (prompt >100K tokens) | $0.50 | $2.50 | $0.05 | platform.claude.com/docs/en/about-claude/pricing |
| Sonnet 5.5 | $2.00 | $10.00 | $0.10 | platform.claude.com/docs/en/about-claude/pricing |
| Opus 5.5 | $4.00 | $20.00 | $0.20 | platform.claude.com/docs/en/about-claude/pricing |

Anthropic rows checked 2026-11-24. Cache writes: 5-minute = 1.25x base input; 1-hour = 2x base input. Cache reads = 0.05x base input on Opus 5.5 and Sonnet 5.5, 0.1x on most other models; check the pricing page per model. Break-even on a 5-min cache entry: after ~1 hit (platform.claude.com prompt-caching; finout.io anthropic-api-pricing, accessed 2026-06-02).

## OpenAI — per 1M tokens

| Model | Input | Cached input | Source |
|---|---|---|---|
| GPT-5.5 | $5.00 | $0.50 | openai.com/api/pricing |
| GPT-5.4 | $2.50 | $0.25 | devtk.ai/en/blog/openai-api-pricing-guide-2026 |

Cached input = **90% off** standard input across the line. Output rates vary by model — read them off the source, do not assume. Model names and exact rates drift fast; this is precisely why the rate table is data and never a literal. Accessed 2026-06-02.

## Bedrock note

AWS Bedrock re-prices the same underlying models (often with its own regional/commitment rates) and bills on its own line. Do not assume Bedrock matches first-party Anthropic/OpenAI rates — pull the Bedrock model rate separately and tag the table row `source: bedrock`. Cloud-side caps for Bedrock spend belong in `cloud-caps.md`.

## Batch API discount

50% off on both OpenAI and Anthropic, returned async within 24h, and **stacks with prompt caching** (combined up to ~95% off). Source: finout.io anthropic-api-pricing, accessed 2026-06-02. Use for non-realtime work (evals, backfills, nightly jobs).

## The `usage` object — field map per provider

Bill against these, not pre-send estimates.

| Concept | Anthropic | OpenAI |
|---|---|---|
| Input tokens | `usage.input_tokens` | `usage.prompt_tokens` |
| Output tokens | `usage.output_tokens` | `usage.completion_tokens` |
| Cached (read) | `usage.cache_read_input_tokens` | `usage.prompt_tokens_details.cached_tokens` |
| Cache write | `usage.cache_creation_input_tokens` | n/a (no explicit write line) |
| Reasoning | included in output | `usage.completion_tokens_details.reasoning_tokens` |

Pre-flight estimate tools (estimates only): Anthropic `client.messages.count_tokens()` returns input tokens, is free, separate rate limit, **not** tiktoken-compatible; OpenAI/most use `tiktoken` locally. Sources: platform.claude.com token-counting; langfuse.com token-and-cost-tracking. Accessed 2026-06-02.

## How to refresh this file

1. Pull each provider's current pricing page (sources above).
2. Update the rate and set `effective_date` to today on every changed row.
3. Add any new model name as a new row — never leave a model out, or the lookup will hit the "unknown model" loud-fail path (which is correct behavior).
4. Re-run `scripts/verify.sh` against your `pricing.yaml` to confirm every row still carries `effective_date` + `source`.
