---
name: laravel
description: "Use when building or extending a Laravel 11/12 app — Eloquent models, migrations and relationships, routing with controllers and Form Requests, queues and background jobs, framework-native security (validation, mass-assignment, policies, signed URLs, rate limiting), and Pest/PHPUnit feature tests. NOT pure PHP language or toolchain work (that is `php`)."
tags: [laravel, php, eloquent, queues, pest, artisan]
recommends: [php, mysql, redis, api-design, secure-coding, testing-web]
origin: risco
---

# Laravel (11/12 era)

Build Laravel the way the framework ships **today** — Laravel 12 (released 2025-02-24,
PHP 8.2–8.4), continuing the slimmed Laravel 11 skeleton. That means **no
`app/Http/Kernel.php` and no `app/Console/Kernel.php`**: middleware, routing, exception
handling and providers are all configured in **`bootstrap/app.php`**, and scheduled tasks
live in **`routes/console.php`**. Generate that structure, not 2019 Laravel.

This skill owns the **framework surface**: Eloquent, routing/controllers, queues, the
artisan-shaped project, and in-framework Pest tests. The PHP *language and toolchain
underneath* (types, enums, Composer/PSR-4, PHPStan, Pint) is the
[../php/SKILL.md](../php/SKILL.md) skill — its boundary line literally reads "NOT
Eloquent/Blade/Artisan (that is laravel)"; this is the mirror.

## Orient before you scaffold

A wrong version assumption generates dead code. Detect the version and skeleton first.

```bash
composer show laravel/framework            # exact installed version
ls bootstrap/app.php                        # present  -> L11/12 slim skeleton
ls app/Http/Kernel.php 2>/dev/null          # present  -> L10 or older (Kernel era)
php artisan --version                       # confirms runtime + version
```

If `bootstrap/app.php` exists and `app/Http/Kernel.php` does **not**, you are on L11/12 —
use the modern idioms below. Then pick your path:

| Situation | Do |
|---|---|
| Greenfield | `laravel new <app>`, then a starter kit: React (React 19 + TS + Inertia 2 + shadcn/ui), Vue (Vue 3 + Inertia 2 + shadcn-vue), or Livewire (Livewire 3 + Volt + Flux UI). Optional WorkOS AuthKit for auth. |
| Brownfield L11/12 | Follow the repo's existing conventions; do not "reorganize" into folders it dropped. |
| Pre-11 (Kernel era) | Migrate to `bootstrap/app.php` deliberately; move Kernel middleware to `withMiddleware()`, schedule to `routes/console.php`. Treat as a project, not an inline tweak. |

## The slim structure (where things live now)

```text
bootstrap/app.php      # withRouting(), withMiddleware(), withExceptions(), withProviders()
routes/web.php         # web routes (CSRF-protected, session)
routes/api.php         # api routes (stateless) — present once you opt in
routes/console.php     # closures + the SCHEDULER (Schedule::command(...)->daily())
app/Models/            # Eloquent models
app/Http/Controllers/  # thin controllers
app/Http/Requests/     # Form Requests (validation + authorization)
app/Jobs/              # queued jobs
app/Policies/          # authorization policies
```

```php
// Bad: hunting for or editing app/Http/Kernel.php to register middleware (L11/12 deleted it).
// Good: bootstrap/app.php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__.'/../routes/web.php', commands: __DIR__.'/../routes/console.php')
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['subscribed' => EnsureUserIsSubscribed::class]);
        $middleware->web(append: [TrackLastSeen::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->dontReport(InvalidOrderException::class);
    })->create();
```

## Eloquent

**Mass assignment is the #1 Laravel footgun.** A model must declare an allowlist; an open
blocklist on user input lets a request set any column (`is_admin`, `balance`).

```php
// Bad: anything in the request body can be written, including columns you never meant to expose.
class Post extends Model {
    protected $guarded = [];
}

// Good: explicit allowlist. Casts give you typed attributes back out of the DB.
class Post extends Model {
    protected $fillable = ['title', 'body', 'published_at'];

    protected function casts(): array {
        return [
            'published_at' => 'datetime',
            'status'       => PostStatus::class,   // backed-enum cast
            'meta'         => 'array',             // json <-> array
            'api_token'    => 'encrypted',         // at-rest encryption
        ];
    }

    public function tags(): BelongsToMany { return $this->belongsToMany(Tag::class); }
}
```

**N+1 is the most common Laravel performance bug** — a query per row instead of one. Eager
load.

```php
// Bad: 1 query for posts + 1 per post for its author = N+1.
foreach (Post::all() as $post) { echo $post->author->name; }

// Good: eager load up front -> 2 queries total.
foreach (Post::with('author')->get() as $post) { echo $post->author->name; }
```

Migrations define the schema; the `casts()` method (L11+ method form, not the old
`$casts` array) maps columns to enums/arrays/encrypted values. Relationship deep dives
(polymorphic, has-many-through, scopes, observers, custom casts, accessors via the
`Attribute` class) live in [references/eloquent-patterns.md](references/eloquent-patterns.md).

## Routing, controllers, validation

Keep controllers thin: they take a validated request, call a service/model, return a
response. Push branching logic out of routes — **business logic in `routes/web.php` is
untestable and unreusable**.

**Form Requests do validation AND authorization in one object** — the `authorize()` gate
runs before `rules()`, so an unauthorized request never reaches your validation or
controller.

```php
// app/Http/Requests/StoreOrderRequest.php
final class StoreOrderRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user()->can('create', Order::class);   // policy check, before rules
    }

    public function rules(): array {
        return [
            'sku'      => ['required', 'string', 'exists:products,sku'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ];
    }
}

// Controller: route-model binding + the Form Request = a tiny method.
public function store(StoreOrderRequest $request): RedirectResponse {
    $order = Order::create($request->validated());          // only allow-listed, validated data
    ProcessOrder::dispatch($order);
    return to_route('orders.show', $order);
}
```

For JSON APIs, shape output with **API Resources** (`JsonResource`). The transport
*contract* — resource naming, versioning, status-code semantics, pagination shape — is the
**api-design** skill, not this one; this skill covers implementing it in Laravel.

## Queues & scheduling

A job that implements `ShouldQueue` is pushed to the queue and runs out-of-band instead of
inline — that is what gets a slow email/payment off the request cycle.

```php
final class ProcessOrder implements ShouldQueue {
    use Queueable, Batchable;

    public int $tries = 3;                       // attempts before it lands in failed_jobs
    public int $timeout = 120;                   // seconds before the worker kills it

    public function backoff(): array { return [10, 60, 300]; }  // exponential-ish retry spacing

    public function __construct(public Order $order) {}

    public function handle(): void {
        if ($this->batch()?->cancelled()) return; // respect a cancelled batch
        // ... charge, fulfil ...
    }
}

ProcessOrder::dispatch($order);                   // queued (or inline if driver is sync)
```

Batches let you fan out and react when the group finishes; `allowFailures()` keeps the
batch going when individual jobs fail.

```php
Bus::batch([new ProcessOrder($a), new ProcessOrder($b)])
    ->allowFailures()
    ->then(fn (Batch $b) => Log::info("done: {$b->totalJobs}"))
    ->dispatch();
```

**Driver choice:**

| Need | Use |
|---|---|
| Simple, low volume, no extra infra | `database` driver (a `jobs` table) |
| High throughput + a dashboard (retries, runtime, failures) | **Redis + Horizon** — Horizon manages the workers and gives you the monitor |

Schedule recurring work in `routes/console.php` (the L11/12 home for the scheduler — there
is no `app/Console/Kernel.php`):

```php
// routes/console.php
Schedule::command('orders:reconcile')->dailyAt('02:00');
Schedule::job(new PruneStaleCarts)->hourly();
```

Worker deployment, Horizon config, the retry/backoff/timeout matrix, `failed_jobs` +
`queue:retry`, and supervisor/`queue:work` flags are in
[references/queues-and-scheduling.md](references/queues-and-scheduling.md).

## Security (framework-native)

| Control | Use | Why |
|---|---|---|
| Validation | Form Request `rules()` | reject malformed input at the edge, before the controller |
| Mass-assignment guard | `$fillable` allowlist (see Eloquent) | stops a request writing columns you never exposed |
| Authorization | Policies + Gates, `$user->can(...)`, `authorize()` | keeps authz out of controllers and consistent |
| Tamper-proof links | signed URLs (`URL::signedRoute`, `signed` middleware) | unsubscribe/verify links that can't be forged |
| Abuse limiting | rate limiting (`throttle` middleware, `RateLimiter::for`) | caps brute-force / scraping per user or IP |
| Secrets at rest | `Hash::make`/`Hash::check` for passwords, `Crypt` for reversible data | bcrypt/argon2 hashing; never store plaintext |

CSRF protection is automatic on `web` routes; do not disable it. **Read config through
`config()`, never `env()` outside `config/*.php`** — once configs are cached (`config:cache`
in prod) `env()` returns `null` everywhere else. Cross-stack OWASP/threat-modeling is the
**secure-coding** skill; the table above is the framework-native layer this skill owns.

## Testing

Pest is the default runner in new Laravel apps (PHPUnit still fully supported). Use
`RefreshDatabase` for a clean schema per test and model factories for data.

```php
uses(RefreshDatabase::class);

it('processes a paid order', function () {
    $user = User::factory()->create();
    $this->actingAs($user)
        ->post('/orders', ['sku' => 'ABC', 'quantity' => 2])
        ->assertRedirect();

    $this->assertDatabaseHas('orders', ['sku' => 'ABC', 'quantity' => 2]);
});
```

**The sync-driver gotcha.** Tests use the `sync` queue driver by default, so a dispatched
job runs **inline** during the test — it does not sit on a queue. If you assert "the email
was sent" you are accidentally testing execution. To test that work was *dispatched*, fake
the queue first:

```php
it('dispatches order processing', function () {
    Queue::fake();                               // jobs are now recorded, not run
    $order = Order::factory()->create();

    ProcessOrder::dispatch($order);

    Queue::assertPushed(ProcessOrder::class);    // assert dispatch, not side effects
});
```

`Http::fake()` and `Event::fake()` work the same way for outbound HTTP and events.
Cross-stack browser/E2E (Playwright/Cypress) strategy is the **testing-web** skill; this
skill covers in-framework Pest/PHPUnit feature and unit tests.

## Ecosystem (reach for these by name)

Pennant (feature flags / A-B), Pulse (real-time perf: slow queries, job throughput),
Folio (page-based routing), Horizon (Redis queue dashboard). First-party — prefer them
over rolling your own.

## Anti-patterns

| Pattern | Why it is bad | Do instead |
|---|---|---|
| `protected $guarded = []` on a user-facing model | any request column becomes mass-assignable (`is_admin`, `balance`) | explicit `$fillable` allowlist |
| Hunting for / re-creating `app/Http/Kernel.php` on L11/12 | the file was deleted; your middleware never registers | configure in `bootstrap/app.php` `withMiddleware()` |
| Lazy access inside a loop/Blade (`$post->author` per row) | N+1 — one query per row | eager load with `with()` |
| Fat controllers / logic in `routes/web.php` | untestable, unreusable, no authz boundary | thin controller + Form Request + service/model |
| Asserting a queued job's *side effects* in a test | sync driver runs it inline — you test execution, not dispatch | `Queue::fake()` + `Queue::assertPushed()` |
| `env()` outside `config/*.php` | returns `null` once `config:cache` runs in prod | read via `config()`; `env()` only inside config files |
| `$tries` unset on a flaky job | one transient failure = permanent failure | set `$tries` + `backoff()` |
| Committing real secrets in `.env` | leaks credentials into history | `.env` is git-ignored; commit `.env.example` only |
| Old `$casts = [...]` array (deprecated form) | misses the L11+ `casts()` method idioms | the `casts(): array` method |

## Verify

Run [scripts/verify.sh](scripts/verify.sh) from a Laravel project root. It validates
`composer.json`, checks the framework version, runs Pint (style, read-only `--test`) and
the test runner (Pest/`artisan test`) if present, and greps for `protected $guarded = []`
under `app/Models`. It degrades gracefully — prints a skip notice and exits 0 — when there
is no Laravel project or no `vendor/` dir, so it never blocks a non-Laravel repo.

## References & siblings

- [references/eloquent-patterns.md](references/eloquent-patterns.md) — relationship catalog
  (polymorphic, has-many-through), eager-load strategies, query/local scopes, observers,
  attribute casts + custom casts, accessors/mutators via the `Attribute` class.
- [references/queues-and-scheduling.md](references/queues-and-scheduling.md) — driver
  selection, Horizon install/config, retry/backoff/timeout matrix, batch chaining,
  `failed_jobs` + `queue:retry`, worker deployment (supervisor, `queue:work` flags),
  graceful restarts.
- PHP language/toolchain underneath Laravel: [../php/SKILL.md](../php/SKILL.md).
- Cross-stack OWASP/threat-modeling: [../secure-coding/SKILL.md](../secure-coding/SKILL.md).
- API contract design, MySQL/Redis server tuning, browser E2E strategy: the **api-design**,
  **mysql** / **redis**, and **testing-web** skills respectively.
