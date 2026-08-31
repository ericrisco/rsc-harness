import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wireHook, unwireHook } from '../targets/_md-block.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-md-')); }

// The file rsc stamps its block into is usually the user's — in issue #249 it was the
// project's hand-written constitution, 204 lines of it, and it got 95 lines of template.
// Removing the block must undo exactly that and nothing else. Tidying someone's document
// while you are in there is the second half of the same damage.
test('stamping the block and removing it leaves the file byte-identical', () => {
  const d = tmp();
  const file = join(d, 'AGENTS.md');
  const original = '# Constitucion\n\n## Uno\ntexto\n\n\n\n## Dos, separado a proposito\ntexto\n';
  writeFileSync(file, original);
  const src = join(d, 'src.md');
  writeFileSync(src, '---\nname: suggest\n---\nCUERPO\n');

  wireHook({ hookTarget: file }, src);
  assert.notEqual(readFileSync(file, 'utf8'), original, 'the block must actually land');

  unwireHook({ hookTarget: file });
  assert.equal(readFileSync(file, 'utf8'), original, 'blank lines far from the block are the author\'s');
});

test('re-stamping replaces the block instead of duplicating it', () => {
  const d = tmp();
  const file = join(d, 'AGENTS.md');
  writeFileSync(file, '# mio\n');
  const src = join(d, 'src.md');
  writeFileSync(src, '---\nname: suggest\n---\nCUERPO\n');
  wireHook({ hookTarget: file }, src);
  wireHook({ hookTarget: file }, src);
  const doc = readFileSync(file, 'utf8');
  assert.equal(doc.split('rsc-suggest:start').length - 1, 1);
});

test('removing a block that is not there touches nothing', () => {
  const d = tmp();
  const file = join(d, 'AGENTS.md');
  writeFileSync(file, '# mio\n\n\n\nfin\n');
  const before = readFileSync(file, 'utf8');
  unwireHook({ hookTarget: file });
  assert.equal(readFileSync(file, 'utf8'), before);
});
