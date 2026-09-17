import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOnboardingPlan, normalizeOnboarding } from '../scripts/lib/onboarding.js';

// Installing used to ask two questions nobody can answer at minute zero: which profile, and whether
// the project is software. Both turned a guess into a lasting limitation, and the default guess —
// `minimal`, 8 skills — contained NONE of the ten phases the always-on layer routes work to. The
// first real request of every new install therefore stopped to install what the harness had just
// demanded. One harness, installed whole, removes the question rather than improving the guess.
const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'scripts', 'rsc.js');
const TMP = [];
const scan = { schemaVersion: 1, signals: [], stacks: [], complexitySignals: [], sourceFileCount: 0, parentHarness: null };

function planFor(kind, scope) {
  const record = { technicalLevel: 'mixed', accompaniment: 'L2', projectKind: kind, goal: 'algo', targets: ['claude'] };
  if (scope) record.softwareScope = scope;
  return buildOnboardingPlan(normalizeOnboarding(record), scan);
}

test.after(() => { for (const d of TMP) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } } });

test('1 · every kind of project is offered the same set of skills', () => {
  const kinds = ['software', 'operations', 'research', 'content', 'mixed'];
  const sets = kinds.map((k) => [...planFor(k, 'small').policy.skills].sort().join(','));
  assert.equal(new Set(sets).size, 1,
    'the ops-vs-code fork asked the user to predict which half of the harness they would need');
});

test('2 · and the size of the work no longer changes what is installed', () => {
  const small = [...planFor('software', 'small').policy.skills].sort().join(',');
  const large = [...planFor('software', 'complex').policy.skills].sort().join(',');
  assert.equal(small, large, 'a guess about scope must not become a lasting limitation');
});

test('3 · the installed set contains the three layers, chain included', () => {
  const skills = planFor('operations', 'small').policy.skills;
  for (const id of ['suggest', 'orient', 'harness', 'init']) assert.ok(skills.includes(id), `harness layer: ${id}`);
  assert.ok(skills.includes('ftd'), 'the default lane must be there to be routed to');
  for (const id of ['sdd', 'specify', 'plan', 'implement', 'verify', 'ship']) {
    assert.ok(skills.includes(id), `chain: ${id} — the default install used to contain none of these`);
  }
});

test('4 · and it stays the harness, not the whole catalog', () => {
  const skills = planFor('software', 'complex').policy.skills;
  assert.ok(skills.length < 60, `installed ${skills.length}; the catalog is not the harness (context-budget)`);
  assert.ok(!skills.includes('godot') && !skills.includes('n8n'), 'domain skills still arrive on demand');
});

test('5 · asking for a profile is refused with what replaced it, not with a stack trace', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-single-')); TMP.push(cwd);
  const out = spawnSync('node', [CLI, 'install', '--profile', 'minimal'], { cwd, encoding: 'utf8' });
  const said = out.stdout + out.stderr;
  assert.doesNotMatch(said, /Profile 'minimal' installed/, 'the choice must be gone, not renamed');
  assert.match(said, /profile|perfil/i, 'and the refusal must name what the user asked for');
  assert.ok(!/at Object\.|at Module\./.test(said), 'a refusal is not a crash (P6)');
});

test('6 · the README no longer sells three profiles', () => {
  const readme = readFileSync(join(HERE, '..', 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /--profile (minimal|core|full)/,
    'a documented flag that no longer exists is a promise the code breaks');
});
