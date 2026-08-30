#!/usr/bin/env node
import { rmSync, existsSync, cpSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planInstall } from './install-plan.js';
import { targetPaths, writeSkill, wireHook, unwireHook, baseDir, TARGET_IDS } from '../targets/index.js';
import { targetHasAgents, writeAgents, removeAgents, agentPath, agentNames } from '../targets/agents.js';
import { readState, writeState } from './lib/state.js';
import { readManifest, writeManifest } from './lib/manifest-file.js';
import { createBackup } from './lib/backups.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

// `.rsc/.version` records the CLI version the shared bases (.rsc/skills/) were
// materialized at — the single, target-agnostic source of truth for "installed
// skills version" (read by the SessionStart update check too).
const versionFile = (cwd) => join(cwd, '.rsc', '.version');

// Per-skill base version. A single global `.rsc/.version` cannot represent a
// partially-refreshed base set, which broke multi-target sync: the first target's pass
// bumped `.rsc/.version`, so later targets saw "current" and skipped refreshing their
// exclusive skills' bases. Tracking the version each base was materialized at makes the
// refresh decision per skill, independent of target ordering. (Absent file → every base
// is treated as stale and refreshed once, which self-heals installs from before this.)
const baseVersionsFile = (cwd) => join(cwd, '.rsc', '.base-versions.json');
function readBaseVersions(cwd) {
  try { return JSON.parse(readFileSync(baseVersionsFile(cwd), 'utf8')); } catch { return {}; }
}
function writeBaseVersions(cwd, versions) {
  mkdirSync(dirname(baseVersionsFile(cwd)), { recursive: true });
  writeFileSync(baseVersionsFile(cwd), JSON.stringify(versions, null, 2) + '\n');
}

// Materialize the real skill files into the project-local base. Copied once and reused;
// when the recorded base version for THIS skill differs from the CLI version, the base is
// re-copied so a reinstall/sync actually updates content. Tracked per skill (see
// baseVersionsFile) so a multi-target sync refreshes every target's bases, not just the
// first target's. Skills are read-only catalog (user customization lives in 02-DOCS), so
// overwriting on a version change is safe. Mutates `baseVersions` with the new mark.
function ensureBase(id, cwd, baseVersions) {
  const dest = baseDir(id, cwd);
  const stale = baseVersions[id] !== CLI_VERSION;
  if (stale && existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(ROOT, 'skills', id), dest, { recursive: true });
  }
  baseVersions[id] = CLI_VERSION;
  return dest;
}

// Every file wireHook() materializes, so they are covered by the pre-write backup and
// reported by a --dry-run. Keep in sync with targets/claude.js wireHook(): a file it
// writes but this omits is silently absent from the snapshot, so `rsc restore` cannot
// bring it back.
function generatedHookFiles({ target, cwd }) {
  if (target !== 'claude') return [];
  return [
    join(cwd, '.rsc', 'session-start.mjs'),
    join(cwd, '.rsc', 'worklog-checkpoint.mjs'),
    join(cwd, '.rsc', 'ship-guard.mjs'),
    join(cwd, '.rsc', 'danger-guard.mjs'),
    join(cwd, '.rsc', 'gitmoji-guard.mjs'),
    join(cwd, '.rsc', 'userprompt-gate.mjs'),
    join(cwd, '.rsc', 'hook-once.mjs'),
    join(cwd, '.rsc', 'sello.mjs'),
  ];
}

function managedPathsForInstall({ skillIds, target, home, cwd }) {
  const paths = targetPaths(target, home, cwd);
  const plan = planInstall({ skillIds, target, home, cwd });
  const out = [paths.stateFile, versionFile(cwd), baseVersionsFile(cwd)];
  if (targetHasAgents(target)) out.push(...agentNames().map((n) => agentPath(target, cwd, n)), join(cwd, '.rsc', 'developer.json'));
  for (const step of plan) {
    if (step.kind === 'skill') {
      out.push(step.to, baseDir(step.id, cwd));
    } else if (step.kind === 'hook') {
      out.push(step.to, ...generatedHookFiles({ target, cwd }));
    }
  }
  return [...new Set(out)];
}

// The opt-outs a team disarmed and the developer tier live as marker files under .rsc/,
// which is machine-local and therefore lost on every clone: a team that disarmed the
// gitmoji guard found it armed again on the next checkout, with nobody having decided
// that. They are decisions, so they belong in the committed declaration.
function localDecisions(cwd) {
  const dir = join(cwd, '.rsc');
  let optOuts = [];
  try {
    optOuts = readdirSync(dir).filter((f) => f.startsWith('.no-')).map((f) => f.slice(4)).sort();
  } catch { /* no .rsc yet */ }
  let tier = null;
  try { tier = JSON.parse(readFileSync(join(dir, 'developer.json'), 'utf8')).tier ?? null; } catch { /* unset */ }
  return { optOuts, tier };
}

// Record the decision, merging so a second assistant never erases the first: installing
// into codex on a machine that already had claude is adding, not replacing. Union, sorted
// where order carries no meaning, so the file stays diffable and a merge conflict stays
// readable.
export function recordInManifest({ cwd, target, skillIds, catalogVersion = CLI_VERSION }) {
  const prev = readManifest(cwd) || { targets: [], skills: [], ownSkills: [], optOuts: [] };
  const { optOuts, tier } = localDecisions(cwd);
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
  return writeManifest(cwd, {
    version: 1,
    targets: union(prev.targets, [target]),
    skills: union(prev.skills, skillIds),
    ownSkills: prev.ownSkills || [],
    catalogVersion,
    tier: tier ?? prev.tier ?? null,
    optOuts: optOuts.length ? optOuts : (prev.optOuts || []),
  });
}

export async function applyInstall({ skillIds, target, home, cwd = process.cwd(), operation = 'install', dryRun = false }) {
  const paths = targetPaths(target, home, cwd);
  const plan = planInstall({ skillIds, target, home, cwd });
  const managedPaths = managedPathsForInstall({ skillIds, target, home, cwd });
  if (dryRun) return { dryRun: true, skills: skillIds, paths: managedPaths };
  const state = readState(paths.stateFile);
  const backup = createBackup({ cwd, operation, target, paths: managedPaths, cliVersion: CLI_VERSION });
  // Decide base refresh per skill (see baseVersionsFile): a base is re-materialized when
  // its recorded version differs from the CLI version. Robust to multi-target installs/
  // syncs — a single global marker would be bumped by the first target and make later
  // targets skip refreshing their exclusive skills' bases.
  const baseVersions = readBaseVersions(cwd);
  for (const step of plan) {
    if (step.kind === 'skill') {
      const base = ensureBase(step.id, cwd, baseVersions);
      const files = await writeSkill(target, step.id, base, step.to);
      state.skills[step.id] = { files, base };
    } else if (step.kind === 'hook') {
      await wireHook(target, paths, join(ensureBase('suggest', cwd, baseVersions), 'SKILL.md'));
    }
  }
  writeBaseVersions(cwd, baseVersions);
  // Install the catalog's subagents for targets that support file-based agents (Claude
  // Code, Cursor, OpenCode, Gemini, Copilot, Junie, Kiro, Codex): `developer` plus the three
  // adversarial refuter lenses `review` dispatches at tier 2. They run at the balanced tier
  // by default (never light/Haiku); the tier lives in .rsc/developer.json, set by `init` at
  // onboarding and honored on every (re)install/sync.
  //
  // The recorded names come from what was WRITTEN, not from a hardcoded list: a state entry
  // naming an agent whose file never landed answers "you have it" for something absent.
  if (targetHasAgents(target)) {
    const written = writeAgents(target, cwd);
    state.agents = written.map((f) => basename(f).split('.')[0]);
  }
  state.version = CLI_VERSION;
  writeState(paths.stateFile, state);
  mkdirSync(dirname(versionFile(cwd)), { recursive: true });
  writeFileSync(versionFile(cwd), CLI_VERSION + '\n');
  recordInManifest({ cwd, target, skillIds });
  ignoreLocalState(cwd);
  return { ...state, backup };
}

// `.rsc/` holds local machine state — hook scripts, install markers, the sello's
// seals, the automation-gap log. None of it belongs in a user's repository, and the
// gap log in particular is prose about what happened in their project: a routine
// `git add -A` would publish it. Nothing used to keep that out, so add the entry.
//
// Additive and idempotent by construction: append one line to an existing
// .gitignore, never rewrite or reorder it, and never create the file in a directory
// that is not a git repository.
export function ignoreLocalState(cwd = process.cwd()) {
  if (!existsSync(join(cwd, '.git'))) return null;
  const gi = join(cwd, '.gitignore');
  let text = '';
  try { text = existsSync(gi) ? readFileSync(gi, 'utf8') : ''; } catch { return null; }
  const already = text.split('\n').some((l) => {
    const s = l.trim().replace(/\/$/, '');
    return s === '.rsc' || s === '/.rsc';
  });
  if (already) return null;
  const prefix = text === '' ? '' : (text.endsWith('\n') ? '' : '\n');
  try {
    appendFileSync(gi, `${prefix}\n# rsc local state (hooks, seals, logs) — machine-local, never committed\n.rsc/\n`);
    return gi;
  } catch { return null; }
}

export function listInstalled({ target, home, cwd = process.cwd() }) {
  const paths = targetPaths(target, home, cwd);
  return Object.keys(readState(paths.stateFile).skills);
}

export async function uninstall({ skillIds, target, home, cwd = process.cwd(), dryRun }) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const removed = [];
  const managedPaths = [paths.stateFile];
  for (const id of skillIds) {
    const entry = state.skills[id];
    if (!entry) continue;
    for (const f of entry.files) {
      managedPaths.push(f);
      removed.push(f);
    }
  }
  if (!removed.length) return removed;
  if (dryRun) return removed;
  createBackup({ cwd, operation: 'uninstall', target, paths: managedPaths, cliVersion: CLI_VERSION });
  for (const id of skillIds) {
    const entry = state.skills[id];
    if (!entry) continue;
    for (const f of entry.files) {
      if (existsSync(f)) rmSync(f, { recursive: true, force: true });
    }
    delete state.skills[id];
  }
  writeState(paths.stateFile, state);
  return removed;
}

export async function syncInstalled({ target, home, cwd = process.cwd(), dryRun = false }) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const ids = Object.keys(state.skills || {});
  if (!ids.length) return dryRun ? { dryRun: true, synced: [], paths: [] } : { synced: [], backup: null };
  if (dryRun) {
    return {
      dryRun: true,
      synced: ids,
      paths: managedPathsForInstall({ skillIds: ids, target, home, cwd }),
    };
  }
  const nextState = await applyInstall({ skillIds: ids, target, home, cwd, operation: 'sync' });
  return { synced: ids, backup: nextState.backup };
}

// Remove EVERYTHING rsc put in this project: installed skills across all targets,
// the wired hooks (settings.json entries / AGENTS-blocks / cursor rules), and the
// shared `.rsc/` (base + hook scripts + version marker). `02-DOCS/` is the user's
// own knowledge — kept unless `withDocs` is set. Returns the paths touched.
// Note: backups live under `.rsc/backups/`, which this removes — so purge does not
// snapshot (a pre-purge backup would delete itself). It is the deliberate escape hatch.
export async function purge({ home, cwd = process.cwd(), withDocs = false, dryRun = false } = {}) {
  const removed = [];
  const drop = (p, recursive = false) => {
    if (!existsSync(p)) return;
    removed.push(p);
    if (!dryRun) rmSync(p, { recursive, force: true });
  };
  for (const target of TARGET_IDS) {
    const paths = targetPaths(target, home, cwd);
    if (existsSync(paths.stateFile)) {
      const state = readState(paths.stateFile);
      for (const id of Object.keys(state.skills || {})) {
        for (const f of state.skills[id].files || []) drop(f, true);
      }
      drop(paths.stateFile);
    }
    // unwireHook mutates files, so only run it for real (dry runs skip it).
    if (!dryRun) removed.push(...unwireHook(target, paths));
    // Remove the subagents this catalog installed — and only those. An uninstaller that takes
    // an agent the user wrote by hand is worse than one that leaves residue.
    for (const n of agentNames()) {
      const agentFile = agentPath(target, cwd, n);
      if (agentFile) drop(agentFile);
    }
  }
  drop(join(cwd, '.rsc'), true);
  if (withDocs) drop(join(cwd, '02-DOCS'), true);
  return removed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  applyInstall({ skillIds: ids, target: 'claude' }).then(() => console.log('installed', ids.join(', ')));
}
