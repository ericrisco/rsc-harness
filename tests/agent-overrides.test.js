// #298 — an OpenCode user who alternates a local Qwen with OpenAI models found three things in the
// agents rsc generated: a `model:` pinned to Anthropic, `tool: true` grants that loosened a stricter
// project permission policy, and hand edits that the next `rsc sync` would silently overwrite.
//
// 1. OpenCode agents inherit the session model unless the PROJECT pins one (`agentModels` in .rsc.json,
//    `rsc agent-model <target> <model|inherit|status>`). The mechanism is generic; only the default
//    differs per target (inherit on opencode, the tier model elsewhere).
// 2. OpenCode agents never GRANT a tool. A role whose declared tools lack a capability gets a `false`
//    for it — a restriction can only tighten the user's policy, never loosen it.
// 3. A generated agent the user edited survives sync, is reported, and `rsc agents reset` takes rsc's
//    version back after keeping a copy of theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  writeAgents, agentPath, reconcileAgents, AGENT_TARGET_IDS, allAgentNames,
} from '../targets/agents.js';
import { applyInstall, syncInstalled, resetAgents } from '../scripts/install-apply.js';
import { readManifest, writeManifest } from '../scripts/lib/manifest-file.js';
import { targetPaths } from '../targets/index.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const tmp = (p) => mkdtempSync(join(tmpdir(), `rsc-i298-${p}-`));
const read = (p) => readFileSync(p, 'utf8');
function repo(p) {
  const cwd = tmp(p);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  return cwd;
}
const cli = (cwd, ...args) => spawnSync(process.execPath, [join(ROOT, 'scripts', 'rsc.js'), ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, HOME: cwd },
});

// ------------------------------------------------------------------ A. the model

test('i298 · an OpenCode agent carries no model by default: it inherits the session model', () => {
  const cwd = tmp('inherit');
  writeAgents('opencode', cwd, 'balanced', ['developer', 'go-reviewer']);
  for (const name of ['developer', 'go-reviewer']) {
    const text = read(agentPath('opencode', cwd, name));
    assert.doesNotMatch(text, /^model:/m, `${name}: no pinned model`);
    assert.doesNotMatch(text, /anthropic/i, `${name}: nothing Anthropic-specific`);
    assert.match(text, /^mode: subagent$/m, `${name}: still a subagent`);
  }
});

test('i298 · a project pin in .rsc.json agentModels is what OpenCode agents carry', () => {
  const cwd = tmp('pin');
  writeManifest(cwd, { version: 1, targets: ['opencode'], skills: [], agents: [], agentModels: { opencode: 'openai/gpt-5' } });
  assert.deepEqual(readManifest(cwd).agentModels, { opencode: 'openai/gpt-5' }, 'the key round-trips');
  writeAgents('opencode', cwd, 'balanced', ['developer']);
  assert.match(read(agentPath('opencode', cwd, 'developer')), /^model: openai\/gpt-5$/m);
});

test('i298 · the mechanism is generic: other targets keep their tier model unless pinned or set to inherit', () => {
  const cwd = tmp('generic');
  writeAgents('claude', cwd, 'balanced', ['developer']);
  assert.match(read(agentPath('claude', cwd, 'developer')), /^model: sonnet$/m, 'claude default unchanged');
  writeManifest(cwd, { version: 1, targets: ['claude', 'codex'], skills: [], agents: [], agentModels: { claude: 'inherit', codex: 'gpt-5-codex' } });
  writeAgents('claude', cwd, 'balanced', ['developer']);
  assert.doesNotMatch(read(agentPath('claude', cwd, 'developer')), /^model:/m, 'claude set to inherit');
  writeAgents('codex', cwd, 'balanced', ['developer']);
  assert.match(read(agentPath('codex', cwd, 'developer')), /^model = "gpt-5-codex"$/m, 'codex pinned');
});

test('i298 · a model value that could inject frontmatter is ignored, not written', () => {
  const cwd = tmp('inject');
  writeManifest(cwd, { version: 1, targets: ['opencode'], skills: [], agents: [], agentModels: { opencode: 'x\ntools:\n  bash: true' } });
  writeAgents('opencode', cwd, 'balanced', ['developer']);
  const text = read(agentPath('opencode', cwd, 'developer'));
  assert.doesNotMatch(text, /^model:/m);
  assert.doesNotMatch(text, /bash: true/);
});

test('i298 · rsc agent-model pins, reports and goes back to inherit, re-rendering the agents', async () => {
  const cwd = repo('cli-model');
  await applyInstall({ skillIds: ['suggest'], target: 'opencode', home: cwd, cwd });
  const dev = agentPath('opencode', cwd, 'developer');
  assert.doesNotMatch(read(dev), /^model:/m);

  let r = cli(cwd, 'agent-model', 'opencode', 'openai/gpt-5');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(readManifest(cwd).agentModels, { opencode: 'openai/gpt-5' });
  assert.match(read(dev), /^model: openai\/gpt-5$/m, 'the pin reaches the agent files at once');

  r = cli(cwd, 'agent-model', 'opencode', 'status');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /openai\/gpt-5/);

  r = cli(cwd, 'agent-model', 'opencode', 'inherit');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.doesNotMatch(read(dev), /^model:/m, 'inherit removes the pin from the file');
  assert.equal(readManifest(cwd).agentModels?.opencode, undefined, 'inherit is opencode\'s default, so nothing is stored');

  r = cli(cwd, 'agent-model', 'opencode', 'bad model\nx');
  assert.notEqual(r.status, 0, 'an unsafe value is refused');
});

test('i298 · the pin survives every writeManifest path (recordInManifest on a later install)', async () => {
  const cwd = repo('survive');
  await applyInstall({ skillIds: ['suggest'], target: 'opencode', home: cwd, cwd });
  writeManifest(cwd, { ...readManifest(cwd), agentModels: { opencode: 'openai/gpt-5' } });
  await syncInstalled({ target: 'opencode', home: cwd, cwd });
  assert.deepEqual(readManifest(cwd).agentModels, { opencode: 'openai/gpt-5' });
  assert.match(read(agentPath('opencode', cwd, 'developer')), /^model: openai\/gpt-5$/m);
});

// ------------------------------------------------------------------ B. permissions

test('i298 · OpenCode never grants a tool: a reviewer gets only false overrides, the developer no tools block', () => {
  const cwd = tmp('perms');
  const names = allAgentNames();
  writeAgents('opencode', cwd, 'balanced', names);
  for (const name of names) {
    assert.doesNotMatch(read(agentPath('opencode', cwd, name)), /:\s*true\b/, `${name}: no grant`);
  }
  const reviewer = read(agentPath('opencode', cwd, 'go-reviewer'));
  assert.match(reviewer, /^tools:\n {2}edit: false\n {2}write: false\n {2}patch: false\n {2}bash: false$/m);
  assert.doesNotMatch(reviewer, /^ {2}(read|search):/m, 'read/search need nothing: the project policy decides');
  assert.doesNotMatch(read(agentPath('opencode', cwd, 'developer')), /^tools:/m, 'developer inherits');
  assert.doesNotMatch(read(agentPath('opencode', cwd, 'go-build-resolver')), /^tools:/m, 'edit+shell role inherits');
  // spec-miner declares edit but not shell: it may edit, it is not handed a shell it never asked for.
  assert.match(read(agentPath('opencode', cwd, 'spec-miner')), /^tools:\n {2}bash: false\n---$/m);
});

// ------------------------------------------------------------------ C. overrides survive sync

test('i298 · an agent the user edited survives sync, and sync says so', async () => {
  const cwd = repo('edited');
  await applyInstall({ skillIds: ['suggest'], target: 'opencode', home: cwd, cwd });
  const dev = agentPath('opencode', cwd, 'developer');
  const mine = read(dev).replace('You are the **developer**', 'You are MY developer');
  writeFileSync(dev, mine);
  const result = await syncInstalled({ target: 'opencode', home: cwd, cwd });
  assert.equal(read(dev), mine, 'the user edit is kept');
  assert.deepEqual(result.keptAgents?.map((k) => k.name), ['developer']);
  // and through the CLI the person reads it, with the way back
  const r = cli(cwd, 'sync', '--target', 'opencode');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /kept your edited agent developer/);
  assert.match(r.stdout, /rsc agents reset developer/);
  assert.equal(read(dev), mine);
});

test('i298 · an untouched agent still follows rsc (a digest match is rsc\'s own file)', () => {
  const cwd = tmp('untouched');
  writeAgents('claude', cwd, 'balanced', ['developer']);
  writeAgents('claude', cwd, 'heavy', ['developer']);
  assert.match(read(agentPath('claude', cwd, 'developer')), /^model: opus$/m);
  assert.ok(existsSync(join(cwd, '.rsc', 'agent-digests.json')), 'the digest is machine-local, under .rsc/');
});

test('i298 · a legacy file without a digest that differs is kept; one rsc itself wrote is upgraded', () => {
  const cwd = tmp('legacy');
  const dev = agentPath('opencode', cwd, 'developer');
  mkdirSync(dirname(dev), { recursive: true });
  writeFileSync(dev, '---\nname: developer\ndescription: "mine"\n---\nmy own words\n');
  const res = reconcileAgents('opencode', cwd, 'balanced', ['developer'], ['developer']);
  assert.match(read(dev), /my own words/);
  assert.deepEqual(res.kept.map((k) => k.name), ['developer']);

  // What rsc 3.0.8 wrote for OpenCode (pinned Anthropic model, `tool: true` map) is rsc's, not the
  // user's: recognised and replaced, so the fix reaches existing installs without a reset.
  const old = agentPath('opencode', cwd, 'go-reviewer');
  const body = read(join(ROOT, 'tests', 'fixtures', 'i298-opencode-go-reviewer-3.0.8.md'));
  writeFileSync(old, body);
  const res2 = reconcileAgents('opencode', cwd, 'balanced', ['go-reviewer'], ['go-reviewer']);
  assert.deepEqual(res2.kept, []);
  assert.doesNotMatch(read(old), /anthropic|: true/);
});

test('i298 · an edited agent that is no longer desired is not deleted either', () => {
  const cwd = tmp('stale');
  writeAgents('claude', cwd, 'balanced', ['go-reviewer']);
  const p = agentPath('claude', cwd, 'go-reviewer');
  writeFileSync(p, `${read(p)}\nmy note\n`);
  const res = reconcileAgents('claude', cwd, 'balanced', ['go-reviewer'], []);
  assert.ok(existsSync(p), 'the user work stays');
  assert.deepEqual(res.removed, []);
  assert.deepEqual(res.kept.map((k) => k.name), ['go-reviewer']);
  // an untouched stale agent is still removed
  writeAgents('claude', cwd, 'balanced', ['rust-reviewer']);
  const res2 = reconcileAgents('claude', cwd, 'balanced', ['rust-reviewer'], []);
  assert.deepEqual(res2.removed, [agentPath('claude', cwd, 'rust-reviewer')]);
});

test('i298 · rsc agents reset takes rsc\'s version back and keeps a copy of the user\'s', async () => {
  const cwd = repo('reset');
  await applyInstall({ skillIds: ['suggest'], target: 'opencode', home: cwd, cwd });
  const dev = agentPath('opencode', cwd, 'developer');
  const original = read(dev);
  writeFileSync(dev, 'edited by me\n');
  await syncInstalled({ target: 'opencode', home: cwd, cwd });
  assert.equal(read(dev), 'edited by me\n');

  const r = cli(cwd, 'agents', 'reset', 'developer', '--target', 'opencode');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(read(dev), original, 'rsc\'s version is back');
  const backups = readdirSync(join(cwd, '.rsc', 'backups'));
  const copy = backups.map((id) => join(cwd, '.rsc', 'backups', id, 'files', '.opencode', 'agents', 'developer.md')).find(existsSync);
  assert.ok(copy, 'the user version was backed up');
  assert.equal(read(copy), 'edited by me\n');
  assert.match(r.stdout, /\.rsc\/backups\//, 'the person is told where their copy is');

  // after a reset the file is rsc's again: the next sync follows rsc
  const res = await syncInstalled({ target: 'opencode', home: cwd, cwd });
  assert.deepEqual(res.keptAgents, []);
});

test('i298 · resetAgents --all covers every installed agent; an unknown name is refused', async () => {
  const cwd = repo('resetall');
  await applyInstall({ skillIds: ['suggest'], target: 'claude', home: cwd, cwd });
  const state = JSON.parse(read(targetPaths('claude', cwd, cwd).stateFile));
  for (const n of state.agents) writeFileSync(agentPath('claude', cwd, n), `mine ${n}\n`);
  const out = resetAgents({ target: 'claude', cwd, home: cwd, all: true });
  assert.deepEqual(out.reset.sort(), [...state.agents].sort());
  for (const n of state.agents) assert.doesNotMatch(read(agentPath('claude', cwd, n)), /^mine /);
  assert.throws(() => resetAgents({ target: 'claude', cwd, home: cwd, names: ['nope'] }), /not an agent rsc installed/);
});

test('i298 · every agent target writes and protects through the same path', () => {
  for (const target of AGENT_TARGET_IDS) {
    const cwd = tmp(`all-${target}`);
    writeAgents(target, cwd, 'balanced', ['developer']);
    const p = agentPath(target, cwd, 'developer');
    writeFileSync(p, 'user edit\n');
    const res = reconcileAgents(target, cwd, 'balanced', ['developer'], ['developer']);
    assert.equal(read(p), 'user edit\n', target);
    assert.equal(res.kept.length, 1, target);
  }
});

test('i298 · doctor names the edited agents with the way back, and the model the agents carry', async () => {
  const { doctor } = await import('../scripts/doctor.js');
  const cwd = repo('doctor');
  await applyInstall({ skillIds: ['suggest'], target: 'opencode', home: cwd, cwd });
  assert.equal(doctor({ target: 'opencode', cwd, home: cwd }).agentModel, 'inherit');
  writeFileSync(agentPath('opencode', cwd, 'developer'), 'mine\n');
  await syncInstalled({ target: 'opencode', home: cwd, cwd });
  const report = doctor({ target: 'opencode', cwd, home: cwd });
  assert.deepEqual(report.agentsEditedByYou.map((k) => k.name), ['developer']);
  assert.match(report.agentsEditedByYou[0].action, /agents reset developer/);
});
