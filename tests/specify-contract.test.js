import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OPEN_POINT_TYPES } from '../scripts/lib/spec-gate.js';

// PRESENCE tests, declared as such. They prove the prose says what specify-contract asked for; they
// do NOT prove the agent behaves differently. Behavioural verification is the capability scenarios
// in skills/specify/evals/cases.yaml, and the spec records that this delivery measures presence,
// not ablation.
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const specify = read('../skills/specify/SKILL.md');
const clarify = read('../skills/clarify/SKILL.md');
const elicit = read('../skills/specify/references/eliciting-requirements.md');
const template = read('../skills/specify/references/spec-template.md');
const evals = read('../skills/specify/evals/cases.yaml');

test('the gate rule is stated once, not three times', () => {
  const hits = specify.match(/one-line, zero-risk|too simple/g) || [];
  assert.equal(hits.length, 1, `gate rule appears ${hits.length}x`);
});

test('specify has an exit gate that names a runnable command', () => {
  assert.match(specify, /## Exit gate/);
  assert.match(specify, /npm run spec:gate/);
});

test('the frontier replaces one-question-per-turn in body and reference', () => {
  assert.match(specify, /ask the frontier, never cross a dependency/i);
  assert.doesNotMatch(specify, /Never batch/);
  assert.match(elicit, /## The frontier pattern/);
  assert.doesNotMatch(elicit, /one-question-at-a-time pattern/);
});

test('no section still prescribes one question per turn — the dial included', () => {
  // The accompaniment dial is where this contradiction survived the first pass: L3 said "still one
  // question at a time" long after the discipline changed.
  // Exactly one mention is legitimate: the sentence that names the old rule in order to reject it.
  const mentions = specify.match(/one.question.(?:at a time|per turn)/gi) || [];
  assert.equal(mentions.length, 1, `"one question per turn" appears ${mentions.length}x`);
  assert.match(specify, /The cure is not one question per turn/);
  assert.doesNotMatch(specify, /still one question at a time/i);
  assert.doesNotMatch(elicit, /one.question.(?:at a time|per turn)/i);
  assert.match(specify, /one round per frontier/);
});

test('the frontier rule names no harness tool, so it ports to every target', () => {
  // Portability was the decision: state the rule, prefer a native selector where one exists.
  assert.doesNotMatch(specify, /AskUserQuestion/);
  assert.doesNotMatch(elicit, /AskUserQuestion/);
  assert.match(specify, /native question selector/i);
});

test('all four open-point types appear in specify, the template and clarify', () => {
  for (const t of OPEN_POINT_TYPES) {
    assert.ok(specify.includes(t), `specify is missing "${t}"`);
    assert.ok(template.includes(t), `the template is missing "${t}"`);
    assert.ok(clarify.includes(t), `clarify is missing "${t}"`);
  }
});

test('clarify acts on the types instead of re-asking them, and must declare outcomes', () => {
  assert.match(clarify, /## The typed handoff/);
  assert.match(clarify, /\*\*Validate\*\*, don't re-ask/);
  assert.match(clarify, /every typed point in the handoff has its declared outcome/i);
});

test('the evals no longer demand one question per turn, and require the dependency case', () => {
  assert.doesNotMatch(evals, /ONE at a time|one at a time/);
  assert.match(evals, /FRONTIER in one numbered round/);
  assert.match(evals, /hinges on another still-open one is held for the next round/);
});

test('the leading word is repeated as a token, not defined once and dropped', () => {
  const hits = specify.match(/\bcontract\b/gi) || [];
  assert.ok(hits.length >= 5, `"contract" appears only ${hits.length}x`);
  assert.match(specify, /is this a clause of the contract, or a detail of how it gets met/i);
});

test('the pruned anti-pattern rows left a pointer to where each rule lives positively', () => {
  // Scope the count to the anti-patterns table itself: the file has other tables, and one of them
  // (the four types) is new function this delivery added on purpose.
  const section = specify.slice(specify.indexOf('## Anti-patterns'), specify.indexOf('## Project grounding'));
  const rows = (section.match(/^\| .* \| .* \|$/gm) || []).length - 2; // header + separator
  assert.equal(rows, 7, `anti-patterns table holds ${rows} rows`);
  assert.match(specify, /are stated positively above/);
  // Each pruned rule must be findable in positive voice, or the prune lost it.
  for (const positive of [/ask the frontier/i, /Read the `constitution`/, /PROPOSE 2-3 approaches/, /## Approval is its own exchange/]) {
    assert.match(specify, positive);
  }
});

test('approval-is-not-approval survives untouched — it was an explicit non-goal', () => {
  assert.match(specify, /## Approval is its own exchange/);
  assert.match(specify, /An answer to a question is not an approval/);
  assert.match(specify, /approved in autopilot, not item by item/);
});
