# Resource exhaustion and availability

Load when anything untrusted (a request, a message, a file, tenant state, work an agent runs) can burn CPU, memory, disk, connections, worker slots, paid API calls or queue capacity, or can crash or deadlock a shared service. A reachable fatal error belongs here for its shared impact even when the parser bug itself is covered in [memory-and-binary.md](memory-and-binary.md); broker delivery logic is in [protocols-and-messaging.md](protocols-and-messaging.md).

The job of this file is to separate an availability vulnerability you can show from source from an ordinary performance complaint.

## Ground rules for this domain

- A finding needs three things: a path from input to cost, a limit that is missing or ineffective, and damage to someone else (another user, a shared service, a safety function, or money the operator pays). If the only process that suffers is the requester's own, there is no vulnerability.
- "No rate limit" alone is not a finding. Before calling a path unbounded, check per-tenant quotas, upstream gateways, deadlines, constraints in the database, queue sizes, concurrency limits, and size caps on bodies, messages and files.
- **Never stress, saturate or load-test anything shared or live.** Proof means complexity analysis on paper, a few small growth points, paid calls replaced by mocks, hard resource caps on the local process, and cancellation tests with a fixed schedule, all inside the sandbox described in [../isolated-execution.md](../isolated-execution.md).
- Always state: what it costs the attacker, how much work the service does, whether the effect persists, how wide it reaches, and how it recovers. One small input with a superlinear or lasting shared effect is a different finding from sustained volume.
- Verdicts follow [../verification.md](../verification.md). Upstream caps, deployed topology, autoscaling, paid quotas or recovery behaviour outside the repo leave a finding at needs-validation.

## Computational amplification

### `superlinear-processing`

**What.** A small accepted input triggers catastrophic regex backtracking, deep nested parsing, recursive validation, symbolic evaluation, graph walks, template expansion, or adversarial sort/hash behaviour.

**Where to look.** Regexes with nested quantifiers or overlapping alternation (`(a+)+`, `(a|a)*`) run on user input; recursive descent parsers without a depth cap; JSON-schema `$ref` loops; template engines with include/macro recursion; hash tables keyed by attacker strings without a seeded hash.

**How to prove.** Derive the accepted depth or cardinality and the complexity, then time a few input sizes locally under a strict timeout and show the growth curve.

### `expansion-bomb`

**What.** Compressed, sparse, nested, aliased or encoded input grows far beyond the size that was checked on the wire or on disk.

**Where to look.** Zip/gzip/brotli inflate, archives within archives, image dimensions vs file size, fonts, office documents, YAML anchors and aliases, XML entity expansion, protocol header-compression tables. Limits must hold after every expansion step and across parser stages.

**How to prove.** A small bomb fixture under a memory-capped local process, showing the post-expansion size or the cap being hit where none exists in code.

### `downstream-query-amplification`

**What.** One small request fans out: wide scans, costly joins, unbounded sorts or aggregates, or a flood of calls to other services. The cause is a missing cap on page size, query depth, filter cardinality or expansion fields.

**Where to look.** GraphQL depth/alias/complexity, `?expand=` / `include=` parameters, `limit` taken from the client without a max, N+1 fan-out to other services, `ORDER BY` on unindexed columns from user input.

**How to prove.** Count queries or downstream calls per request locally, or show the unbounded parameter. Confirm authorization does not deliberately grant that same scope.

**Only a note.** A slow query over data the caller is entitled to scan, behind an effective page cap.

## Resource accumulation

### `unbounded-accumulation`

**What.** Bodies, out-of-order stream chunks, uploads, sessions, unique cache keys, metric labels, log fields, subscriptions or pending jobs pile up without a per-item and an aggregate cap.

**Where to look.** In-memory maps keyed by request data, metric labels from user values, reassembly buffers, session stores without expiry. Check cleanup on disconnect, timeout, cancel and partial parse.

**How to prove.** A bounded local loop showing state growing with attacker-chosen cardinality and never reclaimed.

### `handle-leak`

**What.** Malformed or cancelled work skips cleanup and keeps sockets, files, DB cursors, timers, subprocesses, temp files or object references.

**Where to look.** Error branches without `finally` / `defer` / `with` / RAII, early returns, exceptions between open and close, child processes not reaped.

**How to prove.** Repeat the bad input a bounded number of times locally and show the count of open handles rising inside a shared pool.

### `orphaned-work-after-cancel`

**What.** The client times out, disconnects, cancels, or fails authorization, control returns, but database, model, network or worker work keeps running.

**Where to look.** Context/deadline/abort signal not passed to DB drivers, HTTP clients, LLM calls or worker queues; `fire-and-forget` tasks started before the auth check.

**How to prove.** A deterministic cancel test showing the downstream mock still invoked or still running after cancel.

## Quotas and scheduling

### `pre-auth-cost-imbalance`

**What.** Costly parsing, key lookups, cryptography, decompression or outbound requests run before authentication and before the earliest size or rate gate.

**Where to look.** Middleware order: body parsing and decompression before auth, password hashing for unknown users, signature verification of huge payloads, fetching a remote JWKS on every bad token.

**How to prove.** Compare minimal requester effort with service cost, and check any upstream limit visible in config.

### `quota-accounting-gap`

**What.** Budget is counted on a dimension the attacker can change (IP, route, tenant, key prefix, task ID), so one principal escapes its budget or spends another's.

**Where to look.** Rate limiter keys, `X-Forwarded-For` trust, counters that overflow, distributed counters without atomic increments, counters reset on reconnect or account switch, retries not counted.

**How to prove.** A local test where one principal exceeds its quota by varying the key, or exhausts another principal's allocation.

### `shared-pool-starvation`

**What.** Low-priority or attacker-driven jobs hold shared locks, workers, DB connections, event-loop turns or scheduler priority that unrelated users need.

**Where to look.** Blocking calls on an async event loop, single global worker pools, jobs with no deadline, priority set by the client.

**How to prove.** Show a path that bypasses queue or concurrency fairness, or keeps a slot past its deadline, with a small local schedule.

## Failure and recovery

### `reachable-fatal-error`

**What.** Untrusted input reaches `panic`, `abort`, a fatal assertion, an unhandled exception, `process.exit`, a lock cycle or an infinite loop in a shared process.

**Where to look.** `unwrap()` / `expect()` on parsed input, `assert` on request data, unhandled promise rejections, `os.Exit` in handlers, `while` loops whose exit depends on input.

**How to prove.** The input and the crash locally. State the supervisor scope: one worker or the whole service. A restarted isolated worker lowers impact; the defect remains.

### `retry-storm`

**What.** Timeouts, dependency errors, half-processed messages or failed health checks cause synchronized or unbounded retries with no jitter, ceiling, circuit breaker or dedup.

**Where to look.** Retry loops without max attempts or backoff, health checks that restart everything at once, fail-open fallbacks that do more work.

**How to prove.** One bounded local failure source producing lasting aggregate work against mocks.

### `poison-record-blocking`

**What.** One malformed record fails again and again at the front of something shared: a queue, a partition, a migration, a startup scan, a recovery loop.

**Where to look.** Consumers that never skip or quarantine, offsets committed only on success, startup that crashes on one bad row. Check whether other tenants share the blocked unit.

**How to prove.** Insert one bad record locally and show the unit stuck for everyone behind it.

### `unsafe-recovery`

**What.** When the service restarts, falls back, cleans up or restores, it rebuilds state without limits, skips today's quotas, or puts back the very input that fails again.

**Where to look.** Replay-on-startup, cache warmers, restore jobs, fallback paths with no limits. Recovery is part of availability.

**How to prove.** A local restart loop or an unbounded rebuild shown with small data.

## Moves that apply to every class above

- Build one table per input: earliest accepted size and cardinality, work done before auth, downstream fan-out, persistence, which shared pool it uses, which limit and cleanup owns it, how it recovers.
- Compare per-object limits with aggregate limits. 10,000 legal one-byte items each pass the per-message cap, yet together they fill state shared by the tenant or the process.
- Run proofs only in a sandboxed fixture with tight caps on CPU, memory and time, using a few small input sizes. Replace external and paid calls with mocks. Stop the moment the missing bound or the missing cancellation shows.

## Checklist before reporting

1. Untrusted input, requester effort, the amplification or retained resource, the shared blast radius, and recovery. Missing limits with no concrete shared impact are hardening notes.
2. No upstream, parser, queue, tenant or framework bound in source stops the path. Unknown deployed controls mean needs-validation.
3. Superlinear: accepted complexity plus bounded local growth. Leak: repeatable retention after cleanup should have run. Fatal path: process and supervisor isolation identified.
4. Rank by low requester effort, unauthenticated reach, cross-tenant scope, persistence and poor recovery. Never validate by causing an outage.
5. Confirmed needs safe local proof and a meaningful shared effect. Otherwise needs-validation, naming what the owner must look at: the specific upstream limit, quota, topology or recovery behaviour.
