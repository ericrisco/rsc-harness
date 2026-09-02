import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { applyInstall } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';
import { agentPath } from '../targets/agents.js';
import { commandPath } from '../targets/commands.js';
import { capabilities } from '../scripts/lib/capabilities.js';
import { doctor } from '../scripts/doctor.js';
import { capture } from '../targets/session-memory-core.mjs';

const CLI = join(process.cwd(), 'scripts', 'rsc.js');
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-memory-integration-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  writeFileSync(join(cwd, 'README.md'), 'base\n');
  git(cwd, ['add', 'README.md']);
  git(cwd, ['commit', '-qm', 'initial']);
  return cwd;
}

test('install makes memory, its commands and its capability report agree', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['go', 'plan'], target: 'cursor', home: cwd, cwd });
  const state = JSON.parse(readFileSync(targetPaths('cursor', cwd, cwd).stateFile, 'utf8'));
  assert.equal(state.memory.mode, 'assisted');
  for (const name of ['learn', 'save-session', 'resume-session']) assert.ok(state.commands.includes(name));

  const caps = capabilities({ target: 'cursor', home: cwd, cwd });
  assert.equal(caps.commandsSupported, true);
  assert.ok(caps.commands.some((command) => command.id === 'go-review'));
  assert.equal(caps.memory.mode, 'assisted');
  assert.equal(caps.memory.status, 'ready');

  const report = doctor({ target: 'cursor', home: cwd, cwd });
  assert.equal(report.memory.mode, 'assisted');
  assert.equal(report.memory.status, 'ready');
  assert.deepEqual(report.commandOrphans, []);
  assert.deepEqual(report.missingCommands, []);
});

test('doctor reports a command whose agent backing disappeared and a command file deleted by hand', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['go', 'plan'], target: 'cursor', home: cwd, cwd });
  rmSync(agentPath('cursor', cwd, 'go-reviewer'));
  rmSync(commandPath('cursor', cwd, 'plan'));
  const report = doctor({ target: 'cursor', home: cwd, cwd });
  assert.ok(report.commandOrphans.some((entry) => entry.id === 'go-review' && /install|sync/.test(entry.action)));
  assert.ok(report.missingCommands.some((entry) => entry.id === 'plan' && /sync/.test(entry.action)));
});

test('a tracked lifecycle config degrades honestly and installs no memory commands', async () => {
  const cwd = repo();
  mkdirSync(join(cwd, '.gemini'), { recursive: true });
  writeFileSync(join(cwd, '.gemini', 'settings.json'), '{"theme":"mine"}\n');
  git(cwd, ['add', '.gemini/settings.json']);
  git(cwd, ['commit', '-qm', 'tracked settings']);
  await applyInstall({ skillIds: ['plan'], target: 'gemini', home: cwd, cwd });
  const state = JSON.parse(readFileSync(targetPaths('gemini', cwd, cwd).stateFile, 'utf8'));
  assert.equal(state.memory.mode, 'degraded');
  assert.ok(!state.commands.includes('learn'));
  assert.equal(doctor({ target: 'gemini', home: cwd, cwd }).memory.status, 'degraded');
});

test('doctor summarizes nullable cost without turning unknown into zero', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['plan'], target: 'claude', home: cwd, cwd });
  capture({ cwd, sessionId: 'metric', target: 'claude', event: 'start' });
  writeFileSync(join(cwd, 'README.md'), 'changed\n');
  capture({ cwd, sessionId: 'metric', target: 'claude', event: 'edit', editDelta: 1, cost: null, toolCalls: null });
  const metrics = doctor({ target: 'claude', home: cwd, cwd }).memory.metrics;
  assert.equal(metrics.sessions[0].cost, null);
  assert.equal(metrics.total.cost, null);
  assert.equal(metrics.unknown.cost, 1);
});

test('doctor degrades a wired adapter whose local script disappears', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['plan'], target: 'claude', home: cwd, cwd });
  rmSync(join(cwd, '.rsc', 'session-memory-adapter.mjs'));
  const memory = doctor({ target: 'claude', home: cwd, cwd }).memory;
  assert.equal(memory.status, 'degraded');
  assert.ok(memory.missing.some((path) => path.endsWith('session-memory-adapter.mjs')));
  assert.match(memory.action, /sync/);
});

test('one project option disables and re-enables every memory surface through the CLI', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['plan'], target: 'claude', home: cwd, cwd });
  const env = { ...process.env, HOME: cwd };
  const off = spawnSync(process.execPath, [CLI, 'memory', 'off', '--target', 'claude'], { cwd, env, encoding: 'utf8' });
  assert.equal(off.status, 0, off.stdout + off.stderr);
  let manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  let state = JSON.parse(readFileSync(targetPaths('claude', cwd, cwd).stateFile, 'utf8'));
  assert.equal(manifest.memory, false);
  assert.equal(state.memory.mode, 'disabled');
  assert.ok(!JSON.stringify(readFileSync(join(cwd, '.claude', 'settings.local.json'), 'utf8')).includes('session-memory-adapter'));

  const on = spawnSync(process.execPath, [CLI, 'memory', 'on', '--target', 'claude'], { cwd, env, encoding: 'utf8' });
  assert.equal(on.status, 0, on.stdout + on.stderr);
  manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  state = JSON.parse(readFileSync(targetPaths('claude', cwd, cwd).stateFile, 'utf8'));
  assert.deepEqual(manifest.memory, { enabled: true });
  assert.equal(state.memory.mode, 'full');
});

test('dry-run and backup inventory include memory files created by a real install', async () => {
  const cwd = repo();
  const preview = await applyInstall({ skillIds: ['plan'], target: 'codex', home: cwd, cwd, dryRun: true });
  assert.ok(preview.paths.some((path) => path.endsWith('.codex/hooks.json')));
  assert.ok(preview.paths.some((path) => path.endsWith('.rsc/session-memory-adapter.mjs')));
  const state = await applyInstall({ skillIds: ['plan'], target: 'codex', home: cwd, cwd });
  const backup = JSON.parse(readFileSync(join(cwd, '.rsc', 'backups', state.backup.id, 'manifest.json'), 'utf8'));
  assert.ok(backup.entries.some((entry) => entry.path === '.codex/hooks.json'));
  assert.ok(backup.entries.some((entry) => entry.path === '.rsc/session-memory-adapter.mjs'));
});

test('memory CLI save/resume works and learn needs an explicit approval flag', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['plan'], target: 'codex', home: cwd, cwd });
  const env = { ...process.env, HOME: cwd };
  const save = spawnSync(process.execPath, [CLI, 'memory', 'save', '--session', 'manual-checkpoint', '--target', 'codex'], { cwd, env, encoding: 'utf8' });
  assert.equal(save.status, 0, save.stdout + save.stderr);
  const resumed = spawnSync(process.execPath, [CLI, 'memory', 'resume', '--target', 'codex'], { cwd, env, encoding: 'utf8' });
  assert.equal(resumed.status, 0);
  assert.match(resumed.stdout, /manual-checkpoint/);

  const args = [CLI, 'memory', 'learn', '--target', 'codex', '--text', 'Prefer focused tests.', '--evidence', 'Repeated review', '--confidence', '0.9'];
  const denied = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  assert.equal(denied.status, 1);
  assert.match(denied.stdout, /approval required/);
  const approved = spawnSync(process.execPath, [...args, '--approve'], { cwd, env, encoding: 'utf8' });
  assert.equal(approved.status, 0, approved.stdout + approved.stderr);
  assert.equal(JSON.parse(approved.stdout).saved, true);
});
