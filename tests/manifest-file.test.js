import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readManifest, writeManifest, manifestPath } from '../scripts/lib/manifest-file.js';
import { resolveTargets, targetPaths } from '../targets/index.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-manifest-')); }
function installed(dir, target, skills = ['orient']) {
  const { stateFile } = targetPaths(target, undefined, dir);
  mkdirSync(join(stateFile, '..'), { recursive: true });
  const state = { skills: {} };
  for (const id of skills) state.skills[id] = { files: [], base: '' };
  writeFileSync(stateFile, JSON.stringify(state));
}

test('no manifest → null, never a throw', () => {
  assert.equal(readManifest(tmp()), null);
});

test('an unreadable manifest is reported, not silently ignored', () => {
  const d = tmp();
  writeFileSync(manifestPath(d), '{{{not json');
  assert.throws(() => readManifest(d), /\.rsc\.json/);
});

test('round-trips the team decision, and only the team decision', () => {
  const d = tmp();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient', 'harness'], ownSkills: ['nuestra-skill'],
    agents: ['go-reviewer'], catalogVersion: '1.1.3', tier: 'balanced', optOuts: ['gitmoji'], memory: false,
  });
  const m = readManifest(d);
  assert.deepEqual(m.targets, ['claude']);
  assert.deepEqual(m.skills, ['orient', 'harness']);
  assert.deepEqual(m.ownSkills, ['nuestra-skill']);
  assert.deepEqual(m.agents, ['go-reviewer']);
  assert.equal(m.catalogVersion, '1.1.3');
  assert.equal(m.tier, 'balanced');
  assert.deepEqual(m.optOuts, ['gitmoji']);
  assert.equal(m.memory, false);
});

// A merge conflict in a committed file must be resolvable by reading it. One entry
// per line and stable key order is what makes that true — a re-serialisation that
// reorders keys turns every concurrent edit into an unreadable diff.
test('serialisation is stable and one entry per line', () => {
  const d = tmp();
  const m = { targets: ['claude'], skills: ['b', 'a'], ownSkills: [], catalogVersion: '1', tier: 'balanced', optOuts: [] };
  writeManifest(d, m);
  const first = readFileSync(manifestPath(d), 'utf8');
  writeManifest(d, readManifest(d));
  assert.equal(readFileSync(manifestPath(d), 'utf8'), first, 'rewriting an unchanged manifest must not change bytes');
  assert.match(first, /"skills": \[\n\s+"b",\n\s+"a"\n\s+\]/, 'lists go one per line, order preserved');
});

// --- resolution order: flag > manifest > evidence > heuristic ----------------

test('the manifest beats on-disk evidence', () => {
  const d = tmp();
  installed(d, 'codex');
  writeManifest(d, { targets: ['claude'], skills: [], ownSkills: [], catalogVersion: '1', tier: 'balanced', optOuts: [] });
  const r = resolveTargets({ cwd: d });
  assert.deepEqual(r.ids, ['claude']);
  assert.equal(r.source, 'manifest');
});

test('the flag still beats the manifest', () => {
  const d = tmp();
  writeManifest(d, { targets: ['claude'], skills: [], ownSkills: [], catalogVersion: '1', tier: 'balanced', optOuts: [] });
  assert.deepEqual(resolveTargets({ cwd: d, flagValue: 'codex' }).ids, ['codex']);
});

test('a manifest declaring two targets is not ambiguity — the team chose both', () => {
  const d = tmp();
  writeManifest(d, { targets: ['claude', 'codex'], skills: [], ownSkills: [], catalogVersion: '1', tier: 'balanced', optOuts: [] });
  const r = resolveTargets({ cwd: d });
  assert.deepEqual(r.ids, ['claude', 'codex']);
  assert.equal(r.ambiguous, null);
});

test('no manifest → resolution behaves exactly as before', () => {
  const d = tmp();
  installed(d, 'codex');
  assert.equal(resolveTargets({ cwd: d }).source, 'evidence');
});

// --- written by a real install ---------------------------------------------
import { applyInstall } from '../scripts/install-apply.js';

test('installing writes the manifest with the team decision', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  const m = readManifest(d);
  assert.deepEqual(m.targets, ['claude']);
  assert.ok(m.skills.includes('orient'));
  assert.ok(m.catalogVersion, 'the version lock is what makes a clone reproducible');
});

test('installing into a second assistant merges, never replaces', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  await applyInstall({ skillIds: ['bro'], target: 'codex', home: d, cwd: d });
  const m = readManifest(d);
  assert.deepEqual(m.targets.sort(), ['claude', 'codex']);
  assert.ok(m.skills.includes('orient') && m.skills.includes('bro'));
});

test('re-installing the same thing leaves the manifest byte-identical', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  const before = readFileSync(manifestPath(d), 'utf8');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.equal(readFileSync(manifestPath(d), 'utf8'), before);
});
