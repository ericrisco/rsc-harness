import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join } from 'node:path';
import { doctor, missingHookScripts } from '../scripts/doctor.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-doctorhooks-')); }

// A clone brings .claude/settings.json (committed) but not .rsc/ (ignored), so the
// hook commands point at scripts that are not there. Reporting "wired: true" on that
// is the report saying all-clear while every session start fails.
function wiredButScriptless(dir) {
  mkdirSync(join(dir, '.claude', 'skills'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'skills', '.rsc-state.json'), JSON.stringify({ skills: {} }));
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: `node "${join(dir, '.rsc', 'session-start.mjs')}" "x" "${dir}"` }] }],
    },
  }));
}

test('hookWired is false when a wired script is missing from disk', () => {
  const d = tmp();
  wiredButScriptless(d);
  const r = doctor({ target: 'claude', home: d, cwd: d });
  assert.equal(r.hookWired, false, 'settings.json alone must not count as wired');
});

test('the missing scripts produce exactly one actionable finding, not one per file', () => {
  const d = tmp();
  wiredButScriptless(d);
  const r = doctor({ target: 'claude', home: d, cwd: d });
  const hits = (r.contextBudget?.findings || []).filter((f) => f.id === 'hook-scripts-missing');
  assert.equal(hits.length, 1);
  assert.match(hits[0].action, /repair|sync/, 'the finding must carry its own way out (principle 6)');
});

test('hookWired stays true when the wired scripts are present', () => {
  const d = tmp();
  wiredButScriptless(d);
  mkdirSync(join(d, '.rsc'), { recursive: true });
  writeFileSync(join(d, '.rsc', 'session-start.mjs'), '// present');
  const r = doctor({ target: 'claude', home: d, cwd: d });
  assert.equal(r.hookWired, true);
});

test('a hookless target is unaffected — it has no scripts to lose', () => {
  const d = tmp();
  mkdirSync(join(d, '.codex', 'rsc'), { recursive: true });
  writeFileSync(join(d, '.codex', 'rsc', '.rsc-state.json'), JSON.stringify({ skills: {} }));
  writeFileSync(join(d, 'AGENTS.md'), '# x');
  const r = doctor({ target: 'codex', home: d, cwd: d });
  assert.equal(r.hookWired, true);
});

// The project variable is expanded by the client, not by us. Checking the literal
// string would report every healthy install as broken — the mirror image of the bug
// this whole check exists to fix, and worse, because it fires on everyone.
test('a wired script named through the project variable is found, not reported missing', () => {
  const d = tmp();
  mkdirSync(join(d, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(d, '.rsc'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', '.rsc-state.json'), JSON.stringify({ skills: {} }));
  writeFileSync(join(d, '.rsc', 'session-start.mjs'), '// present');
  writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/.rsc/session-start.mjs"' }] }] },
  }));
  assert.equal(doctor({ target: 'claude', home: d, cwd: d }).hookWired, true);
});

// #283 — the script path was pulled out of the command with a pattern that stopped at the first
// whitespace, so in a project whose path has a space every wired script read as missing: a false
// HIGH finding and, since #277, a non-zero exit that fails any CI built on `doctor`.
function spaced() {
  const d = join(mkdtempSync(join(tmpdir(), 'rsc-doctorhooks-')), 'app entreno');
  mkdirSync(join(d, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(d, '.rsc'), { recursive: true });
  writeFileSync(join(d, '.claude', 'skills', '.rsc-state.json'), JSON.stringify({ skills: {} }));
  return d;
}
const wire = (d, ...commands) => writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify({
  hooks: { UserPromptSubmit: [{ hooks: commands.map((command) => ({ type: 'command', command })) }] },
}));

test('#283 — scripts under a spaced project path are found, double- or single-quoted', () => {
  const d = spaced();
  writeFileSync(join(d, '.rsc', 'one.mjs'), '// present');
  writeFileSync(join(d, '.rsc', 'two.mjs'), '// present');
  wire(d,
    'node "${CLAUDE_PROJECT_DIR}/.rsc/one.mjs"',
    `node '${join(d, '.rsc', 'two.mjs')}'`,
    'node "${CLAUDE_PROJECT_DIR}/.rsc/one.mjs" && node "${CLAUDE_PROJECT_DIR}/.rsc/two.mjs"');
  assert.deepEqual(missingHookScripts({ target: 'claude', home: d, cwd: d }), []);
  assert.equal(doctor({ target: 'claude', home: d, cwd: d }).hookWired, true);
});

test('#283 — a script really missing under a spaced path is reported by its whole path', () => {
  const d = spaced();
  wire(d, 'node "${CLAUDE_PROJECT_DIR}/.rsc/gone.mjs"');
  assert.deepEqual(missingHookScripts({ target: 'claude', home: d, cwd: d }), [join(d, '.rsc', 'gone.mjs')]);
});

test('#283 — an unquoted path without spaces still resolves as before', () => {
  const d = tmp();
  mkdirSync(join(d, '.claude', 'skills'), { recursive: true });
  wire(d, `node ${join(d, '.rsc', 'gone.mjs')} x`);
  assert.deepEqual(missingHookScripts({ target: 'claude', home: d, cwd: d }), [join(d, '.rsc', 'gone.mjs')]);
});

// A whole shell snippet in quotes is not a path. Reading `"node …/a.mjs && node …/b.mjs"` as one
// would report a present script missing — the same false alarm #283 removes, from the other side.
test('#283 — a quoted shell snippet is read script by script, not as one path', () => {
  const d = spaced();
  writeFileSync(join(d, '.rsc', 'a.mjs'), '// present');
  wire(d,
    `bash -c "node '\${CLAUDE_PROJECT_DIR}/.rsc/a.mjs' && node '\${CLAUDE_PROJECT_DIR}/.rsc/a.mjs'"`,
    `sh -c 'node "\${CLAUDE_PROJECT_DIR}/.rsc/a.mjs"'`,
    `sh -c 'node "\${CLAUDE_PROJECT_DIR}/.rsc/gone.mjs"'`);
  assert.deepEqual(missingHookScripts({ target: 'claude', home: d, cwd: d }), [join(d, '.rsc', 'gone.mjs')]);
});

test('#283 — a quoted snippet without a spaced path still yields each script', () => {
  const d = tmp();
  mkdirSync(join(d, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(d, '.rsc'), { recursive: true });
  writeFileSync(join(d, '.rsc', 'a.mjs'), '// present');
  wire(d, `bash -c "node ${d}/.rsc/a.mjs && node ${d}/.rsc/b.mjs"`, `sh -c 'node ${d}/.rsc/a.mjs'`);
  assert.deepEqual(missingHookScripts({ target: 'claude', home: d, cwd: d }), [join(d, '.rsc', 'b.mjs')]);
});
