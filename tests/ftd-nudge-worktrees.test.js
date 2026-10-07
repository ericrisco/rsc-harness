import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { decide, classify, NUDGE } from '../targets/ftd-nudge.mjs';

// Team simulation D11: the lane nudge never fired for a session working in `.worktrees/<b>/`,
// because every path under `.worktrees/` classified as "other" — and the isolation rule sends every
// concurrent session exactly there. The path is classified relative to the worktree it belongs to.

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
const write = (root, rel, body) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };

function project() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ftdwt-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'ana@team.test');
  git(root, 'config', 'user.name', 'Ana');
  write(root, '.gitignore', '.rsc/\n.worktrees/\n');
  write(root, 'src/app.js', 'x\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'init');
  return root;
}
function worktree(root, branch) {
  const wt = join(root, '.worktrees', ...branch.split('/'));
  git(root, 'worktree', 'add', '-q', '-b', branch, wt);
  return wt;
}
const edit = (root, session, file) => decide(root, { session_id: session, tool_input: { file_path: file } });

test('W5 · a path inside .worktrees/<branch>/ is classified as the worktree sees it', () => {
  const root = project();
  const wt = worktree(root, 'feat/busqueda'); // a branch with a slash: two levels under .worktrees/
  assert.equal(classify(root, join(wt, 'src', 'search.js')), 'code');
  assert.equal(classify(root, join(wt, '02-DOCS', 'wiki', 'ftd', 'busqueda.md')), 'document');
  assert.equal(classify(root, join(wt, '.rsc', 'x.mjs')), 'other');
  assert.equal(classify(root, join(wt, 'README.md')), 'other');
  // Without a worktree on disk to ask, one segment is the branch.
  assert.equal(classify('/p', '/p/.worktrees/fix-x/src/a.js'), 'code');
  assert.equal(classify('/p', '/p/.worktrees/fix-x/02-DOCS/wiki/ftd/a.md'), 'document');
});

test('W5 · the nudge fires once for a session editing code inside a worktree', () => {
  const root = project();
  const wt = worktree(root, 'feat/orden');
  assert.equal(edit(root, 'S', join(wt, 'src', 'order.js')), NUDGE);
  assert.equal(edit(root, 'S', join(wt, 'src', 'more.js')), '', 'once per session');
  assert.equal(edit(root, 'T', join(wt, '02-DOCS', 'wiki', 'ftd', 'orden.md')), '');
  assert.equal(edit(root, 'T', join(wt, 'src', 'order.js')), '', 'documented inside the worktree counts');
});

test('W5 · no nudge on a branch whose own commits already carry a feature document', () => {
  const root = project();
  const wt = worktree(root, 'feat/vencidas');
  write(wt, '02-DOCS/wiki/ftd/vencidas.md', '# Vencidas\n');
  git(wt, 'add', '-A');
  git(wt, 'commit', '-qm', 'docs(ftd): vencidas');
  // A later session on this branch — resolving a conflict, say — touches code and no document.
  assert.equal(edit(root, 'CONFLICT', join(wt, 'src', 'app.js')), '');
});

test('W5 · control: a branch whose commits carry no feature document is still nudged', () => {
  const root = project();
  const wt = worktree(root, 'feat/sin-doc');
  write(wt, 'src/x.js', 'y\n');
  git(wt, 'add', '-A');
  git(wt, 'commit', '-qm', 'feat: x');
  assert.equal(edit(root, 'U', join(wt, 'src', 'app.js')), NUDGE);
});
