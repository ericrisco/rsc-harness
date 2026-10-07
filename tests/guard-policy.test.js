import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

// #273 — `init` promises non-technical users a guard against irreversible commands, keyed to their
// technical level. The plan decided it by something else: whether the project practises SDD. The
// reason written for that is right for ship-guard, gitmoji and the SDD gate — they need a code
// project with git — and wrong for the danger guard: `rm -rf` is exactly as irreversible in an
// invoicing workspace.
//
// #274 — `repair` reinstalled with no policy, so the hooks the plan had declined were wired, and the
// next `sync`, which does pass the policy, took them away again.

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '' });

function onboarded({ level, kind }) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-guard-'));
  execFileSync('git', ['init', '-q'], { cwd });
  writeFileSync(join(cwd, 'app.py'), 'x = 1\n');
  const args = ['onboard', '--target', 'claude', '--technical-level', level, '--accompaniment', 'L3',
    '--project-kind', kind, '--software-scope', 'growing', '--workflow', 'main', '--goal', 'Llevar la facturación'];
  const planId = /--accept-plan ([a-f0-9]{64})/.exec(run(cwd, args).stdout)?.[1];
  assert.ok(planId, 'fixture: a plan to accept');
  run(cwd, [...args, '--accept-plan', planId]);
  return cwd;
}
function guards(cwd) {
  const settings = JSON.parse(readFileSync(join(cwd, '.claude', 'settings.json'), 'utf8'));
  return (settings.hooks?.PreToolUse || [])
    .flatMap((e) => e.hooks.map((h) => /\.rsc\/([a-z-]+)\.mjs/.exec(h.command)?.[1]).filter(Boolean)).sort();
}

test('#273 — a non-technical operations project gets the danger guard, and only that', { timeout: 300000 }, () => {
  const cwd = onboarded({ level: 'non-technical', kind: 'operations' });
  assert.deepEqual(guards(cwd), ['danger-guard'], 'the code guards still need a code project');
  assert.ok(existsSync(join(cwd, '.rsc', 'danger-guard.mjs')));
});

test('#273 — mixed is guarded too, as init promises', { timeout: 300000 }, () => {
  assert.deepEqual(guards(onboarded({ level: 'mixed', kind: 'operations' })), ['danger-guard']);
});

// Until 3.0.8 a technical user got no guard at all, and the E2E of 2026-10-07 showed the cost: a
// small project with `main` open had nothing between `git reset --hard` and uncommitted work. The
// guard is now present for everyone; for a technical user it only ASKS, and only about lost work.
test('3.0.8 — a technical project gets the danger guard, and it asks instead of denying', { timeout: 300000 }, () => {
  const cwd = onboarded({ level: 'technical', kind: 'operations' });
  assert.deepEqual(guards(cwd), ['danger-guard']);
  const probe = (command) => {
    const out = spawnSync('node', [join(cwd, '.rsc', 'danger-guard.mjs'), cwd], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' }).stdout;
    return out.trim() ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow';
  };
  assert.equal(probe('git reset --hard HEAD~1'), 'ask', 'lost work: the person confirms');
  assert.equal(probe('git restore .'), 'ask');
  assert.equal(probe('rm -rf build'), 'allow', 'ordinary for a technical person: silent');
  assert.equal(probe("echo 'git reset --hard'"), 'allow', 'a sentence about a command is not the command');
});

test('control — a non-technical software project keeps all four guards', { timeout: 300000 }, () => {
  // branch-guard joined the code guards in 3.0 (team-safe-default A and B).
  assert.deepEqual(guards(onboarded({ level: 'non-technical', kind: 'software' })), ['branch-guard', 'danger-guard', 'gitmoji-guard', 'ship-guard']);
});

test('#274 — repair and sync agree with the accepted plan, and with each other', { timeout: 300000 }, () => {
  const cwd = onboarded({ level: 'non-technical', kind: 'operations' });
  const planned = guards(cwd);
  const victim = readdirSync(join(cwd, '.rsc', 'skills'))[0];
  rmSync(join(cwd, '.rsc', 'skills', victim), { recursive: true, force: true });
  run(cwd, ['repair', '--yes']);
  assert.deepEqual(guards(cwd), planned, 'repair must not wire what the plan declined');
  assert.ok(existsSync(join(cwd, '.rsc', 'skills', victim)), 'and it still repairs what it came for');
  run(cwd, ['sync']);
  assert.deepEqual(guards(cwd), planned, 'sync after repair changes nothing');
});
