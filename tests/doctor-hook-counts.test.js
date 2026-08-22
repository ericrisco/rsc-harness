import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { contextBudget, countHookEntries, RSC_HOOKS } from '../scripts/doctor.js';

// `doctor` is the only command whose job is telling the user what the harness costs. On the Windows
// box that had four copies of every hook, it printed a clean report: 5.4 KB per session start and NO
// finding at all. The existing duplication finding is about being wired in two SCOPES, so a hook
// repeated four times inside one scope was invisible in the one place built to see it.
//
// What the duplication actually costs, measured during clarify (and NOT what the first draft of the
// spec claimed): 4× processes per event unconditionally, but only ~1.27× context — the single-shot
// guard suppresses the repeated body. Without that guard it is a true 4×. So the report has to name
// two different costs, and it must not present either as the other.
//
// Spec: 02-DOCS/wiki/sdd/specs/doctor-counts-hooks.md · Plan: doctor-counts-hooks.plan.md
const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'scripts', 'rsc.js');

// A wired scope, built by hand so the separator style under test never depends on the host.
function wiredScope({ style = 'posix', copies = 1, guard = true, extra = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), `rsc-hc-${style}-`));
  mkdirSync(join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, '.rsc', 'skills', 'suggest'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.version'), '1.0.32\n');
  writeFileSync(join(root, '.rsc', 'skills', 'suggest', 'SKILL.md'), 'x'.repeat(5000));
  // The single-shot guard, materialized or not: this is what decides the context regime.
  if (guard) writeFileSync(join(root, '.rsc', 'hook-once.mjs'), '// guard\n');

  const path = (script) => (style === 'windows'
    ? `C:\\proj\\.rsc\\${script}`
    : join(root, '.rsc', script));
  const entry = (script) => ({ hooks: [{ type: 'command', command: `node "${path(script)}" "${root}"` }] });
  const many = (script) => Array.from({ length: copies }, () => entry(script));

  const hooks = {
    SessionStart: many('session-start.mjs'),
    PreCompact: many('worklog-checkpoint.mjs'),
    SessionEnd: many('worklog-checkpoint.mjs'),
    PreToolUse: [...many('ship-guard.mjs'), ...many('danger-guard.mjs'), ...many('gitmoji-guard.mjs')],
    UserPromptSubmit: many('userprompt-gate.mjs'),
    ...extra,
  };
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({ hooks }, null, 2) + '\n');
  return root;
}

const emptyHome = () => mkdtempSync(join(tmpdir(), 'rsc-hc-home-'));
const budgetOf = (cwd) => contextBudget({ target: 'claude', home: emptyHome(), cwd });
const dupFinding = (b) => b.findings.find((f) => f.id === 'duplicate-hook-entries');

// ── the registry ─────────────────────────────────────────────────────────────────────────

test('the hook registry is a real table, and every row is filled', () => {
  // A registry with a missing row is a hook nobody counts. Iterated here so adding one without a row
  // fails the suite instead of shipping uncounted.
  assert.ok(Array.isArray(RSC_HOOKS) && RSC_HOOKS.length >= 6, `registry too small: ${RSC_HOOKS.length}`);
  for (const h of RSC_HOOKS) {
    assert.ok(h.id && /^[a-z0-9-]+$/.test(h.id), `bad id: ${h.id}`);
    assert.ok(h.needle && h.needle.length > 4, `row ${h.id} has no usable needle`);
    assert.ok(h.label && h.label.length > 3, `row ${h.id} has no human label`);
  }
  const ids = RSC_HOOKS.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids in the registry: ${ids.join(', ')}`);
});

for (const style of ['posix', 'windows']) {
  test(`every registered hook is counted on a ${style}-wired scope`, () => {
    const root = wiredScope({ style, copies: 4 });
    const counts = countHookEntries(JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8')));
    for (const h of RSC_HOOKS) {
      if (h.id === 'legacy-cat-form') continue; // not wired by the fixture; covered by its own test
      const seen = Object.values(counts.perEvent).some((byHook) => byHook[h.id] === 4);
      assert.ok(seen, `${h.id} was not counted 4× on a ${style} scope: ${JSON.stringify(counts.perEvent)}`);
    }
  });
}

// ── the finding ──────────────────────────────────────────────────────────────────────────

for (const style of ['posix', 'windows']) {
  test(`four copies on a ${style} scope produce a finding naming the count`, () => {
    const b = budgetOf(wiredScope({ style, copies: 4 }));
    const f = dupFinding(b);
    assert.ok(f, `no duplicate-hook-entries finding on a ${style} scope with 4 copies`);
    assert.match(f.summary, /4/, `the finding does not carry the count: ${f.summary}`);
    assert.match(f.summary, /session-start/, `the finding does not name the hook: ${f.summary}`);
  });
}

test('the finding names BOTH costs, and does not present one as the other', () => {
  // The whole point of the delivery. Reporting only bytes would move the headline from 5.4 to 6.9 KB
  // and leave the 4× of processes invisible — the same blindness in a new costume.
  const f = dupFinding(budgetOf(wiredScope({ copies: 4 })));
  assert.match(f.summary + f.action, /process|proceso/i, 'the execution surcharge is not named');
  assert.match(f.summary + f.action, /context/i, 'the context surcharge is not named');
  assert.match(f.summary, /4×|4x/, 'the execution multiplier is not stated');
});

test('the finding carries the command that collapses the copies (P6)', () => {
  const f = dupFinding(budgetOf(wiredScope({ copies: 4 })));
  assert.match(f.action, /rsc/, `no way out in the action: ${f.action}`);
});

test('the finding is separate from duplicate-wiring, not folded into it', () => {
  // Decided in clarify: different remedies, so different findings. Folding them would give the user
  // one finding with two actions and no way to tell which one is theirs.
  const b = budgetOf(wiredScope({ copies: 4 }));
  assert.ok(dupFinding(b), 'the entry-duplication finding is missing');
  assert.ok(!b.findings.some((f) => f.id === 'duplicate-wiring'), 'only one scope is wired here');
});

// ── the two context regimes ──────────────────────────────────────────────────────────────

test('with the single-shot guard present, the body is NOT multiplied by the copies', () => {
  // Measured in clarify: four entries sharing a session_id inject the body once. A figure that
  // multiplied here would be the same lie as the one that started this spec, pointing the other way.
  const one = budgetOf(wiredScope({ copies: 1, guard: true }));
  const four = budgetOf(wiredScope({ copies: 4, guard: true }));
  assert.equal(four.sessionStartBytes, one.sessionStartBytes,
    'the body was multiplied even though the guard suppresses the repeat');
  assert.match(dupFinding(four).summary, /suppress|suprim/i, 'the finding does not say the body is suppressed');
});

test('with the guard ABSENT, the body IS multiplied by the copies', () => {
  const one = budgetOf(wiredScope({ copies: 1, guard: false }));
  const four = budgetOf(wiredScope({ copies: 4, guard: false }));
  assert.equal(four.sessionStartBytes, one.sessionStartBytes * 4,
    `an install without the guard pays 4×, and the figure must say so: ${four.sessionStartBytes} vs ${one.sessionStartBytes}`);
});

// ── the half that must not change ────────────────────────────────────────────────────────

test('a healthy scope gets no new finding and the same figures as before', () => {
  const b = budgetOf(wiredScope({ copies: 1 }));
  assert.equal(dupFinding(b), undefined, `a healthy box got a duplication finding: ${JSON.stringify(b.findings)}`);
  assert.ok(b.sessionStartBytes >= 5000, 'the always-on body is still counted');
  assert.ok(b.perTurnBytes > 0, 'the per-turn gate is still counted');
});

test("a user's own hook in the same event is not counted as rsc's", () => {
  const mine = { hooks: [{ type: 'command', command: 'node "/p/scripts/my-own.mjs" --rsc-like' }] };
  const root = wiredScope({ copies: 1, extra: { SessionStart: [mine] } });
  const b = budgetOf(root);
  assert.equal(dupFinding(b), undefined, 'a foreign hook was counted as a duplicate rsc hook');
});

test('the legacy cat-form is counted as an rsc hook', () => {
  // If uninstall knows how to retire that form, the report has to know how to count it.
  const legacy = { hooks: [{ type: 'command', command: 'cat .claude/skills/rsc/suggest/SKILL.md' }] };
  const root = wiredScope({ copies: 1, extra: { SessionStart: [legacy, legacy] } });
  const f = dupFinding(budgetOf(root));
  assert.ok(f, 'two legacy entries were not reported as duplication');
});

test('an event whose value is not a list is reported indeterminate, not crashed', () => {
  const root = wiredScope({ copies: 1, extra: { SessionStart: 'hand-edited nonsense' } });
  const b = budgetOf(root);
  assert.ok(Array.isArray(b.findings), 'the report survived');
  assert.ok(
    b.findings.some((f) => /indetermin/i.test(f.summary + f.id)) || b.scopes.some((s) => s.hookCountsUnknown),
    `a malformed event was neither reported nor survived visibly: ${JSON.stringify(b.findings)}`,
  );
});

test('a scope with no rsc hooks at all reports nothing new', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-hc-bare-'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'settings.json'), JSON.stringify({ hooks: {} }, null, 2) + '\n');
  assert.equal(dupFinding(budgetOf(root)), undefined);
});

test('an unreadable settings.json behaves exactly as before', () => {
  const root = wiredScope({ copies: 4 });
  writeFileSync(join(root, '.claude', 'settings.json'), '{ not json');
  const b = budgetOf(root);
  assert.ok(b.scopes.some((s) => s.status === 'unknown'), 'the unreadable scope is still reported');
  assert.equal(dupFinding(b), undefined, 'nothing is invented for a scope we cannot parse');
});

// ── the exit code, decided in clarify ────────────────────────────────────────────────────

test('the CLI still exits 0 when duplication is found', () => {
  // doctor is a report, not a gate. Turning it into one would break every published script that runs
  // it expecting 0 — decided in clarify, and this is the test that keeps the decision.
  const root = wiredScope({ copies: 4 });
  const r = spawnSync('node', [CLI, 'doctor'], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: emptyHome() } });
  assert.equal(r.status, 0, `doctor exited ${r.status}:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /session-start/, 'the duplication is actually printed for a human');
});

test('the printed report shows the duplication to a human, not only in JSON', () => {
  const root = wiredScope({ copies: 4 });
  const r = spawnSync('node', [CLI, 'doctor'], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: emptyHome() } });
  assert.match(r.stdout, /4×|4x/, `the multiplier is not visible in the printed report:\n${r.stdout}`);
});
