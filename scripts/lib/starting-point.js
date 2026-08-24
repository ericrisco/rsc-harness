// What does this project already own to start from, and does its colour hold up?
//
// The design area declares three times that it will propose a starting point when the user has
// none — `design-loop` phase 1 on `skip`, the closing line of `design`'s brand grounding, and
// `design-dna`'s REUSE mode — and none of the three had anything behind it. An unbacked promise to
// propose falls back to the model's prior, which is the AI-template median the area exists to
// escape. Spec: 02-DOCS/wiki/sdd/specs/design-starting-point.md
//
// This file is the half that can be an algorithm (P1): listing what is installed, and refusing to
// propose a colour that fails contrast. The half that needs judgement — which reference is the right
// bar for what you are building — is prose, in design/references/starting-point.md.
//
// Read-only, always. `02-DOCS` is untracked and has no undo (P9), and a discovery pass has no
// business writing anywhere.
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { designIdentity, BRAND_DIR } from './design-identity.js';

// WCAG 2.2 AA. Body text, and the relaxed floor for large text and UI components.
export const TEXT_MIN = 4.5;
export const UI_MIN = 3.0;

// Which palette roles are held to which floor. `design-dna`'s schema fixes the role vocabulary
// (ground, ink, accent, secondary, hairline); anything outside it is skipped rather than guessed at,
// because inventing a threshold for an unknown role is how a gate starts approving things.
const TEXT_ROLES = new Set(['ink', 'secondary']);
const UI_ROLES = new Set(['accent']);
const GROUND_ROLE = 'ground';

// A record is only reusable if it carries the fields a style is actually rebuilt from. Half a record
// cannot be reused, so it is reported as unreadable instead of offered as a candidate.
const REQUIRED = ['palette'];
const DIMENSIONS = ['palette', 'type', 'space', 'surface', 'motion', 'signatures', 'voice'];

/** Where `design-dna` emits, and where rsc installs, in both scopes. */
export function defaultRoots({ home = homedir(), cwd = process.cwd() } = {}) {
  const roots = [];
  for (const base of home === cwd ? [cwd] : [cwd, home]) {
    roots.push(join(base, '.claude', 'skills'));
    roots.push(join(base, '.rsc', 'skills'));
  }
  return roots;
}

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// WCAG relative luminance. The sRGB transfer function, not a shortcut: an approximation here is a
// wrong ratio everywhere downstream, and it would pass a test written against this file's own output.
function luminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * WCAG 2.x contrast ratio between two colours, 1.0 … 21.0. Symmetric.
 * @param {string} a sRGB hex, `#rrggbb`
 * @param {string} b sRGB hex, `#rrggbb`
 */
export function contrastRatio(a, b) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new TypeError(`not an sRGB hex colour: ${!ca ? a : b}`);
  const la = luminance(ca);
  const lb = luminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Does this palette's text hold up against its own ground?
 *
 * Runs before a measured colour is written as a proposed dimension: a value that fails is not
 * proposed at all, rather than proposed and flagged. Three outcomes are kept apart on purpose —
 * measured-and-passing, measured-and-failing, and **not measured**. Collapsing the third into the
 * first is the vacuous pass this area has already paid for twice.
 *
 * @param {Array<{role: string, hex: string, name?: string}>} colors — `palette.colors` from a dna.json
 * @returns {{ok: boolean, pairs: Array<object>, failures: Array<object>, skipped: Array<object>,
 *            unparsed: string[], reason: string}}
 */
export function checkPairings(colors) {
  const list = Array.isArray(colors) ? colors : [];
  const pairs = [];
  const skipped = [];
  const unparsed = [];

  const ground = list.find((c) => c && c.role === GROUND_ROLE);
  const groundHex = ground ? parseHex(ground.hex) : null;
  if (!ground) {
    return { ok: false, pairs, failures: [], skipped, unparsed, reason: 'no ground role in the palette — nothing to measure against' };
  }
  if (!groundHex) {
    unparsed.push(String(ground.hex));
    return { ok: false, pairs, failures: [], skipped, unparsed, reason: `ground colour is not an sRGB hex: ${ground.hex}` };
  }

  for (const c of list) {
    if (!c || c.role === GROUND_ROLE) continue;
    const isText = TEXT_ROLES.has(c.role);
    const isUi = UI_ROLES.has(c.role);
    if (!isText && !isUi) {
      // A hairline is not text. Saying so is not the same as saying it passed.
      skipped.push({ role: c.role, name: c.name, reason: 'role carries no text, so no text floor applies' });
      continue;
    }
    if (!parseHex(c.hex)) {
      unparsed.push(String(c.hex));
      continue;
    }
    const min = isText ? TEXT_MIN : UI_MIN;
    const ratio = Math.round(contrastRatio(c.hex, ground.hex) * 100) / 100;
    pairs.push({ role: c.role, name: c.name, fg: c.hex, bg: ground.hex, ratio, min, ok: ratio >= min });
  }

  const failures = pairs.filter((p) => !p.ok);
  // Not measuring anything is not a pass. An empty failure list only means green when at least one
  // pair was actually evaluated and nothing was left unparsed.
  const ok = failures.length === 0 && unparsed.length === 0 && pairs.length > 0;
  const reason = unparsed.length
    ? `${unparsed.length} colour(s) could not be parsed, so they were not measured`
    : pairs.length === 0
      ? 'no text or UI role to measure against the ground'
      : failures.length
        ? `${failures.length} pair(s) below their floor`
        : `${pairs.length} pair(s) measured, all above their floor`;
  return { ok, pairs, failures, skipped, unparsed, reason };
}

function readRecord(dir, slug) {
  const file = join(dir, 'dna.json');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    return { error: `cannot read dna.json: ${e.code || e.message}` };
  }
  let dna;
  try {
    dna = JSON.parse(raw);
  } catch (e) {
    return { error: `dna.json is not valid JSON: ${e.message}` };
  }
  const missing = REQUIRED.filter((k) => !dna || !dna[k]);
  if (missing.length) return { error: `record is missing ${missing.join(', ')} — half a record cannot be reused` };

  return {
    record: {
      slug: (dna.meta && dna.meta.slug) || slug,
      name: (dna.meta && dna.meta.name) || slug,
      path: file,
      covers: DIMENSIONS.filter((d) => dna[d]),
      palette: (dna.palette && dna.palette.colors) || [],
    },
  };
}

// What the harness's own identity articles mention. A record the project actually used outranks one
// that merely happens to be installed — but the others stay on the list, because choosing for the
// user is exactly what the spec forbids.
function citedSlugs(harnessRoot) {
  const dir = join(harnessRoot, BRAND_DIR);
  let text = '';
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      try { text += readFileSync(join(dir, f), 'utf8').toLowerCase(); } catch { /* one unreadable article is not the answer */ }
    }
  } catch { /* no identity here; designIdentity reports that half */ }
  return text;
}

/**
 * What this project already owns to start a design from.
 *
 * @param {string[]} roots — skill directories to scan. Defaults to both scopes, both layouts.
 * @param {string} harnessRoot — where `02-DOCS/` lives, for the identity half and the ordering.
 * @returns {{state: 'owned'|'none'|'inconclusive', identity: object, records: object[],
 *            unreadable: Array<{path: string, reason: string}>, reason: string, fix?: string}}
 *   `owned`        — an identity or at least one legible record exists.
 *   `none`         — looked everywhere, found nothing. Carries the way out (P6).
 *   `inconclusive` — something could not be read. Never reported as `none`, never as green.
 */
export function ownedStartingPoints(roots = defaultRoots(), harnessRoot = process.cwd()) {
  const identity = designIdentity(harnessRoot);
  const records = [];
  const unreadable = [];
  let blind = 0;

  for (const root of roots) {
    // existsSync follows symlinks, so a dangling one answers false and would be filed as "nothing
    // installed here". That is unreadability, not absence — the exact conflation designIdentity was
    // fixed for. lstat sees the link itself and tells them apart.
    if (!existsSync(root)) {
      let dangling = false;
      try { dangling = lstatSync(root).isSymbolicLink(); } catch { /* genuinely absent */ }
      if (dangling) {
        blind += 1;
        unreadable.push({ path: root, reason: 'skills root is a symlink that does not resolve' });
      }
      continue;
    }
    let entries;
    try {
      if (!statSync(root).isDirectory()) {
        blind += 1;
        unreadable.push({ path: root, reason: 'skills root exists but is not a directory' });
        continue;
      }
      entries = readdirSync(root, { withFileTypes: true });
    } catch (e) {
      blind += 1;
      unreadable.push({ path: root, reason: `cannot read skills root: ${e.code || e.message}` });
      continue;
    }
    for (const entry of entries) {
      // Dirents, not statSync: a symlinked entry could otherwise report on a directory outside the
      // root we were asked to scan.
      if (!entry.isDirectory()) continue;
      const dir = join(root, entry.name);
      if (!existsSync(join(dir, 'dna.json'))) continue;
      const { record, error } = readRecord(dir, entry.name);
      if (error) { unreadable.push({ path: join(dir, 'dna.json'), reason: error }); continue; }
      if (!records.some((r) => r.slug === record.slug)) records.push(record);
    }
  }

  const cited = citedSlugs(harnessRoot);
  records.sort((a, b) => {
    const ac = cited.includes(a.slug.toLowerCase()) ? 0 : 1;
    const bc = cited.includes(b.slug.toLowerCase()) ? 0 : 1;
    return ac - bc || a.slug.localeCompare(b.slug);
  });

  if (records.length || identity.state === 'present') {
    return {
      state: 'owned',
      identity,
      records,
      unreadable,
      reason: [
        identity.state === 'present' ? `identity present (${identity.articles.length} article(s))` : 'no harness identity',
        `${records.length} style record(s)`,
        unreadable.length ? `${unreadable.length} unreadable` : null,
      ].filter(Boolean).join(', '),
    };
  }

  // Something was there and we could not use it. Saying "nothing to propose" would be a finding we
  // did not earn, and saying nothing at all would hide it.
  if (unreadable.length || blind || identity.state === 'inconclusive') {
    return {
      state: 'inconclusive',
      identity,
      records,
      unreadable,
      reason: unreadable.length
        ? `could not read ${unreadable.length} candidate(s): ${unreadable[0].reason}`
        : `identity could not be read: ${identity.reason}`,
      fix: 'name what could not be read, and ask for another route to it — never propose past a blind spot',
    };
  }

  return {
    state: 'none',
    identity,
    records: [],
    unreadable,
    reason: 'no harness identity and no style record installed in any scope',
    fix: 'propose at most three openable references as candidate bars (design/references/starting-point.md), then run `design-loop`',
  };
}

/**
 * The compact projection `doctor` reports: one object, not a section (P5 — every byte of a report is
 * paid by every user who runs it). Contrast is folded in per record because a record whose own
 * palette fails is not a starting point anyone should be offered.
 *
 * @returns {{state: string, records: string[], contrast: string, unreadable: number, reason: string}}
 */
export function startingPointSummary(root = process.cwd(), roots = defaultRoots({ cwd: root })) {
  const r = ownedStartingPoints(roots, root);
  let failing = 0;
  let unmeasured = 0;
  for (const rec of r.records) {
    const c = checkPairings(rec.palette);
    if (c.failures.length) failing += 1;
    else if (!c.ok) unmeasured += 1;
  }
  const contrast = r.records.length === 0
    ? 'no record to measure'
    : failing
      ? `${failing} record(s) with a pair below its floor`
      : unmeasured
        ? `${unmeasured} record(s) could not be measured`
        : 'all records above their floors';
  return {
    state: r.state,
    records: r.records.map((x) => x.slug),
    contrast,
    unreadable: r.unreadable.length,
    reason: r.reason,
    ...(r.fix ? { fix: r.fix } : {}),
  };
}
