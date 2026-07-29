---
name: harness
description: "Use when governing a workspace's control plane, code or not — the `01-TOOLS/` tooling layer, the `02-DOCS/` chaos→knowledge wiki, the root Knowledge map. Audits it, migrates legacy `XX-*` folders, scaffolds provider tooling, sweeps the inbox, writes root CLAUDE.md/AGENTS.md. NOT the bootstrap front door (that is `init`, which hands off here)."
tags: [harness, company, ops, docs, wiki, connect, tools, knowledge]
recommends: [init]
profiles: [minimal, core, full]
origin: risco
---

# Harness — the workspace control plane

The **harness** is the control plane of a workspace. A workspace need not be code: it can be a company, an ops desk, a legal archive, a personal knowledge vault. Whatever it is, the harness is the durable apparatus that keeps it operable and legible, made of three parts:

- **`01-TOOLS/<PROVIDER>/`** — the operational tooling layer. One folder per external provider, co-locating credentials (`.env`) with the scripts that consume them. Each tool ships a working `test_connection` against the real API.
- **`02-DOCS/`** — the **Karpathy chaos→knowledge engine**: a domain-agnostic LLM wiki
  (`inbox/`, `raw/`, `raw/worklog/`, `wiki/` with its `index.md` / `log.md` / `gaps.md` /
  `scores.json` and `.base` views), embedded in this skill — no external sub-skill required.

  Two on-ramps feed it. **Ingest**: the user drops any file in any format into `inbox/`, and the
  Auto-Ingest Sweep extracts, classifies, cross-links and compiles it — then goes for a walk,
  discovering un-ingested documents anywhere in the workspace, bounded by `.rscignore` (baseline:
  `references/ingest-ignore-defaults.md`) and de-duplicated through the `wiki/.ingested.json`
  ledger. **Worklog**: every meaningful session of
  work is itself a raw source in `raw/worklog/`, captured on `PreCompact`/`SessionEnd`, at a commit
  milestone, or by the daily curation pass.

  Ingest relocates, never deletes: a loose file at the workspace root moves into `raw/`; a file
  inside a folder the user maintains is copied, and consolidating that folder needs explicit consent.

  The `wiki/` is simultaneously an OKF-v0.1 bundle
  ([Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf))
  and an Obsidian-native vault: markdown links, YAML frontmatter, readable filenames, `.base` views
  giving a real graph and live tables. **Structure, not vector DB / embeddings / RAG.** The agent
  writes it; the human reads it in Obsidian. Topics are inferred from content (`finanzas/`, `legal/`,
  `crm/`…), never hardcoded.

  It compounds on its own: every Ingest, Sweep and Query triggers a Maintenance Pass (lint, score
  recomputation, gap detection, Related sweep), a Micro-Improve runs every N interactions, and Deep
  Improve runs on request or on the daily schedule (`references/daily-curation-automation.md` — on
  Claude Code, wire it via the `schedule` skill). Protocol → `references/wiki-protocol.md`;
  formats → `references/ingest-formats.md`; capture → `references/wiki-worklog-template.md`;
  vault → `references/obsidian-scaffolding.md`.
- **The Knowledge map** — the `## Knowledge map` section of the root `CLAUDE.md` that indexes the wiki (including the `harness/` topic) and is read by every other skill before it works in its area.

`harness` is the **protagonist concept**. `init` is the bootstrap front door — it gauges the user, drafts the profile, and hands off the first scaffold. THIS skill (`harness`) is the **ongoing control**: it audits, migrates, scaffolds, sweeps the inbox, and keeps the wiki, the tooling and the Knowledge map honest over the life of the workspace. It also generates root `CLAUDE.md` and `AGENTS.md`, and migrates legacy `XX-*` numbered folders into the canonical layout.

## How the harness talks to the user

Read `02-DOCS/wiki/harness/user-profile.md` before you start and adapt verbosity and question count
to the `technical_level` and `accompaniment_level` you find. L0 means terse and almost silent; L3
means explain everything and ask a lot. No profile yet → assume non-technical, and let `init` run
first contact (it owns the two gauging questions and the dial; do not re-ask them here).

Two files carry the state, both indexed from the root `CLAUDE.md` Knowledge map under `harness/`:
`user-profile.md` for the living portrait of the user, and `decisions.md` as an append-only log —
date, requirements gathered, options presented, choice, why. Log every significant decision you take.

`.rsc/.no-harness` is the user's explicit "no harness in this repo". Treat it as canonical: never
overwrite it, never delete it, never auto-start onboarding past it.

For long SDD work, write the recovery note `02-DOCS/wiki/sdd/sessions/<date>-<slug>.md` before
context compacts or the work is handed off — active artifacts, phase, last verdict, next steps,
risks, commands. It is what lets the next agent resume without trusting chat history.

### Significant decisions: requirements first, then exactly three options

For any significant decision (deploy target, database, hosting, tooling), gather the requirements
that actually drive the choice *before* presenting anything — for a deploy: expected and concurrent
users, budget, data residency, the team's ops comfort, scaling needs. At L0 ask only the few that
change the answer; at L3 ask all of them, one at a time. Then present exactly three options with
honest trade-offs, recommend one in language matched to their level, and log it.

The canonical deploy trio is Hetzner+Coolify (cheap, total control, self-managed), Vercel (zero-ops,
scales itself, costly at scale), and a third chosen from their answers. Apply the pattern yourself
for harness-level choices, but defer concrete deploy mechanics to `deployment`, which owns them.

## Core principle

**Detection with interactive confirmation. Never speculative tools. Never destructive without explicit consent.**

The skill proposes, the user confirms, the skill executes. Every destructive operation (deleting a legacy folder, merging into an existing `CLAUDE.md`) requires explicit consent quoted back from the user, not inferred.

**Out of scope:** adding a single tool — the user does `cp -r 01-TOOLS/_TEMPLATE 01-TOOLS/<X>` manually, no need for the full protocol; and refactoring runtime code — this skill is operational tooling only, never runtime.

## Protocol — five phases

```
SCAN → AUDIT → CONSENT → APPLY → VERIFY
```

Never skip a phase. Never collapse phases. The user reads the AUDIT before anything is written.

### Phase 1 — SCAN (read-only)

Walk the workspace root and gather:

1. **Workspace root** — current directory unless the user passes one explicitly.
2. **Subprojects** — top-level directories containing a manifest (`package.json`, `pyproject.toml`, `pubspec.yaml`, `Cargo.toml`, `go.mod`). Record stack per subproject (Next.js, FastAPI, Flutter, Express, etc.) from manifest contents.
3. **Provider detection** — for every entry in `references/providers.yaml`, search the workspace for evidence:
   - `imports`: grep for the SDK import patterns across source files (skip `node_modules/`, `.venv/`, `.next/`, `__pycache__/`, `.git/`, `dist/`, `build/`, `.dart_tool/`).
   - `env_vars`: grep for the variable names in `.env*`, `*.yaml`, `*.yml`, source files.
   - `deps`: search the dependency name in manifest files.
   - Record evidence with `path:line` for each hit. A provider counts as **detected** if any detector matches.
4. **Legacy `XX-*` folders** — list root entries matching `^[0-9]+-[A-Z_]+$`. For each, recursively classify every file:
   - **TOOLING** — folder contains `.env`, `.env.example`, executable scripts (`*.sh`, `*.py` with shebang), or integrates a provider from the catalog.
   - **DOCS** — `*.md`, `*.txt`, diagrams (`*.png`, `*.svg`, `*.mmd`), notes.
   - **AMBIGUOUS** — mixed, runtime code (Python modules without shebang, TS files), or content the classifier cannot place with high confidence.
5. **Existing canonical layout** — check whether `01-TOOLS/`, `02-DOCS/`, `CLAUDE.md`, `AGENTS.md` already exist. If yes, read their current content.
6. **Git state** — for each subproject that's a git repo, capture `git status --short`. Don't act on dirty trees without flagging.

### Phase 2 — AUDIT (presented to user)

Render **two artifacts**:

1. **A compact text summary in the conversation** — 1–3 sentences per section, the full destructive-ops list, the consent prompt, in the format of `references/audit-report-template.md`. This keeps the terminal flow fast. A full walked-through audit on a synthetic project: `examples/audit-example.md`.
2. **A full HTML report at `<workspace_root>/02-DOCS/audits/audit-YYYY-MM-DD-HHMM.html`** using `references/audit-report-template.html`. Self-contained (inline CSS, no CDN). Includes color-coded action tables, collapsible legacy-folder sections, highlighted destructive ops, and the consent prompt. **Gitignored** (per-run artifact).

If `02-DOCS/audits/` does not exist, create it (with `.gitkeep`) before writing — even on first run, before Phase 4 builds the rest of `02-DOCS/`. Same for `02-DOCS/` itself: the audits subdirectory is the only piece allowed to materialize during Phase 2; the rest waits until APPLY. Never write the audit HTML at the workspace root.

The text summary points to the HTML: `"Full audit at ./02-DOCS/audits/audit-XXX.html — open it to review details, then reply 'yes, proceed' or 'adjust'."`

The HTML must contain:

- **Stack summary** — one line per subproject with detected stack and path.
- **Tools to create** — table: `Tool | Evidence (path:line) | Action (CREATE / MERGE / SKIP)`.
- **Legacy `XX-*` folders** — one sub-section per folder, with a per-file classification table and a proposed destination.
- **Ambiguous files** — explicit list. These will NOT be moved. The user decides later.
- **Root files** — what happens to `CLAUDE.md` / `AGENTS.md` (CREATE, MERGE-additive, or SKIP if identical).
- **`02-DOCS/` plan** — list of sources to ingest (per `references/wiki-protocol.md`), the topics that will appear in `wiki/`, and confirmation that the wiki layer is built in-skill.
- **Files NEVER touched** — explicit list reminding the user of the safety boundary: real `.env`, contents of `node_modules/`, `.venv/`, `.next/`, `__pycache__/`, `.git/`, subproject runtime source.
- **Destructive operations** — separate section, bold. List every folder that would be deleted and under what condition.
- **Dirty git trees** — if any subproject has uncommitted changes, list them and recommend stashing/committing before proceeding.

### Phase 3 — CONSENT

The user must respond with explicit approval. Accept ONLY these forms:

- `"yes, proceed"` / `"go"` / `"proceed"` → APPLY.
- `"adjust"` / `"modify"` → ask which tools to drop/add, then re-AUDIT.
- Anything else, including silence, ambiguous "ok", "sure", "sounds good" → DO NOT PROCEED. Re-prompt explicitly: "I need explicit confirmation. Reply `yes, proceed` or `adjust`."

**Destructive consent is separate.** Even after the main "yes, proceed", the deletion of any legacy `XX-*` folder requires a SECOND consent after migration is verified (see APPLY step 7).

### Phase 4 — APPLY

Execute in this exact order. Each step writes to disk; abort and report on first error.

1. **Root files.**
   - If `CLAUDE.md` does not exist: render `references/claude-md-template.md` with the scan data and write it.
   - If `CLAUDE.md` exists: read it, compute a section-level diff against the template, and apply ONLY additive merges. Never delete user content. Never overwrite a section the user has customized. Append missing sections at the end with an `<!-- added by harness YYYY-MM-DD -->` marker.
   - Same logic for `AGENTS.md`, rendered from `references/agents-md-template.md`.
2. **Create `01-TOOLS/` skeleton.**
   - Create `01-TOOLS/` directory.
   - Copy `assets/_TEMPLATE/` to `01-TOOLS/_TEMPLATE/`. This template is **generic boilerplate with placeholders (`<NOMBRE_TOOL>`, `<TOOL>_API_KEY`)**. The user copies it manually when adding a tool NOT in the catalog. The skill itself does NOT use `_TEMPLATE/` to generate the detected tools — those come from `providers.yaml`.
3. **Per detected tool** (in catalog order):
   - Create `01-TOOLS/<ID>/`.
   - Write every file from the provider entry's `files:` map verbatim (replacing template variables: `{{TOOL_ID}}`, `{{DASHBOARD_URL}}`, etc.).
   - Write `.env.example` from the provider entry's `env_example` field.
   - Write `.gitignore` from the template (`.env`, `keys/`, `out/`, common secrets).
   - `chmod +x` on `test_connection.*` and any other executables.
   - **NEVER write a real `.env` file. NEVER fill credentials.**
4. **Migrate legacy `XX-*` folders.**
   - For each TOOLING file: move to its mapped destination in `01-TOOLS/<X>/`. If the destination file already exists from step 3, the legacy file goes to `01-TOOLS/<X>/migrated/<original-name>` so nothing is overwritten. The user resolves manually.
   - For each DOCS file: move to `02-DOCS/raw/migrated/<original-folder>/<path>`.
   - For each AMBIGUOUS file: leave in place. Record in the verification report. Never force-classify — a file moved to the wrong place is harder to recover than one left where the user put it.
5. **Verify migration.**
   - Count files moved vs files originally present. They must match (moved + ambiguous-remaining = original).
   - If counts don't match, abort and report. Don't proceed to deletion.
6. **Write `01-TOOLS/README.md`.**
   - Render `references/tools-readme-template.md` AFTER all tool folders exist (steps 3 + 4 completed). The catalog table then reflects actual on-disk state, not a promise.
7. **Destructive consent for legacy folder deletion.**
   - For each legacy folder where ALL files were classified (zero ambiguous) AND migration verified: prompt the user with the exact path: `"Migration verified. Delete 00-TOOLS/? Reply with the literal string 'yes, delete 00-TOOLS'."`
   - Only delete on exact-string match. Anything else: skip the deletion, preserve the now-empty folder.
   - For folders WITH ambiguous files: never delete. The folder stays with the ambiguous content.
8. **Build `02-DOCS/` (embedded wiki protocol).**
   - Open `references/wiki-protocol.md` and follow it. It defines initialization, ingest, query, and lint flows in full.
   - For the bootstrap pass on this APPLY: run the Initialization sub-section (create `02-DOCS/inbox/`, `02-DOCS/inbox/README.md` from `inbox-readme-template.md`, `02-DOCS/inbox/_processed/`, `02-DOCS/raw/`, `02-DOCS/wiki/`, `02-DOCS/wiki/index.md`, `02-DOCS/wiki/log.md`), then run the **bootstrap ingest** (one optional seeding pass — the ongoing path is dropping files into `inbox/` and running the Inbox Sweep) for each of these sources (see the "How `harness` uses this protocol" section at the bottom of `wiki-protocol.md`):
     - Each subproject `README.md` if present.
     - `01-TOOLS/README.md` (just written in step 6).
     - Each `01-TOOLS/<TOOL>/README.md` and `CREDENTIALS.md`.
     - Every file under `02-DOCS/raw/migrated/` (from legacy `XX-*` migration in step 4).
     - Root `CLAUDE.md` and `AGENTS.md`.
   - Use these templates verbatim; `wiki-protocol.md` is the source of truth for `02-DOCS`, so do NOT invent a different structure or format:
     - `references/wiki-raw-template.md` — `raw/<topic>/*.md`.
     - `references/wiki-article-template.md` — `wiki/<topic>/*.md` (OKF v0.1 frontmatter + relative markdown links + `## Related`).
     - `references/wiki-index-template.md` — `wiki/index.md` (machine catalog; the `.base` views are the human navigation).
     - `references/wiki-gaps-template.md` — `wiki/gaps.md` (Knowledge Gaps log).
     - `references/wiki-dashboard-template.html` — the live wiki dashboard, regenerated by Maintenance Pass.
     - `references/wiki-archive-template.html` — archived query answers (point-in-time, never edited).
     - `references/wiki-deep-improve-report-template.html` — Deep Improve run reports.

### Phase 5 — VERIFY

**Syntax gate — `bash -n` on every generated shell.** After scaffolding (APPLY steps 3–4), run `bash -n` on every generated `01-TOOLS/*/test_connection.sh` and any other generated shell script (e.g. `migrated/*.sh`) as a per-tool syntax gate. This parses each script without executing it, catching truncation or copy errors before the user ever runs them:

```bash
fail=0
for f in 01-TOOLS/*/test_connection.sh; do
  [ -f "$f" ] || continue
  if bash -n "$f" 2>/tmp/harness-bashn.err; then
    echo "ok   $f"
  else
    echo "FAIL $f"
    sed 's/^/       /' /tmp/harness-bashn.err
    fail=1
  fi
done
[ "$fail" -eq 0 ] || echo "One or more generated shells failed bash -n — report each above and do not claim the scaffold is clean."
```

Report any script that fails the gate (with its parse error) in the final report. A failing gate is a red flag: the provider entry in `providers.yaml` is likely malformed — surface it, don't silently ship a broken script.

**Preflight — `python3` availability.** Most provider smoke-tests pipe the API response through `python3 -c '…'` to parse JSON (Stripe, Mailjet, OpenAI, Anthropic, Gemini, Mistral, SendGrid, Vercel and ~30 more). Before telling the user to rely on those `test_connection.sh` scripts, confirm `python3` is on `PATH` and tell them how to install it if not:

```bash
if command -v python3 >/dev/null 2>&1; then
  echo "python3 present: $(python3 --version 2>&1)"
else
  echo "python3 NOT found — most test_connection.sh scripts parse JSON with it and will fail."
  echo "  macOS:         brew install python   (or: xcode-select --install)"
  echo "  Debian/Ubuntu: sudo apt install python3"
  echo "  Fedora/RHEL:   sudo dnf install python3"
  echo "  Windows:       winget install -e --id Python.Python.3.13   (bump the version if unavailable)"
fi
```

Print a final report:

- `python3` preflight result (present + version, or the install hint above).
- `bash -n` syntax-gate result (per generated shell: ok / FAIL with parse error).
- Files written (full list with paths).
- Folders deleted (with consent quote).
- Ambiguous files preserved (with locations).
- Suggested next steps:
  - `cp 01-TOOLS/<X>/.env.example 01-TOOLS/<X>/.env && chmod 600 01-TOOLS/<X>/.env` per tool.
  - `01-TOOLS/<X>/test_connection.{sh,py}` once `.env` is filled.
  - Any subproject with a dirty git tree to clean up.

## Equip — install the skills this workspace needs

Once the structure stands, make sure the workspace has the rsc skills its stack and goals call for — detection here, not just at `init`:

1. **Detect → propose.** From the detected stacks/providers and the user's goals in `02-DOCS/wiki/harness/`, build a shortlist. Ask the CLI if unsure: `npx @ericrisco/rsc consult "<stack + goal>"`. (Map e.g. detected Stripe→`stripe`, Postgres→`postgresdb`, Next→`nextjs`+`design`, a company/ops focus→`finance-ops`/`invoicing`/`gdpr-privacy`…)
2. **Confirm, then install yourself.** Show the shortlist with a one-line *why* each (matched to the dial), get a one-word confirm, and run it via Bash — installing writes to their environment, so always confirm first:
   ```bash
   npx @ericrisco/rsc add <skill> [<skill> ...]
   ```
   Can't run a shell? Print the exact command for another terminal tab.
3. **Flag the new session.** New skills load at session start — tell the user to open a **new tab/session** (or reload Cursor/Codex/Gemini) in this folder for them to activate. Log the installed set in `02-DOCS/wiki/harness/decisions.md`.

## Keep CLAUDE.md lean — the index lives in the wiki

Root `CLAUDE.md` is read on **every** turn, so every line is a permanent context tax (2026 best
practice: keep it **under ~200 lines**; beyond that, adherence rots as the rules that matter get
diluted by an index nobody needs in context). The biggest growth vector is the `## Knowledge map` —
a row per wiki article, appended by many skills, forever.

**The rule:** the **full** Knowledge map lives in `02-DOCS/wiki/index.md` (loaded on demand, grows
freely). Root `CLAUDE.md`'s `## Knowledge map` is a **short pointer** — only the read-first entries
(`harness/user-profile.md`, `sdd/constitution.md`) plus "full index → `02-DOCS/wiki/index.md`".

**Offload when it bloats (a move, never a trim — no info lost):** when `CLAUDE.md` passes ~200 lines
(the SessionStart hook nudges you) or its `## Knowledge map` has grown past the read-first entries:

1. Open `02-DOCS/wiki/index.md` (create it if absent).
2. **Move** every Knowledge-map row beyond the read-first entries from `CLAUDE.md` into
   `02-DOCS/wiki/index.md`, merging — don't duplicate, don't delete.
3. Leave `CLAUDE.md`'s `## Knowledge map` as the short pointer above.
4. Same for any other section overgrown into an index (e.g. a huge tool table): detail to the wiki,
   pointer stays.

From then on, **new index entries go to `02-DOCS/wiki/index.md`**, not `CLAUDE.md`. This is additive
and reversible; it honors the "never delete user content" rule (you relocate it, with a pointer).
Opt out of the size nudge with `.rsc/.no-claudemd-check`.

## Invariants

The consent, merge and `.env` rules live with the phases that enforce them above. These four are
scope rules that no single phase owns, and breaking one destroys something the user cannot get back:

1. **No speculative tools.** A tool is created if and only if the detector found evidence in the user's code. No "we should probably have a Sentry tool too".
2. **Idempotent.** Running the skill twice produces no extra side effects. Re-scanning a project already canonical detects "nothing to do".
3. **Out-of-scope dirs are invisible.** `node_modules/`, `.venv/`, `.next/`, `__pycache__/`, `.git/`, `dist/`, `build/`, `.dart_tool/` are never read for detection and never touched.
4. **Subproject internals are out of scope.** `.env.example`, `requirements.txt`, `package.json`, source files inside subprojects are READ for detection only. They are NEVER moved, renamed, modified, or deleted. The skill operates exclusively on workspace-root artifacts (`CLAUDE.md`, `AGENTS.md`, `01-TOOLS/`, `02-DOCS/`, and `XX-*` legacy folders at the root level).

## Red flags — abort and re-plan

If any of these occur, stop and report:

- A `git status` on any subproject shows uncommitted changes the user didn't acknowledge.
- The AUDIT shows zero detected tools AND zero legacy folders AND `CLAUDE.md`/`AGENTS.md` already exist → there's nothing for the skill to do. Tell the user.
- The user types anything ambiguous after AUDIT → do not infer consent.
- Migration verification (step 5 of APPLY) shows file count mismatch → abort, don't delete anything.
- The catalog has no entry for a provider obviously present in code → tell the user, suggest adding an entry to `references/providers.yaml` (that file, never `SKILL.md`, is where providers are added), don't fake one.

This skill is fully self-contained. No external sub-skill required.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

