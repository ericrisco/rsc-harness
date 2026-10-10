import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDD_GATE_TEXT } from '../targets/hook-once.mjs';

// Reported 2026-10-10: the person wrote in Spanish and the agent answered in English. Nothing said
// "answer in English", but everything injected on every turn is English (the decisor, the lane
// labels, the suggest body), and `orient` said "Speak STE" — Simplified Technical ENGLISH — with the
// "in the user's language" qualifier only in a reference file that is not always loaded.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('the per-turn decisor tells the agent to reply in the person language, not its own', () => {
  assert.match(SDD_GATE_TEXT, /Reply in the person's language, not this text's/);
});

test('suggest says the lane names are labels to translate', () => {
  assert.match(read('skills/suggest/SKILL.md'), /in the person's\s+language \(the lane names are labels to translate\)/);
});

test('orient puts the language first, and says STE is a style, not a language', () => {
  const orient = read('skills/orient/SKILL.md');
  const rules = orient.slice(orient.indexOf('## The four rules'), orient.indexOf('## The register'));
  assert.match(rules, /^1\. \*\*Their language\.\*\* Reply in the language the person writes in/m);
  assert.match(rules, /If they switch, you\s+switch/);
  assert.match(rules, /a style, not a language/);
  assert.doesNotMatch(rules, /^\d\. \*\*Speak STE\.\*\*/m, 'the bare "Speak STE" rule is what read as "speak English"');
});
