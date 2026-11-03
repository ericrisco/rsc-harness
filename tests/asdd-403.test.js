import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { isPushOrPr } from '../targets/asdd-gate.mjs';

// The FTD → ASDD escalation as a mechanism. A 4.0.2 run took a login (tier 2) down FTD and pushed it
// with no spec; the rule was prose and bent under a time budget.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = join(ROOT, 'targets', 'ship-guard.mjs');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const write = (root, rel, body = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };
const HOME = mkdtempSync(join(tmpdir(), 'rsc-403-home-'));
const ENV = { ...process.env, RSC_SELLO_HOME: HOME };

function guard(root, command) {
  const r = spawnSync(process.execPath, [GUARD, root], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', env: ENV });
  if (!r.stdout.trim()) return null;
  return JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason;
}

// 4.0.4: a passing spec is not enough at tier 2 — the panel must be recorded too.
const panel = (root, task, lenses = 'correctness,security,tests') => spawnSync(process.execPath, [CLI, 'review', 'ledger', 'panel', task, '--lenses', lenses], { cwd: root, encoding: 'utf8', env: ENV });

function project(branch = 'feat/login') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-403-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'T'); git(root, 'config', 'user.email', 't@x');
  write(root, '.gitignore', '.rsc/\n02-DOCS/\n');
  write(root, 'src/app.js');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'c0');
  git(root, 'switch', '-qc', branch);
  return root;
}

const SPEC = (extra = '', four = true) => `---
type: spec
timestamp: 2026-11-10
${extra}---
# Spec

## Problema & por qué
x
## Qué pasa si no lo construimos
x
## La alternativa más barata
x
## Objetivos
x
## Fuera de alcance
x
## Usuarios & contexto
x
## Comportamiento
x
## Criterios de aceptación
x
## Puntos a clarificar
- **suposición tomada** — x
${four ? `## Qué podrá hacer el usuario
x
## Qué resultado obtiene
x
## Qué debe respetar
x
## Cómo lo demuestra
x
` : ''}`;

test('a tier-2 branch with no linked spec cannot be pushed, and the denial says how to recover', () => {
  const r = project();
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  const why = guard(r, 'git push -u origin feat/login');
  assert.ok(why, 'denied');
  assert.match(why, /risk tier 2 \(auth\)/);
  assert.match(why, /Recover: write the spec/);
  assert.match(why, /branch: feat\/login/);
  assert.match(why, /rsc spec gate/);
  assert.ok(guard(r, 'gh pr create --fill'), 'a PR is refused too');
});

test('the same branch passes once a spec linked by frontmatter passes the gate', () => {
  const r = project('feat/x1');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  write(r, '02-DOCS/wiki/sdd/specs/sign-in.md', SPEC('branch: feat/x1\n'));
  panel(r, 'sign-in/closing');
  assert.equal(guard(r, 'git push -u origin feat/x1'), null);
});

test('a spec linked by its slug in the branch name counts too', () => {
  const r = project('feat/login');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  write(r, '02-DOCS/wiki/sdd/specs/login.md', SPEC());
  panel(r, 'login/closing');
  assert.equal(guard(r, 'git push'), null);
});

test('a linked spec that fails the gate still blocks, naming what is missing', () => {
  const r = project();
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  write(r, '02-DOCS/wiki/sdd/specs/login.md', SPEC('', false));
  const why = guard(r, 'git push');
  assert.match(why, /does not pass the gate: 02-DOCS\/wiki\/sdd\/specs\/login\.md \(missing: can, result, respect, proof\)/);
});

test('a spec for another branch does not count', () => {
  const r = project('feat/login');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  write(r, '02-DOCS/wiki/sdd/specs/billing.md', SPEC('branch: feat/billing\n'));
  assert.ok(guard(r, 'git push'));
});

test('tier 0-1 branches, commits, the trunk and the opt-out are left alone', () => {
  const r = project('feat/copy');
  write(r, 'src/app.js', 'y\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'copy');
  assert.equal(guard(r, 'git push'), null, 'tier 1 pushes freely');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  assert.equal(guard(r, 'git commit -m more'), null, 'committing on the branch is not leaving the machine');
  assert.equal(guard(r, 'echo "git push"'), null, 'a mention is not a push');
  write(r, '.rsc/.no-asdd-gate', '');
  assert.equal(guard(r, 'git push'), null, 'the opt-out holds');
});

test('push/PR detection: real commands yes, mentions no', () => {
  for (const c of ['git push', 'git -C . push origin x', 'gh pr create --fill', 'gh pr merge 3 --squash']) assert.ok(isPushOrPr(c), c);
  for (const c of ['git pull', 'git push-hook', 'echo "git push"', 'gh pr view 3', 'git commit -m "git push later"']) assert.ok(!isPushOrPr(c), c);
});

test('rsc risk announces the escalation at tier 2, and only there', () => {
  const r = project();
  const two = spawnSync(process.execPath, [CLI, 'risk', 'src/auth/login.js'], { cwd: r, encoding: 'utf8', env: ENV });
  assert.match(two.stdout, /^escalate: asdd — tier 2 needs a spec/m);
  const one = spawnSync(process.execPath, [CLI, 'risk', 'src/app.js', '--json'], { cwd: r, encoding: 'utf8', env: ENV });
  assert.equal(JSON.parse(one.stdout).escalate, null);
});

// ── closing-review findings on 07c110d ──────────────────────────────────────

test('wrapped and option-heavy forms are pushes too', () => {
  for (const c of ['bash -c "git push"', "sh -c 'git push origin HEAD'", 'eval "git push"', 'gh -R a/b pr merge 3', 'gh --repo a/b pr create']) {
    assert.ok(isPushOrPr(c), c);
  }
  assert.ok(!isPushOrPr('gh -R a/b pr view 3'));
});

test('end to end: a tier-2 branch is refused through bash -c and gh --repo', () => {
  const r = project('feat/rapid-login');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  assert.ok(guard(r, 'bash -c "git push"'));
  assert.ok(guard(r, 'gh --repo a/b pr create'));
});

test('a slug links only when it IS the branch\'s last segment — never a substring', () => {
  const r = project('feat/rapid-login');
  write(r, 'src/auth/session.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth');
  write(r, '02-DOCS/wiki/sdd/specs/api.md', SPEC());
  write(r, '02-DOCS/wiki/sdd/specs/login.md', SPEC());
  write(r, '02-DOCS/wiki/sdd/specs/a.md', SPEC());
  assert.ok(guard(r, 'git push'), 'api.md, login.md and a.md do not vouch for feat/rapid-login');
  write(r, '02-DOCS/wiki/sdd/specs/rapid_login.md', SPEC());
  panel(r, 'rapid_login/closing');
  assert.equal(guard(r, 'git push'), null, 'rapid_login.md is feat/rapid-login: _ and - alike');
});

test('a branch that only touches harness configuration needs no spec', () => {
  const r = project('chore/rsc-upgrade');
  write(r, 'CLAUDE.md', '# project\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'harness');
  assert.equal(guard(r, 'git push'), null);
  write(r, 'src/auth/x.js'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'auth too');
  assert.ok(guard(r, 'git push'), 'harness plus auth is feature work again');
});
