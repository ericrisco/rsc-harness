import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fenceBalance } from '../scripts/lib/skill-lint.js';

// The defect this gate exists for: a stray closing delimiter after a paragraph. It left
// specify/SKILL.md with 15 delimiters, so every block boundary from there to EOF was inverted
// and half the skill rendered as one code block. Found by hand; nothing checked it.
test('an orphan delimiter after a paragraph is unbalanced, and the line is named', () => {
  const body = [
    '# Skill',
    '',
    '```text',
    'a step',
    '```',
    '',
    '**The gate is the point of this skill.**',
    '```',
    '',
    'more prose',
  ].join('\n');
  const r = fenceBalance(body);
  assert.equal(r.balanced, false);
  assert.equal(r.fences, 3);
  assert.equal(r.opened, 8); // 1-indexed line of the unpaired delimiter
});

test('a balanced body passes and reports its pair count', () => {
  const body = ['# Skill', '', '```js', 'const a = 1;', '```', '', '```', 'plain', '```'].join('\n');
  const r = fenceBalance(body);
  assert.equal(r.balanced, true);
  assert.equal(r.fences, 4);
  assert.equal(r.opened, null);
});

test('a body with no code blocks at all is balanced', () => {
  const r = fenceBalance('# Skill\n\nJust prose, one table:\n\n| a | b |\n|---|---|\n');
  assert.equal(r.balanced, true);
  assert.equal(r.fences, 0);
});

test('an indented delimiter inside a block is not counted as a boundary', () => {
  // Only column-0 delimiters are boundaries; this keeps the check honest about what it catches.
  const body = ['```md', '    ```', 'nested sample', '```'].join('\n');
  assert.equal(fenceBalance(body).balanced, true);
});

test('the real specify body is balanced', () => {
  const body = readFileSync(new URL('../skills/specify/SKILL.md', import.meta.url), 'utf8');
  const r = fenceBalance(body);
  assert.equal(r.balanced, true, `specify has ${r.fences} delimiters, unpaired at line ${r.opened}`);
});

// The function above is one half of principle 2; the wiring is the other. A gate nobody has seen
// fail is a gate nobody knows works, so this drives validateBodies over a fake catalog.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBodies } from '../scripts/build-manifest.js';

function catalog(bodies) {
  const base = mkdtempSync(join(tmpdir(), 'rsc-lint-'));
  for (const [id, body] of Object.entries(bodies)) {
    mkdirSync(join(base, id), { recursive: true });
    writeFileSync(join(base, id, 'SKILL.md'), body);
  }
  return base;
}

test('validateBodies reports the offending skill by id and line', () => {
  const base = catalog({
    good: '# Good\n\n```txt\nfine\n```\n',
    broken: '# Broken\n\nprose\n```\n\nmore\n',
  });
  const errs = validateBodies(base);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^broken: unbalanced code-block delimiter opened at line 4/);
});

test('validateBodies is silent on a clean catalog', () => {
  assert.deepEqual(validateBodies(catalog({ a: '# A\n\nprose only\n' })), []);
});
