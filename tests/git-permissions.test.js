// A harness installed from scratch lets the agent close the lane — git commit, git push, gh pr create —
// without asking each time; a force-push still asks. A project decision (`gitPermissions` in .rsc.json),
// so older projects are not changed behind anyone's back and a clone gets what the team decided.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyInstall, syncInstalled } from '../scripts/install-apply.js';
import { readManifest, writeManifest } from '../scripts/lib/manifest-file.js';
import { wireGitPermissions, unwireGitPermissions, gitPermissionsWired, gitPermissionsState } from '../targets/git-permissions.js';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-gp-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  return cwd;
}

test('gp01 · a harness installed from scratch allows commit, push and PR, and asks before a force-push', async () => {
  const cwd = project();
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  const { permissions } = json(join(cwd, '.claude', 'settings.json'));
  for (const rule of ['Bash(git commit *)', 'Bash(git push *)', 'Bash(gh pr create *)']) assert.ok(permissions.allow.includes(rule), rule);
  assert.ok(permissions.ask.includes('Bash(git push --force*)'));
  assert.equal(readManifest(cwd).gitPermissions, true, 'the decision travels with the project');
});

test('gp02 · a project adopted before this keeps its permissions untouched until someone turns it on', async () => {
  const cwd = project();
  writeManifest(cwd, { version: 1, targets: ['claude'], skills: ['suggest'], agents: [] });
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  assert.equal(json(join(cwd, '.claude', 'settings.json')).permissions, undefined);
  assert.equal(readManifest(cwd).gitPermissions, undefined);
});

test('gp03 · off removes only rsc\'s entries and sticks across sync; on puts them back', async () => {
  const cwd = project();
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(npm test *)'], deny: ['Bash(rm -rf *)'] } }));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  writeManifest(cwd, { ...readManifest(cwd), gitPermissions: false });
  await syncInstalled({ target: 'claude', cwd });
  let p = json(join(cwd, '.claude', 'settings.json')).permissions;
  assert.deepEqual(p.allow, ['Bash(npm test *)'], 'the person\'s own allow stays');
  assert.deepEqual(p.deny, ['Bash(rm -rf *)'], 'the person\'s own deny stays');
  assert.equal(p.ask, undefined);
  await syncInstalled({ target: 'claude', cwd });
  assert.equal(gitPermissionsWired('claude', cwd), false, 'sync does not bring them back');
  writeManifest(cwd, { ...readManifest(cwd), gitPermissions: true });
  await syncInstalled({ target: 'claude', cwd });
  p = json(join(cwd, '.claude', 'settings.json')).permissions;
  assert.ok(p.allow.includes('Bash(git push *)') && p.allow.includes('Bash(npm test *)'));
});

test('gp04 · a clone of a project that decided "on" gets the same permissions', async () => {
  const cwd = project();
  writeManifest(cwd, { version: 1, targets: ['codex'], skills: ['suggest'], agents: [], gitPermissions: true });
  await syncInstalled({ target: 'codex', cwd });
  assert.match(readFileSync(join(cwd, '.codex', 'rules', 'rsc-git.rules'), 'utf8'), /prefix_rule\(pattern = \["git", "push"\], decision = "allow"/);
});

test('gp05 · OpenCode: rsc\'s asks stay after its allows (last match wins), and the person\'s rules survive', () => {
  const cwd = project();
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ model: 'x', permission: { bash: { '*': 'ask', 'npm *': 'allow' } } }));
  withMajor('1', () => wireGitPermissions('opencode', cwd));
  const c = json(join(cwd, 'opencode.json'));
  assert.equal(c.model, 'x');
  const keys = Object.keys(c.permission.bash);
  assert.ok(keys.indexOf('git push --force*') > keys.indexOf('git push *'), 'a force-push would be allowed');
  assert.equal(c.permission.bash['*'], 'ask');
  unwireGitPermissions('opencode', cwd);
  assert.deepEqual(json(join(cwd, 'opencode.json')).permission.bash, { '*': 'ask', 'npm *': 'allow' });
});

test('gp06 · Gemini adds to tools.allowed; an unreadable config is never overwritten; Cursor is not touched', () => {
  const cwd = project();
  assert.equal(wireGitPermissions('gemini', cwd).mode, 'wired');
  assert.ok(json(join(cwd, '.gemini', 'settings.json')).tools.allowed.includes('run_shell_command(git push)'));
  writeFileSync(join(cwd, '.gemini', 'settings.json'), '{ not json');
  assert.equal(wireGitPermissions('gemini', cwd).mode, 'config-invalid');
  assert.equal(readFileSync(join(cwd, '.gemini', 'settings.json'), 'utf8'), '{ not json');
  assert.equal(wireGitPermissions('cursor', cwd).mode, 'unsupported');
  assert.ok(!existsSync(join(cwd, '.cursor', 'cli.json')));
});

// ── #298 · OpenCode V2 (`permissions` array) and an honest `on|off|status` ──────────────────────
// The OpenCode major version is read from `opencode --version`; RSC_OPENCODE_MAJOR pins it here.
const withMajor = (major, fn) => {
  const before = process.env.RSC_OPENCODE_MAJOR;
  process.env.RSC_OPENCODE_MAJOR = major;
  try { return fn(); } finally { if (before === undefined) delete process.env.RSC_OPENCODE_MAJOR; else process.env.RSC_OPENCODE_MAJOR = before; }
};
const shell = (resource, effect) => ({ action: 'shell', resource, effect });
const FORCE = 'git push --' + 'force*';
const isRsc = (r) => r.action === 'shell' && /^(git commit|git push|gh pr create)/.test(r.resource) && r.effect !== 'deny';

test('gp07 · OpenCode 2: rsc writes `permissions`, asks after allows, and every user rule that matches later still wins', () => {
  const cwd = project();
  const user = [{ action: '*', resource: '*', effect: 'ask' }, shell('git push *', 'deny'), shell('npm *', 'allow')];
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ model: 'x', permissions: user }));
  const r = withMajor('2', () => wireGitPermissions('opencode', cwd));
  assert.equal(r.mode, 'wired');
  assert.equal(r.format, 'v2');
  const c = json(join(cwd, 'opencode.json'));
  assert.equal(c.model, 'x');
  assert.equal(c.permission, undefined, 'no V1 block on OpenCode 2');
  const list = c.permissions;
  assert.deepEqual(list[0], user[0], 'a leading catch-all is a baseline: rsc goes after it, or its allows would be dead');
  const at = (resource, effect) => list.findIndex((x) => x.action === 'shell' && x.resource === resource && x.effect === effect);
  assert.ok(at('git push *', 'allow') > 0 && at('git commit *', 'allow') > 0 && at('gh pr create *', 'allow') > 0);
  assert.ok(at(FORCE, 'ask') > at('git push *', 'allow'), 'last match wins: the force-push ask must come after the allow');
  assert.ok(at('git push *', 'deny') > at(FORCE, 'ask'), 'the person\'s own deny stays after rsc, so it still wins');
  assert.deepEqual(list.filter((x) => !(isRsc(x) && x.effect !== 'deny')).slice(1), [user[1], user[2]], 'user order kept');
  assert.equal(withMajor('2', () => gitPermissionsState('opencode', cwd)).format, 'v2');
  assert.equal(withMajor('2', () => gitPermissionsWired('opencode', cwd)), true);
  withMajor('2', () => wireGitPermissions('opencode', cwd));
  assert.equal(json(join(cwd, 'opencode.json')).permissions.length, list.length, 'idempotent');
  unwireGitPermissions('opencode', cwd);
  assert.deepEqual(json(join(cwd, 'opencode.json')).permissions, user);
});

test('gp08 · OpenCode 2: a catch-all deny at the top is never overridden — rsc goes before it', () => {
  const cwd = project();
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ permissions: [shell('*', 'deny')] }));
  withMajor('2', () => wireGitPermissions('opencode', cwd));
  const list = json(join(cwd, 'opencode.json')).permissions;
  assert.deepEqual(list[list.length - 1], shell('*', 'deny'));
});

test('gp09 · OpenCode 1.x or unknown version: the V1 `permission.bash` map, which both versions read', () => {
  for (const major of ['1', 'unknown']) {
    const cwd = project();
    const r = withMajor(major, () => wireGitPermissions('opencode', cwd));
    assert.equal(r.format, 'v1', major);
    const c = json(join(cwd, 'opencode.json'));
    assert.equal(c.permission.bash['git push *'], 'allow');
    assert.equal(c.permissions, undefined);
  }
});

test('gp10 · moving to OpenCode 2 migrates rsc\'s V1 entries to V2 and leaves the person\'s V1 rules alone', () => {
  const cwd = project();
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ permission: { bash: { 'npm *': 'allow' } } }));
  withMajor('1', () => wireGitPermissions('opencode', cwd));
  assert.equal(json(join(cwd, 'opencode.json')).permission.bash['git push *'], 'allow');
  withMajor('2', () => wireGitPermissions('opencode', cwd));
  const c = json(join(cwd, 'opencode.json'));
  assert.deepEqual(c.permission, { bash: { 'npm *': 'allow' } });
  assert.ok(c.permissions.some((x) => x.resource === 'git push *' && x.effect === 'allow'));
  assert.equal(gitPermissionsState('opencode', cwd).format, 'v2', 'a file already on V2 is read as V2 even with no version known');
});

test('gp11 · opencode.jsonc is read, never rewritten: rsc reports "manual" and prints the rules to paste', () => {
  const cwd = project();
  const body = '{\n  // my settings\n  "model": "x", /* keep */\n  "permissions": [ { "action": "shell", "resource": "npm *", "effect": "allow" }, ],\n}\n';
  writeFileSync(join(cwd, 'opencode.jsonc'), body);
  const r = withMajor('2', () => wireGitPermissions('opencode', cwd));
  assert.equal(r.mode, 'manual');
  assert.match(r.snippet, /"permissions"/);
  assert.match(r.snippet, /git push \*/);
  assert.equal(readFileSync(join(cwd, 'opencode.jsonc'), 'utf8'), body, 'comments survive: the file is untouched');
  assert.ok(!existsSync(join(cwd, 'opencode.json')));
  const s = withMajor('2', () => gitPermissionsState('opencode', cwd));
  assert.equal(s.format, 'manual');
  assert.equal(s.wired, false);
  assert.deepEqual(unwireGitPermissions('opencode', cwd), []);
  assert.equal(readFileSync(join(cwd, 'opencode.jsonc'), 'utf8'), body);
});

test('gp12 · off removes rsc\'s entries from both formats and nothing of the person\'s', () => {
  const cwd = project();
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify({ permission: { bash: { 'npm *': 'allow' } }, permissions: [shell('ls *', 'allow')] }));
  withMajor('1', () => wireGitPermissions('opencode', cwd));
  const c = json(join(cwd, 'opencode.json'));
  // a V2 block left over from a machine on OpenCode 2
  c.permissions.push(shell('git commit *', 'allow'), shell(FORCE, 'ask'));
  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify(c));
  unwireGitPermissions('opencode', cwd);
  const { $schema, ...left } = json(join(cwd, 'opencode.json'));
  assert.deepEqual(left, { permission: { bash: { 'npm *': 'allow' } }, permissions: [shell('ls *', 'allow')] });
});

const ROOT = join(import.meta.dirname, '..');
const cli = (cwd, args) => execFileSync(process.execPath, [join(ROOT, 'scripts', 'rsc.js'), 'git-permissions', ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, RSC_OPENCODE_MAJOR: '2' },
});

test('gp13 · status and off say what rsc controls, what stops when off, and what is the assistant\'s own job', () => {
  const cwd = project();
  writeManifest(cwd, { version: 1, targets: ['opencode', 'claude'], skills: [], agents: [], gitPermissions: true });
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  writeFileSync(join(cwd, '.rsc', 'danger-guard.mjs'), '');
  writeFileSync(join(cwd, '.rsc', 'branch-guard.mjs'), '');
  for (const out of [cli(cwd, ['status']), cli(cwd, ['off'])]) {
    assert.match(out, /OpenCode/);
    assert.match(out, /rsc controls:/);
    assert.match(out, /When off:/);
    assert.match(out, /OpenCode's job:/);
    assert.match(out, /no rsc guard/i, 'OpenCode runs none of rsc\'s guards — say so');
    assert.match(out, /"permissions"/, 'the snippet to ask before a force-push in OpenCode');
    assert.match(out, /branch-guard/, 'Claude keeps its guards whatever this switch says');
    assert.match(out, /danger-guard/);
  }
  const status = JSON.parse(cli(cwd, ['status', '--json']));
  assert.equal(status.declared, false);
  assert.equal(status.format.opencode, 'v2');
});
