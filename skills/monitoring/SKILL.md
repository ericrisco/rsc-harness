---
name: monitoring
description: "Use when setting up uptime and health monitoring, alerts, or on-call basics for a service already in production, so you learn it is down before customers do — health and readiness probes, alerting on SLO error-budget burn rather than raw counts, curing alert fatigue, on-call rotation with escalation, and a status page. NOT instrumenting logs, metrics or traces, or wiring OpenTelemetry (that is `observability`)."
tags: [monitoring, uptime, alerting, on-call, sre]
recommends: [observability, deployment, error-handling, domains-dns, scaling]
origin: risco
---

# Monitoring

You are wiring up the *outside* view of a service that already shipped: is it alive, is it fast, and when it breaks, does exactly one human get exactly one actionable page. This skill emits a concrete setup — a checker config, a health-endpoint contract, symptom-based alert rules, and an on-call rotation. Not telemetry instrumentation (that is `../observability/SKILL.md`), not the release-gating healthcheck (that is `../deployment/SKILL.md`).

## The one rule

**A page is justified only when there is real user impact AND a human action the system can't take itself.** Everything below descends from this. Internalize the three tiers:

- **Page** (wake someone): users are hurting now and a human must intervene. Checkout returns 5xx. Site unreachable. Error budget burning fast.
- **Ticket** (look during business hours): degraded but not bleeding. Slow-burn budget use, cert expiring in 14 days.
- **Dashboard-only** (don't notify): CPU at 80%, a single retry, a transient blip the system already healed.

If an alert doesn't map to an immediate human action, it is not a page — it's noise, and noise trains people to ignore the one page that matters.

## The 4-layer stack

Don't skip layers and don't collapse them — each answers a different question.

| Layer | Answers | Built with | Fires when |
|---|---|---|---|
| 1. External uptime probe | "Is it reachable from the outside?" | Uptime Kuma / UptimeRobot / Better Stack | URL down, TLS broken, p95 latency over budget |
| 2. Health endpoints | "Is the process alive, and are its deps reachable?" | `/livez` + `/readyz` on the service | liveness fails → restart; readiness fails → pull from rotation |
| 3. SLO burn-rate alert | "Are we spending the error budget too fast?" | Prometheus/Grafana/Better Stack rule | multi-window burn rate exceeds threshold |
| 4. On-call escalation | "Who acts, and who's the backup?" | PagerDuty / incident.io / Better Stack | a page from layers 1–3 routes + escalates |

Layer 1 catches "the whole thing is gone." Layer 2 catches "a dependency died" before users do. Layer 3 catches "we're degrading faster than we can afford." Layer 4 makes sure a human shows up.

## Pick a tool

Decide by budget, team size, and self-host appetite. Pricing as of 2026-06.

| Tool | Free tier | Check interval | Best for | Paid from |
|---|---|---|---|---|
| **Uptime Kuma 2.1.3** | Fully free, self-hosted | down to ~20s | full control, you have a VPS | $0 (you pay the box) |
| **UptimeRobot** | 50 monitors @ 5-min, 1 status page | 5-min free / 1-min paid | no infra, want managed | $7/mo |
| **Better Stack** | 10 monitors + incidents + logs | 30s | incident mgmt + on-call in one | $24/mo |
| **Pingdom** | none | sub-minute | enterprise synthetic + RUM | $15/mo |

Default: **Uptime Kuma** if you already run a VPS (1 GB box is comfortable; needs ~400 MB RAM), **UptimeRobot** free tier if you don't want infra. Kuma 2.1 added Globalping worldwide probe locations (so you test from regions, not just your one box) and built-in domain-expiry monitors. Concrete docker-compose and notification wiring live in `references/tool-setup.md`.

## Health endpoints done right

**Split liveness from readiness — they trigger different machine actions.**

- `/livez` (liveness): is the *process* healthy? If it fails, the orchestrator **restarts** the container. Keep it dumb: just "am I running and not deadlocked." Never check the database here.
- `/readyz` (readiness): are *dependencies* reachable so I can serve traffic? If it fails, the orchestrator **pulls this instance from the load-balancer rotation** but does not kill it.

**The cheap-probe rule: a probe runs constantly, so it must be <100ms and must not cascade-check every downstream.** Why: if `/livez` pings the DB and the DB is briefly slow, liveness fails, the container restarts, the restart hammers the recovering DB — a restart loop that turns a 30-second blip into an outage.

```python
# Bad — one /health that cascades and returns 500 on any hiccup.
# A slow Redis takes the whole service down and triggers restart loops.
@app.get("/health")
def health():
    db.execute("SELECT 1")          # blocks
    redis.ping()                    # blocks
    requests.get(PAYMENTS_URL)      # blocks on a third party!
    return {"status": "ok"}         # 500 if ANY of these throws
```

```python
# Good — split, cheap, correct status codes, small JSON.
@app.get("/livez")                  # liveness: process only. Restart if this fails.
def livez():
    return {"status": "alive"}      # 200, ~1ms, touches nothing downstream

@app.get("/readyz")                 # readiness: deps with short timeouts. Pull from LB if this fails.
def readyz():
    checks = {"db": ping(db, timeout=0.2), "cache": ping(redis, timeout=0.1)}
    ok = all(checks.values())
    return JSONResponse(
        {"status": "ready" if ok else "degraded", "checks": checks},
        status_code=200 if ok else 503,   # 503 so the LB pulls this instance
    )
```

Do **not** put a third-party API call in readiness — a payment provider's outage shouldn't pull all your instances from rotation and take you fully down. Degrade that path in code (`../error-handling/SKILL.md`), don't fail-closed on it here. Go and FastAPI handler examples are in `references/tool-setup.md`.

## What to actually monitor

The golden checklist. Monitor the *symptom users feel*, not just that one URL returns 200.

- [ ] **Availability** — the critical endpoint(s) reachable, from multiple regions.
- [ ] **Latency p95/p99** — averages hide the tail; alert on p95/p99 against a budget, not the mean.
- [ ] **Error rate** — the 5xx-to-total ratio, because raw 5xx count says nothing without traffic volume.
- [ ] **SSL cert expiry** — alert at 14 days; an expired cert is a full outage that no app metric catches.
- [ ] **Domain expiry** — alert at 30 days; a lapsed domain is the most embarrassing avoidable outage.
- [ ] **The critical user journey** — a synthetic check that does login → core action → result, NOT just `GET /`. The homepage can be 200 while checkout is broken.

The homepage being up tells you almost nothing. Probe the path that makes you money.

## Alerts that don't cry wolf

**Alert on symptoms, not causes.** Page on "checkout error rate >2% for 5 min" (user impact), not on "CPU >80%" (a cause that may be harmless and self-resolving). High CPU with happy users is a dashboard line, not a 3am page.

**Use multi-window, multi-burn-rate for SLO alerts** (Google SRE workbook). Burn rate = how fast you're spending the monthly error budget. Require a long *and* a short window to both fire — the long window says "this is real," the short window says "this is still happening," and together they kill false positives from a single spike.

| Burn rate | Window | Budget spent | Severity | Action |
|---|---|---|---|---|
| > 14.4 | 1h (+ 5m short) | 2% in 1h | critical | **page** |
| > 6 | 6h (+ 30m short) | 5% in 6h | warning | **ticket** |
| > 1 | 3d (+ 6h short) | 10% in 3d | info | review |

Routing: **critical → page**, **warning → ticket**, **info → dashboard/review**. Dedupe and group related alerts into one incident (10 hosts failing the same check = one page, not ten). Set **maintenance windows** so planned deploys don't page anyone. The full burn-rate math and a copy-paste Prometheus-style rule with a `runbook_url` annotation are in `references/burn-rate-and-oncall.md`.

## On-call basics

- **Rotation**: weekly, with a **primary and a secondary**. One person can't be the single point of failure for the system that catches single points of failure.
- **Escalation policy**: page primary → if no ack in 5–10 min, page secondary → then the manager. No-ack must always hop; an unacked page is a dropped page.
- **Runbook per alert**: every alert links to a runbook with five fields — Symptom, Impact, First 3 checks, Mitigation, How to escalate. The person paged at 3am should not have to think from scratch. Template in `references/burn-rate-and-oncall.md`.
- **Status page + comms**: a public status page (Kuma and Better Stack include one) so customers self-serve "is it you or me," cutting inbound during an incident.
- **Do NOT start a new on-call on Opsgenie** — Atlassian is retiring it (EOL **2027-04-05**; new sales ended 2025-06-04). **Grafana OnCall OSS was also deprecated** (folded into Grafana Cloud IRM). For a new setup use **PagerDuty, incident.io, Better Stack, or Grafana Cloud IRM**.

## Verify it works

**An untested alert is not an alert.** Before you call monitoring "done," prove the wire end-to-end:

1. Trigger a real synthetic failure (stop the service, or point a monitor at a forced-503 route).
2. Confirm the page actually lands on a phone — not just "the rule exists in the UI."
3. Let the ack timeout lapse and confirm escalation hops to the secondary.
4. Restore, and confirm the resolve/all-clear notification fires too.

`scripts/verify.sh` enforces the *structural* half of this on your config: liveness split from readiness, at least one symptom/burn-rate alert with two windows, a runbook reference on every alert, and a banlist for Opsgenie-as-new-setup and homepage-only monitors. Run it in CI so config drift can't silently re-introduce a noisy or untested setup.

## Anti-patterns

| Bad | Why it bites | Do instead |
|---|---|---|
| Monitor only the homepage `/` | `/` is 200 while checkout is broken — you learn from customers | synthetic check of the critical journey |
| Page on CPU/memory threshold | self-resolves, no user impact → alert fatigue | page on the symptom (error rate, latency, availability) |
| Alert on cause, not symptom | causes are noisy and ambiguous | alert on what the user feels |
| Alert with no runbook link | the paged human improvises at 3am | every alert links a 5-field runbook |
| Single-window threshold "by vibes" | one spike pages; tuned by guesswork | multi-window multi-burn-rate against an SLO |
| Probe cascades every downstream | one slow dep fails the probe → restart loop | cheap <100ms probe, deps in readiness with timeouts |
| Liveness checks the database | slow DB → restart loop turns a blip into an outage | liveness = process only; DB lives in readiness |
| Start new on-call on Opsgenie | EOL 2027-04-05, dead end | PagerDuty / incident.io / Better Stack / Grafana Cloud IRM |
| No secondary on-call | primary asleep/offline → page dropped | primary + secondary + manager escalation |
| No status page | inbound floods support during incidents | public status page customers can self-serve |
| Never tested the alert | "the rule exists" ≠ "the page lands" | trigger a synthetic failure, confirm it pages + escalates |
| Page on warnings | trains people to ignore pages | warning → ticket; only critical → page |

## References

- `references/tool-setup.md` — Uptime Kuma docker-compose (rootless image, volume, port), HTTP + push-heartbeat + SSL/domain-expiry monitors, a synthetic multi-step journey, notification wiring (ntfy / Slack webhook / PagerDuty integration key), a UptimeRobot/Better Stack monitor JSON shape, and Go + FastAPI health-endpoint handlers.
- `references/burn-rate-and-oncall.md` — full multi-window multi-burn-rate math, a copy-paste Prometheus-style alert rule with `runbook_url`, severity mapping, a sample escalation-policy YAML, and a fill-in runbook template.

Related: `../observability/SKILL.md` (what the app emits), `../deployment/SKILL.md` (release-gating healthcheck + rollback), `../error-handling/SKILL.md` (degrade in code), `../domains-dns/SKILL.md` (provision certs/DNS), `../scaling/SKILL.md` (survive the load monitoring detected).
