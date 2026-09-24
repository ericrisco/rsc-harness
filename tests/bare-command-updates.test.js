import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// Every update notice, the README, and three replies to real users said: run
// `npx @ericrisco/rsc@latest` — "that reinstalls and refreshes". In a project that already had a
// harness it opened the install WIZARD instead, and with no terminal (which is how an agent runs it
// when it obeys the notice) it did nothing at all. The fix lives in the CLI that npx downloads, so
// once published every notice already installed and every message already sent becomes true.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const ARGS = ['--technical-level', 'non-technical', '--accompaniment', 'L2', '--project-kind', 'software',
  '--software-scope', 'growing', '--goal', 'prueba', '--target', 'claude'];
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });

function equippedButStale() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-bare-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, 'app.py'), 'x = 1\n');
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, ['onboard', ...ARGS]).stdout)[1];
  run(cwd, ['onboard', ...ARGS, '--accept-plan', planId]);
  assert.ok(existsSync(join(cwd, '.rsc.json')), 'fixture: the harness is declared');
  // What an older install looks like from here: an older version stamp and an old hook body.
  writeFileSync(join(cwd, '.rsc', '.version'), '2.0.10\n');
  writeFileSync(join(cwd, '.rsc', 'session-memory-adapter.mjs'), '// stale adapter from 2.0.10\n');
  return cwd;
}

test('with no terminal, the bare command brings an equipped project up to date', { timeout: 300000 }, () => {
  const cwd = equippedButStale();
  const out = run(cwd, []);
  assert.equal(readFileSync(join(cwd, '.rsc', '.version'), 'utf8').trim(), VERSION, out.stdout.slice(-300));
  assert.doesNotMatch(readFileSync(join(cwd, '.rsc', 'session-memory-adapter.mjs'), 'utf8'), /stale adapter/,
    'the hooks must be re-materialized — that is the whole point of updating');
  assert.doesNotMatch(out.stdout, /Pick skills by hand/, 'no install menu for a project that only needs updating');
});

test('updating keeps the skills the project declared', { timeout: 300000 }, () => {
  const cwd = equippedButStale();
  const before = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).skills;
  run(cwd, []);
  const after = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).skills;
  assert.deepEqual(after, before);
});

test('control: a project with no harness still goes to onboarding', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-bare-none-'));
  execFileSync('git', ['init', '-q'], { cwd });
  const out = run(cwd, []);
  assert.match(out.stdout + out.stderr, /RSC_ONBOARDING_REQUIRED|onboard/);
  assert.equal(existsSync(join(cwd, '.rsc.json')), false, 'nothing is installed without onboarding');
});
