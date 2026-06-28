# Daily curation automation — the compounding pass on a timer

The third trigger of the work-driven path (the other two: the PreCompact/SessionEnd
hook and explicit milestones). This is the harness's existing **Continuous
Improvement** (Maintenance Pass / Micro-Improve / Deep Improve) promoted to a
**first-class, portable, scheduled** automation — "the agent goes for a walk" on a
timer, not only when asked.

**Portable definition + Claude-Code reliability** (same pattern as the hooks): the
spec below works on any assistant as a protocol; on Claude Code, wire a real daily
cron via the `schedule` skill pointed at this prompt.

## Purpose

Run once per day, at a quiet hour, to keep the second brain alive:

- run the **Auto-Ingest Sweep**: process `inbox/`, then scan the workspace (minus
  `.rscignore`) for un-ingested documents, ingest the clearly-documentary folders,
  record them in `wiki/.ingested.json`, and propose the ambiguous ones
- process pending `raw/worklog/` material into `wiki/`
- strengthen weak / low-score pages; fill one open gap
- repair links and the graph (resolve broken wikilinks, add `## Related` where proper nouns recur)
- mark `stale` pages whose sources moved on
- record what changed in `wiki/log.md`

## Suggested schedule

Daily, at a quiet hour when the user is unlikely to be editing the vault.

## Scope (paths)

The **workspace root** (for Auto-Ingest discovery, bounded by `.rscignore`),
`raw/worklog/`, `inbox/`, `raw/`, `wiki/`, `wiki/.ingested.json`, `wiki/harness/`.

## Prompt

```text
Run the daily curation pass for this 02-DOCS second brain.

Use the harness wiki-protocol.md as the contract. First run the Auto-Ingest Sweep:
process inbox/, then scan the workspace (minus .rscignore) for un-ingested documents,
applying Clean-as-you-go (move loose root-level + inbox files into raw/ after a
verified ingest; copy files nested in user-maintained folders and propose
consolidation), record them in wiki/.ingested.json, and list ambiguous folders as
proposals (do not grab them). Then compile pending raw/worklog/ material into wiki/
pages (update existing before creating new), keep frontmatter + relative markdown
links OKF-consistent, append significant decisions to wiki/harness/decisions.md,
refresh the .base-backed navigation, recompute scores.json + the score: property,
and prepend a dated entry (newest first) to wiki/log.md.

Be conservative. If the topic map no longer fits, record a recommendation in
wiki/gaps.md or a page's Open Questions instead of moving large parts of the
vault without explicit approval.
```

## Expected outcome (one of)

- worklog/inbox material distilled; `status` flipped to processed
- maintenance improvements to links, scores, `.base` views, or stale flags
- a `wiki/log.md` entry explaining what was checked and what remains open
- no file changes when there is genuinely nothing useful to do

## Safety

- Do not rewrite or delete raw sources.
- Do not perform large taxonomy reorganizations without explicit approval.
- Do not create pages from weak connections just to look busy.
- Prefer small, compounding improvements over big sweeps.
