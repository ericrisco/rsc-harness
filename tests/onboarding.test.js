import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeOnboarding,
  scanProject,
  buildOnboardingPlan,
  identifyPlan,
  canonicalJson,
  recommendDeferredComponents,
  shellQuote,
  encodeGoal,
  decodeGoal,
} from '../scripts/lib/onboarding.js';

const root = () => mkdtempSync(join(tmpdir(), 'rsc-onboarding-'));
const answers = (overrides = {}) => ({
  schemaVersion: 1,
  technicalLevel: ' mixed ',
  accompaniment: 'l1',
  projectKind: 'software',
  goal: '  Build a small compound-interest website  ',
  softwareScope: 'small',
  targets: ['codex'],
  ...overrides,
});

test('normalizes an agent record to the same values used by the terminal adapter', () => {
  assert.deepEqual(normalizeOnboarding(answers()), {
    schemaVersion: 1,
    technicalLevel: 'mixed',
    accompaniment: 'L1',
    projectKind: 'software',
    goal: 'Build a small compound-interest website',
    softwareScope: 'small',
    targets: ['codex'],
  });
  assert.throws(() => normalizeOnboarding(answers({ goal: ' ' })), /goal/);
  assert.throws(() => normalizeOnboarding(answers({ targets: ['made-up'] })), /target/);
});

test('canonical identity is stable and any governed change invalidates it', () => {
  const dir = root();
  writeFileSync(join(dir, 'package.json'), '{"scripts":{"test":"node --test"}}');
  const record = normalizeOnboarding(answers());
  const one = buildOnboardingPlan(record, scanProject(dir));
  const two = buildOnboardingPlan(record, scanProject(dir));
  assert.equal(canonicalJson(one), canonicalJson(two));
  assert.equal(identifyPlan(one), identifyPlan(two));
  const changed = structuredClone(one);
  changed.record.goal += '!';
  assert.notEqual(identifyPlan(one), identifyPlan(changed));
  assert.match(identifyPlan(one), /^[a-f0-9]{64}$/);
});

test('small software defers SDD with observable triggers; growing software selects it', () => {
  const evidence = scanProject(root());
  const small = buildOnboardingPlan(normalizeOnboarding(answers()), evidence);
  const sdd = small.decisions.find((d) => d.id === 'sdd');
  assert.equal(sdd.state, 'deferred');
  assert.ok(sdd.reason);
  assert.ok(sdd.reevaluateWhen.length);

  const growing = buildOnboardingPlan(normalizeOnboarding(answers({ softwareScope: 'growing' })), evidence);
  assert.equal(growing.decisions.find((d) => d.id === 'sdd').state, 'selected');
  assert.ok(growing.policy.skills.includes('specify'));
  assert.deepEqual(growing.policy.agents.slice(0, 4).sort(), ['developer', 'refuter-correctness', 'refuter-security', 'refuter-tests'].sort());
  assert.ok(growing.decisions.some((d) => d.id === 'developer' && d.state === 'selected'));
  assert.ok(growing.decisions.some((d) => d.id === 'memory' && d.state === 'selected'));
  assert.ok(growing.decisions.some((d) => d.id === 'context7' && d.state === 'deferred'));
});

test('operations policy contains no SDD, base agents, code hooks or gitmoji guard', () => {
  const record = normalizeOnboarding(answers({ projectKind: 'operations', softwareScope: undefined }));
  const plan = buildOnboardingPlan(record, scanProject(root()));
  assert.equal(plan.policy.baseAgents, false);
  assert.equal(plan.policy.alwaysOn, true);
  assert.equal(plan.policy.codeHooks, false);
  assert.equal(plan.policy.gitmojiGuard, false);
  assert.deepEqual(plan.policy.agents, []);
  assert.ok(!plan.policy.skills.includes('sdd'));
  assert.equal(plan.decisions.find((d) => d.id === 'sdd').state, 'deferred');
});

test('the plan does not claim a Claude-only gitmoji guard for Codex', () => {
  const plan = buildOnboardingPlan(normalizeOnboarding(answers({ softwareScope: 'growing' })), scanProject(root()));
  assert.equal(plan.policy.gitmojiGuard, false);
  assert.equal(plan.decisions.find((d) => d.id === 'gitmoji-guard').state, 'deferred');
});

test('detected stacks add their catalog skill with workspace evidence, without inventing FastAPI', () => {
  const dir = root();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { next: '1', react: '1' } }));
  writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname="x"');
  writeFileSync(join(dir, 'go.mod'), 'module example.test/x');
  const plan = buildOnboardingPlan(normalizeOnboarding(answers()), scanProject(dir));
  for (const id of ['nextjs', 'react', 'python', 'go']) {
    assert.ok(plan.policy.skills.includes(id), id);
    assert.equal(plan.decisions.find((d) => d.id === id)?.provenance, 'workspace-evidence');
  }
  assert.ok(!plan.policy.skills.includes('fastapi'));
});

test('POSIX shell quoting round-trips hostile goal text without executing it', async () => {
  const marker = join(root(), 'must-not-exist');
  const goal = `it's $(touch ${marker}) and \`touch ${marker}\``;
  const { execFileSync } = await import('node:child_process');
  const output = execFileSync('sh', ['-c', `printf %s ${shellQuote(goal)}`], { encoding: 'utf8' });
  assert.equal(output, goal);
  assert.equal(existsSync(marker), false);
});

test('generated goal transport is shell-neutral and round-trips arbitrary text', () => {
  const goal = `it's A & B | 100% \"ready\" $(still inert)`;
  const encoded = encodeGoal(goal);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeGoal(encoded), goal);
});

test('a nested scan reads only the selected root and reports a parent marker path', () => {
  const parent = root();
  writeFileSync(join(parent, '.rsc.json'), '{"secret":"must-not-enter-evidence"}');
  writeFileSync(join(parent, 'package.json'), '{"dependencies":{"next":"99"}}');
  const child = join(parent, 'child');
  mkdirSync(child);
  writeFileSync(join(child, 'notes.md'), 'operations runbook');
  const evidence = scanProject(child);
  assert.equal(evidence.parentHarness, '..');
  assert.ok(!canonicalJson(evidence).includes('must-not-enter-evidence'));
  assert.ok(!evidence.signals.includes('package.json'));
  assert.ok(evidence.signals.includes('markdown:1'));
  assert.ok(!canonicalJson(evidence).includes('notes.md'));
});

test('deferred components stay quiet until evidence crosses a recorded trigger', () => {
  const dir = root();
  const plan = buildOnboardingPlan(normalizeOnboarding(answers()), scanProject(dir));
  assert.deepEqual(recommendDeferredComponents(plan, scanProject(dir)), []);
  for (let i = 0; i < 8; i++) writeFileSync(join(dir, `feature-${i}.js`), 'export {};');
  const recommendations = recommendDeferredComponents(plan, scanProject(dir));
  const sdd = recommendations.find((item) => item.id === 'sdd');
  assert.ok(sdd);
  assert.match(sdd.explanation, /source files|grew/i);
  assert.equal(sdd.requiresNewPlan, true);
});

test('managed assistant output never becomes project evidence after a partial install', () => {
  const dir = root();
  mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(dir, '.codex', 'rsc'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'agents', 'developer.md'), '# generated agent');
  writeFileSync(join(dir, '.codex', 'rsc', 'state.md'), '# generated state');
  const evidence = scanProject(dir);
  assert.deepEqual(evidence.signals, []);
  assert.equal(evidence.sourceFileCount, 0);
});

test('declared auth, persistence, payments or integrations select SDD for small software', () => {
  const dir = root();
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { stripe: '1', passport: '1', prisma: '1' } }));
  const plan = buildOnboardingPlan(normalizeOnboarding(answers({ goal: 'Add login, payments and a database' })), scanProject(dir));
  assert.equal(plan.decisions.find((d) => d.id === 'sdd').state, 'selected');
  assert.match(plan.decisions.find((d) => d.id === 'sdd').reason, /auth|payment|persistence|integration/i);
});

test('non-software growth recommends changing to a mixed plan that can actually select SDD', () => {
  const dir = root();
  const operations = normalizeOnboarding(answers({ projectKind: 'operations', softwareScope: undefined, goal: 'Run operations' }));
  const accepted = buildOnboardingPlan(operations, scanProject(dir));
  for (let i = 0; i < 6; i++) writeFileSync(join(dir, `automation-${i}.js`), 'export {};');
  const recommendations = recommendDeferredComponents(accepted, scanProject(dir));
  assert.ok(recommendations.some((item) => item.id === 'sdd'));
  assert.equal(recommendations[0].suggestedRecord.projectKind, 'mixed');
  assert.equal(recommendations[0].suggestedRecord.softwareScope, 'growing');
});

test('persisted trigger rules govern reassessment and a bare manifest is insufficient', () => {
  const dir = root();
  const accepted = buildOnboardingPlan(normalizeOnboarding(answers({ projectKind: 'operations', softwareScope: undefined })), scanProject(dir));
  writeFileSync(join(dir, 'package.json'), '{}');
  assert.deepEqual(recommendDeferredComponents(accepted, scanProject(dir)), []);
  for (let i = 0; i < 6; i++) writeFileSync(join(dir, `work-${i}.js`), 'export {};');
  assert.ok(recommendDeferredComponents(accepted, scanProject(dir)).some((item) => item.id === 'sdd'));
  const disabled = structuredClone(accepted);
  for (const decision of disabled.decisions) decision.triggerRules = [{ type: 'unknown' }];
  assert.deepEqual(recommendDeferredComponents(disabled, scanProject(dir)), []);
});

test('research, content and mixed intent survive normalization and drive proportional policy', () => {
  const evidence = scanProject(root());
  for (const projectKind of ['research', 'content']) {
    const plan = buildOnboardingPlan(normalizeOnboarding(answers({ projectKind, softwareScope: undefined })), evidence);
    assert.equal(plan.record.projectKind, projectKind);
    assert.equal(plan.policy.codeHooks, false);
    assert.equal(plan.decisions.find((d) => d.id === 'sdd').state, 'deferred');
  }
  const mixed = buildOnboardingPlan(normalizeOnboarding(answers({ projectKind: 'mixed', softwareScope: 'growing' })), evidence);
  assert.equal(mixed.record.projectKind, 'mixed');
  assert.equal(mixed.policy.codeHooks, true);
  assert.equal(mixed.decisions.find((d) => d.id === 'sdd').state, 'selected');
});
