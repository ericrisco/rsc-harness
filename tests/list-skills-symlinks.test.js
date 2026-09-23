import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSkills } from '../scripts/lib/capabilities.js';
import { targetPaths } from '../targets/index.js';

// A skill is a directory with a SKILL.md in it. HOW you get there — a real directory or a symlink —
// is the installer's business, and it deliberately differs per platform: links on macOS and Linux so
// seventeen assistants share one copy, real files on Windows where relative dir symlinks need
// Developer Mode. Counting them must not depend on that choice, and it did: `Dirent.isDirectory()`
// describes the LINK, never its target, so every linked skill was invisible — and the `&&`
// short-circuited before the `existsSync` that would have followed it.
//
// It survived because Windows has real directories and CI never built the linked layout.

/** The layout `targets/index.js` actually writes on macOS/Linux: a pointer per assistant. */
function linkedInstall(target, ids) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-links-'));
  const paths = targetPaths(target, root, root);
  mkdirSync(paths.root, { recursive: true });
  for (const id of ids) {
    const real = join(root, '.rsc', 'skills', id);
    mkdirSync(real, { recursive: true });
    writeFileSync(join(real, 'SKILL.md'), `# ${id}\n`);
    symlinkSync(real, paths.skillDir(id), 'dir');
  }
  return root;
}

test('skills reached through a symlink are counted', () => {
  const root = linkedInstall('claude', ['orient', 'ftd', 'harness']);
  const found = listSkills({ target: 'claude', cwd: root, home: root }).map((s) => s.id);
  assert.deepEqual([...new Set(found)].sort(), ['ftd', 'harness', 'orient']);
});

test('real directories still count, because Windows has no links', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-real-'));
  const paths = targetPaths('claude', root, root);
  mkdirSync(join(paths.root, 'orient'), { recursive: true });
  writeFileSync(join(paths.root, 'orient', 'SKILL.md'), '# orient\n');
  assert.deepEqual(listSkills({ target: 'claude', cwd: root, home: root }).map((s) => s.id), ['orient']);
});

// Following links must not become "believe anything". These three are the ways a directory can look
// like a skill and not be one, and the check is still the same single question: is there a SKILL.md
// behind this name?
test('a directory with no SKILL.md is not a skill', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-empty-'));
  const paths = targetPaths('claude', root, root);
  mkdirSync(join(paths.root, 'notaskill'), { recursive: true });
  assert.deepEqual(listSkills({ target: 'claude', cwd: root, home: root }), []);
});

test('a dangling symlink is not a skill', () => {
  const root = linkedInstall('claude', ['orient']);
  const paths = targetPaths('claude', root, root);
  symlinkSync(join(root, '.rsc', 'skills', 'gone'), paths.skillDir('gone'), 'dir');
  assert.deepEqual(listSkills({ target: 'claude', cwd: root, home: root }).map((s) => s.id), ['orient']);
});

test('a plain file is not a skill, however it is named', () => {
  const root = linkedInstall('claude', ['orient']);
  const paths = targetPaths('claude', root, root);
  writeFileSync(join(paths.root, 'readme'), 'not a skill');
  assert.deepEqual(listSkills({ target: 'claude', cwd: root, home: root }).map((s) => s.id), ['orient']);
});

// The other half of the same bug, which the issue did not reach: a target that keeps one FILE per
// skill asks `e.isFile()`, and that is false for a symlink to a file for exactly the same reason.
test('a file-per-skill target counts a linked skill file', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-filelink-'));
  const paths = targetPaths('cursor', root, root);
  const probe = paths.skillDir('__probe__');
  const ext = probe.slice(probe.lastIndexOf('__probe__') + '__probe__'.length);
  mkdirSync(paths.root, { recursive: true });
  const real = join(root, '.rsc', 'skills', 'orient');
  mkdirSync(real, { recursive: true });
  writeFileSync(join(real, `body${ext}`), '# orient\n');
  symlinkSync(join(real, `body${ext}`), paths.skillDir('orient'), 'file');
  assert.deepEqual(listSkills({ target: 'cursor', cwd: root, home: root }).map((s) => s.id), ['orient']);
});
