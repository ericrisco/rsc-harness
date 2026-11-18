import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// #278 — accepting a plan regenerated user-profile.md from nothing. That file is not the plan's: `init`
// records there what it learns about the user, and `orient` changes the dial when they ask for it.
// Re-accepting after an update erased both, and dropped from `.rsc.json` any assistant added
// outside the plan.
//
// #276 — the accompaniment dial once had two names (`accompaniment`, `accompaniment_level`). It is
// now retired altogether: `technical_level` is the one dial, and both old names are removed on
// rewrite. The intent of #276 still holds — one name for the dial, the one every skill reads.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const base = (level = 'non-technical', targets = 'claude') => ['onboard', '--target', targets, '--technical-level', level,
  '--project-kind', 'operations', '--goal', 'Llevar la facturación'];
function accept(cwd, args) {
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan to accept');
  const out = run(cwd, [...args, '--accept-plan', planId]);
  assert.doesNotMatch(out.stdout + out.stderr, /differs|RSC_PLAN_CHANGED/, out.stdout.slice(-400));
}
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-prof-'));
  execFileSync('git', ['init', '-q'], { cwd });
  return cwd;
}
const profilePath = (cwd) => join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md');
const profile = (cwd) => readFileSync(profilePath(cwd), 'utf8');
const edit = (cwd, fn) => writeFileSync(profilePath(cwd), fn(profile(cwd)));
const DISCOVERY = '\n## Descubrimiento\n\n- Dominio: gestoría de tres personas.\n- Intocable: la carpeta CONTABILIDAD/.\n';
const targets = (cwd) => JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).targets.sort();

test('#276 — the profile carries the one dial under the one name every skill reads', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base());
  assert.match(profile(cwd), /^technical_level: non-technical$/m);
  assert.doesNotMatch(profile(cwd), /^accompaniment(_level)?:/m, 'the retired dial is never written');
});

test('#278 — re-accepting keeps what init discovered and the dial the user adjusted', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('non-technical'));
  edit(cwd, (p) => p.replace(/^technical_level: non-technical$/m, 'technical_level: technical') + DISCOVERY);
  accept(cwd, base('non-technical')); // the same plan again, as after an update or a reassess
  const p = profile(cwd);
  assert.match(p, /^technical_level: technical$/m, 'the plan did not change the dial, so the user’s value stands');
  assert.ok(p.includes(DISCOVERY.trim()), 'the discovery survives');
  assert.match(p, /^project_kind: operations$/m);
  assert.match(p, /^Goal: Llevar la facturación$/m);
});

test('#278 — asking for a different dial explicitly still applies it', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('non-technical'));
  edit(cwd, (p) => p.replace(/^technical_level: non-technical$/m, 'technical_level: mixed') + DISCOVERY);
  accept(cwd, base('technical')); // a new decision: the receipt said non-technical, now the user says technical
  assert.match(profile(cwd), /^technical_level: technical$/m);
  assert.ok(profile(cwd).includes(DISCOVERY.trim()));
});

test('#276 — a profile written by an older version loses the retired dial, under either name, and nothing else', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base());
  // What 2.0.15 and 2.0.20 wrote, plus what init added afterwards.
  edit(cwd, (p) => p.replace(/^technical_level: (.*)$/m, 'technical_level: $1\naccompaniment: L3\naccompaniment_level: L3') + DISCOVERY);
  accept(cwd, base());
  const p = profile(cwd);
  assert.doesNotMatch(p, /^accompaniment(_level)?:/m);
  assert.match(p, /^technical_level: non-technical$/m);
  assert.ok(p.includes(DISCOVERY.trim()));
});

test('#278 — an assistant added outside the plan stays declared', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('non-technical', 'claude'));
  run(cwd, ['sync', '--target', 'codex']);
  assert.deepEqual(targets(cwd), ['claude', 'codex'], 'fixture: codex declared by sync');
  accept(cwd, base('non-technical', 'claude'));
  assert.deepEqual(targets(cwd), ['claude', 'codex']);
});

test('control — an assistant the new plan drops is still removed on purpose', { timeout: 300000 }, () => {
  const cwd = project();
  accept(cwd, base('non-technical', 'claude,codex'));
  accept(cwd, base('non-technical', 'claude'));
  assert.deepEqual(targets(cwd), ['claude']);
});

// The compass reads the one dial that is left. If it still keyed its register off a retired name, the
// level chosen at onboarding would be invisible to it — the original #276 failure, one rename later.
test('#276 — the compass reads technical_level', () => {
  const skills = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  assert.match(readFileSync(join(skills, 'orient/SKILL.md'), 'utf8'), /technical_level/);
});
