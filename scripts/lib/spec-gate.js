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

import { parseFrontmatter } from './frontmatter.js';

// The two families below are NOT retroactive. The corpus is 34 specs written before this rule
// existed, and none of them can answer "what if we don't build it" honestly after the fact; a gate
// that turns 34 files red gets switched off within a week. So the requirement starts on a date, and
// the date is derived from the file's own `timestamp:` — not from a list of exempted specs, which
// would be exactly the parallel accounting P3 forbids.
export const NEW_FAMILIES_SINCE = '2026-09-06';

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
  problem: { prefixes: ['problema & por que', 'problema y por que', 'problem & why'] },
  goals: { prefixes: ['objetivos', 'goals'] },
  nongoals: { prefixes: ['no-objetivos', 'no objetivos', 'non-goals'] },
  users: { prefixes: ['usuarios & contexto', 'usuarios y contexto', 'users & context'] },
  behaviour: { prefixes: ['comportamiento', 'behaviour', 'behavior'] },
  acceptance: { prefixes: ['criterios de aceptacion', 'acceptance criteria'] },
  open: {
    prefixes: ['puntos a clarificar', 'puntos de clarify', 'puntos que siguen abiertos', 'points to clarify'],
  },
  // A spec that cannot say what happens if nobody builds it has not been interrogated, only
  // de-risked. `since` is what keeps that demand off the specs written before it existed.
  inaction: {
    prefixes: [
      'que pasa si no lo construimos', '¿que pasa si no lo construimos',
      'coste de no construirlo', 'el coste de no construirlo',
      'cost of not building', 'the cost of not building',
    ],
    since: NEW_FAMILIES_SINCE,
  },
  cheapest: {
    prefixes: ['la alternativa mas barata', 'alternativa mas barata', 'cheapest alternative', 'the cheapest alternative'],
    since: NEW_FAMILIES_SINCE,
  },
};

const UNCHECKED = [
  'que ninguna sección contenga una suposición sin marcar (no es detectable por máquina; es el juicio que la fase existe para ejercer)',
  'que el contenido de cada sección sea correcto, y no sólo presente',
  'que los criterios de aceptación sean de verdad binarios',
  // Added with the status check below, for the same reason the three above exist: a green that is
  // narrower than the rule it appears to enforce is the decorative gate all over again.
  'si una spec dice "implementada" sin nombrar commit, PR ni versión (no hay nada que ir a mirar)',
  'si el trabajo de una spec que se declara sin aterrizar llegó por otra vía (git no lo distingue)',
  // Sin esta línea, el verde sería más estrecho que la regla que aparenta imponer — que es la
  // definición de puerta decorativa, sólo que por omisión en vez de por ausencia.
  `las specs anteriores a ${NEW_FAMILIES_SINCE} — quedan exentas de "qué pasa si no lo construimos" y de "la alternativa más barata", que no pueden rellenarse a posteriori`,
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
  for (const [family, { prefixes }] of Object.entries(FAMILIES)) {
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

// The template's guidance does not fit on one line, and a section still holding it is a section
// nobody filled in. The single-line check above never saw those: `<What concretely happens if` does
// not end in `>`, so it read as content and an untouched template passed the gate green.
//
// Only a block that actually CLOSES counts as guidance. A stray `<` that never finds its `>` — a
// latency budget written `<400ms`, a generic in a code sample — stays content, because guessing
// wrong in that direction hides real prose.
function guidanceLines(lines) {
  const skip = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (!t.startsWith('<') || t.endsWith('>')) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      const u = lines[j].trim();
      if (u === '' || u.startsWith('#')) break; // the block ended without closing: not guidance
      if (u.endsWith('>')) {
        for (let k = i; k <= j; k += 1) skip.add(k);
        i = j;
        break;
      }
    }
  }
  return skip;
}

function hasSubstance(lines) {
  const guidance = guidanceLines(lines);
  return lines.some((line, i) => !guidance.has(i) && isSubstantive(line));
}

// The day this spec was written, as YYYY-MM-DD, or null when there is nothing trustworthy to read.
// Null always means EXEMPT: a spec we cannot date is not a spec we get to fail. Three ways to land
// there, and all three are safe — the CLI itself calls specCompleteness('') to print `unchecked`,
// and parseFrontmatter throws on that.
function specDay(markdown) {
  try {
    const raw = parseFrontmatter(markdown).timestamp;
    if (typeof raw !== 'string') return null;
    const day = raw.slice(0, 10); // ISO order is lexicographic order; no timezone maths needed
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  } catch {
    return null;
  }
}

function requiredFamilies(markdown) {
  const day = specDay(markdown);
  return Object.entries(FAMILIES)
    .filter(([, { since }]) => !since || (day !== null && day >= since))
    .map(([family]) => family);
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

  const families = requiredFamilies(markdown);
  const missing = families.filter((f) => !sections.has(f));
  const empty = families.filter((f) => sections.has(f) && !hasSubstance(sections.get(f)));

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

// ─────────────────────────────────────────────────────────────────────────────
// Does the status still match the repository?
//
// The section check above asks whether a spec is COMPLETE. This asks whether it is still TRUE — and
// nothing asked that before, which is how seven of twenty-five statuses came to contradict the repo:
// one claiming "sin push ni PR" over work that had been in main for weeks, four sitting in
// `awaiting-approval` over work already published. Spec: 02-DOCS/wiki/sdd/specs/spec-status-drift.md
//
// The vocabulary below was extracted from the 25 real statuses, not imagined. That matters: an
// invented recognizer reaches for the bare word `implementada`, and the bare word is not checkable —
// it names nothing to go and look for. Only a commit, a PR or a released version do.

/** The claim shapes this recognizer knows. Anything else is silence, not a finding. */
export const CLAIM_KINDS = ['sha', 'pr', 'version', 'not-landed'];

// Deliberately absent: the bare words `implementada`, `desplegada`, `descartada`, and the phrase
// `no aprobada`. The first two name nothing to check. The last two look like landing claims and are
// not — `descartada` is a spec closed on purpose after being measured, `no aprobada` describes HOW
// approval happened (in autopilot, not item by item), not whether code shipped. Treating either as a
// landing claim would invent drift in the two best-closed specs of the set.
const SHA = /\b[0-9a-f]{7,40}\b/g;
const PR = /\bPR\s*#(\d+)/gi;
const VERSION = /\bpublicada en (\d+\.\d+\.\d+)/gi;
const NOT_LANDED = /\bsin push\b|\bsin PR\b|\bawaiting-approval\b/i;

/**
 * Pull the checkable claims out of a status string. Pure: no git, no I/O.
 * @param {string} statusText
 * @returns {Array<{kind: string, value: string, raw: string}>}
 */
export function statusClaims(statusText) {
  const text = typeof statusText === 'string' ? statusText : '';
  const claims = [];
  for (const m of text.matchAll(PR)) claims.push({ kind: 'pr', value: m[1], raw: m[0] });
  for (const m of text.matchAll(VERSION)) claims.push({ kind: 'version', value: m[1], raw: m[0] });
  for (const m of text.matchAll(SHA)) claims.push({ kind: 'sha', value: m[0], raw: m[0] });
  const neg = NOT_LANDED.exec(text);
  if (neg) claims.push({ kind: 'not-landed', value: neg[0], raw: neg[0] });
  return claims;
}

/**
 * Judge each claim against the repository.
 *
 * Four verdicts and none of them collapse into another. `unverifiable` is the one that keeps this
 * honest — a claim we could not check is not a claim that passed, and it is not drift either.
 *
 * `not-landed` is always handed to a human, and that is a deliberate retreat from what the spec
 * first promised. No query distinguishes "never landed" from "landed by another route": the case
 * that started this work names a commit that genuinely is not in main, while its deliverable has
 * been there for weeks. Checking the named commit would bless the misleading status; inferring the
 * other from anything else would be a heuristic inside a gate. So the deterministic part narrows,
 * and only what it narrowed goes to judgement — principle 1, and the shape `knowledge-drift` already
 * uses.
 *
 * @param {Array<object>} claims from `statusClaims`
 * @param {?{hasCommit: Function, isAncestor: Function, hasPr: Function, hasTag: Function}} probe
 *        null when there is no repository to ask — every claim then reports unverifiable.
 * @returns {Array<{kind: string, value: string, verdict: string, reason: string}>}
 */
export function checkClaims(claims, probe) {
  return (claims || []).map((c) => {
    if (c.kind === 'not-landed') {
      return {
        ...c,
        verdict: 'needs-human',
        reason: 'git cannot tell "never landed" from "landed by another route" — look at whether the deliverable is in main, not at the branch',
      };
    }
    if (!probe) return { ...c, verdict: 'unverifiable', reason: 'no repository to ask' };
    try {
      if (c.kind === 'sha') {
        if (!probe.hasCommit(c.value)) {
          return { ...c, verdict: 'unverifiable', reason: `commit ${c.value} is not in this repository` };
        }
        return probe.isAncestor(c.value)
          ? { ...c, verdict: 'holds', reason: `${c.value} is in main` }
          : { ...c, verdict: 'stale', reason: `${c.value} is NOT in main` };
      }
      if (c.kind === 'pr') {
        return probe.hasPr(c.value)
          ? { ...c, verdict: 'holds', reason: `PR #${c.value} is merged into main` }
          : { ...c, verdict: 'stale', reason: `no merge of PR #${c.value} in main` };
      }
      return probe.hasTag(c.value)
        ? { ...c, verdict: 'holds', reason: `v${c.value} is tagged` }
        : { ...c, verdict: 'stale', reason: `no v${c.value} tag in this repository` };
    } catch (e) {
      // Could not look. Saying `stale` here would invent a finding out of our own failure.
      return { ...c, verdict: 'unverifiable', reason: e.message };
    }
  });
}
