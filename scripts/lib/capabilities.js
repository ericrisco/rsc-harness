// capabilities.js — "what do I already have that solves this?", answered by a
// command instead of by the model's memory.
//
// The automation-gap rule says: never propose BUILDING a skill or an agent before
// checking whether one already exists. A rule like that is only real if something
// enumerates the existing set — otherwise it is a decorative gate, the defect class
// this repo has paid for repeatedly. This file is that something.
//
// Three sources, one shape:
//   installed  — skill artifacts ON DISK, project and user scope, each tagged
//   available  — catalog skills not installed anywhere (ids; --full adds descriptions)
//   agents     — agent files on disk, project and user scope, each tagged
//
// Both skills and agents are read from DISK, never from the install state file: a
// state entry whose files were deleted would otherwise answer "covered — use it"
// for something that is not there, and that answer has no recovery path.
//
// 8 of 17 targets have file-based agents; on the other 9 the agent is advisory and
// there is nothing to enumerate. That is `agentsSupported: false`, never an error —
// the caller drops the agent branch instead of failing.

import { existsSync, readdirSync, statSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { loadManifest } from './manifest.js';
import { targetPaths } from '../../targets/index.js';
import { developerAgentPath, targetHasAgents } from '../../targets/agents.js';

// AGENT_TARGETS is not exported, so derive dir + extension from the one path helper
// that owns it — duplicating that table is how two copies drift apart. The extension
// is taken as everything after the agent's name, because `extname()` cannot recover a
// COMPOUND extension: copilot writes `developer.agent.md`, where extname says '.md',
// which both mis-names the agent and degrades the filter to every markdown file.
const AGENT_NAME = 'developer';
function agentSpecFor(target, root) {
  const p = developerAgentPath(target, root);
  if (!p) return null;
  const base = basename(p);
  const i = base.indexOf(AGENT_NAME);
  const ext = i === 0 ? base.slice(AGENT_NAME.length) : base.slice(base.indexOf('.'));
  return { dir: dirname(p), ext };
}

// Real files only. Directories (a dir named `foo.md` is not an agent), dangling
// symlinks and dotfiles are not capabilities.
function entriesWithExt(dir, ext) {
  if (!dir || !existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.') && e.name.endsWith(ext) && e.name.length > ext.length)
      .filter((e) => {
        if (e.isFile()) return true;
        if (!e.isSymbolicLink()) return false;
        try { return statSync(join(dir, e.name)).isFile(); } catch { return false; } // dangling
      })
      .map((e) => e.name)
      .sort();
  } catch { return []; }
}

// Project scope first, then user scope — unless they are the same directory (a
// project that IS the home dir, plausible for the non-code harnesses), where one
// artifact must not be reported twice.
function bothScopes(cwd, home, forRoot) {
  const project = forRoot(cwd);
  const user = forRoot(home);
  const same = project?.dir && user?.dir && resolve(project.dir) === resolve(user.dir);
  return same ? [[project, 'project']] : [[project, 'project'], [user, 'user']];
}

export function listAgents({ target, home, cwd = process.cwd() } = {}) {
  if (!targetHasAgents(target)) return { supported: false, agents: [] };
  const agents = [];
  for (const [spec, scope] of bothScopes(cwd, home || homedir(), (r) => agentSpecFor(target, r))) {
    if (!spec) continue;
    for (const name of entriesWithExt(spec.dir, spec.ext)) {
      agents.push({ id: name.slice(0, -spec.ext.length), scope, path: join(spec.dir, name) });
    }
  }
  return { supported: true, agents };
}

// Installed skills, read from disk in both scopes. `skillExt` targets (cursor) store
// each skill as a single file; the rest use a directory per skill.
export function listSkills({ target, home, cwd = process.cwd() } = {}) {
  const out = [];
  for (const [paths, scope] of bothScopes(cwd, home || homedir(), (r) => {
    try { const p = targetPaths(target, r, r); return { dir: p.root, probe: p.skillDir('__probe__') }; }
    catch { return null; }
  })) {
    if (!paths?.dir || !existsSync(paths.dir)) continue;
    const ext = basename(paths.probe).replace('__probe__', ''); // '' for dir-per-skill targets
    try {
      for (const e of readdirSync(paths.dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        if (ext) { if (e.isFile() && e.name.endsWith(ext)) out.push({ id: e.name.slice(0, -ext.length), scope }); }
        else if (e.isDirectory() && existsSync(join(paths.dir, e.name, 'SKILL.md'))) out.push({ id: e.name, scope });
      }
    } catch { /* unreadable scope → contributes nothing */ }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id) || a.scope.localeCompare(b.scope));
}

// Keep the discriminator: a description's value is its `NOT x (that is y)` boundary,
// so never cut it off. Trim the middle instead when the whole thing is long.
export function shortDesc(d, limit = 220) {
  const s = String(d || '').replace(/\s+/g, ' ').trim();
  if (s.length <= limit) return s;
  const not = s.search(/\bNOT\b/);
  if (not > 0) {
    const tail = s.slice(not);
    const head = s.slice(0, Math.max(0, limit - tail.length - 2));
    if (head) return `${head.trim()}… ${tail}`;
  }
  return `${s.slice(0, limit - 1)}…`;
}

// `full: true` adds catalog descriptions. Off by default because the catalog's
// descriptions are ~40 KB and `rsc catalog --available` already serves meaning-based
// matching — paying for the same bytes twice is the cost this harness keeps cutting.
export function capabilities({ target, home, cwd = process.cwd(), full = false } = {}) {
  const manifest = loadManifest();
  const byId = new Map(manifest.skills.map((s) => [s.id, s]));
  const skills = listSkills({ target, home, cwd });
  const installedIds = new Set(skills.map((s) => s.id));
  const { supported, agents } = listAgents({ target, home, cwd });
  return {
    target,
    agentsSupported: supported,
    installed: skills.map((s) => ({ ...s, description: shortDesc(byId.get(s.id)?.description) })),
    available: manifest.skills
      .filter((s) => !installedIds.has(s.id))
      .map((s) => (full ? { id: s.id, description: shortDesc(s.description) } : { id: s.id }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    agents,
  };
}

// --- the gap log ---------------------------------------------------------------
//
// Written through this function, never by a skill composing markdown by hand — a
// free-form writer drifts in format within a few sessions and then nothing can read
// it back. Nothing DOES read it back (by spec): its reader is the user, and doctor
// only counts entries.
//
// PRIVACY: `procedure` is the assistant's own description of what it observed doing.
// The user's literal request must never be passed here. This function enforces SHAPE
// ONLY — it cannot tell a description from a paraphrase, and it does not pretend to.
// The rule lives in skills/skill-scout/SKILL.md, where it is held by whoever writes.

export const GAP_VERDICTS = [
  'covered-installed', 'covered-catalog', 'covered-agent',
  'proposed-accepted', 'proposed-declined',
];

export function gapLogPath(cwd = process.cwd()) {
  return join(cwd, '.rsc', 'automation-gaps.md');
}

// Any whitespace run collapses, not just \n: a lone \r is a CommonMark line ending,
// so it would render as an extra (forged, dated) entry while `cat` hid it.
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function appendGap({ procedure, verdict, cwd = process.cwd(), now }) {
  const text = oneLine(procedure);
  if (!text) throw new Error('gap-log: a procedure description is required. Recover: pass --procedure "<what you observed doing>" — your own description of the work, never the user\'s words.');
  if (!GAP_VERDICTS.includes(verdict)) {
    throw new Error(`gap-log: verdict must be one of ${GAP_VERDICTS.join(', ')}. Recover: re-run with a valid --verdict.`);
  }
  const p = gapLogPath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  let needsHeader = true;
  try { needsHeader = statSync(p).size === 0; } catch { needsHeader = true; }
  const header = needsHeader
    ? '# Huecos de automatización\n\nProcedimientos que el asistente observó y qué pasó con ellos. Lo escribe `rsc capabilities gap-log`.\nDebe contener solo la descripción que el asistente hizo de su propio trabajo, no peticiones del usuario — es una regla que sostiene quien escribe, no algo que el código pueda comprobar. Fichero local: no lo commitees.\n\n'
    : '';
  const d = now || new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  appendFileSync(p, `${header}- ${day} · ${text} · **${verdict}**\n`);
  return p;
}

export function countGaps(cwd = process.cwd()) {
  try {
    const p = gapLogPath(cwd);
    if (!existsSync(p)) return 0;
    return readFileSync(p, 'utf8').split('\n').filter((l) => /^- \d{4}-\d{2}-\d{2} · /.test(l)).length;
  } catch { return 0; } // a malformed log must never take down `doctor`
}
