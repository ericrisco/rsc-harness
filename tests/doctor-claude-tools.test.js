import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { doctor } from '../scripts/doctor.js';
import { targetPaths } from '../targets/index.js';
import { writeState } from '../scripts/lib/state.js';

function fixture(t, tools) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-doctor-tools-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, '.claude/agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude/settings.json'), '{}');
  writeState(targetPaths('claude', undefined, cwd).stateFile, { skills: {}, agents: ['react-reviewer'] });
  writeFileSync(join(cwd, '.claude/agents/react-reviewer.md'), `---\nname: react-reviewer\n${tools}\n---\nReview only.\n`);
  return cwd;
}
for (const tools of ['tools: [read, search]', 'tools: read, search', 'tools: [read, search] # readonly', 'tools: "read, search" # readonly', 'tools:\n- read\n- search', 'tools: [\n read,\n search\n]', 'tools:\n  - read\n  - search']) {
  test(`doctor reports generic Claude capabilities: ${tools}`, (t) => {
    const r = doctor({ target: 'claude', cwd: fixture(t, tools) });
    assert.equal(r.healthy, false);
    assert.deepEqual(r.invalidAgentTools[0].tools, ['read', 'search']);
    assert.match(r.invalidAgentTools[0].action, /sync/);
    assert.match(r.invalidAgentTools[0].action, /agents reset react-reviewer/);
  });
}
for (const tools of ['tools: Read, Grep, Glob', 'tools: Read, Grep # search', 'tools: "Read # read"', 'tools: [Read, Grep, Glob, mcp__local__query]', '', 'description: "tools: read, search"', 'description: |\n  tools: read, search']) {
  test(`doctor accepts native, inherited or custom tools: ${tools}`, (t) => {
    const r = doctor({ target: 'claude', cwd: fixture(t, tools) });
    assert.deepEqual(r.invalidAgentTools, []);
    assert.equal(r.healthy, true);
  });
}
