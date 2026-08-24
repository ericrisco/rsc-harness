// The checker that says whether a harness has a design identity — and the test that checks the
// checker. P2: a rule declared binding is born with its mechanism AND the test of the mechanism.
//
// The third case is the one that matters. A checker handed something it cannot read must report
// `inconclusive`, never `present` and never `missing`. Reporting green because you could not look
// is the defect this area already paid for once, in the design-dna style checker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designIdentity, BRAND_DIR, BRAND_SECTION } from '../scripts/lib/design-identity.js';

function harness() {
  return mkdtempSync(join(tmpdir(), 'rsc-identity-'));
}
const brand = (root) => join(root, BRAND_DIR);

test('present: an identity article, linked from the root instructions', () => {
  const root = harness();
  try {
    mkdirSync(brand(root), { recursive: true });
    writeFileSync(join(brand(root), 'visual-identity.md'), '# Identity\n');
    writeFileSync(join(root, 'CLAUDE.md'), `# Project\n\n${BRAND_SECTION}\n\nSee ${BRAND_DIR}/\n`);

    const r = designIdentity(root);
    assert.equal(r.state, 'present');
    assert.equal(r.linked, true);
    assert.deepEqual(r.articles, ['visual-identity.md']);
    assert.ok(!r.fix, 'nothing to fix when the identity is present and linked');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('present but unlinked: the five skills that read it via CLAUDE.md would not find it', () => {
  const root = harness();
  try {
    mkdirSync(brand(root), { recursive: true });
    writeFileSync(join(brand(root), 'visual-identity.md'), '# Identity\n');
    writeFileSync(join(root, 'CLAUDE.md'), '# Project\n\nNothing pointing at the identity.\n');

    const r = designIdentity(root);
    assert.equal(r.state, 'present');
    assert.equal(r.linked, false, 'an unlinked identity must not read as fully wired');
    assert.match(r.fix, /CLAUDE\.md/, 'the finding carries its own way out (P6)');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing: no brand directory at all, and the denial names the way out', () => {
  const root = harness();
  try {
    const r = designIdentity(root);
    assert.equal(r.state, 'missing');
    assert.match(r.fix, /design-loop/);
    assert.match(r.fix, /design-dna/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing: the directory exists but holds no identity article', () => {
  const root = harness();
  try {
    mkdirSync(brand(root), { recursive: true });
    // index.md is the wiki's own index, never an identity article.
    writeFileSync(join(brand(root), 'index.md'), '# Index\n');
    const r = designIdentity(root);
    assert.equal(r.state, 'missing');
    assert.ok(r.fix, 'still carries the way out');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('inconclusive: the brand path is a file, not a directory — cannot look, so cannot say', () => {
  const root = harness();
  try {
    mkdirSync(join(root, '02-DOCS', 'wiki'), { recursive: true });
    writeFileSync(brand(root), 'not a directory\n');

    const r = designIdentity(root);
    assert.equal(r.state, 'inconclusive');
    assert.notEqual(r.state, 'present', 'never green when it could not look');
    assert.notEqual(r.state, 'missing', 'never conflate "could not look" with "looked and found nothing"');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('inconclusive: a dangling symlink where the brand directory should be', () => {
  const root = harness();
  try {
    mkdirSync(join(root, '02-DOCS', 'wiki'), { recursive: true });
    symlinkSync(join(root, 'nowhere-at-all'), brand(root));

    const r = designIdentity(root);
    assert.equal(r.state, 'inconclusive', 'a dangling symlink is unreadable, not empty');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('inconclusive is reported, not thrown — doctor must never crash on a broken harness', () => {
  const root = harness();
  try {
    mkdirSync(brand(root), { recursive: true });
    writeFileSync(join(brand(root), 'visual-identity.md'), '# Identity\n');
    chmodSync(brand(root), 0o000);

    // Either it reads it (running as root) or it cannot; both are answers, neither is a crash.
    const r = designIdentity(root);
    assert.ok(['present', 'inconclusive'].includes(r.state), `unexpected state ${r.state}`);
  } finally {
    try { chmodSync(brand(root), 0o755); } catch {}
    rmSync(root, { recursive: true, force: true });
  }
});

test('this repo: the checker runs on the real harness and returns a usable verdict', () => {
  const r = designIdentity(process.cwd());
  assert.ok(['present', 'missing', 'inconclusive'].includes(r.state));
  assert.ok(typeof r.reason === 'string' && r.reason.length, 'every verdict explains itself');
});
