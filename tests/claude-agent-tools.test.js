import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { agentPath, writeAgentsDetailed } from '../targets/agents.js';

function project(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rsc-claude-tools-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const read = (dir, name) => readFileSync(agentPath('claude', dir, name), 'utf8');

test('Claude reviewers and resolvers receive native tools; unrestricted agents inherit', (t) => {
  const dir = project(t);
  writeAgentsDetailed('claude', dir, 'balanced', ['react-reviewer', 'react-build-resolver', 'developer']);
  assert.match(read(dir, 'react-reviewer'), /^tools: Read, Grep, Glob$/m);
  assert.match(read(dir, 'react-build-resolver'), /^tools: Read, Grep, Glob, Edit, Write, Bash$/m);
  assert.doesNotMatch(read(dir, 'developer'), /^tools:/m);
});

test('sync migrates an unedited legacy rendering even when local digests are absent', (t) => {
  const dir = project(t);
  const names = ['react-reviewer', 'react-build-resolver'];
  writeAgentsDetailed('claude', dir, 'balanced', names);
  for (const name of names) {
    const generic = name.endsWith('reviewer') ? 'read, search' : 'read, search, edit, shell';
    writeFileSync(agentPath('claude', dir, name), read(dir, name).replace(/^tools:.*$/m, `tools: [${generic}]`));
  }
  rmSync(join(dir, '.rsc/agent-digests.json'));
  const result = writeAgentsDetailed('claude', dir, 'balanced', names);
  assert.equal(result.kept.length, 0);
  assert.match(read(dir, names[0]), /^tools: Read, Grep, Glob$/m);
  assert.match(read(dir, names[1]), /^tools: Read, Grep, Glob, Edit, Write, Bash$/m);
});

test('sync preserves a user-customized Claude agent and its tools', (t) => {
  const dir = project(t);
  writeAgentsDetailed('claude', dir, 'balanced', ['react-reviewer']);
  const custom = read(dir, 'react-reviewer').replace(/^tools:.*$/m, 'tools: Read, mcp__project__inspect') + '\nCustom policy.\n';
  writeFileSync(agentPath('claude', dir, 'react-reviewer'), custom);
  assert.equal(writeAgentsDetailed('claude', dir, 'balanced', ['react-reviewer']).kept.length, 1);
  assert.equal(read(dir, 'react-reviewer'), custom);
});
