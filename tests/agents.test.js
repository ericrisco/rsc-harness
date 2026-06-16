import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AGENT_TARGET_IDS, targetHasAgents, writeDeveloperAgent, developerAgentPath,
  readDeveloperTier, writeDeveloperTier,
} from '../targets/agents.js';

test('the 8 agent-capable targets each render a developer agent with a model (valid per format)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ag-'));
  assert.deepEqual([...AGENT_TARGET_IDS].sort(),
    ['claude', 'codex', 'copilot', 'cursor', 'gemini', 'junie', 'kiro', 'opencode']);
  for (const t of AGENT_TARGET_IDS) {
    writeDeveloperAgent(t, cwd);
    const p = developerAgentPath(t, cwd);
    assert.ok(existsSync(p), `${t} agent written`);
    const c = readFileSync(p, 'utf8');
    assert.ok(/model/.test(c), `${t} carries a model`);
    if (p.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(c), `${t} json parses`);
  }
});

test('developer tier: balanced by default, heavy honored, light coerced to balanced (never light)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ag-'));
  assert.equal(readDeveloperTier(cwd), 'balanced');
  writeDeveloperTier(cwd, 'heavy');
  assert.equal(readDeveloperTier(cwd), 'heavy');
  writeDeveloperTier(cwd, 'light');
  assert.equal(readDeveloperTier(cwd), 'balanced');
});

test('balanced→Sonnet / heavy→Opus on Claude; the agent is never Haiku', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-ag-'));
  writeDeveloperAgent('claude', cwd, 'balanced');
  let c = readFileSync(developerAgentPath('claude', cwd), 'utf8');
  assert.match(c, /model: sonnet/);
  assert.doesNotMatch(c, /haiku/i);
  writeDeveloperAgent('claude', cwd, 'heavy');
  c = readFileSync(developerAgentPath('claude', cwd), 'utf8');
  assert.match(c, /model: opus/);
});

test('targets without file-based agents get no developer agent', () => {
  assert.equal(targetHasAgents('codex'), true);
  assert.equal(targetHasAgents('aider'), false);
  assert.equal(targetHasAgents('cline'), false);
  assert.equal(developerAgentPath('aider', process.cwd()), null);
});
