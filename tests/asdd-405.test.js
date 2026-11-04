import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wireHook } from '../targets/claude.js';

// 4.0.5. The 4.0.4 run left two things to the agent's memory: Claude Code's default Co-Authored-By
// trailer (the agent rebased it out by hand), and a headless run that ended on "¿Sigo así?" while
// its reviewers ran in the background, then read the "sí, sigue" as approval for a tier-2 push.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

function wired(settings) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-405-'));
  const hookTarget = join(root, '.claude', 'settings.json');
  if (settings) {
    mkdirSync(dirname(hookTarget), { recursive: true });
    writeFileSync(hookTarget, JSON.stringify(settings, null, 2) + '\n');
  }
  wireHook({ projectRoot: root, hookTarget, skillDir: (id) => join(root, '.claude', 'skills', id) });
  return JSON.parse(readFileSync(hookTarget, 'utf8'));
}

test('a fresh install hides the AI commit trailer and PR footer', () => {
  assert.deepEqual(wired().attribution, { commit: '', pr: '' });
});

test('a reinstall keeps it hidden and does not duplicate it', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-405-'));
  const hookTarget = join(root, '.claude', 'settings.json');
  const paths = { projectRoot: root, hookTarget, skillDir: (id) => join(root, '.claude', 'skills', id) };
  wireHook(paths);
  wireHook(paths);
  assert.deepEqual(JSON.parse(readFileSync(hookTarget, 'utf8')).attribution, { commit: '', pr: '' });
});

test('an attribution the person already chose is left as it is', () => {
  const mine = { commit: 'Reviewed-by: bot', pr: '' };
  assert.deepEqual(wired({ attribution: mine }).attribution, mine);
});

test('the deprecated includeCoAuthoredBy counts as a choice too', () => {
  const s = wired({ includeCoAuthoredBy: true });
  assert.equal(s.attribution, undefined);
  assert.equal(s.includeCoAuthoredBy, true);
});

test('asdd forbids handing the turn back mid-run and separates "continue" from tier-2 approval', () => {
  const asdd = read('skills/asdd/SKILL.md');
  assert.match(asdd, /Never hand the turn back mid-run/);
  assert.match(asdd, /Background reviewers are waited for/);
  assert.match(asdd, /not\*\* approval for a tier-2 merge/);
  assert.match(asdd, /in exactly this form/);
  assert.match(read('skills/implement/SKILL.md'), /Wait for every reviewer inside the turn/);
});
