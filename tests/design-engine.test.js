// The rebuilt `design` skill (spec design-from-scratch, 3.3.0). The previous design area failed
// because its rules were prose the model had to remember; this one ships an engine that decides
// and measures. These tests hold the engine to that: the draw is reproducible, the browser gate can
// both fail and pass (P2), the skill never claims a gate it did not run, the third-party credit
// travels with the package, and the upstream watch both speaks and stays quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkUpstream } from '../scripts/design-upstream.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills', 'design');
const ENGINE = join(SKILL, 'engine');
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'design-gate');
const body = () => readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
const node = (script, args, env = {}) => spawnSync(process.execPath, [join(ENGINE, 'scripts', script), ...args], {
  encoding: 'utf8', env: { ...process.env, ...env }, timeout: 180_000,
});

test('A3 · no skill names the three skills folded into design', () => {
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(md|ya?ml|json|sh|mjs|js)$/.test(e.name) && /\b(design-loop|design-dna|motion-craft)\b/.test(readFileSync(p, 'utf8'))) hits.push(p.slice(ROOT.length + 1));
    }
  };
  walk(join(ROOT, 'skills'));
  assert.deepEqual(hits, []);
  for (const id of ['design-loop', 'design-dna', 'motion-craft']) assert.ok(!existsSync(join(ROOT, 'skills', id)), `skills/${id} is gone`);
});

test('A4 · the same seed deals the same direction; another seed deals another', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'rsc-design-draw-'));
  try {
    const deal = (seed) => {
      const out = join(tmp, `s${seed}-${Math.random().toString(36).slice(2)}`);
      // An empty history per deal: draw.mjs steers away from recent picks, which is right for a
      // person and wrong for a reproducibility check.
      const r = node('draw.mjs', ['--sector', 'restaurant', '--brief', 'a bakery', '--seed', String(seed), '--out', out],
        { TASTE_SKILL_HISTORY: join(out, 'history.json') });
      assert.equal(r.status, 0, r.stderr);
      const d = JSON.parse(readFileSync(join(out, 'direction.json'), 'utf8'));
      return JSON.stringify({ direction: d.direction?.id, hero: d.hero?.id, type: d.type, palette: d.palette, sections: d.sections });
    };
    assert.equal(deal(7), deal(7));
    assert.notEqual(deal(7), deal(8));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

// The browser gate needs Node 22 (global WebSocket) and a Chrome-family browser. Where either is
// missing the test says so instead of passing: a skipped gate must never read as a green one.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const { findChrome } = await import('../skills/design/engine/scripts/lib/cdp.mjs');
let chrome = null;
try { chrome = findChrome(); } catch { chrome = null; }
const gateSkip = nodeMajor < 22 ? `Node ${process.versions.node} < 22` : !chrome ? 'no Chrome/Edge/Chromium found' : false;

test('A5 · the browser gate fails a known-bad page by name and passes the corrected one', { skip: gateSkip }, () => {
  const tmp = mkdtempSync(join(tmpdir(), 'rsc-design-gate-'));
  try {
    const bad = node('inspect.mjs', [join(FIXTURES, 'bad', 'index.html'), '--out', join(tmp, 'bad'), '--json']);
    assert.equal(bad.status, 1, bad.stderr);
    const report = JSON.parse(readFileSync(join(tmp, 'bad', 'report.json'), 'utf8'));
    const badIds = new Set(report.findings.filter((f) => f.level === 'FAIL').map((f) => f.id));
    for (const id of ['headline-lines', 'blank-gap']) assert.ok(badIds.has(id), `bad page reports ${id}: ${[...badIds]}`);

    const good = node('inspect.mjs', [join(FIXTURES, 'good', 'index.html'), '--out', join(tmp, 'good')]);
    assert.equal(good.status, 0, good.stdout.split('\n').filter((l) => /FAIL|\[/.test(l)).join('\n'));
    assert.match(good.stdout, /RESULT: 0 FAIL/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('A6 · without the browser the skill reports the gate as not run, never as passed', () => {
  const b = body();
  assert.match(b, /inspector not run: <reason>/);
  assert.match(b, /Never report a gate as passed that did not\s+run/);
});

test('A9 · third-party licences travel with the skill, and no personal path ships', () => {
  assert.match(readFileSync(join(ENGINE, 'LICENSE'), 'utf8'), /MIT License[\s\S]*Leonxlnx/);
  assert.match(readFileSync(join(SKILL, 'IMPECCABLE-LICENSE.txt'), 'utf8'), /Apache License[\s\S]*Version 2\.0/);
  const third = readFileSync(join(SKILL, 'THIRD_PARTY.md'), 'utf8');
  for (const s of ['Leonxlnx/taste-skill', 'MIT', 'pbakaus/impeccable', 'Paul Bakaus', 'Apache-2.0', 'Modified']) assert.ok(third.includes(s), `THIRD_PARTY.md names ${s}`);
  const upstream = JSON.parse(readFileSync(join(ENGINE, 'UPSTREAM.json'), 'utf8'));
  assert.match(upstream['taste-skill'].commit, /^[0-9a-f]{40}$/);
  const leaks = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (statSync(p).size < 2_000_000 && /\/Users\/|\/home\/[a-z]/.test(readFileSync(p, 'utf8'))) leaks.push(p.slice(ROOT.length + 1));
    }
  };
  walk(SKILL);
  assert.deepEqual(leaks, []);
});

test('A10 · the upstream watch reports a newer upstream and stays quiet when current', async () => {
  const shipped = { 'taste-skill': { repo: 't/t', path: 'skills/taste-skill', commit: 'a'.repeat(40), version: '2.1.4' }, impeccable: { repo: 'i/i', version: 'skill-v4.7.0' } };
  const fake = (routes) => async (url) => {
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    if (!hit) throw new Error(`unexpected ${url}`);
    return { ok: true, status: 200, json: async () => hit[1] };
  };
  const current = await checkUpstream({ upstream: shipped, fetchImpl: fake({ '/commits?': [{ sha: 'a'.repeat(40) }], '/releases?': [{ tag_name: 'engine-v0.1.16' }, { tag_name: 'skill-v4.7.0' }] }) });
  assert.deepEqual(current, []);
  // A merge that already contains the path's latest commit is not news.
  const behind = await checkUpstream({ upstream: shipped, fetchImpl: fake({ '/commits?': [{ sha: 'b'.repeat(40) }], '/compare/': { status: 'behind' }, '/releases?': [{ tag_name: 'skill-v4.7.0' }] }) });
  assert.deepEqual(behind, []);
  const moved = await checkUpstream({ upstream: shipped, fetchImpl: fake({ '/commits?': [{ sha: 'c'.repeat(40) }], '/compare/': { status: 'ahead' }, '/releases?': [{ tag_name: 'skill-v4.8.0' }] }) });
  assert.deepEqual(moved.map((m) => [m.id, m.latest]), [['taste-skill', 'ccccccc'], ['impeccable', 'skill-v4.8.0']]);
});

test('A11 · the description stays within the 350-character ceiling (paid every turn, everywhere)', () => {
  const desc = /^description: "(.*)"$/m.exec(body())[1];
  assert.ok(desc.length <= 350, `${desc.length} chars`);
});

test('the engine ships unmodified: every script parses and RUN.md is upstream text without front matter', () => {
  const scripts = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.mjs')) scripts.push(p); } };
  walk(join(ENGINE, 'scripts'));
  assert.ok(scripts.length >= 9, `${scripts.length} scripts`);
  for (const s of scripts) {
    const r = spawnSync(process.execPath, ['--check', s], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${s}: ${r.stderr}`);
  }
  const run = readFileSync(join(ENGINE, 'RUN.md'), 'utf8');
  assert.ok(!run.startsWith('---'), 'RUN.md carries no front matter, so it is never discovered as a skill');
  assert.match(run, /## The run/);
});
