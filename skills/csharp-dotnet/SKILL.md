---
name: csharp-dotnet
description: "Use when writing, reviewing, testing, or shipping C# / .NET code — ASP.NET Core APIs (minimal APIs vs controllers), EF Core data access, async correctness, solution layout in .cs/.csproj/.sln. NOT a Java/Spring backend (that is spring-boot), NOT a Node/TypeScript backend (that is nestjs), NOT framework-neutral REST naming (that is api-design)."
tags: [csharp, dotnet, aspnetcore, efcore, async]
recommends: [postgresdb, secure-coding, deployment]
origin: risco
---

# Modern C# and .NET services

You write and review C#, ASP.NET Core APIs, and EF Core data access. You own the
.NET idioms, the HTTP-contract patterns *as expressed in .NET*, async correctness,
and the .NET-specific quality/security gates. You delegate everything language-
agnostic to the right sibling.

**Target: .NET 10 (LTS, released 2025-11-11, supported 3 years) with C# 14, EF Core
10, ASP.NET Core 10.** .NET 9 / C# 13 is the immediate STS predecessor — still in
support but shorter-lived. Features gate on the target framework moniker (TFM): a
`net10.0` project gets C# 14 by default; a `net9.0` project caps at C# 13. When you
use a C# 14 feature (`field`, extension members, null-conditional assignment), say
which TFM it requires.

## When NOT to use — delegate

| Situation | Route to |
|---|---|
| Java / Spring Boot backend | `spring-boot` |
| Node / NestJS TypeScript backend | `nestjs` |
| Language-agnostic threat modeling, OWASP authz/abuse review | `../secure-coding/SKILL.md` |
| Raw Postgres schema/index/query tuning | `../postgresdb/SKILL.md` |
| Framework-neutral REST resource taxonomy | `api-design` |
| Dockerfile / CI pipeline / deploy target | `../deployment/SKILL.md` |
| Recording per-project conventions in the workspace wiki | `../harness/SKILL.md` |

The .NET *expression* of an API contract and async correctness live HERE. Resource
naming theory lives in `api-design`; the JVM and Node counterparts are `spring-boot`
and `nestjs`.

## Project & solution layout + dotnet CLI

```bash
dotnet new sln -n Shop                         # solution
dotnet new webapi -n Shop.Api                  # minimal API (default in .NET 10)
dotnet new webapi -n Shop.Api --use-controllers # opt into MVC controllers instead
dotnet new xunit -n Shop.Api.Tests             # test project
dotnet sln add Shop.Api Shop.Api.Tests         # wire into the solution
dotnet add Shop.Api package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet ef migrations add Initial -p Shop.Api   # create a migration
dotnet ef database update -p Shop.Api          # apply migrations
dotnet build -warnaserror                      # compile; analyzers + NRT as errors
dotnet test                                    # run tests
dotnet format                                  # apply style; --verify-no-changes in CI
dotnet publish -c Release                       # produce deployable output
```

Recommended shape:

```text
Shop.sln
Directory.Packages.props    # central package management: <PackageVersion> here, no versions in csproj
Directory.Build.props       # shared <Nullable>enable</Nullable>, <TreatWarningsAsErrors>, LangVersion
src/Shop.Api/               # endpoints grouped by feature module (Products/, Orders/)
src/Shop.Domain/            # entities, value objects (no EF/ASP.NET dependency)
tests/Shop.Api.Tests/
```

Central package management: turn it on with `<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>`
and list versions once in `Directory.Packages.props`. Why: one source of truth, no
version drift across projects.

NRT on for every project — `<Nullable>enable</Nullable>` in `Directory.Build.props`.
Why: the compiler turns whole classes of `NullReferenceException` into build-time
warnings. Never disable it to silence a warning — fix the nullability.

## Modern C# idioms (C# 14 / .NET 10)

DTO as a record, not a class:

```csharp
// Bad: mutable class, no value equality, hand-written boilerplate
public class ProductDto { public int Id { get; set; } public string Name { get; set; } }

// Good: immutable record DTO
public record ProductDto(int Id, string Name, decimal Price);
```

Why: value equality, `with` expressions, no boilerplate — and never reuse an EF entity
as the wire DTO (see anti-patterns).

Pattern matching over if-chains:

```csharp
// Bad
if (shape is Circle) { var c = (Circle)shape; return Math.PI * c.R * c.R; }

// Good
return shape switch
{
    Circle c      => Math.PI * c.R * c.R,
    Rectangle r   => r.W * r.H,
    _             => throw new ArgumentOutOfRangeException(nameof(shape)),
};
```

`field` keyword — field-backed property without a hand-written backing field
(**requires C# 14 / net10.0**):

```csharp
// Bad: explicit backing field just to trim a string
private string _name = "";
public string Name { get => _name; set => _name = value.Trim(); }

// Good (C# 14)
public string Name { get; set => field = value.Trim(); }
```

Primary constructors, `required`/`init`, collection expressions:

```csharp
public class OrderService(IOrderRepository repo, ILogger<OrderService> log)  // primary ctor: DI in one line
{
    public required string Region { get; init; }                            // must be set at construction, then immutable
    private static readonly int[] DefaultTiers = [1, 2, 3];                  // collection expression
}
```

Prefer NRT annotations over defensive null checks: declare `string? note` when null is
valid and let the compiler force callers to handle it, instead of `if (x == null)`
guards scattered everywhere.

Dispose deterministically: `using` / `await using` (or `using` declarations) for
anything `IDisposable`/`IAsyncDisposable`. Why: leaked connections and handles.

## async/await correctness

This is the highest-leverage area to get right. Core rules in body; the full catalog
(ConfigureAwait, ValueTask, IAsyncEnumerable, Channels, parallelism, deadlock cases)
is in **references/async.md** — read it before any non-trivial async review.

- **No `async void`** except top-level event handlers. Why: exceptions escape onto the
  thread pool and crash the process; the caller cannot `await` or catch it. Use `async Task`.
- **Never `.Result` / `.Wait()` / `GetAwaiter().GetResult()` on the request path.** This
  is the classic deadlock and the answer to "my endpoint hangs under load":

```csharp
// Bad: blocks the thread on an async call -> thread-pool starvation / deadlock under load
public IActionResult Get() => Ok(_svc.LoadAsync().Result);

// Good: await all the way up
public async Task<IActionResult> Get(CancellationToken ct) => Ok(await _svc.LoadAsync(ct));
```

- **Flow `CancellationToken`** from the endpoint down into every async call —
  `SaveChangesAsync`, queries, outbound HTTP. Why: a dropped token means the request
  keeps running after the client gives up.
- **`ValueTask` only for hot paths** that usually complete synchronously; default to
  `Task`. Never `await` a `ValueTask` twice.
- **`IAsyncEnumerable<T>` for streaming** results instead of materializing a huge list.

## ASP.NET Core APIs

Decision: **minimal API** for new services; **controllers** only when you need MVC
machinery (model binding conventions, action filters at scale, views). Both can coexist.
Why minimal by default: less ceremony, first-class in .NET 10.

Production minimal API shape — route group + DataAnnotations validation (built in for
minimal API parameters in .NET 10) + ProblemDetails + OpenAPI 3.1:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();                 // OpenAPI 3.1, JSON Schema 2020-12
builder.Services.AddProblemDetails();          // RFC 9457 error bodies
builder.Services.AddDbContext<ShopDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Shop")));

var app = builder.Build();
app.MapOpenApi();                              // serves the OpenAPI document
app.UseExceptionHandler();                     // emits ProblemDetails on unhandled errors

var products = app.MapGroup("/products").WithTags("Products");
products.MapGet("/{id:int}", async (int id, ShopDb db, CancellationToken ct) =>
    await db.Products.AsNoTracking()
        .Where(p => p.Id == id)
        .Select(p => new ProductDto(p.Id, p.Name, p.Price))   // project to DTO, no entity leak
        .FirstOrDefaultAsync(ct) is { } dto
        ? Results.Ok(dto)
        : Results.NotFound());
products.MapPost("/", async (CreateProduct req, ShopDb db, CancellationToken ct) =>
{   // DataAnnotations on CreateProduct are validated automatically in .NET 10
    var entity = new Product { Name = req.Name, Price = req.Price };
    db.Products.Add(entity);
    await db.SaveChangesAsync(ct);
    return Results.Created($"/products/{entity.Id}", new ProductDto(entity.Id, entity.Name, entity.Price));
});
app.Run();
```

DI lifetimes: `Singleton` (one for the app), `Scoped` (one per request — `DbContext`
lives here; it is not thread-safe, so sharing one across requests corrupts change
tracking), `Transient` (new each resolve). Never inject a `Scoped` service into a
`Singleton` (captive dependency — see anti-patterns). Middleware ordering, endpoint
filters, the options pattern, and auth defaults are in **references/aspnetcore.md**.

## EF Core 10

```csharp
// Bad: tracking + N+1 — loads orders, then one query per order's customer
var orders = await db.Orders.ToListAsync(ct);
foreach (var o in orders) { var name = o.Customer.Name; /* lazy/round-trip per row */ }

// Good: no-tracking read + single query via projection
var rows = await db.Orders.AsNoTracking()
    .Select(o => new OrderRow(o.Id, o.Customer.Name))   // EF translates to one JOIN
    .ToListAsync(ct);
```

- `AsNoTracking()` on every read-only query — skips change-tracking overhead.
- Kill N+1 with projection (`Select`) or `Include`/`ThenInclude`; use `AsSplitQuery()`
  when an `Include` cartesian explosion hurts.
- Migrations: `dotnet ef migrations add <Name>` then review the generated `Up`/`Down`
  before `database update`. Never hand-edit applied migrations.
- EF Core 10 highlights: native `json` column type, `vector` type + `VECTOR_DISTANCE()`
  for embeddings/RAG, `LeftJoin`/`RightJoin` LINQ operators, and named query filters
  (multiple filters per entity, selectively disabled).

Raw SQL only via parameterized `FromSql`/`ExecuteSql` interpolated strings (EF
parameterizes the holes). Query patterns, migration workflow, the EF Core 10 features,
and raw-SQL safety in full are in **references/efcore.md**. Schema/index tuning is
`../postgresdb/SKILL.md`.

## .NET security controls

Keep only the .NET-specific controls here; threat modeling and OWASP review go to
`../secure-coding/SKILL.md`.

- **Parameterized data access** — EF LINQ / parameterized `FromSql` / ADO.NET
  `SqlParameter`. Never concatenate user input into SQL. Why: SQL injection.
- **Secrets** — `dotnet user-secrets` in dev, Key Vault / environment in prod. Never in
  `appsettings.json` or source.
- **Antiforgery** for cookie-auth browser POSTs; **Data Protection** for cookies/tokens
  (configure a persisted key ring across instances).
- **Auth defaults** — authenticate then authorize via middleware; prefer policy-based
  authorization; ASP.NET Core 10 is secure-by-default but still verify HTTPS redirection
  and HSTS in production.

## Testing

- **xUnit** is the default. Unit-test domain logic with no framework dependency.
- **Integration tests** via `WebApplicationFactory<Program>` — boots the real pipeline
  in-memory and lets you `HttpClient` your endpoints.
- **Testcontainers** to run a real Postgres in a container for EF integration tests
  instead of the in-memory provider (which lies about relational behavior).
- Gate everything with `scripts/verify.sh` (format + build-warnaserror + test + vuln scan).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| `async void` (non-event-handler) | Exceptions crash the process; uncatchable by caller | `async Task` |
| `.Result` / `.Wait()` on request path | Deadlock / thread-pool starvation under load | `await` all the way |
| Scoped service injected into a Singleton | Captive dependency: stale/`DbContext` reused across requests | Inject `IServiceScopeFactory`, or make the consumer scoped |
| Reusing an EF entity as the wire DTO | Over-posting, serialization cycles, leaked columns | Separate `record` DTO + mapping |
| Tracking queries on read-only reads | Wasted memory/CPU on change tracking | `AsNoTracking()` |
| Lazy navigation in a loop | N+1 round-trips | Projection or `Include` |
| Missing `CancellationToken` | Work continues after client disconnects | Flow the token to all I/O |
| `catch (Exception) { }` swallow | Hides failures; corrupt state continues | Handle specifically or let `UseExceptionHandler` map it |
| `<Nullable>disable</Nullable>` to mute a warning | Re-opens the NRE class of bugs | Keep NRT on; fix the nullability |

## Project grounding

Record per-project conventions (target TFM, package manager, lint rules, deploy
target) in the workspace wiki via `../harness/SKILL.md`, not inline assumptions. Before
calling a C# change done, run `scripts/verify.sh` from the solution/project root.
