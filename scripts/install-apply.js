#!/usr/bin/env node
import { rmSync, existsSync, cpSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planInstall } from './install-plan.js';
import { targetPaths, writeSkill, wireHook, unwireHook, baseDir, TARGET_IDS } from '../targets/index.js';
import {
  targetHasAgents, reconcileAgents, agentPath, agentNames,
  resolveAgentNames, agentByName, readDeveloperTier,
} from '../targets/agents.js';
import { readState, writeState } from './lib/state.js';
import { readManifest, writeManifest } from './lib/manifest-file.js';
import { createBackup } from './lib/backups.js';
import {
  targetHasCommands, resolveCommands, reconcileCommands, commandPath,
} from '../targets/commands.js';
import {
  wireMemory, unwireMemory, memoryManagedPaths, memoryModeFor, memoryEnabledForProject, memoryArtifactsPresent,
} from '../targets/memory.js';

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
export function generatedHookFiles({ target, cwd, policy }) {
  if (target !== 'claude') return [];
  const lifecycle = [
    join(cwd, '.rsc', 'session-start.mjs'),
    join(cwd, '.rsc', 'worklog-checkpoint.mjs'),
    join(cwd, '.rsc', 'hook-once.mjs'),
    join(cwd, '.rsc', 'worktree-reaper.mjs'),
  ];
  if (policy?.codeHooks === false) return [...lifecycle, join(cwd, '.rsc', 'suggest-always-on.md')];
  return [...lifecycle,
    join(cwd, '.rsc', 'ship-guard.mjs'), join(cwd, '.rsc', 'danger-guard.mjs'),
    join(cwd, '.rsc', 'gitmoji-guard.mjs'), join(cwd, '.rsc', 'userprompt-gate.mjs'),
    join(cwd, '.rsc', 'sello.mjs')];
}

export function managedPathsForInstall({ skillIds, agentIds = [], target, home, cwd, policy }) {
  const paths = targetPaths(target, home, cwd);
  const plan = planInstall({ skillIds, target, home, cwd, hooks: policy?.alwaysOn !== false });
  const out = [paths.stateFile, versionFile(cwd), baseVersionsFile(cwd)];
  if (policy?.context7 === false) out.push(join(cwd, '.rsc', '.no-context7'));
  if (policy?.memory !== false) out.push(...memoryManagedPaths(target, cwd));
  if (targetHasAgents(target)) {
    const state = readState(paths.stateFile);
    const explicit = [...new Set([...(state.explicitAgents || readManifest(cwd)?.agents || []), ...agentIds])];
    const desired = policy?.agents || resolveAgentNames([...Object.keys(state.skills || {}), ...skillIds], explicit);
    out.push(...desired.map((n) => agentPath(target, cwd, n)));
  }
  if (targetHasCommands(target)) {
    const state = readState(paths.stateFile);
    const explicit = [...new Set([...(state.explicitAgents || readManifest(cwd)?.agents || []), ...agentIds])];
    const desiredAgents = policy?.agents || resolveAgentNames([...Object.keys(state.skills || {}), ...skillIds], explicit);
    const desiredCommands = resolveCommands({
      target,
      skills: policy ? skillIds : [...new Set([...Object.keys(state.skills || {}), ...skillIds])],
      agents: desiredAgents,
      memoryMode: memoryEnabledForProject(cwd) ? memoryModeFor(target) : 'disabled',
    });
    out.push(...desiredCommands.map((command) => commandPath(target, cwd, command.name)));
  }
  for (const step of plan) {
    if (step.kind === 'skill') {
      out.push(step.to, baseDir(step.id, cwd));
    } else if (step.kind === 'hook') {
      out.push(step.to, ...generatedHookFiles({ target, cwd, policy }));
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
export function recordInManifest({ cwd, target, skillIds, agentIds = [], catalogVersion = CLI_VERSION, dropTarget, onboarding }) {
  const prev = readManifest(cwd) || { targets: [], skills: [], agents: [], ownSkills: [], optOuts: [] };
  const { optOuts, tier } = localDecisions(cwd);
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();
  return writeManifest(cwd, {
    version: 1,
    // Union by default: installing into a second assistant is adding, not replacing.
    // `dropTarget` is the one exception — a MOVE, where leaving the old one declared would
    // have every clone rebuild a harness that was deliberately abandoned.
    targets: union(prev.targets, [target]).filter((t) => t !== dropTarget),
    skills: union(prev.skills, skillIds),
    agents: union(prev.agents, agentIds),
    ownSkills: prev.ownSkills || [],
    catalogVersion,
    tier: tier ?? prev.tier ?? null,
    optOuts: optOuts.length ? optOuts : (prev.optOuts || []),
    memory: prev.memory,
    onboarding: onboarding ?? prev.onboarding,
  });
}

export async function applyInstall({ skillIds = [], agentIds = [], target, home, cwd = process.cwd(), operation = 'install', dryRun = false, policy, onboarding }) {
  const paths = targetPaths(target, home, cwd);
  const plan = planInstall({ skillIds, target, home, cwd, hooks: policy?.alwaysOn !== false });
  const managedPaths = managedPathsForInstall({ skillIds, agentIds, target, home, cwd, policy });
  if (dryRun) return { dryRun: true, skills: skillIds, agents: agentIds, paths: managedPaths };
  const state = readState(paths.stateFile);
  const backup = createBackup({ cwd, operation, target, paths: managedPaths, cliVersion: CLI_VERSION });
  // Decide base refresh per skill (see baseVersionsFile): a base is re-materialized when
  // its recorded version differs from the CLI version. Robust to multi-target installs/
  // syncs — a single global marker would be bumped by the first target and make later
  // targets skip refreshing their exclusive skills' bases.
  const baseVersions = readBaseVersions(cwd);
  if (policy) {
    for (const id of Object.keys(state.skills || {})) {
      if (skillIds.includes(id)) continue;
      rmSync(paths.skillDir(id), { recursive: true, force: true });
      delete state.skills[id];
    }
  }
  for (const step of plan) {
    if (step.kind === 'skill') {
      const base = ensureBase(step.id, cwd, baseVersions);
      const files = await writeSkill(target, step.id, base, step.to);
      state.skills[step.id] = { files, base };
    } else if (step.kind === 'hook') {
      await wireHook(target, paths, join(ensureBase('suggest', cwd, baseVersions), 'SKILL.md'), policy);
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
  const inheritedExplicit = policy ? (state.explicitAgents || []) : (state.explicitAgents || readManifest(cwd)?.agents || []);
  const explicit = [...new Set([...inheritedExplicit, ...agentIds])].sort();
  const desiredAgents = policy?.agents
    ? [...new Set([...policy.agents, ...explicit])].sort()
    : policy?.baseAgents === false
      ? explicit
      : resolveAgentNames(Object.keys(state.skills || {}), explicit);
  const previousAgents = state.agents || [];
  if (targetHasAgents(target)) {
    const agentResult = reconcileAgents(target, cwd, readDeveloperTier(cwd), previousAgents, desiredAgents);
    state.agents = agentResult.names;
    state.agentCollisions = agentResult.collisions;
  } else {
    state.agents = [];
    state.agentCollisions = [];
  }
  state.explicitAgents = explicit;
  const memoryResult = policy?.memory === false
    ? { mode: 'disabled', reason: 'onboarding-policy', paths: unwireMemory(target, cwd) }
    : wireMemory(target, cwd);
  state.memory = { mode: memoryResult.mode, reason: memoryResult.reason, paths: memoryResult.paths };
  const context7OptOut = join(cwd, '.rsc', '.no-context7');
  if (policy?.context7 === false) {
    mkdirSync(dirname(context7OptOut), { recursive: true });
    writeFileSync(context7OptOut, 'Managed by the accepted onboarding plan: external MCP connections require separate consent.\n');
  }
  state.policy = policy ? {
    baseAgents: policy.baseAgents !== false,
    alwaysOn: policy.alwaysOn !== false,
    codeHooks: policy.codeHooks !== false,
    gitmojiGuard: policy.gitmojiGuard !== false,
    memory: policy.memory !== false,
    context7: policy.context7 === true,
  } : state.policy;
  const desiredCommands = resolveCommands({
    target,
    skills: Object.keys(state.skills || {}),
    agents: state.agents,
    memoryMode: state.memory?.mode || 'unsupported',
  });
  const commandResult = reconcileCommands(target, cwd, state.commands || [], desiredCommands);
  state.commands = commandResult.names;
  state.commandCollisions = commandResult.collisions;
  state.version = CLI_VERSION;
  writeState(paths.stateFile, state);
  mkdirSync(dirname(versionFile(cwd)), { recursive: true });
  writeFileSync(versionFile(cwd), CLI_VERSION + '\n');
  recordInManifest({ cwd, target, skillIds, agentIds, onboarding });
  ignoreLocalState(cwd, target);
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
export function ignoreLocalState(cwd = process.cwd(), target) {
  if (!existsSync(join(cwd, '.git'))) return null;
  const gi = join(cwd, '.gitignore');
  let text = '';
  try { text = existsSync(gi) ? readFileSync(gi, 'utf8') : ''; } catch { return null; }

  // `.rsc/` is machine state. The per-target skill entries are derived: symlinks here,
  // real copies on Windows, so committing either shape puts two incompatible forms of the
  // same thing into one repo.
  //
  // But `claude` writes into `.claude/skills/` and `cursor` into `.cursor/rules/`, which
  // are SHARED with the user — their own skills and rules live there too. Excluding the
  // whole directory would quietly stop versioning their work, which is the same sin this
  // release exists to fix: treating what is theirs as if it were ours. So shared
  // directories are excluded entry by entry, and only the entries rsc manages.
  const wanted = ['.rsc/'];
  if (target) {
    const paths = targetPaths(target, undefined, cwd);
    const rel = (abs) => relative(cwd, abs).split(sep).join('/');
    for (const id of Object.keys(readState(paths.stateFile).skills || {})) wanted.push(rel(paths.skillDir(id)));
    // The per-file ledger is derived AND platform-shaped (symlink here, real copy on
    // Windows), so committing it puts two incompatible inventories of one thing in one
    // repo. The declaration that does travel is .rsc.json, in the root.
    wanted.push(rel(paths.stateFile));
    // Subagents are catalog content, re-materialised by every install and sync.
    for (const name of readState(paths.stateFile).agents || []) {
      const file = agentPath(target, cwd, name);
      if (file) wanted.push(rel(file));
    }
    for (const name of readState(paths.stateFile).commands || []) {
      const file = commandPath(target, cwd, name);
      if (file) wanted.push(rel(file));
    }
  }
  // `.rsc`, `/.rsc` and `.rsc/` are the same rule to git. Normalising both ends is what
  // keeps this idempotent against a .gitignore a human wrote in their own spelling.
  const norm = (l) => l.trim().replace(/^\//, '').replace(/\/$/, '');
  const present = new Set(text.split('\n').map(norm));
  const add = wanted.filter((w) => !present.has(norm(w)));
  if (!add.length) return null;

  // Append only. Never rewrite, never reorder: the rest of that file is theirs.
  const prefix = text === '' ? '' : (text.endsWith('\n') ? '' : '\n');
  try {
    appendFileSync(gi, `${prefix}\n# rsc local state (hooks, seals, logs) and managed skill links — machine-local\n${add.join('\n')}\n`);
    if (target) {
      const statePath = targetPaths(target, undefined, cwd).stateFile;
      const state = readState(statePath);
      state.ignoreEntriesAdded = [...new Set([...(state.ignoreEntriesAdded || []), ...add.map(norm)])].sort();
      writeState(statePath, state);
    }
    return gi;
  } catch { return null; }
}

export function collisions({ cwd = process.cwd(), target, home, skillIds = [] }) {
  const paths = targetPaths(target, home, cwd);
  const managed = new Set(Object.keys(readState(paths.stateFile).skills || {}));
  return skillIds.filter((id) => !managed.has(id) && existsSync(paths.skillDir(id)));
}

export function listInstalled({ target, home, cwd = process.cwd() }) {
  const paths = targetPaths(target, home, cwd);
  return Object.keys(readState(paths.stateFile).skills);
}

export function listInstalledAgents({ target, home, cwd = process.cwd() }) {
  const state = readState(targetPaths(target, home, cwd).stateFile);
  const explicit = new Set(state.explicitAgents || []);
  return (state.agents || []).map((id) => {
    const agent = agentByName(id);
    return {
      id,
      source: agentNames().includes(id) ? 'base' : explicit.has(id) ? 'explicit' : 'skill',
      skills: agent?.skills || [],
    };
  });
}

export function listInstalledCommands({ target, home, cwd = process.cwd() }) {
  const state = readState(targetPaths(target, home, cwd).stateFile);
  return (state.commands || []).map((id) => ({ id, path: commandPath(target, cwd, id) }))
    .filter((entry) => entry.path && existsSync(entry.path));
}

export async function uninstall({ skillIds = [], agentIds = [], target, home, cwd = process.cwd(), dryRun }) {
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
  const previousExplicit = state.explicitAgents || readManifest(cwd)?.agents || [];
  const nextExplicit = previousExplicit.filter((id) => !agentIds.includes(id));
  const remainingSkillIds = Object.keys(state.skills || {}).filter((id) => !skillIds.includes(id));
  const desiredAgents = resolveAgentNames(remainingSkillIds, nextExplicit);
  const staleAgents = (state.agents || []).filter((id) => !desiredAgents.includes(id));
  for (const id of staleAgents) {
    const file = agentPath(target, cwd, id);
    if (file) { managedPaths.push(file); removed.push(file); }
  }
  const explicitChanged = nextExplicit.length !== previousExplicit.length;
  if (!removed.length && !explicitChanged) return removed;
  if (dryRun) return [...new Set(removed)];
  createBackup({ cwd, operation: 'uninstall', target, paths: [...new Set(managedPaths)], cliVersion: CLI_VERSION });
  for (const id of skillIds) {
    const entry = state.skills[id];
    if (!entry) continue;
    for (const f of entry.files) {
      if (existsSync(f)) rmSync(f, { recursive: true, force: true });
    }
    delete state.skills[id];
  }
  const agentResult = reconcileAgents(target, cwd, readDeveloperTier(cwd), state.agents || [], desiredAgents);
  state.agents = agentResult.names;
  state.agentCollisions = agentResult.collisions;
  state.explicitAgents = nextExplicit;
  const desiredCommands = resolveCommands({
    target,
    skills: remainingSkillIds,
    agents: state.agents,
    memoryMode: state.memory?.mode || 'unsupported',
  });
  const commandResult = reconcileCommands(target, cwd, state.commands || [], desiredCommands);
  removed.push(...commandResult.removed);
  state.commands = commandResult.names;
  state.commandCollisions = commandResult.collisions;
  writeState(paths.stateFile, state);
  const manifest = readManifest(cwd);
  if (manifest) writeManifest(cwd, {
    ...manifest,
    skills: manifest.skills.filter((id) => !skillIds.includes(id)),
    agents: manifest.agents.filter((id) => !agentIds.includes(id)),
  });
  return [...new Set(removed)];
}

// Reconcile an accepted onboarding plan as a replacement, not an additive install.
// Ownership comes only from the target state file; unrelated files in the assistant
// directory are left untouched.
export function removeTargetInstall({ target, home, cwd = process.cwd() }) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  const ignored = [paths.stateFile];
  const ownedIgnoreEntries = new Set(state.ignoreEntriesAdded || []);
  const owned = [
    ...Object.values(state.skills || {}).flatMap((entry) => entry.files || []),
    ...(state.agents || []).map((name) => agentPath(target, cwd, name)).filter(Boolean),
    ...(state.commands || []).map((name) => commandPath(target, cwd, name)).filter(Boolean),
    paths.stateFile,
  ];
  const root = resolve(cwd);
  const safe = (file) => {
    const absolute = resolve(file);
    if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) return false;
    const parts = relative(root, dirname(absolute)).split(sep).filter(Boolean);
    let cursor = root;
    for (const part of parts) {
      cursor = join(cursor, part);
      if (!existsSync(cursor)) break;
      if (lstatSync(cursor).isSymbolicLink()) {
        const destination = realpathSync(cursor);
        if (destination !== root && !destination.startsWith(`${root}${sep}`)) return false;
      }
    }
    return true;
  };
  if (owned.some((file) => !safe(file))) throw new Error(`RSC_PREVIOUS_INSTALL_INCOMPATIBLE: ${target} state contains a path outside the project root`);
  for (const entry of Object.values(state.skills || {})) {
    for (const file of entry.files || []) { ignored.push(file); rmSync(file, { recursive: true, force: true }); }
  }
  for (const name of state.agents || []) {
    const file = agentPath(target, cwd, name);
    if (file) { ignored.push(file); rmSync(file, { recursive: true, force: true }); }
  }
  for (const name of state.commands || []) {
    const file = commandPath(target, cwd, name);
    if (file) { ignored.push(file); rmSync(file, { recursive: true, force: true }); }
  }
  unwireHook(target, paths);
  unwireMemory(target, cwd);
  rmSync(paths.stateFile, { force: true });
  const gitignore = join(cwd, '.gitignore');
  if (existsSync(gitignore)) {
    const stale = new Set(ignored.map((path) => relative(cwd, path).split(sep).join('/').replace(/^\//, '').replace(/\/$/, ''))
      .filter((entry) => ownedIgnoreEntries.has(entry)));
    const lines = readFileSync(gitignore, 'utf8').split('\n');
    const kept = lines.filter((line) => !stale.has(line.trim().replace(/^\//, '').replace(/\/$/, '')));
    writeFileSync(gitignore, kept.join('\n'));
  }
}

export function pruneSharedBases({ cwd = process.cwd(), skillIds = [] }) {
  const versions = readBaseVersions(cwd);
  const wanted = new Set(skillIds);
  for (const id of Object.keys(versions)) {
    if (wanted.has(id)) continue;
    rmSync(baseDir(id, cwd), { recursive: true, force: true });
    delete versions[id];
  }
  writeBaseVersions(cwd, versions);
}

export async function syncInstalled({ target, home, cwd = process.cwd(), dryRun = false }) {
  const paths = targetPaths(target, home, cwd);
  const state = readState(paths.stateFile);
  // The per-target state is machine wiring and does not travel, so a fresh clone has
  // none of it: sync found zero skills and did nothing, leaving someone with a repo that
  // declares a harness and has none. The committed manifest is exactly the declaration
  // to rebuild from, and it is sitting right there.
  const ids = Object.keys(state.skills || {});
  const manifest = readManifest(cwd);
  const governedSkills = manifest?.onboarding?.plan?.policy?.skills;
  const declared = governedSkills || (ids.length ? ids : (manifest?.skills || []));
  const declaredAgents = state.explicitAgents?.length ? state.explicitAgents : (manifest?.agents || []);
  if (!declared.length && !declaredAgents.length) return dryRun ? { dryRun: true, synced: [], syncedAgents: [], paths: [] } : { synced: [], syncedAgents: [], backup: null };
  if (dryRun) {
    return {
      dryRun: true,
      synced: declared,
      syncedAgents: declaredAgents,
      paths: managedPathsForInstall({ skillIds: declared, agentIds: declaredAgents, target, home, cwd, policy: manifest?.onboarding?.plan?.policy }),
    };
  }
  const nextState = await applyInstall({
    skillIds: declared,
    agentIds: declaredAgents,
    target,
    home,
    cwd,
    operation: 'sync',
    policy: manifest?.onboarding?.plan?.policy,
    onboarding: manifest?.onboarding,
  });
  return { synced: declared, syncedAgents: declaredAgents, backup: nextState.backup };
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
      for (const name of state.commands || []) {
        const file = commandPath(target, cwd, name);
        if (file) drop(file);
      }
      for (const name of state.agents || []) {
        const file = agentPath(target, cwd, name);
        if (file) drop(file);
      }
      drop(paths.stateFile);
    }
    // Unwiring mutates shared config files, so only run it for real (dry runs report
    // those files without touching them).
    if (!dryRun) {
      removed.push(...unwireHook(target, paths));
      removed.push(...unwireMemory(target, cwd));
    } else {
      removed.push(...memoryArtifactsPresent(target, cwd));
    }
    // A lost state file also loses proof of ownership. Leave same-named user files
    // behind rather than guessing from a catalog id and deleting their work.
  }
  drop(join(cwd, '.rsc'), true);
  if (withDocs) drop(join(cwd, '02-DOCS'), true);
  return [...new Set(removed)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2);
  applyInstall({ skillIds: ids, target: 'claude' }).then(() => console.log('installed', ids.join(', ')));
}
