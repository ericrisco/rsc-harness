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

const withTimestamp = (spec, ts) => spec.replace('type: spec\n', `type: spec\ntimestamp: ${ts}\n`);

const NEW_EN = `
## Cost of not building it
It keeps hurting, at an hour a week.

## The cheapest alternative
A manual reminder. Not enough: nobody reads it.
`;

test('a complete Spanish spec passes, parentheticals and all', () => {
  const r = specCompleteness(SPANISH);
  assert.equal(r.ok, true, `missing=${r.missing} empty=${r.empty}`);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.empty, []);
});

test('English template headings are the same families', () => {
  // Post-cut on purpose: with no timestamp this fixture is exempt, and then adding the two new
  // English headings would assert nothing about them (finding G6 of the analyze gate).
  const en = withTimestamp(SPANISH, '2026-09-06')
    .replace('## Problema & por qué', '## Problem & why')
    .replace('## Objetivos (resultado)', '## Goals')
    .replace('## No-objetivos / fuera de alcance', '## Non-goals / out of scope')
    .replace('## Usuarios & contexto', '## Users & context')
    .replace('## Comportamiento (observable)', '## Behaviour')
    .replace('## Criterios de aceptación (binarios)', '## Acceptance criteria')
    .replace('## Puntos a clarificar (a plan)', '## Points to clarify')
    + NEW_EN;
  const r = specCompleteness(en);
  assert.equal(r.ok, true, `missing=${r.missing} empty=${r.empty}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// El corte retroactivo de las dos familias nuevas.
//
// Spec: 02-DOCS/wiki/sdd/specs/intent-scrutiny.md — una spec no cierra sin decir qué pasa si no se
// construye ni cuál es la alternativa más barata. Pero el corpus son 34 specs históricas que no
// pueden rellenarlo a posteriori, así que la exigencia empieza en la fecha de activación y las
// anteriores quedan exentas. El corte se deriva del `timestamp:` del propio fichero (P3: el
// contenido es el ledger — una lista de exentas sería contabilidad paralela).

const toEnglish = (spec) => spec
  .replace('## Problema & por qué', '## Problem & why')
  .replace('## Objetivos (resultado)', '## Goals')
  .replace('## No-objetivos / fuera de alcance', '## Non-goals / out of scope')
  .replace('## Usuarios & contexto', '## Users & context')
  .replace('## Comportamiento (observable)', '## Behaviour')
  .replace('## Criterios de aceptación (binarios)', '## Acceptance criteria')
  .replace('## Puntos a clarificar (a plan)', '## Points to clarify');

const NEW_ES = `
## Qué pasa si no lo construimos
Sigue doliendo, y el coste es una hora por semana.

## La alternativa más barata
Un recordatorio a mano. No basta porque nadie lo mira.
`;

// Sólo la guía de la plantilla, sin tocar: es lo que deja una pasada apresurada.
const NEW_EN_GUIDANCE = `
## Cost of not building it
<What concretely happens if nobody does this, and what it costs.>

## The cheapest alternative
<What would solve most of it without building this, and why that is not enough.>
`;

// (a) post-corte sin las secciones → rojo. En inglés: la plantilla es inglesa.
test('post-cut: a spec missing the two new sections fails and names them', () => {
  const r = specCompleteness(withTimestamp(toEnglish(SPANISH), '2026-09-06'));
  assert.equal(r.ok, false, 'una spec post-corte sin las dos secciones no puede cerrar');
  assert.ok(r.missing.includes('inaction'), `missing=${r.missing}`);
  assert.ok(r.missing.includes('cheapest'), `missing=${r.missing}`);
});

// (b) post-corte con sólo la guía → rojo por vacía. Es el caso que ejerce los PREFIJOS ingleses:
// en (a) las secciones están ausentes, así que allí no se casa ningún encabezado.
test('post-cut: the two new sections holding only template guidance count as empty', () => {
  const r = specCompleteness(withTimestamp(toEnglish(SPANISH), '2026-09-06') + NEW_EN_GUIDANCE);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, [], 'los encabezados ingleses SÍ casan: presentes, no ausentes');
  assert.ok(r.empty.includes('inaction'), `empty=${r.empty}`);
  assert.ok(r.empty.includes('cheapest'), `empty=${r.empty}`);
});

// (c) post-corte con las dos rellenas → verde. En español: ejerce los prefijos del corpus, y es la
// prueba de que la dimensión es ADITIVA (las 7 viejas y las 2 nuevas satisfechas a la vez).
test('post-cut: a spec carrying both new sections passes — the dimension is additive', () => {
  const r = specCompleteness(withTimestamp(SPANISH, '2026-09-06') + NEW_ES);
  assert.equal(r.ok, true, `missing=${r.missing} empty=${r.empty}`);
});

// (d) pre-corte sin ellas → verde. Las 34 specs históricas no se ponen rojas retroactivamente.
test('pre-cut: a spec written before the activation date is exempt', () => {
  const r = specCompleteness(withTimestamp(SPANISH, '2026-09-05'));
  assert.equal(r.ok, true, `una spec del 2026-09-05 no puede exigirse: missing=${r.missing}`);
  assert.deepEqual(r.missing, []);
});

// (e) frontmatter presente pero SIN timestamp → exento. Falla hacia el lado seguro.
test('no timestamp in the frontmatter falls on the exempt side', () => {
  const r = specCompleteness(SPANISH); // su frontmatter es `type: spec` a secas
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

// (f) la cadena vacía NO lanza. Es un camino distinto de (e): `parseFrontmatter('')` tira
// `no frontmatter block`, mientras `---\ntype: spec\n---` devuelve {} sin tirar. Y el CLI lo
// ejecuta de verdad, en scripts/spec-gate.js, para imprimir `unchecked`.
test('the empty string does not throw, and lands exempt', () => {
  let r;
  assert.doesNotThrow(() => { r = specCompleteness(''); }, 'el CLI llama a specCompleteness("")');
  // Sale roja por las 7 familias de siempre — pero jamás por las dos nuevas.
  assert.ok(!r.missing.includes('inaction'), `missing=${r.missing}`);
  assert.ok(!r.missing.includes('cheapest'), `missing=${r.missing}`);
});

// (g) la exención se DECLARA. Es la única regla que este ciclo añade y que ningún otro mecanismo
// vería, y un verde más estrecho que la regla que aparenta imponer es la puerta decorativa otra vez.
test('the gate declares the retroactive exemption instead of hiding it', () => {
  const { unchecked } = specCompleteness('');
  assert.ok(
    unchecked.some((u) => /anteriores a|exent/i.test(u)),
    `unchecked no declara la exención: ${JSON.stringify(unchecked, null, 2)}`,
  );
});
