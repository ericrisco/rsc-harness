# Tracker schema + a filled example

The tracker of record is three structured files under `02-DOCS/wiki/competitors/`. Raw
captures (the diffed HTML/JSON snapshots) go under `02-DOCS/raw/competitors/<rival>/`. The
rule that overrides everything: **a price or feature cell without a `source_url` + `date` is
not knowledge — leave it blank and say so.**

`02-DOCS/wiki/` is an OKF v0.1 bundle, so the one `.md` file here (the competitor profile)
carries YAML frontmatter with a non-empty `type:`; the two CSVs are data files, not OKF
documents. Any cross-references in the profile body use **standard markdown links** (e.g.
`[Beta](./beta.md)`), never wikilinks. See `../../harness/references/wiki-protocol.md`
"## Conventions".

## 1. Competitor profile (one file per rival)

Markdown front-matter + body. One per rival, named `02-DOCS/wiki/competitors/<rival>.md`.
The frontmatter is OKF v0.1 conformant: `type:` is the only required field (non-empty);
`title`/`description`/`tags`/`timestamp` are the recommended standard surface. All the
domain keys below (`name`, `positioning_source.date`, every `pricing_tiers[].date`, …) are
kept verbatim — OKF allows any extra key and `verify.sh` reads them, so adding the OKF
fields is purely additive.

```yaml
---
type: competitor
title: Acme
description: "Tracker of record for Acme — positioning, pricing tiers, and watched surfaces."
tags: [competitor, pricing-watch, feature-watch]
timestamp: 2026-05-28T00:00:00Z
name: Acme
positioning_line: "The all-in-one workspace for remote-first teams"
positioning_source: { url: "https://acme.com", date: "2026-05-28" }
segment: "SMB / mid-market SaaS"
watched_urls:
  - { axis: pricing,       url: "https://acme.com/pricing",   selector: ".price-amount",        cadence: "10m" }
  - { axis: feature,       url: "https://acme.com/changelog", selector: ".changelog li:first-child", cadence: "daily" }
  - { axis: positioning,   url: "https://acme.com",           selector: "h1.hero-title",        cadence: "weekly" }
  - { axis: team,          url: "https://acme.com/careers",   selector: ".jobs-count",          cadence: "weekly" }
pricing_tiers:
  - { tier: "Starter", amount: 0,  currency: USD, period: mo, source_url: "https://acme.com/pricing", date: "2026-05-28" }
  - { tier: "Pro",     amount: 59, currency: USD, period: mo, source_url: "https://acme.com/pricing", date: "2026-05-28" }
  - { tier: "Team",    amount: 99, currency: USD, period: mo, source_url: "https://acme.com/pricing", date: "2026-05-28" }
---

## Notes
Repositioned from "project tool" to "workspace" in Q2 2026 — see change log 2026-05-12.

## Related
- [Beta](./beta.md) — closest competing positioning; cross-watch their pricing moves.
```

Every `pricing_tiers` row and any feature claim must carry `source_url` + `date`. If you only
have the tier name but not a confirmed price, omit `amount` rather than guess.

## 2. Feature matrix (CSV)

Rows = features, columns = competitors, plus a sourcing column pair per competitor so
`verify.sh` can confirm each asserted cell is dated. Keep it at `02-DOCS/wiki/competitors/feature-matrix.csv`.

```csv
feature,acme_value,acme_source_url,acme_date,beta_value,beta_source_url,beta_date
SSO (SAML),Team plan,https://acme.com/pricing,2026-05-28,Enterprise only,https://beta.io/security,2026-05-29
API rate limit,1000 req/min,https://acme.com/docs/limits,2026-05-28,,,
Audit log,yes,https://acme.com/security,2026-05-28,yes,https://beta.io/security,2026-05-29
```

A blank `*_value` with blank source is honest ("we haven't confirmed it"). A non-blank value
with a blank source is a violation — that's an invented fact and `verify.sh` fails it.

## 3. Change log (CSV, append-only)

The time series. Never overwrite a row; each pass appends. Keep it at
`02-DOCS/wiki/competitors/change-log.csv`.

```csv
date,competitor,axis,url,old_value,new_value,materiality,action
2026-05-12,Acme,positioning,https://acme.com,"project tool","remote-first workspace",high,"flag to brand-voice — they moved into our lane"
2026-05-20,Acme,pricing,https://acme.com/pricing,$49/mo,$59/mo,high,"revisit our mid-tier vs theirs (route to pricing)"
2026-05-22,Acme,feature,https://acme.com/changelog,,"SSO on Team plan",medium,"note for product"
2026-05-29,Beta,team,https://beta.io/careers,12 roles,19 roles,low,"hiring sales — watch for go-to-market push"
```

Field rules (these are what `verify.sh` enforces):

- `axis` ∈ `{pricing, feature, positioning, messaging, team, other}` — exactly one.
- `materiality` ∈ `{high, medium, low}`.
- `url` and `date` are required on every row (the change is unverifiable without them).
- `old_value` may be blank for a *new* surface (first capture); `new_value` should not be blank.
- `action` is the next step or the route — empty action on a `high` row is a smell.

## End-to-end: one rival, one pass

1. Orient: Acme is in our vital-few list. Watch pricing (10m), changelog (daily), hero (weekly), careers (weekly).
2. Gather: capture `.price-amount` → reads `$59/mo` on the Pro tier.
3. Analyze: diff vs last stored capture (`$49/mo`) → changed.
4. Classify: `pricing`. Score: `high` (it's our competing tier).
5. Log: append the `2026-05-20` pricing row above.
6. Flag + route: high → route the pricing implication to `../pricing/SKILL.md`; you don't set our price.
