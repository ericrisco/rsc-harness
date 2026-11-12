// emoji-off-review.test.js — what a clean-context review of `emoji: on|off` found.
// Glyphs are written as escapes: this file must itself be readable with emoji off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeOnboarding } from '../scripts/lib/onboarding.js';
import { verifyOnboarding } from '../scripts/lib/onboarding-apply.js';
import { readManifest } from '../scripts/lib/manifest-file.js';
import { plain, hasSymbol, stripSymbols } from '../targets/emoji-policy.mjs';
import { say, setPlainOutput, sparkleGlyphs } from '../scripts/lib/ui.js';
import { KNOWLEDGE_IMPORT } from '../targets/session-memory-core.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const GUARD = join(ROOT, 'targets', 'gitmoji-guard.mjs');
const fresh = (p = 'rsc-emoji-r1-') => mkdtempSync(join(tmpdir(), p));
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' } });
const software = ['--technical-level', 'technical', '--project-kind', 'software', '--software-scope', 'small', '--workflow', 'main', '--goal', 'A calculator', '--target', 'claude'];
const planId = (cwd, args) => run(cwd, ['onboard', ...args]).stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
const install = (cwd, extra = []) => {
  const args = [...software, ...extra];
  assert.equal(run(cwd, ['onboard', ...args, '--accept-plan', planId(cwd, args)]).status, 0);
};
const drift = (cwd) => { const m = readManifest(cwd); return verifyOnboarding(cwd, m.onboarding.plan, m.onboarding.acceptedPlanId); };

function guard(root, command) {
  const r = spawnSync('node', [GUARD, root], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput?.permissionDecisionReason : null;
}
const marked = () => { const root = fresh('rsc-emoji-r1-guard-'); mkdirSync(join(root, '.rsc')); writeFileSync(join(root, '.rsc', '.no-emoji'), ''); return root; };

test('r1-1: reassess prints the state of the project, not the receipt', () => {
  const cwd = fresh();
  install(cwd, ['--emoji', 'off']);
  assert.equal(run(cwd, ['emoji', 'on']).status, 0);
  for (let i = 0; i < 6; i++) writeFileSync(join(cwd, `new-${i}.js`), 'export {};');
  const on = run(cwd, ['reassess']).stdout;
  assert.match(on, /RSC_REASSESSMENT_RECOMMENDED/);
  assert.doesNotMatch(on, /--emoji/, 'the project has emoji on: nothing to repeat');
  assert.equal(run(cwd, ['emoji', 'off']).status, 0);
  assert.match(run(cwd, ['reassess']).stdout, /onboard .*--emoji off /, 'the project has emoji off: the command keeps it');
});

test('r1-2: changing emoji with the command leaves no drift in the accepted plan', () => {
  const cwd = fresh();
  install(cwd, ['--emoji', 'off']);
  assert.deepEqual(drift(cwd), []);
  assert.equal(run(cwd, ['emoji', 'on']).status, 0);
  assert.deepEqual(drift(cwd), [], 'after emoji on');
  assert.equal(run(cwd, ['emoji', 'off']).status, 0);
  assert.deepEqual(drift(cwd), [], 'after emoji off');
  const base = fresh();
  install(base);
  assert.equal(run(base, ['emoji', 'off']).status, 0);
  assert.deepEqual(drift(base), [], 'a plan accepted with emoji on, then off');
});

test('r1-3: with off the guard reads the whole message, every -m, and every symbol', () => {
  const root = marked();
  const cases = {
    'second -m': 'git commit -m "feat: x" -m "cuerpo \u{1F389}"',
    'multiline body': 'git commit -m "feat: x\n\n✨ cuerpo"',
    keycap: 'git commit -m "feat: x 1️⃣"',
    flag: 'git commit -m "feat: x \u{1F1EA}\u{1F1F8}"',
    check: 'git commit -m "feat: x ✓"',
    arrow: 'git commit -m "feat: x →"',
    star: 'git commit -m "feat: x ★"',
    zwj: 'git commit -m "feat: x ❤️‍\u{1F525}"',
    'heredoc body': 'git commit -m "$(cat <<\'EOF\'\nfeat: x\n\ncuerpo \u{1F389}\nEOF\n)"',
  };
  for (const [name, cmd] of Object.entries(cases)) assert.ok(guard(root, cmd), `denied: ${name}`);
  for (const text of ['feat: x ™', 'feat: x © ®', 'feat: café · 日本 • — …', 'feat(a): x']) {
    assert.equal(guard(root, `git commit -m "${text}"`), null, `allowed: ${text}`);
  }
});

test('r1-3b: one definition of a symbol that off does not allow, shared by the guard and plain()', () => {
  for (const s of ['\u{1F389}', '✓', '→', '★', '1️⃣', '\u{1F1EA}\u{1F1F8}', '❤️‍\u{1F525}', '️', '‍']) {
    assert.ok(hasSymbol(`a ${s} b`), JSON.stringify(s));
    assert.ok(!hasSymbol(stripSymbols(`a ${s} b`)), `stripped: ${JSON.stringify(s)}`);
  }
  for (const s of ['©', '®', '™', 'café', '日本', '•', '—', '…', '1', '#', '*']) assert.ok(!hasSymbol(`a ${s} b`), JSON.stringify(s));
});

test('r1-4: plain() leaves text that is not emoji alone, and leaves nothing invisible behind', () => {
  for (const text of ['Copyright © 2026 Acme™ ®', 'failed:    padded col', 'ok:     two', 'café · 日本 • — …']) assert.equal(plain(text), text);
  assert.equal(plain('x ❤️‍\u{1F525} y'), 'x y');
  assert.equal(plain('x \u{1F1EA}\u{1F1F8} y'), 'x y');
  assert.equal(plain('x 1️⃣ y'), 'x y');
  assert.equal(plain('x ★ y ✓ z'), 'x y ok: z');
  assert.doesNotMatch(plain('❤️‍\u{1F525}'), /[‍️]/u);
});

test('r1-4b: JSON the CLI prints is data, and say() does not touch it', () => {
  const json = JSON.stringify({ k: 'a → b © ★' });
  const seen = [];
  const log = console.log;
  console.log = (...a) => seen.push(a.join(' '));
  try { setPlainOutput(true); say(json); say('a → b'); } finally { console.log = log; setPlainOutput(false); }
  assert.equal(seen[0], json);
  assert.equal(seen[1], 'a -> b');
});

test('r1-5: without --emoji the record is the one upstream makes, and the accept line has no --emoji', () => {
  const cwd = fresh();
  const out = run(cwd, ['onboard', ...software]).stdout;
  assert.doesNotMatch(out.split('\n').find((l) => l.startsWith('Accept exactly')), /--emoji/);
  const record = normalizeOnboarding({ technicalLevel: 'technical', projectKind: 'software', softwareScope: 'small', goal: 'A calculator', targets: ['claude'] });
  assert.deepEqual(Object.keys(record), ['schemaVersion', 'technicalLevel', 'projectKind', 'goal', 'softwareScope', 'workflow', 'targets']);
});

test('r1-6: with the marker the animated banner and select() draw no sparkle glyphs', () => {
  assert.ok(sparkleGlyphs(false).some((g) => hasSymbol(g)));
  assert.ok(!sparkleGlyphs(true).some((g) => hasSymbol(g)));
});

test('r1-7: the forms without emoji of rsc own commits are recognized', () => {
  assert.ok(KNOWLEDGE_IMPORT.test('docs(auto): sync desde rsc/knowledge'));
  assert.ok(KNOWLEDGE_IMPORT.test('\u{1F4E5} docs(auto): sync desde rsc/knowledge'));
  assert.ok(!KNOWLEDGE_IMPORT.test('fix: sync desde otro sitio'));
  assert.ok(!KNOWLEDGE_IMPORT.test('docs(auto): notes'));
});
