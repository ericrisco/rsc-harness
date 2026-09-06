import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The status half of `spec-gate` is the only mechanism in the harness that ties a claim about what
// shipped to something checkable. It asked the repository that HOLDS the spec instead of the one the
// spec is ABOUT — and in the layout this workspace's own CLAUDE.md mandates (docs in the container,
// code in the child) that is always the wrong repository. Measured on a freshly published spec: three
// true claims, three false verdicts.
//
// A detector that flags everything put in front of it distinguishes nothing, so these tests are built
// around one asymmetry: "I could not look" must never come back as "this is a lie", and a lie must
// still come back as a lie. Real git repositories throughout; a stubbed git would agree with whatever
// the code believes.
const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, '..', 'scripts', 'spec-gate.js');

const TMP = [];
function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
function put(root, rel, body) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

function newRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-b', 'main', '-q');
  git(dir, 'config', 'user.email', 'eric@example.com');
  git(dir, 'config', 'user.name', 'Eric');
  return dir;
}

// The layout that breaks it: a container repo holding the docs, a child repo holding the code.
function workspace({ config = null, children = ['child'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-gate-'));
  TMP.push(root);
  newRepo(root);
  put(root, 'README.md', '# container\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'container');

  const made = {};
  for (const name of children) {
    const child = newRepo(join(root, name));
    put(child, 'code.js', '// code\n');
    git(child, 'add', '-A');
    git(child, 'commit', '-qm', 'work');
    // Landed the way a plain merge lands: the subject says "Merge pull request #7 from …".
    git(child, 'checkout', '-qb', 'feat/thing');
    put(child, 'more.js', '// more\n');
    git(child, 'add', '-A');
    git(child, 'commit', '-qm', 'feat: thing');
    git(child, 'checkout', '-q', 'main');
    git(child, 'merge', '--no-ff', '-q', 'feat/thing', '-m', 'Merge pull request #7 from eric/feat/thing');
    git(child, 'tag', 'v9.9.9');
    made[name] = { path: child, head: git(child, 'rev-parse', '--short', 'HEAD') };
  }

  if (config !== null) {
    put(root, '02-DOCS/wiki/sdd/config.yaml', `version: 1\nproject:\n  root: ${config}\n`);
  }
  return { root, children: made };
}

function spec(root, { slug = 'thing', status }) {
  const body = `---
type: spec
slug: ${slug}
status: ${status}
---
# Spec — ${slug}

## Problema & por qué
Duele.

## Coste de no construirlo
Sigue doliendo.

## La alternativa más barata
Aguantarse.

## Objetivos
- Que deje de doler.

## No-objetivos / fuera de alcance
- Lo de al lado.

## Usuarios & contexto
El autor.

## Comportamiento
- Main: pasa algo.

## Criterios de aceptación
- Given X, When Y, Then Z.

## Puntos a clarificar
- **pregunta abierta** — ¿cuál es el umbral?
`;
  const path = join(root, '02-DOCS', 'wiki', 'sdd', 'specs', `${slug}.md`);
  put(root, `02-DOCS/wiki/sdd/specs/${slug}.md`, body);
  return path;
}

function runGate(path, cwd) {
  const r = spawnSync('node', [GATE, path], { cwd: cwd || dirname(path), encoding: 'utf8' });
  return { out: r.stdout + r.stderr, code: r.status };
}

test.after(() => {
  for (const d of TMP) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

// ── 1-2. the claim is true, and the gate must say so ────────────────────────────────────────

test('1 · config names the subject: three true claims verify, in the split layout', () => {
  const ws = workspace({ config: 'child' });
  const p = spec(ws.root, { status: `publicada en 9.9.9 (PR #7 → \`${ws.children.child.head}\`)` });

  const { out } = runGate(p);
  assert.match(out, /^PASS/m);
  assert.doesNotMatch(out, /STALE|UNVERIFIABLE/,
    `true claims came back as findings:\n${out}`);
});

test('2 · with no config at all, derivation still finds the child', () => {
  const ws = workspace({ config: null });
  const p = spec(ws.root, { status: `publicada en 9.9.9 (PR #7 → \`${ws.children.child.head}\`)` });

  const { out } = runGate(p);
  assert.doesNotMatch(out, /STALE|UNVERIFIABLE/,
    `whoever never ran sdd-init must still get an answer:\n${out}`);
});

// ── 3-4. and a lie must still come back as a lie ────────────────────────────────────────────

test('3 · a claim the subject contradicts is STALE, not "could not check"', () => {
  const ws = workspace({ config: 'child' });
  const p = spec(ws.root, { status: 'publicada en 1.1.1 (PR #4242)' });

  const { out } = runGate(p);
  assert.match(out, /STALE/, `the whole point is catching this:\n${out}`);
});

test('4 · a spec living beside its own code keeps the detection it already had', () => {
  const ws = workspace({ config: null, children: [] });
  const p = spec(ws.root, { status: 'publicada en 3.3.3 (PR #99)' });

  const { out } = runGate(p);
  assert.match(out, /STALE/,
    `locating the subject must not downgrade a detected lie to "unverifiable":\n${out}`);
});

// ── 5-7. what happens when the subject cannot be pinned down ────────────────────────────────

test('5 · nobody can answer → UNVERIFIABLE, and the message says where it looked', () => {
  const bare = mkdtempSync(join(tmpdir(), 'rsc-gate-nogit-'));
  TMP.push(bare);
  const p = spec(bare, { status: 'publicada en 9.9.9 (PR #7)' });

  const { out } = runGate(p);
  assert.match(out, /UNVERIFIABLE/, `a failure of ours must not be reported as a lie:\n${out}`);
  assert.doesNotMatch(out, /STALE/);
});

test('6 · two children could answer → the ambiguity is reported, never guessed', () => {
  const ws = workspace({ config: null, children: ['one', 'two'] });
  // Both children carry an identical history, so both can answer #7 and v9.9.9.
  const p = spec(ws.root, { status: 'publicada en 9.9.9 (PR #7)' });

  const { out } = runGate(p);
  assert.match(out, /UNVERIFIABLE|AMBIG/i, `two histories cannot both be the subject:\n${out}`);
  assert.match(out, /one|two/, 'and the candidates must be named so a human can settle it');
});

test('7 · config pointing at something that is not a repository falls through to derivation', () => {
  const ws = workspace({ config: 'not-a-repo' });
  mkdirSync(join(ws.root, 'not-a-repo'), { recursive: true });
  const p = spec(ws.root, { status: `publicada en 9.9.9 (PR #7 → \`${ws.children.child.head}\`)` });

  const { out } = runGate(p);
  assert.doesNotMatch(out, /STALE/, `a misconfigured root must not turn true claims false:\n${out}`);
});

// ── 8-9. both ways a pull request lands ─────────────────────────────────────────────────────

test('8 · a PR landed with a merge commit is recognised', () => {
  const ws = workspace({ config: 'child' });
  const p = spec(ws.root, { status: 'publicada en 9.9.9 (PR #7)' });

  const { out } = runGate(p);
  assert.doesNotMatch(out, /PR #7/, `"Merge pull request #7 from …" is how a plain merge lands:\n${out}`);
});

test('9 · and one landed with a squash still is', () => {
  const ws = workspace({ config: 'child' });
  const child = ws.children.child.path;
  git(child, 'checkout', '-qb', 'feat/squashed');
  put(child, 'sq.js', '// sq\n');
  git(child, 'add', '-A');
  git(child, 'commit', '-qm', 'feat: sq');
  git(child, 'checkout', '-q', 'main');
  git(child, 'merge', '--squash', '-q', 'feat/squashed');
  git(child, 'commit', '-qm', 'feat: squashed thing (#8)');

  const p = spec(ws.root, { slug: 'squashed', status: 'publicada en 9.9.9 (PR #8)' });
  const { out } = runGate(p);
  assert.doesNotMatch(out, /PR #8/, `the squash convention must keep working:\n${out}`);
});

// ── 10. it reports; it does not block ───────────────────────────────────────────────────────

test('10 · a stale claim does not change the exit code', () => {
  const clean = workspace({ config: 'child' });
  const okSpec = spec(clean.root, { slug: 'ok', status: 'draft' });
  const stale = workspace({ config: 'child' });
  const badSpec = spec(stale.root, { slug: 'bad', status: 'publicada en 1.1.1 (PR #4242)' });

  const a = runGate(okSpec);
  const b = runGate(badSpec);
  assert.match(b.out, /STALE/);
  assert.equal(b.code, a.code, 'the status check informs; turning it into a blocker is how it gets switched off');
});

// ── 11-12. the branch the first real corpus taught us about ─────────────────────────────────

test('11 · a config naming a real repo that knows nothing about the claims falls through', () => {
  // This workspace's own config says `root: .` — a repository, just not the one its specs describe.
  // Read as authoritative, that keeps every verdict wrong while looking configured.
  const ws = workspace({ config: '.' });
  const p = spec(ws.root, { status: `publicada en 9.9.9 (PR #7 → \`${ws.children.child.head}\`)` });

  const { out } = runGate(p);
  assert.doesNotMatch(out, /STALE|UNVERIFIABLE/,
    `a declaration that recognises nothing in the file is not evidence about the file:\n${out}`);
});

test('12 · a repository and its own worktree are one candidate, not an ambiguity', () => {
  const ws = workspace({ config: null });
  const child = ws.children.child.path;
  git(child, 'worktree', 'add', '-q', '-b', 'feat/side', join(ws.root, 'child-side'));
  const p = spec(ws.root, { status: 'publicada en 9.9.9 (PR #7)' });

  const { out } = runGate(p);
  assert.doesNotMatch(out, /several repositories/,
    `a worktree shares the history; counting it twice invents an ambiguity out of one repo:\n${out}`);
  assert.doesNotMatch(out, /STALE/, out);
});
