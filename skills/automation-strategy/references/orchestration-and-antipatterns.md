# Orchestration strategy & anti-patterns — depth for §4–§5

Engine-agnostic policy. These are the guarantees you *require of* an automation before it ships and
the failure modes you audit for when a fleet is breaking. The per-platform **recipes** (which node,
which toggle, exact retry settings) live in `../../automation-flows/SKILL.md` and each platform skill
— this file is the discipline, not the wiring.

## The orchestration guarantees

### 1. Idempotency & dedup

Event delivery is **at-least-once**: webhooks are re-sent, retries replay, users double-click. Assume
every event can arrive two or more times. A non-idempotent write executed twice = double charge,
duplicate row, duplicate email.

- Require a **stable dedup key** — the provider's event id or a natural external id, never a
  timestamp or a hash of "roughly the same thing".
- Check the key **before** any non-idempotent action; record it **after** success.
- Prefer idempotent operations where the platform/API allows (upsert-by-key beats blind insert;
  idempotency keys on payment APIs).

```text
Bad:  event → create record                    (re-delivery → two records)
Good: event → seen(key)? → if new: create → mark key seen
```

### 2. Error paths, retries & backoff

Every automation has a defined destination for failure. Classify the error first:

- **Transient** (network timeout, 429 rate-limit, 5xx) → retry with **exponential backoff + jitter**,
  a **max attempts cap**, and a total time budget. Respect `Retry-After` when present.
- **Permanent** (400, 401/403 auth, 404, validation) → do **not** retry; retrying just burns runs and
  delays the alert. Route straight to the dead-letter path.

Distinguishing the two is the single highest-leverage error decision — blind retry-everything is a
common cause of both runaway bills and masked auth failures.

### 3. Dead-letter

After retries are exhausted, the failed item must land somewhere **durable and inspectable** — a
queue, a table, the platform's "incomplete executions" store — with enough context (the payload, the
error, the timestamp) to diagnose and **replay** it. Failures dropped on the floor are silent data
loss; you find out when a customer does.

### 4. Observability & alerting

- Emit **success/failure counts** per automation; a run rate that quietly drops is a signal.
- **Heartbeat scheduled jobs and alert on silence.** A cron that stops firing produces no error — it
  produces *nothing*, which is the failure you never hear about. Alert when an expected run doesn't
  happen within its window (dead-man's-switch).
- Route alerts to a **named owner / on-call channel**, not an inbox nobody reads. An alert nobody
  receives is not observability.

### 5. Secrets handling

- Store credentials in the **platform credential store or a vault**, referenced by name — never
  pasted inline in a node/step where an export or a screenshot leaks them.
- **Least privilege** — scope each token to what the automation actually needs.
- **Rotation plan** — tokens expire; a rotation nobody owns becomes a 2 a.m. outage. Engineering
  detail lives in `../../secure-coding/SKILL.md`.

### 6. Versioning & environments

- Separate **dev/staging from prod**. Test against non-prod data; don't debug against live customers.
- **Export/snapshot before editing** a live automation — editing prod is a production change.
- Keep a **rollback**: the previous known-good version, and a way to get back to it fast.

### 7. Avoid fan-out storms

- **Cap concurrency**, batch where possible, and **rate-limit** outbound calls to respect downstream
  quotas.
- Watch for **echo loops**: flow A writes a record that triggers flow B that writes a record that
  triggers flow A. Break the cycle with a guard (a marker field, an event-source check).
- Guard against one event **fanning out into thousands** of downstream calls that trip rate limits or
  detonate the bill. Debounce bursts.

## Anti-patterns — detection & remediation

| Anti-pattern | How you notice it | Remediation |
| --- | --- | --- |
| **No error path** | first API blip and the run just stops; found out from a customer | define a failure destination + retry policy + alert before shipping |
| **Silent failure** | dashboards green, but the work isn't happening; false confidence | alert on failure AND on silence (heartbeat / dead-man's-switch) |
| **No kill-switch** | a misfiring flow floods a downstream system and there's no fast stop | every outward-writing automation gets a documented pause/disable toggle (and whoever's on-call knows where it is) |
| **Over-automation** | maintenance time exceeds the manual time it replaced | re-run the §1 gate; retire it or revert to a checklist |
| **Automating a broken process** | the automation "works" but the outputs are still wrong, just faster | stop, standardize the process on paper, then re-encode |
| **Hidden single point of failure** | it breaks when one person leaves or one personal token expires | service accounts, documented dependencies, no personal-account glue |
| **No owner** | nobody can say how it works or notices when it breaks | assign an owner + a one-page runbook (what it does, deps, how to pause, how to replay) |
| **Choosing platform by familiarity** | the bill "exploded"; billing unit mismatched the run shape | re-select by billing unit for the real shape (see platform matrix) |
| **Retry-everything** | runaway run counts, masked auth failures | classify transient vs permanent; only retry transient, with backoff + cap |
| **Secrets inline** | credentials visible in an export/screenshot; can't rotate cleanly | move to credential store/vault, reference by name, plan rotation |

## Fleet-health audit ("our automations keep breaking")

When someone arrives with a *fleet* that keeps breaking rather than one flow, walk this list — the
breakage is almost always a missing discipline, not a bad node:

1. **Inventory & ownership** — is there a list of every automation with a named owner? Orphans first.
2. **Error paths** — how many have a real failure destination + alert vs die silently?
3. **Idempotency** — which do non-idempotent writes with no dedup key? (double-processing symptoms)
4. **Observability** — is anything watching run rates and heartbeats, or do you learn from customers?
5. **Secrets/expiry** — any recent breaks that trace to an expired token or a personal account?
6. **Environments** — are people editing prod directly with no snapshot/rollback?
7. **Fan-out / loops** — any echo loops or bursts tripping rate limits?

Fix the systemic gap (usually error paths + observability + ownership) rather than patching flows one
at a time. Then feed the corrected guarantees into the build skill as requirements.
