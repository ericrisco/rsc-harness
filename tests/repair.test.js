import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diagnose, repair } from '../scripts/lib/repair.js';
import { applyInstall } from '../scripts/install-apply.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'rsc-repair-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  return d;
}
const files = (d) => execFileSync('find', [d, '-type', 'f'], { encoding: 'utf8' }).split('\n').sort().join('\n');

test('a folder with no rsc in it is left completely alone', async () => {
  const d = repo();
  writeFileSync(join(d, 'README.md'), '# nada que ver');
  const before = files(d);
  const r = await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.deepEqual(r.applied, []);
  assert.equal(files(d), before, 'not one byte');
});

test('a healthy harness reports nothing and writes nothing', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  assert.deepEqual(diagnose({ cwd: d, target: 'claude', home: d }), []);
});

// --- restorations go by themselves ------------------------------------------

test('the 0.1 nested layout is swept without reinstalling anything', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'rsc', 'orient'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'rsc', 'orient', 'SKILL.md'), '# 0.1 leftovers');
  const found = diagnose({ cwd: d, target: 'claude', home: d });
  assert.equal(found.find((f) => f.id === 'nested-layout')?.class, 'restore');
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.equal(existsSync(join(d, '.claude', 'skills', 'rsc')), false);
});

test('quadrupled hook entries are left at exactly one of each', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  const sf = join(d, '.claude', 'settings.json');
  const s = JSON.parse(readFileSync(sf, 'utf8'));
  s.hooks.SessionStart = [...s.hooks.SessionStart, ...s.hooks.SessionStart, ...s.hooks.SessionStart, ...s.hooks.SessionStart];
  writeFileSync(sf, JSON.stringify(s, null, 2));
  assert.equal(diagnose({ cwd: d, target: 'claude', home: d }).find((f) => f.id === 'duplicate-hooks')?.class, 'restore');
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.equal(JSON.parse(readFileSync(sf, 'utf8')).hooks.SessionStart.length, 1);
});

test('a clone with dangling links is rebuilt from the manifest', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  rmSync(join(d, '.rsc'), { recursive: true, force: true });
  assert.equal(diagnose({ cwd: d, target: 'claude', home: d }).find((f) => f.id === 'dangling-links')?.class, 'restore');
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.ok(readFileSync(join(d, '.claude', 'skills', 'orient', 'SKILL.md'), 'utf8').length > 0);
});

// --- changes are asked, never taken -----------------------------------------

test('a wrong target is a change, so it is never applied on its own', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));   // a 0.1 install predates the manifest — that is the case
  writeFileSync(join(d, 'CLAUDE.md'), '# this is a Claude Code project');
  const found = diagnose({ cwd: d, target: 'codex', home: d });
  const wrong = found.find((f) => f.id === 'wrong-target');
  assert.equal(wrong?.class, 'change');
  const r = await repair({ cwd: d, target: 'codex', home: d, invoked: true });
  assert.ok(r.pending.some((f) => f.id === 'wrong-target'), 'a change with nobody to ask stays pending');
});

test('with a change pending, the restorations still get done', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  writeFileSync(join(d, 'CLAUDE.md'), '# claude');
  mkdirSync(join(d, '.codex', 'rsc', 'rsc'), { recursive: true });
  const r = await repair({ cwd: d, target: 'codex', home: d, invoked: true });
  assert.ok(r.applied.some((f) => f.id === 'nested-layout'), 'blocking these on an unrelated decision wastes them');
  assert.ok(r.pending.length);
});

// --- the guarantees ---------------------------------------------------------

test('repairing twice changes nothing the second time', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'rsc'), { recursive: true });
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  const after = files(d);
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.equal(files(d), after);
});

test('dry-run writes nothing and still says what it would do', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'rsc'), { recursive: true });
  const before = files(d);
  const r = await repair({ cwd: d, target: 'claude', home: d, invoked: true, dryRun: true });
  assert.equal(files(d), before);
  assert.ok(r.applied.some((f) => f.id === 'nested-layout'));
});

test('an autonomous repair always leaves a recoverable copy', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'rsc'), { recursive: true });
  const r = await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.ok(r.backup, 'nothing autonomous happens without a way back');
});

// The one guarantee that matters most: repair never touches what it did not install.
test('a hand-written skill and agent survive a full rebuild from scratch', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  mkdirSync(join(d, '.claude', 'skills', 'mia'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', 'mia', 'SKILL.md'), '# three months');
  writeFileSync(join(d, '.claude', 'agents', 'mi-agente.md'), '# mine');
  rmSync(join(d, '.rsc'), { recursive: true, force: true });
  await repair({ cwd: d, target: 'claude', home: d, invoked: true });
  assert.equal(readFileSync(join(d, '.claude', 'skills', 'mia', 'SKILL.md'), 'utf8'), '# three months');
  assert.equal(readFileSync(join(d, '.claude', 'agents', 'mi-agente.md'), 'utf8'), '# mine');
});

test('a missing manifest is a restoration when the person asked, a change when we noticed', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  const asked = diagnose({ cwd: d, target: 'claude', home: d, invoked: true });
  const noticed = diagnose({ cwd: d, target: 'claude', home: d, invoked: false });
  assert.equal(asked.find((f) => f.id === 'no-manifest')?.class, 'restore');
  assert.equal(noticed.find((f) => f.id === 'no-manifest')?.class, 'change');
});

// A manifest declaring codex means the team CHOSE codex. Reading that as a wrong target
// would be rsc second-guessing a decision that was made on purpose.
test('a target the manifest declares is never called wrong', async () => {
  const d = repo();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  writeFileSync(join(d, 'CLAUDE.md'), '# looks like claude, but the team said codex');
  assert.equal(diagnose({ cwd: d, target: 'codex', home: d }).find((f) => f.id === 'wrong-target'), undefined);
});

// The headline case of #249: wired to an assistant nobody chose, with a block stamped
// into a file the user wrote by hand. Accepting the move must actually move it — and give
// that file back exactly as it was, not merely close enough.
test('accepting the move rewires to the right assistant and gives the file back byte-identical', async () => {
  const d = repo();
  const constitution = '# Constitucion\n\n## Uno\ntexto\n\n\n\n## Dos\ntexto\n';
  writeFileSync(join(d, 'AGENTS.md'), constitution);
  writeFileSync(join(d, 'CLAUDE.md'), '# claude project');
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  assert.notEqual(readFileSync(join(d, 'AGENTS.md'), 'utf8'), constitution, 'the block must be in there first');

  const r = await repair({ cwd: d, target: 'codex', home: d, invoked: true, accept: async () => true });

  assert.ok(r.applied.some((f) => f.id === 'wrong-target'));
  assert.equal(readFileSync(join(d, 'AGENTS.md'), 'utf8'), constitution, 'their constitution comes back untouched');
  assert.ok(existsSync(join(d, '.claude', 'skills', 'orient')), 'and it now lives where the project points');
});

test('declining the move leaves everything exactly where it was', async () => {
  const d = repo();
  writeFileSync(join(d, 'AGENTS.md'), '# mia\n');
  writeFileSync(join(d, 'CLAUDE.md'), '# claude');
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  const before = readFileSync(join(d, 'AGENTS.md'), 'utf8');
  const r = await repair({ cwd: d, target: 'codex', home: d, invoked: true, accept: async () => false });
  assert.ok(r.pending.some((f) => f.id === 'wrong-target'));
  assert.equal(readFileSync(join(d, 'AGENTS.md'), 'utf8'), before);
  assert.equal(existsSync(join(d, '.claude', 'skills', 'orient')), false);
});

// Moving away from an assistant must not leave it declared. The manifest unions on
// purpose — installing into a second assistant is adding, not replacing — but a MOVE is
// the one case where the old one has to go, or the manifest keeps promising a harness
// that is no longer there and every clone rebuilds it.
test('after a move, the abandoned assistant is gone from the manifest', async () => {
  const d = repo();
  writeFileSync(join(d, 'AGENTS.md'), '# mia\n');
  writeFileSync(join(d, 'CLAUDE.md'), '# claude');
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  await repair({ cwd: d, target: 'codex', home: d, invoked: true, accept: async () => true });
  const { readManifest } = await import('../scripts/lib/manifest-file.js');
  assert.deepEqual(readManifest(d).targets, ['claude']);
});

// Found by a mutant that survived: the "we only touch what we installed" guarantee was in
// the code but untested on the MOVE path, which is the one that deletes things. A promise
// no test defends is not a promise.
test('moving assistants does not take the user hand-written skills with it', async () => {
  const d = repo();
  writeFileSync(join(d, 'AGENTS.md'), '# mia\n');
  writeFileSync(join(d, 'CLAUDE.md'), '# claude');
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  mkdirSync(join(d, '.codex', 'rsc', 'mia'), { recursive: true });
  writeFileSync(join(d, '.codex', 'rsc', 'mia', 'SKILL.md'), '# three months of my work');

  await repair({ cwd: d, target: 'codex', home: d, invoked: true, accept: async () => true });

  assert.equal(readFileSync(join(d, '.codex', 'rsc', 'mia', 'SKILL.md'), 'utf8'), '# three months of my work');
});

// The case the previous test could not reach: a hand-written skill whose NAME is one rsc
// declares. That one IS in the id list the move walks, so only the managed-check keeps it
// alive. This is the collision from the other direction, and it is where the guarantee
// actually earns its keep.
test('a hand-written skill named like a declared one survives the move', async () => {
  const d = repo();
  writeFileSync(join(d, 'AGENTS.md'), '# mia\n');
  writeFileSync(join(d, 'CLAUDE.md'), '# claude');
  await applyInstall({ skillIds: ['suggest'], target: 'codex', home: d, cwd: d });
  rmSync(join(d, '.rsc.json'));
  writeManifest(d, { targets: ['codex'], skills: ['suggest', 'orient'], ownSkills: [], catalogVersion: '1', tier: null, optOuts: [] });
  mkdirSync(join(d, '.codex', 'rsc', 'orient'), { recursive: true });
  writeFileSync(join(d, '.codex', 'rsc', 'orient', 'SKILL.md'), '# MINE, not rsc orient');

  await repair({ cwd: d, target: 'codex', home: d, invoked: true, accept: async () => true });

  assert.equal(readFileSync(join(d, '.codex', 'rsc', 'orient', 'SKILL.md'), 'utf8'), '# MINE, not rsc orient');
});
