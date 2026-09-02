import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AGENT_TARGET_IDS, targetHasAgents, agentNames, agentPath, writeAgents, removeAgents,
  developerAgentPath, writeDeveloperAgent, removeDeveloperAgent, agentByName,
} from '../targets/agents.js';
import { applyInstall } from '../scripts/install-apply.js';
import { targetPaths } from '../targets/index.js';

// `review` already dispatches three fresh-context refuters at tier 2, and v1.0.14 gave them four
// rules — but all of it lived in PROSE inside a SKILL.md, reconstructed from memory on every run with
// nothing checking that it happened. That is P2 in its most expensive form.
//
// This file also guards the thing that made it possible: agents.js shipped ONE agent as module
// constants, so the registry was the actual work and `developer` is already deployed in user repos.
// Spec: 02-DOCS/wiki/sdd/specs/refuter-agent.md
const REFUTERS = ['refuter-correctness', 'refuter-security', 'refuter-tests'];
const tmp = (p) => mkdtempSync(join(tmpdir(), `ra-${p}-`));
const flat = (s) => s.replace(/\s+/g, ' ');

// ------------------------------------------------------------------ the registry

test('the registry ships developer plus the three refuter lenses', () => {
  assert.deepEqual(agentNames(), ['developer', ...REFUTERS]);
});

test('installing writes every declared agent, in the target own dir and extension', () => {
  for (const target of AGENT_TARGET_IDS) {
    const cwd = tmp(target);
    const written = writeAgents(target, cwd);
    assert.equal(written.length, agentNames().length, `${target}: expected one file per agent`);
    for (const name of agentNames()) {
      const p = agentPath(target, cwd, name);
      assert.ok(existsSync(p), `${target}: ${name} not written to ${p}`);
      assert.match(readFileSync(p, 'utf8'), new RegExp(name), `${target}: ${name} must name itself`);
    }
  }
});

test('a target without file-based agents writes nothing, and that is not a failure', () => {
  // The positive control: 9 of 17 targets have no installable agents and must stay silent.
  for (const target of ['amp', 'zed', 'windsurf', 'cline', 'aider']) {
    assert.equal(targetHasAgents(target), false, `${target} should have no file-based agents`);
    assert.deepEqual(writeAgents(target, tmp(target)), []);
    assert.equal(agentPath(target, tmp(target), 'developer'), null);
  }
});

test('adding a fourth agent costs nothing in the install machinery', () => {
  // The point of the registry: writeAgents iterates it, so the count follows the declaration.
  const cwd = tmp('count');
  assert.equal(writeAgents('claude', cwd).length, agentNames().length);
});

// ------------------------------------------------------------------ back-compat with deployed installs

test('developer still installs where it always did, at its tier', () => {
  const cwd = tmp('devcompat');
  writeAgents('claude', cwd);
  const p = join(cwd, '.claude', 'agents', 'developer.md');
  assert.ok(existsSync(p));
  const body = readFileSync(p, 'utf8');
  assert.match(body, /^name: developer$/m);
  assert.match(body, /^model: sonnet$/m, 'balanced tier on Claude is Sonnet, never Haiku');
  assert.match(body, /test-first/, 'the developer body must survive the registry move intact');
});

test('the old function names still work — deployed installs import them', () => {
  const cwd = tmp('alias');
  assert.equal(developerAgentPath('claude', cwd), agentPath('claude', cwd, 'developer'));
  assert.ok(writeDeveloperAgent('claude', cwd).length >= 1);
  assert.ok(existsSync(agentPath('claude', cwd, 'refuter-tests')), 'the alias writes the whole registry');
  assert.ok(removeDeveloperAgent('claude', cwd).length >= 1);
});

test('heavy tier is honored for every agent, and light is coerced away', () => {
  const cwd = tmp('heavy');
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  writeFileSync(join(cwd, '.rsc', 'developer.json'), JSON.stringify({ tier: 'heavy' }));
  writeAgents('claude', cwd);
  for (const n of agentNames()) {
    assert.match(readFileSync(agentPath('claude', cwd, n), 'utf8'), /^model: opus$/m, `${n} should be opus at heavy`);
  }
  writeFileSync(join(cwd, '.rsc', 'developer.json'), JSON.stringify({ tier: 'light' }));
  writeAgents('claude', cwd);
  assert.match(readFileSync(agentPath('claude', cwd, 'developer'), 'utf8'), /^model: sonnet$/m, 'light coerces to balanced');
});

// ------------------------------------------------------------------ uninstall

test('removeAgents takes the catalog agents and leaves a hand-written one alone', () => {
  const cwd = tmp('rmv');
  writeAgents('claude', cwd);
  const mine = join(cwd, '.claude', 'agents', 'my-own-agent.md');
  mkdirSync(dirname(mine), { recursive: true });
  writeFileSync(mine, 'mine');
  const removed = removeAgents('claude', cwd);
  assert.equal(removed.length, agentNames().length);
  assert.ok(existsSync(mine), 'an uninstaller that takes the user work is worse than one leaving residue');
});

test('removeAgents on a clean tree removes nothing and does not throw', () => {
  assert.deepEqual(removeAgents('claude', tmp('rmclean')), []);
});

// ------------------------------------------------------------------ the contract, in every lens

test('every refuter carries the four inputs, the withheld list and blind-first', () => {
  const cwd = tmp('contract');
  writeAgents('claude', cwd);
  for (const name of REFUTERS) {
    const body = flat(readFileSync(agentPath('claude', cwd, name), 'utf8'));
    assert.match(body, /exactly four inputs/i, `${name}: the input set must be named as closed`);
    for (const input of [/task contract/i, /approved spec/i, /exact source state/i, /entry point/i]) {
      assert.match(body, input, `${name}: missing an input`);
    }
    assert.match(body, /scope change a human explicitly approved/i, `${name}: approved scope changes or false positives follow`);
    assert.match(body, /do NOT get/i, `${name}: the withheld set must be explicit`);
    assert.match(body, /draft verdict/i, `${name}: the draft verdict must be withheld`);
    assert.match(body, /[Bb]lind first, compare second/, `${name}: blind-first must be required`);
    assert.match(body, /append-only/i, `${name}: the blind record must not be rewritable`);
    assert.match(body, /attack list is the deliverable/i, `${name}: the attack list must be a deliverable`);
    assert.match(body, /refute readiness/i, `${name}: the mandate must be to refute`);
  }
});

test('each lens carries its OWN lens inside it, not as a parameter', () => {
  // The decision from clarify: a lens passed at dispatch reintroduces the does-anyone-remember
  // dependency this whole spec exists to remove.
  const cwd = tmp('lens');
  writeAgents('claude', cwd);
  const read = (n) => flat(readFileSync(agentPath('claude', cwd, n), 'utf8'));
  assert.match(read('refuter-correctness'), /off-by-one/i);
  assert.match(read('refuter-security'), /authoriz|injection/i);
  assert.match(read('refuter-tests'), /mocks swallowing/i);
  // And they are genuinely different documents, not one file three times.
  assert.notEqual(read('refuter-correctness'), read('refuter-security'));
});

test('the correctness lens demands a gate prove BOTH directions', () => {
  // The half that was missing until v1.0.17, and the reason it was missing: twelve mutants proved the
  // integrity gate could fail and none asked whether it could pass.
  const cwd = tmp('gate');
  writeAgents('claude', cwd);
  const body = flat(readFileSync(agentPath('claude', cwd, 'refuter-correctness'), 'utf8'));
  assert.match(body, /Can it fail\?/);
  assert.match(body, /Can it pass\?/);
  assert.match(body, /[Oo]ver-blocking is not the safe side/);
  assert.match(body, /is not "the write targets that location"/);
});

test('a refuter fixes nothing and a spec gap goes to the human', () => {
  const cwd = tmp('nofix');
  writeAgents('claude', cwd);
  for (const name of REFUTERS) {
    const body = flat(readFileSync(agentPath('claude', cwd, name), 'utf8'));
    assert.match(body, /You fix nothing/i, `${name}: must not self-amend`);
    assert.match(body, /never to the builder to self-amend/i, `${name}: a SPEC gap is the human call`);
  }
});

test('the shared contract is written once in source, not three times', () => {
  // P5: three files are the accepted cost of putting the lens inside each one; triplicating the
  // contract text in the SOURCE is not.
  const src = readFileSync(new URL('../targets/agents.js', import.meta.url), 'utf8');
  const occurrences = (src.match(/exactly four inputs/g) || []).length;
  assert.equal(occurrences, 1, `the contract appears ${occurrences} times in source; it must be composed`);
});

test('every agent declares a real description and body', () => {
  for (const name of agentNames()) {
    const a = agentByName(name);
    assert.ok(a.desc && a.desc.length > 40, `${name}: needs a real description`);
    assert.ok(a.body && a.body.length > 200, `${name}: needs a real body`);
  }
});

// ------------------------------------------------------------------ the install state must not lie

test('install records EVERY agent it wrote, derived from the files not a hardcoded list', async () => {
  // Mutant M9 survived until this existed: hardcoding ['developer'] left the state claiming one agent
  // while four files sat on disk. A state entry that under-reports is a smaller lie than one that
  // over-reports, and still a lie — and it is the file `doctor` and `sync` read.
  const cwd = mkdtempSync(join(tmpdir(), 'ra-state-'));
  const home = mkdtempSync(join(tmpdir(), 'ra-home-'));
  await applyInstall({ skillIds: ['fastapi'], target: 'claude', home, cwd });
  const state = JSON.parse(readFileSync(targetPaths('claude', home, cwd).stateFile, 'utf8'));
  assert.deepEqual([...state.agents].sort(), [...agentNames(), 'fastapi-reviewer'].sort(),
    'the recorded agents must match what was written');
  for (const n of state.agents) {
    assert.ok(existsSync(agentPath('claude', cwd, n)), `${n} is recorded but its file is not there`);
  }
});
