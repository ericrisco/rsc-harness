import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
