---
name: data-scraper
description: "Use when data lives on a website with no usable API — listings, prices, public records — and the scrape must stay legal and not get blocked: legal gate, extraction path, durable selectors, pacing, resilience. NOT parsing bytes you already hold into fields (that is structured-extraction), NOT a documented API or key (that is api-connector-builder)."
tags: [web-scraping, crawler, anti-bot, robots-txt, gdpr-compliance, playwright, rate-limiting]
recommends: [api-connector-builder, structured-extraction, data-cleaning, gdpr-privacy, webhooks]
origin: risco
---

# Data scraper

You get bytes off websites you do not control — legally, and without getting blocked. You pick the cheapest extraction path that works, build selectors that survive a redesign, pace requests so the host neither bans nor sues you, and you write down the legal basis *before* the first request goes out.

One rule above all the others: **scraping is the fallback, not the default.** It is what you reach for only when no API serves the data. If the site has a documented API or you hold a key, stop — that is `../api-connector-builder/SKILL.md`. And once you have the bytes, parsing them into fields is `../structured-extraction/SKILL.md`, normalizing the rows is `../data-cleaning/SKILL.md`. This skill ends the moment you hold the bytes.

In 2025-2026 scrapers do not fail on parsing. They fail on a terms-of-service breach, on GDPR exposure, or on being blocked after hammering a host. So the work runs in this order: legal gate → extraction path → tool → selectors → politeness → resilience. Skipping the gate is how you end up in *Meta v. Bright Data*.

## The legal gate — run this before any request

Walk every item. Each ends in **proceed**, **proceed-narrowed**, or **stop**. One item at stop means the whole scrape stops until you resolve it. Depth and the case law are in `references/legal-compliance.md`.

The gates below are the ones with real legal exposure — contract, data-protection law, and anti-circumvention. **robots.txt is not one of them**: it is a voluntary convention with no statutory force, so it informs the decision and never blocks it on its own.

- [ ] **Is there an API?** If yes, you are in the wrong skill — never scrape what an API serves. → otherwise proceed.
- [ ] **Did you read the ToS, and does login/auth apply?** Scraping is most exposed as *breach of contract* when you accepted terms — typically by logging in (*Meta v. Bright Data*, 2024). Logged-out public data weakens that claim. **Prefer logged-out public pages; never bypass auth.** → narrow to public, or stop.
- [ ] **Is it personal data?** Names, emails, photos, reviews, IP addresses all count. Scraping public personal data for a *new* purpose — aggregation, resale, AI training — is a severe GDPR breach with fines into the tens of millions of EUR. You need a lawful basis (usually legitimate interest) and data minimization. Filter out special categories at the source. → proceed-narrowed (basis + minimization, see `../gdpr-privacy/SKILL.md`), or stop.
- [ ] **robots.txt and ai.txt?** Read them — they are a *convention*, not law, so this item never stops a scrape on its own. A `Disallow` tells you the host would rather you did not, and `Crawl-delay` tells you its tolerance; both are useful intelligence about where you are likely to get blocked. Weigh it: honoring robots is the low-friction default and the cleanest evidence of good faith, but scraping your own site, one you have permission for, or public pages for research is legitimate whether or not robots allows it. → **advisory: note the decision and move on.**
- [ ] **Are you about to bypass a control you were shown?** A CAPTCHA, a hard block, an enforced rate limit. *Reddit v. Perplexity AI* (2025) turns precisely on whether anti-bot measures were circumvented — a materially worse position than respectfully pacing public pages. Pacing public data is defensible; defeating a control is the frontier where you lose. → **stop. Do not solve the CAPTCHA. Do not bypass the block.**

`hiQ v. LinkedIn` established that scraping *public* data is not automatically a CFAA violation — but that is the floor, not a license. Public + logged-out + no-personal-data is the defensible quadrant, and honoring robots keeps it tidy without being what makes it lawful. Anything outside it, document why and get a human to sign off.

## Extraction-path decision table

Walk *down* only when the rung above is unavailable. ~94% of modern sites are client-side rendered, yet most still ship machine-readable structured data — parse that before you launch a browser.

| Path | Use when | Cost | Detectability |
|------|----------|------|---------------|
| **API** (incl. internal XHR/JSON endpoints) | Any documented API, or the page fetches its own JSON you can call directly | Lowest | Lowest — looks like normal traffic |
| **sitemap.xml + JSON-LD** | `/sitemap.xml` lists the URLs; `<script type="application/ld+json">` carries the records (JSON-LD is Google's preferred structured format, so it is everywhere) | Low — one HTTP GET, parse JSON | Low |
| **HTML selectors** | Data is in server-rendered HTML, no JSON-LD, no XHR JSON | Medium — selectors drift on redesign | Medium |
| **Headless browser** | The data only exists after JS executes (SPA, lazy-load, infinite scroll) and there is no callable XHR endpoint | Highest — CPU, RAM, time, easiest to fingerprint | Highest |

Before you reach for a browser, open DevTools → Network and look for the XHR/fetch that already returns JSON. Calling that endpoint directly is faster, stabler, and less detectable than rendering the whole page to read what the page itself fetched.

## Tool picker

| Site profile | Tool | Version (2026) | The one reason |
|--------------|------|----------------|----------------|
| Static HTML, no fingerprint wall | `httpx` + `selectolax` (or BeautifulSoup) | current | Fast, no browser; `selectolax` parses far quicker than `lxml` |
| Static HTML but TLS/JA3 fingerprint blocks you | `curl_cffi` (profile `chrome131`) | current | Impersonates a real browser's TLS/JA3/HTTP2 fingerprint, not just the User-Agent |
| JS-rendered SPA | Playwright | 1.60.0 (1.59 shipped 2026-04-01) | First-class async, auto-wait, the maintained headless standard |
| Scalable, resilient, recurring crawler | Crawlee (JS or Python) | actively maintained 2026 | Wraps Playwright + proxy rotation + browserforge fingerprints + a disk-persisted `RequestQueue` that resumes after a crash |
| Pure-Python static, legacy codebase | Scrapy | current | Battle-tested for static targets — but its Twisted core lags the asyncio ecosystem; pick Crawlee for new work |

Default new builds to **Crawlee** when the job is recurring or must not break; reach for plain `httpx`/`curl_cffi` only when the target is static and one-shot.

## Robust selectors

Selectors break on redesign because they ride on layout, not meaning. Anchor on what is *semantically* stable — `data-*` attributes, ARIA roles, microdata, visible text — never on `nth-child` chains or generated CSS class hashes (`.css-1a2b3c`), which change on every build.

```html
<!-- the page you are scraping -->
<article data-testid="listing-card">
  <h2 class="css-1a2b3c">Acme Drill 9000</h2>
  <span data-price="129.00">€129,00</span>
</article>
```

```python
# Bad — rides on layout and a build-generated hash; dies on the next deploy
title = page.query_selector("div:nth-child(3) > article > .css-1a2b3c").inner_text()

# Good — anchor on stable semantics, with a fallback chain, and fail loud
def text_or_raise(card, selectors, field):
    for sel in selectors:           # try each selector in priority order
        el = card.query_selector(sel)
        if el and el.inner_text().strip():
            return el.inner_text().strip()
    raise LookupError(f"required field {field!r} not found via {selectors}")

card  = page.query_selector('[data-testid="listing-card"]')
title = text_or_raise(card, ["h2", '[itemprop="name"]'], "title")
price = text_or_raise(card, ["[data-price]", "span:has-text('€')"], "price")
```

Two rules baked into that snippet:

- **Fallback selector chains.** Give every required field 2-3 ordered selectors. A single redesign rarely breaks all of them at once, so the scraper degrades instead of dying.
- **Fail loud on a missing required field.** Raise — never silently write `null`. A silent null is a corrupted dataset you discover three months later. A raised error is a fix you make today.

## Politeness and anti-block

Concrete numbers beat "be respectful." Depth — fingerprint profiles, header sets, proxy taxonomy — is in `references/anti-bot.md`.

- **Pace.** Start at **1 request per 1-3 seconds per host**, concurrency capped at **2-5 per host**. Tune *down* if you see 429s, never up to chase speed.
- **Backoff with jitter.** On a transient error, exponential backoff *plus* random jitter — `delay = base * 2**attempt + random(0, base)`. Without jitter, every worker retries in lockstep and you self-DDoS the host.
- **Honor 429 and `Retry-After`.** A 429 with `Retry-After: 30` means wait 30 seconds, not retry immediately. Ignoring it is the fastest route to an IP ban.
- **Conditional GET.** Send `If-Modified-Since` / `If-None-Match` (ETag) on re-crawls. A `304 Not Modified` costs nothing and tells you the page is unchanged — cheaper for you, lighter on the host.
- **Realistic headers + TLS fingerprint.** A bare `python-requests` User-Agent is an instant tell. Send a full, current browser header set; when JA3/TLS fingerprinting blocks you, switch to `curl_cffi` (`chrome131`) — see the references.
- **Proxies only when justified.** Residential/mobile proxies are for geo-gating and IP-rate distribution on a target that *permits* the scrape — never to evade a block you were explicitly shown. Budget for them on large recurring jobs; do not reach for them to defeat a hard block (that is the legal line you do not cross).

> **Resilience beats speed.** A scraper that runs 50% slower but never breaks is infinitely more valuable than a fast one that dies weekly. Pace for survival, not throughput.

## Resilience

A recurring crawler must survive crashes, redeploys, and the target's schema drift. Patterns and copy-paste starters are in `references/frameworks.md`.

- **Resumable queue.** Use a disk-persisted request queue (Crawlee's `RequestQueue`) so a crash resumes from where it stopped, not from zero. Re-crawling 10k pages because the box rebooted is wasted budget and extra load on the host.
- **Idempotent writes.** Upsert keyed on a stable id (the source URL or a record id), never blind append — so a re-run repairs rows instead of duplicating them.
- **Checkpoint every N records.** Flush progress periodically so an interrupt loses minutes, not hours.
- **Change detection by hash.** Store a content hash per record; only re-process when it changes. This pairs with conditional GET to keep recurring crawls cheap.
- **Monitor and alert.** Alert on a spike in missing-field errors (schema drift — the site redesigned) and on a spike in 403/429 (you are being blocked). Both are silent-failure modes that rot a dataset until someone checks.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
|---|---|---|
| Scraping behind a login, then calling it "public data" | Accepting ToS at login is the breach-of-contract hook (*Meta v. Bright Data*) | Stay logged-out on public pages; never bypass auth |
| Not even reading robots.txt / ai.txt | You lose free intelligence on where you will get blocked, and any good-faith story later | Parse both; honor by default, override deliberately and write down why |
| No delay, unbounded concurrency | Hammers the host → IP ban, possible CFAA-style exposure | 1 req / 1-3s, cap 2-5 concurrent per host |
| Selectors on `nth-child` / `.css-1a2b3c` hashes | Break on the next deploy; silent data loss | Anchor on `data-*` / semantic / text, with fallbacks |
| Silently writing `null` on a missing field | Corrupts the dataset; discovered months later | Raise on a missing *required* field — fail loud |
| Solving a CAPTCHA / bypassing a hard block | Circumventing a shown control (*Reddit v. Perplexity*) — the worst legal posture | Stop. That control is a "no." |
| Scraping personal data with no lawful basis | GDPR fines into tens of millions EUR | Establish basis + minimize + filter special categories (`../gdpr-privacy/SKILL.md`) |
| Storing everything "just in case" | Defeats minimization; expands breach blast radius | Keep only fields the purpose needs; set retention |
| Launching a browser when JSON-LD was right there | Slowest, most detectable, most expensive path | Check XHR/JSON-LD/sitemap first; browser is last |
| No resume — a crash restarts from zero | Wastes budget, doubles load on the host | Disk-persisted resumable queue |
| Hardcoding one User-Agent forever | Stale UA is an easy bot tell | Current full header set; rotate when justified |
| Retrying with no backoff | Lockstep retries self-DDoS the host | Exponential backoff + jitter; honor `Retry-After` |

When in doubt about whether a scrape is defensible, the answer is the gate. Run it, write down the outcome, and only then send a request.
