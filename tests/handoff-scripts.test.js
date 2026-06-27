import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

// --- helpers ------------------------------------------------------------------

function hasGit() {
  return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}
function hasSh() {
  return spawnSync('sh', ['-c', 'true'], { encoding: 'utf8' }).status === 0;
}

const SCRIPTS_DIR = join(import.meta.dirname, '..', 'skills', 'implement', 'scripts');
const SDD_WORKSPACE = join(SCRIPTS_DIR, 'sdd-workspace');
const REVIEW_PACKAGE = join(SCRIPTS_DIR, 'review-package');
const TASK_BRIEF = join(SCRIPTS_DIR, 'task-brief');

// --- shared git repo setup (BASE + HEAD commit) --------------------------------

let tmpRoot;   // holds the throwaway git repo
let BASE_SHA;  // first commit sha
let HEAD_SHA;  // second commit sha

before(() => {
  if (!hasGit() || !hasSh()) return;

  tmpRoot = mkdtempSync(join(tmpdir(), 'rsc-handoff-'));

  function git(...args) {
    const r = spawnSync('git', args, {
      cwd: tmpRoot,
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@test.com',
             GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@test.com' },
    });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }

  git('init');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@test.com');

  // commit 1 — this becomes BASE
  writeFileSync(join(tmpRoot, 'alpha.txt'), 'alpha content\n');
  git('add', 'alpha.txt');
  git('commit', '-m', 'first: add alpha');
  BASE_SHA = git('rev-parse', 'HEAD');

  // commit 2 — an intermediate commit that HEAD~1 would silently drop
  writeFileSync(join(tmpRoot, 'beta.txt'), 'beta content\n');
  git('add', 'beta.txt');
  git('commit', '-m', 'second: add beta');

  // commit 3 — this becomes HEAD; using HEAD~1 would miss "second: add beta"
  writeFileSync(join(tmpRoot, 'gamma.txt'), 'gamma content\n');
  git('add', 'gamma.txt');
  git('commit', '-m', 'third: add gamma');
  HEAD_SHA = git('rev-parse', 'HEAD');
});

after(() => {
  if (tmpRoot) {
    try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// --- sdd-workspace ------------------------------------------------------------

test('sdd-workspace: prints a dir path that exists and contains a .gitignore with *', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const scratchRoot = mkdtempSync(join(tmpdir(), 'rsc-ws-'));

  const r = spawnSync('sh', [SDD_WORKSPACE], {
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: scratchRoot },
    cwd: scratchRoot,
  });

  assert.equal(r.status, 0, `script failed: ${r.stderr}`);
  const outDir = r.stdout.trim();
  assert.ok(outDir.length > 0, 'printed a path');
  assert.ok(existsSync(outDir), `dir exists: ${outDir}`);

  const gitignore = join(outDir, '.gitignore');
  assert.ok(existsSync(gitignore), '.gitignore present inside sdd-workspace dir');
  assert.ok(readFileSync(gitignore, 'utf8').includes('*'), '.gitignore contains *');

  // Idempotent: run again, same path, still valid
  const r2 = spawnSync('sh', [SDD_WORKSPACE], {
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: scratchRoot },
    cwd: scratchRoot,
  });
  assert.equal(r2.status, 0, 'idempotent second run succeeds');
  assert.equal(r2.stdout.trim(), outDir, 'same path returned on second call');

  try { rmSync(scratchRoot, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('sdd-workspace: $1 override uses the explicit dir', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const explicitDir = mkdtempSync(join(tmpdir(), 'rsc-ws-explicit-'));

  const r = spawnSync('sh', [SDD_WORKSPACE, explicitDir], { encoding: 'utf8' });
  assert.equal(r.status, 0, `script failed: ${r.stderr}`);
  const outDir = r.stdout.trim();
  assert.equal(outDir, explicitDir, 'returns the explicit override dir');
  assert.ok(existsSync(join(outDir, '.gitignore')), '.gitignore dropped in override dir');

  try { rmSync(explicitDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// --- review-package -----------------------------------------------------------

test('review-package BASE HEAD: output file exists, contains BOTH commits, has diff --stat section', (t) => {
  if (!hasGit() || !hasSh()) return t.skip('git or sh not available');

  const r = spawnSync('sh', [REVIEW_PACKAGE, BASE_SHA, HEAD_SHA], {
    cwd: tmpRoot,
    encoding: 'utf8',
  });

  assert.equal(r.status, 0, `script failed:\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  const filePath = r.stdout.trim();
  assert.ok(existsSync(filePath), `output file exists: ${filePath}`);

  const content = readFileSync(filePath, 'utf8');

  // Regression guard: git log BASE..HEAD must include BOTH intermediate commits.
  // If the script incorrectly used HEAD~1 it would only show "third: add gamma"
  // and silently drop "second: add beta" — that is the bug these scripts prevent.
  assert.ok(content.includes('second: add beta'), 'contains second commit message (would be dropped by HEAD~1)');
  assert.ok(content.includes('third: add gamma'), 'contains third (HEAD) commit message');

  // diff --stat section present — references files changed across the full range
  assert.ok(
    content.includes('beta.txt') && content.includes('gamma.txt'),
    'diff stat section references files from both intermediate commits',
  );

  // File name is deterministic (based on shas, not timestamp)
  const name = basename(filePath);
  assert.ok(name.startsWith('review-'), `file name starts with review-: ${name}`);
});

test('review-package: fails with nonzero exit when called with zero args', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const r = spawnSync('sh', [REVIEW_PACKAGE], { cwd: tmpRoot, encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'should exit nonzero when no args given');
  assert.ok(r.stderr.length > 0 || r.stdout.length > 0, 'prints an error message');
});

test('review-package: fails when given an invalid revision', (t) => {
  if (!hasGit() || !hasSh()) return t.skip('git or sh not available');

  const r = spawnSync('sh', [REVIEW_PACKAGE, 'bad-rev-abc123', HEAD_SHA], {
    cwd: tmpRoot,
    encoding: 'utf8',
  });
  assert.notEqual(r.status, 0, 'should exit nonzero for invalid rev');
});

// --- task-brief ---------------------------------------------------------------

let fixtureFile; // written in before() but created inline here for clarity

test('task-brief: extracts T2 body and NOT T1 body', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const fixtureDir = mkdtempSync(join(tmpdir(), 'rsc-brief-'));
  fixtureFile = join(fixtureDir, 'tasks.md');
  writeFileSync(fixtureFile, [
    '# Plan',
    '',
    '### T1 First task',
    'This is the first task body.',
    'More T1 content here.',
    '',
    '### T2 Second task',
    'This is the second task body.',
    'More T2 content here.',
    '',
    '### T3 Third task',
    'T3 content.',
    '',
  ].join('\n'));

  const r = spawnSync('sh', [TASK_BRIEF, fixtureFile, '2'], {
    cwd: fixtureDir,
    encoding: 'utf8',
  });

  assert.equal(r.status, 0, `script failed:\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  const outPath = r.stdout.trim();
  assert.ok(existsSync(outPath), `brief file exists: ${outPath}`);

  const content = readFileSync(outPath, 'utf8');
  assert.ok(content.includes('second task body'), 'contains T2 body text');
  assert.ok(content.includes('T2'), 'contains T2 heading');
  assert.ok(!content.includes('first task body'), 'does NOT contain T1 body');
  assert.ok(!content.includes('T3 content'), 'does NOT contain T3 body');

  try { rmSync(fixtureDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('task-brief: fails with nonzero exit when task N not found', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const fixtureDir = mkdtempSync(join(tmpdir(), 'rsc-brief-miss-'));
  const f = join(fixtureDir, 'tasks.md');
  writeFileSync(f, '### T1 Only task\nbody\n');

  const r = spawnSync('sh', [TASK_BRIEF, f, '99'], {
    cwd: fixtureDir,
    encoding: 'utf8',
  });
  assert.notEqual(r.status, 0, 'should fail when task not found');
  assert.ok((r.stderr + r.stdout).toLowerCase().includes('99') ||
            (r.stderr + r.stdout).toLowerCase().includes('not found') ||
            (r.stderr + r.stdout).toLowerCase().includes('task'),
    'prints a meaningful error message');

  try { rmSync(fixtureDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('task-brief: fails with nonzero exit when called with no args', (t) => {
  if (!hasSh()) return t.skip('sh not available');

  const r = spawnSync('sh', [TASK_BRIEF], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'should exit nonzero when no args given');
});
