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

const BAN = String.raw`(?:prohib\p{L}*|forbid\p{L}*|banned|ban list|never (?:use|say|write)|nunca (?:uses|usar|digas|decir|escribas)|no (?:uses|digas|escribas)|do not (?:use|say|write)|don'?t (?:use|say|write)|vetad\p{L}*|blocklist|denylist)`;
const BAN_HEADING = new RegExp(BAN, 'iu');
const BAN_SENTENCE = new RegExp(BAN, 'iu');
const BAN_COLON = new RegExp(String.raw`^\s*(?:[-*+]\s+)?\**\s*(?:[\p{L} ]{0,20}\s)?${BAN}[^:]{0,20}:\**\s*(.+)$`, 'iu');
const QUOTED = /"([^"\n]{1,80})"|“([^”\n]{1,80})”|«([^»\n]{1,80})»|`([^`\n]{1,80})`/gu;

export const normalize = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// A trailing * is the explicit wildcard, so only a markdown bold pair is stripped from the end.
const clean = (s) => s.replace(/^[\s"“«`'*_]+/u, '').replace(/\*\*$/u, '').replace(/[\s"”»`'_.;:,]+$/u, '').trim();

function quotedIn(text) {
  const out = [];
  for (const m of text.matchAll(QUOTED)) out.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  return out;
}

function listItems(text) {
  const q = quotedIn(text);
  if (q.length) return q;
  return text.split(/[,;]|\s+(?:y|and|o|or)\s+/u).map(clean).filter(Boolean);
}

/** Banned phrases declared in one markdown document. */
export function extractRules(markdown, source = '') {
  const found = [];
  const add = (phrase, line) => {
    const p = clean(phrase);
    // A ban is a word or a short phrase. Anything longer is a sentence that happened to be quoted.
    if (p && p.split(/\s+/).length <= 6 && /\p{L}/u.test(p)) found.push({ phrase: p, source, line });
  };
  const lines = String(markdown).split('\n');
  let inFence = false, banSection = false, para = [], paraStart = 0;
  const flush = () => {
    if (!para.length) return;
    const text = para.join(' ');
    for (const sentence of text.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡"“«])/u)) {
      if (BAN_SENTENCE.test(sentence)) for (const q of quotedIn(sentence)) add(q, paraStart + 1);
    }
    para = [];
  };
  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { flush(); inFence = !inFence; return; }
    if (inFence) return;
    const heading = raw.match(/^#{1,6}\s+(.*)$/);
    if (heading) { flush(); banSection = BAN_HEADING.test(heading[1]); return; }
    if (!raw.trim()) { flush(); return; }
    const colon = raw.match(BAN_COLON);
    if (colon && !quotedIn(raw.slice(0, raw.indexOf(':'))).length) { flush(); for (const item of listItems(colon[1])) add(item, i + 1); return; }
    const bullet = raw.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
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
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.md')) files.push(full);
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
