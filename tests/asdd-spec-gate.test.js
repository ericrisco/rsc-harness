import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specCompleteness } from '../scripts/lib/spec-gate.js';

// The cut is the spec's literal date (AC8), never read back from the code under test.
const ASDD_FAMILIES_SINCE = '2026-11-03';

// ASDD (4.0): a spec answers four questions or the gate refuses it — from the cut on, never before.
// Spec: 02-DOCS/wiki/sdd/specs/asdd-v4.md (criterion 8).

const BASE = `---
type: spec
timestamp: TS
---
# Spec — algo

## Problema & por qué
Duele.

## Qué pasa si no lo construimos
Sigue doliendo.

## La alternativa más barata
Un recordatorio. No basta.

## Objetivos
- Que deje de doler.

## Fuera de alcance
- Un QR que nadie pidió.

## Usuarios & contexto
El autor.

## Comportamiento
- Pasa algo.

## Criterios de aceptación
- Given X, When Y, Then Z.

## Puntos a clarificar
- **suposición tomada** — el umbral es 3.
`;

const FOUR = `
## Qué podrá hacer el usuario
Exportar sus facturas, si es dueño de la cuenta.

## Qué resultado obtiene
Un CSV igual al de referencia aprobado.

## Qué debe respetar
La exportación de abonos sigue igual.

## Cómo lo demuestra
Test que compara con el CSV de referencia; su salida queda en la verificación.
`;

const at = (ts, body = BASE) => body.replace('TS', ts);

test('a spec dated on the cut without the four questions is refused, naming each missing one', () => {
  const r = specCompleteness(at(ASDD_FAMILIES_SINCE));
  assert.equal(r.ok, false);
  for (const fam of ['can', 'result', 'respect', 'proof']) assert.ok(r.missing.includes(fam), `missing=${r.missing}`);
});

test('the same spec passes once the four questions are answered', () => {
  const r = specCompleteness(at(ASDD_FAMILIES_SINCE) + FOUR);
  assert.equal(r.ok, true, `missing=${r.missing} empty=${r.empty}`);
});

test('one question missing is enough to refuse — the proof most of all', () => {
  const noProof = FOUR.replace(/## Cómo lo demuestra[\s\S]*$/, '');
  const r = specCompleteness(at('2027-02-01') + noProof);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['proof']);
});

test('a heading with only template guidance under it is empty, not answered', () => {
  const guided = FOUR.replace('Test que compara con el CSV de referencia; su salida queda en la verificación.', '<how the check runs and what evidence remains>');
  const r = specCompleteness(at(ASDD_FAMILIES_SINCE) + guided);
  assert.equal(r.ok, false);
  assert.ok(r.empty.includes('proof'), `empty=${r.empty}`);
});

test('English headings are the same four families', () => {
  const en = FOUR
    .replace('Qué podrá hacer el usuario', 'What the user can do')
    .replace('Qué resultado obtiene', 'What result they get')
    .replace('Qué debe respetar', 'What it must respect')
    .replace('Cómo lo demuestra', 'How it proves it');
  assert.equal(specCompleteness(at(ASDD_FAMILIES_SINCE) + en).ok, true);
});

test('a spec written before the cut is exempt from the four', () => {
  const r = specCompleteness(at('2026-11-02'));
  assert.equal(r.ok, true, `missing=${r.missing}`);
});

test('"Fuera de alcance" alone counts as the non-goals section', () => {
  const r = specCompleteness(at(ASDD_FAMILIES_SINCE) + FOUR);
  assert.ok(!r.missing.includes('nongoals'));
});

test('the gate declares the ASDD exemption instead of hiding it', () => {
  assert.ok(specCompleteness('').unchecked.some((u) => u.includes(ASDD_FAMILIES_SINCE)));
});

test('the shipped template carries the four headings the gate demands', () => {
  const template = readFileSync(new URL('../skills/specify/references/spec-template.md', import.meta.url), 'utf8');
  const four = ['What the user can do', 'What result they get', 'What it must respect', 'How it proves it']
    .map((h) => `\n## ${h}\nfilled.\n`).join('');
  for (const h of ['What the user can do', 'What result they get', 'What it must respect', 'How it proves it']) {
    assert.ok(template.includes(`## ${h}`), `template lost "## ${h}"`);
  }
  assert.equal(specCompleteness(at('2026-11-20') + four).ok, true, 'the template headings are the families the gate reads');
});

test('a spec dated a few days after the cut is held to the four as well', () => {
  assert.equal(specCompleteness(at('2026-11-20')).ok, false);
});
