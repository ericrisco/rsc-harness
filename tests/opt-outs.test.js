import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_OPT_OUTS, MACHINE_OPT_OUTS, projectOptOuts } from '../targets/opt-outs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

test('the two sets are disjoint and sorted', () => {
  for (const [name, list] of [['project', PROJECT_OPT_OUTS], ['machine', MACHINE_OPT_OUTS]]) {
    assert.deepEqual(list, [...list].sort(), `${name} list must stay sorted`);
    assert.equal(new Set(list).size, list.length, `${name} list must have no duplicates`);
  }
  const overlap = PROJECT_OPT_OUTS.filter((n) => MACHINE_OPT_OUTS.includes(n));
  assert.deepEqual(overlap, [], 'a switch is one kind of decision or the other, never both');
});

// The partition is only honest if it COVERS the switches that exist. A new `.no-thing` added to a
// hook without a line here would be classified by omission — silently machine-local — and the
// person who added it would never find out. So the source tree is the oracle, not this file.
test('every .no-* switch the code checks is classified', () => {
  const seen = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!/\.(js|mjs)$/.test(entry.name) || entry.name === 'opt-outs.js') continue;
      for (const m of readFileSync(path, 'utf8').matchAll(/['"`]\.no-([a-z0-9-]+)['"`]/g)) seen.add(m[1]);
    }
  };
  walk(join(ROOT, 'targets'));
  walk(join(ROOT, 'scripts'));
  const classified = new Set([...PROJECT_OPT_OUTS, ...MACHINE_OPT_OUTS]);
  const unclassified = [...seen].filter((n) => !classified.has(n)).sort();
  assert.deepEqual(unclassified, [], `unclassified .no-* switches: ${unclassified.join(', ')}`);
});

test('.no-harness never counts as a project decision', () => {
  assert.equal(PROJECT_OPT_OUTS.includes('harness'), false);
  assert.deepEqual(projectOptOuts(['gitmoji', 'harness', 'context7']), ['gitmoji']);
});

test('projectOptOuts drops unknown names, dedupes and sorts', () => {
  assert.deepEqual(projectOptOuts(['ship-guard', 'gitmoji', 'gitmoji', 'invented']), ['gitmoji', 'ship-guard']);
  assert.deepEqual(projectOptOuts(undefined), []);
});
