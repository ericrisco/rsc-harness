import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { computeCandidate } from '../targets/sello.mjs';

// What the first real ASDD run broke. Spec: 02-DOCS/wiki/sdd/specs/asdd-401.md (criteria 1–4).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const BRIEF = join(ROOT, 'skills', 'implement', 'scripts', 'task-brief');
const HOME = mkdtempSync(join(tmpdir(), 'rsc-401-home-'));
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', input: '', env: { ...process.env, RSC_SELLO_HOME: HOME } });
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

function repo() {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-401-')));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.email', 't@t'); git(cwd, 'config', 'user.name', 't');
  writeFileSync(join(cwd, 'README.md'), '# x\n');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'init');
  return cwd;
}

const SPEC = (four) => `---
type: spec
timestamp: 2026-11-10
---
# Spec — x

## Problema & por qué
Duele.

## Qué pasa si no lo construimos
Sigue.

## La alternativa más barata
Nada.

## Objetivos
- Uno.

## Fuera de alcance
- Un QR.

## Usuarios & contexto
Yo.

## Comportamiento
- Pasa.

## Criterios de aceptación
- Given X, When Y, Then Z.

## Puntos a clarificar
- **suposición tomada** — 3.
${four ? `
## Qué podrá hacer el usuario
Exportar.

## Qué resultado obtiene
Un CSV.

## Qué debe respetar
Lo de antes.

## Cómo lo demuestra
Un test.
` : ''}`;

// ── 1 · spec gate reachable from a user project ─────────────────────────────

test('spec gate: a spec without the four questions fails with exit 1, the complete one passes', () => {
  const cwd = repo();
  const dir = join(cwd, '02-DOCS', 'wiki', 'sdd', 'specs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bad.md'), SPEC(false));
  writeFileSync(join(dir, 'good.md'), SPEC(true));
  const bad = run(cwd, ['spec', 'gate', '02-DOCS/wiki/sdd/specs/bad.md']);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /FAIL\s+bad\.md/);
  const good = run(cwd, ['spec', 'gate', '02-DOCS/wiki/sdd/specs/good.md']);
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /PASS\s+good\.md/);
});

test('spec gate: with no paths it reads this project\'s specs, from any subfolder', () => {
  const cwd = repo();
  const dir = join(cwd, '02-DOCS', 'wiki', 'sdd', 'specs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'only.md'), SPEC(true));
  mkdirSync(join(cwd, 'src'));
  const r = spawnSync(process.execPath, [CLI, 'spec', 'gate'], { cwd: join(cwd, 'src'), encoding: 'utf8', input: '' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS\s+only\.md/);
  assert.match(r.stdout, /1\/1 pass/);
});

test('spec gate: an unknown subcommand is refused with the usage', () => {
  const r = run(repo(), ['spec', 'check']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /spec gate/);
});

// ── 2 · nested worktrees are not part of the change ─────────────────────────

function withNestedWorktree(dirName) {
  const cwd = repo();
  git(cwd, 'checkout', '-qb', 'feat');
  writeFileSync(join(cwd, 'notes.md'), 'n\n');
  git(cwd, 'worktree', 'add', '-q', join(cwd, ...dirName.split('/'), 'agent-1'), '-b', 'agent');
  return cwd;
}

for (const d of ['.claude/worktrees', '.worktrees']) {
  test(`risk: an untracked ${d}/ checkout does not raise the tier`, () => {
    const cwd = withNestedWorktree(d);
    const r = JSON.parse(run(cwd, ['risk', '--base', 'main', '--json']).stdout);
    assert.equal(r.tier, 0, JSON.stringify(r));
    assert.ok(!Object.keys(r.paths).some((p) => p.startsWith(d)), JSON.stringify(r.paths));
  });

  test(`sello: the candidate leaves ${d}/ out, and still sees the real change`, () => {
    const cwd = withNestedWorktree(d);
    const c = computeCandidate(cwd);
    assert.ok(c, 'a candidate');
    assert.ok(Object.keys(c.files).includes('notes.md'));
    assert.ok(!Object.keys(c.files).some((p) => p.startsWith(d)), Object.keys(c.files).join(','));
  });
}

test('risk: a real change under .claude/ (not a worktree) is still tier 2', () => {
  const cwd = repo();
  git(cwd, 'checkout', '-qb', 'feat');
  mkdirSync(join(cwd, '.claude'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'settings.json'), '{}\n');
  assert.equal(JSON.parse(run(cwd, ['risk', '--base', 'main', '--json']).stdout).tier, 2);
});

// ── 3 · task-brief reads the format `tasks` prescribes ──────────────────────

const PLAN = `# Plan

## Tasks

| ID | [P] | Task | Done-check |
|---|---|---|---|
| T001 |  | First | a |
| T002 | [P] | Second | b |
| T010 |  | Tenth | c |

### T2 — details
second detail

### T3 — other
third detail
`;

function brief(n) {
  const d = mkdtempSync(join(tmpdir(), 'rsc-401-brief-'));
  writeFileSync(join(d, 'plan.md'), PLAN);
  const r = spawnSync('sh', [BRIEF, join(d, 'plan.md'), n], { encoding: 'utf8', env: { ...process.env, TMPDIR: d } });
  return r.status === 0 ? { ok: true, text: readFileSync(r.stdout.trim(), 'utf8') } : { ok: false, err: r.stderr };
}

for (const n of ['2', '002', 'T002']) {
  test(`task-brief: "${n}" finds the T002 row, its header and its detail block — nothing else`, () => {
    const b = brief(n);
    assert.ok(b.ok, b.err);
    assert.match(b.text, /\| ID \| \[P\] \| Task/);
    assert.match(b.text, /\| T002 \| \[P\] \| Second/);
    assert.match(b.text, /second detail/);
    assert.doesNotMatch(b.text, /First|Tenth|third detail/);
  });
}

test('task-brief: T10 is not T1, and a missing id says where it looked', () => {
  const ten = brief('10');
  assert.ok(ten.ok);
  assert.match(ten.text, /T010/);
  assert.doesNotMatch(ten.text, /T001/);
  const miss = brief('7');
  assert.equal(miss.ok, false);
  assert.match(miss.err, /table row/);
});

// ── 4 · parked is an outcome ────────────────────────────────────────────────

test('ledger: parked is accepted and counted, apart from open', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([{ severity: 'blocker', file: 'a.js', line: 1, claim: 'billing rounding loses a cent', failure_scenario: 'x' }]));
  run(cwd, ['review', 'ledger', 'record', 'f.json']);
  assert.equal(run(cwd, ['review', 'ledger', 'outcome', 'L1', 'parked']).status, 0);
  const s = JSON.parse(run(cwd, ['review', 'ledger', 'stats', '--json']).stdout);
  assert.equal(s.outcomes.parked, 1);
  assert.equal(s.outcomes.open, 0);
});

// ── closing-review findings on 4a02266 ──────────────────────────────────────

test('risk + sello: a COMMITTED path under a nested-worktree folder keeps its tier', () => {
  const cwd = repo();
  git(cwd, 'checkout', '-qb', 'feat');
  mkdirSync(join(cwd, '.claude', 'worktrees'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'worktrees', 'settings.json'), '{}\n');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'sneak');
  assert.equal(JSON.parse(run(cwd, ['risk', '--base', 'main', '--json']).stdout).tier, 2);
  assert.ok(Object.keys(computeCandidate(cwd).files).includes('.claude/worktrees/settings.json'));
});

test('ledger: parked is not counted as decided in the false rate', () => {
  const cwd = repo();
  writeFileSync(join(cwd, 'f.json'), JSON.stringify([
    { severity: 'nit', file: 'a.js', line: 1, claim: 'naming of the totals helper' },
    { severity: 'nit', file: 'b.js', line: 1, claim: 'billing rounding loses a cent' },
  ]));
  run(cwd, ['review', 'ledger', 'record', 'f.json']);
  run(cwd, ['review', 'ledger', 'outcome', 'L1', 'false']);
  run(cwd, ['review', 'ledger', 'outcome', 'L2', 'parked']);
  assert.equal(JSON.parse(run(cwd, ['review', 'ledger', 'stats', '--json']).stdout).falseRate, 1);
});

test('spec gate: the global --target value is not read as a spec path', () => {
  const cwd = repo();
  const dir = join(cwd, '02-DOCS', 'wiki', 'sdd', 'specs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ok.md'), SPEC(true));
  const r = run(cwd, ['spec', 'gate', '--target', 'claude']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS\s+ok\.md/);
});

test('spec gate: outside git, a subfolder still finds the project\'s 02-DOCS', () => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-401-nogit-')));
  const dir = join(cwd, '02-DOCS', 'wiki', 'sdd', 'specs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bad.md'), SPEC(false));
  mkdirSync(join(cwd, 'sub'));
  const r = spawnSync(process.execPath, [CLI, 'spec', 'gate'], { cwd: join(cwd, 'sub'), encoding: 'utf8', input: '' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL\s+bad\.md/);
});

test('task-brief: a row inside its own heading block is printed once', () => {
  const d = mkdtempSync(join(tmpdir(), 'rsc-401-dup-'));
  writeFileSync(join(d, 'p.md'), '### T1 — first\n\n| ID | Task |\n|---|---|\n| T1 | dup |\n\nafter\n');
  const r = spawnSync('sh', [BRIEF, join(d, 'p.md'), '1'], { encoding: 'utf8', env: { ...process.env, TMPDIR: d } });
  const text = readFileSync(r.stdout.trim(), 'utf8');
  assert.equal(text.split('| T1 | dup |').length - 1, 1, text);
  assert.equal(text.split('| ID | Task |').length - 1, 1, text);
  assert.match(text, /after/);
});
