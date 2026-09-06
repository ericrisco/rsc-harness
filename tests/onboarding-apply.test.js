import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeOnboarding, scanProject, buildOnboardingPlan, identifyPlan } from '../scripts/lib/onboarding.js';
import { applyAcceptedOnboarding, verifyOnboarding } from '../scripts/lib/onboarding-apply.js';

test('post-apply verification names a missing managed artifact and prevents a ready verdict', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-verify-'));
  const record = normalizeOnboarding({
    technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations',
    goal: 'Run an operations desk', targets: ['codex'],
  });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  rmSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md'));
  const differences = verifyOnboarding(cwd, plan, id);
  assert.ok(differences.some((difference) => difference.includes('user-profile.md')));
});

test('post-apply verification rejects changed governed file content', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-content-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  writeFileSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md'), '# corrupted\n');
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('content differs')));
});

test('artifact digest inventory must cover every governed path', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-digest-inventory-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  const manifestPath = join(cwd, '.rsc.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.onboarding.artifactDigests = {};
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('digest inventory')));
});

test('onboarding refuses a governed path whose symlink leaves the project root', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'rsc-onboard-outside-'));
  symlinkSync(outside, join(cwd, '02-DOCS'), 'dir');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) }), /symlink outside project root/);
  assert.deepEqual(readdirSync(outside), []);
});

test('onboarding refuses an external backup symlink before snapshotting private files', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-backup-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'rsc-onboard-backup-outside-'));
  mkdirSync(join(cwd, '.rsc'));
  symlinkSync(outside, join(cwd, '.rsc', 'backups'), 'dir');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) }), /symlink outside project root/);
  assert.deepEqual(readdirSync(outside), []);
});

test('application refuses an identity that does not match the complete canonical plan', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-drift-'));
  const record = normalizeOnboarding({
    technicalLevel: 'technical', accompaniment: 'L1', projectKind: 'software',
    softwareScope: 'small', goal: 'One calculator', targets: ['claude'],
  });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: 'f'.repeat(64) }), /RSC_PLAN_CHANGED/);
});

test('RSC-owned output does not change the accepted project-evidence identity', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onboard-stable-'));
  const record = normalizeOnboarding({
    technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations',
    goal: 'Run an operations desk', targets: ['codex'],
  });
  const before = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(before);
  await applyAcceptedOnboarding({ cwd, plan: before, planId: id });
  const after = buildOnboardingPlan(record, scanProject(cwd));
  assert.equal(identifyPlan(after), id);
});

test('decisions are append-only across onboarding applications', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-decisions-'));
  mkdirSync(join(cwd, '02-DOCS/wiki/harness'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS/wiki/harness/decisions.md'), '# Decisions\n\n- Human decision survives.\n');
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
  assert.match(readFileSync(join(cwd, '02-DOCS/wiki/harness/decisions.md'), 'utf8'), /Human decision survives/);
});

test('verification checks governed paths on disk, not only the state claim', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-path-verify-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  rmSync(join(cwd, 'AGENTS.md'));
  assert.ok(verifyOnboarding(cwd, plan, id).some((d) => d.includes('AGENTS.md')));
});

test('an application failure is typed and carries executable recovery', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-partial-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan), apply: async () => { throw new Error('disk full'); } }), (error) => {
    assert.match(error.message, /RSC_ONBOARDING_INCOMPLETE.*npx .*onboard/s);
    for (const flag of ['--technical-level', '--accompaniment', '--project-kind', '--goal-base64', '--target', '--accept-plan']) assert.match(error.message, new RegExp(flag));
    return true;
  });
});

test('a partial target application rolls back and preserves the accepted recovery plan id', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-partial-rollback-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  const { applyInstall } = await import('../scripts/install-apply.js');
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: id, apply: async (input) => {
    await applyInstall(input);
    throw new Error('late failure');
  } }), /RSC_ONBOARDING_INCOMPLETE/);
  assert.equal(existsSync(join(cwd, '.claude', 'skills', 'specify')), false);
  assert.equal(identifyPlan(buildOnboardingPlan(record, scanProject(cwd))), id);
});

test('a failure while finalizing the receipt rolls back every applied artifact', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-finalize-rollback-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Run ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const { applyInstall } = await import('../scripts/install-apply.js');
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan), apply: async (input) => {
    await applyInstall(input);
    rmSync(join(cwd, '.rsc.json'), { force: true });
    mkdirSync(join(cwd, '.rsc.json'));
  } }), /RSC_ONBOARDING_INCOMPLETE/);
  assert.equal(existsSync(join(cwd, 'AGENTS.md')), false);
  assert.equal(existsSync(join(cwd, '02-DOCS/wiki/harness/user-profile.md')), false);
  assert.equal(existsSync(join(cwd, '.rsc.json')), false);
});

test('accepting fewer targets removes the deselected RSC installation before READY', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-target-reconcile-'));
  mkdirSync(join(cwd, '.git'));
  const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
  const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
  const codexRecord = normalizeOnboarding({ ...bothRecord, softwareScope: 'small', targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) });
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.deepEqual(manifest.targets, ['codex']);
  assert.equal(existsSync(join(cwd, '.claude', 'skills', 'specify')), false);
  assert.equal(existsSync(join(cwd, '.rsc', 'skills', 'specify')), false);
  assert.doesNotMatch(readFileSync(join(cwd, '.gitignore'), 'utf8'), /^\.claude\//m);
  assert.deepEqual(verifyOnboarding(cwd, codex, identifyPlan(codex)), []);
});

test('a corrupt prior target state cannot delete a path outside the project', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-state-root-'));
  const outside = join(mkdtempSync(join(tmpdir(), 'rsc-state-outside-')), 'keep.txt');
  writeFileSync(outside, 'keep');
  const bothRecord = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'software', softwareScope: 'growing', goal: 'Build product', targets: ['claude', 'codex'] });
  const both = buildOnboardingPlan(bothRecord, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan: both, planId: identifyPlan(both) });
  const statePath = join(cwd, '.claude', 'skills', '.rsc-state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  state.skills.orient.files.push(outside);
  writeFileSync(statePath, JSON.stringify(state));
  const codexRecord = normalizeOnboarding({ ...bothRecord, targets: ['codex'] });
  const codex = buildOnboardingPlan(codexRecord, scanProject(cwd));
  await assert.rejects(applyAcceptedOnboarding({ cwd, plan: codex, planId: identifyPlan(codex) }), /PREVIOUS_INSTALL_INCOMPATIBLE/);
  assert.equal(readFileSync(outside, 'utf8'), 'keep');
});

test('a repeated application records conserved provenance', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-provenance-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  const id = identifyPlan(plan);
  await applyAcceptedOnboarding({ cwd, plan, planId: id });
  const receipt = await applyAcceptedOnboarding({ cwd, plan, planId: id });
  assert.ok(Object.values(receipt.provenance.paths).includes('conserved'));
  assert.ok(Object.values(receipt.provenance.paths).every((v) => ['installed', 'preexisting', 'conserved'].includes(v)));
  assert.ok(Object.values(receipt.provenance.skills).every((v) => v === 'conserved'));
  assert.ok(Object.values(receipt.provenance.targets).every((v) => v === 'conserved'));
});

test('every route materialized by onboarding is declared by the accepted plan', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-route-inventory-'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  await applyAcceptedOnboarding({ cwd, plan, planId: identifyPlan(plan) });
  const files = [];
  const walk = (dir, prefix = '') => {
    for (const name of readdirSync(dir)) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const path = join(dir, name);
      if (lstatSync(path).isDirectory()) walk(path, rel); else files.push(rel);
    }
  };
  walk(cwd);
  for (const file of files) {
    assert.ok(plan.governedPaths.some((owned) => {
      if (owned === file || (owned.endsWith('/') && file.startsWith(owned))) return true;
      const path = join(cwd, owned);
      return existsSync(path) && lstatSync(path).isDirectory() && file.startsWith(`${owned}/`);
    }), `${file} is absent from governedPaths`);
  }
});

test('a git project declares the gitignore route that onboarding modifies', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gitignore-inventory-'));
  mkdirSync(join(cwd, '.git'));
  const record = normalizeOnboarding({ technicalLevel: 'mixed', accompaniment: 'L1', projectKind: 'operations', goal: 'Ops', targets: ['codex'] });
  const plan = buildOnboardingPlan(record, scanProject(cwd));
  assert.ok(plan.governedPaths.includes('.gitignore'));
});
