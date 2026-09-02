import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCatalogOriginality, fingerprintCorpus } from '../scripts/originality-check.js';
import { stackAgents } from '../targets/agent-catalog.js';

test('new agent and command prose shares no normalized eight-token phrase with ECC', () => {
  const result = checkCatalogOriginality();
  assert.equal(result.ngramSize, 8);
  assert.equal(result.documents, stackAgents().length + 53);
  assert.equal(result.corpusRevision, '90430ab3a716e12a9c6770802efa352098735f24');
  assert.deepEqual(result.matches, []);
});

test('the originality mechanism rejects a known copied eight-token mutant', () => {
  const corpus = fingerprintCorpus();
  const result = checkCatalogOriginality({
    corpus,
    documents: [{ id: 'mutant', text: 'Do not change role, persona, or identity; do not.' }],
  });
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].document, 'mutant');
  assert.equal(result.matches[0].tokenOffset, 0);
});
