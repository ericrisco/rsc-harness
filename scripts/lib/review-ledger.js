// The review ledger — the deterministic half of ASDD's fix loop and of the reviewer's learning.
//
// Anthropic's reviewer and author once looped more than fifty rounds on one PR, and about 59% of what
// the reviewer kept flagging was code it had already seen. Three rules stopped that: cap the rounds,
// never repeat a finding, and record what happened to each finding so noise can be measured. A rule
// that only lives in a skill's prose is the decorative gate (P2), so the three live here.
// Spec: 02-DOCS/wiki/sdd/specs/asdd-v4.md.
//
// One JSONL file, append-only: `finding`, `outcome` and `round` entries. It sits under .rsc/ and is
// excluded from the sello's candidate like every other journal the harness writes (targets/sello.mjs).

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const LEDGER_PATH = '.rsc/review-ledger.jsonl';
export const OUTCOMES = ['fixed', 'false', 'intentional', 'irrelevant'];
export const MAX_ROUNDS = 3;
export const EVALS_DIR = '02-DOCS/wiki/sdd/review-evals';

// Two findings are the same claim when they sit in the same file and either name the same bug class
// or share most of their words. The line is left out on purpose: it moves between rounds, and a
// repeat must survive the fix that moved it.
export const SAME_CLAIM = 0.5;
const STOP = new Set('the and for with not that this its are was from any only one but has have into than then when which will can'.split(' '));
const words = (s) => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
function overlap(a, b) {
  const A = words(a); const B = words(b);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared += 1;
  const union = A.size + B.size - shared;
  return union ? shared / union : 0;
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const normFile = (f) => text(f).replace(/\\/g, '/').replace(/^\.\//, '');

// Accepts what the lenses emit and what `review consolidate --json` prints.
export function normalize(f) {
  return {
    file: normFile(f.file),
    class: text(f.class) || text(f.bug_class) || text(f.defect_class),
    claim: text(f.claim) || (Array.isArray(f.claims) ? text(f.claims[0]) : '') || text(f.title) || text(f.summary),
    severity: text(f.severity) || 'question',
  };
}

export function sameClaim(a, b) {
  if (a.file !== b.file) return false;
  if (a.class && b.class && a.class.toLowerCase() === b.class.toLowerCase()) return true;
  return overlap(a.claim, b.claim) >= SAME_CLAIM;
}

export function readLedger(root) {
  const path = join(root, LEDGER_PATH);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function append(root, entries) {
  mkdirSync(join(root, '.rsc'), { recursive: true });
  appendFileSync(join(root, LEDGER_PATH), entries.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

// → [{id, status: 'new'|'repeat', repeatOf?, ...finding}]. A repeat is recorded too (it is the noise
// being measured) but points at the original, and the caller must not raise it again.
export function record(root, rawFindings, { task = '', now = new Date().toISOString() } = {}) {
  const ledger = readLedger(root);
  const seen = ledger.filter((e) => e.type === 'finding' && !e.repeatOf);
  let n = ledger.filter((e) => e.type === 'finding').length;
  const out = [];
  for (const raw of rawFindings) {
    const f = normalize(raw);
    n += 1;
    const original = seen.find((s) => sameClaim(s, f));
    const entry = { type: 'finding', id: `L${n}`, task, at: now, ...f, ...(original ? { repeatOf: original.id } : {}) };
    if (!original) seen.push(entry);
    out.push(entry);
  }
  append(root, out);
  return out.map((e) => ({ ...e, status: e.repeatOf ? 'repeat' : 'new' }));
}

export function outcome(root, id, value, { now = new Date().toISOString() } = {}) {
  if (!OUTCOMES.includes(value)) {
    return { ok: false, message: `rsc: unknown outcome "${value}". Use one of: ${OUTCOMES.join(', ')}.` };
  }
  if (!readLedger(root).some((e) => e.type === 'finding' && e.id === id)) {
    return { ok: false, message: `rsc: no finding "${id}" in ${LEDGER_PATH}. Run \`npx @ericrisco/rsc review ledger stats\` to see the recorded ids.` };
  }
  append(root, [{ type: 'outcome', id, outcome: value, at: now }]);
  return { ok: true, message: `${id}: ${value}` };
}

// Counts one more review round for a task. The fourth is refused, with the way out in the message
// (P6): rethink the approach, or park the task in the decision queue and go on with independent work.
export function round(root, task, { now = new Date().toISOString() } = {}) {
  const n = readLedger(root).filter((e) => e.type === 'round' && e.task === task).length + 1;
  if (n > MAX_ROUNDS) {
    return {
      ok: false, round: n,
      message: `rsc: task "${task}" has had ${MAX_ROUNDS} review rounds and has not converged. Stop fixing line by line: rethink the approach, or park the task in the decision queue (02-DOCS/wiki/sdd/progress/<slug>.md, "## Decision queue") and continue with independent tasks.`,
    };
  }
  append(root, [{ type: 'round', task, n, at: now }]);
  return { ok: true, round: n, message: `task "${task}": review round ${n} of ${MAX_ROUNDS}` };
}

export function stats(root) {
  const ledger = readLedger(root);
  const findings = ledger.filter((e) => e.type === 'finding');
  const originals = findings.filter((f) => !f.repeatOf);
  const last = new Map();
  for (const e of ledger) if (e.type === 'outcome') last.set(e.id, e.outcome);
  const outcomes = Object.fromEntries([...OUTCOMES, 'open'].map((k) => [k, 0]));
  for (const f of originals) outcomes[last.get(f.id) || 'open'] += 1;
  const closed = originals.length - outcomes.open;
  const rounds = new Map();
  for (const e of ledger) if (e.type === 'round') rounds.set(e.task, Math.max(rounds.get(e.task) || 0, e.n));
  const totalRounds = [...rounds.values()].reduce((a, b) => a + b, 0);
  return {
    findings: originals.length,
    repeats: findings.length - originals.length,
    outcomes,
    falseRate: closed ? outcomes.false / closed : null,
    tasks: rounds.size,
    meanRounds: rounds.size ? totalRounds / rounds.size : null,
    open: originals.filter((f) => !last.has(f.id)).map((f) => f.id),
  };
}

export function renderStats(s) {
  const pct = (x) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
  return [
    `findings: ${s.findings} unique, ${s.repeats} repeat(s) caught`,
    `outcomes: ${OUTCOMES.map((k) => `${k} ${s.outcomes[k]}`).join(' · ')} · open ${s.outcomes.open}`,
    `false rate: ${pct(s.falseRate)} of closed findings`,
    `rounds: ${s.tasks} task(s), mean ${s.meanRounds === null ? 'n/a' : s.meanRounds.toFixed(2)} round(s) per task`,
    ...(s.open.length ? [`still open: ${s.open.join(', ')} — close each with \`review ledger outcome <id> <${OUTCOMES.join('|')}>\``] : []),
  ].join('\n');
}

// Escapes: reverts that reached the trunk. Each one should become a case the reviewer is scored
// against (the diff, where the bug was, what the review should have said). Only the conventional
// shapes are visible — `Revert "…"` from git, and a `revert:` commit type — and the output says so.
const REVERT = /^(?:\S+\s+)?(?:Revert "|revert(?:\([^)]*\))?!?:)/;
export function escapes(root, { since = '' } = {}) {
  const range = since ? [`${since}..HEAD`] : [];
  const r = spawnSync('git', ['-C', root, 'log', '--format=%H%x00%s', ...range], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return { ok: false, message: `rsc: cannot read git history${since ? ` since ${since}` : ''} (${(r.stderr || '').trim() || 'not a git repository'}).`, reverts: [] };
  let cases = [];
  try { cases = readdirSync(join(root, EVALS_DIR)).filter((f) => f.endsWith('.md')); } catch { cases = []; }
  const reverts = r.stdout.split('\n').filter(Boolean).map((line) => {
    const [sha, subject] = line.split('\0');
    return { sha: sha.slice(0, 7), subject };
  }).filter((c) => REVERT.test(c.subject)).map((c) => ({ ...c, covered: cases.some((f) => f.startsWith(c.sha)) }));
  return { ok: true, reverts };
}

export function renderEscapes(res) {
  if (!res.reverts.length) return 'No reverts found (only `Revert "…"` subjects and `revert:` commits are recognised).';
  const pending = res.reverts.filter((c) => !c.covered).length;
  return [
    ...res.reverts.map((c) => `${c.covered ? 'case  ' : 'NO CASE'} ${c.sha}  ${c.subject}`),
    '',
    pending
      ? `${pending} revert(s) without a case. Write each as ${EVALS_DIR}/<sha>.md: the diff, where the bug was, what the review should have said.`
      : 'Every revert has its case.',
  ].join('\n');
}
