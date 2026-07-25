---
name: cost-tracking
description: "Use when metering and capping AI or cloud app spend — tokens read from the response `usage` object, priced off a dated rate table, ledgered per user/tenant/feature, with alerts and a hard cap before the bill. NOT cash runway (that is `finance-ops`), NOT cost-per-unit margin (that is `unit-economics`), NOT booking the spend (that is `bookkeeping`)."
tags: ["cost-tracking", "token-accounting", "llm-spend", "budgets", "alerts", "prompt-caching", "billing-guardrails", "finops"]
recommends: ["finance-ops", "unit-economics", "analytics", "stripe", "aws-essentials", "gcp-essentials"]
origin: risco
---

# Cost tracking

You are building the money meter for an AI or cloud app: every model call gets a token count, a price, a ledger row, and a budget check — so a cap fires *before* the invoice, not when finance forwards it in a panic. Model-API spend roughly doubled from $3.5B to $8.4B between late 2024 and mid 2025 (firecrawl.dev best-llm-observability-tools, accessed 2026-06-02); the bill is now big enough to need a guardrail, not a spreadsheet at month-end.

The chain you build, in order — each step feeds the next:

1. **Capture** — read tokens from the response, not from a pre-send guess.
2. **Price** — multiply tokens by a *versioned, dated* rate table.
3. **Ledger** — append one idempotent row per request, tagged for attribution.
4. **Budget** — roll the ledger up against a soft and a hard threshold.
5. **Guard** — alert, degrade, or refuse before the threshold becomes an invoice.

The one rule that organizes everything: **bill against the response `usage` object. Anything you compute before the call is an estimate — good only for the pre-flight cap check, never for the ledger.**

## What this skill produces

A checkable cost setup: a **pricing table** (each model row carries `effective_date` + `source`), an **append-only ledger** schema (idempotency key + attribution keys), and a **budget** with both a soft and a hard threshold. `scripts/verify.sh` lints those artifacts (last section). Prose alone is not a deliverable — emit the config.

## Capture: read `usage`, do not estimate

Pre-send token counts (`tiktoken`, Anthropic `client.messages.count_tokens()`) are estimates. They exist for the *pre-flight cap check* — "will this request likely breach the budget?" — and nothing else. The truth lands in the response: input, output, **cached**, and **reasoning** tokens, plus audio/image tokens where the modality applies. Bill the ledger off that object.

Two provider facts that bite if you assume otherwise:
- Anthropic `count_tokens()` returns *input* tokens only, is free, has its own rate limit, and is still an estimate. Anthropic is **not** tiktoken-compatible — do not reuse an OpenAI tokenizer to price Claude (platform.claude.com token-counting; github.com/anthropics/anthropic-tokenizer-typescript, accessed 2026-06-02).
- Output and reasoning tokens are the expensive half — output runs 4-5x the input rate. A meter that only counts input is wrong by most of the bill.

```python
# Bad: pricing off a pre-send character/word guess. Wrong, and ignores output.
est_tokens = len(prompt) // 4
cost = est_tokens * rate_in            # output + reasoning never counted

# Good: capture every field the response actually reports, then price that.
resp = client.messages.create(model=model, messages=msgs, max_tokens=1024)
u = resp.usage
record = {
    "input_tokens":  u.input_tokens,
    "output_tokens": u.output_tokens,
    "cache_read_tokens":     getattr(u, "cache_read_input_tokens", 0),
    "cache_write_tokens":    getattr(u, "cache_creation_input_tokens", 0),
    # OpenAI exposes cached as usage.prompt_tokens_details.cached_tokens
}
cost = price(model, record)            # see "pricing is data" below
```

Wrap the SDK call **once** so capture cannot be skipped. A meter you have to remember to call is a meter that's already missing rows (langfuse.com token-and-cost-tracking, accessed 2026-06-02).

## Pricing is data, never literals

Rates drift fast and silently mis-bill when stale. Keep prices in a **versioned table** — one row per model, each with `effective_date` and `source` — loaded as data. Never write a rate as a literal in business logic. Look up by model and **fail loud on an unknown model; never default to $0**, or a new model silently bills as free and the leak is invisible.

```yaml
# pricing.yaml — perishable. Verify against source before trusting. Dated 2026-06-02.
models:
  - model: claude-haiku-4.5
    effective_date: 2026-06-02
    source: cloudzero.com/blog/claude-api-pricing
    input_per_mtok: 1.00
    output_per_mtok: 5.00
    cache_read_per_mtok: 0.10
  - model: claude-sonnet-4.6
    effective_date: 2026-06-02
    source: cloudzero.com/blog/claude-api-pricing
    input_per_mtok: 3.00
    output_per_mtok: 15.00
    cache_read_per_mtok: 0.30
  - model: claude-opus-4.7
    effective_date: 2026-06-02
    source: cloudzero.com/blog/claude-api-pricing
    input_per_mtok: 5.00
    output_per_mtok: 25.00
    cache_read_per_mtok: 0.50
  - model: gpt-5.5
    effective_date: 2026-06-02
    source: openai.com/api/pricing
    input_per_mtok: 5.00
    output_per_mtok: 40.00
    cache_read_per_mtok: 0.50   # OpenAI cached input = 90% off standard input
```

These numbers are a **snapshot, not a constant** — model names and rates move month to month. Dated 2026-06-02 from the sources above. The dated per-provider snapshots, the `usage`-field map per provider, and refresh instructions live in `references/pricing-tables.md`; read it before you trust a rate.

## Ledger: append-only, idempotent, attributed

One row per request, append-only. Two things must be on every row or the ledger lies:

- A **request/idempotency key.** Retries and SDK auto-retries fire the same logical call twice; without a key the row is written twice and you double-count spend.
- At least one **attribution key** (user, tenant, feature, model). A per-org total can tell you the bill is high; it cannot tell you *which feature or customer* is the leak. Attribution is the difference between "spend is up" and "the summarize-document feature on the enterprise tenant tripled."

```sql
-- append-only; (request_id) is the idempotency key — upsert, never plain insert
CREATE TABLE llm_cost_ledger (
  request_id     TEXT PRIMARY KEY,           -- idempotency: retries collapse to one row
  ts             TIMESTAMPTZ NOT NULL,
  model          TEXT NOT NULL,
  input_tokens   INTEGER NOT NULL,
  output_tokens  INTEGER NOT NULL,
  cached_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd       NUMERIC(12,6) NOT NULL,      -- priced from the table above
  user_id        TEXT,                        -- attribution keys
  tenant_id      TEXT,
  feature        TEXT
);
```

This is an *operational* ledger, not the accounting record — categorizing the spend into the books is `bookkeeping`, and the same rows feed the cost numerator in `unit-economics` and one input line in `finance-ops`. "Cost per active user" on the behavior side is `analytics`; charging customers for metered usage is `stripe`.

## Budgets, alerts, caps

A budget needs a **soft** state (alert + degrade) and a **hard** state (refuse). Roll the ledger up per window (day/month) and per attribution key, then branch:

| Spend vs budget | State | Action |
|---|---|---|
| < 50% | normal | log only |
| 50% / 80% | warn | fire alert to the same pipe as cloud alerts; no behavior change |
| 100% | **soft cap** | degrade — downshift to a cheaper model, drop optional/enrichment calls, shrink context |
| over hard cap | **hard cap** | refuse the request with a typed error (`BudgetExceededError`), not a silent failure |

Two distinct checks, do not conflate them:
- **Pre-flight gate** uses the *estimate* (pre-send token count × rate) to refuse a request that would obviously blow the hard cap — this is the only legitimate use of an estimate.
- **Post-hoc reconciliation** rolls up the *ledger* (real `usage`) against the budget. When someone asks "why is the bill 3x the estimate," you compare provider-billed usage to your ledgered `usage` — the gap is almost always uncounted output/reasoning/cache-write tokens or missing rows from un-wrapped call sites.

## The three levers that move the number

Don't assert savings — show the break-even. Pricing per fact-checked sources accessed 2026-06-02 (platform.claude.com prompt-caching; finout.io anthropic-api-pricing).

- **Prompt caching.** Cache *reads* cost 0.1x base input. The 5-min write costs 1.25x, the 1-hour write 2x. So a 5-min entry pays for itself after roughly **one** cache hit: `1.25 + 0.1·h` (cached) beats `1·(1+h)` (uncached) once `h ≥ 1`. Caching a stable system prompt across a session is almost always net cheaper.
- **Batch API.** 50% off on both OpenAI and Anthropic, async within 24h, and it **stacks with caching** — combined up to ~95% off. Use it for anything not user-facing-realtime: evals, backfills, nightly summaries.
- **Model downshift.** The largest lever. Route easy requests to Haiku/cheap models and reserve Opus/GPT-5.5 for hard ones — at 5x the rate, downshifting the routable half of traffic dwarfs a few percent of caching.

"We'll add caching later" without measuring the hit rate is a guess, not a lever. Instrument `cache_read_tokens` in the ledger first, then you know.

## Cloud spend is the slow backstop

App-level metering is your real-time guard. Cloud billing alerts are a **delayed backstop** — useful, but never the thing standing between you and a runaway loop.

- **AWS** Cost Anomaly Detection is ML-based, runs ~3x/day with up to 24h data delay → SNS → Lambda. AWS Budgets adds threshold alerts on the same pipe.
- **GCP/Azure** are threshold-only. GCP's budget → Pub/Sub → Cloud Function is the one that can actually *pause or throttle* a workload programmatically.

Route every cloud alert into the **same alert pipe** as your app-level budget alerts so there's one place to look. The 24h delay is exactly why the in-app cap exists: by the time AWS notices the anomaly, the loop already spent the money. Recipes and the alert-routing pattern are in `references/cloud-caps.md`; the cap plumbing in depth is `aws-essentials` / `gcp-essentials`.

## Build vs buy

| You want | Use | Trade-off |
|---|---|---|
| Zero code change, fastest setup | Helicone (proxy, ~2-min) | adds a network hop / latency |
| SDK-level capture + a ready cost table | Langfuse (MIT, ships model+tokenizer cost table) | you wire the SDK, but no proxy hop |
| Full control / custom attribution / typed caps | DIY ledger (this skill) | you own pricing-table freshness and capture coverage |

(firecrawl.dev best-llm-observability-tools; guptadeepak.com top-5-llm-observability-platforms-2026, accessed 2026-06-02.) Buy the proxy/platform when you want spend *visibility* fast; build the ledger when caps and per-feature attribution must live inside your own logic.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Pricing literals in business logic | a rate change silently mis-bills everything | versioned table, each row dated + sourced |
| Billing off the pre-send estimate | estimates ignore output/reasoning/cache; off by most of the bill | price the response `usage` object |
| No idempotency key on ledger rows | retries double-count spend | `request_id` PRIMARY KEY, upsert not insert |
| Unknown model defaults to $0 | a new model bills as free; leak is invisible | fail loud on a model absent from the table |
| Only a soft alert, no hard cap | alert fires, loop keeps spending | a hard cap that refuses with a typed error |
| Org-total budget, no attribution | "spend is up" — but you can't find the leak | tag every row by user/tenant/feature |
| Counting input tokens only | output+reasoning are 4-5x the cost — the expensive half | capture all token fields from `usage` |
| Trusting cloud alerts for real-time control | ~24h delay; the loop already spent it | app-level cap is the guard; cloud is the backstop |
| "Add caching later" with no measurement | savings unproven; may not even hit | instrument `cache_read_tokens`, compute break-even |

## Verify the artifact

`scripts/verify.sh [path]` lints a candidate cost config/ledger (yaml/json/ts) and fails if: a pricing entry lacks `effective_date` or `source`; a model referenced in logic is missing from the table; the ledger schema lacks an idempotency/request key or any attribution key; the budget declares no soft+hard pair; or cost looks derived from a `len()`/char estimate instead of a `usage` field. It is read-only and exits 0 on a clean config and on no config found — no false failure.
