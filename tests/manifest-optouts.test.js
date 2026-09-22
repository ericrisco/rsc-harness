import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, syncInstalled } from '../scripts/install-apply.js';
import { readManifest, writeManifest } from '../scripts/lib/manifest-file.js';

// `project-manifest` put the team's disarmed gates into the committed declaration and then never
// read them back: `optOuts` was written on every install and consulted by nothing. These tests
// hold the two halves the spec actually approved — a clone REBUILDS the decision, and a machine
// that already has one KEEPS it — and the line between them, which is whether `.rsc/` was there
// before the install started.

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'rsc-optouts-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  return d;
}
const marker = (d, name) => join(d, '.rsc', `.no-${name}`);
function disarm(d, name) {
  mkdirSync(join(d, '.rsc'), { recursive: true });
  writeFileSync(marker(d, name), '');
}

// --- what gets recorded ------------------------------------------------------

test('a disarmed project gate is recorded in the manifest', async () => {
  const d = repo();
  disarm(d, 'gitmoji');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji']);
});

// The switch that must never travel. One person declining the harness on their laptop would
// otherwise commit "harness" and silence the bootstrap offer in every future clone.
test('a machine-only switch is never recorded', async () => {
  const d = repo();
  disarm(d, 'harness');
  disarm(d, 'context7');
  disarm(d, 'gitmoji');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji']);
});

// The sticky merge: `optOuts.length ? optOuts : prev.optOuts` could never record a removal, so
// re-arming a gate was impossible by the ordinary route once anything read the field.
test('re-arming a gate retires it from the manifest', async () => {
  const d = repo();
  disarm(d, 'gitmoji');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji']);
  rmSync(marker(d, 'gitmoji'));
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(readManifest(d).optOuts, [], 'the deletion IS the decision');
});

// ...but the fallback it replaced existed for a real reason: in a clone `.rsc/` is absent, and
// "I cannot see any markers" must not be read as "the team re-armed everything".
test('a clone with no .rsc/ never erases the declared decision', async () => {
  const d = repo();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient'], ownSkills: [],
    catalogVersion: '1', tier: null, optOuts: ['gitmoji'],
  });
  assert.equal(existsSync(join(d, '.rsc')), false);
  await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji']);
});

// --- hydration ---------------------------------------------------------------

test('a clone rebuilds the disarmed gate as a real marker file', async () => {
  const d = repo();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient'], ownSkills: [],
    catalogVersion: '1', tier: null, optOuts: ['gitmoji', 'ship-guard'],
  });
  await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.ok(existsSync(marker(d, 'gitmoji')), 'the guard the team disarmed must come back disarmed');
  assert.ok(existsSync(marker(d, 'ship-guard')));
});

test('hydration never resurrects a machine-only switch', async () => {
  const d = repo();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient'], ownSkills: [],
    // A manifest written by an older version, before the partition existed.
    catalogVersion: '1', tier: null, optOuts: ['gitmoji', 'harness', 'context7'],
  });
  await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.ok(existsSync(marker(d, 'gitmoji')));
  assert.equal(existsSync(marker(d, 'harness')), false, 'declining the harness is not the team speaking');
  assert.equal(existsSync(marker(d, 'context7')), false);
});

// The case that makes hydration safe: on a machine that already HAS `.rsc/`, the local state is
// the authority. Re-materializing from the manifest here would undo the re-arm above on the very
// next sync, and the person would never find out why the gate came back.
test('an existing .rsc/ is authoritative — sync does not re-materialize', async () => {
  const d = repo();
  disarm(d, 'gitmoji');
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  rmSync(marker(d, 'gitmoji'));
  writeManifest(d, { ...readManifest(d), optOuts: ['gitmoji'] }); // as if a teammate's commit arrived
  await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.equal(existsSync(marker(d, 'gitmoji')), false, 'a git pull does not rewrite this machine');
});

// --- tier, the same hole by the same commit ----------------------------------

test('a clone rebuilds the declared developer tier', async () => {
  const d = repo();
  writeManifest(d, {
    targets: ['claude'], skills: ['orient'], ownSkills: [],
    catalogVersion: '1', tier: 'heavy', optOuts: [],
  });
  await syncInstalled({ target: 'claude', home: d, cwd: d });
  const file = join(d, '.rsc', 'developer.json');
  assert.ok(existsSync(file), 'the tier is a decision too, and it did not travel either');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).tier, 'heavy');
});

// --- what the diagnosis says -------------------------------------------------

// Hydration only fires where `.rsc/` was absent, which is right and which leaves one case
// uncovered on purpose: a machine that is already built and receives a teammate's decision by
// `git pull`. Nothing may be applied there, so the whole debt is to SAY it — and `doctor` is the
// one surface that reports rather than nags, on every run instead of once per session.
test('doctor names a gate the team disarmed and this machine still arms', async () => {
  const { doctor } = await import('../scripts/doctor.js');
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  writeManifest(d, { ...readManifest(d), optOuts: ['gitmoji', 'harness'] });
  const report = doctor({ cwd: d, target: 'claude', home: d });
  assert.deepEqual(report.optOutsNotApplied, ['gitmoji'], 'and never the machine-only one');
  assert.equal(report.gitmojiGuard, 'armed');
  disarm(d, 'gitmoji');
  assert.deepEqual(doctor({ cwd: d, target: 'claude', home: d }).optOutsNotApplied, []);
});

test('doctor stays quiet when there is no manifest', async () => {
  const { doctor } = await import('../scripts/doctor.js');
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  assert.deepEqual(doctor({ cwd: d, target: 'claude', home: d }).optOutsNotApplied, []);
});
