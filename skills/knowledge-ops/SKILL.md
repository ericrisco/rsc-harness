---
name: knowledge-ops
description: "Use when an already-running 02-DOCS/ wiki needs gardening judgment — what is worth capturing (default: nothing), where a loose note belongs, whether to split a bloated article or merge near-duplicates, how to link orphans back in, and what retires to _archive (never delete). NOT building or sweeping the wiki engine itself (that is `harness`)."
tags: [knowledge-ops, wiki, 02-docs, knowledge-base, curation, cross-linking, pruning, knowledge-meta]
recommends: [harness, decision-records, meeting-notes, sop-builder, research-ops, codebase-onboarding]
origin: risco
---

# Knowledge Ops — Garden the 02-DOCS Wiki

*The engine is already running. `harness` built the `02-DOCS/` wiki and owns its automation — the inbox sweep, deterministic lint, scoring, gap detection, the self-improve loop — and changing that machinery or filling the wiki in bulk stays with it. Yours are the four judgments automation deliberately leaves to a human: what is worth capturing, how it should be shaped, how it connects, and what should retire. You are the gardener, not the machinery.*

## Before you touch anything

1. **Confirm `02-DOCS/wiki/` exists.** If there is no wiki, stop and say: "Run `harness` to build the `02-DOCS/` wiki first, then come back to garden it." Why: this skill operates an existing engine; it never creates one. See `../harness/SKILL.md`.
2. **Read `wiki/harness/user-profile.md`** to set your verbosity (the harness accompaniment dial, L0–L3). Why: a non-technical owner wants decisions narrated; an expert wants terse diffs.
3. **Read `wiki/index.md` and `wiki/scores.json` before any edit.** Why: you garden from the map and the score signal, never blind. `scores.json` tells you what is bloated, orphaned, or stale.

If `wiki/log.md` shows a Maintenance Pass ran in the last few minutes, let it finish — do not race the automation.

## The four operations

Every gardening request is one of four operations. Identify which before you act.

| Operation | You are doing this when… | Primary signal | Writes to |
|-----------|--------------------------|----------------|-----------|
| **Capture** | A note/source needs a decision: keep, where, at what altitude | new content in `inbox/`/`raw/` or a loose user note | `raw/` and/or `wiki/<topic>/<article>.md` |
| **Structure** | An article is bloated, mistitled, or duplicated | length, a non-singular Overview, near-duplicate titles | `wiki/<topic>/`, `_archive/` |
| **Link** | Pages are unreachable or under-connected | `scores.json` orphan_penalty (=5), low inbound count | `## See Also` in articles, `index.md` |
| **Prune** | Answers are stale, articles superseded, conflicts unresolved, gaps bloated | freshness, conflict annotations, old `[FILLED]` gaps | `_archive/`, `log.md`, `gaps.md` |

Whichever you do, record a line in `wiki/log.md` under the reserved-file rule in **Safety rails** below. The exact entry shapes per operation live in `references/gardening-playbook.md`.

## Capture — the bar is high

**Default is NO.** Capture only what a future reader or agent will need *and* cannot cheaply re-derive. Why: the wiki is a compounding *model*, not a dump — the Karpathy chaos→knowledge paradigm has the LLM write and the human read, so every page must earn its keep.

Walk the altitude ladder, lowest rung first; stop at the first that fits:

1. **Discard** — ephemeral, re-derivable, or already covered. Most things stop here.
2. **Leave in `raw/` only** — a source worth keeping but not worth a synthesized article yet. It stays immutable in `raw/<topic>/`, no `wiki/` page.
3. **Merge into an existing article** — adds a section or fact to a page that already exists. Prefer this over a new page.
4. **New article** — last resort: a genuinely new, single-thesis subject with no home. Any new article follows the OKF v0.1 article template (`../harness/references/wiki-article-template.md`): YAML frontmatter with a non-empty `type:`, the OKF-recommended `title`/`description`/`tags`/`timestamp`, and standard markdown links — never wikilinks. The reserved `index.md` stays frontmatter-free.

Worked examples for each rung are in `references/gardening-playbook.md`.

**Topic choice.** Reuse an existing topic before inventing one, and keep `wiki/` exactly **one level of subdirs** deep (the protocol's rule).

- Bad: `wiki/payments/stripe/webhooks/retries.md` (four levels deep).
- Good: `wiki/payments/stripe-webhook-retries.md` (existing `payments/` topic, one level).

## Structure — title, Overview, split, merge

**Split** an article when any of these is true:

- It carries **≥2 unrelated theses** (e.g. "Stripe retries" *and* "our refund SLA").
- Its `## Overview` cannot be written as **one honest paragraph**.
- It has grown past readability and the score signal flags it.

Why: one article = one thesis keeps scoring, linking, and retrieval meaningful. After a split, fix `> Sources:` and `> Raw:` on both halves and repair `## See Also` so they reference each other. Recipe in the playbook.

**Merge** near-duplicates into the **higher-scored** page; fold the loser's unique content in, then archive the loser to `wiki/<topic>/_archive/<loser>__YYYY-MM-DD.md` and redirect every inbound link to the survivor. Why: never lose history, never keep two competing truths.

**Title.** A title is the article's address — make it a specific noun phrase, not a label.

- Bad: `Notes on stuff.md`, `Misc.md`, `Stripe.md`.
- Good: `stripe-webhook-retry-policy.md`, `refund-sla-and-escalation.md`.

## Link — build the web, kill orphans

Every article earns **≥1 inbound link** or is a conscious leaf you can justify. Why: an orphan is dead knowledge — nothing reaches it, so it scores `orphan_penalty = 5` and never improves.

- Use `scores.json` as your worklist: sort by lowest score / orphan penalty, fix those first.
- `## See Also` is **bidirectional** — if A links B, B links A.
- Use **standard markdown links** only — NEVER wikilinks (`[[...]]`). An OKF consumer follows markdown links; it cannot follow `[[...]]`. If you find a `[[...]]` link while gardening, convert it. Same-topic link: `[Refund SLA](./refund-sla-and-escalation.md)`. Cross-topic link: `[OAuth setup](../auth/oauth-setup.md)`. Why: the protocol's relative-link convention; `./` is same-topic, `../` crosses one topic boundary, matching the one-level layout. See `../harness/references/wiki-protocol.md` "## Conventions".
- When you add a genuinely new top-level subject, make sure `wiki/index.md` references it so the map stays complete.

## Prune — archive, retire, arbitrate, compact

**Prune is archival, never `rm`.** A superseded article moves to `wiki/<topic>/_archive/<article>__YYYY-MM-DD.md`; you do not delete it. Why: the safety rails forbid destructive loss, and `_archive/` is gitignored from compaction so it stays out of the way without vanishing.

- **Conflicts:** you **flag** contradictions and the **human arbitrates**. Once they choose a winner, you may apply the resolution and annotate the loser — but you never auto-pick. Why: silently choosing a side is data corruption.
- **Stale answers:** mark a page or archived copy with a `> ⚠ Stale — superseded YYYY-MM-DD` note rather than rewriting history.
- **Compaction is bounded:** only `[FILLED YYYY-MM-DD]` gaps **older than 90 days** may be compacted, and only via a single marker prepended to `log.md` — a gap gets a `[FILLED]` stamp, never a deletion.
- **Log every prune** by prepending to `wiki/log.md`.

A full worked prune session (stale + superseded + conflict + gap compaction, all logged) is in `references/gardening-playbook.md`.

## Safety rails

Inherited from `../harness/references/wiki-protocol.md` — do not override them; each one guards against a loss you cannot undo.

1. **Preserve before overwrite.** Never overwrite an article without first copying the old version to `wiki/<topic>/_archive/<article>__YYYY-MM-DD.md`.
2. **Never auto-resolve a conflict.** Flag it; the human arbitrates.
3. **The reserved files only grow.** Log every change in `wiki/log.md`, the OKF reserved change-log: new entries are **prepended at the top (newest first)**, ISO 8601 dates. `gaps.md` is the append-only one — new entries go at the bottom. Past entries in either are immutable: a gap gets a `[FILLED YYYY-MM-DD]` stamp, nothing is ever edited out or deleted.
4. **Never touch an article whose `timestamp` is < 24h ago** without explicit user say-so. Why: it is likely still being worked. (`timestamp` is the OKF last-meaningful-edit field, ISO 8601 — see `../harness/references/wiki-protocol.md` "## Conventions".)

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|--------------|-----------------|------------|
| Capturing everything "to be safe" | The wiki rots into a dump; the model stops being a model | Raise the bar; default to discard or `raw/`-only |
| `rm`-ing a superseded article | Loses history the rails protect | Archive to `_archive/<article>__YYYY-MM-DD.md` |
| Auto-picking a winner in a contradiction | Silent data corruption; you guessed | Flag it; let the human arbitrate |
| Re-running `harness` to fix a broken link | Wrong tool — the Maintenance Pass already auto-fixes links | Repair `## See Also` by hand; let automation handle the rest |
| Nesting `wiki/a/b/c.md` | Breaks the one-level topic rule | Flatten to `wiki/<topic>/<article>.md` |
| Editing a past `log.md` / `gaps.md` entry | Breaks the immutable audit trail | Add a new entry — prepend to `log.md` (newest first), append to `gaps.md` |
| Splitting on length alone | Two halves of one thesis are worse than one page | Split on thesis count, not line count |
| Creating a new topic for a one-off note | Topic sprawl; reuse beats create | File under the nearest existing topic |

## Hand-offs

Route elsewhere when the request is not gardening an existing wiki:

| Request | Route to |
|---------|----------|
| Build/bootstrap the wiki, run an inbox sweep, scaffold `01-TOOLS`, generate root `CLAUDE.md` | `harness` (`../harness/SKILL.md`) — it owns the engine |
| Turn a meeting transcript into a recap with action items + owners | `meeting-notes` (`../meeting-notes/SKILL.md`) |
| Author a decision record (ADR) with alternatives, status, review cadence | `decision-records` (`../decision-records/SKILL.md`) — you may *file* one; that skill *authors* the discipline |
| Document a repeatable procedure step by step | `sop-builder` (`../sop-builder/SKILL.md`) |
| First-pass walkthrough of an unfamiliar codebase | `codebase-onboarding` (`../codebase-onboarding/SKILL.md`) |
| Run a literature / source-gathering research project | `research-ops` (`../research-ops/SKILL.md`) |
