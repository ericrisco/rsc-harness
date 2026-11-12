import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { wireMemory, unwireMemory } from '../targets/memory.js';
import { wireKnowledge, unwireKnowledge } from '../targets/knowledge-wiring.js';
import { applyInstall, syncInstalled, removeTargetInstall } from '../scripts/install-apply.js';

const config = (root) => join(root, '.claude', 'settings.local.json');
const boot = (root) => join(root, '.claude', 'rsc-bootstrap.mjs');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function fixture(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-361 space ')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'main'); mkdirSync(root);
  git(root, 'init', '-qb', 'main'); git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.com');
  writeFileSync(join(root, 'README.md'), 'fixture\n'); git(root, 'add', 'README.md'); git(root, 'commit', '-qm', 'fixture');
  return { dir, root };
}
function commands(root) {
  return Object.values(JSON.parse(readFileSync(config(root), 'utf8')).hooks || {}).flatMap((entries) => entries.flatMap((entry) => entry.hooks || []))
    .map((h) => h.command).filter((s) => /\.rsc\/(session-memory-adapter|knowledge-sync)\.mjs/.test(s));
}
function run(command, cwd, input = '{}') {
  return spawnSync('sh', ['-c', command], { cwd, env: { ...process.env, CLAUDE_PROJECT_DIR: cwd }, input, encoding: 'utf8', timeout: 10000 });
}

test('361 all nine inherited lifecycle commands are quiet in a real fresh worktree', async (t) => {
  const { dir, root } = fixture(t);
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', cwd: root, home: root });
  git(root, 'add', '.rsc.json', '.claude/rsc-bootstrap.mjs'); git(root, 'commit', '-qm', 'portable wiring');
  const child = join(dir, 'fresh checkout'); git(root, 'worktree', 'add', '-qb', 'fix/fresh', child);
  const hooks = commands(root); assert.equal(hooks.length, 9);
  assert.equal(existsSync(join(child, '.rsc')), false);
  const failures = hooks.flatMap((command) => {
    const r = run(command, child, JSON.stringify({ cwd: child, session_id: 'fresh' }));
    return r.status === 0 && r.stdout === '' && r.stderr === '' ? [] : [{ command, status: r.status, stdout: r.stdout, stderr: r.stderr }];
  });
  assert.deepEqual(failures, []);
  assert.equal(existsSync(join(child, '.rsc')), false, 'quiet hooks must not install runtime or create memory');
  assert.equal(existsSync(join(root, '.rsc', 'memory')), false, 'never fall back to parent memory');
});

test('361 standalone wiring creates a shareable bootstrap and forwards all argv/stdin/cwd', (t) => {
  const { root } = fixture(t); wireMemory('claude', root); wireKnowledge('claude', root);
  assert.ok(existsSync(boot(root)));
  const ignored = spawnSync('git', ['check-ignore', '.claude/rsc-bootstrap.mjs'], { cwd: root }); assert.equal(ignored.status, 1);
  const probe = `import {readFileSync,realpathSync} from 'node:fs'; import {fileURLToPath} from 'node:url';
if(fileURLToPath(import.meta.url)!==realpathSync(process.argv[1])) throw new Error('wrong delegate identity');
console.log(JSON.stringify({argv:process.argv.slice(2),input:readFileSync(0,'utf8'),cwd:process.cwd()}));`;
  for (const file of ['session-memory-adapter.mjs', 'knowledge-sync.mjs']) writeFileSync(join(root, '.rsc', file), probe);
  const hooks = commands(root); assert.equal(hooks.length, 9);
  const input = '{"session_id":"argv-probe","prompt":"spaces and \\"quotes\\""}\n';
  for (const command of hooks) {
    assert.match(command, /rsc-bootstrap\.mjs" "quiet"/);
    const op = / claude (\w+)$/.exec(command)[1];
    const r = run(command, root, input); assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '');
    assert.deepEqual(JSON.parse(r.stdout), { argv: command.includes('knowledge-sync.mjs') ? ['hook', 'claude', op] : ['claude', op], input, cwd: root });
  }
});

test('361 sync replaces legacy direct hooks once and independent unwiring preserves user hooks', async (t) => {
  const { root } = fixture(t);
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', cwd: root, home: root });
  const state = JSON.parse(readFileSync(config(root), 'utf8'));
  for (const entries of Object.values(state.hooks)) for (const entry of entries) for (const h of entry.hooks || []) {
    const match = /\.rsc\/(session-memory-adapter|knowledge-sync)\.mjs".*? claude (\w+)$/.exec(h.command || '');
    if (match) h.command = `node "\${CLAUDE_PROJECT_DIR}/.rsc/${match[1]}.mjs" ${match[1] === 'knowledge-sync' ? 'hook ' : ''}claude ${match[2]}`;
  }
  const user = { hooks: [{ type: 'command', command: 'echo user-owned' }] };
  state.hooks.Stop.push(user); state.preference = 'preserved'; writeFileSync(config(root), JSON.stringify(state));
  await syncInstalled({ target: 'claude', cwd: root, home: root }); await syncInstalled({ target: 'claude', cwd: root, home: root });
  assert.equal(commands(root).length, 9); assert.ok(commands(root).every((c) => c.includes('rsc-bootstrap.mjs')));
  unwireMemory('claude', root); assert.equal(commands(root).length, 2); assert.ok(existsSync(boot(root)));
  unwireKnowledge('claude', root); assert.equal(commands(root).length, 0);
  const after = JSON.parse(readFileSync(config(root), 'utf8')); assert.equal(after.preference, 'preserved'); assert.deepEqual(after.hooks.Stop, [user]);
});

test('361 an installation without suggest backs up the shared bootstrap and removes it on uninstall', async (t) => {
  const { root } = fixture(t); mkdirSync(join(root, '.claude'));
  writeFileSync(boot(root), 'previous bootstrap\n');
  const result = await applyInstall({ skillIds: ['orient'], target: 'claude', cwd: root, home: root, policy: { alwaysOn: false, memory: false } });
  assert.ok(result.backup.entries.some((e) => e.path === '.claude/rsc-bootstrap.mjs' && e.existed));
  assert.equal(readFileSync(join(root, '.rsc', 'backups', result.backup.id, 'files', '.claude', 'rsc-bootstrap.mjs'), 'utf8'), 'previous bootstrap\n');
  assert.notEqual(readFileSync(boot(root), 'utf8'), 'previous bootstrap\n');
  assert.equal(commands(root).length, 2);
  rmSync(join(root, '.rsc', 'knowledge-sync.mjs'));
  for (const command of commands(root)) { const r = run(command, root); assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout + r.stderr, ''); }
  removeTargetInstall({ target: 'claude', cwd: root, home: root }); assert.equal(existsSync(boot(root)), false);
});

test('361 the wrapped real memory adapter still records the current checkout session', (t) => {
  const { root } = fixture(t); wireMemory('claude', root); wireKnowledge('claude', root);
  const command = commands(root).find((c) => c.includes('session-memory-adapter.mjs') && c.endsWith(' claude start'));
  const r = run(command, root, JSON.stringify({ cwd: root, session_id: 'actual', is_background_agent: false }));
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '');
  writeFileSync(join(root, 'README.md'), 'actual session edit\n');
  const edit = commands(root).find((c) => c.includes('session-memory-adapter.mjs') && c.endsWith(' claude edit'));
  const edited = run(edit, root, JSON.stringify({ cwd: root, session_id: 'actual', tool_input: { file_path: join(root, 'README.md') } }));
  assert.equal(edited.status, 0, edited.stderr); assert.equal(edited.stderr, '');
  const record = JSON.parse(readFileSync(join(root, '.rsc', 'memory', 'sessions', 'claude--actual.json'), 'utf8'));
  assert.equal(record.sessionId, 'actual');
  assert.equal(record.worktree, root);
});

test('361 legacy repair can migrate providers without breaking surviving lifecycle hooks', async (t) => {
  const { root } = fixture(t);
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', cwd: root, home: root });
  const settings = JSON.parse(readFileSync(config(root), 'utf8'));
  for (const entries of Object.values(settings.hooks)) for (const entry of entries) for (const h of entry.hooks || []) {
    const match = /\.rsc\/(session-memory-adapter|knowledge-sync)\.mjs".*? claude (\w+)$/.exec(h.command || '');
    if (match) h.command = `node "\${CLAUDE_PROJECT_DIR}/.rsc/${match[1]}.mjs" ${match[1] === 'knowledge-sync' ? 'hook ' : ''}claude ${match[2]}`;
  }
  writeFileSync(config(root), JSON.stringify(settings));
  rmSync(join(root, '.rsc.json')); rmSync(join(root, '.claude', 'skills', 'orient'), { recursive: true, force: true });
  mkdirSync(join(root, '.cursor'));
  const { repair } = await import('../scripts/lib/repair.js');
  const result = await repair({ target: 'claude', cwd: root, home: root, invoked: true, accept: async () => true });
  assert.ok(result.applied.some((x) => x.id === 'dangling-links'));
  assert.ok(result.applied.some((x) => x.id === 'wrong-target'));
  assert.equal(commands(root).length, 9);
  for (const command of commands(root)) {
    const r = run(command, root, JSON.stringify({ cwd: root, session_id: 'migration' }));
    assert.equal(r.status, 0, r.stderr); assert.doesNotMatch(r.stderr, /Cannot find module/);
  }
});

for (const memoryFirst of [true, false]) {
  test(`361 shared bootstrap retires only after the last standalone consumer (${memoryFirst})`, (t) => {
    const { root } = fixture(t); wireMemory('claude', root); wireKnowledge('claude', root);
    const first = memoryFirst ? unwireMemory : unwireKnowledge;
    const last = memoryFirst ? unwireKnowledge : unwireMemory;
    first('claude', root); assert.ok(existsSync(boot(root)));
    last('claude', root); assert.equal(existsSync(boot(root)), false);
  });
}

test('361 cleanup retains a user bootstrap consumer or unreadable settings', (t) => {
  const { root } = fixture(t);
  for (const contents of [
    JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node ".claude\\rsc-bootstrap.mjs" quiet . custom.mjs' }] }] } }),
    '{unreadable',
  ]) {
    wireMemory('claude', root);
    const settings = join(root, '.claude', 'settings.json'); writeFileSync(settings, contents);
    unwireMemory('claude', root);
    assert.ok(existsSync(boot(root))); assert.equal(readFileSync(settings, 'utf8'), contents);
  }
});
