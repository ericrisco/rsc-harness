import { test } from 'node:test';
import assert from 'node:assert/strict';
import { specCompleteness, OPEN_POINT_TYPES } from '../scripts/lib/spec-gate.js';

const SPANISH = `---
type: spec
---
# Spec — algo

## Problema & por qué
Duele.

## Objetivos (resultado)
- Que deje de doler.

## No-objetivos / fuera de alcance
- Lo de al lado.

## Usuarios & contexto
El autor.

## Comportamiento (observable)
- Main: pasa algo.

## Criterios de aceptación (binarios)
- Given X, When Y, Then Z.

## Puntos a clarificar (a plan)
- **pregunta abierta** — ¿cuál es el umbral?
`;

test('a complete Spanish spec passes, parentheticals and all', () => {
  const r = specCompleteness(SPANISH);
  assert.equal(r.ok, true, `missing=${r.missing} empty=${r.empty}`);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test('English template headings are the same families', () => {
  const en = SPANISH
    .replace('## Problema & por qué', '## Problem & why')
    .replace('## Objetivos (resultado)', '## Goals')
    .replace('## No-objetivos / fuera de alcance', '## Non-goals / out of scope')
    .replace('## Usuarios & contexto', '## Users & context')
    .replace('## Comportamiento (observable)', '## Behaviour')
    .replace('## Criterios de aceptación (binarios)', '## Acceptance criteria')
    .replace('## Puntos a clarificar (a plan)', '## Points to clarify');
  assert.equal(specCompleteness(en).ok, true);
});

test('a missing family fails and is named', () => {
  const r = specCompleteness(SPANISH.replace('## Comportamiento (observable)\n- Main: pasa algo.\n', ''));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['behaviour']);
});

test('a section present but empty fails — a heading is not content', () => {
  const r = specCompleteness(SPANISH.replace('El autor.', ''));
  assert.equal(r.ok, false);
  assert.deepEqual(r.empty, ['users']);
});

test('a section holding only the template guidance line counts as empty', () => {
  const r = specCompleteness(SPANISH.replace('El autor.', '<Who acts, and what they want.>'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.empty, ['users']);
});

test('all four open-point types are recognised', () => {
  const points = OPEN_POINT_TYPES.map((t) => `- **${t}** — cosa`).join('\n');
  const r = specCompleteness(SPANISH.replace('- **pregunta abierta** — ¿cuál es el umbral?', points));
  assert.deepEqual(r.openPoints.map((p) => p.type), OPEN_POINT_TYPES);
  assert.deepEqual(r.untyped, []);
});

test('an untyped open point defaults to the costliest type and does not block', () => {
  const r = specCompleteness(SPANISH.replace('- **pregunta abierta** — ¿cuál es el umbral?', '- ¿y esto?'));
  assert.equal(r.ok, true);
  assert.equal(r.untyped.length, 1);
  assert.equal(r.openPoints[0].type, 'pregunta abierta');
  assert.equal(r.openPoints[0].typed, false);
});

test('the gate declares what it does not check, so its green cannot be oversold', () => {
  const r = specCompleteness(SPANISH);
  assert.ok(r.unchecked.length > 0);
  assert.ok(r.unchecked.some((u) => /suposición/i.test(u)));
});
