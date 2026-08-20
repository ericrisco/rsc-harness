import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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

// `rel` and `path` are DELIBERATELY different, as the CLI makes them (path = repo-relative,
// rel = wiki-relative). The first version set `rel: path`, so the single field distinction the
// index-row check rests on was invisible to every test: swapping the field survived the suite and
// took the real wiki from 7 candidates to 37 false ones.
const doc = (path, text, extra = {}) => ({
  path: `02-DOCS/wiki/${path}`,
  rel: path,
  dir: dirname(path) === '.' ? '' : dirname(path),
  text,
  indexable: false,
  ...extra,
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
  // NOT a deepEqual against NOT_LOOKED_AT: `diagnose` returns that very array, so the comparison was
  // an identity check dressed as a content check — unfailable by construction. Pin the content instead.
  assert.notEqual(r.notLookedAt.length, 0);
  const disclosed = r.notLookedAt.join(' | ');
  for (const must of ['75%', 'symlink', 'Contradicción general', 'memoria']) {
    assert.ok(disclosed.includes(must), `the disclosure must still name: ${must}`);
  }
  assert.ok(
    !disclosed.includes('define su propia ubicación como válida'),
    'the pre-fix mechanism must not be described as the current blind spot — that was a stale claim inside the stale-claim detector',
  );
});

// ----------------------------------------------------------------- against the real wiki

test('diagnose COMPOSES all four detectors — each one is pinned by its own candidate', () => {
  // The composition was unpinned: the only synthetic diagnose test asserted `scanned` and
  // `notLookedAt`, never `candidates`. Removing findMisplaced took the real wiki from 7 candidates to
  // 1, removing findStaleClaims silently deleted a whole class, and making it fabricate one candidate
  // per document reported 54 — all three with the suite green.
  const docs = [
    doc('sdd/specs/stale.md', fm({ type: 'spec', status: 'implementada (deadbee)' })),
    doc('harness/misplaced.md', fm({ type: 'verification' })),
    doc('sdd/verifications/a.md', fm({ type: 'verification' })),
    doc('sdd/verifications/b.md', fm({ type: 'verification' })),
    doc('sdd/verifications/c.md', fm({ type: 'verification' })),
    doc('harness/contra.md', fm({ description: 'encontrado diez veces' },
      'vive en esta tabla y en ningún otro sitio\n\n| a |\n|---|\n| 1 |\n')),
    doc('sdd/decisions.md', '# log\n\n## 2026-08-01 — sobre `un-slug-inexistente`\n\ntexto\n'),
  ];
  const r = diagnose({ docs, indexText: '# i', refExists: () => false });
  const classes = new Set(r.candidates.map((c) => c.cls));
  assert.ok(classes.has(CLASSES.STALE), 'findStaleClaims must reach the composed output');
  assert.ok(classes.has(CLASSES.MISPLACED), 'findMisplaced must reach the composed output');
  assert.ok(classes.has(CLASSES.CONTRADICTS), 'findContradictions must reach the composed output');
  assert.ok(
    r.candidates.some((c) => /decisions\.md/.test(c.path)),
    'findLogIntruders must reach the composed output',
  );
  // And it must not fabricate: no candidate may name a document that is not in the input.
  const known = new Set(docs.map((d) => d.path));
  for (const c of r.candidates) assert.ok(known.has(c.path), `invented a candidate for ${c.path}`);
});

test('diagnose stays SILENT on a clean input — no candidate per document', () => {
  // AC4 as a falsifiable procedure. A mutant that emits one candidate per doc reported 54 on the real
  // wiki and survived, because nothing asserted the empty case at the composed level.
  const docs = [
    doc('harness/a.md', fm({ type: 'article' })),
    doc('harness/b.md', fm({ type: 'article' })),
    doc('harness/c.md', fm({ type: 'article' })),
  ];
  const r = diagnose({ docs, indexText: '# i', refExists: () => true });
  assert.deepEqual(r.candidates, [], 'a clean input must produce nothing at all');
});

test('the index-row check needs the ROW, not the path mentioned in prose', () => {
  // "the path appears in the string" is not "the row exists" — the mistake this repo recorded as having
  // shipped twice in one day.
  const d = doc('sdd/specs/x.md', fm({ type: 'spec' }), { indexable: true });
  const conv = deriveConventions([d, doc('sdd/specs/y.md', fm({ type: 'spec' })), doc('sdd/specs/z.md', fm({ type: 'spec' }))]);
  const mentioned = findMisplaced({ doc: d, conventions: conv, indexText: '# map\n\nBorramos sdd/specs/x.md porque ya no aplica.\n' });
  assert.ok(
    mentioned.some((c) => /sin fila/.test(c.signal)),
    'a path mentioned as DELETED must not count as indexed',
  );
});

test('the over-firing thresholds are pinned in the LOOSENING direction too', () => {
  // They were pinned only against tightening: every mutant that made the tool NOISIER survived, which
  // is the direction the change claims to protect against (P7, v1.0.17).
  const twoDocs = [doc('brand/a.md', fm({ type: 'article' })), doc('brand/b.md', 'no frontmatter')];
  assert.equal(
    deriveConventions(twoDocs).typeRequiredDirs.has('brand'), false,
    'a 2-document directory is too small to have a frontmatter convention (MIN_DOCS_FOR_TYPE_RULE)',
  );
  const twoDeviants = [
    doc('sdd/specs/a.md', fm({ type: 'spec' })), doc('sdd/specs/b.md', fm({ type: 'spec' })),
    doc('sdd/specs/c.md', 'none'), doc('sdd/specs/d.md', 'none'),
  ];
  assert.equal(
    deriveConventions(twoDeviants).typeRequiredDirs.has('sdd/specs'), false,
    'two deviants means the convention is not universal — at most ONE may deviate',
  );
  const thin = [doc('x/a.md', fm({ type: 't' })), doc('x/b.md', fm({ type: 't' })), doc('y/c.md', fm({ type: 't' }))];
  assert.equal(
    deriveConventions(thin).dominantHome.has('t'), false,
    'a 2-in-A / 1-in-B type is 0.667 — below the dominant share, so nothing is out of place',
  );
});

test('a document with valid frontmatter but no type: is flagged where the convention is universal', () => {
  // This branch (the missing-`type:` one, distinct from unreadable frontmatter) had ZERO coverage:
  // gutting it survived the suite.
  const docs = [
    doc('sdd/specs/a.md', fm({ type: 'spec' })), doc('sdd/specs/b.md', fm({ type: 'spec' })),
    doc('sdd/specs/c.md', fm({ type: 'spec' })), doc('sdd/specs/d.md', fm({ title: 'sin tipo' })),
  ];
  const out = findMisplaced({ doc: docs[3], conventions: deriveConventions(docs), indexText: null });
  assert.equal(out.length, 1);
  assert.match(out[0].signal, /sin `type:`/);
});

test('on the real wiki: it does not fire on correct work, and STALE is genuinely silent', () => {
  // DECOUPLED from the live defect. The previous version REQUIRED the contradiction in
  // puertas-y-mecanismos.md to still exist, so curing the finding the report demands broke the suite —
  // a gate that punishes fixing what it detects. And it injected refExists:()=>true, which makes STALE
  // structurally incapable of firing, while its title claimed "and nothing stale".
  if (!existsSync(WIKI)) return; // 02-DOCS is untracked (P9); in CI there is nothing to read
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && p.endsWith('.md') ? [p] : [];
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
  // refExists REAL, not stubbed: this is the only place the git-facing half of class 1 can be exercised.
  const refExists = (ref) => {
    try { execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], { cwd: ROOT, stdio: 'ignore' }); return true; }
    catch { /* not a commit */ }
    try { execFileSync('git', ['cat-file', '-e', `refs/tags/${ref}`], { cwd: ROOT, stdio: 'ignore' }); return true; }
    catch { return false; }
  };
  const r = diagnose({
    docs, refExists,
    indexText: existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : null,
  });
  // The claim that CAN be asserted without depending on a defect persisting: no false fire on the
  // documents we know are correct.
  for (const noisy of ['sdd/plan.md', 'sdd/tasks.md', 'sdd/analyze.md', 'wiki/index.md']) {
    assert.ok(!r.candidates.some((c) => c.path.endsWith(noisy)), `must not flag ${noisy}`);
  }
  // And STALE really is silent — asserted, not implied by a stub. Every ref the wiki cites resolves.
  assert.deepEqual(
    r.candidates.filter((c) => c.cls === CLASSES.STALE), [],
    'every commit and tag the wiki cites should resolve; a failure here is real drift, not a test bug',
  );
});
