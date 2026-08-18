import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeProse, parseFrontmatter, declaresSingleSource, statedCountInFrontmatter,
  firstTableRowCount, findStaleClaims, findMisplaced, findContradictions, deriveConventions,
  rank, diagnose, CLASSES, SEVERITY_ORDER, NOT_LOOKED_AT,
} from '../scripts/lib/knowledge-doctor.js';

// drift-check asks whether the path a document names exists. Nothing asked whether what it CLAIMS
// still holds, and on 2026-08-18 three stale claims were found by hand while drift-check passed green.
// Spec: 02-DOCS/wiki/sdd/specs/knowledge-doctor.md
//
// EVERY detector is tested in BOTH directions — it flags its known-bad input AND it does not flag its
// known-good one. That symmetry is the rule shipped in v1.0.17, and it exists because its absence let
// an over-blocking gate reach production twice in one day. Half of these tests look redundant and are
// the half that matters.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WIKI = join(ROOT, '02-DOCS', 'wiki');

const doc = (path, text, extra = {}) => ({
  path, rel: path, dir: dirname(path) === '.' ? '' : dirname(path), text, indexable: false, ...extra,
});
const fm = (fields, body = '') =>
  `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`;

// ----------------------------------------------------------------- prose normalization

test('normalizeProse survives the hard wrap that defeated three previous matches', () => {
  // The real declaration in this repo's pattern registry is wrapped mid-phrase. A line-based match
  // loses it — third time in one day that hard wrapping beat a prose match.
  const wrapped = 'el número de apariciones vive **en esta tabla y en\nningún otro sitio**.';
  assert.equal(declaresSingleSource(wrapped), true, 'wrapped declaration must still match');
  assert.match(normalizeProse(wrapped), /en esta tabla y en ningún otro sitio/);
});

test('declaresSingleSource is false for an ordinary document', () => {
  assert.equal(declaresSingleSource('un artículo normal que no declara nada'), false);
});

// ----------------------------------------------------------------- frontmatter

test('parseFrontmatter reads fields, and reports unreadable rather than guessing', () => {
  const ok = parseFrontmatter(fm({ type: 'spec', title: 'X' }, 'body'));
  assert.equal(ok.ok, true);
  assert.equal(ok.fields.type, 'spec');
  assert.equal(parseFrontmatter('no frontmatter here').ok, false);
  assert.equal(parseFrontmatter('---\ntype: x\nnever closed').ok, false);
  assert.match(parseFrontmatter('---\ntype: x').reason, /sin cierre/);
});

// ----------------------------------------------------------------- counts and tables

test('a count is read from the frontmatter only, never from body prose', () => {
  // The live case's own document contains "7 veces" inside a table cell about something else.
  const f = parseFrontmatter(fm({ description: 'encontrado diez veces en este repo' },
    '| a | b |\n|---|---|\n| leyó 7 veces | x |\n')).fields;
  const stated = statedCountInFrontmatter(f);
  assert.equal(stated.value, 10, 'word numbers must be understood');
  assert.equal(stated.source, 'description');
  assert.equal(statedCountInFrontmatter({ description: 'encontrado 12 veces' }).value, 12);
  assert.equal(statedCountInFrontmatter({ description: 'sin cifras' }), null);
});

test('firstTableRowCount counts data rows and demands a separator', () => {
  assert.equal(firstTableRowCount('| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n').rows, 2);
  assert.equal(firstTableRowCount('| a | b |\n| 1 | 2 |\n'), null, 'no separator = not a table');
  assert.equal(firstTableRowCount('sin tablas'), null);
});

// ----------------------------------------------------------------- class 1: stale claims

test('STALE flags a status citing a ref that does not exist', () => {
  const c = findStaleClaims({
    path: 'p.md', text: fm({ status: 'implementada (PR #1 → deadbee, v9.9.9)' }),
    refExists: () => false,
  });
  assert.ok(c.length >= 2, 'both the sha and the version are refs');
  assert.equal(c[0].cls, CLASSES.STALE);
  assert.match(c[0].signal, /no existe/);
});

test('STALE does NOT flag a status whose refs all exist — the positive control', () => {
  const c = findStaleClaims({
    path: 'p.md', text: fm({ status: 'implementada (c384ff5, v1.0.13)' }), refExists: () => true,
  });
  assert.deepEqual(c, []);
});

test('STALE says nothing when there is no status at all', () => {
  assert.deepEqual(findStaleClaims({ path: 'p.md', text: fm({ type: 'article' }), refExists: () => false }), []);
});

// ----------------------------------------------------------------- class 2: misplaced

const conventionsFrom = (docs) => deriveConventions(docs);

test('MISPLACED flags a type living outside every directory that type is seen in', () => {
  // A single instance must never establish its own directory as a valid home: the first version of
  // this rule was dead code because the anomaly added itself to the set of homes.
  const docs = [
    doc('sdd/verifications/a.md', fm({ type: 'verification' })),
    doc('sdd/verifications/b.md', fm({ type: 'verification' })),
    doc('sdd/verifications/c.md', fm({ type: 'verification' })),
    doc('harness/d.md', fm({ type: 'verification' })),
  ];
  const out = findMisplaced({ doc: docs[3], conventions: conventionsFrom(docs), indexText: null });
  assert.equal(out.length, 1);
  assert.match(out[0].signal, /type: verification/);
  // Phrased as an inconsistency: the detector cannot know which side should yield.
  assert.match(out[0].found, /decide tú/);
  assert.equal(out[0].uncertain, true);
});

test('MISPLACED does NOT flag a type in a directory that type genuinely lives in', () => {
  const docs = [doc('sdd/specs/a.md', fm({ type: 'spec' })), doc('sdd/specs/b.md', fm({ type: 'spec' }))];
  assert.deepEqual(findMisplaced({ doc: docs[0], conventions: conventionsFrom(docs), indexText: null }), []);
});

test('REGRESSION: no frontmatter is only a candidate where every sibling has one', () => {
  // The first real run flagged 8 documents that legitimately have none — the SDD phase standards,
  // decisions.md, index.md. 8 of 15 candidates were noise about correct work: the 1.0.14 failure
  // repeating. The bug was applying the derived narrowing to one branch and not the other.
  const mixed = [
    doc('sdd/plan.md', 'no frontmatter'),
    doc('sdd/tasks.md', 'no frontmatter'),
    doc('sdd/analyze.md', 'no frontmatter'),
    doc('sdd/constitution.md', fm({ type: 'constitution' })),
  ];
  const conv = conventionsFrom(mixed);
  assert.deepEqual(
    findMisplaced({ doc: mixed[0], conventions: conv, indexText: null }), [],
    'a directory where frontmatter is not universal must stay silent',
  );

  // At most ONE deviant, so the deviant cannot veto the rule simply by existing.
  const strict = [
    doc('sdd/specs/a.md', fm({ type: 'spec' })),
    doc('sdd/specs/b.md', fm({ type: 'spec' })),
    doc('sdd/specs/d.md', fm({ type: 'spec' })),
    doc('sdd/specs/c.md', 'no frontmatter'),
  ];
  const out = findMisplaced({ doc: strict[3], conventions: conventionsFrom(strict), indexText: null });
  assert.equal(out.length, 1, 'where every sibling has frontmatter, its absence is a candidate');
  assert.match(out[0].signal, /todos los demás/);
});

test('a type with NO dominant home is never judged — the over-firing control', () => {
  // `article` genuinely lives in brand/, harness/ and stack/. Without the corroboration threshold every
  // type would get a "home" (whichever dir happens to hold most) and the minority dirs would all be
  // flagged — noise about correct work, on day one. Mutant M6 survived until this test existed.
  const spread = [
    doc('brand/a.md', fm({ type: 'article' })),
    doc('brand/b.md', fm({ type: 'article' })),
    doc('harness/c.md', fm({ type: 'article' })),
    doc('stack/d.md', fm({ type: 'article' })),
  ];
  const conv = conventionsFrom(spread);
  assert.equal(conv.dominantHome.has('article'), false, 'an evenly spread type has no home to be outside of');
  for (const d of spread) {
    assert.deepEqual(findMisplaced({ doc: d, conventions: conv, indexText: null }), [],
      `${d.path} must stay silent — it is where it belongs`);
  }
});

test('MISPLACED flags an indexable artifact with no row, and not a non-indexable one', () => {
  const d = doc('sdd/specs/x.plan.md', fm({ type: 'plan' }), { indexable: true });
  const conv = conventionsFrom([d, doc('sdd/specs/y.md', fm({ type: 'plan' })), doc('sdd/specs/z.md', fm({ type: 'plan' }))]);
  assert.ok(findMisplaced({ doc: d, conventions: conv, indexText: '# index\n' })
    .some((c) => /sin fila/.test(c.signal)));
  assert.ok(!findMisplaced({ doc: d, conventions: conv, indexText: '- [x](sdd/specs/x.plan.md) row' })
    .some((c) => /sin fila/.test(c.signal)), 'a present row must silence it');
  const article = doc('harness/a.md', fm({ type: 'article' }));
  assert.ok(!findMisplaced({ doc: article, conventions: conventionsFrom([article]), indexText: '# index' })
    .some((c) => /sin fila/.test(c.signal)), 'articles are not expected in the map');
});

// ----------------------------------------------------------------- class 3: contradictions

test('CONTRADICTS flags a frontmatter count against its declared single-source table', () => {
  const text = fm({ description: 'encontrado diez veces' },
    'vive **en esta tabla y en\nningún otro sitio**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |\n');
  const c = findContradictions({ path: 'p.md', text });
  assert.equal(c.length, 1);
  assert.equal(c[0].cls, CLASSES.CONTRADICTS);
  assert.match(c[0].expected, /3/);
  assert.match(c[0].found, /10/);
});

test('CONTRADICTS does NOT flag when the count matches — the positive control', () => {
  const text = fm({ description: 'encontrado dos veces' },
    'en ningún otro sitio\n\n| a |\n|---|\n| 1 |\n| 2 |\n');
  assert.deepEqual(findContradictions({ path: 'p.md', text }), []);
});

test('CONTRADICTS stays out of documents that do not declare single-sourcehood', () => {
  const text = fm({ description: 'encontrado diez veces' }, '| a |\n|---|\n| 1 |\n');
  assert.deepEqual(findContradictions({ path: 'p.md', text }), [],
    'without a declared single source this is out of scope by clarify');
});

// ----------------------------------------------------------------- ranking & wiring

test('rank puts what another process consumes first', () => {
  const ranked = rank([
    { path: 'x/brand/a.md', cls: CLASSES.MISPLACED },
    { path: 'x/sdd/specs/b.md', cls: CLASSES.MISPLACED },
  ]);
  assert.match(ranked[0].path, /sdd\/specs/);
  assert.equal(SEVERITY_ORDER[0], 'sdd/specs');
});

test('diagnose composes the three detectors and reports what it did not look at', () => {
  const r = diagnose({ docs: [doc('harness/a.md', fm({ type: 'article' }))], indexText: '# i', refExists: () => true });
  assert.equal(r.scanned, 1);
  assert.ok(r.notLookedAt.length >= 4);
  assert.ok(r.notLookedAt.some((n) => n.startsWith('La PRIMERA instancia')),
    'the derived-convention blind spot must be declared verbatim, not hidden or mangled');
  assert.deepEqual(r.notLookedAt, NOT_LOOKED_AT, 'the disclosure list must reach the report intact');
});

// ----------------------------------------------------------------- against the real wiki

test('on the real wiki: finds the live contradiction and nothing stale', () => {
  if (!existsSync(WIKI)) return; // public checkout has no 02-DOCS (P9) — nothing to assert
  const walk = (d) => readdirSync(d).flatMap((e) => {
    const p = join(d, e);
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.md') ? [p] : []);
  });
  const docs = walk(WIKI).map((p) => {
    const rel = relative(WIKI, p);
    return {
      path: relative(ROOT, p), rel, dir: dirname(rel) === '.' ? '' : dirname(rel),
      text: readFileSync(p, 'utf8'),
      indexable: rel.startsWith('sdd/specs/') || rel.startsWith('sdd/verifications/'),
    };
  });
  const indexPath = join(WIKI, 'index.md');
  const r = diagnose({
    docs, refExists: () => true,
    indexText: existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null,
  });
  const contradictions = r.candidates.filter((c) => c.cls === CLASSES.CONTRADICTS);
  assert.ok(
    contradictions.some((c) => /puertas-y-mecanismos/.test(c.path)),
    'the live stale counter must be found — it is why this exists',
  );
  // Over-firing check on real data: none of the phase standards may appear.
  for (const noisy of ['sdd/plan.md', 'sdd/tasks.md', 'sdd/analyze.md', 'wiki/index.md']) {
    assert.ok(!r.candidates.some((c) => c.path.endsWith(noisy)), `must not flag ${noisy}`);
  }
});
