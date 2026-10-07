import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { handleLifecycle } from '../targets/session-memory-adapter.mjs';

// The team workflow, as four people ran it (team simulation, 2026-10-07). Real git, real worktrees:
// every defect here lives in what git answers from where, and a stub would answer what we expect.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (root, rel, body) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };

// A project the way a teammate clones it: `.rsc.json` and the ignore block are COMMITTED, so every
// worktree checks out its own `.rsc.json` — the shape that used to give each worktree a private store.
function teamProject() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-team-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'bruno@team.test');
  git(root, 'config', 'user.name', 'Bruno');
  write(root, '.rsc.json', JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [] }));
  write(root, '.gitignore', '.rsc/\n.worktrees/\n');
  write(root, 'src/tasks.js', 'export const tasks = [];\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}

const event = (cwd, id, name, extra = {}) => handleLifecycle({ target: 'claude', event: name, native: { session_id: id, cwd, ...extra }, cwd });
const contextOf = (r) => r.output?.hookSpecificOutput?.additionalContext || '';
const ISOLATION = /rsc · aislamiento/;

function recordsIn(dir) {
  const sessions = join(dir, '.rsc', 'memory', 'sessions');
  if (!existsSync(sessions)) return [];
  return readdirSync(sessions).filter((n) => n.endsWith('.json')).map((n) => JSON.parse(readFileSync(join(sessions, n), 'utf8')));
}

function allFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(join(dir, e.name)) : [join(dir, e.name)]));
}

// ── W1 (D2): a session that moves into a worktree must not haunt the main checkout ─────────────

test('W1 · a session that moves into .worktrees/ keeps ONE journal, in the parent project', () => {
  const root = teamProject();
  event(root, 'MOVER', 'start');
  write(root, 'src/tasks.js', 'export const tasks = [1];\n');
  event(root, 'MOVER', 'edit');
  const wt = join(root, '.worktrees', 'feat', 'busqueda');
  git(root, 'worktree', 'add', '-q', '-b', 'feat/busqueda', wt);
  write(wt, 'src/search.js', 'export const search = () => [];\n');
  event(wt, 'MOVER', 'edit');
  event(wt, 'MOVER', 'turn');

  assert.deepEqual(recordsIn(wt), [], 'no second store inside the worktree');
  const mine = recordsIn(root).filter((r) => r.sessionId === 'MOVER');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].worktree, wt, 'the one record follows the session into the worktree');
  assert.equal(mine[0].branch, 'feat/busqueda');

  // Nobody is working in the main checkout any more: a new session there is not told otherwise.
  event(root, 'NEXT', 'start');
  assert.doesNotMatch(contextOf(event(root, 'NEXT', 'request')), ISOLATION);

  // And its completion lands on that same record.
  event(wt, 'MOVER', 'end');
  assert.ok(recordsIn(root).find((r) => r.sessionId === 'MOVER').timestamps.completedAt);
  assert.deepEqual(recordsIn(wt), []);
});

test('W1 · edits into .worktrees/<b>/ by absolute path move the session even when its cwd stays put', () => {
  const root = teamProject();
  const wt = join(root, '.worktrees', 'feat', 'borrar');
  git(root, 'worktree', 'add', '-q', '-b', 'feat/borrar', wt);
  event(root, 'ABS', 'start');
  write(wt, 'src/delete.js', 'export const del = () => {};\n');
  event(root, 'ABS', 'edit', { tool_input: { file_path: join(wt, 'src', 'delete.js') } });
  event(root, 'ABS', 'turn'); // Stop carries no file: the move must stick

  const mine = recordsIn(root).find((r) => r.sessionId === 'ABS');
  assert.equal(mine.worktree, wt);
  event(root, 'OTHER', 'start');
  assert.doesNotMatch(contextOf(event(root, 'OTHER', 'request')), ISOLATION, 'the main checkout is free');
});

test('W1 · control: a session still editing the main checkout keeps isolating the next one', () => {
  const root = teamProject();
  event(root, 'STAY', 'start');
  write(root, 'src/tasks.js', 'export const tasks = [2];\n');
  event(root, 'STAY', 'edit');
  event(root, 'NEW', 'start');
  assert.match(contextOf(event(root, 'NEW', 'request')), ISOLATION);
});

// ── W2: presence before the first edit ──────────────────────────────────────────────────────────

test('W2 · a session that has only started is already visible to the next one in the same checkout', () => {
  const root = teamProject();
  event(root, 'EARLY', 'start', { prompt: 'PROMPT-CANARY-91' });
  event(root, 'EARLY', 'request', { prompt: 'PROMPT-CANARY-91' });
  event(root, 'LATE', 'start');
  const ctx = contextOf(event(root, 'LATE', 'request'));
  assert.match(ctx, ISOLATION, 'B must be told A is here, although A has edited nothing');

  // Privacy: presence says WHO, never WHAT.
  for (const file of allFiles(join(root, '.rsc', 'memory'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /PROMPT-CANARY-91/, file);
  }
  // A talk-only session does not become a record: resume would hand an empty one to the next session.
  assert.equal(recordsIn(root).filter((r) => r.sessionId === 'EARLY').length, 0);
});

test('W2 · once the first session ends, its presence is gone', () => {
  const root = teamProject();
  event(root, 'GONE', 'start');
  event(root, 'GONE', 'end');
  event(root, 'AFTER', 'start');
  assert.doesNotMatch(contextOf(event(root, 'AFTER', 'request')), ISOLATION);
});

test('W2 · a session never isolates itself', () => {
  const root = teamProject();
  event(root, 'SELF', 'start');
  assert.doesNotMatch(contextOf(event(root, 'SELF', 'request')), ISOLATION);
});

// ── W6 (D5): memory must not claim what a merge brought in ─────────────────────────────────────

test('W6 · after merging the trunk, done/files/next are the session’s own, not the teammates’', () => {
  const root = teamProject();
  // A teammate's work, already on the trunk.
  git(root, 'checkout', '-q', '-b', 'feat/orden');
  write(root, 'src/order.js', 'export const order = 1;\n');
  write(root, '02-DOCS/wiki/ftd/orden-tareas.md', '# Orden\n\n## Next\n\n- CARLA-NEXT ordenar por fecha\n');
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=carla@team.test', '-c', 'user.name=Carla', 'commit', '-q', '-m', 'CARLA-SUBJECT ordenación');
  git(root, 'checkout', '-q', 'main');
  git(root, 'checkout', '-q', '-b', 'feat/busqueda');
  event(root, 'MINE', 'start');
  write(root, 'src/search.js', 'export const search = 1;\n');
  write(root, '02-DOCS/wiki/ftd/busqueda.md', '# Búsqueda\n\n## Next\n\n- BRUNO-NEXT paginar\n');
  event(root, 'MINE', 'edit');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'BRUNO-SUBJECT búsqueda');
  git(root, 'merge', '-q', '--no-ff', 'feat/orden', '-m', 'Merge remote-tracking branch origin/main');
  event(root, 'MINE', 'turn');
  event(root, 'MINE', 'end');

  const record = recordsIn(root).find((r) => r.sessionId === 'MINE');
  // Its own commit and the merge it made (since the second team simulation) — never Carla's commit.
  assert.equal(record.commits.length, 2, `the session's commit and its merge, got ${record.commits.length}`);
  assert.deepEqual(record.files, ['02-DOCS/wiki/ftd/busqueda.md', 'src/search.js']);

  const ctx = contextOf(event(root, 'RESUMER', 'start'));
  assert.match(ctx, /BRUNO-SUBJECT/);
  assert.doesNotMatch(ctx, /CARLA-SUBJECT/, 'a teammate’s commit is not this session’s work');
  assert.match(ctx, /Merge remote-tracking/, 'the merge the session made is its work');
  assert.match(ctx, /BRUNO-NEXT/);
  assert.doesNotMatch(ctx, /CARLA-NEXT/, 'nor is the teammate’s next step');
});

// Second team simulation: a session that merged main and resolved the conflicts was recorded as «no
// commits, files: none», and the next session told the person nothing had been done.
test('W6b · a merge with resolved conflicts is the session’s work, and the resolved file is listed', () => {
  const root = teamProject();
  write(root, 'src/tasks.js', 'base\n');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  git(root, 'checkout', '-q', '-b', 'feat/otra');
  write(root, 'src/tasks.js', 'theirs\n');
  write(root, 'src/other.js', 'theirs only\n');
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=ana@team.test', '-c', 'user.name=Ana', 'commit', '-q', '-m', 'ANA-SUBJECT');
  git(root, 'checkout', '-q', 'main');
  git(root, 'checkout', '-q', '-b', 'feat/mia');
  write(root, 'src/tasks.js', 'mine\n');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'MINE-BEFORE');
  event(root, 'RESOLVER', 'start');
  spawnSync('git', ['merge', '-q', 'feat/otra', '-m', 'MERGE-SUBJECT'], { cwd: root });
  write(root, 'src/tasks.js', 'resolved\n');
  event(root, 'RESOLVER', 'edit');
  git(root, 'add', '-A'); git(root, 'commit', '-q', '--no-edit');
  event(root, 'RESOLVER', 'turn');
  const record = recordsIn(root).find((r) => r.sessionId === 'RESOLVER');
  assert.equal(record.commits.length, 1, 'the merge commit');
  assert.deepEqual(record.files, ['src/tasks.js'], 'what it resolved — not other.js, which only came in');
  const ctx = contextOf(event(root, 'NEXT', 'start'));
  assert.doesNotMatch(ctx, /done: no commits/);
  assert.doesNotMatch(ctx, /ANA-SUBJECT/);
});

