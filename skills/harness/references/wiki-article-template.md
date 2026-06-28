---
# OKF v0.1 standard surface — `type` is the only REQUIRED field (non-empty).
type: article
title: {Title}
description: {One-sentence summary, for previews + search.}
resource: {URL or path to the underlying source/asset — omit the line if none}
tags: []
timestamp: {YYYY-MM-DDTHH:MM:SSZ}
# rsc custom fields (OKF allows any; conformant consumers preserve unknown keys)
aliases: [{old-slug}]
topic: {topic}
status: draft
sources: []
score: 0.0
---

# {Title}

> Sources: {Author1, YYYY-MM-DD; Author2, YYYY-MM-DD}
> Raw: [{raw-source-1}](../../raw/{topic}/{raw-source-1}.md); [{raw-source-2}](../../raw/{topic}/{raw-source-2}.md)

## Overview

{One paragraph summarizing the key points of this article.}

## {Body Sections}

{Synthesize a coherent structure from the source material. Do not copy source text verbatim; distill and reorganize. Use blockquotes sparingly for particularly important original phrasing.}

## Related

{OPTIONAL — include only when cross-references exist. Maintained during lint. Use
standard markdown links (OKF-conformant — they ARE the knowledge graph; an OKF
consumer follows them, and the Obsidian graph + backlinks render them too):
- Same topic: `- [Other Article](./other-article.md) — why it connects.`
- Different topic: `- [Other Article](../other-topic/other-article.md) — why it connects.`
- With display text: `- [how we say it here](../other-topic/other-article.md) — why it connects.`}

<!--
FRONTMATTER CONTRACT — OKF v0.1 conformant. Powers OKF consumers AND Obsidian
Properties + Bases + graph (same file, no translation).
OKF standard surface:
- type         REQUIRED, non-empty. article | decision | worklog | brief | spec | profile.
               (OKF type values are not registered centrally; consumers tolerate unknown ones.)
- title        human-readable; the H1 matches it. Consumers may derive from filename if absent.
- description  single-sentence summary for previews/search.
- resource     URI/path to the underlying asset this concept documents (omit if none).
- tags         cross-cutting qualities ONLY — never the main category (that is `topic`).
- timestamp    ISO 8601 datetime of the last meaningful edit (e.g. 2026-06-28T14:30:00Z).
rsc custom fields (allowed by OKF; never required for conformance):
- aliases  keep the old kebab slug here so pre-migration links still resolve.
- topic    the wiki/<topic>/ folder, one level. Inferred from content, never hardcoded.
- status   draft | stable | stale  (lifecycle; filterable in a Base).
- sources  markdown links to raw/ pages this was distilled from (cite your evidence).
- score    mirror of scores.json, written by the Maintenance Pass (single writer → no drift).

LINKS: standard markdown links only — NEVER wikilinks ([[...]]). Relative paths
(./same-topic.md, ../other-topic/page.md, ../../raw/<topic>/<file>.md). This is
what keeps wiki/ a portable, 100%-OKF-conformant bundle.
-->
