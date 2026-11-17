import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('a direct test run under inherited Claude instructions passes and cleans only its fixtures', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'rsc-scratch-check-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  writeFileSync(join(parent, 'CLAUDE.md'), 'developer instructions');
  const scratch = join(parent, 'tmp');
  mkdirSync(scratch);
  writeFileSync(join(scratch, 'keep'), 'another process owns this file');
  const env = { ...process.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch };
  delete env.NODE_TEST_CONTEXT;
  const file = fileURLToPath(new URL('./agents-md-shadow.test.js', import.meta.url));
  const result = spawnSync(process.execPath, ['--test', file], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(readdirSync(scratch), ['keep']);
});
