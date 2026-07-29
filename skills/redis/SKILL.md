---
name: redis
description: "Use when using Redis or any Redis-protocol store (Valkey, ElastiCache, Upstash, Dragonfly, Memorystore) as a cache, queue, rate limiter or distributed lock and it has to be CORRECT rather than merely connected — stampede-proof caching, locks that cannot release someone else's hold, race-free rate limits, and jobs that survive a worker crash. NOT durable SQL queues with SELECT FOR UPDATE SKIP LOCKED (that is `postgresdb`), NOT vector similarity search over embeddings (that is `vector-db`)."
tags: [redis, valkey, cache, rate-limiting, distributed-locks, queues, bullmq, streams, lua, data-infra]
recommends: [postgresdb, vector-db, clickhouse-analytics, scaling, nodejs, fly-io]
profiles: []
origin: risco
---

# Redis — cache, lock, rate limiter, queue done correctly

Redis is four primitives wearing one server: a **cache**, a **distributed lock**, a **rate
limiter**, and a **job queue**. Each has a correctness contract that has nothing to do with
whether `SET` returns `OK`. You almost certainly already "have Redis working" — a value goes
in, a value comes out. What you do not yet have is a cache that won't stampede your database, a
lock that won't release someone else's hold, a rate limiter that survives concurrent requests,
and a queue whose jobs aren't silently lost when a worker dies. This skill is engine- and
pattern-level, **client-SDK-agnostic**: examples are `redis-cli` and Lua, so they hold across
node-redis, ioredis, redis-py, go-redis, and Lettuce. Every pattern applies unchanged to Valkey
and any Redis-protocol store, since Valkey is a BSD fork of Redis 7.2 and stays protocol-compatible.

## When to use / When NOT

**Use when you are:**

- Adding or reviewing a **cache**: TTL strategy, cache-aside vs write-through, key naming,
  stampede/thundering-herd prevention, negative caching, invalidation.
- Building a **distributed lock**: "only one worker does X", cron de-duplication, leader-ish
  mutual exclusion — the `SET NX PX` + Lua-release + fencing-token contract, and the Redlock call.
- Building a **rate limiter**: per-user/IP/API-key throttling (fixed window, sliding-window log,
  sliding-window counter, token bucket) and why naive `INCR`+`EXPIRE` is a race.
- Running a **queue / background jobs on Redis**: Lists vs Streams vs a library (BullMQ, Sidekiq,
  RQ, Celery), at-least-once delivery, acks, stalled-job recovery, idempotency.
- Deciding **eviction & persistence**: `maxmemory-policy`, RDB vs AOF, cache mode vs database mode.
- Reviewing Redis code for foot-guns: `KEYS *`, unbounded keys, non-atomic read-modify-write,
  missing TTL, a lock released by the wrong owner.

**NOT for (route instead):**

- Durable SQL queue (`SELECT … FOR UPDATE SKIP LOCKED`), engine-level SQL caching →
  [`../postgresdb/SKILL.md`](../postgresdb/SKILL.md). Boundary: if the *durable store* is the
  queue, that's postgresdb; if *Redis* is the queue, you're here.
- Vector similarity / semantic search as the primary job →
  [`../vector-db/SKILL.md`](../vector-db/SKILL.md). Redis 8 vector sets are only *noted* here.
- Analytical / clickstream event store → [`../clickhouse-analytics/SKILL.md`](../clickhouse-analytics/SKILL.md).
- System-level capacity / load strategy, and app/CDN/HTTP-layer caching (Cache-Control, ISR, edge) →
  [`../scaling/SKILL.md`](../scaling/SKILL.md). This skill owns the Redis-specific data contract underneath.
- Provisioning a managed Redis (cluster sizing, dashboards) →
  [`../fly-io/SKILL.md`](../fly-io/SKILL.md) / [`../aws-essentials/SKILL.md`](../aws-essentials/SKILL.md).
  This skill gives the client-side contract, not console clicks.
- Language-runtime async/job concepts unrelated to Redis → [`../nodejs/SKILL.md`](../nodejs/SKILL.md)
  or your language skill.

## Non-negotiables

1. **Every cache key has a TTL.** No TTL in a cache = a memory leak that eventually evicts or 500s.
2. **Never `KEYS *` in production — use `SCAN`.** `KEYS` is O(N) and blocks the single thread;
   one bad pattern freezes every client.
3. **Read-modify-write must be atomic.** App-side `GET` then `SET`/`INCR` races under concurrency.
   Use one Lua `EVAL`, a single atomic command, or `WATCH`/`MULTI`.
4. **A lock = random token + `PX` + Lua compare-and-delete.** Plain `DEL` releases whoever holds it
   now (maybe not you); a lock with no `PX` is held forever if the owner crashes.
5. **Pick `maxmemory-policy` deliberately.** The default `noeviction` makes a full cache fail every
   write — correct for a database, fatal for a cache.
6. **A queue must ack and recover.** `RPOP` straight into a worker loses the job if the worker dies
   mid-task; use a processing list or Streams consumer groups.
7. **Cap unbounded structures.** Lists grow forever without `LTRIM`; streams without `MAXLEN ~`.
8. **One Lua = one short atomic step.** Redis is single-threaded; a long script or huge `MULTI/EXEC`
   blocks *all* clients, not just yours.
9. **Namespace keys** as `svc:entity:id` (e.g. `cart:user:42`) so scans, eviction, and humans can reason.
10. **Know cache vs database durability before choosing persistence.** Cache = lose-it-and-rebuild;
    database = RDB/AOF and `noeviction`. Decide which Redis is *before* you tune it.

## Decision table — which primitive, which structure

| Need | Structure | Canonical commands | The one gotcha |
| --- | --- | --- | --- |
| Cache | string / hash + TTL | `SET k v EX 300` / `GETEX` / `HSET`+`EXPIRE` | stampede on expiry |
| Lock | string + random token | `SET k tok NX PX 30000` + Lua compare-and-`DEL` | wrong-owner release |
| Rate limit | string / zset / hash | one atomic `EVAL` (window/log/bucket) | lost `EXPIRE` → immortal counter |
| Queue (simple) | list | `LMOVE src proc LEFT RIGHT` / `BRPOPLPUSH` | job loss on crash without a processing copy |
| Queue (reliable) | stream | `XADD` / `XREADGROUP` / `XACK` / `XAUTOCLAIM` | unacked PEL grows unbounded |

## Caching

**Namespace + TTL with jitter.** A fixed TTL on a batch of keys written together synchronizes their
expiry — they all die in the same second and stampede the origin at once. Add jitter.

```bash
# Bad: 1000 keys warmed in a loop with the same TTL all expire together
SET product:42 "$json" EX 300
# Good: spread expiry with per-key jitter (300s ± up to 60s)
SET product:42 "$json" EX $(( 300 + RANDOM % 60 ))
```

**Cache-aside (read path).** *Why:* it is the default for read-heavy data; the trap is forgetting
the TTL and forgetting to cache the miss.

```text
# Bad: cache only hits, never the miss → every request for an absent id hits the DB
val = GET product:42
if val == nil: val = db.fetch(42); SET product:42 val EX 300   # absent rows still hammer the DB

# Good: cache-aside with negative caching
val = GET product:42
if val == "__MISS__": return null                              # cached miss, no DB call
if val == nil:
    val = db.fetch(42)
    if val == null: SET product:42 "__MISS__" EX 30            # short negative TTL
    else:           SET product:42 val EX 300
```

**Stampede prevention.** When a hot key expires, N concurrent requests all miss and hammer the
origin. Two mitigations:

- **Recompute lock** — one request rebuilds, the rest briefly serve stale or wait. *The lock TTL
  must exceed worst-case origin latency*, or two requests rebuild anyway.

  ```bash
  # On miss, try to claim the rebuild; only the winner recomputes
  SET product:42:lock 1 NX PX 5000   # 5s > slowest DB rebuild
  # winner: rebuild, SET product:42, then DEL product:42:lock
  # losers: serve last-known value or retry after a short sleep
  ```

- **Probabilistic early expiration (XFetch)** — refresh *before* TTL with rising probability so one
  request renews early while others still hit a warm key. Math + write-through/read-through/
  write-behind in [`references/caching.md`](references/caching.md).

**Invalidation:** on write, either delete the key (next read rebuilds) or write-through. Never rely on
manual invalidation *instead of* a TTL — you will miss a path and serve stale forever.

## Distributed locks

```bash
# Bad: GET-then-DEL races — between your GET and DEL the lock can expire and a NEW owner takes it,
#      and your DEL frees THEIR lock.
GET resource:lock        # == my token?
DEL resource:lock        # ← may delete someone else's lock

# Good: claim with a random token + PX, release only if the token is still mine (atomic Lua).
SET resource:lock "$TOKEN" NX PX 30000     # NX = only if absent; PX = auto-expire so a crash frees it
```

Release **must** be a compare-and-delete in one Lua step:

```lua
-- KEYS[1] = lock key, ARGV[1] = my token. Returns 1 if I held and released it, else 0.
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
```

**TTL vs work duration.** If the protected work can outlast `PX`, the lock expires mid-task and a
second worker starts. Either size `PX` above the worst case, or run a watchdog that renews the TTL
(again via a token-checked Lua `PEXPIRE`) while work continues — never blindly `PEXPIRE`.

**Fencing tokens.** A GC pause or a long syscall can freeze the lock holder *past* expiry; another
worker acquires, then the paused one wakes and writes — both think they hold the lock. The only fix
is a **fencing token**: a monotonically increasing number issued with the lock and checked by the
protected resource, which rejects any write carrying a stale token. No Redis lock alone provides this.

> **Redlock decision.** Single-instance `SET NX PX` is fine when occasional double-execution is
> *tolerable* (idempotent work, best-effort cron de-dup). For *hard* mutual exclusion, a single
> Redis lock is not enough and multi-instance Redlock is contested (it assumes bounded clock drift
> and no long pauses) — **fence the resource or use a lease/consensus system**. Full Redlock
> walk-through and critique in [`references/locks-and-rate-limiting.md`](references/locks-and-rate-limiting.md).

## Rate limiting

```text
# Bad: GET/INCR then EXPIRE as two steps. If the process dies (or loses the race) between INCR and
#      EXPIRE, the key has NO TTL and counts forever — the user is throttled permanently.
n = INCR rl:user:42
if n == 1: EXPIRE rl:user:42 60     # ← may never run
```

Fixed window, done atomically in one `EVAL`:

```lua
-- KEYS[1] = counter, ARGV[1] = limit, ARGV[2] = window seconds. Returns 1 = allow, 0 = deny.
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end   -- TTL set atomically with the first hit
if n > tonumber(ARGV[1]) then return 0 end
return 1
```

Fixed window allows up to 2× the limit across a boundary. For smoother limits:

- **Sliding-window log** — a sorted set scored by timestamp, pruned and counted in one Lua:
  `ZREMRANGEBYSCORE` (drop entries older than the window) → `ZCARD` (count) → `ZADD` (record now) →
  `EXPIRE`. Exact, but O(requests) memory per key.
- **Token bucket** — a hash holding `{tokens, last_refill}`; refill by elapsed time and decrement,
  all in one Lua. Allows bursts up to bucket size, then a steady rate. Smallest memory.

Choose by accuracy-vs-memory; full Lua for all four in
[`references/locks-and-rate-limiting.md`](references/locks-and-rate-limiting.md).

## Queues

| Option | When | Acks / recovery |
| --- | --- | --- |
| **List** | simplest at-least-once, low volume | manual: processing list + requeue stalled |
| **Stream** | reliable jobs, consumer groups, native acks | `XACK` + `XAUTOCLAIM` for stalled/pending |
| **Library** (BullMQ/Sidekiq/RQ/Celery) | you want retries, scheduling, a dashboard | built-in; don't hand-roll |

**Reliable list:** never `RPOP` straight into the worker — a crash mid-task loses the job. Move it to
a per-worker processing list atomically, then ack by removing it.

```bash
job=$(redis-cli LMOVE jobs jobs:proc:w1 LEFT RIGHT)   # atomic: pop from jobs, push to processing
# ... do work (idempotently) ...
redis-cli LREM jobs:proc:w1 1 "$job"                  # ack: remove from processing
# a reaper requeues anything left in jobs:proc:* after a worker dies
```

**Streams (preferred for reliable jobs):** consumer groups give per-message acks and a Pending
Entries List for recovery.

```bash
redis-cli XGROUP CREATE jobs g1 '$' MKSTREAM
redis-cli XREADGROUP GROUP g1 worker1 COUNT 10 BLOCK 5000 STREAMS jobs '>'
# ... process ...
redis-cli XACK jobs g1 "$id"                          # ack a done message
redis-cli XAUTOCLAIM jobs g1 worker2 60000 0          # reclaim messages idle > 60s (stalled worker)
```

Delivery is **at-least-once**: a message can be reprocessed after a crash, so make handlers
idempotent (dedupe on a job id / idempotency key). Reach for **BullMQ** (TypeScript; stalled-job lock
renewal via `lockDuration`/`lockRenewTime`), **Sidekiq** (Ruby), or **RQ**/**Celery** (Python) when
you want retries, delays, and a dashboard — don't reinvent them. Full implementations, DLQ, and the
library comparison in [`references/queues.md`](references/queues.md).

## Eviction & persistence

| `maxmemory-policy` | Behavior | Use for |
| --- | --- | --- |
| `noeviction` (default) | writes fail when full | Redis-as-database (durable data you can't drop) |
| `allkeys-lru` / `allkeys-lfu` | evict any key by recency / frequency | a pure cache (every key is disposable) |
| `volatile-lru` / `volatile-ttl` / `volatile-lfu` | evict **only keys that have a TTL** | mixed: durable keys without TTL stay |

A "cache" running `noeviction` with no TTLs is a memory leak that starts 500ing writes when full —
the single most common Redis incident. Set `maxmemory` *and* an `allkeys-*` policy for a cache.

**Persistence:** RDB = periodic point-in-time snapshots (fast restart, can lose the last interval);
AOF = append every write (durable, slower, larger). A pure cache often needs *neither* — losing it
just rebuilds from the origin. Decide cache-mode vs database-mode first, then persistence follows.

## Anti-patterns → STOP

| Rationalization | What actually happens | Do instead |
| --- | --- | --- |
| "`INCR` then `EXPIRE` is fine" | a lost `EXPIRE` leaves a TTL-less counter → immortal throttle | one atomic `EVAL` (set TTL when `n == 1`) |
| "I'll `GET` then `DEL` the lock" | races; frees a *different* owner's lock | random token + Lua compare-and-delete |
| "`KEYS user:*` to find my keys" | O(N), blocks the single thread, freezes all clients | `SCAN MATCH user:* COUNT 100` |
| "No TTL, I'll invalidate manually" | you miss a path → stale forever + unbounded memory | TTL on every cache key, always |
| "Redlock means the lock is safe" | a GC pause double-acquires; clock-drift assumptions | fence the resource, or accept double-run on idempotent work |
| "`RPOP` the job into the worker" | worker dies mid-task → job vanishes | `LMOVE` to a processing list, or Streams + `XACK` |
| "Big `MULTI` / long Lua = throughput" | single thread blocks every client for the duration | keep each atomic step short; chunk the work |
| "Fixed-window limiter is exact" | allows ~2× the limit across the window boundary | sliding-window log or token bucket if exactness matters |

## Quick reference

```bash
# Cache:      SET k v EX 300 | GETEX k EX 300 | DEL k | SCAN 0 MATCH 'product:*' COUNT 100
# Lock:       SET k tok NX PX 30000  (release via the Lua compare-and-delete above)
# Rate limit: EVAL "<lua>" 1 rl:user:42 100 60   (limit 100 / 60s)
# Queue:      LMOVE jobs jobs:proc LEFT RIGHT | LREM jobs:proc 1 "$job"
#             XADD jobs '*' field v | XREADGROUP ... | XACK | XAUTOCLAIM

# Diagnostics (read-only):
redis-cli INFO memory          # used_memory, maxmemory, evicted_keys
redis-cli --bigkeys            # find the keys eating your memory
redis-cli SLOWLOG GET 10       # slowest recent commands
redis-cli OBJECT FREQ mykey    # access frequency (needs allkeys-lfu)
redis-cli MEMORY USAGE mykey   # bytes for one key
redis-cli SCAN 0 MATCH 'sess:*' COUNT 100   # never KEYS in prod
```

`scripts/verify.sh` scans your project for the high-confidence foot-guns (`KEYS *` in source,
lock release without a token compare, `INCR` with no `EXPIRE`, `maxmemory` with no policy). It is
read-only, never connects to a server, and exits 0 when no Redis usage is found.

## Project grounding

Record this project's Redis decisions in `02-DOCS/wiki/stack/redis.md` (recorded, not gated — same
convention `postgresdb` uses): which primitive(s) you run, the `maxmemory-policy`, persistence
(RDB/AOF/none), the client library, and any lock/rate-limit Lua you depend on. Future agents read
this before touching the cache.

## See Also

- [`references/caching.md`](references/caching.md) — read/write-through, write-behind, XFetch math, negative caching, hot/big keys.
- [`references/locks-and-rate-limiting.md`](references/locks-and-rate-limiting.md) — full Redlock + critique + fencing, watchdog renewal, all four rate-limit algorithms with Lua.
- [`references/queues.md`](references/queues.md) — full reliable-list + Streams implementations, `XAUTOCLAIM` recovery, DLQ, BullMQ/Sidekiq/RQ/Celery detail, idempotency.
- Siblings: [`../postgresdb/SKILL.md`](../postgresdb/SKILL.md) · [`../vector-db/SKILL.md`](../vector-db/SKILL.md) · [`../scaling/SKILL.md`](../scaling/SKILL.md) · [`../clickhouse-analytics/SKILL.md`](../clickhouse-analytics/SKILL.md).
