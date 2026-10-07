import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import * as memory from '../targets/session-memory-core.mjs';
import { syncInstalled } from '../scripts/install-apply.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

// Team simulation D13 (G4). The harness commits `02-DOCS/raw/worklog/.gitkeep` so the folder exists
// in every clone. The memory core read "anything tracked under worklog/" as "the team commits the
// worklog" and every teammate got «rsc memory: tracked worklog detected…» — about a placeholder.
// And a teammate's `sync` never excluded the personal profile the lead's onboarding excluded, so the
// first answer to the one onboarding question sat untracked, one `git add -A` from the team repo.

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-team-mem-'));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.name', 'T'); git(cwd, 'config', 'user.email', 't@x');
  writeFileSync(join(cwd, 'safe.txt'), 'base\n');
  git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'init');
  return cwd;
}
function withPlaceholder(cwd) {
  mkdirSync(join(cwd, '02-DOCS', 'raw', 'worklog'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS', 'raw', 'worklog', '.gitkeep'), '');
  git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'placeholder');
  return cwd;
}

test('a tracked .gitkeep alone is not a tracked worklog: no warning, and the store is ignored', () => {
  const cwd = withPlaceholder(repo());
  const chosen = memory.chooseMemoryRoot(cwd);
  assert.notEqual(chosen.reason, 'tracked-worklog');
  memory.capture({ cwd, sessionId: 's1', target: 'claude', event: 'start' });
  writeFileSync(join(cwd, 'safe.txt'), 'changed\n');
  const first = memory.capture({ cwd, sessionId: 's1', target: 'claude', event: 'edit', editDelta: 1 });
  assert.doesNotMatch(first.notice ?? '', /tracked worklog/i);
  assert.equal(git(cwd, 'check-ignore', relative(cwd, first.path)), relative(cwd, first.path), 'the journal is never committable');
  assert.equal(git(cwd, 'status', '--porcelain', '--', '02-DOCS'), '', 'nothing new to commit under 02-DOCS');
});

test('a clone that already keeps its journal in .rsc/memory stays there, silently', () => {
  const cwd = withPlaceholder(repo());
  writeFileSync(join(cwd, '.gitignore'), '.rsc/\n');
  mkdirSync(join(cwd, '.rsc', 'memory', 'sessions'), { recursive: true });
  writeFileSync(join(cwd, '.rsc', 'memory', 'sessions', 'claude--old.json'), '{}\n');
  const chosen = memory.chooseMemoryRoot(cwd);
  assert.equal(chosen.root, join(cwd, '.rsc', 'memory'), 'the existing history is not orphaned');
  assert.notEqual(chosen.reason, 'tracked-worklog');
  memory.capture({ cwd, sessionId: 's2', target: 'claude', event: 'start' });
  writeFileSync(join(cwd, 'safe.txt'), 'changed\n');
  assert.equal(memory.capture({ cwd, sessionId: 's2', target: 'claude', event: 'edit', editDelta: 1 }).notice, null);
});

test('a worklog with real tracked notes still falls back, and says so once', () => {
  const cwd = withPlaceholder(repo());
  writeFileSync(join(cwd, '02-DOCS', 'raw', 'worklog', 'notes.md'), 'team notes\n');
  git(cwd, 'add', '-A'); git(cwd, 'commit', '-qm', 'notes');
  assert.equal(memory.chooseMemoryRoot(cwd).reason, 'tracked-worklog');
});

test('sync on a teammate clone excludes the personal profile like onboarding does', async () => {
  const cwd = repo();
  writeManifest(cwd, { targets: ['claude'], skills: ['orient', 'suggest'], ownSkills: [], catalogVersion: '3.0.8', tier: null, optOuts: [] });
  await syncInstalled({ target: 'claude', home: cwd, cwd });
  const exclude = readFileSync(join(cwd, '.git', 'info', 'exclude'), 'utf8').split('\n');
  assert.ok(exclude.includes('/02-DOCS/wiki/harness/user-profile.md'), 'the profile is excluded in this clone');
  mkdirSync(join(cwd, '02-DOCS', 'wiki', 'harness'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'harness', 'user-profile.md'), 'technical_level: technical\n');
  assert.equal(git(cwd, 'status', '--porcelain', '--', '02-DOCS/wiki/harness/user-profile.md'), '');
  assert.ok(existsSync(join(cwd, '.claude', 'skills', 'suggest')));
});
