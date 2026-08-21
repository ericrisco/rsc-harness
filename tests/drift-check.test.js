// drift-check.test.js — tests for the drift checker, and for the catalog it guards.
//
// Two things are being tested, and the second is the one that rots: the mechanism, and the real
// artifacts that claim to satisfy it. `result-envelope.test.js` validated a contract's SHAPE
// against a synthetic object and passed for months while 5 of 10 real skills violated it — so
// the last tests here run against the actual catalog, not a fixture.
//
// The dangerous direction for this feature is the classifier going QUIET: every noise class is
// an excuse to skip a claim, and a detector that skips everything reports "all clear" forever.
// That is what the anti-swallow test exists for, and why one test asserts the checker still
// examines hundreds of claims rather than merely failing to complain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  stripFences, stripInlineCode, extractProseLinks, extractInlinePaths,
  classify, checkCatalog, checkKnowledge, memoryDir, scanTree, MissingRoot,
} from '../scripts/drift-check.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO, 'scripts', 'drift-check.js');

// Build a fixture repo: paths relative to the root, contents as given.
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-drift-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return root;
}
const targets = (r) => r.findings.map((f) => f.target).sort();

// ── extraction: code shows, prose points ─────────────────────────────────────────────────

test('drift-check: a broken link in prose is a finding, with document, line and target', () => {
  const root = tree({ 'skills/a/SKILL.md': '# A\n\nSee [the thing](./gone.md) for details.\n' });
  const r = checkCatalog({ root });
  assert.equal(r.findings.length, 1);
  assert.deepEqual(
    { doc: r.findings[0].doc, line: r.findings[0].line, target: r.findings[0].target },
    { doc: 'skills/a/SKILL.md', line: 3, target: './gone.md' },
  );
});

test('drift-check: the same link inside a fenced block is shown, not pointed at', () => {
  const root = tree({ 'skills/a/SKILL.md': '# A\n\n```markdown\nSee [the thing](./gone.md).\n```\n' });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('drift-check: the same link inside inline code is shown, not pointed at', () => {
  const root = tree({ 'skills/a/SKILL.md': '# A\n\nUse `[text](./gone.md)`, never wikilinks.\n' });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('drift-check: an unterminated fence swallows the rest of the file', () => {
  // A paired regex quietly declines to close at EOF, leaving example links looking like prose.
  const root = tree({ 'skills/a/SKILL.md': '# A\n\n```\n[x](./gone.md)\n[y](./also-gone.md)\n' });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('drift-check: ~~~ fences and longer fence runs are honored', () => {
  const root = tree({
    'skills/a/SKILL.md': '~~~\n[x](./gone.md)\n~~~\n\n````md\n[y](./gone2.md)\n````\n\n[real](./gone3.md)\n',
  });
  assert.deepEqual(targets(checkCatalog({ root })), ['./gone3.md'], 'only the prose link counts');
});

test('drift-check: an unbalanced backtick does NOT swallow the rest of the line', () => {
  // Swallowing it would hide a real link — a false negative, the failure mode that matters.
  const root = tree({ 'skills/a/SKILL.md': 'A stray ` backtick and then [real](./gone.md).\n' });
  assert.deepEqual(targets(checkCatalog({ root })), ['./gone.md']);
});

test('drift-check: strippers keep line numbers stable', () => {
  const text = 'one\n```\ntwo\n```\nfour `x` five\n';
  assert.equal(stripFences(text).split('\n').length, text.split('\n').length);
  assert.equal(stripInlineCode(text).split('\n').length, text.split('\n').length);
  assert.match(stripInlineCode('a `code` b'), /^a {8}b$/, 'offsets preserved too');
});

// ── classification ───────────────────────────────────────────────────────────────────────

test('drift-check: every noise class is skipped', () => {
  const root = tree({
    'skills/a/SKILL.md': [
      '[a](skills/<ID>/SKILL.md)',        // placeholder — a shape, not a path
      '[b](references/*.md)',             // placeholder
      '[c](02-DOCS/wiki/brand/voice.md)', // the installed user's project
      '[d](../../raw/brand/sample.md)',   // the installed user's project
      '[e](.rsc/sello.json)',             // born at runtime
      '[f](~/.rsc/sello-config.json)',    // runtime, home-relative
      '[g](scripts/rsc.js:80)',           // line anchor: the file exists, the line moves
      '[h](scripts/rsc.js#generatedHookFiles)',
    ].join('\n\n') + '\n',
  });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('drift-check: ANTI-SWALLOW — near-misses of each noise class stay real claims', () => {
  // The classifier going quiet is this feature's failure mode. Each of these LOOKS like a noise
  // class and is not one; every single one must survive classification and be reported.
  const root = tree({
    'skills/a/SKILL.md': [
      '[a](./.rsc-notes.md)',   // not `.rsc/` — a file whose name merely starts with .rsc
      '[b](./rawdata/x.md)',    // not `raw/`
      '[c](./02-DOCSX/y.md)',   // not `02-DOCS/`
      '[d](./notes.md)',        // plain and gone
    ].join('\n\n') + '\n',
  });
  assert.deepEqual(
    targets(checkCatalog({ root })),
    ['./.rsc-notes.md', './02-DOCSX/y.md', './notes.md', './rawdata/x.md'],
  );
});

test('drift-check: 02-DOCS is the user\'s project in catalog mode and a real claim in knowledge mode', () => {
  assert.equal(classify('02-DOCS/wiki/x.md', { mode: 'catalog' }), 'user-project');
  assert.equal(classify('02-DOCS/wiki/x.md', { mode: 'knowledge' }), 'real');
});

test('drift-check: a site route is not a missing file', () => {
  // Found by running the report on the real wiki: six mentions of `/llms.txt` (a URL path the
  // landing serves) were reported as broken files.
  assert.equal(classify('/llms.txt'), 'web-route');
  assert.equal(classify('/skills/'), 'web-route');
  assert.equal(classify('./llms.txt'), 'real', 'a document-relative path is still a claim');
});

test('drift-check: knowledge mode reads a generic per-skill path as a shape, not a location', () => {
  // The authoring standards say "every skill carries `evals/cases.yaml`" — a claim about 258
  // directories at once. Five findings came from reading it as one broken path.
  const root = tree({
    '02-DOCS/wiki/standard.md': 'Every skill carries `evals/cases.yaml` and `references/guide.md`.\n',
    'skills/alpha/evals/cases.yaml': 'x: 1\n',
  });
  assert.deepEqual(
    targets(checkKnowledge({ root, home: join(root, 'nohome') })),
    ['references/guide.md'],
    'the one that exists under some skill resolves; the one that exists nowhere is still reported',
  );
});

// ── resolution ───────────────────────────────────────────────────────────────────────────

test('drift-check: the wrong-depth bug is caught (the shape of both real ones)', () => {
  // skills/a/references/x.md linking `../b/SKILL.md` resolves to skills/a/b/SKILL.md — absent —
  // while the author meant `../../b/SKILL.md`. Exactly data-cleaning→duckdb and solid-js→vercel.
  const root = tree({
    'skills/a/references/x.md': 'See [b](../b/SKILL.md).\n',
    'skills/b/SKILL.md': '# B\n',
  });
  assert.deepEqual(targets(checkCatalog({ root })), ['../b/SKILL.md']);

  const fixed = tree({
    'skills/a/references/x.md': 'See [b](../../b/SKILL.md).\n',
    'skills/b/SKILL.md': '# B\n',
  });
  assert.deepEqual(checkCatalog({ root: fixed }).findings, []);
});

test('drift-check: catalog mode resolves ONLY from the document\'s directory', () => {
  // Being generous here (repo root as a fallback) would resolve `../b/SKILL.md` via some other
  // base and hide the wrong-depth bug. This asserts the strictness on purpose.
  const root = tree({
    'skills/a/references/x.md': 'See [b](skills/b/SKILL.md).\n',
    'skills/b/SKILL.md': '# B\n',
  });
  assert.deepEqual(targets(checkCatalog({ root })), ['skills/b/SKILL.md'],
    'a repo-root-relative link inside a skill doc does not resolve for a reader either');
});

test('drift-check: knowledge mode resolves shorthand against several bases', () => {
  const root = tree({
    '02-DOCS/wiki/a.md': 'See [x](orient/references/x.md) and [y](scripts/y.js).\n',
    'skills/orient/references/x.md': '# x\n',
    'scripts/y.js': '// y\n',
  });
  const r = checkKnowledge({ root, home: join(root, 'nohome') });
  assert.deepEqual(r.findings, [], 'shorthand into skills/ and repo-root paths both resolve');
});

test('drift-check: knowledge mode also reads paths asserted in inline code', () => {
  // The wiki's worst finding lived in backticks: a plan marked "implementada" naming three
  // files that never existed. Prose-links-only extraction would have missed it entirely.
  const root = tree({ '02-DOCS/wiki/plan.md': 'Shipped as `targets/lib/once.mjs` and `tests/once.test.js`.\n' });
  const r = checkKnowledge({ root, home: join(root, 'nohome') });
  assert.deepEqual(targets(r), ['targets/lib/once.mjs', 'tests/once.test.js']);
  assert.ok(r.findings.every((f) => f.kind === 'inline'));
});

test('drift-check: inline extraction ignores bare filenames and prose in backticks', () => {
  const root = tree({ '02-DOCS/wiki/a.md': 'Run `npm test`, edit `README.md`, see `some words here`.\n' });
  assert.deepEqual(checkKnowledge({ root, home: join(root, 'nohome') }).findings, [],
    'a mention without a directory is not a location claim');
});

test('drift-check: the auto-memory path is derived from HOME, never hardcoded', () => {
  const d = memoryDir('/a/b/c', '/home/someone');
  assert.equal(d, '/home/someone/.claude/projects/-a-b-c/memory');
  // P9 is a property of the source: this file ships in a public npm package.
  const src = readFileSync(join(REPO, 'scripts', 'drift-check.js'), 'utf8');
  assert.doesNotMatch(src, /\/Users\/[a-z]/i, 'no machine-local absolute path in shipped code');
});

test('drift-check: a knowledge tree that is present is scanned; both absent is not a failure', () => {
  const withMem = tree({ 'x.md': '# x\n' });
  mkdirSync(join(withMem, 'home', '.claude', 'projects', String(withMem).replace(/\//g, '-'), 'memory'), { recursive: true });
  writeFileSync(join(withMem, 'home', '.claude', 'projects', String(withMem).replace(/\//g, '-'), 'memory', 'm.md'), 'See `scripts/gone.js`.\n');
  const r = checkKnowledge({ root: withMem, home: join(withMem, 'home') });
  assert.deepEqual(r.trees, ['memory'], 'no wiki here, so only the memory tree');
  assert.deepEqual(targets(r), ['scripts/gone.js']);

  const bare = tree({ 'x.md': '# x\n' });
  assert.throws(() => checkKnowledge({ root: bare, home: join(bare, 'nohome') }), MissingRoot);
});

// ── the mechanism never writes ───────────────────────────────────────────────────────────

test('drift-check: no input artifact is modified by a run', () => {
  const root = tree({
    'skills/a/SKILL.md': 'See [x](./gone.md).\n',
    'skills/a/references/r.md': '# r\n',
    '02-DOCS/wiki/w.md': 'See `scripts/gone.js`.\n',
  });
  const hash = (dir) => {
    const h = createHash('sha256');
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else h.update(p.slice(root.length)).update(readFileSync(p));
      }
    };
    walk(dir);
    return h.digest('hex');
  };
  const before = hash(root);
  checkCatalog({ root });
  checkKnowledge({ root, home: join(root, 'nohome') });
  assert.equal(hash(root), before, 'the input is never mutated — the output is a proposal');
});

// ── CLI contract ─────────────────────────────────────────────────────────────────────────

// The CLI resolves its repo root from its own location, so a fixture run means copying the
// script into the fixture's scripts/ — the same trick tests/eval-lint.test.js uses.
function cliIn(files) {
  const root = tree(files);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'drift-check.js'), readFileSync(CLI));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}\n');
  return {
    root,
    run: (...args) => spawnSync('node', [join(root, 'scripts', 'drift-check.js'), ...args], { encoding: 'utf8' }),
  };
}

test('drift-check CLI: exits 1 on findings and prints the recovery action', () => {
  // P6: a denial without its exit is abandonment. The second clause matters as much as the
  // first — an example link is fixed by putting it in code, and that is the rule, not a loophole.
  const { run } = cliIn({ 'skills/a/SKILL.md': 'See [x](./gone.md).\n' });
  const r = run();
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /FAIL: 1 link\(s\) do not resolve/);
  assert.match(r.stdout, /skills\/a\/SKILL\.md:1\s+→\s+\.\/gone\.md/);
  assert.match(r.stdout, /Recover: fix the link/);
  assert.match(r.stdout, /backticks or a fenced block/, 'the escape for examples is stated');
});

test('drift-check CLI: exits 0 and says PASS when every prose link resolves', () => {
  const { run } = cliIn({ 'skills/a/SKILL.md': 'See [x](./there.md).\n', 'skills/a/there.md': '# t\n' });
  const r = run();
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /RESULT: PASS/);
});

test('drift-check CLI: the real catalog passes', () => {
  const r = spawnSync('node', [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /RESULT: PASS/);
});

test('drift-check CLI: a missing catalog exits 2 and never reports PASS', () => {
  // Silence caused by failure must not be indistinguishable from silence caused by success —
  // that is the decorative-gate pattern in its purest form.
  const { run } = cliIn({ 'readme.md': '# nothing here\n' });
  const r = run();
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /no catalog to check/);
  assert.match(r.stderr, /Recover:/);
  assert.doesNotMatch(r.stdout, /PASS/);
});

test('drift-check CLI: --knowledge reports without blocking', () => {
  const { run } = cliIn({ '02-DOCS/wiki/w.md': 'Shipped as `scripts/gone.js`.\n' });
  const r = run('--knowledge');
  assert.equal(r.status, 0, 'advisory: findings never fail the run');
  assert.match(r.stdout, /scripts\/gone\.js/);
  assert.match(r.stdout, /advisory, nothing is blocked/);
});

// ── the real artifacts ───────────────────────────────────────────────────────────────────

test('drift-check: every prose link in the shipped catalog resolves', () => {
  // Regression guard for the two wrong-depth bugs that shipped (data-cleaning→duckdb,
  // solid-js→vercel) and the template block that was prose instead of code.
  const r = checkCatalog({ root: REPO });
  assert.deepEqual(r.findings.map((f) => `${f.doc}:${f.line} → ${f.target}`), []);
});

test('drift-check: the catalog check actually examines the catalog', () => {
  // Without this, a refactor that broke extraction would make the test above pass over nothing —
  // green because it stopped looking. Measured at 812 when written; the floor leaves room to
  // remove content without tripping, but not to silently stop scanning.
  const r = checkCatalog({ root: REPO });
  assert.ok(r.claims > 700, `expected >700 prose link claims in the catalog, got ${r.claims}`);
});

test('drift-check: scanTree reports how much it skipped, so silence stays auditable', () => {
  const root = tree({ 'skills/a/SKILL.md': '[a](skills/<ID>/x.md)\n\n[b](./real.md)\n', 'skills/a/real.md': '# r\n' });
  const r = scanTree(join(root, 'skills'), { mode: 'catalog', root });
  assert.equal(r.skipped, 1);
  assert.equal(r.claims, 1);
  assert.deepEqual(r.findings, []);
});

test('drift-check: extraction helpers are exported and behave in isolation', () => {
  assert.deepEqual(extractProseLinks('[a](./x.md)').map((c) => c.target), ['./x.md']);
  assert.deepEqual(extractProseLinks('`[a](./x.md)`'), []);
  assert.deepEqual(extractInlinePaths('`scripts/a.js`').map((c) => c.target), ['scripts/a.js']);
  assert.deepEqual(extractInlinePaths('```\n`scripts/a.js`\n```'), [], 'fences win over inline');
});

// ── case sensitivity ─────────────────────────────────────────────────────────────────────
// The gate failed OPEN on the maintainer's own machine. `existsSync` is case-insensitive on
// APFS/HFS+, so a link to `AUDIT.md` resolved against a file named `audit.md` and drift-check said
// PASS locally while Linux CI said FAIL. It happened for real: the motion-craft port moved skill
// references into references/, one link kept the old casing, local was green, CI caught it.
//
// These tests must be able to FAIL on macOS, which is the whole point — a test that only proves
// the fix on Linux proves it where the bug never was.
// Spec: 02-DOCS/wiki/sdd/specs/drift-check-case.md
test('a link that differs from the real file only in case does NOT resolve', () => {
  const root = tree({
    'skills/a/SKILL.md': 'Pull the values from [AUDIT.md](AUDIT.md).\n',
    'skills/a/audit.md': '# the real file, lowercase\n',
  });
  const r = checkCatalog({ root });
  assert.deepEqual(
    r.findings.map((f) => `${f.doc} → ${f.target}`),
    ['skills/a/SKILL.md → AUDIT.md'],
    'a case-mismatched link resolved — the gate is failing open on this filesystem',
  );
});

test('the same link with exact casing resolves', () => {
  // The other half: a checker that reports everything is as useless as one that reports nothing.
  const root = tree({
    'skills/a/SKILL.md': 'Pull the values from [audit.md](audit.md).\n',
    'skills/a/audit.md': '# the real file, lowercase\n',
  });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('a miscased DIRECTORY segment does not resolve either', () => {
  // The basename is not the only place case can drift. Checking only the last segment would let
  // `References/audit.md` through on macOS.
  const root = tree({
    'skills/a/SKILL.md': 'See [it](References/audit.md).\n',
    'skills/a/references/audit.md': '# real\n',
  });
  assert.deepEqual(
    checkCatalog({ root }).findings.map((f) => f.target),
    ['References/audit.md'],
  );
});

test('a link that climbs out of its own directory still resolves when the case is exact', () => {
  // `../sibling/SKILL.md` is the single most common shape in this catalog. If the exactness walk
  // broke on `..`, hundreds of real links would turn into findings.
  const root = tree({
    'skills/a/SKILL.md': 'Hand off to [sibling](../b/SKILL.md).\n',
    'skills/b/SKILL.md': '# sibling\n',
  });
  assert.deepEqual(checkCatalog({ root }).findings, []);
});

test('a miscased link is caught even when it climbs out of its own directory', () => {
  const root = tree({
    'skills/a/SKILL.md': 'Hand off to [sibling](../B/SKILL.md).\n',
    'skills/b/SKILL.md': '# sibling\n',
  });
  assert.deepEqual(checkCatalog({ root }).findings.map((f) => f.target), ['../B/SKILL.md']);
});

test('the real catalog does not depend on case-insensitive resolution', () => {
  // Measured before the change: 0 of 1117 markdown files in the catalog resolved a link only
  // because macOS ignores case. This pins that, so the hardening cannot silently start reporting
  // pre-existing links as broken.
  assert.deepEqual(checkCatalog({ root: REPO }).findings, []);
});
