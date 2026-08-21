// The exit gate of the `specify` phase, as a binary instead of a feeling.
//
// "Stop when the WHAT and WHY are complete enough to plan against" cannot tell done from not-done,
// so the phase closed whenever the agent felt closed — with the write/review/approve steps visible
// the whole time, pulling attention toward being finished. This checks the artifact instead: every
// template section carries content or an explicit open point.
//
// What it does NOT check is returned in `unchecked`, on purpose. Detecting an unmarked assumption is
// the problem `specify` exists to solve, not something a parser can do, and a gate that implies
// otherwise is worse than one that admits its edge.

// The four states a point can be in. Order is the table's order in the skill body.
export const OPEN_POINT_TYPES = [
  'pregunta abierta', // formulable now, unanswered → clarify asks it
  'suposición tomada', // we decided, with the basis written → clarify validates it
  'decisión diferida', // sharp, out of this cycle on purpose → clarify leaves it
  'área no formulable', // known to be coming, not yet sharp → clarify notes it
];

// The corpus is Spanish, the template is English, and both carry drifting parentheticals
// ("Objetivos (resultado)", "Criterios de aceptación (binarios)"). Matching literal strings would
// be useless, so each family is a set of normalised prefixes.
const FAMILIES = {
  problem: ['problema & por que', 'problema y por que', 'problem & why'],
  goals: ['objetivos', 'goals'],
  nongoals: ['no-objetivos', 'no objetivos', 'non-goals'],
  users: ['usuarios & contexto', 'usuarios y contexto', 'users & context'],
  behaviour: ['comportamiento', 'behaviour', 'behavior'],
  acceptance: ['criterios de aceptacion', 'acceptance criteria'],
  open: ['puntos a clarificar', 'puntos de clarify', 'puntos que siguen abiertos', 'points to clarify'],
};

const UNCHECKED = [
  'que ninguna sección contenga una suposición sin marcar (no es detectable por máquina; es el juicio que la fase existe para ejercer)',
  'que el contenido de cada sección sea correcto, y no sólo presente',
  'que los criterios de aceptación sean de verdad binarios',
];

function fold(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function familyOf(heading) {
  const h = fold(heading);
  for (const [family, prefixes] of Object.entries(FAMILIES)) {
    if (prefixes.some((p) => h.startsWith(p))) return family;
  }
  return null;
}

// A heading with nothing under it is not a filled section. Neither is one holding only the
// template's own italic/angle-bracket guidance, which is what a hurried pass leaves behind.
function isSubstantive(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^<.*>$/.test(t)) return false; // <guidance from the template>
  if (/^\*[^*].*\*$/.test(t) && t.length < 200) return false; // *italic guidance*
  if (/^(-|\*)\s*$/.test(t)) return false; // an empty bullet
  return true;
}

function parseOpenPoints(lines) {
  const points = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(?:\[[ x]\]\s*)?(.*)$/);
    if (!m || !m[1].trim()) continue;
    const body = m[1];
    const declared = OPEN_POINT_TYPES.find((t) => {
      const re = new RegExp(`^\\*\\*\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*\\*`, 'i');
      return re.test(fold(body)) || re.test(body);
    });
    points.push({
      type: declared || OPEN_POINT_TYPES[0], // the costliest default: treat it as a real question
      typed: Boolean(declared),
      text: body.trim(),
    });
  }
  return points;
}

/**
 * @param {string} markdown a written spec file
 * @returns {{ok: boolean, missing: string[], empty: string[],
 *            openPoints: Array<{type: string, typed: boolean, text: string}>,
 *            untyped: string[], unchecked: string[]}}
 */
export function specCompleteness(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const sections = new Map(); // family -> body lines

  let current = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      const fam = familyOf(h[1]);
      current = fam;
      if (fam && !sections.has(fam)) sections.set(fam, []);
      continue;
    }
    if (current && sections.has(current)) sections.get(current).push(line);
  }

  const families = Object.keys(FAMILIES);
  const missing = families.filter((f) => !sections.has(f));
  const empty = families.filter((f) => sections.has(f) && !sections.get(f).some(isSubstantive));

  const openPoints = sections.has('open') ? parseOpenPoints(sections.get('open')) : [];
  const untyped = openPoints.filter((p) => !p.typed).map((p) => p.text);

  return {
    ok: missing.length === 0 && empty.length === 0,
    missing,
    empty,
    openPoints,
    untyped,
    unchecked: UNCHECKED,
  };
}
