import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// #298 punto 5 — `doctor` decía `"healthy": true` con el onboarding sin terminar (faltaba la
// constitución), y como usuario no se ve que son dos preguntas distintas. Salud del arnés (lo que
// gobierna `healthy` y el exit code) y preparación del onboarding (el suelo del plan aceptado más
// los borradores) se reportan por separado; la segunda nunca cambia la primera.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const CONSTITUTION = '02-DOCS/wiki/sdd/constitution.md';
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const argsFor = (scope) => ['onboard', '--target', 'claude', '--technical-level', 'technical',
  '--project-kind', 'software', '--software-scope', scope, '--workflow', 'main', '--goal', 'Una API de facturación'];
function onboarded(scope) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ready-'));
  execFileSync('git', ['init', '-q'], { cwd });
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, argsFor(scope)).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan');
  const applied = run(cwd, [...argsFor(scope), '--accept-plan', planId]);
  assert.match(applied.stdout, /RSC_ONBOARDING_READY/, applied.stdout + applied.stderr);
  return cwd;
}
const doctorJson = (cwd) => {
  const out = run(cwd, ['doctor', '--target', 'claude', '--json']);
  return { status: out.status, report: JSON.parse(out.stdout) };
};
const doctorText = (cwd) => run(cwd, ['doctor', '--target', 'claude']);
const head = (stdout) => stdout.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5);

test('#298 — fresh complex non-interactive onboarding: healthy, readiness pending on the constitution draft', { timeout: 300000 }, () => {
  const cwd = onboarded('complex');
  const { status, report } = doctorJson(cwd);
  assert.equal(report.healthy, true);
  assert.equal(status, 0);
  assert.equal(report.onboarding.status, 'pending');
  assert.deepEqual(report.onboarding.missing, []);
  assert.deepEqual(report.onboarding.pending, [CONSTITUTION]);
  assert.match(report.onboarding.action, /`constitution` phase/);

  const text = doctorText(cwd);
  assert.equal(text.status, 0, 'the text report keeps the same exit code');
  const lines = head(text.stdout);
  assert.equal(lines[0], 'Harness health: healthy');
  assert.equal(lines[1], 'Onboarding readiness: pending');
  assert.equal(lines[2], `Pending: ${CONSTITUTION} (draft)`);
  assert.match(lines[3], /^Next: .*`constitution` phase/);
  assert.ok(!lines.some((l) => l.startsWith('Missing:')), 'no Missing line when nothing is missing');
});

test('#298 — constitution deleted where the floor requires it: incomplete, with the command, and still healthy', { timeout: 300000 }, () => {
  const cwd = onboarded('complex');
  rmSync(join(cwd, CONSTITUTION));
  const { status, report } = doctorJson(cwd);
  assert.equal(report.healthy, true, 'readiness never changes health');
  assert.equal(status, 0, 'nor the exit code');
  assert.equal(report.onboarding.status, 'incomplete');
  assert.deepEqual(report.onboarding.missing, [CONSTITUTION]);
  assert.deepEqual(report.onboarding.pending, []);
  assert.match(report.onboarding.action, /`constitution` phase/);
  assert.ok(report.onboarding.action.includes(CONSTITUTION), report.onboarding.action);

  const text = doctorText(cwd);
  assert.equal(text.status, 0);
  const lines = head(text.stdout);
  assert.equal(lines[0], 'Harness health: healthy');
  assert.equal(lines[1], 'Onboarding readiness: incomplete');
  assert.equal(lines[2], `Missing: ${CONSTITUTION}`);
  assert.match(lines[3], /^Next: /);
});

test('#298 — a small project whose plan defers SDD is ready', { timeout: 300000 }, () => {
  const cwd = onboarded('small');
  const { status, report } = doctorJson(cwd);
  assert.equal(report.onboarding.status, 'ready');
  assert.deepEqual(report.onboarding.missing, []);
  assert.deepEqual(report.onboarding.pending, []);
  assert.equal(status, report.healthy ? 0 : 1);
  const lines = head(doctorText(cwd).stdout);
  assert.equal(lines[1], 'Onboarding readiness: ready');
  assert.ok(!lines.some((l) => l.startsWith('Missing:') || l.startsWith('Pending:')));
});

test('#298 — a manual install with no onboarding record is not onboarded, and health is untouched', { timeout: 300000 }, () => {
  const cwd = onboarded('small');
  const before = doctorJson(cwd);
  const manifestPath = join(cwd, '.rsc.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  delete manifest.onboarding;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const { status, report } = doctorJson(cwd);
  assert.equal(report.onboarding.status, 'not-onboarded');
  assert.match(report.onboarding.action, /@ericrisco\/rsc(@latest)? onboard/);
  assert.equal(report.healthy, before.report.healthy);
  assert.equal(status, before.status);
  const lines = head(doctorText(cwd).stdout);
  assert.equal(lines[1], 'Onboarding readiness: not onboarded');
});

test('#298 — the agent handoff after install names the pending constitution draft', { timeout: 300000 }, () => {
  const cwd = onboarded('complex');
  const out = run(cwd, ['install', '--target', 'claude']).stdout;
  const handoff = out.slice(out.indexOf('AGENT HANDOFF'));
  assert.ok(out.includes('AGENT HANDOFF'), out);
  assert.match(handoff, /constitution\.md is a draft/);
  assert.match(handoff, /`constitution` phase/);
});

test('#298 — a receipt that does not match its accepted plan id is incomplete, never ready', { timeout: 300000 }, async () => {
  const { onboardingReadiness } = await import('../scripts/lib/onboarding-apply.js');
  const cwd = onboarded('small');
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(onboardingReadiness(cwd, manifest).status, 'ready');
  manifest.onboarding.plan.floorPaths = [];
  const verdict = onboardingReadiness(cwd, manifest);
  assert.equal(verdict.status, 'incomplete');
  assert.match(verdict.action, /onboard/);
});
