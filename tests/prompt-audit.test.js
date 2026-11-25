// prompt:audit — every rule is seen failing on a bad fixture and passing on a good one, and the whole
// catalog passes. Spec: 02-DOCS/wiki/sdd/specs/harness-prompt-audit.md (RSC workspace).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditText, retiredModels, CURRENT_CLAUDE, RULES } from '../scripts/lib/prompt-audit.js';
import { auditCatalog } from '../scripts/prompt-audit.js';

const rules = (text, ctx) => auditText(text, ctx).map((f) => f.rule);
const skillIds = new Set(['ftd', 'asdd']);

test('retired-model: an older Claude id fails, the current generation passes', () => {
  for (const bad of [
    'model: claude-sonnet-4-6',
    'heavy: claude-opus-4-8',
    'light: claude-haiku-4-5-20251001',
    'model: claude-sonnet-4.6',
    'model="claude-3-5-haiku-latest"',
    'model: claude-opus-5',
  ]) assert.deepEqual(rules(bad), ['retired-model'], bad);
  for (const good of ['model: claude-sonnet-5-5', 'heavy: claude-opus-5-5', 'light: claude-haiku-5-5', 'claude-fable-5-2', 'claude-code is a CLI']) {
    assert.deepEqual(rules(good), [], good);
  }
});

test('retired-model follows CURRENT_CLAUDE, not a hardcoded list', () => {
  assert.deepEqual(retiredModels('claude-sonnet-5-5'), []);
  const saved = CURRENT_CLAUDE.sonnet;
  CURRENT_CLAUDE.sonnet = [6, 0];
  try {
    assert.deepEqual(retiredModels('claude-sonnet-5-5'), ['claude-sonnet-5-5']);
  } finally {
    CURRENT_CLAUDE.sonnet = saved;
  }
});

test('generator-id: an internal id offered as something to invoke fails', () => {
  assert.deepEqual(rules('Invoke memory:learn for exactly one proposed lesson: $ARGUMENTS'), ['generator-id']);
  assert.deepEqual(rules('Use the sello backing for this checkpoint: $ARGUMENTS'), ['generator-id']);
  assert.deepEqual(rules('For exactly one proposed lesson: run `npx @ericrisco/rsc memory learn`'), []);
});

test('history-phrase: the prompt narrating its own past fails; a fact about the world passes', () => {
  for (const bad of [
    'This used to be an instruction in this paragraph, and it was skipped.',
    '**You no longer run the cleanup; you check that it ran.**',
    'onboarding used to end with a request: now run harness',
    'the worst defect this panel ever found was found by the privacy lens',
    'That exact mistake shipped twice in one day here.',
  ]) assert.deepEqual(rules(bad), ['history-phrase'], bad);
  for (const good of [
    'The fix is unproven until the original repro no longer fires.',
    'WCAG 2.2 removed 4.1.1 Parsing.',
    '**You do not run the cleanup; you check that it ran.**',
  ]) assert.deepEqual(rules(good), [], good);
});

test('dead-skill-link: a link to a missing skill fails, an existing one passes', () => {
  assert.deepEqual(rules('see `../nope/SKILL.md`', { skillIds }), ['dead-skill-link']);
  assert.deepEqual(rules('see `../ftd/SKILL.md` and ../../asdd/SKILL.md', { skillIds }), []);
});

test('an allow with a reason silences only its own rule, on its line or the line above', () => {
  assert.deepEqual(rules('claude-opus-4 // prompt-audit: allow retired-model — Kiro names its own models'), []);
  assert.deepEqual(rules('<!-- prompt-audit: allow retired-model — migration guide example -->\nclaude-sonnet-4-6'), []);
  assert.deepEqual(rules('claude-opus-4-8 // prompt-audit: allow history-phrase — wrong rule'), ['retired-model']);
  assert.deepEqual(rules('<!-- prompt-audit: allow retired-model — one line only -->\nok\nclaude-sonnet-4-6'), ['retired-model']);
});

test('an allow without a reason is itself a finding and silences nothing', () => {
  assert.deepEqual(rules('claude-sonnet-4-6 // prompt-audit: allow retired-model').sort(), ['allow-without-reason', 'retired-model']);
});

test('every finding carries the line, the rule and a way out (constitution §6)', () => {
  const [f] = auditText('a\nheavy: claude-opus-4-8');
  assert.equal(f.line, 2);
  assert.equal(f.fix, RULES['retired-model']);
  assert.match(f.fix, /\S/);
});

test('the published catalog passes prompt:audit', () => {
  const { files, findings } = auditCatalog();
  assert.ok(files > 500, `scanned ${files} files; the walk is not reaching the catalog`);
  assert.deepEqual(findings.map((f) => `${f.file}:${f.line} ${f.rule} ${f.match}`), []);
});

test('legacy ids (claude-instant, claude-2.x, claude-3) and dated 5.x ids are retired', () => {
  for (const bad of ['claude-instant-1.2', 'claude-2.1', 'claude-2', 'claude-3-opus-20240229', 'claude-opus-5-20260301', 'claude-sonnet-4-20250514']) {
    assert.deepEqual(rules(bad), ['retired-model'], bad);
  }
  assert.deepEqual(rules('claude-haiku-5-5-20261001'), []);
});

test('every history phrase and each of its alternatives fails', () => {
  for (const bad of [
    'you no longer need to check it', 'you no longer have to check it',
    'the best catch this lens ever found', 'the best catch this gate ever found', 'the best catch this skill ever found',
    'That is how this lens found the worst one.',
  ]) assert.deepEqual(rules(bad), ['history-phrase'], bad);
});

test('generator-id tolerates extra whitespace', () => {
  assert.deepEqual(rules('Invoke  memory:learn now'), ['generator-id']);
});

test('an HTML-comment allow without a reason is a finding and silences nothing', () => {
  assert.deepEqual(rules('claude-sonnet-4-6 <!-- prompt-audit: allow retired-model -->').sort(), ['allow-without-reason', 'retired-model']);
  assert.deepEqual(rules('<!-- prompt-audit: allow retired-model -->\nclaude-sonnet-4-6').sort(), ['allow-without-reason', 'retired-model']);
  assert.deepEqual(rules('claude-sonnet-4-6 <!-- prompt-audit: allow retired-model — migration example -->'), []);
});

test('an allow naming a rule that does not exist is reported', () => {
  assert.deepEqual(rules('claude-opus-4-8 <!-- prompt-audit: allow retired-models — typo -->').sort(), ['allow-unknown-rule', 'retired-model']);
});
