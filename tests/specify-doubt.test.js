import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Las reglas que `specify` gana en la spec intent-scrutiny son prosa dentro de un cuerpo de skill, y
// una regla de comportamiento sin aserción es la puerta decorativa que la constitución prohíbe (P2).
// Ninguna aserción de aquí puede comprobar que el agente OBEDEZCA —eso es el caso de eval, que se
// corre a mano y se declara no automático— pero sí que la instrucción esté escrita y que la
// contraria no. Es el mismo trato que reciben las demás reglas declaradas de este repo.
//
// Se aseveran ANCLAS CORTAS, no párrafos: el cuerpo se reescribirá muchas veces y un test que exige
// una redacción exacta da rojos falsos hasta que alguien lo borra.

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(HERE, '..', ...p), 'utf8');

const BODY = read('skills', 'specify', 'SKILL.md');
const CASES = read('skills', 'specify', 'evals', 'cases.yaml');

test('the first response to an intent is not a verdict on the idea', () => {
  assert.match(BODY, /not a verdict on the idea/i, 'falta la regla de registro');
  assert.match(BODY, /restatement/i, 'la primera respuesta debe reformular');
  assert.match(BODY, /strongest objection/i, 'la primera respuesta debe traer la objeción más fuerte');
});

test('an absent objection is a valid result, so the rule cannot manufacture one', () => {
  // El fallo simétrico: una regla que exige objetar siempre produce objeciones de adorno, y una capa
  // que dispara en todos los casos mide el modelo y no la spec.
  assert.match(BODY, /silence is a valid result/i);
});

test('specify runs the FRAME block and names where it comes from', () => {
  assert.match(BODY, /idea-refinement/, '`idea-refinement` está en el catálogo y nada la invocaba');
  assert.match(BODY, /\bFRAME\b/, 'falta el paso FRAME antes de la ronda de preguntas');
  assert.match(BODY, /current workaround/i, 'FRAME incluye qué se hace hoy, incluido no hacer nada');
});

test('"do not build it" is an enumerated direction, not a courtesy', () => {
  assert.match(BODY, /don't build it|do not build it/i);
});

// Esta pasa ya hoy y seguirá pasando: es una guarda de regresión, no un rojo de TDD. Se escribe
// igual porque el defecto que originó la spec es exactamente éste, y el día que alguien lo
// reintroduzca conviene que algo se entere.
test('no instruction anywhere tells the agent to validate or praise the idea', () => {
  const praise = /(tell|say to|let) the user (it|the idea) is (a )?(great|good|excellent)|praise the idea|validate the idea/i;
  assert.doesNotMatch(BODY, praise);
});

// El trigger NO se asevera ausente: `fire on the faintest sign` y `too eager to brainstorm is cheap`
// son la instrucción de DISPARO, de la que dependen los siete `should_trigger` de la skill. Borrarla
// habría cambiado el enrutado creyendo cambiar el tono (hallazgo F8 de la puerta `analyze`).
test('the early-detection trigger survives untouched', () => {
  assert.match(BODY, /fire on the \*\*faintest\*\* sign|fire on the faintest sign/i);
});

// eval-lint comprueba los mínimos de conteo y que `route_to` resuelva; NO mira `must_include`, así
// que saldría 0 igual si el escenario no se hubiera escrito (hallazgo F7).
test('the eval suite carries a behavioural case for the register rule', () => {
  assert.match(CASES, /strongest objection/i, 'el escenario del registro no está en cases.yaml');
  assert.match(CASES, /Cost of not building it/i, 'el must_include de las dos secciones no está');
});
