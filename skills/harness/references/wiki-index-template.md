# Knowledge Base Index

> **OKF v0.1 reserved file** — `index.md` carries **no frontmatter** (it is a
> directory listing for progressive disclosure, per the OKF spec). Links are
> standard markdown, relative to this file (`topic/article.md`), NEVER wikilinks.
>
> **Human navigation lives in the `.base` views** (`Articles.base`, `Worklog.base`,
> `Decisions.base`) — live tables over frontmatter, sorted by score/status/date.
> This index is the **machine-readable catalog + fallback** the agent maintains;
> it is not the primary surface a human browses in Obsidian.

## {topic-name}

{One-line description of this topic.}

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [{Article Title}]({topic-name}/{article-file}.md) | {One-line summary} | {YYYY-MM-DD} | {N.N} |
| [{Archived Article}]({topic-name}/{archived-file}.html) | [Archived] {One-line summary} | {YYYY-MM-DD} | {N.N} |

## {another-topic}

{One-line description of this topic.}

| Article | Summary | Updated | Score |
|---------|---------|---------|-------|
| [{Article Title}]({another-topic}/{article-file}.md) | {One-line summary} | {YYYY-MM-DD} | {N.N} |

> **Score**: composite quality score (inbound links, source count, cited count,
> freshness; minus conflicts and orphan penalty). Regenerated on every
> Maintenance Pass. Articles below the rewrite threshold get picked up by
> Micro-Improve and Deep Improve.
