// emoji-off.test.js — `emoji: on|off`, the install question that turns every emoji rsc produces off.
// One test per point of the contract, plus the proof that "on" (or no marker at all) is exactly as before.
// Glyphs are written as escapes: this file must itself be readable with emoji off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeOnboarding, ONBOARDING_VALUES, scanProject, buildOnboardingPlan, identifyPlan } from '../scripts/lib/onboarding.js';
import { plain, emojiOff, NO_EMOJI_RULE, noEmojiBody } from '../targets/emoji-policy.mjs';
import { PROJECT_OPT_OUTS } from '../targets/opt-outs.js';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'scripts/rsc.js');
const GUARD = join(ROOT, 'targets', 'gitmoji-guard.mjs');
const START = join(ROOT, 'targets', 'session-start.mjs');
const PICTO = /\p{Extended_Pictographic}/u;
const SPARKLES = '\u2728';
const BUG = '\u{1F41B}';
const CHECK = '\u2705';
const WARN = '\u26A0\uFE0F';
const NOENTRY = '\u26D4';
const PIN = '\u{1F4CD}';
const fresh = (p = 'rsc-emoji-') => mkdtempSync(join(tmpdir(), p));
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' } });
const answers = (extra = {}) => ({
  technicalLevel: 'technical', projectKind: 'software', softwareScope: 'small', goal: 'A calculator', targets: ['claude'], ...extra,
});
const software = ['--technical-level', 'technical', '--project-kind', 'software', '--software-scope', 'small', '--workflow', 'main', '--goal', 'A calculator', '--target', 'claude'];
const planId = (cwd, args) => run(cwd, ['onboard', ...args]).stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];

// ---- 1. the selector -------------------------------------------------------------

test('emoji 1a: onboarding knows emoji on|off, defaults to on, and rejects anything else', () => {
  assert.deepEqual(ONBOARDING_VALUES.emoji, ['on', 'off']);
  assert.ok(!('emoji' in normalizeOnboarding(answers())), 'on is the absence of the key: the record of a plan that does not choose is what it always was');
  assert.ok(!('emoji' in normalizeOnboarding(answers({ emoji: 'on' }))));
  assert.equal(normalizeOnboarding(answers({ emoji: ' OFF ' })).emoji, 'off');
  assert.equal(normalizeOnboarding(answers({ projectKind: 'operations', emoji: 'off' })).emoji, 'off', 'also for non-software projects');
  assert.throws(() => normalizeOnboarding(answers({ emoji: 'maybe' })), /emoji/);
});

test('emoji 1b: off is part of the plan record and of the plan id; on changes nothing', () => {
  const dir = fresh();
  const on = buildOnboardingPlan(normalizeOnboarding(answers({ emoji: 'on' })), scanProject(dir));
  const off = buildOnboardingPlan(normalizeOnboarding(answers({ emoji: 'off' })), scanProject(dir));
  assert.equal(off.record.emoji, 'off');
  assert.notEqual(identifyPlan(on), identifyPlan(off));
  const none = buildOnboardingPlan(normalizeOnboarding(answers()), scanProject(dir));
  assert.equal(identifyPlan(on), identifyPlan(none), 'emoji on is the same plan, with the same id, as not choosing');
  assert.deepEqual(on, none);
  assert.ok(!off.governedPaths.includes('.rsc/.no-emoji'), 'the marker is a decision changeable later, not a digested path');
});

test('emoji 1c: the preview asks the question in Spanish and the accept line repeats --emoji', () => {
  const cwd = fresh();
  const out = run(cwd, ['onboard', ...software]).stdout;
  assert.match(out, /AGENT: ask the person «¿Quieres emoji en las respuestas, los commits y los mensajes de rsc\? \(sí \| no; por defecto sí\)»/);
  assert.match(out, /--emoji <on\|off>/);
  assert.doesNotMatch(out.split('\n').find((l) => l.startsWith('Accept exactly')), /--emoji/, 'on is not repeated');
  const off = run(cwd, ['onboard', ...software, '--emoji', 'off']).stdout;
  assert.match(off, /Emoji: off/);
  assert.match(off, /Accept exactly this plan: .*--emoji off .*--accept-plan/);
  const bad = run(cwd, ['onboard', ...software, '--emoji', 'quizas']);
  assert.notEqual(bad.status, 0);
});

test('emoji 1d: accepting off writes .rsc/.no-emoji and declares it; accepting on removes it; no flag keeps it', () => {
  const cwd = fresh();
  const args = [...software, '--emoji', 'off'];
  const applied = run(cwd, ['onboard', ...args, '--accept-plan', planId(cwd, args)]);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.match(applied.stdout, /RSC_ONBOARDING_READY/);
  assert.ok(existsSync(join(cwd, '.rsc', '.no-emoji')));
  assert.ok(JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).optOuts.includes('emoji'), 'rebuilt in a clone from .rsc.json');

  // Re-onboarding without the flag must not undo the decision: the default follows the marker.
  const again = run(cwd, ['onboard', ...software]).stdout;
  assert.match(again, /Emoji: off/);

  const on = [...software, '--emoji', 'on'];
  const back = run(cwd, ['onboard', ...on, '--accept-plan', planId(cwd, on)]);
  assert.equal(back.status, 0, back.stdout + back.stderr);
  assert.ok(!existsSync(join(cwd, '.rsc', '.no-emoji')));
  assert.ok(!JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).optOuts.includes('emoji'));
});

test('emoji 1e: emoji is a project decision, listed in the opt-out table', () => {
  assert.ok(PROJECT_OPT_OUTS.includes('emoji'));
});

// ---- 2. changing it later --------------------------------------------------------

test('emoji 2: `rsc emoji off|on` writes and removes the marker, records it in .rsc.json, and doctor reports it', async () => {
  const cwd = fresh();
  assert.equal(run(cwd, ['onboard', ...software, '--accept-plan', planId(cwd, software)]).status, 0);
  const { doctor } = await import('../scripts/doctor.js');
  assert.equal(doctor({ cwd, target: 'claude' }).emoji, 'on');

  const off = run(cwd, ['emoji', 'off']);
  assert.equal(off.status, 0, off.stderr);
  assert.ok(existsSync(join(cwd, '.rsc', '.no-emoji')));
  assert.ok(JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).optOuts.includes('emoji'));
  assert.equal(doctor({ cwd, target: 'claude' }).emoji, 'off');
  assert.match(run(cwd, ['emoji', 'status']).stdout, /emoji: off/);
  assert.doesNotMatch(off.stdout, PICTO);

  const on = run(cwd, ['emoji', 'on']);
  assert.equal(on.status, 0, on.stderr);
  assert.ok(!existsSync(join(cwd, '.rsc', '.no-emoji')));
  assert.ok(!JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).optOuts.includes('emoji'));
  assert.match(run(cwd, ['emoji', 'status']).stdout, /emoji: on/);
  assert.notEqual(run(cwd, ['emoji', 'sideways']).status, 0);
});

// ---- 3. commits ------------------------------------------------------------------

function guard(root, command) {
  const r = spawnSync('node', [GUARD, root], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  if (!r.stdout.trim()) return null;
  return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecisionReason ?? null;
}
const marked = (name) => { const root = fresh('rsc-emoji-guard-'); mkdirSync(join(root, '.rsc')); writeFileSync(join(root, '.rsc', name), ''); return root; };

test('emoji 3a: with .no-emoji the guard stops demanding a gitmoji', () => {
  const root = marked('.no-emoji');
  assert.equal(guard(root, 'git commit -m "feat(api): add paging"'), null);
});

test('emoji 3b: with .no-emoji the guard denies an inline commit that carries an emoji, and says how to fix it', () => {
  const root = marked('.no-emoji');
  for (const msg of [`${SPARKLES} feat(api): add paging`, `feat(api): ${SPARKLES} add paging`, ':sparkles: feat: x', `fix: arreglo ${BUG}`]) {
    const reason = guard(root, `git commit -m "${msg}"`);
    assert.ok(reason, `denied: ${msg}`);
    assert.match(reason, /Recover:/);
    assert.match(reason, /without the emoji/);
    assert.match(reason, /\.rsc\/\.no-emoji/);
    assert.doesNotMatch(reason, PICTO, 'the refusal itself carries no emoji');
  }
  assert.ok(guard(root, `git commit -m "$(cat <<'EOF'\n${BUG} fix(x): y\nEOF\n)"`), 'the heredoc form too');
  assert.equal(guard(root, 'git commit'), null, 'an editor commit cannot be read: allowed');
});

test('emoji 3c: .no-emoji wins over .no-gitmoji (the convention is off, the emoji ban is not)', () => {
  const root = marked('.no-emoji');
  writeFileSync(join(root, '.rsc', '.no-gitmoji'), '');
  assert.ok(guard(root, `git commit -m "${SPARKLES} feat: x"`));
  assert.equal(guard(root, 'git commit -m "feat: x"'), null);
});

test('emoji 3d: without the marker the guard is exactly what it was', () => {
  const root = fresh('rsc-emoji-guard-');
  assert.match(guard(root, 'git commit -m "feat(api): add paging"'), /no gitmoji/);
  assert.equal(guard(root, `git commit -m "${SPARKLES} feat(api): add paging"`), null);
  const off = marked('.no-gitmoji');
  assert.equal(guard(off, 'git commit -m "feat: x"'), null);
  assert.equal(guard(off, `git commit -m "${SPARKLES} feat: x"`), null);
});
// knowledge-sync commits: tests/knowledge-sync.test.js, "ks-emoji-off".

// ---- 4. the output of the commands -----------------------------------------------

test('emoji 4a: plain() says in words what the output says in glyphs, and is the identity on plain text', () => {
  assert.equal(plain(`${CHECK} Installed 3 skills`), 'ok: Installed 3 skills');
  assert.equal(plain(`${WARN}  careful`), 'warning: careful');
  assert.equal(plain(`${NOENTRY} blocked \u2014 fix`), 'blocked: blocked \u2014 fix');
  assert.equal(plain('a \u2192 b'), 'a -> b');
  assert.equal(plain('\u{1F449} When you start'), 'When you start');
  assert.doesNotMatch(plain('\u{1F9CA} \u{1F4CF} \u{1F4DD} \u{1F501} \u21BB \u2713 \u2717'), PICTO);
  assert.doesNotMatch(plain('\u{1F9CA} \u{1F4CF} \u{1F4DD} \u{1F501} \u21BB \u2713 \u2717'), /[\u21BB\u2713\u2717]/);
  const text = 'rsc: plain text, a \u00B7 dot and a dash \u2014 nothing to say\n  indented';
  assert.equal(plain(text), text);
});

test('emoji 4b: the CLI prints words with the marker and the same glyphs without it', () => {
  const cwd = fresh();
  const without = run(cwd, ['sello', 'on']);
  assert.ok(without.stdout.includes(`${CHECK} sello ON`), 'precondition: today it prints a glyph');
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  writeFileSync(join(cwd, '.rsc', '.no-emoji'), '');
  const withMarker = run(cwd, ['sello', 'on']);
  assert.match(withMarker.stdout, /ok: sello ON/);
  assert.doesNotMatch(withMarker.stdout, PICTO);
});

test('emoji 4c: emojiOff reads the marker and nothing else', () => {
  const cwd = fresh();
  assert.equal(emojiOff(cwd), false);
  mkdirSync(join(cwd, '.rsc'));
  writeFileSync(join(cwd, '.rsc', '.no-emoji'), '');
  assert.equal(emojiOff(cwd), true);
});

// ---- 5. what is injected into every session --------------------------------------

const suggest = readFileSync(join(ROOT, 'skills/suggest/SKILL.md'), 'utf8');
function sessionStart(root) {
  const md = join(fresh('rsc-emoji-md-'), 'SKILL.md');
  writeFileSync(md, suggest);
  const r = spawnSync('node', [START, md, root], { encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('emoji 5a: with .no-emoji the injected body closes in words and carries the rule', () => {
  const root = marked('.no-emoji');
  const out = sessionStart(root);
  assert.ok(out.length > 1000, 'the body is still injected');
  for (const word of ['Dónde estás:', 'Siguiente:', 'Hecho:', 'Decidido:']) assert.ok(out.includes(word), word);
  assert.match(out, /no reply, commit, pull request or document carries an emoji/i);
  assert.match(out, /even when a skill or a template shows one/i);
  const body = out.slice(0, out.indexOf('===== rsc') === -1 ? undefined : out.indexOf('===== rsc'));
  assert.doesNotMatch(body, PICTO, 'no glyph left in the injected body');
  assert.ok(!out.includes(PIN));
});

test('emoji 5b: without the marker the injected body is byte for byte the skill, as today', () => {
  const root = fresh('rsc-emoji-start-');
  const out = sessionStart(root);
  assert.ok(out.startsWith(suggest));
  assert.ok(out.includes(`${PIN} d\u00F3nde est\u00E1s`));
  assert.doesNotMatch(out, /no reply, commit, pull request or document carries an emoji/i);
});

test('emoji 5c: noEmojiBody is deterministic and idempotent, and the rule stays small', () => {
  const once = noEmojiBody(suggest);
  assert.equal(noEmojiBody(once), once);
  assert.ok(Buffer.byteLength(NO_EMOJI_RULE) < 700);
  assert.doesNotMatch(NO_EMOJI_RULE, PICTO);
});

test('emoji 5d: the always-on body stays under its ceiling with nothing added to the file itself', () => {
  assert.ok(Buffer.byteLength(suggest) < 8000);
  assert.doesNotMatch(suggest, /no-emoji/, 'the rule is injected by the hook, not carried by every install');
});

test('emoji 5e: wireHook materializes the sibling next to session-start', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const cwd = fresh();
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  assert.ok(existsSync(join(cwd, '.rsc', 'emoji-policy.mjs')));
});

// ---- 6. skills and README --------------------------------------------------------

test('emoji 6: orient, its contract and git-workflow say what to do with .no-emoji; init asks; README documents it', () => {
  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  for (const p of ['skills/orient/SKILL.md', 'skills/orient/references/orientation-contract.md', 'skills/git-workflow/SKILL.md', 'skills/git-workflow/references/gitmoji.md']) {
    assert.match(read(p), /\.rsc\/\.no-emoji/, p);
  }
  assert.match(read('skills/orient/references/orientation-contract.md'), /Dónde estás:/);
  assert.match(read('skills/init/SKILL.md'), /--emoji/);
  assert.match(read('README.md'), /rsc emoji <on\|off>/);
});
