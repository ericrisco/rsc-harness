---
name: business-intelligence
description: "Use when a metric (revenue, MRR, margin) needs defining once in a governed semantic layer so every dashboard, report and agent returns the same number, or when an LLM must answer data questions in plain language without hallucinating SQL. NOT chart layout (that is `dashboard`), NOT which KPIs to track (that is `kpi-framework`), NOT a hand-written query (that is `sql`)."
tags: [business-intelligence, semantic-layer, metrics-layer, text-to-sql, natural-language-query, dbt, cube]
recommends: [sql, dashboard, kpi-framework, reporting, analytics, forecasting, clickhouse-analytics, duckdb]
origin: risco
---

# Business intelligence

Answer business questions over the org's data **through a governed semantic layer** — define each metric once in versioned YAML, then route every "what was revenue last quarter by region" through that layer. Numbers come out consistent, auditable, and the same for everyone. This skill builds the layer and queries it in plain language.

## The one rule

**Never free-hand SQL against raw tables to answer a governed business question. Go through the layer.**

Why, with numbers: in dbt's April 2026 benchmark (ACME Insurance, 11 questions × 20 runs, ~15-table schema), an LLM grounded in a semantic layer scored **98.2% (Claude Sonnet 4.6) / 100% (GPT-5.3 Codex)** vs **90.0% / 84.1%** for raw text-to-SQL on the same schema; on the *unmodeled* schema it was 72.7% vs 64.5%, and a 2023 GPT-4 baseline managed 32.7%. The layer is not bureaucracy — it is the accuracy. The model writing SQL against undecorated tables is the failure mode you are eliminating.

Your job is two motions: (1) **build** the metrics layer (entities, dimensions, measures, metrics) and (2) **query** it — translate a plain-language question into metric + dimensions + grain + filter, never into a hand-written query.

## The four primitives

Every semantic layer (MetricFlow, Cube, warehouse-native) is built from the same four nouns. Learn these and the rest is syntax.

- **Entities** — the join keys. `order_id` is the primary entity of `orders`; `customer_id` is a foreign entity that joins to `customers`. Entities are how the layer knows how tables relate so *it* writes the join, not you.
- **Dimensions** — the axes you group and filter by, including time grains (`order_date` by day/week/month/quarter) and categoricals (`region`, `product_category`).
- **Measures** — a single aggregation of a column: `sum(amount)`, `count(distinct customer_id)`.
- **Metrics** — named, reusable expressions built over measures: `gross_revenue`, `mrr`, `gross_margin_pct`. This is what a human or agent actually asks for by name.

```yaml
# MetricFlow-style semantic model for an orders table
semantic_models:
  - name: orders
    model: ref('fct_orders')
    entities:
      - name: order        # primary join key
        type: primary
        expr: order_id
      - name: customer     # foreign key -> customers semantic model
        type: foreign
        expr: customer_id
    dimensions:
      - name: order_date
        type: time
        type_params: { time_granularity: day }   # grain is declared, not implied
      - name: region
        type: categorical
    measures:
      - name: order_amount
        agg: sum            # explicit aggregation
        expr: amount
```

## Decision: do you even need a layer?

Do not stand up a semantic layer for a spreadsheet. Branch on consumers and conflict, not on data size alone.

| Situation | Build the layer? | Route |
|---|---|---|
| One analyst, one table, a 200-row CSV, a one-off question | No | `../sql/SKILL.md` or `../duckdb/SKILL.md` |
| One metric, queried in one place, never disputed | No | `../sql/SKILL.md` |
| Many consumers (dashboards + reports + notebooks + an agent) | Yes | this skill |
| An LLM/agent must answer data questions safely | Yes | this skill |
| Two teams already report different numbers for the same thing | Yes | this skill |

If the answer is "no," stop here and write the query. The layer earns its weight only when a definition has to be shared.

## Pick the layer

| Pick | When | Why |
|---|---|---|
| **dbt Semantic Layer / MetricFlow** | You already run dbt; want Git-native definitions colocated with models, reviewed in PR/CI | Metrics live in YAML next to dbt models, version-controlled, served over JDBC + GraphQL APIs that apps query; compiles to SQL on Snowflake/BigQuery/Redshift/Databricks |
| **Cube** | One definition must feed a BI tool *and* a product dashboard *and* an AI copilot | Open-source, one definition exposed over four query APIs (SQL/REST/GraphQL/MDX) plus an AI API / MCP support so agents call governed metrics as tools |
| **Warehouse-native (Snowflake Semantic Views / Databricks Metric Views)** | The org is all-in on one warehouse | Semantic objects live inside the warehouse — no separate service to run |

MetricFlow was open-sourced (Apache 2.0) at Coalesce 2025 and contributed as an OSI reference implementation, so its YAML is a safe default authoring format regardless of which engine you land on.

## Author the model

**One definition, version-controlled, reviewed in PR — colocated with the models.** Definitions belong in code review, not in a BI tool's UI where they silently fork.

```yaml
# A metric defined once over the measure above
metrics:
  - name: gross_revenue
    label: Gross Revenue
    type: simple
    type_params:
      measure: order_amount     # built on the measure, not raw SQL
  - name: gross_margin_pct
    label: Gross Margin %
    type: ratio                 # ratio metric: numerator / denominator
    type_params:
      numerator: gross_profit
      denominator: gross_revenue
```

```text
# Bad -> Good
Bad:  "revenue" SUM(amount) hand-written in Tableau,
      SUM(net_amount) in the Looker view,
      SUM(amount)-refunds in a notebook  -> three different numbers
Good: one `gross_revenue` metric in YAML; Tableau, the notebook,
      and the agent all query that one metric -> one number
```

For multi-entity join paths, additive vs non-additive vs ratio vs cumulative/derived metrics, semi-additive measures (balances, inventory snapshots), time spines, and the fan-out double-count trap, see `references/authoring-semantic-models.md`.

## Query in plain language

Decompose the question into the four parts **before any SQL exists**. Never jump to a query.

```text
Question: "MRR by plan, monthly, last 2 quarters, EU customers only"
  metric      -> mrr
  group by    -> plan
  time grain  -> month
  date filter -> last 2 quarters
  filter      -> region = 'EU'
```

You hand the layer that spec; it generates the governed SQL. You then explain the answer back in business terms ("EU MRR grew 8% QoQ, driven by the Pro plan"), not as a table dump.

## Wire the agent

Expose the layer as an **MCP / metrics tool**. The agent selects governed metrics + dimensions; the layer returns the SQL/results. The agent never sees raw warehouse tables.

```text
# Bad -> Good
Bad:  agent gets warehouse credentials, reads the schema,
      writes SELECT ... FROM raw.orders JOIN ...  -> 84-90% accurate, unauditable
Good: agent calls query_metrics(metric="gross_revenue",
      group_by=["region"], grain="month", filters=["region='EU'"])
      -> layer returns governed SQL/result, 98-100% accurate
```

Guardrails: deny raw-table access, validate that requested dimensions actually exist on the metric, reject any ungoverned aggregate. Full MCP pattern plus dbt SL GraphQL/JDBC and Cube REST/SQL/MCP query shapes are in `references/wiring-agents-and-apis.md`.

## Reconcile conflicting numbers

When sales says revenue is X and finance says Y, it is almost never a query bug — it is **two definitions**. Do not write a third query to "settle it." Find the two definitions, pick the correct one, encode it once in the layer, and point both teams at it. The disagreement disappears because there is now one number to disagree about.

## Portability (OSI)

Author toward the **Open Semantic Interchange** standard so definitions survive a tool switch. OSI is the vendor-neutral, Apache-2.0, YAML-based spec for datasets/metrics/dimensions/relationships, launched 2025-09-23 by Snowflake + dbt Labs, Cube, Salesforce/Tableau and others; **v1.0 spec published on GitHub 2026-01-27**. Write MetricFlow/OSI-shaped YAML; never invent a proprietary metric format trapped in one BI tool.

## Anti-patterns

| Anti-pattern | Why it bites | Instead |
|---|---|---|
| Free-handing the SQL "just this once" because it's faster | "Once" becomes the fourth conflicting revenue figure; it's unauditable | Add/query a metric |
| Letting each dashboard define revenue itself | That is exactly how you get three numbers and a fire drill | One metric, all consumers query it |
| Skipping the time dimension's grain because it's "obvious" | Undeclared grain → silent daily-vs-monthly mismatches | Declare `time_granularity`/`grain` |
| Handing the agent warehouse creds to figure out the joins | Raw text-to-SQL is 84-90% (33% in 2023) and unauditable; the dbt 2026 benchmark puts the layer +8-14pts ahead | Expose metrics via MCP/API |
| Standing up a semantic layer for a 200-row CSV | Pure overhead for one analyst | `../sql/SKILL.md` / `../duckdb/SKILL.md` |
| Hard-coding the EU filter into the metric | Now you need a second metric for every region | Pass filters at query time |

## Verify

Run `scripts/verify.sh [path]` on your semantic-model directory. It is read-only, never touches a warehouse, and discovers candidate YAML, then warns (advisory) on: a metric with no underlying measure, a measure with no declared `agg`, a time dimension with no grain, duplicate metric names, and a `.sql` beside the model hand-rolling an aggregate the layer should own. It exits non-zero only on unparseable YAML; an empty or clean target passes clean.

Siblings: `../sql/SKILL.md` · `../dashboard/SKILL.md` · `../kpi-framework/SKILL.md` · `../reporting/SKILL.md` · `../analytics/SKILL.md` · `../forecasting/SKILL.md`
