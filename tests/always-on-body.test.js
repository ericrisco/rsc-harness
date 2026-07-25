import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDD_GATE_TEXT } from '../targets/hook-once.mjs';

// The always-on body is the single most expensive piece of context rsc owns: it is injected at
// every session start and again after every compaction. These are the invariants that let it stay
// small without quietly losing what only it can do. See 02-DOCS/wiki/sdd/specs/always-on-diet.md.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const body = readFileSync(join(ROOT, 'skills/suggest/SKILL.md'), 'utf8');

// A ceiling, not a floor. It was 11417 bytes when it elaborated a rule the per-turn hook already
// emits in full; this guards the regrowth, and is the one number to revisit deliberately.
const BODY_CEILING_BYTES = 8000;

test('always-on body: stays under its context ceiling', () => {
  const bytes = Buffer.byteLength(body);
  assert.ok(bytes < BODY_CEILING_BYTES, `always-on body is ${bytes} B, ceiling ${BODY_CEILING_BYTES} B`);
});

test('always-on body: still states the SDD routing rule and its exceptions', () => {
  assert.match(body, /`specify`/, 'names the destination');
  assert.match(body, /one-line, low-risk change/i, 'names the trivial-change exception');
  assert.match(body, /`debug`/, 'names the bug-fix route');
  // Hookless assistants (AGENTS.md family, Cursor) have no per-turn gate: this body is the ONLY
  // place the rule exists for them. Shortening it is fine; removing it is a silent regression.
  assert.match(body, /before any\s+code is written/i, 'the rule itself, not just a pointer');
});

test('always-on body: no longer over-constrains, per our own skill-rubric', () => {
  // skill-rubric dimension 7 forbids borrowed urgency blocks and rationalization tables in ANY
  // catalog skill. The always-on layer used to be the one place that broke its own rule.
  assert.doesNotMatch(body, /stop rationalizing/i, 'no rationalization table');
  assert.doesNotMatch(body, /non-negotiable/i, 'no urgency block');
  // Only prose can shout: strip code spans so filenames (SKILL.md, 02-DOCS/…) are not mistaken
  // for directives.
  const prose = body.replace(/`[^`]*`/g, '');
  const yelled = (prose.match(/\b[A-Z]{4,}\b/g) || []).filter((w) => w !== 'SDD');
  assert.equal(yelled.length, 0, `unexpected shouted directives: ${yelled.join(', ')}`);
});

test('always-on body: keeps the jobs only it can do', () => {
  assert.match(body, /catalog --available/, 'the not-installed skill detector');
  assert.match(body, /consult/, 'the caveat that the lexical ranker is not the decider');
  assert.match(body, /user-profile\.md/, 'the first-contact onboarding gate');
  assert.match(body, /\.rsc\/\.no-harness/, 'the opt-out that makes onboarding inert');
  assert.match(body, /bloque-brújula/, 'the orientation close');
});

test('always-on body: does not re-elaborate what the per-turn gate already emits', () => {
  // The gate text is emitted verbatim every turn on Claude Code. The body may point at the rule;
  // reproducing its wording is the duplication this spec removes.
  const gateLines = SDD_GATE_TEXT.split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 40 && !l.startsWith('='));
  const echoed = gateLines.filter((l) => body.includes(l));
  assert.deepEqual(echoed, [], `body reproduces gate lines verbatim: ${echoed.join(' | ')}`);
});
