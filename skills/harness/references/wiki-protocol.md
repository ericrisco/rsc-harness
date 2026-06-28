# Wiki protocol — `02-DOCS/` layer

This is the protocol for the `02-DOCS/` layer of the workspace. Adapted from
the Karpathy LLM Wiki pattern: "The LLM writes and maintains the wiki; the
human reads and asks questions. The wiki is a persistent, compounding artifact."

This protocol is **embedded inside `harness`** — no external
skill required. When the parent skill (`SKILL.md`) reaches Phase 4 step 8
("Build `02-DOCS/`"), follow this document.

## Contents

- [The paradigm — chaos in, knowledge out](#the-paradigm--chaos-in-knowledge-out)
- [Architecture](#architecture) · [Format split: markdown for state, HTML for surfaces](#format-split-markdown-for-state-html-for-surfaces)
- [The vault is Obsidian-native](#the-vault-is-obsidian-native)
- [Initialization](#initialization)
- [Ingest](#ingest) · [Fetch](#fetch-raw) · [Compile](#compile-wiki) · [Cascade Updates](#cascade-updates) · [Post-Ingest](#post-ingest)
- [Inbox Sweep — "el agente sale a pasear"](#inbox-sweep--el-agente-sale-a-pasear)
- [Worklog Sweep — work-driven capture](#worklog-sweep--work-driven-capture)
- [Auto-Ingest Sweep — automatic, workspace-wide](#auto-ingest-sweep--automatic-workspace-wide)
- [Query](#query)
- [Lint](#lint) · [Deterministic Checks](#deterministic-checks-auto-fix) · [Heuristic Checks](#heuristic-checks-report-only)
- [Continuous Improvement](#continuous-improvement) — Maintenance Pass / Micro-Improve / Deep Improve
- [Conventions](#conventions)
- [How autonomous improvement interacts with this protocol](#how-autonomous-improvement-interacts-with-this-protocol)
- [How `harness` uses this protocol](#how-harness-uses-this-protocol)

## The paradigm — chaos in, knowledge out

`02-DOCS/` is the **chaos→knowledge engine** of the workspace. The contract,
in one line: *the user throws any raw data into a folder; an agent periodically
goes for a walk and turns that chaos into a living knowledge model.*

This means three things the rest of this document enforces:

1. **Any format, no rigid pipeline.** You drop a PDF invoice, a phone photo, a
   bank-statement CSV, an API dump, a loose note — the agent figures out how to
   read each one (`ingest-formats.md`). The software adapts to the user's chaos,
   not the other way round.
2. **Domain-agnostic.** Topics (`finanzas/`, `legal/`, `crm/`, `architecture/`…)
   are inferred from *what the content is about*, never from its format and
   never hardcoded to software-project docs. The same engine serves a financial
   app, a legal archive, or a codebase's documentation.
3. **Every new datum feeds and improves the system.** Ingest compiles + cross-
   links + cascades; the Continuous Improvement loop then rewrites, fills gaps,
   and rescore. The knowledge model compounds with each file.

The application on top (a front-end, a dashboard, a query session) consumes the
**knowledge model**, not the loose documents. `wiki/` is that model; `raw/` and
`inbox/` are the chaos it was distilled from.

---

## Architecture

Four layers, all under `<workspace_root>/02-DOCS/`:

**`inbox/`** — The drop zone. The user throws **any raw file in any format**
here (PDF, image, CSV, JSON, txt, html, docx…). It is unstructured by design —
no topic organization, no naming rules. An **Inbox Sweep** (see below) is the
agent "going for a walk": it processes everything here into `raw/` + `wiki/`,
then moves each processed file to `inbox/_processed/YYYY-MM-DD/`. Contains a
`README.md` (the user-facing contract, from `inbox-readme-template.md`) and the
`_processed/` archive. Originals (binaries) are also preserved under
`raw/<topic>/_originals/` during the sweep. `inbox/_processed/` is gitignored.

**`raw/`** — Immutable source material. Read, never modify. Organized by
topic subdirectories (e.g., `raw/finanzas/`, `raw/legal/`, `raw/architecture/`).
Each topic may hold an `_originals/` subdirectory preserving the byte-for-byte
source binaries (PDFs, images, spreadsheets) whose extracted text lives as
markdown alongside it. `_originals/` is archive, never compiled or linted as
content. See `ingest-formats.md` for how each format lands here.

**`audits/`** — Per-run audit reports emitted by the parent skill
(`harness`). One self-contained HTML file per run, named
`audit-YYYY-MM-DD-HHMM.html`. Point-in-time, never edited, **gitignored**
(per-run artifacts, not durable history). The parent skill creates this
directory in Phase 2 before APPLY runs, so it can predate the rest of
`02-DOCS/` on a greenfield project.

**`wiki/`** — Compiled knowledge articles. Full ownership. Organized by topic
subdirectories, one level only: `wiki/<topic>/<article>.md`. Contains these
special files:

- `wiki/index.md` — Global index. One row per article, grouped by topic, with
  link + summary + Updated date + Score.
- `wiki/log.md` — Operation log (every ingest, query, lint, maintenance pass,
  and improve pass). OKF reserved file: **newest entry first** (prepended at the
  top), ISO 8601 dates, past entries never edited or deleted. No frontmatter.
- `wiki/gaps.md` — Append-only knowledge-gap log. Topics wanted but missing,
  concepts mentioned across multiple articles without their own page, queries
  that couldn't be answered well. Read by the Improve pass.
- `wiki/scores.json` — Per-article composite quality score (regenerated on
  every Maintenance Pass).
- `wiki/dashboard.html` — auto-generated human dashboard (regenerated on every
  Maintenance Pass, gitignored). Self-contained HTML with score histogram,
  top/worst articles, open gaps, recent activity.
- `wiki/reports/YYYY-MM-DD-deep-improve.html` — one HTML report per Deep
  Improve run. Checked into git (small enough, valuable history).
- `wiki/<topic>/<archive>.html` — archived query answers (point-in-time
  reports, never edited, checked in).

#### Reserved topic: `harness/` (the control-plane's own knowledge)

One topic directory is reserved by the harness itself for the data the control
plane keeps about the user and its own decisions. It is a normal wiki topic
(linted, scored, indexed) with two canonical articles:

- `wiki/harness/user-profile.md` — the living portrait of the user: technical
  level, accompaniment level (L0–L3), goals, context, constraints. **Every
  skill reads this first** and adapts verbosity + how many questions it asks to
  the level recorded here. Created/updated by `init` and `harness`.
  When absent, the agent defaults to non-technical framing and asks the two
  gauging questions (technical level, then accompaniment level) before
  proceeding. See the "Core behavior" section of the parent `SKILL.md`.
- `wiki/harness/decisions.md` — **append-only** log of every significant
  decision (deploy target, database, framework, hosting, tooling…). One entry
  per decision with date, requirements gathered, the 3 options presented (the
  "siempre 3 opciones" pattern), the choice, and the why. Never edit past
  entries — same append-only discipline as `log.md` and `gaps.md`.

Both articles are referenced from the root `CLAUDE.md` `## Knowledge map` under
the `harness/` topic.

### Format split: markdown for state, HTML for surfaces

The wiki uses **markdown for everything the agent reads or iteratively edits**
(`raw/`, articles, `log.md`, `gaps.md`, `scores.json`) and **HTML for surfaces
humans open** (dashboard, archives, deep-improve reports). This follows the
"HTML for artifacts, markdown for state" pattern. Rationale:

- Markdown corpus is grep-friendly for the agent in Query, diff-clean in git,
  and easy for Micro-Improve to rewrite without diff noise.
- HTML surfaces are read-once or regenerated; they get the information
  density (tables, inline SVG, color, interactivity) that Thariq advocates.

When in doubt: if it would be edited again, markdown. If it would be opened
once and looked at, HTML.

Templates live alongside this file in `references/`:

- `wiki-raw-template.md`
- `wiki-article-template.md`
- `wiki-index-template.md`
- `wiki-archive-template.md`
- `inbox-readme-template.md` — the `inbox/README.md` user contract
- `ingest-formats.md` — multiformat Fetch protocol (PDF, image, CSV, JSON, …)

---

## The vault is Obsidian-native

`02-DOCS/` opens directly as an Obsidian vault (the human's "base folder" is
`02-DOCS/` itself, not the repo root). The agent writes the wiki; the human
**reads** it in Obsidian — graph, backlinks, Properties, and `.base` views — which
is exactly the Karpathy split. Navigation is **structure** (markdown links +
frontmatter + Bases), not semantic similarity: **no vector DB, no embeddings, no
RAG**, and no embedding/search plugins. The `.base` views become the human
navigation; `index.md` + `scores.json` remain the machine layer + fallback. The
exact scaffolding (the `.base` files, `.obsidian/app.json`, attachments,
`.gitignore`, excluded files) is materialized from `obsidian-scaffolding.md` during
Initialization.

The win is that **the same files serve both surfaces**: because internal links are
standard markdown (not wikilinks) and frontmatter uses the OKF standard field
names, `wiki/` is simultaneously a native Obsidian vault AND a portable, 100%-OKF
v0.1-conformant knowledge bundle — readable by any OKF consumer, no export step.
See the OKF conformance rules in [Conventions](#conventions).

## Initialization

Triggers on the first Ingest. Check whether `02-DOCS/raw/` and `02-DOCS/wiki/`
exist. Create only what is missing; never overwrite existing files:

- `02-DOCS/inbox/` directory — the drop zone for any raw data
- `02-DOCS/inbox/README.md` — rendered from `inbox-readme-template.md`
- `02-DOCS/inbox/_processed/` directory (with `.gitkeep`) — sweep archive
- `02-DOCS/raw/` directory (with `.gitkeep`)
- `02-DOCS/wiki/` directory (with `.gitkeep`)
- `02-DOCS/wiki/index.md` — heading `# Knowledge Base Index`, empty body
- `02-DOCS/wiki/log.md` — heading `# Wiki Log`, empty body
- `02-DOCS/wiki/gaps.md` — heading `# Knowledge Gaps`, empty body
- `02-DOCS/wiki/scores.json` — `{}` (populated by the first Maintenance Pass)
- `02-DOCS/wiki/.ingested.json` — `{}` (the Auto-Ingest Sweep's seen-ledger)
- `02-DOCS/.rscignore` — the scan boundary for the Auto-Ingest Sweep, from
  `ingest-ignore-defaults.md` (tracked, not gitignored)
- `02-DOCS/wiki/reports/` directory (with `.gitkeep`) — will hold Deep Improve reports
- `02-DOCS/audits/` directory (with `.gitkeep`) — holds per-run audit reports
  from the parent skill (`audit-YYYY-MM-DD-HHMM.html`). May already exist if
  Phase 2 of the parent skill created it eagerly to write the first audit.
- `02-DOCS/raw/worklog/` directory (with `.gitkeep`) — the **work-driven on-ramp**
  (see "Worklog Sweep"); holds `YYYY-MM-DD-<slug>.md` captures of what we did.
- `02-DOCS/attachments/` directory + `README.md` — shared binaries (Obsidian's
  default attachment folder), from `obsidian-scaffolding.md`.
- `02-DOCS/wiki/Articles.base`, `Worklog.base`, `Decisions.base` — the human
  navigation views, from `obsidian-scaffolding.md`.
- `02-DOCS/.obsidian/app.json` — sets the attachment folder and wikilink defaults,
  from `obsidian-scaffolding.md`.
- `02-DOCS/.gitignore` — at minimum:
  - `wiki/dashboard.html` (regenerated by Maintenance Pass)
  - `audits/*.html` (per-run audit artifacts from the parent skill)
  - `inbox/_processed/` (sweep archive — bulky, derivable; the durable copy
    of every binary lives in `raw/<topic>/_originals/`)
  - `.obsidian/workspace*.json` and `.obsidian/cache` (Obsidian per-machine state;
    the rest of `.obsidian/` — themes, bases, config — is tracked)
  - `wiki/reports/*.html` is **not** gitignored — Deep Improve reports are
    durable historical records, unlike the per-run audit snapshots.

If Query or Lint cannot find the wiki structure, tell the user:
"Run an ingest first to initialize the wiki." Do not auto-create.

---

## Ingest

Fetch a source into `raw/`, then compile it into `wiki/`. Always both steps,
no exceptions.

### Fetch (raw/)

1. Get the source content. The source can be **any format** — a markdown
   README, a PDF invoice, a phone photo, a CSV export, an API payload, a URL.
   Follow `ingest-formats.md` to convert it: detect the format, run the
   matching handler, and produce (a) the preserved original in
   `raw/<topic>/_originals/` for non-text sources, (b) the extracted-text
   markdown. Text sources copy straight in; URLs use the agent's web fetch;
   PDFs/images use the agent's PDF/vision reading; tabular/JSON get a faithful
   digest with the original preserved. If a format truly can't be read, the
   handler preserves the original and logs a gap — never silently drop data.

2. Pick a topic directory. Check existing `02-DOCS/raw/` subdirectories
   first; reuse one if the topic is close enough. Create a new subdirectory
   only for genuinely distinct topics.

3. Save as `02-DOCS/raw/<topic>/YYYY-MM-DD-descriptive-slug.md`.
   - Slug from source title, kebab-case, max 60 characters.
   - Published date unknown → omit the date prefix from the file name
     (e.g., `descriptive-slug.md`). The metadata Published field still
     appears; set it to `Unknown`.
   - If a file with the same name already exists, append a numeric suffix
     (e.g., `descriptive-slug-2.md`).
   - Include metadata header: source URL, collected date, published date.
   - Preserve original text. Clean formatting noise. Do not rewrite opinions.

   See `wiki-raw-template.md` for the exact format.

### Compile (wiki/)

Determine where the new content belongs:

- **Same core thesis as existing article** → Merge into that article. Add the
  new source to Sources/Raw. Update affected sections.
- **New concept** → Create a new article in the most relevant topic directory.
  Name the file after the concept, not the raw file.
- **Spans multiple topics** → Place in the most relevant directory. Add
  See Also cross-references to related articles elsewhere.

These are not mutually exclusive. A single source may warrant merging into
one article while also creating a separate article for a distinct concept
it introduces. In all cases, check for factual conflicts: if the new source
contradicts existing content, annotate the disagreement with source
attribution. When merging, note the conflict within the merged article.
When the conflicting content lives in separate articles, note it in both
and cross-link them.

See `wiki-article-template.md` for article format. Key points:

- Sources field: author, organization, or publication name + date,
  semicolon-separated.
- Raw field: markdown links to `raw/` files, semicolon-separated.
- Relative paths from `wiki/<topic>/` use `../../raw/<topic>/<file>.md` (two
  levels up to `02-DOCS/`).

### Cascade Updates

After the primary article, check for ripple effects:

1. Scan articles in the same topic directory for content affected by the
   new source.
2. Scan `02-DOCS/wiki/index.md` entries in other topics for articles covering
   related concepts.
3. Update every article whose content is materially affected. Each updated
   file gets its `timestamp` refreshed.

Archive pages are never cascade-updated (they are point-in-time snapshots).

### Post-Ingest

Update `02-DOCS/wiki/index.md`: add or update entries for every touched
article. When adding a new topic section, include a one-line description.
The article's `timestamp` reflects when its knowledge content last changed,
not the file system mtime. See `wiki-index-template.md` for format.

Prepend to `02-DOCS/wiki/log.md` (newest entry first, at the top):

```
## [YYYY-MM-DD] ingest | <primary article title>
- Updated: <cascade-updated article title>
- Updated: <another cascade-updated article title>
```

Omit `- Updated:` lines when no cascade updates occur.

### Auto-trigger: Maintenance Pass

Every Ingest ends by running the **Maintenance Pass** (see Continuous
Improvement section below). This is not optional — it runs automatically.

---

## Inbox Sweep — "el agente sale a pasear"

The Inbox Sweep is the agent going for a walk through the drop zone. It is a
**batch Ingest** over everything sitting in `02-DOCS/inbox/`, turning a folder
of chaos into compiled knowledge in one pass. This is the operation the whole
paradigm is built around: the user dumps raw data whenever they like, and the
sweep (on demand or scheduled) gives it order.

### Triggers

- User says: `"procesa el inbox"`, `"sal a pasear"`, `"ingest inbox"`,
  `"sweep the inbox"`, `"process my drop folder"`.
- Scheduled via cron (see below).

### Steps

1. **Walk** `02-DOCS/inbox/`, recursively, collecting every file. **Skip**
   `inbox/_processed/`, `inbox/README.md`, and dotfiles. If the inbox is empty,
   report "inbox is empty, nothing to sweep" and stop.

2. **For each file**, run a full Ingest (Fetch via `ingest-formats.md` →
   Compile → Cascade), exactly as the single-source Ingest above:
   - Detect format, extract content, preserve the original in
     `raw/<topic>/_originals/`.
   - Classify into a topic by **content**, not format (a `factura.pdf` and an
     `extracto.csv` may both be `finanzas/`).
   - Compile into `wiki/`, merging into an existing article or creating a new
     one, with See Also cross-links and conflict annotations.

3. **On success**, move the original file from `inbox/` to
   `inbox/_processed/YYYY-MM-DD/<original-name>` (the byte-for-byte copy also
   lives in `raw/<topic>/_originals/`; `_processed/` is the audit trail of
   *what arrived when*). Preserve any subfolder structure the user used inside
   the inbox.

4. **On failure** (unreadable binary, extraction error): leave the file **in
   `inbox/`**, write the failure stub + gap per `ingest-formats.md`'s Unknown
   handler, and continue with the next file. An unread file is never marked
   processed.

5. **One Maintenance Pass at the end** — not per file. After the whole batch
   is compiled, run a single Maintenance Pass (deterministic lint, score
   recompute, cross-link sweep, gap detection, dashboard regen). Batching keeps
   the sweep fast even for a large drop.

6. **Micro-Improve counter** increments by the number of files successfully
   ingested (each is an interaction). If the counter crosses N, run
   Micro-Improve once after the Maintenance Pass.

### Post-Sweep log

Prepend to `02-DOCS/wiki/log.md` (newest entry first, at the top):

```
## [YYYY-MM-DD] sweep | <S> ingested, <F> failed, <A> articles touched
- Ingested: <file> → [Article](topic/article.md)
- Failed: <file> (reason)
```

### Sweep safety rails

- **Idempotent.** A second sweep over an already-empty inbox does nothing.
- **No data loss.** A file leaves `inbox/` only after its original is safely in
  `raw/<topic>/_originals/` (or it was pure text fully captured in `raw/`).
- **Failures stay visible.** Unreadable files remain in `inbox/` with a gap
  logged, so the user can act — they are never hidden in `_processed/`.

---

## Worklog Sweep — work-driven capture

The Inbox Sweep turns files the user *dropped* into knowledge. The **Worklog
Sweep** turns what we *did* into knowledge — the second on-ramp. A work session is
just another source of chaos: it lands in `raw/worklog/` and is Compiled into
`wiki/` through the exact same pipeline. No parallel system.

### What it captures

One `raw/worklog/YYYY-MM-DD-<slug>.md` per meaningful unit of work, in the format
of `wiki-worklog-template.md` (frontmatter `type: worklog`, `title`, `topic`,
`timestamp`, `status: unprocessed`): what we did, why (intent + decisions), files touched
(`path:line`), outcome with evidence, open questions/next, commands. This
generalizes the SDD session-summary convention to *any* work.

### Triggers

- **Hook — `PreCompact` / `SessionEnd`** (Claude Code): fires right before context
  is lost or the session ends. The hook only *reminds*; the agent writes the
  worklog (Karpathy: the LLM writes). Wired by `targets/` → `.rsc/worklog-checkpoint.mjs`
  (run via `node`, so it works on Windows too).
- **Explicit milestone**: after a commit or a shipped feature, capture a worklog.
- **Daily curation automation**: distills any pending worklog raw on a timer (see
  Continuous Improvement and `daily-curation-automation.md`).

### Throttle — capture signal, not noise

Write a worklog **only** when there is durable signal: files changed, a decision
was made, or a milestone was hit. **Skip** pure read/answer turns and questions
with no change. Never manufacture a worklog "to look busy" — that is the same
safety rule the curation pass honors.

### Steps

1. **Capture.** Write the worklog to `raw/worklog/YYYY-MM-DD-<slug>.md`
   (`status: unprocessed`). Infer `topic` from content.
2. **Compile.** Run the normal Compile (Fetch is a no-op — the worklog is already
   `raw`): distill durable points into `wiki/<topic>/` articles (update existing
   before creating new), add markdown-link cross-refs + `## Related`, cascade.
3. **Route decisions.** Every significant decision is appended to
   `wiki/harness/decisions.md` (append-only, the "siempre 3 opciones" shape).
4. **Close.** Flip the worklog's `status` to `processed` (the raw stays as
   evidence — never deleted or rewritten) and append to `wiki/log.md`.

### Post-Sweep log

Prepend to `02-DOCS/wiki/log.md` (newest entry first, at the top):

```markdown
## [YYYY-MM-DD] worklog | <slug> → <A> articles touched
```

### Worklog Sweep safety rails

- **Evidence is immutable.** The worklog raw is never edited for style after the
  fact; only its `status` flips. Distillation happens in `wiki/`, not in the raw.
- **No invention.** Capture what actually happened (cite commands/outputs); do not
  embellish outcomes. "Done" requires evidence.
- **Throttled.** No worklog for trivial turns (see Throttle above).

---

## Auto-Ingest Sweep — automatic, workspace-wide

The Inbox Sweep processes what the user *dropped* in `inbox/`. The **Auto-Ingest
Sweep** extends it: it also **discovers** un-ingested documents anywhere in the
workspace and ingests them on its own — so the user never has to remember to file
sources. It runs automatically (SessionStart nudge + daily cron; see Triggers) and
on request.

The hard rule that keeps "automatic, workspace-wide" safe: **ingesting never
destroys data** — the original is always preserved inside the brain at
`raw/<topic>/_originals/`. What it does NOT do is leave the workspace cluttered:
once a source is safely in `raw/`, the loose original is **relocated, not left in
place** (see "Clean-as-you-go" below), so ingesting a file actually *tidies* the
tree. **Deleting** a file or a folder outright is still destructive and always
requires explicit, quoted consent.

### Clean-as-you-go — a clean repo is the invariant

The brain is the home for sources; the workspace is not a junk drawer. So when the
sweep ingests a **loose document at the workspace root** or **anything in
`inbox/`**, the original is **MOVED into the brain**, not copied — the byte-for-byte
file lands in `raw/<topic>/_originals/` and the root/inbox is left clean. Nothing is
lost: the file still exists, in `raw/`, which is version-controlled-adjacent
evidence. This is the literal contract the user asked for: *a PDF dropped at the
root that gets ingested ends up in `raw/`, not at the root.*

Scope of the move (deliberately narrow, so we never yank files out of places the
user organized on purpose):

- **Loose files at the workspace root** (a stray `factura.pdf`, `notes.txt`) → **moved** into `raw/<topic>/_originals/` after a verified ingest.
- **`inbox/` contents** → **moved** (this was already the inbox contract: process → `inbox/_processed/`; the durable copy is in `raw/`).
- **Files nested inside a structured folder the user maintains** (e.g. a project's own `docs/`, a `/transcripts` directory) → **copied**, and the sweep **proposes** consolidating + removing the now-redundant folder with quoted consent. Never silently moved.

A move only ever happens **after** the original is confirmed written to
`raw/<topic>/_originals/` (or fully captured as text in `raw/`). If anything fails,
the original stays exactly where it was.

### Steps

1. **inbox/** — run the Inbox Sweep on `inbox/` (unchanged).
2. **Scan** — walk the workspace minus `.rscignore` (and minus detected app source
   dirs). Consider only document-like files. A file is **un-ingested** when its
   `path` is absent from `wiki/.ingested.json` OR its content hash differs.
3. **Classify** each candidate and apply the Clean-as-you-go rule:
   - **Loose document at the workspace root** → **auto-ingest, then MOVE** the
     original into `raw/<topic>/_originals/`. The root is left clean.
   - **Clearly documentary folder** (docs/transcripts/pdfs, no code) →
     **auto-ingest**: Compile to `wiki/`, **copy** the original into
     `raw/<topic>/_originals/` (the source stays put for now), then **propose**
     removing the now-redundant folder (quoted consent — step 5).
   - **Ambiguous** (mixed, or possibly app data) → **list it and propose**; do not
     touch it. Log it to `gaps.md` so the next pass remembers.
4. **Record** every ingested source in `wiki/.ingested.json` (the move/copy is
   recorded with its new `raw/` location).
5. **Offer cleanup** — for a documentary folder the sweep fully ingested, **offer**
   to remove it once redundant, with the consent quoted back from the user.
   **Never auto-delete**, and never a folder the sweep did not itself empty.
   (Root-level loose files and `inbox/` files need no such offer — they are moved
   into `raw/` as part of the ingest, which is non-destructive: the file is
   relocated, never deleted.)

### Ledger — `wiki/.ingested.json`

The seen-ledger; the single source of truth for "what we've already ingested",
which makes the workspace scan idempotent (the Inbox Sweep alone tracks
processed-ness only by moving files to `inbox/_processed/`).

```json
{
  "<relpath-from-workspace-root>": { "hash": "sha256:…", "ingested": "YYYY-MM-DD", "topic": "…" }
}
```

Un-ingested = path absent OR hash changed. `inbox/` files still move to
`inbox/_processed/` **and** get a ledger entry. Initialized as `{}`.

### Auto-Ingest safety rails

- **Ledger-idempotent.** Never reprocess a source whose path+hash is recorded.
- **Scoped by `.rscignore`.** Never scan code, build output, `01-TOOLS/`, the
  wiki's own `raw/`+`wiki/`, or non-document files (see `ingest-ignore-defaults.md`).
- **Clean-as-you-go.** Loose root-level files and `inbox/` contents are **moved**
  into `raw/` after a verified ingest (the repo stays clean); files nested in a
  user-maintained folder are **copied** and consolidation is proposed with consent.
  A move never precedes the original being safely written to `raw/`.
- **Never delete.** The original is relocated into `raw/`, never destroyed.
  Removing an emptied/redundant folder is quoted-consent only.
- **Ambiguity is proposed, not grabbed.**

---

## Query

Search the wiki and answer questions. Examples of triggers:

- "What do I know about X?"
- "Summarize everything related to Y"
- "Compare A and B based on my wiki"

### Steps

1. Read `02-DOCS/wiki/index.md` to locate relevant articles.
2. Read those articles and synthesize an answer.
3. Prefer wiki content over your own training knowledge. Cite sources with
   markdown links: `[Article Title](02-DOCS/wiki/topic/article.md)`
   (project-root-relative paths for in-conversation citations; within
   wiki/ files, use paths relative to the current file).
4. Output the answer in the conversation. Do not write files unless asked.

### Auto-trigger: Touch Update + Maintenance Pass

After answering, run two automatic passes (non-blocking — the answer comes
first):

1. **Touch Update**:
   - For every article cited, increment its `cited_count` in `wiki/scores.json`.
   - If the query couldn't find a satisfying answer (no relevant article, or
     the agent had to fall back on training data), append a gap to
     `wiki/gaps.md` (format below).
2. **Maintenance Pass** (see Continuous Improvement section below).

### Archiving

When the user explicitly asks to archive or save the answer to the wiki:

1. Write the answer as a new **HTML** wiki page. See
   `wiki-archive-template.html`. Archives are point-in-time, read-once
   reports and benefit from HTML's information density (TL;DR box, sources
   sidebar, anchor links, inline SVG when relevant). When converting
   conversation citations to the archive page, rewrite project-root-relative
   paths to file-relative paths.
   - Sources sidebar: links to the wiki articles cited in the answer (use
     `.md` paths — they still link to the live articles).
   - No Raw field (content does not come from raw/).
   - File name reflects the query topic, e.g.,
     `subscription-flow-overview.html`.
   - Place in the most relevant topic directory: `wiki/<topic>/<name>.html`.
   - Self-contained: inline CSS, no CDN, no external scripts.
2. Always create a new page. Never merge into existing articles (archive
   content is a synthesized answer, not raw material).
3. Update `02-DOCS/wiki/index.md`. Add a row pointing to the `.html` file,
   prefix the Summary with `[Archived]`. The link target is the HTML path.
4. Prepend to `02-DOCS/wiki/log.md` (newest entry first, at the top):
   ```
   ## [YYYY-MM-DD] query | Archived: <page title>
   ```

---

## Lint

Quality checks on the wiki. Two categories with different authority levels.

### Deterministic Checks (auto-fix)

Fix these automatically:

**Index consistency** — compare `02-DOCS/wiki/index.md` against actual
`02-DOCS/wiki/` files (excluding index.md and log.md):

- File exists but missing from index → add entry with `(no summary)`
  placeholder. For the Updated column, use the article's `timestamp` if
  present; otherwise fall back to file's last modified date.
- Index entry points to nonexistent file → mark as `[MISSING]` in the
  index. Do not delete the entry; let the user decide.

**Internal links** — for every markdown link in `wiki/` article files (body
text and Sources metadata), excluding Raw field links (validated by Raw
references below) and excluding index.md/log.md (handled above):

- Target does not exist → search `wiki/` for a file with the same name
  elsewhere.
  - Exactly one match → fix the path.
  - Zero or multiple matches → report to the user.

**Raw references** — every link in a Raw field must point to an existing
`raw/` file:

- Target does not exist → search `raw/` for a file with the same name
  elsewhere.
  - Exactly one match → fix the path.
  - Zero or multiple matches → report to the user.

**See Also** — within each topic directory:

- Add obviously missing cross-references between related articles.
- Remove links to deleted files.

### Heuristic Checks (report only)

These rely on your judgment. Report findings without auto-fixing:

- Factual contradictions across articles
- Outdated claims superseded by newer sources
- Missing conflict annotations where sources disagree
- Orphan pages with no inbound links from other wiki articles
- Missing cross-topic references
- Concepts frequently mentioned but lacking a dedicated page
- Archive pages whose cited source articles have been substantially updated
  since archival

### Post-Lint

Prepend to `02-DOCS/wiki/log.md` (newest entry first, at the top):

```
## [YYYY-MM-DD] lint | <N> issues found, <M> auto-fixed
```

---

## Continuous Improvement

The wiki improves itself as the user interacts with it. Three layers,
increasing in scope and consent requirements:

### Layer 1 — Maintenance Pass (every Ingest, every Query)

**Runs automatically. No consent prompt. Non-destructive only.**

Operations:

1. **Deterministic Lint with auto-fix** — runs the Lint subset that is safe
   to fix automatically (broken internal links, raw references, See Also
   drift, index consistency).
2. **Recompute quality scores** — for every wiki article, compute:
   ```
   score = (inbound_links * 2)
         + (sources_count)
         + (cited_count * 0.5)
         + freshness_weight
         - (conflict_count * 3)
         - (orphan_penalty)
   ```
   Where:
   - `freshness_weight` = 1.0 if `timestamp` within 30 days, 0.5 within 90, 0.1 beyond 180.
   - `orphan_penalty` = 5 if zero inbound links AND zero citations, else 0.
   - `conflict_count` = number of explicit conflict annotations in the article body.

   Write to `02-DOCS/wiki/scores.json` as `{ "topic/article.md": <score>, ... }`.
3. **Cross-link sweep** — within each affected topic, add obviously missing
   `See Also` links between related articles (the existing Lint heuristic, but
   actually applied, not just reported).
4. **Gap detection** — for concepts mentioned in ≥3 articles but lacking a
   dedicated page, append to `wiki/gaps.md`.
5. **Dashboard regeneration** — render `wiki/dashboard.html` from
   `wiki-dashboard-template.html`, populating it with current scores, top/worst
   5 articles, open gaps, and the last 20 lines from `wiki/log.md`. The HTML is
   self-contained (inline CSS + SVG, no CDN). Gitignored.
6. **Log** — append a one-line entry to `wiki/log.md`:
   ```
   ## [YYYY-MM-DD] maintenance | autofixes: <N>, new See Also: <M>, gaps detected: <K>
   ```

This pass MUST complete in under ~30 seconds for typical-sized wikis (< 200
articles). If it can't, skip the heaviest step (cross-link sweep) and log a
warning. The dashboard regeneration is cheap (< 1s) and never skipped.

### Layer 2 — Micro-Improve (every N interactions, default N=5)

**Runs automatically. No consent required for additive changes. Old versions
preserved.** Counts Ingests + Queries together. The counter lives at the top
of `wiki/log.md` (or in `wiki/scores.json` under `_meta.interactions_since_improve`).

When the counter hits N, run:

1. **Pick 1 lowest-scoring article** from `wiki/scores.json`. If its score is
   below threshold (default: 2.0), rewrite it:
   - Re-read all its `Raw:` sources.
   - Distill again with better structure (improved overview, clearer body
     sections, accurate See Also).
   - **Preserve the old version** at `wiki/<topic>/_archive/<article>__YYYY-MM-DD.md`
     so the user can revert.
   - Bump the `timestamp`.
2. **Pick 1 top gap** from `wiki/gaps.md`. If there's enough raw material for
   it (≥2 raw sources mention the concept), create a new article. Mark the
   gap as `[FILLED YYYY-MM-DD]` in `wiki/gaps.md` instead of deleting (audit trail).
3. **Refresh 1 stale archive** — if any archived query answer cites articles
   whose `timestamp` is newer than the archive's, append a `> ⚠ Stale:
   underlying sources updated YYYY-MM-DD` note to the archive (read-only flag,
   don't rewrite).
4. **Reset counter** to 0.
5. **Log**:
   ```
   ## [YYYY-MM-DD] micro-improve | rewrote: <title>, filled gap: <title>, flagged stale: <title>
   ```

If a rewrite affects an article the user touched in the last 24 hours, SKIP
that article and pick the next lowest-scoring one — never overwrite recent
human work.

### Layer 3 — Deep Improve (explicit or scheduled)

**Runs on explicit user request, or via cron.** Heavier than Micro-Improve;
processes multiple articles per run.

Triggers:
- User says: `"improve the wiki"`, `"deep improve"`, `"polish wiki"`.
- Scheduled via the `schedule` skill (recommended cadence: weekly).

Operations:

1. Run a full Lint (both deterministic and heuristic categories).
2. Rewrite the bottom-K articles by score (default K=5).
3. Fill the top-K gaps (default K=3).
4. Generate cross-topic See Also recommendations from the heuristic Lint
   report and apply them.
5. Refresh all archive freshness flags.
6. Compact `wiki/gaps.md` — remove `[FILLED]` entries older than 90 days.
7. **Write the Deep Improve report** to
   `wiki/reports/YYYY-MM-DD-deep-improve.html` using
   `wiki-deep-improve-report-template.html`. Includes: summary stats,
   per-rewrite cards with old/new title and reason, gaps filled, conflicts
   flagged, archives marked stale. Self-contained HTML (inline CSS/SVG, no
   CDN). **Checked into git** (one report per run, dated, history is
   valuable).
8. Append a comprehensive log entry to `wiki/log.md` referencing the report
   file path.

Before Deep Improve runs from a user command, the agent MUST list what it
plans to rewrite/create and ask for `"yes, proceed"`. Scheduled runs use the
configuration captured at schedule creation time.

### Suggested cron setup

```bash
# Nightly Inbox Sweep at 02:00 — the agent goes for a walk through the drop zone
schedule create wiki-inbox --cron "0 2 * * *" --command "procesa el inbox"

# Daily Lint with auto-fix at 03:00
schedule create wiki-lint --cron "0 3 * * *" --command "lint wiki --autofix"

# Weekly Deep Improve, Sundays 04:00 local
schedule create wiki-improve --cron "0 4 * * 0" --command "deep improve wiki"
```

The three together are the full loop: the sweep ingests whatever landed in the
inbox overnight, the lint keeps links/scores honest, and the weekly deep improve
rewrites weak articles and fills gaps. Knowledge compounds without the user
doing anything but dropping files.

### Knowledge Gaps log — format

`wiki/gaps.md` accumulates wanted-but-missing topics. Append-only; gaps get
flagged `[FILLED YYYY-MM-DD]` when addressed, never deleted.

```
# Knowledge Gaps

## [YYYY-MM-DD] gap | <concept>
Source: <where it was detected — query that couldn't answer, articles mentioning it, etc.>
Mentioned in: [Article A](topic/a.md), [Article B](topic/b.md)
Suggested topic: <topic where the new article would go>
Status: open
```

When filled:

```
## [YYYY-MM-DD] gap | <concept>
...
Status: [FILLED 2026-06-02] → wrote [New Article](topic/new-article.md)
```

### Safety rails for autonomous improvement

These apply to all Layers:

1. **Never overwrite without preservation.** Rewrites always archive the old
   version to `wiki/<topic>/_archive/`. The archive folder is gitignored
   from compaction (lives forever unless the user prunes).
2. **Never touch articles the human just touched.** If `timestamp` < 24h ago,
   skip in Micro-Improve. (Deep Improve respects this via the consent prompt.)
3. **Never auto-resolve conflicts.** Heuristic Lint flags contradictions;
   the user resolves.
4. **Always log every change** to `wiki/log.md`. The log is the audit trail
   for everything autonomous.
5. **`wiki/log.md` is newest-first + immutable; `wiki/gaps.md` is append-only.**
   New `log.md` entries are prepended at the top (OKF reserved-file rule); new
   `gaps.md` entries are appended. Past entries in either are never edited.
   Compaction (in Deep Improve) only removes `[FILLED]` gaps older than 90 days,
   and only adds a single compaction marker entry to the log.

---

## Conventions

- **`wiki/` is an OKF v0.1 bundle.** The whole `wiki/` directory conforms to the
  Open Knowledge Format ([spec](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)):
  it is portable, tarball-able, and any OKF consumer (Obsidian, the OKF HTML
  visualizer, an agent) can read it without translation. The conformance rules
  the rest of this protocol enforces:
  1. Every non-reserved `.md` file has valid YAML frontmatter with a non-empty
     `type`. (Reserved files `index.md` and `log.md` are exempt — see below.)
  2. The frontmatter standard surface is `type` (required) + `title, description,
     resource, tags, timestamp` (recommended, OKF-named). rsc adds custom fields
     (`aliases, topic, status, sources, score`) — OKF allows any extra key.
  3. The knowledge graph is built from **standard markdown links** — NEVER
     wikilinks (`[[...]]`). An OKF consumer follows markdown links; it cannot
     follow `[[...]]`.
- **Standard markdown links, relative paths.** Internal cross-references use
  `[Text](./same-topic.md)` / `[Text](../other-topic/page.md)` / `[Text](../../raw/<topic>/<file>.md)`.
  Obsidian is configured (`useMarkdownLinks: true`, `newLinkFormat: relative`,
  `alwaysUpdateLinks: true` — see `obsidian-scaffolding.md`) so the graph +
  backlinks render and links auto-rewrite on rename. The `aliases` field keeps the
  old kebab slug so pre-migration links still resolve.
- **Frontmatter on curated articles.** Every `wiki/<topic>/` article carries the
  YAML frontmatter from `wiki-article-template.md` (`type, title, description,
  resource, tags, timestamp` + custom `aliases, topic, status, sources, score`).
  This powers OKF consumers AND Obsidian Properties + the `.base` views. The two
  OKF **reserved** files are exempt: `index.md` carries **no frontmatter** (it is
  a directory listing) and `log.md` is the change log (see below).
- **`log.md` is newest-first.** Per the OKF reserved-file rule, new entries are
  **prepended at the top** (newest first), use ISO 8601 dates, and past entries
  are never edited or deleted. `gaps.md` stays append-only (it is a custom file,
  not OKF-reserved).
- **Human-readable wiki filenames** (`Month-End Close.md`) for clean graph nodes;
  the old kebab slug goes in `aliases` so prior links still resolve.
  `raw/` and `raw/worklog/` filenames stay kebab + date (chaos, not display).
- `wiki/` supports one level of topic subdirectories only. No deeper
  nesting.
- Today's date for log entries, Collected dates, and Archived dates.
  The `timestamp` field (ISO 8601) reflects when the article's knowledge content
  last changed. Published dates come from the source (use `Unknown` when unavailable).
- Inside `wiki/` files, internal references use relative markdown links. In
  conversation output, use project-root-relative paths (e.g.,
  `02-DOCS/wiki/topic/Article.md`).
- Ingest updates both `02-DOCS/wiki/index.md` and `02-DOCS/wiki/log.md`.
  Archive (from Query) updates both. Lint updates `02-DOCS/wiki/log.md`
  (and `02-DOCS/wiki/index.md` only when auto-fixing index entries). Plain
  queries do not write any files.

---

## How autonomous improvement interacts with this protocol

- **Bootstrap Ingest** (Phase 4 step 8 of the parent SKILL.md) ends with the
  Maintenance Pass automatically — the wiki starts with scores already
  computed.
- **Subsequent Ingests and Queries** triggered by the user from any session
  carry the same auto-Maintenance behavior.
- **Counter persistence**: the interaction counter for Micro-Improve lives in
  `wiki/scores.json` under `_meta.interactions_since_improve`. Don't lose it
  across sessions.
- **Configuration**: defaults can be overridden by a `wiki/.config.json` if
  present: `{ "micro_improve_every": 5, "rewrite_threshold": 2.0, "skip_recent_hours": 24 }`.

---

## How `harness` uses this protocol

The `02-DOCS/` engine is **domain-agnostic and ongoing**: the durable way to
feed it is to drop files into `inbox/` and let the Inbox Sweep run (on demand
or via cron). The dev bootstrap below is just **one convenient seeding pass** —
it pre-fills the wiki from the workspace's own documentation so the knowledge
base isn't empty on day one. It is not the only or primary ingestion path; a
non-software user might skip it entirely and rely solely on the inbox.

When the parent skill reaches Phase 4 step 8 ("Build `02-DOCS/`"), it first
initializes the layer (creating `inbox/`, `inbox/README.md`, `raw/`, `wiki/`,
…), then performs a **bootstrap ingest** by treating each of these as a
separate Fetch+Compile pass:

1. Each subproject `README.md` → topic = `subprojects` (or split per
   subproject: `backend`, `frontend`, etc., if the workspace already has
   strong per-subproject identity).
2. `01-TOOLS/README.md` → topic = `operations`.
3. Each `01-TOOLS/<TOOL>/README.md` and `CREDENTIALS.md` → topic = `operations`,
   one article per tool, citing both files as Raw.
4. Each file under `02-DOCS/raw/migrated/` (from legacy `XX-*` folder
   migration) → topic chosen by content. **These files stay where they are
   in `raw/migrated/` — they're already raw.** Skip the Fetch step entirely
   and run only Compile: write `02-DOCS/wiki/<topic>/<article>.md` citing
   `../../raw/migrated/<original-folder>/<file>.md` in the Raw field. Do NOT
   duplicate the content into `raw/<topic>/`.
5. Root `CLAUDE.md` and `AGENTS.md` → topic = `meta`.

After the bootstrap ingest, the index.md should have at least these topics
populated. The user can re-trigger ingest later for new sources, and
the same protocol applies.
