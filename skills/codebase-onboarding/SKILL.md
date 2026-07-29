---
name: codebase-onboarding
description: "Use when you land in an unfamiliar or inherited codebase and must get productive fast: a breadth-first map of entry points, request flow, module ownership, hidden side effects (cron, webhooks, workers) and churn hotspots, committed as CODEBASE-MAP.md. NOT a deep audit of one module (that is `analyze`) or chasing one failure (that is `debug`)."
tags: [onboarding, codebase, code-mapping, legacy-code, architecture, reverse-engineering, hotspots]
recommends: [analyze, debug, decision-records, harness, init, knowledge-ops]
origin: risco
---

# Codebase onboarding — get oriented fast, leave a map

You have just landed in a codebase you did not write: a fresh clone, an inherited project, an acquired repo, an abandoned side project someone handed you. The instinct is to start reading files top-to-bottom. Resist it. That is how a week disappears and you still cannot answer "where does X happen". This skill runs a disciplined **breadth-first reconnaissance pass** and produces one durable artifact: a map a teammate can trust and you can re-read tomorrow.

The payoff is measured. Engineers using AI to onboard reach the same milestones roughly **2x faster** — productive in 1–2 weeks instead of 4–6 — and the biggest gains are exactly in *searching for code, decoding undocumented patterns, and tracing data flows* (super-productivity.com, accessed 2026-06-02). That is what the recon pass below targets, in order.

## Lead with the deliverable

Before you grep a single line, know the target: a single living file, `CODEBASE-MAP.md`, committed at the repo root. You work *backward* from its sections — every recon step fills one. Minimal schema:

```markdown
# CODEBASE-MAP.md — <repo name>

## Stack          # languages, framework + versions, package manager, run scripts
## Entry points   # main / server bootstrap / route registration / CLI commands
## Request flow   # one real path traced transport -> business logic -> persistence
## Module ownership   # who owns transport / business logic / persistence / UI
## Hidden behavior    # cron, webhooks, queue workers, event listeners, env branches
## Hotspots       # most-churned + most-complex files = highest risk
## How to run     # the exact commands to boot it and hit one path locally
```

Why a file and not a chat answer: a map that lives only in the conversation dies when the session ends, and the next agent re-does the work. The artifact is the point. `verify.sh` checks these sections exist (structure, not content).

## Two operating rules

1. **Breadth before depth.** First pass maps *where things are*, not *how they work*. You are drawing the subway map, not reading every passenger's diary. Depth is `analyze`/`debug` work, on demand, later. — Reading everything is the failure mode onboarding exists to replace.
2. **Hypothesis before answer.** Spend ~5 minutes forming your own guess ("auth probably lives in `src/middleware`"), then grep to confirm or kill it. — Verifying a hypothesis builds the mental model that makes you fast; a handed-to-you answer does not stick (martinfowler.com, Böckeler, accessed 2026-06-02).

## The recon pass — ordered

Run these in order. Each step writes one map section. Stop escalating the moment the section is answerable.

**a. Orient — read the manifest, size the repo.**
Read the manifest(s) and lockfile, not the README first: `package.json` / `pyproject.toml` / `go.mod` / `Gemfile` / `pom.xml` tell you the real stack, framework version and run scripts; the lockfile tells you what is actually installed. Then size it:

```bash
scc --by-file --sort lines .   # LOC, complexity, COCOMO estimate per file
```

`scc` (Sloc Cloc and Code, pure-Go, v3.7.0 Apr 2026) is the fast structural counter of record — materially faster than cloc/tokei and it reports per-file complexity, which you reuse for hotspots. Why manifest-first: the README describes intent (often stale); the manifest describes reality.

**b. Find the entry points.**
Where does execution start? Look for `main`, the server bootstrap, route registration, CLI command definitions. Let the framework's convention guide you (Next.js `app/`/`pages/`, Express `app.use`/router mounts, Django `urls.py`, FastAPI `@app`/`APIRouter`, Rails `routes.rb`, Spring `@RestController`). See `references/recon-playbook.md` for per-ecosystem patterns.

**c. Trace one real request end-to-end.**
Pick a single meaningful path (a login, a checkout, the main CLI command) and follow it: transport (route/handler) → business logic → persistence → response. One path traced beats ten skimmed. This is the spine of the map.

**d. Map module ownership.**
For the directories `scc` flagged as large, label each: transport, business logic, persistence, UI, shared/util. You are answering "if I need to change pricing, which folder do I open" — the question teammates actually ask.

**e. Hunt hidden behavior.**
The bugs live in what runs *without* a request. Grep for cron schedules, webhook receivers, queue/background workers, event listeners and env-driven branches (see the appendix). Why this step is non-negotiable: side effects are invisible in a top-down read and they are where inherited codebases bite.

**f. Rank hotspots.**
Git churn is the cheapest risk signal — no extra tooling, and high-churn files are a proxy for "lacks tests/abstraction":

```bash
git log --format=format: --name-only --since=12.month \
  | grep -v '^$' | sort | uniq -c | sort -nr | head -50
```

The richer move is **churn × complexity**: the top-right quadrant (changes constantly *and* is hard to read) is your real danger zone (understandlegacycode.com Hotspots, accessed 2026-06-02). Escalate to that — or to a tree-sitter dependency graph — only when grep + churn is not enough: `references/recon-playbook.md` has the churn×complexity recipe (code-maat) and when codegraph PageRank / FileScopeMCP earn their setup cost.

**g. Confirm hands-on.**
Run the app, walk one end-user journey, send a real request, watch the logs. Reading alone leaves the map unverified; a single real request validates the whole trace in step c.

## Scope the effort

Match the pass to the repo. Do not stand up heavy tooling on a small project.

| Repo shape | Map fully | Skip / defer | Escalate to a graph tool? |
| --- | --- | --- | --- |
| Tiny (<20 files) | a, b, c, g | churn, ownership table | No — grep is faster than setup |
| Single-service app | all a–g | — | Only if ownership is unclear after grep |
| Large monorepo | a, b, then per-package c–f | mapping every package at once | Yes — codegraph PageRank to find the load-bearing packages |
| Polyglot | a, b, c per language boundary | one unified flow diagram | Yes, if cross-language calls obscure the flow |

## Command appendix

Language-tagged, copy-ready. Per-ecosystem depth lives in `references/recon-playbook.md`.

```bash
# Size + complexity (reuse the complexity column for hotspots)
scc --by-file --sort complexity .

# Route registration (adjust per framework)
rg -n "app\.(get|post|put|delete|use)\(|@app\.(get|post)|APIRouter|router\.(get|post)" --type-add 'web:*.{js,ts,py}' -tweb

# Cron / scheduled jobs
rg -n "cron|schedule|@scheduled|setInterval|celery\.beat|node-cron" -i

# Webhook receivers
rg -n "webhook|/hooks/|stripe.*signature|x-hub-signature" -i

# Queue / background workers
rg -n "queue|worker|bull|sidekiq|celery|sqs|rabbitmq|kafka|@task" -i

# Env-driven branches (hidden config-conditional behavior)
rg -n "process\.env\.|os\.environ|ENV\[|getenv" 
```

## Writing & maintaining the map

- **Commit it.** `CODEBASE-MAP.md` at the repo root, in version control. A map outside the repo rots silently.
- **Keep it living.** When the recon reveals you guessed wrong, fix the line — the map is the record of what is *true now*, not your first impression.
- **Link out, do not duplicate.** The map says *what is*. For *why a choice was made*, write an ADR (`../decision-records/SKILL.md`). To scaffold project tooling and a wiki, that is `../harness/SKILL.md`. To write the agent-memory `CLAUDE.md`, that is `../init/SKILL.md` — onboarding is the broader recon that feeds it. For generic note/wiki capture, `../knowledge-ops/SKILL.md`.
- **Hand off to depth tools.** Once the map exists, a deep correctness/security read of one module is `../analyze/SKILL.md`; chasing a specific failure through the system is `../debug/SKILL.md`. Onboarding builds the map you debug *with*.

## Anti-patterns

| Bad | Why it bites | Good |
| --- | --- | --- |
| Read every file top-to-bottom | Burns the week; you finish exhausted and still can't trace one request | Breadth-first: map locations first, depth on demand |
| Trust the README over the code | READMEs drift; the manifest and the routes are the truth | Read manifest + lockfile first, confirm by grep |
| Map everything at full depth | Analysis paralysis on a monorepo; you map dead modules | Trace one real flow end-to-end; expand only where needed |
| Skip the run step | An unverified map is a hypothesis, not a map | Boot it, hit one path, watch logs before you trust the trace |
| Map lives only in chat | Dies with the session; next agent redoes it | Write & commit `CODEBASE-MAP.md` |
| Guess instead of grep | Confident-wrong is worse than slow-right | Form the hypothesis, then `rg` to confirm or kill it |
| Stand up a tree-sitter MCP graph on a 5-file repo | Setup costs more than the whole recon | Reserve graph tools for large monorepos; grep + churn first |
