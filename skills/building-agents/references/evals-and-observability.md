# Evals, tracing & cost control — the production line

An LLM feature without an eval gate is a demo. This file ships a runnable, provider-
agnostic eval harness (the one `scripts/verify.sh` dry-runs), an LLM-as-judge that is
itself model-agnostic, OTel GenAI tracing, and a closed-loop cost controller: caching,
batching, routing/cascades, and hard budgets. Python 3.12+, Pydantic v2.

## Eval-first

Define success criteria **before** building. Two complementary suites:

- **Capability evals** — can the agent do the new thing at all? Built once, when you add
  a feature.
- **Regression evals** — does a prompt/model/code change break what already worked? Run
  on every PR against a stored baseline.

Both reduce to: a golden set, graders, metrics, and a threshold that gates merge.

## Golden sets

JSONL, one case per line, versioned as fixtures next to the code:

```json
{"input": "Refund order ord_8123 for 500 cents, defective", "expected": {"tool": "refund", "order_id": "ord_8123"}, "metadata": {"suite": "capability", "tags": ["refund"]}}
```

```python
import json
from pathlib import Path

from pydantic import BaseModel


class Case(BaseModel):
    input: str
    expected: dict
    metadata: dict = {}


def load_golden(path: str | Path) -> list[Case]:
    return [Case.model_validate_json(line) for line in Path(path).read_text().splitlines() if line.strip()]
```

Build the golden set from **real traffic** (sampled, labeled), not invented prompts; keep
a strict train/eval split so prompts can't be tuned against the eval set (a form of
leakage). Version it: a golden set is a first-class artifact, reviewed like code.

## Graders

Three grader kinds, one interface. The LLM-as-judge uses the same `LLMProvider`, so the
judge is provider-agnostic and can run on a *different* model than the candidate.

```python
from typing import Protocol

from provider_abstraction import CompletionRequest, LLMProvider, Message
from provider_abstraction import complete_structured


class Grader(Protocol):
    name: str
    def grade(self, case: Case, output: str) -> float: ...   # 0.0–1.0


class ExactGrader:
    name = "exact"
    def grade(self, case: Case, output: str) -> float:
        return float(output.strip() == str(case.expected.get("text", "")).strip())


class SchemaGrader:
    name = "schema"
    def __init__(self, schema: type[BaseModel]) -> None:
        self.schema = schema
    def grade(self, case: Case, output: str) -> float:
        try:
            self.schema.model_validate_json(output)
            return 1.0
        except Exception:
            return 0.0


class Verdict(BaseModel):
    score: float          # 0.0–1.0
    reasoning: str


class JudgeGrader:
    name = "judge"
    RUBRIC = ("Score 0.0–1.0 how well the ANSWER satisfies the CRITERIA. "
              "Be strict; reward only grounded, complete, correct answers. Return JSON.")

    def __init__(self, judge: LLMProvider, judge_model: str) -> None:
        self.judge, self.model = judge, judge_model

    async def grade(self, case: Case, output: str) -> float:
        v = await complete_structured(self.judge, CompletionRequest(model=self.model, messages=[
            Message(role="system", content=self.RUBRIC),
            Message(role="user", content=f"CRITERIA:\n{case.expected}\n\nANSWER:\n{output}")]), Verdict)
        return v.score
```

Judge hygiene: use a **different model** for judge vs candidate to avoid self-preference
bias; prefer **pairwise** (A-vs-B) when comparing two systems and **pointwise** (score one)
for absolute gates; randomize A/B order to cancel position bias; and **calibrate** the
judge against ~50 human labels before trusting it in a gate (target judge-human agreement
> 0.8).

## Metrics

```python
def accuracy(scores: list[float]) -> float:
    return sum(s >= 0.5 for s in scores) / len(scores)


def pass_at_k(successes_per_case: list[int], k: int) -> float:
    # pass@k = fraction of cases with >=1 success in k attempts.
    return sum(s >= 1 for s in successes_per_case) / len(successes_per_case)


def pass_caret_k(all_success_per_case: list[bool]) -> float:
    # pass^k = fraction of cases where ALL k attempts succeeded (stability).
    return sum(all_success_per_case) / len(all_success_per_case)


def percentile(values: list[float], p: float) -> float:
    s = sorted(values)
    idx = min(len(s) - 1, int(round((p / 100) * (len(s) - 1))))
    return s[idx]
```

Track at minimum: `accuracy`, `pass@1`/`pass@3`, `faithfulness` (judge/citation grader),
answer relevance, `cost_per_task`, `p50`/`p95` latency, and `tool_call_validity_rate`
(fraction of tool calls that pass schema validation). Recommended gates: capability
`pass@3 ≥ 0.90`; regression `pass^3 = 1.0` on release-critical paths.

## Eval runner

The full async runner. It supports a **dry-run** mode (`EVAL_DRY_RUN=1` or `--dry-run`)
that uses a stub provider and never hits live APIs — this is exactly what `verify.sh`
invokes as a smoke test.

```python
# evals/run.py
import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from pathlib import Path

from provider_abstraction import (CompletionRequest, CompletionResponse, LLMProvider,
                                   Message, Usage, get_provider)


class StubProvider:
    """Deterministic offline provider for dry-runs — no network, no keys."""
    async def complete(self, req: CompletionRequest) -> CompletionResponse:
        return CompletionResponse(text='{"ok": true}', usage=Usage(input_tokens=10, output_tokens=5))
    async def stream(self, req):  # pragma: no cover - unused in dry-run
        yield
    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [[0.0] * 1536 for _ in texts]


async def run(golden_path: str, dry_run: bool) -> int:
    cases = [json.loads(line) for line in Path(golden_path).read_text().splitlines() if line.strip()]
    provider: LLMProvider = StubProvider() if dry_run else get_provider(os.environ["LLM"])
    model = "stub" if dry_run else os.environ["LLM"].split(":", 1)[1]
    rows = []
    for c in cases:
        t0 = time.perf_counter()
        resp = await provider.complete(CompletionRequest(model=model,
            messages=[Message(role="user", content=c["input"])]))
        ok = SchemaGrader(_AnyJSON).grade(_Case(c), resp.text)
        rows.append({"score": ok, "cost": resp.usage.cost_usd, "ms": (time.perf_counter() - t0) * 1000})

    n = len(rows) or 1
    metrics = {
        "accuracy": sum(r["score"] for r in rows) / n,
        "cost_per_task": sum(r["cost"] for r in rows) / n,
        "p95_latency_ms": statistics.quantiles([r["ms"] for r in rows], n=20)[-1] if len(rows) > 1 else rows[0]["ms"],
    }
    thresholds = {"accuracy": 0.0 if dry_run else 0.9}   # dry-run only checks the pipeline runs
    Path("eval-report.json").write_text(json.dumps(metrics, indent=2))
    failed = {k: metrics[k] for k, lo in thresholds.items() if metrics[k] < lo}
    print(json.dumps({"metrics": metrics, "failed": failed, "dry_run": dry_run}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", default="evals/golden.jsonl")
    ap.add_argument("--dry-run", action="store_true", default=os.environ.get("EVAL_DRY_RUN") == "1")
    args = ap.parse_args()
    sys.exit(asyncio.run(run(args.golden, args.dry_run)))
```

```python
# tiny shims referenced above so the file is self-contained
from pydantic import BaseModel


class _AnyJSON(BaseModel):
    model_config = {"extra": "allow"}


class _Case:
    def __init__(self, d: dict) -> None:
        self.input, self.expected, self.metadata = d["input"], d.get("expected", {}), d.get("metadata", {})
```

## Regression gates in CI

Run the suite on every PR; fail if any metric regresses past tolerance versus a stored
baseline. GitHub Actions:

```yaml
name: eval-gate
on: pull_request
jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -e . pydantic openai anthropic
      - name: Run evals
        env:
          LLM: ${{ vars.LLM }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: python evals/run.py --golden evals/golden.jsonl
      - name: Compare against baseline
        run: python evals/compare.py eval-report.json evals/baseline.json --tolerance 0.02
```

```python
# evals/compare.py — fail if any metric regresses more than tolerance vs baseline.
import json
import sys

current, baseline, _, tol = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
cur = json.load(open(current))
base = json.load(open(baseline))
regressions = {k: (base[k], cur[k]) for k in ("accuracy",)
               if k in base and cur.get(k, 0) < base[k] - tol}
if regressions:
    print(f"REGRESSION: {regressions}")
    sys.exit(1)
print("no regressions")
```

Guard against flaky graders: run judge grades `n=3` and require majority; never put a
grader with judge-human agreement below your threshold into a release gate.

## Tracing (OTel GenAI)

Emit OpenTelemetry **GenAI semantic-convention** spans (`gen_ai.*`). Dashboards
(Langfuse / Phoenix / Braintrust) are swappable OTLP backends — you emit spans, you swap
the exporter.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))  # OTEL_EXPORTER_OTLP_ENDPOINT
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("agent")


async def traced_complete(p: LLMProvider, system: str, req: CompletionRequest) -> CompletionResponse:
    with tracer.start_as_current_span("chat") as span:
        span.set_attribute("gen_ai.system", system)               # "openai" | "anthropic" | ...
        span.set_attribute("gen_ai.request.model", req.model)
        if req.temperature is not None:  # unset on current Claude models
            span.set_attribute("gen_ai.request.temperature", req.temperature)
        resp = await p.complete(req)
        span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input_tokens)
        span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output_tokens)
        span.set_attribute("gen_ai.usage.cost_usd", resp.usage.cost_usd)
        return resp
```

Wrap each tool call and each agent step in its own child span; the agent loop's `run_id`
becomes the trace id, so a whole run is one tree. **Redact PII before it lands in a span**
(spans persist to a backend) — never trace raw user content unfiltered.

## Cost & latency control

### Caching

Provider prompt caching (Anthropic `cache_control`, OpenAI/Gemini automatic cached input)
is abstracted behind the adapter (`cache_system` flag). On top of that, an **app-level
semantic cache** returns a prior answer when a new request is near-identical:

```python
import hashlib


class SemanticCache:
    def __init__(self, provider: LLMProvider, retriever, threshold: float = 0.95) -> None:
        self.provider, self.retriever, self.threshold = provider, retriever, threshold

    async def get_or_compute(self, prompt: str, compute) -> tuple[str, bool]:
        [vec] = await self.provider.embed([prompt])
        hits = await self.retriever.search(vec, k=1, flt={"kind": "cache"})
        if hits and hits[0].get("sim", 0) >= self.threshold:
            return hits[0]["content"], True                       # cache hit
        answer = await compute()
        await self.retriever.upsert(prompt, vec, answer, meta={"kind": "cache"})
        return answer, False
```

### Batching

For offline workloads (backfills, nightly evals, bulk classification), use provider batch
APIs (≈ −50% cost class) instead of synchronous calls. Submit a JSONL of requests, poll,
collect — latency is hours, not seconds, which is fine offline.

### Model routing / cascades

Classify the task, send it to the **cheapest model that passes the eval for that task
class**, and escalate only on a failed self-check — never default to the flagship.

```python
async def route_and_run(task: str, classify, providers: dict[str, tuple[LLMProvider, str]]) -> str:
    tier = await classify(task)                          # "cheap" | "default" | "smart"
    order = {"cheap": ["cheap", "default", "smart"],
             "default": ["default", "smart"],
             "smart": ["smart"]}[tier]
    for name in order:
        provider, model = providers[name]
        resp = await provider.complete(CompletionRequest(model=model,
            messages=[Message(role="user", content=task)]))
        if await _self_check(provider, model, task, resp.text):    # escalate only on failure
            return resp.text
    return resp.text                                     # smart tier is terminal


async def _self_check(provider, model, task: str, answer: str) -> bool:
    v = await complete_structured(provider, CompletionRequest(model=model, messages=[
        Message(role="user", content=f"Does this answer fully and correctly address the task? "
                                      f"TASK: {task}\nANSWER: {answer}")]), Verdict)
    return v.score >= 0.8
```

### Budgets

An immutable per-tenant cost tracker with a hard stop. Frozen dataclass = auditable, never
silently mutated.

```python
from dataclasses import dataclass, field


class BudgetExceededError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class CostRecord:
    tenant: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


@dataclass(frozen=True, slots=True)
class CostTracker:
    budgets_usd: dict[str, float] = field(default_factory=dict)   # per-tenant cap
    records: tuple[CostRecord, ...] = ()

    def add(self, r: CostRecord) -> "CostTracker":
        spent = self.spent(r.tenant) + r.cost_usd
        cap = self.budgets_usd.get(r.tenant, float("inf"))
        if spent > cap:
            raise BudgetExceededError(f"{r.tenant}: ${spent:.4f} exceeds ${cap:.2f}")
        return CostTracker(budgets_usd=self.budgets_usd, records=(*self.records, r))

    def spent(self, tenant: str) -> float:
        return sum(rec.cost_usd for rec in self.records if rec.tenant == tenant)
```

Compute `cost_usd` from the dated pricing table — never hardcode a price in business logic.

| Model (provider:id) | $/MTok in | $/MTok out | Notes |
|---|---|---|---|
| anthropic:claude-haiku-5-5 | 0.10 | 0.50 | cheap/fast; prompts >100K tokens bill 0.50 / 2.50 |
| anthropic:claude-sonnet-5-5 | 2.00 | 10.00 | default; cache reads 0.10; 1M context |
| anthropic:claude-opus-5-5 | 4.00 | 20.00 | flagship Opus; cache reads 0.20; 1M context |
| openai:gpt-5.5 | 5.00 | 30.00 | flagship; >272K prompt billed 2× in / 1.5× out |
| openai:gpt-5.4 | 2.50 | 15.00 | cached input −90% |
| openai:gpt-5.2-codex | 1.75 | 14.00 | code-tuned |
| gemini:gemini-3.5-flash | 1.50 | 9.00 | cached 0.15; 1M context |
| gemini:gemini-3.1-pro | — | — | paid-only since 2026-04-01 |

Anthropic rows checked against the official price table in 2026-11; the others are **as of
2026-06**. Verify before quoting. Load them from config and refresh
the table before trusting any number.

## Anti-patterns

- **Overfitting prompts to the eval set** — you measure memorization, not capability.
  Hold out a fresh split.
- **Happy-path-only evals** — include adversarial, empty, and malformed inputs.
- **Chasing accuracy while cost/latency drift** — gate on `cost_per_task` and `p95`, not
  just accuracy.
- **Flaky graders in release gates** — calibrate and majority-vote, or keep them advisory.
- **Tracing PII without redaction** — spans persist; redact before emit.

## See also

- `provider-abstraction.md` — the `LLMProvider` the runner, judge, and router all use.
- `agent-loops-and-harness.md` — budgets and `AgentState` the `CostTracker` complements.
