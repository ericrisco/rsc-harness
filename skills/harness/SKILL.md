---
name: harness
description: "Use when you want to control, govern or maintain the harness of a workspace — software OR a non-code base (a company, an ops desk, a personal knowledge vault). The harness is the CONTROL PLANE: the `01-TOOLS/` operational tooling layer + the `02-DOCS/` Karpathy chaos→knowledge engine + the root Knowledge map. Triggers: 'control the harness', 'gestiona el arnés', 'manage 01-TOOLS and 02-DOCS', 'audit my workspace', 'audita mi proyecto', 'procesa el inbox', 'sal a pasear', migrating numbered `XX-*` folders into the canonical structure, detecting external provider integrations (Stripe, Mailjet, Hetzner, Firebase, OAuth, Postgres…) and scaffolding connection-ready tools, generating root `CLAUDE.md`/`AGENTS.md`, or consolidating scattered docs into a living wiki. `init` is the bootstrap front door; THIS skill is the ongoing control. Brownfield-first; greenfield is the degenerate case."
tags: [harness, company, ops, docs, wiki, connect, tools, knowledge]
recommends: [init]
profiles: [minimal, core, full]
---

# Harness — the workspace control plane

The **harness** is the control plane of a workspace. A workspace need not be code: it can be a company, an ops desk, a legal archive, a personal knowledge vault. Whatever it is, the harness is the durable apparatus that keeps it operable and legible, made of three parts:

- **`01-TOOLS/<PROVIDER>/`** — the operational tooling layer. One folder per external provider, co-locating credentials (`.env`) with the scripts that consume them. Each tool ships a working `test_connection` against the real API.
- **`02-DOCS/`** — the **Karpathy chaos→knowledge engine**: a domain-agnostic LLM wiki (`inbox/` + `raw/` + `raw/worklog/` + `wiki/` + `wiki/index.md` + `wiki/log.md` + `wiki/gaps.md` + `wiki/scores.json` + the `.base` views), fully embedded in this skill. It feeds from **two on-ramps**: (1) the user drops **any raw file in any format** (PDF, image, CSV, JSON, txt, html…) into `inbox/`, and an **Auto-Ingest Sweep** ("the agent goes for a walk") extracts, classifies, cross-links, and compiles it — and goes further, **discovering un-ingested documents anywhere in the workspace** (a stray `/transcripts`, `/facturas`…), bounded by `.rscignore` and de-duplicated by the `wiki/.ingested.json` ledger, fired automatically at SessionStart (when the inbox has material) and by the daily cron. Ingest keeps the repo clean: a loose file it ingests at the workspace root (or anything in `inbox/`) is **moved into `raw/`** (relocated, never deleted — a dropped PDF ends up in `raw/`, not at the root), while files inside a user-maintained folder are copied and consolidation is proposed; removing a redundant folder needs explicit consent; (2) a **Worklog Sweep** captures **what we do** — every meaningful session of work is itself a `raw` source (`raw/worklog/`) compiled into the wiki, fired by a `PreCompact`/`SessionEnd` hook, by an explicit milestone (a commit), or by the daily curation automation (`references/daily-curation-automation.md`). The `wiki/` is a **100%-OKF-v0.1 bundle** (Google's [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)) AND an **Obsidian-native** vault at the same time — standard markdown links, OKF-standard YAML frontmatter (Properties), readable filenames, and `.base` views give a real graph + live tables — structure, **not vector DB / embeddings / RAG**. The agent writes it; the human reads it in Obsidian. See `references/wiki-protocol.md` for the protocol, `references/ingest-formats.md` for the multiformat Fetch, `references/wiki-worklog-template.md` for the work capture, and `references/obsidian-scaffolding.md` for the vault scaffolding. Topics are inferred from content (`finanzas/`, `legal/`, `crm/`…), never hardcoded. The wiki **self-improves continuously**: every Ingest, Sweep and Query triggers a Maintenance Pass (deterministic lint, score recomputation, gap detection, Related/See-Also sweep), and every N interactions a Micro-Improve runs. Deep Improve runs on explicit request or via the scheduled daily curation. No external skill needed.
- **The Knowledge map** — the `## Knowledge map` section of the root `CLAUDE.md` that indexes the wiki (including the `harness/` topic) and is read by every other skill before it works in its area.

`harness` is the **protagonist concept**. `init` is the bootstrap front door — it gauges the user, drafts the profile, and hands off the first scaffold. THIS skill (`harness`) is the **ongoing control**: it audits, migrates, scaffolds, sweeps the inbox, and keeps the wiki, the tooling and the Knowledge map honest over the life of the workspace. It also generates root `CLAUDE.md` and `AGENTS.md`, and migrates legacy `XX-*` numbered folders into the canonical layout.

## Core behavior of the whole harness — non-technical-first + accompaniment dial

This is the behavior the **entire harness honors** and that every other skill reads back. It governs how the agent talks, how many questions it asks, and how it decides things — for every interaction, not just the first.

### 1. Always start assuming NON-TECHNICAL

The system **always starts assuming the user is non-technical.** The **very first question on first contact** gauges technical level, framed kindly — for example:

> "¿Te manejas con código y términos técnicos, o prefieres que te lo explique todo en cristiano?"

Default to **non-technical framing** (plain language, no jargon, analogies over internals) until the user tells you otherwise. Never assume fluency.

### 2. Immediately ask the accompaniment / explanation level

Right after the technical-level question, ask the desired **accompaniment level**, describing each option clearly so the user can choose. It is a dial:

- **L0 "Modo cavernícola"** — mínimas palabras. Hazlo y ya, casi sin explicar.
- **L1 "Breve"** — una línea de *por qué* en cada paso.
- **L2 "Explica decisiones"** — justifica cada decisión relevante al avanzar.
- **L3 "Acompañamiento total"** — explica TODO, hace muchas preguntas para contextualizar cada cosa, razona cada decisión. Ideal para no-técnicos.

### 3. Persist the profile + adapt every skill to it

Persist the technical level, the accompaniment level, and **all ongoing analysis of the user** (goals, context, constraints, decisions taken) into `02-DOCS`:

- `02-DOCS/wiki/harness/user-profile.md` — technical level, accompaniment level, goals, context, constraints (the living portrait of the user).
- `02-DOCS/wiki/harness/decisions.md` — an **append-only** log of every significant decision taken, with date, the requirements gathered, the 3 options presented, the choice, and the why.

Both files are referenced from the root `CLAUDE.md` `## Knowledge map` under the `harness/` topic. **Every skill READS `user-profile.md`** at the start of its work and **ADAPTS its verbosity and how many questions it asks** to the technical + accompaniment level found there. L0 means terse and almost silent; L3 means explain everything and ask a lot. When the level is unknown (no profile yet), default to non-technical + ask the two gauging questions before proceeding.

`harness` itself MUST: (a) READ `02-DOCS/wiki/harness/user-profile.md` and adapt its own verbosity/questioning to the technical + accompaniment level; (b) LOG every significant decision it takes to `02-DOCS/wiki/harness/decisions.md` (append-only); (c) use the "siempre 3 opciones" pattern below for any significant decision.

For long SDD work, the harness also respects the SDD session-summary convention:
when context is about to compact, pause, or hand off, write
`02-DOCS/wiki/sdd/sessions/<date>-<slug>.md` with active artifacts, current
phase, last verdict, next steps, risks, commands and skill_resolution. This is
not a replacement for the wiki; it is the recovery note that lets the next
agent resume without trusting chat history.

**Opt-out marker.** When a workspace has no profile yet, a freshly-installed session auto-starts `init` (via the `suggest` Onboarding gate and claude's SessionStart hook). A `.rsc/.no-harness` file is the explicit opt-out: present → never auto-start onboarding in this repo, even without a profile. `harness` treats it as canonical and never overwrites or deletes it.

### 4. Decision pattern — "siempre 3 opciones"

For **any significant decision** (deploy target, database, framework, hosting, tooling…):

1. **FIRST gather the relevant requirements by asking the user.** For a deploy decision, that means: expected number of users, concurrent users, budget, data region / residency, the team's ops comfort, scaling needs. Don't present options before you understand the constraints. (At L3, ask all of them, one kind question at a time; at L0, ask only the few that actually change the answer.)
2. **THEN present EXACTLY 3 options** with honest trade-offs and a **clear recommendation matched to their answers AND their accompaniment level.** Explain *why* each one, in language matched to the user's technical level.

Canonical deploy example:

1. **Hetzner VPS + Coolify** — barato, control total, self-managed (tú llevas el mantenimiento).
2. **Vercel** — zero-ops, gestionado, escala solo; caro a escala.
3. **Una tercera según el caso** — Fly.io / Railway / cloud gestionado, elegida por las respuestas del usuario.

`harness` decides whether a decision is in scope or belongs elsewhere: it applies the pattern itself for harness-level choices, but **defers concrete deploy specifics to `deployment`** (which owns the deploy mechanics). In every case the requirements-first → 3-options → recommendation shape, and the decisions.md log entry, are the same.

## Core principle

**Detection with interactive confirmation. Never speculative tools. Never destructive without explicit consent.**

The skill proposes, the user confirms, the skill executes. Every destructive operation (deleting a legacy folder, merging into an existing `CLAUDE.md`) requires explicit consent quoted back from the user, not inferred.

## When to use

- A workspace has grown organically and needs the canonical `01-TOOLS` / `02-DOCS` structure.
- Old numbered folders (`00-TOOLS`, `03-NOTES`, `04-LEGACY`…) exist and need to be consolidated.
- A new project is being kicked off and needs the harness from day one.
- Provider integrations exist in code but there's no operational tooling for them.

**Do NOT use when:**
- The user only wants to add a single tool — they can `cp -r 01-TOOLS/_TEMPLATE 01-TOOLS/<X>` manually.
- The user wants to refactor runtime code — this skill is operational tooling only, never runtime.

## Architecture

```
harness/
├── SKILL.md                          ← this file (the protocol)
├── references/
│   ├── providers.yaml                ← detector catalog with full file bodies per provider
│   ├── claude-md-template.md         ← root CLAUDE.md template
│   ├── agents-md-template.md         ← root AGENTS.md template
│   ├── tools-readme-template.md      ← 01-TOOLS/README.md catalog template
│   ├── audit-report-template.md      ← exact format of the audit report shown to user
│   ├── wiki-protocol.md              ← embedded wiki protocol + Inbox/Worklog Sweep + Continuous Improvement
│   ├── ingest-formats.md             ← multiformat Fetch (PDF, image, CSV, JSON, html…)
│   ├── inbox-readme-template.md      ← the inbox/README.md drop-zone contract
│   ├── wiki-raw-template.md          ← format for raw/<topic>/*.md
│   ├── wiki-worklog-template.md      ← format for raw/worklog/*.md (work-driven capture)
│   ├── wiki-article-template.md     ← format for wiki/<topic>/*.md (OKF frontmatter + markdown links)
│   ├── wiki-index-template.md       ← format for wiki/index.md (machine catalog; .base = human nav)
│   ├── obsidian-scaffolding.md      ← .base views, .gitignore, attachments, .obsidian config
│   ├── daily-curation-automation.md ← portable scheduled compounding pass (the third trigger)
│   ├── wiki-archive-template.md     ← format for archived query answers
│   └── wiki-gaps-template.md        ← format for wiki/gaps.md (Knowledge Gaps log)
├── assets/
│   └── _TEMPLATE/                    ← per-tool boilerplate (cp -r seed)
└── examples/
    └── audit-example.md              ← walked-through audit on a synthetic project
```

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

1. **A compact text summary in the conversation** — 1–3 sentences per section, the full destructive-ops list, the consent prompt. This keeps the terminal flow fast.
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
   - Same logic for `AGENTS.md`.
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
   - For each AMBIGUOUS file: leave in place. Record in the verification report.
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
   - Use the templates in `references/wiki-*.md` verbatim. Do NOT invent a different format.

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

## Iron rules (non-negotiable)

These rules cut across every phase. Violating any one of them aborts the run.

1. **Audit before action.** Nothing is written before the AUDIT is rendered and CONSENT is given.
2. **Explicit consent only.** Silence, ambiguity, "ok" all mean NO. Only the exact-form strings count as yes.
3. **No `.env` real, ever.** The skill writes `.env.example` only. Real credentials are the user's responsibility.
4. **No speculative tools.** A tool is created if and only if the detector found evidence in the user's code. No "we should probably have a Sentry tool too".
5. **No overwrite without merge.** Existing `CLAUDE.md`, `AGENTS.md`, or tool files are merged additively. The skill never deletes user content.
6. **Destructive ops require a second consent quoting the path.** "Yes, delete `00-TOOLS`" is different from a generic "yes, proceed".
7. **Ambiguous files preserve the legacy folder.** Don't force-classify. If you can't classify with confidence, leave it.
8. **Idempotent.** Running the skill twice produces no extra side effects. Re-scanning a project already canonical detects "nothing to do".
9. **Out-of-scope dirs are invisible.** `node_modules/`, `.venv/`, `.next/`, `__pycache__/`, `.git/`, `dist/`, `build/`, `.dart_tool/` are never read for detection and never touched.
10. **`references/wiki-protocol.md` is the source of truth for `02-DOCS`.** Do not invent a different wiki structure.
11. **Subproject internals are out of scope.** `.env.example`, `requirements.txt`, `package.json`, source files inside subprojects are READ for detection only. They are NEVER moved, renamed, modified, or deleted. The skill operates exclusively on workspace-root artifacts (`CLAUDE.md`, `AGENTS.md`, `01-TOOLS/`, `02-DOCS/`, and `XX-*` legacy folders at the root level).

## Rationalizations — STOP

These thoughts mean the skill is about to violate its own rules. Recognize them and abort:

| Excuse | Reality |
|--------|---------|
| "The user clearly meant yes when they said 'ok'" | No. They didn't say the exact string. Re-prompt. |
| "Just this one tool is obviously needed even without evidence" | No. Catalog says no detector hit = no tool. |
| "I'll write the `.env` with placeholder values — it's not real credentials" | No. `.env` is reserved for real credentials. Use `.env.example` only. |
| "The existing `CLAUDE.md` is clearly outdated, I'll rewrite it" | No. Merge additively. The user owns their `CLAUDE.md`. |
| "These files in `00-TOOLS/RANDOM/` look like docs to me, I'll move them" | If the classification confidence isn't high, mark AMBIGUOUS and leave in place. |
| "I'll delete the legacy folder since it's empty after migration" | Only after the second exact-string consent. Empty + no consent = preserve. |
| "Let me also reorganize the subproject internals while I'm here" | No. The skill operates on workspace root only. Subproject internals are out of scope. |
| "The wiki structure could be a bit different here" | No. Follow `references/wiki-protocol.md` verbatim. |
| "The `01-TOOLS/_TEMPLATE/` should be flavored with the user's first detected tool" | No. `_TEMPLATE/` is generic boilerplate with placeholders. Detected tools come from the catalog, not the template. |

## Red flags — abort and re-plan

If any of these occur, stop and report:

- A `git status` on any subproject shows uncommitted changes the user didn't acknowledge.
- The AUDIT shows zero detected tools AND zero legacy folders AND `CLAUDE.md`/`AGENTS.md` already exist → there's nothing for the skill to do. Tell the user.
- The user types anything ambiguous after AUDIT → do not infer consent.
- Migration verification (step 5 of APPLY) shows file count mismatch → abort, don't delete anything.
- The catalog has no entry for a provider obviously present in code → tell the user, suggest adding a catalog entry, don't fake one.

## References

- `references/providers.yaml` — full provider catalog with detectors and per-file content. Edit this to add a new provider; don't edit `SKILL.md`.
- `references/claude-md-template.md` — root `CLAUDE.md` template.
- `references/agents-md-template.md` — root `AGENTS.md` template.
- `references/tools-readme-template.md` — `01-TOOLS/README.md` catalog template.
- `references/audit-report-template.md` — text summary format for the in-conversation audit summary.
- `references/audit-report-template.html` — HTML format for the full per-run audit artifact written to `02-DOCS/audits/`.
- `references/wiki-protocol.md` — embedded protocol for the `02-DOCS/` chaos→knowledge layer (initialization, **Inbox Sweep**, **Worklog Sweep**, ingest, query, lint, **Continuous Improvement**: Maintenance Pass, Micro-Improve, Deep Improve; Obsidian-native conventions).
- `references/ingest-formats.md` — multiformat Fetch: how any input (PDF, image, CSV/Excel, JSON/API, html, docx, email, unknown binary) becomes `raw/` markdown with the original preserved in `_originals/`.
- `references/inbox-readme-template.md` — the `inbox/README.md` drop-zone contract shown to the user.
- `references/wiki-raw-template.md` — format for `02-DOCS/raw/<topic>/*.md`.
- `references/wiki-worklog-template.md` — format for `02-DOCS/raw/worklog/*.md` (the work-driven capture; the session as a raw source).
- `references/wiki-article-template.md` — format for `02-DOCS/wiki/<topic>/*.md` (OKF v0.1 frontmatter + relative markdown links + `## Related`).
- `references/wiki-index-template.md` — format for `02-DOCS/wiki/index.md` (machine catalog; the `.base` views are the human navigation).
- `references/obsidian-scaffolding.md` — the vault scaffolding: `.base` views, `.gitignore`, `attachments/`, `.obsidian` config (no vector DB / RAG).
- `references/daily-curation-automation.md` — portable scheduled compounding pass; on Claude Code wired via the `schedule` skill.
- `references/wiki-archive-template.html` — HTML format for archived query answers (point-in-time, never edited).
- `references/wiki-dashboard-template.html` — HTML format for the live wiki dashboard, regenerated by Maintenance Pass.
- `references/wiki-deep-improve-report-template.html` — HTML format for Deep Improve run reports.
- `references/wiki-gaps-template.md` — format for `02-DOCS/wiki/gaps.md` (Knowledge Gaps log).
- `assets/_TEMPLATE/` — the boilerplate copied into every new tool.

This skill is fully self-contained. No external sub-skill required.

## Orientación (siempre)

Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ✅ qué hiciste · 🧭 por qué · ➡️ siguiente, terminando en pregunta), calibrado al dial de `02-DOCS/wiki/harness/user-profile.md`. **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)

