// sello.mjs — the deterministic core of the "sello" (review receipt) system.
//
// A sello binds a review verdict to the EXACT bytes that were reviewed. The ship
// gate (ship-guard.mjs) refuses to commit/push/PR anything whose bytes differ from
// what was sealed. Opt-in per project via .rsc/sello-config.json — absent or
// disabled, nothing here runs and the harness behaves exactly as before.
//
// Design rules (constitution):
//  - P1: everything in this file is an algorithm — no tokens, no judgment.
//  - P2: every gate has a test (tests/sello.test.js), including the risk table itself.
//  - P4: the sello is the artifact that makes a human approval binding.
//  - P6: every deny message carries its own `Recover:` line, asserted by test.
//  - P7: risk-0 changes (docs/copy) pass in complete silence.
//
// Materialized to .rsc/sello.mjs as a sibling of ship-guard.mjs (hooks are copied
// file-by-file, so imports must be sibling-relative — same pattern as hook-once.mjs).

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------- paths & config

export function selloPaths(root) {
  return {
    config: join(root, '.rsc', 'sello-config.json'),
    state: join(root, '.rsc', 'sello.json'),
    findings: join(root, '.rsc', 'sello-findings.md'),
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

// ---------------------------------------------------------------- risk table
//
// Risk is classified by WHAT a path touches, never by how many lines changed.
// Tiers: 0 = nulo (docs/copy — silent), 1 = normal (one lens), 2 = alto (full panel).
// The FLOOR_CLASSES can never be lowered to 0 by any project override — secrets and
// the harness's own configuration stay guarded no matter what.

export const RISK_TABLE = [
  { class: 'docs', tier: 0, pattern: '(^|/)(docs|doc)/|\\.(md|mdx|markdown|txt|rst)$|(^|/)LICENSE$|(^|/)CHANGELOG' },
  { class: 'secrets', tier: 2, pattern: '(^|/)\\.env(\\.|$)|(^|/)(secrets?|credentials?)(/|\\.|$)|\\.(pem|key|p12|pfx)$' },
  { class: 'auth', tier: 2, pattern: '(^|/)(auth|authn|authz|login|session|oauth|sso)(/|\\.|-)' },
  { class: 'ci', tier: 2, pattern: '(^|/)\\.github/workflows/|(^|/)\\.gitlab-ci\\.yml$|(^|/)Jenkinsfile$' },
  { class: 'migrations', tier: 2, pattern: '(^|/)migrations?/' },
  { class: 'billing', tier: 2, pattern: '(^|/)(billing|payments?|checkout|stripe)(/|\\.|-)' },
  { class: 'harness', tier: 2, pattern: '(^|/)\\.rsc/|(^|/)\\.claude/' },
];
export const FLOOR_CLASSES = ['secrets', 'harness'];
export const DEFAULT_TIER = 1;

// A project override may RAISE freely (add patterns at a tier, or lift a class) and
// may LOWER only explicitly (naming the class), never below tier 1, and never a
// floor class. Returns the effective table or throws with a recoverable message.
export function validateRiskConfig(cfg) {
  const risk = cfg?.risk;
  if (!risk) return { table: RISK_TABLE, lowered: [] };
  const lowered = [];
  const extra = [];
  for (const r of risk.raise || []) {
    if (!r?.pattern) throw new Error(`sello: raise entry without pattern. ${MESSAGES.badRiskConfig}`);
    new RegExp(r.pattern); // throws on an uncompilable pattern
    extra.push({ class: r.class || 'custom', tier: 2, pattern: r.pattern });
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

// → {tier, classes: {path: class}} — tier is the max across all paths; a path with
// no match lands on DEFAULT_TIER. Unreadable config falls back to the default table
// upstream (checkSello never silently lowers risk — spec's error path).
export function classifyRisk(paths, cfg = null) {
  const { table } = validateRiskConfig(cfg || {});
  const classes = {};
  let tier = 0;
  for (const p of paths) {
    const row = table.find((r) => new RegExp(r.pattern).test(p));
    const t = row ? row.tier : DEFAULT_TIER;
    classes[p] = row ? row.class : 'default';
    if (t > tier) tier = t;
  }
  return { tier, classes };
}

// ---------------------------------------------------------------- candidate

function git(root, ...args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? (r.stdout || '').trimEnd() : null;
}

function trunkRef(root) {
  for (const ref of ['origin/main', 'origin/master', 'main', 'master']) {
    if (git(root, 'rev-parse', '--verify', '--quiet', ref) !== null) return ref;
  }
  return null;
}

// The candidate is the change vs the trunk merge-base: every path that differs
// between that base and the working tree (committed on the branch, staged, unstaged
// or untracked), each hashed byte-for-byte. Deleted paths hash to "D". One byte of
// difference anywhere → a different candidate.
export function computeCandidate(root) {
  const trunk = trunkRef(root);
  if (!trunk) return null;
  const head = git(root, 'rev-parse', 'HEAD');
  const base = head ? git(root, 'merge-base', 'HEAD', trunk) : null;
  if (!base) return null;

  const names = new Set();
  for (const line of (git(root, 'diff', '--name-only', base) || '').split('\n')) {
    if (line) names.add(line);
  }
  // Untracked files join the candidate EXCEPT the harness's own .rsc/ state — the
  // sello's config/state/findings live there, and sealing them would make writing
  // the sello mutate the very candidate it seals (the system would invalidate
  // itself). Tracked .rsc/ changes committed on the branch still count above:
  // deliberate harness-config changes are content; local state is not.
  for (const line of (git(root, 'ls-files', '--others', '--exclude-standard') || '').split('\n')) {
    if (line && !line.startsWith('.rsc/')) names.add(line);
  }

  const files = {};
  const numstat = {};
  for (const name of [...names].sort()) {
    const abs = join(root, name);
    if (existsSync(abs)) {
      files[name] = createHash('sha256').update(readFileSync(abs)).digest('hex');
    } else {
      files[name] = 'D';
    }
  }
  for (const line of (git(root, 'diff', '--numstat', base) || '').split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (m) numstat[m[3]] = (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
  }
  return { base, files, numstat };
}

// ---------------------------------------------------------------- sello state

export function readSello(root) {
  const p = selloPaths(root).state;
  if (!existsSync(p)) return { missing: true };
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    if (!s || typeof s !== 'object' || !s.files || !s.base) return { corrupt: true };
    return s;
  } catch { return { corrupt: true }; }
}

export function writeSello(root, sello) {
  writeFileSync(selloPaths(root).state, JSON.stringify(sello, null, 2) + '\n');
}

export function appendFindings(root, lines) {
  if (!lines?.length) return;
  const p = selloPaths(root).findings;
  const header = existsSync(p) ? '' : '# sello — hallazgos no bloqueantes\n\nSe acumulan aquí; `rsc sello report` los muestra. No interrumpen nada.\n';
  appendFileSync(p, header + lines.map((l) => `- ${l}`).join('\n') + '\n');
}

export function countFindings(root) {
  const p = selloPaths(root).findings;
  if (!existsSync(p)) return 0;
  return readFileSync(p, 'utf8').split('\n').filter((l) => l.startsWith('- ')).length;
}

// ---------------------------------------------------------------- messages (P6)
//
// Every message that can DENY an action carries a `Recover:` line naming the exact
// way out. tests/sello.test.js asserts this for every entry — a block without its
// recovery is the one thing this system is not allowed to produce.

export const MESSAGES = {
  noReview: (tier) =>
    `sello: this change is risk tier ${tier} and has no review. ` +
    `Recover: run the \`review\` skill (it freezes, reviews and approves the sello), or \`npx @ericrisco/rsc sello off\` to turn the sello off for this project.`,
  diverged: (paths) =>
    `sello: the change no longer matches what was reviewed — ${paths.slice(0, 5).join(', ')}${paths.length > 5 ? ` (+${paths.length - 5} more)` : ''} differ from the sealed bytes. ` +
    `Recover: re-run the \`review\` skill on the divergence (only what changed is re-reviewed), or \`npx @ericrisco/rsc sello off\` for this project.`,
  baseMoved: () =>
    `sello: the branch base moved (rebase/merge) since the review — the same diff on a new base is a new candidate. ` +
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
  badRiskConfig:
    'Recover: fix .rsc/sello-config.json — "raise" entries need a valid pattern; "lower" only accepts known classes and never "secrets" or "harness".',
  riskUnknown: () =>
    `sello: the risk of this change could not be evaluated, so it is treated as risk tier 1 (never silently as 0). ` +
    `Recover: check that this is a git repository with a reachable trunk (origin/main or main), then retry.`,
};

// ---------------------------------------------------------------- the check
//
// The single verdict function the guard, the CLI and the tests all share.
// → {ok: true, code} | {ok: false, code, message}

export function checkSello(root) {
  const cfg = readConfig(root);
  if (!cfg || cfg.enabled !== true) return { ok: true, code: 'disabled' };

  const candidate = computeCandidate(root);
  if (!candidate) return { ok: true, code: 'no-repo' }; // fail-open: nothing to measure

  const paths = Object.keys(candidate.files);
  if (paths.length === 0) return { ok: true, code: 'clean' };

  let risk;
  try { risk = classifyRisk(paths, cfg); }
  catch { risk = { tier: DEFAULT_TIER, classes: {} }; } // spec: never silently down to 0

  const sello = readSello(root);
  if (sello.missing) {
    if (risk.tier === 0) return { ok: true, code: 'risk0' }; // P7: silence for docs/copy
    return { ok: false, code: 'no-review', message: MESSAGES.noReview(risk.tier) };
  }
  if (sello.corrupt) return { ok: false, code: 'corrupt', message: MESSAGES.corrupt() };
  if (sello.status === 'blocked') return { ok: false, code: 'blocked', message: MESSAGES.blocked(sello.reason) };
  if (sello.status !== 'approved') {
    if (risk.tier === 0) return { ok: true, code: 'risk0' };
    return { ok: false, code: 'no-review', message: MESSAGES.noReview(risk.tier) };
  }
  if (sello.base !== candidate.base) return { ok: false, code: 'base-moved', message: MESSAGES.baseMoved() };

  const diverged = [];
  const sealed = sello.files || {};
  for (const p of new Set([...Object.keys(sealed), ...paths])) {
    if (sealed[p] !== candidate.files[p]) diverged.push(p);
  }
  if (diverged.length) return { ok: false, code: 'diverged', message: MESSAGES.diverged(diverged) };
  return { ok: true, code: 'sealed' };
}

// Fix-budget accounting: |numstat delta| vs the frozen totals, plus new files.
export function budgetSpent(frozen, current) {
  let spent = 0;
  const all = new Set([...Object.keys(frozen.numstat || {}), ...Object.keys(current.numstat || {})]);
  for (const p of all) {
    spent += Math.abs((current.numstat?.[p] || 0) - (frozen.numstat?.[p] || 0));
  }
  return spent;
}
