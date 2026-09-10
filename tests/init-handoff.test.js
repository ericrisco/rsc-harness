import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Spec: 02-DOCS/wiki/sdd/specs/install-completion-floor.md §C
//
// La Fase 5 de `init` terminaba con una frase en prosa —«ahora ejecuta `harness` y monto el
// esqueleto»— y nada la ejecutaba. Terminar dependía de que una persona leyera esa línea y
// escribiera algo, y en el recorrido por chat esa persona acaba de delegar precisamente para no
// tener que saber qué escribir. Es el mismo patrón que `worktree-cleanup-default`: un
// comportamiento declarado por defecto cuyo ejecutor no existe.
//
// Se aseveran anclas cortas y estructurales, no párrafos: el cuerpo se reescribirá muchas veces.
// Y se descartan los comentarios HTML, porque un ancla dentro de un comentario no es una
// instrucción — lección de `tests/specify-doubt.test.js`, donde un stub con las anclas en un
// comentario pasaba la suite entera mientras ordenaba lo contrario.

const RAW = readFileSync(new URL('../skills/init/SKILL.md', import.meta.url), 'utf8');
const BODY = RAW.replace(/<!--[\s\S]*?-->/g, '');

function section(re) {
  const chunks = BODY.split(/\n(?=#{2,4} )/);
  const hit = chunks.find((chunk) => re.test(chunk.split('\n', 1)[0]));
  assert.ok(hit, `no hay sección cuyo encabezado case con ${re}`);
  return hit;
}

test('init invokes the scaffolder instead of asking the user to run it', () => {
  const handoff = section(/HANDOFF/i);
  assert.match(handoff, /invoke `harness`|invokes `harness`/i, 'tiene que invocarlo, no pedirlo');
  assert.doesNotMatch(handoff, /`init` stops here/, 'ya no se detiene ahí a esperar');
});

test('init does not claim the harness is ready when the scaffold did not happen', () => {
  const handoff = section(/HANDOFF/i);
  // Tolerante al espacio en blanco a propósito: el cuerpo va envuelto a 100 columnas y la frase
  // queda partida por un salto de línea. La afirmación aseverada es la misma.
  assert.match(handoff, /do not tell the\s+user rsc is ready/i, 'la regla tiene que estar escrita');
  assert.match(handoff, /RSC_ONBOARDING_INCOMPLETE/, 'y alineada con lo que hace el instalador');
});
