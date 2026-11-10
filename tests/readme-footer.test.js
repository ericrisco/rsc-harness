import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The README closes with a plain italic "Made in Andorra" line under the License section:
// no emoji, no link, one blank line between them.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');
const lines = README.replace(/\n+$/, '').split('\n');

test('the README ends with the Made in Andorra footer after the License section', () => {
  const n = lines.length;
  assert.equal(lines[n - 1], '*Made in Andorra*');
  assert.equal(lines[n - 2], '');
  assert.equal(lines[n - 3], 'MIT. See [LICENSE](LICENSE).');
  assert.equal(lines[n - 5], '## License');
});

test('Andorra is mentioned exactly once in the README', () => {
  assert.equal(README.match(/Andorra/g)?.length ?? 0, 1);
});
