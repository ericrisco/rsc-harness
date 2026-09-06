import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    for (const flag of ['--technical-level', '--accompaniment', '--project-kind', '--goal', '--target', '--accept-plan']) assert.match(error.message, new RegExp(flag));
    return true;
  });
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
