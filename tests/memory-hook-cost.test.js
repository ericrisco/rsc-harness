import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { capture, chooseMemoryRoot } from '../targets/session-memory-core.mjs';

// #332: on Windows every git process costs 50–80 ms, and the memory hooks spawned one per dirty file
// (twice) and one per session commit on every event. A long session pushed each message past Claude
// Code's 5 s hook timeout. The cost of an event must not grow with the session.

const adapter = fileURLToPath(new URL('../targets/session-memory-adapter.mjs', import.meta.url));
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-hook-cost-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['config', 'user.name', 'Test']);
  git(cwd, ['config', 'user.email', 'test@example.test']);
  git(cwd, ['config', 'core.autocrlf', 'false']);
  writeFileSync(join(cwd, '.rsc.json'), '{"version":1,"targets":["claude"],"skills":[],"agents":[],"ownSkills":[],"optOuts":[]}\n');
  writeFileSync(join(cwd, 'base.txt'), 'base\n');
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-qm', 'base']);
  return cwd;
}

// The git processes one `request` hook spawns, counted by git itself.
function gitProcesses(cwd) {
  const trace = join(mkdtempSync(join(tmpdir(), 'rsc-trace-')), 'trace');
  execFileSync(process.execPath, [adapter, 'claude', 'request'], {
    cwd, input: '{"session_id":"s1"}', env: { ...process.env, GIT_TRACE: trace },
  });
  const count = readFileSync(trace, 'utf8').split('\n').filter((line) => line.includes('trace: built-in: git')).length;
  rmSync(trace, { force: true });
  return count;
}

function grow(cwd, dirty, commits) {
  for (let i = 0; i < commits; i += 1) {
    writeFileSync(join(cwd, `c${i}.txt`), `${i}\n`);
    git(cwd, ['add', `c${i}.txt`]);
    git(cwd, ['commit', '-qm', `c${i}`]);
  }
  for (let i = 0; i < dirty; i += 1) writeFileSync(join(cwd, `d${i}.txt`), `${i}\n`);
}

test('a hook event spawns as many git processes in a long session as in a fresh one (#332)', () => {
  const short = repo();
  gitProcesses(short); // opens the session: the anchor takes this HEAD as its baseline
  grow(short, 1, 1);
  const few = gitProcesses(short);

  const long = repo();
  gitProcesses(long);
  grow(long, 40, 25);
  const many = gitProcesses(long);

  assert.equal(many, few, `40 dirty files and 25 commits cost ${many} git processes, one of each cost ${few}`);
  assert.ok(many <= 20, `an event spawned ${many} git processes`);
});

test('batched fingerprints equal one hash-object per file, odd names and deleted files included (#332)', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'gone.txt'), 'tracked\n');
  git(cwd, ['add', 'gone.txt']);
  git(cwd, ['commit', '-qm', 'gone']);
  capture({ cwd, sessionId: 'odd', target: 'claude', event: 'start' });
  // A name opening with `"` is read as C-quoted by --stdin-paths; spaces and non-ASCII must survive too.
  for (const name of ['"quoted.txt', 'with space.txt', 'ñandú.txt', 'plain.txt']) writeFileSync(join(cwd, name), `${name}\n`);
  rmSync(join(cwd, 'gone.txt'));
  const result = capture({ cwd, sessionId: 'odd', target: 'claude', event: 'request' });

  const anchors = join(chooseMemoryRoot(cwd).root, 'anchors');
  const anchor = JSON.parse(readFileSync(join(anchors, readdirSync(anchors)[0]), 'utf8'));
  const expected = Object.fromEntries(Object.keys(anchor.lastFingerprints).map((path) => {
    try { return [path, git(cwd, ['hash-object', '--no-filters', '--', path])]; } catch { return [path, null]; }
  }));
  assert.deepEqual(anchor.lastFingerprints, expected);
  assert.equal(anchor.lastFingerprints['gone.txt'], null);
  for (const name of ['"quoted.txt', 'with space.txt', 'ñandú.txt', 'plain.txt']) {
    assert.match(anchor.lastFingerprints[name] || '', /^[0-9a-f]{40}$/u, name);
  }
  assert.ok(result.record.files.includes('"quoted.txt'));
  assert.equal(result.record.editCount, 4); // the deleted file has no fingerprint to compare
});

test('one diff-tree over every session commit lists what one diff-tree per commit listed, merges included (#332)', () => {
  const cwd = repo();
  capture({ cwd, sessionId: 'merge', target: 'claude', event: 'start' });
  const main = git(cwd, ['symbolic-ref', '--short', 'HEAD']);
  git(cwd, ['switch', '-qc', 'side']);
  writeFileSync(join(cwd, 'base.txt'), 'side\n');
  writeFileSync(join(cwd, 'theirs.txt'), 'brought in by the merge\n');
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-qm', 'side']);
  git(cwd, ['switch', '-q', main]);
  writeFileSync(join(cwd, 'base.txt'), 'main\n');
  writeFileSync(join(cwd, 'mine.txt'), 'mine\n');
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-qm', 'main']);
  try { git(cwd, ['merge', '-q', 'side']); } catch { /* conflict on base.txt, resolved below */ }
  writeFileSync(join(cwd, 'base.txt'), 'resolved\n');
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-qm', 'merge side', '--no-edit']);

  const result = capture({ cwd, sessionId: 'merge', target: 'claude', event: 'turn' });
  // What the loop this replaced computed: `--cc` for a merge, `-r --root` for any other commit.
  const loop = new Set();
  for (const line of git(cwd, ['log', '--first-parent', '--format=%H %P', `${result.record.baselineHead}..HEAD`]).split('\n')) {
    const [sha, ...parents] = line.split(' ');
    const args = parents.length > 1 ? ['--cc'] : ['-r', '--root'];
    for (const name of git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-z', ...args, sha]).split('\0')) if (name) loop.add(name);
  }
  assert.deepEqual(result.record.files, [...loop].sort());
  assert.deepEqual(result.record.files, ['base.txt', 'mine.txt']);
  assert.equal(result.record.commits.length, 2);
});

test('a file git cannot read fails the batch, and every other file is still fingerprinted one by one (#332)', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  for (const others of [[], ['readable.txt']]) {
    const cwd = repo();
    capture({ cwd, sessionId: 'locked', target: 'claude', event: 'start' });
    writeFileSync(join(cwd, 'locked.txt'), 'no read permission\n');
    chmodSync(join(cwd, 'locked.txt'), 0o000);
    for (const name of others) writeFileSync(join(cwd, name), `${name}\n`);
    capture({ cwd, sessionId: 'locked', target: 'claude', event: 'request', force: true });
    const anchors = join(chooseMemoryRoot(cwd).root, 'anchors');
    const anchor = JSON.parse(readFileSync(join(anchors, readdirSync(anchors)[0]), 'utf8'));
    chmodSync(join(cwd, 'locked.txt'), 0o600);
    assert.equal(anchor.lastFingerprints['locked.txt'], null, 'an unreadable file has no fingerprint, never an empty one');
    for (const name of others) assert.equal(anchor.lastFingerprints[name], git(cwd, ['hash-object', '--no-filters', '--', name]));
  }
});
