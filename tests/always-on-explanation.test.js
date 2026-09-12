import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// La regla de explicación (spec `explain-without-assuming`) vive en el cuerpo always-on, que se
// inyecta en cada turno de cada usuario.
//
// POR QUÉ SE ANCLA A LA FRASE EXACTA Y NO A SUS PALABRAS. La primera versión afirmaba cinco tokens
// sueltos (`command`, `flag`, `path`, `at first use`, `without saying what it does`) y un refutador
// enseñó que **todos ellos están también en la negación de la regla**:
//     «Never define a term at first use; give a command, flag or path without saying what it does.»
// pasaba 8/8. Otros cinco supervivientes de la misma familia: condicionarla («Only if the user asks
// twice: …»), quitarle el imperativo («Topics: a term at first use; …»), degradarla a `####` y
// anidarla bajo la puerta de primer contacto —que el propio cuerpo declara inerte una vez existe el
// perfil—, duplicarla literal bajo otro encabezado, y esconderla en `references/`.
// Un test de presencia de tokens fija el vocabulario, no la regla. Este fija la frase.
//
// Coste aceptado: cualquier reescritura de la regla, aunque sea una errata, pone el test en rojo.
// Es deseable. Son 122 bytes de contrato en el fichero más caro del catálogo; cambiarlos debe
// costar una decisión, no un descuido.
//
// LO QUE ESTE FICHERO **NO** COMPRUEBA, y es deliberado:
//   - que una skill efectivamente defina el término la primera vez que lo usa;
//   - que la regla mejore la comprensión de nadie;
//   - el coste en bytes, que ya vigila `always-on-body.test.js` (8000 B desde `always-on-diet`).
//     Reimplementarlo sería contabilidad paralela, y el primer borrador lo hizo: inventó un techo
//     de 8272 B sin mirar si existía uno.
// Ningún parser ve las dos primeras. Las mediría un runner de evals que este repo no tiene. Por eso
// la regla se declara **no vinculante** en la spec: el principio 2 pide mecanismo para lo que se
// declara vinculante, y aquí no hay mecanismo posible. Esta nota está aquí, y no sólo en la spec,
// para que nadie lea «hay test» como «está comprobado».
//
// Las anclas descartan comentarios HTML y vallas de código: dentro de ellos la regla es texto
// citado, no instrucción. El comentario fue el vector que dejó pasar un stub en `specify-doubt`
// (2026-09-05); la valla es el mismo ataque con otro disfraz, y sobrevivía hasta que un refutador
// la degradó a un bloque ```md devolviendo bytes de la prosa vecina para no mover el total.

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, '..', 'skills');

/** Quita comentarios HTML y bloques vallados: lo que queda es instrucción, no cita. */
function instructionsOnly(text) {
  const out = [];
  let fence = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      continue;
    }
    if (m) { fence = m[1]; continue; }
    out.push(line);
  }
  return out.join('\n');
}

// El contrato, literal. Spec `explain-without-assuming`, criterios de aceptación.
const HEADING = '## Explain without assuming';
const RULE = 'Define a term at first use; never give a command, flag or path '
  + 'without saying what it does.';

const BODY = instructionsOnly(readFileSync(join(SKILLS, 'suggest', 'SKILL.md'), 'utf8'));

/** Todo `.md` bajo skills/, no sólo los SKILL.md: la regla tampoco puede esconderse en references/. */
function everyMarkdown(dir = SKILLS) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name);
    if (d.isDirectory()) return everyMarkdown(full);
    return d.isFile() && d.name.endsWith('.md') ? [full] : [];
  });
}

test('la regla existe, literal, bajo su encabezado canónico de nivel 2', () => {
  const lines = BODY.split('\n');
  const at = lines.findIndex((l) => l.trimEnd() === HEADING);
  assert.notEqual(
    at, -1,
    `no hay ninguna línea que sea exactamente "${HEADING}". Un encabezado de otro nivel no vale: `
      + '`####` anidado bajo la puerta de primer contacto convierte una regla always-on en una '
      + 'regla de primer contacto, y el cuerpo declara esa puerta inerte en cuanto existe el perfil. '
      + 'Si la regla sigue en el fichero, está dentro de un comentario o de una valla: ahí es cita.',
  );

  const rest = lines.slice(at + 1);
  const nextHeading = rest.findIndex((l) => /^#{1,6} /.test(l));
  const section = (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).join('\n');
  assert.ok(
    section.includes(RULE),
    'la sección existe pero no dice la regla, literal. Se ancla a la frase entera y no a sus '
      + 'palabras porque cada palabra está también en su negación: «Never define a term at first '
      + `use; give a command…» contiene los mismos tokens. Esperado, literal:\n  ${RULE}`,
  );
});

test('la regla NO declara un segundo default para el caso sin perfil', () => {
  // `orient/SKILL.md` ya publica «No profile yet → assume non-technical + L3», más exigente que
  // esta regla. Un default propio aquí sólo podría debilitar el que ya existe, y el borrador lo
  // hacía: lo cazó una revisión con contexto fresco antes de escribirse una línea de código.
  const at = BODY.indexOf(HEADING);
  const section = BODY.slice(at, BODY.indexOf('\n## ', at + 1));
  assert.doesNotMatch(
    section, /no profile/i,
    'la regla está declarando qué pasa sin perfil. Ese caso ya lo fija `orient` («No profile yet → '
      + 'assume non-technical + L3»), y es más exigente: un default propio aquí sólo puede '
      + 'debilitarlo. Bórralo y deja que mande el que ya existe.',
  );
});

test('la regla se dice una vez en todo el catálogo, no tres', () => {
  const owners = everyMarkdown()
    .filter((f) => instructionsOnly(readFileSync(f, 'utf8')).includes(RULE))
    .map((f) => relative(SKILLS, f))
    .sort();

  assert.deepEqual(
    owners, ['suggest/SKILL.md'],
    'la regla vive sólo en la capa always-on. Repetirla en otra skill —bajo cualquier encabezado, o '
      + 'escondida en `references/`— es lo que `always-on-diet` prohíbe: decir la regla una vez, no '
      + 'tres. Un puntero en prosa que defiera a la capa always-on NO cuenta: esto busca la frase '
      + 'literal, no el nombre de la regla.',
  );
});
