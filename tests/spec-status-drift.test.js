// Does a spec's declared status still match the repository? — and the tests that check the checker.
// Spec: 02-DOCS/wiki/sdd/specs/spec-status-drift.md
//
// `spec-gate` has always checked that every section EXISTS. It never checked that what a section
// CLAIMS is still true, and it never said it didn't. Seven of twenty-five specs drifted: one says
// "sin push ni PR" over work that has been in main for weeks, four sit in `awaiting-approval` over
// work already published. That is P2 aimed at the SDD's own ledger.
//
// The two mutants, written before the implementation:
//   1. a landing claim (SHA) over work that is NOT in main  -> `stale`
//   2. a not-landed claim                                   -> `needs-human`, and explicitly NOT `holds`
// The second is the whole point: if it came back `holds`, the tool would bless the misleading status
// that started this spec.
//
// And the control that matters on the reader: `no aprobada` and `descartada` must produce NO claim.
// Without it the first reasonable recognizer flags `spec-challenger` — deliberately closed, measured
// and discarded — as drifted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const tmpSpec = (body) => {
  const d = mkdtempSync(join(tmpdir(), 'rsc-specstatus-'));
  const f = join(d, 'fixture.md');
  writeFileSync(f, body);
  return f;
};
import { statusClaims, checkClaims, specCompleteness } from '../scripts/lib/spec-gate.js';

// A probe stands in for git, so the reader is tested against real status text and never against a
// throwaway repository. Fabricating repos would mostly test `git`.
const probe = ({ commits = [], ancestors = [], prs = [], tags = [] } = {}) => ({
  hasCommit: (sha) => commits.includes(sha),
  isAncestor: (sha) => ancestors.includes(sha),
  hasPr: (n) => prs.includes(Number(n)),
  hasTag: (v) => tags.includes(`v${v}`), // mirrors gitProbe: the bare version in, `v`-prefixed tag looked up
});
const only = (text, p) => checkClaims(statusClaims(text), p);

// ── the reader, over the shapes the real corpus actually contains ────────────

test('reads the four shapes the 25 real statuses contain', () => {
  const c = statusClaims('implementada (PR #226 → c384ff5, publicada en 1.0.13)');
  assert.deepEqual(c.map((x) => x.kind).sort(), ['pr', 'sha', 'version']);
  assert.equal(c.find((x) => x.kind === 'pr').value, '226');
  assert.equal(c.find((x) => x.kind === 'sha').value, 'c384ff5');
  assert.equal(c.find((x) => x.kind === 'version').value, '1.0.13');
});

test('reads the three ways this corpus says the work has not landed', () => {
  for (const text of ['awaiting-approval', 'implementada, sin push ni PR', 'Implementada, sin push: 13/13']) {
    const c = statusClaims(text);
    assert.ok(c.some((x) => x.kind === 'not-landed'), `missed the negation in: ${text}`);
  }
});

// THE CONTROL — these look like landing claims and are not.
test('CONTROL: "no aprobada" and "descartada" produce no claim at all', () => {
  assert.deepEqual(statusClaims('no aprobada ítem por ítem'), []);
  assert.deepEqual(statusClaims('**medida y descartada** (2026-08-19). No se construye.'), []);
});

test('a status with nothing checkable yields nothing, and nothing is not green', () => {
  assert.deepEqual(statusClaims(''), []);
  assert.deepEqual(statusClaims('aprobada en autopiloto, no punto por punto'), []);
});

// ── the verdicts ─────────────────────────────────────────────────────────────

test('a SHA that is an ancestor of main holds', () => {
  const [v] = only('implementada 7ebebaf', probe({ commits: ['7ebebaf'], ancestors: ['7ebebaf'] }));
  assert.equal(v.verdict, 'holds');
});

// MUTANT 1 — a landing claim over work that never landed.
test('MUTANT: a landing claim whose commit is known but NOT in main is stale', () => {
  const [v] = only('implementada 55a740c', probe({ commits: ['55a740c'], ancestors: [] }));
  assert.equal(v.verdict, 'stale');
});

test('a SHA the repository does not know is unverifiable — not stale, not holds', () => {
  const [v] = only('implementada deadbeef', probe({}));
  assert.equal(v.verdict, 'unverifiable');
  assert.notEqual(v.verdict, 'stale');
  assert.notEqual(v.verdict, 'holds');
});

// MUTANT 2 — the case that started the spec.
test('MUTANT: a not-landed claim is needs-human, and explicitly never holds', () => {
  const [v] = only('implementada, sin push ni PR', probe({}));
  assert.equal(v.verdict, 'needs-human');
  assert.notEqual(v.verdict, 'holds');
  assert.match(v.reason, /otra vía|another route|git/i);
});

test('a published version holds when its tag exists, and is stale when it does not', () => {
  assert.equal(only('publicada en 1.1.1', probe({ tags: ['v1.1.1'] }))[0].verdict, 'holds');
  assert.equal(only('publicada en 9.9.9', probe({ tags: ['v1.1.1'] }))[0].verdict, 'stale');
});

test('a PR holds when main carries its merge, stale when it does not', () => {
  assert.equal(only('implementada (PR #246)', probe({ prs: [246] }))[0].verdict, 'holds');
  assert.equal(only('implementada (PR #999)', probe({ prs: [246] }))[0].verdict, 'stale');
});

// ── no repository, and a probe that misbehaves ───────────────────────────────

test('no repository means unverifiable everywhere, never stale', () => {
  const vs = checkClaims(statusClaims('implementada (PR #246 → 7ebebaf, publicada en 1.1.1)'), null);
  assert.equal(vs.length, 3);
  for (const v of vs) assert.equal(v.verdict, 'unverifiable');
});

test('a probe that throws is unverifiable with its reason, never a finding', () => {
  const angry = { hasCommit: () => { throw new Error('shallow clone'); }, isAncestor: () => false, hasPr: () => false, hasTag: () => false };
  const [v] = only('implementada 7ebebaf', angry);
  assert.equal(v.verdict, 'unverifiable');
  assert.match(v.reason, /shallow clone/);
});

test('the report grows its own edge: the new claim classes are declared unchecked', () => {
  const u = specCompleteness('').unchecked;
  assert.ok(u.some((x) => /nada que ir a mirar/.test(x)), 'the bare-word limit must be declared');
  assert.ok(u.some((x) => /otra vía/.test(x)), 'the another-route limit must be declared');
});

// ── the CLI, end to end ──────────────────────────────────────────────────────
// These exist because of a real defect caught mid-build: wiring the status column in inverted the
// pass/fail branch, so the gate counted a FAILURE every time a spec PASSED. `node -c` reported the
// file as fine — syntax is not correctness, and a gate with an inverted counter is the decorative
// gate with extra steps.

const CLI = new URL('../scripts/spec-gate.js', import.meta.url).pathname;
const run = (args) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

const GOOD = `---
status: implementada
---
# Spec — x
## Problema & por qué
p
## Objetivos
- g
## No-objetivos
- n
## Usuarios & contexto
u
## Comportamiento
b
## Criterios de aceptación
- Given a, When b, Then c.
## Puntos a clarificar
- [ ] **pregunta abierta** — q
`;

test('a complete spec exits 0 and is counted as a pass, not a failure', () => {
  const d = tmpSpec(GOOD);
  try {
    const { code, out } = run([d]);
    assert.equal(code, 0);
    assert.match(out, /^PASS/m);
    assert.match(out, /1\/1 pass/);
  } finally { rmSync(dirname(d), { recursive: true, force: true }); }
});

test('an incomplete spec exits non-zero and is counted as a failure', () => {
  const d = tmpSpec('---\nstatus: draft\n---\n# Spec — x\n');
  try {
    const { code, out } = run([d]);
    assert.notEqual(code, 0);
    assert.match(out, /^FAIL/m);
    assert.match(out, /0\/1 pass/);
  } finally { rmSync(dirname(d), { recursive: true, force: true }); }
});

test('a status contradicted by the repo is reported, and counted', () => {
  const d = tmpSpec(GOOD.replace('status: implementada', 'status: implementada (PR #99999999)'));
  try {
    const { out } = run([d]);
    assert.match(out, /status STALE: PR #99999999/);
    assert.match(out, /1 status claim\(s\) contradicted/);
  } finally { rmSync(dirname(d), { recursive: true, force: true }); }
});

test('every run declares what it does not check', () => {
  const d = tmpSpec(GOOD);
  try {
    assert.match(run([d]).out, /Not checked by this gate:/);
  } finally { rmSync(dirname(d), { recursive: true, force: true }); }
});

test('the worktree directory is ignored — isolated work must not show up as untracked content', () => {
  const gi = readFileSync(new URL('../.gitignore', import.meta.url).pathname, 'utf8');
  assert.match(gi, /^\.worktrees\/$/m);
});
