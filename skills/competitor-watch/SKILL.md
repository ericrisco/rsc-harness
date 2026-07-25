---
name: competitor-watch
description: "Use when an already-named set of rivals is watched on a cadence — pricing, features, positioning and changelog diffed into a maintained tracker plus an append-only, classified change log. NOT sizing the market or choosing who the rivals are (that is `market-research`), NOT one-off page extraction (that is `data-scraper`)."
tags: [competitive-intelligence, monitoring, pricing-tracking, feature-tracking, marketing-ops]
recommends: [market-research, pricing, sales-pipeline, brand-voice, data-scraper, automation-flows, seo-geo]
origin: risco
---

# competitor-watch

You run a **standing watch**, not a one-shot study. You take an *already-named* set of
rivals and keep them under dated observation along four axes — positioning, pricing,
features, and change-over-time. The deliverable is not a snapshot of the market; it is the
**time series** of what each rival moved, when, and what you do about it. Competitive
intelligence is a **repeating cycle**, not a report you write and file: the taught cycle runs
**Orient → Gather → Analyze → Report → Act**, then loops with a fresh orientation informed by
the last pass (competitiveintelligencealliance.io, accessed 2026-06-02).

Two near-misses decide the routing (the rest are in **Handoffs**, below). `../market-research/SKILL.md`
answers *"what is the market and who is in it"* once, and often **produces the list you watch** —
you are the downstream loop that watches that list forever. `../data-scraper/SKILL.md` owns the
generic mechanics of pulling data off a page on demand; you *use* change detection as a means, but
your identity is the maintained tracker + classified change log + cadence. "Extract this one table
once" → data-scraper. "Keep watching these five companies" → you.

## Ethics gate — runs FIRST, before any capture

Legitimate CI is **legal + ethical collection from public, observable sources** with your
identity disclosed. SCIP's Code of Ethics is the industry line (scip.org, accessed 2026-06-02).
The practical gate is the **front-page test**: would you be comfortable if your collection
method were reported on the front page of the news? If not, don't do it.

- **Public/observable sources only** — their own site, public filings, trade-show material,
  published reviews (G2/Capterra), public social. *Why:* anything else is not CI, it's a legal risk.
- **Never pose as a customer** to extract non-public info (no fake demo requests, no false
  pretenses, no misrepresenting who you are). *Why:* it's a Code-of-Ethics violation and it taints the data.
- **Never bypass access controls, paywalls, or rate limits / "no-scrape" terms.** *Why:*
  circumventing access is the bright line between intelligence and intrusion.

If a request needs any of those, **refuse and reframe to the legal equivalent**: instead of
"get their internal pricing," watch their *public* pricing page on a cadence and log the moves.

## Ground & scope before you watch anything

1. **Get the competitor list.** If there is none, or it's unvalidated guesswork → STOP and
   route to `../market-research/SKILL.md`. *Why:* watching the wrong rivals forever is worse
   than not watching. You are not the one who decides who the competitors are.
2. **Pick the vital few, then the watch-axes.** The 3–7 rivals that move your roadmap, and only
   the surfaces (below) that change your decisions. *Why:* watching 30 companies on every axis
   produces noise nobody reads; depth on the few beats breadth on the many.
3. **Persist the tracker of record** under `02-DOCS/wiki/competitors/` (one profile per rival
   + a shared change log); keep raw captures under `02-DOCS/raw/competitors/`. *Why:* the
   tracker is a maintained artifact, not a chat answer — it has to live somewhere re-runnable.
4. **Every price/feature cell carries a `source_url` + `date`, or it stays blank.** *Why:*
   this is the single highest-value guard against inventing a rival's number. If you didn't
   see it on a dated public page, you don't know it — leave the cell empty and say so.

```text
Bad:  Acme Pro tier — $79/mo                          (no source, no date — invented)
Good: Acme Pro tier — $79/mo  [acme.com/pricing, 2026-05-28]   (seen, sourced, dated)
```

## Watch-list → config: map each surface

This is the real branch — different surfaces want different cadences and different selector
types, so the table earns its place. Cadence is tiered by how fast the surface moves: time-
sensitive surfaces want **5–15 min** checks, general competitor surfaces **hourly–daily**,
slow/compliance surfaces **daily** (visualping.io / scrapx.io cadence guidance, accessed
2026-06-02). Over-frequent on a slow page is just cost and noise; under-frequent on pricing is a missed move.

| Axis (surface) | What you watch | Cadence | Selector type |
|---|---|---|---|
| Pricing / packaging | the price node, tier names, promo banner | **5–15 min** | CSS on the price element, or JSONPath if pricing comes from an API |
| Features / changelog | release-notes / "what's new" list | daily | CSS on the release list (first N items) |
| Positioning / homepage | hero headline + subhead copy | daily–weekly | CSS on the hero text block |
| Launches / partnerships | press / blog index | daily | CSS on the post list |
| Careers / hiring | open-roles count + titles | weekly | CSS on the jobs list (signals strategy) |
| Customer reviews | G2 / Capterra recent reviews | weekly | CSS on the review feed |
| Social | public profile / posts | daily–weekly | platform-dependent; public only |

That mapping — **URL + selector + cadence per surface** — *is* the monitoring config. Write
it down as config, don't hold it in your head.

## The change loop

Each pass on a watched URL: **capture → diff vs last → classify → score → log → flag.**

1. **Capture** the watched node (not the whole page — the selector keeps the diff signal-clean).
2. **Diff** against the last stored capture for that URL.
3. **Classify** the change into exactly one axis: `pricing | feature | positioning | messaging | team | other`.
4. **Score materiality**: `high` (changes our roadmap or pricing), `medium` (worth knowing),
   `low` (cosmetic / noise). *Why:* a diff with no classification and no materiality is noise — it
   tells you something moved but not whether to care.
5. **Append a dated change-log row.** Never overwrite; the log is the time series.
6. **Flag the `high` rows** for action and route them — a price move to whoever owns *our*
   pricing decision, a feature ship to product. You log and flag; you don't make those calls.

```text
Bad:  "They changed their website."
      (no date, no axis, no old/new, no materiality, no action — unactionable)

Good: 2026-05-20 · pricing · Acme · acme.com/pricing
      Pro tier $49→$59/mo · high · revisit our mid-tier vs theirs
      (dated, classified, old→new, scored, with a next step)
```

## The tracker artifacts

Three structured files. Required fields named here; full schema + a filled end-to-end example
competitor live in `references/tracker-schema.md`. The profile is a `.md` page under the
`02-DOCS/wiki/` OKF v0.1 bundle, so its YAML frontmatter carries a non-empty `type: competitor`
(plus the OKF-recommended `title`/`description`/`tags`/`timestamp`) alongside the domain keys;
its body uses standard markdown links, never wikilinks. The two CSVs are data files, not OKF
documents.

- **Competitor profile** (one per rival): OKF frontmatter (`type: competitor`, …) + the domain
  keys `name`, `positioning_line`, `segment`, pricing tiers (each with `amount`, `currency`,
  `source_url`, `date`), feature-matrix rows, watched URLs.
- **Feature matrix** (CSV): rows = features, columns = competitors, each cell sourced + dated.
- **Change log** (CSV, append-only): `date,competitor,axis,url,old_value,new_value,materiality,action`.

```csv
date,competitor,axis,url,old_value,new_value,materiality,action
2026-05-20,Acme,pricing,https://acme.com/pricing,$49/mo,$59/mo,high,revisit our mid-tier
2026-05-22,Acme,feature,https://acme.com/changelog,,SSO on Team plan,medium,note for product
```

## Tooling — what you can actually run

The runnable default is **`changedetection.io`** (open-source, self-hosted): it does text/
visual / **XPath/CSS-selector** and **JSON-API (JSONPath / jq)** change detection, checks as
often as ~1 minute, notifies via Slack/Discord/Telegram/email/API, and ships AI change
summaries like "Price dropped from \$89.99 to \$67.00" (github.com/dgtlmoon/changedetection.io,
accessed 2026-06-02). Prefer this when you must *produce a config you can run* rather than
recommend a SaaS. Full docker-compose + per-axis watch recipe is in `references/monitoring-config.md`.

- **The Wayback Machine is an archive, not a monitor.** It captures *some* snapshots (a
  pricing page may be archived once in months, or never) and **does not tell you when something
  changed**; its "Changes" diff (added=blue, deleted=yellow) only compares two existing
  captures (archive.org "Compare two versions", accessed 2026-06-02). Use it to **reconstruct
  historical positioning**, never as the live alerting layer.
- **The paid CI-suite tier** exists and sets the feature bar — quote real numbers, don't
  over-prescribe: Crayon median ≈\$28.7K/yr, Klue ~\$16K–\$42.7K/yr (priced by seats), Kompyte
  ~\$20K avg ARR (entry from ~\$300/yr), lightweight page-monitors Visualping from ~\$10/mo,
  ChangeTower from ~\$9/mo (vendr.com, autobound.ai, kompyte.com, accessed 2026-06-02). These
  auto-update battlecards — but the **battlecard is a sales artifact owned by `../sales-pipeline/SKILL.md`**,
  not you. A self-host config covers most teams; the suite is overkill until you're tracking
  many rivals across social + filings 24/7 with a dedicated CI owner.
- **The recurring run** (cron / webhook scheduling) is wiring, not watching → `../automation-flows/SKILL.md`.

## Handoffs

| Request | Route to |
|---|---|
| Size the market, produce/validate the competitor list, TAM/SAM/SOM, buyer/JTBD | `../market-research/SKILL.md` |
| Set OUR price / packaging / tiers (a decision, not an observation) | `../pricing/SKILL.md` |
| Build the sales battlecard / objection handling / "why we win" | `../sales-pipeline/SKILL.md` |
| Define OUR positioning / value prop / messaging | `../brand-voice/SKILL.md` |
| One-off "extract this page/table once" with no cadence or tracker | `../data-scraper/SKILL.md` |
| Wire the recurring run as a cron/webhook automation | `../automation-flows/SKILL.md` |
| Track OUR own SEO / AI-search visibility vs rivals on one page | `../seo-geo/SKILL.md` |

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Treating it as a one-shot study | The value is the delta over time; a snapshot is stale on arrival | Set a cadence, append to a change log every pass |
| Inventing a rival's price/feature | Unsourced "facts" pollute the tracker and mislead decisions | Every cell gets `source_url` + `date`, or stays blank |
| Posing as a customer / bypassing a paywall | Fails the front-page test; not CI, it's a legal risk | Public observable sources only; refuse and reframe |
| Using the Wayback Machine as the live monitor | It doesn't tell you *when* something changed and may never capture the page | Wayback for historical reconstruction only; changedetection.io for live alerts |
| 5-min cadence on a careers page / weekly on pricing | Over-frequent = noise + cost; under-frequent = a missed move | Tier the cadence by axis volatility (see the table) |
| Logging a raw diff with no axis/materiality | "Something changed" is unactionable | Classify the axis, score materiality, add a next step |
| Watching 30 competitors | Breadth produces noise nobody reads | Watch the vital 3–7 that move your roadmap |
| Building the battlecard inside this skill | That's sales enablement, a different owner | Hand off to `../sales-pipeline/SKILL.md`; you supply the tracker |

## Verify

After you emit a tracker / change log / config, run `scripts/verify.sh` against your project
docs. Read-only lint: required tracker columns present; **every pricing/feature row has a
non-empty `source_url` and `date`** (the anti-invention guard); change-log `axis` and
`materiality` in the allowed sets, with a `url` + `date` on every row; and a **warning** when a
monitoring-config entry pairs a slow axis with a sub-15-min cadence, or pricing with a
slower-than-daily one. It exits 0 on an empty/clean target — no false failures.
