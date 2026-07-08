---
name: automation-strategy
description: "Use when deciding whether a process is worth automating, choosing an automation platform, sizing ROI / build-vs-buy, designing an automation strategy, or diagnosing why a fleet of automations keeps breaking — the discipline layer that runs BEFORE anyone builds. Triggers: 'should we automate this?', 'is this worth automating', 'n8n vs Make vs Zapier vs Power Automate — which do we pick', 'custom script or no-code platform', \"what's the ROI on automating X\", 'design our automation strategy', 'our automations keep breaking', 'automating this cost more than it saved', '¿merece la pena automatizar esto?', 'qué plataforma de automatización elegimos'. NOT building the flow on a platform (design + importable artifact is automation-flows; driving a live platform API/MCP is the n8n / make / zapier / power-automate skills), NOT a typed API client with auth/pagination/backoff (api-connector-builder), NOT the inbound endpoint that receives webhook events in your app (webhooks)."
tags: [automation, strategy, roi, build-vs-buy, platform-selection, orchestration, idempotency, n8n, make, zapier, power-automate]
recommends: [automation-flows, n8n, make, zapier, power-automate]
profiles: [core, full]
origin: risco
---

# Automation strategy — decide whether, where, and how before anyone builds

This is the discipline layer of the automation suite. It answers three questions that come *before* the first node is wired: **should this be automated at all?**, **on what platform, and is a platform even the right tool vs code?**, and **what orchestration guarantees does every automation have to meet so the fleet doesn't rot?** No platform API, no importable JSON, no code lives here — the moment the decision is made, you route to the skill that builds it.

Building the flow (design + importable artifact) → `../automation-flows/SKILL.md`. Driving a specific platform's live API/MCP → `../n8n/SKILL.md`, `../make/SKILL.md`, `../zapier/SKILL.md`, `../power-automate/SKILL.md`. A typed API client in code → `../api-connector-builder/SKILL.md`. Receiving webhooks in your own app → `../webhooks/SKILL.md`.

Every fact about pricing and platform capability below moves fast. Treat the `≈` figures as hedges and re-check the vendor page at author time; the honest limits (Zapier can't create Zaps via public API; Power Automate can't create end-user "My flows" cleanly via API) are called out where they matter and expanded in the references.

## 1. Should you automate at all?

Most "we should automate this" instincts are wrong — not because automation is bad, but because the process underneath isn't ready, or the payoff isn't there. Gate on four factors, all of them, before writing a line:

- **Frequency** — how many times per week/month does this run? A once-a-quarter task rarely earns its maintenance cost.
- **Time saved per run** — minutes of human toil removed each time. Two minutes × 1,000 runs beats an hour × 3.
- **Error rate of doing it by hand** — high manual error rate (typos, missed steps, missed SLAs) is often a bigger win than the time saved. Automation's real product is *consistency*, not just speed.
- **Stability of the process** — how often do the steps, the systems, or the rules change? An unstable process is the one thing that turns automation into a liability.

Rough gate: automate when it is **frequent AND stable AND** either saves meaningful time-per-run *or* removes a costly manual error rate. If it's frequent but unstable, or high-value but requires judgment on every run, do not automate yet — see below. Full scoring rubric with worked numbers: `references/automate-decision-and-roi.md`.

### The trap: automating a broken or unstable process

Automating a bad process just makes you produce bad output faster, and now nobody can see the badness because a machine hides it. **Fix and standardize the process first, then automate the standardized version.** If the steps aren't written down the same way twice, if it "depends", if three people do it three ways — you are not ready. Standardize on paper, run it manually a few times against the written steps, *then* encode it. Automating chaos gives you automated chaos with a maintenance bill.

### Human-in-the-loop: what you deliberately do NOT fully automate

Some steps should stay manual by design, wrapped in an approval gate rather than removed:

- **Judgment calls** — pricing exceptions, hiring decisions, content that carries brand/legal risk, anything where "usually right" isn't good enough.
- **Irreversible or high-blast-radius actions** — sending money, deleting data, emailing your whole list, publishing publicly, terminating accounts. Automate the *preparation*, require a human click for the *commit*.
- **Low-frequency, high-stakes** — the payoff is small and the cost of a silent wrong run is huge.

The pattern is *assisted*, not autonomous: the automation gathers, drafts, and stages; a human approves the commit. Cheap insurance against the day the automation is confidently wrong at scale.

## 2. ROI and build-vs-buy

### Payback math

```text
build cost      = hours to build  × loaded hourly rate
monthly saving  = (runs/month × time saved per run × loaded rate)
                  − monthly platform/run cost
                  − monthly maintenance cost   ← the line people forget
payback (months)= build cost / monthly saving
```

Two rules of thumb: if **payback > ~12 months**, the process is probably too rare or too cheap to bother; if **maintenance eats > ~30–50% of the gross saving**, you've built a pet, not a tool. Maintenance is not optional — APIs change, auth expires, edge cases surface. Budget it explicitly or the ROI is fiction. Worked examples: `references/automate-decision-and-roi.md`.

### No/low-code platform vs custom code

| Choose a no/low-code platform when… | Choose custom code when… |
| --- | --- |
| Gluing 2–8 SaaS apps with pre-built connectors | Logic is genuinely complex, algorithmic, or stateful |
| Business owner needs to read/edit the flow | High volume where per-run platform billing dominates TCO |
| Speed to first version matters more than control | You need version control, tests, code review, CI on the logic |
| Volume is modest and connectors exist | The vendor has no connector and you need deep API control |

The honest middle: platforms win on **time-to-first-version and readability**; code wins on **complex logic, testability, and cost at scale**. Many mature setups are hybrid — a platform orchestrates and a small custom service (or `api-connector-builder` client) does the hard part.

### Total cost of ownership

TCO is not the sticker price. Count: the **platform bill under your real volume and its billing unit** (this is where surprises live — see §3), build time, ongoing maintenance, the cost of an outage when it fails silently, and the switching cost if you outgrow the platform. A "free" automation that a senior engineer babysits monthly is not free.

## 3. Platform selection

Pick on **billing unit first** — it's the axis that dictates cost at scale, and choosing on familiarity instead is the classic 10× mistake. Then filter on data residency, ecosystem, programmatic maturity, and portability. This is a routing decision: once chosen, hand off to that platform's skill.

| Axis | n8n | Make | Zapier | Power Automate |
| --- | --- | --- | --- | --- |
| **Billing unit** | per **execution** (whole run = 1, any # of steps); self-host = $0 | per **credit** (each module action = 1; was "operations", renamed 2025-08-27) | per **task** (every action counts) | per **user** or per **flow** (premium); bundled with many M365 plans |
| **Best cost shape** | few long/complex flows, high volume | moderate multi-step flows | many short simple flows | teams already paying for M365 |
| **Self-host / data residency** | **yes** — your infra, your data | no (EU/US regions only) | no | Microsoft cloud / Dataverse regions |
| **Ecosystem fit** | technical teams, raw HTTP, code nodes | mid-market, deep per-app modules | widest app catalog (~9,000+) | **native to Microsoft 365** — Teams, SharePoint, Outlook, Dataverse |
| **Programmatic + MCP maturity** | public REST API to CRUD workflows; community MCP; strongest for code-driven ops | management API + MCP support maturing | rich API for actions + Zapier MCP to expose actions to agents — **but no public API to create Zaps** | Flow management APIs + solutions/ARM — **but no clean public API to create end-user "My flows"** |
| **Portability** | high — export/import JSON + self-hostable runtime | medium — blueprint export/import, but runs only on Make | low — no portable export | low — tied to MS solutions |

**Routing shortcuts:** already living in Microsoft 365 → **Power Automate** (`../power-automate/SKILL.md`). Data must stay on your own infra, or high volume where execution-billing wins → **n8n** (`../n8n/SKILL.md`). Obscure app, non-technical owner → **Zapier** (`../zapier/SKILL.md`). Deep per-app modules, mid volume → **Make** (`../make/SKILL.md`).

**Two capability limits to state honestly, not paper over:** you can drive Zapier's actions programmatically and via MCP, but you **cannot create a Zap through a public API** — Zap authoring is UI-only. Power Automate exposes flow *management* and solution deployment, but there is **no clean public API to author an end-user's personal "My flows"**. If a plan depends on API-creating either, the plan is wrong. Full matrix, MCP notes, and caveats: `references/platform-selection-matrix.md`.

## 4. Orchestration strategy (engine-agnostic)

These are the guarantees every automation must meet regardless of platform. This is the *policy*; the per-platform *recipe* lives in `../automation-flows/SKILL.md` and the platform skills. Deep dive: `references/orchestration-and-antipatterns.md`.

- **Idempotency & dedup.** Delivery is at-least-once and retries replay; assume every event can arrive twice. Require a **stable dedup key** (event id / external id) checked *before* any non-idempotent write (charge, email, insert). No dedup on a non-idempotent write = duplicate charges waiting to happen.
- **Error paths, retries & backoff.** Every automation has a defined destination for failure. Retry **transient** errors (timeouts, 429/5xx) with backoff and a cap; do **not** retry **permanent** errors (400/validation) — route them out. A flow with no error path isn't finished.
- **Dead-letter.** After retries are exhausted, the failed item lands in a durable place a human can inspect and replay — a queue, a table, an "incomplete executions" store. Dropped-on-the-floor failures are invisible data loss.
- **Observability & alerting.** Emit success/failure counts; put a **heartbeat on scheduled jobs and alert on silence** (a cron that stops firing is the failure you never hear about). Route alerts to a named owner, not a dead inbox.
- **Secrets handling.** Credentials in the platform's credential store / a vault, referenced by name — never pasted inline where an export leaks them. Least privilege, and a rotation plan. Engineering detail → `../secure-coding/SKILL.md`.
- **Versioning & environments.** Separate **dev/staging from prod**; export before you edit; keep a rollback. Changes to a live automation are production changes and deserve the same care.
- **Avoid fan-out storms.** Cap concurrency, batch, and rate-limit. Watch for **echo loops** (flow A writes a record that triggers flow B that triggers flow A) and for a single event fanning out into thousands of downstream calls that trip rate limits or blow the bill.

## 5. Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| **No error path** | First API hiccup, the run dies; you learn from an angry customer | Define a failure destination + alert before shipping |
| **Silent failure** | Failures that don't alert erode trust worse than no automation — everyone assumes it worked | Alert on failure *and* on silence (heartbeat) |
| **No kill-switch** | When it misfires at scale, there's no fast way to stop the bleeding | Every outward-writing automation gets a documented pause/disable toggle |
| **Over-automation** | Automating rare / low-value / judgment work costs more to maintain than doing it by hand | Gate on §1; leave judgment steps human-in-the-loop |
| **Automating a broken process** | You produce bad output faster and hide the badness behind a machine | Standardize the process first, then encode it |
| **Hidden single point of failure** | One personal token / one undocumented flow everyone depends on | Service accounts, documented dependencies, no personal-account glue |
| **No owner** | Orphaned automations rot; nobody notices the break or knows how it works | Name an owner + a one-page runbook per automation |
| **Choosing platform by familiarity** | Bill 10× higher than the right billing unit; "our automation bill exploded" | Pick by billing unit for your run shape (§3) |

## Related skills

- `../automation-flows/SKILL.md` — **build layer**: designs the flow and emits the importable artifact once this skill has decided *whether* and *where*. Strategy decides; automation-flows designs.
- `../n8n/SKILL.md`, `../make/SKILL.md`, `../zapier/SKILL.md`, `../power-automate/SKILL.md` — **operate layer**: drive that platform's live API/MCP to CRUD, activate, and run. Route here after §3.
- `../api-connector-builder/SKILL.md` — when the answer is custom code, not a platform: typed client with auth/pagination/backoff.
- `../webhooks/SKILL.md` — when you need to *receive* events in your own app (this skill treats webhooks as triggers, it doesn't build the receiver).
- `../secure-coding/SKILL.md` — secrets/rotation engineering behind the orchestration policy in §4.

## Checklist

- [ ] Ran the §1 gate: frequency × time-saved × error-rate × **stability** — and confirmed the process is standardized, not chaos being paved.
- [ ] Identified any judgment / irreversible / high-blast-radius step and kept it human-in-the-loop with an approval gate.
- [ ] Computed payback including **maintenance**, and confirmed it's under the rule-of-thumb ceiling.
- [ ] Decided platform vs custom code on the build-vs-buy criteria, not on what's familiar.
- [ ] Chose the platform by **billing unit for the real run shape**, then data residency / ecosystem / portability — and did NOT assume a capability the platform lacks (Zap creation, PA "My flows").
- [ ] Specified the orchestration guarantees §4 requires (idempotency key, error path, dead-letter, heartbeat/alert, secrets store, dev/prod split, fan-out caps) as requirements handed to the build skill.
- [ ] Every automation has a named owner, a runbook, and a kill-switch.
- [ ] Routed the actual build to `automation-flows` / the chosen platform skill — no flow was built inside this skill.
