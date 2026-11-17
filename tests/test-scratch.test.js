import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('a direct Node test run removes its fixtures and keeps unrelated temp files', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'rsc-scratch-check-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  writeFileSync(join(parent, 'keep'), 'another process owns this file');
  const env = { ...process.env, TMPDIR: parent, TMP: parent, TEMP: parent };
  delete env.NODE_TEST_CONTEXT;
  const file = fileURLToPath(new URL('./agents-md-shadow.test.js', import.meta.url));
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=the shadow body carries its marker|a project that cannot duplicate', file], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(readdirSync(parent), ['keep']);
});
