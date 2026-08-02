// sello.test.js — the tests the constitution demands for the sello:
//  P2: every gate proves it gates (no decorative gates — this repo already paid for four).
//  P6: every deny message carries its `Recover:` line, asserted here, not assumed.
//  P7: risk-0 changes pass in silence; kill-switch parity is byte-exact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  MESSAGES, RISK_TABLE, FLOOR_CLASSES, classifyRisk, validateRiskConfig,
  computeCandidate, checkSello, writeSello, budgetSpent, lensesRequired,
  selloPaths, appendFindings, countFindings, isDeliveryCommand, SELLO_STATE_PATHS,
} from '../targets/sello.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const SHIP_GUARD = join(REPO, 'targets', 'ship-guard.mjs');
const RSC = join(REPO, 'scripts', 'rsc.js');

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
// A crash must NOT read as "allow" — otherwise the parity tests would pass on a
// guard that merely fell over.
function runGuard(root, command) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const r = spawnSync('node', [SHIP_GUARD, root], { encoding: 'utf8', input });
  assert.equal(r.status, 0, `guard crashed (exit ${r.status}): ${r.stderr}`);
  assert.equal(r.stderr.trim(), '', `guard wrote to stderr: ${r.stderr}`);
  if (!r.stdout.trim()) return null; // silence = allow
  const parsed = JSON.parse(r.stdout); // a non-JSON body is a bug, let it throw
  return parsed.hookSpecificOutput?.permissionDecision === 'deny' ? parsed : null;
}
const runCli = (root, ...args) => spawnSync('node', [RSC, 'sello', ...args], { cwd: root, encoding: 'utf8' });

// --- P6: every deny message carries its recovery ---------------------------------

test('sello: every message names its recovery action', () => {
  // Iterate the object itself — a new message cannot be added without being checked.
  const sample = { noReview: [1], diverged: [['a', 'b']], blocked: ['x'], overBudget: [10, 5], partialLenses: [1, 3] };
  for (const [key, value] of Object.entries(MESSAGES)) {
    const rendered = typeof value === 'function' ? value(...(sample[key] || [])) : value;
    assert.equal(typeof rendered, 'string', `MESSAGES.${key} did not render to a string`);
    assert.match(rendered, /Recover:/, `MESSAGES.${key} lacks its recovery: ${rendered}`);
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

// --- regressions found by the adversarial review panel ---------------------------
// Each of these shipped as a passing implementation and was refuted by a lens.

test('sello: a floor class wins over the docs row even when both match (B1)', () => {
  // First-match-wins let `.claude/CLAUDE.md`, `credentials.txt` and `docs/prod.pem`
  // classify as docs/tier-0 — a silent pass for exactly what the floor guards.
  for (const p of ['.claude/CLAUDE.md', 'CLAUDE.md', 'credentials.txt', 'docs/prod.pem', 'docs/.env', 'secrets/README.md', '.rsc/policy.md']) {
    assert.equal(classifyRisk([p]).tier, 2, `${p} must not be risk-0`);
  }
  assert.equal(classifyRisk(['docs/guide.md']).tier, 0, 'plain docs stay silent');
});

test('sello: paths git would quote are hashed for real, not as deleted (B2)', () => {
  // core.quotePath turns café.js into "caf\303\251.js"; the escaped name matches no
  // file, so both freeze and check saw "D" and any later mutation passed as sealed.
  const root = makeRepo();
  enable(root);
  const name = 'facturación.js';
  writeFileSync(join(root, name), 'const a = 1;\n');
  const c = computeCandidate(root);
  assert.ok(c.files[name], `expected a raw key for ${name}, got ${JSON.stringify(Object.keys(c.files))}`);
  assert.notEqual(c.files[name], 'D', 'an existing file must never hash as deleted');
  freezeApprove(root);
  assert.equal(checkSello(root).code, 'sealed');
  writeFileSync(join(root, name), 'const a = BACKDOOR;\n');
  assert.equal(checkSello(root).code, 'diverged', 'a mutation of an accented path must be caught');
});

test('sello: its own state never enters the candidate, tracked or not (B3)', () => {
  // With .rsc/ tracked, writing the sello mutated the candidate it sealed →
  // staleFreeze forever → permanent delivery lockout whose documented recovery looped.
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, 'app.js'), 'work\n');
  g(root, 'add', '-A'); g(root, 'commit', '-m', 'track .rsc too');
  const c1 = computeCandidate(root);
  for (const p of SELLO_STATE_PATHS) {
    assert.equal(c1.files[p], undefined, `${p} must never be part of the candidate`);
  }
  freezeApprove(root);
  const c2 = computeCandidate(root);
  assert.equal(c1.base, c2.base);
  assert.deepEqual(Object.keys(c1.files), Object.keys(c2.files), 'writing the sello must not change the candidate');
  assert.equal(checkSello(root).code, 'sealed', 'freeze→approve must converge with .rsc/ tracked');
});

test('sello: risk-0 passes even with a stale blocked/corrupt sello left over (B4)', () => {
  const root = makeRepo();
  enable(root);
  // A previous change was blocked; it is fully reverted and only docs change now.
  writeFileSync(join(root, 'app.js'), 'risky\n');
  const c = computeCandidate(root);
  writeSello(root, { status: 'blocked', ...c, reason: 'authz gap' });
  writeFileSync(join(root, 'app.js'), 'export const x = 1;\n'); // reverted to trunk content
  writeFileSync(join(root, 'README.md'), '# docs only now\n');
  assert.equal(checkSello(root).code, 'risk0', 'a docs-only change must not inherit an old verdict');
  writeFileSync(selloPaths(root).state, '{not json');
  assert.equal(checkSello(root).code, 'risk0', 'nor a corrupt leftover');
});

test('sello: delivery detection resists both evasion and false positives (B5)', () => {
  for (const c of [
    'git commit -m x', 'git -C /some/path commit -m x', 'git -c user.name=x commit -m x',
    'git --no-pager commit', 'git push', 'git -C . push origin feature',
    'gh pr create --title x', 'gh pr merge --squash', 'gh -R o/r pr create',
  ]) assert.equal(isDeliveryCommand(c), true, `should be a delivery: ${c}`);

  for (const c of [
    'grep -rn "git push" docs/', "grep -rn 'git commit' .", 'echo "remember to git commit later"',
    'git log --grep="git push"', 'git status', 'git commit-tree abc', 'git commit-graph write',
    'ls -la', 'git merge-base HEAD main',
  ]) assert.equal(isDeliveryCommand(c), false, `should NOT be a delivery: ${c}`);
});

test('ship-guard: .no-ship-guard opts out of branch hygiene but NOT of the sello (B6)', () => {
  const root = makeRepo();
  enable(root);
  writeFileSync(join(root, '.rsc', '.no-ship-guard'), '');
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  const denial = runGuard(root, 'git commit -m x');
  assert.ok(denial, 'the sello must still enforce when only ship-guard is opted out');
  assert.match(denial.hookSpecificOutput.permissionDecisionReason, /sello/);
});

test('sello: a non-main trunk is honored via config, and an inert gate says so (B7)', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-sello-dev-'));
  g(root, 'init', '-b', 'develop');
  g(root, 'config', 'user.email', 't@t'); g(root, 'config', 'user.name', 'T');
  writeFileSync(join(root, 'app.js'), 'x\n');
  g(root, 'add', '.'); g(root, 'commit', '-m', 'init');
  g(root, 'checkout', '-b', 'feature');
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, 'src.js'), 'unreviewed\n');
  // No trunk configured → stands down, but LABELS itself instead of lying.
  enable(root);
  const inert = checkSello(root);
  assert.equal(inert.code, 'no-trunk');
  assert.match(inert.warning, /Recover:/);
  // Configured → the gate works normally.
  enable(root, { trunk: 'develop' });
  assert.equal(checkSello(root).code, 'no-review');
});

test('sello: a broken risk config falls back to the DEFAULT table, never a flat tier (B8)', () => {
  const root = makeRepo();
  enable(root, { risk: { raise: [{ pattern: '(' }] } });
  writeFileSync(join(root, '.env.production'), 'SECRET=1\n');
  const risk = classifyRisk(['.env.production'], { risk: { raise: [{ pattern: '(' }] } });
  assert.equal(risk.tier, 2, 'the floor must survive a malformed config');
  assert.match(risk.configError, /Recover:/);
  assert.equal(checkSello(root).code, 'no-review');
});

test('sello: `off` works even when the config is malformed (B9)', () => {
  const root = makeRepo();
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: true, risk: { raise: [{ pattern: '(' }] } }));
  const r = runCli(root, 'off');
  assert.equal(r.status, 0, `sello off must never be locked away by a broken config: ${r.stdout}${r.stderr}`);
  assert.equal(checkSello(root).code, 'disabled');
});

test('sello: symlinks hash their target, never the pointed-at bytes (B10)', () => {
  const root = makeRepo();
  const outside = join(root, '..', `sello-outside-${process.pid}`);
  writeFileSync(outside, 'SECRET MATERIAL\n');
  symlinkSync(outside, join(root, 'link.txt'));
  const c = computeCandidate(root);
  assert.match(c.files['link.txt'], /^L:/, 'a symlink must be marked and hashed by target');
  const secretHash = createHash('sha256').update(readFileSync(outside)).digest('hex');
  assert.notEqual(c.files['link.txt'], secretHash, 'out-of-repo content must never be read into the sello');
});

// --- CLI: the 100+ lines the panel proved were entirely untested --------------------

test('sello CLI: full lifecycle on/freeze/approve/check/status/report', () => {
  const root = makeRepo();
  assert.equal(runCli(root, 'on').status, 0);
  writeFileSync(join(root, 'app.js'), 'changed\n');
  assert.equal(runCli(root, 'check').status, 1, 'unreviewed risk>0 must fail the check');
  assert.match(runCli(root, 'freeze').stdout, /risk tier 1 → 1 lens/);
  const ok = runCli(root, 'approve', '--lenses', 'correctness');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(runCli(root, 'check').status, 0);
  const status = JSON.parse(runCli(root, 'status').stdout);
  assert.equal(status.enabled, true);
  assert.equal(status.check, 'sealed');
  assert.equal(status.lensesRequired, 1);
  // The durable trail survives the next freeze (spec: "saber después qué se entregó").
  const log = readFileSync(selloPaths(root).log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(log.length, 1);
  assert.equal(log[0].status, 'approved');
  assert.ok(log[0].digest);
});

test('sello CLI: a tier-2 change cannot be sealed with zero lenses', () => {
  const root = makeRepo();
  runCli(root, 'on');
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github/workflows/ci.yml'), 'on: push\n');
  assert.match(runCli(root, 'freeze').stdout, /risk tier 2 → 3 lens/);
  const bare = runCli(root, 'approve');
  assert.equal(bare.status, 1, 'an empty panel must not seal a tier-2 change');
  assert.match(bare.stdout, /Recover:/);
  const partial = runCli(root, 'approve', '--lenses', 'correctness', '--accept-partial-lenses');
  assert.equal(partial.status, 0, 'the gap may be accepted on purpose');
  assert.equal(JSON.parse(readFileSync(selloPaths(root).log, 'utf8').trim()).partialLenses, true);
});

test('sello CLI: valueless flags are usage errors, not crashes', () => {
  const root = makeRepo();
  runCli(root, 'on');
  writeFileSync(join(root, 'app.js'), 'changed\n');
  runCli(root, 'freeze');
  const r = runCli(root, 'approve', '--lenses');
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stdout + r.stderr, /is not a function|TypeError/);
});

test('sello CLI: freeze works from a subdirectory and from a repo with no .rsc yet', () => {
  const root = makeRepo();
  runCli(root, 'on');
  mkdirSync(join(root, 'src', 'deep'), { recursive: true });
  writeFileSync(join(root, 'src', 'deep', 'mod.js'), 'x\n');
  const r = spawnSync('node', [RSC, 'sello', 'freeze'], { cwd: join(root, 'src', 'deep'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  // The path must be repo-root-relative, or the guard's candidate would never match.
  const sealed = JSON.parse(readFileSync(selloPaths(root).state, 'utf8'));
  assert.ok(sealed.files['src/deep/mod.js'], `expected repo-relative key, got ${JSON.stringify(Object.keys(sealed.files))}`);
});

test('sello CLI: budget-check denies an unexplained overrun and records a justified one', () => {
  const root = makeRepo();
  runCli(root, 'on');
  writeFileSync(join(root, 'app.js'), 'a\n');
  runCli(root, 'freeze');
  runCli(root, 'budget', '--lines', '2');
  writeFileSync(join(root, 'app.js'), Array.from({ length: 40 }, (_, i) => `line${i}`).join('\n'));
  const denied = runCli(root, 'budget-check');
  assert.equal(denied.status, 1);
  assert.match(denied.stdout, /Recover:/);
  const justified = runCli(root, 'budget-check', '--justify', 'the fix needed a new helper');
  assert.equal(justified.status, 0);
  assert.match(readFileSync(selloPaths(root).findings, 'utf8'), /budget exceeded/);
});

test('sello: a fix hidden in a new untracked file still costs budget', () => {
  const root = makeRepo();
  writeFileSync(join(root, 'app.js'), 'a\n');
  const frozen = computeCandidate(root);
  writeFileSync(join(root, 'sneaky-fix.js'), Array.from({ length: 50 }, () => 'x').join('\n'));
  assert.ok(budgetSpent(frozen, computeCandidate(root)) >= 40, 'new files must not be free');
});

test('sello: lens requirements scale with tier and honor the config cap', () => {
  assert.equal(lensesRequired(0), 0);
  assert.equal(lensesRequired(1), 1);
  assert.equal(lensesRequired(2), 3);
  assert.equal(lensesRequired(2, { lenses: 2 }), 2, 'config may cap the panel');
  assert.equal(lensesRequired(2, { lenses: 0 }), 3, 'but never below one lens');
});

// --- the gate's production wiring (a decorative gate is the defect we already paid for)

test('materialization: the guard and its sello core are installed together', async () => {
  const { readFileSync: rf } = await import('node:fs');
  const claude = rf(join(REPO, 'targets', 'claude.js'), 'utf8');
  assert.match(claude, /copyFileSync\(join\(HERE, 'sello\.mjs'\)/, 'wireHook must materialize sello.mjs next to ship-guard');
  const apply = rf(join(REPO, 'scripts', 'install-apply.js'), 'utf8');
  assert.match(apply, /'sello\.mjs'/, 'sello.mjs must be in generatedHookFiles or restore cannot recover it');
  // And the guard must actually reach it as a sibling.
  const guard = rf(join(REPO, 'targets', 'ship-guard.mjs'), 'utf8');
  assert.match(guard, /new URL\('\.\/sello\.mjs', import\.meta\.url\)/, 'the guard must import its sibling, not a package path');
});

// --- the global switch and scope precedence ----------------------------------------
// Two scopes silently disagreeing is a failure this harness has already lived
// through (a project opt-out that never reached the user-scope guard), so
// precedence is asserted in both directions and the decision is surfaced.

function withHome(root) {
  const home = mkdtempSync(join(tmpdir(), 'rsc-sello-home-'));
  mkdirSync(join(home, '.rsc'), { recursive: true });
  return { home, env: { ...process.env, RSC_SELLO_HOME: home } };
}
const setGlobal = (home, cfg) => writeFileSync(join(home, '.rsc', 'sello-config.json'), JSON.stringify(cfg));
const cliIn = (root, env, ...args) => spawnSync('node', [RSC, 'sello', ...args], { cwd: root, encoding: 'utf8', env });

test('sello global: a project with no config inherits the global switch', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  setGlobal(home, { enabled: true });
  const r = cliIn(root, env, 'status');
  const st = JSON.parse(r.stdout);
  assert.equal(st.enabled, true, 'global on must reach a project with no config of its own');
  assert.equal(st.decidedBy, 'global');
  assert.equal(st.scopes.global, 'on');
  assert.equal(st.scopes.project, 'unset');
  assert.equal(cliIn(root, env, 'check').status, 1, 'and it actually enforces');
});

test('sello global: the project switch always wins, in both directions', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');

  setGlobal(home, { enabled: true });
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: false }));
  let st = JSON.parse(cliIn(root, env, 'status').stdout);
  assert.equal(st.enabled, false, 'project off must override global on');
  assert.equal(st.decidedBy, 'project');

  setGlobal(home, { enabled: false });
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: true }));
  st = JSON.parse(cliIn(root, env, 'status').stdout);
  assert.equal(st.enabled, true, 'project on must override global off');
  assert.equal(st.decidedBy, 'project');
});

test('sello global: `on --global` writes the user scope and warns when a project overrides it', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  writeFileSync(selloPaths(root).config, JSON.stringify({ enabled: false }));
  const r = cliIn(root, env, 'on', '--global');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /global/);
  assert.match(r.stdout, /project switch always wins/, 'a silently-overridden global switch is the bug this warns about');
  assert.equal(JSON.parse(readFileSync(join(home, '.rsc', 'sello-config.json'), 'utf8')).enabled, true);
  assert.equal(JSON.parse(readFileSync(selloPaths(root).config, 'utf8')).enabled, false, 'the project file must not be touched');
});

test('sello global: risk overrides come from the global config when the project has none', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  // A globally-declared raise rule must classify a project path it matches.
  setGlobal(home, { enabled: true, risk: { raise: [{ class: 'infra', pattern: '(^|/)terraform/' }] } });
  mkdirSync(join(root, 'terraform'), { recursive: true });
  writeFileSync(join(root, 'terraform', 'main.tf'), 'resource {}\n');
  const frozen = cliIn(root, env, 'freeze');
  assert.equal(frozen.status, 0, frozen.stdout + frozen.stderr);
  assert.match(frozen.stdout, /risk tier 2/, 'a global raise rule must apply to the project');
  assert.match(frozen.stdout, /terraform\/main\.tf → infra/);
});

test('sello global: the derived scope marker is never persisted into a config file', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  setGlobal(home, { enabled: true });
  cliIn(root, env, 'on');
  assert.equal(JSON.parse(readFileSync(selloPaths(root).config, 'utf8')).scope, undefined, 'project config');
  cliIn(root, env, 'on', '--global');
  assert.equal(JSON.parse(readFileSync(join(home, '.rsc', 'sello-config.json'), 'utf8')).scope, undefined, 'global config');
});

test('sello global: the guard honors the global switch too', () => {
  const root = makeRepo();
  const { home, env } = withHome(root);
  setGlobal(home, { enabled: true });
  writeFileSync(join(root, 'app.js'), 'unreviewed\n');
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
  const r = spawnSync('node', [SHIP_GUARD, root], { encoding: 'utf8', input, env });
  assert.equal(r.status, 0);
  const denial = JSON.parse(r.stdout || '{}');
  assert.equal(denial.hookSpecificOutput?.permissionDecision, 'deny', 'the gate must enforce a globally-enabled sello');
});

test('sello: non-blocking findings accumulate in a readable artifact', () => {
  const root = makeRepo();
  assert.equal(countFindings(root), 0);
  appendFindings(root, ['pre-existing: N+1 in listUsers', 'nit: rename x']);
  appendFindings(root, ['pre-existing: missing index on orders.user_id']);
  assert.equal(countFindings(root), 3);
  const text = readFileSync(selloPaths(root).findings, 'utf8');
  assert.match(text, /N\+1/);
});
