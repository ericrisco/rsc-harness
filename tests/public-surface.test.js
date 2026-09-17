import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the project PROMISES in public is a claim like any other, and P10 does not stop at the repo
// boundary: a published promise without the mechanism behind it is an assertion without evidence.
// Until this file existed, nothing checked it — so the README kept advertising a gate that routed
// every feature request through the ten-phase chain for as long as it took somebody to notice.
//
// This guard is deliberately about CLAIMS, not wording. It names the handful of sentences whose
// truth value changed in 2.0.0 and asserts they are gone or present, in every public surface at
// once, because the README and the site drifting apart is the same failure wearing two coats.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SURFACES = ['README.md', 'site/llms.txt', 'site/index.html', 'site/es/index.html'];
const ALL = SURFACES.filter((p) => existsSync(join(ROOT, p))).map((p) => ({ p, text: read(p) }));

test('1 · every public surface this guard names actually exists', () => {
  assert.deepEqual(ALL.map((s) => s.p), SURFACES, 'a guard that silently skips a file guards nothing');
});

// ── claims that 2.0.0 made FALSE ─────────────────────────────────────────────────────────────

const RETIRED = [
  { what: 'routing every feature request through the spec phase', re: /routes? through `?specify`?/i },
  { what: 'the spec-first new-feature gate', re: /new-feature gate|spec-first/i },
  { what: 'a profile to choose at install time', re: /--profile\s+(minimal|core|full)/i },
];

for (const claim of RETIRED) {
  test(`2 · no surface still claims: ${claim.what}`, () => {
    const guilty = ALL.filter((s) => claim.re.test(s.text)).map((s) => s.p);
    assert.deepEqual(guilty, [], `2.0.0 made this false; it is still published in: ${guilty.join(', ')}`);
  });
}

// ── claims that 2.0.0 made TRUE, and that nothing says yet ───────────────────────────────────

const REQUIRED = [
  { what: 'the default lane has a name', re: /\bFTD\b/, where: ['README.md', 'site/llms.txt'] },
  { what: 'the chain is not entered by the harness alone', re: /explicit request|accepted proposal|never enters? it alone/i, where: ['README.md'] },
  { what: 'a request for information writes nothing', re: /read-only|writes nothing/i, where: ['README.md'] },
  { what: 'isolation is retired automatically once work lands', re: /post-merge|retire[sd]? .*worktree|worktree.*retire/i, where: ['README.md'] },
];

for (const claim of REQUIRED) {
  test(`3 · stated where it matters: ${claim.what}`, () => {
    const missing = claim.where.filter((p) => !claim.re.test(read(p)));
    assert.deepEqual(missing, [], `true since 2.0.0 and unstated in: ${missing.join(', ')}`);
  });
}

// ── the promise that was already published, and is only now backed ───────────────────────────

test('4 · the own-skills promise is still made, because it is finally true', () => {
  const readme = read('README.md');
  assert.match(readme, /ownSkills|own skills/i, 'the boundary between yours and the catalog must be documented');
  assert.match(readme, /never installs, updates or overwrites/i,
    'this exact promise predates the mechanism that keeps it; now that it holds, it stays');
});

// ── counts are derived, never typed ──────────────────────────────────────────────────────────

test('5 · no surface carries a skill count the catalog would contradict', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const real = manifest.skills.length;
  const wrong = [];
  for (const { p, text } of ALL) {
    for (const m of text.matchAll(/(\d{2,4})\s*(?:quality-gated\s+)?skills/gi)) {
      if (Number(m[1]) !== real) wrong.push(`${p}: says ${m[1]}, catalog has ${real}`);
    }
  }
  assert.deepEqual(wrong, [], wrong.join(' · '));
});
