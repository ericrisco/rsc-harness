import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { ignoreLocalState } from '../scripts/install-apply.js';
import { doctor } from '../scripts/doctor.js';

// Team simulation D9: in a teammate's clone `.worktrees/` showed up as `?? .worktrees/` — nothing in
// rsc ever ignored it, although the isolation rule sends every concurrent session there. The fix
// belongs in the COMMITTED .gitignore block, so the clone inherits it with the first pull.

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
const write = (root, rel, body) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };
const tmp = (prefix) => realpathSync(mkdtempSync(join(tmpdir(), prefix)));

function repo() {
  const root = tmp('rsc-hyg-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'lead@team.test');
  git(root, 'config', 'user.name', 'Lead');
  write(root, 'README.md', '# app\n');
  write(root, '.gitignore', 'node_modules/\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'init');
  return root;
}

test('W4 · the rsc ignore block covers .worktrees/, once', () => {
  const root = repo();
  ignoreLocalState(root);
  const gi = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(gi, /^\.worktrees\/$/m);
  assert.equal(ignoreLocalState(root), null, 'idempotent');
  for (const spelling of ['.worktrees', '/.worktrees/']) {
    const other = repo();
    writeFileSync(join(other, '.gitignore'), `.rsc/\n${spelling}\n`);
    assert.equal(ignoreLocalState(other), null, `${spelling} already covers it`);
  }
});

test('W4 · a teammate clone inherits it: a worktree there is not offered for commit', () => {
  const lead = repo();
  ignoreLocalState(lead);
  git(lead, 'add', '.gitignore');
  git(lead, 'commit', '-qm', 'chore: ignore rsc state');
  const origin = tmp('rsc-hyg-origin-');
  git(origin, 'init', '-q', '--bare', '-b', 'main'); // CI's git defaults to master: the clone would check out nothing
  git(lead, 'remote', 'add', 'origin', origin);
  git(lead, 'push', '-q', 'origin', 'main');
  const bruno = join(tmp('rsc-hyg-clone-'), 'bruno');
  spawnSync('git', ['clone', '-q', origin, bruno]);
  git(bruno, 'worktree', 'add', '-q', '-b', 'feat/busqueda', join(bruno, '.worktrees', 'feat', 'busqueda'));
  assert.equal(git(bruno, 'status', '--porcelain'), '', 'no `?? .worktrees/` in the clone');
});

test('W4 · doctor flags a .worktrees/ that git does not ignore, and leftover landed worktrees', () => {
  const root = repo();
  const wt = join(root, '.worktrees', 'feat', 'vieja');
  git(root, 'worktree', 'add', '-q', '-b', 'feat/vieja', wt);
  write(wt, 'vieja.txt', 'x\n');
  git(wt, 'add', '-A');
  git(wt, 'commit', '-qm', 'feat: vieja');
  git(root, 'merge', '-q', '--no-ff', 'feat/vieja', '-m', 'land');

  const before = doctor({ target: 'codex', cwd: root, home: join(root, '.home') }).worktreeHygiene;
  assert.equal(before.ignored, false);
  assert.match(before.action, /sync/);
  assert.deepEqual(before.leftovers.map((l) => l.branch), ['feat/vieja']);
  assert.match(before.action, /worktrees reap/);

  ignoreLocalState(root);
  git(root, 'worktree', 'remove', '--force', wt);
  const after = doctor({ target: 'codex', cwd: root, home: join(root, '.home') }).worktreeHygiene;
  assert.equal(after.ignored, true);
  assert.deepEqual(after.leftovers, []);
  assert.equal(after.action, undefined, 'nothing to do, nothing said');
});
