import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { normalizeOnboarding, missingOnboardingFields, ONBOARDING_VALUES } from '../scripts/lib/onboarding.js';
import { verifyOnboarding } from '../scripts/lib/onboarding-apply.js';

// Onboarding asks ONE question about the person now: technical, or with analogies and plain words.
// `technical_level` is the only dial; `accompaniment_level` is retired. Old scripts and agents still
// pass `--accompaniment`, so the flag is accepted and ignored — never validated, never required,
// never recorded, never suggested back.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const BASE = ['onboard', '--target', 'claude', '--technical-level', 'non-technical',
  '--project-kind', 'operations', '--goal', 'Llevar la facturación'];
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-oneq-'));
  execFileSync('git', ['init', '-q'], { cwd });
  return cwd;
}
function accept(cwd, args) {
  const shown = run(cwd, args);
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(shown.stdout)?.[1];
  assert.ok(planId, `a plan: ${shown.stdout}${shown.stderr}`);
  const out = run(cwd, [...args, '--accept-plan', planId]);
  assert.doesNotMatch(out.stdout + out.stderr, /differs|RSC_PLAN_CHANGED|RSC_ONBOARDING_INCOMPLETE:/, out.stdout.slice(-400) + out.stderr);
  return { shown, planId };
}
const profilePath = (cwd) => join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md');
const profile = (cwd) => readFileSync(profilePath(cwd), 'utf8');
const receipt = (cwd) => JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).onboarding;

test('the record no longer knows the accompaniment dial', () => {
  assert.equal(ONBOARDING_VALUES.accompaniment, undefined);
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'nonsense', projectKind: 'operations', goal: 'Ops', targets: ['claude'] });
  assert.equal('accompaniment' in record, false, 'ignored, not validated and not recorded');
  assert.ok(!missingOnboardingFields({ technicalLevel: 'mixed', projectKind: 'operations', goal: 'Ops', targets: ['claude'] }).includes('accompaniment'));
});

test('onboard without --accompaniment produces a plan, and nothing suggests the flag back', { timeout: 300000 }, () => {
  const cwd = project();
  const { shown } = accept(cwd, BASE);
  assert.doesNotMatch(shown.stdout, /--accompaniment/);
  assert.match(profile(cwd), /^technical_level: non-technical$/m);
  assert.doesNotMatch(profile(cwd), /accompaniment/);
  const missing = run(project(), ['onboard', '--target', 'claude']);
  assert.doesNotMatch(missing.stderr, /accompaniment/, 'neither in missing nor in the recovery hint');
});

test('onboard with the old --accompaniment flag still succeeds and records no dial', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, [...BASE, '--accompaniment', 'L2']);
  assert.match(profile(cwd), /^technical_level: non-technical$/m);
  assert.doesNotMatch(profile(cwd), /^accompaniment_level:/m);
  assert.equal(receipt(cwd).plan.record.accompaniment, undefined);
});

test('the flag does not change the plan id: old scripts accept the same plan', { timeout: 300000 }, () => {
  const a = /--accept-plan ([a-f0-9]{64})/.exec(run(project(), BASE).stdout)?.[1];
  const b = /--accept-plan ([a-f0-9]{64})/.exec(run(project(), [...BASE, '--accompaniment', 'L3']).stdout)?.[1];
  assert.ok(a && b);
  assert.equal(a, b);
});

test('re-applying onboarding removes an old accompaniment_level line and reports no drift for it', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, BASE);
  const DISCOVERY = '\n## Descubrimiento\n\n- Dominio: gestoría.\n';
  writeFileSync(profilePath(cwd), profile(cwd).replace(/^technical_level: .*$/m, (l) => `${l}\naccompaniment_level: L3\naccompaniment: L3`) + DISCOVERY);
  accept(cwd, BASE);
  const p = profile(cwd);
  assert.doesNotMatch(p, /accompaniment/);
  assert.match(p, /^technical_level: non-technical$/m);
  assert.ok(p.includes(DISCOVERY.trim()), 'the rest of the profile is the user’s and survives');
  const r = receipt(cwd);
  assert.deepEqual(verifyOnboarding(cwd, r.plan, r.acceptedPlanId), []);
});

test('reading a profile that still carries the retired lines is not drift', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, BASE);
  writeFileSync(profilePath(cwd), profile(cwd).replace(/^technical_level: .*$/m, (l) => `${l}\naccompaniment_level: L1\naccompaniment: L1`));
  // Sealed as an older version would have sealed it: the profile as written, retired lines included.
  // (Any edit to a governed file after acceptance is content drift on its own; that is not this test.)
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  const rel = '02-DOCS/wiki/harness/user-profile.md';
  manifest.onboarding.artifactDigests[rel] = createHash('sha256').update(readFileSync(profilePath(cwd))).digest('hex');
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify(manifest, null, 2));
  const r = receipt(cwd);
  assert.deepEqual(verifyOnboarding(cwd, r.plan, r.acceptedPlanId), []);
});
