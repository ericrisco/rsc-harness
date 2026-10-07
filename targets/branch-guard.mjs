#!/usr/bin/env node
// rsc Branch guard (claude). Wired by targets/claude.js onto PreToolUse (matcher Bash) as
// `node ...`, like ship-guard. argv[2] = project root · stdin = PreToolUse hook JSON.
//
// Two rules from team-safe-default, each the deterministic floor of something the skills decide:
//
//   A · the default branch is closed for the agent where the project shows it is complex or in
//       production (trunk-policy.mjs). A commit or a merge there is denied, and the message says
//       how to carry on: a branch, or — if the project is in fact simple — the person unlocking it.
//   B · another session is working in this same checkout (session-memory-core.mjs). Switching
//       branches here would change its files under it, so it is denied, and the message says how to
//       carry on: a worktree under `.worktrees/`.
//
// Every denial carries its way out (constitution P6). Only what the AGENT runs is seen: a person
// committing in their own terminal is never touched (spec, P3). FAIL-OPEN: no repo, no git, a module
// missing, anything unclear → allow. Opt-outs, both PROJECT switches: `.rsc/.no-trunk-guard`
// («desbloquea main» / `rsc main unlock`) and `.rsc/.no-worktree-isolation` (`rsc isolation off`).
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }));
  process.exit(0);
}

const GIT_OPTS = String.raw`(?:(?:-C\s+\S+|-c\s+\S+|--(?:work-tree|git-dir|namespace)\s+\S+|--\S+)\s+)*`;
export const COMMITS_HERE = new RegExp(String.raw`\bgit\s+${GIT_OPTS}(?:commit|merge|cherry-pick|revert|am)(?![\w-])`);
// A branch move: switch, or checkout of something that is not a path (`checkout -- f`, `checkout HEAD -- f`).
export const MOVES_BRANCH = new RegExp(String.raw`\bgit\s+${GIT_OPTS}(?:switch(?![\w-])|checkout(?![\w-])(?![^;&|\n]*\s--(?:\s|$)))`);

export const unquoted = (command) => command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');

/** Where the git command actually runs: `git -C <dir>`, or a leading `cd <dir> &&`, else the cwd. */
export function effectiveDir(command, base) {
  const c = command.match(/\bgit\s+(?:-c\s+\S+\s+)*-C\s+("[^"]+"|'[^']+'|\S+)/);
  const d = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/);
  const raw = (c || d)?.[1]?.replace(/^["']|["']$/g, '');
  if (!raw) return base;
  return isAbsolute(raw) ? raw : resolve(base, raw);
}

const gitAt = (dir) => (...args) => {
  const r = spawnSync('git', ['-C', dir, ...args], { windowsHide: true, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : null;
};

const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min <= 1 ? 'just now' : `${min} min ago`;
};

// The quote-aware split, the heredoc strip and the shell unwrapping (`bash -c "…"`, `eval`, `env`…)
// live in shell-unwrap.mjs, shared with the other guards (E2E defect 15). It is a sibling import
// like trunk-policy.mjs; without it the guard cannot read a command and fails open.
const SH = await import(new URL('./shell-unwrap.mjs', import.meta.url)).catch(() => null);
const tokens = (s) => s.trim().split(/\s+/).filter(Boolean);

/** What a branch-moving segment moves to, or null if it is a path checkout after all (`checkout .`). */
function moveTarget(seg, dir) {
  const t = tokens(seg.replace(/^.*?\bgit\s+/, '').replace(/^(?:(?:-C|-c)\s+\S+\s+|--\S+\s+)*/, ''));
  const verb = t.shift();
  const create = t.findIndex((x) => /^-[cCbB]$/.test(x));
  if (create >= 0) return { name: t[create + 1] || null, created: true };
  const name = t.find((x) => !x.startsWith('-'));
  if (!name) return { name: null, created: false };
  if (verb === 'checkout' && (name === '.' || (existsSync(resolve(dir, name)) && !gitAt(dir)('rev-parse', '--verify', '--quiet', `refs/heads/${name}`)))) return null;
  return { name, created: false };
}

/**
 * Rule A and rule B, judged segment by segment: a chain is followed the way the shell runs it, so
 * `git switch -c feat/x && git commit` is a commit on feat/x (allowed) and `git switch main && git
 * merge feat/x` is a merge on main (judged as one). `cd` and `git -C` move the folder being judged.
 */
export async function evaluate({ root, command, cwd, sessionId }) {
  if (typeof command !== 'string' || !command) return null;
  if (!SH) return null;
  // Words inside quotes or heredocs are text, not commands: `grep -rn "git commit" docs/` is a search.
  // Except where a wrapper hands the string to a shell: `bash -c "git commit"` runs the commit, so
  // the segments judged are the ones the shell would really run (shell-unwrap.mjs).
  const raw = SH.expand(command);
  const segs = raw.map(unquoted);
  if (!segs.some((s) => COMMITS_HERE.test(s) || MOVES_BRANCH.test(s))) return null;
  const self = (rel) => new URL(rel, import.meta.url);
  let dir = cwd || root;
  const branchAt = new Map(); // toplevel → branch the chain has moved it to

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const cd = (raw[i] || seg).match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*$/);
    if (cd) { const d = cd[1].replace(/^["']|["']$/g, ''); dir = isAbsolute(d) ? d : resolve(dir, d); continue; }
    const commits = COMMITS_HERE.test(seg);
    const moves = MOVES_BRANCH.test(seg);
    if (!commits && !moves) continue;
    const at = effectiveDir(raw[i] || seg, dir);
    const git = gitAt(at);
    const top = git('rev-parse', '--show-toplevel');
    if (!top) continue;
    const here = (() => { try { return realpathSync(top); } catch { return top; } })();

    if (moves) {
      const target = moveTarget(seg, at);
      if (target) {
        if (!existsSync(join(root, '.rsc', '.no-worktree-isolation'))) {
          const reason = await isolationDenial({ root, here, sessionId, self });
          if (reason) return reason;
        }
        if (target.name) branchAt.set(here, target.name);
      }
    }

    if (commits && !existsSync(join(root, '.rsc', '.no-trunk-guard'))) {
      try {
        const { trunkPolicy, defaultBranchName } = await import(self('./trunk-policy.mjs'));
        const branch = branchAt.get(here) ?? git('symbolic-ref', '--quiet', '--short', 'HEAD');
        const trunk = defaultBranchName(here);
        if (branch && trunk && branch === trunk) {
          const policy = trunkPolicy(here);
          if (policy.closed) return await trunkDenial({ root, here, sessionId, self, trunk, policy });
        }
      } catch { /* policy module missing → nothing to enforce */ }
    }
  }
  return null;
}

async function othersHere({ root, here, sessionId, self }) {
  try {
    const { otherActiveSessions } = await import(self('./session-memory-core.mjs'));
    return otherActiveSessions({ cwd: root, worktreeCwd: here, sessionId, target: 'claude' });
  } catch { return []; } // no memory module → no detection
}

async function trunkDenial({ root, here, sessionId, self, trunk, policy }) {
  // Where a branch would go depends on rule B: alone → this same folder; with company → .worktrees/.
  // Whether to branch at all is the person's call: the agent asks, it never branches on its own.
  const others = existsSync(join(root, '.rsc', '.no-worktree-isolation')) ? [] : await othersHere({ root, here, sessionId, self });
  const branch = others.length
    ? '`git worktree add .worktrees/<branch> -b feat/<what>` and commit inside `.worktrees/<branch>/` (another session is working in this folder)'
    : '`git switch -c feat/<what>` in this same folder, no worktree';
  return `This project keeps its default branch "${trunk}" closed for the agent (it looks complex or in production: ${policy.signals.join(', ')}), so this commit was not made. ` +
    `Do not choose for the person: ask them in one line whether to open a branch for this change or to unlock "${trunk}". ` +
    `Branch → ${branch}; it reaches "${trunk}" through a pull request. ` +
    'Unlock → only on their explicit answer, `npx @ericrisco/rsc main unlock` (a project decision, saved in .rsc.json), then commit again.';
}

async function isolationDenial({ root, here, sessionId, self }) {
  const others = await othersHere({ root, here, sessionId, self });
  if (!others.length) return null;
  const who = others.map((o) => `${o.target}${o.branch ? ` on "${o.branch}"` : ''}, ${ago(o.updatedAt)}`).join('; ');
  return `Another session is working in this same folder (${who}). Switching branches here would change its files under it. ` +
    'Work in a worktree instead, inside the project: `git worktree add .worktrees/<branch> -b <branch>` (or without -b for an existing branch) and run everything inside `.worktrees/<branch>/`; tell the person that is where the project now runs. ' +
    'To turn this rule off for the project: `npx @ericrisco/rsc isolation off`.';
}

function isMain(metaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const me = fileURLToPath(metaUrl);
  try { return realpathSync(me) === realpathSync(invoked); } catch { return me === invoked; }
}

if (isMain(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  if (!existsSync(join(root, '.git'))) allow();
  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { allow(); }
  if ((input.tool_name || input.toolName) !== 'Bash') allow();
  const command = input.tool_input?.command || input.toolInput?.command || '';
  const reason = await evaluate({ root, command, cwd: input.cwd || root, sessionId: input.session_id });
  if (reason) deny(reason);
  allow();
}
