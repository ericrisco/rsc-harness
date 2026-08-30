import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectTarget, installedTargets, resolveTargets, targetPaths } from '../targets/index.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'rsc-target-')); }

// Write the state file a real install would leave for `target`, so the fixture is
// evidence of the same shape the CLI writes — not a hand-rolled approximation.
function installed(dir, target, skills = ['orient']) {
  const { stateFile } = targetPaths(target, undefined, dir);
  mkdirSync(join(stateFile, '..'), { recursive: true });
  const state = { skills: {} };
  for (const id of skills) state.skills[id] = { files: [], base: '' };
  writeFileSync(stateFile, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// installedTargets — the evidence
// ---------------------------------------------------------------------------

test('installedTargets: nothing installed → []', () => {
  assert.deepEqual(installedTargets(tmp()), []);
});

test('installedTargets: finds the one target with a state file', () => {
  const d = tmp();
  installed(d, 'claude');
  assert.deepEqual(installedTargets(d), ['claude']);
});

test('installedTargets: a state file with zero skills is not an installation', () => {
  const d = tmp();
  const { stateFile } = targetPaths('claude', undefined, d);
  mkdirSync(join(stateFile, '..'), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ skills: {} }));
  assert.deepEqual(installedTargets(d), []);
});

test('installedTargets: unreadable state counts as absent, never throws', () => {
  const d = tmp();
  const { stateFile } = targetPaths('claude', undefined, d);
  mkdirSync(join(stateFile, '..'), { recursive: true });
  writeFileSync(stateFile, 'not json{{{');
  assert.deepEqual(installedTargets(d), []);
});

test('installedTargets: order is stable regardless of which was written first', () => {
  const a = tmp(); installed(a, 'codex'); installed(a, 'claude');
  const b = tmp(); installed(b, 'claude'); installed(b, 'codex');
  assert.deepEqual(installedTargets(a), installedTargets(b));
});

// ---------------------------------------------------------------------------
// detectTarget — the heuristic, with Claude Code finally in it
// ---------------------------------------------------------------------------

test('detectTarget: .claude/ is an explicit signal, not a fallthrough', () => {
  const d = tmp();
  mkdirSync(join(d, '.claude'));
  assert.equal(detectTarget(d), 'claude');
});

test('detectTarget: CLAUDE.md is an explicit signal', () => {
  const d = tmp();
  writeFileSync(join(d, 'CLAUDE.md'), '# hi');
  assert.equal(detectTarget(d), 'claude');
});

// The bug that opened issue #249: `harness` writes AGENTS.md into every repo it
// equips, so AGENTS.md must never outrank a real Claude Code signal.
test('detectTarget: AGENTS.md loses to .claude/ — the #249 mine', () => {
  const d = tmp();
  writeFileSync(join(d, 'AGENTS.md'), '# hand-written constitution');
  writeFileSync(join(d, 'CLAUDE.md'), '# pointer');
  mkdirSync(join(d, '.claude'));
  assert.equal(detectTarget(d), 'claude');
});

test('detectTarget: AGENTS.md loses to an explicit .codex/', () => {
  const d = tmp();
  writeFileSync(join(d, 'AGENTS.md'), '# x');
  mkdirSync(join(d, '.codex'));
  assert.equal(detectTarget(d), 'codex');
});

test('detectTarget: AGENTS.md alone still means codex — no regression', () => {
  const d = tmp();
  writeFileSync(join(d, 'AGENTS.md'), '# x');
  assert.equal(detectTarget(d), 'codex');
});

test('detectTarget: empty repo still falls back to claude', () => {
  assert.equal(detectTarget(tmp()), 'claude');
});

// ---------------------------------------------------------------------------
// resolveTargets — the single point of resolution
// ---------------------------------------------------------------------------

test('resolveTargets: the flag beats evidence and heuristic alike', () => {
  const d = tmp();
  installed(d, 'codex');
  writeFileSync(join(d, 'AGENTS.md'), '# x');
  const r = resolveTargets({ cwd: d, flagValue: 'claude' });
  assert.deepEqual(r.ids, ['claude']);
  assert.equal(r.ambiguous, null);
  assert.equal(r.source, 'flag');
});

test('resolveTargets: the flag takes a comma list', () => {
  const r = resolveTargets({ cwd: tmp(), flagValue: 'claude, codex' });
  assert.deepEqual(r.ids, ['claude', 'codex']);
});

test('resolveTargets: one installed target wins over a misleading AGENTS.md', () => {
  const d = tmp();
  installed(d, 'claude');
  writeFileSync(join(d, 'AGENTS.md'), '# hand-written');
  const r = resolveTargets({ cwd: d });
  assert.deepEqual(r.ids, ['claude']);
  assert.equal(r.source, 'evidence');
});

test('resolveTargets: two installed targets are ambiguous — it must not pick', () => {
  const d = tmp();
  installed(d, 'claude');
  installed(d, 'codex');
  const r = resolveTargets({ cwd: d });
  assert.deepEqual(r.ids, []);
  assert.deepEqual(r.ambiguous, ['claude', 'codex']);
  assert.equal(r.source, 'evidence');
});

test('resolveTargets: no evidence falls through to the heuristic', () => {
  const d = tmp();
  writeFileSync(join(d, 'AGENTS.md'), '# x');
  const r = resolveTargets({ cwd: d });
  assert.deepEqual(r.ids, ['codex']);
  assert.equal(r.source, 'heuristic');
});

test('resolveTargets: a healthy single install resolves as it always did', () => {
  const d = tmp();
  installed(d, 'codex');
  assert.deepEqual(resolveTargets({ cwd: d }).ids, ['codex']);
});
