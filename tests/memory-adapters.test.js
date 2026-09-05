import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

let adapters = {};
try { adapters = await import('../targets/memory.js'); } catch { /* RED: adapter absent */ }

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-memory-adapter-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'file.txt'), 'base\n');
  git(cwd, ['add', 'file.txt']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

const fixture = (target) => JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'memory', `${target}-session-start.json`), 'utf8'));

test('five local adapters translate their versioned start fixture to native bounded context', () => {
  assert.equal(typeof adapters.handleLifecycle, 'function');
  for (const target of ['claude', 'codex', 'cursor', 'gemini', 'opencode']) {
    const cwd = repo();
    adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: `source-${target}`, cwd }, cwd });
    writeFileSync(join(cwd, 'file.txt'), `${target}\n`);
    adapters.handleLifecycle({ target: 'claude', event: 'edit', native: { session_id: `source-${target}`, cwd }, cwd });
    const native = { ...fixture(target), cwd };
    const result = adapters.handleLifecycle({ target, event: 'start', native, cwd });
    assert.equal(result.remote, false, target);
    assert.ok(adapters.contextFromNativeOutput(target, result.output).includes('exact continuation'), target);
    assert.ok(Buffer.byteLength(JSON.stringify(result.output)) < 5000, target);
  }
});

test('capture adapters ignore prompt, response, tool output and file content fields', () => {
  const cwd = repo();
  const sentinel = 'NATIVE_PRIVATE_SENTINEL_4eb1';
  adapters.handleLifecycle({ target: 'gemini', event: 'start', native: { session_id: 'private-adapter', cwd, prompt: sentinel }, cwd });
  writeFileSync(join(cwd, 'file.txt'), 'changed\n');
  const result = adapters.handleLifecycle({
    target: 'gemini', event: 'edit', cwd,
    native: { session_id: 'private-adapter', cwd, prompt: sentinel, prompt_response: sentinel, tool_output: sentinel, file_content: sentinel },
  });
  assert.ok(!readFileSync(result.capture.path, 'utf8').includes(sentinel));
});

test('a later boundary without metrics does not erase an observed metric', () => {
  const cwd = repo();
  adapters.handleLifecycle({ target: 'codex', event: 'start', native: { session_id: 'metrics-adapter', cwd }, cwd });
  writeFileSync(join(cwd, 'file.txt'), 'changed\n');
  adapters.handleLifecycle({ target: 'codex', event: 'edit', native: { session_id: 'metrics-adapter', cwd, cost: 1.5, tool_calls: 3 }, cwd });
  const later = adapters.handleLifecycle({ target: 'codex', event: 'turn', native: { session_id: 'metrics-adapter', cwd }, cwd });
  assert.equal(later.capture.record.cost, 1.5);
  assert.equal(later.capture.record.toolCalls, 3);
});

test('disabled memory and Cursor background agents produce zero context and zero writes', () => {
  const cwd = repo();
  const off = adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: 'off', cwd }, cwd, settings: { enabled: false } });
  assert.deepEqual(off.output, {});
  assert.equal(off.capture, null);

  const cloud = adapters.handleLifecycle({ target: 'cursor', event: 'start', native: { session_id: 'cloud', is_background_agent: true }, cwd });
  assert.deepEqual(cloud.output, {});
  assert.equal(cloud.remote, true);
  assert.equal(cloud.capture, null);
});

test('adapter failures are fail-open and never block the host session', () => {
  const result = adapters.handleLifecycle({ target: 'unknown', event: 'start', native: Object.create(null), cwd: '/path/that/does/not/exist' });
  assert.deepEqual(result.output, {});
  assert.equal(result.degraded, true);
});

test('the command adapter consumes native stdin and emits only target-native JSON', () => {
  for (const target of ['claude', 'codex', 'cursor', 'gemini', 'opencode']) {
    const cwd = repo();
    adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: `seed-${target}`, cwd }, cwd });
    writeFileSync(join(cwd, 'file.txt'), 'changed\n');
    adapters.handleLifecycle({ target: 'claude', event: 'edit', native: { session_id: `seed-${target}`, cwd }, cwd });
    const native = { ...fixture(target), cwd };
    const stdout = execFileSync(process.execPath, [join(process.cwd(), 'targets', 'session-memory-adapter.mjs'), target, 'start'], {
      cwd,
      input: JSON.stringify(native),
      encoding: 'utf8',
    });
    const output = JSON.parse(stdout);
    assert.ok(adapters.contextFromNativeOutput(target, output).includes('exact continuation'), target);
  }
});

// A container harness (the directory holding `.rsc.json`) governs child repos that have no harness of
// their own. The hook payload's `cwd` is wherever the tool call happened to run — inside a child, often —
// and that is not the project's identity. Anchoring the journal there scatters memory across children.
function containerWithChild({ childHarness = false } = {}) {
  const container = repo();
  writeFileSync(join(container, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [] }));
  const child = join(container, 'child');
  execFileSync('git', ['init', '-q', child]);
  git(child, ['config', 'user.name', 'Test']);
  git(child, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(child, 'file.txt'), 'child\n');
  git(child, ['add', 'file.txt']);
  git(child, ['commit', '-qm', 'child initial']);
  if (childHarness) writeFileSync(join(child, '.rsc.json'), JSON.stringify({ version: 1, targets: ['claude'], skills: [] }));
  return { container, child };
}
const anchorAt = (root, id) => join(root, '.rsc', 'memory', 'anchors', `claude--${id}.json`);

test('a tool call inside a child repo anchors memory in the nearest harness, not in the child', () => {
  const { container, child } = containerWithChild();
  const id = 'container-governs-child';
  const result = adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: id, cwd: child } });
  assert.equal(result.degraded, false, result.error);
  assert.ok(existsSync(anchorAt(container, id)), 'anchor belongs to the harness that owns the session');
  assert.ok(!existsSync(join(child, '.rsc')), 'nothing is written into a child that has no harness');
});

test('a child with its own .rsc.json is its own project — the nearest harness wins', () => {
  const { container, child } = containerWithChild({ childHarness: true });
  const id = 'child-has-own-harness';
  adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: id, cwd: child } });
  assert.ok(existsSync(anchorAt(child, id)), 'the child harness is the project');
  assert.ok(!existsSync(anchorAt(container, id)), 'the container is not consulted past a nearer harness');
});

test('with no .rsc.json anywhere above, the payload cwd is still the project (unchanged behaviour)', () => {
  const cwd = repo();
  const id = 'no-harness-anywhere';
  adapters.handleLifecycle({ target: 'claude', event: 'start', native: { session_id: id, cwd } });
  assert.ok(existsSync(anchorAt(cwd, id)));
});
