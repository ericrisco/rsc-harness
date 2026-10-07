import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// E2E defects 7, 8 and 9, reproduced with the exact onboarding the field test ran: a small software
// project, technical, straight on main, Claude Code. Each assertion is something the fresh install
// told the person that was not true, or contradicted itself about.

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const run = (cwd, args, opts = {}) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', ...opts });
const ONBOARD = ['onboard', '--technical-level', 'technical', '--project-kind', 'software', '--goal', 'mini web de tareas',
  '--software-scope', 'small', '--workflow', 'main', '--target', 'claude'];

let cwd;
let preview;
before(() => {
  cwd = mkdtempSync(join(tmpdir(), 'rsc-fresh-'));
  git(cwd, ['init', '-q']);
  git(cwd, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '--no-verify', '-m', '🔧 init']);
  preview = run(cwd, ONBOARD).stdout;
  const id = preview.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.ok(id, preview);
  const accepted = run(cwd, [...ONBOARD, '--accept-plan', id]);
  assert.equal(accepted.status, 0, accepted.stderr + accepted.stdout);
});

function doctor() {
  const r = run(cwd, ['doctor']);
  const json = JSON.parse(r.stdout.slice(r.stdout.indexOf('\n{') + 1));
  return { text: r.stdout, json };
}

// What the SessionStart hook really injects, run the way Claude Code runs it.
function sessionStart(sessionId) {
  const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.json'), 'utf8'));
  const command = settings.hooks.SessionStart.flatMap((e) => e.hooks).map((h) => h.command)
    .find((c) => c.includes('session-start'));
  const expanded = command.replaceAll('${CLAUDE_PROJECT_DIR}', cwd);
  return spawnSync('/bin/sh', ['-c', expanded], {
    cwd, encoding: 'utf8', input: JSON.stringify({ session_id: `${sessionId}-${process.pid}-${Date.now()}`, hook_event_name: 'SessionStart' }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, RSC_HOOK_MARKER_DIR: mkdtempSync(join(tmpdir(), 'rsc-fresh-markers-')) },
  }).stdout;
}

test('9c · the accept command pins the exact version that produced the plan', () => {
  const line = preview.split('\n').find((l) => l.startsWith('Accept exactly this plan:'));
  assert.ok(line.includes(`npx @ericrisco/rsc@${VERSION} onboard`), line);
  assert.ok(!line.includes('@latest'), line);
});

test('9a · sdd is not shown as merely deferred while its skill is installed', () => {
  const deferredSdd = preview.split('\n').find((l) => l.includes('workflow/sdd'));
  assert.ok(deferredSdd, 'the deferred practice is still listed, so reassess keeps watching it');
  assert.match(deferredSdd, /skill is installed/i, deferredSdd);
  assert.match(deferredSdd, /practice/i, deferredSdd);
});

test('9b · the plan lists the 01-TOOLS/ files onboarding writes', () => {
  for (const p of ['01-TOOLS/.gitignore', '01-TOOLS/_TEMPLATE/README.md', '01-TOOLS/_TEMPLATE/.env.example']) {
    assert.ok(preview.includes(p), `${p} missing from the plan:\n${preview}`);
  }
  // And every one of them is really written.
  for (const p of ['01-TOOLS/.gitignore', '01-TOOLS/_TEMPLATE/README.md']) statSync(join(cwd, p));
});

test('8 · the first session after onboard does not nag for a skill audit', () => {
  const out = sessionStart('first-session');
  assert.doesNotMatch(out, /skill audit is due/, out);
});

test('7a · "Per session start" matches the always-on body the hook really injects', () => {
  const { text, json } = doctor();
  // Whatever file the SessionStart hook really hands over: since 3.0.8 a small software project gets
  // the full suggest body (the FTD/SDD lanes), an operations project the short stub.
  const startCmd = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8')).hooks.SessionStart.map((e) => e.hooks[0].command).join(' ');
  const bodyRel = /\$\{CLAUDE_PROJECT_DIR\}\/([^"]+\.md)/.exec(startCmd)?.[1];
  assert.ok(bodyRel, startCmd);
  const body = statSync(join(cwd, bodyRel)).size;
  const shown = /Per session start : ([\d.]+) KB/.exec(text)?.[1];
  assert.equal(shown, (body / 1024).toFixed(1), text);
  const injected = Buffer.byteLength(sessionStart('budget-check'));
  assert.ok(injected >= body, `the hook injects at least the body: ${injected} vs ${body}`);
  assert.ok(Number(shown) * 1024 <= injected + 1024, `figure ${shown} KB vs real ${injected} B`);
  assert.match(text, /banners/i, 'the label says what is not counted');
  assert.ok(json.healthy);
});

test('7b · a healthy fresh install does not recommend `rsc repair` for a hook the plan deferred', () => {
  const { json } = doctor();
  assert.equal(json.healthy, true);
  assert.ok(!/repair/.test(json.worktreeCleanup.action || ''), JSON.stringify(json.worktreeCleanup));
});

test('7c · no design skill installed → no design-loop / design-dna recommendation', () => {
  const { json } = doctor();
  const blob = JSON.stringify([json.designIdentity, json.designStartingPoint]);
  assert.doesNotMatch(blob, /design-loop|design-dna/, blob);
});
