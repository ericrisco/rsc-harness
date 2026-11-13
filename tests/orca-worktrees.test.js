import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { provenanceOf, classifyWorktrees, reapWorktree, autoReap } from '../targets/worktree-reaper.mjs';
import { capture } from '../targets/session-memory-core.mjs';
import { isolationContext } from '../targets/session-memory-adapter.mjs';
import { applyInstall, recordInManifest, syncInstalled } from '../scripts/install-apply.js';

const roots = [];
function temp() { const p = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-orca-'))); roots.push(p); return p; }
function write(root, path, text) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); }
function git(root, ...args) { const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); }
function repo() {
  const root = temp(); git(root, 'init', '-qb', 'main');
  git(root, 'config', 'user.name', 'Test'); git(root, 'config', 'user.email', 'test@example.com');
  write(root, '.gitignore', '.worktrees/\n.rsc/\n'); write(root, 'main.txt', 'init\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'init'); return root;
}
function landed(root) {
  const path = join(root, '.worktrees', 'repo', 'task');
  git(root, 'worktree', 'add', '-qb', 'fix/task', path);
  write(path, 'task.txt', 'done\n'); git(path, 'add', '.'); git(path, 'commit', '-qm', 'fix task');
  git(root, 'merge', '--no-ff', '-qm', 'merge task', 'fix/task');
  return { path, branch: 'fix/task' };
}
function fakeOrca(body, callback) {
  const bin = temp(); const file = join(bin, 'orca');
  const checkArgs = 'if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(["worktree", "current", "--json"])) process.exit(64);';
  writeFileSync(file, `#!${process.execPath}\n${checkArgs}\n${body}\n`); chmodSync(file, 0o755);
  const previous = process.env.PATH; process.env.PATH = `${bin}${delimiter}${previous}`;
  try { return callback(); } finally { process.env.PATH = previous; }
}
test.after(() => roots.forEach(p => rmSync(p, { recursive: true, force: true })));

test('#350 declared Orca ownership prevents both automatic and confirmed Git removal', () => {
  const root = repo(); const wt = landed(root);
  write(root, '.rsc.json', JSON.stringify({ worktreeManager: 'orca' }));
  assert.equal(provenanceOf(root, wt), 'orca');
  const candidate = classifyWorktrees(root).find(c => c.path === wt.path);
  assert.equal(candidate.verdict, 'skip'); assert.deepEqual(candidate.reasons, ['orca']);
  const removed = reapWorktree(root, wt.path, { confirmed: true });
  assert.equal(removed.removed, false); assert.match(removed.reason, /orca worktree rm/); assert.match(removed.reason, /--run-hooks/);
  assert.equal(autoReap(root).reaped.length, 0); assert.ok(existsSync(wt.path));
});

test('#350 installation recording preserves the project manager declaration', () => {
  const root = temp();
  write(root, '.rsc.json', JSON.stringify({ version: 1, worktreeManager: 'orca', targets: ['claude'], skills: ['orient'] }));
  recordInManifest({ cwd: root, target: 'claude', skillIds: ['orient'] });
  assert.equal(JSON.parse(readFileSync(join(root, ".rsc.json"), "utf8")).worktreeManager, 'orca');
});

test('#350 install and sync preserve the manager declaration and materialize its protection', async () => {
  const root = temp();
  write(root, '.rsc.json', JSON.stringify({ version: 1, worktreeManager: 'orca', targets: ['claude'], skills: ['orient'] }));
  const options = { cwd: root, home: root, target: 'claude' };
  await applyInstall({ ...options, skillIds: ['orient'] });
  const readManager = () => JSON.parse(readFileSync(join(root, '.rsc.json'), 'utf8')).worktreeManager;
  assert.equal(readManager(), 'orca', 'initial installation preserves the declared manager');
  // Remove a managed runtime file so sync has an actual repair to perform.
  const runtime = join(root, '.rsc', 'worktree-reaper.mjs');
  rmSync(runtime);
  await syncInstalled(options);
  assert.equal(readManager(), 'orca', 'sync preserves the declared manager');
  assert.ok(existsSync(runtime), 'sync restores the runtime file');
  const installed = await import(pathToFileURL(runtime).href);
  assert.equal(installed.provenanceOf(root, { path: root, branch: 'fix/task' }), 'orca');
});

test('#350 Orca identity is established by its returned path, never branch naming', { skip: process.platform === 'win32' }, () => {
  const root = repo(); const wt = landed(root);
  fakeOrca('console.log(JSON.stringify({result:{worktree:{id:"orca-task",path:process.cwd()}}}))', () => {
    assert.equal(provenanceOf(root, wt), 'orca');
    assert.equal(reapWorktree(root, wt.path).removed, false);
  });
});

test('#350 unavailable or mismatched Orca evidence cannot authorise deletion', { skip: process.platform === 'win32' }, () => {
  const root = repo(); const wt = landed(root);
  for (const script of [
    'process.exit(1)',
    'console.log("not json")',
    'console.log(JSON.stringify({result:{worktree:{id:"other",path:"/elsewhere"}}}))',
  ]) fakeOrca(script, () => {
    assert.equal(provenanceOf(root, wt), 'manager-unknown');
    assert.equal(reapWorktree(root, wt.path, { confirmed: true }).removed, false);
  });
});

test('#350 unmanaged worktrees remain eligible when Orca explicitly returns no worktree', { skip: process.platform === 'win32' }, () => {
  const root = repo(); const wt = landed(root);
  fakeOrca('console.log(JSON.stringify({result:{worktree:null}}))', () => {
    assert.equal(provenanceOf(root, wt), 'rsc');
    assert.equal(classifyWorktrees(root).find(c => c.path === wt.path).verdict, 'safe');
  });
});

test('#350 a hung or oversized Orca response is bounded and retains ownership uncertainty', { skip: process.platform === 'win32' }, () => {
  const root = temp(); const wt = { path: root, branch: 'fix/task' };
  fakeOrca('setInterval(() => {}, 1000)', () => {
    const start = Date.now();
    assert.equal(provenanceOf(root, wt), 'manager-unknown');
    assert.ok(Date.now() - start < 8000, 'the query must not hang the cleanup hook');
  });
  fakeOrca('console.log("x".repeat(1024 * 1024))', () => {
    assert.equal(provenanceOf(root, wt), 'manager-unknown');
  });
});

test('#350 Orca isolation guidance retains warnings for unverified sessions', () => {
  const root = repo(); write(root, '.rsc.json', JSON.stringify({ worktreeManager: 'orca' }));
  capture({ cwd: root, worktreeCwd: root, target: 'codex', sessionId: 'other', event: 'start' });
  const message = isolationContext({ project: root, here: root, sessionId: 'mine', target: 'claude' });
  assert.match(message, /otra sesión/); assert.match(message, /Orca/); assert.match(message, /orca worktree current --json/);
  assert.match(message, /sesiones/); assert.match(message, /orca worktree create/);
  assert.doesNotMatch(message, /`git worktree add/);
});
