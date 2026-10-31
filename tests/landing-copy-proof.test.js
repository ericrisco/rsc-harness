import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('../skills/landing-copy/scripts/verify.sh', import.meta.url));
function check(copy) {
  const dir = mkdtempSync(join(tmpdir(), 'rsc-proof-'));
  try {
    const file = join(dir, 'landing copy.md');
    writeFileSync(file, copy);
    return spawnSync('bash', [script, file], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('a demonstration is a recognizable proof marker without fabricated testimonials', () => {
  const result = check('# Plan your project\nFor teams building apps.\n## Product demonstration\nInspect the plan before accepting it.\nStart your setup\n');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /1 file\(s\)/);
});
test('an unsupported claim alone is not a proof block, including paths with spaces', () => {
  const result = check('# Plan your project\nFor teams building apps.\nWorks perfectly every time.\nStart your setup\n');
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /no proof block/);
});
