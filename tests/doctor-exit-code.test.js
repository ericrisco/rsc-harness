import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { targetPaths } from '../targets/index.js';

// #277 — `doctor` exited 0 whatever its report said, so a CI or an editor extension built on top of
// rsc could not trust the exit code. And what was missing arrived in three shapes: `missing` as
// "id:/abs/path" strings, `missingCommands` as { id, path, action }, `missingAgents` as { id, action }
// without the path. A broken hook (`hookWired: false`) did not change the exit code either.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const ARGS = ['onboard', '--target', 'claude', '--technical-level', 'technical', '--accompaniment', 'L1',
  '--project-kind', 'software', '--software-scope', 'complex', '--workflow', 'main', '--goal', 'Una API de facturación'];
function built() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-doc-'));
  execFileSync('git', ['init', '-q'], { cwd });
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, ARGS).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan');
  run(cwd, [...ARGS, '--accept-plan', planId]);
  return cwd;
}
const doctorJson = (cwd) => {
  const out = run(cwd, ['doctor', '--target', 'claude', '--json']);
  return { status: out.status, report: JSON.parse(out.stdout) };
};
const SHAPE = (entry) => typeof entry.id === 'string' && typeof entry.path === 'string' && typeof entry.action === 'string';

test('#277 — a healthy harness exits 0 and says so', { timeout: 300000 }, () => {
  const { status, report } = doctorJson(built());
  assert.equal(report.healthy, true, JSON.stringify({ m: report.missing, a: report.missingAgents, c: report.missingCommands, h: report.hookWired }));
  assert.equal(status, 0);
});

test('#277 — a missing skill exits non-zero, in the one shape every list uses', { timeout: 300000 }, () => {
  const cwd = built();
  rmSync(join(cwd, '.rsc', 'skills', 'orient'), { recursive: true, force: true });
  rmSync(join(cwd, '.claude', 'skills', 'orient'), { recursive: true, force: true });
  const { status, report } = doctorJson(cwd);
  assert.equal(status, 1);
  assert.equal(report.healthy, false);
  assert.ok(report.missing.length && report.missing.every(SHAPE), JSON.stringify(report.missing));
  assert.ok(report.missing.some((m) => m.id === 'orient' && m.path.includes('orient')));
});

test('#277 — a missing agent carries its path, and exits non-zero', { timeout: 300000 }, () => {
  const cwd = built();
  const state = JSON.parse(readFileSync(targetPaths('claude', undefined, cwd).stateFile, 'utf8'));
  const agent = state.agents?.[0];
  assert.ok(agent, 'fixture: this plan installs agents');
  rmSync(join(cwd, '.claude', 'agents', `${agent}.md`), { force: true });
  const { status, report } = doctorJson(cwd);
  assert.equal(status, 1);
  assert.ok(report.missingAgents.length && report.missingAgents.every(SHAPE), JSON.stringify(report.missingAgents));
  assert.ok(report.missingAgents[0].path.endsWith(`${agent}.md`));
});

test('#277 — an unwired hook exits non-zero, with or without --json', { timeout: 300000 }, () => {
  const cwd = built();
  rmSync(targetPaths('claude', undefined, cwd).hookTarget, { force: true });
  const { status, report } = doctorJson(cwd);
  assert.equal(report.hookWired, false);
  assert.equal(status, 1);
  assert.equal(run(cwd, ['doctor', '--target', 'claude']).status, 1);
});
