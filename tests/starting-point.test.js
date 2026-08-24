// What does this project already own, and does its colour hold up? — and the tests that check the
// checker (P2). Spec: 02-DOCS/wiki/sdd/specs/design-starting-point.md
//
// Three promises in the design area say "I'll propose you a starting point" and none of them had
// anything behind it. This is the half that can be an algorithm (P1): finding what is already
// installed, and refusing to propose a colour that fails contrast.
//
// The three cases that decide whether this is worth anything are the mutants, and they were written
// before the implementation:
//   1. a record whose ink-on-ground measures 4.1:1  -> must be a FAILURE, or the gate is decorative
//   2. a record directory that cannot be read       -> must be `inconclusive`, never `none`/`owned`
//   3. a colour that cannot be parsed               -> must NOT land in the pass column
// The second one is this area's recurring defect: the design-dna checker ran regex probes over empty
// text and returned vacuous passes, and designIdentity reported a dangling symlink as absence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ownedStartingPoints,
  contrastRatio,
  checkPairings,
  startingPointSummary,
  TEXT_MIN,
  UI_MIN,
} from '../scripts/lib/starting-point.js';

function tmp(prefix = 'rsc-startpoint-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

// A minimal record that satisfies the design-dna schema's required palette shape.
function record(root, slug, { colors, name, drop } = {}) {
  const dir = join(root, slug);
  mkdirSync(dir, { recursive: true });
  const dna = {
    meta: { name: name || slug, slug },
    palette: {
      colors: colors || [
        { role: 'ground', hex: '#ffffff', name: 'paper' },
        { role: 'ink', hex: '#111111', name: 'soot' },
      ],
      coverage: { ground: 90, ink: 10 },
      banned: [],
    },
    type: { families: ['x'] },
  };
  if (drop) for (const k of drop) delete dna[k];
  writeFileSync(join(dir, 'dna.json'), JSON.stringify(dna));
  return dir;
}

// ── ownedStartingPoints ──────────────────────────────────────────────────────

test('owned: one legible record is enough, and it is never chosen for the user', () => {
  const root = tmp();
  try {
    record(root, 'night-shift');
    const r = ownedStartingPoints([root], tmp());
    assert.equal(r.state, 'owned');
    assert.equal(r.records.length, 1);
    assert.equal(r.records[0].slug, 'night-shift');
    assert.ok(r.records[0].covers.includes('palette'));
    assert.equal(r.unreadable.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('owned: what the harness cites comes first, and the rest stay listed', () => {
  const root = tmp();
  const harness = tmp();
  try {
    record(root, 'aaa-first-alphabetically');
    record(root, 'night-shift');
    const brand = join(harness, '02-DOCS', 'wiki', 'brand');
    mkdirSync(brand, { recursive: true });
    writeFileSync(join(brand, 'visual-identity.md'), '# Identity\n\nBuilt in the night-shift style.\n');

    const r = ownedStartingPoints([root], harness);
    assert.equal(r.state, 'owned');
    assert.equal(r.records[0].slug, 'night-shift', 'the cited record leads');
    assert.equal(r.records.length, 2, 'the other one is still a candidate, not discarded');
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(harness, { recursive: true, force: true });
  }
});

test('none: looked, found nothing — and the denial carries its way out (P6)', () => {
  const root = tmp();
  try {
    const r = ownedStartingPoints([root], tmp());
    assert.equal(r.state, 'none');
    assert.equal(r.records.length, 0);
    assert.ok(r.fix, 'a denial with no exit is abandonment');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// MUTANT 2 — the one this area keeps paying for.
test('MUTANT: a root that cannot be read is inconclusive, never none and never owned', () => {
  const parent = tmp();
  try {
    const dangling = join(parent, 'skills-link');
    symlinkSync(join(parent, 'does-not-exist'), dangling);

    const r = ownedStartingPoints([dangling], tmp());
    assert.equal(r.state, 'inconclusive');
    assert.notEqual(r.state, 'none');
    assert.notEqual(r.state, 'owned');
    assert.match(r.reason, /resolve|read/i);
  } finally { rmSync(parent, { recursive: true, force: true }); }
});

test('a record missing its palette is unreadable, not a usable candidate', () => {
  const root = tmp();
  try {
    record(root, 'half-written', { drop: ['palette'] });
    const r = ownedStartingPoints([root], tmp());
    assert.equal(r.records.length, 0, 'half a record cannot be reused');
    assert.equal(r.unreadable.length, 1);
    assert.match(r.unreadable[0].reason, /palette/);
    assert.equal(r.state, 'inconclusive', 'something was there and we could not use it');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('unparseable JSON is reported, not skipped in silence', () => {
  const root = tmp();
  try {
    const dir = join(root, 'broken');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'dna.json'), '{ not json');
    const r = ownedStartingPoints([root], tmp());
    assert.equal(r.records.length, 0);
    assert.equal(r.unreadable.length, 1);
    assert.equal(r.state, 'inconclusive');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('read-only: it never writes into the roots it scans', () => {
  const root = tmp();
  try {
    record(root, 'night-shift');
    chmodSync(root, 0o555);
    const r = ownedStartingPoints([root], tmp());
    assert.equal(r.state, 'owned', 'a read-only root is still perfectly readable');
  } finally {
    chmodSync(root, 0o755);
    rmSync(root, { recursive: true, force: true });
  }
});

// ── contrastRatio ────────────────────────────────────────────────────────────
// Anchored to values the standard fixes, not to this implementation's own output — a ratio checked
// against itself passes with any conversion, including a wrong one.

test('contrastRatio is anchored to known values, not to itself', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff') * 100) / 100, 21);
  assert.equal(contrastRatio('#123456', '#123456'), 1);
  // Symmetric: the standard's ratio does not care which colour is the foreground.
  assert.equal(contrastRatio('#000000', '#ffffff'), contrastRatio('#ffffff', '#000000'));
  // A mid grey on white is the classic near-miss; 4.5 must not be satisfied by #777 on white.
  assert.ok(contrastRatio('#777777', '#ffffff') < TEXT_MIN);
  assert.ok(contrastRatio('#595959', '#ffffff') >= TEXT_MIN);
});

// ── checkPairings ────────────────────────────────────────────────────────────

test('a sound palette passes, with the pairs it actually evaluated named', () => {
  const r = checkPairings([
    { role: 'ground', hex: '#ffffff', name: 'paper' },
    { role: 'ink', hex: '#111111', name: 'soot' },
  ]);
  assert.equal(r.failures.length, 0);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].min, TEXT_MIN);
  assert.ok(r.pairs[0].ok);
});

// MUTANT 1 — if this passes, the gate is decorative.
test('MUTANT: ink at 4.1:1 on its ground is a failure', () => {
  // #7d7d7d on white measures ~4.12:1 — below the 4.5 floor, above a careless eyeball.
  const r = checkPairings([
    { role: 'ground', hex: '#ffffff', name: 'paper' },
    { role: 'ink', hex: '#7d7d7d', name: 'fog' },
  ]);
  assert.equal(r.failures.length, 1, 'a 4.1:1 text pair must not be proposable');
  assert.ok(r.failures[0].ratio < TEXT_MIN);
  assert.equal(r.failures[0].role, 'ink');
});

test('accent is held to the UI floor, not the text floor', () => {
  const r = checkPairings([
    { role: 'ground', hex: '#ffffff', name: 'paper' },
    { role: 'accent', hex: '#767676', name: 'steel' }, // ~4.54:1 — passes both
    { role: 'ink', hex: '#111111', name: 'soot' },
  ]);
  const accent = r.pairs.find((p) => p.role === 'accent');
  assert.equal(accent.min, UI_MIN);
  assert.ok(accent.ok);
});

test('a non-text role is skipped explicitly, and a skip is not a pass', () => {
  const r = checkPairings([
    { role: 'ground', hex: '#ffffff', name: 'paper' },
    { role: 'ink', hex: '#111111', name: 'soot' },
    { role: 'hairline', hex: '#eeeeee', name: 'thread' },
  ]);
  assert.ok(r.skipped.some((s) => s.role === 'hairline'));
  assert.ok(!r.pairs.some((p) => p.role === 'hairline'), 'a skip never enters the pass column');
});

// MUTANT 3 — an empty failures list is not, on its own, a green light.
test('MUTANT: an unparseable colour does not land in the pass column', () => {
  const r = checkPairings([
    { role: 'ground', hex: '#ffffff', name: 'paper' },
    { role: 'ink', hex: 'oklch(0.2 0 0)', name: 'soot' },
  ]);
  assert.equal(r.unparsed.length, 1);
  assert.equal(r.pairs.length, 0, 'nothing was measured, so nothing passed');
  assert.equal(r.ok, false, 'unmeasured is not green');
});

test('no ground means nothing can be measured, and it says so', () => {
  const r = checkPairings([{ role: 'ink', hex: '#111111', name: 'soot' }]);
  assert.equal(r.ok, false);
  assert.match(r.reason, /ground/);
});

// ── the projection `doctor` reports ──────────────────────────────────────────

test('summary: a record whose own palette fails is reported as failing, not as a candidate to offer', () => {
  const root = tmp();
  try {
    record(root, 'fog', {
      colors: [
        { role: 'ground', hex: '#ffffff', name: 'paper' },
        { role: 'ink', hex: '#7d7d7d', name: 'fog' }, // ~4.12:1
      ],
    });
    const r = startingPointSummary(tmp(), [root]);
    assert.equal(r.state, 'owned');
    assert.deepEqual(r.records, ['fog']);
    assert.match(r.contrast, /below its floor/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('summary: nothing owned reports `none` and carries the fix', () => {
  const root = tmp();
  try {
    const r = startingPointSummary(tmp(), [root]);
    assert.equal(r.state, 'none');
    assert.equal(r.contrast, 'no record to measure');
    assert.ok(r.fix);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('summary stays compact — a report field is paid by every user who runs doctor (P5)', () => {
  const root = tmp();
  try {
    record(root, 'night-shift');
    const r = startingPointSummary(tmp(), [root]);
    assert.ok(JSON.stringify(r).length < 400, `summary is ${JSON.stringify(r).length} bytes`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── the material itself ──────────────────────────────────────────────────────
// Two acceptance criteria are about the prose, and they are mechanical enough to check: the mapping
// must exist in exactly one place, and it must not offer as a candidate something the area's own
// trend record already marks as reading like a template.

const REPO = new URL('..', import.meta.url).pathname;
const MATERIAL = join(REPO, 'skills', 'design', 'references', 'starting-point.md');

test('the mapping lives in exactly one file (P5 — the area just paid down its duplication)', () => {
  const marker = 'which bar';
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      if (readFileSync(p, 'utf8').includes(marker)) hits.push(p);
    }
  };
  walk(join(REPO, 'skills'));
  assert.deepEqual(hits, [MATERIAL], `the mapping should exist once, found in: ${hits.join(', ')}`);
});

test('no candidate is something the area already marks as reading like a template', () => {
  const material = readFileSync(MATERIAL, 'utf8');
  // Lifted from trends-2026.md's "What now reads as dated / AI-generic (avoid)" section.
  const dated = ['glassmorphism', 'neumorphism', 'mesh gradient', 'blob background', 'aurora'];
  const table = material.slice(material.indexOf('| Building |'), material.indexOf('## 2.'));
  for (const term of dated) {
    assert.ok(
      !table.toLowerCase().includes(term),
      `"${term}" is on the dated list and must not be offered as a candidate bar`,
    );
  }
});

test('the material stays under its cap — it replaces prose, it does not add a chapter', () => {
  const lines = readFileSync(MATERIAL, 'utf8').split('\n').length;
  assert.ok(lines <= 100, `starting-point.md is ${lines} lines, cap is 100`);
});

test('every promise that used to be empty now points at the material', () => {
  const wired = [
    ['skills/design-loop/SKILL.md', 'starting-point.md'],
    ['skills/design/references/brand-grounding.md', 'starting-point.md'],
    ['skills/design/SKILL.md', 'starting-point.md'],
    ['skills/design-dna/SKILL.md', 'designStartingPoint'],
  ];
  for (const [file, needle] of wired) {
    const text = readFileSync(join(REPO, file), 'utf8');
    assert.ok(text.includes(needle), `${file} does not point at the starting point (${needle})`);
  }
});
