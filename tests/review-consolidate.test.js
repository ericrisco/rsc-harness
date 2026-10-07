import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFindings, consolidate, normalizeSeverity } from '../scripts/lib/review-findings.js';
import { agentByName, agentNames } from '../targets/agents.js';

// ECC idea 2 (orch-review), adapted: the refuter panel reports one defect several ways, and a lens can
// overstate. Grouping is deterministic and lives in the binary (P1); the verifier is judgement and
// lives in an agent. A gate nobody has seen both fail and pass is not a gate (P2), so every grouping
// rule below is pinned in both directions.
// FTD: 02-DOCS/wiki/ftd/review-verifier.md
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const RSC = join(REPO, 'scripts', 'rsc.js');
const tmp = () => mkdtempSync(join(tmpdir(), 'rc-'));
const f = (o) => ({ lens: 'correctness', severity: 'blocker', file: 'src/a.js', line: 10, claim: 'null user dereference crashes the handler', failure_scenario: 'request without session -> TypeError 500', evidence: '', ...o });
const report = (lens, findings) => `# ${lens} lens\n\nAttacked: everything.\n\n\`\`\`json findings\n${JSON.stringify(findings)}\n\`\`\`\n`;

// ------------------------------------------------------------------ grouping, both directions

test('three lenses on the same line collapse to one finding that keeps every lens', () => {
  const r = consolidate([
    f({ lens: 'correctness', line: 10, claim: 'null user dereference crashes the handler' }),
    f({ lens: 'security', line: 12, severity: 'should-fix', claim: 'handler crashes on a null user, leaking a 500' }),
    f({ lens: 'tests', line: 9, severity: 'nit', claim: 'no test covers the null user handler crash' }),
  ]);
  assert.equal(r.reported, 3);
  assert.equal(r.unique, 1);
  const [one] = r.findings;
  assert.equal(one.severity, 'blocker', 'the highest severity wins');
  assert.deepEqual(one.lenses, ['correctness', 'security', 'tests']);
  assert.deepEqual(one.lines, [9, 12]);
  assert.equal(one.claims.length, 3, 'no claim is lost in the merge');
  assert.equal(one.verify, true);
});

test('the same file far apart, or another file on the same line, stays separate', () => {
  const r = consolidate([
    f({ line: 10 }), f({ line: 40 }), f({ file: 'src/b.js', line: 10 }),
  ]);
  assert.equal(r.unique, 3);
});

test('near each other but saying different things stays separate — the real panel run', () => {
  // The first real run: three lenses, six findings, two DIFFERENT defects on adjacent lines. Grouping
  // by place alone merged them into one, and the 0..100 check vanished into an "also:" line.
  const run = JSON.parse(readFileSync(join(REPO, 'tests', 'fixtures', 'review-panel-run.json'), 'utf8'));
  const r = consolidate(run.findings);
  assert.equal(r.reported, 6);
  assert.equal(r.unique, 3);
  const claims = r.findings.map((x) => x.claims.join(' '));
  assert.ok(claims.some((c) => /first unit|one unit/i.test(c) && !/validated/i.test(c)), 'the planted bug, alone');
  assert.ok(claims.some((c) => /validated/i.test(c) && !/one unit/i.test(c)), 'the range check, alone');
  assert.equal(r.findings[0].lenses.length, 3, 'all three lenses found the planted bug');
  assert.equal(consolidate([f({ line: 10 }), f({ line: 11, claim: 'discountPct is not validated to 0..100', failure_scenario: 'pct 150 -> negative total' })]).unique, 2);
});

test('the window edge: 3 lines apart merges, 4 does not; --window 0 only merges the exact line', () => {
  assert.equal(consolidate([f({ line: 10 }), f({ line: 13 })]).unique, 1);
  assert.equal(consolidate([f({ line: 10 }), f({ line: 14 })]).unique, 2);
  assert.equal(consolidate([f({ line: 10 }), f({ line: 11 })], { window: 0 }).unique, 2);
  assert.equal(consolidate([f({ line: 10 }), f({ line: 10 })], { window: 0 }).unique, 1);
});

test('identical quoted evidence merges across files; short or different evidence does not', () => {
  const ev = 'db.execute(`SELECT * FROM t WHERE id=${id}`)';
  assert.equal(consolidate([f({ file: 'a.js', line: 1, evidence: ev }), f({ file: 'b.js', line: 90, evidence: `  ${ev.toUpperCase()} ` })]).unique, 1);
  assert.equal(consolidate([f({ file: 'a.js', line: 1, evidence: 'x = 1' }), f({ file: 'b.js', line: 90, evidence: 'x = 1' })]).unique, 2, 'too short to be the same defect');
  assert.equal(consolidate([f({ file: 'a.js', line: 1, evidence: ev }), f({ file: 'b.js', line: 90, evidence: `${ev};` })]).unique, 2);
});

test('the worked example: eleven reports become four, highest severity first', () => {
  const r = consolidate([
    f({ lens: 'correctness', file: 'api/auth.js', line: 40 }), f({ lens: 'security', file: 'api/auth.js', line: 41 }), f({ lens: 'tests', file: 'api/auth.js', line: 42, severity: 'should-fix' }),
    f({ lens: 'correctness', file: 'api/orders.js', line: 88, severity: 'should-fix' }), f({ lens: 'tests', file: 'api/orders.js', line: 90, severity: 'should-fix' }),
    f({ lens: 'security', file: 'lib/log.js', line: 5, severity: 'should-fix' }), f({ lens: 'correctness', file: 'lib/log.js', line: 7, severity: 'nit' }), f({ lens: 'tests', file: 'lib/log.js', line: 6, severity: 'nit' }),
    f({ lens: 'tests', file: 'README.md', line: 3, severity: 'nit' }), f({ lens: 'correctness', file: 'README.md', line: 4, severity: 'nit' }), f({ lens: 'security', file: 'README.md', line: 2, severity: 'nit' }),
  ]);
  assert.equal(r.reported, 11);
  assert.equal(r.unique, 4);
  assert.deepEqual(r.findings.map((x) => [x.id, x.severity, x.file]), [
    ['F1', 'blocker', 'api/auth.js'], ['F2', 'should-fix', 'api/orders.js'], ['F3', 'should-fix', 'lib/log.js'], ['F4', 'nit', 'README.md'],
  ]);
  assert.equal(r.toVerify, 3, 'blockers and should-fix go to the verifier; nits do not');
});

// ------------------------------------------------------------------ the pre-report gate, checked

test('a blocker with no location or no failure scenario is a question, and says why', () => {
  const r = consolidate([f({ line: null }), f({ file: 'x.js', line: 3, failure_scenario: '' })]);
  for (const x of r.findings) {
    assert.equal(x.severity, 'question');
    assert.equal(x.verify, false);
    assert.match(x.notes.join(' '), /→ question/);
  }
  assert.equal(consolidate([f({})]).findings[0].severity, 'blocker', 'a complete blocker keeps its severity');
});

test('severity words: the canonical four, the HIGH/CRITICAL family, and an unknown word', () => {
  assert.equal(normalizeSeverity('should-fix'), 'should-fix');
  assert.equal(normalizeSeverity('CRITICAL'), 'blocker');
  assert.equal(normalizeSeverity('Should Fix'), 'should-fix');
  assert.equal(normalizeSeverity('low'), 'nit');
  assert.equal(normalizeSeverity('spicy'), null);
  assert.equal(consolidate([f({ severity: 'spicy' })]).findings[0].severity, 'question');
});

// ------------------------------------------------------------------ parsing what the lenses emit

test('parses fenced blocks from a lens report, plain JSON, and reports what it could not read', () => {
  const md = report('security', [f({ lens: 'security' })]) + '\n```json findings\n[]\n```\n';
  assert.equal(parseFindings(md, 'sec.md').findings.length, 1, 'an empty block is a valid "found nothing"');
  assert.equal(parseFindings(JSON.stringify({ findings: [f({}), f({})] })).findings.length, 2);
  const bad = parseFindings('```json findings\n[{oops\n```\n', 'bad.md');
  assert.equal(bad.findings.length, 0);
  assert.match(bad.errors[0], /bad\.md block 1: not valid JSON/);
  assert.match(parseFindings('just prose, no block', 'p.md').errors[0], /no ```json findings block/);
});

// ------------------------------------------------------------------ the CLI

test('rsc review consolidate: files in, ranked report out, --json for machines', () => {
  const d = tmp();
  writeFileSync(join(d, 'c.md'), report('correctness', [f({ lens: 'correctness', line: 10 })]));
  writeFileSync(join(d, 's.md'), report('security', [f({ lens: 'security', line: 11 })]));
  writeFileSync(join(d, 't.md'), report('tests', []));
  const human = spawnSync('node', [RSC, 'review', 'consolidate', 'c.md', 's.md', 't.md'], { cwd: d, encoding: 'utf8' });
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /2 finding\(s\) reported → 1 unique · 1 go to finding-verifier/);
  assert.match(human.stdout, /F1 \[blocker\] src\/a\.js:10-11/);
  const json = spawnSync('node', [RSC, 'review', 'consolidate', 'c.md', 's.md', '--json', '--window', '0'], { cwd: d, encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).unique, 2, '--window 0 is honoured and not read as a file');
});

test('rsc review consolidate: stdin works, an unreadable block fails loudly, bad usage exits non-zero', () => {
  const d = tmp();
  const viaStdin = spawnSync('node', [RSC, 'review', 'consolidate'], { cwd: d, encoding: 'utf8', input: JSON.stringify([f({})]) });
  assert.equal(viaStdin.status, 0, viaStdin.stderr);
  assert.match(viaStdin.stdout, /1 finding\(s\) reported/);
  writeFileSync(join(d, 'bad.md'), '```json findings\n[{\n```\n');
  const bad = spawnSync('node', [RSC, 'review', 'consolidate', 'bad.md'], { cwd: d, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /not valid JSON/);
  assert.equal(spawnSync('node', [RSC, 'review', 'tally'], { cwd: d, encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync('node', [RSC, 'review', 'consolidate', 'missing.md'], { cwd: d, encoding: 'utf8' }).status, 1);
  assert.equal(spawnSync('node', [RSC, 'review', 'consolidate', '--window', '-2'], { cwd: d, encoding: 'utf8', input: '[]' }).status, 1);
});

// ------------------------------------------------------------------ the agents and the skill agree

test('every refuter is told the findings shape, and the verifier ships with its three verdicts', () => {
  assert.ok(agentNames().includes('finding-verifier'));
  for (const name of ['refuter-correctness', 'refuter-security', 'refuter-tests']) {
    const body = agentByName(name).body;
    assert.match(body, /```json findings/, `${name} must emit the consolidable shape`);
    assert.match(body, /"failure_scenario"/, name);
  }
  const v = agentByName('finding-verifier').body;
  for (const verdict of ['CONFIRMED', 'REFUTED', 'UNPROVEN']) assert.match(v, new RegExp(`\\*\\*${verdict}\\*\\*`));
  assert.match(v, /prove it false/);
  assert.match(v, /edit no file/);
});

test('the review skill runs consolidate before the filters, and only CONFIRMED evidence blocks', () => {
  const skill = readFileSync(join(REPO, 'skills', 'review', 'SKILL.md'), 'utf8');
  const consolidateAt = skill.indexOf('rsc review consolidate');
  const filtersAt = skill.indexOf('A finding blocks only if it survives all three filters');
  assert.ok(consolidateAt > 0 && consolidateAt < filtersAt, 'consolidation must come before the blocking filters');
  assert.match(skill, /`finding-verifier`[^]*\*\*CONFIRMED\*\*/);
  assert.match(skill.slice(filtersAt), /Evidence\*\* — `finding-verifier` returned \*\*CONFIRMED\*\*/);
});
