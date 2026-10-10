import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SKILL_FLOOR } from '../scripts/lib/default-skill-floor.js';
import { syncInstalled } from '../scripts/install-apply.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

// Issue #303: a small business asks "connect my Holded / my Sage", and rsc had two walls. The
// `harness` rule created a tool ONLY from evidence in code (a business has none), and the only other
// way was copying a template by hand. rsc ships no ready-made connections on purpose, so the answer
// is a method that is always installed, not a list of vendors.
// FTD: 02-DOCS/wiki/ftd/connect-tool.md
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const skill = read('skills/connect-tool/SKILL.md');

test('connect-tool is part of the floor every installation equips', () => {
  assert.ok(DEFAULT_SKILL_FLOOR.includes('connect-tool'));
});

test('a harness declared before 3.0.13 gains connect-tool on sync, on disk and not just named', async () => {
  const d = mkdtempSync(join(tmpdir(), 'ct-sync-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeManifest(d, { targets: ['claude'], skills: ['orient', 'suggest', 'unslop', 'ftd'], ownSkills: [], catalogVersion: '3.0.12', tier: null, optOuts: [] });
  const r = await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.ok(r.synced.includes('connect-tool'));
  assert.ok(existsSync(join(d, '.claude', 'skills', 'connect-tool', 'SKILL.md')));
});

test('harness now accepts a tool the user names, and hands that job to connect-tool', () => {
  const harness = read('skills/harness/SKILL.md');
  assert.match(harness, /or the user asked for it by name \(then `\.\.\/connect-tool\/SKILL\.md` builds it\)/);
  assert.doesNotMatch(harness, /if and only if the detector found evidence/, 'the code-only rule is the wall #303 hit');
  assert.doesNotMatch(harness, /the user does `cp -r 01-TOOLS\/_TEMPLATE/, 'nobody should be told to copy the template by hand');
});

test('the method: docs before memory, read-only first, never write into a desktop program database', () => {
  for (const rule of [
    /the docs decide, never memory/i,
    /If you find\s+nothing reliable, say so/,
    /\*\*Read first\.\*\*/,
    /Never write directly into a desktop program's database/,
    /Work on a copy, never the live database/,
    /Never open the\s+database port to the internet/,
  ]) assert.match(skill, rule);
});

test('the read-only proof tells a permission error apart from any other failure', () => {
  // A probe that prints "writes refused" on ANY error passes a wrong password as proof. Each one must
  // grep for the permission error specifically, and fail on everything else.
  const probes = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => /writes refused/.test(b));
  assert.equal(probes.length, 2, 'PostgreSQL and SQL Server probes');
  for (const p of probes) {
    assert.match(p, /FAIL — this user can write/, 'a successful write fails the test');
    assert.match(p, /grep -q/, 'success requires the specific permission error');
    assert.match(p, /FAIL — unexpected error/, 'any other error fails, never passes as refused');
  }
});

test('no ready-to-send message for an IT person or an accounting firm (removed by the owner)', () => {
  assert.doesNotMatch(skill, /Hi <name>|ready to\s+send|write the message/i);
  assert.match(skill, /Check the support terms/, 'the vendor-terms caution stays, without the message');
});
