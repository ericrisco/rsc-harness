import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';

const SCHEMA_VERSION = 1;

export function backupsDir(cwd = process.cwd()) {
  return join(cwd, '.rsc', 'backups');
}

export function createBackup({ cwd = process.cwd(), operation, target, paths, cliVersion, now = new Date() }) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  const id = uniqueSnapshotId({ cwd, now, operation, target });
  const root = join(backupsDir(cwd), id);
  const filesRoot = join(root, 'files');
  mkdirSync(filesRoot, { recursive: true });

  const entries = uniquePaths.map((absPath) => snapshotEntry({ cwd, root, absPath }));
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    id,
    createdAt: now.toISOString(),
    operation,
    target,
    cwd,
    cliVersion,
    entries,
  };
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function listBackups({ cwd = process.cwd() } = {}) {
  const dir = backupsDir(cwd);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((id) => readManifest({ cwd, id }))
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function restoreBackup({ cwd = process.cwd(), id, dryRun = false }) {
  const snapshot = resolveSnapshot({ cwd, id });
  const changed = [];
  for (const entry of snapshot.entries) {
    const absPath = safeJoin(cwd, entry.path);
    changed.push(absPath);
    if (dryRun) continue;
    restoreEntry({ cwd, snapshot, entry, absPath });
  }
  return { snapshot, changed };
}

function snapshotEntry({ cwd, root, absPath }) {
  const rel = safeRelative(cwd, absPath);
  if (!existsSync(absPath)) return { path: rel, existed: false, kind: 'missing' };

  const stat = lstatSync(absPath);
  if (stat.isSymbolicLink()) {
    return { path: rel, existed: true, kind: 'symlink', linkTarget: readlinkSync(absPath) };
  }

  const contentPath = join('files', rel);
  const contentAbs = join(root, contentPath);
  mkdirSync(dirname(contentAbs), { recursive: true });
  if (stat.isDirectory()) {
    cpSync(absPath, contentAbs, { recursive: true });
    return { path: rel, existed: true, kind: 'dir', contentPath };
  }

  cpSync(absPath, contentAbs);
  return { path: rel, existed: true, kind: 'file', contentPath };
}

function restoreEntry({ cwd, snapshot, entry, absPath }) {
  if (!entry.existed) {
    rmSync(absPath, { recursive: true, force: true });
    return;
  }

  rmSync(absPath, { recursive: true, force: true });
  mkdirSync(dirname(absPath), { recursive: true });
  if (entry.kind === 'symlink') {
    symlinkSync(entry.linkTarget, absPath, process.platform === 'win32' ? 'junction' : undefined);
    return;
  }

  const contentAbs = join(backupsDir(cwd), snapshot.id, entry.contentPath);
  cpSync(contentAbs, absPath, { recursive: entry.kind === 'dir' });
}

function resolveSnapshot({ cwd, id }) {
  if (!id) throw new Error('restore requires a snapshot id or latest');
  if (id === 'latest') {
    const latest = listBackups({ cwd })[0];
    if (!latest) throw new Error('no backups found');
    return latest;
  }

  const manifest = readManifest({ cwd, id });
  if (!manifest) throw new Error(`backup not found: ${id}`);
  return manifest;
}

function readManifest({ cwd, id }) {
  const path = join(backupsDir(cwd), id, 'manifest.json');
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function uniqueSnapshotId({ cwd, now, operation, target }) {
  const base = snapshotId({ now, operation, target });
  let id = base;
  let counter = 2;
  while (existsSync(join(backupsDir(cwd), id))) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  return id;
}

function snapshotId({ now, operation, target }) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  return `${stamp}-${safeId(operation)}-${safeId(target || 'all')}`;
}

function safeId(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function safeRelative(cwd, absPath) {
  const rel = relative(cwd, absPath);
  if (!rel || rel.startsWith('..') || rel.split(sep).includes('..')) {
    throw new Error(`path is outside project root: ${absPath}`);
  }
  return rel.split(sep).join('/');
}

// A manifest path is split on BOTH separators, because the input is file content — readManifest()
// reads it off disk — and not every manifest was written by safeRelative() on this platform. A path
// stored with Windows separators (`..\..\somewhere`) has no '/' to split on, so the old check saw a
// single segment, found no '..', and handed the raw string to join() — which honours backslashes on
// Windows. The guard only guarded on POSIX.
//
// Splitting into real segments does both jobs at once: `..` becomes visible to the check, and the
// path is rebuilt by join() rather than passed through, so the separator the manifest happened to
// use stops mattering. Found while fixing the Windows hook-duplication bug: same family.
const pathSegments = (value) => value.split(/[/\\]+/).filter(Boolean);

function safeJoin(cwd, relPath) {
  if (!relPath || isAbsolute(relPath) || pathSegments(relPath).includes('..')) {
    throw new Error(`path is outside project root: ${relPath}`);
  }
  return join(cwd, ...pathSegments(relPath));
}
