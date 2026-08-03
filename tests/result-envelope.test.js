import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResultEnvelope, validateResultEnvelope } from '../scripts/lib/result-envelope.js';

const validEnvelope = {
  status: 'complete',
  executive_summary: 'Spec and tests are green.',
  artifact: '02-DOCS/wiki/sdd/specs/export-csv.md',
  next_recommended: 'plan',
  risk: 'low',
  skill_resolution: {
    used: ['sdd-init', 'specify'],
    missing: [],
    fallback: [],
    compact_rules: ['Use config.yaml before choosing commands.']
  },
  evidence: ['npm test']
};

test('validateResultEnvelope accepts complete phase envelopes', () => {
  assert.deepEqual(validateResultEnvelope(validEnvelope), []);
});

test('validateResultEnvelope rejects incomplete phase envelopes', () => {
  const errors = validateResultEnvelope({ ...validEnvelope, evidence: undefined });
  assert.ok(errors.includes('missing evidence'));
});

test('parseResultEnvelope extracts fenced json result-envelope blocks', () => {
  const parsed = parseResultEnvelope(`Done.\n\n\`\`\`json result-envelope\n${JSON.stringify(validEnvelope)}\n\`\`\`\n`);
  assert.equal(parsed.status, 'complete');
  assert.deepEqual(parsed.skill_resolution.used, ['sdd-init', 'specify']);
});

// --- the contract, not just the validator ------------------------------------------
//
// `sdd` states "Every SDD phase ends with the same parseable block". For the catalog's
// whole life that was false — 5 of the 10 canonical phases had no envelope — and this
// file passed anyway, because it only exercised the validator on a synthetic object.
// A validator with nothing to validate is the same decorative-gate pattern the rubric
// kept producing, so the claim now has a test over the real skills.
import { readFileSync } from 'node:fs';
import { join, dirname as dn } from 'node:path';
import { fileURLToPath as furl } from 'node:url';

const SKILLS = join(dn(furl(import.meta.url)), '..', 'skills');
// The chain `specify` prints, in order. These are the phases the dispatcher chains,
// so these are the ones that owe an envelope.
const CANONICAL_PHASES = [
  'constitution', 'specify', 'clarify', 'plan', 'tasks',
  'analyze', 'implement', 'verify', 'review', 'ship',
];

test('every canonical SDD phase carries a result envelope', () => {
  const missing = CANONICAL_PHASES.filter(
    (id) => !readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8').includes('```json result-envelope'),
  );
  assert.deepEqual(missing, [], `sdd claims every phase emits one; these do not: ${missing.join(', ')}`);
});

test("each phase's envelope validates and routes to a real phase", () => {
  for (const id of CANONICAL_PHASES) {
    const body = readFileSync(join(SKILLS, id, 'SKILL.md'), 'utf8');
    const parsed = parseResultEnvelope(body);
    assert.ok(parsed, `${id}: the envelope block must be parseable, not illustrative prose`);
    // The documented shape uses pipe-separated placeholders for the open fields, so
    // check the structure and the routing rather than the literal values.
    for (const key of ['status', 'executive_summary', 'artifact', 'next_recommended', 'risk', 'skill_resolution', 'evidence']) {
      assert.ok(key in parsed, `${id}: envelope is missing '${key}'`);
    }
    assert.ok(parsed.skill_resolution.used.includes(id), `${id}: skill_resolution.used must name the phase itself`);
    assert.ok(Array.isArray(parsed.evidence) && parsed.evidence.length, `${id}: evidence must be a non-empty list`);
    const next = String(parsed.next_recommended).split('|').map((s) => s.trim());
    const known = new Set([...CANONICAL_PHASES, 'sdd-init', 'debug', 'none']);
    for (const n of next) {
      assert.ok(known.has(n), `${id}: next_recommended '${n}' is not a phase in the chain`);
    }
  }
});
