// capabilities.js — "what do I already have that solves this?", answered by a
// command instead of by the model's memory.
//
// The automation-gap rule says: never propose CREATING a skill or an agent before
// checking whether one already exists. A rule like that is only real if something
// enumerates the existing set — otherwise it is a decorative gate, the defect class
// this repo has paid for repeatedly. This file is that something.
//
// Three sources, one shape:
//   installed  — skills active for this target
//   available  — catalog skills not installed
//   agents     — agent FILES on disk (project + user scope)
//
// Only 5 of 17 targets have file-based agents; on the other 12 the agent is
// advisory and there is nothing to enumerate. That is `agentsSupported: false`,
// never an error — the caller drops the agent branch instead of failing.

import { existsSync, readdirSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import { loadManifest } from './manifest.js';
import { listInstalled } from '../install-apply.js';
import { developerAgentPath, targetHasAgents } from '../../targets/agents.js';

// AGENT_TARGETS is not exported on purpose, so derive the directory and extension
// from the one path helper that owns it. Duplicating that table here is how the
// two copies drift apart.
function agentDirFor(target, root) {
  const p = developerAgentPath(target, root);
  return p ? { dir: dirname(p), ext: extname(p) } : null;
}

function readAgentDir(dir, ext, scope) {
  if (!dir || !existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === ext)
      .map((f) => ({ id: basename(f, ext), scope, path: join(dir, f) }))
      .sort((a, b) => a.id.localeCompare(b.id));
  } catch { return []; }
}

// Agent files for a target, project scope first then user scope. A project agent
// and a user agent with the same id are both listed with their scope, because
// which one wins is the tool's business, not ours to guess.
export function listAgents({ target, home, cwd = process.cwd() } = {}) {
  if (!targetHasAgents(target)) return { supported: false, agents: [] };
  const project = agentDirFor(target, cwd);
  const user = agentDirFor(target, home || homedir());
  return {
    supported: true,
    agents: [
      ...readAgentDir(project?.dir, project?.ext, 'project'),
      ...readAgentDir(user?.dir, user?.ext, 'user'),
    ],
  };
}

const shortDesc = (d) => {
  const s = String(d || '').split('. ')[0].replace(/\s+/g, ' ').trim();
  return s.length > 140 ? `${s.slice(0, 139)}…` : s;
};

export function capabilities({ target, home, cwd = process.cwd() } = {}) {
  const manifest = loadManifest();
  const installed = new Set(listInstalled({ target, home, cwd }));
  const byId = new Map(manifest.skills.map((s) => [s.id, s]));
  const { supported, agents } = listAgents({ target, home, cwd });
  return {
    target,
    agentsSupported: supported,
    installed: [...installed].sort().map((id) => ({ id, description: shortDesc(byId.get(id)?.description) })),
    available: manifest.skills
      .filter((s) => !installed.has(s.id))
      .map((s) => ({ id: s.id, description: shortDesc(s.description) }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    agents,
  };
}

// --- the gap log ---------------------------------------------------------------
//
// Written through this function, never by a skill composing markdown by hand — a
// free-form writer drifts in format within a few sessions and then nothing can
// read it back. Nothing DOES read it back (by spec): its reader is the user.
//
// PRIVACY BOUNDARY: `procedure` is the assistant's own description of what it
// observed doing. The user's literal request must never be passed here. The rule
// lives in the skill; this function enforces only shape.

export const GAP_VERDICTS = [
  'covered-installed', 'covered-catalog', 'covered-agent',
  'proposed-accepted', 'proposed-declined',
];

export function gapLogPath(cwd = process.cwd()) {
  return join(cwd, '.rsc', 'automation-gaps.md');
}

export function appendGap({ procedure, verdict, artifact, cwd = process.cwd(), now }) {
  const text = String(procedure || '').replace(/\s*\n\s*/g, ' ').trim();
  if (!text) throw new Error('gap-log: a procedure description is required. Recover: pass --procedure "<what you observed doing>" — your own description of the work, never the user\'s words.');
  if (!GAP_VERDICTS.includes(verdict)) {
    throw new Error(`gap-log: verdict must be one of ${GAP_VERDICTS.join(', ')}. Recover: re-run with a valid --verdict.`);
  }
  const p = gapLogPath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  const header = existsSync(p) ? '' : '# Huecos de automatización\n\nProcedimientos que el asistente observó y qué pasó con ellos. Lo escribe `rsc capabilities gap-log`.\nNo contiene peticiones del usuario: solo la descripción que el asistente hizo de su propio trabajo.\n\n';
  const day = (now || new Date()).toISOString().slice(0, 10);
  appendFileSync(p, `${header}- ${day} · ${text} · **${verdict}**${artifact ? ` · ${artifact}` : ''}\n`);
  return p;
}

export function countGaps(cwd = process.cwd()) {
  const p = gapLogPath(cwd);
  if (!existsSync(p)) return 0;
  return readFileSync(p, 'utf8').split('\n').filter((l) => /^- \d{4}-\d{2}-\d{2} · /.test(l)).length;
}
