import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const fresh = () => mkdtempSync(join(tmpdir(), 'rsc-onboard-cli-'));
const run = (cwd, args, input) => spawnSync(process.execPath, [CLI, ...args], { cwd, input, encoding: 'utf8' });
const complete = [
  '--technical-level', 'mixed', '--accompaniment', 'L1', '--project-kind', 'operations',
  '--goal', 'Run a small operations desk', '--target', 'codex',
];

test('fresh install and add cannot bypass onboarding or write files', () => {
  for (const args of [['install', '--profile', 'minimal', '--target', 'codex'], ['add', 'fastapi', '--target', 'codex']]) {
    const cwd = fresh();
    const result = run(cwd, args);
    assert.notEqual(result.status, 0, `${args[0]} must be rejected`);
    assert.match(result.stderr + result.stdout, /RSC_ONBOARDING_REQUIRED/);
    assert.deepEqual(readdirSync(cwd), []);
  }
});

test('non-interactive onboarding reports missing fields as JSON and writes nothing', () => {
  const cwd = fresh();
  const result = run(cwd, ['--target', 'codex']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /RSC_ONBOARDING_REQUIRED/);
  assert.match(result.stderr + result.stdout, /technical-level/);
  assert.deepEqual(readdirSync(cwd), []);
});

test('complete onboarding previews a canonical plan without writing and gives exact recovery', () => {
  const cwd = fresh();
  const result = run(cwd, ['onboard', ...complete]);
  assert.equal(result.status, 0, result.stderr);
  const output = result.stdout;
  assert.match(output, /RSC_ONBOARDING_PLAN/);
  const id = output.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.ok(id);
  assert.match(output, new RegExp(`--accept-plan ${id}`));
  assert.deepEqual(readdirSync(cwd), []);
});

test('acceptance recomputes the plan: wrong id writes nothing; exact id persists verified receipt', () => {
  const cwd = fresh();
  const preview = run(cwd, ['onboard', ...complete]);
  const id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  const wrong = run(cwd, ['onboard', ...complete, '--accept-plan', '0'.repeat(64)]);
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr + wrong.stdout, /RSC_PLAN_CHANGED/);
  assert.deepEqual(readdirSync(cwd), []);

  const accepted = run(cwd, ['onboard', ...complete, '--accept-plan', id]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /RSC_ONBOARDING_READY/);
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(manifest.onboarding.acceptedPlanId, id);
  assert.equal(manifest.onboarding.plan.policy.baseAgents, false);
  assert.ok(existsSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md')));
  assert.ok(!existsSync(join(cwd, '.codex/agents/developer.toml')));
  assert.ok(!existsSync(join(cwd, 'AGENTS.md')));

  const sync = run(cwd, ['sync', '--target', 'codex']);
  assert.equal(sync.status, 0, sync.stderr);
  const afterSync = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(afterSync.onboarding.acceptedPlanId, id);
  assert.ok(!existsSync(join(cwd, '.codex/agents/developer.toml')), 'sync preserves the no-base-agents policy');
  assert.ok(!existsSync(join(cwd, 'AGENTS.md')), 'sync preserves the no-code-hooks policy');
});

test('changing root evidence after preview invalidates acceptance', () => {
  const cwd = fresh();
  const preview = run(cwd, ['onboard', ...complete]);
  const id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  writeFileSync(join(cwd, 'notes.md'), 'new evidence');
  const accepted = run(cwd, ['onboard', ...complete, '--accept-plan', id]);
  assert.notEqual(accepted.status, 0);
  assert.match(accepted.stderr + accepted.stdout, /RSC_PLAN_CHANGED/);
  assert.ok(!existsSync(join(cwd, '.rsc.json')));
});
