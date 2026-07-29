---
name: scaling
description: "Use when traffic is growing or about to spike and the system bends under concurrency — deciding what to add and in what order (cache, connection pool, async queue, read replica, more instances) and proving it with a load test against explicit RPS and p95 targets rather than guessing. NOT making one slow request faster or profiling an N+1 (that is `performance`), NOT race-free Redis caches, locks and queue semantics (that is `redis`)."
tags: [scaling, capacity, load-testing, caching, read-replicas, pgbouncer, k6, devops]
recommends: [performance, redis, postgresdb, monitoring, deployment, backups, fly-io]
profiles: []
origin: risco
---

# Scaling: survive many requests at once

Performance makes one request faster. Scaling makes many requests survive at the same time. Different problem, different toolbox — don't reach for this one when a single endpoint is slow for a single user (that is `../performance/SKILL.md`).

The whole job in one line: **diagnose the bottleneck, apply the cheapest lever that moves it, re-measure under load.** Repeat until the next bottleneck appears or you hit your target.

**Prime directive: never add infrastructure without a measurement first.** A replica, a queue, or a third app instance you bought on a hunch costs money every month and usually moves the wrong tier. Measure, then add.

## Start here — order of operations

Levers are ordered by payoff per dollar. Caching is nearly free and wins biggest; replicas and autoscaling cost forever. Climb the ladder in order; stop the moment the symptom clears.

| Symptom | Likely bottleneck tier | First lever | Sibling that wires it |
|---|---|---|---|
| Slow *only* under load, fine solo | unknown — measure first | USE-method triage (Step 0) | `../monitoring/SKILL.md` |
| Same reads recomputed for everyone | app/DB doing repeat work | Lever 1 — cache | `../redis/SKILL.md` |
| `too many clients already` | DB connection slots | Lever 2 — pooler | `../postgresdb/SKILL.md` |
| Spiky writes time out / drop | synchronous write path | Lever 2 — async queue | `../redis/SKILL.md` |
| Reads dominate, primary CPU hot | DB read capacity | Lever 3 — read replica | `../postgresdb/SKILL.md` |
| All tiers healthy, just need throughput | app instance count | Lever 4 — horizontal / autoscale | `../deployment/SKILL.md` |

## Step 0 — find the bottleneck before you add anything

Use the **USE method** (Utilization, Saturation, Errors) on every resource — CPU, memory, disk, network, and the DB connection pool. For each one ask: how busy (U), how much is queued/waiting (S), and any errors (E).

- **Saturation predicts collapse earlier than utilization.** A CPU at 70% util with a growing run-queue is closer to falling over than one at 90% with no queue. Watch queue depth, run-queue length, and connection-pool wait time — those spike before throughput craters.
- **Read p95/p99, never the mean.** The mean hides the tail your users actually feel; if p50 is 80 ms and p95 is 4 s, a meaningful slice of traffic is having a bad time and the average lies about it.
- The dashboards, alerts, and SLOs that produce these numbers are `../monitoring/SKILL.md` / observability's job. Scaling *consumes* USE signals; it doesn't build the collectors.

Output of Step 0 is one sentence: "the bottleneck is the DB connection pool / app CPU / origin cache-miss rate." Don't proceed without it.

## Lever 1 — Caching (cheapest, do first)

Cache layers, outermost to innermost — each one removes work the layer behind it would have done:

| Layer | Removes | Typical TTL |
|---|---|---|
| CDN / edge | origin round-trip for static + cacheable HTML | minutes–hours |
| HTTP cache headers (`Cache-Control`, `ETag`) | re-downloads; enables 304s | per-resource |
| App cache (in-proc / Redis) | recomputed views, serialized payloads | seconds–minutes |
| Query-result cache | repeated identical DB reads | seconds |

- **Cache the expensive read, not the cheap one.** Caching a 2 ms lookup adds a network hop and an invalidation bug for nothing; cache the 400 ms aggregate everyone hits.
- **Target >80% hit ratio for general traffic** (static-heavy/CDN routinely hits 95%+). A ratio consistently **<60%** means a broken strategy — wrong cache keys, TTL too low, or churny data that shouldn't be cached.
- **Beware the cold-cache miss storm.** On deploy or cache flush, every request misses at once and stampedes the origin — the cache that was protecting you now amplifies the load. Mitigating that (stampede protection, single-flight, request coalescing) is cache *correctness* → `../redis/SKILL.md`.
- If the underlying query is just slow, caching only hides it. Fix the query — N+1, missing index — via `../performance/SKILL.md` before papering over it with TTL.

## Lever 2 — Connection pooling + queues

**Pool DB connections.** Each Postgres connection is a backend process with real memory cost; apps that open a connection per request exhaust `max_connections` fast.

```text
Bad:  app → opens a fresh DB connection per request → "too many clients already"
Good: app → PgBouncer (transaction mode) → small pool of reused server connections
```

- Use **transaction pooling** for stateless web apps: a server connection is held only for the duration of a transaction and released on COMMIT/ROLLBACK — reported real-world effect is roughly 100× effective connection capacity.
- **Sizing rule:** keep `(number_of_pools × default_pool_size) < max_connections − ~15` (leave headroom for superuser/admin slots). Set `default_pool_size ≈ 1.5–2× vCores` for CPU-bound OLTP — more connections than cores just adds context-switch contention, not throughput.
- **Gotcha — transaction pooling breaks session-scoped features:** prepared statements (pre-PG14 protocol), `SET` / session GUCs, advisory *session* locks, and `LISTEN/NOTIFY`. Route those to a session-pooling pool or refactor them out. Don't discover this in production.

**Shed spiky writes into a queue.** Queue-based load leveling puts a queue between a bursty producer and a constrained consumer so the consumer drains at its own steady rate; the queue absorbs the spike instead of the synchronous tier melting.

- Move anything that doesn't need a synchronous answer — emails, webhooks, thumbnails, exports — off the request path.
- Queue *semantics* (race-free rate limits, stalled-job recovery, fencing tokens, durable `SKIP LOCKED` queues) belong to `../redis/SKILL.md` and `../postgresdb/SKILL.md`. Scaling decides *that* you defer work; those decide it's done correctly.

## Lever 3 — Read replicas

Reach for a replica only when Step 0 says **reads dominate and the primary is read-saturated** — not as a reflex.

- **Replicas serve reads, never the source of truth for read-after-write.** Async streaming replication lags; a user who just wrote and immediately reads from a replica may see stale data. Route post-write reads (or that user's whole session for a window) to the primary, or use replica-lag-aware routing.
- A replica is **not** a write-scaling story and **not**, by itself, an HA/backup story. Writes still all hit one primary; durability and recovery are `../backups/SKILL.md`.
- Wiring the replication itself — `primary_conninfo`, slots, promotion — is `../postgresdb/SKILL.md`. Scaling decides *add a replica and route reads to it*; postgresdb makes it real.

## Lever 4 — Horizontal scaling & autoscaling

- **Make the app stateless first.** You can't horizontally scale what holds local state — in-memory sessions, sticky uploads on local disk, per-instance caches that must agree. Push session/state to Redis or the DB, then add instances freely.
- **Autoscale on the saturation metric that actually binds, not CPU alone.** If the real limit is DB connections, scaling app instances on CPU just opens *more* connections and topples the DB faster. Scale on the bottleneck Step 0 found.
- Choosing a host, rolling deploys, and the autoscaling dials are `../deployment/SKILL.md` plus the platform skill (`../fly-io/SKILL.md`, and siblings for railway/render/vercel). Scaling gives the strategy — how many and triggered by what; the platform gives the knobs.

## Prove it — load testing with k6

Don't claim the system survives. Measure that it does. **k6** (Go core, JS test scripts) reached v1.0.0 on 2025-04-28 under SemVer and is the default OSS load-test tool; the current v1 line is v1.7.x and v2.0.0 shipped in May 2026 (GrafanaCON 2026).

- **Thresholds are the test's pass/fail SLO** — codify the target so the run goes red on its own instead of you eyeballing a graph.
- **Test a prod-like target, never localhost.** Localhost has no network latency, no real DB, no CDN — it measures your laptop, not your system.
- Run a ladder, not one shot: **smoke → load → stress → spike → soak** (find the *knee* where latency turns vertical).

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up to 50 virtual users
    { duration: '3m', target: 50 },   // hold (steady-state load test)
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // SLO gate: 95% of requests under 500 ms
    http_req_failed: ['rate<0.01'],   // SLO gate: under 1% errors
  },
};

export default function () {
  const res = http.get(`${__ENV.TARGET_URL}/api/health`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

Full ladder (stage configs for each test type), CI gate snippet, and how to read the summary (p95/p99, `http_req_failed`, spotting the knee) are in **`references/load-testing-k6.md`**.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Scaling before measuring | You spend on the wrong tier; symptom persists | Step 0 USE triage, name the bottleneck first |
| Scaling a stateful app horizontally | Instances disagree; sessions vanish on routing | Make it stateless, externalize state, then scale |
| Caching cheap work / no TTL strategy | Adds a hop + invalidation bugs for no gain | Cache the expensive read; set deliberate TTLs |
| Load-testing localhost | Measures your laptop, not production | Test a prod-like target over the network |
| Reporting mean latency | Hides the tail users actually feel | Gate on p95/p99 |
| Read replica to absorb writes | Writes still hit one primary; you gain nothing | Replica is read-only; queue/shard writes |
| DB with no connection pooler | `too many clients already` under any spike | PgBouncer transaction mode + the sizing rule |
| Autoscaling on CPU while DB connections saturate | More instances = more connections = faster DB death | Autoscale on the binding saturation metric |

## Stop rule & cost

Scale to the *next* bottleneck, then re-measure — don't pre-buy capacity for traffic you don't have. Every lever has a price: caching is ~free, a pooler is cheap, a read replica and autoscaling cost every month and add operational surface. Climb one rung, re-run the load test, and stop when you clear the target. Survived, proven, no further — that's done.
