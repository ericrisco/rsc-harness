# Platform selection matrix — n8n · Make · Zapier · Power Automate

Depth for §3. This is a *routing* reference: decide, then hand off to the platform's own skill
(`../../n8n/`, `../../make/`, `../../zapier/`, `../../power-automate/`) for the live API/MCP work.
All pricing/version figures move — re-check the vendor page at author time.

## Billing unit is the decision axis

Cost at scale is dominated by the unit each platform charges on. The *same* logical flow costs
wildly different amounts depending on shape (few-long vs many-short) because of this.

| Platform | Billing unit | What counts as 1 | Cost shape it favors |
| --- | --- | --- | --- |
| **n8n** | execution | one whole workflow run, any number of steps | few, long, complex flows; high volume; self-host = $0 |
| **Make** | credit | each module action (renamed from "operations" 2025-08-27, converted 1:1) | moderate multi-step flows |
| **Zapier** | task | each action step that runs | many, short, simple flows |
| **Power Automate** | seat / flow | per-user or per-flow premium licensing; standard connectors bundled with many M365 plans | teams already paying for Microsoft 365 |

**Worked contrast** — a 10-step flow run 10,000×/month:

- **n8n:** 10,000 executions regardless of step count; self-hosted = $0 infra-aside.
- **Make:** ~100,000 credits (10 module actions × 10k).
- **Zapier:** ~100,000 tasks (10 actions × 10k) — pushed into high tiers fast.
- **Power Automate:** governed by seat/flow licensing rather than per-action, so the math is about
  who's licensed and premium-connector usage, not run count.

For complex high-volume flows, n8n's per-execution model commonly cuts cost 80–90% vs per-task/credit
platforms. For a Microsoft-centric team, Power Automate can be effectively "free at the margin"
because it rides existing M365 licenses.

## Full comparison

| Axis | n8n | Make | Zapier | Power Automate |
| --- | --- | --- | --- | --- |
| Free / entry | self-host free; cloud Starter ≈ €20/mo | ≈ 1,000 credits free; Core ≈ $9/mo | 100 tasks/mo free; Pro ≈ $19.99/mo | bundled in many M365 plans; premium add-ons |
| App breadth | ~1,000 nodes + generic HTTP + code | ~1,500, often deep per app | ~9,000+ apps — widest catalog | strong on MS + growing 3rd-party connectors |
| Self-host / data residency | **yes — your infra** | no (EU/US regions) | no | Microsoft cloud / Dataverse regions |
| Who runs/maintains it | technical; you run the box | mid; visual but rich | non-technical-friendly | IT/business in a Microsoft shop |
| Portability | high (export/import JSON + self-hostable runtime) | medium (blueprint export/import, runs only on Make) | low (no portable export) | low (tied to MS solutions) |
| Complex logic / code | code nodes, sandboxed by default (n8n 2.0) | functions + routers | limited (Code by Zapier) | expressions + Azure Functions escape hatch |

## Programmatic + MCP maturity (honest)

The suite's platform skills drive these; here's the strategy-level read on how far each goes.

- **n8n** — public REST API can CRUD and activate workflows programmatically; strongest fit for
  code-driven ops and GitOps-style management. MCP is community-driven and evolving. Best pick when
  you want automations that are themselves managed as code. → `../../n8n/SKILL.md`.
- **Make** — management API plus maturing MCP / AI-agent support; you can manage scenarios via API to
  a useful degree. → `../../make/SKILL.md`.
- **Zapier** — rich API for *running actions*, and **Zapier MCP** exposes thousands of app actions to
  AI agents. **Hard limit: there is no public API to create/author a Zap** — Zap building is UI-only.
  You can trigger and act, not construct. → `../../zapier/SKILL.md`.
- **Power Automate** — Flow *management* APIs, plus solutions/ARM/ALM for deploying flows as packaged
  artifacts. **Hard limit: no clean public API to author an end-user's personal "My flows"**; the
  supported path is solution-based deployment, not arbitrary per-user flow creation. →
  `../../power-automate/SKILL.md`.

**Do not build a plan that depends on API-creating a Zap or a personal Power Automate "My flow."**
Both are UI-authored. If automation-of-the-automation is a requirement, that requirement points at
**n8n** (and to a lesser extent Make).

## Ecosystem fit — the tie-breaker after billing

- **Microsoft 365 shop** (Teams, SharePoint, Outlook, Dataverse, Excel Online) → **Power Automate**.
  The native integration and bundled licensing usually beat everything else on both cost and
  friction. Don't bolt a third-party platform onto a Microsoft estate without a reason.
- **Data must stay on your own infrastructure** (compliance, residency, air-gapped) → **n8n**
  self-hosted is the only option here that keeps data on your box.
- **Obscure or long-tail app**, non-technical owner → **Zapier** for catalog breadth.
- **Deep per-app capability at mid volume** → **Make**.

## Routing summary

```text
Microsoft 365 estate?            → Power Automate
Data must stay on our infra?     → n8n (self-host)
High volume / complex / code?    → n8n
Need to manage flows as code?    → n8n (Make second)
Widest app catalog / non-tech?   → Zapier
Deep modules, mid volume?        → Make
```

Then route to that platform's skill for the build/operate work. Portability note: n8n's exportable
JSON makes exit cheap; the other three lock you in more, so weigh that if you expect to outgrow the
choice.
