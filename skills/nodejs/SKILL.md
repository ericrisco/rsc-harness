---
name: nodejs
description: "Use when building or operating a plain Node.js / Express 5 backend service: project layout, async correctness, central error middleware, fail-fast config, graceful shutdown on SIGTERM. NOT DI modules/providers/guards (that is `nestjs`), NOT the type system or tsconfig (that is `typescript`), NOT REST contract design (that is `api-design`)."
tags: [nodejs, express, backend, async, error-handling]
recommends: [nestjs, typescript, api-design, error-handling, postgresdb]
origin: risco
---

# Node.js backend services

Stand up a plain Node.js HTTP/JSON service — `node:http` or Express 5 — that a person can read, test, and operate without a DI framework. This skill is about the runtime and the request lifecycle: how to lay out the code, how to keep async correct, how errors become status codes, how config fails fast, and how the process dies cleanly. The contract shape, the type system, and the data layer live elsewhere (see the boundary below).

## Boundary

- The app is built around `@Module` / `@Injectable` / DI providers, guards, interceptors, pipes, exception filters → [`nestjs`](../nestjs/SKILL.md). Nest starts the moment the DI container appears; route away then, do not half-build it here.
- Pure TypeScript type system, generics, `tsconfig` → [`typescript`](../typescript/SKILL.md). This skill uses TS but does not teach types.
- REST resource modeling, versioning, pagination, status-code semantics (framework-agnostic) → [`api-design`](../api-design/SKILL.md). This skill *wires* the handlers; api-design decides the contract. Cross-cutting error taxonomy → [`error-handling`](../error-handling/SKILL.md).
- Schema, queries, connection pool, migrations → [`postgresdb`](../postgresdb/SKILL.md) / [`prisma-orm`](../prisma-orm/SKILL.md) / [`drizzle-orm`](../drizzle-orm/SKILL.md). *Calling* a repository stays here; designing the table does not.
- Containerizing / shipping → [`docker`](../docker/SKILL.md) / [`deployment`](../deployment/SKILL.md). Choosing the logging/metrics/tracing stack → [`observability`](../observability/SKILL.md). This skill emits structured logs and a shutdown hook; it does not own the pipeline.

## Decide first

Pick the runtime shape before writing code — the wrong choice is expensive to undo.

| Situation | Choice | Why |
| --- | --- | --- |
| Needs DI/modules, large team, heavy cross-cutting | route to [`nestjs`](../nestjs/SKILL.md) | Don't reinvent a DI container by hand |
| Small/medium JSON API, want middleware + routing | Express 5 | Mature, async errors auto-forward (v5) |
| One tiny endpoint, zero deps, a healthcheck | `node:http` | No dependency surface to maintain |
| A library, not a server | not this skill | No request lifecycle to manage |

Defaults for a new service: pin **Node 24 (Active LTS)** in `engines.node`; Node 22 is Maintenance LTS; Node 26 is Current (released 2026-05-05, enters LTS Oct 2026) — adopt it only if you want Temporal/V8 14.6 and can track Current. Write **ESM** for new code (`"type": "module"`), CommonJS only when a hard dependency forces it.

```jsonc
// package.json
{
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "node --watch src/server.ts",
    "test": "node --test"
  }
}
```

## Project layout

Concrete tree. The names are conventions, not magic — but the split is load-bearing.

```text
src/
  app.ts          # build + return the Express app; NEVER calls listen()
  server.ts       # imports app, listens, owns SIGTERM/shutdown
  config/
    env.ts        # validate process.env once, export a typed `config`
  routes/
    users.ts      # router only: path → controller
  controllers/
    users.ts      # parse request, call service, shape response
  services/
    users.ts      # business logic, no req/res objects
  repositories/
    users.ts      # data access; the only layer that touches the DB
  errors/
    app-error.ts  # AppError/HttpError with status + code
```

**Rule — separate app construction from `listen()`.** `app.ts` builds and returns the app; `server.ts` binds the port and owns shutdown. Why: tests import `app` and exercise routes in-process without binding a port, so they run fast and in parallel.

```ts
// Bad: index.ts listens at import time — untestable, double-binds in tests
const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(3000); // side effect on import

// Good: app.ts
export function buildApp() {
  const app = express();
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  return app; // no listen here
}
```

## Async rules

Every async mistake here is a latent production incident, not a style nit.

- **Await or return every promise.** A floating promise is a latent process crash — since Node 15 an unhandled rejection terminates the process by default. The error happens later, detached from its handler.
- **Never mix callback + promise styles.** Promisify once at the boundary (`util.promisify` or `fs/promises`) and stay in promises after that. Half-converted code swallows errors.
- **`Promise.all` for independent work; sequential `await` only for true dependencies.** Awaiting independent calls one by one wastes wall-clock time.
- **Use `AbortSignal.timeout(ms)` for per-operation deadlines** and thread the signal into `fetch`/DB/long ops. Compose with `AbortController` so shutdown can cancel in-flight work (see graceful shutdown).
- **Never rely on a global `unhandledRejection` handler as control flow.** Log and exit there if anything; do not use it to keep running.

```ts
// Bad: forgotten await — the rejection floats and crashes later, error lost
function handler(req, res) {
  saveAudit(req.body);          // returns a promise nobody awaits
  res.json({ ok: true });       // responds before save resolves/rejects
}

// Good: await it (Express 5 forwards a throw to the error middleware)
async function handler(req, res) {
  await saveAudit(req.body);
  res.json({ ok: true });
}
```

## Error handling

This is the core, and the most common bug. In **Express 5 an async handler that rejects or throws is auto-forwarded to the error middleware** — no `try/catch + next(err)` wrapper, no `asyncHandler`. Source: Express 5 migration guide and the framework's own router tests (a value-less `Promise.reject()` becomes an Error with message `Rejected promise`).

- Define one `AppError` (or `HttpError`) carrying `status` and `code`. Throw it from services; controllers don't translate.
- Register **exactly one 4-arg `(err, req, res, next)` error middleware, LAST**, after every route. **Arity is what makes Express treat it as an error handler** — a 3-arg function is a normal middleware no matter what you name it. Order still matters in v5.
- A 404 fallthrough handler goes *just before* the error middleware.
- Map known errors → their status; unknown → 500; **never leak the stack or raw message in production.**

```ts
// errors/app-error.ts
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// app.ts — registration ORDER (routes → 404 → error handler)
app.use("/users", usersRouter);

app.use((_req, res) => res.status(404).json({ code: "not_found" }));

// LAST, exactly 4 args — this is the error handler
app.use((err, _req, res, _next) => {
  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : "internal_error";
  if (status >= 500) logger.error({ err }, "unhandled");
  res.status(status).json({
    code,
    message: status < 500 ? err.message : "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});
```

```ts
// Bad: the symptom "async route throws but client gets 200 empty body"
app.use((err, _req, res, _next) => { /* error handler */ });  // registered FIRST
app.get("/users/:id", async (req, res) => {
  const u = await findUser(req.params.id);   // throws NotFound
  res.json(u);                                // never reached; no handler after → hangs/empties
});
```

The error handler placed before the route never sees the throw, so the response is whatever was half-written. Put it last. See [`references/express5-migration.md`](references/express5-migration.md) for the full v4→5 breaking-change checklist, the middleware-order diagram, and the legacy v4 `asyncHandler` wrapper.

## Config & secrets

Validate `process.env` once at boot, fail fast, and export a typed `config` object. **A missing variable should crash at startup, not at 3am on first use.** Ban scattered `process.env.X` reads throughout the codebase — they hide the contract and defeat the boot check.

```ts
// config/env.ts — hand-rolled or zod/envalid; the point is one gate
import { z } from "zod";
const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
export const config = schema.parse(process.env); // throws → process won't start
```

## Graceful shutdown

On SIGTERM the orchestrator gives you a brief window to finish. Drop nothing.

1. Flip readiness to **not-ready** so the load balancer stops routing new traffic.
2. `server.close()` — stop accepting new connections, let in-flight requests finish.
3. Abort long-running work via a shared `AbortController` (the signal you threaded into ops).
4. Close the DB pool and other resources.
5. `process.exit(0)`, with a force-exit timer as a backstop if drain stalls.

Expose `/healthz` (liveness — is the process up) separately from `/readyz` (readiness — should it receive traffic). They answer different questions; conflating them causes both false restarts and dropped requests during deploys. The complete copy-pasteable `server.ts` — signal handlers, `AbortController`, readiness gate, force-exit backstop — lives in [`references/graceful-shutdown.md`](references/graceful-shutdown.md).

```ts
// server.ts (sketch — full version in references/)
const controller = new AbortController();
const server = buildApp().listen(config.PORT);

function shutdown() {
  ready = false;                       // /readyz now 503
  server.close(() => process.exit(0)); // drain, then exit
  controller.abort();                  // cancel in-flight long ops
  setTimeout(() => process.exit(1), 10_000).unref(); // backstop
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

## Testing

Node 24 ships a built-in test runner — `node:test` with `node --test` — so a backend needs no external runner for unit/integration tests, and `node --watch` for dev. **Import `app` from `app.ts` and hit it directly** (supertest or `undici`); never start the live server in a test. That is exactly why `app.ts` doesn't call `listen()`.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../src/app.ts";

test("404 returns the error contract", async () => {
  const res = await request(buildApp()).get("/nope");
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "not_found");
});
```

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Floating promise (no `await`/`return`) | Unhandled rejection crashes the process (Node 15+), error detached | Await or return every promise |
| Error middleware with 3 args or not last | Express never treats it as an error handler; throws fall through | 4 args `(err,req,res,next)`, registered LAST |
| Reading `process.env.X` everywhere | Missing var fails at 3am, contract is invisible | Validate once in `config/env.ts`, export typed `config` |
| `listen()` inside `app.ts` | Side effect on import; tests bind a port / double-listen | `app.ts` returns app, `server.ts` listens |
| `catch (e) {}` then continue | Swallows the failure, masks the bug | Re-throw, or map to an `AppError` |
| `process.exit()` without draining | Drops in-flight requests on deploy | SIGTERM → `server.close()` → abort → exit |
| Global `unhandledRejection` as control flow | Hides bugs, leaves process in a bad state | Log + exit there; fix the floating promise |
| Assuming Express 4 defaults | v5: `urlencoded` `extended:false`, `static` `dotfiles:"ignore"` | Read [`references/express5-migration.md`](references/express5-migration.md) |
| Leaking stack/message in prod | Information disclosure | Stack only when `NODE_ENV !== "production"` |

## Verify

`scripts/verify.sh` statically lints a produced repo for these rules (4-arg error handler last, no `listen()` in `app.ts`, `engines.node` supported, floating-promise heuristic). Advisory; hard-fails only on `listen()` in `app.ts` or a missing error handler.
