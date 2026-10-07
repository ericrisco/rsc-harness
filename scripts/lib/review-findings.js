// Consolidation of the refuter panel's findings — the deterministic half of `review`.
//
// Three fresh-context lenses attack the same diff, so they often report the SAME defect in three
// different sentences, and the author spends triage time discovering that eleven findings are four.
// Grouping them is an algorithm, not a judgement (P1), so it lives here and not in the skill's prose.
// What survives grouping and is serious enough to block goes to `finding-verifier` — that half IS
// judgement, and stays in the agent.
//
// Input: what the lenses emit — fenced ```json findings blocks inside their reports, or plain JSON.
// Output: unique findings, highest severity first, each with the lenses that reported it and a
// `verify` flag on the ones the verifier must try to refute before they may block.

export const SEVERITIES = ['blocker', 'should-fix', 'nit', 'question'];
const ALIASES = {
  critical: 'blocker', high: 'blocker', blocking: 'blocker',
  medium: 'should-fix', shouldfix: 'should-fix', 'should_fix': 'should-fix', major: 'should-fix',
  low: 'nit', info: 'nit', minor: 'nit',
};
const rank = (s) => SEVERITIES.indexOf(s);
export const DEFAULT_WINDOW = 3;

export function normalizeSeverity(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (SEVERITIES.includes(s)) return s;
  return ALIASES[s] || ALIASES[s.replace(/[-\s]/g, '')] || null;
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const normFile = (f) => text(f).replace(/\\/g, '/').replace(/^\.\//, '');
const normEvidence = (e) => text(e).replace(/\s+/g, ' ').toLowerCase();

// Pull every finding out of one source. A source is a lens report (markdown with fenced blocks) or a
// JSON file. Anything unparseable is reported, never silently dropped: a lost finding is the one
// failure a consolidation step must not add.
export function parseFindings(raw, source = 'stdin') {
  const findings = [];
  const errors = [];
  const take = (value, where) => {
    const list = Array.isArray(value) ? value : (Array.isArray(value?.findings) ? value.findings : [value]);
    for (const item of list) {
      if (!item || typeof item !== 'object') { errors.push(`${where}: a finding must be an object`); continue; }
      findings.push({ ...item, source });
    }
  };
  const blocks = [...String(raw).matchAll(/```json[ \t]+findings[^\n]*\n([\s\S]*?)```/g)];
  if (blocks.length) {
    blocks.forEach((m, i) => {
      try { take(JSON.parse(m[1]), `${source} block ${i + 1}`); }
      catch (e) { errors.push(`${source} block ${i + 1}: not valid JSON (${e.message})`); }
    });
    return { findings, errors };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return { findings, errors };
  try { take(JSON.parse(trimmed), source); }
  catch { errors.push(`${source}: no \`\`\`json findings block and not plain JSON`); }
  return { findings, errors };
}

// The pre-report gate, checked instead of trusted: a blocker or should-fix with no location or no
// concrete failure scenario is a suspicion, and a suspicion is a question. The downgrade is visible.
export function normalizeFinding(f) {
  const out = {
    lens: text(f.lens) || text(f.source) || 'unknown',
    severity: normalizeSeverity(f.severity),
    file: normFile(f.file),
    line: Number.isInteger(Number(f.line)) && Number(f.line) > 0 ? Number(f.line) : null,
    claim: text(f.claim) || text(f.title) || text(f.summary),
    failure_scenario: text(f.failure_scenario) || text(f.repro),
    evidence: text(f.evidence),
    notes: [],
  };
  if (!out.severity) {
    out.notes.push(`severity "${f.severity ?? ''}" unknown → question`);
    out.severity = 'question';
  }
  if (rank(out.severity) <= rank('should-fix')) {
    const missing = [];
    if (!out.file || !out.line) missing.push('file:line');
    if (!out.failure_scenario) missing.push('failure_scenario');
    if (missing.length) {
      out.notes.push(`${out.severity} without ${missing.join(' and ')} → question`);
      out.severity = 'question';
    }
  }
  return out;
}

// Two findings are the same defect when they quote the same evidence, or when they point at the same
// place (same file, lines within the window) AND say the same thing. Place alone is not enough: the
// first real panel run put two different defects on adjacent lines (a discount applied to one unit,
// and a missing 0..100 check), and merging them buried the second one where no verifier looked.
// A missed merge costs one extra verification; a wrong merge hides a defect — so the bar is
// conservative. "Say the same thing" is word overlap (Jaccard) of claim, or claim + failure scenario.
const STOP = new Set('the and for with not that this its are was from any only one but has have into than then when which will can its'.split(' '));
const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  const A = words(a); const B = words(b);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  const union = A.size + B.size - shared;
  return union ? shared / union : 0;
}
export const SAME_CLAIM = 0.2;
export function similarity(a, b) {
  return Math.max(overlap(a.claim, b.claim),
    overlap(`${a.claim} ${a.failure_scenario}`, `${b.claim} ${b.failure_scenario}`));
}
function sameDefect(a, b, window) {
  const ea = normEvidence(a.evidence);
  if (ea.length >= 12 && ea === normEvidence(b.evidence)) return true;
  const near = a.file && a.file === b.file && a.line && b.line && Math.abs(a.line - b.line) <= window;
  return Boolean(near) && similarity(a, b) >= SAME_CLAIM;
}

export function consolidate(rawFindings, { window = DEFAULT_WINDOW } = {}) {
  const items = rawFindings.map(normalizeFinding);
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (sameDefect(items[i], items[j], window)) parent[find(j)] = find(i);
    }
  }
  const groups = new Map();
  items.forEach((it, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(it);
  });
  const uniq = (xs) => [...new Set(xs.filter(Boolean))];
  const merged = [...groups.values()].map((members) => {
    const severity = SEVERITIES[Math.min(...members.map((m) => rank(m.severity)))];
    const lines = members.map((m) => m.line).filter(Boolean);
    return {
      severity,
      file: uniq(members.map((m) => m.file))[0] || '',
      lines: lines.length ? [Math.min(...lines), Math.max(...lines)] : [],
      lenses: uniq(members.map((m) => m.lens)).sort(),
      claims: uniq(members.map((m) => m.claim)),
      failure_scenarios: uniq(members.map((m) => m.failure_scenario)),
      evidence: uniq(members.map((m) => m.evidence)),
      notes: uniq(members.flatMap((m) => m.notes)),
      reported: members.length,
      verify: rank(severity) <= rank('should-fix'),
    };
  });
  merged.sort((a, b) => rank(a.severity) - rank(b.severity)
    || a.file.localeCompare(b.file) || (a.lines[0] || 0) - (b.lines[0] || 0));
  merged.forEach((m, i) => { m.id = `F${i + 1}`; });
  return {
    reported: items.length,
    unique: merged.length,
    toVerify: merged.filter((m) => m.verify).length,
    findings: merged,
  };
}

const where = (f) => (f.file ? `${f.file}${f.lines.length ? `:${f.lines[0]}${f.lines[1] !== f.lines[0] ? `-${f.lines[1]}` : ''}` : ''}` : '(no location)');

export function renderConsolidation(result, errors = []) {
  const out = [
    `${result.reported} finding(s) reported → ${result.unique} unique · ${result.toVerify} go to finding-verifier`,
  ];
  for (const f of result.findings) {
    out.push('', `${f.id} [${f.severity}] ${where(f)} — ${f.claims[0] || '(no claim)'}`);
    out.push(`   lenses: ${f.lenses.join(', ')}${f.reported > 1 ? ` (${f.reported} reports merged)` : ''}`);
    for (const c of f.claims.slice(1)) out.push(`   also: ${c}`);
    for (const s of f.failure_scenarios) out.push(`   failure: ${s}`);
    for (const n of f.notes) out.push(`   note: ${n}`);
    if (f.verify) out.push('   → verify: dispatch finding-verifier; it blocks only if CONFIRMED');
  }
  for (const e of errors) out.push('', `⚠️  ${e}`);
  return out.join('\n');
}
