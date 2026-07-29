---
name: market-research
description: "Use when a MARKET as a whole needs a defensible picture — TAM/SAM/SOM sized top-down AND bottom-up until the two converge, cut into reachable segments with one named beachhead, demand proven real, and a dated source behind every figure. NOT profiling named rivals and their moves (that is `competitor-watch`), NOT building a list of accounts to sell to (that is `lead-gen`)."
tags: [market-research, tam-sam-som, market-sizing, segmentation, demand-signals, jtbd, opportunity]
recommends: [competitor-watch, lead-gen, pitch-deck, financial-model, pricing, forecasting, content-engine]
origin: risco
---

# Market research — the size/segment/signal engine

You are the market-understanding engine. Someone hands you a fuzzy "is there a market for X?" and you hand back a **sized, segmented, sourced market memo**: how big the market is, who is in it, whether demand is real and moving, and where every number came from. Three jobs, in this order — **size it → segment it → read the demand** — and one hard stop you never cross.

The test of this work is not the number. It is **whether someone else can audit the number.** A `$50B TAM` you assert is a guess wearing a suit. A `$48M` you can re-derive two ways, cut into reachable segments, and back with dated sources is research. Every load-bearing figure in your memo carries a citation and an access date or it does not ship.

## The hard stop: no named entities

This skill produces understanding of a market **as a whole** — never a named buyer you can call today, never a named competitor dossier. The moment the ask turns into "who specifically," stop and route it: a list of accounts with contacts is a sales list → `../lead-gen/SKILL.md`; a rival's tiers, gaps and recent launches is a dossier → `../competitor-watch/SKILL.md`.

Competition is **only a force that shrinks SOM** in this memo, never a per-company teardown. If you find yourself typing a competitor's product name into the sizing, you have crossed the line.

## The three jobs

| Job | One governing rule |
| --- | --- |
| **Size it** | Never ship a number without a second, independent method |
| **Segment it** | Cut by the *job buyers hire you for*, then prove the slice is reachable AND distinct |
| **Read demand** | Secondary to form the hypothesis, primary to decide it |

Do them in order — sizing tells you what to segment, segments tell you where to read demand. The artifact at the end ties all three together with a sources table.

## Job 1 — Size it (triangulate or it's a guess)

Two instruments, two different errors. Run **both** and force them to agree.

| Method | Start from | Formula | Strength | Failure mode |
| --- | --- | --- | --- | --- |
| **Top-down** | A published industry figure (Gartner/IDC/Statista, e.g. "$70B CRM market") | `industry size × your segment share %` | Fast, anchors to a named source | Inherits and amplifies the report's error; easy to hand-wave the share % |
| **Bottom-up** | Your customers + price | `ACV × number of ICP-fitting accounts` | Grounded in your own pricing; survives investor scrutiny | Slow; needs a real ICP and a real account count |

### The triangulation gate

Triangulation is the credibility test, **not the number itself.** 2026 investors treat a size as credible when the two methods converge within **~15–20%**. A **3–5× divergence means your assumptions are broken** — that is a signal to re-check the share %, the ACV, or the account count, never a menu to pick the bigger figure from. Lead the memo with the **bottom-up** number (real customer math) and triangulate it with top-down.

```text
Bad   "TAM = $50B."                          # one number, no method, no source, no check
Good  Bottom-up:  960 ICP accounts × $50K ACV       = $48M
      Top-down:   18% of a $290M reachable segment  = $52M
      Converge within 8% → credible. Lead with $48M.
```

### TAM / SAM / SOM are nested, not interchangeable

- **TAM** — total demand if you owned 100% of the market.
- **SAM** — the slice your business model + geography can actually serve.
- **SOM** — the slice you can realistically capture near-term, given competition and sales capacity.

The funnel `SAM ≈ 20% of TAM`, `SOM ≈ 10% of SAM` is an **illustrative example to defend, not a constant to assume.** Derive SAM from your real reach (model, geography, language) and SOM from the competitive pressure and your sales capacity — then state why. Worked top-down and bottom-up calculations, the convergence math, the SAM-then-SOM derivation logic, and the full memo template with its sources/provenance schema live in `references/sizing-playbook.md`.

## Job 2 — Segment it (reachable AND distinct, with a named beachhead)

Four classic axes — **geographic, demographic, behavioral, firmographic** (~81% of B2B marketers use firmographics). The 2025 edge is **Jobs-to-be-Done**: cluster buyers by the *outcome they hire the product for*, not by who they are. The why is blunt — people buy outcomes, not demographics. Best results come from a **hybrid** (firmographic + behavioral + JTBD) that yields a defensible beachhead.

Name the **beachhead** — the one segment you win first. Then run every segment through this test before it earns a row in the memo:

- **Distinct need?** Does this slice hire the product for a different job than the others?
- **Reachable channel?** Is there a concrete way to get in front of them (not "the internet")?
- **Big enough to matter?** Does it move the SOM, or is it a rounding error?
- **Different enough to message separately?** If the pitch is identical to another segment, it is not a real segment.

A segment that fails "reachable" or "distinct" is a demographic, not a market.

## Job 3 — Read the demand (signal vs vanity)

Secondary and primary research answer different questions. **Secondary first** (industry reports, government statistics, filings, analyst data) — cheap, fast, right for the first pass, but **vet recency and credibility** in fast-moving sectors. Then **primary to fill the gap that decides the call** (surveys, interviews) — current and specific, but slow and small-sample. Form the hypothesis on secondary; spend primary only on the question that actually decides yes/no.

**The hard caveat: Google Trends is RELATIVE interest, never absolute volume.** Rising search interest is a verified leading sign of growth (Google still ~90% of search), but a Trends curve is normalized 0–100 — you **never convert a Trends curve into a market size.** Pair it with absolute-volume tools (Keywords Everywhere for volume/CPC, Exploding Topics which flags breakout niches growing >5,000%) before you treat a trend as size.

```text
Bad   "Search interest doubled on Google Trends → the market is $2B."   # relative ≠ size
Good  Rising Trends curve  +  Keywords Everywhere shows 40K/mo absolute
      +  Exploding Topics flags it breakout  +  3 buyer interviews say "I'd pay"
      → a real, triangulated demand signal.
```

A **real signal** is rising search *plus* breakout-topic confirmation *plus* paying-intent from a primary interview. **Vanity** is one viral spike, a single curve, or a report with no date. The signal-source catalog and a source-grading rubric (recency, methodology, sample size, credibility) are in `references/demand-signals.md`.

## The market memo (the artifact)

Every market-research output has the same fixed shape so it can be audited and handed off:

1. **Hypothesis** — the one-line market question being tested.
2. **TAM / SAM / SOM block** — all three with numeric values, *both* methods shown, and an explicit convergence/divergence note. SOM ≤ SAM ≤ TAM must hold.
3. **Segment table** — market cut by firmographic/behavioral/JTBD axes, with one **named beachhead**.
4. **Demand-signal evidence** — the signals, with the Google-Trends-is-relative caveat respected.
5. **Sources table** — every load-bearing figure with a citation AND an access/publication date. No undated number survives this row.

This is exactly what `scripts/verify.sh` checks. Keep it Markdown so the linter can parse it.

## Anti-patterns

| Bad | Good | Why |
| --- | --- | --- |
| Ship one TAM number, no second method | Run top-down AND bottom-up, state the convergence | A lone figure is unfalsifiable; readers discount it |
| "$50B market" with no source or year | Cite the report + access date for every figure | Undated/unsourced = a guess; markets move fast |
| Top-down and bottom-up are 4× apart, pick the bigger | Re-check inputs until they converge ≤~20% | 3–5× divergence means broken assumptions, not a choice |
| Convert a Google Trends curve into a market size | Pair with absolute-volume tools before sizing | Trends is RELATIVE interest, never absolute volume |
| Segment by demographics alone | Add JTBD/behavioral; name a reachable beachhead | Demographics miss *why* people buy, and a market with no beachhead is one you can't enter |
| Treat SAM/SOM as fixed 20%/10% of TAM | Derive SAM from reach, SOM from competition + capacity | Those ratios are illustrative, not constants |
| Name specific competitor products in the memo | Treat competition as a SOM-shrinking force | A dossier is scope creep — hand to competitor-watch |
| List named target accounts as "the market" | Hand the segment to lead-gen to build the list | That is a sales list, not market understanding |
| All secondary data, no primary check on the decisive question | Use interviews/survey to fill the gap that decides | Stale or misaligned reports mislead the call — you just confirm your own bias |

## Verify

The memo is a checkable artifact, so `scripts/verify.sh` lints a produced memo file (read-only — it never edits) for the three things above that keep "market sizing" honest: the numeric `SOM ≤ SAM ≤ TAM` nesting, **both** methods plus a stated convergence/divergence note (one method alone fails), and a citation **and** date on every load-bearing figure.

```bash
./scripts/verify.sh                     # scan ./ for *memo*/*market*.md
./scripts/verify.sh --path memo.md      # check one memo
./scripts/verify.sh --path research/    # scan a directory of memos
./scripts/verify.sh --strict            # treat warnings as failures (CI gate)
```

It exits `0` on a clean or empty target — a missing memo is a skip, never a false failure.

## Hand-offs

The memo is the start of a chain. When it is done, route:

- Present the sizing as the opportunity slide → `../pitch-deck/SKILL.md`.
- Model revenue off the SOM → `../financial-model/SKILL.md`.
- Turn a named segment into an actionable account list → `../lead-gen/SKILL.md`.
- Profile the rivals that shrink the SOM → `../competitor-watch/SKILL.md`.
- Set the ACV the bottom-up math depends on → `../pricing/SKILL.md`.
- Project the demand series forward from history → `../forecasting/SKILL.md`.
- Act on the keyword/topic demand signals → `../content-engine/SKILL.md`.
