#!/usr/bin/env node
// rsc SessionStart payload (claude). Wired by targets/claude.js as `node ...` so
// it runs on every platform including Windows (no bash dependency).
//   argv[2] = absolute path to suggest's SKILL.md   argv[3] = absolute project root
// Always emits suggest's always-on body; appends an onboarding banner when the
// workspace has no harness profile yet, and an auto-ingest nudge when there is
// un-ingested material waiting in the inbox.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STALE_AUDIT_DAYS = 14; // periodic skill-audit cadence (kept in sync with scripts/audit.js)

const suggestMd = process.argv[2];
const root = process.argv[3] || process.cwd();

const has = (...p) => existsSync(join(root, ...p));

// Is a Context7 MCP server configured for this project (.mcp.json → mcpServers.context7)?
function hasContext7() {
  try {
    const mcp = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'));
    return Boolean(mcp.mcpServers && mcp.mcpServers.context7);
  } catch { return false; }
}

// Has a skill audit run within the cadence? Missing stamp → never audited → due.
function auditDue() {
  try {
    const { lastRun } = JSON.parse(readFileSync(join(root, '.rsc', 'audit.json'), 'utf8'));
    return (Date.now() - new Date(lastRun).getTime()) / 86400000 >= STALE_AUDIT_DAYS;
  } catch { return true; }
}

try { process.stdout.write(readFileSync(suggestMd, 'utf8')); } catch { /* missing → emit nothing */ }

const profile = join(root, '02-DOCS', 'wiki', 'harness', 'user-profile.md');
const optout = join(root, '.rsc', '.no-harness');
const profileExists = existsSync(profile);
if (!existsSync(profile) && !existsSync(optout)) {
  process.stdout.write(`
===== rsc onboarding =====
Fresh setup: 02-DOCS/wiki/harness/user-profile.md is missing.
ACTION: invoke \`init\` now (first contact: technical level + accompaniment dial) before the task.
If the user does not want a harness here: create .rsc/.no-harness
==========================
`);
}

// Auto-Ingest nudge: when a harness wiki exists and the inbox holds a real file
// (anything other than README.md / dotfiles / the _processed archive), tell the
// agent to run the Auto-Ingest Sweep. The hook only reminds; the agent does the
// scan + ingest. Cheap signal here; the thorough workspace scan lives in the sweep.
const inbox = join(root, '02-DOCS', 'inbox');
if (existsSync(join(root, '02-DOCS', 'wiki')) && existsSync(inbox)) {
  let pending = false;
  try {
    pending = readdirSync(inbox, { withFileTypes: true })
      .some((e) => e.isFile() && e.name !== 'README.md' && !e.name.startsWith('.'));
  } catch { /* unreadable → no nudge */ }
  if (pending) {
    process.stdout.write(`
===== rsc auto-ingest =====
Un-ingested material is waiting in 02-DOCS/inbox/.
ACTION: run the Auto-Ingest Sweep now — ingest inbox/, then scan the workspace
(minus .rscignore) for un-ingested documents, recording them in wiki/.ingested.json.
Originals are copied, never moved; deleting an emptied folder needs explicit consent.
===========================
`);
  }
}

// Git required: version control is the substrate the SDD chain + ship guard assume.
// If the project is not under git, push for it once per session. Persist the user's
// "no" as .rsc/.no-git so the decision lives in a file and we stop re-asking.
if (!has('.git') && !has('.rsc', '.no-git')) {
  process.stdout.write(`
===== rsc git required =====
This project is NOT under version control (no .git/).
The SDD flow and the ship guard assume git. ACTION: offer to run \`git init\` now
(recommended). If the user declines, create .rsc/.no-git so I stop asking.
============================
`);
}

// Context7 MCP: only for active rsc projects (a profile exists). If the live-docs MCP
// isn't wired, nudge to add it once. Opt out per project with .rsc/.no-context7.
if (profileExists && !hasContext7() && !has('.rsc', '.no-context7')) {
  process.stdout.write(`
===== rsc context7 MCP =====
Context7 (live, version-correct library docs) is not configured for this project.
ACTION: install it once — \`claude mcp add --transport http context7 https://mcp.context7.com/mcp\`
then reload the session. If you don't want it here: create .rsc/.no-context7.
============================
`);
}

// Periodic skill audit: for active rsc projects, nudge to re-audit when the last run
// is stale (or never ran). Running \`rsc audit\` stamps .rsc/audit.json and silences
// this for the cadence. Opt out with .rsc/.no-audit.
if (profileExists && auditDue() && !has('.rsc', '.no-audit')) {
  process.stdout.write(`
===== rsc skill audit =====
A skill audit is due (runs at most every ${STALE_AUDIT_DAYS} days). It flags overlapping
skills and skills with no footprint in this project.
ACTION: run \`npx @ericrisco/rsc audit\`. Opt out with .rsc/.no-audit.
===========================
`);
}

// CLAUDE.md hygiene: the root CLAUDE.md is read on EVERY turn, so an overgrown one (usually
// the Knowledge map accreting a row per wiki article) is a permanent context tax that rots
// adherence. When it passes the ~200-line 2026 budget, nudge to offload the index into
// 02-DOCS/wiki/index.md and keep CLAUDE.md a short pointer (the `harness` skill owns the move;
// it's a relocation, not a delete). Opt out with .rsc/.no-claudemd-check.
const CLAUDEMD_MAX_LINES = 200;
if (!has('.rsc', '.no-claudemd-check')) {
  try {
    const lines = readFileSync(join(root, 'CLAUDE.md'), 'utf8').split('\n').length;
    if (lines > CLAUDEMD_MAX_LINES) {
      process.stdout.write(`
===== rsc CLAUDE.md hygiene =====
CLAUDE.md is ${lines} lines — over the ~${CLAUDEMD_MAX_LINES}-line budget (it's read every turn, so each line costs context).
ACTION: offload the Knowledge map / overgrown sections into 02-DOCS/wiki/index.md and leave a short
pointer in CLAUDE.md (no info lost — it's a move). The \`harness\` skill owns the procedure.
Opt out with .rsc/.no-claudemd-check.
=================================
`);
    }
  } catch { /* no CLAUDE.md → nothing to check */ }
}

// Update check: compare the installed version (.rsc/.version, written at install)
// against the latest published on npm, and nudge the agent to offer an update.
// Fail-silent (offline / missing baseline / parse error → nothing). Disable with
// RSC_NO_UPDATE_CHECK=1. RSC_LATEST overrides the npm lookup (tests / mirrors).
function isNewer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

if (!process.env.RSC_NO_UPDATE_CHECK) {
  try {
    const installed = readFileSync(join(root, '.rsc', '.version'), 'utf8').trim();
    let latest = process.env.RSC_LATEST;
    if (!latest) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest', { signal: ctrl.signal });
      clearTimeout(timer);
      latest = (await res.json()).version;
    }
    if (installed && latest && isNewer(latest, installed)) {
      process.stdout.write(`
===== rsc update available =====
rsc ${latest} is out — you have ${installed}.
ACTION: tell the user a new version is available and, if they say yes, run:
  npx @ericrisco/rsc@latest
(That reinstalls and refreshes the skill content to the latest.)
================================
`);
    }
  } catch { /* offline / no baseline / parse error → stay silent */ }
}
