# Knowledge Gaps

Append-only log of wanted-but-missing topics. Entries are flagged
`[FILLED YYYY-MM-DD]` when an Improve pass writes the article — never
deleted. Compaction (Deep Improve only) removes `[FILLED]` entries older
than 90 days, with a single compaction marker entry in `wiki/log.md`.

One entry per gap, in this shape:

```markdown
## [YYYY-MM-DD] gap | {concept}

Source: {where this gap was detected — a query that couldn't answer, N
articles mentioning the concept without a dedicated page, an ingested
source the agent didn't know where to place, etc.}

Mentioned in: [Article A](topic/a.md); [Article B](topic/b.md)

Suggested topic: {topic where the new article would belong}

Status: open
```
