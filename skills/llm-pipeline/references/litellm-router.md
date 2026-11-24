# LiteLLM Router / Proxy config (v1.83.x)

Fuller config than the SKILL body. Version-pinned to the **v1.83.3-stable** line (also recent: v1.81.9-stable, v1.81.13). LiteLLM exposes a unified OpenAI-format `completion()` across 100+ providers, with retry/fallback, cost tracking, and budget management, as an SDK or a Proxy Server.

## SDK Router with every fallback bucket

```python
from litellm import Router

router = Router(
    model_list=[
        {"model_name": "smart",
         "litellm_params": {"model": "anthropic/claude-sonnet-5-5",
                            "api_key": "os.environ/ANTHROPIC_API_KEY",
                            "timeout": 30, "order": 1}},
        {"model_name": "smart",          # same group, order 2 = first internal fallback
         "litellm_params": {"model": "openai/gpt-4o",
                            "api_key": "os.environ/OPENAI_API_KEY",
                            "timeout": 30, "order": 2}},
        {"model_name": "cheap",
         "litellm_params": {"model": "anthropic/claude-haiku-5-5",
                            "api_key": "os.environ/ANTHROPIC_API_KEY",
                            "timeout": 20}},
        {"model_name": "long-ctx",
         "litellm_params": {"model": "openai/gpt-4o",
                            "api_key": "os.environ/OPENAI_API_KEY", "timeout": 60}},
    ],
    # cross-group fallbacks (after order levels in a group are exhausted)
    fallbacks=[{"smart": ["cheap"]}],
    content_policy_fallbacks=[{"smart": ["smart"]}],   # ContentPolicyViolationError
    context_window_fallbacks=[{"smart": ["long-ctx"]}],# ContextWindowExceededError
    default_fallbacks=["cheap"],                         # catch-all last resort
    num_retries=2,            # bounded retries PER order level
    timeout=30,              # router-wide hard cap
    retry_after=1,
)
```

Order semantics: a request to an `order=1` deployment that fails (connection error, 404, 429, ...) auto-tries `order=2`, then `order=3`. Each order level runs its own `num_retries` before escalating. Once all orders in the group are exhausted, the `fallbacks`/specialized buckets fire. Retry backoff is exponential from `INITIAL_RETRY_DELAY` 0.2s up to `MAX_RETRY_DELAY` 10s, with jitter.

## Keys come from env, never inline

Use `os.environ/VAR` indirection (proxy YAML) or read `os.environ[...]` in SDK. A literal `sk-...` in a model_list is a leaked credential and a verify.sh FAIL.

## Proxy Server config (config.yaml)

```yaml
model_list:
  - model_name: smart
    litellm_params:
      model: anthropic/claude-sonnet-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
      timeout: 30
  - model_name: smart-backup
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      timeout: 30

router_settings:
  num_retries: 2
  timeout: 30
  fallbacks: [{"smart": ["smart-backup"]}]
  context_window_fallbacks: [{"smart": ["smart-backup"]}]

litellm_settings:
  cache: true
  cache_params:
    type: redis
    host: os.environ/REDIS_HOST
    port: os.environ/REDIS_PORT
    ttl: 600
```

## Budget & rate limits

```yaml
litellm_settings:
  max_budget: 100         # $ hard cap across the proxy; aborts over-budget requests
  budget_duration: 30d
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Per-key / per-tenant budgets are set on virtual keys (`/key/generate` with `max_budget` and `tpm_limit`/`rpm_limit`). Budgets that ABORT are the point — a logged-only budget does not stop a runaway loop.

## Cost callback

```python
import litellm

def track(kwargs, response, start, end):
    cost = kwargs.get("response_cost")
    # emit per-step: model, tokens, cost, latency, cache_hit, fallback used
    log.info("llm_call", model=kwargs["model"], cost=cost,
             latency_ms=(end - start).total_seconds() * 1000)

litellm.success_callback = [track]
```

The cost/latency numbers belong in your observability backbone; attribution dashboards belong to the cost-tracking skill, not here.
