import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Team simulation D10 (G2). The ship guard exists for one moment: leaving a feature branch for the
// trunk with work that was never saved or pushed. It fired instead on `git merge origin/main` run ON
// the feature branch — bringing the trunk in, the opposite of leaving — and told the person to push
// "before switching to the trunk", a reason that was false about the command (P6). And rsc's own
// knowledge commits (📥/📝 docs(auto)) counted as the person's unpushed work.
const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, '..', 'targets', 'ship-guard.mjs');

function sh(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
const commit = (root, file, msg) => { writeFileSync(join(root, file), `${msg}\n`); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', msg); };

/** A clone with origin/main, on a pushed feature branch. */
function clone() {
  const base = mkdtempSync(join(tmpdir(), 'rsc-sg-team-'));
  const origin = join(base, 'origin.git');
  const root = join(base, 'work');
  sh(base, 'init', '-q', '--bare', '-b', 'main', origin);
  sh(base, 'clone', '-q', origin, root);
  sh(root, 'config', 'user.email', 't@x'); sh(root, 'config', 'user.name', 'T');
  commit(root, 'a.txt', 'init');
  sh(root, 'push', '-q', '-u', 'origin', 'main');
  sh(root, 'switch', '-q', '-c', 'feat/orden');
  commit(root, 'b.txt', 'feat work');
  sh(root, 'push', '-q', '-u', 'origin', 'feat/orden');
  return root;
}

function decide(root, command) {
  const r = spawnSync('node', [GUARD, root], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason : null;
}

test('updating a feature branch with the trunk is not leaving it, even with local work', () => {
  const root = clone();
  commit(root, 'c.txt', 'local, not pushed yet');
  for (const cmd of ['git merge origin/main', 'git merge main', 'git -C . merge --no-edit origin/main', 'git fetch origin && git merge origin/main']) {
    assert.equal(decide(root, cmd), null, `denied a merge INTO the feature branch: ${cmd}`);
  }
});

test('switching to the trunk with unpushed work is still denied', () => {
  const root = clone();
  commit(root, 'c.txt', 'local, not pushed yet');
  assert.match(decide(root, 'git switch main') ?? '', /not pushed/);
  assert.match(decide(root, 'git switch main && git merge feat/orden') ?? '', /not pushed/);
});

test("rsc's own docs(auto) commits are not the person's unpushed work", () => {
  const root = clone();
  commit(root, 'k1.md', '📥 docs(auto): sync desde rsc/knowledge');
  commit(root, 'k2.md', '📝 docs(auto): notes [skip ci]');
  assert.equal(decide(root, 'git switch main'), null, 'only rsc knowledge commits are ahead');
  commit(root, 'c.txt', '✨ feat: the person\'s work');
  assert.match(decide(root, 'git switch main') ?? '', /1 commit\(s\) not pushed/, 'counted without the docs(auto) ones');
});

test('a never-pushed branch made only of docs(auto) commits is not stranded work either', () => {
  const root = clone();
  sh(root, 'switch', '-q', '-c', 'feat/local', 'main');
  commit(root, 'k1.md', '📥 docs(auto): sync desde rsc/knowledge');
  assert.equal(decide(root, 'git switch main'), null);
  commit(root, 'c.txt', 'real');
  assert.match(decide(root, 'git switch main') ?? '', /never pushed/);
});

test('a merge aimed at a checkout that is on the trunk still counts as landing there', () => {
  const root = clone();
  commit(root, 'c.txt', 'local, not pushed yet');
  const trunk = `${root}-trunk`;
  sh(root, 'worktree', 'add', '-q', '--detach', trunk);
  sh(trunk, 'switch', '-q', 'main');
  assert.match(decide(root, `git -C ${trunk} merge feat/orden`) ?? '', /not pushed/);
});
