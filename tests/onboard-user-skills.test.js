import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// #275 — a skill the user wrote by hand with a catalog name (`review`, `plan`, `debug`…) was replaced by
// `onboard` without a word: the dry-run plan listed its folder among the managed paths like any other,
// and after accepting, `/review` did something else and the user's own version sat in a backup nobody
// told them about. `add` and `install` already refuse this; `onboard` never asked.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });
const ARGS = ['onboard', '--target', 'claude', '--technical-level', 'non-technical',
  '--accompaniment', 'L3', '--project-kind', 'operations', '--goal', 'Llevar la facturación'];
const planIdOf = (out) => /--accept-plan ([a-f0-9]{64})/.exec(out.stdout)?.[1];
const OWN = '---\nname: review\ndescription: La revisión de facturas de esta gestoría.\n---\n# Nuestra revisión\n';
function project({ own = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-own-'));
  execFileSync('git', ['init', '-q'], { cwd });
  if (own) writeOwn(cwd);
  return cwd;
}
function writeOwn(cwd) {
  mkdirSync(join(cwd, '.claude', 'skills', 'review'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'skills', 'review', 'SKILL.md'), OWN);
}

test('#275 — the dry-run plan names a hand-written skill it is about to replace', { timeout: 300000 }, () => {
  const out = run(project(), ARGS);
  assert.match(out.stdout, /Your own skills this plan replaces:\n\s+! \.claude\/skills\/review/);
  assert.match(out.stdout, /To keep yours, rename its folder/);
});

test('#275 — a skill rsc installed itself is not reported as the user’s', { timeout: 300000 }, () => {
  const cwd = project({ own: false });
  run(cwd, [...ARGS, '--accept-plan', planIdOf(run(cwd, ARGS))]);
  const again = run(cwd, ARGS);
  assert.ok(planIdOf(again), 'fixture: a plan');
  assert.doesNotMatch(again.stdout, /Your own skills/);
});

test('#275 — the plan id binds the consent: one generated before the skill existed no longer applies', { timeout: 300000 }, () => {
  const cwd = project({ own: false });
  const stale = planIdOf(run(cwd, ARGS));
  writeOwn(cwd);
  const out = run(cwd, [...ARGS, '--accept-plan', stale]);
  assert.equal(out.status, 3, out.stderr);
  assert.match(out.stderr, /RSC_PLAN_CHANGED/);
  assert.equal(readFileSync(join(cwd, '.claude', 'skills', 'review', 'SKILL.md'), 'utf8'), OWN, 'untouched');
});

test('#275 — after accepting, the user is told exactly where their version was kept', { timeout: 300000 }, () => {
  const cwd = project();
  const out = run(cwd, [...ARGS, '--accept-plan', planIdOf(run(cwd, ARGS))]);
  const kept = /Your previous \.claude\/skills\/review is kept in (\S+)/.exec(out.stdout)?.[1];
  assert.ok(kept, out.stdout.slice(-600));
  assert.equal(readFileSync(join(cwd, kept, 'SKILL.md'), 'utf8'), OWN);
  assert.ok(existsSync(join(cwd, '.claude', 'skills', 'review', 'SKILL.md')), 'the catalog skill is in place');
});

test('#275 — renaming theirs, as the plan suggests, keeps it working next to the catalog one', { timeout: 300000 }, () => {
  const cwd = project();
  renameSync(join(cwd, '.claude', 'skills', 'review'), join(cwd, '.claude', 'skills', 'review-own'));
  const plan = run(cwd, ARGS);
  assert.doesNotMatch(plan.stdout, /Your own skills/);
  run(cwd, [...ARGS, '--accept-plan', planIdOf(plan)]);
  assert.equal(readFileSync(join(cwd, '.claude', 'skills', 'review-own', 'SKILL.md'), 'utf8'), OWN);
  assert.ok(existsSync(join(cwd, '.claude', 'skills', 'review', 'SKILL.md')));
});
