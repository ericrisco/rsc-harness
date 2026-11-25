# SEO & GEO — Get Found by Google AND Cited by AI Engines

This is the **technical + AI-visibility** layer under the marketing skill. The skill body writes
SEO-*aware copy structure* (one `<h1>`, query-answering subheads, benefit in the first 160 chars);
this reference owns the rest: traditional on-page/technical SEO, GEO (getting cited by AI engines),
JSON-LD schema, per-engine optimization, and the keyword/SERP research workflow.

**Two surfaces, one piece of content:**

- **SEO** — rank in *traditional* search results: **Google, Bing**. The engine returns a list of
  links; you want to be near the top.
- **GEO (Generative Engine Optimization)** — get *cited* inside an AI answer: **ChatGPT,
  Perplexity, Gemini / Google AI Overviews, Claude, Microsoft Copilot**. There is no list of ten
  blue links — the engine writes one answer and footnotes a handful of sources.

> **The one insight that reframes everything:** AI engines don't rank pages, they **cite sources**.
> Being one of the 3–5 sources an answer is built from is the new "ranking #1". You optimize not to
> be clicked, but to be *quoted and attributed*. Most pages are invisible here; a page that is
> specific, well-sourced, and cleanly structured is disproportionately likely to be the one cited.

GEO does not replace SEO — it sits on top of it. The same page should be crawlable and ranked
(SEO) *and* quotable and attributed (GEO). The two share ~62% of their signals; the GEO-specific
~38% is what this reference adds.

---

## Quick start — audit, then decide

Run the free, no-API audit first. It tells you what you already have before you change anything.

```bash
python3 scripts/seo_audit.py "https://example.com"
```

It reports: `<title>` + length, meta description + length, presence of OG tags, the `<h1>`, count
of JSON-LD blocks, load time, whether `robots.txt` exists and which AI bots it names, and whether a
`sitemap.xml` is served. No API key, no install beyond Python 3 stdlib. (Deeper, API-keyed scripts
exist upstream — see "Optional tooling" at the end — but you do not need them for an audit.)

Then triage with the priority levels below.

| Level | Meaning | Action |
| --- | --- | --- |
| **P0** | Critical — blocks indexing/citation | Fix immediately |
| **P1** | Important — significant ranking/citation impact | Fix this sprint |
| **P2** | Recommended — polish, incremental gains | Backlog |

---

## GEO — getting cited by AI engines

The systematic methods come from the Princeton/IIT-Delhi/Georgia-Tech/Allen-AI paper *GEO:
Generative Engine Optimization* (Aggarwal et al., arXiv:2311.09735, **KDD 2024**). The authors
A/B-tested content edits against a commercial generative engine (Perplexity) and measured the
change in a page's share of the cited answer. These are the edits that moved the needle.

> **Read these as a *directional* ordering, not measured numbers.** They come from one 2023–24
> study on one engine, so treat them as a ranked priority list — what to try first, not a lift you
> can promise. The *ordering* has held up; the original per-method percentages have **not** been
> independently reproduced, so they are deliberately omitted here. Lead with the top three.

Listed highest-impact → lowest. Impact is the study's *relative* effect, not a guaranteed number.

| Method | Impact | How to apply |
| --- | --- | --- |
| **Cite sources** | strong | Link claims to authoritative references ("According to a 2024 Stanford study…"). Low-ranking pages saw the biggest jump. |
| **Add statistics** | strong | Replace vague claims with specific, verifiable numbers and a source. |
| **Add quotations** | strong | Quote a named expert with attribution. |
| **Authoritative tone** | moderate | State findings with confidence; drop "might", "I think", hedging. |
| **Easy to understand** | moderate | Explain the hard concept in plain language before the jargon. |
| **Technical terms** | moderate | Use the correct domain vocabulary so the engine matches specialist queries. |
| **Unique words / vocabulary diversity** | modest | Avoid repetitive phrasing; vary terminology. |
| **Fluency optimization** | moderate | Clean grammar, logical flow, short focused paragraphs. |
| ~~**Keyword stuffing**~~ | **negative** | **Actively hurts GEO.** Unlike old-school SEO, repetition *lowers* citation rate. |

**Best combination:** *Fluency + Statistics* gave the highest overall lift. *Citations +
Authoritative tone* won for professional/B2B content.

These map cleanly onto the marketing skill's non-negotiables — "specificity beats adjectives",
"no invented proof", "one claim per asset" are *also* the top GEO moves. **The honest, specific,
sourced copy this skill already insists on is the same copy AI engines cite.** The marketing
ban-list applies in full: hype words and keyword stuffing both repel humans and AI.

> **Hard rule carried over from the skill body: never fabricate the statistic, quote, or citation
> that earns the lift.** A made-up "67% of teams" is a defect, not a GEO tactic. Mark
> `[[NEEDS PROOF]]` and get a real source — an AI engine that catches an unsourced number stops
> citing the domain.

### Structure content so it can be extracted

AI engines lift *passages*, not pages. Make the passage trivial to extract:

- **Answer-first.** The direct answer in the first sentence under the heading, then elaborate. Don't
  bury the lede behind a preamble.
- **One idea per paragraph**, 2–3 sentences. Atomic paragraphs are quotable; walls of text are not.
- **Phrase headings as the question** the user actually asks ("How much does X cost?"), then answer
  it immediately underneath.
- **Lists for steps, tables for comparisons.** Engines extract these near-verbatim.
- **Keep content fresh.** Recency is a real citation signal (see per-engine table). Stamp and
  genuinely update `dateModified`.

### Let the right AI crawlers in (2026 landscape)

A page can't be cited if the engine can't fetch it. As of 2026 the AI-crawler ecosystem splits into
**three** roles — and you usually want to **allow the retrieval and user fetchers even if you block
the training crawlers**:

| Role | What it does | Examples | Default stance |
| --- | --- | --- | --- |
| **Search / retrieval** | Builds the index the engine cites at answer time | `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Amazonbot` | **Allow** — this is how you get cited |
| **User-initiated fetch** | Fetches your page live when a user asks | `ChatGPT-User`, `Perplexity-User`, `Claude-User` | **Allow** — blocking kills live citations |
| **Model training** | Crawls to train the base model | `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot` | Your call — allow for reach, block to keep content out of training |

Critically, these are **independently controllable**: OpenAI documents allowing `OAI-SearchBot`
while disallowing `GPTBot`, and `Claude-SearchBot` is separate from `ClaudeBot`. So "I don't want my
content in training data" does **not** have to mean "I don't want to be cited".

```text
# robots.txt — allow citation/retrieval, opt out of training (a common 2026 stance)
User-agent: OAI-SearchBot      # ChatGPT Search retrieval
Allow: /
User-agent: ChatGPT-User       # live fetch when a user asks ChatGPT
Allow: /
User-agent: PerplexityBot      # Perplexity index
Allow: /
User-agent: Perplexity-User    # live fetch
Allow: /
User-agent: Claude-SearchBot   # Claude retrieval index
Allow: /
User-agent: Claude-User        # live fetch
Allow: /
User-agent: Googlebot          # Google Search + AI Overviews
Allow: /
User-agent: Bingbot            # Bing + Copilot
Allow: /

# Training crawlers — uncomment Disallow to opt OUT of training corpora:
# User-agent: GPTBot
# Disallow: /
# User-agent: ClaudeBot
# Disallow: /
# User-agent: Google-Extended
# Disallow: /

Sitemap: https://example.com/sitemap.xml
```

```text
Bad  — `User-agent: * / Disallow: /` on a site that wants AI visibility — invisible to every engine.
Good — Allow the retrieval + user-fetch bots above; decide on training crawlers deliberately.
```

> The upstream skill lumped all bots into one "allow everything" block and treated `GPTBot` as the
> way to get cited. That is out of date: `GPTBot` is a *training* crawler; `OAI-SearchBot` is what
> actually feeds ChatGPT's citations. Allow the search/user bots; the training bots are a separate,
> optional decision.

---

## Per-engine optimization

Each engine cites from a different index and weights different signals. Optimize the same page for
all of them, then bias toward wherever your audience actually asks.

| Engine | Index it cites from | What moves citations |
| --- | --- | --- |
| **ChatGPT** | Bing-based web + `OAI-SearchBot` | Content-answer fit (match the question's framing), branded/first-party domains over aggregators, recency, a real backlink profile. |
| **Perplexity** | Own crawl + Google | FAQ schema, clean atomic paragraphs, publicly hosted PDFs, semantic relevance over keyword match, publishing velocity. |
| **Google AI Overviews / Gemini** | Google | E-E-A-T (Experience, Expertise, Authority, Trust), structured data, topical authority via content clusters + internal links, authoritative citations. |
| **Microsoft Copilot** | Bing | Be indexed in Bing (use IndexNow), page speed, clear entity definitions, Microsoft-ecosystem signals (LinkedIn, GitHub). |
| **Claude** | Own retrieval (`Claude-SearchBot`) + web search | High factual density, clean extractable structure, well-sourced claims. Claude crawls far more than it cites — be the quotable, sourced page. |

**Universal moves that help every engine:** allow the retrieval/user bots, ship FAQPage + Article +
Organization schema, build genuine backlinks, keep content current, structure with clear H1>H2>H3
and lists/tables, and put specific sourced statistics up front.

---

## Traditional SEO — on-page & technical checklist

### On-page (P0 unless noted)

- [ ] One unique `<title>`, **50–60 chars**, primary keyword toward the front.
- [ ] One unique `<meta name="description">`, **120–160 chars**, compelling, includes the keyword.
- [ ] Exactly **one `<h1>`** per page, containing the primary keyword. (The skill's `verify.sh`
      flags multiple `<h1>`.)
- [ ] Logical heading hierarchy: H1 > H2 > H3, no skipped levels.
- [ ] **(P1)** Every `<img>` has descriptive `alt` text; descriptive file names.
- [ ] **(P1)** Internal links to related content with descriptive anchor text; no 404s.
- [ ] **(P1)** Canonical tag set; no duplicate-content collisions.
- [ ] **(P2)** Open Graph (`og:title/description/image` 1200×630 / `og:url` / `og:type`) and
      Twitter card (`summary_large_image`) tags set.
- [ ] **(P2)** External links use `rel="noopener noreferrer"`.

```html
<title>Live PR Previews in 30 Seconds — Driftway</title>
<meta name="description" content="Get a live preview URL on every pull request in 30 seconds. One CLI step, no staging queue. Start free, no credit card.">
```

### Technical (P0 unless noted)

- [ ] Site reachable, no 5xx; HTTPS with a valid certificate.
- [ ] Mobile-responsive (Google indexes mobile-first).
- [ ] No critical page blocked by `noindex` or by `robots.txt`.
- [ ] Indexed: check `site:yourdomain.com` on Google **and** Bing (Bing index gates Copilot).
- [ ] **(P1)** XML sitemap exists and is submitted to Google Search Console + Bing Webmaster Tools.
- [ ] **(P1)** Core Web Vitals in the green (see below).
- [ ] **(P2)** Images optimized (WebP, lazy-load), CSS/JS minified, Brotli/GZIP on, CDN in front.

### Core Web Vitals (current thresholds)

Google's three Core Web Vitals as of **2026**. **INP replaced FID on 12 March 2024** — FID is
retired; do not target it.

| Metric | Measures | Good | Needs work | Poor |
| --- | --- | --- | --- | --- |
| **LCP** (Largest Contentful Paint) | Loading | ≤ 2.5 s | 2.5–4 s | > 4 s |
| **INP** (Interaction to Next Paint) | Responsiveness | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | Visual stability | ≤ 0.1 | 0.1–0.25 | > 0.25 |

Implementing these in a Next.js app (Metadata API, `next/image`, font strategy) belongs to the
sibling `nextjs` skill — this reference defines the targets; `nextjs` hits them.

### Off-page & E-E-A-T

Backlinks from relevant, diverse referring domains remain Google's strongest off-page signal and a
top predictor of AI citation too. Demonstrate **E-E-A-T**: author bios with credentials, an about
page, visible contact info, privacy/terms, and real reviews/testimonials. Brand mentions count even
without a link. (Acquiring backlinks is outreach/PR work — flag it as a dependency; this skill does
not buy or fabricate links.)

---

## JSON-LD schema

Schema markup is structured data that tells engines exactly what a page is — and FAQPage in
particular is a strong GEO signal because it hands the engine pre-extracted Q&A pairs. Put one
`<script type="application/ld+json">` block in the page `<head>` (in Next.js, render it via the
Metadata API or a `<Script>` tag). Validate every block before shipping.

**Pick by page type:** `Organization` (homepage/about) · `WebPage` (any page) · `Article`
(blog/news, with author + `datePublished`/`dateModified`) · `FAQPage` (any Q&A — highest GEO value)
· `Product` (e-commerce) · `SoftwareApplication` (tools/apps) · `HowTo` (tutorials; Google retired HowTo rich results in 2023) ·
`BreadcrumbList` (navigation) · `LocalBusiness` (physical location). Combine several on one page with
`@graph`.

**FAQPage — the single highest-leverage schema for GEO:**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How fast can I get a preview URL?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "In about 30 seconds. Run `driftway up` on any branch and it prints a live URL — no staging queue, no YAML."
      }
    }
  ]
}
```

**Article — for blog/tutorial content (author + dates are the GEO-relevant fields):**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Live PR Previews Without a Staging Queue",
  "datePublished": "2026-01-15T08:00:00+00:00",
  "dateModified": "2026-05-20T10:30:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Jordan Rivera",
    "jobTitle": "Staff Engineer",
    "url": "https://example.com/author/jordan"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Driftway",
    "logo": { "@type": "ImageObject", "url": "https://example.com/logo.png" }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://example.com/blog/previews" }
}
```

**Organization — homepage/about (the `sameAs` links tie your entity to its profiles):**

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Driftway",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://github.com/driftway",
    "https://linkedin.com/company/driftway",
    "https://x.com/driftway"
  ]
}
```

For Product, SoftwareApplication, HowTo, BreadcrumbList, LocalBusiness, SpeakableSpecification, and
a combined `@graph` example, the full template set lives in the upstream skill credited above; the
three types here cover the overwhelming majority of marketing sites.

**Validate before shipping (no fabricated ratings or reviews in schema — same proof rule):**

- Google Rich Results Test — `https://search.google.com/test/rich-results`
- Schema.org Validator — `https://validator.schema.org/`
- Google Search Console → *Enhancements* for live errors after deploy.

---

## Keyword & SERP research workflow

You do not need a paid tool to do real keyword work. Use the agent's **WebSearch** plus the free
audit. Escalate to APIs only when scale demands it.

1. **Seed from the brand study.** The SEO keywords dimension in `02-DOCS/wiki/brand/` is the
   starting list — never invent keywords the brand hasn't claimed.
2. **Expand with WebSearch.** Search the seed terms; read the People-Also-Ask questions and the
   autocomplete-style related queries that surface. Each real question is a candidate FAQ entry and
   an answer-first heading.
   ```text
   WebSearch: "{keyword} 2026"                         # current volume/intent signal
   WebSearch: "{keyword} vs {alternative}"             # comparison intent → comparison table
   WebSearch: "how to {job the keyword implies}"       # informational intent → HowTo
   ```
3. **Read the SERP for intent.** Look at what already ranks: are the top results how-tos, product
   pages, or listicles? Match that intent or you won't rank regardless of copy quality.
4. **Map one primary keyword per page; no cannibalization.** Two pages chasing the same term
   compete with each other. Assign secondary/long-tail keywords as subheads.
5. **Check the AI answer too.** Ask the question in ChatGPT/Perplexity and see who gets cited —
   those citations *are* your GEO competitor set, often different from the Google top 10.

> **Optional paid tooling (no API key required for anything above):** the upstream `seo-geo` skill
> ships DataForSEO-backed Python scripts — `keyword_research.py`, `related_keywords.py`,
> `serp_analysis.py`, `backlinks.py`, `domain_overview.py`, `competitor_gap.py`,
> `autocomplete_ideas.py` — for programmatic volume/difficulty/backlink data. They require
> `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` and are **not** vendored here; only the free
> `seo_audit.py` is. Reach for them when you're running SEO at scale, not for a single site.

---

## Anti-patterns / rationalizations → STOP

| Rationalization | Reality / Fix |
| --- | --- |
| "GEO replaces SEO, skip the technical stuff" | GEO sits *on top of* SEO; a page that can't be crawled or ranked can't be cited either. Do both. |
| "Stuff the keyword everywhere to rank" | Keyword stuffing helps nothing and *lowers* AI citation by ~10%. Write naturally; one primary keyword per page. |
| "Add a `67% of teams` stat — sounds citable" | Fabricated stats are a defect and get a domain dropped once caught. Mark `[[NEEDS PROOF]]`, source it, then ship. |
| "Allow `GPTBot` so ChatGPT cites me" | `GPTBot` is a *training* crawler. `OAI-SearchBot` (+ `ChatGPT-User`) is what feeds citations. Allow the right bot. |
| "Block all AI bots to protect content" | That makes you invisible in AI answers. Block *training* crawlers if you must; keep *retrieval* + *user* fetchers allowed. |
| "Target FID for responsiveness" | FID was retired 12 Mar 2024. Optimize **INP** (≤ 200 ms good). |
| "More schema types = better" | Invalid or irrelevant schema is ignored or penalized. Ship the few types that match the page, and validate them. |
| "One `<h1>` is a copy detail" | It's also a ranking + extraction signal. Exactly one, with the keyword. |

---

## SEO/GEO QA gate

Run before claiming a page is optimized.

- [ ] `scripts/seo_audit.py` run; title/description lengths, single `<h1>`, JSON-LD count, load
      time, robots/sitemap reviewed.
- [ ] Title 50–60 chars, meta description 120–160, both with the primary keyword.
- [ ] Exactly one `<h1>` with the keyword; clean H1>H2>H3 hierarchy.
- [ ] Answer-first structure; atomic 2–3-sentence paragraphs; lists/tables where they fit.
- [ ] At least the top-3 GEO methods applied (cite sources, statistics, quotations) — every stat
      and quote real and sourced, none fabricated.
- [ ] FAQPage + Article/Organization schema present and **validated**; no fake ratings/reviews.
- [ ] `robots.txt` allows the retrieval + user-fetch AI bots; training-crawler decision is deliberate.
- [ ] Core Web Vitals targeted: LCP ≤ 2.5 s, **INP ≤ 200 ms**, CLS ≤ 0.1.
- [ ] One primary keyword per page; no cannibalization; no keyword stuffing.
- [ ] Indexed in Google **and** Bing; sitemap submitted to both.

---

## See Also

- `SKILL.md` (`## SEO & GEO`) — the marketing skill that owns this reference and the SEO-aware copy
  structure rules.
- `../nextjs/SKILL.md` — implements the technical layer: Metadata API for title/description/OG and
  JSON-LD, `next/image` and font strategy for Core Web Vitals.
- `../design/SKILL.md` — the visual/UX layer; CLS and LCP are as much layout as code.
- `../harness/SKILL.md` — the `02-DOCS/wiki/brand/` study whose SEO-keywords dimension seeds the research above.
