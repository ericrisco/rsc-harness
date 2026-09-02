import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { applyInstall, uninstall, syncInstalled } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';
import { agentPath, BASE_AGENT_NAMES } from '../targets/agents.js';
import { readManifest, writeManifest } from '../scripts/lib/manifest-file.js';
import { loadManifest, skillsForProfile } from '../scripts/lib/manifest.js';

function repo(prefix = 'rsc-agent-install-') {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  execFileSync('git', ['init', '-q'], { cwd });
  return cwd;
}

const stateAt = (cwd, target = 'claude') => JSON.parse(readFileSync(targetPaths(target, cwd, cwd).stateFile, 'utf8'));

test('installing django adds exactly its two conditional agents beside the four base agents', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['django'], target: 'claude', home: cwd, cwd });
  const state = stateAt(cwd);
  assert.deepEqual(state.agents.sort(), [...BASE_AGENT_NAMES, 'django-build-resolver', 'django-reviewer'].sort());
  assert.ok(existsSync(agentPath('claude', cwd, 'django-reviewer')));
  assert.ok(!existsSync(agentPath('claude', cwd, 'fastapi-reviewer')));
  assert.deepEqual(state.explicitAgents, []);
});

test('uninstall reconciles dependencies and leaves unrelated agents present', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['django', 'fastapi'], target: 'claude', home: cwd, cwd });
  await uninstall({ skillIds: ['django'], agentIds: [], target: 'claude', home: cwd, cwd });
  const state = stateAt(cwd);
  assert.ok(!state.agents.includes('django-reviewer'));
  assert.ok(!state.agents.includes('django-build-resolver'));
  assert.ok(state.agents.includes('fastapi-reviewer'));
  assert.ok(!existsSync(agentPath('claude', cwd, 'django-reviewer')));
  assert.ok(existsSync(agentPath('claude', cwd, 'fastapi-reviewer')));
});

test('an explicitly requested agent survives removal of its backing skill until removed by name', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['go'], agentIds: ['go-reviewer'], target: 'claude', home: cwd, cwd });
  await uninstall({ skillIds: ['go'], agentIds: [], target: 'claude', home: cwd, cwd });
  assert.ok(stateAt(cwd).agents.includes('go-reviewer'));
  assert.deepEqual(readManifest(cwd).agents, ['go-reviewer']);

  await uninstall({ skillIds: [], agentIds: ['go-reviewer'], target: 'claude', home: cwd, cwd });
  assert.ok(!stateAt(cwd).agents.includes('go-reviewer'));
  assert.ok(!existsSync(agentPath('claude', cwd, 'go-reviewer')));
});

test('sync on a clone restores explicit agents from the committed manifest', async () => {
  const cwd = repo();
  writeManifest(cwd, {
    targets: ['claude'], skills: [], agents: ['spec-miner'], ownSkills: [],
    catalogVersion: '1.1.6', tier: null, optOuts: [],
  });
  await syncInstalled({ target: 'claude', home: cwd, cwd });
  const state = stateAt(cwd);
  assert.deepEqual(state.explicitAgents, ['spec-miner']);
  assert.ok(state.agents.includes('spec-miner'));
  assert.ok(existsSync(agentPath('claude', cwd, 'spec-miner')));
});

test('a target without file agents records support honestly and writes no conditional file', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['django'], target: 'windsurf', home: cwd, cwd });
  const state = stateAt(cwd, 'windsurf');
  assert.deepEqual(state.agents, []);
  assert.equal(agentPath('windsurf', cwd, 'django-reviewer'), null);
});

test('a shared agent remains until its final skill dependency is removed', async () => {
  const cwd = repo();
  await applyInstall({ skillIds: ['java', 'spring-boot'], target: 'claude', home: cwd, cwd });
  await uninstall({ skillIds: ['java'], target: 'claude', home: cwd, cwd });
  assert.ok(stateAt(cwd).agents.includes('java-reviewer'));
  assert.ok(stateAt(cwd).agents.includes('java-build-resolver'));

  await uninstall({ skillIds: ['spring-boot'], target: 'claude', home: cwd, cwd });
  assert.ok(!stateAt(cwd).agents.includes('java-reviewer'));
  assert.ok(!stateAt(cwd).agents.includes('java-build-resolver'));
});

test('fresh minimal and core profiles materialize only the four base agents', async () => {
  const catalog = loadManifest();
  for (const profile of ['minimal', 'core']) {
    const cwd = repo(`rsc-agent-${profile}-`);
    await applyInstall({ skillIds: skillsForProfile(catalog, profile), target: 'claude', home: cwd, cwd });
    assert.deepEqual(stateAt(cwd).agents.sort(), [...BASE_AGENT_NAMES].sort(), profile);
  }
});
