import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  KNOWLEDGE, OPT_OUT, SKIP_CI, hook, inactiveReason, knowledgeStatus, onRequest, onTurn, work, workerRuntime,
} from '../targets/knowledge-sync.mjs';

process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND = '1';

// Knowledge sync is on by default, so these tests are mostly about what it must NOT do: touch the
// default branch, push code, push the profile, push somebody's unpushed work, overwrite a file you are
// editing, pull in code. Everything runs against a real `--bare` remote and two clones — "Eric" and
// "Ana" — and the remote's default branch is PROTECTED the way GitHub protects it: a pre-receive hook
// rejects every push to `main`. Knowledge travels through `rsc/knowledge` (team-safe-default D).

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function write(repo, rel, body) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), body);
}
const read = (repo, rel) => readFileSync(join(repo, rel), 'utf8');

function team({ protectedMain = true } = {}) {
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
  if (protectedMain) {
    const hook = join(remote, 'hooks', 'pre-receive');
    writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do [ "$ref" = "refs/heads/main" ] && { echo "main is protected" >&2; exit 1; }; done\nexit 0\n');
    chmodSync(hook, 0o755);
  }
  const clone = (name, who) => {
    const dir = join(tmp, name);
    git(tmp, 'clone', '-q', remote, dir);
    ident(dir, who);
    return dir;
  };
  return { tmp, remote, seedTip: git(remote, 'rev-parse', 'main'), eric: clone('eric', 'Eric'), ana: clone('ana', 'Ana'), clone };
}

function ident(repo, who) {
  git(repo, 'config', 'user.name', who);
  git(repo, 'config', 'user.email', `${who.toLowerCase()}@x`);
}

/** Make the project look complex (CI): the default branch closes for the agent (trunk-policy). */
function makeComplex(repo) {
  write(repo, '.github/workflows/ci.yml', 'on: push\n');
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

const K = 'rsc/knowledge';
const kFiles = (remote) => git(remote, 'ls-tree', '-r', '--name-only', K).split('\n');
const kShow = (remote, rel) => git(remote, 'show', `${K}:${rel}`);
const state = (repo) => JSON.parse(read(repo, '.rsc/knowledge-sync.json'));
const quiet = (repo) => { onRequest(repo, { spawnFetch: false }); }; // consume the one-time announcement

// ------------------------------------------------------------------ up

test('ks01 · a knowledge change goes to rsc/knowledge, and the protected main is never touched', () => {
  const { remote, eric, seedTip } = team();
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/nueva.md'), 'hola');
  assert.equal(git(remote, 'rev-parse', 'main'), seedTip, 'the default branch moved');
  const msg = git(remote, 'log', '-1', '--format=%s', K);
  assert.match(msg, /^📝 docs\(auto\): 02-DOCS\/wiki\/nueva\.md/);
  assert.ok(msg.endsWith(SKIP_CI), 'every automatic commit must keep CI and deploys out of it');
  assert.equal(git(remote, 'log', '-1', '--format=%an', K), 'Eric', 'the author is the person, not a bot');
  assert.deepEqual(state(eric).notices, [], 'a protected main must not produce a push error');
});

test('ks02 · only knowledge goes up: code, the profile and what you staged by hand stay out', () => {
  const { remote, eric } = team();
  write(eric, 'src/app.js', 'staged by hand\n');
  git(eric, 'add', 'src/app.js');
  write(eric, '02-DOCS/wiki/harness/user-profile.md', 'technical_level: L4\n');
  write(eric, '01-TOOLS/X/run.py', 'print()\n');
  turn(eric);
  assert.ok(kFiles(remote).includes('01-TOOLS/X/run.py'));
  assert.equal(kShow(remote, 'src/app.js'), 'code');
  assert.equal(kShow(remote, '02-DOCS/wiki/harness/user-profile.md'), 'technical_level: L2');
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
  assert.ok(kFiles(remote).includes('02-DOCS/wiki/nueva.md'));
  assert.equal(kShow(remote, 'src/app.js'), 'code', 'the wip commit leaked to the remote');
  assert.equal(git(remote, 'log', '--format=%s', K).includes('wip: not ready'), false);
});

test('ks04 · from a feature branch: up to rsc/knowledge without the branch, and the branch keeps it', () => {
  const { remote, eric, seedTip } = team();
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'feature code\n');
  git(eric, 'commit', '-q', '-am', 'feat: x');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/nueva.md'), 'hola');
  assert.equal(kShow(remote, 'src/app.js'), 'code', 'feature code reached the exchange branch');
  assert.equal(git(remote, 'rev-parse', 'main'), seedTip);
  assert.equal(git(eric, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feat/x');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\)/);
  assert.equal(git(eric, 'status', '--porcelain'), '', 'the branch is left clean');
});

test('ks05 · a deletion goes up too', () => {
  const { remote, eric } = team();
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  unlinkSync(join(eric, '02-DOCS/wiki/nueva.md'));
  turn(eric);
  assert.equal(kFiles(remote).includes('02-DOCS/wiki/nueva.md'), false);
});

test('ks06 · somebody else pushed first: replayed on top, both survive', () => {
  const { remote, eric, ana } = team();
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  write(eric, '02-DOCS/wiki/de-eric.md', 'eric\n');
  turn(eric);
  const files = kFiles(remote);
  assert.ok(files.includes('02-DOCS/wiki/de-ana.md') && files.includes('02-DOCS/wiki/de-eric.md'));
});

test('ks07 · the same line changed on both sides: nothing is forced, and it is said', () => {
  const { remote, eric, ana } = team();
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA\ntres\n');
  turn(ana);
  write(eric, '02-DOCS/wiki/index.md', 'uno\nERIC\ntres\n');
  turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/index.md'), 'uno\nANA\ntres');
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
  assert.ok(kFiles(remote).includes('02-DOCS/wiki/nueva.md'));
  assert.equal(state(eric).queue.length, 0);
});

test('ks09 · main closed for the agent (complex project, on main): nothing committed there, it still goes up', () => {
  const { remote, eric } = team();
  makeComplex(eric);
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'ci'); // a person's own commit, before
  const head = git(eric, 'rev-parse', 'HEAD');
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  turn(eric);
  assert.equal(git(eric, 'rev-parse', 'HEAD'), head, 'sync committed on a closed default branch');
  assert.match(git(eric, 'status', '--porcelain'), /nueva\.md/, 'the change stays in the files');
  assert.equal(kShow(remote, '02-DOCS/wiki/nueva.md'), 'hola');
  turn(eric); // still modified: going up again is a no-op, not an error
  assert.deepEqual(state(eric).notices, []);
});

// ------------------------------------------------------------------ down

test('ks10 · somebody else\'s knowledge arrives on the default branch of a simple project, as a sync commit', () => {
  const { remote, eric, ana } = team();
  quiet(eric);
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  const said = message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n');
  assert.match(said, /📥 .*Ana.*de-ana\.md/);
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📥 docs\(auto\): sync desde rsc\/knowledge/);
  assert.notEqual(git(eric, 'rev-parse', 'HEAD'), git(remote, 'rev-parse', K), 'never a fast-forward onto the exchange branch');
});

test('ks11 · on a feature branch it arrives too, and your work is untouched', () => {
  const { eric, ana } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'half done\n');
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n');
  assert.equal(read(eric, 'src/app.js'), 'half done\n');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📥 docs\(auto\)/);
});

test('ks12 · code on the exchange branch never comes down through it', () => {
  const { eric, ana } = team();
  quiet(eric);
  git(ana, 'switch', '-q', '-c', K);
  write(ana, '.claude/settings.json', '{"hooks":{}}\n');
  write(ana, 'src/app.js', 'from the exchange branch\n');
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  git(ana, 'add', '-A');
  git(ana, 'commit', '-q', '-m', 'misuse: code on the exchange branch');
  git(ana, 'push', '-q', 'origin', K);
  message(eric);
  assert.equal(existsSync(join(eric, '.claude/settings.json')), false, 'code that would run here was pulled in');
  assert.equal(read(eric, 'src/app.js'), 'code\n');
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n', 'the knowledge part still arrives');
});

test('ks13 · the profile of somebody else never lands on your machine', () => {
  const { eric, ana } = team();
  quiet(eric);
  git(ana, 'switch', '-q', '-c', K);
  write(ana, '02-DOCS/wiki/harness/user-profile.md', 'technical_level: L5\n');
  git(ana, 'commit', '-q', '-am', 'my dials');
  git(ana, 'push', '-q', 'origin', K);
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

test('ks16 · on a closed default branch, what arrives is not written there; the next branch gets it committed', () => {
  const { eric, ana } = team();
  makeComplex(eric);
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'ci');
  quiet(eric);
  const head = git(eric, 'rev-parse', 'HEAD');
  write(ana, '02-DOCS/wiki/de-ana.md', 'ana\n');
  turn(ana);
  const said = String(message(eric));
  // Team sim 2026-10-07 (D1): written uncommitted, it blocked the next `git pull` of main.
  assert.equal(existsSync(join(eric, '02-DOCS/wiki/de-ana.md')), false, 'written into a closed default branch');
  assert.equal(git(eric, 'status', '--porcelain', '--', '02-DOCS'), '', 'nothing left uncommitted on main');
  assert.equal(git(eric, 'rev-parse', 'HEAD'), head, 'a commit landed on the closed default branch');
  assert.match(said, /Ana.*de-ana\.md/, 'it is still said what is waiting');
  assert.equal(String(message(eric)), '', 'said once, not every message');
  git(eric, 'switch', '-q', '-c', 'feat/e');
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/de-ana.md'), 'ana\n');
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📥 docs\(auto\)/);
});

test('ks17 · a newcomer clones the default branch and has the team\'s knowledge after the first message', () => {
  const { eric, clone } = team();
  write(eric, '02-DOCS/wiki/nueva.md', 'lo que sabe el equipo\n');
  turn(eric);
  const nuevo = clone('nuevo', 'Nuevo');
  assert.equal(existsSync(join(nuevo, '02-DOCS/wiki/nueva.md')), false, 'fixture: main does not have it yet');
  message(nuevo);
  assert.equal(read(nuevo, '02-DOCS/wiki/nueva.md'), 'lo que sabe el equipo\n');
});

test('ks18 · two working branches carrying the same knowledge merge into main without a conflict', () => {
  const { eric, ana, clone } = team();
  git(eric, 'switch', '-q', '-c', 'feat/a');
  git(ana, 'switch', '-q', '-c', 'feat/b');
  quiet(ana);
  write(eric, '02-DOCS/wiki/nueva.md', 'compartido\n');
  turn(eric);
  message(ana);
  for (const [repo, b] of [[eric, 'feat/a'], [ana, 'feat/b']]) git(repo, 'push', '-q', 'origin', b);
  const lead = clone('lead', 'Lead');
  git(lead, 'fetch', '-q', 'origin', 'feat/a', 'feat/b');
  git(lead, 'merge', '-q', '--no-edit', 'origin/feat/a');
  git(lead, 'merge', '-q', '--no-edit', 'origin/feat/b'); // throws on conflict
  assert.equal(read(lead, '02-DOCS/wiki/nueva.md'), 'compartido\n');
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
  assert.throws(() => kFiles(remote), 'the exchange branch was created while opted out');
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
  // Since 3.0.8 the model gets the same text (ks57): a notice only the person saw was news the agent
  // could not explain a turn later.
  assert.ok(out.hookSpecificOutput.additionalContext.includes(out.systemMessage));
  write(eric, '02-DOCS/wiki/nueva.md', 'hola\n');
  hook('claude', 'turn', { session_id: 's1', cwd: eric });
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\)/, 'the Stop event did not commit');
  work(eric, 'ship');
  assert.ok(kFiles(remote).includes('02-DOCS/wiki/nueva.md'));
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

test('ks43 · the background worker runs on node even when the host is not node (OpenCode is Bun)', () => {
  assert.equal(workerRuntime('/opt/homebrew/lib/node_modules/opencode-ai/bin/opencode.exe', { bun: '1.3.14', node: '24.3.0' }), 'node');
  assert.equal(workerRuntime('/usr/local/bin/bun', { bun: '1.3.14' }), 'node');
  assert.equal(workerRuntime('/usr/local/bin/node', { node: '22.0.0' }), '/usr/local/bin/node');
  assert.equal(workerRuntime('C:\\Program Files\\nodejs\\node.exe', { node: '22.0.0' }), 'C:\\Program Files\\nodejs\\node.exe');
});

// ------------------------------------------------------------------ review findings (2026-10-04)

test('ks44 · closed main: a second edit of the same file, and a new file later, both go up (review H1)', () => {
  const { remote, eric } = team();
  makeComplex(eric); git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'ci');
  quiet(eric);
  write(eric, '02-DOCS/wiki/index.md', 'uno\nV1\ntres\n'); turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/index.md'), 'uno\nV1\ntres');
  write(eric, '02-DOCS/wiki/index.md', 'uno\nV2\ntres\n'); turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/index.md'), 'uno\nV2\ntres');
  write(eric, '02-DOCS/wiki/b.md', 'b\n'); turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/b.md'), 'b');
  assert.deepEqual(state(eric).notices.filter((n) => /choca/.test(n)), []);
  assert.equal(git(eric, 'log', '-1', '--format=%s'), 'ci', 'still nothing committed on the closed main');
});

test('ks45 · closed main: a teammate changing the same file twice is never a false clash, and reaches the next branch (review H2)', () => {
  const { eric, ana } = team();
  makeComplex(eric); git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'ci');
  quiet(eric); quiet(ana);
  git(ana, 'switch', '-q', '-c', 'feat/a');
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA1\ntres\n'); turn(ana);
  assert.match(String(message(eric)), /Ana/);
  assert.equal(read(eric, '02-DOCS/wiki/index.md'), 'uno\ndos\ntres\n', 'a closed main is left as the remote has it');
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA2\ntres\n'); turn(ana);
  assert.doesNotMatch(String(message(eric)), /también has tocado/);
  git(eric, 'switch', '-q', '-c', 'feat/e');
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/index.md'), 'uno\nANA2\ntres\n');
});

test('ks46 · closed main the remote has not seen yet: still nothing committed there (review H4)', () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ks-')));
  const remote = join(tmp, 'remote.git'); git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const repo = join(tmp, 'repo'); git(tmp, 'init', '-q', '-b', 'main', repo); ident(repo, 'Eric');
  write(repo, '.gitignore', '.rsc/\n'); write(repo, '.rsc.json', '{}'); write(repo, 'Dockerfile', 'FROM x\n');
  write(repo, '02-DOCS/wiki/index.md', 'a\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', remote);
  const head = git(repo, 'rev-parse', 'HEAD');
  write(repo, '02-DOCS/wiki/index.md', 'b\n');
  onTurn(repo, { spawnShip: false });
  assert.equal(git(repo, 'rev-parse', 'HEAD'), head);
});

test('ks47 · a merge in progress inside .worktrees/ is seen, and its conflict is left alone (review H5)', () => {
  const { eric } = team();
  const wt = join(eric, '.worktrees', 'x');
  git(eric, 'worktree', 'add', '-q', wt, '-b', 'feat/x');
  git(wt, 'switch', '-q', '-c', 'other');
  write(wt, '02-DOCS/wiki/index.md', 'uno\nOTHER\ntres\n'); git(wt, 'commit', '-qam', 'o');
  git(wt, 'switch', '-q', 'feat/x');
  write(wt, '02-DOCS/wiki/index.md', 'uno\nMINE\ntres\n'); git(wt, 'commit', '-qam', 'm');
  try { git(wt, 'merge', 'other'); } catch { /* the conflict is the point */ }
  assert.equal(git(wt, 'status', '--porcelain', '--', '02-DOCS'), 'UU 02-DOCS/wiki/index.md');
  onTurn(wt, { spawnShip: false });
  assert.equal(git(wt, 'status', '--porcelain', '--', '02-DOCS'), 'UU 02-DOCS/wiki/index.md');
});

test('ks48 · closed main without the snapshot chain (an upgrade): our own last upload is replaced, a teammate\'s never', () => {
  const { remote, eric, ana } = team();
  makeComplex(eric); git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'ci');
  quiet(eric); quiet(ana);
  write(eric, '02-DOCS/wiki/nueva.md', 'v1\n'); turn(eric);
  const drop = () => { const s = state(eric); delete s.snap; writeFileSync(join(eric, '.rsc', 'knowledge-sync.json'), JSON.stringify(s)); };
  drop();
  write(eric, '02-DOCS/wiki/nueva.md', 'v2\n'); turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/nueva.md'), 'v2', 'E2E 2026-10-04: the second edit after an upgrade stayed behind');
  // Ana changes it on rsc/knowledge; Eric, without having taken it, edits again: that is a real clash.
  git(ana, 'switch', '-q', '-c', 'feat/a');
  message(ana);
  write(ana, '02-DOCS/wiki/nueva.md', 'ana\n'); turn(ana);
  drop();
  write(eric, '02-DOCS/wiki/nueva.md', 'v3\n'); turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/nueva.md'), 'ana', 'a teammate\'s change was overwritten');
  assert.match(state(eric).notices.join(' '), /choca/);
});

// ------------------------------------------------------------------ committed knowledge (E2E 2026-10-04)

test('ks49 · knowledge the agent committed with its code goes up as its knowledge part only, with [skip ci]', () => {
  const { remote, eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, '02-DOCS/wiki/ftd/x.md', '# x\n');
  write(eric, 'src/app.js', 'code v2\n');
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', '✨ feat: x');
  turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/ftd/x.md'), '# x');
  assert.equal(kShow(remote, 'src/app.js'), 'code', 'code travelled through rsc/knowledge');
  const msg = git(remote, 'log', '-1', '--format=%B', K);
  assert.match(msg, /^📝 docs\(auto\): 02-DOCS\/wiki\/ftd\/x\.md \[skip ci\]/);
  assert.match(msg, /Desde: ✨ feat: x/);
  assert.equal(git(remote, 'log', '-1', '--format=%an', K), 'Eric');
  assert.equal(git(remote, 'rev-parse', 'refs/heads/main'), git(eric, 'rev-parse', 'origin/main'), 'main untouched');
});

test('ks50 · committed knowledge goes up once; the next commit with docs goes up on its own turn', () => {
  const { remote, eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, '02-DOCS/wiki/ftd/x.md', '# x\n'); git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', '📝 docs: x');
  turn(eric);
  const first = git(remote, 'rev-parse', K);
  turn(eric);
  assert.equal(git(remote, 'rev-parse', K), first, 'a turn with nothing new pushed again');
  write(eric, '02-DOCS/wiki/ftd/x.md', '# x\n\n- [x] done\n'); git(eric, 'commit', '-qam', '✅ test: x');
  turn(eric);
  assert.equal(kShow(remote, '02-DOCS/wiki/ftd/x.md'), '# x\n\n- [x] done');
});

test('ks51 · a commit with only code sends nothing', () => {
  const { remote, eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'code v2\n'); git(eric, 'commit', '-qam', '✨ feat: x');
  turn(eric);
  assert.equal(git(remote, 'branch', '--list', K), '', 'rsc/knowledge was created for a code-only commit');
});

// ------------------------------------------------------------------ per branch (2026-10-06)

test('ks52 · docs you wrote on one branch reach a branch you open later', () => {
  const { eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/a');
  write(eric, '02-DOCS/wiki/ftd/a.md', '# a\n');
  turn(eric);
  git(eric, 'switch', '-q', 'main');
  git(eric, 'switch', '-q', '-c', 'feat/b');
  const said = String(message(eric));
  assert.equal(read(eric, '02-DOCS/wiki/ftd/a.md'), '# a\n');
  assert.match(said, /📥 .*ti, desde otra rama/);
});

test('ks53 · a teammate\'s docs, already brought into one branch, also reach a branch opened afterwards (the reported gap)', () => {
  const { eric, ana } = team();
  quiet(eric); quiet(ana);
  git(eric, 'switch', '-q', '-c', 'feat/a');
  message(eric);
  write(ana, '02-DOCS/wiki/api.md', 'v1\n'); turn(ana);
  assert.match(String(message(eric)), /📥 .*Ana/);
  git(eric, 'switch', '-q', 'main');
  git(eric, 'switch', '-q', '-c', 'feat/c');
  assert.ok(!existsSync(join(eric, '02-DOCS/wiki/api.md')), 'precondition: the new branch starts without it');
  message(eric);
  assert.equal(read(eric, '02-DOCS/wiki/api.md'), 'v1\n');
});

test('ks54 · editing your own uploaded doc again on the same branch is not a clash', () => {
  const { eric } = team();
  quiet(eric);
  git(eric, 'switch', '-q', '-c', 'feat/a');
  write(eric, '02-DOCS/wiki/ftd/a.md', '# a\n');
  turn(eric);
  write(eric, '02-DOCS/wiki/ftd/a.md', '# a\n\n- [x] más\n');
  const said = String(message(eric));
  assert.doesNotMatch(said, /también has tocado/);
  assert.equal(read(eric, '02-DOCS/wiki/ftd/a.md'), '# a\n\n- [x] más\n');
});

// E2E 2026-10-07: the local docs(auto) commit carried [skip ci] onto the working branch, where it is
// often the newest commit, so the next ordinary push of main would skip CI. And the first turn of a
// fresh install sent rsc's own 01-TOOLS/_TEMPLATE up as if a teammate had written it.
test('ks55 · the commit on your branch never carries [skip ci]; the copy on rsc/knowledge does', () => {
  const { remote, eric } = team({ protectedMain: false });
  write(eric, '02-DOCS/wiki/nota.md', 'n\n');
  turn(eric);
  const local = git(eric, 'log', '-1', '--format=%s');
  assert.match(local, /^📝 docs\(auto\): 02-DOCS\/wiki\/nota\.md$/, 'the working branch commit');
  assert.ok(!local.includes(SKIP_CI));
  assert.ok(git(remote, 'log', '-1', '--format=%s', K).endsWith(SKIP_CI), 'the exchange copy keeps CI out');
});

test('ks56 · rsc\'s own template does not travel; a real tool next to it does', () => {
  const { remote, eric } = team({ protectedMain: false });
  write(eric, '01-TOOLS/_TEMPLATE/CREDENTIALS.md', '# plantilla\n');
  write(eric, '01-TOOLS/stripe/README.md', '# stripe\n');
  turn(eric);
  const up = kFiles(remote);
  assert.ok(up.includes('01-TOOLS/stripe/README.md'));
  assert.ok(!up.some((f) => f.startsWith('01-TOOLS/_TEMPLATE/')), up.join(','));
  assert.ok(!git(eric, 'show', '--name-only', '--format=', 'HEAD').includes('_TEMPLATE'), 'and it is not committed for you either');
});

// Field test 3.0.4: «📥 te llegó un cambio» reached the person in one turn, and a turn later the agent
// could not say what had changed — the notice had never been in its context.
test('ks57 · what the person is told about knowledge, the model is told too', () => {
  const { eric } = team({ protectedMain: false });
  const out = hook('claude', 'request', { cwd: eric });
  assert.ok(out.systemMessage, 'the first request announces sync');
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.ok(out.hookSpecificOutput.additionalContext.includes(out.systemMessage));
  const dsh = hook('deepseek', 'request', { cwd: eric });
  assert.equal(dsh.systemMessage, undefined, 'one copy for DeepSeek Harness');
});

// E2E defect 11: "📝 docs(auto): .env, .gitignore, CREDENTIALS y 4 más" for EIGHT files — the count
// was of distinct basenames (two `.gitignore` became one) and the names could not tell
// `01-TOOLS/.gitignore` from `01-TOOLS/_TEMPLATE/.gitignore`.
test('commitSummary counts files, not basenames, and names each one unambiguously', async () => {
  const { commitSummary } = await import('../targets/knowledge-sync.mjs');
  const files = [
    '01-TOOLS/.gitignore', '01-TOOLS/_TEMPLATE/.env.example', '01-TOOLS/_TEMPLATE/.gitignore',
    '01-TOOLS/_TEMPLATE/CREDENTIALS.md', '01-TOOLS/_TEMPLATE/README.md', '01-TOOLS/_TEMPLATE/test_connection.sh',
    '02-DOCS/wiki/harness/decisions.md', '02-DOCS/wiki/harness/installation-plan.md',
  ];
  const s = commitSummary(files);
  assert.match(s, /^8 ficheros: /, s);
  const shown = s.replace(/^8 ficheros: /, '').replace(/ y \d+ más$/, '').split(', ');
  for (const name of shown) assert.ok(files.includes(name), `shown name is a full path: ${name}`);
  assert.equal(shown.length + Number(/ y (\d+) más$/.exec(s)?.[1] || 0), 8, s);
  assert.equal(commitSummary(['02-DOCS/wiki/a.md']), '02-DOCS/wiki/a.md');
  assert.equal(commitSummary(['02-DOCS/wiki/a.md', '02-DOCS/wiki/a.md']), '02-DOCS/wiki/a.md', 'duplicates count once');
});

// Field test 3.0.8: the end of a turn committed an FTD update («Fix … probado») on main while the fix
// itself was still uncommitted, so the next push published a document describing code not in history.
test('ks58 · with code still uncommitted, docs go up without a commit of ours on the branch', () => {
  const { remote, eric } = team({ protectedMain: false });
  write(eric, '.rsc/.no-trunk-guard', ''); // main explicitly open: two authors would close it as a team
  const before = git(eric, 'rev-parse', 'HEAD');
  write(eric, 'src/app.js', 'fixed\n');
  write(eric, '02-DOCS/wiki/ftd/fix.md', '# fix\n- [x] probado\n');
  turn(eric);
  assert.equal(git(eric, 'rev-parse', 'HEAD'), before, 'no docs commit ahead of the code');
  assert.equal(kShow(remote, '02-DOCS/wiki/ftd/fix.md'), '# fix\n- [x] probado', 'the teammates still get it');
  assert.match(git(eric, 'status', '--porcelain', '-uall'), /02-DOCS\/wiki\/ftd\/fix\.md/, 'left to be committed with the code');
  git(eric, 'add', '-A'); git(eric, 'commit', '-q', '-m', 'fix');
  write(eric, '02-DOCS/wiki/nota.md', 'n\n');
  turn(eric);
  assert.match(git(eric, 'log', '-1', '--format=%s'), /^📝 docs\(auto\)/, 'with nothing else pending, the usual commit');
});

// ------------------------------------------------------------------ team simulation (2026-10-07)

/** A team whose main is closed for everybody (CI pushed to origin), and pushable by hand (the PR merge). */
function closedTeam() {
  const t = team({ protectedMain: false });
  makeComplex(t.eric);
  git(t.eric, 'add', '-A'); git(t.eric, 'commit', '-q', '-m', 'ci'); git(t.eric, 'push', '-q', 'origin', 'main');
  git(t.ana, 'pull', '-q', '--ff-only');
  return t;
}

/** A pull request merged into main on the remote: what the lead's merge button does. */
function mergePR(t, branch) {
  const lead = existsSync(join(t.tmp, 'lead')) ? join(t.tmp, 'lead') : t.clone('lead', 'Lead');
  git(lead, 'fetch', '-q', 'origin');
  git(lead, 'switch', '-q', 'main'); git(lead, 'merge', '-q', '--ff-only', 'origin/main');
  git(lead, 'merge', '-q', '--no-ff', '--no-edit', `origin/${branch}`);
  git(lead, 'push', '-q', 'origin', 'main');
}

test('ks59 · D1 · a closed main never blocks `git pull`: the same docs arriving by rsc/knowledge and by a merged PR', () => {
  const t = closedTeam();
  const { eric, ana } = t;
  quiet(eric); quiet(ana);
  git(ana, 'switch', '-q', '-c', 'feat/a');
  write(ana, '02-DOCS/wiki/ftd/orden.md', '# orden\n');          // new
  write(ana, '02-DOCS/wiki/index.md', 'uno\nANA\ntres\n');      // tracked on main
  turn(ana);
  message(eric);
  assert.equal(git(eric, 'status', '--porcelain', '-uall', '--', '02-DOCS'), '', 'the closed main was left dirty');
  git(ana, 'push', '-q', 'origin', 'feat/a');
  mergePR(t, 'feat/a');
  git(eric, 'pull', '-q', '--no-rebase'); // throws: "untracked working tree files would be overwritten by merge"
  assert.equal(read(eric, '02-DOCS/wiki/ftd/orden.md'), '# orden\n');
  assert.equal(read(eric, '02-DOCS/wiki/index.md'), 'uno\nANA\ntres\n');
  assert.equal(String(message(eric)), '', 'after the pull nothing is pending and nothing clashes');
});

test('ks60 · D3 · teammates\' commits brought in by merging main are not sent as yours, and no false clash', () => {
  const t = team({ protectedMain: false });
  const { eric, ana } = t;
  quiet(eric); quiet(ana);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  write(eric, 'src/app.js', 'eric\n'); git(eric, 'commit', '-qam', '✨ feat: x');
  turn(eric); // records where the branch was
  git(ana, 'switch', '-q', '-c', 'feat/a');
  write(ana, '02-DOCS/wiki/plan.md', 'v1\n'); git(ana, 'add', '-A'); git(ana, 'commit', '-qm', '📝 docs: plan');
  git(ana, 'push', '-q', 'origin', 'feat/a');
  turn(ana);
  mergePR(t, 'feat/a');
  write(ana, '02-DOCS/wiki/plan.md', 'v2\n'); turn(ana); // rsc/knowledge moves on
  const anas = git(ana, 'log', '--format=%H', '-1', '--', '02-DOCS/wiki/plan.md');
  git(eric, 'fetch', '-q', 'origin');
  git(eric, 'merge', '-q', '--no-edit', 'origin/main');
  const viaMerge = git(eric, 'log', '--format=%H', '--author=Ana', 'HEAD');
  turn(eric);
  const s = state(eric);
  for (const c of viaMerge.split('\n').filter(Boolean)) {
    assert.ok(!s.queue.includes(c) && !s.ours.includes(c), `Ana's commit ${c.slice(0, 7)} was taken as Eric's`);
  }
  assert.ok(anas);
  assert.deepEqual(s.notices.filter((n) => /choca/.test(n)), [], s.notices.join(' | '));
});

test('ks61 · D3 · a clash whose two versions have become the same is not delivered; an open one is', () => {
  const clashing = () => {
    const { eric, ana } = team();
    quiet(eric);
    write(ana, '02-DOCS/wiki/index.md', 'uno\nANA\ntres\n'); write(ana, '02-DOCS/wiki/otro.md', 'ana\n'); turn(ana);
    write(eric, '02-DOCS/wiki/index.md', 'uno\nERIC\ntres\n'); write(eric, '02-DOCS/wiki/otro.md', 'eric\n');
    turn(eric);
    assert.ok(state(eric).notices.some((n) => /choca/.test(n)), 'fixture: a clash was recorded');
    return eric;
  };
  const one = clashing();
  git(one, 'checkout', 'origin/rsc/knowledge', '--', '02-DOCS/wiki/index.md'); // took Ana's for one of them
  const said = onRequest(one, { spawnFetch: false });
  const notice = said.split('\n').find((l) => /choca/.test(l)) || '';
  assert.match(notice, /otro\.md/, 'the open clash is still said');
  assert.doesNotMatch(notice, /index\.md/, 'the resolved file is still named as a clash');
  const both = clashing();
  git(both, 'checkout', 'origin/rsc/knowledge', '--', '02-DOCS/wiki/index.md', '02-DOCS/wiki/otro.md');
  assert.doesNotMatch(onRequest(both, { spawnFetch: false }), /choca/, 'a clash that no longer exists was delivered');
});

test('ks62 · D3b · a doc already on the remote main as it is on rsc/knowledge is not committed into a branch: the merge brings it', () => {
  const t = team({ protectedMain: false });
  const { eric, ana } = t;
  quiet(eric); quiet(ana);
  git(eric, 'switch', '-q', '-c', 'feat/x');
  git(ana, 'switch', '-q', '-c', 'feat/a');
  write(ana, '02-DOCS/wiki/ya.md', 'en main\n'); turn(ana);
  git(ana, 'push', '-q', 'origin', 'feat/a');
  mergePR(t, 'feat/a');
  git(eric, 'fetch', '-q', 'origin');
  message(eric);
  assert.equal(git(eric, 'log', '--format=%s', 'main..HEAD'), '', 'a 📥 commit duplicated what main already has');
  git(eric, 'merge', '-q', '--no-edit', 'origin/main');
  assert.equal(read(eric, '02-DOCS/wiki/ya.md'), 'en main\n');
});

test('ks63 · D4 · a stale fetch is refreshed in the foreground, so a one-message session sees fresh docs', () => {
  const { eric, ana } = team();
  quiet(eric);
  write(ana, '02-DOCS/wiki/fresco.md', 'f\n'); turn(ana);
  assert.equal(onRequest(eric, { spawnFetch: false }), '', 'a recent fetch is trusted: no network on every message');
  const s = state(eric); s.lastFetch = Date.now() - 11 * 60_000; writeFileSync(join(eric, '.rsc', 'knowledge-sync.json'), JSON.stringify(s));
  assert.match(onRequest(eric, { spawnFetch: false }), /fresco\.md/);
  assert.equal(read(eric, '02-DOCS/wiki/fresco.md'), 'f\n');
});

// Second team simulation: «cambios … de Ana: busqueda.md, estadisticas.md» — busqueda.md was Bruno's own.
test('ks64 · each incoming file is credited to its own author, and your own come back as yours', () => {
  const { eric, ana } = team({ protectedMain: false });
  write(eric, '.rsc/.no-trunk-guard', ''); write(ana, '.rsc/.no-trunk-guard', '');
  quiet(eric); quiet(ana);
  write(ana, '02-DOCS/wiki/de-ana.md', 'a\n'); turn(ana);
  git(eric, 'switch', '-q', '-c', 'feat/otra');
  write(eric, '02-DOCS/wiki/de-eric.md', 'e\n'); turn(eric);
  git(eric, 'switch', '-q', 'main');
  const said = String(message(eric));
  assert.match(said, /de Ana: 02-DOCS\/wiki\/de-ana\.md/, said);
  assert.match(said, /de ti, desde otra rama: 02-DOCS\/wiki\/de-eric\.md/, said);
  assert.doesNotMatch(said, /de Ana: [^;]*de-eric/, said);
});
