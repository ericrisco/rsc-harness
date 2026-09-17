import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// FTD — Fast-Track Development — is the lane ordinary work takes. The change it encodes is not a new
// method: it is that the harness stops sending every request that sounds like building through the
// ten-phase chain, which is what constitution P7 has said since it was written ("la fricción es
// proporcional al riesgo; un sistema que molesta en el 80% inofensivo acaba apagado") and what the
// gate has never done.
//
// Two of these tests are size ceilings, and they are not tidiness. `context-budget` measured the
// always-on layer at 11.4 KB and left a diet declared as pending work; adding a third lane to a
// layer somebody already decided was too heavy has to come out of the same budget, not on top of it.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(HERE, '..', ...p), 'utf8');

const GATE = /SDD_GATE_TEXT = `([\s\S]*?)`;/.exec(read('targets', 'hook-once.mjs'))[1];
const SUGGEST = read('skills', 'suggest', 'SKILL.md');

// Measured on the parent commit, before this feature existed.
const GATE_BYTES_BEFORE = 905;
const SUGGEST_BYTES_BEFORE = 7282;

test('1 · the per-turn gate offers three outcomes, not two', () => {
  assert.match(GATE, /\bFTD\b/, 'the everyday lane must be named');
  assert.match(GATE, /\bSDD\b/, 'and the formal chain must still exist');
  assert.match(GATE, /question|pregunta|answer|inform/i,
    'and the third outcome — a request for information — must be reachable, which is the one the gate never had');
});

test('2 · the gate no longer routes all change intent into the chain', () => {
  assert.doesNotMatch(GATE, /MUST route it through SDD/,
    'this is the sentence P7 has been contradicting since it was written');
});

test('3 · the gate never says the harness may enter the chain on its own', () => {
  // Gentle-AI abandoned size and risk as selectors for a reason, and the user chose the same rule:
  // the harness may PROPOSE the chain, the human selects it.
  assert.match(GATE, /propose|propon/i, 'proposing is the harness\'s half');
  assert.match(GATE, /accept|acepta|explicit|explícit/i, 'selecting is the human\'s');
});

test('4 · and it did not get bigger doing it', () => {
  assert.ok(Buffer.byteLength(GATE) <= GATE_BYTES_BEFORE,
    `the per-turn gate is injected on every single turn: ${Buffer.byteLength(GATE)} > ${GATE_BYTES_BEFORE} bytes`);
});

test('5 · the always-on body declares the three lanes and the read-only default', () => {
  assert.match(SUGGEST, /\bFTD\b/);
  assert.match(SUGGEST, /read-only|sólo lectura|solo lectura/i,
    'a request for information must not authorise a change — the concept the harness has never had');
});

test('6 · and the always-on body did not get bigger either', () => {
  assert.ok(Buffer.byteLength(SUGGEST) <= SUGGEST_BYTES_BEFORE,
    `always-on body: ${Buffer.byteLength(SUGGEST)} > ${SUGGEST_BYTES_BEFORE} bytes (context-budget)`);
});

test('7 · the lane has a skill that owns its method', () => {
  assert.equal(existsSync(join(HERE, '..', 'skills', 'ftd', 'SKILL.md')), true,
    'a lane the harness routes to must be a skill somebody can read');
  const ftd = read('skills', 'ftd', 'SKILL.md');
  assert.match(ftd, /Fast-Track Development/);
  assert.match(ftd, /02-DOCS/, 'the feature document lives in the workspace wiki, not in the code repo');
});

// ── the routing corpus: what makes the decisor checkable at all ───────────────────────────────
//
// The decisor is prose and judgement, by the user's explicit choice over a deterministic
// alternative. P2 still applies — a binding rule is born with the mechanism that checks it — so the
// mechanism is a fixture corpus with an expected lane per request, scored by the existing behavior
// eval. What `npm test` can check deterministically is that the corpus is honest: that it covers
// every lane, and that it contains the cases designed to catch the failure this lane exists to fix.

test('8 · the routing corpus exists and every lane is represented', () => {
  const path = join(HERE, '..', 'skills', 'ftd', 'evals', 'routing.json');
  assert.equal(existsSync(path), true, 'the decisor is prose; without a corpus nothing checks it');
  const corpus = JSON.parse(readFileSync(path, 'utf8'));
  const lanes = new Set(corpus.cases.map((c) => c.expect));
  assert.deepEqual([...lanes].sort(), ['answer', 'ftd', 'sdd']);
  for (const c of corpus.cases) {
    assert.ok(c.request && c.expect && c.why, `every case states its reasoning: ${JSON.stringify(c)}`);
  }
});

test('9 · the corpus carries the cases this lane exists because of', () => {
  const corpus = JSON.parse(readFileSync(join(HERE, '..', 'skills', 'ftd', 'evals', 'routing.json'), 'utf8'));
  const answers = corpus.cases.filter((c) => c.expect === 'answer');
  assert.ok(answers.length >= 3, 'the read-only lane is the new one; it needs more than a token case');
  assert.ok(corpus.cases.some((c) => c.expect === 'ftd' && /grande|big|large|many|varios/i.test(c.why)),
    'a big change that needs no formal artifacts is FTD: size must not select the chain');
  assert.ok(corpus.cases.some((c) => c.expect === 'sdd' && /(explicit|pide|asks|propos)/i.test(c.why)),
    'and the chain is entered by request or accepted proposal, never by the harness alone');
});
