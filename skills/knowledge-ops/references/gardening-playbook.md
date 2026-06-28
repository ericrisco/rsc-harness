# Gardening playbook — knowledge-ops

Offloaded depth for the four operations. The SKILL body holds the rules; this
holds the worked recipes, examples, and the exact `wiki/log.md` entry shapes.
All wiki conventions here trace to `../../harness/references/wiki-protocol.md`
and `../../harness/references/wiki-article-template.md`.

## The Capture altitude ladder, worked

Default is discard. Climb only when a rung's criterion is met.

1. **Discard** — re-derivable, ephemeral, or already covered.
   - Example: "The build passed on commit abc123." Re-derivable from CI; discard.
   - Example: a duplicate of a fact already in `wiki/payments/stripe-webhook-retry-policy.md`. Discard.

2. **Leave in `raw/` only** — a real source, no synthesis warranted yet.
   - Example: a vendor PDF of Stripe's pricing. Keep it immutable in
     `raw/payments/stripe-pricing-2026.pdf` (or its extracted `.md`); do not
     compile a `wiki/` page until someone actually needs the synthesized answer.

3. **Merge into an existing article** — adds a fact/section to a page that exists.
   - Example: "Stripe now retries webhooks for 3 days, up from 2." Append a dated
     line to the body of `wiki/payments/stripe-webhook-retry-policy.md` and update
     its `> Sources:`. No new page.

4. **New article** — genuinely new, single-thesis, homeless subject.
   - Example: "Our refund SLA and escalation path." Distinct thesis, no existing
     home → new `wiki/payments/refund-sla-and-escalation.md`, then link it both
     ways with the Stripe page (standard markdown links, e.g.
     `[Stripe webhook retry policy](./stripe-webhook-retry-policy.md)`) and reference
     it in `wiki/index.md`.
   - Conform to OKF v0.1: the new article carries YAML frontmatter with a non-empty
     `type:` plus the recommended `title`/`description`/`tags`/`timestamp`, per
     `../../harness/references/wiki-article-template.md`. Never wikilinks.

Topic rule in practice: before `mkdir wiki/<new-topic>/`, scan `index.md` for an
existing topic that fits. One level of subdirs only — `wiki/<topic>/<article>.md`.
The reserved `index.md` is a directory listing and carries **no frontmatter**.

## Split recipe — carve one article into two

When an article carries ≥2 unrelated theses (or its Overview cannot be one
paragraph):

1. Name the theses. Each becomes its own single-thesis article with a specific
   title (`stripe-webhook-retry-policy.md`, `refund-sla-and-escalation.md`).
2. Move each thesis's body sections into its article. Write a fresh one-paragraph
   `## Overview` for each.
3. Fix metadata on both: `> Sources:` keeps only the author/org + date relevant to
   that half; `> Raw:` keeps only the `../../raw/<topic>/<file>.md` links that back
   that half.
4. Repair `## See Also`: the two halves link each other; re-point any inbound
   links from other pages to whichever half they actually meant.
5. Archive the original to `_archive/<original>__YYYY-MM-DD.md` (preserve before
   overwrite), then update `index.md`.
6. Log it (see entry shapes below).

## Merge recipe — fold near-duplicates into one

1. Read both pages' scores in `scores.json`. The **higher score wins**
   (`score = inbound_links*2 + sources_count + cited_count*0.5 + freshness_weight
   - conflict_count*3 - orphan_penalty`).
2. Fold the loser's unique content and `> Sources:`/`> Raw:` references into the
   winner. Do not duplicate facts already present.
3. Archive the loser to `wiki/<topic>/_archive/<loser>__YYYY-MM-DD.md`.
4. Redirect every inbound link (grep the wiki for `(loser.md)` and `/loser.md)`)
   to the survivor so nothing breaks.
5. Update `index.md`; log it.

## Worked prune session

Scenario: `scores.json` flags one stale page, one superseded page, one
unresolved conflict annotation, and a pile of old `[FILLED]` gaps.

1. **Stale page** (`freshness_weight` at 0.1, content still correct): add a
   `> ⚠ Stale — verify against source as of YYYY-MM-DD` note at the top. Do not
   rewrite. Log.
2. **Superseded page** (a newer article replaces it): copy to
   `_archive/<article>__YYYY-MM-DD.md`, leave a one-line pointer to the successor
   in the survivor's `## See Also`, remove the dead page from `index.md`. Never
   `rm`. Log.
3. **Conflict** (`conflict_count > 0`, two pages disagree): you do **not** decide.
   Surface both claims to the human, get the ruling, then annotate the losing
   claim with `> Superseded by [winner](./winner.md) per owner decision YYYY-MM-DD`
   (standard markdown link, never a wikilink) and clear the conflict annotation. Log.
4. **Gap compaction:** only `[FILLED YYYY-MM-DD]` gaps **older than 90 days** may
   be compacted, via a single marker line prepended to `log.md` (newest first) — `gaps.md`
   stays append-only; you never delete a gap entry.

## `wiki/log.md` entry shapes

`log.md` is the OKF reserved change-log: **newest entry first** — prepend each new entry at the
top of the file (it has no frontmatter, ISO 8601 dates, immutable past entries). Match the
protocol's `## [YYYY-MM-DD] <op> | …` format. One line (or short block) per manual operation
(shown below newest-last only for readability; in the file the latest sits on top):

```markdown
## [2026-06-02] capture | new | wiki/payments/refund-sla-and-escalation.md
Created from raw/payments/refund-policy-2026.md. New single-thesis subject; no existing home. See Also <-> stripe-webhook-retry-policy.md.

## [2026-06-02] capture | raw-only | raw/payments/stripe-pricing-2026.md
Kept source, no wiki article — no synthesized answer needed yet.

## [2026-06-02] structure | split | wiki/payments/stripe-and-refunds.md -> stripe-webhook-retry-policy.md + refund-sla-and-escalation.md
Two unrelated theses. Original archived to _archive/stripe-and-refunds__2026-06-02.md. Sources/Raw/See Also fixed on both halves.

## [2026-06-02] structure | merge | wiki/auth/oauth.md + wiki/auth/oauth-setup.md -> oauth-setup.md
Merged into higher-scored oauth-setup.md (score 7.5 vs 2.0). Loser archived to _archive/oauth__2026-06-02.md. 3 inbound links redirected.

## [2026-06-02] link | see-also | wiki/payments/refund-sla-and-escalation.md
Added bidirectional See Also to stripe-webhook-retry-policy.md; cleared orphan_penalty.

## [2026-06-02] prune | archive | wiki/payments/old-retry-notes.md -> _archive/old-retry-notes__2026-06-02.md
Superseded by stripe-webhook-retry-policy.md. Removed from index.md.

## [2026-06-02] prune | conflict-resolved | wiki/payments/stripe-webhook-retry-policy.md
Conflict on retry window arbitrated by owner: 3 days wins. Loser claim annotated. conflict_count cleared.

## [2026-06-02] prune | compact | gaps.md
Compacted 4 [FILLED] gaps older than 90 days into this marker. No gap entries deleted.
```

Keep entries terse and factual: date, op, target paths, one-line why. The log is
the audit trail the rails depend on — never edit a past entry; prepend the new one at the top
(newest first, per the OKF reserved-file rule). `gaps.md` stays append-only (new entries at the
bottom).
