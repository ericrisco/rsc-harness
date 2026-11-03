import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { SELLO_STATE_PATHS } from '../targets/sello.mjs';
import { LEDGER_PATH, MAX_ROUNDS } from '../scripts/lib/review-ledger.js';

// ASDD's deterministic half: `rsc risk`, `review ledger`, `review escapes`.
// Spec: 02-DOCS/wiki/sdd/specs/asdd-v4.md (criteria 3–7). Every gate is shown failing AND passing.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const HOME = mkdtempSync(join(tmpdir(), 'rsc-asdd-home-'));
const run = (cwd, args, input = '') => spawnSync(process.execPath, [CLI, ...args], {
  cwd, encoding: 'utf8', input, env: { ...process.env, RSC_SELLO_HOME: HOME },
});
const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function repo() {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-asdd-')));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.email', 't@t'); git(cwd, 'config', 'user.name', 't');
  writeFileSync(join(cwd, 'README.md'), '# x\n');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'init');
  return cwd;
}

// ── rsc risk ────────────────────────────────────────────────────────────────

test('risk: docs are tier 0 with no reviewer and no human', () => {
  const r = run(repo(), ['risk', 'docs/guide.md']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^tier 0$/m);
  assert.match(r.stdout, /^reviewers: 0$/m);
  assert.match(r.stdout, /^human approval: not required$/m);
});

test('risk: ordinary code is tier 1 with one reviewer', () => {
  const r = run(repo(), ['risk', 'src/cart.js']);
  assert.match(r.stdout, /^tier 1$/m);
  assert.match(r.stdout, /^reviewers: 1$/m);
  assert.match(r.stdout, /^human approval: not required$/m);
});

test('risk: a CI workflow is tier 2, three reviewers, and a human must approve', () => {
  const r = run(repo(), ['risk', 'src/cart.js', '.github/workflows/release.yml']);
  assert.match(r.stdout, /^tier 2$/m);
  assert.match(r.stdout, /^reviewers: 3$/m);
  assert.match(r.stdout, /^human approval: required$/m);
});

test('risk: with no paths it reads the change against the trunk, untracked files included', () => {
  const cwd = repo();
  git(cwd, 'checkout', '-qb', 'feat');
  mkdirSync(join(cwd, 'billing'), { recursive: true });
  writeFileSync(join(cwd, 'billing', 'invoice.js'), 'x\n');
  const r = run(cwd, ['risk', '--json']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.tier, 2);
  assert.equal(j.humanApproval, true);
  assert.deepEqual(j.classes, ['billing']);
});

test('risk: with nothing to compare against it refuses and says how to go on', () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-asdd-nogit-')));
  const r = run(cwd, ['risk']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /--base <ref>|risk <path/);
});

// ── review ledger ───────────────────────────────────────────────────────────

const finding = (claim, line = 10, extra = {}) => ({ severity: 'blocker', file: 'src/a.js', line, claim, failure_scenario: 'x', ...extra });

test('ledger: the same claim twice is recorded once as new and once as a repeat, even after the line moved', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f1.json'), JSON.stringify([finding('discount applied to one unit only, not the whole cart')]));
  writeFileSync(join(cwd, 'f2.json'), JSON.stringify([finding('discount applied to one unit only instead of whole cart', 14)]));
  const a = run(cwd, ['review', 'ledger', 'record', 'f1.json', '--task', 'T1']);
  assert.match(a.stdout, /L1\s+new/);
  const b = run(cwd, ['review', 'ledger', 'record', 'f2.json', '--task', 'T1']);
  assert.match(b.stdout, /L2\s+repeat of L1/);
});

test('ledger: a different claim in the same file is not a repeat', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('discount applied to one unit only'), finding('percentage not checked against 0..100 range', 11)]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'new']);
});

test('ledger: the same bug class in the same file is one finding, whatever the wording', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('user id read from path', 5, { class: 'IDOR' }), finding('anyone can open any order', 40, { class: 'idor' })]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'repeat']);
});

test('ledger: rounds 1–3 pass, the 4th is refused with the way out', () => {
  const cwd = repo();
  for (let i = 1; i <= MAX_ROUNDS; i += 1) {
    const r = run(cwd, ['review', 'ledger', 'round', 'T1']);
    assert.equal(r.status, 0, `round ${i}: ${r.stdout}`);
    assert.match(r.stdout, new RegExp(`round ${i} of ${MAX_ROUNDS}`));
  }
  const fourth = run(cwd, ['review', 'ledger', 'round', 'T1']);
  assert.notEqual(fourth.status, 0);
  assert.match(fourth.stdout, /rethink the approach/);
  assert.match(fourth.stdout, /decision queue/);
  assert.equal(run(cwd, ['review', 'ledger', 'round', 'T2']).status, 0, 'rounds are per task');
});

test('ledger: outcomes are validated and counted; stats report the false rate and open findings', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('null deref on empty cart'), finding('race on concurrent checkout', 30), finding('missing auth check on export', 60)]));
  run(cwd, ['review', 'ledger', 'record', 'f.json']);
  assert.notEqual(run(cwd, ['review', 'ledger', 'outcome', 'L1', 'maybe']).status, 0, 'unknown outcome refused');
  assert.notEqual(run(cwd, ['review', 'ledger', 'outcome', 'L9', 'fixed']).status, 0, 'unknown id refused');
  assert.equal(run(cwd, ['review', 'ledger', 'outcome', 'L1', 'fixed']).status, 0);
  assert.equal(run(cwd, ['review', 'ledger', 'outcome', 'L2', 'false']).status, 0);
  run(cwd, ['review', 'ledger', 'round', 'T1']); run(cwd, ['review', 'ledger', 'round', 'T1']);
  const s = JSON.parse(run(cwd, ['review', 'ledger', 'stats', '--json']).stdout);
  assert.equal(s.findings, 3);
  assert.equal(s.outcomes.fixed, 1);
  assert.equal(s.outcomes.false, 1);
  assert.equal(s.outcomes.open, 1);
  assert.equal(s.falseRate, 0.5);
  assert.deepEqual(s.open, ['L3']);
  assert.equal(s.meanRounds, 2);
  assert.match(run(cwd, ['review', 'ledger', 'stats']).stdout, /false rate: 50%/);
});

test('ledger: it lives in .rsc/ and never becomes part of a sealed candidate', () => {
  assert.ok(SELLO_STATE_PATHS.includes(LEDGER_PATH));
  const cwd = repo();
  run(cwd, ['review', 'ledger', 'round', 'T1']);
  assert.match(readFileSync(join(cwd, LEDGER_PATH), 'utf8'), /"type":"round"/);
});

// ── review escapes ──────────────────────────────────────────────────────────

test('escapes: a revert without a case is listed, and covered once its case exists', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'a.js'), '1\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'feat: a');
  git(cwd, 'revert', '--no-edit', 'HEAD');
  writeFileSync(join(cwd, 'b.js'), '1\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'fix: unrelated');
  const sha = git(cwd, 'log', '--format=%h', '--grep', 'Revert', '-1').trim().slice(0, 7);
  const before = run(cwd, ['review', 'escapes']);
  assert.match(before.stdout, new RegExp(`NO CASE ${sha}`));
  assert.doesNotMatch(before.stdout, /unrelated/);
  mkdirSync(join(cwd, '02-DOCS', 'wiki', 'sdd', 'review-evals'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'sdd', 'review-evals', `${sha}.md`), '# case\n');
  const after = JSON.parse(run(cwd, ['review', 'escapes', '--json']).stdout);
  assert.deepEqual(after.reverts.map((c) => c.covered), [true]);
});

test('escapes: a repository with no reverts says so and which shapes it recognises', () => {
  const r = run(repo(), ['review', 'escapes']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No reverts found/);
});
