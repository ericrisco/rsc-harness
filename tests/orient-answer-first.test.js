import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The owner had to ask three times for the same explanation, and each time the answer was at the
// bottom of the reply. Three habits from `i-have-adhd` (ayghri, MIT), rewritten for `orient`: our
// close stays the brújula, which is why "end when the answer is done" was NOT taken.
const orient = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'orient', 'SKILL.md'), 'utf8');
const habits = orient.slice(orient.indexOf('Three habits make those rules hold'), orient.indexOf('## The register'));

test('the answer goes in the first line', () => {
  assert.match(habits, /\*\*The answer goes first\.\*\* The first line is the answer, the verdict or the action/);
});

test('visible lists stop at five, and nothing that matters is dropped', () => {
  assert.match(habits, /\*\*Five visible items at most\.\*\*/);
  assert.match(habits, /Never drop an item that matters/);
});

test('a check before sending, which keeps the brújula as the close and real doubt as doubt', () => {
  assert.match(habits, /\*\*Check before you send\.\*\*/);
  assert.match(habits, /the brújula is the close/);
  assert.match(habits, /keep one that carries real doubt/);
});

test('the source is credited', () => {
  assert.match(habits, /adapted from the `i-have-adhd` skill, ayghri, MIT/);
});
