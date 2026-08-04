import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { holdoutGate, scoreFromRaw, LIFT_MIN } from '../scripts/lib/behavior-score.js';

// The hold-out guard of skill-harden used to be decorative: the workflow generated a fresh
// scenario, ran it, scored it, and threw the result away, while the rubric promised "the hold-out
// score must also improve". Ninth appearance of the pattern constitution P2 exists to kill, and the
// most expensive one — the affected mechanism decides what enters a 258-skill catalog.
// See 02-DOCS/wiki/sdd/specs/generalization-gate.md.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(ROOT, 'scripts/skill-harden.workflow.js'), 'utf8');
const rubric = readFileSync(join(ROOT, 'scripts/skill-harden-rubric.md'), 'utf8');
const CLI = join(ROOT, 'scripts/skill-behavior-eval.js');

// One graded scenario, built from the grader signals the eval engine actually emits.
// composeOutputScore = 0.6 * (satisfied/total * 10) + 0.4 * mean(quality).
const grade = (satisfied, total, q) => ({
  mustInclude: Array.from({ length: total }, (_, i) => ({ item: `i${i}`, satisfied: i < satisfied, evidence: '' })),
  quality: { completeness: q[0], actionability: q[1], correctness: q[2], grounding: q[3] },
});
const raw = (treatment, baseline) => ({
  skillId: 'holdout-probe',
  scenarios: [{ index: 0, xIsTreatment: true, gradeX: treatment, gradeY: baseline }],
});

// treatment 5.4 vs baseline 9.2 -> lift -3.8
const REGRESSED = raw(grade(1, 2, [6, 6, 6, 6]), grade(2, 2, [8, 8, 8, 8]));
// identical grades -> lift exactly 0
const FLAT = raw(grade(2, 2, [8, 8, 8, 8]), grade(2, 2, [8, 8, 8, 8]));
// treatment 9.2 vs baseline 8.9 -> lift +0.3 (deliberately BELOW the main gate's LIFT_MIN)
const TRANSFERRED = raw(grade(2, 2, [8, 8, 8, 8]), grade(2, 2, [7, 7, 7, 8]));

const gateOf = (r) => holdoutGate(scoreFromRaw(r));

// ---------------------------------------------------------------- the pure decision (criteria 1-3, 6)

test('holdoutGate blocks a measured regression', () => {
  const g = gateOf(REGRESSED);
  assert.equal(g.verdict, 'block');
  assert.equal(g.kind, 'regression');
  assert.equal(g.lift, -3.8);
  assert.ok(g.reason.length > 0, 'a block always carries its reason');
});

test('holdoutGate blocks a flat hold-out: the bar is "beats no-skill", not "does not worsen"', () => {
  const g = gateOf(FLAT);
  assert.equal(g.verdict, 'block');
  assert.equal(g.kind, 'regression');
  assert.equal(g.lift, 0);
});

test('holdoutGate passes a small positive lift, below the main gate on purpose', () => {
  const g = gateOf(TRANSFERRED);
  assert.equal(g.verdict, 'pass');
  assert.equal(g.kind, 'transfer');
  assert.equal(g.lift, 0.3);
  // The spec picks "clear regression" over the main gate's threshold: one fresh scenario graded
  // once is noisy, so only the unambiguous signal acts. Guard the deliberate difference.
  assert.ok(g.lift < LIFT_MIN, 'hold-out must not inherit LIFT_MIN');
});

test('holdoutGate fails closed and distinguishes indeterminate from regression', () => {
  for (const input of [undefined, null, { aggregate: { absoluteScore: null, lift: null, n: 0, dropped: 2 } }]) {
    const g = holdoutGate(input);
    assert.equal(g.verdict, 'block', `${JSON.stringify(input)} must block`);
    assert.equal(g.kind, 'indeterminate');
    assert.notEqual(g.kind, 'regression');
  }
  // A scenario the engine dropped is indeterminate, never a measured regression.
  const dropped = holdoutGate(scoreFromRaw({ skillId: 'x', scenarios: [{ index: 0, error: 'grade-failed' }] }));
  assert.equal(dropped.kind, 'indeterminate');
});

test('holdoutGate is deterministic: same signals, same verdict, no model call', () => {
  assert.deepEqual(gateOf(REGRESSED), gateOf(REGRESSED));
  assert.deepEqual(gateOf(TRANSFERRED), gateOf(TRANSFERRED));
});

// ---------------------------------------------------------------- the CLI contract (criteria 1-3)

const runCli = (mode, payload) =>
  spawnSync(process.execPath, [CLI, mode, '-'], { input: payload, encoding: 'utf8' });

test('--holdout exits 1 on a block and names the verdict', () => {
  const r = runCli('--holdout', JSON.stringify(REGRESSED));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /BLOCK/i);
  assert.match(r.stdout, /regression/i);
});

test('--holdout exits 0 on a pass', () => {
  const r = runCli('--holdout', JSON.stringify(TRANSFERRED));
  assert.equal(r.status, 0);
  assert.match(r.stdout, /PASS/i);
});

test('--holdout exits 2 on unparseable input', () => {
  assert.equal(runCli('--holdout', 'not json').status, 2);
});

test('--score keeps its own contract untouched', () => {
  // TRANSFERRED has absolute 9.2 but lift 0.3 -> the MAIN gate must still fail it.
  const r = runCli('--score', JSON.stringify(TRANSFERRED));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Behavioral scorecard/);
});

// ---------------------------------------------------------------- the wiring (criteria 4, 5, 7)

test('a blocking hold-out reverts the round edit', () => {
  // Must live in the hold-out BLOCK branch specifically. Slicing from `holdoutVerdict` would pass on
  // the diff judge's pre-existing revert, which is exactly the bug this test exists to catch.
  const i = workflow.indexOf("verdict.verdict === 'block'");
  assert.ok(i > 0, 'the block branch exists and is keyed on the CLI verdict');
  const branch = workflow.slice(i, workflow.indexOf('round++', i));
  assert.match(branch, /git checkout --/, 'the block path reverts');
  assert.match(branch, /SKILL\.md/, 'reverts the body');
  assert.match(branch, /references/, 'reverts the references');
  // The verdict must be recorded before it is acted on, or a blocked round leaves no trace.
  assert.ok(workflow.indexOf('lastFixHoldout =') < i, 'the verdict is recorded before the revert');
});

test('the commit is gated on the hold-out of the last applied edit', () => {
  // This is the assertion that fails on the original code: the workflow ran the hold-out and the
  // commit condition never mentioned it.
  assert.match(workflow, /lastFixHoldout/, 'the last applied edit\'s verdict is tracked');
  const commitIf = workflow.match(/if \(([^)]*passed[^)]*)\)/);
  assert.ok(commitIf, 'the commit condition exists');
  assert.match(commitIf[1], /holdoutClean/, 'and it consults the hold-out');
  assert.ok(
    workflow.indexOf('holdoutClean =') < workflow.indexOf(commitIf[0]),
    'holdoutClean is computed before the commit decides',
  );
});

test('the result reports the hold-out per round, and why a pass did not commit', () => {
  const tail = workflow.slice(workflow.lastIndexOf('return {'));
  assert.match(tail, /holdout/i, 'the returned object carries the hold-out record');
  assert.match(workflow, /notCommittedBecause|blockedBy/, 'a pass that did not commit says which condition failed');
});

// ------------------------------------------------- the third verdict (criteria 9, 10)

test('diagnosis can conclude the fix needs a capability the loop cannot write', () => {
  assert.match(workflow, /'skill', ?'eval', ?'capability'|"skill", ?"eval", ?"capability"/, 'the enum gained capability');
  assert.match(workflow, /missingCapability/, 'the verdict must name the capability');
  assert.match(workflow, /capability-out-of-reach/, 'and it is a distinct outcome, not a generic fail');
});

test('the capability verdict edits nothing', () => {
  // Everything between the capability branch and the next branch must not touch skill files.
  const i = workflow.indexOf("fault.fault === 'capability'");
  assert.ok(i > 0, 'the capability branch exists');
  const branch = workflow.slice(i, workflow.indexOf("fault.fault === 'skill'", i));
  assert.doesNotMatch(branch, /Edit tool|APPLY the edit|Apply the edits/i, 'no edit is applied');
});

test('the default bias still favours blaming the skill', () => {
  assert.match(workflow, /Default to 'skill' when unsure/, 'blaming anything else stays the harder path');
});

// ------------------------------------------- the ex-ante gate + rubric truth (criteria 8, 11)

test('the fixer is constrained BEFORE it writes, not only judged after', () => {
  // The constraint must be inside the fixer's OWN prompt — the agent that writes the edit — not only
  // in the judge that runs afterwards. Bound the region to that single agent() call.
  const start = workflow.indexOf('must genuinely cover this mustFix');
  const end = workflow.indexOf('`fix:r', start);
  assert.ok(start > 0 && end > start, 'the fixer prompt exists and ends at its own label');
  const fixerRegion = workflow.slice(start, end);
  assert.match(fixerRegion, /never seen|unseen/i, 'the litmus test travels with the instruction');
  assert.match(fixerRegion, /applicability|criterion/i, 'a principle carries its applicability');
  assert.match(fixerRegion, /Generalization gate/i, 'and it points at the rubric section that defines it');
  assert.match(fixerRegion, /Banned|banned/, 'the ban is stated, not implied');
  // Named mechanism, stated as a check rather than a suggestion. Softening "Litmus test before every
  // line" into "consider whether…" is a real regression: it turns the gate back into advice.
  assert.match(fixerRegion, /Litmus test/i, 'the check is named, as the rubric names it');
  assert.match(fixerRegion, /HARD CONSTRAINT|must/, 'and it binds rather than suggests');
  // The ex-ante gate must precede the diff judge in the loop, or it is not ex-ante.
  assert.ok(end < workflow.indexOf('diff-judge'), 'the fixer is constrained before the judge runs');
});

test('the rubric defines the ex-ante gate it now claims', () => {
  assert.match(rubric, /Generalization gate/i);
  assert.match(rubric, /Litmus test/i, 'the named check the fixer prompt invokes');
  assert.match(rubric, /never seen|unseen/i, 'the litmus test is written down');
  assert.match(rubric, /applicability/i, 'so is the "criterion, not answer" rule');
  assert.match(rubric, /ex-ante|before the edit/i, 'and that it binds before the edit, not after');
});

test('every guard the rubric calls mandatory has a mechanism in the loop', () => {
  // Constitution P2: a rule declared binding is born with the check, and with the test that checks
  // the check. This is that test — it fails the moment the rubric promises a guard the code lacks.
  const guards = [
    { claim: /Diff judge/i, mechanism: /diff-judge/ },
    { claim: /Hold-out/i, mechanism: /--holdout/ },
    { claim: /Generalization gate/i, mechanism: /Generalization gate/ },
  ];
  for (const g of guards) {
    assert.match(rubric, g.claim, 'the rubric declares this guard');
    assert.match(workflow, g.mechanism, `the loop implements the guard matching ${g.claim}`);
  }
});

test('the rubric states that a main-gate pass with a red hold-out does not ship', () => {
  assert.match(rubric, /does not commit|no commit|never commits/i);
});
