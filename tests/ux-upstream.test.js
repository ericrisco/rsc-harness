// The `ux` skill ships two MIT skills unmodified under `upstream/` and routes into them. These tests
// hold that claim: every shipped file matches the hash recorded with its upstream commit, the
// upstream SKILL.md bodies carry no front matter (so they are never discovered as second skills),
// the licences travel with the package, every path the skill routes to exists, and the skill is in
// the default floor in place of the retired `ui-engineering`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SKILL_FLOOR } from '../scripts/lib/default-skill-floor.js';
import { RETIRED_SKILLS } from '../scripts/lib/retired-skills.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills', 'ux');
const UPSTREAM = join(SKILL, 'upstream');
const manifest = JSON.parse(readFileSync(join(UPSTREAM, 'UPSTREAM.json'), 'utf8'));
const body = () => readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

test('every upstream file matches the hash recorded with its commit, and nothing unrecorded ships', () => {
  for (const [name, source] of Object.entries(manifest)) {
    assert.match(source.commit, /^[0-9a-f]{40}$/, `${name}: pinned commit`);
    assert.equal(source.license, 'MIT', `${name}: licence`);
    const dir = join(UPSTREAM, name);
    const shipped = files(dir).map((p) => relative(dir, p)).sort();
    assert.deepEqual(shipped, Object.keys(source.files).sort(), `${name}: shipped files = recorded files`);
    for (const [file, hash] of Object.entries(source.files)) {
      assert.equal(sha(join(dir, file)), hash, `${name}/${file} drifted from upstream`);
    }
  }
});

test('upstream bodies carry no front matter and their licences ship with them', () => {
  for (const name of Object.keys(manifest)) {
    const guide = readFileSync(join(UPSTREAM, name, 'GUIDE.md'), 'utf8');
    assert.ok(!guide.startsWith('---'), `${name}/GUIDE.md must not be discovered as a skill`);
    assert.match(readFileSync(join(UPSTREAM, name, 'LICENSE'), 'utf8'), /^MIT License/);
  }
  assert.ok(!files(SKILL).some((p) => p !== join(SKILL, 'SKILL.md') && p.endsWith('SKILL.md')),
    'only one SKILL.md inside skills/ux');
});

test('every path the skill routes to exists', () => {
  const text = body();
  const refs = new Set();
  for (const [, p] of text.matchAll(/`(upstream\/[^`\s]+\.(?:md|json))`/g)) refs.add(p);
  for (const [, p] of text.matchAll(/\((references\/[^)\s]+\.md)\)/g)) refs.add(p);
  for (const [, p] of text.matchAll(/`…\/([^`\s]+\.md)`/g)) refs.add(`upstream/ux-designer/references/${p}`);
  for (const [, p] of text.matchAll(/`(\d\d[ab]?-[a-z-]+\.md)`/g)) refs.add(`upstream/ux-designer/references/${p}`);
  assert.ok(refs.size >= 30, `${refs.size} routed paths`);
  for (const p of refs) assert.ok(existsSync(join(SKILL, p)), `routed path missing: ${p}`);
  for (const ref of readdirSync(join(UPSTREAM, 'ux-designer', 'references'))) {
    assert.ok(text.includes(ref), `upstream reference never routed: ${ref}`);
  }
});

test('the description stays within the 350-character ceiling', () => {
  const desc = /^description: "(.*)"$/m.exec(body())[1];
  assert.ok(desc.length <= 350, `${desc.length} chars`);
});

test('ux is preinstalled and ui-engineering is retired into it', () => {
  assert.ok(DEFAULT_SKILL_FLOOR.includes('ux'));
  assert.equal(RETIRED_SKILLS['ui-engineering'], 'ux');
  assert.ok(!existsSync(join(ROOT, 'skills', 'ui-engineering')));
});
