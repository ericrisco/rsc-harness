---
name: nestjs
description: "Use when building or structuring a NestJS backend — feature modules, providers and DI wiring, provider scopes and request-lifecycle order, where to bind guards/pipes/interceptors/filters, and testing with Test.createTestingModule. NOT a bare Express/Fastify service with no DI (that is `nodejs`), NOT framework-agnostic REST design (that is `api-design`)."
tags: [nestjs, nodejs, backend, dependency-injection, guards, pipes, testing, typescript]
recommends: [nodejs, typescript, api-design, prisma-orm, testing-web]
origin: risco
---

# NestJS

Build server-side Node apps the way NestJS intends: feature modules, providers wired through the DI container, controllers, and a cross-cutting layer bound at a deliberate scope. This skill is about Nest-specific mechanics — how DI scopes resolve, what order the request lifecycle runs in, where to bind guards/pipes/interceptors/filters, and how to test it with `Test.createTestingModule`.

## Not this — route instead

- Bare Express/Fastify/`http` service, no `@Module`/`@Injectable` → `../nodejs/SKILL.md`. Nest starts the moment the DI container appears.
- REST resource modeling, versioning, status codes, idempotency (framework-agnostic) → `../api-design/SKILL.md`. Nest is where you *implement* those decisions.
- Designing the schema / writing queries / migrations → `../prisma-orm/SKILL.md`. *Injecting* a repo or `DataSource` provider stays here; designing the table does not.
- Generic JS/TS test infra (Jest config, coverage thresholds, monorepo) → `../testing-web/SKILL.md`. The Nest harness (`TestingModule`, `overrideProvider`, Supertest bootstrap) stays here.

## Mental model

Everything is a **provider** in a directed DI graph. **Modules** draw the boundaries of that graph — a provider is only reachable where it is provided or imported. **Cross-cutting concerns** (guards, interceptors, pipes, filters) are decorators bound at a scope you choose: global, controller, or route. Get those three right and the rest is plumbing.

The request lifecycle runs in a fixed order. Memorize it — most "my guard can't see the validated body" bugs are an ordering misunderstanding:

```text
req → middleware → guards → interceptors(pre) → pipes → handler → interceptors(post) → exception filters → res
```

So pipes run *after* guards (a guard cannot read a transformed DTO), and filters catch everything thrown downstream. Source: NestJS request-lifecycle docs.

## Module design

One feature module per bounded context. Rules, each with its why:

- **`exports` is the module's public API.** A provider not exported is private to that module — that is the encapsulation, lean on it.
- **`imports` brings in another module's exports; it does not re-declare providers.** Re-declaring a provider in two modules gives you two singletons and silent state bugs.
- **Keep `AppModule` thin.** It wires feature modules and global config, nothing else. A god `AppModule` that declares every controller becomes an untestable circular-dependency magnet.
- **Use a dynamic module (`forRoot` / `forRootAsync`) for configurable infrastructure** (DB, cache, mailer) so consumers pass options instead of editing the module.

```typescript
// Bad — everything dumped in AppModule, no boundaries
@Module({ controllers: [OrdersController, UsersController, BillingController],
          providers: [OrdersService, UsersService, BillingService, PrismaService] })
export class AppModule {}

// Good — a feature module owns its slice and exports only its public surface
@Module({
  imports: [PrismaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], // other modules consume the service, not the repo
})
export class OrdersModule {}
```

## Providers & DI

Pick the custom-provider form by intent:

| Form | Use it when | Resolved by |
|------|-------------|-------------|
| `useClass` | Default — swap implementation by class (e.g. real vs fake mailer) | Nest instantiates |
| `useValue` | A ready object/constant: config, a mock in tests | Used as-is |
| `useFactory` | Value needs computing or other providers (`inject: [...]`) | Your factory fn |
| `useExisting` | Alias an existing token to a new token | Reuses instance |

A non-class token needs explicit injection — Nest has no type to reflect on:

```typescript
const STRIPE = 'STRIPE_CLIENT';

@Module({
  providers: [{
    provide: STRIPE,
    useFactory: (cfg: ConfigService) => new Stripe(cfg.get('STRIPE_KEY')),
    inject: [ConfigService],
  }],
  exports: [STRIPE],
})
export class PaymentsModule {}

@Injectable()
export class CheckoutService {
  constructor(@Inject(STRIPE) private readonly stripe: Stripe) {}
}
```

`forwardRef(() => X)` is a last resort, not a fix — it works around a circular dependency that usually signals two modules that should share a third. Reach for the refactor first; if you must, `forwardRef` goes on *both* sides. See the anti-patterns table.

## Provider scopes

| Scope | Lifetime | Use when |
|-------|----------|----------|
| `DEFAULT` | Singleton (one per app) | Almost always — stateless services |
| `REQUEST` | New instance per request | You genuinely need per-request state (`@Inject(REQUEST)` for the live request) |
| `TRANSIENT` | New instance per consumer | Each injector gets its own copy |

REQUEST scope **bubbles up**: any provider that injects a request-scoped provider becomes request-scoped too, and so does the controller — with a real per-request instantiation cost. Default to singleton; reach for REQUEST only when you must.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  constructor(@Inject(REQUEST) private readonly req: Request) {}
  get userId() { return this.req.user?.id; }
}
```

The classic gotcha: a request-scoped provider injected into a **guard** reads as undefined or stale because guards run early and the scope propagation is not what you assumed. If a guard needs request data, pull it from `ExecutionContext` (`context.switchToHttp().getRequest()`), not from an injected request-scoped service.

## Cross-cutting layer

Pick the primitive by what it is *for*:

| Primitive | Job | Signature |
|-----------|-----|-----------|
| Guard | Authorize — allow/deny the request | returns `boolean` / `Promise<boolean>` |
| Interceptor | Wrap the handler before **and** after (logging, transform, timeout, cache) | RxJS, `handle().pipe(...)` |
| Pipe | Validate and/or transform an input argument | returns transformed value or throws |
| Exception filter | Catch a thrown error and shape the response | `catch(exception, host)` |

Then pick the binding scope:

| Binding | Reach | Can inject deps? |
|---------|-------|------------------|
| `APP_GUARD` / `APP_PIPE` / `APP_INTERCEPTOR` / `APP_FILTER` token in a module's `providers` | Global | **Yes** — resolved by the DI container |
| `@UseGuards(X)` / `@UsePipes(X)` on controller or route | Local | Yes if you pass the class |
| `app.useGlobalGuards(new X())` in `main.ts` | Global | **No** — you instantiated it yourself |

The gotcha that bites everyone: `app.useGlobalPipes(new ValidationPipe())` works, but a guard or pipe that needs to inject a `ConfigService` **cannot** be registered with `new` — Nest never resolved it. Use the `APP_*` token instead so the container builds it:

```typescript
// Good — global AND DI-capable
@Module({
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
```

Deeper material — `ExecutionContext`, custom param decorators, `Reflector` + `SetMetadata` for role/`@Public()` guards, transform/timeout interceptors, filter shape, multiple-binding order — is in `references/cross-cutting.md`.

## Validation

DTO + `ValidationPipe` + `class-validator`/`class-transformer`. The production-safe config:

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip properties with no decorator
  forbidNonWhitelisted: true, // 400 on unknown properties instead of silently dropping
  transform: true,            // coerce payloads to DTO class instances (and primitives)
}));
```

```typescript
export class CreateOrderDto {
  @IsString() @IsNotEmpty()
  sku: string;

  @IsInt() @Min(1)
  quantity: number;
}
```

If the pipe needs to inject something, bind it globally via `APP_PIPE` instead of `new` (same DI rule as above).

## Testing

`Test.createTestingModule({...}).compile()` returns a `TestingModule` you pull providers from. Decision line: **unit-test a provider with its collaborators mocked; e2e-test the wired app over HTTP.**

Unit — mock the collaborators:

```typescript
const moduleRef = await Test.createTestingModule({
  providers: [OrdersService],
})
  .overrideProvider(OrderRepository)
  .useValue({ findById: vi.fn().mockResolvedValue(order) })
  .compile();

const service = moduleRef.get(OrdersService);
```

e2e — boot the real app and hit it with Supertest. **Replicate the global config from `main.ts`** (pipes, filters, guards) or the test passes while prod 400s:

```typescript
const app = moduleRef.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); // mirror main.ts
await app.init();
await request(app.getHttpServer()).post('/orders').send(body).expect(201);
```

`overrideGuard(AuthGuard).useValue({ canActivate: () => true })` lets an e2e test bypass auth. Full recipes — mocking a repo, request-scoped via `resolve()`, ConfigModule in tests, Vitest vs Jest — in `references/testing-recipes.md`.

## Bootstrap & tooling

- Scaffold with the CLI, not by hand: `nest g resource orders`, `nest g module orders`, `nest g service orders`. It wires the module registration for you.
- **NestJS 11** is current (Jan 2025), requires **Node.js 20+**, and ships **Express v5** as the default HTTP adapter (Fastify remains an option).
- Use the **SWC builder** for dev — roughly 20x faster builds and faster cold start than `tsc`. Keep `tsc` for type-checking in CI.
- ESM is first-class in v11 (top-level await aligned with modern Node).
- The official harness is moving toward **Vitest** (SWC-powered) alongside Jest; Jest is still fully supported and is what `nest new` historically scaffolds.

## Anti-patterns

| Anti-pattern | Why it hurts | Do instead |
|--------------|--------------|------------|
| God `AppModule` declaring every controller/provider | No boundaries; breeds circular deps; untestable | One feature module per bounded context, `exports` = public API |
| `new OrdersService(repo)` inside a controller/service | Bypasses DI; same class becomes two unmocked instances | Constructor-inject; let the container build it |
| Business logic in the controller | Controllers should map HTTP ↔ service calls only | Push logic into a provider; controller stays thin |
| `Scope.REQUEST` by default | Bubbles up the chain, per-request cost, surprise undefined in guards | Default singleton; REQUEST only with a real reason |
| `useGlobalPipes(new X())` for a pipe that needs deps | `new` is not DI-resolved; injected deps are undefined | Bind via `APP_PIPE` / `APP_GUARD` token in `providers` |
| e2e test that skips `main.ts` globals | Green test, red prod — validation/filters not applied | Replicate global pipes/filters/guards in the e2e bootstrap |
| `forwardRef` sprinkled to silence "circular dependency" | Hides the real coupling; fragile bootstrap order | Refactor to a shared module; `forwardRef` only as last resort, on both sides |

## Verify

Run `scripts/verify.sh [dir]` to statically catch DI bypasses without a Nest install. It hard-fails only on `new XxxService(...)` outside test files; everything else is a warning. Exits 0 on a clean or empty target.
