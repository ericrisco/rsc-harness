---
name: api-design
description: "Use when settling the contract of an API you expose, before implementation: resources/URLs, REST vs GraphQL, versioning, one RFC 9457 error envelope, pagination, idempotency — emitted as OpenAPI 3.1. NOT implementing the endpoints (that is `fastapi`/`nestjs`/`go`/`nodejs`), NOT auth hardening (that is `secure-coding`), NOT consuming a third-party API (that is `api-connector-builder`)."
tags: [api-design, rest, graphql, openapi, versioning, pagination, http, rfc9457, contract-design]
recommends: [fastapi, nestjs, go, nodejs, secure-coding, webhooks, api-connector-builder, code-review]
origin: risco
---

# API design

## Your one job

You design the **contract** an API exposes. You do not write the handler. The deliverable is a set of decisions a backend skill can implement directly: resource shapes, URLs, methods, the status-code map, one error envelope, pagination params, versioning rules — ideally captured as an **OpenAPI 3.1** document.

When the user names a framework (FastAPI, NestJS, Go, Node), they own the build; you are pulled in for contract questions. Settle the contract first, then hand off (see [Handoff](#handoff)). Keep every decision framework-neutral: nothing here should mention an ORM, a router, or a DI container.

## REST vs GraphQL vs hybrid

Pick on traffic shape, not fashion. Decide once, write it down.

| Situation | Choose | Why |
|---|---|---|
| CRUD-ish resources, public API, HTTP caching matters | **REST** | URLs map to resources; CDN/proxy caching works on GET + ETag out of the box |
| Many client shapes, deep nested graphs, mobile over-fetch is real | **GraphQL** | one round-trip, client picks fields; no N endpoints per screen |
| Stable resource API + one rich read surface for a client app | **Hybrid** | REST for the system of record, a GraphQL read layer on top |

Operational gotcha that decides monitoring: **GraphQL returns HTTP 200 even when a field errored** — failures live in an `errors[]` array next to partial `data`. Your dashboards cannot alert on 5xx; you must alert on the `errors[]` payload. REST signals failure with the HTTP status itself. If your ops team lives on status-code SLOs, that is a point for REST. Schema/nullability design, mutation and error-union conventions, and this error model in full: [`references/graphql-design.md`](references/graphql-design.md).

## Resource & URL modeling

Resources are **nouns**; HTTP methods are the verbs. Never put a verb in a path.

Rules, each with its reason:
- **Plural collections, consistent everywhere** — `/projects`, `/projects/{id}`. Pick plural and never mix singular in; inconsistent naming is the most-cited design smell.
- **Nest sub-resources one level** — `/projects/{id}/tasks`. Deeper than one level (`/projects/{p}/tasks/{t}/comments/{c}`) gets unreadable; link to the flat resource instead (`/comments/{c}`).
- **Methods carry intent** — `GET` read, `POST` create, `PUT` full replace, `PATCH` partial update, `DELETE` remove. A path never says what it does.
- **Filter/sort/select via query string, not new paths** — `?status=open&sort=-created_at&fields=id,title`. One `GET /projects` handles all of it; don't mint `/projects/open` and `/projects/byDate`.

| Bad | Good | Why |
|---|---|---|
| `POST /createProject` | `POST /projects` | the method is the verb |
| `GET /getUserOrders/{id}` | `GET /users/{id}/orders` | noun hierarchy, no verb |
| `GET /project` and `GET /tasks` | `GET /projects` and `GET /tasks` | one plural convention |
| `GET /projects/active` | `GET /projects?status=active` | filter is a query param |
| `POST /projects/{id}/delete` | `DELETE /projects/{id}` | method, not path segment |

Full query grammar (filter operators, sparse fieldsets, sort syntax), content negotiation, rate-limit headers and a HATEOAS note: [`references/rest-conventions.md`](references/rest-conventions.md).

## Status codes that matter

You need a small map, used consistently. Don't overload 200.

```http
200 OK            # read / update succeeded, body returned
201 Created       # resource created — include Location: /projects/{id}
202 Accepted      # async accepted, not done — return a status URL
204 No Content    # success, nothing to return (e.g. DELETE)
400 Bad Request   # malformed syntax / unparseable
401 Unauthorized  # not authenticated — who are you?
403 Forbidden     # authenticated but not allowed — I know you, no
404 Not Found     # resource absent (or hidden from this caller)
409 Conflict      # state collision — duplicate, version mismatch
422 Unprocessable # syntactically fine, semantically invalid (validation)
429 Too Many Req  # rate limited — include Retry-After
5xx               # your fault, never the client's; never leak the stack
```

Two distinctions agents get wrong:
- **401 vs 403** — 401 means *unauthenticated* (no/invalid credentials); 403 means *authenticated but unauthorized*. Returning 401 on a permission failure leaks that re-auth might help when it won't.
- **409 vs 422** — 409 is a *state* conflict (the request fights the current server state: dup key, stale version). 422 is a *content* problem (the body parses but fails business rules). Full status-code table with when-each in [`references/rest-conventions.md`](references/rest-conventions.md).

## Error envelope: RFC 9457

One error shape across **every** endpoint. Adopt **RFC 9457 Problem Details** (the current standard; it obsoletes RFC 7807). Media type `application/problem+json`. Standard members: `type`, `title`, `status`, `detail`, `instance`, plus your own extension members.

```json
{
  "type": "https://api.acme.com/problems/validation-error",
  "title": "Your request parameters didn't validate.",
  "status": 422,
  "detail": "due_date must be in the future.",
  "instance": "/projects/8a3/tasks",
  "errors": [
    { "field": "due_date", "message": "must be in the future" }
  ],
  "correlation_id": "req_01H..."
}
```

Rules:
- **`type` is a stable, machine-readable URI** — clients branch on it, not on `detail`. Never change a `type` string once published.
- **`title` is human, generic per type; `detail` is human, specific to this occurrence.** `detail` is for people, not parsers.
- **Always carry a correlation/request id** (extension member) so a support ticket maps to a log line.
- **Never leak internals** — no stack traces, SQL, internal hostnames, or raw DB ids in `detail`. That is both an information leak and a coupling leak.

## Pagination

Default to **cursor (keyset)** pagination. Use offset only for small, bounded sets.

| Approach | Use when | Why |
|---|---|---|
| **Cursor / keyset** | large or changing datasets, feeds, anything hot | opaque token over an indexed ordered column → constant-time, stable across inserts |
| **Offset / limit** | small bounded admin lists, fixed reference tables | simple, but the DB scans-and-discards skipped rows (degrades with depth) and **skips or duplicates rows** when data shifts between page loads |

Decision line: if the list can grow unbounded or rows can be inserted between page fetches, use cursor.

REST cursor envelope — same keys on every list endpoint:

```json
{
  "data": [ { "id": "...", "title": "..." } ],
  "next_cursor": "eyJpZCI6MTI4N30",
  "has_more": true
}
```

The next page is `GET /projects?cursor=eyJpZCI6MTI4N30&limit=50`. The cursor is opaque — clients must not parse or construct it.

GraphQL has its own de-facto standard: **Relay Connections** — `edges { node, cursor }`, `pageInfo { hasNextPage, endCursor }`, args `first` / `after`. Use it; don't invent a bespoke GraphQL pagination shape. See [`references/graphql-design.md`](references/graphql-design.md).

## Versioning & evolution

**Prefer additive, non-breaking evolution over a new version.** A new version forks your client base and your maintenance. Most changes don't need one.

- **Non-breaking (no version bump):** adding an optional field, adding a new endpoint, adding a new optional query param, adding a new enum value clients are told to tolerate.
- **Breaking (needs a version):** removing/renaming a field, changing a type, making an optional field required, changing status-code semantics, changing the error `type` for a case.

When you must version, **use a URL path version (`/v1/...`) for public APIs** — it is visible, cacheable, trivially testable in a browser, and the most common convention clients expect. Header/media-type versioning (`Accept: application/vnd.acme.v2+json`) keeps URLs clean but is harder to test and cache; query-param versioning (`?version=2`) pollutes every URL. Default to path.

Deprecate gracefully with the `Deprecation` and `Sunset` response headers so clients get programmatic warning before removal:

```http
Deprecation: true
Sunset: Sat, 31 Oct 2026 23:59:59 GMT
Link: <https://api.acme.com/v2/projects>; rel="successor-version"
```

Full breaking-vs-non-breaking matrix, the three versioning mechanisms and the deprecation/sunset workflow: [`references/versioning-and-evolution.md`](references/versioning-and-evolution.md).

## Idempotency & concurrency

- **Make POST/PATCH retry-safe with an `Idempotency-Key` header.** The client sends a unique key; the server replays the original response on a retry instead of double-creating. This is an IETF httpapi draft (not yet an RFC) but is the proven pattern across Stripe, PayPal, and others — adopt it for any create/charge/payment-like operation where a network retry could duplicate work.

```http
POST /payments
Idempotency-Key: 9b1f7c2e-... 
```

- **Use `ETag` + `If-Match` for optimistic concurrency** on PUT/PATCH. The server returns an `ETag` (a version fingerprint) on read; the client sends it back in `If-Match` on write. If it no longer matches, the server returns **412 Precondition Failed** — no lost update. Use `If-None-Match` for conditional GET caching.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Verbs in paths (`/getUsers`, `/createProject`) | duplicates HTTP semantics, breaks caching/tooling | noun + HTTP method |
| Mixed plural/singular collections | clients can't predict URLs | one plural convention everywhere |
| 200 on error (REST) | breaks status-code monitoring and client error handling | real 4xx/5xx + RFC 9457 body |
| Different error shape per endpoint | every client writes per-endpoint parsing | one `application/problem+json` shape |
| Leaking stack traces / SQL / DB ids in errors | info leak + couples clients to internals | generic `title`, safe `detail`, correlation id |
| Offset pagination on a hot/large feed | slow at depth; skips/dups rows on insert | cursor/keyset pagination |
| Unbounded list endpoint (no limit) | one client can pull the whole table | enforce a default + max `limit` |
| New version for every change | forks clients, multiplies maintenance | additive non-breaking evolution |
| Breaking a field in place on a live version | silently breaks existing clients | new field/version + deprecation headers |
| 401 for a permission failure | misleads client into re-authing | 403 when authenticated-but-forbidden |
| 200 for a created resource | hides the create, no `Location` | 201 + `Location` header |
| Ignoring GraphQL partial `errors[]` | failures invisible to monitoring | alert on `errors[]`, not just HTTP 5xx |

## Handoff

The contract is the artifact. Emit it as an **OpenAPI 3.1** document — the checkable deliverable a framework skill generates code from. How to shape it, and what `scripts/verify.sh` checks: [`references/openapi-contract.md`](references/openapi-contract.md).

Hand off to the builder:
- Python/async → [`../fastapi/SKILL.md`](../fastapi/SKILL.md)
- NestJS / Node DI → [`../nestjs/SKILL.md`](../nestjs/SKILL.md)
- Go `net/http` → [`../go/SKILL.md`](../go/SKILL.md)
- Node generally → [`../nodejs/SKILL.md`](../nodejs/SKILL.md)

Adjacent concerns you do **not** own:
- Auth hardening, OWASP, CORS/CSP threat-modeling → [`../secure-coding/SKILL.md`](../secure-coding/SKILL.md) (you only place 401/403/scopes in the contract)
- Receiving inbound webhooks (HMAC verify, replay, dedupe) → [`../webhooks/SKILL.md`](../webhooks/SKILL.md)
- Building an outbound client to a third-party API → [`../api-connector-builder/SKILL.md`](../api-connector-builder/SKILL.md)
- Reviewing handler code (not the design) → [`../code-review/SKILL.md`](../code-review/SKILL.md)
