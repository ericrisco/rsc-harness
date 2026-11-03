import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { SELLO_STATE_PATHS } from '../targets/sello.mjs';
import { LEDGER_PATH } from '../scripts/lib/review-ledger.js';

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

test('risk: moving a file out of a tier-2 place still counts as tier 2', () => {
  const cwd = repo();
  mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'workflows', 'ci.yml'), 'on: push\n');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'ci');
  git(cwd, 'checkout', '-qb', 'feat');
  git(cwd, 'mv', '.github/workflows/ci.yml', 'old-ci.yml');
  git(cwd, 'commit', '-qm', 'move');
  assert.match(run(cwd, ['risk', '--base', 'main']).stdout, /^tier 2$/m);
});

test('risk: the global --target value is not a path, and paths from a subfolder resolve to the root', () => {
  const cwd = repo();
  git(cwd, 'checkout', '-qb', 'feat');
  mkdirSync(join(cwd, 'migrations'), { recursive: true });
  writeFileSync(join(cwd, 'migrations', '001.sql'), 'x\n');
  assert.match(run(cwd, ['risk', '--target', 'claude', '--base', 'main']).stdout, /^tier 2$/m);
  const sub = spawnSync(process.execPath, [CLI, 'risk', '001.sql'], { cwd: join(cwd, 'migrations'), encoding: 'utf8', env: { ...process.env, RSC_SELLO_HOME: HOME } });
  assert.match(sub.stdout, /^tier 2$/m);
});

test('risk: working straight on the trunk, a committed change is still the change asked about', () => {
  const cwd = repo();
  mkdirSync(join(cwd, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'workflows', 'release.yml'), 'on: push\n');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'ci');
  const r = run(cwd, ['risk']);
  assert.match(r.stdout, /^tier 2$/m);
  assert.match(r.stdout, /^base: HEAD~1/m);
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

test('ledger: the same claim in another file is a different finding', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('discount applied to one unit only'), { ...finding('discount applied to one unit only'), file: 'src/b.js' }]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'new']);
});

test('ledger: the bug class survives the documented pipeline, consolidate --json into record', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'lens.json'), JSON.stringify([finding('order id read from the path, no owner check', 5, { class: 'IDOR' })]));
  const c = run(cwd, ['review', 'consolidate', 'lens.json', '--json']);
  writeFileSync(join(cwd, 'c1.json'), c.stdout);
  assert.equal(JSON.parse(c.stdout).findings[0].class, 'IDOR');
  run(cwd, ['review', 'ledger', 'record', 'c1.json']);
  writeFileSync(join(cwd, 'lens2.json'), JSON.stringify([finding('owner check missing: user opens any order', 40, { class: 'idor' })]));
  writeFileSync(join(cwd, 'c2.json'), run(cwd, ['review', 'consolidate', 'lens2.json', '--json']).stdout);
  assert.match(run(cwd, ['review', 'ledger', 'record', 'c2.json']).stdout, /repeat of L1/);
});

test('ledger: a different claim in the same file is not a repeat', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('discount applied to one unit only'), finding('percentage not checked against 0..100 range', 11)]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'new']);
});

test('ledger: the same bug class in the same file is one finding when the claims still touch', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('order id read from the path, no owner check', 5, { class: 'IDOR' }), finding('owner check missing: user opens any order', 40, { class: 'idor' })]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'repeat']);
});

test('ledger: the same class alone never hides a different defect in the same file', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([
    finding('parseUser returns undefined on an empty payload', 5, { class: 'null-check' }),
    finding('deleteInvoice skips the tenant guard, letting any tenant delete', 80, { class: 'null-check' }),
  ]));
  const r = run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']);
  assert.deepEqual(JSON.parse(r.stdout).map((f) => f.status), ['new', 'new']);
});

test('ledger: a finding closed as fixed that comes back is a regression, raised anew', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('discount applied to one unit only, not the whole cart')]));
  run(cwd, ['review', 'ledger', 'record', 'f.json']);
  run(cwd, ['review', 'ledger', 'outcome', 'L1', 'fixed']);
  const again = JSON.parse(run(cwd, ['review', 'ledger', 'record', 'f.json', '--json']).stdout);
  assert.equal(again[0].status, 'new');
});

test('ledger: the file is read wherever the --task flag sits, and junk entries do not crash it', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('race on concurrent checkout'), null, 3]));
  const r = run(cwd, ['review', 'ledger', 'record', '--task', 'T2', 'f.json', '--json']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.length, 1);
  assert.equal(out[0].task, 'T2');
  writeFileSync(join(cwd, 'n.json'), 'null');
  assert.equal(run(cwd, ['review', 'ledger', 'record', 'n.json']).status, 0);
});

test('ledger: rounds 1–3 pass, the 4th is refused with the way out', () => {
  const cwd = repo();
  // The cap is the spec's literal 3 (AC5), never read back from the code under test.
  for (let i = 1; i <= 3; i += 1) {
    const r = run(cwd, ['review', 'ledger', 'round', 'cart/T1']);
    assert.equal(r.status, 0, `round ${i}: ${r.stdout}`);
    assert.match(r.stdout, new RegExp(`round ${i} of 3`));
  }
  const fourth = run(cwd, ['review', 'ledger', 'round', 'cart/T1']);
  assert.notEqual(fourth.status, 0);
  assert.match(fourth.stdout, /rethink the approach/);
  assert.match(fourth.stdout, /decision queue/);
  assert.equal(run(cwd, ['review', 'ledger', 'round', 'cart/T2']).status, 0, 'rounds are per task');
  assert.equal(run(cwd, ['review', 'ledger', 'round', 'invoices/T1']).status, 0, 'and per spec: every plan starts at T1');
});

test('ledger: a bare task id is refused, with the qualified form in the message', () => {
  const r = run(repo(), ['review', 'ledger', 'round', 'T001']);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /<slug>\/T001/);
});

test('ledger: outcomes are validated and counted; stats report the false rate and open findings', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([finding('null deref on empty cart'), finding('race on concurrent checkout', 30), finding('missing auth check on export', 60)]));
  run(cwd, ['review', 'ledger', 'record', 'f.json']);
  assert.notEqual(run(cwd, ['review', 'ledger', 'outcome', 'L1', 'maybe']).status, 0, 'unknown outcome refused');
  assert.notEqual(run(cwd, ['review', 'ledger', 'outcome', 'L9', 'fixed']).status, 0, 'unknown id refused');
  assert.equal(run(cwd, ['review', 'ledger', 'outcome', 'L1', 'fixed']).status, 0);
  assert.equal(run(cwd, ['review', 'ledger', 'outcome', 'L2', 'false']).status, 0);
  run(cwd, ['review', 'ledger', 'round', 'x/T1']); run(cwd, ['review', 'ledger', 'round', 'x/T1']);
  const s = JSON.parse(run(cwd, ['review', 'ledger', 'stats', '--json']).stdout);
  assert.equal(s.findings, 3);
  assert.equal(s.outcomes.fixed, 1);
  assert.equal(s.outcomes.false, 1);
  assert.equal(s.outcomes.open, 1);
  assert.equal(s.falseRate, 0.5);
  assert.deepEqual(s.open, ['L3']);
  assert.equal(s.meanRounds, 2);
  // A repeat is noise caught, never a second open finding.
  writeFileSync(join(cwd, 'again.json'), JSON.stringify([finding('race on concurrent checkout', 31)]));
  run(cwd, ['review', 'ledger', 'record', 'again.json']);
  const t = JSON.parse(run(cwd, ['review', 'ledger', 'stats', '--json']).stdout);
  assert.equal(t.findings, 3);
  assert.equal(t.repeats, 1);
  assert.equal(t.outcomes.open, 1);
  assert.match(run(cwd, ['review', 'ledger', 'stats']).stdout, /false rate: 50%/);
});

test('ledger: it lives in .rsc/ and never becomes part of a sealed candidate', () => {
  assert.ok(SELLO_STATE_PATHS.includes(LEDGER_PATH));
  const cwd = repo();
  run(cwd, ['review', 'ledger', 'round', 'x/T1']);
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

test('escapes: each revert is matched to its own case, `revert:` commits count, and --since bounds the range', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'a.js'), '1\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'feat: a');
  git(cwd, 'revert', '--no-edit', 'HEAD');
  const old = git(cwd, 'rev-parse', 'HEAD').trim();
  writeFileSync(join(cwd, 'b.js'), '1\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'revert: undo the QR');
  const all = JSON.parse(run(cwd, ['review', 'escapes', '--json']).stdout).reverts;
  assert.equal(all.length, 2);
  mkdirSync(join(cwd, '02-DOCS', 'wiki', 'sdd', 'review-evals'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'sdd', 'review-evals', `${old.slice(0, 7)}.md`), '# case\n');
  const after = JSON.parse(run(cwd, ['review', 'escapes', '--json']).stdout).reverts;
  assert.deepEqual(after.map((c) => [c.subject.startsWith('revert:'), c.covered]), [[true, false], [false, true]]);
  const since = JSON.parse(run(cwd, ['review', 'escapes', '--since', old, '--json']).stdout).reverts;
  assert.deepEqual(since.map((c) => c.subject), ['revert: undo the QR']);
});

test('escapes: a repository with no reverts says so and which shapes it recognises', () => {
  const r = run(repo(), ['review', 'escapes']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No reverts found/);
});
