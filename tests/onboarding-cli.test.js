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

test('a manifest without a verified receipt or installed state is not an existing harness', () => {
  for (const manifest of [{}, { version: 1, targets: [], skills: [], agents: [] }, { version: 1, targets: ['codex'], skills: ['orient'], agents: [] }]) {
    const cwd = fresh();
    writeFileSync(join(cwd, '.rsc.json'), JSON.stringify(manifest));
    const result = run(cwd, ['add', 'fastapi', '--target', 'codex']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /RSC_ONBOARDING_REQUIRED/);
    assert.equal(existsSync(join(cwd, '.codex')), false);
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
  assert.ok(existsSync(join(cwd, 'AGENTS.md')), 'operations retains the always-on profile/orient surface');
  const instructions = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  assert.match(instructions, /user-profile|orient|suggest/);
  assert.doesNotMatch(instructions, /feature intent goes through SDD|gitmoji/i);

  const sync = run(cwd, ['sync', '--target', 'codex']);
  assert.equal(sync.status, 0, sync.stderr);
  const afterSync = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(afterSync.onboarding.acceptedPlanId, id);
  assert.ok(!existsSync(join(cwd, '.codex/agents/developer.toml')), 'sync preserves the no-base-agents policy');
  assert.ok(existsSync(join(cwd, 'AGENTS.md')), 'sync preserves the always-on surface');
});

test('operations on Claude keeps SessionStart but omits feature, ship and gitmoji gates', () => {
  const cwd = fresh();
  const args = [
    '--technical-level', 'mixed', '--accompaniment', 'L1', '--project-kind', 'operations',
    '--goal', 'Run operations', '--target', 'claude',
  ];
  const preview = run(cwd, ['onboard', ...args]);
  const id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.equal(run(cwd, ['onboard', ...args, '--accept-plan', id]).status, 0);
  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.ok(settings.hooks.SessionStart?.length);
  assert.equal(settings.hooks.UserPromptSubmit, undefined);
  assert.equal(settings.hooks.PreToolUse, undefined);
  for (const name of ['ship-guard.mjs', 'gitmoji-guard.mjs', 'userprompt-gate.mjs']) {
    assert.ok(!existsSync(join(cwd, '.rsc', name)), name);
  }
});

test('re-onboarding from software to operations unwires previously installed code hooks', () => {
  const cwd = fresh();
  const software = ['--technical-level', 'mixed', '--accompaniment', 'L1', '--project-kind', 'software', '--software-scope', 'growing', '--goal', 'Build product', '--target', 'claude'];
  let preview = run(cwd, ['onboard', ...software]);
  let id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.equal(run(cwd, ['onboard', ...software, '--accept-plan', id]).status, 0);
  const operations = ['--technical-level', 'mixed', '--accompaniment', 'L1', '--project-kind', 'operations', '--goal', 'Run operations', '--target', 'claude'];
  preview = run(cwd, ['onboard', ...operations]);
  id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.equal(run(cwd, ['onboard', ...operations, '--accept-plan', id]).status, 0);
  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  assert.equal(settings.hooks.PreToolUse, undefined);
  assert.equal(settings.hooks.UserPromptSubmit, undefined);
});

test('preview inventories every RSC-owned applied route', () => {
  const cwd = fresh();
  const preview = run(cwd, ['onboard', ...complete]);
  assert.match(preview.stdout, /Managed paths:/);
  assert.match(preview.stdout, /\.rsc\.json/);
  assert.match(preview.stdout, /AGENTS\.md/);
  assert.match(preview.stdout, /02-DOCS\/wiki\/harness\/user-profile\.md/);
  assert.doesNotMatch(preview.stdout, /\/Volumes\/|\/private\/tmp\//);
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

test('reassess stays quiet until deferred evidence changes, then requires a new accepted plan', () => {
  const cwd = fresh();
  const software = [
    '--technical-level', 'mixed', '--accompaniment', 'L1', '--project-kind', 'software',
    '--software-scope', 'small', '--goal', 'Build one calculator', '--target', 'codex',
  ];
  const preview = run(cwd, ['onboard', ...software]);
  const id = preview.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.equal(run(cwd, ['onboard', ...software, '--accept-plan', id]).status, 0);
  const quiet = run(cwd, ['reassess']);
  assert.equal(quiet.status, 0, quiet.stderr);
  assert.match(quiet.stdout, /NO_CHANGE/);
  for (let i = 0; i < 6; i++) writeFileSync(join(cwd, `new-${i}.js`), 'export {};');
  const changed = run(cwd, ['reassess']);
  assert.equal(changed.status, 0, changed.stderr);
  assert.match(changed.stdout, /RSC_REASSESSMENT_RECOMMENDED/);
  assert.match(changed.stdout, /SDD|sdd/);
  assert.match(changed.stdout, /--software-scope growing/);
  assert.match(changed.stdout, /accept/i);
});
