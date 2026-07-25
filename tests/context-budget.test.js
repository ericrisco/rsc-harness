import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, statSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { applyInstall } from '../scripts/install-apply.js';
import { contextBudget } from '../scripts/doctor.js';

function snapshot(root) {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(`${relative(root, p)}:${statSync(p).mtimeMs}`);
    }
  })(root);
  return out.sort().join('\n');
}

function wireStubScope(root, version = '0.2.0') {
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: 'command', command: `node "${root}/.rsc/session-start.mjs"` }] }] },
  }));
  mkdirSync(join(root, '.rsc/skills/suggest'), { recursive: true });
  writeFileSync(join(root, '.rsc/.version'), `${version}\n`);
  writeFileSync(join(root, '.rsc/skills/suggest/SKILL.md'), 'x'.repeat(5000));
}

test('contextBudget reports the four figures for an installed project', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest', 'fastapi'], target: 'claude', cwd });

  const budget = contextBudget({ target: 'claude', home, cwd });

  assert.ok(budget.sessionStartBytes > 5000, `always-on body counted: ${budget.sessionStartBytes}`);
  assert.ok(budget.perTurnBytes > 100, `per-turn gate counted: ${budget.perTurnBytes}`);
  assert.ok(budget.descriptionsBytes > 100, `installed descriptions counted: ${budget.descriptionsBytes}`);
  assert.ok(budget.topContributors.bodies.length > 0, 'names the heaviest bodies');
  assert.ok(budget.topContributors.descriptions.length > 0, 'names the heaviest descriptions');
  assert.ok(budget.topContributors.bodies.every((b) => b.id && b.bytes > 0), 'contributors carry id + bytes');
});

test('contextBudget flags duplicate wiring across scopes, with the action', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-dup-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  wireStubScope(home);

  const budget = contextBudget({ target: 'claude', home, cwd });
  const dup = budget.findings.find((f) => f.id === 'duplicate-wiring');

  assert.ok(dup, 'duplicate wiring surfaced as a finding');
  assert.ok(dup.action && dup.action.length > 0, 'the finding carries a concrete action');
  assert.equal(budget.scopes.filter((s) => s.wired).length, 2, 'both scopes counted');
});

test('contextBudget reports no duplication finding for a single scope', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-single-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const budget = contextBudget({ target: 'claude', home, cwd });

  assert.ok(!budget.findings.some((f) => f.id === 'duplicate-wiring'));
  assert.ok(budget.sessionStartBytes > 0, 'still reports the weight');
});

test('contextBudget marks an unreadable scope unknown and still delivers the rest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-bad-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude/settings.json'), '{ this is not json');

  const budget = contextBudget({ target: 'claude', home, cwd });

  assert.ok(budget.scopes.some((s) => s.status === 'unknown'), 'bad scope marked unknown');
  assert.ok(budget.sessionStartBytes > 0, 'a broken scope does not sink the whole report');
});

test('contextBudget never mutates the project', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-ro-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'claude', cwd });

  const before = snapshot(cwd);
  contextBudget({ target: 'claude', home, cwd });

  assert.equal(snapshot(cwd), before, 'read-only report');
});

test('contextBudget says what does not apply on a hookless target', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-cb-md-'));
  const home = mkdtempSync(join(tmpdir(), 'rsc-cb-home-'));
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });

  const budget = contextBudget({ target: 'codex', home, cwd });

  // A hookless assistant has no per-session/per-turn injection: reporting 0 would read as
  // "you pay nothing", which is a different and wrong claim.
  assert.ok(budget.notApplicable.includes('sessionStart'), 'sessionStart flagged not-applicable');
  assert.ok(budget.notApplicable.includes('perTurn'), 'perTurn flagged not-applicable');
  assert.ok(budget.descriptionsBytes > 0, 'descriptions still apply');
});
