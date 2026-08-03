// capabilities.test.js — the automation-gap rule says "never propose creating a
// skill or agent before checking what exists". These tests exist so that rule is a
// mechanism rather than a claim (P2), and so the always-on cost stays bounded (P5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { capabilities, listAgents, appendGap, countGaps, gapLogPath, GAP_VERDICTS } from '../scripts/lib/capabilities.js';
import { AGENT_TARGET_IDS, targetHasAgents } from '../targets/agents.js';
import { TARGET_IDS } from '../targets/index.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const RSC = join(REPO, 'scripts', 'rsc.js');
const SUGGEST = join(REPO, 'skills', 'suggest', 'SKILL.md');

// --- the enumeration covers all three sources ------------------------------------

test('capabilities: reports installed skills, catalog skills and agents in one pass', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-caps-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-caps-home-'));
  const caps = capabilities({ target: 'claude', home, cwd });
  for (const key of ['installed', 'available', 'agents']) {
    assert.ok(Array.isArray(caps[key]), `missing source: ${key}`);
  }
  assert.equal(typeof caps.agentsSupported, 'boolean');
  // A fresh project has nothing installed, so the whole catalog is available.
  assert.equal(caps.installed.length, 0);
  assert.ok(caps.available.length > 200, `expected the catalog, got ${caps.available.length}`);
  assert.ok(caps.available.every((s) => s.id && typeof s.description === 'string'));
});

test('capabilities: finds agent files in both project and user scope', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-caps-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-caps-home-'));
  mkdirSync(join(cwd, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'agents', 'migrator.md'), '# migrator\n');
  writeFileSync(join(home, '.claude', 'agents', 'reviewer.md'), '# reviewer\n');
  writeFileSync(join(cwd, '.claude', 'agents', 'notes.txt'), 'not an agent\n');
  const { supported, agents } = listAgents({ target: 'claude', home, cwd });
  assert.equal(supported, true);
  const ids = agents.map((a) => `${a.scope}:${a.id}`);
  assert.deepEqual(ids, ['project:migrator', 'user:reviewer']);
  assert.ok(agents.every((a) => a.path.endsWith('.md')), 'only agent files, not stray files');
});

test('capabilities: a target without file-based agents reports unsupported, never fails', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-caps-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-caps-home-'));
  const without = TARGET_IDS.filter((t) => !targetHasAgents(t));
  assert.ok(without.length > 0, 'some targets have no file-based agents — that is the case under test');
  for (const t of without) {
    const r = listAgents({ target: t, home, cwd });
    assert.equal(r.supported, false, `${t} should report unsupported`);
    assert.deepEqual(r.agents, []);
    assert.equal(capabilities({ target: t, home, cwd }).agentsSupported, false);
  }
  // And the ones that do support them are exactly the declared set — one source of truth.
  for (const t of AGENT_TARGET_IDS) assert.equal(targetHasAgents(t), true);
});

test('capabilities CLI: prints all three kinds, and says so when agents do not apply', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-caps-'));
  mkdirSync(join(cwd, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'agents', 'migrator.md'), '# migrator\n');
  const claude = spawnSync('node', [RSC, 'capabilities', '--target', 'claude'], { cwd, encoding: 'utf8' });
  assert.equal(claude.status, 0, claude.stderr);
  assert.match(claude.stdout, /^skill\t\S+\tavailable\t/m);
  assert.match(claude.stdout, /^agent\tmigrator\tproject\t/m);
  const aider = spawnSync('node', [RSC, 'capabilities', '--target', 'aider'], { cwd, encoding: 'utf8' });
  assert.equal(aider.status, 0, aider.stderr);
  assert.match(aider.stdout, /no file-based agents/, 'an unsupported target must say so, not stay silent');
  const json = spawnSync('node', [RSC, 'capabilities', '--target', 'claude', '--json'], { cwd, encoding: 'utf8' });
  assert.ok(JSON.parse(json.stdout).available.length > 200);
});

// --- P5: the always-on cost is bounded by a number, not an adjective ---------------

test('automation gap: the always-on rule stays within its byte ceiling', () => {
  const body = readFileSync(SUGGEST, 'utf8');
  const section = /### Automation gap[\s\S]*?(?=\n---|\n## |$)/.exec(body);
  assert.ok(section, 'the automation-gap rule must be present in the always-on body');
  const bytes = Buffer.byteLength(section[0].trim());
  assert.ok(bytes <= 320, `the always-on rule is ${bytes} bytes; the ceiling is 320 — put detail in skill-scout, not here`);
  // The rule must point at the command and at where the detail lives, or it is not
  // actionable from the always-on layer alone.
  assert.match(section[0], /rsc capabilities/);
  assert.match(section[0], /skill-scout/);
});

test('automation gap: the detail lives in skill-scout, not in the always-on body', () => {
  const scout = readFileSync(join(REPO, 'skills', 'skill-scout', 'SKILL.md'), 'utf8');
  assert.match(scout, /AGENT-COVERS/, 'the agent branch must exist in the decision table');
  assert.match(scout, /gap-log/, 'the recording step must be documented where it is performed');
  assert.match(scout, /building-agents/, 'the agent build path must be routed');
  assert.match(scout, /Skill or agent/, 'the skill-vs-agent criterion belongs here');
});

// --- the gap log: shape enforced by code, privacy enforced by the skill -------------

test('gap log: records procedure and verdict, and rejects a missing one', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gap-'));
  assert.equal(countGaps(cwd), 0);
  appendGap({ procedure: 'audit branches by content before deleting them', verdict: 'proposed-accepted', cwd });
  appendGap({ procedure: 'verify a release is in sync across git/npm/tag/release', verdict: 'covered-installed', cwd });
  assert.equal(countGaps(cwd), 2);
  const text = readFileSync(gapLogPath(cwd), 'utf8');
  assert.match(text, /audit branches by content/);
  assert.match(text, /\*\*proposed-accepted\*\*/);
  assert.match(text, /No contiene peticiones del usuario/, 'the header states the boundary for whoever reads it');

  assert.throws(() => appendGap({ procedure: '', verdict: 'proposed-accepted', cwd }), /Recover:/);
  assert.throws(() => appendGap({ procedure: 'x', verdict: 'made-up', cwd }), /Recover:/);
  for (const v of GAP_VERDICTS) {
    assert.doesNotThrow(() => appendGap({ procedure: `p-${v}`, verdict: v, cwd }));
  }
});

test('gap log: entries stay one line each, so the format cannot drift', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gap-'));
  appendGap({ procedure: 'a procedure\nwith embedded\nnewlines', verdict: 'proposed-declined', cwd });
  const entries = readFileSync(gapLogPath(cwd), 'utf8').split('\n').filter((l) => l.startsWith('- 2'));
  assert.equal(entries.length, 1, 'a multi-line description must collapse to a single entry');
  assert.match(entries[0], /a procedure with embedded newlines/);
});

test('gap log CLI: writes through the command and refuses an invalid verdict', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gap-'));
  const ok = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', 'sync four release surfaces', '--verdict', 'covered-agent'], { cwd, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(countGaps(cwd), 1);
  const bad = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', 'x', '--verdict', 'nope'], { cwd, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /Recover:/);
  // A valueless flag is a usage error, not a crash.
  const bare = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure'], { cwd, encoding: 'utf8' });
  assert.equal(bare.status, 1);
  assert.doesNotMatch(bare.stdout + bare.stderr, /TypeError|is not a function/);
});
