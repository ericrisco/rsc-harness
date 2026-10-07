import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// E2E defect 10: `rsc uninstall` with no id printed "Removed: (nothing)" and exited 0, `--help` was
// swallowed as if it were an id, and `rsc help` was an unknown command. A command that did nothing
// must not look like one that succeeded, and asking for help must never run the command.

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
const fresh = () => mkdtempSync(join(tmpdir(), 'rsc-usage-'));

test('uninstall with no id is a usage error that names purge for a full removal', () => {
  const r = run(fresh(), ['uninstall']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const out = r.stdout + r.stderr;
  assert.doesNotMatch(out, /Removed:/);
  assert.match(out, /uninstall <id/);
  assert.match(out, /purge/);
});

test('uninstall --help and -h print usage, exit 0, and remove nothing', () => {
  for (const flag of ['--help', '-h']) {
    const cwd = fresh();
    const r = run(cwd, ['uninstall', flag]);
    assert.equal(r.status, 0, `${flag}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /uninstall <id/);
    assert.doesNotMatch(r.stdout + r.stderr, /Removed:|unknown skill/);
    assert.deepEqual(readdirSync(cwd), []);
  }
});

test('rsc help, --help and -h print the general help and exit 0 without onboarding', () => {
  for (const args of [['help'], ['--help'], ['-h']]) {
    const cwd = fresh();
    const r = run(cwd, args);
    assert.equal(r.status, 0, `${args}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /Use: npx @ericrisco\/rsc/);
    assert.match(r.stdout, /purge/);
    assert.doesNotMatch(r.stdout + r.stderr, /unknown command|RSC_ONBOARDING_REQUIRED/);
    assert.deepEqual(readdirSync(cwd), []);
  }
});

test('purge --help never purges', () => {
  const cwd = fresh();
  const r = run(cwd, ['purge', '--help']);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /Removed \d+/);
  assert.match(r.stdout, /purge/);
});
