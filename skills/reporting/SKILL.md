---
name: reporting
description: "Use when a recurring report must ship itself on a cadence — weekly digest, monthly exec pack, board pack — via a fetch→narrate→render→deliver pipeline with a schedule and a freshness gate. NOT a live view people slice (that is `dashboard`), NOT picking which KPIs to track (that is `kpi-framework`), NOT a one-off investigation (that is `analytics`)."
tags: [reporting, automated-reports, recurring, stakeholder-reporting, scheduled-delivery, data-analytics]
recommends: [dashboard, kpi-framework, analytics, automation-flows, email-connector, spreadsheet-ops, google-workspace, notion-connector, github-actions]
origin: risco
---

# reporting — the standing artifact that ships itself

A report is a **push** artifact: a fixed snapshot that lands in someone's inbox or shared drive on a
cadence, the same shape every period, with no human assembling it. That is the whole job. If a human
opens a live view to slice numbers themselves, that is **pull** — a
[`dashboard`](../dashboard/SKILL.md), not a report. Hold that line; almost every failed "reporting"
project is a dashboard wearing a report's name, or a report nobody can trust because the numbers went
stale and no one noticed.

Your deliverable is a **runnable pipeline**, not advice: a template, a generation script, a schedule,
and a delivery step, with a freshness gate so it fails loud instead of shipping yesterday's numbers.

## Step 0 — Write the report contract (no contract, no build)

Before any code, pin six fields. An undefined audience is a report no one reads; an undefined source
is a number no one can defend.

| Field | What it fixes | Example |
| --- | --- | --- |
| **Audience** | Who reads it → sets depth and tone | "5-person leadership team" |
| **Cadence** | When it ships → sets the scheduler | "every Monday 08:00 Europe/Madrid" |
| **Sections** | The fixed skeleton, same every period | Exec summary · revenue · pipeline · risks |
| **Metric source** | Where numbers come from + **who owns them** | `metrics.csv` from the data team |
| **Channel** | The artifact + transport | PDF over email |
| **Owner** | Who gets paged when it breaks | a named person, not "the team" |

Rule: you **consume** an agreed metric set — you do not adjudicate which KPIs matter. If the ask is
"which metrics should we even track?", that is [`kpi-framework`](../kpi-framework/SKILL.md), not this
skill. The contract names the source and its owner so a wrong number has an address.

## Decide: push report vs live dashboard (this branches — settle it first)

Audiences want a citable snapshot for the period more often than a live feed — that is why push wins
for exec summaries, weekly reviews, and finance close packs.

| Signal in the ask | Route |
| --- | --- |
| "Same summary, every week/month/quarter" | **reporting** (here) |
| "Consistent snapshot the board can cite in a meeting" | **reporting** (here) |
| "It must arrive even if no one logs in" | **reporting** (here) |
| "A screen people open to filter/drill live" | [`dashboard`](../dashboard/SKILL.md) |
| "Self-serve, slice by region/date on demand" | [`dashboard`](../dashboard/SKILL.md) |

When both are wanted, build the report and let it link to the dashboard as a "go deeper" footer.

## Pick the artifact format

| Format | Wins when | Notes |
| --- | --- | --- |
| **Email-body HTML** | Short digest, ≤1 screen, read on a phone | Inline the key numbers; no attachment to open |
| **PDF** | Exec / client / board, fixed layout that must look identical for everyone | The default for anything formal; pinned render stack below |
| **Spreadsheet** | Analysts who will re-filter and pivot the data themselves | Hand off the data, not a picture → [`spreadsheet-ops`](../spreadsheet-ops/SKILL.md) |
| **Notion / living doc** | Internal team, the doc evolves and gets commented | Page over file → [`notion-connector`](../notion-connector/SKILL.md) |

A board pack is a PDF; an analyst hand-off is a spreadsheet. Picking PDF for analysts who wanted to
pivot is the most common format miss.

## The four-layer pipeline: fetch → narrate → render → deliver

Keep the four layers separate so each is testable and the template never knows where data came from.

**Pinned stack** (Python, the most-documented 2025 PDF path — verified on PyPI 2026-06-02):
`pandas` (data) → `Jinja2` (HTML template) → `WeasyPrint` **68.1** (HTML+CSS → PDF), `Matplotlib`
for embedded charts. Pin WeasyPrint — major versions change CSS support, so an unpinned bump can
silently reflow a board pack. Re-check PyPI before you freeze, then freeze what you resolve.

```python
# render.py — minimal fetch → narrate → render. Delivery + charts live in references/pipeline.md.
import pandas as pd
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML  # WeasyPrint==68.1

def build_report(metrics_csv: str, params: dict) -> bytes:
    df = pd.read_csv(metrics_csv)                      # fetch
    df = df[df["region"] == params["region"]]          # per-recipient scope, NOT a new template
    cur, prev = df["revenue"].iloc[-1], df["revenue"].iloc[-2]
    ctx = {
        "title": f'{params["region"]} weekly revenue',
        "period": params["period"],
        "summary": narrate(cur, prev),                 # narrate (see below)
        "rows": df.tail(8).to_dict("records"),
    }
    env = Environment(loader=FileSystemLoader("templates"))
    html = env.get_template("report.html.j2").render(**ctx)   # render
    return HTML(string=html).write_pdf()
```

Rule: **one template, per-recipient params** — regional managers each get their region from the same
`report.html.j2`, scoped by `params`, never a forked template per recipient. A template-per-recipient
codebase rots the first time the layout changes. The full worked template, the Matplotlib base64 chart
embed, the per-recipient loop, the GitHub Actions workflow, and the freshness gate are in
[`references/pipeline.md`](references/pipeline.md).

## The narrative layer (the part that gets read)

Executives read the **executive summary and stop**. Lead every report with: the report's purpose in
one line, **3 key takeaways**, and **what changed versus last period**. Then per section, one
period-over-period delta sentence and one "so what". An annotated chart callout is retained; a bare
chart is not.

```python
def narrate(cur: float, prev: float) -> str:
    delta = (cur - prev) / prev * 100
    arrow = "up" if delta >= 0 else "down"
    flag = " — investigate" if abs(delta) >= 20 else ""    # anomaly callout
    return (f"Revenue {arrow} {abs(delta):.1f}% vs last week "
            f"(€{cur:,.0f} from €{prev:,.0f}){flag}.")
```

Bad → Good, the difference that decides whether the report is useful:

- **Bad:** a table row `Revenue | 248,300 | 201,400`. The reader must do the math and guess if it matters.
- **Good:** "Revenue up 23.3% WoW (€248,300 from €201,400) — investigate: driven by the enterprise renewal that won't recur next week."

The numbers are the evidence; the sentence is the report.

## Schedule + reliability gate (where reports actually die)

Reports die two ways: **stale data** ships silently, and **a silent break** means no one notices for
weeks. Treat the schedule as managed infrastructure.

**Where to run it:**

| Situation | Scheduler |
| --- | --- |
| You already run a server / cron host | **cron** (`0 8 * * 1` = Mondays 08:00) |
| No server, want zero infra | **GitHub Actions** `on: schedule: - cron:` — the recommended cloud option |
| Multi-app event wiring beyond a timer | route the plumbing to [`automation-flows`](../automation-flows/SKILL.md) |

This skill owns the report-shaped concern (contract, narrative, artifact) and *uses* a scheduler — it
does not teach scheduling in general. The actual transport (SMTP/Gmail send) belongs to
[`email-connector`](../email-connector/SKILL.md); for a Drive/Workspace destination see
[`google-workspace`](../google-workspace/SKILL.md). The GH Actions `schedule:` YAML is in
[`references/pipeline.md`](references/pipeline.md).

**Reliability checklist — every recurring report:**

- [ ] **Freshness gate before send** — assert the source is newer than the last period; if stale, do
      NOT send, raise instead. A report that consumes dirty data is not this skill's job to clean —
      that is [`data-cleaning`](../data-cleaning/SKILL.md); this gate only refuses to ship
      known-stale numbers.
- [ ] **Fail loud** — on any error, alert the owner (the report not arriving is itself a silent failure).
- [ ] **Idempotent run** — re-running for the same period produces the same artifact, no duplicate send.
- [ ] **Dead-report cleanup** — if no one opened the last N editions, kill the schedule. Unread reports
      are pure cost and noise.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Email a live dashboard link, call it "the report" | Recipient must log in and slice; most won't, the snapshot is lost | Ship the fixed artifact; link the dashboard as a footer |
| No freshness gate | Stale numbers ship silently; trust dies on the first wrong figure | Assert source newer than last period; refuse to send if stale |
| One mega-report for every audience | Execs drown in analyst detail; analysts can't refilter a PDF | Contract per audience; one template, per-recipient params |
| Raw metric dump, no narrative | Reader does the math, misses what changed, stops opening it | Exec summary + 3 takeaways + a "so what" per section |
| Schedule with no failure alert | A broken job is invisible for weeks; the report just stops | Fail loud to the named owner on any error |
| A template forked per recipient | Layout change must be made N times; they drift | Single template scoped by `params` |
| Redefining KPIs inside the report | The report quietly becomes the metric authority, numbers diverge | Consume an agreed set; defer definition to [`kpi-framework`](../kpi-framework/SKILL.md) |
| Unpinned WeasyPrint / render lib | A minor bump reflows the board pack with no warning | Pin (WeasyPrint 68.1) and re-check PyPI before changing |
| Hand-assembling the digest weekly | It breaks the week the owner is on leave | Automate the pipeline end to end; a human only reads it |

## Verify

Run `scripts/verify.sh` (read-only; pass a path to a generated pipeline directory, or run in it). It
confirms a Jinja2 template renders against a sample context without error, the generation script
produces a non-empty PDF/HTML artifact, a schedule definition exists (a crontab line or a
`.github/workflows/*.yml` with a `schedule:` block), and a delivery step is wired. It soft-warns if no
freshness/failure gate is detected, and exits 0 on an empty/clean target — nothing to check is not a
failure.
