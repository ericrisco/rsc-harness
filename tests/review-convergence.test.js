import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as L from '../scripts/lib/review-ledger.js';
import { consolidate } from '../scripts/lib/review-findings.js';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '../scripts/rsc.js');
const repo = () => mkdtempSync(join(tmpdir(), 'rsc-review-convergence-'));
const run = (root, ...args) => spawnSync(process.execPath, [CLI, 'review', 'ledger', ...args], { cwd: root, encoding: 'utf8' });
const findings = [
  'branchless syntax does not establish JIT-generated instruction timing',
  'allocation and garbage collection invalidate the source-level runtime guarantee',
  'hardware cache access duration varies with secret data placement',
];
const finding = (i, extra = {}) => ({ file: 'src/auth.js', line: 10 + i, claim: findings[i], severity: 'question', lens: 'tests', criterion: 'AC-constant-time', ...extra });
const task = 'login/T1';

test('panel-only CLI callers share the three-round budget; a fourth panel is not recorded', () => {
  const root = repo();
  for (let i = 0; i < 3; i++) assert.equal(run(root, 'panel', task, '--lenses', 'correctness,security,tests').status, 0);
  const before = readFileSync(join(root, L.LEDGER_PATH), 'utf8');
  const fourth = run(root, 'panel', task, '--lenses', 'correctness,security,tests');
  assert.equal(fourth.status, 1);
  assert.match(fourth.stdout, /spec|criterion/i);
  assert.equal(readFileSync(join(root, L.LEDGER_PATH), 'utf8'), before);
  assert.equal(run(root, 'round', task).status, 1, 'round cannot bypass three panels');
  assert.equal(run(root, 'panel', 'login/T2', '--lenses', 'tests').status, 0);
});

test('round-record-panel consumes one round, not two; invalid panels consume none', () => {
  const root = repo();
  assert.equal(L.panel(root, task, '').ok, false);
  assert.equal(L.panel(root, 'bare', 'tests').ok, false);
  for (let i = 1; i <= 3; i++) {
    assert.equal(L.round(root, task).round, i);
    L.record(root, [finding(0)], { task });
    assert.equal(L.panel(root, task, 'tests').ok, true);
  }
  assert.equal(L.round(root, task).ok, false);
  assert.equal(L.panel(root, task, 'tests').ok, false);
  assert.equal(L.stats(root).meanRounds, 3);
});

test('legacy panels and explicit rounds count together without resetting historical budgets', () => {
  const root = repo();
  L.record(root, [], { task });
  writeFileSync(join(root, L.LEDGER_PATH), [
    { type: 'round', task, n: 1 }, { type: 'panel', task, lenses: ['tests'] },
    { type: 'panel', task, lenses: ['tests'] }, { type: 'round', task, n: 2 },
  ].map(JSON.stringify).join('\n') + '\n');
  assert.equal(L.panel(root, task, 'tests').ok, true, 'completes pending third effective round');
  assert.equal(L.round(root, task).ok, false);
  assert.equal(L.panel(root, task, 'tests').ok, false);
});

test('distinct criterion objections in later rounds produce an advisory without closing findings', () => {
  const root = repo();
  L.round(root, task);
  const first = L.record(root, [finding(0)], { task });
  assert.equal(first[0].status, 'new');
  assert.equal(L.stats(root).criterionSignals.length, 0);
  L.round(root, task);
  const second = L.record(root, [finding(1)], { task });
  assert.equal(second[0].status, 'new');
  assert.equal(second[0].advisories.length, 1);
  const [signal] = L.stats(root).criterionSignals;
  assert.equal(signal.task, task);
  assert.equal(signal.criterion, 'AC-constant-time');
  assert.equal(signal.lens, 'tests');
  assert.deepEqual(signal.rounds, [1, 2]);
  assert.deepEqual(L.stats(root).open, ['L1', 'L2']);
  assert.match(L.renderStats(L.stats(root)), /possible.*criterion/i);
  assert.match(L.renderStats(L.stats(root)), /clarify|spec/i);
  assert.match(L.renderStats(L.stats(root)), /not.*proof|does not prove/i);
});

test('same-round findings and independent tasks, criteria and lenses do not trigger the advisory', () => {
  for (const variant of ['same-round', 'task', 'criterion', 'lens', 'metadata']) {
    const root = repo();
    L.round(root, task); L.record(root, [finding(0)], { task });
    const nextTask = variant === 'task' ? 'other/T1' : task;
    if (variant !== 'same-round') L.round(root, nextTask);
    const extra = variant === 'criterion' ? { criterion: 'AC-password' }
      : variant === 'lens' ? { lens: 'security' }
        : variant === 'metadata' ? { criterion: undefined, lens: undefined } : {};
    L.record(root, [finding(1, extra)], { task: nextTask });
    assert.deepEqual(L.stats(root).criterionSignals, [], variant);
  }
});

test('fixed regressions and repeated claims retain their existing semantics without proof-churn warnings', () => {
  const root = repo();
  L.round(root, task); L.record(root, [finding(0)], { task });
  L.outcome(root, 'L1', 'fixed');
  L.round(root, task);
  assert.equal(L.record(root, [finding(0)], { task })[0].status, 'new');
  assert.deepEqual(L.stats(root).criterionSignals, []);
  assert.equal(L.record(root, [finding(0)], { task })[0].status, 'repeat');
});

test('consolidation preserves actual criterion/lens pairs, never their Cartesian product', () => {
  const common = { claim: 'identical code defect', evidence: 'same sufficiently long quoted code evidence' };
  const merged = consolidate([finding(0, { ...common, criterion: 'AC1', lens: 'tests' }), finding(1, { ...common, criterion: 'AC2', lens: 'security' })]);
  assert.equal(merged.unique, 1);
  assert.deepEqual(merged.findings[0].criterion_refs, [{ criterion: 'AC1', lens: 'tests' }, { criterion: 'AC2', lens: 'security' }]);
  const root = repo(); L.round(root, task);
  assert.deepEqual(L.record(root, merged.findings, { task })[0].criterion_refs, merged.findings[0].criterion_refs);
  L.round(root, task); L.record(root, [finding(2, { criterion: 'AC1', lens: 'security' })], { task });
  assert.deepEqual(L.stats(root).criterionSignals, []);
});

test('CLI record and stats expose the advisory and retain JSON output shape', () => {
  const root = repo();
  for (let i = 0; i < 2; i++) {
    assert.equal(run(root, 'round', task).status, 0);
    writeFileSync(join(root, 'finding.json'), JSON.stringify([finding(i)]));
    const result = run(root, 'record', 'finding.json', '--task', task, ...(i === 0 ? ['--json'] : []));
    assert.equal(result.status, 0, result.stderr);
    if (i === 0) assert.ok(Array.isArray(JSON.parse(result.stdout)));
    else assert.match(result.stdout, /possible.*criterion/i);
    assert.equal(run(root, 'panel', task, '--lenses', 'correctness,security,tests').status, 0);
  }
  const stats = JSON.parse(run(root, 'stats', '--json').stdout);
  assert.equal(stats.criterionSignals.length, 1);
  assert.equal(stats.outcomes.open, 2);
});

test('real Git CLI: consolidation preserves recurrence metadata and panels never double-count explicit rounds', () => {
  const root = repo();
  const git = (...args) => {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'main');
  writeFileSync(join(root, 'README.md'), '# isolated review fixture\n');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  for (let i = 0; i < 3; i++) {
    assert.equal(run(root, 'round', task).status, 0);
    writeFileSync(join(root, 'lens.json'), JSON.stringify([finding(i)]));
    const consolidated = spawnSync(process.execPath, [CLI, 'review', 'consolidate', 'lens.json', '--json'], { cwd: root, encoding: 'utf8' });
    assert.equal(consolidated.status, 0, consolidated.stderr);
    writeFileSync(join(root, 'consolidated.json'), consolidated.stdout);
    const recorded = run(root, 'record', 'consolidated.json', '--task', task, '--json');
    assert.equal(recorded.status, 0, recorded.stderr);
    const [entry] = JSON.parse(recorded.stdout);
    assert.deepEqual(entry.criterion_refs, [{ criterion: 'AC-constant-time', lens: 'tests' }]);
    assert.equal(entry.round, i + 1);
    assert.equal(entry.advisories.length, i ? 1 : 0);
    assert.equal(run(root, 'panel', task, '--lenses', 'correctness,security,tests').status, 0);
  }
  const fourth = run(root, 'panel', task, '--lenses', 'correctness,security,tests');
  assert.equal(fourth.status, 1);
  const panels = L.readLedger(root).filter((e) => e.type === 'panel');
  assert.deepEqual(panels.map((e) => e.round), [1, 2, 3]);
  assert.ok(panels.every((e) => e.sha === head));
  assert.equal(L.stats(root).meanRounds, 3);
  assert.deepEqual(L.stats(root).open, ['L1', 'L2', 'L3']);
});

test('CLI record before panel binds findings to that panel without an explicit round', () => {
  const root = repo();
  for (let i = 0; i < 3; i++) {
    writeFileSync(join(root, 'finding.json'), JSON.stringify([finding(i)]));
    const result = run(root, 'record', 'finding.json', '--task', task, '--json');
    assert.equal(result.status, 0, result.stderr);
    const panel = run(root, 'panel', task, '--lenses', 'correctness,security,tests');
    assert.equal(panel.status, 0, panel.stderr);
    if (i) assert.match(panel.stdout, /possible.*criterion/i);
    assert.equal(L.stats(root).meanRounds, i + 1);
  }
  assert.deepEqual(L.stats(root).criterionSignals[0].rounds, [1, 2, 3]);
  assert.deepEqual(L.stats(root).open, ['L1', 'L2', 'L3']);
  assert.equal(run(root, 'panel', task, '--lenses', 'correctness,security,tests').status, 1);
});

test('pending findings bind together only on a valid panel; ambiguous legacy findings stay unassigned', () => {
  const root = repo();
  L.record(root, [], { task });
  writeFileSync(join(root, L.LEDGER_PATH), JSON.stringify({ type: 'finding', id: 'L1', task,
    file: 'src/auth.js', claim: findings[0], criterion_refs: [{ criterion: 'AC-constant-time', lens: 'tests' }] }) + '\n');
  L.panel(root, task, 'tests');
  L.record(root, [finding(1), finding(2)], { task });
  assert.equal(L.panel(root, task, '').ok, false);
  assert.deepEqual(L.stats(root).criterionSignals, []);
  L.panel(root, task, 'tests');
  assert.equal(L.stats(root).meanRounds, 2);
  assert.deepEqual(L.stats(root).criterionSignals, [], 'old missing round is not inferred; new findings share one round');
});

test('implement protocol round-panel-record keeps the explicit round active for findings', () => {
  const root = repo();
  for (let i = 0; i < 3; i++) {
    assert.equal(run(root, 'round', task).status, 0);
    assert.equal(run(root, 'panel', task, '--lenses', 'correctness,security,tests').status, 0);
    writeFileSync(join(root, 'finding.json'), JSON.stringify([finding(i)]));
    const result = run(root, 'record', 'finding.json', '--task', task, '--json');
    assert.equal(result.status, 0, result.stderr);
    const [recorded] = JSON.parse(result.stdout);
    assert.equal(recorded.round, i + 1);
    assert.equal(recorded.advisories.length, i ? 1 : 0);
    assert.equal(L.stats(root).meanRounds, i + 1);
  }
  assert.deepEqual(L.stats(root).criterionSignals[0].rounds, [1, 2, 3]);
  assert.equal(run(root, 'round', task).status, 1);
  assert.equal(run(root, 'panel', task, '--lenses', 'tests').status, 1);
});

test('a panel does not split findings within an explicit round; a later implicit panel clears that context', () => {
  const root = repo();
  L.round(root, task);
  L.record(root, [finding(0)], { task });
  L.panel(root, task, 'tests');
  assert.equal(L.record(root, [finding(1)], { task })[0].round, 1);
  assert.deepEqual(L.stats(root).criterionSignals, [], 'both claims belong to explicit round one');
  L.panel(root, task, 'tests');
  const [pending] = L.record(root, [finding(2)], { task });
  assert.equal(pending.round, undefined, 'new implicit round must not inherit explicit attribution');
  assert.equal(pending.round_pending, true);
  L.panel(root, task, 'tests');
  assert.deepEqual(L.stats(root).criterionSignals[0].rounds, [1, 3]);
  assert.equal(L.stats(root).meanRounds, 3);
});
