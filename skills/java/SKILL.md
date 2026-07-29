---
name: java
description: "Use when writing, reviewing or refactoring modern Java (21+, 25 LTS) — records and sealed interfaces as algebraic data types, exhaustive pattern-matching switch over instanceof ladders, virtual-thread concurrency, structured concurrency and ScopedValue replacing ThreadLocal, Stream and Optional pipelines, compact-constructor validation, parametrized JDBC, and the Maven/Gradle build surface. NOT Spring framework wiring (that is `spring-boot`)."
tags: [java, jvm, records, virtual-threads, sealed-types]
recommends: [spring-boot, secure-coding, deployment]
origin: risco
---

# Modern Java (21+)

Write, review, and refactor Java the way the language is shaped today, not the way it
was in 2014.

Targets **Java 21+ with Java 25 as the current LTS** (released 2025-09-16, supported to
2033; Java 26 is the current non-LTS, 2026-03-17). "Modern" here means: records and sealed
interfaces instead of JavaBeans and type hierarchies, exhaustive pattern-matching `switch`
instead of `instanceof`+cast ladders, virtual threads instead of hand-tuned pools, and
`ScopedValue` instead of `ThreadLocal`. If you are reaching for a telescoping constructor,
a getter/setter bean, or a manual `ExecutorService` sized to a core count, stop.

## When to use / When NOT to use

**Use when:**

- Authoring, reviewing, or refactoring any `.java` file.
- Modeling a domain: record vs class, sealed hierarchy vs enum, where immutability belongs.
- Replacing `instanceof`+cast chains or visitor boilerplate with a pattern-matching `switch`.
- Concurrency that blocks on I/O at scale: migrating thread pools / reactive chains to
  virtual threads, fan-out with structured concurrency, `ThreadLocal` -> `ScopedValue`.
- Stream / Optional / Collector pipelines, and deciding when a plain loop beats a stream.
- Setting up or fixing a `pom.xml` / `build.gradle(.kts)` for a current JDK (toolchain,
  `--release`, preview flags, JUnit 5).

**When NOT to use (delegate):**

- **Spring** controllers, beans, starters, autoconfiguration, `@Transactional` -> `spring-boot`.
  This skill is the plain-JDK layer underneath; framework wiring is out of scope by topic.
- **Kotlin** on the JVM (Android or server) -> `kotlin-android`. Java and Kotlin interop but
  are different languages; coroutines and Kotlin null-safety belong there.
- **Language-agnostic threat modeling / OWASP / authz** -> `secure-coding`. This skill keeps
  only Java-specific controls (parametrized JDBC, compact-constructor validation, sane deser).
- **Containerfile / CI pipeline / shipping** -> `deployment`. This skill keeps only a
  jlink/jpackage note and the JDK base-image choice.
- **PostgreSQL schema / index / query tuning** -> `postgresdb`. This skill covers JDBC
  parametrization from the Java side only.
- Recording per-project conventions in a workspace wiki -> `harness` (see "Project grounding").

Records/sealed/pattern-matching design, virtual-thread concurrency, and the build surface
live **here** — there is no separate "java-concurrency" or "java-build" skill.

## Decision rules

Apply these on every Java edit:

1. **Record by default for data.** If a type just carries values, make it a `record`; it
   gets `equals`/`hashCode`/`toString` and is immutable for free. Class only when you need
   mutable identity or inheritance.
2. **Sealed + exhaustive `switch` over `instanceof` ladders.** A closed set of cases is a
   `sealed interface`; the compiler then proves your `switch` is total. An `instanceof`+cast
   ladder is an unchecked manual version of this.
3. **Immutable and `final` by default.** Fields `final`, collections wrapped/copied; mutate
   only where you have measured a reason. Shared mutable state is the bug you debug at 3am.
4. **`Optional` is a return type, never a field or parameter.** It signals "maybe absent" to a
   caller; an `Optional` field just adds a null-of-null. For absent collections, return empty.
5. **Virtual threads for blocking I/O, platform threads for CPU work.** Loom wins when threads
   spend their life parked on sockets/JDBC; it does nothing for a tight CPU loop.
6. **One virtual thread per task. Never pool them.** They are cheap (millions are fine);
   pooling them re-introduces the limit they exist to remove.
7. **Validate in the compact constructor.** A `record`'s invariants belong in its compact
   constructor so an invalid instance cannot exist — not in a separate `validate()` you can forget.
8. **Parametrize every JDBC query.** `PreparedStatement` with `?`, bind values; never
   concatenate user input into SQL.
9. **Stream for transforms, loop for side-effects.** A `map`/`filter`/`collect` pipeline is
   clear; a `forEach` that mutates external state is a loop wearing a costume — write the loop.
10. **Treat compiler warnings as failures.** Build with `-Xlint:all -Werror`; an ignored
    `unchecked` or `deprecation` warning is a deferred bug.

## Data modeling

A `record` is the default data carrier — immutable, no setters, validated in its compact
constructor.

```java
// Good: invalid Money cannot exist; value semantics for free.
public record Money(long cents, Currency currency) {
    public Money {                                   // compact constructor
        if (cents < 0) throw new IllegalArgumentException("cents < 0: " + cents);
        Objects.requireNonNull(currency, "currency");
    }
    public Money plus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
        return new Money(cents + other.cents, currency);
    }
}
```

```java
// Bad: telescoping constructors, mutable identity, hand-written equals you will get wrong.
public final class Money {
    private long cents; private Currency currency;
    public Money() {}
    public Money(long cents) { this.cents = cents; }
    public Money(long cents, Currency currency) { this.cents = cents; this.currency = currency; }
    public void setCents(long c) { this.cents = c; }   // now any caller can break invariants
    public long getCents() { return cents; }
    // ... 40 lines of getters/setters/equals/hashCode ...
}
```

A **sealed interface + record cases is an algebraic data type** — a closed set the compiler
knows about:

```java
public sealed interface PaymentResult permits Captured, Declined, Pending {}
public record Captured(String id, Money amount)        implements PaymentResult {}
public record Declined(String reason, int code)        implements PaymentResult {}
public record Pending(String id, Instant retryAfter)   implements PaymentResult {}
```

**Enum vs sealed:** use an `enum` when cases are a fixed set of *constants with no per-case
data* (`Status.ACTIVE`); use a sealed interface when each case *carries different fields*
(above). Reaching for an enum plus a parallel "payload" map means you wanted a sealed type.

## Pattern matching

`instanceof` binds the pattern variable directly — no cast:

```java
if (event instanceof Captured c) {       // Good: c is in scope, already typed
    ledger.record(c.id(), c.amount());
}
```

An exhaustive `switch` over a sealed type with **record deconstruction** and `when` guards
replaces the whole ladder — and **omit `default` when the sealed set is covered** so adding a
new case becomes a compile error you must handle:

```java
// Good: total over the sealed type; deconstruction patterns; guard; null branch.
String describe(PaymentResult r) {
    return switch (r) {
        case Captured(var id, var amt) when amt.cents() == 0 -> "free capture " + id;
        case Captured(var id, var amt)                       -> "captured " + amt.cents() + "c " + id;
        case Declined(var reason, var code)                  -> "declined(" + code + "): " + reason;
        case Pending(var id, var __)                         -> "pending " + id;
        case null                                            -> "no result";
        // no default: compiler proves exhaustiveness; a new permits-case won't compile until handled
    };
}
```

```java
// Bad: instanceof + cast ladder. No exhaustiveness check; a new case silently falls through.
String describe(PaymentResult r) {
    if (r instanceof Captured) { Captured c = (Captured) r; return "captured " + c.amount(); }
    else if (r instanceof Declined) { Declined d = (Declined) r; return "declined " + d.reason(); }
    else return "?";   // silently wrong when Pending is added
}
```

Java 25 adds **primitive type patterns** in `instanceof` and `switch` (e.g. `case int i`),
extending exhaustiveness to primitives.

## Concurrency: virtual threads

For blocking I/O, run **one virtual thread per task** inside a per-task executor closed with
try-with-resources (the close call blocks until every submitted task finishes):

```java
// Good: 500 blocking fetches, one virtual thread each. No pool sizing, no reactive ceremony.
List<String> fetchAll(List<URI> urls, HttpClient http) throws InterruptedException {
    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        var futures = urls.stream()
            .map(u -> exec.submit(() -> http.send(
                HttpRequest.newBuilder(u).build(), BodyHandlers.ofString()).body()))
            .toList();
        return futures.stream().map(f -> {
            try { return f.get(); } catch (Exception e) { throw new CompletionException(e); }
        }).toList();
    } // close() joins all tasks
}
```

```java
// Bad: a fixed platform-thread pool caps you at N concurrent blocking calls and starves.
var exec = Executors.newFixedThreadPool(16);   // 484 of 500 fetches wait on a thread
```

**JEP 491 (JDK 24) removed `synchronized` pinning** — a virtual thread inside a `synchronized`
block no longer pins its carrier, so legacy `synchronized` code is safe on Loom now. For *long*
holds prefer `ReentrantLock` anyway (fairness, tryLock, interruptibility).

**Structured concurrency** (`StructuredTaskScope`) ties subtasks to a scope so one failure
cancels the siblings — but it is **still preview in Java 25 (JEP 505, 5th preview)**, so it
needs `--enable-preview`. **`ScopedValue` is FINAL in Java 25 (JEP 506)** and is the immutable
replacement for `ThreadLocal` when sharing context across virtual threads:

```java
// Good: immutable, explicitly scoped, propagates into child tasks; nothing to clean up.
private static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();
ScopedValue.where(REQUEST_ID, id).run(() -> handle(req));   // REQUEST_ID.get() inside
```

A `ThreadLocal` set on the caller does **not** appear in the tasks you submit to an executor,
and on millions of virtual threads its mutable per-thread copies leak memory — that symptom is
exactly what `ScopedValue` fixes. Deep dive (scopes, joiners, pinning diagnosis, when platform
threads still win) -> `references/concurrency.md`.

## Streams, Optional, Collectors (essentials)

Use `stream().toList()` (Java 16+, immutable) for the common case; `Collectors.groupingBy`
and `teeing` cover most aggregation:

```java
Map<Currency, Long> totalByCcy = payments.stream()
    .collect(Collectors.groupingBy(Payment::currency,
             Collectors.summingLong(p -> p.amount().cents())));
```

`Optional` discipline: chain `map`/`filter`/`orElseGet`/`orElseThrow`; never `.get()` without a
prior `isPresent`, never an `Optional` field. Do **not** stream when a loop is clearer — a
`forEach` with side-effects, an early `break`/`return`, or index-coupled logic is a loop.
Full Collector catalog, custom collectors, `mapMulti`, Gatherers (Java 24+), and parallel-stream
caveats -> `references/streams.md`.

## Builds

Pin the language level with the compiler plugin's `<release>`, run JUnit 5 via Surefire.
**Maven 4 is not yet GA (4.0.0-rc-5, Nov 2025) — use Maven 3.9.x for production**:

```xml
<properties><maven.compiler.release>25</maven.compiler.release></properties>
<build><plugins>
  <plugin>
    <groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId>
    <version>3.13.0</version>
    <configuration><release>25</release>
      <compilerArgs><arg>-Xlint:all</arg><arg>-Werror</arg></compilerArgs></configuration>
  </plugin>
  <plugin>
    <groupId>org.apache.maven.plugins</groupId><artifactId>maven-surefire-plugin</artifactId>
    <version>3.5.2</version>
  </plugin>
</plugins></build>
```

Gradle 9.x (current 9.5.1, requires Java 17+ to run, prefers the configuration cache) uses a
**toolchain block** so the build picks the right JDK regardless of the runner's default:

```kotlin
plugins { java }
java { toolchain { languageVersion = JavaLanguageVersion.of(25) } }
tasks.test { useJUnitPlatform() }
```

Full `pom.xml` / `build.gradle.kts` skeletons, multi-module, preview-flag wiring, JUnit 5 +
AssertJ + Mockito, jlink/jpackage -> `references/builds.md`.

## Errors & null

- **Never return `null`.** Return `Optional<T>` for a maybe-value, an empty collection for "none".
- **try-with-resources** for anything `AutoCloseable`; do not write a `finally { close() }` by hand.
- **Chain exceptions** — `throw new ServiceException("loading user " + id, cause)` — so the
  stack trace keeps the root. Swallowing (`catch (Exception e) {}`) destroys the evidence.
- **Checked vs unchecked:** checked (`extends Exception`) for recoverable, expected conditions
  the caller must handle; unchecked (`extends RuntimeException`) for programming bugs / invariant
  violations. Do not wrap everything in a checked exception "to be safe" — it just gets rethrown.

## Anti-patterns / rationalizations -> STOP

| Rationalization | Reality / Do instead |
| --- | --- |
| "I'll add setters to the record for convenience" | Then it isn't immutable. Build a new instance; validate in the compact constructor. |
| "instanceof+cast is fine, it's only three cases" | No exhaustiveness; case four silently falls through. Sealed + `switch`. |
| "pool the virtual threads to be safe" | Pooling re-adds the limit Loom removes. One virtual thread per task. |
| "ThreadLocal carries my request context" | It doesn't cross submit() and leaks on millions of vthreads. `ScopedValue`. |
| "Optional field so callers handle absence" | Optional is a return type. A field is null-of-null; use the value or a default. |
| "raw `List` is shorter than `List<Payment>`" | Raw types disable generics checks. Always parametrize. |
| "catch and ignore, it can't happen here" | Then assert it; a swallowed exception erases the bug. Log + rethrow or handle. |
| "fmt the id into the SQL string, it's trusted" | Trust nothing at the boundary. `PreparedStatement` with `?`. |
| "wrap it in a checked exception to force handling" | Most callers just rethrow. Unchecked for bugs; checked only when recovery is real. |
| "`new Thread(r).start()` per request" | On platform threads that's a few thousand max. Virtual-thread-per-task executor. |
| "default branch keeps the switch safe" | A default hides the new case. Omit it on a sealed type so it won't compile. |
| "warnings are just noise" | `unchecked`/`deprecation` are deferred bugs. `-Xlint:all -Werror`. |

## Quick reference

| Task | Idiom / command |
| --- | --- |
| Build + test (Maven) | `./mvnw -q verify` (or `mvn -q verify`) |
| Build + test (Gradle) | `./gradlew check` |
| Data carrier | `record Money(long cents, Currency ccy) { Money { ... } }` |
| Closed case set | `sealed interface R permits A, B {}` + `record A(...) implements R {}` |
| Exhaustive match | `switch (r) { case A(var x) -> ...; case B b -> ...; }` (no `default`) |
| Concurrent blocking I/O | `try (var e = Executors.newVirtualThreadPerTaskExecutor()) { ... }` |
| Context across threads | `ScopedValue.where(KEY, val).run(() -> ...)` |
| Run a single source file | `java App.java` (compact source + instance `main`, JEP 512, final in 25) |
| Local gate | `./scripts/verify.sh` (run in your project root) |

## Project grounding (02-DOCS + CLAUDE.md)

When this skill runs in a project with a `02-DOCS/` layer (the
[`harness`](../harness/SKILL.md) Karpathy wiki), record this project's Java decisions there
and index them from the root `CLAUDE.md`, so the next agent inherits them instead of re-deriving.

1. **Find the article** `02-DOCS/wiki/stack/java.md`, indexed in `02-DOCS/wiki/index.md` (the
   Knowledge map index; root `CLAUDE.md` points to it).
2. **If missing or stale**, create/update it with the project's real choices — JDK/LTS target,
   Maven vs Gradle, the domain-modeling conventions (records/sealed), the concurrency model
   (virtual threads, structured-concurrency preview on/off), and the error/null conventions —
   then index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a
   short pointer to it).
3. **Read it first on every use** and stay consistent; when a convention changes, update the
   article (bump its `Updated` date) in the same change.

No `02-DOCS/` layer? Skip silently (optionally suggest `harness`). Technical conventions are
*recorded, not gated* — never block the task on this.

## See Also

Sibling skills (link only those present under `skills/`):

- `spring-boot` - the Spring framework surface (controllers, beans, autoconfiguration); this
  skill is the plain-JDK/language layer underneath it.
- [`secure-coding`](../secure-coding/SKILL.md) - threat modeling and language-agnostic
  authz/abuse/OWASP review (this skill keeps the Java-specific controls).
- [`deployment`](../deployment/SKILL.md) - Docker, CI, and shipping (this skill keeps only the
  jlink/jpackage note and base-image choice).
- [`postgresdb`](../postgresdb/SKILL.md) - SQL schema/index/query tuning (this skill covers JDBC
  parametrization from the Java side only).
- [`harness`](../harness/SKILL.md) - the `02-DOCS/` workspace wiki where per-project Java
  conventions are recorded (see "Project grounding").

Local references (read when):

- `references/concurrency.md` - virtual-thread internals, structured concurrency, ScopedValue,
  pinning diagnosis, when platform threads still win.
- `references/streams.md` - full Collectors catalog, custom collectors, Gatherers, parallel-stream
  caveats, Stream-vs-loop decision table.
- `references/builds.md` - full pom.xml + build.gradle.kts skeletons, multi-module, preview flags,
  JUnit 5 + AssertJ + Mockito, jlink/jpackage, dependency hygiene.
