// Project copy rules: the phrases a project has forbidden in anything it publishes.
//
// Until this file existed those rules were prose the model read and interpreted. A student's project
// banned recruitment wording in decisions.md, and the agent still delivered "this is not a recruitment
// network": it judged that negating a banned word was allowed. A rule the model can reinterpret is a
// preference. This module turns the project's own wording into patterns a script can check, so the
// copy guard (targets/copy-guard.mjs) and `rsc copy check` enforce it without asking the model.
//
// Where rules come from, all under 02-DOCS/wiki/ (raw/ is unprocessed input, not policy):
//   1. a heading that names a ban ("## Never use", "## Frases prohibidas") → its bullet items;
//   2. a "Never use: a, b, c" line → its comma-separated items;
//   3. a sentence that prohibits ("Queda prohibido …", "Never say …") → its quoted phrases.
// Only node builtins: the file is copied next to the hook and must run with nothing installed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// A rule is a DECLARATION, not a mention. 3.0.21 read any sentence that contained "prohibido" and any
// backticked token near it, and on a real wiki that turned file names, table cells and words like
// "add" or "review" into banned phrases: documentation ABOUT rules became rules. So the keyword has to
// open the line or sentence, code spans are never phrases in prose, tables are skipped, and process
// records (ftd/, sdd/) are not policy.
const BAN = String.raw`(?:prohib\p{L}*|vetad\p{L}*|forbidden|banned|never (?:use|say|write)|nunca (?:uses|usar|digas|decir|escribas)|no (?:uses|digas|escribas)|do not (?:use|say|write)|don'?t (?:use|say|write)|blocklist|denylist)`;
const LEAD = String.raw`^[\s>*_¡¿("“«-]*(?:(?:queda|quedan|esta|está|estan|están|it is|it's|is|are|strictly|totalmente|terminantemente|absolutamente|words|phrases|terms|palabras|frases|términos|terminos|expresiones)\s+){0,2}`;
const DECLARES = new RegExp(LEAD + BAN, 'iu');
const BAN_HEADING = new RegExp(BAN, 'iu');
const BAN_COLON = new RegExp(String.raw`^\s*(?:[-*+]\s+)?\**\s*(?:(?:queda|quedan|esta|está|it is|words|phrases|terms|palabras|frases|términos|terminos|expresiones)\s+){0,2}${BAN}[\p{L} ]{0,25}:\**\s*(.*)$`, 'iu');
const PROSE_QUOTES = /"([^"\n]{1,80})"|“([^”\n]{1,80})”|«([^»\n]{1,80})»/gu;
const LIST_QUOTES = /"([^"\n]{1,80})"|“([^”\n]{1,80})”|«([^»\n]{1,80})»|`([^`\n]{1,80})`/gu;
const STOP = new Set(['y', 'o', 'e', 'u', 'a', 'de', 'la', 'el', 'en', 'and', 'or', 'the', 'of', 'to', 'in']);
const SKIP_DIRS = new Set(['ftd', 'sdd', 'raw']);
// The guard checks TEXT. A visual-identity ban ("no illustrations of people") read as copy would forbid
// the word "people" in every answer, so pages and sections about visuals are not copy policy.
const VISUAL = /visual|design|dise[nñ]o|colou?r|logo|imagen|image|ilustraci|tipograf|typograph|paleta|palette/iu;

export const normalize = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// A trailing * is the explicit wildcard, so only a markdown bold pair is stripped from the end.
const clean = (s) => s.replace(/\*\*/gu, '').replace(/^[\s"“«`'_]+/u, '').replace(/^(?:y|and|o|or)\s+/iu, '').replace(/[\s"”»`'_.;:,]+$/u, '').trim();

function quotedIn(text, re) {
  const out = [];
  for (const m of text.matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out;
}

function listItems(text) {
  const q = quotedIn(text, LIST_QUOTES);
  if (q.length) return q;
  // Commas only: "cerebros, robots o personas" split on "o" would ban the word "personas".
  return text.split(/[,;]/u).map(clean).filter(Boolean);
}

/** Banned phrases declared in one markdown document. */
export function extractRules(markdown, source = '') {
  const found = [];
  const add = (phrase, line) => {
    const p = clean(phrase);
    const letters = normalize(p).replace(/[^\p{L}]/gu, '');
    // A ban is a word or a short phrase: not a sentence that happened to be quoted, not a stray "y".
    if (p && p.split(/\s+/).length <= 6 && letters.length >= 2 && !STOP.has(normalize(p))) found.push({ phrase: p, source, line });
  };
  const lines = String(markdown).split('\n');
  let inFence = false, banSection = false, visualSection = false, para = [], paraStart = 0, colonList = null;
  const flush = () => {
    if (colonList) { for (const item of listItems(colonList.text)) add(item, colonList.line); colonList = null; }
    if (!para.length) return;
    const text = para.join(' ');
    for (const sentence of text.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡"“«*])/u)) {
      if (DECLARES.test(sentence)) for (const q of quotedIn(sentence, PROSE_QUOTES)) add(q, paraStart + 1);
    }
    para = [];
  };
  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { flush(); inFence = !inFence; return; }
    if (inFence) return;
    if (/^\s*\|/.test(raw)) { flush(); return; }
    const heading = raw.match(/^#{1,6}\s+(.*)$/);
    if (heading) { flush(); visualSection = VISUAL.test(heading[1]); banSection = !visualSection && BAN_HEADING.test(heading[1]) && heading[1].split(/\s+/).length <= 6; return; }
    if (visualSection) return;
    if (!raw.trim()) { flush(); return; }
    const bullet = raw.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    // A "Vetado: a, b," list may wrap onto the next lines; it runs until a blank line or a new item.
    if (colonList && !bullet) { colonList.text += ' ' + raw.trim(); const end = colonList.text.search(/[.!?](?=\s+\p{Lu}|\s*$)/u); if (end >= 0) { colonList.text = colonList.text.slice(0, end); flush(); } return; }
    const colon = raw.match(BAN_COLON);
    if (colon) { flush(); colonList = { text: colon[1], line: i + 1 }; const end = colonList.text.search(/[.!?](?=\s+\p{Lu}|\s*$)/u); if (end >= 0) { colonList.text = colonList.text.slice(0, end); flush(); } return; }
    if (bullet && banSection) { flush(); for (const item of listItems(bullet[1])) add(item, i + 1); return; }
    if (bullet) { flush(); para = [bullet[1]]; paraStart = i; flush(); return; }
    if (!para.length) paraStart = i;
    para.push(raw.trim());
  });
  flush();
  return found;
}

/** Every rule in the project's wiki, de-duplicated by its normalized phrase. */
export function loadRules(root, { maxFiles = 3000 } = {}) {
  const base = join(root, '02-DOCS', 'wiki');
  const files = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (files.length >= maxFiles || name.startsWith('.')) continue;
      const full = join(dir, name);
      let st; try { st = statSync(full); } catch { continue; }
      // Archived pages (_archive/, archive/) are history, not the rules in force.
      if (st.isDirectory()) { if ((dir !== base || !SKIP_DIRS.has(name)) && !name.startsWith('_') && !/^archive/i.test(name)) walk(full); }
      else if (name.endsWith('.md') && !VISUAL.test(name)) files.push(full);
    }
  };
  walk(base);
  const seen = new Map();
  for (const f of files) {
    let body = '';
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    for (const r of extractRules(body, relative(root, f).split('\\').join('/'))) {
      const key = normalize(r.phrase);
      if (!seen.has(key)) seen.set(key, r);
    }
  }
  return [...seen.values()];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The pattern for one phrase. A trailing * widens it explicitly. A single Spanish infinitive is the
 * one implicit widening, because that is how such bans are written and how they leak: "captar"
 * forbidden, "captación" delivered. Only forms that continue the stem with the verb's own vowels
 * count, so "captar" catches "capta", "captación", "captando" and leaves "captura" alone.
 */
export function patternOf(phrase) {
  let p = normalize(phrase).trim();
  let tail = '(?![\\p{L}\\p{N}])';
  if (p.endsWith('*')) { p = p.slice(0, -1); tail = '[\\p{L}\\p{N}]*'; }
  else if (/^\p{L}{3,}(ar|er|ir)$/u.test(p)) {
    const vowels = p.endsWith('ar') ? '[aeo]' : '[aeio]';
    return new RegExp(`(?<![\\p{L}\\p{N}])${esc(p.slice(0, -2))}${vowels}\\p{L}*`, 'gu');
  }
  const body = p.split(/\s+/).map(esc).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${tail}`, 'gu');
}

/** Text with code removed: an agent may cite a rule inside backticks without it counting as copy. */
export function proseOnly(text) {
  return String(text)
    .replace(/```[\s\S]*?(?:```|$)/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

/** Each place the text uses a banned phrase: { phrase, source, line, match }. */
export function findViolations(text, rules) {
  const hits = [];
  const compiled = rules.map((r) => ({ r, re: patternOf(r.phrase) }));
  String(text).split('\n').forEach((raw, i) => {
    const line = normalize(raw);
    for (const { r, re } of compiled) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) hits.push({ phrase: r.phrase, source: r.source, line: i + 1, match: m[0] });
    }
  });
  return hits;
}
