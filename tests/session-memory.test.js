import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

let memory = {};
try { memory = await import('../targets/session-memory-core.mjs'); } catch { /* RED: core absent */ }

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-memory-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'README.md'), 'one\n');
  git(cwd, ['add', 'README.md']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

test('an early boundary records real work before SessionEnd and a quiet session does not', () => {
  assert.equal(typeof memory.capture, 'function');
  const cwd = repo();
  const startedAt = '2026-09-02T10:00:00.000Z';
  const quiet = memory.capture({ cwd, sessionId: 'quiet', target: 'claude', event: 'start', now: startedAt });
  assert.equal(quiet.record, null);
  assert.equal(readdirSync(join(memory.chooseMemoryRoot(cwd).root, 'sessions')).length, 0);

  memory.capture({ cwd, sessionId: 'active', target: 'claude', event: 'start', now: startedAt });
  writeFileSync(join(cwd, 'README.md'), 'two\n');
  const early = memory.capture({ cwd, sessionId: 'active', target: 'claude', event: 'edit', editDelta: 1, now: '2026-09-02T10:01:00.000Z' });
  assert.equal(early.record.target, 'claude');
  assert.deepEqual(early.record.files, ['README.md']);
  assert.equal(early.record.commits.length, 0);

  git(cwd, ['add', 'README.md']);
  git(cwd, ['commit', '-qm', 'change']);
  const afterCommit = memory.capture({ cwd, sessionId: 'active', target: 'claude', event: 'turn', now: '2026-09-02T10:02:00.000Z' });
  assert.equal(afterCommit.record.commits.length, 1);
  assert.equal(afterCommit.record.head, git(cwd, ['rev-parse', 'HEAD']));
});

test('a quiet session does not claim dirty files that predate its start', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'README.md'), 'already dirty\n');
  memory.capture({ cwd, sessionId: 'quiet-dirty', target: 'claude', event: 'start' });
  const boundary = memory.capture({ cwd, sessionId: 'quiet-dirty', target: 'claude', event: 'request' });
  assert.equal(boundary.record, null);
  assert.deepEqual(readdirSync(join(memory.chooseMemoryRoot(cwd).root, 'sessions')), []);
});

test('a later edit to a file already dirty at session start is still recorded', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'README.md'), 'already dirty\n');
  memory.capture({ cwd, sessionId: 'dirty-edited', target: 'claude', event: 'start' });
  writeFileSync(join(cwd, 'README.md'), 'edited during session\n');
  const boundary = memory.capture({ cwd, sessionId: 'dirty-edited', target: 'claude', event: 'request' });
  assert.deepEqual(boundary.record.files, ['README.md']);
});

test('a rename records both repository paths', () => {
  const cwd = repo();
  memory.capture({ cwd, sessionId: 'rename', target: 'codex', event: 'start' });
  git(cwd, ['mv', 'README.md', 'GUIDE.md']);
  const result = memory.capture({ cwd, sessionId: 'rename', target: 'codex', event: 'boundary' });
  assert.deepEqual(result.record.files, ['GUIDE.md', 'README.md']);
});

test('resume selects exact branch/worktree, labels nearby and flags parallel sessions', () => {
  const cwd = repo();
  memory.capture({ cwd, sessionId: 'one', target: 'claude', event: 'start', now: '2026-09-02T10:00:00.000Z' });
  writeFileSync(join(cwd, 'README.md'), 'changed\n');
  memory.capture({ cwd, sessionId: 'one', target: 'claude', event: 'edit', editDelta: 1, now: '2026-09-02T10:01:00.000Z' });
  memory.capture({ cwd, sessionId: 'two', target: 'codex', event: 'start', now: '2026-09-02T10:01:30.000Z' });
  memory.capture({ cwd, sessionId: 'two', target: 'codex', event: 'edit', editDelta: 1, now: '2026-09-02T10:02:00.000Z' });

  const exact = memory.resume({ cwd, target: 'gemini', now: '2026-09-02T10:03:00.000Z' });
  assert.equal(exact.match, 'exact');
  assert.equal(exact.record.sessionId, 'two');
  assert.equal(exact.record.concurrent, true);
  assert.match(exact.context, /exact continuation/);

  git(cwd, ['checkout', '-qb', 'other']);
  const nearby = memory.resume({ cwd, target: 'opencode', now: '2026-09-02T10:04:00.000Z' });
  assert.equal(nearby.match, 'nearby');
  assert.match(nearby.context, /nearby continuation/);
});

test('provider session-id namespaces cannot overwrite one another', () => {
  const cwd = repo();
  memory.capture({ cwd, sessionId: 'same-id', target: 'claude', event: 'start' });
  writeFileSync(join(cwd, 'README.md'), 'changed\n');
  memory.capture({ cwd, sessionId: 'same-id', target: 'claude', event: 'edit', editDelta: 1 });
  memory.capture({ cwd, sessionId: 'same-id', target: 'codex', event: 'start' });
  memory.capture({ cwd, sessionId: 'same-id', target: 'codex', event: 'edit', editDelta: 1 });
  const files = readdirSync(join(memory.chooseMemoryRoot(cwd).root, 'sessions')).filter((name) => name.endsWith('.json')).sort();
  assert.deepEqual(files, ['claude--same-id.json', 'codex--same-id.json']);
  const codex = JSON.parse(readFileSync(join(memory.chooseMemoryRoot(cwd).root, 'sessions', 'codex--same-id.json'), 'utf8'));
  assert.equal(codex.concurrent, true, 'same provider id does not make two assistants one session');
});

test('retention pruning, bounded rendering and compaction hints are deterministic', () => {
  const cwd = repo();
  memory.capture({ cwd, sessionId: 'old', target: 'cursor', event: 'start', now: '2026-07-01T00:00:00.000Z' });
  writeFileSync(join(cwd, 'README.md'), 'old\n');
  memory.capture({ cwd, sessionId: 'old', target: 'cursor', event: 'edit', editDelta: 1, now: '2026-07-01T00:01:00.000Z' });

  memory.capture({ cwd, sessionId: 'new', target: 'cursor', event: 'start', now: '2026-09-02T00:00:00.000Z' });
  const current = memory.capture({
    cwd, sessionId: 'new', target: 'cursor', event: 'edit', editDelta: 3,
    settings: { editThreshold: 3, contextBytes: 180 }, now: '2026-09-02T00:01:00.000Z',
  });
  assert.equal(current.compactionHint, true);
  const root = memory.chooseMemoryRoot(cwd).root;
  assert.deepEqual(readdirSync(join(root, 'sessions')).filter((name) => name.endsWith('.json')), ['cursor--new.json']);
  const resumed = memory.resume({ cwd, settings: { contextBytes: 180 }, now: '2026-09-02T00:02:00.000Z' });
  assert.ok(Buffer.byteLength(resumed.context) <= 180);
});

test('approved lessons cross targets above threshold; unapproved lessons never write', () => {
  const cwd = repo();
  const rejected = memory.learn({ cwd, text: 'Prefer table-driven tests.', evidence: 'Repeated correction', scope: 'project', confidence: 0.9, approved: false });
  assert.equal(rejected.saved, false);

  const low = memory.learn({ cwd, text: 'Keep names short.', evidence: 'One occurrence', scope: 'project', confidence: 0.4, approved: true, now: '2026-09-02T09:00:00.000Z' });
  const high = memory.learn({ cwd, text: 'Prefer table-driven tests.', evidence: 'Three reviewed changes', scope: 'project', confidence: 0.9, approved: true, now: '2026-09-02T09:01:00.000Z' });
  assert.equal(low.saved, true);
  assert.equal(high.saved, true);

  memory.capture({ cwd, sessionId: 'lesson-run', target: 'claude', event: 'start', now: '2026-09-02T09:02:00.000Z' });
  writeFileSync(join(cwd, 'README.md'), 'lesson\n');
  memory.capture({ cwd, sessionId: 'lesson-run', target: 'claude', event: 'edit', editDelta: 1, now: '2026-09-02T09:03:00.000Z' });
  const result = memory.resume({ cwd, target: 'codex', now: '2026-09-02T09:04:00.000Z' });
  assert.equal(result.lessons.length, 1);
  assert.equal(result.lessons[0].text, 'Prefer table-driven tests.');
});

test('approved lessons inject even before the project has a session journal', () => {
  const cwd = repo();
  memory.learn({ cwd, text: 'Keep migrations reversible.', evidence: 'Approved architecture review', scope: 'project', confidence: 0.95, approved: true });
  const result = memory.resume({ cwd, target: 'claude' });
  assert.equal(result.match, 'none');
  assert.match(result.context, /approved lessons/);
  assert.match(result.context, /Keep migrations reversible/);
});

test('metrics preserve unknown as null and never invent zero totals', () => {
  const cwd = repo();
  for (const [sessionId, cost, toolCalls, minute] of [['a', null, null, '01'], ['b', 1.25, 4, '02'], ['c', 2.75, null, '03']]) {
    memory.capture({ cwd, sessionId, target: 'gemini', event: 'start', now: `2026-09-02T10:${minute}:00.000Z` });
    writeFileSync(join(cwd, 'README.md'), `${sessionId}\n`);
    memory.capture({ cwd, sessionId, target: 'gemini', event: 'edit', editDelta: 1, cost, toolCalls, now: `2026-09-02T10:${minute}:30.000Z` });
  }
  const summary = memory.metricsSummary({ cwd, now: '2026-09-02T11:00:00.000Z' });
  assert.deepEqual(summary.total, { cost: null, toolCalls: null });
  assert.deepEqual(summary.knownTotal, { cost: 4, toolCalls: 4 });
  assert.deepEqual(summary.unknown, { cost: 1, toolCalls: 2 });
  assert.equal(summary.sessions.find((row) => row.sessionId === 'a').cost, null);
});

test('an empty metrics ledger reports unknown totals, not synthetic zero cost', () => {
  const cwd = repo();
  const summary = memory.metricsSummary({ cwd });
  assert.deepEqual(summary.total, { cost: null, toolCalls: null });
});

test('without git the record is useful but explicitly has no branch or commits', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-memory-no-git-'));
  writeFileSync(join(cwd, 'file.txt'), 'x');
  const result = memory.capture({ cwd, sessionId: 'plain', target: 'opencode', event: 'save', editDelta: 1 });
  assert.equal(result.record.branch, null);
  assert.deepEqual(result.record.commits, []);
  assert.match(result.notice, /without git/i);
});

test('the local CLI exposes machine-readable status without a network dependency', () => {
  const cwd = repo();
  const stdout = execFileSync(process.execPath, [join(process.cwd(), 'targets', 'session-memory.mjs'), 'status'], {
    cwd,
    env: { ...process.env, RSC_PROJECT_CWD: cwd },
    input: '{}',
    encoding: 'utf8',
  });
  const status = JSON.parse(stdout);
  assert.equal(status.enabled, true);
  assert.equal(status.sessions, 0);
  assert.ok(['wiki-worklog', 'local-state'].includes(status.kind));
});
