import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agentByName, REFUTER_FOUR_INPUTS } from '../targets/agents.js';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/refuter-corpus.json', import.meta.url), 'utf8'));

test('the behavioral corpus labels one real defect and one tempting false positive per lens', () => {
  assert.deepEqual(corpus.map((entry) => entry.agent).sort(), [
    'refuter-correctness', 'refuter-security', 'refuter-tests',
  ]);
  for (const entry of corpus) {
    assert.match(entry.realDefect.line, /:\d+$/);
    assert.match(entry.realDefect.failureMode, /\S/);
    assert.ok(['HIGH', 'CRITICAL'].includes(entry.realDefect.severity));
    assert.match(entry.temptingFalsePositive.reasonToOmit, /\S/);
  }
});

test('each lens carries the same byte-identical four-input contract and anti-noise gate', () => {
  assert.equal(typeof REFUTER_FOUR_INPUTS, 'string');
  for (const entry of corpus) {
    const body = agentByName(entry.agent).body;
    assert.ok(body.includes(REFUTER_FOUR_INPUTS), `${entry.agent}: four-input contract drifted`);
    for (const phrase of [
      'Before reporting any finding',
      'exact changed line',
      'concrete input, state, and wrong result',
      'caller, import, and relevant test',
      'existing guards',
      'HIGH or CRITICAL',
      'zero findings',
    ]) assert.match(body, new RegExp(phrase, 'i'), `${entry.agent}: ${phrase}`);
  }
});

test('each labeled case has its distinguishing signals represented in its lens', () => {
  for (const entry of corpus) {
    const body = agentByName(entry.agent).body;
    for (const signal of entry.requiredSignals) {
      assert.match(body, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `${entry.agent}: ${signal}`);
    }
  }
});
