import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { classifyChange, computeCandidate, classifyCandidate, changeText } from '../targets/sello.mjs';

// 4.0.4. The 4.0.3 run's tier 2 came from a spec file NAME (`specs/login.md`), not from the login code,
// which lived in `src/app.js` at tier 1. And it ran one reviewer where tier 2 asks for three.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'rsc.js');
const GUARD = join(ROOT, 'targets', 'ship-guard.mjs');
const HOME = mkdtempSync(join(tmpdir(), 'rsc-404-home-'));
const ENV = { ...process.env, RSC_SELLO_HOME: HOME };
const git = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const write = (root, rel, body = 'x\n') => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), body); };
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: ENV });
const guard = (root, command) => {
  const r = spawnSync(process.execPath, [GUARD, root], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', env: ENV });
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason : null;
};

function project(branch = 'feat/login') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-404-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'T'); git(root, 'config', 'user.email', 't@x');
  write(root, '.gitignore', '.rsc/\n02-DOCS/\n');
  write(root, 'src/app.js', 'export const notes = [];\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'c0');
  git(root, 'switch', '-qc', branch);
  return root;
}

const LOGIN = `import { scrypt, timingSafeEqual } from 'node:crypto';
export function login(user, password) { /* … */ }
res.setHeader('set-cookie', \`sid=\${token}; HttpOnly\`);
`;

// ── content signals ─────────────────────────────────────────────────────────

test('content: auth code in a generic file is tier 2, and the reason is shown', () => {
  const r = classifyChange(['src/app.js'], { 'src/app.js': LOGIN });
  assert.equal(r.tier, 2);
  assert.equal(r.classes['src/app.js'], 'auth');
  assert.ok(r.content.some((h) => h.class === 'auth' && h.path === 'src/app.js'));
});

test('content: each class is recognised, and ordinary code is not', () => {
  const cases = {
    billing: 'const intent = await stripe.paymentIntents.create({ amount });',
    migrations: 'ALTER TABLE users ADD COLUMN email text;',
    secrets: 'const key = "AKIAABCDEFGHIJKLMNOP";',
    auth: 'const hash = await bcrypt.hash(pw, 10);',
  };
  for (const [cls, text] of Object.entries(cases)) {
    assert.equal(classifyChange(['src/x.js'], { 'src/x.js': text }).classes['src/x.js'], cls, cls);
  }
  const plain = classifyChange(['src/x.js'], { 'src/x.js': 'export const add = (a, b) => a + b;\nconst sessionLength = 3;\n' });
  assert.equal(plain.tier, 1);
  assert.deepEqual(plain.content, []);
});

test('content: documentation that talks about passwords is not auth code', () => {
  const r = classifyChange(['docs/guide.md'], { 'docs/guide.md': 'Reset your password with bcrypt.' });
  assert.equal(r.tier, 0);
});

test('content: a lowered class drops to tier 1 in content too; the floor does not', () => {
  const cfg = { risk: { lower: ['auth'] } };
  assert.equal(classifyChange(['src/x.js'], { 'src/x.js': 'bcrypt.hash(p)' }, cfg).tier, 1);
  assert.equal(classifyChange(['src/x.js'], { 'src/x.js': '-----BEGIN RSA PRIVATE KEY-----' }, cfg).tier, 2);
});

test('rsc risk: the login in src/app.js is tier 2 from the diff, and from the file given by path', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  const diff = run(r, ['risk', '--base', 'main']);
  assert.match(diff.stdout, /^tier 2$/m);
  assert.match(diff.stdout, /content: auth in src\/app\.js/);
  assert.match(run(r, ['risk', 'src/app.js']).stdout, /^tier 2$/m);
});

test('rsc risk: only ADDED lines count — removing auth code is not a new auth change', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  git(r, 'switch', '-q', 'main'); git(r, 'merge', '-q', 'feat/login'); git(r, 'switch', '-qc', 'feat/tidy');
  write(r, 'src/app.js', 'export const notes = [];\n');
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'drop login');
  assert.match(run(r, ['risk', '--base', 'main']).stdout, /^tier 1$/m);
});

test('sello: the candidate is classified with content too', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  assert.equal(classifyCandidate(r, computeCandidate(r)).tier, 2);
});

// ── the panel at tier 2 ─────────────────────────────────────────────────────

const SPEC = `---
type: spec
timestamp: 2026-11-10
branch: feat/login
---
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
## Qué podrá hacer el usuario
x
## Qué resultado obtiene
x
## Qué debe respetar
x
## Cómo lo demuestra
x
`;

test('gate: login code in src/app.js is caught by content and needs a spec', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  assert.match(guard(r, 'git push'), /risk tier 2 \(auth\)/);
});

test('gate: a passing spec without the panel is still refused; one lens is not a panel; three are', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  write(r, '02-DOCS/wiki/sdd/specs/sign-in.md', SPEC);
  const none = guard(r, 'git push');
  assert.match(none, /no review panel of 3 lens\(es\) is recorded/);
  assert.match(none, /review ledger panel sign-in\/closing --lenses correctness,security,tests/);
  assert.equal(run(r, ['review', 'ledger', 'panel', 'sign-in/T001', '--lenses', 'security']).status, 0);
  assert.match(guard(r, 'git push'), /largest still valid: 1/);
  assert.equal(run(r, ['review', 'ledger', 'panel', 'other-spec/closing', '--lenses', 'a,b,c']).status, 0);
  assert.ok(guard(r, 'git push'), 'a panel on another spec does not count');
  assert.equal(run(r, ['review', 'ledger', 'panel', 'sign-in/closing', '--lenses', 'correctness,security,tests']).status, 0);
  assert.equal(guard(r, 'git push'), null);
});

test('ledger panel: a bare task or no lenses is refused with the way out', () => {
  const r = project();
  assert.match(run(r, ['review', 'ledger', 'panel', 'closing', '--lenses', 'a']).stdout, /<slug>\/closing/);
  assert.match(run(r, ['review', 'ledger', 'panel', 'x/closing']).stdout, /--lenses/);
});

// ── closing-review findings on 79e9dc6: operations, not words ───────────────

test('content: harmless code that merely mentions the words stays where its path puts it', () => {
  const harmless = {
    'src/Login.jsx': '<input type="password" name="pw" />',
    'src/i18n/en.js': "password: 'Password',",
    'tests/x.test.js': "const fixture = 'password';",
    'config.yaml': 'password: ${DB_PASSWORD}',
    'package-lock.json': '"node_modules/stripe": {',
    'tests/db.test.js': 'db.exec("CREATE TABLE t(x)")',
    'src/a.js': 'sessions.get(id)',
    'src/util.js': 'cache.session.get(key)',
    'src/b.js': '// TODO: bcrypt.hash(pw) once we have users',
  };
  for (const [p, text] of Object.entries(harmless)) {
    const r = classifyChange([p], { [p]: text });
    assert.deepEqual(r.content, [], `${p}: ${JSON.stringify(r.content)}`);
    assert.ok(r.tier <= 1, `${p} → tier ${r.tier}`);
  }
});

test('content: the auth libraries the first table missed are recognised', () => {
  const real = [
    'await bcryptjs.hash(pw, 10)',
    'await argon2id.verify(hash, pw)',
    "res.cookie('sid', id, { httpOnly: true })",
    "const mac = crypto.createHmac('sha256', key)",
    'const session = await getServerSession(req, res, opts)',
    'const t = await admin.auth().verifyIdToken(idToken)',
  ];
  for (const text of real) assert.equal(classifyChange(['src/x.js'], { 'src/x.js': text }).tier, 2, text);
  assert.equal(classifyChange(['src/pay.js'], { 'src/pay.js': 'const k = process.env.STRIPE_SECRET_KEY;' }).tier, 2);
});

test('content: a secret is caught even in a test or config file', () => {
  for (const p of ['tests/x.test.js', 'config.yaml', 'README.md']) {
    assert.equal(classifyChange([p], { [p]: 'key = "AKIAABCDEFGHIJKLMNOP"' }).tier, 2, p);
  }
});

test('changeText: paths with spaces lose git\'s trailing tab, and an added line starting "++" is read', () => {
  const r = project();
  write(r, 'd d/x y.js', 'a\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'base');
  git(r, 'switch', '-q', 'main'); git(r, 'merge', '-q', 'feat/login'); git(r, 'switch', '-qc', 'feat/two');
  write(r, 'd d/x y.js', 'a\n++ bcrypt.hash(x)\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'edit');
  const texts = changeText(r, git(r, 'merge-base', 'HEAD', 'main').trim(), ['d d/x y.js']);
  assert.deepEqual(Object.keys(texts), ['d d/x y.js']);
  assert.match(texts['d d/x y.js'], /\+\+ bcrypt\.hash/);
});

test('changeText: a change too large for a pathspec list is still read whole', () => {
  const r = project();
  const many = Array.from({ length: 1500 }, (_, i) => `src/${'deeply-nested-folder-name/'.repeat(3)}file-number-${i}.js`);
  for (const p of many) write(r, p, 'export const x = 1;\n');
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'many');
  git(r, 'switch', '-q', 'main'); git(r, 'merge', '-q', 'feat/login'); git(r, 'switch', '-qc', 'feat/big');
  for (const p of many) write(r, p, 'export const x = 2;\n');
  write(r, many[700], 'export const x = 2;\nawait bcrypt.hash(pw, 10);\n');
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'big');
  const base = git(r, 'merge-base', 'HEAD', 'main').trim();
  const texts = changeText(r, base, many);
  assert.equal(Object.keys(texts).length, many.length);
  assert.equal(classifyChange(many, texts).tier, 2);
});

test('panel: lens names are one per lens whatever the case, and code after the panel voids it', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  write(r, '02-DOCS/wiki/sdd/specs/sign-in.md', SPEC);
  run(r, ['review', 'ledger', 'panel', 'sign-in/closing', '--lenses', 'Correctness,correctness,SECURITY']);
  assert.match(guard(r, 'git push'), /largest still valid: 2/);
  run(r, ['review', 'ledger', 'panel', 'sign-in/closing', '--lenses', 'correctness,security,tests']);
  assert.equal(guard(r, 'git push'), null);
  write(r, 'notes.md', 'progress\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'docs after review');
  assert.equal(guard(r, 'git push'), null, 'docs after the review keep it valid');
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}// more\nexport const y = 2;\n`); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'code after review');
  assert.match(guard(r, 'git push'), /no review panel of 3/, 'code after the review voids it');
});

// ── round-2 findings on e052aee ─────────────────────────────────────────────

test('panel: harness state, CLAUDE.md and a merge of main after the review keep it valid', () => {
  const r = project();
  write(r, 'src/app.js', `export const notes = [];\n${LOGIN}`);
  git(r, 'add', '-A'); git(r, 'commit', '-qm', 'login');
  write(r, '02-DOCS/wiki/sdd/specs/sign-in.md', SPEC);
  run(r, ['review', 'ledger', 'panel', 'sign-in/closing', '--lenses', 'correctness,security,tests']);
  // a project that tracks its harness state commits it after the review
  write(r, '.rsc/sello.json', '{}\n'); git(r, 'add', '-f', '.rsc/sello.json'); git(r, 'commit', '-qm', 'sello state');
  write(r, 'CLAUDE.md', '# notes\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'claude note');
  // someone else's code lands on main and is merged in
  git(r, 'switch', '-q', 'main'); write(r, 'src/other.js', 'export const o = 1;\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'other');
  git(r, 'switch', '-q', 'feat/login'); git(r, 'merge', '-q', '--no-edit', 'main');
  assert.equal(guard(r, 'git push'), null);
});

test('content: more real login forms are auth', () => {
  for (const text of [
    'const hash = await promisify(crypto.scrypt)(pw, salt, 64);',
    'const { payload } = await jwtVerify(token, key);',
    'const t = await new SignJWT(claims).sign(key);',
    'res.cookie(SESSION_COOKIE, id, { httpOnly: true });',
    'req.session.userId = user.id;',
    'const session = await lucia.createSession(user.id, {});',
  ]) assert.equal(classifyChange(['src/x.js'], { 'src/x.js': text }).tier, 2, text);
  assert.equal(classifyChange(['src/x.js'], { 'src/x.js': 'if (req.session.userId === id) ok();' }).tier, 1, 'reading the session is not issuing one');
});

test('changeText: a path git quotes (a tab in the name) is still read', () => {
  const r = project();
  const name = 'tab\tx.js';
  write(r, name, 'a\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'base');
  git(r, 'switch', '-q', 'main'); git(r, 'merge', '-q', 'feat/login'); git(r, 'switch', '-qc', 'feat/q');
  write(r, name, 'a\nawait bcrypt.hash(p, 10);\n'); git(r, 'add', '-A'); git(r, 'commit', '-qm', 'edit');
  const texts = changeText(r, git(r, 'merge-base', 'HEAD', 'main').trim(), [name]);
  assert.match(texts[name] || '', /bcrypt\.hash/);
});
