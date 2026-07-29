---
name: observability
description: "Use when instrumenting a service from the inside so an incident can be explained from telemetry alone — wiring OpenTelemetry logs, metrics and traces, standing up a Collector, exporting via OTLP, and defining telemetry-driven alerts. NOT outside-in uptime probes, on-call rotation, or who-gets-paged (that is `monitoring`)."
tags: [observability, opentelemetry, tracing, metrics, structured-logging]
recommends: [monitoring, error-handling, performance, cost-tracking, docker]
origin: risco
---

# Observability

You are wiring the *inside* view of a service: when something breaks at 3am, an engineer must be able to answer "what happened, where, and why" from telemetry alone — without adding a `console.log` and redeploying into the fire. This skill emits a concrete artifact: SDK init code, instrumentation (spans/metrics/structured logs), a Collector config, and alert rules that the instrumentation makes possible. The outside-in half — is it up, who gets paged — is `../monitoring/SKILL.md`.

## The one rule

**Every signal carries the same correlation identity: `trace_id`, `service.name`, `deployment.environment`.** A log line you cannot pivot to its trace, or a spiking metric you cannot pivot to an exemplar span, doubles your mean-time-to-resolution — you are back to grepping. Three signals that don't share keys are three disconnected tools; three that do are one queryable system. Set the resource once at SDK init, inject `trace_id`/`span_id` into every log, and never emit a metric you can't tie back to a service and environment.

## The three pillars — when each earns its place

Don't emit all three of everything. Each signal answers a different question at a different cost.

| Signal | Answers | Cost | Alert on it? | Main gotcha |
|---|---|---|---|---|
| **Logs** | "what exactly happened in this one event" | high per-event, cheap to skip | rarely (noisy) | high-cardinality fields belong in the *body*, not in stream labels |
| **Metrics** | "what's the rate/aggregate over time" | cheap, pre-aggregated | yes — this is your alert source | cardinality explosion if a label is unbounded |
| **Traces** | "what was the causal path across hops, and where did time go" | medium; sample it | indirectly (via derived RED metrics) | one giant span = no causality; sample or you pay for noise |

The "fourth pillar," **continuous profiling** (CPU/heap flame graphs over time), is now a first-class OTel signal — reach for it only when traces say "the time is inside *this* function" and you need to know which line.

## Architecture

Instrument once, route anywhere. The app talks OTLP to a Collector; the Collector fans the firehose out to backends.

```text
  ┌─────────────┐   OTLP/gRPC :4317        ┌───────────────────────────┐
  │  app + SDK  │   OTLP/HTTP :4318  ───▶   │       OTel Collector       │
  │ (resource:  │   /v1/traces             │  receivers → processors    │
  │ service.name│   /v1/metrics            │  → exporters (per signal)  │
  │  +env+ver)  │   /v1/logs               │  wired in service.pipelines│
  └─────────────┘                          └───────────────────────────┘
                                                 │        │        │
                                            logs │ traces │ metrics│
                                                 ▼        ▼        ▼
                                              Loki     Tempo   Mimir/Prom   (+ Grafana to view)
                                                  └── or a single vendor: Datadog / Honeycomb ──┘
```

OTLP is the wire format: **gRPC on 4317** (TLS + gzip by default), **HTTP on 4318** with per-signal paths `/v1/traces`, `/v1/metrics`, `/v1/logs`. Always export to a Collector, never straight to the vendor. Why: the Collector gives you one place to **batch** (fewer round-trips), **retry** (survive a backend blip), **redact** PII, and **swap or add a backend without redeploying the app**. App SDKs should be dumb pipes; policy lives in the Collector.

## Instrument in the right order: auto first, manual second

**Never hand-roll a span for something auto-instrumentation already covers** (HTTP servers, DB clients, queues). You will miss edges and waste effort. Turn on zero-code instrumentation, confirm traces flow, *then* add manual spans only where your business logic lives.

```bash
# Node — zero-code, no app changes. SDK is 2.0+; the register hook is compatible.
npm i @opentelemetry/api @opentelemetry/auto-instrumentations-node
OTEL_SERVICE_NAME=checkout-api \
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=prod,service.version=1.4.2 \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
node --require '@opentelemetry/auto-instrumentations-node/register' app.js
```

```bash
# Python — zero-code via the launcher; it patches known libraries on import.
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install
OTEL_SERVICE_NAME=checkout-api \
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=prod,service.version=1.4.2 \
opentelemetry-instrument python app.py
```

Then add a manual span only around a meaningful business operation — and give it attributes and a status, or it tells you nothing:

```javascript
// Bad — a span with no attributes and no status. You learn that "something ran."
const span = tracer.startSpan('work');
await chargeCard(order);
span.end();
```

```javascript
// Good — named for the business op, carries the inputs you'd filter by, records outcome.
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('checkout');
await tracer.startActiveSpan('charge_card', async (span) => {
  span.setAttribute('order.id', order.id);          // searchable dimension
  span.setAttribute('payment.provider', 'stripe');
  try {
    await chargeCard(order);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    span.recordException(err);                        // attaches the stack as an event
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw err;
  } finally {
    span.end();                                       // a span you never end leaks forever
  }
});
```

Per-stack init (Node SDK 2.0 manual setup, Go SDK, context propagation across HTTP/queue hops, the GenAI span template) lives in `references/instrumentation-recipes.md`.

## Resource and semantic conventions

**Use the standard attribute names; never invent bespoke keys.** The whole correlation story and every prebuilt backend dashboard assume `http.*`, `db.*`, `gen_ai.*`, `service.*`. A homegrown `mycompany.endpoint` attribute is invisible to every tool that expects `http.route`.

- Set on the resource, once: `service.name` (required — unset means telemetry lands as `unknown_service`), `service.version`, `deployment.environment`.
- Kubernetes attributes (`k8s.*`) reached release candidate (2026-03); DB conventions are on their 2nd RC. Prefer the standard names even while an area is still stabilizing.
- For LLM calls, **GenAI conventions exited experimental for client spans (early 2026)** — use `gen_ai.*` so the same span feeds your spend view:

```javascript
// LLM call as a span: model + token attrs. These attributes feed ../cost-tracking/SKILL.md.
await tracer.startActiveSpan('chat gpt-4o', async (span) => {
  span.setAttribute('gen_ai.system', 'openai');
  span.setAttribute('gen_ai.request.model', 'gpt-4o');
  const res = await openai.chat.completions.create({ /* ... */ });
  span.setAttribute('gen_ai.usage.input_tokens', res.usage.prompt_tokens);
  span.setAttribute('gen_ai.usage.output_tokens', res.usage.completion_tokens);
  span.end();
});
```

This skill emits the *signal* (token attributes on a span). Turning those tokens into a dollar figure and a budget is `../cost-tracking/SKILL.md`.

## Structured, correlated logs

**Logs are JSON, carry the trace context, and never carry PII.** Free-text `print` lines cost you twice: you can't query them, and you can't jump from the log to its trace.

```python
# Bad — unstructured, unsearchable, unlinkable to a trace.
print("charged user " + email + " amount " + str(amount))
```

```python
# Good — structured, leveled, correlated, no PII (id not email).
import logging, json
from opentelemetry import trace

def log_charge(order_id, amount):
    ctx = trace.get_current_span().get_span_context()
    logging.info(json.dumps({
        "event": "charge.succeeded",
        "level": "info",
        "order_id": order_id,            # an opaque id, not the customer's email
        "amount_cents": amount,
        "trace_id": format(ctx.trace_id, "032x"),  # ← the pivot back to the trace
        "span_id": format(ctx.span_id, "016x"),
    }))
```

Level discipline: `error` = a human should look, `warn` = degraded but handled, `info` = business milestones, `debug` = off in prod. If everything is `error`, nothing is.

## Metrics that earn an alert

**RED for request-driven services, USE for finite resources.** Alerts come from metrics — logs and traces are for *investigating* the alert, not firing it.

- **RED** (per service/endpoint): **R**ate (requests/s), **E**rrors (failed/s), **D**uration (latency as a *histogram*, so you can read p50/p95/p99 — never a single average, which hides the tail).
- **USE** (per resource — CPU, pool, disk): **U**tilization, **S**aturation (queue depth / waiting), **E**rrors.

**The cardinality rule — this is the #1 way an observability stack falls over.** A metric's total series count is the product of its label cardinalities. Put an unbounded value on a label and you create a near-infinite series count; the time-series database (Prometheus/Mimir) is most often restarted because of exactly this. Loki indexes *labels only, not log contents* — so the same rule binds its stream labels.

```text
# Bad — user_id is unbounded; 5M users = 5M series per metric. OOMs the TSDB.
http_requests_total{route="/checkout", user_id="u_8f3a...", status="200"}
```

```text
# Good — only bounded, low-cardinality dimensions on the metric.
http_requests_total{route="/checkout", method="POST", status="200"}
# Need to slice by user? That's a trace attribute or a log field, never a metric label.
```

## The Collector config

A minimal valid pipeline. An exporter is **inert until it appears in a pipeline** — defining one under `exporters:` does nothing on its own.

```yaml
# otel-collector.yaml — Collector v0.153.0 shape
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }

processors:
  memory_limiter:                 # first line of defense: shed load before OOM
    check_interval: 1s
    limit_percentage: 80
  batch: {}                       # batch before export — fewer, bigger round-trips
  redaction:                      # strip PII before it leaves your network
    allow_all_keys: true
    blocked_values: ["[0-9]{13,16}", "\\b[\\w.]+@[\\w.]+\\b"]  # PANs, emails

exporters:
  otlphttp/traces:  { endpoint: http://tempo:4318 }
  otlphttp/logs:    { endpoint: http://loki:3100/otlp }
  otlphttp/metrics: { endpoint: http://mimir:9009/otlp }

service:
  pipelines:
    traces:  { receivers: [otlp], processors: [memory_limiter, redaction, batch], exporters: [otlphttp/traces] }
    logs:    { receivers: [otlp], processors: [memory_limiter, redaction, batch], exporters: [otlphttp/logs] }
    metrics: { receivers: [otlp], processors: [memory_limiter, batch],            exporters: [otlphttp/metrics] }
```

Tail sampling, gateway-vs-agent topology, multi-backend fan-out (LGTM **and** a vendor in parallel), and `resourcedetection` live in `references/collector-config.md`. Shipping the Collector as a container or in CI is `../docker/SKILL.md`.

## Alerts the telemetry now enables

The instrumentation above makes these *possible* — defining them is your job; routing the page to a human is `../monitoring/SKILL.md`.

- **SLO burn-rate (multi-window)** — alert when you're spending the error budget too fast, using a fast window (e.g. 5m) AND a slow window (e.g. 1h) so a brief blip doesn't page but a sustained burn does. This fires on *impact*, not on traffic.
- **Latency SLO** — p99 of the duration histogram over budget for a sustained window.
- **Saturation** — the USE "S": queue depth / pool waiters climbing, the leading indicator before errors appear.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Unbounded label (`user_id`, `request_id`, `email`) on a metric or Loki stream | Cardinality explosion → TSDB OOM/restart, cost blowup | Keep labels low-cardinality; put the high-cardinality field on a span attribute or log body |
| Logging PII / secrets (email, card, token) | Compliance breach + the leak is now in every log backend | Log opaque ids; redact in the Collector before export |
| 100% trace sampling in prod, no policy | Pay to store noise; backend throttles and drops the traces you needed | Head/tail sampling — keep all errors + slow traces, sample the rest |
| App exports straight to the vendor, no Collector | Can't batch, retry, redact, or swap backends without a redeploy | Always route through a Collector |
| Instrument everything before deciding the question | Noise with no signal; nobody opens the dashboard | Start from "what would I ask during an incident," instrument that path |
| Alert on a raw error *count* | Fires on traffic spikes, silent during a low-traffic outage | Alert on error *rate* / SLO burn |
| One giant span per request (or a thousand contentless ones) | No causality, or context with no detail — both useless | Span per meaningful operation, each with attributes + status |

## Verify

Run `scripts/verify.sh` against the directory holding your Collector config + SDK init. It checks the config is valid, that every defined exporter is actually wired into a pipeline (the classic "defined but unused" footgun), that `service.name` is set, and warns on high-cardinality metric labels. It is read-only and exits 0 when there's nothing to check.
