import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Las reglas que `specify` gana con la spec intent-scrutiny son prosa dentro de un cuerpo de skill,
// y una regla declarada sin comprobación es la puerta decorativa que la constitución prohíbe (P2).
//
// La primera versión de este fichero ERA esa puerta decorativa. Un refutador sustituyó el cuerpo
// entero de `specify` por catorce líneas que ordenaban elogiar la idea y no objetar, con las anclas
// metidas en un comentario HTML rotulado «ninguna de estas líneas es una instrucción», y salió 7/7
// verde. Un test que vigila una regla contra el teatro, siendo teatro.
//
// Lo que cambió, y por qué cada cosa:
//   1. Se descartan los COMENTARIOS HTML. Un ancla dentro de un comentario no es una instrucción,
//      y era el vector exacto del ataque. Las vallas de código NO se descartan: en esta skill la
//      tabla del recorrido vive dentro de una, y es lo que un agente sigue de verdad.
//   2. Las anclas son ESTRUCTURALES: no basta que la cadena aparezca en el fichero, tiene que
//      aparecer bajo el encabezado que la posee. Una mención suelta ya no cuenta.
//   3. La guarda negativa universal se retiró, y abajo se dice por qué en lugar de fingirla.

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(HERE, '..', ...p), 'utf8');

const RAW = read('skills', 'specify', 'SKILL.md');
const CASES = read('skills', 'specify', 'evals', 'cases.yaml');

// Un comentario HTML no es una instrucción para nadie.
const BODY = RAW.replace(/<!--[\s\S]*?-->/g, '');

/** El cuerpo de la sección cuyo encabezado casa, hasta el siguiente encabezado. */
function section(re) {
  const chunks = BODY.split(/\n(?=#{2,4} )/);
  const hit = chunks.find((c) => re.test(c.split('\n', 1)[0]));
  assert.ok(hit, `no hay ninguna sección cuyo encabezado case con ${re}`);
  return hit;
}

test('the register rule lives in its own section, not as a stray mention', () => {
  const s = section(/not a verdict on the idea/i);
  assert.match(s, /restatement/i, 'la primera respuesta debe reformular');
  assert.match(s, /strongest objection/i, 'y traer la objeción más fuerte');
  assert.match(s, /silence is a valid result/i, 'y poder no traer ninguna, sin inventarla');
});

test('the ban on praise is spelled out with concrete phrasings, in more than one language', () => {
  const s = section(/not a verdict on the idea/i);
  // El cuerpo es bilingüe y la spec exige «ni equivalentes en ningún idioma». Un agente obedece una
  // prohibición que reconoce; una prohibición abstracta no la reconoce en su propio idioma.
  assert.match(s, /"Great idea"|“Great idea”/, 'nombra el fraseo inglés prohibido');
  assert.match(s, /buena idea|gran idea|idea buenísima/i, 'y el castellano, que es donde ocurre');
  assert.match(s, /in any language|en cualquier idioma/i);
});

test('the objection never blocks, and overriding it costs writing the reason', () => {
  // Spec §E. Vivía sólo en la spec: ni en el cuerpo, ni en un test, ni en ningún criterio numerado.
  // Una regla declarada sin comprobación, dentro del ciclo que existe para atacar ese patrón.
  const s = section(/not a verdict on the idea/i);
  assert.match(s, /never blocks|not a veto/i, 'la objeción no puede vetar');
  assert.match(s, /write the reason into the spec/i, 'proceder contra ella cuesta escribirla');
});

test('a trivial change does not pay for any of this', () => {
  // AC10 para la maquinaria NUEVA. `specify-contract.test.js` cubre la regla vieja de saltarse la
  // cadena y asevera que aparece exactamente una vez, así que esto se dice con otras palabras a
  // propósito: duplicar las suyas pondría esa suite en rojo.
  const s = section(/not a verdict on the idea/i);
  assert.match(s, /typo fix/i);
});

test('FRAME is a section of its own that names where it comes from', () => {
  const s = section(/\bFRAME\b/);
  assert.match(s, /idea-refinement/, '`idea-refinement` estaba en el catálogo y nada la invocaba');
  assert.match(s, /current workaround/i, 'incluye qué se hace hoy, incluido no hacer nada');
  assert.match(s, /don't build it|do not build it/i, '«no construirlo» es una dirección enumerada');
});

test('FRAME scales with the stakes instead of taxing every one-line change', () => {
  // Sin esta aserción, borrar la única frase que exime a un cambio pequeño dejaba la suite en 33/33.
  const s = section(/\bFRAME\b/);
  assert.match(s, /scales with the stakes|small change/i);
});

test('the pass itself carries the two steps, not only the prose above it', () => {
  // La tabla de pasos es lo que un agente sigue. Si la regla vive sólo en prosa y el recorrido no la
  // nombra, el recorrido gana.
  const pass = section(/The pass, end to end/i);
  assert.match(pass, /RESTATE \+ OBJECT/);
  assert.match(pass, /FRAME/);
});

test('the body names the two sections the gate now requires', () => {
  // El defecto que esto cierra: la tabla «What a good spec contains» enumeraba 7 secciones mientras
  // el comprobador exigía 9, así que la primera pasada de toda spec futura salía roja por culpa de
  // la propia fase. Superficie de guía y superficie de aplicación, desincronizadas.
  const table = section(/What a good spec contains/i);
  assert.match(table, /Cost of not building it/i);
  assert.match(table, /cheapest alternative/i);
});

test('the early-detection trigger survives, as an instruction and not as a memory of one', () => {
  // Con la versión anterior de este test bastaba un comentario diciendo «esta skill SOLÍA decir
  // faintest sign; ya no» para pasar en verde. Ahora se exige dentro de la sección que la posee, y
  // los comentarios ya no cuentan.
  const s = section(/Detect the moment/i);
  assert.match(s, /fire on the \*\*faintest\*\* sign|fire on the faintest sign/i);
});

test('the eval suite carries a behavioural case for the register rule', () => {
  // eval-lint comprueba conteos y que `route_to` resuelva; NO mira `must_include`, así que saldría 0
  // igual sin este escenario. Lo que lo ve es esta aserción, no el linter.
  assert.match(CASES, /strongest objection/i);
  assert.match(CASES, /Cost of not building it/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Lo que este fichero NO comprueba, declarado en vez de fingido.
//
// **Que en ninguna parte del cuerpo haya una instrucción de elogiar.** Se intentó con una expresión
// regular y salió mal en las dos direcciones: fallaba 19 de 22 fraseos realistas —incluidos todos
// los castellanos, que son los que originaron la spec— y a la vez se ponía ROJA si alguien
// reforzaba la regla escribiendo «you must not validate the idea», porque la prohibición contiene
// la frase que prohíbe. Un test que se pone rojo con la mejora y verde con el defecto es peor que
// ninguno. El conjunto de formas de elogiar es abierto y multilingüe: no es reconocible por
// coincidencia de texto. Lo que sí es comprobable —y es lo que queda arriba— es que la prohibición
// esté escrita, nombrada con ejemplos concretos y en los dos idiomas del cuerpo.
//
// **Que el agente obedezca.** Eso es el caso de comportamiento de `evals/cases.yaml`, que nada en
// este repo ejecuta: no hay runner de modelo. Se corre a mano y se declara no medido.
