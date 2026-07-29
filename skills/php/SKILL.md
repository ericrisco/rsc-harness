---
name: php
description: "Use when writing, reviewing or modernizing PHP (8.3-8.5) outside Laravel — strict types, union and intersection types, readonly classes, backed enums, property hooks and asymmetric visibility, the pipe operator and clone-with, Composer with PSR-4, PER-CS style, PSR interop, and the quality toolchain (PHPStan, Pint, Rector, PHPUnit/Pest). NOT Eloquent, Blade or Artisan (that is `laravel`)."
tags: [php, php8, composer, psr, enums, types, static-analysis]
recommends: [laravel, secure-coding, mysql]
origin: risco
---

# Modern PHP (8.x)

Write PHP the way the 2025-2026 ecosystem does: `declare(strict_types=1)` at the top of
every file, typed everything, Composer-first, statically analyzed at the top level — not
the way a 2015 WordPress plugin did. This skill owns the **language and its
framework-agnostic ecosystem**: the type system, Composer + PSR-4, PER-CS style, the PSR
interop interfaces, and the quality toolchain.

**Version targeting.** Floor is **8.3** (security-only, the lowest you should support).
Default new code to **8.4** (property hooks, asymmetric visibility). Use **8.5** features
(`|>`, `clone with`, `array_first`/`array_last`, `#[\NoDiscard]`) only when the deploy
runtime is confirmed 8.5+ — 8.5 released 2025-11-20. 7.x and 8.0-8.2 are EOL; never target
them.

## When to use

- Authoring/reviewing/refactoring any `.php` file or a `composer.json`.
- Designing classes: enums, DTOs, value objects, readonly classes, interfaces, traits.
- Standing up a vanilla-PHP project: Composer, PSR-4 autoload, namespaces, entrypoint.
- Wiring quality gates: PHPStan/Psalm, Pint/PHP-CS-Fixer, Rector, CI.
- Modernizing legacy 5.x/7.x patterns to 8.x idioms.
- Picking framework-agnostic libs (Symfony components, Guzzle, Monolog, Doctrine DBAL,
  league/*) and PSR-compatible interop.

## When NOT to use (delegate)

| The ask is about | Route to | This skill keeps |
|---|---|---|
| Eloquent, Blade, Artisan, container bindings, queues | laravel | the PHP *underneath* Laravel only |
| WP hooks, the loop, `wp_*`, `$wpdb` | wordpress | nothing WP-specific |
| Shopify app/theme SDK work | shopify | nothing Shopify-specific |
| OWASP threat modeling, authz/abuse review | secure-coding | PHP-native controls (PDO, `password_hash`, escaping) |
| REST resource naming, status-code contract as a discipline | api-design | PHP request/response code only |
| DB schema/index tuning | mysql / postgresdb | PDO usage from the PHP side |

The type system, Composer, PSR, and the static-analysis toolchain are canonical **here** and
nowhere else in the catalog.

## Non-negotiables

1. **`declare(strict_types=1);` is the first statement in every `.php` file.** Without it
   PHP silently coerces `"5"` to `5`, `1` to `true` — bugs that type hints exist to stop.
2. **Type every parameter, return, and property.** An untyped signature is a `mixed` you
   did not ask for; PHPStan cannot reason about it.
3. **One namespace per file, PSR-4, Composer-autoloaded.** No `require_once` chains, no
   hand-rolled autoloaders. PSR-0 is deprecated.
4. **`final` by default.** Open a class for extension only when you have designed the
   extension point. Inheritance you did not plan for is a maintenance bill.
5. **Commit `composer.lock`** for applications (reproducible installs); libraries commit it
   for dev too but do not ship it in the package.
6. **PHPStan at max + style-clean before "done".** "It runs" is not the bar; the static
   analyzer and formatter passing is.

## The type system

| Tool | Use it for | One-line why |
|---|---|---|
| Union `A\|B` | a value that is genuinely one of N types | beats `mixed`; PHPStan narrows it |
| Intersection `A&B` | a value that must satisfy several interfaces | expresses "Countable *and* Traversable" without a marker type |
| `readonly` property | a field set once in the constructor | immutability the engine enforces, no manual guard |
| `readonly class` (8.2+) | a whole value object | every property readonly; can only build a changed copy |
| Pure enum | a closed set with no scalar backing | replaces stringly-typed class constants |
| Backed enum (`: string`/`: int`) | a closed set that maps to a DB/JSON value | `from()`/`tryFrom()` give safe parsing |
| `never` return | a function that always throws/exits | tells the analyzer the path is dead |
| `true`/`false` literal types (8.2+) | a method that only ever returns one | precise contracts |
| Nullable `?T` | "may be absent" | distinct from "optional argument with a default" |
| `@template` docblock generics | typed collections/containers | PHPStan reads them; the engine does not have native generics |

```php
<?php

declare(strict_types=1);

// Bad: stringly-typed, untyped, mutable, coercible.
class Order {
    public $status;            // untyped -> mixed
    public function setStatus($s) { $this->status = $s; }  // accepts anything
}

// Good: backed enum + readonly + typed signatures.
enum OrderStatus: string {
    case Pending = 'pending';
    case Paid    = 'paid';
    case Shipped = 'shipped';

    public function isFinal(): bool {
        return $this === self::Shipped;
    }
}

final readonly class Order {
    public function __construct(
        public string $id,
        public OrderStatus $status,
    ) {}
}

$status = OrderStatus::tryFrom($raw) ?? OrderStatus::Pending; // safe parse, never throws on bad input
```

Generics live in docblocks until the engine ships them — PHPStan enforces them:

```php
<?php

declare(strict_types=1);

/**
 * @template T
 */
final class Collection {
    /** @var list<T> */
    private array $items = [];

    /** @param T $item */
    public function add(mixed $item): void { $this->items[] = $item; }

    /** @return list<T> */
    public function all(): array { return $this->items; }
}
```

See [references/type-system.md](references/type-system.md) for enum-with-interface patterns,
variance, the asymmetric-visibility matrix, and `readonly` edge cases.

## Modern OO idioms

```php
<?php

declare(strict_types=1);

final class PriceCalculator {
    // Constructor property promotion: declare + assign in one place.
    public function __construct(private readonly TaxRate $rate) {}

    public function total(Money $net): Money {
        // match (not switch): expression, strict ===, no fall-through, exhaustive-ish.
        $multiplier = match ($this->rate->region) {
            Region::EU => 1.21,
            Region::US => 1.00,
        };
        return $net->times($multiplier);
    }
}

// Named arguments: skip optional params, self-document call sites.
$client = new HttpClient(timeout: 5, retries: 3);

// First-class callable syntax: pass a method as a callable without a closure wrapper.
$ids = array_map($repo->idOf(...), $orders);
```

Rules: promote constructor properties; prefer `match` over `switch`; enums over class
constants; immutable DTOs over mutable bags; `$fn(...)` over `Closure::fromCallable`.

## PHP 8.4: property hooks + asymmetric visibility

Property hooks give computed/guarded properties the engine and PHPStan can see — no
docblock getters. Asymmetric visibility lets a property be read widely but written
narrowly, killing get/set boilerplate.

```php
<?php

declare(strict_types=1);

// Bad: manual getter/setter pair, invisible to static analysis as a "property".
final class Temperature {
    private float $celsius = 0.0;
    public function getFahrenheit(): float { return $this->celsius * 9 / 5 + 32; }
    public function setCelsius(float $c): void {
        if ($c < -273.15) { throw new \InvalidArgumentException('below absolute zero'); }
        $this->celsius = $c;
    }
}

// Good: a computed property hook + a guarded set hook (PHP 8.4+).
final class Temperature {
    public float $celsius = 0.0 {
        set (float $value) {
            if ($value < -273.15) { throw new \InvalidArgumentException('below absolute zero'); }
            $this->celsius = $value;
        }
    }

    public float $fahrenheit {
        get => $this->celsius * 9 / 5 + 32;
    }
}

// Asymmetric visibility: readable everywhere, writable only inside the class.
final class Account {
    public function __construct(public private(set) int $balance) {}
    public function deposit(int $amount): void { $this->balance += $amount; }
}
```

**Trap:** keep hooks pure-ish. A `get` hook that runs a query or mutates state turns a
field access into a hidden side effect. For lazy initialization or I/O, use an explicit
method, not a hook.

## PHP 8.5: pipe, clone-with, and friends (8.5+ runtime only)

Only reach for these when the deploy target is confirmed 8.5+ (released 2025-11-20).

```php
<?php

declare(strict_types=1);

// Bad: deeply nested calls read inside-out.
$result = array_sum(array_filter(array_map(strlen(...), $words), fn($n) => $n > 3));

// Good: pipe operator |> reads left-to-right as a transform pipeline (8.5+).
$result = $words
    |> fn($w) => array_map(strlen(...), $w)
    |> fn($n) => array_filter($n, fn($x) => $x > 3)
    |> array_sum(...);

// clone with: a with-er for readonly objects in one expression (8.5+).
$shipped = clone $order with ['status' => OrderStatus::Shipped];

// array_first / array_last: no more reset()/end() side effects (8.5+).
$head = array_first($items);
$tail = array_last($items);
```

`#[\NoDiscard]` (8.5+) marks a return value that must be used — the engine warns if a caller
ignores it. Put it on a method whose result is the whole point (a built value, a `Result`).

## Composer & project layout

```
my-package/
├── composer.json
├── composer.lock        # commit it for apps
├── src/                 # PSR-4 root -> namespace App\
├── tests/
└── phpstan.neon
```

```json
{
    "name": "acme/my-package",
    "type": "library",
    "require": {
        "php": ">=8.3",
        "psr/log": "^3.0"
    },
    "require-dev": {
        "phpstan/phpstan": "^2.1",
        "laravel/pint": "^1.18",
        "pestphp/pest": "^4.0",
        "rector/rector": "^2.0"
    },
    "autoload": {
        "psr-4": { "App\\": "src/" }
    },
    "autoload-dev": {
        "psr-4": { "App\\Tests\\": "tests/" }
    },
    "scripts": {
        "lint": "pint --test",
        "stan": "phpstan analyse",
        "test": "pest",
        "check": ["@lint", "@stan", "@test"]
    },
    "config": { "sort-packages": true }
}
```

Rules: `require` = runtime deps, `require-dev` = tools/tests; the `psr-4` map points a
namespace prefix at a base dir (PSR-0 is dead); `composer check` is your one-shot gate.

## Error handling

```php
<?php

declare(strict_types=1);

// A typed hierarchy lets callers catch by meaning, not by string matching.
abstract class DomainException extends \RuntimeException {}
final class OrderNotFound extends DomainException {}
final class PaymentDeclined extends DomainException {}

try {
    $order = $repo->find($id) ?? throw new OrderNotFound("order {$id}");
} catch (PaymentDeclined $e) {
    $logger->warning('payment declined', ['order' => $id, 'reason' => $e->getMessage()]);
    throw $e; // rethrow; do not swallow
} finally {
    $lock->release(); // runs whether or not we threw
}
```

Rules: throw typed exceptions, never bare `\Exception`; never swallow (no empty `catch`);
never use the `@` error-suppression operator — it hides fatals from the analyzer; clean up
in `finally`; catch `\Throwable` only at a process boundary (CLI entry, request handler).

## Security controls (PHP-native)

Generic appsec (OWASP, authz, threat modeling) is [../secure-coding/SKILL.md](../secure-coding/SKILL.md).
The PHP-specific controls below stay here.

| Control | API | Why |
|---|---|---|
| Parametrized SQL | PDO prepared statements | the only safe defense against SQLi; never interpolate |
| Password storage | `password_hash()` / `password_verify()` | bcrypt/argon2 with per-hash salt; never `md5`/`sha1` |
| Tokens / secrets | `random_bytes()` / `random_int()` | cryptographically secure; `rand()`/`mt_rand()` are not |
| Output to HTML | `htmlspecialchars($s, ENT_QUOTES, 'UTF-8')` | stops reflected/stored XSS at the boundary |
| `unserialize()` | `['allowed_classes' => false]` | blocks object-injection gadget chains |
| Comparing secrets | `hash_equals()` | constant-time; `===` leaks length/timing |

```php
<?php

declare(strict_types=1);

// Bad: string interpolation = SQL injection.
$pdo->query("SELECT * FROM users WHERE email = '{$email}'");

// Good: prepared statement with a bound parameter.
$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email');
$stmt->execute(['email' => $email]);
$user = $stmt->fetch(\PDO::FETCH_ASSOC);
```

## PSR interop

Depend on PSR interfaces, not concrete vendors, so code stays portable:

- **PSR-3** `Psr\Log\LoggerInterface` — type-hint this; inject Monolog as the impl.
- **PSR-4** autoloading — the Composer mapping above.
- **PSR-7** `RequestInterface`/`ResponseInterface` — HTTP messages; Guzzle/Nyholm implement them.
- **PSR-11** `ContainerInterface` — a container contract with `get()`/`has()`.
- **PSR-15** middleware/handler — `process(Request, Handler): Response`.

```php
<?php

declare(strict_types=1);

use Psr\Log\LoggerInterface;

final class Mailer {
    public function __construct(private readonly LoggerInterface $log) {} // PSR-3, not "new Monolog"
}
```

## Quality toolchain

- **PHPStan 2.x** at `level: max` (Psalm at max is the alternative) — your type contract.
  2.1+ understands 8.4 property hooks.
- **Pint** or **PHP-CS-Fixer** enforcing **PER-CS** (the living standard that replaced the
  now-frozen PSR-12). Run in `--test`/`--dry-run` in CI.
- **Rector 2.x** for mechanical upgrades (e.g. 7.x → 8.x rule sets) — review the diff.
- **PHPUnit 12** or **Pest 4** (built on PHPUnit 12) for tests.

Wire them as Composer `scripts` (above) so `composer check` and CI run the same gate. Full
configs — `phpstan.neon`, `pint.json`, `rector.php`, `phpunit.xml` — are in
[references/tooling.md](references/tooling.md).

## Anti-patterns

| Pattern | Why it is bad | Do instead |
|---|---|---|
| Associative array as a DTO | no types, no autocomplete, typo = silent null | a `readonly` class or backed enum |
| Missing `declare(strict_types=1)` | silent scalar coercion defeats your type hints | first line of every file |
| Untyped property/param/return | every one is an invisible `mixed` | type everything; let PHPStan reason |
| `@` error suppression | hides fatals and warnings from you and the analyzer | handle the error or let it throw |
| String-interpolated SQL / `mysql_*` | SQL injection; `mysql_*` removed in PHP 7 | PDO prepared statements |
| Global state / `static` mutable singletons | untestable, order-dependent, hidden coupling | constructor injection |
| Fat static "helper" classes | a namespace masquerading as an object; no DI, no mocking | small injected services |
| `mixed` everywhere | abandons the type system you are paying for | precise union/intersection types |
| Manual getter/setter pairs (on 8.4+) | boilerplate the engine can express natively | property hooks / `private(set)` |
| `switch` with fall-through | accidental fall-through bugs; statement not expression | `match` (strict, exhaustive) |

## References & siblings

- [references/type-system.md](references/type-system.md) — enums (backed + interface +
  methods), docblock generics, `readonly`/`clone with`, property-hook edge cases, the
  asymmetric-visibility matrix.
- [references/tooling.md](references/tooling.md) — full `phpstan.neon`, `pint.json`,
  `.php-cs-fixer.dist.php`, `rector.php`, `phpunit.xml` / Pest, composer scripts, CI snippet.
- Laravel framework surface (Eloquent, Blade, Artisan): the **laravel** skill.
- Generic appsec / OWASP: [../secure-coding/SKILL.md](../secure-coding/SKILL.md).
- DB schema/index tuning: the **mysql** / [../postgresdb/SKILL.md](../postgresdb/SKILL.md) skills.
