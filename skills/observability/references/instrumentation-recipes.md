# Instrumentation recipes — per stack

Stack-specific snippets offloaded from `SKILL.md`. Reach for these only after zero-code auto-instrumentation is flowing; manual code is for business logic the auto layer can't see. APIs target **OpenTelemetry JS SDK 2.0+** and current Python/Go SDKs.

## Node / JS — manual SDK init

Use this only if you need programmatic control beyond the `--require` register hook (custom processors, multiple exporters, sampler tuning). Otherwise prefer the zero-code path in `SKILL.md`.

```javascript
// instrument.js — load FIRST, before any other require (node -r ./instrument.js app.js)
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'checkout-api',
    'service.version': '1.4.2',
    'deployment.environment': 'prod',
  }),
  traceExporter: new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
process.on('SIGTERM', () => sdk.shutdown());  // flush buffered spans on shutdown
```

## Python — launcher + manual span

`opentelemetry-instrument` patches known libraries on import. Add manual spans only around your own logic.

```python
from opentelemetry import trace
tracer = trace.get_tracer("checkout")

def settle_order(order_id):
    with tracer.start_as_current_span("settle_order") as span:
        span.set_attribute("order.id", order_id)
        try:
            do_settlement(order_id)
            span.set_status(trace.StatusCode.OK)
        except Exception as err:
            span.record_exception(err)
            span.set_status(trace.StatusCode.ERROR, str(err))
            raise
```

## Go — SDK init

Go has no zero-code agent; init the provider in `main` and use `otelhttp`/`otelgrpc` middleware for transport-level spans.

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
    exp, err := otlptracehttp.New(ctx) // reads OTEL_EXPORTER_OTLP_ENDPOINT
    if err != nil { return nil, err }
    res, _ := resource.New(ctx, resource.WithAttributes(
        semconv.ServiceName("checkout-api"),
        semconv.ServiceVersion("1.4.2"),
        semconv.DeploymentEnvironment("prod"),
    ))
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exp),
        sdktrace.WithResource(res),
    )
    otel.SetTracerProvider(tp)
    return tp, nil // defer tp.Shutdown(ctx) in main
}
```

## Context propagation across boundaries

A trace only spans services if the `traceparent` (W3C Trace Context) is carried across each hop. Auto-instrumentation handles HTTP for you; you must do it by hand across **message queues**, which have no built-in carrier.

```javascript
// Producer — inject the active context into message headers.
const { propagation, context } = require('@opentelemetry/api');
const headers = {};
propagation.inject(context.active(), headers);
await queue.send({ body, headers });          // ship headers alongside the payload

// Consumer — extract it, then run work inside the parent context.
const parentCtx = propagation.extract(context.active(), msg.headers);
context.with(parentCtx, () => {
  tracer.startActiveSpan('process_message', (span) => { /* ... */ span.end(); });
});
```

Without this, the consumer starts a brand-new root trace and you lose the causal link from producer to consumer.

## GenAI / LLM span template

Use `gen_ai.*` semantic conventions (client spans exited experimental, early 2026). Span name convention is `{operation} {model}`. These token attributes are the bridge that `../cost-tracking/SKILL.md` consumes to compute spend.

```python
with tracer.start_as_current_span("chat gpt-4o") as span:
    span.set_attribute("gen_ai.provider.name", "openai")
    span.set_attribute("gen_ai.operation.name", "chat")
    span.set_attribute("gen_ai.request.model", "gpt-4o")
    span.set_attribute("gen_ai.request.temperature", 0.2)
    resp = client.chat.completions.create(model="gpt-4o", messages=msgs, temperature=0.2)
    span.set_attribute("gen_ai.response.model", resp.model)
    span.set_attribute("gen_ai.usage.input_tokens", resp.usage.prompt_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", resp.usage.completion_tokens)
```

Do not put the prompt or completion *text* on the span by default — it is high-cardinality and frequently PII. Capture it only behind an explicit, redacted, opt-in content-capture flag.
