# ASP.NET Core 10 — full catalog

The body has the decision and the canonical shape; this is the depth.

## Minimal APIs vs controllers

| Pick minimal APIs when | Pick controllers when |
|---|---|
| New service, REST/JSON endpoints, route groups suffice | You need view rendering (MVC/Razor) |
| You want the least ceremony and AOT-friendliness | You rely on the full filter pipeline, conventions, or `ApiController` model-binding niceties at scale |
| Endpoints map cleanly to delegates | Large teams already standardized on controllers |

They coexist in one app. Default to minimal for new code; state the reason if you choose controllers.

## Route groups + endpoint filters

```csharp
var products = app.MapGroup("/products")
    .WithTags("Products")
    .RequireAuthorization()                 // applies to the whole group
    .AddEndpointFilter<ValidationFilter>(); // cross-cutting check per request

products.MapGet("/{id:int}", GetById);
products.MapPost("/", Create);
```

An endpoint filter runs around the handler — use it for validation, logging, or shaping results without repeating code per endpoint.

```csharp
public sealed class ValidationFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        // inspect ctx.Arguments, short-circuit with Results.ValidationProblem(...) if invalid
        return await next(ctx);
    }
}
```

## Validation (.NET 10)

In .NET 10, DataAnnotations on minimal API parameters — query, header, and body, **including records** — are validated automatically; a failure produces a ProblemDetails 400 without manual code. Annotate the DTO and you are done for simple cases; use an endpoint filter or FluentValidation for cross-field rules.

```csharp
public record CreateProduct(
    [property: Required, MaxLength(120)] string Name,
    [property: Range(0.0, 1_000_000.0)] decimal Price);
```

## ProblemDetails (RFC 9457)

`AddProblemDetails()` + `UseExceptionHandler()` turn unhandled exceptions and status-code responses into a consistent machine-readable error body. Never return raw exception text to clients. Use `Results.Problem(...)` / `Results.ValidationProblem(...)` for explicit error shaping.

## OpenAPI 3.1

`Microsoft.AspNetCore.OpenAPI` generates an **OpenAPI 3.1** document (JSON Schema draft 2020-12) at build/runtime:

```csharp
builder.Services.AddOpenApi();
app.MapOpenApi();               // serves /openapi/v1.json
```

Annotate with `.WithTags(...)`, `.WithName(...)`, `.Produces<T>(...)`, `.WithSummary(...)` for a richer document. Pair with a UI (Scalar, Swagger UI) only in non-prod by default.

## Middleware ordering

Order matters — each component sees the request on the way in and the response on the way out. A workable baseline:

```text
UseExceptionHandler  ->  HSTS / HttpsRedirection  ->  static assets
  ->  routing  ->  CORS  ->  Authentication  ->  Authorization  ->  endpoints
```

Authentication must precede Authorization. Exception handling goes first so it wraps everything below it.

## DI lifetimes

| Lifetime | Instances | Use for |
|---|---|---|
| `Singleton` | one per app | stateless services, caches, `IHttpClientFactory` |
| `Scoped` | one per request | `DbContext`, per-request state |
| `Transient` | one per resolve | lightweight stateless helpers |

**Captive dependency**: injecting a `Scoped` (or `Transient` holding scoped state) into a `Singleton` captures it for the app lifetime — a reused `DbContext` across requests corrupts change tracking. Inject `IServiceScopeFactory` and create a scope per unit of work instead, or make the consumer scoped. The DI container's scope validation catches many of these at startup in development.

## Configuration / options pattern

Bind config sections to typed options instead of reading magic strings:

```csharp
builder.Services.Configure<ShopOptions>(builder.Configuration.GetSection("Shop"));
// inject IOptions<ShopOptions> (singleton snapshot) or IOptionsSnapshot<ShopOptions> (per-request reload)
```

Use `IOptionsSnapshot<T>` in scoped services when values can change at runtime; `IOptions<T>` otherwise.

## Auth defaults

ASP.NET Core 10 is secure-by-default. Still: configure authentication then authorization in the right middleware order, prefer policy-based authorization (`RequireAuthorization("policy")`) over scattered role checks, enforce HTTPS redirection + HSTS in production, and keep token/cookie protection on the Data Protection key ring (persisted and shared across instances). Threat modeling beyond these knobs is `security-audit`.
