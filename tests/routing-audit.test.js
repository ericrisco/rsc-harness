import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditRouting, loadRoutingCases } from '../scripts/routing-audit.js';
import { createRanker } from '../scripts/consult.js';
import { loadManifest } from '../scripts/lib/manifest.js';

test('loads every local trigger and negative routing prompt', () => {
  const cases = loadRoutingCases();
  assert.ok(cases.length >= 2996);
  assert.ok(cases.some(({ skill, section }) => skill === 'performance' && section === 'positive'));
  assert.ok(cases.some(({ routeTo }) => routeTo === 'scaling'));
});

test('routing audit measures positives, negatives, and declared owners', async () => {
  const manifest = {
    skills: [
      { id: 'alpha', description: 'Use when handling alpha widgets.', tags: ['alpha'] },
      { id: 'beta', description: 'Use when handling beta reports.', tags: ['beta'] },
    ],
  };
  const result = await auditRouting(manifest, [
    { skill: 'alpha', section: 'positive', prompt: 'handle an alpha widget', routeTo: null },
    { skill: 'alpha', section: 'negative', prompt: 'prepare a beta report', routeTo: 'beta' },
  ]);
  assert.equal(result.rank1, 1);
  assert.equal(result.negativeSelfRank1, 0);
  assert.equal(result.routedTop5, 1);
  assert.equal(result.routeBeatsOwner, 1);
});

test('new audit-derived skills rank in the top five for every declared trigger', async () => {
  const ids = new Set([
    'decision-challenge',
    'deprecation',
    'idea-refinement',
    'simplify-code',
    'source-grounded-development',
  ]);
  const ranker = await createRanker(loadManifest());
  try {
    for (const row of loadRoutingCases().filter(({ skill, section }) => (
      ids.has(skill) && section === 'positive'
    ))) {
      const ranked = ranker.rank(row.prompt).slice(0, 5).map(({ id }) => id);
      assert.ok(
        ranked.includes(row.skill),
        `${row.skill} should rank top five for "${row.prompt}"; got ${ranked.join(', ')}`,
      );
    }
  } finally {
    ranker.close();
  }
});
