import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { applyInstall, pruneSharedBases, removeTargetInstall } from '../install-apply.js';
import { targetPaths } from '../../targets/index.js';
import { readState } from './state.js';
import { readManifest, writeManifest } from './manifest-file.js';
import { encodeGoal, identifyPlan } from './onboarding.js';
import { createBackup, restoreBackup } from './backups.js';

const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function inside(root, path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

export function assertManagedPathsStayInsideRoot(cwd, paths) {
  const root = realpathSync(resolve(cwd));
  for (const rel of paths || []) {
    const clean = rel.replace(/\/$/, '');
    const absolute = resolve(root, clean);
    if (!inside(root, absolute)) throw new Error(`RSC_ROOT_AMBIGUOUS: managed path escapes project root: ${rel}`);
    const segments = relative(root, absolute).split(sep).filter(Boolean);
    let cursor = root;
    for (const segment of segments) {
      cursor = join(cursor, segment);
      if (!existsSync(cursor)) break;
      if (lstatSync(cursor).isSymbolicLink()) {
        const destination = realpathSync(cursor);
        if (!inside(root, destination)) throw new Error(`RSC_ROOT_AMBIGUOUS: managed path follows a symlink outside project root: ${rel}`);
      }
    }
  }
}

function digestPath(path) {
  if (!existsSync(path)) return 'missing';
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return createHash('sha256').update(`link:${readlinkSync(path)}`).digest('hex');
  if (stat.isDirectory()) {
    const rows = readdirSync(path).sort().map((name) => `${name}:${digestPath(join(path, name))}`);
    return createHash('sha256').update(`dir:${rows.join('|')}`).digest('hex');
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function digestGovernedPaths(cwd, paths) {
  return Object.fromEntries((paths || [])
    .filter((path) => path !== '.rsc.json' && path !== '.rsc/backups/')
    .map((path) => [path, digestPath(join(cwd, path.replace(/\/$/, '')))]));
}

function recoveryCommand(plan, planId) {
  const record = plan.record;
  return [
    'npx @ericrisco/rsc@latest onboard',
    `--technical-level ${record.technicalLevel}`,
    `--accompaniment ${record.accompaniment}`,
    `--project-kind ${record.projectKind}`,
    `--goal-base64 ${encodeGoal(record.goal)}`,
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
  const expectedDigests = manifest?.onboarding?.artifactDigests;
  if (!expectedDigests) differences.push('manifest receipt has no governed artifact digests');
  else {
    const expectedPaths = (plan.governedPaths || []).filter((path) => path !== '.rsc.json' && path !== '.rsc/backups/');
    if (!sameSet(Object.keys(expectedDigests), expectedPaths)) differences.push('governed artifact digest inventory differs from accepted plan');
    for (const path of expectedPaths) {
      if (digestPath(join(cwd, path.replace(/\/$/, ''))) !== expectedDigests[path]) differences.push(`governed content differs at ${path}`);
    }
  }
  const docsDir = join(cwd, '02-DOCS', 'wiki', 'harness');
  const profile = existsSync(join(docsDir, 'user-profile.md')) ? readFileSync(join(docsDir, 'user-profile.md'), 'utf8') : '';
  for (const line of [
    `technical_level: ${plan.record.technicalLevel}`,
    `accompaniment: ${plan.record.accompaniment}`,
    `project_kind: ${plan.record.projectKind}`,
    `Goal: ${plan.record.goal}`,
  ]) if (!profile.split('\n').includes(line)) differences.push(`profile content differs: ${line.split(':')[0]}`);
  const installation = existsSync(join(docsDir, 'installation-plan.md')) ? readFileSync(join(docsDir, 'installation-plan.md'), 'utf8') : '';
  if (!installation.includes(`Plan id: \`${planId}\``)) differences.push('installation plan identity differs');
  for (const decision of plan.decisions || []) {
    if (!installation.includes(`| ${decision.kind} | ${decision.id} | ${decision.state} |`)) differences.push(`installation plan omits ${decision.kind}/${decision.id}`);
  }
  const decisions = existsSync(join(docsDir, 'decisions.md')) ? readFileSync(join(docsDir, 'decisions.md'), 'utf8') : '';
  if (!decisions.includes(`Accepted plan \`${planId}\``)) differences.push('decision ledger omits accepted plan');
  if (!sameSet(manifest?.targets || [], plan.policy.targets)) differences.push('manifest targets differ from accepted policy');
  if (!sameSet(manifest?.skills || [], plan.policy.skills)) differences.push('manifest skills differ from accepted policy');
  if (!sameSet(manifest?.agents || [], plan.policy.agents || [])) differences.push('manifest agents differ from accepted policy');
  return differences;
}

export async function applyAcceptedOnboarding({ cwd = process.cwd(), plan, planId, now = new Date(), apply = applyInstall }) {
  if (identifyPlan(plan) !== planId) throw new Error('RSC_PLAN_CHANGED: regenerate the plan and ask the user to accept the new id');
  const previousManifest = readManifest(cwd);
  const previousReceipt = previousManifest?.onboarding;
  const previousPlan = previousReceipt?.plan;
  const transactionPaths = [...new Set([
    ...(plan.governedPaths || []),
    ...(previousPlan?.governedPaths || []),
    '.rsc.json',
  ])];
  assertManagedPathsStayInsideRoot(cwd, transactionPaths);
  const snapshotPaths = transactionPaths.filter((path) => path !== '.rsc/backups/');
  const transaction = createBackup({
    cwd, operation: 'onboarding-transaction', target: plan.policy.targets.join('-'),
    paths: snapshotPaths.map((path) => join(cwd, path.replace(/\/$/, ''))), cliVersion: 'onboarding', now,
  });
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
    for (const target of previousPlan?.policy?.targets || []) {
      if (!plan.policy.targets.includes(target)) removeTargetInstall({ cwd, target });
    }
    for (const target of plan.policy.targets) {
      await apply({
        cwd,
        target,
        skillIds: plan.policy.skills,
        policy: plan.policy,
        operation: 'onboard',
      });
    }
    pruneSharedBases({ cwd, skillIds: plan.policy.skills });
    writeOnboardingDocuments(cwd, plan, planId);
    receipt.provenance.paths = Object.fromEntries((plan.governedPaths || []).map((path) => [
      path,
      existed[path] ? (previousReceipt ? 'conserved' : 'preexisting') : 'installed',
    ]));
    receipt.artifactDigests = digestGovernedPaths(cwd, plan.governedPaths);
    const manifest = readManifest(cwd);
    writeManifest(cwd, {
      ...manifest,
      targets: [...plan.policy.targets],
      skills: [...plan.policy.skills],
      agents: [...(plan.policy.agents || [])],
      onboarding: receipt,
    });
    const differences = verifyOnboarding(cwd, plan, planId);
    if (differences.length) throw new Error(differences.join('; '));
    return receipt;
  } catch (error) {
    restoreBackup({ cwd, id: transaction.id });
    throw new Error(`RSC_ONBOARDING_INCOMPLETE: ${error.message}. Recover with: ${recoveryCommand(plan, planId)}`);
  }
}
