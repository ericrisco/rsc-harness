import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  KNOWLEDGE, OPT_OUT, SKIP_CI, hook, inactiveReason, knowledgeStatus, onRequest, onTurn, work,
} from '../targets/knowledge-sync.mjs';

process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND = '1';

// Knowledge sync is on by default, so these tests are mostly about what it must NOT do: push code,
// push the profile, push somebody's unpushed work, overwrite a file you are editing, pull in code
// that would run on your machine. Everything runs against a real `--bare` remote and two clones —
// "Eric" and "Ana" — because the whole feature is what git does between two machines.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function write(repo, rel, body) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), body);
}
const read = (repo, rel) => readFileSync(join(repo, rel), 'utf8');

function team() {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ks-')));
  const remote = join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const seed = join(tmp, 'seed');
  git(tmp, 'clone', '-q', remote, seed);
  ident(seed, 'Seed');
  write(seed, '.gitignore', '.rsc/\n');
  write(seed, '.rsc.json', JSON.stringify({ version: 1, targets: ['claude'], skills: [], agents: [], ownSkills: [], optOuts: [] }));
  write(seed, '02-DOCS/wiki/index.md', 'uno\ndos\ntres\n');
  write(seed, '02-DOCS/wiki/harness/user-profile.md', 'technical_level: L2\n');
  write(seed, '01-TOOLS/README.md', 'tools\n');
  write(seed, 'src/app.js', 'code\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'seed');
  git(seed, 'push', '-q', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const clone = (name, who) => {
    const dir = join(tmp, name);
    git(tmp, 'clone', '-q', remote, dir);
    ident(dir, who);
    return dir;
  };
  return { tmp, remote, eric: clone('eric', 'Eric'), ana: clone('ana', 'Ana') };
}

function ident(repo, who) {
  git(repo, 'config', 'user.name', who);
  git(repo, 'config', 'user.email', `${who.toLowerCase()}@x`);
}

/** The end of a turn, with the background push run in the foreground. */
function turn(repo) {
  onTurn(repo, { spawnShip: false });
  work(repo, 'ship');
}

/** A new message, after the background fetch has had its chance. */
function message(repo) {
  work(repo, 'fetch');
  return onRequest(repo, { spawnFetch: false });
}

const remoteFiles = (remote) => git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n');
const remoteShow = (remote, rel) => git(remote, 'show', `main:${rel}`);
const state = (repo) => JSON.parse(read(repo, '.rsc/knowledge-sync.json'));
const quiet = (repo) => { onRequest(repo, { spawnFetch: false }); }; // consume the one-time announcement

// ------------------------------------------------------------------ up

test('ks01 · a knowledge change made on the default branch reaches the remote with the same SHA', () => {
  const { remote, eric } = team();
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(git(remote, 'rev-parse', 'main'), git(eric, 'rev-parse', 'HEAD'));
  const msg = git(remote, 'log', '-1', '--format=%s', 'main');
  assert.match(msg, /^📝 docs\(auto\): nueva/);
  assert.ok(msg.endsWith(SKIP_CI), 'every automatic commit must keep CI and deploys out of it');
  assert.equal(git(remote, 'log', '-1', '--format=%an', 'main'), 'Eric', 'the author is the person, not a bot');
});

test('ks02 · only knowledge is committed: code, the profile and what you staged by hand stay out', () => {
  const { remote, eric } = team();
  write(eric, 'src/app.js', 'staged by hand\n');
  git(eric, 'add', 'src/app.js');
  write(eric, '02-DOCS/wiki/harness/user-profile.md', 'technical_level: L4\n');
  write(eric, '01-TOOLS/X/run.py', 'print()\n');
  turn(eric);
  assert.ok(remoteFiles(remote).includes('01-TOOLS/X/run.py'));
  assert.equal(remoteShow(remote, 'src/app.js'), 'code');
  assert.equal(remoteShow(remote, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: L2');
  const status = git(eric, 'status', '--porcelain');
  assert.match(status, /^M {2}src\/app\.js$/m, 'what you staged is still staged, and still yours');
  assert.match(status, /user-profile\.md/);
});

test('ks03 · your unpushed code never goes up with it', () => {
  const { remote, eric } = team();
  write(eric, 'src/app.js', 'unreviewed\n');
  git(eric, 'commit', '-q', '-am', 'wip: not ready');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.ok(remoteFiles(remote).includes('02-DOCS/wiki/nueva.md'));
  assert.equal(remoteShow(remote, 'src/app.js'), 'code', 'the wip commit leaked to the remote');
  assert.equal(git(remote, 'log', '--format=%s', 'main').includes('wip: not ready'), false);
});

test('ks04 · from a feature branch, the change reaches main and the branch keeps its own commit', () => {
  const { remote, eric } = team();
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'feature code\n');
  git(eric, 'commit', '-q', '-am', 'feat: x');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(remoteShow(remote, '02-DOCS/wiki/nueva.md'), 'hola');
  assert.equal(remoteShow(remote, 'src/app.js'), 'code', 'feature code reached main');
  assert.equal(git(eric, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/x');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\)/);
  assert.equal(git(eric, 'status', '--porcelain'), '', 'the branch is left clean, so ship-guard has nothing to object to');
});

test('ks05 · a deletion goes up too', () => {
  const { remote, eric } = team();
  unlinkSync(join(eric, '01-TOOLS/README.md'));
  turn(eric);
  assert.equal(remoteFiles(remote).includes('01-TOOLS/README.md'), false);
});

test('ks06 · somebody else pushed first: replayed on top, both survive', () => {
  const { remote, eric, ana } = team();
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  write(eric, '02-DOCS/wiki/de-eric.md', 'eric\n');
  turn(eric);
  const files = remoteFiles(remote);
  assert.ok(files.includes('02-DOCS/wiki/de-ana.md') && files.includes('02-DOCS/wiki/de-eric.md'));
});

test('ks07 · the same line changed on both sides: nothing is forced, and it is said', () => {
  const { remote, eric, ana } = team();
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA\ntres\n');
  turn(ana);
  write(eric, '02-DOCS/wiki/index.md', 'uno\nERIC\ntres\n');
  turn(eric);
  assert.equal(remoteShow(remote, '02-DOCS/wiki/index.md'), 'uno\nANA\ntres');
  assert.equal(read(eric, '02-DOCS/wiki/index.md'), 'uno\nERIC\ntres\n');
  assert.ok(state(eric).notices.some((n) => n.includes('choca')), JSON.stringify(state(eric).notices));
  assert.equal(existsSync(join(eric, '.rsc', 'knowledge-sync.index')), false, 'the throwaway index was left behind');
});

test('ks08 · offline: committed locally, nothing said, pushed on a later turn', () => {
  const { tmp, remote, eric } = team();
  const real = git(eric, 'remote', 'get-url', 'origin');
  git(eric, 'remote', 'set-url', 'origin', join(tmp, 'nowhere.git'));
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.deepEqual(state(eric).notices, []);
  assert.equal(state(eric).queue.length, 1);
  git(eric, 'remote', 'set-url', 'origin', real);
  work(eric, 'fetch');
  assert.ok(remoteFiles(remote).includes('02-DOCS/wiki/nueva.md'));
  assert.equal(state(eric).queue.length, 0);
});

// ------------------------------------------------------------------ down

test('ks10 · somebody else\'s knowledge arrives, by fast-forward on the default branch', () => {
  const { eric, ana } = team();
  quiet(eric);
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  const said = message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n');
  assert.match(said, /📥 .*Ana.*de-ana\.md/);
  assert.equal(git(eric, 'rev-parse', 'HEAD'), git(ana, 'rev-parse', 'HEAD'), 'a fast-forward, not a new commit');
});

test('ks11 · on a feature branch it arrives too, as one sync commit, and your work is untouched', () => {
  const { eric, ana } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'half done\n');
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n');
  assert.equal(read(eric, 'src/app.js'), 'half done\n');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📥 docs\(auto\): sync desde main/);
});

test('ks12 · what is not knowledge is said, not pulled — and said once', () => {
  const { eric, ana } = team();
  quiet(eric);
  write(ana, '.claude/settings.json', '{"hooks":{}}\n');
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  git(ana, 'add', '-A');
  git(ana, 'commit', '-q', '-m', 'hooks + doc');
  git(ana, 'push', '-q', 'origin', 'main');
  const said = message(eric);
  assert.equal(existsSync(join(eric, '.claude/settings.json')), false, 'code that would run here was pulled in');
  assert.match(said, /No los traigo solo/);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n', 'the knowledge part still arrives');
  assert.doesNotMatch(message(eric), /No los traigo solo/, 'nagged twice about the same push');
});

test('ks13 · the profile of somebody else never lands on your machine', () => {
  const { eric, ana } = team();
  quiet(eric);
  write(ana, '02-DOCS/wiki/harness/user-profile.md', 'technical_level: L5\n');
  git(ana, 'commit', '-q', '-am', 'my dials');
  git(ana, 'push', '-q', 'origin', 'main');
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: L2\n');
});

test('ks14 · a file you are editing is not overwritten: yours stays, and it is said', () => {
  const { eric, ana } = team();
  quiet(eric);
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA\ntres\n');
  turn(ana);
  write(eric, '02-DOCS/wiki/index.md', 'uno\nERIC\ntres\n');
  const said = message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/index.md'), 'uno\nERIC\ntres\n');
  assert.match(said, /también has tocado/);
});

test('ks15 · your own pushes do not come back as somebody else\'s', () => {
  const { eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(message(eric), '', 'announced its own push as incoming');
});

// ------------------------------------------------------------------ on by default, off on request

test('ks20 · on by default, and the first message says so — once', () => {
  const { eric } = team();
  assert.equal(inactiveReason(eric), null);
  const first = onRequest(eric, { spawnFetch: false });
  assert.match(first, /rsc knowledge-sync off/);
  assert.doesNotMatch(onRequest(eric, { spawnFetch: false }), /knowledge-sync off/);
});

test('ks21 · .no-knowledge-sync turns it off completely', () => {
  const { remote, eric } = team();
  mkdirSync(join(eric, '.rsc'), { recursive: true });
  writeFileSync(join(eric, '.rsc', OPT_OUT), '');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(onRequest(eric, { spawnFetch: false }), '');
  assert.equal(remoteFiles(remote).includes('02-DOCS/wiki/nueva.md'), false);
  assert.equal(git(eric, 'log', '-1', '--format=%s'), 'seed');
  assert.equal(knowledgeStatus(eric).reason, 'opted-out');
});

test('ks22 · it stays quiet where it has no business: no origin, no harness, no knowledge folders', () => {
  const { tmp, eric } = team();
  git(eric, 'remote', 'remove', 'origin');
  assert.equal(inactiveReason(eric), 'no-origin');
  const bare = join(tmp, 'plain');
  mkdirSync(bare);
  git(bare, 'init', '-q');
  assert.equal(inactiveReason(bare), 'no-harness');
  writeFileSync(join(bare, '.rsc.json'), '{}');
  git(bare, 'remote', 'add', 'origin', join(tmp, 'remote.git'));
  assert.equal(inactiveReason(bare), 'no-knowledge-folders');
  assert.equal(onRequest(bare, { spawnFetch: false }), '');
});

test('ks23 · a rebase in progress belongs to a person: nothing is committed or applied', () => {
  const { eric } = team();
  quiet(eric);
  const gitdir = git(eric, 'rev-parse', '--absolute-git-dir');
  mkdirSync(join(gitdir, 'rebase-merge'));
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  onTurn(eric, { spawnShip: false });
  assert.equal(git(eric, 'log', '-1', '--format=%s'), 'seed');
  rmSync(join(gitdir, 'rebase-merge'), { recursive: true });
});

test('ks24 · the paths are exactly the knowledge folders', () => {
  assert.deepEqual([...KNOWLEDGE], ['01-TOOLS/', '02-DOCS/wiki/', '02-DOCS/attachments/']);
});

// ------------------------------------------------------------------ wired into the lifecycle

test('ks30 · the hook: a message says it to the person, the end of a turn commits', () => {
  const { remote, eric } = team();
  const out = hook('claude', 'request', { session_id: 's1', cwd: eric });
  assert.match(out.systemMessage || '', /rsc knowledge-sync off/, JSON.stringify(out));
  assert.equal(out.hookSpecificOutput, undefined, 'a notice for the person must not go into the model context');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  hook('claude', 'turn', { session_id: 's1', cwd: eric });
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\)/, 'the Stop event did not commit');
  work(eric, 'ship');
  assert.ok(remoteFiles(remote).includes('02-DOCS/wiki/nueva.md'));
  assert.deepEqual(Object.keys(hook('cursor', 'request', { cwd: eric })), [], 'nothing new: nothing said');
});

test('ks31 · a Stop that a Stop hook caused does not commit again; a cloud agent does nothing', () => {
  const { eric } = team();
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  hook('claude', 'turn', { session_id: 's1', cwd: eric, stop_hook_active: true });
  assert.equal(git(eric, 'log', '-1', '--format=%s'), 'seed');
  process.env.RSC_REMOTE_AGENT = '1';
  try { hook('claude', 'turn', { cwd: eric }); } finally { delete process.env.RSC_REMOTE_AGENT; }
  assert.equal(git(eric, 'log', '-1', '--format=%s'), 'seed');
});

test('ks32 · the hook runs as a process, the way an assistant calls it', () => {
  const { eric } = team();
  const script = join(import.meta.dirname, '..', 'targets', 'knowledge-sync.mjs');
  const out = execFileSync(process.execPath, [script, 'hook', 'claude', 'request'],
    { cwd: eric, input: JSON.stringify({ cwd: eric }), encoding: 'utf8', env: { ...process.env, RSC_KNOWLEDGE_SYNC_FOREGROUND: '1' } });
  assert.match(JSON.parse(out).systemMessage, /knowledge-sync off/);
});

// ------------------------------------------------------------------ installed, and switched by the CLI

test('ks40 · an install puts the module next to the adapter, and the CLI switches it per project', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const { readManifest } = await import('../scripts/lib/manifest-file.js');
  const { eric } = team();
  await applyInstall({ skillIds: ['orient'], target: 'claude', home: eric, cwd: eric });
  assert.ok(existsSync(join(eric, '.rsc', 'knowledge-sync.mjs')), 'the adapter imports it: missing, the memory breaks too');
  assert.equal(inactiveReason(eric), null, 'on by default after an install');

  const cli = (...args) => execFileSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'rsc.js'), ...args],
    { cwd: eric, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  cli('knowledge-sync', 'off');
  assert.ok(existsSync(join(eric, '.rsc', OPT_OUT)));
  assert.deepEqual(readManifest(eric).optOuts, ['knowledge-sync'], 'a project decision travels in .rsc.json');
  assert.equal(JSON.parse(cli('knowledge-sync', 'status')).reason, 'opted-out');
  cli('knowledge-sync', 'on');
  assert.equal(existsSync(join(eric, '.rsc', OPT_OUT)), false);
  assert.deepEqual(readManifest(eric).optOuts, []);
  assert.equal(JSON.parse(cli('knowledge-sync', 'status')).active, true);
});

test('ks41 · wired apart from the memory: its own entries, removable without touching the memory', async () => {
  const { wireKnowledge, unwireKnowledge } = await import('../targets/knowledge-wiring.js');
  const { wireMemory } = await import('../targets/memory.js');
  const { eric } = team();
  wireMemory('claude', eric);
  wireKnowledge('claude', eric);
  const commands = () => Object.values(JSON.parse(read(eric, '.claude/settings.local.json')).hooks || {})
    .flat().flatMap((e) => e.hooks.map((h) => h.command.replaceAll('"', '')));
  const count = (needle) => commands().filter((c) => c.includes(needle)).length;
  assert.equal(count('knowledge-sync.mjs hook claude request'), 1);
  assert.equal(count('knowledge-sync.mjs hook claude turn'), 1);
  assert.ok(count('session-memory-adapter.mjs') > 0);
  wireMemory('claude', eric); // the memory rewiring itself keeps what is not its own
  assert.equal(count('knowledge-sync.mjs hook claude turn'), 1);
  wireKnowledge('claude', eric); // idempotent
  assert.equal(count('knowledge-sync.mjs hook claude turn'), 1);
  unwireKnowledge('claude', eric);
  assert.equal(count('knowledge-sync'), 0);
  assert.ok(count('session-memory-adapter.mjs') > 0, 'removing sync took the memory with it');
});

test('ks42 · every assistant gets it, and the memory stays free of network code', async () => {
  const { wireKnowledge, KNOWLEDGE_TARGETS } = await import('../targets/knowledge-wiring.js');
  for (const target of KNOWLEDGE_TARGETS) {
    const { eric } = team();
    const result = wireKnowledge(target, eric);
    assert.equal(result.mode, 'wired', target);
    for (const path of result.paths) {
      assert.ok(existsSync(path), `${target}: ${path}`);
      assert.equal(git(eric, 'check-ignore', path.slice(eric.length + 1)), path.slice(eric.length + 1), `${target}: ignored`);
    }
  }
  const source = readFileSync(join(import.meta.dirname, '..', 'targets', 'knowledge-sync.mjs'), 'utf8');
  assert.doesNotMatch(source, /node:(?:http|https|net|tls)|https?:\/\//u, 'it talks to origin through git, and nothing else');
});
