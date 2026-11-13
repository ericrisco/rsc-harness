import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireHook } from '../targets/claude.js';

function fixture({ local = true, open = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc parking space '));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(root, '.gitignore'), '.rsc/\n.claude/\n');
  writeFileSync(join(root, 'app.js'), 'export const page = true;\n');
  git('add', '.'); git('commit', '-qm', 'baseline');
  wireHook({ projectRoot: root, hookTarget: join(root, '.claude/settings.json'), skillDir: id => join(root, '.claude/skills', id) });
  writeFileSync(join(root, '.rsc', open ? '.no-trunk-guard' : '.no-trunk-open'), '');
  git('switch', '-qc', 'feat/experiment');
  if (local) { writeFileSync(join(root, 'auth.js'), 'export const passwordHash = "fixture";\n'); git('add', 'auth.js'); git('commit', '-qm', 'local auth experiment'); }
  const hook = (command, cwd = root) => {
    const r = spawnSync(process.execPath, [join(root, '.rsc/ship-guard.mjs'), root], {
      input: JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }), encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '');
    return r.stdout.trim() ? JSON.parse(r.stdout) : {};
  };
  return { root, git, hook };
}
const denied = result => result.hookSpecificOutput?.permissionDecision === 'deny';

test('installed hook parks a local tier-2 experiment with main explicitly open, preserving all commits', () => {
  const { root, git, hook } = fixture(); const tip = git('rev-parse', 'HEAD');
  const result = hook('git switch main');
  assert.equal(denied(result), false); assert.match(result.systemMessage || '', /local.*feat\/experiment|feat\/experiment.*local/i);
  git('switch', '-q', 'main');
  assert.equal(git('rev-parse', 'feat/experiment'), tip); assert.equal(git('branch', '-r'), '');
  assert.equal(existsSync(join(root, '.rsc/.no-ship-guard')), false);
  assert.equal(existsSync(join(root, '.rsc/.no-asdd-gate')), false);
});

test('a local experiment stays protected under the branches/PR workflow', () => {
  const { hook } = fixture({ open: false }); assert.equal(denied(hook('git switch main')), true);
});

test('only untracked editor settings are excluded; tracked editor changes and other work still block', () => {
  const { root, git, hook } = fixture({ local: false });
  mkdirSync(join(root, '.vscode')); writeFileSync(join(root, '.vscode/settings.json'), '{}');
  assert.equal(denied(hook('git switch main')), false);
  writeFileSync(join(root, 'new source.js'), '// unsaved source'); assert.equal(denied(hook('git switch main')), true);
  rmSync(join(root, 'new source.js'));
  git('add', '.vscode/settings.json'); git('commit', '-qm', 'editor configuration');
  writeFileSync(join(root, '.vscode/settings.json'), '{"changed":true}'); assert.equal(denied(hook('git switch main')), true);
});

test('ignored paths are respected but modified or staged source is never parked', () => {
  const { root, git, hook } = fixture();
  writeFileSync(join(root, '.git/info/exclude'), 'scratch/\n'); mkdirSync(join(root, 'scratch')); writeFileSync(join(root, 'scratch/note'), 'scratch');
  assert.equal(denied(hook('git switch main')), false);
  writeFileSync(join(root, 'app.js'), 'modified'); assert.equal(denied(hook('git switch main')), true);
  git('add', 'app.js'); assert.equal(denied(hook('git switch main')), true);
});

test('parking is not a merge, destructive switch, chained delivery or push exemption', () => {
  const { hook } = fixture();
  for (const command of ['git switch -f main', 'git checkout --force main', 'git switch main && git merge feat/experiment', 'git switch main; git push origin main', 'git push origin feat/experiment']) {
    assert.equal(denied(hook(command)), true, command);
  }
});

test('quoted paths and shell wrappers park the same checkout, including a quoted trunk name', () => {
  const { root, hook } = fixture();
  for (const command of [`git -C "${root}" switch main`, 'git checkout "main"', 'bash -c "git switch main"']) {
    const result = hook(command); assert.equal(denied(result), false, command); assert.ok(result.systemMessage, command);
  }
  writeFileSync(join(root, 'app.js'), 'dirty'); assert.equal(denied(hook('git checkout "main"')), true);
});

test('a published branch with local commits still requires delivery', () => {
  const { root, git, hook } = fixture();
  git('update-ref', 'refs/remotes/origin/feat/experiment', 'main'); git('config', 'remote.origin.url', join(root, 'not-contacted.git'));
  git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  git('branch', '--set-upstream-to=origin/feat/experiment');
  assert.equal(denied(hook('git switch main')), true);
});

test('a foreign checkout never borrows the current project parking permission', () => {
  const a = fixture(); const b = fixture({ open: false });
  assert.equal(denied(a.hook(`git -C "${b.root}" switch main`)), true);
});

test('publication without upstream configuration still protects pending work', () => {
  const { root, git, hook } = fixture();
  const remote = mkdtempSync(join(tmpdir(), 'rsc-parking-remote-'));
  const init = spawnSync('git', ['init', '--bare', '-q', remote], { encoding: 'utf8' }); assert.equal(init.status, 0, init.stderr);
  git('remote', 'add', 'origin', remote); git('push', '-q', 'origin', 'feat/experiment');
  writeFileSync(join(root, 'later.js'), 'another local commit'); git('add', 'later.js'); git('commit', '-qm', 'later work');
  assert.ok(git('rev-parse', 'refs/remotes/origin/feat/experiment'));
  assert.equal(denied(hook('git switch main')), true);
});

test('assignments and directory-changing wrappers cannot borrow the open checkout permission', () => {
  const a = fixture(); const b = fixture({ open: false });
  for (const command of [
    `GIT_DIR='${b.root}/.git' GIT_WORK_TREE='${b.root}' git switch main`,
    `env -C '${b.root}' git switch main`,
    `bash -c "GIT_DIR='${b.root}/.git' GIT_WORK_TREE='${b.root}' git switch main"`,
  ]) assert.equal(denied(a.hook(command)), true, command);
});
