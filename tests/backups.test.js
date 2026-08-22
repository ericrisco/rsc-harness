import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupsDir, createBackup, listBackups, restoreBackup } from '../scripts/lib/backups.js';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'rsc-backup-'));
}

test('createBackup snapshots existing files and restoreBackup restores them', () => {
  const cwd = tmp();
  const file = join(cwd, 'AGENTS.md');
  writeFileSync(file, 'before\n');

  const snap = createBackup({ cwd, operation: 'install', target: 'codex', paths: [file], cliVersion: '0.0.0-test' });
  writeFileSync(file, 'after\n');

  const restored = restoreBackup({ cwd, id: snap.id });

  assert.equal(readFileSync(file, 'utf8'), 'before\n');
  assert.ok(restored.changed.some((p) => p.endsWith('AGENTS.md')));
});

test('restoreBackup removes managed files that were missing before the snapshot', () => {
  const cwd = tmp();
  const file = join(cwd, '.codex', 'rsc', 'fastapi');

  const snap = createBackup({ cwd, operation: 'install', target: 'codex', paths: [file], cliVersion: '0.0.0-test' });
  mkdirSync(file, { recursive: true });
  writeFileSync(join(file, 'SKILL.md'), 'created\n');

  restoreBackup({ cwd, id: snap.id });

  assert.equal(existsSync(file), false);
});

test('restoreBackup supports dry-run without mutating files', () => {
  const cwd = tmp();
  const file = join(cwd, 'AGENTS.md');
  writeFileSync(file, 'before\n');
  const snap = createBackup({ cwd, operation: 'install', target: 'codex', paths: [file], cliVersion: '0.0.0-test' });
  writeFileSync(file, 'after\n');

  const preview = restoreBackup({ cwd, id: snap.id, dryRun: true });

  assert.equal(readFileSync(file, 'utf8'), 'after\n');
  assert.ok(preview.changed.some((p) => p.endsWith('AGENTS.md')));
});

test('listBackups returns newest snapshots first and latest restores newest', () => {
  const cwd = tmp();
  const first = createBackup({
    cwd,
    operation: 'install',
    target: 'codex',
    paths: [],
    cliVersion: '0.0.0-test',
    now: new Date('2026-06-06T10:00:00Z'),
  });
  const second = createBackup({
    cwd,
    operation: 'sync',
    target: 'codex',
    paths: [],
    cliVersion: '0.0.0-test',
    now: new Date('2026-06-06T11:00:00Z'),
  });

  const listed = listBackups({ cwd });
  const latest = restoreBackup({ cwd, id: 'latest', dryRun: true });

  assert.equal(listed[0].id, second.id);
  assert.equal(listed[1].id, first.id);
  assert.equal(latest.snapshot.id, second.id);
});

test('createBackup records symlinks as symlinks', () => {
  const cwd = tmp();
  const real = join(cwd, '.rsc', 'skills', 'fastapi');
  const link = join(cwd, '.claude', 'skills', 'fastapi');
  mkdirSync(real, { recursive: true });
  writeFileSync(join(real, 'SKILL.md'), 'skill\n');
  mkdirSync(join(cwd, '.claude', 'skills'), { recursive: true });
  try {
    symlinkSync('../../.rsc/skills/fastapi', link, 'dir');
  } catch {
    return;
  }

  const snap = createBackup({ cwd, operation: 'install', target: 'claude', paths: [link], cliVersion: '0.0.0-test' });

  assert.equal(snap.entries[0].kind, 'symlink');
  assert.equal(lstatSync(link).isSymbolicLink(), true);
});

test('restoreBackup rejects manifest paths outside the project root', () => {
  const cwd = tmp();
  const root = join(backupsDir(cwd), 'bad-snapshot');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'bad-snapshot',
    createdAt: '2026-06-06T10:00:00.000Z',
    operation: 'restore',
    target: 'codex',
    cwd,
    cliVersion: '0.0.0-test',
    entries: [{ path: '../outside.txt', existed: false, kind: 'missing' }],
  }, null, 2));

  assert.throws(() => restoreBackup({ cwd, id: 'bad-snapshot', dryRun: true }), /outside project root/);
});

// --- path-traversal guard: both separators ---------------------------------
// safeJoin's traversal check split the manifest path on '/' only, then handed the raw string to
// join(). A manifest entry written with Windows separators — `..\..\somewhere` — has no '/' to split
// on, so the check saw a single segment, found no '..', and passed it straight to join(), which DOES
// honour backslashes on Windows. A guard that only guards on POSIX is the P2 pattern pointed at
// restore, and the input is file content (readManifest), not in-process data.
//
// Found while fixing the Windows hook-duplication bug: same family, different subsystem.
function manifestWith(cwd, entryPath) {
  const snap = createBackup({
    cwd, operation: 'install', target: 'claude',
    paths: [join(cwd, 'AGENTS.md')], cliVersion: '0.0.0-test',
  });
  const file = join(backupsDir(cwd), snap.id, 'manifest.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.entries = [{ path: entryPath, existed: false, kind: 'missing' }];
  writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  return snap.id;
}

for (const evil of ['../../escaped.txt', '..\\..\\escaped.txt', 'a/../../escaped.txt', 'a\\..\\..\\escaped.txt']) {
  test(`restoreBackup refuses a manifest path that climbs out: ${JSON.stringify(evil)}`, () => {
    const cwd = tmp();
    writeFileSync(join(cwd, 'AGENTS.md'), 'x\n');
    const id = manifestWith(cwd, evil);
    assert.throws(
      () => restoreBackup({ cwd, id, dryRun: true }),
      /outside project root/,
      `a manifest path with '..' was accepted: ${evil}`,
    );
  });
}

test('a legitimate nested manifest path still restores, on either separator', () => {
  // The other half: a guard that rejects everything is as useless as one that rejects nothing.
  for (const good of ['.claude/settings.json', '.claude\\settings.json']) {
    const cwd = tmp();
    writeFileSync(join(cwd, 'AGENTS.md'), 'x\n');
    const id = manifestWith(cwd, good);
    const r = restoreBackup({ cwd, id, dryRun: true });
    assert.equal(r.changed.length, 1, `rejected a legitimate path: ${good}`);
    assert.ok(
      r.changed[0].endsWith(join('.claude', 'settings.json')),
      `resolved to the wrong place: ${r.changed[0]}`,
    );
  }
});
