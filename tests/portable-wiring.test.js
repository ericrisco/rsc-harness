import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { handleLifecycle } from '../targets/memory.js';

let adapters = {};
try { adapters = await import('../targets/memory.js'); } catch { /* RED: adapter absent */ }

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-memory-wiring-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'README.md'), 'base\n');
  git(cwd, ['add', 'README.md']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

test('memory support is explicit and Cursor is assisted because start is fire-and-forget', () => {
  assert.deepEqual(adapters.MEMORY_TARGETS, {
    claude: 'full', codex: 'full', cursor: 'assisted', gemini: 'full', opencode: 'full',
  });
  assert.equal(adapters.memoryModeFor('windsurf'), 'unsupported');
});

test('each supported target wires only ignored project-local files with no network code', () => {
  for (const target of Object.keys(adapters.MEMORY_TARGETS)) {
    const cwd = repo();
    const result = adapters.wireMemory(target, cwd);
    assert.equal(result.mode, adapters.MEMORY_TARGETS[target], target);
    for (const path of result.paths) {
      assert.ok(existsSync(path), `${target}: ${path}`);
      assert.equal(git(cwd, ['ls-files', '--', relative(cwd, path)]), '', `${target}: untracked`);
      assert.equal(git(cwd, ['check-ignore', relative(cwd, path)]), relative(cwd, path), `${target}: ignored`);
    }
    const source = result.paths.filter((path) => /\.(?:mjs|js)$/u.test(path)).map((path) => readFileSync(path, 'utf8')).join('\n');
    assert.doesNotMatch(source, /\b(?:fetch|https?:|node:(?:http|https|net|tls))\b/u, `${target}: local only`);
  }
});

test('tracked or user-owned config is never overwritten to pretend local-only support', () => {
  const cwd = repo();
  mkdirSync(join(cwd, '.gemini'), { recursive: true });
  const config = join(cwd, '.gemini', 'settings.json');
  writeFileSync(config, '{"theme":"user"}\n');
  git(cwd, ['add', '.gemini/settings.json']);
  git(cwd, ['commit', '-qm', 'user config']);
  const before = readFileSync(config, 'utf8');
  const result = adapters.wireMemory('gemini', cwd);
  assert.equal(result.mode, 'degraded');
  assert.equal(result.reason, 'config-tracked');
  assert.equal(readFileSync(config, 'utf8'), before);
});

test('unwire removes only rsc entries and preserves a neighboring user hook', () => {
  const cwd = repo();
  mkdirSync(join(cwd, '.codex'), { recursive: true });
  const config = join(cwd, '.codex', 'hooks.json');
  writeFileSync(config, JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node user-hook.mjs' }] }] } }, null, 2));
  adapters.wireMemory('codex', cwd);
  adapters.unwireMemory('codex', cwd);
  const body = readFileSync(config, 'utf8');
  assert.match(body, /user-hook\.mjs/);
  assert.doesNotMatch(body, /session-memory-adapter/);
});

test('the OpenCode plugin mutates the first system block before the model and keeps sessions separate', async () => {
  const cwd = repo();
  const result = adapters.wireMemory('opencode', cwd);
  const plugin = result.paths.find((path) => path.endsWith('.opencode/plugins/rsc-memory.js'));
  const body = readFileSync(plugin, 'utf8');
  assert.match(body, /experimental\.chat\.system\.transform/);
  assert.match(body, /output\.system\[0\]/);
  assert.match(body, /session\.idle/);
  assert.match(body, /experimental\.session\.compacting/);

  handleLifecycle({ target: 'claude', event: 'start', native: { session_id: 'plugin-seed', cwd }, cwd });
  writeFileSync(join(cwd, 'README.md'), 'changed\n');
  handleLifecycle({ target: 'claude', event: 'edit', native: { session_id: 'plugin-seed', cwd }, cwd });
  const module = await import(`${pathToFileURL(plugin).href}?test=${Date.now()}`);
  const hooks = await module.RscMemoryPlugin({ directory: cwd, worktree: cwd });
  const output = { system: ['base system'] };
  await hooks['experimental.chat.system.transform']({ sessionID: 'plugin-destination' }, output);
  assert.equal(output.system.length, 1);
  assert.match(output.system[0], /exact continuation/);
});
