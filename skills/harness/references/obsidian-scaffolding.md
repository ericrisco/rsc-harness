# Obsidian scaffolding — make `02-DOCS/` open as a vault

Materialized during **Initialization** (see `wiki-protocol.md`). Turns the wiki
into a native Obsidian vault: graph, backlinks, Properties, and Bases — with **no
vector DB, no embeddings, no RAG**. Navigation is structure (links + frontmatter),
not semantic search. Do NOT add embedding/semantic-search plugins; that breaks the
thesis. Obsidian core only.

The point a human opens the vault at (the "base folder") is `02-DOCS/` itself —
not the repo root. Obsidian writes its config into `02-DOCS/.obsidian/`.

## `02-DOCS/.gitignore` (additions)

```gitignore
# Obsidian per-machine state (the rest of .obsidian/ — themes, bases, config — is tracked)
.obsidian/workspace*.json
.obsidian/cache
# regenerated / per-run surfaces
wiki/dashboard.html
audits/*.html
inbox/_processed/
```

## `02-DOCS/attachments/README.md`

```markdown
# attachments

Shared binaries referenced from wiki pages (images, PDFs, diagrams) when they are
not bundled with a specific raw source. Link them from the page that depends on
them. Source-bundled originals stay in `raw/<topic>/_originals/`.
```

## `02-DOCS/.obsidian/app.json` (attachment folder + OKF link mode)

```json
{
  "attachmentFolderPath": "attachments",
  "newLinkFormat": "relative",
  "useMarkdownLinks": true,
  "alwaysUpdateLinks": true
}
```

`useMarkdownLinks: true` makes new internal links **standard markdown links**, not
wikilinks — this is what keeps `wiki/` a 100%-OKF-conformant bundle (OKF consumers
follow markdown links; wikilinks `[[...]]` are non-conformant). `newLinkFormat:
relative` writes paths relative to the current file (`../topic/page.md`), which OKF
supports and which resolves both in Obsidian and in any OKF consumer.
`alwaysUpdateLinks: true` makes Obsidian rewrite those relative links automatically
on rename, so links survive moves the way wikilinks used to. `userIgnoreFilters`
(Settings → Files & Links → Excluded files) should hide noise from search/graph:
`raw/_originals/`, `inbox/_processed/`, `audits/`.

## `.base` views — the human navigation (replace hand-maintained nav)

These supersede manual upkeep of `index.md`/`dashboard.html` for humans;
`index.md` and `scores.json` remain as the machine layer + fallback.

### `02-DOCS/wiki/Articles.base`

```yaml
filters:
  and:
    - type == "article"
views:
  - type: table
    name: All Articles
    order: [file.name, topic, status, score, timestamp]
    sort:
      - property: score
        direction: DESC
```

### `02-DOCS/wiki/Worklog.base`

```yaml
filters:
  and:
    - type == "worklog"
views:
  - type: table
    name: Worklog
    order: [file.name, topic, timestamp, status]
    sort:
      - property: timestamp
        direction: DESC
```

### `02-DOCS/wiki/Decisions.base`

```yaml
filters:
  and:
    - type == "decision"
views:
  - type: table
    name: Decisions
    order: [file.name, topic, status, timestamp]
    sort:
      - property: timestamp
        direction: DESC
```
