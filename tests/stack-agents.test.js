import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as agents from '../targets/agents.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_NEW = [
  'cpp-build-resolver', 'cpp-reviewer',
  'csharp-reviewer',
  'django-build-resolver', 'django-reviewer',
  'fastapi-reviewer',
  'flutter-build-resolver', 'flutter-reviewer',
  'go-build-resolver', 'go-reviewer',
  'java-build-resolver', 'java-reviewer',
  'kotlin-build-resolver', 'kotlin-reviewer',
  'mle-reviewer',
  'php-reviewer',
  'postgres-reviewer',
  'python-reviewer',
  'pytorch-build-resolver',
  'rag-reviewer',
  'react-build-resolver', 'react-reviewer',
  'rust-build-resolver', 'rust-reviewer',
  'spec-miner',
  'swift-build-resolver', 'swift-reviewer',
  'typescript-reviewer',
  'vue-reviewer',
].sort();

test('stack catalog exposes exactly the 29 approved new agents', () => {
  assert.equal(typeof agents.stackAgentNames, 'function');
  assert.deepEqual(agents.stackAgentNames().sort(), EXPECTED_NEW);
});

test('agent dependencies resolve exact, shared and explicit-only sets', () => {
  assert.equal(typeof agents.resolveAgentNames, 'function');
  assert.deepEqual(
    agents.resolveAgentNames(['django'], []).filter((id) => !agents.BASE_AGENT_NAMES.includes(id)).sort(),
    ['django-build-resolver', 'django-reviewer'],
  );
  assert.deepEqual(
    agents.resolveAgentNames(['java', 'spring-boot'], []).filter((id) => !agents.BASE_AGENT_NAMES.includes(id)).sort(),
    ['java-build-resolver', 'java-reviewer'],
  );
  assert.ok(!agents.resolveAgentNames([], []).includes('spec-miner'));
  assert.ok(agents.resolveAgentNames([], ['spec-miner']).includes('spec-miner'));
});

test('catalog validation enforces role gates and kills a broken mutant', () => {
  assert.equal(typeof agents.validateAgentCatalog, 'function');
  assert.deepEqual(agents.validateAgentCatalog(agents.stackAgents()), []);

  const [first, ...rest] = agents.stackAgents();
  const mutant = [{ ...first, desc: first.desc.replace(/\bNOT\b.*$/u, '') }, ...rest];
  const errors = agents.validateAgentCatalog(mutant);
  assert.ok(errors.some((e) => e.includes(first.name) && e.includes('NOT')));
});

test('reviewers declare read-only tools and resolvers declare a bounded write surface', () => {
  for (const agent of agents.stackAgents()) {
    assert.ok(['balanced', 'heavy'].includes(agent.tier), agent.name);
    assert.ok(agent.routing.should.length > 0, `${agent.name}: should route`);
    assert.ok(agent.routing.shouldNot.length > 0, `${agent.name}: should not route`);
    if (agent.role === 'reviewer') {
      assert.deepEqual(agent.tools, ['read', 'search'], agent.name);
    }
    if (agent.role === 'build-resolver') {
      assert.deepEqual(agent.tools, ['read', 'search', 'edit', 'shell'], agent.name);
    }
  }
});

test('Go, C++ and Python source receipts are dated and primary', () => {
  const receipts = JSON.parse(readFileSync(join(ROOT, 'targets', 'agent-sources.json'), 'utf8'));
  for (const id of ['go-reviewer', 'cpp-reviewer', 'python-reviewer']) {
    const receipt = receipts.find((entry) => entry.agent === id);
    assert.ok(receipt, id);
    assert.match(receipt.researchedAt, /^2026-09-02$/);
    assert.ok(receipt.sources.length >= 1);
    assert.ok(receipt.sources.every((source) => /^https:\/\/(go\.dev|isocpp\.github\.io|docs\.python\.org)\//.test(source.url)));
    assert.ok(receipt.sources.every((source) => source.coverage.length > 0));
  }
});

test('a requested stack agent renders natively with its declared tools on all 8 targets', () => {
  assert.equal(typeof agents.writeAgents, 'function');
  for (const target of agents.AGENT_TARGET_IDS) {
    const cwd = mkdtempSync(join(tmpdir(), `rsc-stack-${target}-`));
    const written = agents.writeAgents(target, cwd, 'balanced', ['go-reviewer']);
    assert.equal(written.length, 1, target);
    const path = agents.agentPath(target, cwd, 'go-reviewer');
    assert.ok(existsSync(path), `${target}: go-reviewer`);
    const text = readFileSync(path, 'utf8');
    assert.match(text, /go-reviewer/);
    if (path.endsWith('.json')) {
      assert.deepEqual(JSON.parse(text).tools, ['read', 'search']);
    } else if (path.endsWith('.toml')) {
      assert.match(text, /^tools = \["read", "search"\]$/m);
    } else {
      assert.match(text, /^tools: \[read, search\]$/m);
    }
  }
});

test('the specialized bodies carry their discriminating stack attacks', () => {
  const cases = {
    'go-reviewer': [/goroutine lifetime/i, /errors\.Is/i, /interface nil/i],
    'cpp-reviewer': [/RAII/i, /moved-from/i, /exception guarantees/i],
    'python-reviewer': [/TaskGroup/i, /descriptor/i, /generator finalization/i],
    'mle-reviewer': [/temporal\/entity leakage/i, /fail open/i, /rollback without retraining/i],
    'spec-miner': [/extracted-draft/i, /40 files or 20,000 lines/i, /approved spec/i],
  };
  for (const [name, patterns] of Object.entries(cases)) {
    const body = agents.agentByName(name).body;
    for (const pattern of patterns) assert.match(body, pattern, `${name}: ${pattern}`);
  }
});
