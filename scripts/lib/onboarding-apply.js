import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyInstall } from '../install-apply.js';
import { targetPaths } from '../../targets/index.js';
import { readState } from './state.js';
import { readManifest, writeManifest } from './manifest-file.js';
import { identifyPlan, shellQuote } from './onboarding.js';

const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function recoveryCommand(plan, planId) {
  const record = plan.record;
  return [
    'npx @ericrisco/rsc@latest onboard',
    `--technical-level ${record.technicalLevel}`,
    `--accompaniment ${record.accompaniment}`,
    `--project-kind ${record.projectKind}`,
    `--goal ${shellQuote(record.goal)}`,
    ...(record.softwareScope ? [`--software-scope ${record.softwareScope}`] : []),
    `--target ${record.targets.join(',')}`,
    `--accept-plan ${planId}`,
  ].join(' ');
}

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
  const decisionsPath = join(dir, 'decisions.md');
  if (!existsSync(decisionsPath)) writeFileSync(decisionsPath, docs.decisions);
  else if (!readFileSync(decisionsPath, 'utf8').includes(`Accepted plan \`${planId}\``)) {
    appendFileSync(decisionsPath, `${readFileSync(decisionsPath, 'utf8').endsWith('\n') ? '' : '\n'}\n${docs.decisions.replace(/^# Harness decisions\n+/, '')}`);
  }
}

export function verifyOnboarding(cwd, plan, planId) {
  const differences = [];
  if (identifyPlan(plan) !== planId) differences.push('persisted plan identity differs from its canonical content');
  for (const target of plan.policy.targets) {
    const state = readState(targetPaths(target, undefined, cwd).stateFile);
    if (!sameSet(Object.keys(state.skills || {}), plan.policy.skills)) differences.push(`${target}: installed skills differ from accepted policy`);
    if (!sameSet(state.agents || [], plan.policy.agents || [])) differences.push(`${target}: installed agents differ from accepted policy`);
    if (state.policy?.alwaysOn !== plan.policy.alwaysOn) differences.push(`${target}: always-on policy differs`);
    if (state.policy?.codeHooks !== plan.policy.codeHooks) differences.push(`${target}: code-hook policy differs`);
    if (state.policy?.memory !== plan.policy.memory) differences.push(`${target}: memory policy differs`);
  }
  for (const name of ['user-profile.md', 'installation-plan.md', 'decisions.md']) {
    if (!existsSync(join(cwd, '02-DOCS', 'wiki', 'harness', name))) differences.push(`missing ${name}`);
  }
  for (const path of plan.governedPaths || []) {
    if (!existsSync(join(cwd, path.replace(/\/$/, '')))) differences.push(`missing governed path ${path}`);
  }
  const manifest = readManifest(cwd);
  if (manifest?.onboarding?.acceptedPlanId !== planId) differences.push('manifest receipt differs from accepted plan');
  return differences;
}

export async function applyAcceptedOnboarding({ cwd = process.cwd(), plan, planId, now = new Date(), apply = applyInstall }) {
  if (identifyPlan(plan) !== planId) throw new Error('RSC_PLAN_CHANGED: regenerate the plan and ask the user to accept the new id');
  const previousManifest = readManifest(cwd);
  const previousReceipt = previousManifest?.onboarding;
  const existed = Object.fromEntries((plan.governedPaths || []).map((path) => [path, existsSync(join(cwd, path.replace(/\/$/, '')))]));
  const receipt = {
    schemaVersion: 1,
    acceptedPlanId: planId,
    acceptedAt: now.toISOString(),
    plan,
    provenance: {
      skills: Object.fromEntries(plan.policy.skills.map((id) => [id,
        previousReceipt?.plan?.policy?.skills?.includes(id) ? 'conserved' : previousManifest?.skills?.includes(id) ? 'preexisting' : 'installed',
      ])),
      targets: Object.fromEntries(plan.policy.targets.map((id) => [id,
        previousReceipt?.plan?.policy?.targets?.includes(id) ? 'conserved' : previousManifest?.targets?.includes(id) ? 'preexisting' : 'installed',
      ])),
      paths: {},
    },
  };
  try {
    for (const target of plan.policy.targets) {
      await apply({
        cwd,
        target,
        skillIds: plan.policy.skills,
        policy: plan.policy,
        operation: 'onboard',
      });
    }
    writeOnboardingDocuments(cwd, plan, planId);
  } catch (error) {
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${error.message}. Recover with: ${recoveryCommand(plan, planId)}`);
  }
  receipt.provenance.paths = Object.fromEntries((plan.governedPaths || []).map((path) => [
    path,
    existed[path] ? (previousReceipt ? 'conserved' : 'preexisting') : 'installed',
  ]));
  const manifest = readManifest(cwd);
  writeManifest(cwd, { ...manifest, onboarding: receipt });
  const differences = verifyOnboarding(cwd, plan, planId);
  if (differences.length) {
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${differences.join('; ')}. Recover with: ${recoveryCommand(plan, planId)}`);
  }
  return receipt;
}
