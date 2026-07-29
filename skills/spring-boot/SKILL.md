---
name: spring-boot
description: "Use when building, reviewing, testing, securing or configuring a Spring Boot 4 / Framework 7 backend — controllers, services, Spring Data JPA, application.yml, SecurityFilterChain, slice tests. NOT plain modern-Java language work like records or virtual threads (that is `java`); NOT engine-level SQL schema/index/EXPLAIN (that is `postgresdb`)."
tags: [java, spring, jpa, security, backend]
recommends: [java, postgresdb, secure-coding, deployment]
origin: risco
---

# Spring Boot backends (Boot 4 / Framework 7)

A Spring Boot app is **a thin web layer delegating to a transactional service layer over
Spring Data JPA repositories** — wired by constructor injection, configured by typed
`@ConfigurationProperties`, locked down by a `SecurityFilterChain` bean. Controllers
validate input and delegate; they never own business logic, transactions, or persistence.
Hold that shape and most "where does this go?" questions answer themselves.

**Pinned stack** (verify against the project's `pom.xml`/`build.gradle` — do not assume):
Spring Boot 4.0 (GA 2025-11-20), Spring Framework 7, Java 17 baseline / Java 25 LTS, Jakarta
EE 11 (`jakarta.*`, never `javax.*`), Jackson 3, Spring Security 7, Spring Data JPA /
Hibernate 7, JUnit 5 + Testcontainers, Maven 3.9 / Gradle.

If you are typing `WebSecurityConfigurerAdapter`, `@MockBean`, field `@Autowired`,
`authorizeRequests`, or `javax.persistence` — **stop**. Those are the previous generation.
The modern idioms below replace every one of them.

## Boundaries

- Plain Java language work (records, sealed types, virtual threads, streams, pattern
  matching) with no Spring -> [`../java/SKILL.md`](../java/SKILL.md).
- Async Python FastAPI -> [`../fastapi/SKILL.md`](../fastapi/SKILL.md). NestJS/Node ->
  [`../nestjs/SKILL.md`](../nestjs/SKILL.md). Django -> [`../django/SKILL.md`](../django/SKILL.md).
- Engine-level SQL: schema/index design, `EXPLAIN`, partitioning, zero-downtime DDL ->
  [`../postgresdb/SKILL.md`](../postgresdb/SKILL.md) (this skill drives the JPA layer above it).
- Language-agnostic injection/authz/secret theory ->
  [`../secure-coding/SKILL.md`](../secure-coding/SKILL.md).
- Dockerfile/Compose/CI/CD mechanics -> [`../deployment/SKILL.md`](../deployment/SKILL.md)
  (keep only a build note here).

## Project layout

Package by feature, not by layer — colocation keeps a change to one feature in one folder.

```text
com.acme.shop
├── order/
│   ├── OrderController.java       // @RestController — web edge
│   ├── OrderService.java          // @Service — @Transactional unit of work
│   ├── OrderRepository.java       // extends JpaRepository<Order, Long>
│   ├── Order.java                 // @Entity (jakarta.persistence)
│   └── dto/CreateOrderRequest.java, OrderResponse.java   // records, never entities
├── config/AppProperties.java      // @ConfigurationProperties record
├── security/SecurityConfig.java   // SecurityFilterChain bean
└── ShopApplication.java           // @SpringBootApplication
```

## Controllers

`@RestController` + DTO records, `@Valid` on the body (Bean Validation, `jakarta.validation`)
so business code can assume valid data, `ResponseEntity` for 201/`Location`, a
`@RestControllerAdvice` for one error envelope. The controller parses, validates, delegates
and maps — any branch with business meaning belongs in the service, where it is transactional
and unit-testable without MVC. Boot 4 adds first-class versioning via a `version` attribute
on the mapping — one controller serves many versions, no path duplication.

```java
@RestController
@RequestMapping("/api/users")
class UserController {
    private final UserService users;
    UserController(UserService users) { this.users = users; }   // constructor injection

    @PostMapping(version = "1")                                  // Boot 4 API versioning
    ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest req) {
        UserResponse body = users.create(req);
        URI location = URI.create("/api/users/" + body.id());
        return ResponseEntity.created(location).body(body);     // 201 + Location
    }
}

record CreateUserRequest(@NotBlank String name, @Email String email) {}
record UserResponse(Long id, String name, String email) {}
```

```java
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> onInvalid(MethodArgumentNotValidException e) {
        var details = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage()).toList();
        return ResponseEntity.badRequest().body(new ApiError("validation_failed", "Invalid request", details));
    }
}
record ApiError(String code, String message, List<String> details) {}
```

**Bad -> Good** — never return the entity; it leaks columns and lazy-loads in the serializer:

```java
// Bad: leaks columns; lazy fields blow up in the serializer after the tx closes.
@GetMapping("/{id}") User get(@PathVariable Long id) { return repo.findById(id).orElseThrow(); }
// Good: map to a DTO inside the transactional service.
@GetMapping("/{id}") UserResponse get(@PathVariable Long id) { return users.get(id); }
```

## Service + transactions

Constructor-injected, `final` fields, `@Transactional` on the write path, `readOnly = true`
on queries (lets Hibernate skip dirty checking). `@Transactional` belongs on service methods,
never on a controller or repository: the transaction must wrap the unit of work, not the HTTP
request or a single query.

```java
@Service
class UserService {
    private final UserRepository repo;
    private final PasswordEncoder encoder;
    UserService(UserRepository repo, PasswordEncoder encoder) { this.repo = repo; this.encoder = encoder; }

    @Transactional
    UserResponse create(CreateUserRequest req) {
        var user = repo.save(new User(req.name(), req.email(), encoder.encode(req.rawPassword())));
        return new UserResponse(user.getId(), user.getName(), user.getEmail());
    }

    @Transactional(readOnly = true)
    UserResponse get(Long id) {
        return repo.findById(id).map(this::toResponse).orElseThrow(() -> new NotFoundException(id));
    }
}
```

Two traps that produce "my `@Transactional` isn't rolling back":
- **Self-invocation.** Calling `this.other()` inside the same bean bypasses the proxy, so its
  `@Transactional` is ignored. Split into another bean or accept the outer transaction.
- **Checked exceptions don't roll back by default.** Spring rolls back on `RuntimeException`
  only; use `@Transactional(rollbackFor = ...)` for checked ones.

**Bad -> Good** — field injection vs constructor:

```java
// Bad: not testable with `new`, hides missing beans until runtime, allows final-less mutation.
@Autowired private UserRepository repo;
// Good:
private final UserRepository repo;
UserService(UserRepository repo) { this.repo = repo; }
```

## JPA persistence

`jakarta.persistence` imports (never `javax`). Spring Data gives you derived queries for free
and `@Query` for the rest; `Pageable`/`Page` for paging.

```java
import jakarta.persistence.*;

@Entity @Table(name = "users")
class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String name;
    @Column(unique = true) private String email;
    @OneToMany(mappedBy = "user") private List<Order> orders = new ArrayList<>();
    // getters; protected no-arg ctor for Hibernate
}

interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);                       // derived query
    Page<User> findByNameContaining(String q, Pageable page);       // paginated

    @Query("select u from User u join fetch u.orders where u.id = :id")
    Optional<User> findWithOrders(@Param("id") Long id);            // fetch join kills N+1
}
```

**N+1 symptom:** iterating a lazy collection issues one query per parent. Fix with a
`join fetch`, an `@EntityGraph`, or `@BatchSize`. **`LazyInitializationException`** means you
touched a lazy field after the transaction (and its Hibernate session) closed — map to a DTO
*inside* the `@Transactional` service, or fetch eagerly for that path. Relationship/cascade
depth, projections, Specifications, optimistic locking and migration tooling are in
[`references/jpa.md`](references/jpa.md).

## Configuration & profiles

```yaml
# application.yml — no secrets committed here; import them at boot.
spring:
  config:
    import: "optional:configtree:/run/secrets/"   # mount real secrets at runtime
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
app:
  invite-ttl: 24h
  max-orders-per-day: 50
---
spring:
  config:
    activate:
      on-profile: dev
app:
  max-orders-per-day: 5
```

```java
@ConfigurationProperties(prefix = "app")
record AppProperties(Duration inviteTtl, int maxOrdersPerDay) {}   // typed, validated at startup
// register once: @EnableConfigurationProperties(AppProperties.class) on a @Configuration
```

**Bad -> Good** — scattered `@Value("${app.max-orders-per-day}")` strings vs one injected
`AppProperties` record. One typed binding beats string keys sprinkled across the codebase and
fails fast on a missing/mistyped key instead of NPE-ing later.

## Security

A single `SecurityFilterChain` bean with the lambda DSL, stateless for token APIs, JWT via the
resource server.

```java
@Configuration
@EnableMethodSecurity                                            // enables @PreAuthorize
class SecurityConfig {
    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
          .csrf(csrf -> csrf.disable())                          // OK: stateless token API, no cookies
          .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
          .authorizeHttpRequests(auth -> auth
              .requestMatchers(HttpMethod.POST, "/api/users").permitAll()
              .requestMatchers("/api/admin/**").hasRole("ADMIN")
              .anyRequest().authenticated())
          .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()));
        return http.build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}
```

Order `requestMatchers` from most specific to least — the first match wins, so a broad
`permitAll` placed early opens routes you meant to lock. Full JWT/OAuth2 client, method
security, CORS, and CSRF posture (token vs cookie apps) live in
[`references/security.md`](references/security.md). For the language-agnostic authz/secret
principles behind these rules, see [`../secure-coding/SKILL.md`](../secure-coding/SKILL.md).

## Testing

Pick the narrowest slice that exercises what you changed — `@SpringBootTest` only when you
genuinely need the full context:

| Slice | Loads | Use for | Collaborators |
|---|---|---|---|
| `@WebMvcTest` | web layer + Security + MockMvc | one controller's HTTP contract | `@MockitoBean` the service |
| `@DataJpaTest` | JPA + in-memory/TC DB, rolls back per test | repository queries, mappings | real repo, test DB |
| `@SpringBootTest` | full context | end-to-end / integration | real beans, Testcontainers |

`@MockBean`/`@SpyBean` are removed — use `@MockitoBean`/`@MockitoSpyBean` from
`org.springframework.test.context.bean.override.mockito`.

```java
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean UserService users;                              // not @MockBean

    @Test void rejectsBlankName() throws Exception {
        mvc.perform(post("/api/users").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"\",\"email\":\"a@b.co\"}"))
           .andExpect(status().isBadRequest());
    }
}
```

Integration DB via Testcontainers + `@ServiceConnection` (auto-wires connection details, no
`@DynamicPropertySource`):

```java
@TestConfiguration(proxyBeanMethods = false)
class ContainersConfig {
    @Bean @ServiceConnection
    PostgreSQLContainer<?> postgres() { return new PostgreSQLContainer<>("postgres:17"); }
}
```

Slice deep dive, container reuse, `MockMvcTester`/`WebTestClient`, and the CI gate are in
[`references/testing.md`](references/testing.md).

## HTTP clients & resilience

Outbound calls: declare an `@HttpExchange` interface and register it — no manual
`RestTemplate`/`HttpServiceProxyFactory` boilerplate.

```java
@HttpExchange("/v1")
interface BillingClient {
    @GetExchange("/invoices/{id}") Invoice invoice(@PathVariable String id);
}
// register: @ImportHttpServices(group = "billing", types = BillingClient.class) on a @Configuration
```

`RestClient` is the modern synchronous client for ad-hoc calls. For built-in resilience,
`@Retryable` and `@ConcurrencyLimit` are core in Framework 7 — no extra Spring Retry
dependency for the basics.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Extend `WebSecurityConfigurerAdapter` | Removed in Security 6/7 | `SecurityFilterChain` bean + lambda DSL |
| `@Autowired` on a field | Untestable, hides missing beans till runtime | constructor injection, `final` fields |
| `@Transactional` on a `@RestController` | Tx must wrap the unit of work, not the request | put it on the service method |
| Business branching in the controller | Not transactional, needs MVC to test | move the decision into the `@Service` |
| Return the `@Entity` from a controller | Leaks columns, lazy-loads in serializer (LIE) | map to a DTO record inside the tx |
| Request body reaching the service unvalidated | Business code can no longer assume valid data | `@Valid` + `jakarta.validation` at the edge |
| Scattered `@Value("${...}")` config keys | String keys, no validation, fails late | one typed `@ConfigurationProperties` record |
| Use `@MockBean` / `@SpyBean` | Replaced in Boot 4 | `@MockitoBean` / `@MockitoSpyBean` |
| `import javax.persistence` / `javax.validation` | Jakarta EE 11 baseline | `jakarta.*` |
| `authorizeRequests` / `antMatchers` | Gone in Security 6/7 | `authorizeHttpRequests` + `requestMatchers` |
| `csrf().disable()` with no rationale | Silently opens cookie-session apps | disable only for stateless token APIs; comment why |
| `@SpringBootTest` for one controller | Slow, loads everything | `@WebMvcTest` + `@MockitoBean` |
| One 800-line `@Service` | Untestable, tangled transactions | split per use case / aggregate |
| `catch (Exception e)` and echo `e.getMessage()` | Leaks internals, swallows bugs | `@RestControllerAdvice` + typed error envelope |
| Serialize a lazy collection after the tx closes | `LazyInitializationException` / N+1 | fetch join or `@EntityGraph`, map in-tx |

`scripts/verify.sh` greps a project for the legacy idioms above (read-only, best effort).

## Quick reference

| Task | Idiom |
|---|---|
| Inject a dependency | constructor arg, `final` field |
| Expose an endpoint | `@RestController` + `@GetMapping`/`@PostMapping(version=)` |
| Validate input | `@Valid @RequestBody` + `jakarta.validation` annotations |
| Get by id | `repo.findById(id).orElseThrow(...)` in a `readOnly` tx |
| Paginate | `Page<T> findBy...(..., Pageable page)` |
| Custom query | `@Query("select ... join fetch ...")` |
| Transaction boundary | `@Transactional` on the service method |
| Hash a password | `PasswordEncoder` bean (`BCryptPasswordEncoder`) |
| Lock down routes | `SecurityFilterChain` + `authorizeHttpRequests`/`requestMatchers` |
| JWT API | `oauth2ResourceServer(o -> o.jwt(...))`, stateless session |
| Mock a collaborator in a test | `@MockitoBean` |
| Integration DB | Testcontainers `@Bean` + `@ServiceConnection` |

## Project grounding

If the repo has a `02-DOCS/` wiki, record stack decisions (Boot version, security posture,
test strategy, migration tool) in `02-DOCS/wiki/stack/spring-boot.md` and link it from the
`CLAUDE.md` Knowledge map. This is recorded, not gated — if there is no `02-DOCS/`, skip
silently; you may suggest the project harness if the user wants persistent docs.
