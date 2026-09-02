import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

let memory = {};
try { memory = await import('../targets/session-memory-core.mjs'); } catch { /* RED: core absent */ }

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-private-memory-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'safe.txt'), 'base\n');
  git(cwd, ['add', 'safe.txt']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

test('the persisted session schema is closed and ignores conversational sentinels', () => {
  assert.equal(typeof memory.validateSessionRecord, 'function');
  const cwd = repo();
  const promptSentinel = 'PROMPT_SENTINEL_97fd';
  const responseSentinel = 'RESPONSE_SENTINEL_a411';
  memory.capture({ cwd, sessionId: 'private', target: 'codex', event: 'start', prompt: promptSentinel, response: responseSentinel });
  writeFileSync(join(cwd, 'safe.txt'), 'changed\n');
  const result = memory.capture({
    cwd, sessionId: 'private', target: 'codex', event: 'edit', editDelta: 1,
    prompt: promptSentinel, response: responseSentinel, toolOutput: 'TOOL_SENTINEL_ff9a', fileContent: 'FILE_SENTINEL_71ac',
  });
  const raw = readFileSync(result.path, 'utf8');
  for (const sentinel of [promptSentinel, responseSentinel, 'TOOL_SENTINEL_ff9a', 'FILE_SENTINEL_71ac']) assert.ok(!raw.includes(sentinel));
  assert.deepEqual(memory.validateSessionRecord(JSON.parse(raw)), []);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), [...memory.SESSION_RECORD_FIELDS].sort());

  const mutant = { ...JSON.parse(raw), prompt: promptSentinel };
  assert.ok(memory.validateSessionRecord(mutant).some((error) => /prompt|unknown field/.test(error)));
});

test('a tracked worklog falls back to local state, remains ignored and warns once', () => {
  const cwd = repo();
  const worklog = join(cwd, '02-DOCS', 'raw', 'worklog');
  mkdirSync(worklog, { recursive: true });
  writeFileSync(join(worklog, 'tracked.md'), 'tracked\n');
  git(cwd, ['add', '02-DOCS/raw/worklog/tracked.md']);
  git(cwd, ['commit', '-qm', 'track worklog']);

  const chosen = memory.chooseMemoryRoot(cwd);
  assert.equal(chosen.kind, 'local-state');
  assert.equal(chosen.root, join(cwd, '.rsc', 'memory'));
  memory.capture({ cwd, sessionId: 'fallback', target: 'cursor', event: 'start' });
  writeFileSync(join(cwd, 'safe.txt'), 'changed\n');
  const first = memory.capture({ cwd, sessionId: 'fallback', target: 'cursor', event: 'edit', editDelta: 1 });
  const second = memory.capture({ cwd, sessionId: 'fallback', target: 'cursor', event: 'turn' });
  assert.match(first.notice, /tracked worklog/i);
  assert.equal(second.notice, null);
  assert.equal(git(cwd, ['check-ignore', relative(cwd, first.path)]), relative(cwd, first.path));
  assert.equal(git(cwd, ['ls-files', '--', relative(cwd, first.path)]), '');
});

test('an untracked wiki worklog is preferred and protected by the local exclude', () => {
  const cwd = repo();
  mkdirSync(join(cwd, '02-DOCS', 'raw', 'worklog'), { recursive: true });
  const chosen = memory.chooseMemoryRoot(cwd);
  assert.equal(chosen.kind, 'wiki-worklog');
  assert.ok(chosen.root.endsWith('02-DOCS/raw/worklog/.rsc-memory'));
  const probe = join(relative(cwd, chosen.root), 'probe.json');
  assert.equal(git(cwd, ['check-ignore', probe]), probe);
});

test('secret-shaped lesson fields are rejected rather than persisted', () => {
  const cwd = repo();
  const result = memory.learn({
    cwd, approved: true, scope: 'project', confidence: 0.9,
    text: 'Use sk-live-secret-value-123456789 in tests.', evidence: 'review',
  });
  assert.equal(result.saved, false);
  assert.match(result.reason, /secret/i);
  const lessons = join(memory.chooseMemoryRoot(cwd).root, 'lessons');
  assert.equal(existsSync(lessons) ? readdirSync(lessons).filter((name) => name.endsWith('.json')).length : 0, 0);
});
