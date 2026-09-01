import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY = join(ROOT, 'skills', 'motion-craft', 'scripts', 'verify.sh');
const SKILL = join(ROOT, 'skills', 'motion-craft', 'SKILL.md');

function run(css) {
  const d = mkdtempSync(join(tmpdir(), 'motion-rules-'));
  writeFileSync(join(d, 'app.css'), css);
  try {
    return execFileSync('bash', [VERIFY, d], { encoding: 'utf8' });
  } catch (e) {
    return e.stdout || '';
  }
}

// One row per hard rule in the skill body. Each is seen to FAIL on a violation and
// PASS on the clean version — a gate never seen to fail is not known to work.
const RULES = [
  {
    id: 'transition-all',
    dirty: '.a { transition: all 200ms ease-out; }',
    clean: '.a { transition: opacity 200ms ease-out, transform 200ms ease-out; }',
  },
  {
    id: 'layout-anim',
    dirty: '.a { transition: width 200ms ease-out; }',
    clean: '.a { transition: transform 200ms ease-out; }',
  },
  {
    id: 'linear-move',
    dirty: '.a { transition: transform 200ms linear; }',
    clean: '.a { transition: transform 200ms ease-out; }',
  },
  {
    id: 'long-duration',
    dirty: '.a { transition: opacity 800ms ease-out; }',
    clean: '.a { transition: opacity 200ms ease-out; }',
  },
];

for (const r of RULES) {
  test(`${r.id}: fires on the violation`, () => {
    assert.match(run(r.dirty), new RegExp(`⚠\\s+${r.id}:`), 'the rule must be seen to fail');
  });
  test(`${r.id}: silent on the clean version`, () => {
    assert.match(run(r.clean), new RegExp(`✓\\s+${r.id}`), 'and to pass, or it only ever says no');
  });
}

test('reduced-motion: a project that animates and never mentions it is flagged', () => {
  assert.match(run('.a { transition: opacity 200ms ease-out; }'), /reduced-motion:.*never mentions/);
});

test('reduced-motion: honoured means no finding', () => {
  const out = run('.a { transition: opacity 200ms ease-out; }\n@media (prefers-reduced-motion: reduce) { .a { transition: none; } }');
  assert.match(out, /✓\s+reduced-motion/);
});

test('--strict turns findings into a non-zero exit', () => {
  const d = mkdtempSync(join(tmpdir(), 'motion-strict-'));
  writeFileSync(join(d, 'app.css'), '.a { transition: all 200ms; }');
  let code = 0;
  try { execFileSync('bash', [VERIFY, d, '--strict'], { encoding: 'utf8' }); } catch (e) { code = e.status; }
  assert.equal(code, 1, 'without this, --strict is a flag that promises a gate and delivers none');
});

test('a project with nothing to check is not a failure', () => {
  const d = mkdtempSync(join(tmpdir(), 'motion-empty-'));
  assert.doesNotThrow(() => execFileSync('bash', [VERIFY, d, '--strict'], { encoding: 'utf8' }));
});

// The registry and the prose must not drift apart: a rule the skill declares binding
// with no row here is the decorative gate this file exists to prevent.
test('every never-animate rule in the body has a row in the verifier', () => {
  const script = readFileSync(VERIFY, 'utf8');
  const body = readFileSync(SKILL, 'utf8');
  for (const r of RULES) assert.ok(script.includes(`"${r.id}\\t`), `${r.id} missing from the registry`);
  assert.match(body, /## What must never animate/, 'the prose section the registry answers to');
  assert.match(body, /transition: all/, 'the prose must still state the rule the registry checks');
});
