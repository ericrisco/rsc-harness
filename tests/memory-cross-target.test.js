import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { handleLifecycle, contextFromNativeOutput } from '../targets/memory.js';

const TARGETS = ['claude', 'codex', 'cursor', 'gemini', 'opencode'];
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cross-memory-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'file.txt'), 'base\n');
  git(cwd, ['add', 'file.txt']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

const native = (target, sessionId, cwd) => target === 'opencode'
  ? { sessionID: sessionId, cwd }
  : { session_id: sessionId, cwd, is_background_agent: false };

test('every local source record is consumable by every local destination adapter', () => {
  for (const source of TARGETS) {
    const cwd = repo();
    handleLifecycle({ target: source, event: 'start', native: native(source, `${source}-source`, cwd), cwd });
    writeFileSync(join(cwd, 'file.txt'), `${source}\n`);
    handleLifecycle({ target: source, event: 'edit', native: native(source, `${source}-source`, cwd), cwd });
    for (const destination of TARGETS) {
      const result = handleLifecycle({ target: destination, event: 'start', native: native(destination, `${destination}-from-${source}`, cwd), cwd });
      const context = contextFromNativeOutput(destination, result.output);
      assert.match(context, new RegExp(`source: ${source}/${source}-source`), `${source} -> ${destination}`);
    }
  }
});
