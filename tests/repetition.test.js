import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseGapLog, similarity, terms, groupProcedures, decideOffer, recommendKind, mergeLogs,
  THRESHOLD, GROUP_AT, UNCERTAIN_AT,
} from '../scripts/lib/repetition.js';
import { repetitionReport } from '../scripts/lib/repetition-report.js';
import { GAP_VERDICTS, globalGapLogPath, repoNameOf, appendGap, gapLogPath } from '../scripts/lib/capabilities.js';

// The always-on rule asks "was that a repeatable procedure?" about ONE episode, judged by the agent that
// just did it. Nothing looked backwards. The evidence is the session that wrote the spec: four manual
// mutation runs and five identical score-then-rescore passes, none of which ever triggered it.
// Spec: 02-DOCS/wiki/sdd/specs/repetition-detector.md
//
// Both directions on every rule (v1.0.17): it must fire when it should AND stay silent when it should
// not. For a detector whose whole risk is nagging, the silence half is the important half.

// The real descriptions from that session, written differently each time because they were.
const MUTATION_RUNS = [
  'planté ocho mutantes a mano sobre el fichero de test y conté los muertos',
  'plantar diecisiete mutantes a mano y correr la suite por cada uno, restaurando con git',
  'planté doce mutantes a mano, corrí la suite y restauré cada uno',
];
const OTHER = [
  'escribir la fila del índice del wiki',
  'correr el linter del catálogo y leer el informe',
];
const entry = (date, procedure, verdict = 'proposed-accepted', repo = null) => ({ date, procedure, verdict, repo, line: 1 });
const line = (date, procedure, verdict = 'proposed-accepted', repo = null) =>
  `- ${date} · ${procedure}${repo ? ` · [repo:${repo}]` : ''} · **${verdict}**`;

// ------------------------------------------------------------------ parsing

test('parseGapLog reads the existing line format, repo tag included', () => {
  const log = ['# header', '', line('2026-08-17', 'hacer algo'), line('2026-08-18', 'otra cosa', 'proposed-declined', 'mi-repo'), 'prose that is not an entry'].join('\n');
  const e = parseGapLog(log);
  assert.equal(e.length, 2);
  assert.equal(e[0].procedure, 'hacer algo');
  assert.equal(e[0].repo, null);
  assert.equal(e[1].verdict, 'proposed-declined');
  assert.equal(e[1].repo, 'mi-repo');
});

test('parseGapLog skips malformed lines instead of guessing at them', () => {
  assert.deepEqual(parseGapLog('- not a date · x · **v**\n- 2026-13-99 · y'), []);
});

// ------------------------------------------------------------------ similarity, both directions

test('similarity groups real paraphrases of the SAME procedure above the threshold', () => {
  for (let i = 0; i < MUTATION_RUNS.length; i++) {
    for (let j = i + 1; j < MUTATION_RUNS.length; j++) {
      const s = similarity(MUTATION_RUNS[i], MUTATION_RUNS[j]);
      assert.ok(s >= GROUP_AT, `"${MUTATION_RUNS[i]}" vs "${MUTATION_RUNS[j]}" = ${s.toFixed(2)} < ${GROUP_AT}`);
    }
  }
});

test('similarity keeps DIFFERENT procedures below the threshold — the silence half', () => {
  const pairs = [...OTHER.flatMap((o) => MUTATION_RUNS.map((m) => [o, m])), [OTHER[0], OTHER[1]]];
  for (const [a, b] of pairs) {
    const s = similarity(a, b);
    assert.ok(s < GROUP_AT, `"${a}" vs "${b}" = ${s.toFixed(2)} >= ${GROUP_AT} — would fire a false offer`);
  }
});

test('numerals and filler are dropped: eight mutants and twelve mutants are the same work', () => {
  assert.ok(!terms('planté ocho mutantes').has('ocho'));
  assert.ok(terms('planté ocho mutantes').has('mutant'));
  assert.equal(similarity('', 'algo'), 0, 'empty input scores nothing rather than dividing by zero');
});

// ------------------------------------------------------------------ grouping

test('groupProcedures groups the three real runs and leaves the unrelated one alone', () => {
  const e = [...MUTATION_RUNS.map((p, i) => entry(`2026-08-1${i}`, p)), entry('2026-08-18', OTHER[0])];
  const { groups } = groupProcedures(e);
  assert.deepEqual(groups.map((g) => g.entries.length).sort((a, b) => b - a), [3, 1]);
});

test('the uncertain band does NOT group, and says what it refused to assume', () => {
  const { groups, uncertain } = groupProcedures(
    [
      entry('2026-08-17', 'plantar mutantes correr suite restaurar fichero'),
      entry('2026-08-18', 'plantar mutantes revisar informe wiki catalogo'),
    ],
    0.9, // force everything below the grouping bar so the near-miss lands in the band
  );
  assert.equal(groups.length, 2, 'below the bar it must stay two groups');
  assert.ok(uncertain.length >= 1, 'and the near-miss must be recorded, not silently dropped');
  assert.ok(uncertain[0].score >= UNCERTAIN_AT);
});

test('per-repo counts are kept so the offer can say WHERE it repeated', () => {
  const e = MUTATION_RUNS.map((p, i) => entry(`2026-08-1${i}`, p, 'proposed-accepted', i === 2 ? 'otro' : 'aqui'));
  const { groups } = groupProcedures(e);
  const big = groups.find((g) => g.entries.length === 3);
  assert.deepEqual([...big.repos.entries()].sort(), [['aqui', 2], ['otro', 1]]);
});

// ------------------------------------------------------------------ the offer, both directions

const groupsOf = (procs, verdicts = []) =>
  groupProcedures(procs.map((p, i) => entry(`2026-08-1${i}`, p, verdicts[i] || 'proposed-accepted'))).groups;

test('decideOffer fires at the threshold', () => {
  const { offer } = decideOffer({ groups: groupsOf(MUTATION_RUNS) });
  assert.ok(offer);
  assert.equal(offer.seen, 3);
  assert.equal(offer.threshold, THRESHOLD);
});

test('decideOffer stays SILENT below the threshold', () => {
  const { offer, reason } = decideOffer({ groups: groupsOf(MUTATION_RUNS.slice(0, 2)) });
  assert.equal(offer, null);
  assert.match(reason, /umbral/);
});

test('decideOffer stays silent forever after a decline', () => {
  // A "no" that has to be repeated every week is what makes someone switch the harness off.
  const { offer } = decideOffer({ groups: groupsOf(MUTATION_RUNS, ['proposed-accepted', 'proposed-declined', 'proposed-accepted']) });
  assert.equal(offer, null);
});

test('decideOffer stays silent when the thing is already covered', () => {
  const { offer, reason } = decideOffer({ groups: groupsOf(MUTATION_RUNS), covered: true });
  assert.equal(offer, null);
  assert.match(reason, /ya cubierto/);
});

// ------------------------------------------------------------------ what to recommend

test('recommendKind picks capability for execute-and-compare work, and says why', () => {
  const r = recommendKind(MUTATION_RUNS[0]);
  assert.equal(r.kind, 'capability');
  assert.match(r.why, /script|hook/);
});

test('recommendKind picks agent for look-without-inheriting-context work', () => {
  assert.equal(recommendKind('refutar la revisión con contexto fresco').kind, 'agent');
});

test('recommendKind falls back to skill, and capability beats skill when both could apply', () => {
  assert.equal(recommendKind('explicar al usuario cómo estructurar una spec').kind, 'skill');
  // "correr" makes it executable work even though "explicar" would read as guidance.
  assert.equal(recommendKind('explicar y correr la comparación de cifras').kind, 'capability');
});

// ------------------------------------------------------------------ the sixth verdict

test('the registry gained a verdict for "needs an executable capability"', () => {
  assert.ok(GAP_VERDICTS.includes('proposed-capability'));
  // Additive: the original five must keep validating, or every existing caller breaks.
  for (const v of ['covered-installed', 'covered-catalog', 'covered-agent', 'proposed-accepted', 'proposed-declined']) {
    assert.ok(GAP_VERDICTS.includes(v), `${v} must survive`);
  }
});

// ------------------------------------------------------------------ merging and I/O

test('mergeLogs sums local and global without double-counting a double write', () => {
  const a = [entry('2026-08-17', 'x'), entry('2026-08-18', 'y')];
  const b = [entry('2026-08-17', 'x'), entry('2026-08-19', 'z')];
  assert.equal(mergeLogs(a, b).length, 3);
});

test('appendGap writes both logs, and tags the global one with the repo', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rd-cwd-'));
  const home = mkdtempSync(join(tmpdir(), 'rd-home-'));
  appendGap({ procedure: 'planté mutantes a mano', verdict: 'proposed-capability', cwd, home });
  const local = parseGapLog(readFileSync(gapLogPath(cwd), 'utf8'));
  const global = parseGapLog(readFileSync(globalGapLogPath(home), 'utf8'));
  assert.equal(local.length, 1);
  assert.equal(global.length, 1);
  assert.equal(global[0].repo, repoNameOf(cwd), 'the global entry must say which repo it came from');
  assert.equal(local[0].repo, null, 'the local log needs no tag — it is the repo');
});

test('repetitionReport is silent with no registry, and BLOCKS on an unreadable one', () => {
  const empty = mkdtempSync(join(tmpdir(), 'rd-empty-'));
  const r = repetitionReport({ cwd: empty, home: empty });
  assert.equal(r.blocked, false);
  assert.equal(r.offer, null);

  // A directory where a file is expected: reading it throws → blocked, never an invented count.
  const bad = mkdtempSync(join(tmpdir(), 'rd-bad-'));
  mkdirSync(join(bad, '.rsc', 'automation-gaps.md'), { recursive: true });
  const r2 = repetitionReport({ cwd: bad, home: bad });
  assert.equal(r2.blocked, true);
  assert.match(r2.reason, /no se pudo leer/);
  assert.equal(r2.offer, null);
});

test('repetitionReport end to end: the real case offers a capability, across repos', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'rd-e2e-'));
  const home = mkdtempSync(join(tmpdir(), 'rd-e2e-home-'));
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  mkdirSync(join(home, '.rsc'), { recursive: true });
  writeFileSync(gapLogPath(cwd), [line('2026-08-17', MUTATION_RUNS[0]), line('2026-08-17', MUTATION_RUNS[1])].join('\n') + '\n');
  writeFileSync(globalGapLogPath(home), line('2026-08-18', MUTATION_RUNS[2], 'proposed-accepted', 'otro-repo') + '\n');
  const r = repetitionReport({ cwd, home });
  assert.equal(r.blocked, false);
  assert.ok(r.offer, 'three sightings across two repos must reach the threshold');
  assert.equal(r.offer.seen, 3);
  assert.equal(r.offer.kind, 'capability');
  assert.ok(r.offer.repos.some((x) => x.repo === 'otro-repo'), 'the cross-repo sighting is the point');
});
