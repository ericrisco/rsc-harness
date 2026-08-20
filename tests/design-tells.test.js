import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// The `design` skill taught principles and checked six things, and NONE of those six had a test:
// verify.sh only appeared sideways in gate-honesty*.test.js. So this file does two jobs.
//
//  1. It makes the tell corpus a REGISTRY instead of a pile of `if` blocks, and then proves the
//     registry: every row is iterated from here, and a row without a fixture fails the suite. That
//     is the only way "we check eight tells" stops being a claim (P1 + P2).
//  2. It closes the pre-existing debt: the four judgement-shaped checks that cannot be table rows
//     get a nominal test each, so the count of tested gates goes from zero to all of them.
//
// Coverage, said honestly: 8 generically-iterated table rows + 3 counters + 4 pre-existing
// functions. They are NOT covered by the same mechanism, and pretending otherwise would be the
// decorative-gate pattern this repo has paid for eight times.
//
// Spec: 02-DOCS/wiki/sdd/specs/design-tells.md · Plan: design-tells.plan.md
const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(HERE, '..', 'skills', 'design', 'scripts', 'verify.sh');
const SKILL = join(HERE, '..', 'skills', 'design', 'SKILL.md');
const TELLS_REF = join(HERE, '..', 'skills', 'design', 'references', 'ai-tells.md');
const FIXTURES = join(HERE, 'fixtures', 'design-tells');

// The description is paid on every turn whether the skill fires or not, so it is the one number
// this delivery is not allowed to grow (spec §Acceptance 12, constitution P5).
const DESCRIPTION_BYTES_BEFORE = 397;

const read = (p) => readFileSync(p, 'utf8');
const tmp = (p) => mkdtempSync(join(tmpdir(), `dt-${p}-`));

// Never hit a real dev server: 127.0.0.1:1 is guaranteed refused, so Lighthouse always skips.
function runVerify(cwd, { forceGrep = false } = {}) {
  const env = { ...process.env, NO_COLOR: '1', TERM: 'dumb' };
  if (forceGrep) env.VERIFY_FORCE_GREP = '1';
  try {
    return execFileSync('bash', [VERIFY, '--url', 'http://127.0.0.1:1'], {
      cwd, env, encoding: 'utf8', timeout: 60_000,
    });
  } catch (err) {
    // A non-zero exit is legitimate here (--strict, or a real fail); the output is what we assert on.
    if (err.stdout != null) return err.stdout;
    throw err;
  }
}

// ------------------------------------------------------------------ the registry itself

// Contract from the plan §3: a parser that returns [] when the table is gone would turn deleting
// every row into a green suite. It throws instead. This is the M9 lesson from refuter-agent.
function parseTellTable(src) {
  const m = src.match(/tell_table\(\)\s*\{\s*cat <<'TELLS'\n([\s\S]*?)\nTELLS/);
  if (!m) throw new Error('TELL_TABLE not found in verify.sh — the registry is gone, not empty');
  const rows = m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((line) => {
      const [id, sev, globs, pattern, message] = line.split('%%');
      return { id, sev, globs, pattern, message, line };
    });
  if (rows.length === 0) throw new Error('TELL_TABLE parsed to zero rows — a registry with no rows checks nothing');
  return rows;
}

test('the tell registry exists, parses, and every field is filled', () => {
  const rows = parseTellTable(read(VERIFY));
  assert.ok(rows.length >= 8, `expected at least 8 tell rows, got ${rows.length}`);
  const ids = new Set();
  for (const r of rows) {
    for (const field of ['id', 'sev', 'globs', 'pattern', 'message']) {
      assert.ok(r[field] && r[field].length > 0, `row "${r.line}" has an empty ${field}`);
    }
    assert.match(r.id, /^[a-z0-9-]+$/, `id must be kebab-case: ${r.id}`);
    assert.equal(r.sev, 'warn', `${r.id}: every tell warns, none fails (constitution P7)`);
    assert.ok(!ids.has(r.id), `duplicate row id: ${r.id}`);
    ids.add(r.id);
  }
});

test('a parser that goes quiet when the registry disappears is not a parser', () => {
  assert.throws(() => parseTellTable('nothing here'), /registry is gone/);
  assert.throws(
    () => parseTellTable("tell_table() {\n  cat <<'TELLS'\n# only a comment\nTELLS"),
    /checks nothing/,
  );
});

test('every message says what to do instead, or names the legitimate exception (P6)', () => {
  for (const r of parseTellTable(read(VERIFY))) {
    assert.ok(
      /use |prefer |replace |instead|legit|only when|exception/i.test(r.message),
      `${r.id}: a warning with no way out is abandonment, not safety: "${r.message}"`,
    );
  }
});

test('the ERE patterns stay POSIX — no lookahead, no \\b, no \\s', () => {
  for (const r of parseTellTable(read(VERIFY))) {
    assert.ok(!/\(\?[=!<]/.test(r.pattern), `${r.id}: lookahead is PCRE, grep -E will not honour it`);
    assert.ok(!/\\b|\\s|\\d|\\w/.test(r.pattern), `${r.id}: \\b/\\s/\\d/\\w are not portable ERE`);
  }
});

// ------------------------------------------------------- one fixture per row, both engines

test('every registry row has a fixture and fires on it — under ripgrep AND under grep', () => {
  const rows = parseTellTable(read(VERIFY));
  for (const r of rows) {
    const fixture = join(FIXTURES, 'tells', `${r.id}.tsx`);
    assert.ok(
      existsSync(fixture),
      `row "${r.id}" has no fixture at tests/fixtures/design-tells/tells/${r.id}.tsx — ` +
        'a check nobody has ever seen fire is decorative',
    );
    for (const forceGrep of [false, true]) {
      const dir = tmp(r.id);
      copyFileSync(fixture, join(dir, `${r.id}.tsx`));
      const out = runVerify(dir, { forceGrep });
      const engine = forceGrep ? 'grep' : 'ripgrep';
      assert.match(out, /\[warn\]/, `${r.id} (${engine}): no warning at all`);
      assert.ok(
        out.includes(`${r.id}:`),
        `${r.id} (${engine}): the warning must name the row id. Got:\n${out}`,
      );
    }
  }
});

test('the multibyte rows really do fire under both engines', () => {
  // The risk the plan ranked #1: `—` and `·` are UTF-8, and rg and macOS grep -E do not agree
  // about them. If either engine goes silent here, two of the flagship checks are theatre.
  for (const id of ['em-dash', 'middot-chain']) {
    for (const forceGrep of [false, true]) {
      const dir = tmp(id);
      copyFileSync(join(FIXTURES, 'tells', `${id}.tsx`), join(dir, `${id}.tsx`));
      const out = runVerify(dir, { forceGrep });
      assert.ok(out.includes(`${id}:`), `${id} silent under ${forceGrep ? 'grep' : 'rg'}`);
    }
  }
});

test('the negative control stays silent: URLs, viewBoxes and commented dashes are not tells', () => {
  // Found by reading a real run over this repo, not by reasoning: `w3.org/2000/svg` matched the
  // numbered-eyebrow pattern, and `/* tokens — lifted */` matched the dash row. Both were noise,
  // and noise is how a checker gets switched off.
  for (const forceGrep of [false, true]) {
    const dir = tmp('negative');
    copyFileSync(join(FIXTURES, 'negative', 'urls-and-comments.tsx'), join(dir, 'mark.tsx'));
    const out = runVerify(dir, { forceGrep });
    assert.doesNotMatch(out, /\[warn\]/, `negative control fired under ${forceGrep ? 'grep' : 'rg'}:\n${out}`);
  }
});

test('the clean control page raises nothing — zero new noise', () => {
  for (const forceGrep of [false, true]) {
    const dir = tmp('clean');
    copyFileSync(join(FIXTURES, 'clean', 'page.tsx'), join(dir, 'page.tsx'));
    const out = runVerify(dir, { forceGrep });
    assert.doesNotMatch(out, /\[warn\]/, `clean page warned under ${forceGrep ? 'grep' : 'rg'}:\n${out}`);
  }
});

// ------------------------------------------------------------------ the counters

test('the eyebrow ceiling warns with BOTH numbers, not just a verdict', () => {
  const dir = tmp('eyebrow');
  copyFileSync(join(FIXTURES, 'counters', 'eyebrow-ceiling.tsx'), join(dir, 'page.tsx'));
  const out = runVerify(dir);
  assert.match(out, /eyebrow/i, `no eyebrow warning:\n${out}`);
  assert.match(out, /3[^\n]*1|1[^\n]*3/, `the warning must print count and ceiling:\n${out}`);
});

test('no determinable section count means SKIP, never a guessed denominator', () => {
  const dir = tmp('nodenom');
  // Three eyebrows, zero sections: the ratio has no denominator.
  writeFileSync(
    join(dir, 'frag.tsx'),
    ['<p className="text-xs uppercase tracking-wide">One</p>',
     '<p className="text-xs uppercase tracking-wide">Two</p>',
     '<p className="text-xs uppercase tracking-wide">Three</p>'].join('\n'),
  );
  const out = runVerify(dir);
  assert.doesNotMatch(out, /\[warn\][^\n]*eyebrow/i, `guessed a denominator instead of skipping:\n${out}`);
  assert.match(out, /\[skip\][^\n]*eyebrow/i, `the skip must be said out loud:\n${out}`);
});

test('a spec list with a border on both sides of every row is flagged', () => {
  const dir = tmp('borders');
  copyFileSync(join(FIXTURES, 'counters', 'double-border-rows.tsx'), join(dir, 'spec.tsx'));
  assert.match(runVerify(dir), /\[warn\][^\n]*border/i);
});

test('mixing radius systems is flagged, and the accent lock is NOT claimed checkable', () => {
  const dir = tmp('radius');
  copyFileSync(join(FIXTURES, 'counters', 'radius-systems.tsx'), join(dir, 'mixed.tsx'));
  assert.match(runVerify(dir), /\[warn\][^\n]*radius/i);

  // Clarification 8: counting "two accents" needs to know WHICH token is the accent, which is
  // judgement. Declaring it machine-checked would build the exact gate this repo keeps paying for.
  const src = read(VERIFY);
  assert.ok(!/accent/i.test(src), 'verify.sh must not claim to check accent consistency');
});

// ------------------------------------------- the four pre-existing checks, finally under test

test('the four judgement-shaped pre-existing checks each fire on a nominal case', () => {
  const cases = [
    ['two-h1.tsx', '<h1>One</h1>\n<h1>Two</h1>', /multiple <h1>/i],
    ['no-alt.tsx', '<img src="/a.png" width="10" height="10" />', /without alt/i],
    ['hex.css', '@theme {\n  --color-bg: oklch(1 0 0);\n}\n.x { color: #ff00aa; }', /hardcoded hex/i],
    ['motion.css', '@keyframes spin { from { rotate: 0deg; } }', /prefers-reduced-motion/i],
  ];
  for (const [name, body, expected] of cases) {
    const dir = tmp('pre');
    // The hex check only arms itself when a token system exists, so keep each case self-contained.
    writeFileSync(join(dir, name), body);
    const out = runVerify(dir);
    assert.match(out, expected, `${name}: pre-existing check did not fire:\n${out}`);
  }
});

// ------------------------------------------------------------------ prose discipline

test('the prose does not re-teach a single tell the binary already catches', () => {
  // Criterion 11 mechanised. Prose may SAY that the checker covers something; what it may not do
  // is restate the pattern as a rule the agent has to remember, which is the duplication P5 bans.
  const rows = parseTellTable(read(VERIFY));
  const prose = [SKILL, TELLS_REF].filter(existsSync).map(read).join('\n');
  for (const r of rows) {
    if (r.pattern.length < 4) continue; // too short to search for meaningfully
    const literal = r.pattern.replace(/[[\]().*+?^$|\\{}]/g, '');
    if (literal.length < 4) continue;
    const asRule = new RegExp(`^[-*|].*${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im');
    assert.doesNotMatch(
      prose,
      asRule,
      `"${literal}" (row ${r.id}) is taught in prose AND checked by the binary — pick one`,
    );
  }
});

test('the judgement-only tells reference exists and stays short', () => {
  assert.ok(existsSync(TELLS_REF), 'references/ai-tells.md must exist');
  const lines = read(TELLS_REF).split('\n').length;
  assert.ok(lines <= 90, `ai-tells.md is ${lines} lines — the corpus was copied, not split (P5)`);
});

test('the description does not grow by one byte', () => {
  const desc = read(SKILL).match(/^description:\s*(.*)$/m)[1].trim();
  assert.ok(
    Buffer.byteLength(desc, 'utf8') <= DESCRIPTION_BYTES_BEFORE,
    `description grew to ${Buffer.byteLength(desc, 'utf8')} bytes (was ${DESCRIPTION_BYTES_BEFORE})`,
  );
});

test('the borrowed material is credited to its MIT source', () => {
  const prose = [SKILL, TELLS_REF].filter(existsSync).map(read).join('\n');
  assert.match(prose, /taste-skill/i, 'the absorbed corpus must credit Leonxlnx/taste-skill');
  assert.match(prose, /MIT/, 'the licence must be named');
});

test('the three content gaps got closed', () => {
  const systems = join(HERE, '..', 'skills', 'design', 'references', 'design-systems.md');
  assert.ok(existsSync(systems), 'references/design-systems.md must exist');
  const sys = read(systems);
  for (const pkg of ['govuk-frontend', 'polaris', 'carbon']) {
    assert.match(sys, new RegExp(pkg, 'i'), `the official-package map must name ${pkg}`);
  }
  const motion = read(join(HERE, '..', 'skills', 'design', 'references', 'motion-and-interaction.md'));
  assert.match(motion, /ScrollTrigger|scroll-driven/i, 'the escalation path must be documented');
  assert.match(motion, /addEventListener\('scroll'\)|addEventListener\("scroll"\)/, 'the banned listener must be named');

  const skill = read(SKILL);
  assert.match(skill, /theme.*lock|lock.*theme/i, 'the theme lock must be declared');
  assert.match(skill, /accent/i, 'the accent lock must be declared as judgement');
});
