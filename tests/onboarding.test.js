import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeOnboarding,
  scanProject,
  buildOnboardingPlan,
  identifyPlan,
  canonicalJson,
  recommendDeferredComponents,
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
  assert.equal(plan.policy.hooks, false);
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
  assert.ok(evidence.signals.includes('notes.md'));
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
