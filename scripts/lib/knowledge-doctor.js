// knowledge-doctor.js — does what the wiki CLAIMS still hold?
//
// drift-check answers one question: does the path a document names exist? It is a good mechanism and
// its scope ends there. It cannot see a claim that was true the day it was written and is not true
// now, and on 2026-08-18 three of those were found by hand in one session while drift-check passed
// green: a counter with three different values across three documents, four decisions-log entries
// written by eval agents about features nobody is building, and a spec asserting "the verify.sh of
// four stacks" when there are 189 and only 2 run coverage.
//
// A wiki with stale claims does not read badly. It reads with the same confidence and occasionally
// lies — and `02-DOCS/` is untracked (P9), so there is no git log to reconstruct when a sentence
// stopped being true.
//
// THIS DETECTS, IT DOES NOT CURE. `knowledge-ops` already owns the gardening (prune, archive never
// delete, merge duplicates, kill orphans) and knows HOW; what did not exist is anything telling it
// WHERE. Deterministic narrowing, judgment on the narrowed set (P1) — the split knowledge-drift used.
//
// Scope decided in clarify (2026-08-18): contradictions ONLY against a declared single source; the
// general cross-document case needs semantic comparison whose false-positive rate nobody measured,
// and a detector that cries wolf gets switched off (P7).

// Order = cost of being wrong. Artifacts another process consumes as INPUT come first; articles a
// human reads occasionally come last. A declared constant, not a heuristic.
export const SEVERITY_ORDER = ['sdd/specs', 'sdd/verifications', 'sdd', 'harness', 'brand', 'stack'];

export const CLASSES = { STALE: 'ya-no-aplica', MISPLACED: 'fuera-de-sitio', CONTRADICTS: 'se-contradice' };

// Out of scope, named so their absence is not read as cleanliness.
export const NOT_LOOKED_AT = [
  'La PRIMERA instancia de una desviación de convención: las convenciones se derivan del wiki en cada corrida, así que un único fichero fuera de sitio define su propia ubicación como válida. Deliberado — hardcodear la tabla sería una segunda copia de la verdad que deriva de ella.',
  'Contradicción general entre documentos (exige comparación semántica; fuera por clarify 18-08).',
  'Obsolescencia semántica de prosa: si un párrafo sobre arquitectura sigue siendo cierto.',
  'La memoria del proyecto: drift-check ya resuelve sus rutas vía memoryDir(); su auditoría semántica queda fuera.',
  'Calidad de escritura, tono, o si un artículo merece existir.',
];

/**
 * Whitespace-collapsed text for prose matching. Not a nicety: the single-source declaration in this
 * repo's own pattern registry is wrapped mid-phrase (`vive **en esta tabla y en\nningún otro
 * sitio**`), so a line-based match loses it. Third time in one day that hard wrapping defeated a
 * prose match — twice in tests before this.
 */
export const normalizeProse = (text) => String(text || '').replace(/\s+/g, ' ');

/** Split frontmatter from body. Returns {fields, body, ok, reason}. Unreadable => a candidate, never a skip. */
export function parseFrontmatter(text) {
  const t = String(text || '');
  if (!t.startsWith('---')) return { fields: {}, body: t, ok: false, reason: 'sin frontmatter YAML' };
  const end = t.indexOf('\n---', 3);
  if (end === -1) return { fields: {}, body: t, ok: false, reason: 'frontmatter sin cierre' };
  const head = t.slice(4, end);
  const fields = {};
  for (const line of head.split('\n')) {
    const m = /^([a-z_]+):\s*(.*)$/i.exec(line);
    if (m) fields[m[1].toLowerCase()] = m[2].trim();
  }
  return { fields, body: t.slice(end + 4), ok: true, reason: null };
}

/** Does this document declare itself the single source of a fact? Matched on normalized prose. */
export function declaresSingleSource(text) {
  const p = normalizeProse(text);
  return /en ning[uú]n otro sitio|and nowhere else|fuente [uú]nica|single source of/i.test(p);
}

const WORD_NUMBERS = {
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
};

/**
 * A count asserted in the FRONTMATTER only. Body prose is not a usable signal: the live case's own
 * document contains "7 veces" inside a table cell describing something else entirely.
 */
export function statedCountInFrontmatter(fields) {
  for (const key of ['description', 'title']) {
    const v = String(fields[key] || '');
    const digits = /(\d+)\s+(?:veces|times|apariciones|occurrences)/i.exec(v);
    if (digits) return { value: Number(digits[1]), source: key, literal: digits[0] };
    const words = new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\s+(?:veces|times)`, 'i').exec(v);
    if (words) return { value: WORD_NUMBERS[words[1].toLowerCase()], source: key, literal: words[0] };
  }
  return null;
}

/** Data rows of the first markdown table (header and separator excluded). */
export function firstTableRowCount(body) {
  const lines = String(body || '').split('\n');
  let i = lines.findIndex((l) => /^\s*\|.*\|/.test(l) && /\|/.test(l));
  if (i === -1) return null;
  if (!/^\s*\|[\s:|-]+\|/.test(lines[i + 1] || '')) return null; // header must be followed by a separator
  let n = 0;
  for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) n++;
  return { rows: n, headerLine: i + 1 };
}

const lineOf = (text, needle) => {
  const idx = String(text).indexOf(needle);
  if (idx === -1) return 1;
  return String(text).slice(0, idx).split('\n').length;
};

/** Class 1 — a status: citing a commit or tag that does not exist. refExists is injected. */
export function findStaleClaims({ path, text, refExists }) {
  const { fields } = parseFrontmatter(text);
  const status = String(fields.status || '');
  if (!status) return [];
  const out = [];
  const refs = new Set();
  for (const m of status.matchAll(/\b([0-9a-f]{7,8})\b/g)) refs.add(m[1]);
  for (const m of status.matchAll(/\bv?(\d+\.\d+\.\d+)\b/g)) refs.add(`v${m[1]}`);
  for (const ref of refs) {
    if (refExists(ref)) continue;
    out.push({
      path, line: lineOf(text, 'status:'), cls: CLASSES.STALE,
      signal: `status: cita \`${ref}\`, que no existe en el repo`,
      expected: `un commit o tag \`${ref}\``, found: 'nada con ese nombre',
    });
  }
  return out;
}

/**
 * Class 2 — out of place. Conventions are DERIVED from the wiki on every run, never hardcoded:
 * a hardcoded table is a second copy of the truth and drifts from it.
 */
// A convention needs CORROBORATION, and this is the sharp edge of deriving one from the data.
//
// The first version of both rules below was dead code — a gate that could not fail. A misplaced file
// added its own directory to the set of valid homes for its type, and a file missing frontmatter
// counted inside its own denominator for "every sibling has one". In both cases the anomaly defined
// itself as normal, so neither check could ever fire. Caught by the tests, which is exactly the
// can-it-pass / can-it-fail symmetry from v1.0.17 doing its job on the way in rather than in
// production.
//
// The fix in both: a single instance never establishes a convention, and never excuses itself.
export const DOMINANT_HOME_SHARE = 0.75; // one directory holding this share of a type owns it
export const MIN_DOCS_FOR_TYPE_RULE = 3; // below this a directory is too small to have a convention

export function deriveConventions(docs) {
  const typeCounts = new Map(); // type -> Map(dir -> n)
  const dirsWithType = new Map();
  for (const d of docs) {
    const { fields, ok } = parseFrontmatter(d.text);
    const has = ok && Boolean(fields.type);
    const seen = dirsWithType.get(d.dir) || { withType: 0, total: 0 };
    seen.total++; if (has) seen.withType++;
    dirsWithType.set(d.dir, seen);
    if (has) {
      if (!typeCounts.has(fields.type)) typeCounts.set(fields.type, new Map());
      const m = typeCounts.get(fields.type);
      m.set(d.dir, (m.get(d.dir) || 0) + 1);
    }
  }

  // A type is only "at home" somewhere if ONE directory holds a dominant share of it. `article` is
  // spread across brand/harness/stack by design, so it has no dominant home and is never judged —
  // which is the correct silence, not a gap.
  const dominantHome = new Map();
  for (const [type, dirs] of typeCounts) {
    const total = [...dirs.values()].reduce((a, b) => a + b, 0);
    const [bestDir, bestN] = [...dirs.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total >= 2 && bestN / total >= DOMINANT_HOME_SHARE) dominantHome.set(type, { dir: bestDir, share: bestN / total, total });
  }

  // Frontmatter is demanded where at most ONE document deviates — so the deviant does not veto the
  // rule by existing, and a directory of mixed conventions still stays silent.
  const typeRequiredDirs = new Set(
    [...dirsWithType.entries()]
      .filter(([, v]) => v.total >= MIN_DOCS_FOR_TYPE_RULE && v.withType >= v.total - 1)
      .map(([k]) => k),
  );
  return { dominantHome, typeRequiredDirs };
}

export function findMisplaced({ doc, conventions, indexText }) {
  const out = [];
  const { fields, ok, reason } = parseFrontmatter(doc.text);
  if (!ok) {
    // The SAME derived narrowing as the missing-`type:` branch below. The first real run flagged 8
    // documents that legitimately have no frontmatter — the SDD phase standards, decisions.md,
    // index.md — which is over-firing on correct work: 8 of 15 candidates were noise, and a report
    // that cries wolf gets ignored (P7). A document without frontmatter is only a candidate in a
    // directory where every other document has one. Applying the narrowing to one branch and not the
    // other was the bug; the fix is symmetry, not an exclusion list.
    if (conventions.typeRequiredDirs.has(doc.dir)) {
      out.push({
        path: doc.path, line: 1, cls: CLASSES.MISPLACED,
        signal: `frontmatter ilegible (${reason}), y todos los demás documentos de \`${doc.dir}\` lo tienen`,
        expected: 'frontmatter YAML con type:', found: reason,
        uncertain: true,
      });
    }
    return out;
  }
  if (!fields.type) {
    if (conventions.typeRequiredDirs.has(doc.dir)) {
      out.push({
        path: doc.path, line: 1, cls: CLASSES.MISPLACED,
        signal: `sin \`type:\`, y todos los demás documentos de \`${doc.dir}\` lo tienen`,
        expected: 'un type: no vacío', found: 'ausente',
      });
    }
  } else {
    const home = conventions.dominantHome.get(fields.type);
    if (home && home.dir !== doc.dir) {
      out.push({
        path: doc.path, line: lineOf(doc.text, 'type:'), cls: CLASSES.MISPLACED,
        // Deliberately phrased as an inconsistency: the detector cannot know which side should yield,
        // and pretending otherwise would be inventing the answer.
        signal: `\`type: ${fields.type}\` en \`${doc.dir}\`, pero ${Math.round(home.share * 100)}% de ese tipo (${home.total} docs) vive en \`${home.dir}\``,
        expected: 'o el fichero en otra carpeta, o otro type:', found: 'inconsistencia — decide tú cuál cede',
        uncertain: true,
      });
    }
  }
  if (indexText != null && doc.indexable && !indexText.includes(doc.rel)) {
    out.push({
      path: doc.path, line: 1, cls: CLASSES.MISPLACED,
      signal: 'artefacto sin fila en el Knowledge map',
      expected: `una fila citando \`${doc.rel}\``, found: 'ninguna',
    });
  }
  return out;
}

/** Class 3 — a frontmatter count contradicting the table the document declares its single source. */
export function findContradictions({ path, text }) {
  if (!declaresSingleSource(text)) return [];
  const { fields, body, ok } = parseFrontmatter(text);
  if (!ok) return [];
  const stated = statedCountInFrontmatter(fields);
  if (!stated) return [];
  const table = firstTableRowCount(body);
  if (!table) return [];
  if (stated.value === table.rows) return [];
  return [{
    path, line: lineOf(text, `${stated.source}:`), cls: CLASSES.CONTRADICTS,
    signal: `el frontmatter dice "${stated.literal}" y el documento se declara fuente única, pero su primera tabla tiene ${table.rows} filas`,
    expected: `${table.rows} (las filas de la tabla)`, found: `${stated.value} (en \`${stated.source}:\`)`,
  }];
}

/** Rank by cost of being wrong, then by class, then by path — stable and explainable. */
export function rank(candidates) {
  const bucket = (p) => {
    const i = SEVERITY_ORDER.findIndex((d) => p.includes(`/${d}/`) || p.endsWith(`/${d}`));
    return i === -1 ? SEVERITY_ORDER.length : i;
  };
  const clsRank = (c) => [CLASSES.CONTRADICTS, CLASSES.STALE, CLASSES.MISPLACED].indexOf(c);
  return [...candidates].sort((a, b) =>
    bucket(a.path) - bucket(b.path) || clsRank(a.cls) - clsRank(b.cls) || a.path.localeCompare(b.path));
}

/** The whole pass, over already-read documents. Pure: no fs, no git — both are injected. */
export function diagnose({ docs, indexText, refExists }) {
  const cands = [];
  const conventions = deriveConventions(docs);
  for (const doc of docs) {
    cands.push(...findStaleClaims({ path: doc.path, text: doc.text, refExists }));
    cands.push(...findMisplaced({ doc, conventions, indexText }));
    cands.push(...findContradictions({ path: doc.path, text: doc.text }));
  }
  return { candidates: rank(cands), scanned: docs.length, notLookedAt: NOT_LOOKED_AT };
}
