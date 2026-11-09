# Spring Security depth (Security 7)

SKILL.md has the headline: one `SecurityFilterChain` bean, lambda DSL,
`authorizeHttpRequests` + `requestMatchers`, stateless for token APIs. This is the depth.
The language-agnostic authz/secret reasoning is `../security-audit/SKILL.md`; this file is the
Spring wiring.

## JWT resource server (validate tokens minted elsewhere)

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://issuer.example.com/   # discovers JWKS + validates iss/exp/sig
```

```java
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
          .requestMatchers("/actuator/health", "/api/public/**").permitAll()
          .anyRequest().authenticated())
      .oauth2ResourceServer(o -> o.jwt(jwt -> jwt.jwtAuthenticationConverter(converter())));
    return http.build();
}
```

Map JWT scopes/claims to authorities with a `JwtAuthenticationConverter` (e.g. a `roles` claim
-> `ROLE_*`) so `hasRole`/`@PreAuthorize` work against your token's shape.

## OAuth2 client (call protected services on the user's behalf)

`spring-boot-starter-oauth2-client` + `spring.security.oauth2.client.registration.*`. Pair it
with an `@HttpExchange` client (see SKILL.md) so the access token is attached automatically by
an `OAuth2ClientHttpRequestInterceptor`/exchange filter — no manual `Authorization` header.

## Method security

`@EnableMethodSecurity` (replaces the old `@EnableGlobalMethodSecurity`) turns on
`@PreAuthorize`/`@PostAuthorize`:

```java
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
UserResponse get(Long userId) { ... }
```

Use it for row-level / ownership checks the URL matcher can't express. URL matchers guard
coarse routes; method security guards fine-grained access.

## CORS

Define one `CorsConfigurationSource` bean and reference it from the chain — never echo the
request `Origin` blindly:

```java
@Bean CorsConfigurationSource cors() {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(List.of("https://app.example.com"));   // explicit allowlist
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    c.setAllowCredentials(true);
    var src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/api/**", c);
    return src;
}
// in the chain: .cors(Customizer.withDefaults())
```

`allowCredentials(true)` with `allowedOrigins("*")` is rejected by the spec — list real origins.

## CSRF posture — the one decision people get wrong

- **Token API, no cookies** (JWT in `Authorization`): CSRF is not exploitable, so
  `csrf.disable()` is correct. Always leave a comment saying *why* it's disabled.
- **Cookie/session app** (server-rendered, `JSESSIONID`): keep CSRF **enabled**; use the
  `CookieCsrfTokenRepository` and send the token from the client. Disabling it here is a real
  vulnerability.

## Common pitfalls

- **Matcher ordering:** first match wins. A broad `permitAll()` placed before a narrow
  `hasRole()` opens the narrow route. Order most-specific-first.
- **Forgetting `STATELESS`:** a "stateless" API that still creates sessions leaks `JSESSIONID`
  cookies and breaks horizontal scaling.
- **`permitAll` vs no rule:** `anyRequest().authenticated()` must be the catch-all; an
  unmatched request with no terminal rule is a misconfiguration.
- **Encoding passwords with the wrong bean:** use the injected `PasswordEncoder`
  (`BCryptPasswordEncoder` or `DelegatingPasswordEncoder`), never `MessageDigest`/plain hashes.
