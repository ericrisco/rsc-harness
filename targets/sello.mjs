// sello.mjs — the deterministic core of the "sello" (review receipt) system.
//
// A sello binds a review verdict to the EXACT bytes that were reviewed. The ship
// gate (ship-guard.mjs) refuses to commit/push/PR anything whose bytes differ from
// what was sealed. Opt-in per project via .rsc/sello-config.json — absent or
// disabled, nothing here runs and the harness behaves exactly as before.
//
// TRUST MODEL — read this before believing a sello. It binds BYTES, not intent:
// it proves "what ships is what was reviewed", never "the review was any good".
// `sello approve` is an unauthenticated local command and the reviewing agent is
// the one that calls it, so the sello is SELF-ATTESTED: it is drift protection
// between review and delivery, not tamper-evidence against the agent or the user.
// Anyone who can write .rsc/ can seal anything — which is why `sello off` is a
// documented one-liner rather than something to defeat.
//
// Design rules (constitution):
//  - P1: everything in this file is an algorithm — no tokens, no judgment.
//  - P2: every gate has a test (tests/sello.test.js), including the risk table itself.
//  - P4: the sello is the artifact that makes an approval binding to a candidate.
//  - P6: every deny message carries its own `Recover:` line, asserted by test.
//  - P7: risk-0 changes (docs/copy) pass in complete silence.
//
// Materialized to .rsc/sello.mjs as a sibling of ship-guard.mjs (hooks are copied
// file-by-file, so imports must be sibling-relative — same pattern as hook-once.mjs).

import { existsSync, lstatSync, readFileSync, readlinkSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------- paths & config

// The sello's own state can never be part of the candidate it seals: writing the
// sello would mutate the change being sealed, so `freeze` → `approve` could never
// converge (a permanent, unrecoverable delivery lockout). Excluded whether the
// project tracks .rsc/ or not.
export const SELLO_STATE_PATHS = [
  '.rsc/sello.json', '.rsc/sello-config.json', '.rsc/sello-findings.md', '.rsc/sello-log.jsonl',
];

export function selloPaths(root) {
  return {
    config: join(root, '.rsc', 'sello-config.json'),
    state: join(root, '.rsc', 'sello.json'),
    findings: join(root, '.rsc', 'sello-findings.md'),
    log: join(root, '.rsc', 'sello-log.jsonl'),
  };
}

export function readConfig(root) {
  try {
    const cfg = JSON.parse(readFileSync(selloPaths(root).config, 'utf8'));
    return cfg && typeof cfg === 'object' ? cfg : null;
  } catch { return null; }
}

export function isEnabled(root) {
  const cfg = readConfig(root);
  return !!(cfg && cfg.enabled === true);
}

// The CLI can run from any subdirectory; the guard always runs from the project
// root. Both must compute the same candidate, so both resolve to the git toplevel.
export function resolveRoot(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() || root : root;
}

// ---------------------------------------------------------------- risk table
//
// Risk is classified by WHAT a path touches, never by how many lines changed.
// Tiers: 0 = nulo (docs/copy — silent), 1 = normal (one lens), 2 = alto (full panel).
// A path is scored by the HIGHEST tier of every row it matches — first-match-wins
// would let the docs row shadow a floor class (`credentials.txt`, `.claude/CLAUDE.md`)
// and hand a silent pass to exactly what the floor exists to guard.

export const RISK_TABLE = [
  { class: 'docs', tier: 0, pattern: '(^|/)(docs|doc)/|\\.(md|mdx|markdown|txt|rst)$|(^|/)LICENSE$|(^|/)CHANGELOG' },
  { class: 'secrets', tier: 2, pattern: '(^|/)\\.env(\\.|$)|(^|/)(secrets?|credentials?)(/|\\.|-|$)|\\.(pem|key|p12|pfx)$|(^|/)[^/]*(secret|credential)[^/]*$' },
  { class: 'auth', tier: 2, pattern: '(^|/)(auth|authn|authz|login|session|oauth|sso)(/|\\.|-)' },
  { class: 'ci', tier: 2, pattern: '(^|/)\\.github/workflows/|(^|/)\\.gitlab-ci\\.yml$|(^|/)Jenkinsfile$' },
  { class: 'migrations', tier: 2, pattern: '(^|/)migrations?/' },
  { class: 'billing', tier: 2, pattern: '(^|/)(billing|payments?|checkout|stripe)(/|\\.|-)' },
  { class: 'harness', tier: 2, pattern: '(^|/)\\.rsc/|(^|/)\\.claude/|(^|/)CLAUDE\\.md$' },
];
export const FLOOR_CLASSES = ['secrets', 'harness'];
export const DEFAULT_TIER = 1;
// User-supplied patterns are compiled inside a PreToolUse hook, so a catastrophic
// one would hang the user's own delivery. Bounded, not sandboxed — the same file
// holds the kill switch, so this is a foot-gun guard, not a security boundary.
export const MAX_PATTERN_LEN = 200;
export const MAX_RAISE_RULES = 64;

// A project override may RAISE freely and may LOWER only explicitly (naming a known
// class), never below tier 1, and never a floor class. Throws with a recoverable
// message; callers fall back to the DEFAULT table, never to a flat tier.
export function validateRiskConfig(cfg) {
  const risk = cfg?.risk;
  if (!risk) return { table: RISK_TABLE, lowered: [] };
  const lowered = [];
  const extra = [];
  const raise = risk.raise || [];
  if (raise.length > MAX_RAISE_RULES) {
    throw new Error(`sello: too many "raise" rules (${raise.length} > ${MAX_RAISE_RULES}). ${MESSAGES.badRiskConfig}`);
  }
  for (const r of raise) {
    if (!r?.pattern || typeof r.pattern !== 'string') {
      throw new Error(`sello: a "raise" entry has no pattern. ${MESSAGES.badRiskConfig}`);
    }
    if (r.pattern.length > MAX_PATTERN_LEN) {
      throw new Error(`sello: pattern longer than ${MAX_PATTERN_LEN} chars. ${MESSAGES.badRiskConfig}`);
    }
    try { new RegExp(r.pattern); }
    catch (e) { throw new Error(`sello: uncompilable pattern ${JSON.stringify(r.pattern)} (${e.message}). ${MESSAGES.badRiskConfig}`); }
    extra.push({ class: r.class || 'custom', tier: r.tier === 1 ? 1 : 2, pattern: r.pattern });
  }
  for (const l of risk.lower || []) {
    const cls = typeof l === 'string' ? l : l?.class;
    if (FLOOR_CLASSES.includes(cls)) {
      throw new Error(`sello: the "${cls}" class can never be lowered — secrets and the harness's own configuration keep their risk tier under every configuration. ${MESSAGES.badRiskConfig}`);
    }
    if (!RISK_TABLE.some((row) => row.class === cls)) {
      throw new Error(`sello: cannot lower unknown class "${cls}". ${MESSAGES.badRiskConfig}`);
    }
    lowered.push(cls);
  }
  const table = [
    ...extra,
    ...RISK_TABLE.map((row) => (lowered.includes(row.class) ? { ...row, tier: 1 } : row)),
  ];
  return { table, lowered };
}

// → {tier, classes: {path: class}, lowered, configError} — a path scores the MAX
// tier of every row it matches; unmatched paths land on DEFAULT_TIER.
export function classifyRisk(paths, cfg = null) {
  let table = RISK_TABLE;
  let lowered = [];
  let configError = null;
  try { ({ table, lowered } = validateRiskConfig(cfg || {})); }
  catch (e) { configError = e.message; table = RISK_TABLE; lowered = []; }

  const compiled = table.map((r) => ({ ...r, re: new RegExp(r.pattern) }));
  const classes = {};
  let tier = 0;
  for (const p of paths) {
    let best = -1;
    let cls = 'default';
    for (const row of compiled) {
      if (row.re.test(p) && row.tier > best) { best = row.tier; cls = row.class; }
    }
    if (best < 0) { best = DEFAULT_TIER; cls = 'default'; }
    classes[p] = cls;
    if (best > tier) tier = best;
  }
  return { tier, classes, lowered, configError };
}

// How many lenses a tier requires (capped by an explicit config knob, floor 1).
export function lensesRequired(tier, cfg = null) {
  const base = tier === 0 ? 0 : tier === 1 ? 1 : 3;
  const cap = Number(cfg?.lenses);
  if (base > 0 && Number.isFinite(cap) && cap >= 1) return Math.min(base, Math.floor(cap));
  return base;
}

// ---------------------------------------------------------------- candidate

// core.quotePath makes git escape non-ASCII paths ("caf\303\251.js"); the escaped
// name matches no file on disk, so the file would hash as deleted and any later
// mutation of it would sail through the gate. -z gives raw NUL-separated paths.
function git(root, ...args) {
  const r = spawnSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return r.status === 0 ? (r.stdout || '') : null;
}
const nulList = (out) => (out || '').split('\0').filter(Boolean);

export function trunkRef(root, cfg = null) {
  const configured = typeof cfg?.trunk === 'string' ? [cfg.trunk, `origin/${cfg.trunk}`] : [];
  for (const ref of [...configured, 'origin/main', 'origin/master', 'main', 'master']) {
    if (git(root, 'rev-parse', '--verify', '--quiet', ref) !== null) return ref;
  }
  return null;
}

// The candidate is the change vs the trunk merge-base: every path that differs
// between that base and the working tree (committed on the branch, staged, unstaged
// or untracked), each hashed byte-for-byte. Deleted paths hash to "D". Symlinks hash
// their target string, never the pointed-at bytes (an out-of-repo link must not be
// read, and a link to a FIFO would hang the hook).
export function computeCandidate(rawRoot, cfg = null) {
  const root = resolveRoot(rawRoot);
  const trunk = trunkRef(root, cfg);
  if (!trunk) return null;
  const head = git(root, 'rev-parse', 'HEAD');
  const base = head ? (git(root, 'merge-base', 'HEAD', trunk) || '').trim() : null;
  if (!base) return null;

  const names = new Set();
  for (const n of nulList(git(root, 'diff', '--name-only', '-z', base))) names.add(n);
  for (const n of nulList(git(root, 'ls-files', '--others', '--exclude-standard', '-z'))) names.add(n);
  for (const p of SELLO_STATE_PATHS) names.delete(p);

  const files = {};
  const numstat = {};
  for (const name of [...names].sort()) {
    const abs = join(root, name);
    let st = null;
    try { st = lstatSync(abs); } catch { st = null; }
    if (!st) { files[name] = 'D'; continue; }
    if (st.isSymbolicLink()) {
      files[name] = 'L:' + createHash('sha256').update(readlinkSync(abs)).digest('hex');
    } else if (st.isFile()) {
      files[name] = createHash('sha256').update(readFileSync(abs)).digest('hex');
    } else {
      files[name] = 'S'; // socket/fifo/device — never read, but its presence counts
    }
  }
  for (const line of (git(root, 'diff', '--numstat', base) || '').split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (m) numstat[m[3]] = (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
  }
  // Untracked files never appear in numstat, so a fix hidden in a new file would
  // cost zero budget. Count their lines.
  for (const n of nulList(git(root, 'ls-files', '--others', '--exclude-standard', '-z'))) {
    if (SELLO_STATE_PATHS.includes(n) || numstat[n] !== undefined) continue;
    try {
      const st = lstatSync(join(root, n));
      if (st.isFile()) numstat[n] = readFileSync(join(root, n), 'utf8').split('\n').length;
    } catch { /* unreadable → not counted */ }
  }
  return { base, files, numstat };
}

export function candidateDigest(candidate) {
  const body = Object.keys(candidate.files).sort().map((p) => `${p}:${candidate.files[p]}`).join('\n');
  return createHash('sha256').update(`${candidate.base}\n${body}`).digest('hex');
}

// ---------------------------------------------------------------- sello state

export function readSello(root) {
  const p = selloPaths(resolveRoot(root)).state;
  if (!existsSync(p)) return { missing: true };
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (!s || typeof s !== 'object' || !s.files || !s.base) return { corrupt: true };
    return s;
  } catch { return { corrupt: true }; }
}

export function writeSello(rawRoot, sello) {
  const p = selloPaths(resolveRoot(rawRoot)).state;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(sello, null, 2) + '\n');
}

// A durable record of what was delivered under which verdict — the sello file
// itself is overwritten by the next freeze, so without this the trail dies.
export function appendLog(rawRoot, entry) {
  const p = selloPaths(resolveRoot(rawRoot)).log;
  mkdirSync(dirname(p), { recursive: true });
  appendFileSync(p, JSON.stringify(entry) + '\n');
}

export function appendFindings(rawRoot, lines) {
  if (!lines?.length) return;
  const p = selloPaths(resolveRoot(rawRoot)).findings;
  mkdirSync(dirname(p), { recursive: true });
  const header = existsSync(p) ? '' : '# sello — hallazgos no bloqueantes\n\nSe acumulan aquí; `rsc sello report` los muestra. No interrumpen nada.\n';
  const flat = lines.map((l) => `- ${String(l).replace(/\s*\n\s*/g, ' ')}`);
  appendFileSync(p, header + flat.join('\n') + '\n');
}

export function countFindings(rawRoot) {
  const p = selloPaths(resolveRoot(rawRoot)).findings;
  if (!existsSync(p)) return 0;
  return readFileSync(p, 'utf8').split('\n').filter((l) => l.startsWith('- ')).length;
}

// ---------------------------------------------------------------- delivery detection
//
// Does this shell command actually DELIVER? Two failure modes to avoid, both real:
// denying `grep -rn "git push" docs/` (the words inside a string are not a delivery)
// and allowing `git -C . commit` (a first-class agent pattern — cwd resets between
// Bash calls, so agents pass -C routinely).
// Flags that may sit between the binary and the subcommand: --long, --long=value,
// and single-letter flags that take a separate value (-C path, -c k=v, -R owner/repo).
const GIT_OPTS = '(?:-{1,2}[\\w-]+(?:=\\S+)?\\s+|-[A-Za-z]\\s+\\S+\\s+)*';
const GIT_DELIVERY = new RegExp(`\\bgit\\s+${GIT_OPTS}(?:commit|push)(?![\\w-])`);
const GH_DELIVERY = new RegExp(`\\bgh\\s+${GIT_OPTS}pr\\s+${GIT_OPTS}(?:create|merge)(?![\\w-])`);

export function isDeliveryCommand(command) {
  if (typeof command !== 'string' || !command) return false;
  // Blank out quoted strings so a command that merely MENTIONS the words is not
  // mistaken for one that runs them.
  const bare = command.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  return GIT_DELIVERY.test(bare) || GH_DELIVERY.test(bare);
}

// ---------------------------------------------------------------- messages (P6)
//
// Every message that can DENY an action carries a `Recover:` line naming the exact
// way out. tests/sello.test.js iterates MESSAGES and asserts this for every entry —
// a block without its recovery is the one thing this system may never produce.

export const MESSAGES = {
  noReview: (tier) =>
    `sello: this change is risk tier ${tier} and has no review. ` +
    `Recover: run the \`review\` skill (it freezes, reviews and approves the sello), or \`npx @ericrisco/rsc sello off\` to turn the sello off for this project.`,
  diverged: (paths) =>
    `sello: the change no longer matches what was reviewed — ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ` (+${paths.length - 5} more)` : ''} differ from the sealed bytes. ` +
    `Recover: re-run the \`review\` skill on the divergence (only what changed is re-reviewed), or \`npx @ericrisco/rsc sello off\` for this project.`,
  baseMoved: () =>
    `sello: the sello belongs to a different base — the branch was rebased/merged, or this sello was left over from a change that already shipped. Either way nothing has reviewed the current candidate. ` +
    `Recover: re-run the \`review\` skill (only the divergence is re-reviewed), or \`npx @ericrisco/rsc sello off\` for this project.`,
  corrupt: () =>
    `sello: the sello file is unreadable, which counts as "no review" — nothing is ever approved by default. ` +
    `Recover: re-run the \`review\` skill to produce a fresh sello, or \`npx @ericrisco/rsc sello off\` for this project.`,
  blocked: (reason) =>
    `sello: the review left this change BLOCKED${reason ? ` (${reason})` : ''}. ` +
    `Recover: fix the blocking findings and re-run the \`review\` skill, or \`npx @ericrisco/rsc sello off\` for this project.`,
  notFrozen: () =>
    `sello: nothing is frozen yet, so there is nothing to approve. ` +
    `Recover: run \`npx @ericrisco/rsc sello freeze\` first, then review, then approve.`,
  staleFreeze: () =>
    `sello: the change mutated after it was frozen — approving now would seal bytes nobody reviewed. ` +
    `Recover: run \`npx @ericrisco/rsc sello freeze\` again and re-review the divergence.`,
  overBudget: (spent, budget) =>
    `sello: the fix touched ~${spent} line(s) but the declared budget was ${budget} — an unexplained overrun is how over-engineering gets in. ` +
    `Recover: re-run with --justify "<why the budget was not enough>" to record the reason, or shrink the fix.`,
  partialLenses: (given, required) =>
    `sello: risk tier needs ${required} lens(es) but only ${given} were recorded — an incomplete panel must not seal silently. ` +
    `Recover: run the missing lenses and pass them all to --lenses, or accept the gap on purpose with --accept-partial-lenses.`,
  badRiskConfig:
    'Recover: fix .rsc/sello-config.json — "raise" entries need a valid pattern under 200 chars; "lower" only accepts known classes and never "secrets" or "harness". `npx @ericrisco/rsc sello off` always works, even with a broken config.',
  riskUnknown: () =>
    `sello: the risk of this change could not be evaluated, so it is treated as risk tier 1 (never silently as 0). ` +
    `Recover: check that this is a git repository with a reachable trunk (origin/main, main, or "trunk" in .rsc/sello-config.json), then retry.`,
  noTrunk: () =>
    `sello: no trunk branch found (looked for origin/main, origin/master, main, master), so the gate cannot compute what changed and is standing down. ` +
    `Recover: set {"trunk": "<your branch>"} in .rsc/sello-config.json so the sello knows what to diff against.`,
};

// ---------------------------------------------------------------- the check
//
// The single verdict function the guard, the CLI and the tests all share.
// → {ok: true, code} | {ok: false, code, message}

export function checkSello(rawRoot) {
  const root = resolveRoot(rawRoot);
  const cfg = readConfig(root);
  if (!cfg || cfg.enabled !== true) return { ok: true, code: 'disabled' };

  const candidate = computeCandidate(root, cfg);
  if (!candidate) {
    // Fail open, but never silently: doctor/status surface this so an inert gate
    // in a develop-based repo cannot masquerade as an armed one.
    return { ok: true, code: 'no-trunk', warning: MESSAGES.noTrunk() };
  }

  const paths = Object.keys(candidate.files);
  if (paths.length === 0) return { ok: true, code: 'clean' };

  const risk = classifyRisk(paths, cfg);
  // P7 first, before any sello state is consulted: a docs-only change must never
  // be blocked by a leftover sello from some other change.
  if (risk.tier === 0) return { ok: true, code: 'risk0' };

  const sello = readSello(root);
  if (sello.missing) return { ok: false, code: 'no-review', message: MESSAGES.noReview(risk.tier) };
  if (sello.corrupt) return { ok: false, code: 'corrupt', message: MESSAGES.corrupt() };
  if (sello.status === 'blocked') return { ok: false, code: 'blocked', message: MESSAGES.blocked(sello.reason) };
  if (sello.status !== 'approved') return { ok: false, code: 'no-review', message: MESSAGES.noReview(risk.tier) };
  if (sello.base !== candidate.base) return { ok: false, code: 'base-moved', message: MESSAGES.baseMoved() };

  const diverged = [];
  const sealed = sello.files || {};
  for (const p of new Set([...Object.keys(sealed), ...paths])) {
    if (sealed[p] !== candidate.files[p]) diverged.push(p);
  }
  if (diverged.length) return { ok: false, code: 'diverged', message: MESSAGES.diverged(diverged) };
  return { ok: true, code: 'sealed' };
}

// Fix-budget accounting: |numstat delta| vs the frozen totals (untracked files
// included — see computeCandidate). Approximate by construction: a same-size
// rewrite costs 0 and a moved hunk double-counts. It bounds sprawl, not edits.
export function budgetSpent(frozen, current) {
  let spent = 0;
  const all = new Set([...Object.keys(frozen.numstat || {}), ...Object.keys(current.numstat || {})]);
  for (const p of all) {
    spent += Math.abs((current.numstat?.[p] || 0) - (frozen.numstat?.[p] || 0));
  }
  return spent;
}
