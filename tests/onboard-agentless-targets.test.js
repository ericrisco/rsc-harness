import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedAgentsFor } from '../scripts/lib/onboarding-apply.js';
import { TARGET_IDS } from '../targets/index.js';
import { AGENT_TARGET_IDS } from '../targets/agents.js';

// Nine of the seventeen assistants have no notion of a subagent. The plan computes ONE list of
// agents for the whole project, and the verifier used to demand that list from every target — so
// onboarding could never complete on any of the nine. Because the failure rolls back, the person
// was left with empty directory shells, no harness, and a recovery command that walks back into the
// same wall.
//
// The distinction that had been lost: the policy is the PROJECT's, the capability is the TARGET's.

const AGENTLESS = TARGET_IDS.filter((t) => !AGENT_TARGET_IDS.includes(t));
const plan = (agents) => ({ policy: { agents } });

test('the nine agentless targets are expected to hold no agents', () => {
  assert.deepEqual(AGENTLESS.sort(), ['aider', 'amp', 'antigravity', 'cline', 'continue', 'jules', 'roo', 'windsurf', 'zed']);
  for (const target of AGENTLESS) {
    assert.deepEqual(expectedAgentsFor(target, plan(['developer', 'refuter-tests'])), [], target);
  }
});

// Relaxing the check must not blind it: a target that CAN hold agents is still held to the policy,
// which is the entire reason the check exists.
test('the eight agent-capable targets are still held to the policy', () => {
  for (const target of AGENT_TARGET_IDS) {
    assert.deepEqual(expectedAgentsFor(target, plan(['developer'])), ['developer'], target);
  }
});

test('a policy with no agents expects none anywhere', () => {
  for (const target of TARGET_IDS) assert.deepEqual(expectedAgentsFor(target, { policy: {} }), []);
});

// The claim the unit test cannot make: that a real onboarding of the reported shape now COMPLETES.
// Runs the CLI exactly as a person would, on a throwaway repo.
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const GOAL = 'backend python y frontend react';

function onboard(cwd, args) {
  return execFileSync(process.execPath, [CLI, 'onboard',
    '--technical-level', 'non-technical', '--accompaniment', 'L3',
    '--project-kind', 'software', '--software-scope', 'growing', ...args], { cwd, encoding: 'utf8' });
}

test('a real onboarding including an agentless target completes', { timeout: 300000 }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-onb-e2e-'));
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('node', ['-e', `require('fs').writeFileSync('${join(cwd, 'app.py')}', 'x = 1\\n')`]);

  const proposal = onboard(cwd, ['--goal', GOAL, '--target', 'antigravity,claude']);
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(proposal)?.[1];
  assert.ok(planId, 'the proposal must offer a plan id to accept');

  const accepted = onboard(cwd, ['--goal', GOAL, '--target', 'antigravity,claude', '--accept-plan', planId]);

  // The claim is precise, because the CLI still ends by handing off: it prints
  // RSC_ONBOARDING_INCOMPLETE for the harness floor (02-DOCS/wiki/sdd/constitution.md), which the
  // `harness` skill scaffolds and no command does. That is the designed end of a SUCCESSFUL run
  // and nothing rolls back. What must never appear again is the agent divergence.
  assert.doesNotMatch(accepted, /installed agents differ from accepted policy/, accepted.slice(-400));

  // And "did not fail" is not the claim either — the harness has to be on disk. Before the fix this
  // ran the rollback and left empty directory shells with no manifest at all, which is what made
  // the failure so disorienting to hit.
  assert.ok(existsSync(join(cwd, '.rsc.json')), '.rsc.json must exist: a rolled-back onboarding leaves none');
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.deepEqual([...manifest.targets].sort(), ['antigravity', 'claude']);
  assert.ok(manifest.skills.length > 0, 'skills must be declared');
  assert.ok(existsSync(join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md')));
  // The agentless target got the skills it CAN hold. That is what the fix is for.
  assert.ok(existsSync(join(cwd, '.antigravity', 'rsc')), 'the agentless target must be installed too');
  assert.ok(readdirSync(join(cwd, '.antigravity', 'rsc')).length > 0, 'and not as an empty shell');
});
