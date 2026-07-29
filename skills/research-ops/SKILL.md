---
name: research-ops
description: "Use when someone hands you an open question whose answer must survive scrutiny — a tech choice, a regulation, a what-is-actually-true-about-X — with every non-obvious claim dated and sourced, source disagreements surfaced rather than averaged away, and a cited memo as the deliverable. Also for refreshing a stale research memo. NOT sizing a market with TAM/SAM/SOM (that is `market-research`), NOT a standing cadence watch on named rivals (that is `competitor-watch`)."
tags: [research-ops, deep-research, source-credibility, citations, verification, synthesis, knowledge-meta]
recommends: [market-research, competitor-watch, data-scraper, knowledge-ops, decision-records, structured-extraction, technical-writing]
origin: risco
---

# Research-ops — the deep-research operating procedure

You are the **method, not the topic**. Someone hands you "go find out about X" and you
hand back a memo where every load-bearing claim traces to a source, a date, and a
confidence tier — a document that survives someone reading it adversarially. The topic
changes every time; the procedure does not.

Two hard rules, stated up front because everything else hangs off them:

- **One search pass is not research.** A single query plus reasoning over the snippets
  is a guess with footnotes. Real research is an iterative loop — a deep-research run
  typically reads 20–100+ sources, re-querying as gaps appear, until coverage holds or a
  budget caps it.
- **An unsourced claim is not a finding.** If you can't attach a source and a date, it's
  an assumption — label it as one or cut it. Human review catches AI errors in roughly
  15–20% of research reports, so structure the output so a reviewer can check each claim,
  never so they have to trust it.

## The loop

Research is an ordered loop, not a lookup. Run it in this order; each step has a reason.

1. **Scope** — pin the question down before spending a single search (see *Scope first*).
   Why: a fuzzy question burns the budget on the wrong sources.
2. **Plan queries** — write 3–6 distinct query angles, not one phrasing repeated. Cover
   the claim, the counter-claim, and the primary source. Why: you can't triangulate what
   you only searched one way.
3. **Fan out** — run the searches in parallel; collect candidate sources. Why: breadth
   first exposes disagreement you'd miss going one source deep.
4. **Fetch & read** — open the actual pages, not the result snippets. Read the primary
   source, not the blog summarizing it. Why: snippets drop caveats, dates, and numbers.
5. **Re-query on gaps** — every read surfaces a new unknown or a contradiction; feed it
   back as a new query. Why: this is the part that makes it a loop instead of a list.
6. **Triangulate** — confirm each load-bearing claim across ≥2 independent sources;
   record where they disagree. Why: triangulation is the foundation of a credible finding.
7. **Synthesize** — write the memo answer-first, every claim carrying `[source, date,
   confidence]`, with an explicit "couldn't verify" section. Why: the memo is the
   deliverable; the searches were just inputs.

> **Stop rule:** stop when new searches stop changing the answer (coverage plateaus) OR
> the budget cap is hit — whichever comes first. Looping forever is not rigor.

## Scope first

Refuse to start on an underspecified question. Researching a fuzzy ask produces a fuzzy
memo and wastes the search budget. Before the first query, get the 2–3 answers that
change which sources are even relevant.

```text
Bad  (will waste the budget):  "What car should I buy?"
Good (scopeable):              "Best used EV under €25k for a 40km daily commute,
                                bought in Spain in 2026, prioritizing range over trim."
```

The clarifiers that almost always matter: **constraint** (budget / scale / tolerance),
**context** (where, for whom, what stack), and **time** ("as of when" — 2026 answers
differ from 2023 ones). If the asker can't answer them, ask; don't guess and research the
wrong thing.

## Source credibility

Not every source counts the same. Restrict to **primary / authoritative** sources where
you can — official docs, standards bodies, regulator pages, company release notes, filings,
the actual paper. When a claim lives only in secondary commentary, it drops a confidence
tier. Pick the credibility check by source type:

| Source type | Check to apply | Default confidence |
|---|---|---|
| Official docs, standards, regulator, filing, release notes | SIFT — Trace to original; you are already at it | High |
| Peer-reviewed / scholarly / formal document | CRAAP (Currency, Relevance, Authority, Accuracy, Purpose) | High once it passes |
| Trade press / reputable news, corroborated by another | SIFT — Find better coverage, confirm elsewhere | Medium |
| Single blog, vendor marketing, forum post, uncorroborated | SIFT — Investigate the source; treat as a lead, not a fact | Low |
| AI summary / search snippet | Not a source — open the page it cites | None until traced |

**Lateral reading is the non-negotiable move.** To judge a page, leave it: open a new tab
and check what others say about the author/org rather than trusting the page's account of
itself. A site's "About" page is not evidence the site is authoritative. Full SIFT/CRAAP
walkthrough, lateral-reading recipe, and worked tier examples live in
[references/credibility-rubric.md](references/credibility-rubric.md).

## Date everything

Every non-obvious claim carries a date, because "true" has a shelf life — a 2024 pricing
fact or API behaviour may be wrong in 2026. Record **both** dates when they differ:

- **Publication date** — when the source was written/last updated.
- **Access date** — when you read it (matters for living pages with no clear pub date).

Provenance line grammar (the contract the verify gate checks):

```text
CLAIM — [Source title](https://url), pub 2026-04-12 / accessed 2026-06-02 · confidence: high
```

If a source carries no discernible date, that's a finding in itself: record `pub: n/a`,
keep the access date, and drop it a tier. **Stale → re-verify**: when refreshing an old
memo, re-run the loop on the dated claims; don't just copy yesterday's citation forward.
Full skeleton and grammar: [references/memo-template.md](references/memo-template.md).

## Verify load-bearing claims

A claim is **load-bearing** if the answer changes when it's wrong. Triangulate every one
against **≥2 independent sources** — independent meaning they don't both trace back to the
same origin (three blogs quoting one press release is one source, not three).

When sources disagree, **surface the disagreement; never average it away.** "Source A says
X, source B says Y, here's why and which I weight higher" is a finding. Splitting the
difference into a number neither source supports is a fabrication. If you genuinely find no
disagreement, say so explicitly — silence reads as "didn't check."

This is why the memo is structured claim → source → date → confidence rather than as
flowing prose: roughly 15–20% of AI research reports contain an error a human catches on
review, and they can only catch it if each claim is individually checkable.

## Synthesize

The memo is the deliverable. Structure it so the answer arrives first and the evidence
backs it up — not a link dump the reader has to assemble themselves.

```markdown
## Answer
<the direct answer in 2–4 sentences; the bottom line up front>

## Findings
- <claim> — [Source](url), pub YYYY-MM-DD / accessed YYYY-MM-DD · confidence: high|med|low
- <claim, triangulated> — corroborated by [A](url, date) and [B](url, date) · confidence: high

## Disagreements
- <where sources conflicted, and how you weighted them> — or "none found across N sources"

## Open questions / could not verify
- <what you could not source; what's still an assumption; what would settle it>
```

The "Open questions / could not verify" section is mandatory and is not a sign of failure —
it's the honest boundary of what the evidence supports. A memo with no open questions on a
hard topic is usually a memo that stopped looking.

## Budget & stop rules

Cap effort so the loop terminates. Sensible defaults for an on-demand run:

- **~5–8 searches** to start; escalate past that only when a real gap or contradiction
  demands it, not reflexively.
- **Fetch what you'll cite**, not everything you find — reading 8 sources well beats
  skimming 40.
- **Stop** when two more searches don't move the answer (coverage plateau) or the cap is
  hit. Then write — note in *Open questions* anything the budget left unresolved.

## Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|---|---|---|
| One search, then reason over the snippets | That's a guess with footnotes, not research | Run the loop: re-query on every gap |
| Citing the search-result snippet | Snippets drop caveats, dates, numbers | Fetch and cite the actual page |
| Single-source claim presented as fact | One source can be wrong or biased | Triangulate load-bearing claims across ≥2 independent sources |
| Averaging two contradicting sources | Invents a number neither source supports | Surface the disagreement and weight it |
| Trusting a page's self-description | "About us" is not evidence of authority | Lateral-read: check the org elsewhere |
| Undated citation | A 2023 fact may be false in 2026 | Record pub + accessed date on every claim |
| No confidence tier | Reader can't tell a filing from a forum post | Tag high/med/low per finding |
| No "could not verify" section | Hides the boundary of the evidence | Always include open questions |
| Synthesizing before reading | Conclusion drives the search, not the evidence | Read first, conclude after |
| Infinite search, no stop rule | Burns budget, never ships the memo | Cap searches; stop at coverage plateau |
| Topic-creep into market sizing | That's a different skill's job | Route TAM/SAM/SOM to ../market-research |
| Re-citing a stale memo unchanged | Yesterday's source may be outdated | On refresh, re-verify the dated claims |

## Verify

The memo is a checkable artifact, so there's a gate for it. Run it against the produced
memo (read-only; it never edits):

```bash
./scripts/verify.sh --path memo.md     # check one memo
./scripts/verify.sh --path research/   # scan a directory of memos
```

It asserts the memo has an answer/summary section, that every finding line carries a
citation token, that every citation carries a date, that a confidence tier appears, and
that an "Open questions / unverified" section exists. A missing or empty target is a SKIP,
not a failure. The gate proves the memo is *sourced and dated* — it does not judge whether
the answer is correct; that's the capability eval's and your job.

## See also

- [../market-research/SKILL.md](../market-research/SKILL.md) — when the question is "how
  big is the market / who's in it" (TAM/SAM/SOM), not "what's true about X".
- [../competitor-watch/SKILL.md](../competitor-watch/SKILL.md) — when you need a standing
  cadence watch on named rivals, not a one-shot investigation.
- [../data-scraper/SKILL.md](../data-scraper/SKILL.md) — when the job is bulk-extracting
  data from many pages; research-ops *uses* fetched pages, it doesn't own scrape infra.
- [../knowledge-ops/SKILL.md](../knowledge-ops/SKILL.md) — to file what you already know
  into a durable base; research-ops *produces* findings, knowledge-ops *files* them.
