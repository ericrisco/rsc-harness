#!/usr/bin/env node
// rsc Ship guard (claude). Wired by targets/claude.js onto PreToolUse (matcher Bash)
// as `node ...` so it runs on every platform including Windows.
//   argv[2] = absolute project root   stdin = PreToolUse hook JSON
//
// Enforces the "close the feature before you leave it" rule at the one deterministic
// moment it matters: when a Bash command tries to switch to the trunk (main/master)
// or merge into it. If the current feature branch has uncommitted changes or commits
// that were never pushed, the guard DENIES the command and tells the agent to run
// `ship` (commit → push → PR). Opening the PR itself is `ship`'s job and the skill's
// hard rule; this hook guarantees you cannot quietly abandon unsaved/unpushed work.
//
// Design: precise (only fires on a trunk switch/merge), local-only (no network, no gh),
// and FAIL-OPEN — any ambiguity (detached HEAD, no repo, git error) allows the command.
// Opt out per project with .rsc/.no-ship-guard.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.argv[2] || process.cwd();

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// Opt-out and "not a git repo" both mean: nothing to enforce.
if (existsSync(join(root, '.rsc', '.no-ship-guard'))) allow();
if (!existsSync(join(root, '.git'))) allow();

// Read the tool call. Only Bash commands can move branches.
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { allow(); }
if ((input.tool_name || input.toolName) !== 'Bash') allow();
const command = input.tool_input?.command || input.toolInput?.command || '';
if (typeof command !== 'string' || !command) allow();

// ---- sello gate (opt-in) ----------------------------------------------------
// When the sello is ON for this project, delivery commands (commit, push, PR)
// must match the sealed bytes. OFF (the default) → this block is a no-op and the
// guard behaves exactly as before. checkSello itself fails open on environment
// problems and denies only on real divergence/no-review/corruption (spec).
const DELIVERY = /\bgit\s+commit\b|\bgit\s+push\b|\bgh\s+pr\s+(?:create|merge)\b/;
if (DELIVERY.test(command)) {
  try {
    const { checkSello, isEnabled } = await import(new URL('./sello.mjs', import.meta.url));
    if (isEnabled(root)) {
      const verdict = checkSello(root);
      if (!verdict.ok) deny(verdict.message);
    }
  } catch { /* sello lib missing/unloadable → nothing to enforce, fail open */ }
}

// Does this command try to land on / move to the trunk?
const TRUNK = /\bgit\s+(?:checkout|switch)\s+(?:-{1,2}\S+\s+)*(?:main|master)\b/;
const MERGE = /\bgit\s+merge\b/;
if (!TRUNK.test(command) && !MERGE.test(command)) allow();

const git = (...args) => {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : null;
};

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
// Not on a feature branch (already trunk, detached, or git failed) → nothing to guard.
if (!branch || branch === 'HEAD' || branch === 'main' || branch === 'master') allow();

const tail = '\n(If this is intentional and you accept the risk, create .rsc/.no-ship-guard to disable this guard.)';

// 1) Uncommitted work would be carried off the feature branch.
const dirty = git('status', '--porcelain');
if (dirty && dirty.length > 0) {
  deny(`You're leaving feature branch "${branch}" with uncommitted changes. Commit them first — run the \`ship\` skill (commit → push → PR), don't abandon the diff.${tail}`);
}

// 2) Commits exist but were never pushed.
const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
if (upstream) {
  const ahead = git('rev-list', '--count', `${upstream}..HEAD`);
  if (ahead && Number(ahead) > 0) {
    deny(`Feature branch "${branch}" has ${ahead} commit(s) not pushed to ${upstream}. Push them and open the PR — run the \`ship\` skill — before switching to the trunk.${tail}`);
  }
} else {
  // No upstream at all: if the branch carries commits beyond the trunk, it was never pushed.
  const aheadOfTrunk = git('rev-list', '--count', 'main..HEAD') ?? git('rev-list', '--count', 'master..HEAD');
  if (aheadOfTrunk && Number(aheadOfTrunk) > 0) {
    deny(`Feature branch "${branch}" was never pushed (no upstream, ${aheadOfTrunk} commit(s) ahead of the trunk). Push it and open a PR — run the \`ship\` skill — before leaving it.${tail}`);
  }
}

allow();
