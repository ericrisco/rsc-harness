// The design skill's modes and visual target — the parts of it that can be checked without an agent.
//
// `design` used to assume every request was a new identity, so its brand gate blocked a spacing fix
// the same way it blocked a greenfield landing page. It now names six modes, and only the two that
// decide identity (Create, Replace) are allowed to block. That split is a contract other prose leans
// on, so it is parsed here rather than trusted.
//
// The rest is wiring: a reference nobody links is never loaded (dead weight, rubric dimension 3),
// a hand-off to a sibling that does not exist is a dead end, and Apache-2.0 material carries its
// credit. The behaviour itself (does the agent actually stop, or not) is the eval's job:
// skills/design/evals/cases.yaml, capability scenarios 3 to 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const DESIGN = join(REPO, 'skills', 'design');
const REFS = join(DESIGN, 'references');
const SKILL = join(DESIGN, 'SKILL.md');
const read = (p) => readFileSync(p, 'utf8');
const lineCount = (p) => read(p).split('\n').length;

// Returns {mode: gateCell}. Throws when the table is gone: a parser that returns {} would turn
// deleting the table into a green suite (the M9 lesson in design-tells.test.js).
function modeTable(src) {
  const start = src.indexOf('| Mode | Asked as | What may change | Brand gate |');
  if (start < 0) throw new Error('mode table not found in design/SKILL.md');
  const rows = {};
  for (const line of src.slice(start).split('\n').slice(2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    rows[cells[0].replace(/\*/g, '')] = cells[3];
  }
  return rows;
}

test('the mode table names all six modes', () => {
  const rows = modeTable(read(SKILL));
  assert.deepEqual(
    Object.keys(rows).sort(),
    ['Audit', 'Create', 'Distill', 'Extend', 'Polish', 'Replace'],
  );
});

test('only the modes that decide identity are allowed to block on the brand study', () => {
  const rows = modeTable(read(SKILL));
  for (const [mode, gate] of Object.entries(rows)) {
    const decidesIdentity = mode === 'Create' || mode === 'Replace';
    if (decidesIdentity) {
      assert.match(gate, /^blocks/, `${mode} must block until the brand study is complete`);
    } else {
      assert.match(gate, /never blocks/, `${mode} inherits the identity from the code and must not block`);
    }
  }
});

test('the STOP step is scoped to the modes that decide identity', () => {
  // The numbered STOP step is what an agent actually obeys; the table alone would be contradicted by it.
  const stop = read(SKILL).split('\n').find((l) => /\bSTOP\b/.test(l) && /^\d+\./.test(l));
  assert.ok(stop, 'the brand-grounding STOP step is missing');
  assert.match(stop, /Create or Replace/, 'the STOP step must name the modes it applies to');
});

test('every reference is linked from the body, or it is never loaded', () => {
  const body = read(SKILL);
  for (const file of readdirSync(REFS).filter((f) => f.endsWith('.md'))) {
    assert.ok(body.includes(`references/${file}`), `references/${file} is not linked from design/SKILL.md`);
  }
});

test('every hand-off to a sibling skill from the references resolves', () => {
  for (const file of readdirSync(REFS).filter((f) => f.endsWith('.md'))) {
    for (const [link] of read(join(REFS, file)).matchAll(/\.\.\/\.\.\/[a-z0-9-]+\/SKILL\.md/g)) {
      assert.ok(existsSync(join(REFS, link)), `${file} hands off to ${link}, which does not exist`);
    }
  }
});

test('the render check is in the checklist and in the verify.sh fallback that mirrors it', () => {
  const needle = /Rendered and inspected at 360px, desktop and the target size/;
  assert.match(read(SKILL), needle, 'design/SKILL.md checklist');
  assert.match(read(join(DESIGN, 'scripts', 'verify.sh')), needle, 'verify.sh print_checklist');
});

test('the Apache-2.0 material is credited where it lands', () => {
  for (const file of ['refine-and-audit.md', 'visual-target.md', 'ai-tells.md', 'signature-and-craft.md']) {
    const text = read(join(REFS, file));
    assert.match(text, /Impeccable/, `${file} must credit Impeccable`);
    assert.match(text, /Apache-2\.0/, `${file} must name the licence`);
  }
  assert.match(read(join(REFS, 'visual-target.md')), /ui-taste/, 'the image-first path is Uizze\'s own');
  assert.match(read(join(REPO, 'README.md')), /pbakaus\/impeccable.*Apache-2\.0/, 'README third-party table');
});

test('the body stays under the 400-line ceiling and the new references under their caps (P5)', () => {
  assert.ok(lineCount(SKILL) <= 400, `design/SKILL.md is ${lineCount(SKILL)} lines`);
  const caps = { 'refine-and-audit.md': 140, 'visual-target.md': 100 };
  for (const [file, cap] of Object.entries(caps)) {
    const n = lineCount(join(REFS, file));
    assert.ok(n <= cap, `${file} is ${n} lines, cap is ${cap}`);
  }
});
