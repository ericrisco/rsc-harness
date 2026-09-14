import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { wireHook } from '../targets/claude.js';

// What a clone actually is, measured rather than imagined: `git clone` of an equipped repo brings
// `.rsc.json` and the committed wiring, and brings NOTHING the wiring invokes — `.rsc/` is ignored
// by design, because its contents are machine-shaped (symlinks here, real copies on Windows).
//
// So the first session in a clone runs six wired hooks against six files that do not exist. What
// the person sees is not a warning, it is the module loader's stack trace — and because three of
// the six are PreToolUse guards on the shell tool, they see it again on every shell call for the
// whole session. That is worse than having no harness: "no harness" reads as not set up, this reads
// as broken and noisy, which is what makes people uninstall instead of finish installing.
//
// These tests build that state on purpose: wire a real harness, then delete exactly what git does
// not carry. They must be able to FAIL here, and today they do — every one of the six dumps.

const SUGGEST_BODY = '# suggest\n\nalways-on body.\n';

/** An equipped project, then stripped to exactly what `git clone` would hand you. */
function clonedWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-clone-'));
  mkdirSync(join(root, '.claude', 'skills', 'suggest'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'suggest', 'SKILL.md'), SUGGEST_BODY);
  writeFileSync(join(root, '.claude', 'settings.json'), '{}\n');
  writeFileSync(
    join(root, '.rsc.json'),
    JSON.stringify({ version: 1, targets: ['claude'], skills: ['orient'], catalogVersion: '1.3.6' }, null, 2),
  );

  const paths = {
    projectRoot: root,
    hookTarget: join(root, '.claude', 'settings.json'),
    skillDir: (id) => join(root, '.claude', 'skills', id),
  };
  wireHook(paths, join(root, '.claude', 'skills', 'suggest', 'SKILL.md'));

  // The clone: git carries the committed wiring, never the machine-shaped directory it points into.
  rmSync(join(root, '.rsc'), { recursive: true, force: true });
  return { root, paths };
}

/** Every command the committed wiring tells the client to run, with the client's own variable resolved. */
function wiredCommands(root) {
  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
  const out = [];
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (typeof hook.command === 'string') out.push({ event, command: hook.command });
      }
    }
  }
  return out.map(({ event, command }) => ({
    event,
    command: command.replaceAll('${CLAUDE_PROJECT_DIR}', root),
  }));
}

/** Run one wired command the way the client would, and report what the user would actually see. */
function runWired(command, root) {
  const r = spawnSync(command, { shell: true, cwd: root, input: '{}', encoding: 'utf8' });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

// A stack trace has a shape, and naming the shape is what keeps this test honest: it must not pass
// merely because a message changed wording.
const DUMP_MARKERS = [
  'Cannot find module',
  'node:internal/modules',
  'at Module._resolveFilename',
  'throw err;',
  'ERR_MODULE_NOT_FOUND',
];

function dumpFoundIn(text) {
  return DUMP_MARKERS.filter((m) => text.includes(m));
}

test('a clone carries the wiring and not what it invokes — the state under test is real', () => {
  const { root } = clonedWorkspace();
  const commands = wiredCommands(root);
  assert.ok(commands.length >= 6, `expected the six wired hooks, got ${commands.length}`);
  for (const { command } of commands) {
    assert.ok(
      command.includes('.rsc/') || command.includes('.rsc\\'),
      `a wired command points somewhere git does not carry: ${command}`,
    );
  }
});

test('AC#9 — no committed hook dumps a stack trace in a clone', () => {
  const { root } = clonedWorkspace();
  const offenders = [];
  for (const { event, command } of wiredCommands(root)) {
    const { stdout, stderr } = runWired(command, root);
    const hits = dumpFoundIn(stdout + stderr);
    if (hits.length) offenders.push(`${event}: ${hits.join(', ')}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these hooks dump a stack trace instead of saying something:\n  ${offenders.join('\n  ')}`,
  );
});

test('AC#9 — no committed hook blocks the turn in a clone', () => {
  const { root } = clonedWorkspace();
  const blocking = [];
  for (const { event, command } of wiredCommands(root)) {
    const { status } = runWired(command, root);
    // 2 is the deny code for a PreToolUse hook: a missing harness must never deny the user's tool.
    if (status === 2) blocking.push(`${event} denied the tool call (exit 2)`);
  }
  assert.deepEqual(blocking, [], blocking.join('\n'));
});
