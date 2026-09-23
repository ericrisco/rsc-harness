import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, renameSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleLifecycle } from '../targets/session-memory-adapter.mjs';

// The memory answers two different questions and used to answer both from the same directory:
//
//   WHERE to keep the journal — the nearest harness. Right, and deliberate: a child without its own
//   `.rsc.json` must not scatter journals across the tree.
//   WHO the session is — which worktree, which branch. That was asked of git from the SAME
//   directory, so two worktrees nested under one harness were both recorded as the harness itself,
//   and the second one "matched exactly" the first one's record.
//
// On top of that, the resume chain ended in `|| records[0]`: when nothing was yours, the newest
// record in the store, whoever wrote it.
//
// Everything here uses REAL git worktrees, because the whole bug lives in what `git rev-parse
// --show-toplevel` answers from where.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function harnessWithTwoWorktrees() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-wt-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 't@t');
  git(root, 'config', 'user.name', 't');
  writeFileSync(join(root, 'README'), 'root\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  // The manifest is written AFTER the commit, so the worktrees do not check it out. That is the
  // shape that shares a store: a nested checkout with no `.rsc.json` of its own anchors to the
  // harness above it. (If each worktree carried its own manifest, each would get a private store
  // and there would be nothing to cross — the reporter's passing control, and my first fixture.)
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [] }));
  const alice = join(root, 'wt-alice');
  const bob = join(root, 'wt-bob');
  git(root, 'worktree', 'add', '-q', '-b', 'alice-feature', alice);
  git(root, 'worktree', 'add', '-q', '-b', 'bob-feature', bob);
  return { root, alice, bob };
}

const CANARY = 'ALICE-CANARY-7f3d9e21';

function aliceWorks(alice) {
  const native = { session_id: CANARY, cwd: alice };
  writeFileSync(join(alice, 'secret-plan.md'), 'alice only\n');
  handleLifecycle({ target: 'claude', event: 'edit', native, cwd: alice });
  handleLifecycle({ target: 'claude', event: 'end', native, cwd: alice });
}
const startIn = (cwd, id) => handleLifecycle({ target: 'claude', event: 'start', native: { session_id: id, cwd }, cwd });
const contextOf = (r) => r.output?.hookSpecificOutput?.additionalContext || '';

test('a sibling worktree under the same harness never receives the other one’s journal', () => {
  const { alice, bob } = harnessWithTwoWorktrees();
  aliceWorks(alice);
  const ctx = contextOf(startIn(bob, 'BOB-1'));
  assert.doesNotMatch(ctx, new RegExp(CANARY), `bob received alice's record:\n${ctx}`);
  assert.doesNotMatch(ctx, /secret-plan\.md/);
});

// The journal still lives in ONE place — the harness — which is what `nearestHarness` is for. Only
// the identity inside it changes.
test('the journal is still kept at the harness, but records the real worktree', () => {
  const { root, alice } = harnessWithTwoWorktrees();
  aliceWorks(alice);
  const ctx = contextOf(startIn(alice, 'ALICE-2'));
  assert.match(ctx, new RegExp(CANARY), 'alice must still resume her own work');
  assert.match(ctx, new RegExp(`worktree: ${alice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`), 'the recorded worktree is where she worked');
  assert.doesNotMatch(ctx, new RegExp(`worktree: ${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
});

// The second path: a checkout moved or renamed leaves a stale `worktree` on its records, so exact and
// same-worktree both miss for whoever occupies it next — and the chain used to land on records[0].
test('a moved checkout does not inherit the newest record in the store', () => {
  const { root, alice } = harnessWithTwoWorktrees();
  aliceWorks(alice);
  const moved = join(root, 'wt-moved');
  git(root, 'worktree', 'move', alice, moved);
  const ctx = contextOf(startIn(moved, 'BOB-2'));
  assert.doesNotMatch(ctx, new RegExp(CANARY), `the moved checkout was handed alice's record:\n${ctx}`);
});

// Controls — what must keep working exactly as before.
test('control: the same worktree resumes its own previous session', () => {
  const { alice } = harnessWithTwoWorktrees();
  aliceWorks(alice);
  assert.match(contextOf(startIn(alice, 'ALICE-3')), /exact continuation/);
});

test('control: a session at the harness root resumes its own work', () => {
  const { root } = harnessWithTwoWorktrees();
  const native = { session_id: 'ROOT-1', cwd: root };
  writeFileSync(join(root, 'root-work.md'), 'x\n');
  handleLifecycle({ target: 'claude', event: 'edit', native, cwd: root });
  handleLifecycle({ target: 'claude', event: 'end', native, cwd: root });
  assert.match(contextOf(startIn(root, 'ROOT-2')), /ROOT-1/);
});

test('control: the root does not receive a worktree’s journal either', () => {
  const { root, alice } = harnessWithTwoWorktrees();
  aliceWorks(alice);
  assert.doesNotMatch(contextOf(startIn(root, 'ROOT-3')), new RegExp(CANARY));
});
