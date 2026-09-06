import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyInstall } from '../install-apply.js';
import { targetPaths } from '../../targets/index.js';
import { readState } from './state.js';
import { readManifest, writeManifest } from './manifest-file.js';
import { identifyPlan } from './onboarding.js';

const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function renderOnboardingDocuments(plan, planId) {
  const profile = `---\ntechnical_level: ${plan.record.technicalLevel}\naccompaniment: ${plan.record.accompaniment}\nproject_kind: ${plan.record.projectKind}\n---\n\n# User profile\n\nGoal: ${plan.record.goal}\n`;
  const rows = plan.decisions.map((d) => `| ${d.kind} | ${d.id} | ${d.state} | ${d.reason} | ${d.reevaluateWhen.join('; ') || '—'} |`).join('\n');
  const installation = `# Accepted harness plan\n\nPlan id: \`${planId}\`\n\n| Kind | Component | Decision | Reason | Reevaluate when |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
  const decisions = `# Harness decisions\n\n- Accepted plan \`${planId}\`.\n- Project kind: ${plan.record.projectKind}.\n- SDD: ${plan.decisions.find((d) => d.id === 'sdd')?.state || 'selected through profile'}.\n`;
  return { profile, installation, decisions };
}

export function writeOnboardingDocuments(cwd, plan, planId) {
  const dir = join(cwd, '02-DOCS', 'wiki', 'harness');
  mkdirSync(dir, { recursive: true });
  const docs = renderOnboardingDocuments(plan, planId);
  writeFileSync(join(dir, 'user-profile.md'), docs.profile);
  writeFileSync(join(dir, 'installation-plan.md'), docs.installation);
  writeFileSync(join(dir, 'decisions.md'), docs.decisions);
}

export function verifyOnboarding(cwd, plan, planId) {
  const differences = [];
  if (identifyPlan(plan) !== planId) differences.push('persisted plan identity differs from its canonical content');
  for (const target of plan.policy.targets) {
    const state = readState(targetPaths(target, undefined, cwd).stateFile);
    if (!sameSet(Object.keys(state.skills || {}), plan.policy.skills)) differences.push(`${target}: installed skills differ from accepted policy`);
    if (!sameSet(state.agents || [], plan.policy.agents || [])) differences.push(`${target}: installed agents differ from accepted policy`);
    if (state.policy?.hooks !== plan.policy.hooks) differences.push(`${target}: hook policy differs`);
    if (state.policy?.memory !== plan.policy.memory) differences.push(`${target}: memory policy differs`);
  }
  for (const name of ['user-profile.md', 'installation-plan.md', 'decisions.md']) {
    if (!existsSync(join(cwd, '02-DOCS', 'wiki', 'harness', name))) differences.push(`missing ${name}`);
  }
  const manifest = readManifest(cwd);
  if (manifest?.onboarding?.acceptedPlanId !== planId) differences.push('manifest receipt differs from accepted plan');
  return differences;
}

export async function applyAcceptedOnboarding({ cwd = process.cwd(), plan, planId, now = new Date() }) {
  if (identifyPlan(plan) !== planId) throw new Error('RSC_PLAN_CHANGED: regenerate the plan and ask the user to accept the new id');
  const receipt = {
    schemaVersion: 1,
    acceptedPlanId: planId,
    acceptedAt: now.toISOString(),
    plan,
    provenance: {
      skills: Object.fromEntries(plan.policy.skills.map((id) => [id, 'installed'])),
      targets: Object.fromEntries(plan.policy.targets.map((id) => [id, 'installed'])),
    },
  };
  for (const target of plan.policy.targets) {
    await applyInstall({
      cwd,
      target,
      skillIds: plan.policy.skills,
      policy: plan.policy,
      operation: 'onboard',
    });
  }
  writeOnboardingDocuments(cwd, plan, planId);
  const manifest = readManifest(cwd);
  writeManifest(cwd, { ...manifest, onboarding: receipt });
  const differences = verifyOnboarding(cwd, plan, planId);
  if (differences.length) {
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${differences.join('; ')}. Recover with: npx @ericrisco/rsc@latest sync`);
  }
  return receipt;
}
