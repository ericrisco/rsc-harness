import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTextCorpus, descriptionCollisions, rankText, tokenize } from '../scripts/lib/text-rank.js';

const skills = [
  { id: 'simplify-code', description: 'Use when simplifying complex working code without behavior changes.', tags: ['refactor'] },
  { id: 'deployment', description: 'Use when deploying a verified release to production.', tags: ['deploy'] },
  { id: 'simplify-copy', description: 'Use when simplifying complex working copy without meaning changes.', tags: ['copy'] },
];

test('tokenizer folds accents and keeps multilingual words', () => {
  assert.deepEqual(tokenize('Simplificación ràpida'), ['simplificacion', 'rapida']);
});

test('TF-IDF ranker joins light lexical variants', () => {
  const ranked = rankText(buildTextCorpus(skills), 'simplified the complex function safely');
  assert.equal(ranked[0].id, 'simplify-code');
});

test('description collision detector reports overlapping contracts', () => {
  const collisions = descriptionCollisions(buildTextCorpus(skills), 0.25);
  assert.ok(collisions.some(({ left, right }) => (
    left === 'simplify-code' && right === 'simplify-copy'
  )));
});
