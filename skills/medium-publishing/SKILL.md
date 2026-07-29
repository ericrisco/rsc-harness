---
name: medium-publishing
description: "Use when a finished article has to land on Medium correctly — profile vs publication, cross-posting under a canonical link so your own site keeps the SEO credit, import-tool failures, the 5-tag cap, pseudo-Markdown gotchas. NOT writing or headlining the piece (that is `medium-writing`), NOT cadence or earnings (that is `medium-strategy`)."
tags: [medium, publishing, cross-posting, canonical-url, seo, import-tool]
recommends: [medium-writing, medium-strategy, seo-geo, social-publisher]
origin: risco
---

# Medium publishing

Land a finished article on Medium with correct metadata: right destination, no duplicate-content penalty, valid tags, intact formatting. Writing the article is `../medium-writing/SKILL.md`; deciding when/where/how-often to publish and how it grows is `../medium-strategy/SKILL.md`. This skill is only the mechanics of getting bytes onto the platform with the right metadata attached.

## Reality check (2025-2026)

**The Medium API is closed to new integrations.** As of 2025-01-01 Medium issues no new integration tokens and accepts no new integrations; only tokens minted before that date still work. Why it matters: any plan that starts with "register a Medium API token and automate it" is dead on arrival for anyone who didn't already have one. Integration platforms confirm this — the Medium app in Make is marked legacy, and n8n's Medium credentials can no longer be newly configured.

So the default publishing path is **web editor + import tool + canonical link**, done through the UI. Treat the API as a legacy escape hatch (last section), not the plan — when asked "can I get a token and automate this?", the honest answer is almost always no, so say why and route to the import path below rather than promising automation.

## Decision table — pick your path

Branch on where the article already lives and what you control:

| Situation | Path | Canonical handling |
|---|---|---|
| Article only ever lives on Medium | Write or paste natively in the web editor, publish | None needed — Medium *is* the original |
| Article already published on your own site/blog | **Import tool**: paste the original URL | Auto-set to that URL + auto-backdated |
| Import tool fails (403/404/timeout) | Native paste, then set canonical by hand | Manual: Story settings -> Customize canonical link |
| You hold a pre-2025 API token and want automation | Legacy `POST /v1/users/{id}/posts` | `canonicalUrl` field in the request body |
| Destination is a publication you write for | Submit draft to the publication | Same as above; submission is separate from canonical |

## Cross-post without an SEO penalty (the core job)

When the article already lives on your own site, you must tell search engines that the **origin** — your page, never the Medium URL — is canonical, or Google sees two copies and may credit Medium or neither. Two mechanisms, in order of preference:

**1. Import tool (preferred).** Pasting the original URL into Medium's import field does three things at once:
- imports the rendered content into a new draft,
- sets the story's canonical link to that original URL (search engines keep crediting your site),
- backdates the Medium post to your original publish date by reading the page's `article:published_time` meta tag.

Path: New story -> import icon (or `medium.com/p/import`) -> paste the original URL -> Import. Review the draft, then publish.

**2. Manual canonical (fallback).** If you drafted natively or the import failed, set it per story: **More options (•••) -> Story settings -> advanced/edit -> "Customize canonical link"**, paste the origin URL, then publish. This is per-story; there is no global default.

```text
Bad:  Open a new Medium story, paste the article body, hit Publish.
      -> Duplicate content, no canonical, wrong date. Your own page now
         competes with Medium for its own ranking.
Good: Use the import tool (canonical + backdate set automatically), or if
      you paste natively, set "Customize canonical link" to the origin URL
      BEFORE publishing.
```

## When the import fails

The importer is an HTTP crawler hitting your URL; failures are crawl failures, not Medium bugs. Map the symptom to the cause:

| Symptom | Likely cause | Fix |
|---|---|---|
| 400 / 404 | URL unreachable, redirected, or page metadata missing | Verify the URL loads anonymously; ensure `<link rel="canonical">` and `article:published_time` exist |
| 403 | Bot-blocking (WAF, Cloudflare challenge, login wall) | Serve a clean static copy the crawler can reach, or paste natively + set canonical manually |
| 500 / 504 | Crawl timeout — heavy JS, slow page | Provide a lightweight static HTML version of the article |
| Imports but body is empty/garbled | Content rendered client-side only (JS) | Same: static HTML with the content in the initial markup |

The reliable workaround for stubborn pages: publish a minimal static HTML page of the article carrying `<link rel="canonical">` and `<meta property="article:published_time">`, import *that*, then you can take it down. Full recipe and the complete error -> cause -> fix matrix are in `references/cross-post-and-canonical.md`.

## Tags & formatting at publish time

**Five tags, exactly.** Medium allows up to 5 tags per story; they drive topic distribution and discovery, so they are functional metadata, not decoration. Pick 5 real topics readers browse, not keyword-stuffed variants.

```text
Bad:  tags: react, reactjs, react.js, react-hooks, javascript, frontend, webdev  (7, redundant)
Good: tags: react, javascript, web-development, frontend, programming           (5, distinct surfaces)
```

**Medium is NOT a full Markdown editor.** The web editor interprets a *subset* of Markdown shortcuts as you type, and silently ignores the rest. Know the gotchas:

- Headings (`#`, `##`), blockquote (`>`), emphasis (`*`/`_`), ordered/bulleted lists (`1.`, `*`), and the `---` separator work as you type.
- **No Markdown tables.** Pasting a `| col | col |` table renders as plain text. Restructure into a list, or insert the table as an image.
- **Code blocks**: type triple-backtick then content, or `Cmd/Ctrl + Option + 6`. Do not rely on indentation-based code.
- **Embeds**: paste a bare URL on its own line (YouTube, gist, tweet) and Medium expands it. A URL inside a sentence stays a plain link.

```text
Bad:  Paste a raw Markdown table and assume it renders as a table.
Good: Convert the table to a labeled list, or screenshot/export it as an
      image and insert the image. Reserve real tables for the original site.
```

(The legacy API's `contentFormat: markdown` is more permissive than the web editor — but that path is closed to new users.)

## Publications

Two outcomes, often confused:

- **Self-publish** puts the story on your own profile immediately.
- **Submit to a publication** routes the draft to that publication's editors, where it stays **pending** — not live — until one of them publishes it. A publication is editorially controlled, so submission is a request, not a publish action, and it only works if you are already an accepted writer there. If you're not, request access first; submitting otherwise goes nowhere.

## Legacy API — only if you hold a pre-2025 token

Do **not** attempt to register a new token; it will be refused. This applies *only* to tokens minted before 2025-01-01.

```bash
# 1. Resolve your user id
curl -s -H "Authorization: Bearer $MEDIUM_TOKEN" \
  https://api.medium.com/v1/me
# -> { "data": { "id": "<userId>", ... } }

# 2. Create a post with canonical + publish status
curl -s -X POST \
  -H "Authorization: Bearer $MEDIUM_TOKEN" \
  -H "Content-Type: application/json" \
  https://api.medium.com/v1/users/<userId>/posts \
  -d '{
    "title": "My title",
    "contentFormat": "markdown",
    "content": "# My title\n\nBody...",
    "canonicalUrl": "https://mysite.com/original-post",
    "tags": ["react", "javascript", "web-development"],
    "publishStatus": "draft"
  }'
```

`publishStatus` is `public` | `draft` | `unlisted`. For a publication, POST to `/v1/publications/{publicationId}/posts`; a `draft` there stays pending an editor. Full field reference and response shapes are in `references/legacy-api.md`.

## Anti-patterns

| Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Paste a copy of your own article, publish with no canonical | Duplicate content; your site loses ranking credit | Import tool, or set canonical to the origin before publishing |
| Plan an automated pipeline on a freshly registered API token | No new tokens since 2025-01-01; it will never authorize | Use the import tool / web editor; reserve API only for pre-2025 tokens |
| Cram 6+ tags or keyword-stuff the tag slots | Max is 5; redundant tags waste distribution surface | Pick 5 distinct topics readers actually browse |
| Paste a raw Markdown table and assume it renders | The web editor has no table support | List or image; keep the table on the origin site |
| Submit to a publication and assume it goes live | Submission is pending until an editor acts; needs writer access | Self-publish for instant, or submit only as an accepted writer |
| Set canonical to the Medium URL | Points credit at Medium, defeating the cross-post | Canonical must point to your origin site |
| Native paste of a backdated piece without checking the date | Manual paste does not backdate; canonical/date mismatch | Use import (auto-backdate) or set the date deliberately |

## Post-publish verify checklist

A correctly cross-posted article passes all of these:

- [ ] Canonical link present **and pointing to the origin** (your site), not the Medium URL.
- [ ] Publish date matches the original (backdated correctly if cross-posted).
- [ ] 5 tags or fewer, all distinct real topics.
- [ ] Code blocks render as code; embeds expanded; no broken Markdown tables.
- [ ] Correct destination — your profile, or the intended publication (and it actually went live, not stuck pending).
