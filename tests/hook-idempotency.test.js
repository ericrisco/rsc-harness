import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireHook, unwireHook, hookWiringOf } from '../targets/claude.js';

// On Windows every install APPENDED a hook instead of replacing it. Reported from a real Windows
// box: after `install` + two `add` + `sync`, every hook was present FOUR times — so the `suggest`
// always-on body was injected 4× per session start (4× the context cost it is budgeted for, P5)
// and all six guards ran 4× per command.
//
// Cause: `join()` produces `.rsc\session-start.mjs` on Windows, `JSON.stringify` escapes that to
// `.rsc\\session-start.mjs`, and all seven dedup filters searched for a FORWARD-slash needle
// (`.rsc/session-start.`). The needle never matched, so the filter never dropped the previous entry.
//
// The half the report did not mention, and which is worse: `unwireHook` uses the same forward-slash
// needle, so on Windows `uninstall`/`purge` removed NONE of the hooks it claims to remove. A
// cleanup that silently cleans nothing is the decorative gate pattern (P2) pointed at uninstall.
//
// These tests run on POSIX and must be able to FAIL there: the Windows-shaped entries are written by
// hand, so the separator under test never depends on the host. That is the whole point — a test that
// only reproduces this on Windows could not run in this repo's CI at all.
const HERE = new URL('.', import.meta.url).pathname;

// A settings.json as a Windows install would have left it: backslash separators throughout.
const WINDOWS_ENTRY = (script) => ({
  hooks: [{ type: 'command', command: `node "C:\\proj\\.rsc\\${script}" "C:\\proj"` }],
});
const POSIX_ENTRY = (script) => ({
  hooks: [{ type: 'command', command: `node "/home/u/proj/.rsc/${script}" "/home/u/proj"` }],
});

function workspace(settings) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-hooks-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  const hookTarget = join(root, '.claude', 'settings.json');
  writeFileSync(hookTarget, JSON.stringify(settings, null, 2) + '\n');
  return {
    root,
    hookTarget,
    read: () => JSON.parse(readFileSync(hookTarget, 'utf8')),
    paths: {
      projectRoot: root,
      hookTarget,
      skillDir: (id) => join(root, '.claude', 'skills', id),
    },
  };
}

// ── the normalizer, directly ──────────────────────────────────────────────────────────────

test('a Windows-shaped entry matches the same needle as a POSIX one', () => {
  const needle = '.rsc/session-start.';
  assert.ok(hookWiringOf(POSIX_ENTRY('session-start.mjs')).includes(needle), 'posix entry');
  assert.ok(hookWiringOf(WINDOWS_ENTRY('session-start.mjs')).includes(needle), 'windows entry');
});

test('the normalizer does not turn unrelated entries into matches', () => {
  // A normalizer that made everything match would delete a user's own hooks — the opposite failure,
  // and a far more expensive one than a duplicate.
  const mine = { hooks: [{ type: 'command', command: 'node "C:\\proj\\scripts\\my-own-hook.mjs"' }] };
  assert.ok(!hookWiringOf(mine).includes('.rsc/'), 'a user hook must never look like an rsc hook');
});

test('a lone backslash in the JSON text is an escape, not a separator, and is left alone', () => {
  // Why the normalizer does ONE replacement instead of two: JSON.stringify escapes every backslash
  // as `\\`, so a separator always arrives doubled. A single backslash in the JSON text is some
  // other escape — `\"` here — and turning it into a slash would mangle it for no gain. A mutation
  // pass found that the second replacement this started with was dead weight; this pins that.
  const quoted = { hooks: [{ command: 'node "C:\\p\\.rsc\\ship-guard.mjs" --msg "he said \\"hi\\""' }] };
  const wiring = hookWiringOf(quoted);
  assert.ok(wiring.includes('.rsc/ship-guard.'), 'the separator still normalizes');
  assert.ok(wiring.includes('\\"'), 'an escaped quote must survive normalization untouched');
});

test('every separator form of the same path normalizes identically', () => {
  const forms = [
    { hooks: [{ command: 'node "C:\\p\\.rsc\\ship-guard.mjs"' }] },
    { hooks: [{ command: 'node "C:/p/.rsc/ship-guard.mjs"' }] },
    { hooks: [{ command: 'node "/p/.rsc/ship-guard.mjs"' }] },
  ];
  for (const f of forms) {
    assert.ok(hookWiringOf(f).includes('.rsc/ship-guard.'), `missed: ${JSON.stringify(f)}`);
  }
});

// ── wiring: replace, never append ─────────────────────────────────────────────────────────

// Every hook wireHook manages, with the event it lands on. Iterated, so a new hook added without a
// dedup filter fails this suite instead of quietly duplicating on the next Windows install.
const MANAGED = [
  ['SessionStart', 'session-start.mjs'],
  ['PreCompact', 'worklog-checkpoint.mjs'],
  ['SessionEnd', 'worklog-checkpoint.mjs'],
  ['PreToolUse', 'ship-guard.mjs'],
  ['PreToolUse', 'danger-guard.mjs'],
  ['PreToolUse', 'gitmoji-guard.mjs'],
  ['UserPromptSubmit', 'userprompt-gate.mjs'],
];

for (const [event, script] of MANAGED) {
  test(`wireHook REPLACES a Windows-shaped ${script} on ${event}, never appends`, () => {
    const ws = workspace({ hooks: { [event]: [WINDOWS_ENTRY(script)] } });
    wireHook(ws.paths);
    const entries = ws.read().hooks[event] || [];
    const ours = entries.filter((e) => hookWiringOf(e).includes(`.rsc/${script.replace('.mjs', '.')}`));
    assert.equal(ours.length, 1, `${script} on ${event}: ${ours.length} copies after one wire (expected 1)`);
  });
}

test('wiring four times in a row leaves exactly one copy of each hook', () => {
  // The reported symptom, reproduced end to end: install + two adds + sync.
  const ws = workspace({});
  for (let i = 0; i < 4; i += 1) wireHook(ws.paths);
  const settings = ws.read();
  for (const [event, script] of MANAGED) {
    const ours = (settings.hooks[event] || []).filter(
      (e) => hookWiringOf(e).includes(`.rsc/${script.replace('.mjs', '.')}`),
    );
    assert.equal(ours.length, 1, `${script} on ${event} is present ${ours.length}× after 4 wires`);
  }
});

test('a pre-existing Windows install converges to one copy, not five', () => {
  // The upgrade path for the boxes that already have four copies: one wire cleans them all up.
  const ws = workspace({
    hooks: {
      SessionStart: [WINDOWS_ENTRY('session-start.mjs'), WINDOWS_ENTRY('session-start.mjs'),
        WINDOWS_ENTRY('session-start.mjs'), WINDOWS_ENTRY('session-start.mjs')],
    },
  });
  wireHook(ws.paths);
  const ours = ws.read().hooks.SessionStart.filter((e) => hookWiringOf(e).includes('.rsc/session-start.'));
  assert.equal(ours.length, 1, 'four stale Windows copies must collapse to one');
});

test("a user's own hooks on the same event survive wiring", () => {
  const mine = { hooks: [{ type: 'command', command: 'node "/p/scripts/my-own.mjs"' }] };
  const ws = workspace({ hooks: { SessionStart: [mine] } });
  wireHook(ws.paths);
  const settings = ws.read();
  assert.ok(
    settings.hooks.SessionStart.some((e) => JSON.stringify(e).includes('my-own.mjs')),
    'wiring must never eat a hook it does not own',
  );
});

// ── unwiring: the half the report missed ──────────────────────────────────────────────────

test('unwireHook removes Windows-shaped rsc hooks', () => {
  const ws = workspace({
    hooks: {
      SessionStart: [WINDOWS_ENTRY('session-start.mjs')],
      PreToolUse: [WINDOWS_ENTRY('danger-guard.mjs'), WINDOWS_ENTRY('gitmoji-guard.mjs')],
    },
  });
  unwireHook(ws.paths);
  const settings = ws.read();
  assert.equal(settings.hooks, undefined, `uninstall left hooks behind: ${JSON.stringify(settings)}`);
});

test('unwireHook keeps hooks it does not own, on both separator styles', () => {
  const mine = { hooks: [{ type: 'command', command: 'node "C:\\proj\\scripts\\my-own.mjs"' }] };
  const ws = workspace({ hooks: { SessionStart: [WINDOWS_ENTRY('session-start.mjs'), mine] } });
  unwireHook(ws.paths);
  const remaining = ws.read().hooks.SessionStart;
  assert.equal(remaining.length, 1);
  assert.ok(JSON.stringify(remaining[0]).includes('my-own.mjs'));
});

test('unwireHook also removes the legacy cat-form entry', () => {
  // The bash-era form, kept working through the migration; it has no .rsc/ path at all.
  const ws = workspace({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'cat .claude/skills/rsc/suggest/SKILL.md' }] }] },
  });
  unwireHook(ws.paths);
  assert.equal(ws.read().hooks, undefined);
});
