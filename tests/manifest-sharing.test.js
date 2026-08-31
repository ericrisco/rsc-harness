import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, collisions, ignoreLocalState } from '../scripts/install-apply.js';
import { divergence } from '../scripts/lib/divergence.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'rsc-share-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  return d;
}
// Ask git, never reason about the pattern: `.rsc/` does not match `.rsc.json` today,
// but a user's own `.rsc*` would, and a rule we merely believe is not a rule.
function ignored(d, path) {
  try { execFileSync('git', ['check-ignore', '-q', path], { cwd: d }); return true; }
  catch { return false; }
}

test('the manifest is never excluded from git', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  ignoreLocalState(d);
  assert.equal(ignored(d, '.rsc.json'), false);
  assert.equal(ignored(d, '.rsc/'), true, 'machine state still stays out');
});

test('a hand-written skill in the shared directory keeps its place in git', async () => {
  const d = repo();
  mkdirSync(join(d, '.claude', 'skills', 'mi-skill'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'mi-skill', 'SKILL.md'), '# mine');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  ignoreLocalState(d, 'claude');
  assert.equal(ignored(d, '.claude/skills/mi-skill/SKILL.md'), false, 'their work must stay versioned');
  assert.equal(ignored(d, '.claude/skills/orient'), true, 'what rsc manages does not');
});

test('the ignore file is only ever appended to — never reordered', async () => {
  const d = repo();
  writeFileSync(join(d, '.gitignore'), 'node_modules/\n.env\n');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  ignoreLocalState(d, 'claude');
  const lines = readFileSync(join(d, '.gitignore'), 'utf8').split('\n');
  assert.equal(lines[0], 'node_modules/');
  assert.equal(lines[1], '.env');
});

// --- collisions -------------------------------------------------------------

test('a hand-written skill sharing a catalog name is named before anything is overwritten', () => {
  const d = repo();
  mkdirSync(join(d, '.claude', 'skills', 'orient'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'orient', 'SKILL.md'), '# three months of my work');
  assert.deepEqual(collisions({ cwd: d, target: 'claude', skillIds: ['orient', 'bro'] }), ['orient']);
});

test('an rsc-managed skill is not a collision — it is ours to replace', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(collisions({ cwd: d, target: 'claude', skillIds: ['orient'] }), []);
});

// --- divergence -------------------------------------------------------------

test('a skill the teammate added shows as missing', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  writeManifest(d, { targets: ['claude'], skills: ['orient', 'harness'], ownSkills: [], catalogVersion: '1', tier: null, optOuts: [] });
  const v = divergence({ cwd: d, target: 'claude' });
  assert.deepEqual(v.missing, ['harness']);
});

test('a declared own-skill absent from the repo is reported, and never written', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  writeManifest(d, { targets: ['claude'], skills: ['orient'], ownSkills: ['nuestra'], catalogVersion: '1', tier: null, optOuts: [] });
  const v = divergence({ cwd: d, target: 'claude' });
  assert.deepEqual(v.ownMissing, ['nuestra']);
  assert.deepEqual(v.missing, [], 'an own-skill is not something rsc can install');
});

test('an undeclared hand-written skill is not a divergence at all', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'mia'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'mia', 'SKILL.md'), '# mine');
  const v = divergence({ cwd: d, target: 'claude' });
  assert.ok(!v.missing.includes('mia') && !v.extra.includes('mia') && !v.ownMissing.includes('mia'));
});

test('no manifest → nothing to diverge from', () => {
  const d = repo();
  const v = divergence({ cwd: d, target: 'claude' });
  assert.deepEqual([v.missing, v.extra, v.ownMissing], [[], [], []]);
});

// The whole point of the manifest: a clone has no per-target state (it is machine
// wiring and does not travel), so sync used to find zero skills and do nothing —
// leaving the person with a repo that declares a harness and has none.
test('a clone rebuilds from the manifest alone', async () => {
  const { syncInstalled } = await import('../scripts/install-apply.js');
  const d = repo();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient', 'bro'], ownSkills: [],
    catalogVersion: '1.1.3', tier: null, optOuts: [],
  });
  const r = await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.deepEqual(r.synced.sort(), ['bro', 'orient']);
  assert.ok(readFileSync(join(d, '.claude', 'skills', 'orient', 'SKILL.md'), 'utf8').length > 0);
});

test('sync still prefers what is installed when there is no manifest', async () => {
  const { syncInstalled } = await import('../scripts/install-apply.js');
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  const r = await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.ok(r.synced.includes('orient'));
});
