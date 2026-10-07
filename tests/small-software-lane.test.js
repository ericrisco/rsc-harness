// E2E of 2026-10-07 (rsc vs ECC, same task, five sessions): a small software project with `main` open
// and a technical user had (a) no guard at all and (b) a three-line always-on stub with no FTD/SDD
// lanes in it, so the agent never wrote a feature document. Both came from one cause: the plan tied
// the lane decision and the danger guard to "practises SDD". These pin the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, classify, NUDGE } from '../targets/ftd-nudge.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });

function onboarded({ kind = 'software', scope = 'small', level = 'technical' } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-lane-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, 'index.html'), '<!doctype html>\n');
  const args = ['onboard', '--target', 'claude', '--technical-level', level, '--project-kind', kind,
    ...(kind === 'software' ? ['--software-scope', scope, '--workflow', 'main'] : []), '--goal', 'mini web de tareas'];
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan to accept');
  run(cwd, [...args, '--accept-plan', planId]);
  return cwd;
}
const wired = (cwd, event) => {
  const settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8'));
  return (settings.hooks?.[event] || []).flatMap((e) => e.hooks.map((h) => /\.rsc\/([a-z-]+)\.(mjs|md)/.exec(h.command)?.[1]).filter(Boolean)).sort();
};

test('lane01 · a small software project gets the lanes: full suggest body, per-turn gate, FTD nudge', { timeout: 300000 }, () => {
  const cwd = onboarded();
  const start = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8')).hooks.SessionStart.map((e) => e.hooks[0].command).join(' ');
  assert.ok(!start.includes('suggest-always-on.md'), 'not the operations stub');
  assert.ok(!existsSync(join(cwd, '.rsc', 'suggest-always-on.md')));
  assert.deepEqual(wired(cwd, 'UserPromptSubmit').filter((h) => h === 'userprompt-gate'), ['userprompt-gate']);
  assert.ok(wired(cwd, 'PostToolUse').includes('ftd-nudge'));
  assert.ok(wired(cwd, 'PreToolUse').includes('danger-guard'), 'and a guard, technical user or not');
  const gate = spawnSync('node', [join(cwd, '.rsc', 'userprompt-gate.mjs'), cwd], { input: JSON.stringify({ session_id: 's', prompt: 'x' }), encoding: 'utf8' }).stdout;
  assert.match(gate, /FTD/);
});

test('lane02 · an operations project keeps the light layer: no lane gate, no nudge', { timeout: 300000 }, () => {
  const cwd = onboarded({ kind: 'operations' });
  assert.deepEqual(wired(cwd, 'UserPromptSubmit').filter((h) => h === 'userprompt-gate'), []);
  assert.ok(!wired(cwd, 'PostToolUse').includes('ftd-nudge'));
});

test('lane03 · the nudge fires once, on the first code edit of a session with no feature document', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-nudge-'));
  const edit = (session, file) => decide(root, { session_id: session, tool_input: { file_path: join(root, file) } });
  assert.equal(edit('a', 'README.md'), '', 'markdown is not code');
  assert.equal(edit('a', '02-DOCS/wiki/harness/user-profile.md'), '');
  assert.equal(edit('a', 'src/app.js'), NUDGE);
  assert.equal(edit('a', 'src/other.js'), '', 'once per session');
  assert.equal(edit('b', '02-DOCS/wiki/ftd/filtro.md'), '', 'documented first');
  assert.equal(edit('b', 'src/app.js'), '', 'a documented session is never nudged');
  assert.equal(edit('c', 'src/app.js'), NUDGE, 'each session decides for itself');
  writeFileSync(join(root, '.rsc', '.no-ftd-nudge'), '');
  assert.equal(edit('d', 'src/app.js'), '', 'opt-out');
});

test('lane04 · what counts as code', () => {
  const root = '/p';
  assert.equal(classify(root, '/p/src/a.ts'), 'code');
  assert.equal(classify(root, 'index.html'), 'code');
  assert.equal(classify(root, '/p/02-DOCS/wiki/sdd/specs/x.md'), 'document');
  for (const other of ['/p/.claude/settings.json', '/p/.rsc/x.mjs', '/p/01-TOOLS/a/b.sh', '/p/notes.txt', '/elsewhere/a.js']) {
    assert.equal(classify(root, other), 'other', other);
  }
});
