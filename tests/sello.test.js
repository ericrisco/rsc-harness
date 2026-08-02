// sello.test.js — the tests the constitution demands for the sello:
//  P2: every gate proves it gates (no decorative gates — this repo already paid for four).
//  P6: every deny message carries its `Recover:` line, asserted here, not assumed.
//  P7: risk-0 changes pass in silence; kill-switch parity is byte-exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  MESSAGES, RISK_TABLE, FLOOR_CLASSES, classifyRisk, validateRiskConfig,
  computeCandidate, checkSello, writeSello, readSello, budgetSpent,
  isEnabled, selloPaths, appendFindings, countFindings,
} from '../targets/sello.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIP_GUARD = join(HERE, '..', 'targets', 'ship-guard.mjs');

// --- fixture: a real git repo with a trunk and a feature branch -----------------

function sh(root, cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
const g = (root, ...args) => sh(root, 'git', args);

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-sello-'));
  g(root, 'init', '-b', 'main');
  g(root, 'config', 'user.email', 'test@example.com');
  g(root, 'config', 'user.name', 'Test');
  writeFileSync(join(root, 'app.js'), 'export const x = 1;\n');
  writeFileSync(join(root, 'README.md'), '# readme\n');
  g(root, 'add', '.');
  g(root, 'commit', '-m', 'init');
  g(root, 'checkout', '-b', 'feature');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  return root;
}
function enable(root, extra = {}) {
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: true, ...extra }));
}
function freezeApprove(root) {
  const c = computeCandidate(root);
  writeSello(root, { status: 'approved', ...c, risk: classifyRisk(Object.keys(c.files)), lenses: ['correctness'] });
}

// Run the real ship-guard binary the way Claude Code does (stdin hook JSON).
function runGuard(root, command) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const r = spawnSync('node', [SHIP_GUARD, root], { encoding: 'utf8', input });
  try { return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision === 'deny' ? JSON.parse(r.stdout) : null; }
  catch { return null; } // empty stdout = allow
}

// --- P6: every deny message carries its recovery ---------------------------------

test('sello: every message names its recovery action', () => {
  const rendered = [
    MESSAGES.noReview(1), MESSAGES.diverged(['a', 'b']), MESSAGES.baseMoved(),
    MESSAGES.corrupt(), MESSAGES.blocked('x'), MESSAGES.notFrozen(),
    MESSAGES.staleFreeze(), MESSAGES.overBudget(10, 5), MESSAGES.badRiskConfig,
    MESSAGES.riskUnknown(),
  ];
  assert.equal(rendered.length, Object.keys(MESSAGES).length, 'every MESSAGES entry is asserted here — add new ones to this list');
  for (const m of rendered) {
    assert.match(m, /Recover:/, `message lacks its recovery: ${m}`);
  }
});

// --- risk table: integrity + classification --------------------------------------

test('sello: default risk table is intact (patterns compile, tiers valid, floor present)', () => {
  for (const row of RISK_TABLE) {
    assert.ok(row.class && typeof row.class === 'string');
    assert.ok([0, 1, 2].includes(row.tier), `bad tier for ${row.class}`);
    assert.doesNotThrow(() => new RegExp(row.pattern), `uncompilable pattern for ${row.class}`);
  }
  for (const cls of FLOOR_CLASSES) {
    assert.ok(RISK_TABLE.some((r) => r.class === cls && r.tier === 2), `floor class ${cls} missing or lowered in the default table`);
  }
});

test('sello: risk classifies by what is touched, not how much', () => {
  assert.equal(classifyRisk(['README.md', 'docs/guide.md']).tier, 0);
  assert.equal(classifyRisk(['src/feature.js']).tier, 1);
  assert.equal(classifyRisk(['.github/workflows/ci.yml']).tier, 2);
  assert.equal(classifyRisk(['src/auth/login.js']).tier, 2);
  assert.equal(classifyRisk(['.env.production']).tier, 2);
  assert.equal(classifyRisk(['README.md', 'src/x.js', 'migrations/001.sql']).tier, 2, 'tier is the max across files');
});

test('sello: overrides raise freely, lower explicitly, and never lower the floor', () => {
  const raised = classifyRisk(['src/pricing-engine.js'], { risk: { raise: [{ class: 'pricing', pattern: 'pricing' }] } });
  assert.equal(raised.tier, 2);
  const lowered = classifyRisk(['migrations/001.sql'], { risk: { lower: ['migrations'] } });
  assert.equal(lowered.tier, 1, 'lowering lands on 1, never 0');
  assert.throws(() => validateRiskConfig({ risk: { lower: ['secrets'] } }), /never be lowered/);
  assert.throws(() => validateRiskConfig({ risk: { lower: ['harness'] } }), /never be lowered/);
  assert.throws(() => validateRiskConfig({ risk: { lower: ['nope'] } }), /unknown class/);
  assert.throws(() => validateRiskConfig({ risk: { raise: [{ pattern: '(' }] } }));
});

// --- candidate: byte-exact ---------------------------------------------------------

test('sello: one byte of change produces a different candidate', () => {
  const root = makeRepo();
  writeFileSync(join(root, 'app.js'), 'export const x = 2;\n');
  const a = computeCandidate(root);
  assert.ok(a.files['app.js']);
  writeFileSync(join(root, 'app.js'), 'export const x = 3;\n');
  const b = computeCandidate(root);
  assert.notEqual(a.files['app.js'], b.files['app.js']);
  assert.equal(a.base, b.base);
});

// --- the check: every spec path -----------------------------------------------------

test('sello: disabled → everything passes (kill-switch parity)', () => {
  const root = makeRepo();
  writeFileSync(join(root, 'src.js'), 'unreviewed\n');
  assert.equal(checkSello(root).ok, true);
  assert.equal(checkSello(root).code, 'disabled');
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: false }));
  assert.equal(checkSello(root).code, 'disabled');
});

test('sello: enabled + docs-only change → silent pass (risk 0)', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'README.md'), '# changed docs\n');
  const v = checkSello(root);
  assert.equal(v.ok, true);
  assert.equal(v.code, 'risk0');
});

test('sello: enabled + code change without review → deny with recovery', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'changed\n');
  const v = checkSello(root);
  assert.equal(v.ok, false);
  assert.equal(v.code, 'no-review');
  assert.match(v.message, /Recover:/);
});

test('sello: sealed bytes pass; a single mutated byte denies', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'export const x = 2;\n');
  freezeApprove(root);
  assert.equal(checkSello(root).code, 'sealed');
  writeFileSync(join(root, 'app.js'), 'export const x = 2;;\n'); // one byte
  const v = checkSello(root);
  assert.equal(v.code, 'diverged');
  assert.match(v.message, /app\.js/);
  assert.match(v.message, /Recover:/);
});

test('sello: a moved base invalidates the sello (rebase rule)', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'export const x = 2;\n');
  g(root, 'add', '.'); g(root, 'commit', '-m', 'feature work');
  freezeApprove(root);
  assert.equal(checkSello(root).code, 'sealed');
  // trunk advances; the branch rebases onto it → same diff, new base, new candidate
  g(root, 'checkout', 'main');
  writeFileSync(join(root, 'other.js'), 'trunk moved\n');
  g(root, 'add', '.'); g(root, 'commit', '-m', 'trunk');
  g(root, 'checkout', 'feature');
  g(root, 'rebase', 'main');
  const v = checkSello(root);
  assert.equal(v.code, 'base-moved');
  assert.match(v.message, /Recover:/);
});

test('sello: corrupt sello counts as no review — never approved by default', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'changed\n');
  writeFileSync(selloPaths(root).state, '{not json');
  const v = checkSello(root);
  assert.equal(v.code, 'corrupt');
  assert.match(v.message, /Recover:/);
});

test('sello: a blocked verdict blocks delivery', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'changed\n');
  const c = computeCandidate(root);
  writeSello(root, { status: 'blocked', ...c, reason: 'authz gap' });
  const v = checkSello(root);
  assert.equal(v.code, 'blocked');
  assert.match(v.message, /authz gap/);
});

// --- the guard: the gate fires on delivery commands, and only when enabled ----------

test('ship-guard: sello OFF → commit/push/PR flow untouched (parity)', () => {
  const root = makeRepo();
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  assert.equal(runGuard(root, 'git commit -m "x"'), null);
  assert.equal(runGuard(root, 'git push origin feature'), null);
  assert.equal(runGuard(root, 'gh pr create --title x'), null);
});

test('ship-guard: sello ON denies unreviewed delivery on all three commands, with recovery', () => {
  const root = makeRepo();
  enable(root);
  // sello.mjs must sit next to the guard exactly as materialization places it —
  // run the guard from a copy of both, like a real install.
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  for (const cmd of ['git commit -m "x"', 'git push', 'gh pr create']) {
    const denial = runGuard(root, cmd);
    assert.ok(denial, `expected a deny for: ${cmd}`);
    assert.match(denial.hookSpecificOutput.permissionDecisionReason, /Recover:/);
  }
});

test('ship-guard: sello ON + sealed bytes → delivery allowed', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'reviewed\n');
  freezeApprove(root);
  assert.equal(runGuard(root, 'git commit -m "x"'), null);
});

test('ship-guard: non-delivery commands never consult the sello', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  assert.equal(runGuard(root, 'ls -la'), null);
  assert.equal(runGuard(root, 'git status'), null);
});

// --- fix budget ----------------------------------------------------------------------

test('sello: budget accounting measures the fix delta', () => {
  const root = makeRepo();
  writeFileSync(join(root, 'app.js'), 'line1\nline2\n');
  const frozen = computeCandidate(root);
  writeFileSync(join(root, 'app.js'), 'line1\nline2\nline3\nline4\nline5\n');
  const current = computeCandidate(root);
  const spent = budgetSpent(frozen, current);
  assert.ok(spent >= 3, `expected >=3 lines spent, got ${spent}`);
  assert.equal(budgetSpent(frozen, frozen), 0, 'no fix → zero spent');
});

// --- findings artifact ------------------------------------------------------------------

test('sello: non-blocking findings accumulate in a readable artifact', () => {
  const root = makeRepo();
  assert.equal(countFindings(root), 0);
  appendFindings(root, ['pre-existing: N+1 in listUsers', 'nit: rename x']);
  appendFindings(root, ['pre-existing: missing index on orders.user_id']);
  assert.equal(countFindings(root), 3);
  const text = readFileSync(selloPaths(root).findings, 'utf8');
  assert.match(text, /N\+1/);
});
