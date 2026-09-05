import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// The reaper decides whether a worktree can be removed WITHOUT asking. That makes it the most
// dangerous piece of judgement the harness owns: every false positive is a directory that is gone,
// and with it anything inside it that was never in git. So this file builds REAL git repositories in
// a temp dir — no stubbed git, because stubbed git is exactly where this class of code lies — and
// exercises both directions of the gate (P2): each blocker gets a case that proves it refuses, and
// the clean state gets a case that proves it still removes. A gate that has only ever been seen
// refuse is not known to work.
const HERE = dirname(fileURLToPath(import.meta.url));
const MOD = join(HERE, '..', 'targets', 'worktree-reaper.mjs');
const CLI = join(HERE, '..', 'scripts', 'rsc.js');

const {
  classifyWorktrees, reapWorktree, isCleanupEnabled, resolveTrunk, listWorktrees, REGENERABLE,
} = await import(MOD);

const TMP = [];
function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
function write(root, rel, body) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

// A repo on `main` with one commit, plus a `.worktrees/` dir — the location rsc creates.
function repo({ trunkName = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-wt-'));
  TMP.push(root);
  git(root, 'init', '-b', trunkName, '-q');
  git(root, 'config', 'user.email', 'eric@example.com');
  git(root, 'config', 'user.name', 'Eric');
  write(root, 'README.md', '# repo\n');
  write(root, '.gitignore', 'node_modules/\n.env\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'init');
  return root;
}

// A worktree with rsc's own shape: under .worktrees/<slug> on branch feat/<slug>.
function rscWorktree(root, slug = 'thing', { location = 'rsc', branch = 'rsc' } = {}) {
  const path = location === 'rsc'
    ? join(root, '.worktrees', slug)
    : join(root, '..', `stray-${slug}-${Math.random().toString(36).slice(2, 7)}`);
  // A sibling path lives OUTSIDE the repo, so cleaning the repo does not clean it. Left unregistered,
  // these accumulated in the temp dir across runs — 303 of them — and turned this suite intermittent.
  // Evidence that only holds when the machine happens to be tidy is not evidence.
  if (location !== 'rsc') TMP.push(path);
  const ref = branch === 'rsc' ? `feat/${slug}` : `wip-${slug}`;
  git(root, 'worktree', 'add', '-q', '-b', ref, path);
  // git reports the real path; on macOS the temp dir arrives here through two symlinks.
  return { path: realpathSync.native(path), branch: ref };
}

// Land the worktree's work on the trunk the way a real merge does (identities preserved).
function mergeIntoTrunk(root, branch) {
  git(root, 'merge', '--no-ff', '-q', branch, '-m', `merge ${branch}`);
}

// Land it the way a forge's squash button does: same content, brand-new identity.
function squashIntoTrunk(root, branch) {
  git(root, 'merge', '--squash', '-q', branch);
  git(root, 'commit', '-qm', `squash ${branch}`);
}

function verdictFor(root, path) {
  const found = classifyWorktrees(root).find((c) => c.path === path);
  return found || { verdict: 'absent', reasons: [] };
}

test.after(() => {
  for (const d of TMP) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

// ── 1. the positive direction: the gate must be able to PASS ────────────────────────────────

test('1 · rsc worktree, clean, merged → safe, and reaping removes directory and branch', () => {
  const root = repo();
  const wt = rscWorktree(root, 'alpha');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: alpha');
  mergeIntoTrunk(root, wt.branch);

  assert.equal(verdictFor(root, wt.path).verdict, 'safe');

  const out = reapWorktree(root, wt.path);
  assert.equal(out.removed, true);
  assert.equal(out.branchDeleted, true);
  assert.equal(existsSync(wt.path), false, 'the directory must be gone');
  assert.ok(!git(root, 'branch', '--list', wt.branch), 'the merged branch must be gone');
  assert.ok(!listWorktrees(root).some((w) => w.path === wt.path), 'git must not still list it');
});

// ── 2-3. the blockers that exist to protect work ────────────────────────────────────────────

test('2 · a tracked modification blocks the silent path and names the file', () => {
  const root = repo();
  const wt = rscWorktree(root, 'beta');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: beta');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'feature.txt', 'work, edited but never committed\n');

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'ask');
  assert.ok(v.reasons.some((r) => r.startsWith('dirty')), `expected a dirty reason, got ${v.reasons}`);
  assert.ok(JSON.stringify(v).includes('feature.txt'), 'the pending file must be named');
});

test('3 · a file that was never in the history blocks it too — this is the .env case', () => {
  const root = repo();
  const wt = rscWorktree(root, 'gamma');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: gamma');
  mergeIntoTrunk(root, wt.branch);
  // Clean for git — it is ignored — and the only copy that exists anywhere.
  write(wt.path, '.env', 'DATABASE_URL=postgres://localhost/dev\n');
  assert.equal(git(wt.path, 'status', '--porcelain'), '', 'precondition: git itself calls this clean');

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'ask', 'a git-clean worktree holding the only copy of .env is NOT safe');
  assert.deepEqual(v.details.outside, ['.env'], 'and it is out-of-history content, not a pending edit');
  assert.deepEqual(v.details.dirty, [], 'calling it dirty would give the user the wrong instruction');
});

test('4 · but installed dependencies and build output do not block it', () => {
  const root = repo();
  const wt = rscWorktree(root, 'delta');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: delta');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'node_modules/left-pad/index.js', 'module.exports = 1\n');
  write(wt.path, 'dist/bundle.js', 'built\n');

  assert.equal(verdictFor(root, wt.path).verdict, 'safe',
    'without this carve-out the default would never be automatic — every worktree has dependencies');
});

// ── 5. the case the whole content-based criterion exists for ────────────────────────────────

test('5 · squash-merged: directory goes, branch STAYS (git cannot delete it safely)', () => {
  const root = repo();
  const wt = rscWorktree(root, 'epsilon');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: epsilon');
  squashIntoTrunk(root, wt.branch);

  // Reachability would say "never merged" here. That is the bug this criterion avoids.
  assert.equal(verdictFor(root, wt.path).verdict, 'safe');

  const out = reapWorktree(root, wt.path);
  assert.equal(out.removed, true);
  assert.equal(out.branchDeleted, false);
  assert.equal(out.branchKept, true, 'the branch is the recovery net when equivalence was judged, not proven');
  assert.ok(git(root, 'branch', '--list', wt.branch), 'the branch must still exist');
});

// ── 6-8. everything that must never be touched ──────────────────────────────────────────────

test('6 · a branch that still carries work of its own is never a candidate', () => {
  const root = repo();
  const wt = rscWorktree(root, 'zeta');
  write(wt.path, 'feature.txt', 'work in progress\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: zeta');

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'skip');
  assert.ok(v.reasons.includes('not-integrated'));
});

test('7 · location matches but the branch does not → ambiguous, so it is asked, never silent', () => {
  const root = repo();
  const wt = rscWorktree(root, 'eta', { branch: 'foreign' });
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: eta');
  mergeIntoTrunk(root, wt.branch);

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'ask');
  assert.ok(v.reasons.includes('provenance-ambiguous'));
});

test('8 · neither signal matches → foreign: not removed and not even offered', () => {
  const root = repo();
  const wt = rscWorktree(root, 'theta', { location: 'stray', branch: 'foreign' });
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: theta');
  mergeIntoTrunk(root, wt.branch);

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'skip');
  assert.ok(v.reasons.includes('foreign'));

  const out = reapWorktree(root, wt.path);
  assert.equal(out.removed, false, 'a foreign worktree is not ours to delete');
  assert.equal(existsSync(wt.path), true);
});

// ── 9-11. the switches and the edges ────────────────────────────────────────────────────────

test('9 · the opt-out makes the whole thing a silent no-op', () => {
  const root = repo();
  const wt = rscWorktree(root, 'iota');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: iota');
  mergeIntoTrunk(root, wt.branch);
  assert.equal(isCleanupEnabled(root), true);

  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.no-worktree-cleanup'), '');

  assert.equal(isCleanupEnabled(root), false);
  assert.deepEqual(classifyWorktrees(root), []);
  assert.equal(reapWorktree(root, wt.path).removed, false);
  assert.equal(existsSync(wt.path), true);
});

test('10 · no resolvable trunk → nothing is classified, and nothing throws', () => {
  const root = repo({ trunkName: 'trunk' });
  const wt = rscWorktree(root, 'kappa');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: kappa');

  assert.equal(resolveTrunk(root), null);
  assert.deepEqual(classifyWorktrees(root), [], 'unable to judge integration ⇒ no candidates at all');
  assert.equal(existsSync(wt.path), true);
});

test('11 · the main working tree is never a candidate', () => {
  const root = repo();
  rscWorktree(root, 'lambda');
  assert.ok(!classifyWorktrees(root).some((c) => c.path === root));
  assert.equal(reapWorktree(root, root).removed, false);
  assert.ok(existsSync(join(root, 'README.md')));
});

// ── 12-14. reaping refuses, and a bulk yes does not launder risk ────────────────────────────

test('12 · reaping an un-integrated worktree is refused even when asked directly', () => {
  const root = repo();
  const wt = rscWorktree(root, 'mu');
  write(wt.path, 'feature.txt', 'unmerged work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: mu');

  const out = reapWorktree(root, wt.path, { confirmed: true });
  assert.equal(out.removed, false, 'confirmation does not upgrade "not integrated" into safe');
  assert.match(out.reason, /feat\/mu/, 'a refusal names what it is refusing');
  assert.match(out.reason, /ship|discard/, 'and carries the way out (P6), not just a fact');
  assert.equal(existsSync(wt.path), true);
});

test('13 · reaping works even when the process is standing inside the worktree', () => {
  const root = repo();
  const wt = rscWorktree(root, 'nu');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A');
  git(wt.path, 'commit', '-qm', 'feat: nu');
  mergeIntoTrunk(root, wt.branch);

  const before = process.cwd();
  try {
    process.chdir(wt.path);
    const out = reapWorktree(root, wt.path);
    assert.equal(out.removed, true, 'the common case — closing from where you worked — must still clean');
  } finally {
    process.chdir(before);
  }
  assert.equal(existsSync(wt.path), false);
});

test('14 · a bulk reap takes the safe ones and leaves the ones that were asked for a reason', () => {
  const root = repo();
  const safe = rscWorktree(root, 'xi');
  write(safe.path, 'a.txt', 'a\n');
  git(safe.path, 'add', '-A'); git(safe.path, 'commit', '-qm', 'feat: xi');
  mergeIntoTrunk(root, safe.branch);

  const risky = rscWorktree(root, 'omicron');
  write(risky.path, 'b.txt', 'b\n');
  git(risky.path, 'add', '-A'); git(risky.path, 'commit', '-qm', 'feat: omicron');
  mergeIntoTrunk(root, risky.branch);
  write(risky.path, '.env', 'SECRET=1\n');

  const results = classifyWorktrees(root)
    .filter((c) => c.verdict === 'safe')
    .map((c) => reapWorktree(root, c.path));

  assert.equal(results.length, 1, 'only one of the two was ever safe');
  assert.equal(existsSync(safe.path), false);
  assert.equal(existsSync(risky.path), true, 'a yes in bulk must not authorise what was asked for risk');
});

// ── 15. the table the code iterates, and the skill that must call this ──────────────────────

test('15 · the regenerable table is data the test can read, not conditionals it cannot', () => {
  assert.ok(Array.isArray(REGENERABLE) && REGENERABLE.length > 3);
  for (const name of ['node_modules', 'dist', '__pycache__']) {
    assert.ok(REGENERABLE.includes(name), `${name} must be treated as regenerable`);
  }
});

test('15b · ship option 1 executes the cleanup instead of describing it afterwards', async () => {
  const { readFileSync } = await import('node:fs');
  const ship = readFileSync(join(HERE, '..', 'skills', 'ship', 'SKILL.md'), 'utf8');
  const start = ship.indexOf('### Option 1');
  const end = ship.indexOf('### Option 2');
  assert.ok(start > 0 && end > start, 'the option-1 section must exist');
  const runnable = ship.slice(start, end).split('\n')
    .filter((l) => !l.trimStart().startsWith('#')).join('\n');
  assert.match(runnable, /^npx @ericrisco\/rsc worktrees reap /m,
    'a commented-out command satisfies /rsc worktrees/ too; the criterion is that option 1 RUNS it');
});

test('15c · the CLI classifies a real repository', () => {
  const root = repo();
  const wt = rscWorktree(root, 'pi');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: pi');
  mergeIntoTrunk(root, wt.branch);

  const r = spawnSync('node', [CLI, 'worktrees'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  // `safe` also appears in the footer this command always prints, so pin it to the candidate's line.
  const line = r.stdout.split('\n').find((l) => l.includes('feat/pi'));
  assert.ok(line, `the candidate must be listed: ${r.stdout}`);
  assert.match(line, /^\s*safe\s/, `classified, not just mentioned: ${line}`);
});

// ── 16. the sweep: it must speak when there is something to say, and only then ───────────────

function sweep(root) {
  const r = spawnSync('node', [join(HERE, '..', 'targets', 'session-start.mjs'), '/nonexistent/SKILL.md', root], {
    encoding: 'utf8',
    env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('16 · the session-start sweep names landed worktrees and tells the agent to ask first', () => {
  const root = repo();
  const wt = rscWorktree(root, 'rho');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: rho');
  mergeIntoTrunk(root, wt.branch);

  const out = sweep(root);
  assert.match(out, /rsc worktree cleanup/);
  assert.match(out, /rho/);
  // Asserting the wording of the offer proves nothing: that string is a literal inside the block and
  // stays true whether or not the sweep touched the disk. Ask the disk.
  assert.equal(existsSync(wt.path), true, 'the sweep offers; it must never remove on its own');
  assert.ok(git(root, 'branch', '--list', wt.branch), 'nor delete the branch behind the offer');
  assert.match(out, /no-worktree-cleanup/, 'a recurring notice must carry its permanent off switch (P6)');
});

test('16b · and stays completely silent when nothing has landed', () => {
  const root = repo();
  const wt = rscWorktree(root, 'sigma');
  write(wt.path, 'feature.txt', 'still working\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: sigma');

  assert.doesNotMatch(sweep(root), /worktree cleanup/, 'nothing to say is nothing to say');
});

test('16c · the reaper travels with the hook that imports it', async () => {
  const { readFileSync } = await import('node:fs');
  const claude = readFileSync(join(HERE, '..', 'targets', 'claude.js'), 'utf8');
  assert.match(claude, /copyFileSync\(join\(HERE, 'worktree-reaper\.mjs'\)/,
    'session-start imports it as a sibling, so the installer must materialize it as one');
});

// ── 17-20. what the adversarial security pass found: three ways this destroyed or leaked data ──

test('17 · a file NAMED like a build dir is not a build dir (config/env holds credentials)', () => {
  const root = repo();
  const wt = rscWorktree(root, 'tau');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: tau');
  mergeIntoTrunk(root, wt.branch);
  // Matching the regenerable table against the BASENAME made every one of these disposable.
  write(wt.path, 'config/env', 'DB_PASSWORD=hunter2\n');
  write(wt.path, 'deploy/build', '#!/bin/sh\n');
  write(wt.path, 'notes/out', 'private\n');

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'ask', 'these are three never-committed files, not build output');
  assert.ok(v.details.outside.includes('config/env'), `expected config/env, got ${v.details.outside}`);
});

test('17b · a real build directory is still regenerable, and so is junk at any depth', () => {
  const root = repo();
  const wt = rscWorktree(root, 'upsilon');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: upsilon');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'dist/assets/deep/bundle.js', 'built\n');
  write(wt.path, 'sub/.DS_Store', 'junk');

  assert.equal(verdictFor(root, wt.path).verdict, 'safe');
});

test('18 · a refusal names every reason, not just the first one it happened to record', async () => {
  const { refusal } = await import(MOD);
  const root = repo();
  const wt = rscWorktree(root, 'phi');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: phi');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'feature.txt', 'edited\n');           // dirty, and merely annoying
  write(wt.path, 'production.env', 'STRIPE=sk_live\n'); // untracked, and irreplaceable

  const message = refusal(verdictFor(root, wt.path));
  assert.match(message, /feature\.txt/);
  assert.match(message, /production\.env/,
    'confirming against a description of the tracked nuisance is how the untracked secret gets deleted');
});

test('18b · and a worktree holding one is never reaped without confirmation', () => {
  const root = repo();
  const wt = rscWorktree(root, 'chi');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: chi');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'production.env', 'STRIPE=sk_live\n');

  assert.equal(reapWorktree(root, wt.path).removed, false);
  assert.equal(existsSync(join(wt.path, 'production.env')), true);
});

test('19 · the sweep leaks neither machine paths nor the names of files at risk', () => {
  const root = repo();
  const wt = rscWorktree(root, 'psi');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: psi');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, '.env', 'SECRET=1\n');                // ignored: the user marked it private
  write(wt.path, 'salary-notes.md', 'confidential\n'); // untracked

  const out = sweep(root);
  assert.doesNotMatch(out, /salary-notes/, 'these names enter the model context unprompted');
  assert.ok(!out.includes(realpathSync.native(root)), 'P9: nothing distributed carries machine paths');
  assert.match(out, /psi/, 'it must still be identifiable enough to act on');
});

test('19b · and it stays bounded when a worktree holds thousands of stray files', () => {
  const root = repo();
  const wt = rscWorktree(root, 'omega');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: omega');
  mergeIntoTrunk(root, wt.branch);
  for (let i = 0; i < 400; i++) write(wt.path, `artifacts/f${i}.bin`, 'x');

  const out = sweep(root);
  assert.ok(out.length < 4000, `the startup block must not balloon the context; got ${out.length} bytes`);
});

test('20 · a reap target outside the project is refused', () => {
  const root = repo();
  const outsider = mkdtempSync(join(tmpdir(), 'rsc-outside-'));
  TMP.push(outsider);
  writeFileSync(join(outsider, 'tax-returns.pdf'), 'precious');

  const out = reapWorktree(root, outsider, { confirmed: true });
  assert.equal(out.removed, false);
  assert.equal(existsSync(join(outsider, 'tax-returns.pdf')), true);
});

test('21 · a path crafted to forge a second porcelain entry produces no candidate', () => {
  const root = repo();
  const decoy = join(root, 'DECOY');
  mkdirSync(decoy, { recursive: true });
  writeFileSync(join(decoy, 'precious.txt'), 'keep me');

  // `git worktree list --porcelain` is newline-delimited and does not quote paths.
  const evil = join(root, '.worktrees', `x\nworktree ${decoy}`);
  try {
    git(root, 'worktree', 'add', '-q', '-b', 'feat/evil', evil);
  } catch {
    return; // git refused the name outright — the forgery never gets off the ground here
  }
  const paths = listWorktrees(root).map((w) => w.path);
  assert.ok(!paths.includes(realpathSync.native(decoy)), 'a fabricated entry must never be listed');
  assert.ok(!classifyWorktrees(root).some((c) => c.path === realpathSync.native(decoy)));
  assert.equal(existsSync(join(decoy, 'precious.txt')), true);
});

// ── 22-28. what the adversarial correctness pass found ──────────────────────────────────────

test('22 · a freshly cut worktree that never produced a commit is NOT landed work', () => {
  const root = repo();
  const wt = rscWorktree(root, 'fresh');
  write(wt.path, 'node_modules/dep/index.js', 'installed\n'); // npm install ran, nothing written yet

  const v = verdictFor(root, wt.path);
  assert.notEqual(v.verdict, 'safe',
    'nothing landed from a branch that never carried a commit — this is a live workspace');
  assert.ok(v.reasons.includes('nothing-landed'), `got ${v.reasons}`);
});

test('22b · and one cut from an older trunk, still with no commits, is not landed either', () => {
  const root = repo();
  const wt = rscWorktree(root, 'stale');
  write(root, 'other.txt', 'trunk moved on\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'trunk work');

  assert.notEqual(verdictFor(root, wt.path).verdict, 'safe');
});

test('23 · naming a path selects it — it does not accept the risk of removing it', () => {
  const root = repo();
  const wt = rscWorktree(root, 'named');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: named');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'production.env', 'STRIPE=sk_live\n');

  const r = spawnSync('node', [CLI, 'worktrees', 'reap', wt.path], { cwd: root, encoding: 'utf8' });
  assert.match(r.stdout, /production\.env/, 'the refusal must say what is at stake');
  assert.equal(existsSync(join(wt.path, 'production.env')), true, 'a path is a selection, not a consent');

  const ok = spawnSync('node', [CLI, 'worktrees', 'reap', wt.path, '--confirm'], { cwd: root, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(existsSync(wt.path), false, 'and an explicit confirmation still works');
});

test('24 · the trunk branch is never deleted, whatever the user confirms', () => {
  const root = repo();
  // A sibling checkout of the trunk itself: location matches rsc's convention, branch does not.
  const path = join(root, '..', `${basename(root)}-main`);
  TMP.push(path);
  git(root, 'checkout', '-qb', 'feat/elsewhere');   // free the trunk so it can be checked out elsewhere
  git(root, 'worktree', 'add', '-q', path, 'main');

  const out = reapWorktree(root, path, { confirmed: true });
  assert.ok(git(root, 'rev-parse', '--verify', 'main'), 'deleting the trunk ref must never be a side effect');
  if (out.removed) assert.equal(out.branchDeleted, false);
});

test('25 · a rename is parsed as one file, not as a truncated second one', () => {
  const root = repo();
  const wt = rscWorktree(root, 'renamed');
  write(wt.path, 'original-document.md', 'text\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: renamed');
  mergeIntoTrunk(root, wt.branch);
  git(wt.path, 'mv', 'original-document.md', 'renamed-document.md');

  const v = verdictFor(root, wt.path);
  const named = JSON.stringify(v);
  assert.ok(!/ginal-document/.test(named), `a refusal must name files that exist: ${named}`);
  assert.ok(/renamed-document\.md/.test(named));
});

test('26 · a locked worktree is left alone and is never announced as removable', () => {
  const root = repo();
  const wt = rscWorktree(root, 'locked');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: locked');
  mergeIntoTrunk(root, wt.branch);
  git(root, 'worktree', 'lock', '--reason', 'external drive, do not remove', wt.path);

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'skip', 'a lock is the strongest "do not touch" a user can express');
  assert.ok(v.reasons.includes('locked'));
});

test('27 · reaping one worktree does not de-register another whose media is absent', () => {
  const root = repo();
  const a = rscWorktree(root, 'reapable');
  write(a.path, 'a.txt', 'a\n'); git(a.path, 'add', '-A'); git(a.path, 'commit', '-qm', 'feat: a');
  mergeIntoTrunk(root, a.branch);

  const b = rscWorktree(root, 'absent');
  write(b.path, 'precious.txt', 'never committed\n');
  rmSync(b.path, { recursive: true, force: true }); // the volume went away, the work did not

  assert.equal(reapWorktree(root, a.path).removed, true);
  const admin = git(root, 'worktree', 'list', '--porcelain');
  assert.ok(admin.includes('absent'), 'a temporarily missing worktree must keep its registration');
});

test('28 · a worktree too large for a 1 MiB pipe is still read, not called unreadable', () => {
  const root = repo();
  const wt = rscWorktree(root, 'huge');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: huge');
  mergeIntoTrunk(root, wt.branch);
  // ~2 MB of porcelain output: enough to kill git through node's default pipe budget.
  for (let i = 0; i < 12000; i++) write(wt.path, `blob/${'n'.repeat(120)}${i}.bin`, 'x');

  const v = verdictFor(root, wt.path);
  assert.ok(!v.reasons.includes('unreadable'), 'node truncating the pipe is not git failing to report');
  assert.equal(v.verdict, 'ask', 'and 12000 stray files are certainly something to ask about');
});

test('28b · but a genuinely unreadable worktree is skipped, never called safe', async () => {
  const { classifyWorktrees: classify } = await import(MOD);
  const root = repo();
  const wt = rscWorktree(root, 'gone');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: gone');
  mergeIntoTrunk(root, wt.branch);
  rmSync(wt.path, { recursive: true, force: true });

  const found = classify(root).find((c) => c.branch === wt.branch);
  assert.ok(!found || found.verdict !== 'safe', 'a directory git cannot inspect is never safe to delete');
});

// ── 29-36. coverage the mutation pass proved was missing ────────────────────────────────────

test('29 · the sibling <repo>-<slug> layout is recognised — it is the one `worktrees` documents', () => {
  const root = repo();
  const path = join(root, '..', `${basename(root)}-sib`);
  TMP.push(path);
  git(root, 'worktree', 'add', '-q', '-b', 'feat/sib', path);
  const real = realpathSync.native(path);
  write(real, 'f.txt', 'work\n'); git(real, 'add', '-A'); git(real, 'commit', '-qm', 'feat: sib');
  mergeIntoTrunk(root, 'feat/sib');

  assert.equal(verdictFor(root, real).verdict, 'safe');
});

test('29b · so is a bare worktrees/ directory', () => {
  const root = repo();
  const path = join(root, 'worktrees', 'plain');
  git(root, 'worktree', 'add', '-q', '-b', 'feat/plain', path);
  const real = realpathSync.native(path);
  write(real, 'f.txt', 'work\n'); git(real, 'add', '-A'); git(real, 'commit', '-qm', 'feat: plain');
  mergeIntoTrunk(root, 'feat/plain');

  assert.equal(verdictFor(root, real).verdict, 'safe');
});

test('29c · and a feature/ prefix, which is what ship own examples write', () => {
  const root = repo();
  const path = join(root, '.worktrees', 'longform');
  git(root, 'worktree', 'add', '-q', '-b', 'feature/longform', path);
  const real = realpathSync.native(path);
  write(real, 'f.txt', 'work\n'); git(real, 'add', '-A'); git(real, 'commit', '-qm', 'feat: longform');
  mergeIntoTrunk(root, 'feature/longform');

  assert.equal(verdictFor(root, real).verdict, 'safe');
});

test('30 · a monorepo keeps the carve-out: nested node_modules is still disposable', () => {
  const root = repo();
  const wt = rscWorktree(root, 'mono');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: mono');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'packages/app/node_modules/dep/index.js', 'installed\n');
  write(wt.path, 'apps/web/dist/bundle.js', 'built\n');

  assert.equal(verdictFor(root, wt.path).verdict, 'safe',
    'workspaces are the common JS shape; sending every one of them to the prompt is how this gets turned off');
});

test('30b · but a FILE called env, deep in the tree, is still content to lose', () => {
  const root = repo();
  const wt = rscWorktree(root, 'deepenv');
  write(wt.path, 'feature.txt', 'work\n');
  git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: deepenv');
  mergeIntoTrunk(root, wt.branch);
  write(wt.path, 'services/api/config/env', 'AWS_SECRET=hunter2\n');

  const v = verdictFor(root, wt.path);
  assert.equal(v.verdict, 'ask');
  assert.deepEqual(v.details.outside, ['services/api/config/env']);
});

test('31 · a detached worktree is left alone, and no message says "null"', async () => {
  const root = repo();
  const path = join(root, '.worktrees', 'floating');
  git(root, 'worktree', 'add', '-q', '--detach', path);
  const real = realpathSync.native(path);

  const v = verdictFor(root, real);
  assert.equal(v.verdict, 'skip');
  assert.ok(v.reasons.includes('detached'));
  const { refusal, summarize } = await import(MOD);
  assert.ok(!refusal(v).includes('null'), 'a refusal that interpolates a branch which does not exist is not a message');
  assert.ok(!summarize(v, root).includes('null'));
});

test('32 · a submodule is not a worktree of this repository', async () => {
  const { classifyWorktrees: classify } = await import(MOD);
  const root = repo();
  const inner = repo();
  git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', inner, 'vendor-lib');
  git(root, 'commit', '-qm', 'add submodule');

  assert.ok(!classify(root).some((c) => c.path.endsWith('vendor-lib')),
    'it only looks like one, which is exactly why it needs the guard');
});

test('33 · from inside a worktree, home is the main checkout — not where you stand', async () => {
  const { resolveMainRoot } = await import(MOD);
  const root = repo();
  const wt = rscWorktree(root, 'standing');

  assert.equal(resolveMainRoot(wt.path), realpathSync.native(root),
    'this is what the CLI calls, and it is why you can close a branch from the worktree you built it in');
});

test('34 · the remote tip wins over a stale local trunk', () => {
  const root = repo();
  const remote = mkdtempSync(join(tmpdir(), 'rsc-remote-'));
  TMP.push(remote);
  git(remote, 'init', '--bare', '-q', '-b', 'main');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-q', 'origin', 'main');

  const wt = rscWorktree(root, 'pushed');
  write(wt.path, 'f.txt', 'work\n'); git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: pushed');
  mergeIntoTrunk(root, wt.branch);

  assert.equal(resolveTrunk(root), 'origin/main', 'a stale local main must not certify work as landed');
  assert.equal(verdictFor(root, wt.path).verdict, 'skip',
    'merged locally but never pushed: from the remote trunk nothing has landed yet');

  git(root, 'push', '-q', 'origin', 'main');
  assert.equal(verdictFor(root, wt.path).verdict, 'safe', 'once it is really on the trunk, it is landed');
});

test('35 · an integration question git cannot answer is never read as "landed"', async () => {
  const { integrationOf, listWorktrees: list, refusal } = await import(MOD);
  const root = repo();
  const wt = rscWorktree(root, 'unanswerable');
  write(wt.path, 'f.txt', 'work\n'); git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: u');

  const entry = list(root).find((w) => w.branch === wt.branch);
  assert.equal(integrationOf(root, entry, 'refs/heads/no-such-trunk'), 'unknown');
  assert.match(refusal({ branch: wt.branch, reasons: ['unknown'], details: {} }), /git log/,
    'and the refusal hands back a command to check it by hand (P6)');
});

test('36 · the sweep respects the opt-out, not only the library does', () => {
  const root = repo();
  const wt = rscWorktree(root, 'quiet');
  write(wt.path, 'f.txt', 'work\n'); git(wt.path, 'add', '-A'); git(wt.path, 'commit', '-qm', 'feat: q');
  mergeIntoTrunk(root, wt.branch);
  assert.match(sweep(root), /worktree cleanup/, 'precondition: it would speak');

  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.no-worktree-cleanup'), '');
  assert.doesNotMatch(sweep(root), /worktree cleanup/, 'off means off at both entry points');
});
