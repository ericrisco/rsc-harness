---
name: seo-geo
description: "Use when one existing page needs to rank in Google AND get cited by AI answer engines — auditing a URL for on-page SEO, structured-data JSON-LD, GEO citation levers, Core Web Vitals, crawlability, and AI-bot access in robots.txt. NOT writing the article body (that is `article-writing`), NOT keyword research or content strategy (that is `content-engine`)."
tags: [seo, geo, structured-data, schema-org, core-web-vitals, ai-search, technical-seo]
recommends: [content-engine, article-writing, landing-copy, performance, nextjs, accessibility, analytics]
origin: risco
---

# seo-geo — make one page findable in Google AND in AI answers

> One audited page, two surfaces. You take an **existing** URL and make it rank in
> Google's blue links / AI Overviews **and** earn citations in ChatGPT Search,
> Perplexity, and Gemini — through meta, schema, answer-first structure, and a clean
> technical audit. You do **not** write the article body and you do **not** pick the
> keywords. That work belongs upstream.

## When to use / When NOT to use

**Use when** the request is about a concrete artifact:

- "Audit this page for SEO" / "why isn't this ranking?" / "make this page rank."
- "Get us cited in ChatGPT / Perplexity / AI Overviews" / "optimize for AI search."
- "Add schema markup" / "write the JSON-LD for this article/product."
- "Our Core Web Vitals are failing" / crawlability / "should we block GPTBot?"

**Do NOT use — redirect instead:**

| Request | Owner |
|---|---|
| Write the long-form article/blog body | `article-writing` |
| Keyword research, topic clusters, content calendar | `content-engine` |
| Write persuasive value-prop / CTA copy | `landing-copy` |
| Actually fix a slow LCP/INP (render path, hydration, bundle) | `performance` |
| Wire Next.js `generateMetadata` / app-router SEO plumbing | [`../nextjs/SKILL.md`](../nextjs/SKILL.md) |
| WAI-ARIA / keyboard / contrast audit | `accessibility` |
| Measure traffic / set up GA4 / dashboards after the fact | `analytics` |

The load-bearing distinction: **`content-engine`** decides *what to write and which
keywords to target* (upstream strategy); you optimize the *specific page that exists*.
**`performance`** owns *why* a render is slow; you only *measure* Core Web Vitals against
the p75 thresholds, flag a fail, and hand off the fix.

## The one rule both surfaces share

**Answer the primary query completely in the first ~40–200 words.** Everything below is
downstream of this. Why: Google extracts that opening for featured snippets and AI
Overviews, and the Princeton GEO study (KDD 2024, 10k queries across 8 domains) found
answer-first, source-cited content is what AI engines lift into their answers — not
buried prose. If the page makes a reader scroll past an intro to reach the answer, no
amount of schema saves it.

There is **no separate "AI SEO" toggle for Google.** AI Overviews and AI Mode run on the
*same* Googlebot crawl, the same rendering, the same ranking, and the same E-E-A-T /
helpful-content signals (folded into core ranking in March 2024). Good page experience
and distinguishable main content serve both surfaces at once. Treat them as one job.

## 1. On-page SEO pass

- **Title ≤ 60 chars**, primary query near the front. Past ~60 chars Google truncates it.
- **Meta description ≤ 160 chars** that earns the click — it is not a ranking factor, it
  is the ad copy for the result.
- **Exactly one `<h1>`**, then a logical `<h2>`/`<h3>` hierarchy that mirrors search
  intent (the sub-questions a searcher actually has).
- **Internal links with descriptive anchors** ("Core Web Vitals thresholds", not "click
  here") — anchor text is an entity signal both Google and AI engines read.

```html
<!-- Bad: vague, query buried, no length discipline -->
<title>Home | Our Awesome Company - Welcome to the Best Site Ever for You</title>
<meta name="description" content="We are a company. Learn more about us here today.">

<!-- Good: query first, within limits, earns the click -->
<title>Core Web Vitals: LCP, INP &amp; CLS Thresholds (2026)</title>
<meta name="description"
  content="The exact LCP, INP, and CLS pass thresholds Google uses at the p75 field
  percentile — plus how to check yours in 2 minutes.">
```

## 2. Schema / JSON-LD — ship the live types, never the dead ones

Pick from the live column. Shipping a deprecated type is **dead markup**: it renders
nothing and signals carelessness. The single highest-value guard in this skill is *not
emitting a dead `@type`*.

| Page type | Ship this JSON-LD | Why |
|---|---|---|
| Article / blog post | `Article` or `BlogPosting` — `headline`, `author`, `datePublished`, `dateModified`, `image` | Still eligible; `dateModified` is a freshness signal |
| Product page | `Product` + `Offer` — `price`, `priceCurrency`, `availability`, optional `aggregateRating` | Live rich result |
| Any page | `BreadcrumbList`, `Organization` / `WebSite` | Entity signals AI engines corroborate against |
| FAQ section | **NOTHING for rich results** | FAQ rich results restricted to health/gov since late 2023; full deprecation **May 7 2026**, API removed Aug 2026. Keep Q&A as visible prose. |
| Course / event-announcement / claim-review / salary / vehicle / learning-video | **NOTHING** | Retired **June 2025** — dead markup |

Validate every block with the **Rich Results Test** and the **Schema Markup Validator
(validator.schema.org)** before shipping. Copy-paste blocks with required-vs-recommended
props and the full dead-types list are in
[`references/schema-recipes.md`](references/schema-recipes.md).

## 3. GEO pass — the measured citation levers

The Princeton GEO study quantified what moves source content into AI answers. Apply these
as concrete edits — they are not vibes, they are deltas measured on GEO-bench:

- **Cited sources inline** (~+30% visibility) — link to authoritative origins for claims.
- **Statistics** (~+32%) — one verifiable number per ~150–200 words, with its source.
- **Quotations** (~+41%, the biggest lever) — quote a named expert or primary document.
- **Fluency** (~+28%) — clean, readable prose. **Keyword stuffing did NOT help** in the
  study; stuffing is pure cost.
- **Freshness** — update real content *and* `dateModified`. Recency is a genuine AI-source
  signal; a stale-looking page is corroborated less.
- **Entity corroboration** — earn mentions on independent authoritative domains so AI
  engines can cross-check who you are. This is the off-page half of GEO.

Why it is no longer optional: a citation in an AI Overview can lift CTR 80%+, while AI
Overviews are *compressing* classic organic CTR (Gartner projected ~25% organic-traffic
decline by 2026). GEO runs *alongside* on-page SEO, never instead of it.

**Myth callout — `llms.txt`.** Do not sell `llms.txt` as a ranking or AI-visibility
signal. Google (Illyes, Mueller) does not use it and likened it to the long-ignored
keywords meta tag; the major AI crawlers overwhelmingly skip `/llms.txt` and crawl HTML
directly. AI access is governed by **robots.txt + real on-page authority**, not a root
text file. Spending effort there is the modern keyword-meta-tag mistake.

## 4. Technical audit — measure, flag, hand off

**Core Web Vitals** (thresholds unchanged since INP replaced FID in March 2024):

| Metric | Good (p75) |
|---|---|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |

A URL **passes only if ≥75% of real visits hit "good" at the p75 of the CrUX field
dataset.** Lab tools (Lighthouse) *estimate*; **CrUX / field decides.** A green Lighthouse
score with a failing CrUX p75 is still a fail. **Measure and flag here — hand the actual
render-path fix to `performance`** (and to [`../nextjs/SKILL.md`](../nextjs/SKILL.md) for
App Router apps). Do not guess at LCP fixes in this skill.

**Crawlability / indexability:** correct `<link rel="canonical">`, a referenced
`sitemap.xml`, no stray `noindex`/`Disallow` on the page you want ranked, robots.txt
present and intentional.

**AI-bot access (per purpose):** robots.txt controls AI crawlers separately by purpose,
and the choice has visibility consequences.

- Blocking the *search* bot (`OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`)
  **removes you from that engine's citations.** Block only the *training* bot
  (`GPTBot`, `ClaudeBot`, `CCBot`) if you want citations but not training-corpus use.
- `Google-Extended` opts out of Google AI *training* — but **AI Overviews are served by
  ordinary Googlebot, so you cannot opt out of AI Overviews without leaving Search.**

The full 2026 user-agent table and robots.txt templates are in
[`references/ai-crawler-control.md`](references/ai-crawler-control.md).

## 5. The audit checklist (the artifact you emit)

Emit this as a pass/fail list per page. This is what `scripts/verify.sh` lints.

- [ ] `<title>` ≤ 60 chars, query near front; meta description ≤ 160.
- [ ] Exactly one `<h1>`; H2/H3 hierarchy matches intent.
- [ ] Primary query answered in the first ~40–200 words.
- [ ] JSON-LD: valid JSON, has `@context` + `@type`, **no dead type**, validates in Rich
      Results Test.
- [ ] ≥2 GEO levers present (statistic / quotation / cited source / fluency).
- [ ] CWV stated at p75 field thresholds, with pass/fail + handoff note if failing.
- [ ] canonical + sitemap correct; no accidental `noindex`.
- [ ] robots.txt does not block a *search* bot while the page claims AI visibility.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| Shipping FAQPage / Course / Vehicle JSON-LD for rich results | Deprecated (FAQ dead May 2026; seven types retired June 2025) — dead markup | Article/Product/Breadcrumb; keep Q&A as visible prose |
| Treating GEO as a separate job from Google SEO | AI Overviews use the same Googlebot / ranking / E-E-A-T | One audited page serves both surfaces |
| Adding `llms.txt` to "rank in AI" | Google ignores it; AI bots skip it | Fix robots.txt + earn real authority/citations |
| Burying the answer under intro fluff | Snippets & AI extraction need answer-first | Answer the query in the first ~40–200 words |
| Keyword stuffing for AI citation | Princeton: stuffing didn't help; quotes/stats/cites did | Add statistics, quotations, cited sources |
| Blocking OAI-SearchBot/PerplexityBot, then expecting AI citations | Search bots feed the citations | Block only training bots if you want citations |
| Calling CWV "passed" off a green Lighthouse score | CrUX p75 field decides, not the lab | Read CrUX / field at p75; lab only estimates |
| Debugging an LCP regression inside this skill | Render-path work belongs to performance | Flag the fail, hand to `performance` |

## Handoff

When the audit hits a boundary, name the owner and stop:

- **Keywords, clusters, briefs, "what should we write?"** → `content-engine`.
- **The actual article/body draft** → [`../article-writing/SKILL.md`](../article-writing/SKILL.md).
- **Persuasive value-prop / CTA copy** → `landing-copy`.
- **Fixing a CWV fail (render, hydration, bundle)** → `performance`.
- **Wiring `generateMetadata` / sitemap route / app-router SEO** → [`../nextjs/SKILL.md`](../nextjs/SKILL.md).
- **WAI-ARIA / contrast / keyboard a11y** → `accessibility`.
- **Measuring traffic / GA4 / Search Console dashboards after** → `analytics`.
