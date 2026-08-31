import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { applyInstall } from '../scripts/install-apply.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-portable-')); }

// A harness that names the folder it was born in cannot be shared, cannot survive a
// rename, and cannot be committed — the whole "share it by git" goal dies on this one
// line. So the check is blunt: the project's own absolute path must appear nowhere.
test('nothing rsc writes contains this machine absolute path', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  const settings = readFileSync(join(d, '.claude', 'settings.json'), 'utf8');
  assert.ok(!settings.includes(d), `settings.json still names ${d}`);
});

test('the wiring points at the project through a variable, not a path', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  const settings = readFileSync(join(d, '.claude', 'settings.json'), 'utf8');
  assert.match(settings, /\$\{CLAUDE_PROJECT_DIR\}/, 'commands must resolve the project at run time');
});

test('renaming the project folder leaves the wiring still correct', async () => {
  const d = tmp();
  await applyInstall({ skillIds: ['orient', 'suggest'], target: 'claude', home: d, cwd: d });
  const moved = join(dirname(d), `${d.split('/').pop()}-moved`);
  renameSync(d, moved);
  const settings = readFileSync(join(moved, '.claude', 'settings.json'), 'utf8');
  assert.ok(!settings.includes(d), 'the old location must not survive the move');
  assert.match(settings, /\$\{CLAUDE_PROJECT_DIR\}/);
});
