---
name: automation-flows
description: "Use when building or fixing a no-code automation on n8n, Make, or Zapier — trigger to multi-app steps with data mapping, dedup, retries and an error path — or picking the platform by billing unit (task vs credit vs execution). NOT a typed API client in code (that is api-connector-builder), NOT a webhook receiver in your own app (that is webhooks)."
tags: [automation, n8n, make, zapier, no-code, workflows, error-handling, integrations]
recommends: [automation-strategy, n8n, make, zapier, power-automate, webhooks, api-connector-builder, error-handling, stripe, notion-connector, google-workspace, whatsapp-telegram]
profiles: []
origin: risco
---

# Automation flows — glue many SaaS apps on a visual platform, with an error path that actually fires

You are building a working automation on a hosted visual platform: a trigger, a chain of app actions with branching and explicit data mapping, and an error-handling and retry strategy without which the flow is not done.

Your job is two things at once: **platform judgement** (pick n8n vs Make vs Zapier by the constraints) and a **buildable artifact** (an importable n8n workflow JSON, or a precise numbered build sheet for Make/Zapier, which have no portable export).

This skill stops the moment the right answer is real code. Writing a typed API client → `../api-connector-builder/SKILL.md`. Building the endpoint that *receives* a webhook in your own app → `../webhooks/SKILL.md`. Scripting one vendor directly → `../stripe/SKILL.md`, `../notion-connector/SKILL.md`, `../google-workspace/SKILL.md`, `../whatsapp-telegram/SKILL.md`.

## 1. Pick the platform

The single most expensive mistake is choosing on familiarity instead of cost model. The three platforms bill on fundamentally different units, and at volume that gap is 10×.

| Constraint | Zapier | Make | n8n |
| --- | --- | --- | --- |
| **Billing unit** (why it dominates cost) | per **task** — every action counts | per **credit** — each module action = 1 credit (was "operations" until 2025-08-27; converted 1:1) | per **execution** — whole run = 1, any step count |
| **Free tier** | 100 tasks/mo | 1,000 ops/mo | self-host free, unlimited execs |
| **Entry paid** | Pro ≈ $19.99/mo (billed annually), 750 tasks | Core ≈ $9/mo, 10k credits (billing unit became **credits** on 2025-08-27) | cloud Starter ≈ €20/mo (billed annually), 2,500 execs; self-host = $0 |
| **App breadth** (obscure-app signal) | ≈ 8,000+ integrations — widest | ≈ 1,500, often deeper per app | ≈ 1,000 nodes + generic HTTP node + code |
| **Self-host / data residency** | no | no | yes — your infra, your data |
| **Who maintains it** | non-technical-friendly | mid; visual but richer | technical; you run the box (n8n 2.0, stable Dec 2025, made isolated code execution the default — Code nodes run in sandboxed task runners) |

**Worked cost example.** A 10-step flow run 10,000×/month:
- Zapier: ~100,000 tasks (10 actions × 10k) → well past the Pro tier, into the high tiers.
- Make: ~100,000 credits → similar pressure.
- n8n: **10,000 executions** regardless of step count; self-hosted = **$0**.

For complex, high-volume flows, n8n's execution model can cut cost 80–90% vs Zapier.

Pricing and version figures move; re-check the **primary vendor pages** before quoting a customer (the `≈` is a hedge, not a guarantee): Zapier zapier.com/pricing, Make make.com/en/pricing, n8n n8n.io/pricing, and the n8n 2.0 release note blog.n8n.io/introducing-n8n-2-0. Make's switch to **credits** as the billing unit (2025-08-27) and n8n 2.0's **sandboxed-by-default code execution** (stable Dec 2025) are the two facts most likely to surprise someone who learned these tools a year ago.

Decision in one line per row: bill on the unit that matches your shape — many short flows favor task/op platforms; few long flows favor n8n. Obscure app you can't find a node for → Zapier. Raw HTTP / custom code / data must stay on your infra → n8n. Non-technical owner who never wants to SSH → Zapier or Make cloud.

## 2. Anatomy: trigger → steps → output

A flow has **exactly one trigger**. Then a chain of action steps. Map every field explicitly.

**Trigger: prefer webhook/push over polling.** A webhook trigger (Zapier *Catch Hook*, Make custom webhook, n8n Webhook node) fires on an inbound POST — near-instant. A polling trigger (Zapier *Retrieve Poll*) does a periodic GET; the interval depends on plan, **1–15 minutes between checks**. Polling costs latency, costs runs (it fires even when nothing changed), and can miss events between polls.

```text
Bad:  Trigger = "poll Airtable for new rows every 15 min"  → up to 15 min stale, burns runs on empty checks
Good: Trigger = Airtable "new record" webhook              → fires the instant the row lands, zero idle runs
```

**Map data explicitly. Never assume field names survive a hop.** The Typeform field `email` does not arrive at the Slack step called `email` — it arrives as a node-output reference you must wire by hand. Pin a real sample, look at the actual output keys, map from those.

**Add a guard early.** Put a filter/condition right after the trigger so junk events stop before they hit an external API: drop test payloads, require the fields you need to be non-empty, exit on the wrong event type.

## 3. Error handling — the spine

Every flow ships with an error path, because a flow without one is a silent failure waiting for the day the API hiccups and nobody notices the orders stopped syncing. Before you call a flow done you must be able to point at three things: where a failed run goes, how many times it retries, and who gets told. Full per-platform recipes (including the manual exponential-backoff loop) live in `references/error-handling.md`, and the retry/backoff theory under them in `../error-handling/SKILL.md`; here is the working core.

**n8n.** Build a dedicated **Error Workflow** that begins with the **Error Trigger** node — it runs only when a monitored workflow fails. Wire it to Slack/email/a log row, then set it as the main flow's `settings.errorWorkflow`. On risky nodes (anything hitting an external API) toggle **Retry On Fail** (Max Tries 3–5, set a Wait between tries) and, where a single failed item shouldn't kill the run, **Continue On Fail** (the node emits an error object instead of halting). n8n's built-in retry is **linear** — for true exponential backoff you build a wait/loop yourself (recipe in references).

**Make.** Attach an error handler to the risky module:
- **Break** — the production default. Sends the failed run to the **Incomplete Executions** queue (no data loss) and can auto-retry from there.
- **Resume** — supply a hard-coded fallback value and continue.
- **Ignore** — continue past a non-critical failure.
- **Commit** — end marked success. **Rollback** — end marked error and try to revert (not all modules support revert → can leave inconsistency).
- Always put a **filter before** any external-API module to validate data first.

**Zapier.** **Autoreplay** automatically replays failed steps, up to **5 retries** per step — but it's account-wide and turns OFF for a Zap once that Zap is published with its own custom error handling. **Filters** gate a Zap so it only proceeds when data is the right shape. **Paths** give if/then branching, including a fallback branch on error.

| Concern | n8n | Make | Zapier |
| --- | --- | --- | --- |
| Auto-retry | Retry On Fail (Max Tries 3–5, linear) | Break → Incomplete Executions auto-retry | Autoreplay (5/step, account-wide) |
| Don't halt on one bad item | Continue On Fail | Ignore / Resume | Filter to skip |
| Branch / fallback | IF + Error Workflow | router + Resume | Paths |
| Failure alert | Error Trigger → Slack/email | error handler → notify module | published Zap error notification |
| Exponential backoff | manual wait/loop | manual | not native |

## 4. Idempotency & dedup

Flows commonly **run twice for one event**: providers deliver webhooks at-least-once, and retries replay. If your flow does a non-idempotent write (create a charge, send an email, insert a row), a double-fire means a double charge or a duplicate record.

Fix: **dedup on a stable key** (the event id / external id) *before* any non-idempotent action.
- **n8n** — a check-before-write node or DB lookup keyed on the id; skip if seen.
- **Make** — a **data store** keyed on the id; check, then write the key.
- **Zapier** — a storage/lookup step (Storage by Zapier) keyed on the id; filter out if present.

```text
Bad:  webhook → create Notion row                       (Stripe retries the event → two rows)
Good: webhook → lookup event_id in store →
        filter "not seen" → create Notion row → save event_id
```

## 5. Test & observe before publish

- Pin a real sample payload (or use the platform's test execution) — don't reason about field names blindly.
- **Deliberately fire the error branch**: force a bad value, watch the failed run land where you expect.
- Confirm the alert **actually arrives** — send the test Slack/email and see it in the channel, not just "it should fire".
- Re-send the *same* event and confirm the dedup guard blocks the second run.
- Only then publish. (On Zapier, remember publishing with custom error handling turns Autoreplay off for that Zap.)

## 6. Emit the artifact

**If n8n is chosen, produce an importable workflow JSON** the user can paste into *Import from File/Clipboard*. It must have a non-empty `nodes` array (including a trigger node), a `connections` object, and `settings.errorWorkflow` pointing at the Error Workflow. Reference credentials by the n8n **credential store**, never paste secrets inline. Full schema and a minimal trigger→action→error example: `references/n8n-workflow-json.md`.

**If Make or Zapier is chosen, produce a numbered build sheet** — neither has a portable export you can hand over. One row per step: `# | app | action | field mapping (source → target) | error directive`. End with the trigger type and the dedup key.

Run `scripts/verify.sh` on any JSON you emit: read-only, no network, no credentials — it parses the file and checks a non-empty `nodes` array, a `connections` object, and ≥1 trigger node (exits 0 on an empty target).

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| No error path | First API hiccup, the flow dies silently; you find out from an angry customer | Wire the platform's error handler + a real alert before shipping |
| Polling when a webhook exists | 1–15 min stale, burns runs on empty checks | Use the push/webhook trigger |
| 12-step branching logic crammed into Zapier | Task billing explodes; logic gets unmaintainable | Move complex/high-volume logic to n8n |
| Blind field mapping | `email` ≠ the field the next step calls `email`; data silently lands empty | Pin a sample, map from real output keys |
| Non-idempotent write, no dedup | At-least-once delivery → double charge / duplicate row | Dedup on event id before the write |
| Secrets pasted inline in a node | Leaked in exports, unrotatable, shared everywhere | Use the platform credential store, reference by name |
| One mega-flow doing everything | Unreadable, untestable, one failure nukes all | Split: trigger → sub-flow per concern |
| Choosing platform by familiarity | Bill 10× higher than the right unit; "my automation bill exploded" | Pick by billing unit (task vs op vs execution) up front |
