# Worklog raw template — `raw/worklog/<YYYY-MM-DD>-<slug>.md`

The **work-driven on-ramp**. A Worklog Sweep writes one of these per meaningful
unit of work — what we *did*, not what someone dropped in `inbox/`. It is `raw`
(evidence: preserved, never edited after the fact) and is Compiled into `wiki/`
like any other source. The session is just another source of chaos.

**Throttle — do NOT write a worklog for:** pure read/answer turns, questions with
no file change, no decision, and no commit. Capture only durable signal. Never
manufacture a worklog "to look busy."

```yaml
---
# OKF v0.1: `type` is the only required field. The rest is the standard surface
# (title/description/timestamp) plus rsc custom fields (topic/status/sources).
type: worklog
title: {What we did, one line}
description: {One-sentence summary of the session.}
timestamp: {YYYY-MM-DDTHH:MM:SSZ}
topic: {inferred-topic}
status: unprocessed
sources: []
---
```

## What we did

{Concrete changes / features / fixes — one bullet each. Plain, factual.}

## Why

{Intent and the decisions taken. Every *significant* decision is ALSO appended to
`wiki/harness/decisions.md` (append-only, with the 3-options shape) during Compile.}

## Files touched

- `{path}:{line}` — {what changed}

## Outcome

{Verdict: shipped & verified / partial / blocked. Include the evidence — test
output, command result, screenshot path. No "done" without proof.}

## Open questions / next

- {What remains, what to pick up next session.}

## Commands

- `{command}` — {result}

<!--
LIFECYCLE: written by the Worklog Sweep → status: unprocessed. The Compile step
distills durable points into wiki/<topic>/ articles (update existing before
creating new), cross-links, cascades, appends decisions to decisions.md, then
flips this file's status to processed (the raw stays as evidence; it is not
deleted or rewritten). Triggers that fire a Worklog Sweep: a PreCompact/SessionEnd
hook (Claude Code), an explicit milestone (a commit / a shipped feature), and the
daily curation automation. See `wiki-protocol.md` → "Worklog Sweep".
-->
