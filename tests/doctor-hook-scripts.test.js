import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctor } from '../scripts/doctor.js';

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
  assert.match(hits[0].action, /sync/, 'the finding must carry its own way out');
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
